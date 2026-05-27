#!/bin/bash

echo "=================================="
echo " DIAGNÓSTICO HIGHSPEED ISP"
echo "=================================="
echo ""

check_ok() {
  if [ "$1" = "0" ]; then
    echo "✅ $2"
  else
    echo "❌ $2"
  fi
}

echo "1) Backend FastAPI"
curl -s http://127.0.0.1:8000/docs >/dev/null
check_ok "$?" "Backend responde en puerto 8000"

echo ""
echo "2) Login admin"
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c 'import sys,json; 
try:
 d=json.load(sys.stdin); print(d.get("access_token") or d.get("token") or "")
except Exception:
 print("")')

if [ -n "$TOKEN" ]; then
  echo "✅ Login OK"
else
  echo "❌ Login falló"
fi

echo ""
echo "3) Frontend"
curl -s http://127.0.0.1:5173 >/dev/null
check_ok "$?" "Frontend responde en puerto 5173"

echo ""
echo "4) APK final"
if [ -f ~/highspeed-angel/frontend/public/highspeed-isp-release.apk ]; then
  echo "✅ APK existe:"
  ls -lh ~/highspeed-angel/frontend/public/highspeed-isp-release.apk
else
  echo "❌ No existe highspeed-isp-release.apk"
fi

echo ""
echo "5) QR descarga"
if [ -f ~/highspeed-angel/frontend/public/highspeed-apk-qr.png ]; then
  echo "✅ QR existe:"
  ls -lh ~/highspeed-angel/frontend/public/highspeed-apk-qr.png
else
  echo "❌ No existe highspeed-apk-qr.png"
fi

echo ""
echo "6) Router MikroTik desde backend"
if [ -n "$TOKEN" ]; then
  curl -s -X POST http://127.0.0.1:8000/routers/1/test \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
else
  echo "No se prueba MikroTik porque no hay token."
fi

echo ""
echo "=================================="
echo " URLs"
echo "=================================="
echo "APK:      http://192.168.0.113:5173/highspeed-isp-release.apk"
echo "QR:       http://192.168.0.113:5173/highspeed-apk-qr.png"
echo "Página:   http://192.168.0.113:5173/descargar.html"
echo ""
