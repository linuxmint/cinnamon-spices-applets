# Clipboard Applet for Cinnamon

A feature-rich clipboard history applet for the Cinnamon desktop environment.

## Features

- 📋 **Clipboard History**: Keep track of your clipboard with a configurable history
- 🔍 **Live Search**: Search through your clipboard history in real-time
- ⚙️ **Highly Configurable**: Extensive settings for history size, tracking, and UI customization
- 💾 **Persistent Storage**: Optionally save your clipboard history between sessions
- 🎯 **Primary Selection Tracking**: Monitor and sync mouse selections (optional)
- 🎨 **Adaptive Menu Sizing**: Configurable width with automatic height adjustment
- 🌍 **Internationalization**: Full translation support via Gettext

## Usage

### Basic Usage
- **Left Click**: Toggle the clipboard history menu
- **Left Click on Item**: Copy item to clipboard and close menu
- **Middle Click on Item**: Remove item from history
- **Search Box**: Filter history items in real-time
- **Clear History**: Remove all history items
- **Clear Clipboard**: Clear the current clipboard content
- **Tracking Toggle**: Enable/disable clipboard monitoring

### Keyboard Shortcuts
- When menu is open, start typing to search
- Esc clears the filter and closes the menu

## Configuration

Access settings from the menu's "Settings" button or via Cinnamon Settings.

### History Section
- **History Size**: Maximum number of items to keep (5-500, default: 50)
- **Ignore Duplicates**: Skip duplicate entries (default: enabled)
- **Ignore Whitespace**: Skip empty or whitespace-only entries (default: enabled)
- **Persist History**: Save history to disk between sessions (default: enabled)

### Tracking Section
- **Tracking Enabled**: Enable/disable clipboard monitoring (default: enabled)
- **Poll Interval**: Check frequency for clipboard changes (1-10 seconds, default: 1)
- **Track Primary**: Monitor mouse selections (default: disabled)
- **Sync Primary**: Sync mouse selections with clipboard (default: disabled)

### Menu Section
- **Show Search Box**: Display the search/filter box (default: enabled)
- **Popup Width**: Menu width in pixels (220-720, default: 400)
- **Popup Height**: Auto-adjusted based on content (not configurable)

## Dependencies

- Cinnamon 5.0 or later
- GLib and Gio libraries (usually pre-installed)

## Supported Versions

- Cinnamon 5.0
- Cinnamon 5.2
- Cinnamon 5.4
- Cinnamon 5.6
- Cinnamon 5.8
- Cinnamon 6.0
- Cinnamon 6.2
- Cinnamon 6.4

## File Structure

```
clipboard@chmodmasx/
├── files/clipboard@chmodmasx/
│   ├── applet.js              # Main applet code
│   ├── metadata.json          # Applet metadata
│   ├── po/                    # Translations
│   ├── settings-schema.json   # Settings definition
│   ├── stylesheet.css         # UI styling
│   └── icon.png              # Applet icon
├── info.json                 # Spices metadata
└── README.md                 # This file
```

## Troubleshooting

### Settings window won't open
1. Reload Cinnamon (Alt+F2, type `r`)
2. Re-add the applet to the panel
3. Check that xlet-settings is installed: `which xlet-settings`

### Clipboard not tracking
1. Ensure "Tracking Enabled" is toggled on in settings
2. Check the poll interval is appropriate (1-2 seconds usually works best)
3. Some applications may not support clipboard monitoring

### History not persisting
1. Verify "Persist History" is enabled in settings
2. Check that `~/.local/share/cinnamon/clipboard@chmodmasx/` directory exists
3. Ensure write permissions in user's home directory

## Performance Tips

- For best performance with large history, keep "History Size" under 100
- If tracking feels sluggish, increase "Poll Interval" to 2-3 seconds
- Disable "Track Primary" if you don't need mouse selection tracking

## License

GPL-3.0 - See COPYING file for details

## Author

**chmodmasx** - Main developer

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Links

- [Cinnamon Spices](https://cinnamon-spices.linuxmint.com)
- [Cinnamon Documentation](https://wiki.linuxmint.com/wiki/Cinnamon)
- [GitHub Repository](https://github.com/linuxmint/cinnamon-spices-applets)

## Changelog

### Version 1.0.0 (2026-01-20)
- Initial release
- Full clipboard history support
- Live search functionality
- Comprehensive configuration options
- Support for Cinnamon 5.0-6.4
- Translation support

---

**Last Updated**: January 26, 2026
