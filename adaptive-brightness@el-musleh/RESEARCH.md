# Research: Brightness Detection and Adjustment

This document describes the research sources, algorithms, and methodologies used by the Adaptive Brightness applet for detecting ambient light and adjusting screen brightness.

---

## Illuminance Research Sources

### Ambient Light Lux Ranges

The applet's default lux bounds and zone thresholds are based on multiple research sources:

| Source | Indoor Median | Indoor Range | Outdoor Median | Outdoor Range |
|--------|--------------|--------------|----------------|---------------|
| PMC Study (2021) | 179 lux | 50-333 lux (IQR) | 1175 lux | 197-5400 lux (IQR) |
| Engineering Toolbox | 25-50 lux (room center) | 100-1000 lux (near window) | 10000 lux (clear day) | 500-10000+ lux |
| EN 12464 Standard | 100-300 lux (general) | 500-1000 lux (office) | - | - |

**Key findings**:
- Typical indoor environments range from 50-500 lux
- Office environments typically 300-500 lux
- Near windows can reach 1000 lux
- Outdoor clear sunlight reaches 5000-10000 lux
- Dark rooms at night measure <10 lux

### References

1. **PMC Study**: "Ambient Light Exposure in Daily Life" (2021)
   - Measured illuminance across 50 participants in various locations
   - Median indoor: 179 lux (IQR: 50-333)
   - Median outdoor: 1175 lux (IQR: 197-5400)

2. **Engineering Toolbox**: "Light Level - Illuminance"
   - Standard reference for typical illuminance values
   - Outdoor clear day: ~10000 lux
   - Indoor near window: ~1000 lux
   - Indoor room center: 25-50 lux

3. **EN 12464-1**: "Light and lighting - Lighting of work places"
   - European standard for workplace lighting
   - General office: 300-500 lux
   - Precision work: 500-1000 lux

---

## Response Curve Algorithms

The applet offers three mathematical curves for mapping lux to brightness:

### 1. Logarithmic (Default)

**Step-by-step calculation**:

1. Normalize lux into `[0, 1]`:
   ```
   n = (lux - min_lux) / (max_lux - min_lux)
   ```

2. Apply logarithmic curve:
   ```
   normalized = log(n × luxRange + 1) / log(luxRange + 1)
   ```
   where `luxRange = max_lux - min_lux`

3. Scale to brightness range:
   ```
   brightness = min_brightness + normalized × (max_brightness - min_brightness)
   ```

**Rationale**:
- Matches human eye perception (Weber-Fechner law)
- More sensitive to changes in dim light
- Natural-feeling brightness adjustments
- Best for varied lighting conditions

**Example** (min-lux=1, max-lux=700, min-brightness=5%, max-brightness=100%):
- `lux = 1` → at floor → **5%**
- `lux = 50` → `n = 49/699 ≈ 0.070`, `norm = log(0.070×699+1)/log(700) = log(50)/log(700) ≈ 0.72` → **73%**
- `lux = 200` → `n = 199/699 ≈ 0.285`, `norm = log(0.285×699+1)/log(700) = log(200)/log(700) ≈ 0.85` → **86%**
- `lux = 350` → `n = 349/699 ≈ 0.499`, `norm = log(0.499×699+1)/log(700) = log(350)/log(700) ≈ 0.93` → **93%**
- `lux = 700` → at ceiling → **100%**

### 2. Linear

**Step-by-step calculation**:

1. Normalize lux into `[0, 1]`:
   ```
   n = (lux - min_lux) / (max_lux - min_lux)
   ```

2. Scale to brightness range:
   ```
   brightness = min_brightness + n × (max_brightness - min_brightness)
   ```

**Rationale**:
- Direct 1:1 proportion between lux and brightness
- Predictable control in consistent environments
- Simple, easy to understand

**Example** (min-lux=0, max-lux=700, min-brightness=10%, max-brightness=100%):
- `lux = 0` → at floor → **10%**
- `lux = 2` → `n = 2/700 ≈ 0.003` → brightness = `10% + 0.003 × 90% ≈ 10.3%` → **10%**
- `lux = 350` → `n = 350/700 = 0.5` → brightness = `10% + 0.5 × 90% = 55%` → **55%**
- `lux = 700` → at ceiling → **100%**

### 3. Sigmoidal

**Step-by-step calculation**:

1. Normalize lux into `[0, 1]`:
   ```
   n = (lux - min_lux) / (max_lux - min_lux)
   ```

2. Apply sigmoidal curve:
   ```
   normalized = 1 / (1 + exp(-10 × (n - 0.5)))
   ```

3. Scale to brightness range:
   ```
   brightness = min_brightness + normalized × (max_brightness - min_brightness)
   ```

**Rationale**:
- Smooth S-curve with sharp transition zone
- Gradual changes at extremes
- Rapid adjustment in the middle range
- Ideal for distinct lighting states (indoor vs outdoor)

**Example** (min-lux=0, max-lux=700, min-brightness=10%, max-brightness=100%):
- `lux = 0` → `n = 0`, `norm = 1/(1+exp(5)) ≈ 0.007` → **10%**
- `lux = 2` → `n ≈ 0.003`, `norm = 1/(1+exp(-10×(-0.497))) ≈ 0.007` → **10%**
- `lux = 350` → `n = 0.5`, `norm = 1/(1+exp(0)) = 0.5` → **55%**
- `lux = 400` → `n ≈ 0.57`, `norm = 1/(1+exp(-10×0.07)) ≈ 0.67` → **70%**
- `lux = 500` → `n ≈ 0.71`, `norm = 1/(1+exp(-10×0.21)) ≈ 0.89` → **90%**
- `lux = 700` → at ceiling → **100%**

---

## Zone Detection Algorithm

### Overview

When Travel Mode is enabled, the applet detects the current environment zone and dynamically adjusts the effective lux range for better brightness granularity.

### Zone Classification

| Zone | Median Lux | Typical Environment | Effective Range |
|------|-----------|---------------------|-----------------|
| DARK_ROOM | ≤30 lux | Night, dark room, cinema | clamped to user min/max: 0 – max(50, p95) |
| INDOOR | 30-800 lux | Office, home, classroom | clamped to user min/max: min(5, p5) – max(800, p95) |
| OUTDOOR | >800 lux | Near window, sunlight, open areas | clamped to user min/max: min(200, p5) – max(max_lux, p95) |

### Algorithm Steps

1. **Rolling Window**:
   - Maintain last 30 lux samples
   - New samples added, oldest removed (FIFO)

2. **Median Calculation**:
   - Compute median of rolling window
   - Median is robust against outliers and noise

3. **Zone Classification**:
   - If median ≤30 lux → DARK_ROOM
   - If median ≥800 lux → OUTDOOR
   - Otherwise → INDOOR

4. **Hysteresis**:
   - Require 5 consecutive samples in a new zone before switching
   - Prevents rapid zone switching due to temporary lighting changes
   - Zone counter increments when candidate zone matches
   - Zone resets when staying in current zone

5. **Effective Range Calculation**:
   - Compute 5th percentile (p5) and 95th percentile (p95) of rolling window
   - Zone-specific effective range:
     - DARK_ROOM: min=0, max=max(50, p95)
     - INDOOR: min=min(5, p5), max=max(800, p95)
     - OUTDOOR: min=min(200, p5), max=max(max_lux, p95)

### Example

User moves from office (200 lux) to outdoors (1200 lux):
1. Rolling window accumulates higher lux values
2. Median crosses 800 lux threshold
3. After 5 consecutive samples >800 lux, zone switches to OUTDOOR
4. Effective range expands to cover outdoor lux range
5. Brightness mapping tightens to outdoor range for better granularity

---

## Calibration Methodology

### 10-Second High-Speed Calibration

The applet uses a 10-second calibration process for both dark and bright environments:

#### Dark Calibration

1. **Sampling**:
   - Poll sensor at 200ms interval (5× faster than normal 1000ms default)
   - Collect ~50 samples over 10 seconds

2. **Median Filtering**:
   - Compute median of collected samples
   - Median is robust against sensor noise and temporary light spikes
   - Set min-lux to median × 1.10 (headroom above noise floor)

3. **Damping**:
   - If median > MAX_DAMPED_GAP (1000 lux), cap at 1000 lux
   - Prevents setting min-lux too high due to accidental light exposure

#### Bright Calibration

1. **Sampling**:
   - Same high-speed polling (200ms, ~50 samples)

2. **95th Percentile**:
   - Compute 95th percentile of collected samples
   - Robust against occasional shadows or dim moments
   - Set max-lux to 95th percentile × 1.10

3. **Headroom Buffer**:
   - Add 10% headroom to 95th percentile
   - Accounts for lighting fluctuations
   - Formula: `max_lux = p95 × 1.1`

### Calibration Tips

- **Dark calibration**: Go to your dimmest environment (e.g., dark room at night)
- **Bright calibration**: Go to your brightest environment (e.g., direct sunlight)
- **Avoid interference**: Don't move or change lighting during calibration
- **Verify results**: Check that lux readings match your environment after calibration

---

## Default Values Justification

### Chosen Defaults

| Setting | Value | Rationale |
|---------|-------|-----------|
| min-lux | 1 lux | Captures true darkness; calibrate for your environment |
| max-lux | 700 lux | Practical laptop ALS ceiling; Travel Mode auto-expands if needed |
| min-brightness | 5% | Low floor for dark environments; raise if too dim |
| max-brightness | 100% | Full brightness for bright environments |
| response-curve | logarithmic | Matches human eye perception; was bug-fixed from linear |
| smoothing-factor | 0.7 | Smooth transitions (0=instant, 1=frozen); uses (1-factor) responsiveness |

### Verification at 311 lux (typical indoor)

With logarithmic curve and defaults:
- `n = (311-1)/(700-1) = 310/699 ≈ 0.444`
- `normalized = log(0.444×699 + 1) / log(700) = log(311) / log(700) ≈ 0.91`
- Brightness: `5 + 0.91 × (100-5) ≈ 91%`

This is within the comfortable 40-60% range for indoor lighting.

---

## Error Handling and Robustness

### Sensor Reading Errors

- Invalid readings (<0, NaN, Infinity) → return min_brightness
- Missing sensor → show "No sensor" in UI; periodic rediscovery while enabled
- Consecutive loop errors (>5) → auto-disable applet

### Settings Validation

- All settings clamped to min/max ranges
- Invalid response curve → fallback to logarithmic
- Invalid log level → fallback to off
- Changes persisted automatically
- Poll interval changes blocked during calibration mutex

### Calibration Safety

- Mutex prevents concurrent calibration
- Calibration aborts if sensor becomes unavailable
- Original poll interval restored after calibration
- Calibration state reset on applet removal

---

## Future Research Directions

1. **User Feedback Integration**: Collect anonymized lux/brightness data to refine anchor points
2. **Machine Learning**: Explore ML models for personalized brightness preferences
3. **Time-of-Day Adjustment**: Incorporate circadian rhythm considerations
4. **Display Type Awareness**: Adjust for OLED vs LCD panel characteristics
