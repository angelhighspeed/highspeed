#!/bin/bash

set -e

LOG="$HOME/highspeed-auto-backups/corte_automatico.log"
DATE=$(date +"%F %H:%M:%S")

mkdir -p "$HOME/highspeed-auto-backups"

cd "$HOME/highspeed-angel"

source "$HOME/highspeed-angel/.highspeed_secrets"

echo "[$DATE] Iniciando corte automático por facturas impagas..." >> "$LOG"

TOKEN=$(curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$HIGHSPEED_ADMIN_USER\",\"password\":\"$HIGHSPEED_ADMIN_PASSWORD\"}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or d.get("token") or "")')

if [ -z "$TOKEN" ]; then
  echo "[$DATE] ERROR: no se pudo obtener token" >> "$LOG"
  exit 1
fi

RESPONSE=$(curl -s -X POST http://127.0.0.1:8000/billing/suspend-overdue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "[$DATE] Respuesta: $RESPONSE" >> "$LOG"

if echo "$RESPONSE" | grep -qiE "error|detail|unauthorized|forbidden"; then
  echo "[$DATE] ERROR: corte automático falló" >> "$LOG"
  exit 1
fi

echo "[$DATE] Corte automático ejecutado OK" >> "$LOG"
