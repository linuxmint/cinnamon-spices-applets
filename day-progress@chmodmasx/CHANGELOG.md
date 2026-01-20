# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] - 2026-01-19

### Fixed
- Corrected percentage calculation when start and end hours are equal (24-hour range now anchored to the start hour).

### Changed
- Allow an end hour value of 24 (now default) and simplify the end-hour tooltip.
- Declared Cinnamon 6.6 support in metadata.

## [1.0.3] - 2026-01-12

### Changed
- Improved popup display alignment by padding hours, minutes, and percent values with monospace styling.
- Applied `day-progress-label` styling to the elapsed/remaining menu rows.
- Updated Spanish and Hungarian translations.

## [1.0.2] - 2026-01-09

### Added
- Tooltip with aligned elapsed/remaining values and monospace styling.
- French and Hungarian translations.

### Changed
- Switched settings launcher to `xlet-settings` for Cinnamon 6.6 compatibility.
- Defaulted end hour to 0 and added a 24-hour range hint in settings.
- Updated Spanish translation and the translation template.

## [1.0.1] - 2025-12-11

### Changed
- Renamed the shared `.label` style to `.day-progress-label` to avoid clashing with Cinnamon themes or other xlets.
- Translated the remaining Spanish source comments to English for consistency across the codebase.

## [1.0] - 2025-10-03

### Added
- Initial release of Day Progress applet
- Customizable pie chart progress indicator
- Time range configuration (start/end hours)
- Toggle between elapsed and remaining time display
- Two visual styles: Pie with border and Pie without border
- Adjustable size (width and height)
- Detailed information popup menu
- Translation support with English and Spanish languages
- Settings panel integration

### Features
- Real-time progress tracking
- Auto-update every 10 seconds
- Support for 24-hour cycle or custom time ranges
- Midnight wrap-around support
- Clean, minimal design that fits any panel theme
