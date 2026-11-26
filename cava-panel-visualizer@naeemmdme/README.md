# CAVA Panel Visualizer

A compact, real-time audio spectrum visualizer for the Cinnamon desktop panel, powered by [CAVA](https://github.com/karlstav/cava).

## Features

- Displays 16 live audio spectrum bars in the Cinnamon panel
- Minimal mint-green visual design with a transparent background
- Automatically hides the bars when audio is silent
- Runs CAVA as a separate process using its own configuration
- Shows audio output information and volume in the applet tooltip
- Optionally displays the currently playing track when `playerctl` is installed
- Cleans up its background process when the applet is removed

## Requirements

- Linux Mint or another Linux distribution running Cinnamon
- Cinnamon desktop environment
- CAVA 0.7.x
- PulseAudio or a compatible PulseAudio interface
- `pactl` (usually provided by `pulseaudio-utils`)
- `playerctl` (optional, for track information)

### Install dependencies

On Debian-based distributions:

```
sudo apt install cava pulseaudio-utils playerctl
```

`playerctl` is optional.

## Installation

1. Open **System Settings → Applets**.
2. Select the **Download** tab.
3. Search for **CAVA Panel Visualizer**.
4. Install the applet.
5. Return to the **Manage** tab and add it to your panel.

Make sure CAVA is installed before enabling the applet.

## Configuration

The applet uses its own bundled `cinnamon-panel.conf` configuration file. It does not require changes to your main CAVA configuration.

Default configuration:

- Bars: 16
- Frame rate: 30 FPS
- Input: PulseAudio
- Channels: Mono
- Sensitivity: 100

## Troubleshooting

**The visualizer does not appear**

- Check that CAVA is installed: `cava --version`
- Confirm that audio is playing.
- Restart Cinnamon or remove and re-add the applet.

**No audio is detected**

- Check that PulseAudio is running.
- Verify that `pactl info` returns audio server information.
- Confirm that your active audio output is working.

**Track information is missing**

Install `playerctl` and make sure a supported media player is running.

## Compatibility

Developed and tested with Cinnamon on Linux Mint. The applet is intended for Cinnamon sessions running on X11.

## License

GPL-3.0-or-later

## Author

**naeemmdme**
