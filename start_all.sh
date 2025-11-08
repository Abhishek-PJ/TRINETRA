#!/bin/bash

# SNIDS - Start All Services Script
# This script stops any running services and starts all components

set -e  # Exit on error

PROJECT_DIR="/home/abhishek/trinetra_demo/TRINETRA"
INTERFACE="wlp0s20f3"

echo "=========================================="
echo "  SNIDS - Starting All Services"
echo "=========================================="

# Step 1: Stop existing services
echo ""
echo "[1/5] Stopping existing services..."
pkill -f "node.*vite" 2>/dev/null || true
pkill -f uvicorn 2>/dev/null || true
sudo pkill -f "python.*snids.py" 2>/dev/null || true
sudo pkill -f "suricata -i" 2>/dev/null || true
sleep 2
echo "✓ All services stopped"

# Step 2: Start Suricata IDS
echo ""
echo "[2/5] Starting Suricata IDS on interface ${INTERFACE}..."
sudo suricata -i ${INTERFACE} -c /etc/suricata/suricata.yaml -D
sleep 2

if pgrep -f "suricata -i" > /dev/null; then
    echo "✓ Suricata IDS started successfully"
else
    echo "✗ Failed to start Suricata IDS"
    exit 1
fi

# Step 3: Start SNIDS capture script
echo ""
echo "[3/5] Starting SNIDS traffic capture script..."
cd ${PROJECT_DIR}
sudo -E env "SURICATA_IFACE=${INTERFACE}" "SURICATA_ONLY=1" .venv/bin/python src/snids.py > /tmp/snids.log 2>&1 &
sleep 3

if pgrep -f "snids.py" > /dev/null; then
    echo "✓ SNIDS capture script started successfully"
else
    echo "✗ Failed to start SNIDS script"
    exit 1
fi

# Step 4: Start Backend API
echo ""
echo "[4/5] Starting Backend API (port 8000)..."
cd ${PROJECT_DIR}/webapi
../.venv/bin/python -m uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
sleep 3

if pgrep -f uvicorn > /dev/null; then
    echo "✓ Backend API started successfully"
else
    echo "✗ Failed to start Backend API"
    exit 1
fi

# Step 5: Start Frontend
echo ""
echo "[5/5] Starting Frontend (port 5173)..."
cd ${PROJECT_DIR}/webui
npm run dev > /tmp/frontend.log 2>&1 &
sleep 3

if pgrep -f "node.*vite" > /dev/null; then
    echo "✓ Frontend started successfully"
else
    echo "✗ Failed to start Frontend"
    exit 1
fi

# Summary
echo ""
echo "=========================================="
echo "  ✓ ALL SERVICES STARTED SUCCESSFULLY"
echo "=========================================="
echo ""
echo "Service Status:"
echo "  • Suricata IDS:      Running on ${INTERFACE}"
echo "  • SNIDS Script:      Capturing traffic (30s intervals)"
echo "  • Backend API:       http://localhost:8000"
echo "  • Frontend UI:       http://localhost:5173"
echo ""
echo "Logs:"
echo "  • Suricata:          /var/log/suricata/eve.json"
echo "  • SNIDS Script:      /tmp/snids.log"
echo "  • Backend API:       /tmp/backend.log"
echo "  • Frontend:          /tmp/frontend.log"
echo ""
echo "To stop all services, run: ./stop_all.sh"
echo "=========================================="
