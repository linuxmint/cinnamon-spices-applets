# PowerMan - Enhanced Power Manager for Cinnamon

An enhanced power management applet for Linux Mint Cinnamon that extends the default power applet with automation features for brightness and power profiles. Mostly usable on laptops.

![PowerMan Icon](https://img.shields.io/badge/version-1.6.2-blue) ![Cinnamon](https://img.shields.io/badge/cinnamon-6.0%2B-green) ![License](https://img.shields.io/badge/license-GPL--3.0-orange)

## Features

### 🔋 **Battery Information**

- **Battery monitoring and Brightness control** with detailed device information (laptop battery, PPD), interface is same as the original Cinnamon Power applet with added button to configure Automation Settings.

### 💡 **Automated Brightness Control**

- **Separate brightness levels** for AC power and battery operation
- **Automatic brightness switching** when power source changes
- **Idle dimming** with configurable timeout and dim levels (dconf support)
- **Screen and keyboard backlight** support via Cinnamon Settings Daemon

### ⚡ **Power Profile Automation**

- **Automatic power profile switching** between AC and battery modes
- **Performance mode** on AC power, **balanced/power-saver** on battery (or by user's choice)
- **Low battery protection** - automatic power-saver mode when battery is critical
- **Manual override** support through standard system controls

### 🎛️ **Advanced Configuration**

- **Conditional settings visibility** - options appear only when hardware supports them
- **Hardware capability detection** - detection of brightness control, battery and power profiles
- **System integration** option to replace default Cinnamon power applet or to hide this one when you're satisfied with your settings
- **Debug logging** for troubleshooting automation issues

## Installation

### Method 1: Manual Installation

1. Download or clone this repository
2. Copy the `powerman@dr.drummie` folder to `~/.local/share/cinnamon/applets/`
3. Right-click on the panel → "Applets" → Find "PowerMan" → Add to panel

### Method 2: From ZIP

1. Download the latest release ZIP
2. Extract ZIP and copy `powerman@dr.drummie` folder to `~/.local/share/cinnamon/applets/`
3. If using non-English language, manually compile translations (see Translation section)
4. Add PowerMan to your panel via System Settings → Applets

## Configuration

Access settings by right-clicking the applet and selecting "Configure..." or directly from applet's popup:

### **Display & Advanced**

- **Panel Display**: Choose what information to show (battery percentage, time remaining, etc.)
- **Notifications**: Enable/disable automation notifications
- **System Integration**: Replace default power applet or hide this one
- **Debug Logging**: Enable detailed logging for troubleshooting

### **Brightness Control** *(available only if brightness control detected)*

- **Automatic Brightness**: Set different levels for AC and battery power
- **Idle Dimming**: Automatically dim screen when idle
- **Manual Control**: Brightness sliders in the applet menu

### **Power Management** *(available only if power profiles and battery detected)*

- **Profile Automation**: Different power profiles for AC/battery
- **Battery Saver**: Auto-enable power-saver mode on low battery

### **System Integration**

PowerMan can replace the default Cinnamon power applet on laptop systems:

- **System tray position**: Adjustable in panel edit mode (right-click panel → "Panel edit mode")
- **Replacing default applet**: PowerMan is designed to serve as a complete replacement for the built-in power applet
- **Restoration**: If PowerMan is uninstalled, you may need to manually re-enable the default power applet in Applet Manager and restart the system or logout/login

## Hardware Requirements

PowerMan automatically detects available hardware and shows only relevant settings, I guess most usable for laptops:

- **✅ Any system**: Basic power monitoring and device status
- **🔋 + Battery**: Power profile automation, battery saver
- **💡 + Brightness control**: Automatic brightness switching depending on power source, idle dimming

## Compatibility

- **Cinnamon Desktop**: 6.0, 6.2, 6.4+
- **Linux Mint**: 21.x, 22.x  
- **Other Cinnamon distros**: Should work on any modern Cinnamon installation
- **Hardware**: Automatic detection ensures compatibility across different laptop/desktop configurations

## Troubleshooting

### **Known Issues**

- If dim idle time is too low (less then 30 seconds), there could be issues with reverting brightness when switching power source
- Sometimes there could be little longer interval to detect battery power source (I guess it depends what hardware you have inside your machine)
- Tested on 3 different laptops (older models), VM, real hardware (office PC)

### **Settings not appearing**

- Restart Cinnamon: `Alt+F2` → type `r` → Enter
- Check hardware detection in debug logs
- Ensure required services are running (UPower, PowerProfiles daemon)

### **Features showing as unavailable**

- Info messages explain when hardware/software requirements are not met
- Examples: "Screen brightness control is not available" or "Power profile automation is not available"  
- Enable debug logging to see detailed hardware detection results

### **Brightness control not working**

- Test manual brightness: `brightnessctl` or system settings
- Restart Cinnamon Settings Daemon: `killall csd-power`
- Check if laptop supports software brightness control

### **Power profiles not switching**

- Verify power-profiles-daemon is running: `systemctl status power-profiles-daemon`
- Test manual switching: `powerprofilesctl set balanced`

## Development

Based on the original Cinnamon Power applet with enhancements like power source automation.

### **Contributing**

- Follow existing code style and structure
- Test on multiple hardware configurations  
- Update capability detection for new features
- Maintain backward compatibility
- Add translations for additional languages using the `po/` system

### **Translation**

Croatian localization is complete. I have translated to other languages, but don't understand if it is correct, if so, please send me or add updated translation for your language.
Translation deployment depends on installation method:

**Cinnamon Spices installation**: `.po` files are automatically compiled during installation  
**Manual/ZIP installation**: Requires manual `.mo` file generation and placement

## License

GPL-3.0 - Based on original Cinnamon power applet code.

## Credits

- **Original Cinnamon Power Applet**: Linux Mint Team
- **Applet icon**: <a href="https://www.flaticon.com/free-icons/power-settings" title="power settings icons">Power settings icons created by orvipixel - Flaticon</a>
- **Inspiration**: My aged laptops with old batteries
