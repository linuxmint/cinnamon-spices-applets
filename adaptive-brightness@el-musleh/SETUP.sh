#!/bin/bash
# Setup script for Adaptive Brightness Applet

set -e

echo "🌤 Adaptive Brightness Setup Script"
echo "===================================="
echo ""

# Step 0: Install applet files
echo "0️⃣  Installing applet files..."
APPLET_DIR="$HOME/.local/share/cinnamon/applets/adaptive-brightness@el-musleh"
mkdir -p "$APPLET_DIR"
cp -r files/adaptive-brightness@el-musleh/* "$APPLET_DIR/"
echo "   ✓ Applet files installed"

# Step 1: Install brightnessctl
echo ""
echo "1️⃣  Installing brightnessctl..."
if command -v brightnessctl &> /dev/null; then
    echo "   ✓ brightnessctl already installed"
else
    echo "   Installing package..."
    sudo apt update
    sudo apt install -y brightnessctl
    echo "   ✓ Installation complete"
fi

# Step 2: Configure permissions for brightnessctl
echo ""
echo "2️⃣  Checking brightnessctl permissions..."

if timeout 2 sudo -n /usr/bin/brightnessctl get &>/dev/null; then
    echo "   ✓ brightnessctl already works without password"
else
    echo "   brightnessctl requires a password to run."
    echo "   The applet needs password-less access to adjust brightness."
    echo ""
    if command -v zenity &> /dev/null; then
        zenity --question --title="Adaptive Brightness Setup" \
            --text="brightnessctl requires a password.\n\nConfigure password-less sudo access for brightnessctl?" \
            --ok-label="Configure" --cancel-label="Skip" \
            --width=400 2>/dev/null
        choice=$?
    else
        read -r -p "   Configure password-less sudo for brightnessctl? [Y/n]: " reply
        if [[ "$reply" =~ ^[nN] ]]; then
            choice=1
        else
            choice=0
        fi
    fi
    if [ "$choice" -eq 0 ]; then
        echo "   Configuring sudoers entry..."
        echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/brightnessctl" | sudo tee /etc/sudoers.d/brightnessctl-applet > /dev/null
        sudo chmod 440 /etc/sudoers.d/brightnessctl-applet
        echo "   ✓ Password-less sudo configured"
    else
        echo "   ⚠ Skipped. The applet may not be able to control brightness."
    fi
fi

# Step 3: Verify sensor
echo ""
echo "3️⃣  Verifying ambient light sensor..."
if [ -r /sys/bus/iio/devices/iio:device0/in_illuminance_raw ]; then
    RAW=$(cat /sys/bus/iio/devices/iio:device0/in_illuminance_raw)
    SCALE=$(cat /sys/bus/iio/devices/iio:device0/in_illuminance_scale)
    LUX=$(echo "$RAW * $SCALE" | bc)
    echo "   ✓ Sensor found and working"
    echo "   Light level: ${LUX%.*} lux"
else
    echo "   ⚠ Sensor not found!"
    echo "   Your system may not have an ambient light sensor"
    echo "   The applet will still work if sensor is added later"
fi

# Step 4: Test brightness control
echo ""
echo "4️⃣  Testing brightness control..."
CURRENT=$(sudo /usr/bin/brightnessctl get)
echo "   Current brightness: $CURRENT"
echo "   Testing set to 50%..."
sudo /usr/bin/brightnessctl set 50% > /dev/null
sleep 1
NEW=$(sudo /usr/bin/brightnessctl get)
echo "   New brightness: $NEW"
echo "   ✓ Brightness control working"

# Restore original
sudo /usr/bin/brightnessctl set "$CURRENT" > /dev/null

# Step 5: Install development tools (optional)
echo ""
echo "5️⃣  Installing development tools (optional)..."
if command -v npm &> /dev/null; then
    echo "   Installing ESLint for code quality checks..."
    npm install --loglevel=error 2>/dev/null
    echo "   ✓ ESLint installed"
else
    echo "   ⚠ npm not found. Skipping ESLint installation."
    echo "   To install later: npm install"
fi

echo ""
echo "Next steps:"
echo "  1. Go to Cinnamon Settings → Applets"
echo "  2. Find and enable 'Adaptive Brightness'"
echo "  3. Right-click the applet to configure settings"
echo ""
echo "💡 Developer tip: to see live applet output (including Gjs errors) in a"
echo "   terminal, run:"
echo "   cinnamon --replace &"
echo ""
echo "   Or watch the current session's errors (no restart needed):"
echo "   tail -f ~/.xsession-errors | grep \"\[AB\]\""
echo ""

# Step 6: Restart Cinnamon (optional)
echo "6️⃣  Restart Cinnamon (optional)..."
echo "   You can also restart later with: Alt+F2 → r → Enter, or: cinnamon --replace &"
echo ""

if command -v zenity &> /dev/null; then
    zenity --question --title="Adaptive Brightness Setup" \
        --text="Setup complete! Restart Cinnamon now to enable the applet?" \
        --ok-label="Restart Now" --cancel-label="Later" \
        --width=400 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   Restarting Cinnamon..."
        cinnamon --replace &>/dev/null &
    else
        echo "   Skipping restart."
    fi
else
    read -r -p "   Restart Cinnamon now? [y/N]: " response
    if [[ "$response" =~ ^[yY]$ ]]; then
        echo "   Restarting Cinnamon..."
        cinnamon --replace &>/dev/null &
    else
        echo "   Skipping restart."
    fi
fi
