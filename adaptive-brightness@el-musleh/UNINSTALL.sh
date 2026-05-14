#!/bin/bash
# Uninstall script for Adaptive Brightness Applet

set -e

echo "🗑 Adaptive Brightness Uninstall Script"
echo "======================================"

# 1. Remove sudoers entry
SUDOERS_FILE="/etc/sudoers.d/brightnessctl-applet"
if [ -f "$SUDOERS_FILE" ]; then
    echo "1️⃣ Removing sudoers entry..."
    sudo rm "$SUDOERS_FILE"
    echo "   ✓ Sudoers entry removed"
else
    echo "1️⃣ Sudoers entry not found. Skipping."
fi

# 2. Remove applet folder
APPLET_DIR="$HOME/.local/share/cinnamon/applets/adaptive-brightness@el-musleh"
if [ -d "$APPLET_DIR" ]; then
    echo "2️⃣ Removing applet folder..."
    rm -rf "$APPLET_DIR"
    echo "   ✓ Applet folder removed"
else
    echo "2️⃣ Applet folder not found at $APPLET_DIR. Skipping."
fi

# 3. Optional: Remove brightnessctl
echo ""
echo "3️⃣ Would you like to remove 'brightnessctl'?"
read -p "Type 'yes' to remove: " confirm
if [ "$confirm" == "yes" ]; then
    echo "   Removing brightnessctl..."
    sudo apt remove -y brightnessctl
    echo "   ✓ brightnessctl removed"
else
    echo "   Skipping brightnessctl removal."
fi

echo ""
echo "✅ Uninstall complete!"
echo "   You may want to restart Cinnamon to apply changes."
