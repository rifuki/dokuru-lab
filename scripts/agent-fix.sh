#!/usr/bin/env bash
set -euo pipefail

RULE_ID="${1:-}"
REMOTE_HOST="${DOKURU_LAB_BASELINE_HOST:-google-dokuru-lab-baseline}"
AGENT_URL="${DOKURU_AGENT_URL:-http://127.0.0.1:3939}"

if [ -z "$RULE_ID" ]; then
  printf 'Usage: DOKURU_AGENT_TOKEN=dok_... %s <rule_id>\n' "$0" >&2
  printf 'Example: DOKURU_AGENT_TOKEN=dok_... %s 5.16\n' "$0" >&2
  exit 1
fi

if [ -z "${DOKURU_AGENT_TOKEN:-}" ]; then
  printf 'ERROR: DOKURU_AGENT_TOKEN is required. Do not store it in files.\n' >&2
  exit 1
fi

printf 'Applying Dokuru rule %s through agent on %s\n' "$RULE_ID" "$REMOTE_HOST"

ssh "$REMOTE_HOST" \
  "RULE_ID='$RULE_ID' AGENT_URL='$AGENT_URL' DOKURU_AGENT_TOKEN='$DOKURU_AGENT_TOKEN' bash -s" <<'REMOTE'
set -euo pipefail

header="Authorization: Bearer $DOKURU_AGENT_TOKEN"
json_body="{\"rule_id\":\"$RULE_ID\",\"targets\":[]}"

print_audit() {
  label="$1"
  response=$(curl -sS "$AGENT_URL/audit/$RULE_ID" -H "$header")
  printf '%s: ' "$label"
  printf '%s' "$response" | python3 -c '
import json, sys
j = json.load(sys.stdin)
d = j.get("data") or {}
print(d.get("status", "unknown"))
msg = d.get("message")
if msg:
    print(msg)
'
}

print_audit 'before'

printf '\nfix: '
fix_response=$(curl -sS -X POST "$AGENT_URL/fix" -H "$header" -H 'content-type: application/json' -d "$json_body")
printf '%s' "$fix_response" | python3 -c '
import json, sys
j = json.load(sys.stdin)
d = j.get("data") or {}
print(d.get("status", "unknown"))
msg = d.get("message")
if msg:
    print(msg)
'

sleep 8

printf '\n'
print_audit 'after'

printf '\ncontainer: '
docker inspect dokuru-lab-baseline --format 'PidMode={{.HostConfig.PidMode}} Memory={{.HostConfig.Memory}} PidsLimit={{.HostConfig.PidsLimit}} CapAdd={{json .HostConfig.CapAdd}} RestartCount={{.RestartCount}}'
REMOTE
