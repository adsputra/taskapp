#!/usr/bin/env bash
# Runs the pgTAP suite (supabase/tests/database) against a throwaway
# Supabase Postgres container:
#   1. applies the Supabase stand-ins (scripts/test-db/supabase_stubs.sql)
#   2. applies supabase/schema.sql TWICE (it must be idempotent)
#   3. runs every *.test.sql file and fails on any "not ok"
#
# Requires Docker. On a full local stack you can use `supabase test db`
# instead (the stand-ins are then unnecessary).
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE="${SUPABASE_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.171}"
NAME="taskapp_pgtap_$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting $IMAGE ..."
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null

# The image restarts Postgres once after its init scripts; wait until the
# auth schema is in place and the server answers twice in a row.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$NAME" psql -U postgres -tAc "SELECT to_regclass('auth.users') IS NOT NULL" 2>/dev/null | grep -q t; then
    ready=$((ready + 1))
    [ "$ready" -ge 2 ] && break
  else
    ready=0
  fi
  sleep 1
done
[ "$ready" -ge 2 ] || { echo "Postgres did not become ready" >&2; exit 1; }

run_sql() {
  local user="$1" file="$2"
  docker exec -i "$NAME" psql -U "$user" -d postgres -v ON_ERROR_STOP=1 -q -X < "$file"
}

echo "Applying harness stand-ins ..."
run_sql supabase_admin scripts/test-db/supabase_stubs.sql >/dev/null 2>&1

for pass in 1 2; do
  echo "Applying schema.sql (pass $pass) ..."
  if ! output=$(run_sql postgres supabase/schema.sql 2>&1); then
    echo "$output" | grep -v -e '^NOTICE' -e 'skipping' >&2
    exit 1
  fi
done

failed=0
for file in supabase/tests/database/*.test.sql; do
  output=$(docker exec -i "$NAME" psql -U postgres -d postgres -X -tA -v ON_ERROR_STOP=1 < "$file" 2>&1) || failed=1
  tests=$(echo "$output" | grep -cE '^(not )?ok ' || true)
  if echo "$output" | grep -qE '^not ok|Looks like|ERROR'; then
    failed=1
    echo "✗ $file"
    echo "$output" | grep -E '^not ok|^#|ERROR|LINE|DETAIL' | sed 's/^/    /'
  else
    echo "✓ $file ($tests tests)"
  fi
done

exit "$failed"
