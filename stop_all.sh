#!/bin/bash

# SNIDS - Stop All Services Script

echo "=========================================="
echo "  SNIDS - Stopping All Services"
echo "=========================================="

echo ""
echo "Stopping Frontend (Vite)..."
pkill -f "node.*vite" 2>/dev/null || true
echo "✓ Frontend stopped"

echo ""
echo "Stopping Backend API (Uvicorn)..."
pkill -f uvicorn 2>/dev/null || true
echo "✓ Backend API stopped"

echo ""
echo "Stopping SNIDS capture script..."
sudo pkill -f "python.*snids.py" 2>/dev/null || true
echo "✓ SNIDS script stopped"

echo ""
echo "Stopping Suricata IDS..."
sudo pkill -f "suricata -i" 2>/dev/null || true
echo "✓ Suricata IDS stopped"

sleep 2

echo ""
echo "=========================================="
echo "  ✓ ALL SERVICES STOPPED"
echo "=========================================="
