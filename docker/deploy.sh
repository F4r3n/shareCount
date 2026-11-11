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
    COMPOSE=(podman-compose -f "$COMPOSE_FILE")
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
((DEPLOY_BACKEND)) && log "Using $(podman-compose version 2>/dev/null | tail -n 1)"
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
# Wait until Postgres accepts TCP connections. Over the unix socket, the
# temporary server the image runs while initialising a new volume would
# already answer, and a restore started then would be cut off.
wait_for_db() {
    local deadline=$((SECONDS + HEALTH_TIMEOUT))
    until "${COMPOSE[@]}" exec -T db sh -c \
        'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
        ((SECONDS < deadline)) || die "database did not become ready within ${HEALTH_TIMEOUT}s"
        sleep 2
    done
}

# One-time move from the old layout: the first compose file kept the database
# in an anonymous volume, the current one uses the named volume <project>_pgdata.
project="${COMPOSE_PROJECT_NAME:-$(basename "$(dirname "$COMPOSE_FILE")")}"
NEW_VOLUME="${project}_pgdata"
compose_container() {
    podman ps -aq --filter "label=io.podman.compose.project=$project" \
        --filter "label=com.docker.compose.service=$1" | head -n 1
}
db_volume() {
    podman inspect -f \
        '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$1"
}

OLD_VOLUME=""
if ((DEPLOY_BACKEND)); then
    db_container="$(compose_container db)"
    if [[ -n "$db_container" ]] && podman inspect -f '{{.State.Running}}' "$db_container" | grep -q true; then
        data_volume="$(db_volume "$db_container")"
        if [[ -n "$data_volume" && "$data_volume" != "$NEW_VOLUME" ]]; then
            OLD_VOLUME="$data_volume"
            log "The database is on the old volume $OLD_VOLUME: its data will be moved to $NEW_VOLUME"
        fi
    fi
fi

BACKUP_FILE=""
if ((DEPLOY_BACKEND)); then
    if ((BACKUP)); then
        if "${COMPOSE[@]}" exec -T db true >/dev/null 2>&1; then
            mkdir -p "$BACKUP_DIR"
            BACKUP_FILE="$BACKUP_DIR/sharecount-$(date -u +%Y%m%dT%H%M%SZ)-$PREVIOUS_COMMIT.dump"
            log "Backing up database to ${BACKUP_FILE#"$ROOT"/}"
            if ! "${COMPOSE[@]}" exec -T db sh -c \
                'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$BACKUP_FILE"; then
                rm -f "$BACKUP_FILE"
                die "database backup failed, nothing was deployed"
            fi
            # Keep only the most recent dumps.
            find "$BACKUP_DIR" -maxdepth 1 -name 'sharecount-*.dump' -printf '%T@ %p\n' \
                | sort -rn | tail -n +"$((KEEP_BACKUPS + 1))" | cut -d' ' -f2- \
                | xargs -r rm -f --
        else
            warn "database is not running, skipping backup (first deploy?)"
        fi
    fi

    log "Building backend image"
    "${COMPOSE[@]}" build backend

    if [[ -n "$OLD_VOLUME" ]]; then
        # Stop writes, dump, recreate the database on the new volume, restore.
        migration_dump="$BACKUP_DIR/sharecount-$(date -u +%Y%m%dT%H%M%SZ)-volume-migration.dump"
        mkdir -p "$BACKUP_DIR"
        recover="Your data is untouched in volume $OLD_VOLUME and in $migration_dump"
        log "Stopping backend to move the data"
        "${COMPOSE[@]}" stop backend
        log "Dumping database to ${migration_dump#"$ROOT"/}"
        if ! "${COMPOSE[@]}" exec -T db sh -c \
            'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$migration_dump" \
            || [[ ! -s "$migration_dump" ]]; then
            "${COMPOSE[@]}" start backend || true
            die "dump failed, nothing was changed (backend restarted)"
        fi

        # podman refuses to recreate the database while the backend container
        # depends on it, so remove that container first (it is recreated below).
        backend_container="$(compose_container backend)"
        [[ -z "$backend_container" ]] || podman rm -f "$backend_container" >/dev/null
        log "Recreating database on volume $NEW_VOLUME"
        "${COMPOSE[@]}" up -d --no-deps --force-recreate db
        db_container="$(compose_container db)"
        [[ -n "$db_container" && "$(db_volume "$db_container")" == "$NEW_VOLUME" ]] \
            || die "the database was not moved to $NEW_VOLUME. $recover"
        wait_for_db
        tables="$("${COMPOSE[@]}" exec -T db sh -c \
            'psql -tAq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from pg_tables where schemaname = '"'public'"'"')"
        [[ "$(echo "$tables" | tr -d '[:space:]')" == 0 ]] \
            || die "$NEW_VOLUME already contains tables, not restoring over them. $recover"

        log "Restoring data"
        "${COMPOSE[@]}" exec -T db sh -c \
            'pg_restore --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <"$migration_dump" \
            || die "restore failed. $recover"
        log "Data moved; the old volume $OLD_VOLUME is kept (podman volume rm $OLD_VOLUME once all is fine)"
    else
        log "Starting database"
        "${COMPOSE[@]}" up -d db
        wait_for_db
    fi

    # Always recreate the backend: podman-compose does not reliably pick up a
    # new image or a changed env file on a plain `up -d`. The database keeps running.
    log "Restarting backend"
    "${COMPOSE[@]}" up -d --no-deps --force-recreate backend

    log "Waiting for backend at $HEALTH_URL"
    deadline=$((SECONDS + HEALTH_TIMEOUT))
    until version="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; do
        if ((SECONDS >= deadline)); then
            "${COMPOSE[@]}" logs --tail 50 backend >&2 || true
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
  restore: ${COMPOSE[*]} exec -T db sh -c 'pg_restore --clean --if-exists -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' < $BACKUP_FILE
EOF
fi
if [[ "$PREVIOUS_COMMIT" != "$COMMIT" ]]; then
    echo "To roll back: $0 --ref $PREVIOUS_COMMIT --no-pull"
fi
