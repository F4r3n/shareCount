#!/usr/bin/env bash
# Deploy ShareCount with podman: the backend and its database (podman-compose)
# and the frontend (static files served by nginx).
#
# Steps: update the code, build the frontend (here, in a Node container, after
# running its tests), back up the database, rebuild and restart the backend,
# wait until it answers, then switch the frontend to the new build. Database
# migrations run at backend startup.
# Nothing visible changes until the frontend build is ready, and the frontend
# is only switched once the new backend is healthy.
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
#   FRONTEND_KEEP     frontend releases to keep    (default 5)
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
RELEASES_DIR="${FRONTEND_ROOT}-releases"
FRONTEND_KEEP="${FRONTEND_KEEP:-5}"
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

SUDO=()
if ((DEPLOY_FRONTEND)); then
    # Releases live next to FRONTEND_ROOT and the switch renames a symlink in
    # its parent directory, so that directory must be writable.
    frontend_parent="$(dirname "$FRONTEND_ROOT")"
    [[ -d "$frontend_parent" ]] || die "$frontend_parent does not exist"
    if [[ ! -w "$frontend_parent" ]]; then
        command -v sudo >/dev/null 2>&1 || die "$frontend_parent is not writable and sudo is not available"
        log "$frontend_parent needs root, using sudo"
        sudo -v || die "sudo is required to update $FRONTEND_ROOT"
        SUDO=(sudo)
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

    # The Android app links (.well-known/assetlinks.json) are generated from the
    # app signing key, which is not on the server: keep the ones currently served.
    if [[ ! -e "$FRONTEND_BUILD/.well-known" && -d "$FRONTEND_ROOT/.well-known" ]]; then
        cp -a "$FRONTEND_ROOT/.well-known" "$FRONTEND_BUILD/"
        log "Keeping the current .well-known (Android app links)"
    fi
fi

# --- backend -----------------------------------------------------------------------
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

    log "Starting database"
    "${COMPOSE[@]}" up -d db
    deadline=$((SECONDS + HEALTH_TIMEOUT))
    until "${COMPOSE[@]}" exec -T db sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
        ((SECONDS < deadline)) || die "database did not become ready within ${HEALTH_TIMEOUT}s"
        sleep 2
    done

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
# Each build is a release directory; FRONTEND_ROOT is a symlink to the current
# one, replaced atomically (nginx never sees a half-copied site).
PREVIOUS_RELEASE=""
if ((DEPLOY_FRONTEND)); then
    release="$RELEASES_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$COMMIT"
    log "Installing frontend to ${release}"
    "${SUDO[@]}" mkdir -p "$RELEASES_DIR"
    "${SUDO[@]}" cp -a "$FRONTEND_BUILD" "$release"
    "${SUDO[@]}" chmod -R a+rX "$release"

    link_tmp="$FRONTEND_ROOT.new-$$"
    "${SUDO[@]}" ln -sfn "$release" "$link_tmp"
    if [[ -L "$FRONTEND_ROOT" ]]; then
        PREVIOUS_RELEASE="$(readlink -f "$FRONTEND_ROOT")"
    elif [[ -e "$FRONTEND_ROOT" ]]; then
        # First run: the current site is a plain directory, keep it as a release.
        PREVIOUS_RELEASE="$RELEASES_DIR/$(date -u +%Y%m%dT%H%M%SZ)-before-releases"
        log "Moving the current site to $PREVIOUS_RELEASE"
        "${SUDO[@]}" mv "$FRONTEND_ROOT" "$PREVIOUS_RELEASE"
    fi
    "${SUDO[@]}" mv -Tf "$link_tmp" "$FRONTEND_ROOT"
    log "Frontend switched to $COMMIT"

    # Keep the most recent releases, never the current or previous one.
    current_release="$(readlink -f "$FRONTEND_ROOT")"
    find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r \
        | tail -n +"$((FRONTEND_KEEP + 1))" | while read -r name; do
            path="$RELEASES_DIR/$name"
            [[ "$path" == "$current_release" || "$path" == "$PREVIOUS_RELEASE" ]] && continue
            "${SUDO[@]}" rm -rf -- "$path"
        done
fi

# --- summary ---------------------------------------------------------------------
log "Deployed $COMMIT"
if [[ -n "$BACKUP_FILE" ]]; then
    cat <<EOF
Database backup: ${BACKUP_FILE#"$ROOT"/}
  restore: ${COMPOSE[*]} exec -T db sh -c 'pg_restore --clean --if-exists -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' < $BACKUP_FILE
EOF
fi
if [[ -n "$PREVIOUS_RELEASE" ]]; then
    sudo_prefix=""
    ((${#SUDO[@]})) && sudo_prefix="sudo "
    cat <<EOF
Previous frontend: $PREVIOUS_RELEASE
  roll back: ${sudo_prefix}ln -sfn $PREVIOUS_RELEASE $FRONTEND_ROOT
EOF
fi
