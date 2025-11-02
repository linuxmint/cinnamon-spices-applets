# Changelog

The format adheres to [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html)

## [2.0.0] - 2025-11-02 - [#7939](https://github.com/linuxmint/cinnamon-spices-applets/pull/7939)

Extensive rewrite to enable new features – some bugs may have been introduced.

### Added

- Manual switching schedule per twilight ([#6758](https://github.com/linuxmint/cinnamon-spices-applets/issues/6758)).
- Automatic switching schedule offset per twilight ([#7247](https://github.com/linuxmint/cinnamon-spices-applets/issues/7247)).
- Keybinding to toggle appearance ([#7923](https://github.com/linuxmint/cinnamon-spices-applets/issues/7923)).
- Indicator showing if the actual appearance is unsynced with the current time, also in the settings configure menu (previously only shown in the panel's icon state).
- Indicator of the next appearance update schedule.
- Indicator of the twilights computed from the location as a widget instead of the previous notification triggered from a button.
- Indicator of the current system location.
- **Known limitation**: some indicators are updated with a delay of 2 seconds because of an [issue with Cinnamon's settings](https://github.com/linuxmint/cinnamon/issues/12362).

### Changed

- Every previous "mode" textual reference to be "appearance".
- Themes fields to be read-only.
- Timezone coordinates local database to be the same as the ones used by Cinnamon Settings Daemon's Night Light.
  - Note that there can still be a difference in the twilight times as their calculation is done differently.
- Improved logging and notifications types for better look and clarity.

### Changed (internal)

- Use of MobX for scalable reactive state management.
- Use of Vite transpilation for better imports handling, use of external libraries and bundling.
- Use of TypeScript for better typing expressivity.
- Use of Vitest for unit testing.

## [1.2.6] - 2025-05-18 - [#7257](https://github.com/linuxmint/cinnamon-spices-applets/pull/7257)

### Fixed

- Custom commands launching to correctly support `;` shell feature. [#6549](https://github.com/linuxmint/cinnamon-spices-applets/issues/6549)

## [1.2.5] - 2025-05-18 - [#7256](https://github.com/linuxmint/cinnamon-spices-applets/pull/7256)

### Added

- Explicit notification for not supported versions of Cinnamon ([#7207](https://github.com/linuxmint/cinnamon-spices-applets/issues/7207)).

### Fixed

- `g++` dependency wrongly verified as `gcc`.

## [1.2.4] - 2025-05-13 - [#7217](https://github.com/linuxmint/cinnamon-spices-applets/pull/7217)

### Changed (internal)

- Use of TypeScript checking via JSDoc.
- Renaming of a lot of code things.

## [1.2.3] - 2025-04-28 - [#7140](https://github.com/linuxmint/cinnamon-spices-applets/pull/7140)

### Fixed

- Desktop background to be applied to either file or folder depending if slideshow is enabled ([#7138](https://github.com/linuxmint/cinnamon-spices-applets/issues/7138)).
- Background's file/folder to support non-ASCII URIs.

## [1.2.2] - 2025-01-23 - [#6797](https://github.com/linuxmint/cinnamon-spices-applets/pull/6797)

### Fixed

- Missing import in time change listener's `main.cpp` for `g++` 14.2 ([#6791](https://github.com/linuxmint/cinnamon-spices-applets/issues/6791)).

## [1.2.1] - 2024-10-22 - [#6524](https://github.com/linuxmint/cinnamon-spices-applets/pull/6524)

### Added

- Shell features support for custom commands launching.

### Changed

- Custom commands launching's list's `Active` attribute to default to `true`.

## [1.2.0] - 2024-10-22 - [#6521](https://github.com/linuxmint/cinnamon-spices-applets/pull/6521)

### Added

- Custom commands launching.

## [1.1.0] - 2024-09-02 - [#6361](https://github.com/linuxmint/cinnamon-spices-applets/pull/6361)

### Added

- Desktop background support ([#6354](https://github.com/linuxmint/cinnamon-spices-applets/issues/6354)).

## [1.0.1] - 2024-08-26 - [#6344](https://github.com/linuxmint/cinnamon-spices-applets/pull/6344)

### Fixed

- `GLib.DateTime` used methods to be compatible with `GLib` < 2.80 ([#6341](https://github.com/linuxmint/cinnamon-spices-applets/issues/6341)).

## [1.0.0] - 2025-08-26 - [#6329](https://github.com/linuxmint/cinnamon-spices-applets/pull/6329)

### Added

- Initial release
