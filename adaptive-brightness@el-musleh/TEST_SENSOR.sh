#!/bin/bash

echo "=== Adaptive Brightness Sensor Test ==="
echo ""

echo "1. Checking sensor files..."
if [ -r /sys/bus/iio/devices/iio:device0/in_illuminance_raw ]; then
    echo "   ✓ Raw sensor readable"
    RAW=$(cat /sys/bus/iio/devices/iio:device0/in_illuminance_raw)
    echo "   Current reading: $RAW"
else
    echo "   ✗ Raw sensor NOT readable"
fi

if [ -r /sys/bus/iio/devices/iio:device0/in_illuminance_scale ]; then
    echo "   ✓ Scale sensor readable"
    SCALE=$(cat /sys/bus/iio/devices/iio:device0/in_illuminance_scale)
    echo "   Scale value: $SCALE"
else
    echo "   ✗ Scale sensor NOT readable"
fi

echo ""
echo "2. Checking brightnessctl..."
if command -v brightnessctl &> /dev/null; then
    echo "   ✓ brightnessctl installed"
    BRIGHTNESS=$(sudo /usr/bin/brightnessctl get)
    echo "   Current brightness: $BRIGHTNESS"
else
    echo "   ✗ brightnessctl NOT installed"
    echo "   Install with: sudo apt install brightnessctl"
fi

echo ""
echo "3. Checking sudo permissions..."
if sudo -n /usr/bin/brightnessctl get &> /dev/null 2>&1; then
    echo "   ✓ Sudo password-less access configured"
else
    echo "   ⚠ Sudo requires password (or not configured)"
    echo "   Setup with: echo \"\$USER ALL=(ALL) NOPASSWD: /usr/bin/brightnessctl\" | sudo tee /etc/sudoers.d/brightnessctl-applet"
fi

echo ""
echo "=== System Ready ==="
