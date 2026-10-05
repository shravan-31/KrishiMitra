#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==============================================="
echo "Step 1: Building React Frontend Vite App"
echo "==============================================="
cd frontend
npm install
npm run build
cd ..

echo "==============================================="
echo "Step 2: Installing Python Backend Dependencies"
echo "==============================================="
cd backend
# Install CPU-only PyTorch first to save memory and avoid GPU bloat
pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install --no-cache-dir -r requirements.txt
cd ..

echo "==============================================="
echo "Build Finished Successfully!"
echo "==============================================="
