### 1.3.0 - 20250822

* Refactored applet to extend `TextIconApplet` for label support.
* Added configurable brightness adjustment step size.
* Added middle-click support to toggle between up to 3 user-defined brightness values.
* Added option to restrict scroll & middle-click events to selected monitors.
* Added applet label customization setting.
* Removed hardcoded `BRIGHTNESS_ADJUSTMENT_STEP` (now configurable).
* Centralized brightness update logic into `_incrementBrightnessForMonitors`.
* Updated settings schema and strings.

### Previous Versions

**Note:** This is the first published changelog for this applet. Previous versions did not include a changelog file.