#!/usr/bin/env bash
# Deploy ShareCount with podman: the backend and its database (podman-compose)
# and the frontend (static files served by nginx).
#
# Steps: update the code, build the frontend (here, in a Node container, after
# running its tests), back up the database, rebuild and restart the backend,
# wait until it answers, then rsync the new frontend into the nginx root.
# Database migrations run at backend startup.
# Nothing visible changes until the frontend build is ready, and the frontend
# is only updated once the new backend is healthy. Run it as your normal user:
# sudo is only used for the rsync, when the nginx root is not writable by you.
#
# Usage: docker/deploy.sh [options]
#
#   --ref <git-ref>         check out this branch, tag or commit before deploying
#   --no-pull               deploy the code as it is on disk (no git fetch/pull)
#   --no-backup             skip the database backup
#   --no-backend            only deploy the frontend
#   --no-frontend           only deploy the backend and the database
#
# Environment overrides:
#   FRONTEND_ROOT     directory served by nginx    (default /var/www/html/sharecount)
#   NODE_IMAGE        image used to build          (default docker.io/library/node:22-slim)
#   VITE_BACKEND_URL  baked into local builds, e.g. sharecount.faren.ovh/api (optional)
#   HEALTH_URL        URL polled after start       (default http://127.0.0.1:4000/version)
#   HEALTH_TIMEOUT    seconds to wait for it       (default 180)
#   BACKUP_DIR        where dumps are written      (default docker/backups)
#   KEEP_BACKUPS      number of dumps to keep      (default 10)
#   COMPOSE_PROJECT_NAME  compose project name     (default: compose's own default)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
OVERRIDE_FILE="$ROOT/docker/docker-compose.override.yml"
ENV_FILE="$ROOT/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/docker/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/version}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
FRONTEND_ROOT="${FRONTEND_ROOT:-/var/www/html/sharecount}"
FRONTEND_ROOT="${FRONTEND_ROOT%/}"
NODE_IMAGE="${NODE_IMAGE:-docker.io/library/node:22-slim}"

REF=""
PULL=1
BACKUP=1
DEPLOY_BACKEND=1
DEPLOY_FRONTEND=1

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

while (($#)); do
    case "$1" in
        --ref) [[ $# -ge 2 ]] || die "--ref needs a value"; REF="$2"; shift 2 ;;
        --no-pull) PULL=0; shift ;;
        --no-backup) BACKUP=0; shift ;;
        --no-backend) DEPLOY_BACKEND=0; shift ;;
        --no-frontend) DEPLOY_FRONTEND=0; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "unknown option: $1" ;;
    esac
done
((DEPLOY_BACKEND || DEPLOY_FRONTEND)) || die "--no-backend and --no-frontend: nothing to deploy"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# --- tooling -----------------------------------------------------------------
command -v podman >/dev/null 2>&1 || die "podman is required"

if ((DEPLOY_BACKEND)); then
    command -v podman-compose >/dev/null 2>&1 || die "podman-compose is required"
    # Pass the project name explicitly: podman-compose 1.0.x ignores
    # COMPOSE_PROJECT_NAME. The default is the compose file's directory name.
    PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(dirname "$COMPOSE_FILE")")}"
    COMPOSE=(podman-compose -p "$PROJECT" -f "$COMPOSE_FILE")
    # Machine-specific tweaks (e.g. exposing the database port) go in an
    # untracked override file, so they never block `git pull`.
    [[ -f "$OVERRIDE_FILE" ]] && COMPOSE+=(-f "$OVERRIDE_FILE")
    command -v curl >/dev/null 2>&1 || die "curl is required"

    [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"
    missing=()
    for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT FRONT_URL LISTENING_URL; do
        grep -Eq "^[[:space:]]*(export[[:space:]]+)?${var}=." "$ENV_FILE" || missing+=("$var")
    done
    ((${#missing[@]} == 0)) || die "backend/.env is missing: ${missing[*]}"
fi

if ((DEPLOY_FRONTEND)); then
    command -v rsync >/dev/null 2>&1 || die "rsync is required"
    # Only the rsync into the nginx root runs as root, and only when this user
    # cannot write there itself. Ask for the password now rather than after
    # the builds.
    [[ -d "$FRONTEND_ROOT" ]] || die "$FRONTEND_ROOT does not exist (create it once: sudo mkdir -p $FRONTEND_ROOT)"
    RSYNC=(rsync)
    if [[ -n "$(find "$FRONTEND_ROOT" -path "$FRONTEND_ROOT/.well-known" \
            -prune -o -type d ! -writable -print -quit)" ]]; then
        command -v sudo >/dev/null 2>&1 || die "$FRONTEND_ROOT is not writable and sudo is not available"
        log "Updating $FRONTEND_ROOT needs sudo (only for rsync)"
        sudo -v || die "sudo is required to update $FRONTEND_ROOT"
        RSYNC=(sudo rsync)
    fi
fi

# --- code ----------------------------------------------------------------------
cd "$ROOT"
PREVIOUS_COMMIT="$(git rev-parse --short HEAD)"
if ((PULL)); then
    git diff --quiet && git diff --cached --quiet \
        || die "uncommitted changes in $ROOT (commit/stash them or use --no-pull)"
    log "Fetching latest code"
    git fetch --quiet --tags origin
    [[ -n "$REF" ]] && git checkout --quiet "$REF"
    if git symbolic-ref -q HEAD >/dev/null; then
        git pull --quiet --ff-only
    fi
elif [[ -n "$REF" ]]; then
    git checkout --quiet "$REF"
fi
COMMIT="$(git rev-parse --short HEAD)"
log "Deploying $COMMIT (previously $PREVIOUS_COMMIT)"
((DEPLOY_BACKEND)) && log "Using $(podman-compose version 2>/dev/null | grep -m 1 'podman-compose version' || echo podman-compose), project $PROJECT"
[[ -f "$OVERRIDE_FILE" ]] && ((DEPLOY_BACKEND)) && log "Using local overrides from ${OVERRIDE_FILE#"$ROOT"/}"

# --- frontend: prepare (nothing is changed yet) ------------------------------------
FRONTEND_BUILD="$STAGE/frontend-build"

build_frontend() {
    local src="$STAGE/frontend-src"
    log "Building frontend in $NODE_IMAGE"
    mkdir -p "$src"
    # Copy the sources as they are on disk, without local build outputs.
    tar -C "$ROOT/frontend" --exclude=./node_modules --exclude=./build --exclude=./.svelte-kit -cf - . \
        | tar -C "$src" -xf -
    # keep-id: files written by the build belong to the current user.
    podman run --rm --userns=keep-id \
        -e HOME=/tmp -e CI=true -e VITE_BACKEND_URL="${VITE_BACKEND_URL:-}" \
        -v "$src:/app:Z" -w /app "$NODE_IMAGE" \
        sh -c 'npm ci --no-audit --no-fund --loglevel=error && npx vitest run --silent && npm run build' \
        || return 1
    mv "$src/build" "$FRONTEND_BUILD"
}

if ((DEPLOY_FRONTEND)); then
    build_frontend || die "frontend build or tests failed, nothing was deployed"
    [[ -f "$FRONTEND_BUILD/index.html" ]] || die "frontend build has no index.html, nothing was deployed"
fi

# --- backend -----------------------------------------------------------------------
# podman-compose is only used to build the image and to create containers.
# Every check, exec, stop and removal goes through podman itself, on the exact
# container: podman-compose 1.0.x (Debian 12) always exits 0 from `exec` and
# ignores --no-deps, which would make failures look like successes.
NEW_VOLUME="${PROJECT:-}_pgdata"

container_of() {    # container id of a compose service, in any state
    podman ps -aq --filter "label=io.podman.compose.project=$PROJECT" \
        --filter "label=com.docker.compose.service=$1" | head -n 1
}
is_running() {
    [[ -n "$1" && "$(podman inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" == true ]]
}
data_volume_of() {
    podman inspect -f \
        '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$1"
}
db_sh() {           # run a shell command in the database container
    local id; id="$(container_of db)"
    [[ -n "$id" ]] || return 1
    podman exec "$id" sh -c "$1"
}
dump_db() {         # dump_db <file>: fails unless a non-empty dump was written
    if db_sh 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$1" && [[ -s "$1" ]]; then
        return 0
    fi
    rm -f "$1"
    return 1
}
table_count() {
    db_sh 'psql -tAq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from pg_tables where schemaname = '"'public'"'"' \
        | tr -d '[:space:]'
}
# Wait until Postgres accepts TCP connections. Over the unix socket, the
# temporary server the image runs while initialising a new volume would
# already answer, and a restore started then would be cut off.
wait_for_db() {
    local deadline=$((SECONDS + HEALTH_TIMEOUT))
    until db_sh 'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
        ((SECONDS < deadline)) || die "database did not become ready within ${HEALTH_TIMEOUT}s"
        sleep 2
    done
}
remove_container() {    # remove_container <service>; volumes are kept
    local id; id="$(container_of "$1")"
    [[ -z "$id" ]] || podman rm -f "$id" >/dev/null
}

OLD_VOLUME=""
BACKUP_FILE=""
if ((DEPLOY_BACKEND)); then
    db_id="$(container_of db)"
    if [[ -n "$db_id" ]]; then
        # One-time move from the old layout: the first compose file kept the
        # database in an anonymous volume, the current one uses <project>_pgdata.
        data_volume="$(data_volume_of "$db_id")"
        if [[ -n "$data_volume" && "$data_volume" != "$NEW_VOLUME" ]]; then
            OLD_VOLUME="$data_volume"
            log "The database is on the old volume $OLD_VOLUME: its data will be moved to $NEW_VOLUME"
        fi
        # A stopped database is started, so it can be backed up (and moved).
        if ! is_running "$db_id"; then
            log "Starting the existing database container"
            podman start "$db_id" >/dev/null || die "could not start the database container, nothing was deployed"
            wait_for_db
        fi
    fi

    if ((BACKUP)); then
        if [[ -n "$db_id" ]]; then
            mkdir -p "$BACKUP_DIR"
            BACKUP_FILE="$BACKUP_DIR/sharecount-$(date -u +%Y%m%dT%H%M%SZ)-$PREVIOUS_COMMIT.dump"
            log "Backing up database to ${BACKUP_FILE#"$ROOT"/}"
            dump_db "$BACKUP_FILE" || die "database backup failed, nothing was deployed"
            # Keep only the most recent dumps.
            find "$BACKUP_DIR" -maxdepth 1 -name 'sharecount-*.dump' -printf '%T@ %p\n' \
                | sort -rn | tail -n +"$((KEEP_BACKUPS + 1))" | cut -d' ' -f2- \
                | xargs -r rm -f --
        else
            warn "no database container yet, skipping backup (first deploy?)"
        fi
    fi

    log "Building backend image"
    "${COMPOSE[@]}" build backend

    if [[ -n "$OLD_VOLUME" ]]; then
        # Stop writes, dump, recreate the database on the new volume, restore.
        mkdir -p "$BACKUP_DIR"
        migration_dump="$BACKUP_DIR/sharecount-$(date -u +%Y%m%dT%H%M%SZ)-volume-migration.dump"
        recover="Your data is untouched in volume $OLD_VOLUME and in $migration_dump"
        log "Stopping backend to move the data"
        backend_id="$(container_of backend)"
        [[ -z "$backend_id" ]] || podman stop "$backend_id" >/dev/null
        log "Dumping database to ${migration_dump#"$ROOT"/}"
        if ! dump_db "$migration_dump"; then
            [[ -z "$backend_id" ]] || podman start "$backend_id" >/dev/null || true
            die "dump failed, nothing was changed (backend restarted)"
        fi

        # The backend container depends on the database one, so both go; the
        # old volume itself is kept. The backend is recreated below.
        remove_container backend
        remove_container db
        log "Creating database on volume $NEW_VOLUME"
        "${COMPOSE[@]}" up -d db
        db_id="$(container_of db)"
        [[ -n "$db_id" && "$(data_volume_of "$db_id")" == "$NEW_VOLUME" ]] \
            || die "the database was not moved to $NEW_VOLUME. $recover"
        wait_for_db
        tables="$(table_count)" || die "could not inspect $NEW_VOLUME. $recover"
        [[ "$tables" == 0 ]] || die "$NEW_VOLUME already contains tables, not restoring over them. $recover"

        log "Restoring data"
        podman exec -i "$db_id" sh -c \
            'pg_restore --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <"$migration_dump" \
            || die "restore failed. $recover"
        tables="$(table_count)" || true
        [[ "$tables" =~ ^[1-9][0-9]*$ ]] || die "restore left no tables in $NEW_VOLUME. $recover"
        log "Data moved ($tables tables); the old volume $OLD_VOLUME is kept (podman volume rm $OLD_VOLUME once all is fine)"
    elif [[ -z "$(container_of db)" ]]; then
        log "Creating database"
        "${COMPOSE[@]}" up -d db
        wait_for_db
    else
        wait_for_db
    fi

    # Recreate the backend from the new image by removing its container and
    # creating it again; `up --force-recreate --no-deps backend` would also
    # recreate the database with podman-compose 1.0.x. The database container
    # already exists, so `up` leaves it as it is.
    log "Restarting backend"
    remove_container backend
    "${COMPOSE[@]}" up -d --no-deps backend

    log "Waiting for backend at $HEALTH_URL"
    deadline=$((SECONDS + HEALTH_TIMEOUT))
    until version="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; do
        if ((SECONDS >= deadline)); then
            backend_id="$(container_of backend)"
            [[ -z "$backend_id" ]] || podman logs --tail 50 "$backend_id" >&2 || true
            echo >&2
            [[ -n "$BACKUP_FILE" ]] && echo "Backup taken before this deploy: $BACKUP_FILE" >&2
            echo "To roll back the code: $0 --ref $PREVIOUS_COMMIT --no-pull" >&2
            ((DEPLOY_FRONTEND)) && echo "The frontend was not changed." >&2
            die "backend did not become healthy within ${HEALTH_TIMEOUT}s"
        fi
        sleep 2
    done
    log "Backend $version is up"
fi

# --- frontend: switch ----------------------------------------------------------------
# Two passes so a page never references a file that is not there yet:
#   1. add the new hashed assets (_app/) next to the current ones, delete nothing;
#   2. update the pages and remove what the new build no longer has.
# .well-known/ (Android app links, generated from the signing key that is not on
# the server) is never deleted; it is only updated if the build contains one.
if ((DEPLOY_FRONTEND)); then
    # -rlt: no owner/group copied, so files written via sudo belong to root.
    rsync_opts=(-rlt --chmod=D755,F644)
    log "Updating frontend in $FRONTEND_ROOT"
    if [[ -d "$FRONTEND_BUILD/_app" ]]; then
        "${RSYNC[@]}" "${rsync_opts[@]}" "$FRONTEND_BUILD/_app/" "$FRONTEND_ROOT/_app/"
    fi
    "${RSYNC[@]}" "${rsync_opts[@]}" --delete-delay --delay-updates --filter='P /.well-known/' \
        "$FRONTEND_BUILD/" "$FRONTEND_ROOT/"
    log "Frontend updated to $COMMIT"
fi

# --- summary ---------------------------------------------------------------------
log "Deployed $COMMIT"
if [[ -n "$BACKUP_FILE" ]]; then
    cat <<EOF
Database backup: ${BACKUP_FILE#"$ROOT"/}
  restore: podman exec -i $(podman inspect -f '{{.Name}}' "$(container_of db)") sh -c 'pg_restore --clean --if-exists --no-owner -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' < $BACKUP_FILE
EOF
fi
if [[ "$PREVIOUS_COMMIT" != "$COMMIT" ]]; then
    echo "To roll back: $0 --ref $PREVIOUS_COMMIT --no-pull"
fi
