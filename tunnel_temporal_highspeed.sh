#!/bin/bash

echo "=================================="
echo " TUNNEL TEMPORAL HIGHSPEED ISP"
echo "=================================="
echo ""
echo "Cuando aparezca la URL trycloudflare.com, copiala."
echo "Dejá esta terminal abierta mientras uses el acceso externo."
echo ""

cloudflared tunnel --url http://127.0.0.1:5173
