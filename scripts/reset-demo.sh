#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${DOKURU_LAB_HOST:-google-dokuru-lab}"
REMOTE_PATH="${DOKURU_LAB_PATH:-/home/rifuki/dokuru-lab}"
BASELINE_FILE="${DOKURU_LAB_FILE:-docker-compose.yaml.pre-hardening}"

printf 'Resetting Dokuru Lab demo on %s:%s\n' "$REMOTE_HOST" "$REMOTE_PATH"

ssh "$REMOTE_HOST" \
  "REMOTE_PATH='$REMOTE_PATH' BASELINE_FILE='$BASELINE_FILE' bash -s" <<'REMOTE'
set -euo pipefail

cd "$REMOTE_PATH"

if [ ! -f "$BASELINE_FILE" ]; then
  printf 'ERROR: missing baseline file: %s/%s\n' "$REMOTE_PATH" "$BASELINE_FILE" >&2
  exit 1
fi

printf 'Restoring compose baseline from %s\n' "$BASELINE_FILE"
cp "$BASELINE_FILE" docker-compose.yaml

printf 'Recreating lab stack...\n'
docker compose up -d checkout-api customer-db latency-probe dokuru-lab caddy >/dev/null

printf 'Waiting for dokuru-lab health...\n'
for _ in $(seq 1 30); do
  health=$(docker inspect dokuru-lab --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)
  if [ "$health" = "healthy" ] || [ "$health" = "running" ]; then
    break
  fi
  sleep 1
done

printf '\n=== containers ===\n'
docker ps --format 'table {{.Names}}\t{{.Status}}'

printf '\n=== attacker runtime ===\n'
docker inspect dokuru-lab --format 'PidMode={{.HostConfig.PidMode}} UsernsMode={{.HostConfig.UsernsMode}} CapAdd={{json .HostConfig.CapAdd}} Memory={{.HostConfig.Memory}} PidsLimit={{.HostConfig.PidsLimit}} RestartCount={{.RestartCount}}'

printf '\n=== B3 readiness ===\n'
docker exec dokuru-lab sh -lc '
pid=$(pgrep -x postgres | head -1 || true)
echo "postgres_process=${pid:-no}"
if [ -z "$pid" ]; then
  echo "SECRET_LEAK_NOT_READY"
  exit 1
fi
envs=$(tr "\000" "\n" < "/proc/$pid/environ" 2>/tmp/dokuru-env-read.err || true)
case "$envs" in
  *POSTGRES_PASSWORD=*) echo "SECRET_LEAK_READY" ;;
  *) echo "SECRET_LEAK_NOT_READY"; exit 1 ;;
esac
'

printf '\n=== HTTP health ===\n'
curl -fsS http://localhost/api/health >/dev/null
printf 'LAB_HTTP_OK\n'

printf '\nDemo baseline is ready.\n'
REMOTE
