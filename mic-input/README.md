# Microphone Input Level

A Cinnamon panel applet for controlling microphone input volume and mute status.

## Features

- **Real-time volume display**: Shows current microphone input level as a percentage on the panel
- **Volume slider**: Adjust microphone input volume from 0-100%
- **Mute toggle**: Quick mute/unmute switch
- **Dynamic icon**: Icon changes based on volume level and mute status
- **Quick access**: Click to open popup menu with all controls
- **Sound Settings shortcut**: Direct link to system sound settings

## Installation

1. Download the applet
2. Extract to `~/.local/share/cinnamon/applets/`
3. Right-click on your panel and select "Applets"
4. Find "Microphone Input Level" and click the "+" button to add it

## Usage

- **Panel icon**: Displays current microphone volume percentage
- **Click the icon**: Opens popup menu with volume slider and mute toggle
- **Adjust volume**: Use the slider in the popup menu
- **Mute/Unmute**: Toggle the switch in the popup menu
- **Sound Settings**: Click "Sound Settings" to open the system sound configuration

## Requirements

- Cinnamon 6.0 or later
- PulseAudio (pactl command)

## Technical Details

The applet uses PulseAudio's `pactl` commands to:
- Detect the default microphone input source
- Read current volume and mute status
- Control volume and mute settings

Volume updates automatically every second to reflect changes made in other applications.

## License

GPL-3.0

## Author

ds0934
