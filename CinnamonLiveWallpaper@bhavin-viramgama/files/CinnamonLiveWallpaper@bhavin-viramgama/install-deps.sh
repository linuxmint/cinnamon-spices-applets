#!/bin/bash

# live-wallpaper applet dependency installation script
echo "Installing dependencies for Live Wallpaper applet..."

# Check if apt is available (Debian/Ubuntu/Mint)
if ! command -v apt >/dev/null 2>&1; then
    echo "Error: apt package manager not found. Please manually install mpv, socat, and xwinwrap."
    exit 1
fi

sudo apt update
# sudo apt install -y mpv socat git make gcc libx11-dev libxext-dev libxrender-dev
sudo apt install -y mpv socat git make gcc libx11-dev libxext-dev libxrender-dev xdotool

# Install xwinwrap from source if not available
if ! command -v xwinwrap >/dev/null 2>&1; then
    echo "Installing xwinwrap from source..."
    cd /tmp
    git clone https://github.com/mmhobi7/xwinwrap.git
    cd xwinwrap
    make
    sudo make install
    cd ..
    rm -rf xwinwrap
fi

echo "Dependencies installed successfully!"
