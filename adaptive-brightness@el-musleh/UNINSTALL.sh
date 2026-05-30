#!/bin/bash
# Uninstall script for Adaptive Brightness Applet

echo "🗑️  Uninstalling Adaptive Brightness Applet"
echo "============================================"
echo ""

APPLET_DIR="$HOME/.local/share/cinnamon/applets/adaptive-brightness@el-musleh"
SUDOERS_FILE="/etc/sudoers.d/brightnessctl-applet"

# Remove applet files
if [ -d "$APPLET_DIR" ]; then
    echo "Removing applet files..."
    rm -rf "$APPLET_DIR"
    echo "   ✓ Applet files removed"
else
    echo "   ℹ Applet not installed in user directory"
fi

# Ask about sudoers
if sudo test -f "$SUDOERS_FILE"; then
    echo ""
    read -p "Remove password-less sudo configuration? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo rm -f "$SUDOERS_FILE"
        echo "   ✓ Sudo configuration removed"
    else
        echo "   ℹ Sudo configuration kept"
    fi
fi

echo ""
echo "✅ Uninstall complete"
echo ""
echo "Note: brightnessctl package was not removed."
echo "To remove it manually: sudo apt remove brightnessctl"
echo "If you want to clear applet settings too: rm -f ~/.config/cinnamon/spices/adaptive-brightness@el-musleh/*.json"
echo ""
echo "Please restart Cinnamon (Alt+F2 → r → Enter)"
