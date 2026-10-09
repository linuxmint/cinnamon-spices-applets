#!/usr/bin/python3
"""Read-only OpenRazer snapshot; stdout is always one JSON document."""
# SPDX-License-Identifier: MIT
import gettext
import json
from pathlib import Path

_ = gettext.translation('razer-battery@akasolace',
                        localedir=str(Path.home() / '.local/share/locale'),
                        fallback=True).gettext
import math


def snapshot(manager_factory):
    try:
        devices = manager_factory().devices
    except Exception:
        return {"devices": [], "error": _("OpenRazer unavailable. Check the user daemon and session bus.")}
    result = []
    for device in devices:
        try:
            if not device.has("battery"):
                continue
            name, serial = str(device.name), str(device.serial)
        except Exception:
            continue
        entry = {"name": name, "serial": serial, "battery": None, "charging": None}
        try:
            level = device.battery_level
            if isinstance(level, bool) or not isinstance(level, (int, float)):
                raise ValueError("Invalid battery")
            if not math.isfinite(level) or not 0 <= level <= 100:
                raise ValueError("Invalid battery")
            entry["battery"] = round(level)
        except Exception:
            entry["error"] = _("Battery unavailable (device disconnected or asleep).")
        if entry["battery"] is not None:
            try:
                entry["charging"] = bool(device.is_charging)
            except Exception:
                pass
        result.append(entry)
    return {"devices": sorted(result, key=lambda d: (d["name"], d["serial"])), "error": None}


def main():
    try:
        from openrazer.client import DeviceManager
    except ImportError:
        data = {"devices": [], "error": _("OpenRazer Python API missing. Install python3-openrazer for /usr/bin/python3.")}
    else:
        data = snapshot(DeviceManager)
    print(json.dumps(data, ensure_ascii=True))


if __name__ == "__main__":
    main()
