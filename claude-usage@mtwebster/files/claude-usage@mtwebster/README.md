# Claude Usage Monitor

A Cinnamon panel applet that displays Claude API usage limits (5-hour and 7-day) by polling the Anthropic API endpoint.

## Features

- Displays 5-hour and 7-day usage percentages in the panel
- Color-coded text: green (<50%), yellow (50-80%), red (>80%)
- Configurable polling interval (1-60 minutes, default 5)
- Tooltip shows reset times and last update time
- Custom credentials path support

## Requirements

- Claude Code installed and configured (provides API credentials)
- Alternatively, you can specify a custom path to your Claude credentials file

## Installation

### From Cinnamon Settings (Recommended)

1. Open Cinnamon Settings → Applets
2. Go to the "Download" tab
3. Search for "Claude Usage Monitor"
4. Click "Install"
5. Enable the applet in the "Manage" tab

### Manual Installation

1. Download and extract the applet
2. Copy the folder `claude-usage@mtwebster` to `~/.local/share/cinnamon/applets/`
3. Enable the applet in Cinnamon Settings → Applets

## License

GPL-3.0 License.

[Changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/weather%40mockturtl/CHANGELOG.md)
