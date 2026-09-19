# Audio Spectrum

A real-time system audio spectrum visualizer for the Cinnamon panel.

Audio Spectrum displays the audio currently playing on your system directly
in the Cinnamon panel, with multiple visualization styles and configurable
animation settings.

## Features

- Real-time system audio visualization
- 10 visualization styles:
  - Classic LED
  - 80s Car Stereo
  - Dot Matrix
  - Classic Spectrum
  - Fire
  - Neon Line
  - VU Meter
  - 1980s Digital
  - Oscilloscope
  - Classic Neon
- Adjustable number of EQ bars
- Adjustable sensitivity
- Configurable width, height and bar spacing
- Selectable 20, 25, 30 or 60 FPS
- Adjustable fall speed
- Optional peak hold

## Requirements

Audio Spectrum requires CAVA to capture and analyze system audio.

CAVA must be installed on the system. On Debian/Ubuntu/Linux Mint systems it
can normally be installed with:

`sudo apt install cava`

## Usage

1. Add **Audio Spectrum** to the Cinnamon panel.
2. Play audio on the system.
3. The spectrum visualizer will react to the currently playing audio.
4. Right-click the applet and open its settings to customize the visualization.

## Configuration

The applet settings allow you to select the visualization style and configure
the number of bars, sensitivity, dimensions, animation speed, fall speed and
peak hold.

## License

Copyright (C) 2026 CrazySwede

Audio Spectrum is licensed under the GNU General Public License version 3.
