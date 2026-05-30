# AI Assistant Rules

## No Hardcoded Numbers

**Rule**: Always use named constants instead of hardcoded numeric literals in code.

### When to Apply
- When writing or modifying JavaScript/TypeScript code
- When adding new configuration values
- When defining thresholds, limits, or magic numbers
- When setting timer intervals, buffer sizes, or similar values

### Examples

**Bad:**
```javascript
const sigmoidal = (n) => 1 / (1 + Math.exp(-10 * (n - 0.5)));
this._calibration.countdown = 10;
this._zoneCounter = 0;
Mainloop.timeout_add(200, callback);
```

**Good:**
```javascript
const SIGMOIDAL_CENTER = 0.5;
const SIGMOIDAL_STEEPNESS = -10;
const CALIBRATION_COUNTDOWN_SECONDS = 10;
const INITIAL_COUNTER_VALUE = 0;
const CALIBRATION_POLL_INTERVAL_MS = 200;

const sigmoidal = (n) => 1 / (1 + Math.exp(SIGMOIDAL_STEEPNESS * (n - SIGMOIDAL_CENTER)));
this._calibration.countdown = CALIBRATION_COUNTDOWN_SECONDS;
this._zoneCounter = INITIAL_COUNTER_VALUE;
Mainloop.timeout_add(CALIBRATION_POLL_INTERVAL_MS, callback);
```

### Exceptions
- Array indices: `arr[0]`, `arr[1]`
- Simple increment/decrement: `i++`, `count++`
- Sentinel values: `0`, `1`, `-1` when used as initial/default values
- Enum values

### Constant Naming
- Use `UPPER_SNAKE_CASE` for constants
- Include units in name when applicable: `TIMEOUT_MS`, `BUFFER_SIZE_BYTES`
- Be descriptive: `MAX_RETRIES` instead of `MAX`

### Implementation Steps
1. Identify the numeric literal
2. Determine its purpose and meaning
3. Create a descriptive constant name
4. Add the constant at the top of the file with other constants
5. Replace the hardcoded number with the constant

### Reference
See `/home/steve/prompt/software-engineering/code-quality/044-code-quality-and-linting-guide.md` for detailed guidelines.
