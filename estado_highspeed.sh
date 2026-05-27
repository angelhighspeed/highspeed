#!/bin/bash

echo "=================================="
echo " ESTADO HIGHSPEED ISP"
echo "=================================="
echo ""

echo "1) Servicios systemd"
echo "--------------------"

for service in highspeed-backend.service highspeed-frontend.service highspeed.service; do
  if systemctl list-units --type=service --all | grep -q "$service"; then
    echo ""
    echo "$service"
    systemctl is-active "$service"
    systemctl is-enabled "$service" 2>/dev/null || true
  fi
done

echo ""
echo "2) Puertos"
echo "----------"

echo -n "Backend 8000: "
curl -s http://127.0.0.1:8000/docs >/dev/null && echo "OK" || echo "FALLA"

echo -n "Frontend 5173: "
curl -s http://127.0.0.1:5173 >/dev/null && echo "OK" || echo "FALLA"

echo ""
echo "3) APK / QR / Página"
echo "-------------------"

for file in \
  frontend/public/highspeed-isp-release.apk \
  frontend/public/highspeed-mobile.apk \
  frontend/public/highspeed-apk-qr.png \
  frontend/public/descargar.html
do
  if [ -f "$file" ]; then
    echo "OK  $file"
  else
    echo "NO  $file"
  fi
done

echo ""
echo "4) Backups automáticos"
echo "---------------------"

if [ -d "$HOME/highspeed-auto-backups" ]; then
  echo "Carpeta OK: $HOME/highspeed-auto-backups"
  ls -lh "$HOME/highspeed-auto-backups" | tail -10
else
  echo "No existe carpeta de backups automáticos"
fi

echo ""
echo "5) Git"
echo "------"

git status --short
echo ""
git log --oneline -3
echo ""
git tag | tail -5

echo ""
echo "=================================="
echo " FIN"
echo "=================================="
