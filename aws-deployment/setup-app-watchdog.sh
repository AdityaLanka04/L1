#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/brainwave-backend}"

chmod +x "$APP_DIR/aws-deployment/app-health-watchdog.sh"
sudo cp "$APP_DIR/aws-deployment/systemd/brainwave-app-watchdog.service" /etc/systemd/system/
sudo cp "$APP_DIR/aws-deployment/systemd/brainwave-app-watchdog.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now brainwave-app-watchdog.timer

echo "BrainwaveAI watchdog enabled."
systemctl list-timers brainwave-app-watchdog.timer --no-pager
