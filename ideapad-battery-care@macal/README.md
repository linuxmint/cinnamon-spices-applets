# IdeaPad Battery Care - Cinnamon Applet

Battery conservation mode control for Lenovo IdeaPad laptops on Linux.

## Description

This Cinnamon applet allows you to control the **battery conservation mode** on Lenovo IdeaPad laptops. When enabled, this mode limits battery charging to **80%** to extend battery lifespan, which is ideal if your laptop is frequently connected to AC power.

## Features

- **One-click toggle** - Left-click the panel icon to toggle conservation mode
- **Visual indicators** - Plug icon when active (80%), battery icon when inactive (100%)
- **Real-time status** - Tooltip shows current mode and battery percentage
- **Persistence** - Remembers your preference across reboots
- **Auto-detection** - Automatically finds compatible Lenovo hardware
- **Secure** - Uses PolicyKit for safe permission handling

## Icons

| Icon | Status |
|------|--------|
| 🔌 Plug (ac-adapter) | Conservation mode **active** - charging limited to 80% |
| 🔋 Battery | Conservation mode **inactive** - full charge to 100% |
| ⚠️ Warning | Incompatible hardware detected |

## Compatible Hardware

This applet works with Lenovo laptops that support the `ideapad_acpi` kernel module with conservation mode feature.

To check if your laptop is compatible:

```bash
ls /sys/bus/platform/drivers/ideapad_acpi/*/conservation_mode 2>/dev/null && echo "Compatible" || echo "Not compatible"
```

### Tested Models

- Lenovo IdeaPad 16IRL8
- Other IdeaPad models with ideapad_acpi support

## Requirements

- Linux Mint with Cinnamon desktop (tested on LMDE6 with Cinnamon 6.4)
- Lenovo laptop with `ideapad_acpi` kernel module support
- PolicyKit (pkexec) for privilege elevation

## Installation

### From Cinnamon Spices

1. Right-click on the Cinnamon panel
2. Select "Applets"
3. Click the "Download" tab
4. Search for "IdeaPad Battery Care"
5. Click the install button

### Manual Installation

1. Download the applet files
2. Extract to `~/.local/share/cinnamon/applets/ideapad-battery-care@cinnamon/`
3. Restart Cinnamon: `Alt+F2` → type `r` → Enter
4. Add the applet to your panel

### CLI Installation (Recommended)

For full functionality with the helper script and PolicyKit policy:

```bash
git clone https://github.com/your-username/ideapad-battery-care.git
cd ideapad-battery-care
sudo ./scripts/install.sh
./scripts/install-applet.sh
```

## Usage

### Panel Applet

| Action | Result |
|--------|--------|
| **Left click** | Toggle conservation mode on/off |
| **Right click** | Context menu with Enable/Disable options |
| **Hover** | Tooltip shows current status and battery percentage |

### CLI Commands (if CLI installed)

```bash
ideapad-battery-care status   # Show current status
ideapad-battery-care on       # Enable conservation mode (80%)
ideapad-battery-care off      # Disable conservation mode (100%)
ideapad-battery-care toggle   # Toggle state
```

## Configuration

Settings are automatically saved to:
```
~/.config/ideapad-battery-care/config.json
```

Your preference is restored when the applet loads or when the system restarts.

## How It Works

1. **Hardware Detection**: The applet looks for the conservation mode control file at:
   ```
   /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode
   ```
   If not found, it searches all subdirectories under `/sys/bus/platform/drivers/ideapad_acpi/`.

2. **Control**: Writing `1` enables conservation mode (80% charge limit), writing `0` disables it.

3. **Permissions**: Uses PolicyKit (pkexec) with a helper script for secure privilege elevation without requiring password entry on active local sessions.

## Troubleshooting

### Applet shows warning icon

Your laptop may not support conservation mode. Check compatibility with:
```bash
lsmod | grep ideapad_acpi
```

If the module is not loaded, try:
```bash
sudo modprobe ideapad_acpi
```

### Permission errors

Make sure the CLI tools are installed:
```bash
sudo ./scripts/install.sh
```

This installs the PolicyKit policy that allows passwordless operation.

### Applet doesn't update after CLI changes

The applet polls for status updates every 30 seconds. Changes made via CLI will be reflected on the next poll cycle.

### Applet doesn't appear

Restart Cinnamon: `Alt+F2` → type `r` → Enter

## License

MIT License - See [LICENSE](../../LICENSE) file for details.

## Author

**Macal**

## Project Links

- **Main Repository**: https://github.com/your-username/ideapad-battery-care
- **Report Issues**: https://github.com/your-username/ideapad-battery-care/issues

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
