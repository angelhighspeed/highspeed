#!/bin/bash

set -e

PROJECT_DIR="$HOME/highspeed-angel"
BACKUP_DIR="$HOME/backups_highspeed_reinicio_apk"
DATE=$(date +"%F_%H-%M")

echo "=================================="
echo " ACTUALIZAR HIGHSPEED DESDE GITHUB"
echo "=================================="
echo ""

cd "$PROJECT_DIR"

echo "1) Revisando cambios locales..."
if [ -n "$(git status --short)" ]; then
  echo "⚠️ Hay cambios locales sin guardar:"
  git status --short
  echo ""
  echo "Primero hacé commit o backup antes de actualizar."
  exit 1
fi

echo "✅ Git limpio"

echo ""
echo "2) Backup antes de actualizar..."
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/highspeed_antes_pull_$DATE.tar.gz" \
  backend/app \
  frontend/src \
  frontend/assets \
  frontend/android/app/src/main/res \
  frontend/package.json \
  frontend/capacitor.config.json \
  frontend/.env \
  frontend/.env.production 2>/dev/null || true

echo "✅ Backup creado: $BACKUP_DIR/highspeed_antes_pull_$DATE.tar.gz"

echo ""
echo "3) Descargando cambios desde GitHub..."
git pull origin main

echo ""
echo "4) Instalando dependencias frontend si cambiaron..."
cd "$PROJECT_DIR/frontend"
npm install

echo ""
echo "5) Reiniciando servicios..."
sudo systemctl restart highspeed-backend.service 2>/dev/null || true
sudo systemctl restart highspeed-frontend.service 2>/dev/null || true

echo ""
echo "=================================="
echo " ACTUALIZACION COMPLETADA"
echo "=================================="
echo "Sistema: http://192.168.0.113:5173"
echo ""
