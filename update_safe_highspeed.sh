#!/bin/bash

set -e

PROJECT_DIR="$HOME/highspeed-angel"
BACKUP_DIR="$HOME/backups_highspeed_reinicio_apk"
DATE=$(date +"%F_%H-%M")

echo "=================================="
echo " UPDATE SEGURO HIGHSPEED ISP"
echo "=================================="
echo ""

cd "$PROJECT_DIR"

echo "1) Revisando estado Git..."
if [ -n "$(git status --short)" ]; then
  echo "⚠️ Hay cambios sin guardar:"
  git status --short
  echo ""
  echo "Primero hacé commit o backup antes de continuar."
  exit 1
fi

echo "✅ Git limpio"

echo ""
echo "2) Creando backup rápido..."
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/highspeed_update_safe_$DATE.tar.gz" \
  backend/app \
  frontend/src \
  frontend/assets \
  frontend/android/app/src/main/res \
  frontend/package.json \
  frontend/capacitor.config.json \
  frontend/.env \
  frontend/.env.production 2>/dev/null || true

echo "✅ Backup creado: $BACKUP_DIR/highspeed_update_safe_$DATE.tar.gz"

echo ""
echo "3) Compilando APK release..."
./build_apk_release.sh

echo ""
echo "4) Guardando APK compilada..."
cp frontend/public/highspeed-isp-release.apk \
  "$BACKUP_DIR/highspeed-isp-release-update-safe-$DATE.apk"

echo ""
echo "=================================="
echo " UPDATE SEGURO COMPLETADO"
echo "=================================="
echo "APK:"
echo "http://192.168.0.113:5173/highspeed-isp-release.apk"
echo ""
