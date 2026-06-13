# Changelog

## Version History

### v1.0.0 - 2026-06-07
- **Removed Travel Mode:**
  - Removed zone detection (Dark Room, Indoor, Outdoor) and adaptive lux bound expansion features
  - Simplified codebase by eliminating Travel Mode settings, state tracking, and zone classification logic
  - Manual Override Cooldown (`manual-debounce-window`) is now the only cooldown mechanism
- **Fixed Manual Override Cooldown:**
  - Cooldown duration now correctly uses the `manual-debounce-window` setting (default 5s, configurable up to 120s) instead of a hardcoded constant
  - Setting title clarified to "Manual Override Cooldown" with improved description
- **Fixed Screen Lock Blocking:**
  - Added `Meta.IdleMonitor` check to detect when the user is idle (OS idle-dimming)
  - Brightness changes detected during idle periods (>3 seconds) are no longer treated as manual overrides — the OS idle-dimmer can now lower brightness without triggering the manual override cooldown, allowing screen lock to proceed normally

### v0.9.0 - 2026-05-30
- **Initial Release:**
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
