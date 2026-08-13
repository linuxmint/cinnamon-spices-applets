# Changelog

## Known Issues

- If dimming is enabled and screen is dimmed (user is idle), power profile would be switched immediately, but brightness will be switched after user become active again (to avoid screen brightness dimming bugs).
- If you have dimming enabled for i.e. only battery mode, after auto switching from AC to battery, dimming would not be active until some user activity (couldn't find a way around that issue).

## [1.9.11]

- Fixed (#8601): **`hide-applet-icon` setting reset on every state change**: `_updateCapabilitySettings()` was unconditionally overwriting the user's hide preference on every `device-scan-post` event (power source change, UPower signal, notification), causing the applet icon to reappear even when explicitly hidden by the user; replaced the bidirectional override with a one-way auto-hide that only sets the flag on feature-less systems (no battery and no brightness, e.g. VM)

## [1.9.10]

- Fixed AC source detection on laptops where battery charge-protection circuits report `DISCHARGING` at full charge while the charger is connected — now uses the authoritative UPower `OnBattery` property directly.
- Removed `prefer-battery-ac-detection` setting — superseded by direct UPower detection which is reliable across all hardware without per-vendor workarounds.

## [1.9.9]

- Fixed brightness slider value not being stored correctly after a `SetPercentage` D-Bus call.
- Fixed race condition in brightness change tracking when multiple async D-Bus calls were in flight simultaneously.
- Fixed orphaned menu separator remaining visible after removing the original power applet.
- Simplified "Remove power applet" confirmation dialog and menu item label.
- Added missing translations for 17 languages; corrected Bluetooth device mistranslation in Czech, Danish, and German locales.
- Various internal stability fixes.

## [1.9.8]

- Fixed brightness detection race condition at startup — detection is now delayed to allow D-Bus service registration to complete.
- Fixed brightness control appearing unavailable on laptops with older CSD versions that don't expose the `GetStep` D-Bus method.
- Fixed battery saver mode triggering on every battery level update instead of only when the threshold boundary is crossed.
- Fixed capability detection using actor visibility instead of a dedicated flag — prevents false-negative on startup.
- Various internal stability and memory leak fixes (signal disconnection, null guards, settings cleanup).

## [1.9.7]

- Replaced the "Replace system power applet" setting switch with a **"Remove power applet"** button directly in the applet popup menu.
  - The button is visible only while the original `power@cinnamon.org` or `battery@cinnamon.org` applet is active in the panel.
  - Clicking opens a confirmation dialog before permanently removing the applet.
  - The button hides itself after removal.

## [1.9.6]

- Fixed signal leaks on applet removal and brightness slider cleanup.
- Fixed auto-hide logic for desktop and VM systems (no battery detected).
- Various internal stability fixes.

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
