---
id: 6d2206ef-bbf2-48d5-b54e-9951ce827ec7
title: README
tags: []
pinned: false
created: 2026-11-01T13:37:12.238251807+00:00
modified: 2026-11-01T13:44:08.208013022+00:00
---
# README

# ADB TV Brightness

Scroll over the panel icon to adjust a compatible TV's brightness; click for a slider.

Requires Python 3 and an authorised ADB connection.

Tested with Cinnamon 6.6.9 and a TV exposing `global/picture_backlight` (range 0–100). Support for other controllers must be confirmed interactively; Android TVs differ by manufacturer.

## ADB setup

On Linux Mint, install the distribution package:

```sh
sudo apt install adb
```

Enable the TV's Developer options (usually by selecting Build number seven times in Settings → About), then enable USB debugging and, if provided, network/ADB debugging. Menu names vary. For TVs providing legacy network ADB:

```sh
adb connect TV_IP:5555
adb devices -l
```

Accept the authorisation prompt on the TV. The device must show `device`, not `unauthorized` or `offline`. If network debugging requires initial USB setup, connect using a manufacturer-supported USB data connection, authorise, then run `adb -s USB_SERIAL tcpip 5555` followed by `adb connect TV_IP:5555`.

Devices with Wireless debugging pairing instead use `adb pair TV_IP:PAIRING_PORT` and `adb connect TV_IP:CONNECTION_PORT` with the ports shown on the TV. Some TVs do not offer either connection method. Use network debugging only on a trusted LAN; disable it when no longer needed.

[Official Android ADB documentation](https://developer.android.com/tools/adb) (credibility: 10/10; platform-maintainer documentation).

## Configure the applet

Right-click the icon → Configure. Enter the authorised ADB serial or TV address:port, controller type, setting name/path and verified native range. A blank device disables communication. No personal address is shipped.

For the originally tested TV:

- Type: Android setting
- Namespace: Global
- Name: `picture_backlight`
- Minimum: 0; maximum: 100; scroll step: 5 percentage points

The slider maps 0–100% to the native range. The applet refreshes every ten seconds, including changes made by other tools. Existing keyboard shortcuts are untouched.

## Discover a controller

The complete discovery tool is included in the installed applet:

```sh
cd ~/.local/share/cinnamon/applets/adb-tv-brightness@AtomicRobotMan0101
python3 discover_brightness.py --scan-only
python3 discover_brightness.py
# Select a particular connected device:
python3 discover_brightness.py --device TV_IP:5555
```

The inventory reads global/system/secure settings, device properties, display/power/lights diagnostics, service names and exposed sysfs backlights. It lists matching names and current values. Modes, automatic controls, colour tuning and non-integer settings are diagnostic only. 

No root access or undocumented vendor service calls are attempted.

Choose Y/N/Q for each testable candidate. Android settings do not declare their range: enter supported minimum/maximum values from verified device knowledge. Sysfs candidates use their exposed maximum. Do not guess a range from a current value. Press Enter to run the test:

1. Read the original value.
2. Reduce the numeric value by 20%, bounded by the minimum (for example 60 → 48).
3. Hold for three seconds; restore and verify the original value.
4. Answer “Did this drop and increase the brightness of your screen?”
5. Y saves the confirmed controller and exits; N moves to the next candidate.

Copy the confirmed fields into **Configure**. Discovery saves a proposal, not the applet's settings. Runtime settings are maintained exclusively by Cinnamon's settings API. The report/proposal are stored under `~/.local/state/adb-tv-brightness@AtomicRobotMan0101/` (`XDG_STATE_HOME` is honoured). Reports may contain private identifiers; inspect before sharing. No runtime data is written to the applet installation directory by default.

Restoration is attempted on errors, Ctrl-C and termination. Disconnection, power loss or a forced kill can prevent it: the error reports the original value for manual restoration. Testing stops on errors. Stop other brightness-changing tools during discovery. The numeric reduction does not imply a linear change in perceived luminance. Some manufacturer-only controllers cannot be discovered.

## Troubleshooting

- Blank device: right-click → Configure and enter the device.
- Connection error: check `adb devices -l`, network access and authorisation.
- Missing helper command: install `adb` and `python3` through your distribution.
- Value changes but screen does not: test a different controller; a readable Android setting is not proof that the TV uses it.
- Sysfs permission denied: choose a supported controller; this applet does not root the TV or change permissions.

The tooltip shows command errors. Pending changes are discarded after failures.

<!-- -->
## About

Developed by Evan McBeth. MIT licensed. The icon is original artwork included under the same licence.
