# Research: Brightness Detection and Adjustment

This document describes the research sources, algorithms, and methodologies used by the Adaptive Brightness applet for detecting ambient light and adjusting screen brightness.

---

## Illuminance Research Sources

### Ambient Light Lux Ranges

The applet's default lux bounds are based on multiple research sources:

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

2. Apply Weber-Fechner logarithmic curve:
   ```
   k = luxRange / min_lux
   normalized = log(n × k + 1) / log(k + 1)
   ```
   where `luxRange = max_lux - min_lux` and `min_lux > 0`. When `min_lux = 0`, falls back to `normalized = log(n × luxRange + 1) / log(luxRange + 1)`.

   Equivalently, this can be written as:
   ```
   normalized = log(lux / min_lux) / log(max_lux / min_lux)
   ```

3. Scale to brightness range:
   ```
   brightness = min_brightness + normalized × (max_brightness - min_brightness)
   ```

**Rationale**:
- Matches human eye perception (Weber-Fechner law)
- Properly respects `min_lux` as the perceptual reference point, preventing overly bright screens at low lux when `min_lux` is calibrated above 0
- Natural-feeling brightness adjustments
- Best for varied lighting conditions

**Example** (min-lux=1, max-lux=700, min-brightness=5%, max-brightness=100%):
- `lux = 1` → at floor → **5%**
- `lux = 10` → `n = 9/699 ≈ 0.013`, `k = 699`, `norm = log(0.013×699+1)/log(700) = log(10)/log(700) ≈ 0.36` → **39%**
- `lux = 50` → `n = 49/699 ≈ 0.070`, `norm = log(0.070×699+1)/log(700) = log(50)/log(700) ≈ 0.60` → **62%**
- `lux = 200` → `n = 199/699 ≈ 0.285`, `norm = log(0.285×699+1)/log(700) = log(200)/log(700) ≈ 0.81` → **82%**
- `lux = 500` → `n = 499/699 ≈ 0.713`, `norm = log(0.713×699+1)/log(700) = log(500)/log(700) ≈ 0.95` → **95%**
- `lux = 700` → at ceiling → **100%**

**Example with min-lux=10** (max-lux=700, min-brightness=10%, max-brightness=100%):
- `lux = 10` → at floor → **10%**
- `lux = 50` → `n = 40/690 ≈ 0.058`, `k = 69`, `norm = log(0.058×69+1)/log(70) = log(5)/log(70) ≈ 0.38` → **44%**
- `lux = 100` → `n = 90/690 ≈ 0.130`, `norm = log(0.130×69+1)/log(70) = log(10)/log(70) ≈ 0.54` → **59%**
- `lux = 200` → `n = 190/690 ≈ 0.275`, `norm = log(0.275×69+1)/log(70) = log(20)/log(70) ≈ 0.71` → **74%**
- `lux = 500` → `n = 490/690 ≈ 0.710`, `norm = log(0.710×69+1)/log(70) = log(50)/log(70) ≈ 0.88` → **89%**
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

### Comparison

**Side-by-side lux-to-brightness mapping** (`min-lux=10`, `max-lux=700`, `min-brightness=10%`, `max-brightness=100%`):

| Lux | Linear | Logarithmic | Sigmoidal |
|-----|--------|-------------|-----------|
| 10 | 10% | 10% | 10% |
| 50 | 16% | 44% | ~10% |
| 100 | 24% | 59% | ~16% |
| 200 | 39% | 74% | ~55% |
| 500 | 78% | 89% | ~90% |
| 700 | 100% | 100% | 100% |

**Formulas** (normalized position `n = (lux - min_lux) / (max_lux - min_lux)`):

| Curve | Formula | Behavior |
|-------|---------|----------|
| Linear | `brightness = n` | Uniform step size across the entire range |
| Logarithmic | `log(n × k + 1) / log(k + 1)` where `k = luxRange / min_lux` | Larger steps at low lux, smaller steps at high lux (perceptual) |
| Sigmoidal | `1 / (1 + exp(-10 × (n - 0.5)))` | Flat at extremes, steep in the middle |

**Why the numbers differ:**
- **Linear** treats every lux unit equally. At 50 lux you're only 6% above your floor, so brightness stays low (16%).
- **Logarithmic** treats lux *relative to the floor*. At 50 lux you've gone 5× above your 10-lux floor, so brightness jumps to 44% — matching how your eye actually perceives the change.
- **Sigmoidal** stays flat until you cross the midpoint (~350 lux), then rapidly climbs. It resists changing brightness in the dark but snaps quickly once you reach indoor levels.

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
| max-lux | 700 lux | Practical laptop ALS ceiling; calibrate in your brightest environment |
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
