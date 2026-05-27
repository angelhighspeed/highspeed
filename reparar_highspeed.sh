#!/bin/bash

echo "=================================="
echo " REPARAR HIGHSPEED ISP"
echo "=================================="
echo ""

echo "1) Reiniciando servicios..."
sudo systemctl restart highspeed-backend.service 2>/dev/null || true
sudo systemctl restart highspeed-frontend.service 2>/dev/null || true
sudo systemctl restart highspeed.service 2>/dev/null || true

sleep 3

echo ""
echo "2) Estado de backend"
curl -s http://127.0.0.1:8000/docs >/dev/null && echo "✅ Backend OK" || echo "❌ Backend falla"

echo ""
echo "3) Estado de frontend"
curl -s http://127.0.0.1:5173 >/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend falla"

echo ""
echo "4) APK"
if [ -f "$HOME/highspeed-angel/frontend/public/highspeed-isp-release.apk" ]; then
  echo "✅ APK disponible"
  ls -lh "$HOME/highspeed-angel/frontend/public/highspeed-isp-release.apk"
else
  echo "❌ APK no encontrada"
fi

echo ""
echo "5) Últimos logs backend"
journalctl -u highspeed-backend.service -n 20 --no-pager 2>/dev/null || true

echo ""
echo "6) Últimos logs frontend"
journalctl -u highspeed-frontend.service -n 20 --no-pager 2>/dev/null || true

echo ""
echo "=================================="
echo " URLs"
echo "=================================="
echo "Sistema:  http://192.168.0.113:5173"
echo "APK:      http://192.168.0.113:5173/highspeed-isp-release.apk"
echo "QR:       http://192.168.0.113:5173/highspeed-apk-qr.png"
echo "Descarga: http://192.168.0.113:5173/descargar.html"
echo ""
