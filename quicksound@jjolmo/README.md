# Quick Sound Applet

A fork of the Cinnamon sound applet with enhanced device switching capabilities and improved user experience.

## Overview

Quick Sound is a Cinnamon panel applet that provides comprehensive audio control, including volume management, media player control, and **simplified output device switching**. It extends the original sound applet with features that make switching between audio devices faster and more intuitive.

## Key Differences from the Original Sound Applet

### 1. **Direct Device Switching in Main Menu**
   - Output devices are displayed directly in the main menu (not hidden in a submenu)
   - Active device is visually highlighted with the system accent color
   - Quick one-click switching between audio devices

### 2. **Custom Device Icons and Names**
   - Configure up to 10 custom rules to assign custom icons and names to devices
   - Devices are matched by description string (case-insensitive)
   - Example: Automatically show a headphone icon for devices containing "headset"

### 3. **Device Filtering**
   - Filter out unwanted devices from the list using a comma-separated filter list
   - Useful for hiding virtual devices or duplicate entries

### 4. **Visual Enhancements**
   - Active device highlighted with system accent color
   - Custom icons displayed for each device based on rules
   - Cleaner, more intuitive interface

## Features

- **Volume Control**: Adjust system volume with mouse wheel or slider
- **Media Player Control**: Control MPRIS-compatible media players (play, pause, next, previous, seek)
- **Output Device Switching**: Quickly switch between audio output devices
- **Input Device Control**: Manage microphone input and mute controls
- **Application Volume**: Control volume for individual applications
- **Customizable Display**: Show track information, album art, and player controls
- **Device Customization**: Custom icons and names for audio devices

## Installation

1. Copy the `quicksound@jjolmo` folder to your Cinnamon applets directory:
   ```bash
   cp -r quicksound@jjolmo ~/.local/share/cinnamon/applets/
   ```

2. Enable the applet in Cinnamon Settings:
   - Open Cinnamon Settings → Applets
   - Find "Quick Sound" and enable it

## Usage

### Basic Controls

- **Left Click**: Open the sound menu
- **Mouse Wheel**: Adjust volume (scroll up/down)
- **Middle Click**: Toggle mute (configurable in settings)
- **Shift + Middle Click**: Toggle input mute (configurable in settings)

### Switching Audio Devices

1. Click the sound applet icon in the panel
2. Scroll to the bottom of the menu to see available output devices
3. Click on any device to switch to it
4. The active device is highlighted with your system accent color

### Configuring Device Rules

Device rules allow you to customize how devices appear in the menu:

1. Right-click the applet → **Configure**
2. Navigate to the "Device rules" sections
3. For each rule (1-10):
   - **Rule**: Enter a string that appears in the device description (e.g., "headset", "bluetooth")
   - **Icon**: Enter the icon name (e.g., "audio-headphones-symbolic", "bluetooth-symbolic")
   - **Name**: Enter a custom name to display instead of the device description

**Example Configuration:**
- Rule: "headset"
- Icon: "audio-headphones-symbolic"
- Name: "Headset"

Any device with "headset" in its description will show the headphone icon and be labeled "Headset".

### Filtering Devices

To hide certain devices from the list:

1. Open applet settings
2. Go to "Filter list" section
3. Enter comma-separated keywords (e.g., "virtual, dummy, monitor")
4. Any device containing these keywords will be hidden

### Media Player Controls

When a media player is active:
- **Horizontal Scroll**: Navigate between tracks (if enabled in settings)
- **Mouse Buttons 4/5**: Previous/Next track
- **Player Menu**: Shows album art, track info, and playback controls

## Settings

The applet offers extensive customization options:

### Menu Section
- **Control Players**: Enable/disable media player controls
- **Show Loop and Shuffle controls**: Display extended player controls
- **Show menu**: Set keyboard shortcut to open menu
- **Always show input switch**: Keep microphone mute switch visible

### Panel Section
- **Show song information**: Display track info on the panel
- **Limit song information**: Set character limit for track display
- **Action on middle click**: Configure middle click behavior
- **Use horizontal scrolling**: Enable track navigation with horizontal scroll
- **Show album art as icon**: Display album cover as applet icon
- **Hide system tray icons**: Hide player icons in system tray

### Tooltip Section
- Configure what information appears in the tooltip

### Device Rules
- Configure up to 10 custom rules for device icons and names
- Filter list to hide unwanted devices

## License

GPL-3.0

## Author

Forked from the original Cinnamon sound applet by jjolmo (cidwel)

## Contributing

This is a fork focused on improving device switching. Contributions and feedback are welcome!

