#!/bin/bash

echo "=================================="
echo " LIMPIEZA HIGHSPEED ISP"
echo "=================================="
echo ""

echo "1) Limpiando backups automáticos viejos..."
find "$HOME/highspeed-auto-backups" -type f -name "*.json" -mtime +30 -delete 2>/dev/null || true
find "$HOME/highspeed-auto-backups" -type f -name "*.log" -size +20M -exec truncate -s 5M {} \; 2>/dev/null || true

echo "✅ Backups/logs automáticos limpiados"

echo ""
echo "2) Limpiando backups manuales viejos..."
find "$HOME/backups_highspeed_reinicio_apk" -type f -name "*.tar.gz" -mtime +60 -delete 2>/dev/null || true

echo "✅ Backups manuales viejos limpiados"

echo ""
echo "3) Limpiando builds Android antiguos..."
rm -rf "$HOME/highspeed-angel/frontend/android/app/build" 2>/dev/null || true
rm -rf "$HOME/highspeed-angel/frontend/android/build" 2>/dev/null || true

echo "✅ Builds Android limpiados"

echo ""
echo "4) Limpiando dist viejo..."
rm -rf "$HOME/highspeed-angel/frontend/dist" 2>/dev/null || true

echo "✅ Dist limpiado"

echo ""
echo "5) Espacio en disco:"
df -h /

echo ""
echo "=================================="
echo " LIMPIEZA COMPLETADA"
echo "=================================="
