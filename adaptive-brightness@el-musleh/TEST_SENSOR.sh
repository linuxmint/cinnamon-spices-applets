#!/bin/bash
# Test script to verify ambient light sensor functionality

echo "🧪 Ambient Light Sensor Diagnostic"
echo "==================================="
echo ""

# Check for sensors
echo "1️⃣  Looking for ambient light sensors..."
SENSOR_FOUND=false
for i in {0..9}; do
    SENSOR_PATH="/sys/bus/iio/devices/iio:device${i}/in_illuminance_raw"
    if [ -r "$SENSOR_PATH" ]; then
        RAW=$(cat "$SENSOR_PATH" 2>/dev/null)
        SCALE=$(cat "/sys/bus/iio/devices/iio:device${i}/in_illuminance_scale" 2>/dev/null || echo "1")
        LUX=$(echo "$RAW * $SCALE" | bc)
        echo "   ✓ Found sensor at iio:device${i}"
        echo "   Raw: $RAW, Scale: $SCALE, Lux: ${LUX%.*}"
        SENSOR_FOUND=true
    fi
done

if [ "$SENSOR_FOUND" = false ]; then
    echo "   ✗ No ambient light sensor found"
    echo "   Checked paths: /sys/bus/iio/devices/iio:device[0-9]/in_illuminance_raw"
fi

echo ""
echo "2️⃣  Checking brightnessctl..."
if command -v brightnessctl &> /dev/null; then
    echo "   ✓ brightnessctl installed at: $(which brightnessctl)"
    echo "   Current brightness: $(sudo brightnessctl get 2>/dev/null || echo 'permission denied')"
else
    echo "   ✗ brightnessctl not found"
    echo "   Install with: sudo apt install brightnessctl"
fi

echo ""
echo "3️⃣  Checking sudo permissions..."
if sudo -n brightnessctl get &> /dev/null; then
    echo "   ✓ Password-less sudo configured"
else
    echo "   ✗ Sudo requires password or not configured"
    echo "   Run SETUP.sh to configure password-less sudo"
fi

echo ""
echo "Diagnostic complete."
