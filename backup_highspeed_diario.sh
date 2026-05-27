#!/bin/bash

source "$HOME/highspeed-angel/.highspeed_secrets"

BACKUP_DIR="$HOME/highspeed-auto-backups"
DATE=$(date +"%F_%H-%M")
OUT="$BACKUP_DIR/highspeed_backup_$DATE.json"

mkdir -p "$BACKUP_DIR"

TOKEN=$(curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"angelito0"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or d.get("token") or "")')

if [ -z "$TOKEN" ]; then
  echo "ERROR: no se pudo obtener token"
  exit 1
fi

curl -s http://127.0.0.1:8000/backup/export \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT"

if [ ! -s "$OUT" ]; then
  echo "ERROR: backup vacío"
  rm -f "$OUT"
  exit 1
fi

echo "Backup creado: $OUT"

# Mantener solo últimos 30 backups
ls -1t "$BACKUP_DIR"/highspeed_backup_*.json 2>/dev/null | tail -n +31 | xargs -r rm -f
