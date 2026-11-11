#!/bin/sh
# Run the backend tests against a throwaway Postgres (docker/db/docker-compose-test.yml, port 5433).
# Starts the test database if needed, resets it with init.sql, then runs cargo test.
# Extra arguments go to cargo test, e.g.: sh launch_test.sh transactions_batch_flow
set -eu
cd "$(dirname "$0")"

COMPOSE_FILE=../docker/db/docker-compose-test.yml
export PGPASSWORD=testpass
PSQL="psql -h 127.0.0.1 -p 5433 -U testuser -d testdb -v ON_ERROR_STOP=1 -q"

podman-compose -p sharecount-test -f "$COMPOSE_FILE" up -d >/dev/null

# Ready over TCP only once the image's init (unix-socket only) is finished.
printf 'Waiting for the test database'
i=0
until $PSQL -c 'select 1' >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
        echo
        echo "Test database not ready after 60s. Logs:" >&2
        podman logs --tail 30 sharecount-test_test_db_1 >&2 || true
        exit 1
    fi
    printf '.'
    sleep 1
done
echo ' ready'

# Fresh tables and test data for every run.
$PSQL -f ../docker/db/init/init.sql >/dev/null

cargo test "$@" -- --nocapture
