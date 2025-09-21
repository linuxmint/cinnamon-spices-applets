# Changelog

## Known Issues

- If PowerMan is set to replace default Power applet and then uninstalled, you may need to manually re-enable the default power applet in Applet Manager and restart the system or logout/login. If PowerMan is still installed and active, you need to enable default Power applet, then uncheck "Replace system applet", it should appear in System tray.
- If dimming is enabled and screen is dimmed (user is idle), power profile would be switched immediately, but brightness will be switched after user become active again (to avoid screen brightness dimming bugs).
- If you have dimming enabled for i.e. only battery mode, after auto switching from AC to battery, dimming would not be active until some user activity (couldn't find a way around that issue).

## [1.9.5]

- Extended default popup with switches for quickly enable / disable automation.
- Added option to remember user's "external" change of brightness with settings depending on power source.
- Refactored some internal stuff.
- Updated po / pot files.
  
## [1.9.1]

- Refactored whole automation logic into extension framework with hooks and dedicated managers separated from applet's main logic.
- Fixed (most of) brightness and dimming switching bugs on power source changes.
- Fixed power state when batteries are full and AC connected (since most of power line detection on 3 laptops didn't gave me some meaningful results like "AC connected", on 100% of battery it should switch onto battery mode, then after short timeout switch again onto AC mode).
- Improved responsiveness and speed of the applet.
- Added icons to notifications.
- Removed some unneeded notifications.
- Improved debug logging for troubleshooting.

## [1.6.6]

- Initial release with power profile automation.
- Added separate AC/battery brightness levels.
- All logic inside original Power applet.
