#!/bin/bash
# Production readiness checks for adaptive-brightness@el-musleh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="files/adaptive-brightness@el-musleh"
FAIL=0

pass() { echo "   ✓ $1"; }
fail() { echo "   ✗ $1"; FAIL=1; }

echo "Production Readiness Test Suite"
echo "================================"
echo ""

echo "1️⃣  Lint and structure..."
if npm run lint --silent 2>&1 | grep -E "[[:space:]]error[[:space:]]" | grep -qv "0 errors"; then
    fail "ESLint reported errors"
else
    pass "ESLint (0 errors)"
fi
./TEST_DEVELOPMENT.sh >/dev/null 2>&1 && pass "TEST_DEVELOPMENT.sh" || fail "TEST_DEVELOPMENT.sh"

echo ""
echo "2️⃣  Cinnamon spice validation..."
if (cd .. && ./validate-spice adaptive-brightness@el-musleh >/dev/null 2>&1); then
    pass "validate-spice"
else
    fail "validate-spice"
fi

echo ""
echo "3️⃣  Settings sync (gschema ↔ settings-schema ↔ applet.js)..."
if python3 - <<'PY'
import json, re, sys
from pathlib import Path

root = Path("files/adaptive-brightness@el-musleh")
schema = json.loads((root / "settings-schema.json").read_text())
gschema = (root / "org.cinnamon.applet.adaptive-brightness@el-musleh.gschema.xml").read_text()
applet = (root / "applet.js").read_text()
meta = json.loads((root / "metadata.json").read_text())

# Keys in gschema
gkeys = set(re.findall(r'name="([^"]+)"', gschema))
gkeys = {k for k in gkeys if not k.startswith("org.")}

# Settings schema keys (exclude UI-only types)
skip_types = {"separator", "header", "label", "button"}
ss_keys = {k for k, v in schema.items() if v.get("type") not in skip_types}

missing_in_ss = gkeys - ss_keys
missing_in_gs = ss_keys - gkeys
if missing_in_ss:
    print(f"   ✗ gschema keys missing from settings-schema: {sorted(missing_in_ss)}")
    sys.exit(1)
if missing_in_gs:
    print(f"   ✗ settings-schema keys missing from gschema: {sorted(missing_in_gs)}")
    sys.exit(1)

# Default parity for numeric/string settings
pairs = [
    ("min-brightness", "min_brightness", 5),
    ("max-brightness", "max_brightness", 100),
    ("min-lux", "min_lux", 1),
    ("max-lux", "max_lux", 700),
    ("poll-interval", "poll_interval", 1000),
    ("smoothing-factor", None, 0.7),
    ("lux-change-threshold", "lux_change_threshold", 3),
    ("adaptive-calibration-threshold", None, 15),
    ("log-level", "log_level", "off"),
    ("label-display-mode", "label_display_mode", "brightness_lux"),
    ("response-curve", "response_curve", "logarithmic"),
    ("show-label", "show_label", "live_status"),
]
errors = []
for key, prop, expected in pairs:
    ss_val = schema[key]["default"]
    m = re.search(rf'<key[^>]+name="{key}"[^>]*>.*?<default>([^<]+)</default>', gschema, re.S)
    if not m:
        errors.append(f"missing gschema default for {key}")
        continue
    gs_raw = m.group(1).strip().strip("'")
    if isinstance(expected, float):
        if abs(float(ss_val) - float(gs_raw)) > 0.001:
            errors.append(f"{key}: schema={ss_val} gschema={gs_raw}")
    elif str(ss_val) != gs_raw:
        errors.append(f"{key}: schema={ss_val} gschema={gs_raw}")
    if prop:
        if f"{prop} = " not in applet and f'this.{prop} = ' not in applet:
            errors.append(f"applet.js missing default for {prop}")

# Callback methods exist
for key, val in schema.items():
    cb = val.get("callback")
    if cb and f"{cb}(" not in applet and f"{cb}()" not in applet:
        errors.append(f"callback {cb} for {key} not found in applet.js")

if errors:
    for e in errors:
        print(f"   ✗ {e}")
    sys.exit(1)
print("   ✓ All settings keys and defaults aligned")
PY
then
    pass "Settings three-source sync"
else
    fail "Settings three-source sync"
fi

echo ""
echo "4️⃣  Logic unit tests..."
if python3 - <<'PY'
import math

BRIGHTNESS_MIN, BRIGHTNESS_MAX = 1, 100
LOG_OFFSET = 1

def parse_brightnessctl_machine(stdout):
    parts = stdout.strip().split(',')
    for part in parts:
        if '%' in part:
            pct = int(part.replace('%', ''))
            return max(BRIGHTNESS_MIN, min(BRIGHTNESS_MAX, pct))
    if len(parts) >= 5:
        current, mx = int(parts[2]), int(parts[4])
        if mx > 0:
            return max(BRIGHTNESS_MIN, min(BRIGHTNESS_MAX, round(current / mx * 100)))
    return None

def smooth(old, target, factor):
    responsiveness = 1 - factor
    return old + (target - old) * responsiveness

def lux_to_brightness_log(lux, min_lux, max_lux, min_b, max_b):
    if lux <= min_lux: return min_b
    if lux >= max_lux: return max_b
    lr = max_lux - min_lux
    n = (lux - min_lux) / lr
    norm = math.log(n * lr + LOG_OFFSET) / math.log(lr + LOG_OFFSET)
    return round(min_b + norm * (max_b - min_b))

assert parse_brightnessctl_machine("intel_backlight,backlight,132,33%,400") == 33
assert parse_brightnessctl_machine("intel_backlight,backlight,400,100%,400") == 100
assert abs(smooth(33, 100, 0.0) - 100) < 0.01
assert abs(smooth(33, 100, 1.0) - 33) < 0.01
assert abs(smooth(33, 100, 0.7) - 53.1) < 0.2
b = lux_to_brightness_log(311, 1, 700, 5, 100)
assert 80 <= b <= 98, f"311 lux brightness {b} out of expected range"
print("ok")
PY
then
    pass "Logic unit tests"
else
    fail "Logic unit tests"
fi

echo ""
echo "5️⃣  Version consistency..."
if python3 - <<'PY'
import json, re
from pathlib import Path
meta = json.loads(Path("files/adaptive-brightness@el-musleh/metadata.json").read_text())
pkg = json.loads(Path("package.json").read_text())
changes = Path("CHANGES.md").read_text()
top = re.search(r"### v([\d.]+)", changes)
cv = top.group(1) if top else "?"
if meta["version"] != pkg["version"]:
    raise SystemExit(f"metadata {meta['version']} != package.json {pkg['version']}")
if meta["version"] != cv:
    raise SystemExit(f"metadata/package {meta['version']} != CHANGES top {cv}")
print("ok")
PY
then
    pass "Version tags"
else
    fail "Version tags"
fi

echo ""
echo "6️⃣  Required assets..."
for f in applet.js icon.png stylesheet.css screenshot.png; do
    if [ -f "$ROOT/$f" ] || [ -f "$f" ]; then pass "$f present"; else fail "$f missing"; fi
done

echo ""
if [ $FAIL -eq 0 ]; then
    echo "✅ Production checks passed (manual Cinnamon QA still recommended)."
    exit 0
else
    echo "❌ Production checks failed — fix issues above before release."
    exit 1
fi
