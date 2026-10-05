#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing CPU-only PyTorch to optimize memory and build time..."
pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "Installing remaining dependencies..."
pip install --no-cache-dir -r requirements.txt
