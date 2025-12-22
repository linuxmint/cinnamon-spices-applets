#!/bin/bash
# Setup script for Adaptive Brightness Applet

set -e

echo "🌤 Adaptive Brightness Setup Script"
echo "===================================="
echo ""

# Step 1: Install brightnessctl
echo "1️⃣  Installing brightnessctl..."
if command -v brightnessctl &> /dev/null; then
    echo "   ✓ brightnessctl already installed"
else
    echo "   Installing package..."
    sudo apt update
    sudo apt install -y brightnessctl
    echo "   ✓ Installation complete"
fi

# Step 2: Configure sudo access
echo ""
echo "2️⃣  Configuring password-less sudo..."
SUDOERS_FILE="/etc/sudoers.d/brightnessctl-applet"

if sudo test -f "$SUDOERS_FILE"; then
    echo "   ✓ Sudoers entry already exists"
else
    echo "   Creating sudoers entry..."
    echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/brightnessctl" | sudo tee "$SUDOERS_FILE" > /dev/null
    sudo chmod 440 "$SUDOERS_FILE"
    echo "   ✓ Sudoers configured"
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

# Step 5: Restart Cinnamon
echo ""
echo "5️⃣  Restarting Cinnamon..."
echo "   Press Alt+F2, type 'r', and press Enter"
echo "   Or run: pkill -9 cinnamon; cinnamon &"
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Cinnamon (Alt+F2 → r → Enter)"
echo "  2. Go to Cinnamon Settings → Applets"
echo "  3. Find and enable 'Adaptive Brightness'"
echo "  4. Right-click the applet to configure settings"
