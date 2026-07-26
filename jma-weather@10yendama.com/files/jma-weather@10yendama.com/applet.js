const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const St = imports.gi.St;

const UUID = "jma-weather@10yendama.com";
const VERSION = "3.2.0";

// Local modules must be loaded through the CJS importer.
// `imports.ui.extension.getCurrentExtension()` is a GNOME Shell pattern and
// does not exist in Cinnamon, so using it makes the applet fail at startup.
let WeatherUtils = null;
let WeatherData = null;
let HttpClientModule = null;
let WeatherServiceModule = null;
let LocationServiceModule = null;
let IconServiceModule = null;
let CacheServiceModule = null;
let JmaProviderModule = null;
let OpenMeteoProviderModule = null;

function _prependImportPath(path) {
    if (!imports.searchPath.includes(path))
        imports.searchPath.unshift(path);
}

function _loadLocalModules(metadata) {
    if (WeatherUtils)
        return;

    if (!metadata || !metadata.path)
        throw new Error(`[${UUID}] metadata.path is unavailable`);

    const root = metadata.path;

    _prependImportPath(`${root}/src/utils`);
    _prependImportPath(`${root}/src/models`);
    _prependImportPath(`${root}/src/services`);
    _prependImportPath(`${root}/src/providers`);

    WeatherUtils = imports.weatherUtils;
    WeatherData = imports.weatherData;
    HttpClientModule = imports.httpClient;
    WeatherServiceModule = imports.weatherService;
    LocationServiceModule = imports.locationService;
    IconServiceModule = imports.iconService;
    CacheServiceModule = imports.cacheService;
    JmaProviderModule = imports.jmaProvider;
    OpenMeteoProviderModule = imports.openMeteoProvider;
}

function formatHour(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;

    return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatWeekday(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;

    return date.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short"
    });
}

function formatUpdatedAt(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "--:--";

    return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatCacheSavedAt(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;

    return date.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatWindDirection(value) {
    const degrees = WeatherUtils.asNumber(value);
    if (degrees === null)
        return null;

    const normalized = ((degrees % 360) + 360) % 360;
    const labels = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    return labels[Math.round(normalized / 45) % labels.length];
}

function formatJmaPrecipitationBlock(block, nextBlock = null) {
    const start = new Date(block?.time);
    if (Number.isNaN(start.getTime()))
        return null;

    const end = new Date(nextBlock?.time);
    const startHour = String(start.getHours()).padStart(2, "0");
    if (Number.isNaN(end.getTime()))
        return `${startHour}時以降 ${Math.round(block.pop)}%`;

    return `${startHour}–${String(end.getHours()).padStart(2, "0")}時 ` +
        `${Math.round(block.pop)}%`;
}

function feelsLikeDescription(actual, apparent) {
    const temperature = WeatherUtils.asNumber(actual);
    const feels = WeatherUtils.asNumber(apparent);
    if (temperature === null || feels === null)
        return "";

    const difference = feels - temperature;
    if (difference <= -4)
        return "かなり寒く感じます";
    if (difference <= -2)
        return "寒く感じます";
    if (difference >= 4)
        return "かなり暑く感じます";
    if (difference >= 2)
        return "暑く感じます";
    return "気温どおりの体感です";
}

function _fileExists(path) {
    if (!path)
        return false;

    try {
        return Gio.File.new_for_path(path).query_exists(null);
    } catch (error) {
        global.logError(`[${UUID}] icon path check failed: ${error}`);
        return false;
    }
}

function _setSvgIcon(actor, path, size) {
    actor.set_icon_size(Number(size) || 24);

    try {
        if (_fileExists(path)) {
            actor.set_gicon(new Gio.FileIcon({
                file: Gio.File.new_for_path(path)
            }));
            actor.set_icon_type(St.IconType.FULLCOLOR);
            return;
        }
    } catch (error) {
        global.logError(`[${UUID}] SVG icon load failed: ${error}`);
    }

    actor.set_icon_name("weather-overcast-symbolic");
    actor.set_icon_type(St.IconType.SYMBOLIC);
}

class WeatherSummaryMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(iconSize) {
        super({ reactive: false });

        this._box = new St.BoxLayout({
            vertical: false,
            style_class: "jma-weather-current-row"
        });
        this._icon = new St.Icon({
            icon_name: "weather-overcast-symbolic",
            icon_size: Number(iconSize) || 44,
            style_class: "jma-weather-current-icon"
        });
        this.label = new St.Label({
            text: "予報を取得しています…",
            style_class: "jma-weather-current-label"
        });
        this.label.clutter_text.set_line_wrap(true);

        this._box.add_actor(this._icon);
        this._box.add_actor(this.label);
        this.addActor(this._box);
    }

    setContent(iconPath, text, iconSize) {
        _setSvgIcon(this._icon, iconPath, iconSize);
        this.label.set_text(text || "予報を取得できません");
    }
}

class WeatherForecastMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(iconSize) {
        super({ reactive: false });

        this._iconSize = Number(iconSize) || 24;
        this._list = new St.BoxLayout({
            vertical: true,
            style_class: "jma-weather-forecast-list"
        });
        this.addActor(this._list);
    }

    setRows(rows, iconSize, emptyText) {
        this._iconSize = Number(iconSize) || 24;

        for (const child of this._list.get_children())
            child.destroy();

        if (!Array.isArray(rows) || !rows.length) {
            this._list.add_actor(new St.Label({
                text: emptyText,
                style_class: "jma-weather-empty-label"
            }));
            return;
        }

        for (const row of rows) {
            const box = new St.BoxLayout({
                vertical: false,
                style_class: "jma-weather-forecast-row"
            });
            const icon = new St.Icon({
                icon_name: "weather-overcast-symbolic",
                icon_size: this._iconSize,
                style_class: "jma-weather-forecast-icon"
            });
            const label = new St.Label({
                text: row.text || "",
                style_class: "jma-weather-forecast-label"
            });
            label.clutter_text.set_line_wrap(false);

            _setSvgIcon(icon, row.iconPath, this._iconSize);
            box.add_actor(icon);
            box.add_actor(label);
            this._list.add_actor(box);
        }
    }
}

class WeatherTextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor() {
        super({ reactive: false });
        this.label = new St.Label({
            text: "",
            style_class: "jma-weather-text-block"
        });
        this.label.clutter_text.set_line_wrap(true);
        this.addActor(this.label);
    }

    setText(text) {
        this.label.set_text(text || "予報を取得できません");
    }
}

class JmaWeatherApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._instanceId = instanceId;
        this._timeoutId = 0;
        this._destroyed = false;
        this._weather = new WeatherData.WeatherSnapshot();
        this._lastNoticeKeys = new Set();
        this._lastRainNotice = null;
        this._settingsMonitor = null;
        this._settingsMonitorSignalId = 0;
        this._settingsReloadId = 0;
        this._settingRefreshId = 0;
        this._refreshGeneration = 0;
        this._refreshInFlight = false;
        this._refreshQueued = false;
        this._activeConfigSignature = null;
        this._iconService = new IconServiceModule.IconService(metadata.path);

        this._setPanelIcon(this._iconService.iconPath("unknown"));
        this.set_applet_label("天気…");
        this.set_applet_tooltip("天気予報を取得しています");

        this._settings = new Settings.AppletSettings(
            this,
            metadata.uuid,
            instanceId
        );

        const refreshKeys = [
            ["display-name", "displayName"],
            ["selected-prefecture-code", "selectedPrefectureCode"],
            ["selected-municipality-code", "selectedMunicipalityCode"],
            ["custom-coordinates", "customCoordinates"],
            ["jma-area-code", "jmaAreaCode"],
            ["jma-area-name", "jmaAreaName"],
            ["jma-temp-area-name", "jmaTempAreaName"],
            ["latitude", "latitude"],
            ["longitude", "longitude"],
            ["panel-mode", "panelMode"],
            ["hourly-count", "hourlyCount"],
            ["current-icon-size", "currentIconSize"],
            ["forecast-icon-size", "forecastIconSize"],
            ["rain-notification", "rainNotification"],
            ["rain-threshold", "rainThreshold"],
            ["heat-notification", "heatNotification"],
            ["heat-threshold", "heatThreshold"],
            ["uv-notification", "uvNotification"],
            ["uv-threshold", "uvThreshold"],
            ["details-url", "detailsUrl"],
            ["radar-url", "radarUrl"]
        ];

        for (const [key, property] of refreshKeys) {
            this._settings.bind(
                key,
                property,
                this._onSettingChanged.bind(this)
            );
        }

        this._settings.bind(
            "update-interval",
            "updateInterval",
            this._restartTimer.bind(this)
        );

        this._setupSettingsMonitor();

        this._httpClient = new HttpClientModule.HttpClient(
            `JMA-Weather-Cinnamon/${VERSION}`,
            20
        );

        const jmaProvider = new JmaProviderModule.JmaProvider(
            this._httpClient,
            WeatherUtils
        );
        const openMeteoProvider = new OpenMeteoProviderModule.OpenMeteoProvider(
            this._httpClient,
            WeatherUtils
        );

        this._weatherService = new WeatherServiceModule.WeatherService(
            jmaProvider,
            openMeteoProvider,
            WeatherData.WeatherSnapshot
        );
        this._locationService = new LocationServiceModule.LocationService(WeatherUtils);
        this._cacheService = new CacheServiceModule.CacheService({
            uuid: UUID,
            instanceId: this.instance_id ?? this._instanceId,
            maxAgeMs: 24 * 60 * 60 * 1000
        });

        this._buildMenu();
        this._restoreCachedWeather();
        this._refreshAll();
        this._restartTimer();
    }

    _buildMenu() {
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new Applet.AppletPopupMenu(
            this,
            this._orientation
        );
        this._menuManager.addMenu(this._menu);

        this._currentItem = new WeatherSummaryMenuItem(
            Number(this.currentIconSize) || 44
        );
        this._menu.addMenuItem(this._currentItem);

        this._hourlyHeader = new PopupMenu.PopupMenuItem(
            "時間別予報",
            { reactive: false }
        );
        this._hourlyHeader.label.add_style_class_name("jma-weather-header");
        this._menu.addMenuItem(this._hourlyHeader);

        this._hourlyItem = new WeatherForecastMenuItem(
            Number(this.forecastIconSize) || 24
        );
        this._menu.addMenuItem(this._hourlyItem);

        this._regionalHeader = new PopupMenu.PopupMenuItem(
            "気象庁の地域予報",
            { reactive: false }
        );
        this._regionalHeader.label.add_style_class_name("jma-weather-header");
        this._menu.addMenuItem(this._regionalHeader);

        this._regionalItem = new WeatherTextMenuItem();
        this._menu.addMenuItem(this._regionalItem);

        this._weeklyHeader = new PopupMenu.PopupMenuItem(
            "週間予報（気象庁）",
            { reactive: false }
        );
        this._weeklyHeader.label.add_style_class_name("jma-weather-header");
        this._menu.addMenuItem(this._weeklyHeader);

        this._weeklyItem = new WeatherForecastMenuItem(
            Number(this.forecastIconSize) || 24
        );
        this._menu.addMenuItem(this._weeklyItem);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refresh = new PopupMenu.PopupMenuItem("今すぐ更新");
        refresh.connect("activate", () => this._refreshAll());
        this._menu.addMenuItem(refresh);

        const details = new PopupMenu.PopupMenuItem("詳しい予報を開く");
        details.connect("activate", () => this._openUri(this.detailsUrl));
        this._menu.addMenuItem(details);

        const radar = new PopupMenu.PopupMenuItem("雨雲レーダーを開く");
        radar.connect("activate", () => this._openUri(this.radarUrl));
        this._menu.addMenuItem(radar);

        const settings = new PopupMenu.PopupMenuItem("設定");
        settings.connect("activate", () => this._openSettings());
        this._menu.addMenuItem(settings);
    }

    on_applet_clicked() {
        this._menu.toggle();
    }

    _onSettingChanged() {
        this._render();

        // A single external save can update many keys. Debounce callbacks so
        // it results in one provider refresh instead of a request storm.
        if (this._settingRefreshId)
            Mainloop.source_remove(this._settingRefreshId);

        this._settingRefreshId = Mainloop.timeout_add(250, () => {
            this._settingRefreshId = 0;
            if (!this._destroyed)
                this._refreshAll();
            return false;
        });
    }

    _setupSettingsMonitor() {
        try {
            const settingsFile = this._settings?.file;
            const settingsPath = settingsFile?.get_path();
            const parent = settingsFile?.get_parent();
            if (!settingsPath || !parent)
                return;

            this._settingsFilePath = settingsPath;
            this._settingsMonitor = parent.monitor_directory(
                Gio.FileMonitorFlags.NONE,
                null
            );
            this._settingsMonitorSignalId = this._settingsMonitor.connect(
                "changed",
                () => this._queueSettingsReload()
            );
        } catch (error) {
            global.logError(`[${UUID}] settings monitor failed: ${error}`);
        }
    }

    _queueSettingsReload() {
        if (this._settingsReloadId)
            Mainloop.source_remove(this._settingsReloadId);

        // SettingsStore saves atomically with os.replace(), which can emit
        // multiple directory events. Reload once after the write settles.
        this._settingsReloadId = Mainloop.timeout_add(200, () => {
            this._settingsReloadId = 0;
            if (this._destroyed || !this._settings)
                return false;

            try {
                this._settings.remoteUpdate("", "");
            } catch (error) {
                global.logError(`[${UUID}] settings reload failed: ${error}`);
            }
            return false;
        });
    }

    _restartTimer() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const minutes = Math.max(10, Number(this.updateInterval) || 30);
        this._timeoutId = Mainloop.timeout_add_seconds(
            minutes * 60,
            () => {
                this._refreshAll();
                return true;
            }
        );
    }

    _createProviderConfig() {
        const location = this._locationService.createProviderConfig({
            displayName: this.displayName,
            selectedPrefectureCode: this.selectedPrefectureCode,
            selectedMunicipalityCode: this.selectedMunicipalityCode,
            customCoordinates: this.customCoordinates,
            jmaAreaCode: this.jmaAreaCode,
            jmaAreaName: this.jmaAreaName,
            jmaTempAreaName: this.jmaTempAreaName,
            latitude: this.latitude,
            longitude: this.longitude
        });

        return { jma: location.jma, openMeteo: location.openMeteo };
    }

    _restoreCachedWeather() {
        try {
            const config = this._createProviderConfig();
            const cached = this._cacheService.load(config);

            if (this._cacheService.lastError)
                global.logError(`[${UUID}] ${this._cacheService.lastError}`);

            if (!cached)
                return;

            this._weather = WeatherData.WeatherSnapshot.fromCache(cached);
            this._activeConfigSignature = this._cacheService.signature(config);
            this._render();
        } catch (error) {
            global.logError(`[${UUID}] cache restore failed: ${error}`);
        }
    }

    _refreshAll() {
        this._refreshGeneration += 1;

        if (this._refreshInFlight) {
            this._refreshQueued = true;
            return;
        }

        this._startRefresh(this._refreshGeneration);
    }

    _startRefresh(generation) {
        this._refreshInFlight = true;
        this.set_applet_tooltip("天気予報を更新しています…");

        let config;
        let signature;
        try {
            config = this._createProviderConfig();
            signature = this._cacheService.signature(config);
        } catch (error) {
            this._refreshInFlight = false;
            global.logError(`[${UUID}] location config: ${error}`);

            if (generation === this._refreshGeneration)
                this.set_applet_tooltip(`地域設定エラー: ${error.message || error}`);

            this._drainQueuedRefresh(generation);
            return;
        }

        // Never carry provider data across different locations. A settings
        // change during an active request is handled by the generation gate.
        const previousSnapshot = this._activeConfigSignature === signature
            ? this._weather
            : null;

        this._weatherService.refresh(
            config,
            previousSnapshot,
            snapshot => {
                this._refreshInFlight = false;

                if (this._destroyed)
                    return;

                const isLatest = generation === this._refreshGeneration;
                if (isLatest) {
                    this._weather = snapshot;
                    this._activeConfigSignature = signature;

                    if (snapshot.hasFreshData()) {
                        this._cacheService.save(config, snapshot);
                        if (this._cacheService.lastError)
                            global.logError(`[${UUID}] ${this._cacheService.lastError}`);
                    }

                    this._render();
                    if (snapshot.hasFreshData())
                        this._checkNotifications();

                    if (snapshot.errors.length)
                        global.logError(`[${UUID}] ${snapshot.errors.join(" | ")}`);
                }

                this._drainQueuedRefresh(generation);
            }
        );
    }

    _drainQueuedRefresh(completedGeneration) {
        if (this._destroyed)
            return;

        if (this._refreshQueued || completedGeneration !== this._refreshGeneration) {
            this._refreshQueued = false;
            this._startRefresh(this._refreshGeneration);
        }
    }

    _openSettings() {
        // The applet menu must launch the v3 external settings application
        // directly. On some Cinnamon versions configureApplet() opens the
        // schema-generated legacy window even when metadata.json declares an
        // external configuration app.
        try {
            const settingsApp = `${this._metadata.path}/settings.py`;
            const instanceId = this.instance_id ?? this._instanceId;
            // User-managed Python installations selected by /usr/bin/env may
            // not include the distribution PyGObject packages used by GTK.
            const argv = ["/usr/bin/python3", settingsApp];

            if (instanceId !== null && instanceId !== undefined)
                argv.push("--instance", String(instanceId));

            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            return;
        } catch (externalError) {
            global.logError(
                `[${UUID}] external settings app failed: ${externalError}`
            );
        }

        try {
            // Compatibility fallback for environments where the external
            // settings application cannot be started.
            if (typeof this.configureApplet === "function") {
                this.configureApplet();
                return;
            }

            const instanceId = this.instance_id ?? this._instanceId;

            if (instanceId !== null && instanceId !== undefined) {
                Util.spawnCommandLine(
                    `cinnamon-settings applets ${UUID} ${instanceId}`
                );
                return;
            }

            Util.spawnCommandLine(`cinnamon-settings applets ${UUID}`);
        } catch (error) {
            global.logError(`[${UUID}] settings fallback failed: ${error}`);

            try {
                Util.spawnCommandLine("cinnamon-settings applets");
                Main.notify(
                    "アプレット設定を開きました",
                    "一覧から JMA Weather Japan の設定を選んでください。"
                );
            } catch (fallbackError) {
                global.logError(
                    `[${UUID}] settings list fallback failed: ${fallbackError}`
                );
                Main.notify(
                    "設定画面を開けませんでした",
                    String(fallbackError.message || fallbackError)
                );
            }
        }
    }

    _setPanelIcon(path) {
        try {
            if (_fileExists(path)) {
                this.set_applet_icon_path(path);
                return;
            }
        } catch (error) {
            global.logError(`[${UUID}] panel SVG icon failed: ${error}`);
        }

        this.set_applet_icon_name("weather-overcast-symbolic");
    }

    _dataStatusLine() {
        const label = this._weather.staleLabel();
        if (!label)
            return null;

        const savedAt = formatCacheSavedAt(this._weather.cacheSavedAt);
        return savedAt
            ? `⚠ ${label}（保存 ${savedAt}）`
            : `⚠ ${label}`;
    }

    _render() {
        if (!this._weather.hasData()) {
            this._setPanelIcon(this._iconService.iconPath("warning"));
            this.set_applet_label("天気");
            this.set_applet_tooltip("予報を取得できませんでした");
            this._currentItem.setContent(
                this._iconService.iconPath("warning"),
                "予報を取得できませんでした",
                Number(this.currentIconSize) || 44
            );
            this._hourlyItem.setRows([], Number(this.forecastIconSize) || 24, "時間別予報を取得できません");
            this._regionalItem.setText("地域予報を取得できません");
            this._weeklyItem.setRows([], Number(this.forecastIconSize) || 24, "週間予報を取得できません");
            return;
        }

        const jma = this._weather.jma;
        const hourly = this._weather.openMeteo;
        const panelWeather = this._weather.panelWeather();
        const panelHourly = panelWeather.hourlyEntry;
        const hasOpenMeteoCurrent = hourly?.current?.code !== null &&
            hourly?.current?.code !== undefined;
        const currentConditionIconName = hasOpenMeteoCurrent
            ? this._iconService.openMeteoForecastIconName(hourly.current)
            : this._iconService.jmaIconName(jma?.weatherCode);
        const currentConditionIconPath = this._iconService.iconPath(
            currentConditionIconName
        );
        const panelIconName = panelHourly
            ? this._iconService.openMeteoForecastIconName(panelHourly)
            : currentConditionIconName;
        this._setPanelIcon(this._iconService.iconPath(panelIconName));

        const currentTemp = panelWeather.currentTemp;
        const today = this._weather.effectiveToday();
        const minTemp = today.min;
        const maxTemp = today.max;
        const panelPop = panelWeather.precipitation;

        let label = "";
        if (this.panelMode === "temperature" || this.panelMode === "full") {
            const displayTemp = currentTemp !== null && currentTemp !== undefined
                ? Math.round(currentTemp)
                : maxTemp !== null && maxTemp !== undefined
                    ? Math.round(maxTemp)
                    : null;

            if (displayTemp !== null)
                label = `${displayTemp}°`;
        }

        if (this.panelMode === "full" && panelPop !== null && panelPop !== undefined)
            label += `${label ? " " : ""}☔${Math.round(panelPop)}%`;

        if (maxTemp !== null &&
            maxTemp !== undefined &&
            Number(maxTemp) >= Number(this.heatThreshold || 35))
            label += `${label ? " " : ""}🔥`;

        this.set_applet_label(label);

        const location = this.displayName || "設定地域";
        const dataStatusLine = this._dataStatusLine();
        const openMeteoState = this._weather.providerState("openMeteo");
        const currentTime = hourly?.current?.time
            ? formatUpdatedAt(hourly.current.time)
            : null;
        const currentWindDirection = formatWindDirection(
            hourly?.current?.windDirection
        );
        const currentLines = [
            `${location}`,
            dataStatusLine,
            hasOpenMeteoCurrent
                ? "現在の天気（推定）"
                : jma
                    ? "地域予報（Open-Meteo取得不可）"
                    : null,
            currentTemp !== null && currentTemp !== undefined
                ? `現在 ${Math.round(currentTemp)}℃` : null,
            hourly?.current?.feels !== null && hourly?.current?.feels !== undefined
                ? `体感 ${Math.round(hourly.current.feels)}℃（${feelsLikeDescription(currentTemp, hourly.current.feels)}）`
                : null,
            hourly?.current?.wind !== null && hourly?.current?.wind !== undefined
                ? `風 ${currentWindDirection ? `${currentWindDirection} ` : ""}` +
                    `${hourly.current.wind.toFixed(1)} km/h`
                : null,
            hourly?.current?.precipitation !== null &&
            hourly?.current?.precipitation !== undefined
                ? `降水量 ${Math.max(0, hourly.current.precipitation).toFixed(1)} mm`
                : null,
            hasOpenMeteoCurrent
                ? `情報源 Open-Meteo / 有効 ${currentTime || "時刻不明"} / ${openMeteoState}`
                : null
        ].filter(Boolean);

        this._currentItem.setContent(
            currentConditionIconPath,
            currentLines.join("\n"),
            Number(this.currentIconSize) || 44
        );

        const count = Math.max(3, Math.min(12, Number(this.hourlyCount) || 8));
        const allHourlyRows = hourly?.rows || [];
        const currentHourlyIndex = panelHourly
            ? allHourlyRows.indexOf(panelHourly)
            : 0;
        const hourlyRows = allHourlyRows
            .slice(Math.max(0, currentHourlyIndex), Math.max(0, currentHourlyIndex) + count)
            .map(row => {
            const temp = row.temp !== null && row.temp !== undefined
                ? `${Math.round(row.temp)}℃` : "--℃";
            const pop = row.pop !== null && row.pop !== undefined
                ? `${Math.round(row.pop)}%` : "--%";
            const precipitation = row.precipitation !== null &&
                row.precipitation !== undefined
                ? `${Math.max(0, row.precipitation).toFixed(1)}mm`
                : "--mm";
            const wind = row.wind !== null && row.wind !== undefined
                ? `${Math.round(row.wind)}km/h` : "--km/h";
            const direction = formatWindDirection(row.windDirection);
            const uv = row.uv !== null && row.uv !== undefined
                ? `UV${row.uv.toFixed(1)}` : "UV--";
            return {
                iconPath: this._iconService.iconPath(
                    this._iconService.openMeteoForecastIconName(row)
                ),
                text: `${formatHour(row.time)}  ${temp}  ☔${pop}  ` +
                    `${precipitation}  💨${direction ? `${direction} ` : ""}${wind}  ${uv}`
            };
            });

        this._hourlyItem.setRows(
            hourlyRows,
            Number(this.forecastIconSize) || 24,
            "時間別予報を取得できません"
        );

        const regionalRows = jma?.regionalRows || [];
        const precipitationBlocks = jma?.precipitationBlocks || [];
        const regionalLines = [
            jma?.areaName || null,
            regionalRows[0]?.weatherText || jma?.weatherText || null,
            regionalRows[0]?.windText
                ? `風：${regionalRows[0].windText}` : null,
            regionalRows[1]?.weatherText
                ? `明日：${regionalRows[1].weatherText}` : null,
            minTemp !== null && minTemp !== undefined &&
            maxTemp !== null && maxTemp !== undefined
                ? `今日の気温 最低 ${Math.round(minTemp)}℃ / 最高 ${Math.round(maxTemp)}℃`
                : maxTemp !== null && maxTemp !== undefined
                    ? `今日の最高気温 ${Math.round(maxTemp)}℃`
                    : null,
            precipitationBlocks.length
                ? "降水確率（時間帯）" : null,
            ...precipitationBlocks.map((block, index) =>
                formatJmaPrecipitationBlock(
                    block,
                    precipitationBlocks[index + 1]
                )
            ),
            jma?.issuedAt
                ? `気象庁発表 ${formatUpdatedAt(jma.issuedAt)} / ` +
                    `${this._weather.providerState("jma")}`
                : jma
                    ? `情報源 気象庁 / ${this._weather.providerState("jma")}`
                    : null
        ].filter(Boolean);
        this._regionalItem.setText(
            regionalLines.join("\n") || "地域予報を取得できません"
        );

        const weeklyRows = this._weather.mergedWeeklyRows().map(row => {
            const min = row.min !== null ? Math.round(row.min) : "--";
            const max = row.max !== null ? Math.round(row.max) : "--";
            const pop = row.pop !== null ? Math.round(row.pop) : "--";
            return {
                iconPath: this._iconService.iconPath(
                    this._iconService.dailyIconName(row.code)
                ),
                text: `${formatWeekday(row.time)}  ${min}/${max}℃  ☔${pop}%`
            };
        });

        this._weeklyItem.setRows(
            weeklyRows,
            Number(this.forecastIconSize) || 24,
            "週間予報を取得できません"
        );

        const tooltip = [
            location,
            dataStatusLine,
            hasOpenMeteoCurrent ? "現在の天気（推定） / Open-Meteo" : "地域予報（代替）",
            currentTemp !== null && currentTemp !== undefined
                ? `現在 ${Math.round(currentTemp)}℃` : null,
            panelPop !== null && panelPop !== undefined
                ? `時間別降水確率 ${Math.round(panelPop)}%` : null,
            `更新 ${formatUpdatedAt(this._weather.latestUpdatedAt())}`
        ].filter(Boolean).join("\n");

        this.set_applet_tooltip(tooltip);
    }

    _checkNotifications() {
        const hourly = this._weather.openMeteo;

        if (this.rainNotification &&
            this._weather.isProviderFresh("openMeteo") &&
            hourly?.rows?.length) {
            const threshold = Number(this.rainThreshold || 60);
            const sixHoursLater = Date.now() + 6 * 60 * 60 * 1000;
            const target = hourly.rows.find(row => {
                const time = new Date(row.time).getTime();
                return row.pop !== null &&
                    row.pop >= threshold &&
                    !Number.isNaN(time) &&
                    time <= sixHoursLater;
            });

            if (target) {
                const probability = Math.round(target.pop);
                const shouldNotify =
                    !this._lastRainNotice ||
                    this._lastRainNotice.time !== target.time ||
                    probability >= this._lastRainNotice.probability + 10;

                if (shouldNotify) {
                    this._lastRainNotice = {
                        time: target.time,
                        probability
                    };
                    this._notifyOnce(
                        `rain:${target.time}:${probability}`,
                        `${this.displayName || "設定地域"}：6時間以内に雨の可能性`,
                        `${formatHour(target.time)}ごろの降水確率は${probability}%です。傘の準備をおすすめします。`
                    );
                }
            } else {
                this._lastRainNotice = null;
            }
        }

        const today = this._weather.effectiveToday();
        if (this.heatNotification &&
            this._weather.hasFreshData() &&
            today.max !== null &&
            today.max !== undefined &&
            today.max >= Number(this.heatThreshold || 35)) {
            const key = `heat:${new Date().toDateString()}:${today.max}`;
            this._notifyOnce(
                key,
                `${this.displayName || "設定地域"}：高温に注意`,
                `予想最高気温は${Math.round(today.max)}℃です。外出時は暑さ対策をしてください。`
            );
        }

        if (this.uvNotification &&
            this._weather.isProviderFresh("openMeteo") &&
            hourly?.uvMax !== null &&
            hourly?.uvMax !== undefined &&
            hourly.uvMax >= Number(this.uvThreshold || 8)) {
            const key = `uv:${new Date().toDateString()}:${hourly.uvMax}`;
            this._notifyOnce(
                key,
                `${this.displayName || "設定地域"}：紫外線が強い予報`,
                `最大UV指数は${hourly.uvMax.toFixed(1)}です。`
            );
        }
    }

    _notifyOnce(key, title, body) {
        if (this._lastNoticeKeys.has(key))
            return;

        this._lastNoticeKeys.add(key);
        Main.notify(title, body);

        if (this._lastNoticeKeys.size > 30) {
            const first = this._lastNoticeKeys.values().next().value;
            this._lastNoticeKeys.delete(first);
        }
    }

    _openUri(url) {
        if (!url)
            return;

        try {
            Gio.AppInfo.launch_default_for_uri(url, null);
        } catch (error) {
            global.logError(`[${UUID}] URL open failed: ${error}`);
            Main.notify("URLを開けませんでした", String(error.message || error));
        }
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        this._refreshGeneration += 1;
        this._refreshQueued = false;

        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        for (const idName of ["_settingsReloadId", "_settingRefreshId"]) {
            if (this[idName]) {
                Mainloop.source_remove(this[idName]);
                this[idName] = 0;
            }
        }

        if (this._settingsMonitor) {
            if (this._settingsMonitorSignalId)
                this._settingsMonitor.disconnect(this._settingsMonitorSignalId);
            this._settingsMonitor.cancel();
            this._settingsMonitor = null;
            this._settingsMonitorSignalId = 0;
        }

        if (this._httpClient)
            this._httpClient.destroy();

        if (this._settings)
            this._settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    _loadLocalModules(metadata);

    return new JmaWeatherApplet(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
