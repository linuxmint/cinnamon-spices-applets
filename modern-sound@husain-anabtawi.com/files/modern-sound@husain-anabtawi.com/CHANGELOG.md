# Changelog

Release notes for **Modern Sound**.

## [1.3.0] — 2026-08-06

### Added

- **Middle-click actions** — configure plain and Shift+middle-click (mute output/input, combined mute, play/pause).
- **100% mark on master slider** when overamplification is enabled in system sound settings.
- **Sound Change Effects** settings — optional volume change sound (output only; mic stays silent).
- **Volume OSD on panel scroll** — optional on-screen level indicator (respects Cinnamon media-keys OSD setting).
- **Panel tooltip option** — show `Volume: N%` or **Sound** only.
- **Shift + scroll on panel icon** — adjust mic volume; plain scroll adjusts output.
- **Volume scroll step** — configurable 1–10% for panel scroll and menu sliders.
- **Invert scroll direction** — optional reversal for panel scroll and menu sliders.

### Changed

- **Theme-native styling** — menu uses Cinnamon shell theme classes (`popup-slider-menu-item`, `popup-device-menu-item`); layout-only custom CSS.
- Volume sliders refactored to **`PopupSliderMenuItem`** (official sound applet pattern).

### Fixed

- Shared scroll math aligned with Cinnamon (`step × norm / max`) for overamplification-aware scrolling.
- Overamplification GSettings listener disconnected when the applet is removed from the panel.

---

## [1.2.0] — 2026-08-03

### Added

- **Overamplification Reflection** — when **Overamplification is enabled** in Sound settings, master volume can go up to 150% (menu slider and panel scroll).
- **Volume tooltip** — hover the panel icon to see the current level (e.g. `Volume: 78%`).

---

## [1.1.0] — 2026-08-02

### Added

- **Scroll wheel on panel icon** — scroll up or down on the sound icon to raise or lower master volume (5% per step).
- **Input device picker** — choose your microphone from the menu, with the same expandable list used for outputs.
- **Hide single device rows** — in **Configure… → Devices**, optionally hide the output or input row when only one device is available.

---

## [1.0.0] — 2026-08-01

### Added

- Initial release.
- Master volume and mic volume sliders with percentage.
- Output device picker with expandable device list.
- Per-application volume for apps playing audio.
- Quick actions: Mute Sound, Mute Mic, Open Settings.
- Keyboard shortcut to open the menu (default: `Shift+Super+S`).
