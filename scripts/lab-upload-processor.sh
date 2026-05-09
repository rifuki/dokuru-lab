#!/usr/bin/env bash
set -Eeuo pipefail

LAB_UPLOAD_DIR="${LAB_UPLOAD_DIR:-/srv/dokuru-lab/uploads}"
LAB_CRON_LOG="${LAB_CRON_LOG:-/var/log/lab-cron.log}"
LAB_TIMEOUT_SECONDS="${LAB_TIMEOUT_SECONDS:-10}"

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

mkdir -p "$LAB_UPLOAD_DIR"
touch "$LAB_CRON_LOG"

printf '[%s] scan %s\n' "$(date -Is)" "$LAB_UPLOAD_DIR" >> "$LAB_CRON_LOG"

shopt -s nullglob
for payload in "$LAB_UPLOAD_DIR"/*.sh; do
	[ -f "$payload" ] || continue
	case "$payload" in
		*.processed|*.failed) continue ;;
	esac

	printf '[%s] executing %s\n' "$(date -Is)" "$payload" >> "$LAB_CRON_LOG"
	if timeout "${LAB_TIMEOUT_SECONDS}s" bash "$payload" >> "$LAB_CRON_LOG" 2>&1; then
		mv "$payload" "${payload}.processed"
		printf '[%s] processed %s\n' "$(date -Is)" "$payload" >> "$LAB_CRON_LOG"
	else
		mv "$payload" "${payload}.failed"
		printf '[%s] failed %s\n' "$(date -Is)" "$payload" >> "$LAB_CRON_LOG"
	fi
done
