#!/bin/bash

while true; do
  clear
  echo "=================================="
  echo " HIGHSPEED ISP - MENU RAPIDO"
  echo "=================================="
  echo ""
  echo "1) Diagnóstico completo"
  echo "2) Estado del sistema"
  echo "3) Reparar / reiniciar servicios"
  echo "4) Compilar APK release firmada"
  echo "5) Update seguro: backup + build"
  echo "6) Actualizar desde GitHub"
  echo "7) Backup manual"
  echo "8) Ver URLs"
  echo "9) Git status"
  echo "10) Limpiar archivos temporales"
  echo "0) Salir"
  echo ""
  read -p "Elegí una opción: " op

  case "$op" in
    1)
      cd ~/highspeed-angel && ./diagnostico_highspeed.sh
      read -p "Enter para continuar..."
      ;;
    2)
      cd ~/highspeed-angel && ./estado_highspeed.sh
      read -p "Enter para continuar..."
      ;;
    3)
      cd ~/highspeed-angel && ./reparar_highspeed.sh
      read -p "Enter para continuar..."
      ;;
    4)
      cd ~/highspeed-angel && ./build_apk_release.sh
      read -p "Enter para continuar..."
      ;;
    5)
      cd ~/highspeed-angel && ./update_safe_highspeed.sh
      read -p "Enter para continuar..."
      ;;
    6)
      cd ~/highspeed-angel && ./actualizar_desde_github.sh
      read -p "Enter para continuar..."
      ;;
    7)
      cd ~/highspeed-angel && ./backup_highspeed_diario.sh
      read -p "Enter para continuar..."
      ;;
    8)
      echo ""
      echo "Sistema:  http://192.168.0.113:5173"
      echo "APK:      http://192.168.0.113:5173/highspeed-isp-release.apk"
      echo "Página:   http://192.168.0.113:5173/descargar.html"
      echo "QR:       http://192.168.0.113:5173/highspeed-apk-qr.png"
      echo ""
      read -p "Enter para continuar..."
      ;;
    9)
      cd ~/highspeed-angel
      git status
      echo ""
      git log --oneline -5
      read -p "Enter para continuar..."
      ;;
    10)
      cd ~/highspeed-angel && ./limpiar_highspeed.sh
      read -p "Enter para continuar..."
      ;;
    0)
      echo "Saliendo..."
      exit 0
      ;;
    *)
      echo "Opción inválida"
      sleep 1
      ;;
  esac
done
