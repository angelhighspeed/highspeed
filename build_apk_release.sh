#!/bin/bash

set -e

PROJECT_DIR="$HOME/highspeed-angel"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=================================="
echo " BUILD APK RELEASE HIGHSPEED ISP"
echo "=================================="

cd "$FRONTEND_DIR"

echo ""
echo "1) Limpiando build anterior..."
rm -rf dist
rm -rf android/app/build
rm -rf android/app/src/main/assets/public
rm -f public/*.apk

echo ""
echo "2) Compilando frontend..."
npm run build

echo ""
echo "3) Sincronizando Capacitor..."
npx cap sync android

echo ""
echo "4) Compilando APK release firmada..."
cd android
./gradlew clean
./gradlew assembleRelease

echo ""
echo "5) Copiando APKs finales..."
cd "$FRONTEND_DIR"

cp android/app/build/outputs/apk/release/app-release.apk public/highspeed-isp-release.apk
cp android/app/build/outputs/apk/release/app-release.apk public/highspeed-isp-final.apk
cp android/app/build/outputs/apk/release/app-release.apk public/highspeed-mobile.apk

echo ""
echo "6) Reiniciando frontend..."
sudo systemctl restart highspeed-frontend.service

echo ""
echo "=================================="
echo " APK RELEASE LISTA"
echo "=================================="
ls -lh public/highspeed-isp-release.apk public/highspeed-isp-final.apk public/highspeed-mobile.apk

echo ""
echo "Descarga:"
echo "http://192.168.0.113:5173/highspeed-isp-release.apk"
echo "Página:"
echo "http://192.168.0.113:5173/descargar.html"
echo ""
