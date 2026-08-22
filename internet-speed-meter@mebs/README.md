# Internet Speed Meter

A lightweight Cinnamon applet that displays real-time internet upload and download speed directly in the panel.

![Screenshot](screenshot.png)

## Features

- Real-time download and upload speed in the panel
- Automatic network interface detection (via the default route)
- Auto-scaling units: B/s, KB/s, MB/s, GB/s (or b/s, Kb/s, Mb/s, Gb/s)
- Compact single-line or stacked layout
- Configurable refresh interval, decimal places, and font size

## Installation

From the Cinnamon System Settings:

1. Open **System Settings** → **Applets**
2. Select **Internet Speed Meter** from the available applets
3. Click **+** to add it to the panel

Or install manually by copying the `files/internet-speed-meter@mebs` folder to `~/.local/share/cinnamon/applets/` and restarting Cinnamon (right-click the panel → Troubleshoot → Restart Cinnamon).

## Settings

| Setting             | Description                                           | Default |
| ------------------- | ----------------------------------------------------- | ------- |
| Refresh interval    | How often the speed is updated                         | 2.0 s   |
| Show speed in bits  | Display b/s instead of B/s                             | Off     |
| Network interface   | Interface to monitor (empty = auto-detect)             | Auto    |
| Decimal places      | Number of decimals in the displayed value              | 1       |
| Layout              | Compact (single line) or Stacked (DL / UL)             | Compact |
| Font size           | Label font size in px                                  | 13 px   |

## Usage

- **Hover** to see the active interface and current download/upload speeds.
- Right-click the applet to open the applet's settings menu.

## Requirements

- Cinnamon desktop environment (Linux Mint recommended)
- Python 3 with `GObject` bindings (installed by default on Linux Mint)

## Author

[Md. Mahmudul Hasan](https://github.com/MDHasan0078)

## License

GPL-3.0
