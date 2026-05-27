#!/bin/bash

LOG="$HOME/highspeed-auto-backups/monitor_highspeed.log"
DATE=$(date +"%F %H:%M:%S")

mkdir -p "$HOME/highspeed-auto-backups"

BACKEND="OK"
FRONTEND="OK"

curl -s http://127.0.0.1:8000/docs >/dev/null || BACKEND="FALLA"
curl -s http://127.0.0.1:5173 >/dev/null || FRONTEND="FALLA"

echo "[$DATE] Backend=$BACKEND Frontend=$FRONTEND" >> "$LOG"

if [ "$BACKEND" = "FALLA" ] || [ "$FRONTEND" = "FALLA" ]; then
  echo "[$DATE] Intentando reparar servicios..." >> "$LOG"

  sudo systemctl restart highspeed-backend.service 2>/dev/null || true
  sudo systemctl restart highspeed-frontend.service 2>/dev/null || true

  sleep 3

  curl -s http://127.0.0.1:8000/docs >/dev/null && BACKEND2="OK" || BACKEND2="FALLA"
  curl -s http://127.0.0.1:5173 >/dev/null && FRONTEND2="OK" || FRONTEND2="FALLA"

  echo "[$DATE] Después de reparar: Backend=$BACKEND2 Frontend=$FRONTEND2" >> "$LOG"
fi
