# Hotspot Manager

Start a Wi-Fi hotspot from the Cinnamon panel with one switch. See which devices are
connected, copy or reveal the network name and password, and show a QR code that a
phone camera can scan to join.

Tested on Linux Mint 22.3 with X11 and a Realtek RTL8188CE adapter.

## Requirements

- Linux Mint with Cinnamon and NetworkManager (the default).
- A Wi-Fi adapter that supports access-point (AP) mode. Check with
  `iw list | grep -A12 "Supported interface modes" | grep AP`.
  If a line containing AP appears, the adapter can host a hotspot.
- The `jq` and `qrencode` packages: `sudo apt install jq qrencode`.
  The applet does not install them for you. Without jq the applet cannot read its
  status. Without qrencode the Show QR to join button reports an error.

## Installation

Hotspot Manager is not yet in the Cinnamon Spices catalogue. Once it is published,
install it from System Settings, then Applets, then Download.

After installing, restart Cinnamon (Alt+F2, type `r`, Enter), right-click the panel,
choose Applets, and add Hotspot Manager.

## Usage

Click the icon and turn on the Hotspot switch. The status reads ON AIR while the
hotspot runs, OFFLINE when it is off, and WORKING while a change is in progress.

- Reveal password, Copy password and Copy SSID work from the menu.
- Show QR to join creates a QR code that a phone camera can scan.
- Settings changes the network name or password. Press Save & apply, and a running
  hotspot restarts with the new values. Generate password creates a random one.
- Devices lists each connected device with its IP address and state. A device that
  sends no name appears as "unknown device". A notification appears when a device
  joins or leaves.
- Auto-off turns the hotspot off after 30, 60 or 120 minutes. It works only while
  Cinnamon is running.

## Limits

- The hotspot and your normal Wi-Fi share one adapter. On a Realtek RTL8188CE, starting
  the hotspot disconnected the laptop from its Wi-Fi network, and the connection came
  back after the hotspot was stopped. Other adapters may behave differently.
- A phone that joins the hotspot reaches the internet when this computer has a working
  Ethernet connection, using DHCP. Tested on a Realtek RTL8188CE. Sharing a Wi-Fi
  connection does not work on this card, because the Wi-Fi link drops when the hotspot
  starts.
- The number of devices depends on the adapter.
- The hotspot does not start automatically at boot.

## Privacy and security

- The Wi-Fi password is stored in plain text in `~/.config/hotspot-manager/config.json`.
  Only your user account can read the file.
- The QR image also contains the password, at `~/.config/hotspot-manager/qr/join.png`.
  Only you can read it. Delete it when you no longer need it.
- When the hotspot starts, the password is passed to `nmcli` as a command argument.
  Other users on the computer could see it briefly in the process list. This is a known
  limitation.
- The applet makes no network requests. It runs local `nmcli` and `ip` commands only.

## Troubleshooting

- The switch turns back off by itself: read the log with
  `grep "hotspot-manager" ~/.xsession-errors | tail -20`.
- "no Wi-Fi adapter found": check that your adapter appears as type wifi in
  `nmcli device status`.
- "Connection activation failed": the adapter may not support AP mode, or it may be
  busy. Try `nmcli device disconnect <adapter>` first, using your adapter name.
- "cannot read hotspot status": install `jq`.

## License

GPL-2.0-only. See the LICENSE file.
