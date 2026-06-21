#!/usr/bin/env bash

set -u

APP_DIR="${APP_DIR:-/home/ubuntu/brainwave-backend}"
COMPOSE_FILE="${COMPOSE_FILE:-aws-deployment/docker-compose.production.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health/ready}"
FAILURE_LIMIT="${FAILURE_LIMIT:-3}"
STATE_FILE="${STATE_FILE:-/tmp/brainwave-app-watchdog.failures}"

if curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null; then
    printf '0\n' > "$STATE_FILE"
    exit 0
fi

failures=0
if [[ -f "$STATE_FILE" ]]; then
    read -r failures < "$STATE_FILE" || failures=0
fi
failures=$((failures + 1))
printf '%s\n' "$failures" > "$STATE_FILE"

logger -t brainwave-watchdog "Readiness check failed ($failures/$FAILURE_LIMIT)"

if (( failures < FAILURE_LIMIT )); then
    exit 0
fi

cd "$APP_DIR" || exit 1

if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" restart backend
else
    docker-compose -f "$COMPOSE_FILE" restart backend
fi

printf '0\n' > "$STATE_FILE"
logger -t brainwave-watchdog "Restarted backend after repeated readiness failures"
