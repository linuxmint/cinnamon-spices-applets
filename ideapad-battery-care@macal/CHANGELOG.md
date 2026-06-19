# Changelog - IdeaPad Battery Care

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-28

### Changed
- Renamed from "Coidado Batería" to "IdeaPad Battery Care"
- Changed active mode icon from battery to plug (ac-adapter-symbolic) for better visual distinction
- Updated all user-facing strings to English
- Migrated from sudoers to PolicyKit for permission management
- Restructured repository for Cinnamon Spices compatibility

### Fixed
- Fixed applet constructor timing issue with `_applet_context_menu`
- Fixed Cinnamon 6.4 compatibility in metadata.json

## [1.0.0] - 2025-11-27

### Added
- Initial release
- Battery conservation mode toggle (80% charge limit)
- Cinnamon panel applet with one-click toggle
- CLI tool with status, on, off, toggle, restore commands
- Automatic hardware detection for Lenovo IdeaPad laptops
- Persistence of user preference across reboots
- Real-time battery percentage display
- Context menu with Enable/Disable options
- PolicyKit integration for passwordless operation
- Support for Cinnamon 5.0 through 6.4
