#!/bin/bash
# Development testing script

echo "🛠️  Development Test Suite"
echo "=========================="
echo ""

echo "1️⃣  Validating JSON files..."
if python3 -m json.tool files/adaptive-brightness@el-musleh/settings-schema.json > /dev/null 2>&1; then
    echo "   ✓ settings-schema.json valid"
else
    echo "   ✗ settings-schema.json invalid"
fi

if python3 -m json.tool files/adaptive-brightness@el-musleh/metadata.json > /dev/null 2>&1; then
    echo "   ✓ metadata.json valid"
else
    echo "   ✗ metadata.json invalid"
fi

if python3 -m json.tool info.json > /dev/null 2>&1; then
    echo "   ✓ info.json valid"
else
    echo "   ✗ info.json invalid"
fi

echo ""
echo "2️⃣  Checking settings defaults..."
if python3 - <<'PY' >/dev/null 2>&1
import json
with open("files/adaptive-brightness@el-musleh/settings-schema.json", "r", encoding="utf-8") as f:
    data = json.load(f)
assert data["min-lux"]["default"] == 1
assert data["max-lux"]["default"] == 700
assert data["label-display-mode"]["default"] == "brightness_lux"
assert "brightness_lux" in data["label-display-mode"]["options"].values()
assert data["response-curve"]["default"] == "logarithmic"
assert "logarithmic" in data["response-curve"]["options"].values()
assert data["log-level"]["default"] == "off"
assert "off" in data["log-level"]["options"].values()
PY
then
    echo "   ✓ numeric and combobox defaults are valid"
else
    echo "   ✗ numeric and combobox defaults are invalid"
fi

echo ""
echo "3️⃣  Checking file structure..."
if [ -f "files/adaptive-brightness@el-musleh/applet.js" ]; then
    echo "   ✓ applet.js present"
else
    echo "   ✗ applet.js missing"
fi

if [ -f "files/adaptive-brightness@el-musleh/icon.png" ]; then
    echo "   ✓ icon.png present"
else
    echo "   ✗ icon.png missing"
fi

if [ -f "screenshot.png" ]; then
    echo "   ✓ screenshot.png present"
else
    echo "   ✗ screenshot.png missing"
fi

echo ""
echo "4️⃣  Checking settings sections..."
if grep -q '"description": "Travel Mode"' files/adaptive-brightness@el-musleh/settings-schema.json && \
   grep -q '"description": "Logs"' files/adaptive-brightness@el-musleh/settings-schema.json; then
    echo "   ✓ Travel Mode and Logs sections present"
else
    echo "   ✗ Travel Mode/Logs sections missing"
fi

echo ""
echo "Run './validate-spice adaptive-brightness@el-musleh' for full validation."
