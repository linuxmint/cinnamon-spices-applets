# Modern Sound

A modern Cinnamon panel sound applet — compact by default, expandable when needed.

## Install

1. Open **Menu → Preferences → Applets**
2. Go to **Download**
3. Search for **Modern Sound** and install
4. Add it to your panel


## Using the applet

### Left click — sound menu

- **Master volume** — slider with percentage (100% mark when overamplification is on)
- **Mic volume** — slider with percentage
- **Output device** — current speaker/headphone; click the row to expand when multiple devices are available
- **Input device** — current microphone; click the row to expand when multiple devices are available
- **Applications** — per-app volume for apps that are playing audio
- **Quick actions** — Mute Sound · Mute Mic · Open Settings

### Scroll wheel — panel icon

| Action | Effect |
|--------|--------|
| **Scroll** | Raise or lower **output** volume |
| **Shift + scroll** | Raise or lower **mic** volume |

Scroll step, direction, and OSD are configurable (see below). Default step is 5%.

### Middle click — panel icon

Configurable actions for plain and **Shift + middle-click** (mute output, mute input, combined mute, or play/pause).

### Right click — applet options

- **Configure…** — applet settings (see below)
- **Panel Settings…** / **Remove Applet…** — standard Cinnamon panel options

## Settings

Right-click the applet → **Configure…**

### Panel

| Setting | Description |
|---------|-------------|
| **Open menu** | Keyboard shortcut to open the menu (default: `Shift+Super+S`) |
| **Middle-click action** | Action on middle-click (default: toggle mute) |
| **Shift + middle-click action** | Action on Shift+middle-click (default: toggle mic mute) |
| **Show volume in tooltip** | When off, tooltip shows **Sound** instead of `Volume: N%` |
| **Volume scroll step** | Scroll adjustment step in percent (1–10%, default 5%) |
| **Invert scroll direction** | Reverse scroll up/down for panel and menu sliders |

### Sound Change Effects

| Setting | Description |
|---------|-------------|
| **Play sound when changing output volume** | Volume click sound for output sliders and panel scroll (mic always silent) |
| **Show volume OSD when scrolling the panel icon** | Brief on-screen volume indicator when scrolling the panel icon |

### Devices

| Setting | Description |
|---------|-------------|
| **Hide output device when only one is available** | Removes the output row from the menu when you have a single output |
| **Hide input device when only one is available** | Removes the input row from the menu when you have a single microphone |

When a hide-single-device setting is off (default), the device row stays visible even with one device — useful to see which device is active.

## Feedback

For bug reports, feature requests, and other feedback, open an issue on the development repository:

[github.com/hus201/cinnamon-modern-sound-applet/issues](https://github.com/hus201/cinnamon-modern-sound-applet/issues)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.
