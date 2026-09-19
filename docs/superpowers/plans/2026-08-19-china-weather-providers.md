# China Weather Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently selectable QWeather and ColorfulClouds providers to `weather@mockturtl` for Cinnamon 6.6.9, including current, hourly, daily, immediate-precipitation, and alert data without leaking credentials.

**Architecture:** Keep the existing single-selected-`WeatherProvider` model. Each new provider has a GJS-facing request orchestrator and Node-testable pure payload adapters; shared pure helpers cover units, precipitation windows, safe request logging, and diagnostic redaction. QWeather uses a dedicated API Host plus `X-QW-Api-Key`; ColorfulClouds uses one v2.6 combined request with a path Token and a separately redacted log URL.

**Tech Stack:** TypeScript 5.9, GJS/Cinnamon APIs, libsoup 2/3, Luxon 3.2.1, webpack 5, ESLint 8, a dependency-free TypeScript test harness compiled by the existing TypeScript dev dependency.

**Spec:** `docs/superpowers/specs/2026-08-19-china-weather-providers-design.md`

## Global Constraints

- Runtime target is Cinnamon 6.6.9 through `weather@mockturtl/src/3_8`; do not modify the end-of-life `src/3_0` implementation.
- QWeather and ColorfulClouds are independent choices; do not merge their data and do not implement automatic failover.
- The QWeather integration supports only dedicated `*.qweatherapi.com` hosts plus API Key authentication; do not add JWT/Ed25519.
- ColorfulClouds supports only the stable v2.6 combined endpoint plus Token authentication; do not add App Key/App Secret/HMAC.
- Never place QWeather API keys or ColorfulClouds Tokens in request logs, error messages, or exported diagnostic configuration.
- A valid current-weather payload is required; unavailable forecast, minutely, or alert data degrades to empty/absent fields without discarding current weather.
- Use metric API responses and convert to the existing internal contract: Kelvin, m/s, hPa, humidity percent, millimetres, and Luxon `DateTime` values.
- Do not make real API requests in automated tests and do not add production dependencies.
- Add all new user-facing strings to the translation template; do not invent translations in existing `.po` files.
- Preserve every existing provider and existing user setting.

---

### Task 1: Add the pure test harness and credential-safety foundations

**Files:**
- Create: `weather@mockturtl/tests/tsconfig.json`
- Create: `weather@mockturtl/tests/harness.ts`
- Create: `weather@mockturtl/tests/run.ts`
- Create: `weather@mockturtl/tests/security.test.ts`
- Create: `weather@mockturtl/src/3_8/lib/unitConversions.ts`
- Create: `weather@mockturtl/src/3_8/lib/precipitation.ts`
- Create: `weather@mockturtl/src/3_8/lib/httpLog.ts`
- Create: `weather@mockturtl/src/3_8/config-redaction.ts`
- Modify: `weather@mockturtl/package.json`
- Modify: `weather@mockturtl/.gitignore`
- Modify: `weather@mockturtl/src/3_8/utils.ts:589-599`
- Modify: `weather@mockturtl/src/3_8/lib/soupLib.ts:8-39,66-85,231-260`
- Modify: `weather@mockturtl/src/3_8/config.ts:756-786`

**Interfaces:**
- Produces: `CelsiusToKelvin(number | null)`, `KPHtoMPS(number | null)`, and `PascalsToHectopascals(number | null)` from `lib/unitConversions.ts`.
- Produces: `FindPrecipitationWindow(values: readonly number[], stepMinutes: number): ImmediatePrecipitation` from `lib/precipitation.ts`.
- Produces: `BuildRequestUrls(url: string, params?: Record<string, Primitive>, logUrl?: string)` returning `{ requestUrl, logUrl }` from `lib/httpLog.ts`.
- Produces: `RedactAppletConfig<T extends Record<string, unknown>>(config: T): T` from `config-redaction.ts`.
- Changes: `SoupLibSendOptions` gains `logUrl?: string`; both Soup2 and Soup3 log only the resulting safe URL.

- [ ] **Step 1: Add a dependency-free TypeScript test harness**

Add these scripts to `package.json`:

```json
"test": "tsc --project tests/tsconfig.json && node tests/.build/tests/run.js",
"typecheck": "tsc --project src/3_8/tsconfig.json --noEmit"
```

Add `tests/.build/` to `.gitignore`. Configure `tests/tsconfig.json` to compile only pure modules and tests:

```json
{
  "extends": "../src/3_8/tsconfig.json",
  "compilerOptions": {
    "target": "es2019",
    "module": "commonjs",
    "moduleResolution": "node",
    "verbatimModuleSyntax": false,
    "isolatedModules": false,
    "rootDir": "..",
    "outDir": "./.build",
    "noEmit": false,
    "noEmitOnError": true,
    "lib": ["es2019", "dom"]
  },
  "include": [
    "./**/*.ts",
    "../src/3_8/config-redaction.ts",
    "../src/3_8/lib/httpLog.ts",
    "../src/3_8/lib/precipitation.ts",
    "../src/3_8/lib/unitConversions.ts",
    "../src/3_8/providers/qweather/**/*.ts",
    "../src/3_8/providers/caiyun/**/*.ts",
    "../src/3_8/types.ts",
    "../src/3_8/weather-data.ts"
  ]
}
```

Implement `harness.ts` with `test`, `equal`, `deepEqual`, `ok`, and `run`; `run` must throw after printing failures so Node exits non-zero. `run.ts` initially imports `security.test.ts`, then calls `run()`.

- [ ] **Step 2: Write failing tests for units, precipitation windows, safe URLs, and diagnostic redaction**

Create `security.test.ts` with these cases and exact expectations:

```typescript
test("converts provider units", () => {
  equal(CelsiusToKelvin(20), 293.15);
  equal(KPHtoMPS(36), 10);
  equal(PascalsToHectopascals(100325), 1003.25);
});

test("finds a five-minute precipitation window", () => {
  deepEqual(FindPrecipitationWindow([0, 0.2, 0.1, 0], 5), {
    start: 5,
    end: 15,
  });
  deepEqual(FindPrecipitationWindow([0, 0, 0], 1), {
    start: -1,
    end: -1,
  });
});

test("uses a redacted request URL for logging", () => {
  const urls = BuildRequestUrls(
    "https://api.caiyunapp.com/v2.6/secret-token/116.4,39.9/weather",
    { unit: "metric:v2" },
    "https://api.caiyunapp.com/v2.6/[REDACTED]/116.4,39.9/weather",
  );
  ok(urls.requestUrl.includes("secret-token"));
  ok(!urls.logUrl.includes("secret-token"));
  ok(urls.logUrl.includes("unit=metric:v2"));
});

test("redacts every provider credential and location", () => {
  const redacted = RedactAppletConfig({
    apiKey: { value: "legacy" },
    openweathermap_onecall_apikey: { value: "owm" },
    qweather_apikey: { value: "qw" },
    qweather_api_host: { value: "abc.def.qweatherapi.com" },
    caiyun_token: { value: "cy" },
    location: { value: "Beijing" },
    locationList: { value: [{ lat: 39.9, lon: 116.4, city: "Beijing", entryText: "Beijing" }] },
  });
  equal(redacted.apiKey.value, "REDACTED");
  equal(redacted.openweathermap_onecall_apikey.value, "REDACTED");
  equal(redacted.qweather_apikey.value, "REDACTED");
  equal(redacted.caiyun_token.value, "REDACTED");
  equal(redacted.qweather_api_host.value, "abc.def.qweatherapi.com");
  equal(redacted.location.value, "REDACTED");
  equal(redacted.locationList.value[0].lat, "REDACTED");
});
```

- [ ] **Step 3: Install existing dependencies and verify the tests fail for missing modules**

Run from `weather@mockturtl`:

```bash
npm install --no-package-lock
npm test
```

Expected: TypeScript reports that `unitConversions`, `precipitation`, `httpLog`, and `config-redaction` do not exist. No `package-lock.json` is created.

- [ ] **Step 4: Implement the pure helpers**

Move the existing `CelsiusToKelvin` and `KPHtoMPS` implementations from `utils.ts` into `lib/unitConversions.ts`, add `PascalsToHectopascals`, and re-export the first two from `utils.ts` so all current imports remain valid:

```typescript
export function KPHtoMPS(speed: number | null): number {
  return speed == null ? 0 : speed / 3.6;
}

export function CelsiusToKelvin(celsius: number): number;
export function CelsiusToKelvin(celsius: number | null): number | null;
export function CelsiusToKelvin(celsius: number | null): number | null {
  return celsius == null ? null : celsius + 273.15;
}

export function PascalsToHectopascals(pressure: number | null): number | null {
  return pressure == null ? null : pressure / 100;
}
```

`FindPrecipitationWindow` must treat `value > 0` as precipitation, return the first wet offset, and return `end: -1` when precipitation continues through the series.

`BuildRequestUrls` must append the same encoded query parameters to both the real and safe base URL. Preserve the current insertion order and `encodeURI` behavior so existing providers do not change.

`RedactAppletConfig` must clone the parsed settings object, replace any top-level setting whose key matches `/api_?key|apikey|token/i` and has a `.value`, preserve `qweather_api_host`, and retain the existing location/location-list redaction behavior.

- [ ] **Step 5: Route Soup logging and diagnostic export through the helpers**

In both Soup implementations, replace direct URL assembly/logging with:

```typescript
const urls = BuildRequestUrls(url, params, logUrl);
const query = urls.requestUrl;
const safeQuery = urls.logUrl;
Logger.Debug("URL called: " + safeQuery);
```

Use `safeQuery` in every Soup2 “sending”, “reading”, and “reply received” log line, while `Message.new` must continue to receive `query`.

In `Config.GetAppletConfigJson`, replace the inline credential/location mutation with `return RedactAppletConfig(conf);`.

- [ ] **Step 6: Run the focused tests and existing static checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
```

Expected: all commands exit 0; `npm test` prints four passing security/helper tests; no test output contains `secret-token`, `qw`, or `cy` as credential values.

- [ ] **Step 7: Commit the foundation**

```bash
git add --sparse docs/superpowers/plans/2026-08-19-china-weather-providers.md
git add weather@mockturtl/.gitignore weather@mockturtl/package.json weather@mockturtl/tests weather@mockturtl/src/3_8/config-redaction.ts weather@mockturtl/src/3_8/config.ts weather@mockturtl/src/3_8/lib/httpLog.ts weather@mockturtl/src/3_8/lib/precipitation.ts weather@mockturtl/src/3_8/lib/soupLib.ts weather@mockturtl/src/3_8/lib/unitConversions.ts weather@mockturtl/src/3_8/utils.ts
git commit -m "test(weather): add provider adapter harness"
```

---

### Task 2: Build and test the QWeather payload adapter

**Files:**
- Create: `weather@mockturtl/src/3_8/providers/qweather/config.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/condition.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/parser.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/common.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/current.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/daily.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/hourly.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/minutely.ts`
- Create: `weather@mockturtl/src/3_8/providers/qweather/payload/alert.ts`
- Create: `weather@mockturtl/tests/fixtures/qweather.ts`
- Create: `weather@mockturtl/tests/qweather.test.ts`
- Modify: `weather@mockturtl/tests/run.ts`

**Interfaces:**
- Consumes: unit conversions and `FindPrecipitationWindow` from Task 1.
- Produces: `NormalizeQWeatherApiHost(value: string): string | null` and `QWeatherLanguage(locale: string | null, translateCondition: boolean): string`.
- Produces: `QWeatherCondition(icon: string, text: string, translate: Translator): Condition`.
- Produces: `QWeatherResponseToData(payloads: QWeatherPayloadSet, location: LocationData, translate: Translator): WeatherData | null`.
- Produces: typed response interfaces used by the runtime provider in Task 3.

- [ ] **Step 1: Write representative typed fixtures**

Use Beijing coordinates and `Asia/Shanghai`. The fixture values must make conversion errors visible:

```typescript
export const qweatherCurrent = {
  code: "200",
  updateTime: "2026-08-19T12:30+08:00",
  fxLink: "https://www.qweather.com/weather/beijing-101010100.html",
  now: {
    obsTime: "2026-08-19T12:20+08:00",
    temp: "20",
    feelsLike: "22",
    icon: "101",
    text: "多云",
    wind360: "135",
    windDir: "东南风",
    windScale: "3",
    windSpeed: "18",
    humidity: "65",
    precip: "0.0",
    pressure: "1003",
    vis: "20",
    cloud: "40",
    dew: "12"
  },
  refer: { sources: ["QWeather"], license: ["QWeather Developers License"] }
} satisfies QWeatherCurrentResponse;
```

Add one daily entry with `tempMin: "10"`, `tempMax: "24"`, sunrise `05:30`, sunset `18:55`, and UV `6`; add two hourly entries with one rainy hour; add minutely values `[0, 0.2, 0.1, 0]` at five-minute intervals; add one severe alert and two metadata attribution strings.

- [ ] **Step 2: Write failing QWeather adapter tests**

Register tests for:

```typescript
test("normalizes only dedicated QWeather API hosts", () => {
  equal(NormalizeQWeatherApiHost("https://AbC.Def.qweatherapi.com/"), "abc.def.qweatherapi.com");
  equal(NormalizeQWeatherApiHost("devapi.qweather.com"), null);
  equal(NormalizeQWeatherApiHost("qweatherapi.com.evil.example"), null);
});

test("maps a complete QWeather response", () => {
  const weather = QWeatherResponseToData(qweatherPayloadSet, beijing, identity);
  ok(weather !== null);
  equal(weather.temperature, 293.15);
  equal(weather.extra_field?.value, 295.15);
  equal(weather.wind.speed, 5);
  equal(weather.pressure, 1003);
  equal(weather.forecasts[0].temp_min, 283.15);
  equal(weather.forecasts[0].temp_max, 297.15);
  equal(weather.hourlyForecasts?.[1].precipitation?.chance, 80);
  deepEqual(weather.immediatePrecipitation, { start: 5, end: 15 });
  equal(weather.alerts?.[0].level, "severe");
  ok(weather.alerts?.[0].description.includes("当前预警数据可能存在延迟"));
  equal(weather.sunrise?.toISO(), "2026-08-19T05:30:00.000+08:00");
});

test("keeps current weather when optional QWeather payloads are absent", () => {
  const weather = QWeatherResponseToData({ current: qweatherCurrent }, beijing, identity);
  ok(weather !== null);
  deepEqual(weather.forecasts, []);
  deepEqual(weather.hourlyForecasts, []);
  equal(weather.immediatePrecipitation, undefined);
});

test("rejects a non-success QWeather current payload", () => {
  equal(QWeatherResponseToData({
    current: { code: "401" } as QWeatherCurrentResponse,
  }, beijing, identity), null);
});
```

Also assert icon mappings for clear day `100`, clear night `150`, thunderstorm `302`, snow `400`, haze `502`, and unknown `999`.

- [ ] **Step 3: Run the QWeather tests and observe the missing adapter failure**

Run `npm test` from `weather@mockturtl`.

Expected: compilation fails because QWeather payload/config/condition/parser exports do not exist.

- [ ] **Step 4: Define exact QWeather payload types**

Model all fields consumed by the adapter. Use a shared base for v7 responses:

```typescript
export interface QWeatherBaseResponse {
  code: string;
  updateTime?: string;
  fxLink?: string;
  refer?: { sources?: string[]; license?: string[] };
}
```

Define current `now`, daily `daily[]`, hourly `hourly[]`, minutely `minutely[]`, and the v1 alert `metadata`/`alerts[]` exactly as represented by the fixtures and official responses. Optional API fields must use `?`; required mapping fields such as current `temp`, `icon`, and `text` stay required.

- [ ] **Step 5: Implement host/language and condition mapping**

`NormalizeQWeatherApiHost` must strip one `http://` or `https://` prefix, discard a trailing slash, reject any remaining path/query/port, lowercase the hostname, and accept only this anchored pattern:

```typescript
/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+qweatherapi\.com$/
```

`QWeatherLanguage` returns `"en"` when translation is disabled. When enabled, first map Traditional Chinese locales (`zh-TW`, `zh-HK`, `zh-MO`, and `zh-Hant`) to `zh-hant`; then map every other `zh*` locale to `zh`; otherwise pass through a lowercase two-letter language code.

`QWeatherCondition` must map QWeather icon families to existing icons:

- `100`/`150`: clear day/night.
- `101`–`104` and `151`–`154`: few clouds through overcast with day/night variants.
- `300`–`304`: showers/thunderstorm.
- `305`–`318` and `350`–`399`: rain/freezing rain.
- `400`–`499`: snow/sleet.
- `500`–`515`: fog/haze/dust.
- `900`/`901`: hot/cold.
- Unknown: `weather-severe-alert` plus `na-symbolic`.

Use the API `text` for `main` and `description`; use `translate("Unknown")` only when it is empty.

- [ ] **Step 6: Implement `QWeatherResponseToData` minimally**

Use this exact public shape:

```typescript
export type Translator = (text: string) => string;

export interface QWeatherPayloadSet {
  current: QWeatherCurrentResponse;
  daily?: QWeatherDailyResponse | null;
  hourly?: QWeatherHourlyResponse | null;
  minutely?: QWeatherMinutelyResponse | null;
  alerts?: QWeatherAlertResponse | null;
}

export function QWeatherResponseToData(
  payloads: QWeatherPayloadSet,
  location: LocationData,
  translate: Translator,
): WeatherData | null;
```

Return `null` unless `current.code === "200"` and `current.now` exists. Convert finite numeric strings, use `null` for absent numeric fields, set daily dates to local noon, use the first daily sunrise/sunset, and use `daily[0].uvIndex`. Append every alert `metadata.attributions` entry to each alert description on separate lines without changing its text.

- [ ] **Step 7: Run QWeather tests and all pure tests**

Run:

```bash
npm test
npm run typecheck
```

Expected: all helper and QWeather tests pass; production type checking exits 0.

- [ ] **Step 8: Commit the QWeather adapter**

```bash
git add weather@mockturtl/src/3_8/providers/qweather weather@mockturtl/tests/fixtures/qweather.ts weather@mockturtl/tests/qweather.test.ts weather@mockturtl/tests/run.ts
git commit -m "feat(weather): parse QWeather responses"
```

---

### Task 3: Integrate QWeather requests and settings

**Files:**
- Create: `weather@mockturtl/src/3_8/providers/qweather/provider.ts`
- Modify: `weather@mockturtl/src/3_8/config.ts:1-33,61-107,121-190,371-459,797-844`
- Modify: `weather@mockturtl/src/3_8/main.ts:98-116`
- Modify: `weather@mockturtl/src/3_8/types.ts:30-45,87`
- Modify: `weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json:83-116,220-380`
- Modify: `weather@mockturtl/tests/qweather.test.ts`

**Interfaces:**
- Consumes: QWeather payload types, normalization, language, and adapter from Task 2.
- Produces: `QWeatherOptions { apiHost: string; apiKey: string }`.
- Produces: `QWeather implements WeatherProvider<Services.QWeather, QWeatherOptions>`.
- Changes: `Services.QWeather = "QWeather"`, its service factory, settings bindings, and `ApiService` union member `"qweather"`.

- [ ] **Step 1: Add failing tests for request inputs that remain pure**

Extend `qweather.test.ts` to verify:

```typescript
test("formats QWeather coordinates to the documented precision", () => {
  equal(QWeatherLocation({ lat: 39.904234, lon: 116.407428 }), "116.41,39.90");
});

test("uses English when condition translation is disabled", () => {
  equal(QWeatherLanguage("zh-CN", false), "en");
  equal(QWeatherLanguage("zh-CN", true), "zh");
  equal(QWeatherLanguage("zh-TW", true), "zh-hant");
});
```

Export `QWeatherLocation(location: Pick<LocationData, "lat" | "lon">): string` from `qweather/config.ts`.

- [ ] **Step 2: Run tests and verify the new coordinate test fails**

Run `npm test`.

Expected: compilation fails because `QWeatherLocation` is not exported.

- [ ] **Step 3: Implement `QWeatherLocation` and the runtime provider**

The provider metadata is fixed:

```typescript
public readonly prettyName = _("QWeather");
public readonly name = Services.QWeather;
public readonly maxForecastSupport = 7;
public readonly maxHourlyForecastSupport = 24;
public readonly website = "https://www.qweather.com/";
public readonly needsApiKey = true;
public readonly supportHourlyPrecipChance = true;
public readonly supportHourlyPrecipVolume = true;
public readonly locationType = "coordinates";
```

Normalize the configured host before constructing `https://${host}`. Start current, 24-hour, and 7-day requests concurrently. Add minutely only when `config._immediatePrecip` is true and alerts only when `config._showAlerts` is true. Every request uses:

```typescript
headers: { "X-QW-Api-Key": options.apiKey },
params: { location: QWeatherLocation(loc), lang: QWeatherLanguage(config.currentLocale, config._translateCondition), unit: "m" }
```

The v1 alert endpoint puts `lat` then `lon` in the path and uses `localTime=true`. Pass `_` as the adapter translator.

`ValidConfiguration` returns `NO_KEY` when the key is blank or host normalization returns `null`. HTTP/API 401 and 403 post `bad key`; 429 uses the normal service error; optional endpoint failures suppress a second global error and become `null`. A missing/invalid current response returns `null`; other missing payloads still call the adapter.

- [ ] **Step 4: Register QWeather in configuration and refresh subscriptions**

Add the import, enum member, and factory. Add private settings fields, two change events, and keys:

```typescript
QWEATHER_API_HOST: { key: "qweather_api_host", prop: "QWeatherApiHost" },
QWEATHER_APIKEY: { key: "qweather_apikey", prop: "QWeatherApiKey" },
```

`GetServiceConfig(Services.QWeather)` returns trimmed `apiHost` and `apiKey` without migrating the legacy generic key. Subscribe both change events to `this.loop.Refresh()` in `main.ts`. Add `"qweather"` to `ApiService`.

- [ ] **Step 5: Add QWeather settings UI**

Add `QWeather (key and API Host needed)` to `dataService.options`, then add three keys to the provider section:

```json
"qweather_label": {
  "type": "label",
  "description": "QWeather provides weather data for China and worldwide locations. A dedicated API Host and API Key from console.qweather.com are required.",
  "dependency": "dataService=QWeather"
},
"qweather_api_host": {
  "type": "entry",
  "default": "",
  "description": "QWeather API Host",
  "dependency": "dataService=QWeather",
  "tooltip": "Enter only your dedicated *.qweatherapi.com host from the QWeather console."
},
"qweather_apikey": {
  "type": "entry",
  "default": "",
  "description": "QWeather API Key",
  "dependency": "dataService=QWeather",
  "tooltip": "Copy the API Key credential from your QWeather project."
}
```

- [ ] **Step 6: Verify QWeather integration statically**

Run:

```bash
npm test
npm run typecheck
npm run lint
node -e "JSON.parse(require('fs').readFileSync('files/weather@mockturtl/3.8/settings-schema.json', 'utf8')); console.log('settings valid')"
```

Expected: all commands exit 0 and the final command prints `settings valid`.

- [ ] **Step 7: Commit the selectable QWeather provider**

```bash
git add weather@mockturtl/src/3_8/providers/qweather weather@mockturtl/src/3_8/config.ts weather@mockturtl/src/3_8/main.ts weather@mockturtl/src/3_8/types.ts weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json weather@mockturtl/tests/qweather.test.ts
git commit -m "feat(weather): add QWeather provider"
```

---

### Task 4: Build and test the ColorfulClouds payload adapter

**Files:**
- Create: `weather@mockturtl/src/3_8/providers/caiyun/condition.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/parser.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/common.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/realtime.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/hourly.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/daily.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/alert.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/payload/response.ts`
- Create: `weather@mockturtl/tests/fixtures/caiyun.ts`
- Create: `weather@mockturtl/tests/caiyun.test.ts`
- Modify: `weather@mockturtl/tests/run.ts`

**Interfaces:**
- Consumes: unit conversion and precipitation helpers from Task 1.
- Produces: `CaiYunCondition(skycon: string, translate: Translator): Condition`.
- Produces: `CaiYunLanguage(locale: string | null, translateCondition: boolean): CaiYunLanguageCode`.
- Produces: `CaiYunResponseToData(payload: CaiYunWeatherResponse, location: LocationData, translate: Translator): WeatherData | null`.
- Produces: typed v2.6 combined-response interfaces used by Task 5.

- [ ] **Step 1: Write a ColorfulClouds combined fixture**

Create one response with:

- `status: "ok"`, `api_version: "v2.6"`, `unit: "metric:v2"`, `timezone: "Asia/Shanghai"`, `tzshift: 28800`, and `[39.9, 116.4]` location.
- Realtime temperature `20`, apparent temperature `22`, pressure `100325`, humidity `0.65`, wind `36 km/h`, and `PARTLY_CLOUDY_DAY`.
- Two hourly temperatures whose skycon and precipitation arrays are intentionally reversed, proving the adapter joins by `datetime` rather than array index.
- One daily temperature with min `10`, max `24`, a day skycon, sunrise `05:30`, and sunset `18:55`.
- Minute precipitation values `[0, 0.2, 0.1, 0]` one minute apart.
- One alert whose title contains `暴雨橙色预警`.

- [ ] **Step 2: Write failing ColorfulClouds adapter tests**

Register these assertions:

```typescript
test("maps a ColorfulClouds v2.6 combined response", () => {
  const weather = CaiYunResponseToData(caiyunWeather, beijing, identity);
  ok(weather !== null);
  equal(weather.temperature, 293.15);
  equal(weather.extra_field?.value, 295.15);
  equal(weather.wind.speed, 10);
  equal(weather.pressure, 1003.25);
  equal(weather.humidity, 65);
  equal(weather.dewPoint, null);
  equal(weather.forecasts[0].temp_min, 283.15);
  equal(weather.forecasts[0].temp_max, 297.15);
  equal(weather.hourlyForecasts?.[0].precipitation?.chance, 70);
  deepEqual(weather.immediatePrecipitation, { start: 1, end: 3 });
  equal(weather.alerts?.[0].level, "severe");
  equal(weather.sunrise?.toISO(), "2026-08-19T05:30:00.000+08:00");
});

test("joins ColorfulClouds hourly series by datetime", () => {
  const weather = CaiYunResponseToData(caiyunWeather, beijing, identity);
  equal(weather?.hourlyForecasts?.[0].condition.main, "Partly cloudy");
  equal(weather?.hourlyForecasts?.[1].condition.main, "Rain");
});

test("requires ColorfulClouds realtime data", () => {
  equal(CaiYunResponseToData(
    { ...caiyunWeather, result: {} } as CaiYunWeatherResponse,
    beijing,
    identity,
  ), null);
});
```

Add condition tests for all supported SKYCON families and alert-level tests: red → extreme, orange → severe, yellow → moderate, blue/white → minor, unknown → unknown.

- [ ] **Step 3: Run tests and observe the missing ColorfulClouds adapter failure**

Run `npm test`.

Expected: TypeScript reports missing `caiyun` modules.

- [ ] **Step 4: Define the consumed v2.6 response types**

Model top-level status/timezone/location plus the consumed realtime, minutely, hourly, daily, and alert fields. Time-series values share:

```typescript
export interface CaiYunTimedValue<T> {
  datetime: string;
  value: T;
}

export interface CaiYunDatedValue<T> {
  date: string;
  value: T;
}
```

Keep optional blocks optional because account entitlements and coverage can omit them. Model alert fields `title`, `description`, `source`, `pubtimestamp`, and identifiers as optional strings except `title`.

- [ ] **Step 5: Implement language, SKYCON, and alert mapping**

`CaiYunLanguage` returns `en_US` when translation is disabled. When enabled, map only `zh_CN`, `zh_TW`, `en_US`, `en_GB`, and `ja`; fall back to `en_US`.

Map SKYCON values to translated canonical text and existing icons:

- `CLEAR_DAY`, `CLEAR_NIGHT`
- `PARTLY_CLOUDY_DAY`, `PARTLY_CLOUDY_NIGHT`, `CLOUDY`
- `LIGHT_HAZE`, `MODERATE_HAZE`, `HEAVY_HAZE`, `FOG`
- `LIGHT_RAIN`, `MODERATE_RAIN`, `HEAVY_RAIN`, `STORM_RAIN`
- `LIGHT_SNOW`, `MODERATE_SNOW`, `HEAVY_SNOW`, `STORM_SNOW`
- `DUST`, `SAND`, `WIND`

Unknown values use translated `Unknown`, `weather-severe-alert`, and `na-symbolic`.

- [ ] **Step 6: Implement the combined adapter**

Use this public signature:

```typescript
export function CaiYunResponseToData(
  payload: CaiYunWeatherResponse,
  location: LocationData,
  translate: Translator,
): WeatherData | null;
```

Require `status === "ok"` and `result.realtime`. Convert `metric:v2` pressure from Pa to hPa, wind from km/h to m/s, temperature to Kelvin, and humidity to percent. Set dew point to `null`. Use Maps keyed by `datetime`/date when joining hourly/daily series; skip a temperature entry only when no condition exists. Parse daily dates at noon and combine `daily.astro[0].date` with local sunrise/sunset clock values.

For minutely data, use each timed `precipitation` value in chronological order with a one-minute step. For alerts, map Chinese color words in the title to severity and use `source ?? "ColorfulClouds"` as sender.

- [ ] **Step 7: Run all adapter tests**

Run:

```bash
npm test
npm run typecheck
```

Expected: helper, QWeather, and ColorfulClouds tests all pass; production type checking exits 0.

- [ ] **Step 8: Commit the ColorfulClouds adapter**

```bash
git add weather@mockturtl/src/3_8/providers/caiyun weather@mockturtl/tests/fixtures/caiyun.ts weather@mockturtl/tests/caiyun.test.ts weather@mockturtl/tests/run.ts
git commit -m "feat(weather): parse ColorfulClouds responses"
```

---

### Task 5: Integrate the ColorfulClouds request and settings

**Files:**
- Create: `weather@mockturtl/src/3_8/providers/caiyun/config.ts`
- Create: `weather@mockturtl/src/3_8/providers/caiyun/provider.ts`
- Modify: `weather@mockturtl/src/3_8/config.ts:1-33,61-107,121-190,371-459,797-844`
- Modify: `weather@mockturtl/src/3_8/main.ts:98-116`
- Modify: `weather@mockturtl/src/3_8/types.ts:87`
- Modify: `weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json:83-116,220-390`
- Modify: `weather@mockturtl/tests/caiyun.test.ts`

**Interfaces:**
- Consumes: ColorfulClouds response types, language mapper, and adapter from Task 4; `SoupLibSendOptions.logUrl` from Task 1.
- Produces: `CaiYunRequestOptions` and `BuildCaiYunRequest(options)` for constructing the credential-bearing request and its redacted log equivalent.
- Produces: `CaiYunOptions { token: string }`.
- Produces: `CaiYun implements WeatherProvider<Services.CaiYun, CaiYunOptions>`.
- Changes: `Services.CaiYun = "CaiYun"`, service factory, settings binding, and `ApiService` member `"caiyun"`.

- [ ] **Step 1: Add a failing request-builder test**

Extend `caiyun.test.ts` with a test for the runtime request inputs:

```typescript
test("builds a bounded ColorfulClouds request without exposing its token", () => {
  const token = "token-with-special_value";
  const requestOptions: CaiYunRequestOptions = {
    token,
    location: { lat: 39.9042, lon: 116.4074 },
    locale: "zh-CN",
    translateCondition: true,
    forecastHours: 72,
    forecastDays: 20,
    showAlerts: true,
  };
  const request = BuildCaiYunRequest(requestOptions);
  ok(request.url.includes(encodeURIComponent(token)));
  ok(!request.logUrl.includes(token));
  equal(request.params.unit, "metric:v2");
  equal(request.params.lang, "zh_CN");
  equal(request.params.hourlysteps, 48);
  equal(request.params.dailysteps, 15);
  equal(request.params.alert, true);

  const withoutAlerts = BuildCaiYunRequest({
    ...requestOptions,
    showAlerts: false,
  });
  equal("alert" in withoutAlerts.params, false);
});
```

- [ ] **Step 2: Run the focused test and observe the missing builder failure**

Run `npm test`.

Expected: TypeScript reports that `BuildCaiYunRequest` or the new `caiyun/config` module does not exist.

- [ ] **Step 3: Implement the pure request builder and one-request ColorfulClouds provider**

Create `caiyun/config.ts` with this exact public contract:

```typescript
export interface CaiYunRequestOptions {
  token: string;
  location: Pick<LocationData, "lat" | "lon">;
  locale: string | null;
  translateCondition: boolean;
  forecastHours: number;
  forecastDays: number;
  showAlerts: boolean;
}

export function BuildCaiYunRequest(options: CaiYunRequestOptions): {
  url: string;
  logUrl: string;
  params: {
    unit: "metric:v2";
    lang: CaiYunLanguageCode;
    hourlysteps: number;
    dailysteps: number;
    alert?: true;
  };
};
```

The builder must encode the Token with `encodeURIComponent`, preserve the provider's longitude/latitude order, use `CaiYunLanguage`, cap hourly and daily counts at 48 and 15, include `alert: true` only when alerts are enabled, and place `[REDACTED]` in the log URL. The provider must consume this builder rather than duplicate URL construction.

Use fixed metadata:

```typescript
public readonly prettyName = _("ColorfulClouds");
public readonly name = Services.CaiYun;
public readonly maxForecastSupport = 15;
public readonly maxHourlyForecastSupport = 48;
public readonly website = "https://caiyunapp.com/";
public readonly needsApiKey = true;
public readonly supportHourlyPrecipChance = true;
public readonly supportHourlyPrecipVolume = true;
public readonly locationType = "coordinates";
```

Construct exactly one request per refresh from the builder result:

```typescript
const request = BuildCaiYunRequest({
  token: options.token,
  location: loc,
  locale: config.currentLocale,
  translateCondition: config._translateCondition,
  forecastHours: config._forecastHours,
  forecastDays: config._forecastDays,
  showAlerts: config._showAlerts,
});
```

Pass `request.url`, `request.params`, and `request.logUrl` to `HttpLib.Instance.LoadJsonSimple`. Return `NO_KEY` for a blank token. Treat HTTP 401/403 and `status: "failed"` with an invalid-token message as `bad key`; let 429 and network failures use the normal service error. Pass `_` to the adapter.

- [ ] **Step 4: Register ColorfulClouds in configuration**

Add the provider import, `Services.CaiYun`, factory entry, `_caiyun_token`, `CaiYunTokenChanged`, and:

```typescript
CAIYUN_TOKEN: { key: "caiyun_token", prop: "CaiYunToken" }
```

`GetServiceConfig(Services.CaiYun)` returns `{ token: this._caiyun_token.trim() }`. Subscribe the change event to refresh. Add `"caiyun"` to `ApiService`.

- [ ] **Step 5: Add ColorfulClouds settings UI**

Add `ColorfulClouds (token needed)` to the provider choices and add:

```json
"caiyun_label": {
  "type": "label",
  "description": "ColorfulClouds provides high-resolution weather data for China. A Weather API v2.6 Token from platform.caiyunapp.com is required.",
  "dependency": "dataService=CaiYun"
},
"caiyun_token": {
  "type": "entry",
  "default": "",
  "description": "ColorfulClouds API Token",
  "dependency": "dataService=CaiYun",
  "tooltip": "Copy a v2.6 Token from the ColorfulClouds developer platform."
}
```

Place label and credential keys next to the corresponding QWeather keys in the provider section.

- [ ] **Step 6: Verify one-request integration and settings**

Run:

```bash
npm test
npm run typecheck
npm run lint
node -e "const s=JSON.parse(require('fs').readFileSync('files/weather@mockturtl/3.8/settings-schema.json','utf8')); if(s.dataService.options.ColorfulClouds!=='CaiYun') throw new Error('missing provider'); console.log('settings valid')"
```

Expected: all commands exit 0 and the schema check prints `settings valid`. Inspect `provider.ts` with `rg -n "LoadJson" src/3_8/providers/caiyun/provider.ts`; exactly one request call is present.

- [ ] **Step 7: Commit the selectable ColorfulClouds provider**

```bash
git add weather@mockturtl/src/3_8/providers/caiyun/config.ts weather@mockturtl/src/3_8/providers/caiyun/provider.ts weather@mockturtl/src/3_8/config.ts weather@mockturtl/src/3_8/main.ts weather@mockturtl/src/3_8/types.ts weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json weather@mockturtl/tests/caiyun.test.ts
git commit -m "feat(weather): add ColorfulClouds provider"
```

---

### Task 6: Complete documentation, translations, release metadata, and end-to-end verification

**Files:**
- Modify: `weather@mockturtl/README.md:29-170`
- Modify: `weather@mockturtl/CHANGELOG.md:1-8`
- Modify: `weather@mockturtl/files/weather@mockturtl/metadata.json:6`
- Modify/generated: `weather@mockturtl/files/weather@mockturtl/po/weather@mockturtl.pot`
- Generated: `weather@mockturtl/files/weather@mockturtl/3.8/weather-applet.js`

**Interfaces:**
- Consumes: both completed providers and all settings from Tasks 1–5.
- Produces: applet release version `3.6.11`, user setup documentation, current translation template, and the deployable webpack bundle.

- [ ] **Step 1: Update the provider comparison table and setup instructions**

Add rows with these values:

| Provider | Key | Days | Hours | Immediate | Alerts |
| --- | --- | ---: | ---: | --- | --- |
| QWeather | Yes, plus API Host | 7 | 24 | China/coverage dependent | Account/coverage dependent |
| ColorfulClouds | Yes | 15 | 48 | Yes | Account permission required |

Add provider sections that link to the official consoles and state:

- QWeather requires both a dedicated `*.qweatherapi.com` API Host and an API Key; legacy shared domains are not accepted; API Key daily volume becomes more restricted from 2027.
- ColorfulClouds requires a v2.6 Token; the applet calls the combined endpoint once per refresh; Token authentication is simpler but less secure than the vendor-recommended signed authentication.
- Both may charge or limit calls according to the user's account, so users should choose a suitable refresh interval.

- [ ] **Step 2: Record the release**

Insert at the top of `CHANGELOG.md`:

```markdown
## 3.6.11

* Add QWeather support with dedicated API Host and API Key authentication.
* Add ColorfulClouds Weather API v2.6 support.
* Redact all provider credentials from diagnostic exports and request logs.
```

Change only the metadata version from `3.6.10` to `3.6.11`.

- [ ] **Step 3: Run the complete test, static-analysis, and bundle suite**

From `weather@mockturtl`, run in this order:

```bash
npm test
npm run typecheck
npm run lint
npm run start
```

Expected:

- Every provider/helper test passes.
- TypeScript and ESLint exit 0.
- webpack emits `files/weather@mockturtl/3.8/weather-applet.js` without errors.

- [ ] **Step 4: Generate the translation template from the completed bundle**

From the repository root, run:

```bash
./cinnamon-spices-makepot weather@mockturtl
```

Expected: `weather@mockturtl.pot` contains `QWeather`, `ColorfulClouds`, `QWeather API Host`, `QWeather API Key`, `ColorfulClouds API Token`, the two provider descriptions, and any canonical ColorfulClouds condition strings. Existing `.po` translations remain unchanged unless the repository script updates only source references mechanically.

- [ ] **Step 5: Validate metadata, secrets, and provider registration in built artifacts**

Run from the repository root:

```bash
node -e "JSON.parse(require('fs').readFileSync('weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json','utf8')); JSON.parse(require('fs').readFileSync('weather@mockturtl/files/weather@mockturtl/metadata.json','utf8')); console.log('json valid')"
rg -n "QWeather|ColorfulClouds|qweather_api_host|caiyun_token" weather@mockturtl/files/weather@mockturtl/3.8/weather-applet.js weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json
rg -n "secret-token|token-with-special_value" weather@mockturtl/files/weather@mockturtl/3.8/weather-applet.js weather@mockturtl/files/weather@mockturtl/po/weather@mockturtl.pot
git diff --check
```

Expected: JSON validation prints `json valid`; the first search finds both provider registrations and setting names; the second search returns no matches; `git diff --check` is silent.

- [ ] **Step 6: Review the final diff against the acceptance criteria**

Run:

```bash
git status --short
git diff --stat HEAD
git diff -- weather@mockturtl/src/3_8/config.ts weather@mockturtl/src/3_8/main.ts weather@mockturtl/src/3_8/lib/soupLib.ts weather@mockturtl/files/weather@mockturtl/3.8/settings-schema.json
```

Confirm the diff contains two selectable providers, conditional QWeather minutely/alert requests, one ColorfulClouds combined request, safe logging, diagnostic redaction, documentation, metadata `3.6.11`, and the regenerated bundle. Record that live Cinnamon rendering and real-credential calls remain manual checks because no credentials are available in the repository.

- [ ] **Step 7: Commit the release artifacts and documentation**

```bash
git add weather@mockturtl/README.md weather@mockturtl/CHANGELOG.md weather@mockturtl/files/weather@mockturtl/metadata.json weather@mockturtl/files/weather@mockturtl/po/weather@mockturtl.pot weather@mockturtl/files/weather@mockturtl/3.8/weather-applet.js
git commit -m "docs(weather): document China weather providers"
```
