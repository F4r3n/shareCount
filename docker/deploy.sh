#!/usr/bin/env bash
# Deploy the ShareCount backend and its database with podman/docker compose.
#
# Steps: update the code, check backend/.env, back up the database (if it is
# running), rebuild the backend image, restart the stack and wait until the
# backend answers. Database migrations run automatically at backend startup.
#
# Usage: docker/deploy.sh [--ref <git-ref>] [--no-pull] [--no-backup]
#
#   --ref <git-ref>  check out this branch, tag or commit before deploying
#   --no-pull        deploy the code as it is on disk (no git fetch/pull)
#   --no-backup      skip the database backup
#
# Environment overrides:
#   HEALTH_URL      URL polled after start      (default http://127.0.0.1:4000/version)
#   HEALTH_TIMEOUT  seconds to wait for it      (default 180)
#   BACKUP_DIR      where dumps are written     (default docker/backups)
#   KEEP_BACKUPS    number of dumps to keep     (default 10)
#   COMPOSE_PROJECT_NAME  compose project name  (default: compose's own default)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
ENV_FILE="$ROOT/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/docker/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/version}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

REF=""
PULL=1
BACKUP=1

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

while (($#)); do
    case "$1" in
        --ref) [[ $# -ge 2 ]] || die "--ref needs a value"; REF="$2"; shift 2 ;;
        --no-pull) PULL=0; shift ;;
        --no-backup) BACKUP=0; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "unknown option: $1" ;;
    esac
done

# --- tooling -----------------------------------------------------------------
if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    COMPOSE=(podman compose)
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
else
    die "neither 'podman compose' nor 'docker compose' is available"
fi
COMPOSE+=(-f "$COMPOSE_FILE")
# Machine-specific tweaks (e.g. exposing the database port) go in an untracked
# override file, so they never block `git pull`.
OVERRIDE_FILE="$ROOT/docker/docker-compose.override.yml"
if [[ -f "$OVERRIDE_FILE" ]]; then
    COMPOSE+=(-f "$OVERRIDE_FILE")
fi
command -v curl >/dev/null 2>&1 || die "curl is required"

# --- configuration -------------------------------------------------------------
[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"
missing=()
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT FRONT_URL LISTENING_URL; do
    grep -Eq "^[[:space:]]*(export[[:space:]]+)?${var}=." "$ENV_FILE" || missing+=("$var")
done
((${#missing[@]} == 0)) || die "backend/.env is missing: ${missing[*]}"

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
[[ -f "$OVERRIDE_FILE" ]] && log "Using local overrides from ${OVERRIDE_FILE#"$ROOT"/}"

# --- backup --------------------------------------------------------------------
BACKUP_FILE=""
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

# --- build & start -------------------------------------------------------------
log "Building backend image"
"${COMPOSE[@]}" build backend

log "Starting database"
"${COMPOSE[@]}" up -d db
deadline=$((SECONDS + HEALTH_TIMEOUT))
until "${COMPOSE[@]}" exec -T db sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
    ((SECONDS < deadline)) || die "database did not become ready within ${HEALTH_TIMEOUT}s"
    sleep 2
done

# Always recreate the backend: podman-compose does not reliably pick up a new
# image or a changed env file on a plain `up -d`. The database is left running.
log "Restarting backend"
"${COMPOSE[@]}" up -d --no-deps --force-recreate backend

# --- health check --------------------------------------------------------------
log "Waiting for backend at $HEALTH_URL"
deadline=$((SECONDS + HEALTH_TIMEOUT))
until version="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; do
    if ((SECONDS >= deadline)); then
        "${COMPOSE[@]}" logs --tail 50 backend >&2 || true
        echo >&2
        [[ -n "$BACKUP_FILE" ]] && echo "Backup taken before this deploy: $BACKUP_FILE" >&2
        echo "To roll back the code: $0 --ref $PREVIOUS_COMMIT --no-pull" >&2
        die "backend did not become healthy within ${HEALTH_TIMEOUT}s"
    fi
    sleep 2
done

log "Deployed $COMMIT, backend version $version"
if [[ -n "$BACKUP_FILE" ]]; then
    cat <<EOF
Backup: ${BACKUP_FILE#"$ROOT"/}
Restore it with:
  ${COMPOSE[*]} exec -T db sh -c 'pg_restore --clean --if-exists -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' < $BACKUP_FILE
EOF
fi
