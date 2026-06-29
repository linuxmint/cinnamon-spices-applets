# Release Notes

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.9.0] - 2026-05-30

### Added
- Initial release of Adaptive Brightness
- Automatic brightness control based on ambient light sensor (ALS) readings
- 10-second high-speed calibration for dark and bright environments with median filtering and 95th percentile + 10% headroom
- Three response curves for lux-to-brightness mapping: Logarithmic (default), Linear, Sigmoidal
- Travel Mode with zone detection: automatically classifies environment as Dark Room (≤30 lux), Indoor (30–800 lux), or Outdoor (>800 lux) using a rolling median window with hysteresis, and dynamically tightens effective lux range per zone for better brightness granularity
- Multi-section settings UI (General, Calibration, Travel Mode, Logs)
- Icon-only panel mode to hide the percentage text
- Configurable smoothing factor for buttery-smooth brightness transitions (0=instant, 1=very smooth)
- Lux stability threshold to avoid flickering on minor sensor noise
- Manual brightness override detection with adoption of user-set brightness
- Async brightness control via `Gio.Subprocess` with sudo fallback and one-time user notification
- Periodic sensor rediscovery and re-probe when sensor becomes unavailable
- Logging toggle with configurable verbosity (Debug, Info, Error, Off)
- Comprehensive error handling, robustness improvements, and calibration safety (mutex, abort on sensor loss, poll interval restoration)
- Research-based default values justified by PMC illuminance studies, EN 12464 standards, and Engineering Toolbox references
