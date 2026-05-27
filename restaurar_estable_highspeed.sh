#!/bin/bash

set -e

PROJECT_DIR="$HOME/highspeed-angel"
BACKUP_DIR="$HOME/backups_highspeed_reinicio_apk"
DATE=$(date +"%F_%H-%M")
TAG="v1.0.0-highspeed-isp"

echo "=================================="
echo " RESTAURAR HIGHSPEED A VERSION ESTABLE"
echo "=================================="
echo ""

cd "$PROJECT_DIR"

echo "1) Backup del estado actual..."
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/highspeed_antes_restaurar_$DATE.tar.gz" \
  backend/app \
  frontend/src \
  frontend/assets \
  frontend/android/app/src/main/res \
  frontend/package.json \
  frontend/capacitor.config.json \
  frontend/.env \
  frontend/.env.production 2>/dev/null || true

echo "Backup creado: $BACKUP_DIR/highspeed_antes_restaurar_$DATE.tar.gz"

echo ""
echo "2) Restaurando código desde tag estable: $TAG"
git fetch --all --tags
git checkout "$TAG"

echo ""
echo "3) Estado actual:"
git status --short

echo ""
echo "=================================="
echo " RESTAURACION COMPLETADA"
echo "=================================="
echo "Ahora estás en el tag $TAG."
echo "Para volver a trabajar en main:"
echo "git checkout main"
echo ""
