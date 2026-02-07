#!/bin/bash

# Setup swap file for EC2 instances with limited RAM
# Recommended for t3.small (2GB RAM)

set -e

SWAP_SIZE="2G"

echo "🔧 Setting up ${SWAP_SIZE} swap file..."

# Check if swap already exists
if [ -f /swapfile ]; then
    echo "⚠️  Swap file already exists"
    sudo swapon --show
    exit 0
fi

# Create swap file
echo "Creating swap file..."
sudo fallocate -l $SWAP_SIZE /swapfile

# Set permissions
echo "Setting permissions..."
sudo chmod 600 /swapfile

# Make swap
echo "Making swap..."
sudo mkswap /swapfile

# Enable swap
echo "Enabling swap..."
sudo swapon /swapfile

# Make permanent
echo "Making swap permanent..."
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
echo "✅ Swap setup complete!"
sudo swapon --show
free -h
