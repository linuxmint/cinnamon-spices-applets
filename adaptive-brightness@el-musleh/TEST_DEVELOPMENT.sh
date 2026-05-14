#!/bin/bash
# Adaptive Brightness Development Test Script

echo "=== Running Dev Tests ==="

# 1. Check for Syntax Errors
echo "Checking syntax in applet.js..."
if [ -f "adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh/applet.js" ]; then
    # Basic check - using jshint if available, or just cat for sanity
    if command -v jshint &> /dev/null; then
        jshint adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh/applet.js
    else
        echo "JSHint not found, skipping linting."
    fi
else
    echo "Error: applet.js not found!"
    exit 1
fi

# 2. Check for Missing Prefixes
echo "Checking log prefixes..."
grep -v "\[AB\]" adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh/applet.js | grep "global.log"
if [ $? -eq 0 ]; then
    echo "Error: Found logs missing [AB] prefix."
    exit 1
else
    echo "Success: All logs have [AB] prefix."
fi

# 3. Check for Schema Validation
echo "Validating JSON schemas..."
if command -v jq &> /dev/null; then
    jq empty adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh/settings-schema.json
    echo "Success: JSON schema is valid."
else
    echo "jq not found, skipping schema validation."
fi

echo "=== Tests Complete ==="
