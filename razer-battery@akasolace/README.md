# Razer Battery

Shows battery percentages for Razer wireless devices in the Cinnamon panel,
using the installed OpenRazer Python API. Designed for Linux Mint 22.3 /
Cinnamon 6.6; tested in a live panel with a Basilisk V3 Pro 35K.

## Requirements

Requires a working OpenRazer user daemon and `python3-openrazer` accessible to
`/usr/bin/python3`. Use your distribution's trusted package repositories and
package manager to install available OpenRazer packages. This applet does not
install drivers, add third-party package repositories, or require root at runtime.
If these packages are unavailable in your distribution's repositories, this
applet cannot provide battery readings without an existing OpenRazer setup.

## Usage

Add **Razer Battery** through System Settings → Applets. It refreshes every
60 seconds. Click it to see device names, charging status, and **Refresh now**.

All battery-capable devices are included automatically, sorted by name and
serial. The panel shows percentages such as `100% / 55%`. The icon represents
the lowest readable battery; its charging emblem means at least one readable
device reports charging. Device rows show individual charging states.

No configuration is required. Use panel edit mode to move the applet. Remove
it from the panel with the right-click menu; uninstall through Applets settings.

## Unavailable readings

`—` means there are no readable devices, the daemon is unavailable, or the
Python API is missing. The menu explains the error. Unsupported charging is
shown as unknown. Disconnected devices disappear on the next refresh or show
unavailable if OpenRazer still lists them. Firmware or daemon cached values
cannot be distinguished from live readings. A 15-second query timeout prevents
stalled queries from blocking the panel. Recovery retries automatically.

## Verification

Live panel operation and the real 100% / not-charging API reading have been
confirmed on Cinnamon 6.6.9 with a Basilisk V3 Pro 35K (Wireless). Automated
Python and JavaScript tests cover multiple-device data, failed and invalid
readings, unsupported charging, overlapping queries, timeouts, and cleanup.
Vertical-panel layout, physical charging/reconnection transitions, and multiple
physical devices have not yet been verified.

The included screenshot is a crop of the running panel applet. The square icon
is original artwork. MIT licensed; independent of Razer and Linux Mint.
