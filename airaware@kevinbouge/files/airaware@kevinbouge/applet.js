const Applet = imports.ui.applet;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;

const DEFAULT_UUID = 'airaware@kevinbouge';
const TRANSIENT_ERROR_DELAY_SECONDS = 8;
const DATA_STALE_FACTOR = 2;
const PLACE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PLACE_COORDINATE_TOLERANCE = 0.02;
const WEEKDAY_LABELS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

/*
 * TODO roadmap:
 * - manual location search/geocoding
 * - multiple saved locations
 * - hourly forecast
 * - multiple providers
 * - custom weighting
 * - personal allergens
 * - graphs
 */

let _uuid = DEFAULT_UUID;
let Cache = null;
let EnvironmentAssembler = null;
let Formatter = null;
let LocationService = null;
let NotificationPolicy = null;
let OpenMeteoProvider = null;
let OpenMeteoWeatherProvider = null;
let ReverseGeocoder = null;
let RiskCalculator = null;

function _(text) {
    return Gettext.dgettext(_uuid, text);
}

function _replace(template, replacements) {
    let result = template;

    for (const key in replacements)
        result = result.replace(`{${key}}`, `${replacements[key]}`);

    return result;
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _formatWeekdayLabel(dateText) {
    if (typeof dateText !== 'string')
        return _('Unknown');

    const parts = dateText.split('-');

    if (parts.length !== 3)
        return dateText;

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31)
        return dateText;

    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day)
        return dateText;

    return _(WEEKDAY_LABELS[date.getDay()]);
}

function _loadLocalModules(metadata) {
    if (Cache !== null)
        return;

    imports.searchPath.unshift(GLib.build_filenamev([metadata.path, 'lib']));

    Cache = imports.cache;
    EnvironmentAssembler = imports.environmentAssembler;
    Formatter = imports.formatter;
    LocationService = imports.locationService;
    NotificationPolicy = imports.notificationPolicy;
    OpenMeteoProvider = imports.openMeteoProvider;
    OpenMeteoWeatherProvider = imports.openMeteoWeatherProvider;
    ReverseGeocoder = imports.reverseGeocoder;
    RiskCalculator = imports.riskCalculator;

    Formatter.setTranslator(_);
}

function _nowMs() {
    return GLib.get_real_time() / 1000;
}

class AirAwareApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        _uuid = metadata.uuid || DEFAULT_UUID;
        _loadLocalModules(metadata);

        this.metadata = metadata;
        this.instanceId = instanceId;
        this._destroyed = false;
        this._refreshTimerId = 0;
        this._errorTimerId = 0;
        this._activeLocationRequest = null;
        this._activeProviderRequest = null;
        this._activeWeatherRequest = null;
        this._activeReverseGeocodeRequest = null;
        this._activeReverseGeocodeKey = null;
        this._refreshGeneration = 0;
        this._providerData = null;
        this._currentRisk = null;
        this._locationDisplayName = null;
        this._locationDisplayStatus = 'unknown';
        this._lastFreshCategoryId = null;
        this._lastError = null;
        this._usingStaleData = false;
        this._isRefreshing = false;
        this._lastLocationResult = null;
        this._panelIconColorId = null;
        this._panelIconPaths = this._buildPanelIconPaths(metadata.path);

        this.refreshIntervalMinutes = 60;
        this.showPanelText = true;
        this.notificationLevel = 'disabled';
        this.forecastLength = 3;
        this.locationMode = 'automatic';
        this.manualLatitude = '';
        this.manualLongitude = '';
        this._locationSettingsSignature = null;
        this.on_open_coordinate_map_pressed = () => this._openCoordinateMap();
        this.on_test_notification_pressed = () => this._sendTestNotification();

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_icon_path(this._panelIconPaths.unavailable);
        this._setPanelIconColor(null);
        this.set_applet_tooltip(_('AirAware: loading environmental conditions'));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.actor.add_style_class_name('airaware-menu');
        this.menuManager.addMenu(this.menu);

        this._cache = Cache.createCache({
            baseDirectory: Cache.getDefaultCacheDirectory(metadata.uuid),
        });
        this._locationService = LocationService.createLocationService({
            cache: this._cache,
            desktopId: 'airaware',
        });

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind('refresh-interval', 'refreshIntervalMinutes',
            () => this._onSettingsChanged());
        this.settings.bind('show-panel-text', 'showPanelText',
            () => this._onSettingsChanged());
        this.settings.bind('notification-level', 'notificationLevel',
            () => this._onSettingsChanged());
        this.settings.bind('location-mode', 'locationMode',
            () => this._onSettingsChanged());
        this.settings.bind('manual-latitude', 'manualLatitude',
            () => this._onSettingsChanged());
        this.settings.bind('manual-longitude', 'manualLongitude',
            () => this._onSettingsChanged());

        this.refreshIntervalMinutes = this._normalizeRefreshInterval(
            this.refreshIntervalMinutes
        );
        this.locationMode = this._normalizeLocationMode(this.locationMode);
        this._locationSettingsSignature = this._getLocationSettingsSignature();

        this._setLoadingState();
        this._rebuildMenu();
        this._scheduleRefresh();
        this._refreshData(false);
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._destroy();
    }

    _openCoordinateMap() {
        let coordinates = this._manualCoordinatesFromSettings();

        if (coordinates === null && this._lastLocationResult)
            coordinates = this._lastLocationResult.coordinates;

        const uri = coordinates
            ? this._buildCoordinateMapUri(coordinates)
            : 'https://www.openstreetmap.org/';

        this._launchUri(uri);
    }
    destroy() {
        this._destroy();

        if (this.menu)
            this.menu.destroy();

        this.actor._delegate = null;
        this.emit('destroy');
    }

    _destroy() {
        if (this._destroyed)
            return;

        this._destroyed = true;
        this._clearRefreshTimer();
        this._clearErrorTimer();
        this._cancelActiveRequests();

        if (this._locationService)
            this._locationService.destroy();

        if (this.settings)
            this.settings.finalize();
    }

    _onSettingsChanged() {
        if (this._destroyed)
            return;

        this.refreshIntervalMinutes = this._normalizeRefreshInterval(
            this.refreshIntervalMinutes
        );
        this.forecastLength = 3;
        this.locationMode = this._normalizeLocationMode(this.locationMode);

        const locationSettingsSignature = this._getLocationSettingsSignature();
        const locationSettingsChanged = this._locationSettingsSignature !== null &&
            locationSettingsSignature !== this._locationSettingsSignature;

        this._locationSettingsSignature = locationSettingsSignature;
        this._updatePanel();
        this._rebuildMenu();
        this._scheduleRefresh();

        if (locationSettingsChanged && this._canRefreshForCurrentLocationSettings())
            this._refreshData(false);
    }

    _normalizeRefreshInterval(value) {
        const allowed = [30, 60, 120, 240, 360];
        const numericValue = Number(value);

        if (allowed.indexOf(numericValue) !== -1)
            return numericValue;

        return 60;
    }

    _normalizeLocationMode(value) {
        return value === 'manual' ? 'manual' : 'automatic';
    }

    _getLocationSettingsSignature() {
        return [
            this._normalizeLocationMode(this.locationMode),
            `${this.manualLatitude}`.trim(),
            `${this.manualLongitude}`.trim(),
        ].join('|');
    }

    _manualCoordinatesFromSettings() {
        return LocationService.coordinatesFromManualSettings(
            this.manualLatitude,
            this.manualLongitude
        );
    }

    _manualLocationResultFromSettings(source = 'manual') {
        const coordinates = this._manualCoordinatesFromSettings();

        if (coordinates === null)
            return null;

        this._cache.writeCoordinates(coordinates);

        return {
            coordinates,
            updatedAt: _nowMs(),
            source,
            isStale: false,
            error: null,
        };
    }

    _cachedLocationResult() {
        const envelope = this._cache.readCoordinates();

        if (!envelope)
            return null;

        return {
            coordinates: envelope.data,
            updatedAt: envelope.savedAt,
            source: 'cache',
            isStale: true,
            error: null,
        };
    }

    _locationResultFromProviderData(data) {
        if (!data ||
            !_isFiniteNumber(data.latitude) ||
            !_isFiniteNumber(data.longitude))
            return null;

        return {
            coordinates: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: null,
            },
            updatedAt: data.fetchedAt,
            source: 'provider-response',
            isStale: this._isDataOld(data),
            error: null,
        };
    }

    _buildCoordinateMapUri(coordinates) {
        const latitude = Number(coordinates.latitude);
        const longitude = Number(coordinates.longitude);

        if (!_isFiniteNumber(latitude) || !_isFiniteNumber(longitude))
            return 'https://www.openstreetmap.org/';

        const latitudeText = latitude.toFixed(5);
        const longitudeText = longitude.toFixed(5);

        return `https://www.openstreetmap.org/?mlat=${latitudeText}&mlon=${longitudeText}#map=10/${latitudeText}/${longitudeText}`;
    }

    _launchUri(uri) {
        try {
            if (Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context()))
                return;
        } catch (error) {
            this._logError(error);
        }

        Util.spawn(['xdg-open', uri]);
    }

    _canRefreshForCurrentLocationSettings() {
        if (this._normalizeLocationMode(this.locationMode) !== 'manual')
            return true;

        return this._manualCoordinatesFromSettings() !== null;
    }

    _clearRefreshTimer() {
        if (this._refreshTimerId !== 0) {
            Mainloop.source_remove(this._refreshTimerId);
            this._refreshTimerId = 0;
        }
    }

    _clearErrorTimer() {
        if (this._errorTimerId !== 0) {
            Mainloop.source_remove(this._errorTimerId);
            this._errorTimerId = 0;
        }
    }

    _scheduleRefresh() {
        this._clearRefreshTimer();

        this._refreshTimerId = Mainloop.timeout_add_seconds(
            this.refreshIntervalMinutes * 60,
            () => {
                this._refreshData(false);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _cancelActiveRequests() {
        if (this._activeLocationRequest) {
            this._activeLocationRequest.cancel();
            this._activeLocationRequest = null;
        }

        if (this._activeProviderRequest) {
            this._activeProviderRequest.cancel();
            this._activeProviderRequest = null;
        }

        if (this._activeWeatherRequest) {
            this._activeWeatherRequest.cancel();
            this._activeWeatherRequest = null;
        }

        if (this._activeReverseGeocodeRequest) {
            this._activeReverseGeocodeRequest.cancel();
            this._activeReverseGeocodeRequest = null;
            this._activeReverseGeocodeKey = null;
        }
    }

    _setLoadingState() {
        this._currentRisk = null;
        this._updatePanel(_('Loading'));
    }

    _setError(error) {
        this._isRefreshing = false;
        this._lastError = error;
        this._logError(error);
        this._rebuildMenu();

        this._clearErrorTimer();
        this._errorTimerId = Mainloop.timeout_add_seconds(
            TRANSIENT_ERROR_DELAY_SECONDS,
            () => {
                this._lastError = null;
                this._rebuildMenu();
                this._errorTimerId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _refreshData(forceLocationRefresh) {
        if (this._destroyed)
            return;

        // Invalidate callbacks from older requests before cancellation can
        // trigger any asynchronous completion handlers.
        this._refreshGeneration++;

        const refreshGeneration = this._refreshGeneration;

        this._cancelActiveRequests();
        this._clearErrorTimer();
        this._lastError = null;
        this._isRefreshing = true;
        this._updatePanel();
        this._rebuildMenu();

        if (this._normalizeLocationMode(this.locationMode) === 'manual') {
            const manualLocationResult = this._manualLocationResultFromSettings();

            if (manualLocationResult === null) {
                this._useCachedResponse(new Error('Manual location coordinates are invalid'));
                return;
            }

            this._lastLocationResult = manualLocationResult;
            this._ensureLocationDisplayName(manualLocationResult);
            this._fetchProviderData(this._lastLocationResult, refreshGeneration);
            return;
        }

        const locationOptions = {
            timeoutMs: 15000,
        };
        let locationRequest = null;
        let locationCompleted = false;
        const locationCallback = (error, locationResult) => {
            locationCompleted = true;

            if (this._activeLocationRequest === locationRequest)
                this._activeLocationRequest = null;

            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            if (error || !locationResult) {
                const manualFallback = this._manualLocationResultFromSettings('manual-fallback');

                if (manualFallback !== null) {
                    this._lastLocationResult = manualFallback;
                    this._ensureLocationDisplayName(manualFallback);
                    this._fetchProviderData(manualFallback, refreshGeneration);
                    return;
                }

                this._useCachedResponse(error || new Error('Location unavailable'));
                return;
            }

            this._lastLocationResult = locationResult;
            this._ensureLocationDisplayName(locationResult);
            this._fetchProviderData(locationResult, refreshGeneration);
        };

        locationRequest = forceLocationRefresh
            ? this._locationService.refreshLocationAsync(locationOptions, locationCallback)
            : this._locationService.getLocationAsync(locationOptions, locationCallback);

        this._activeLocationRequest = locationCompleted ? null : locationRequest;
    }

    _fetchProviderData(locationResult, refreshGeneration) {
        const requestDays = this.forecastLength + 1;
        const cachedEnvelope = this._cache.readResponse();
        const cachedData = cachedEnvelope ? cachedEnvelope.data : null;
        let airQualityResult = {
            completed: false,
            error: null,
            data: null,
        };
        let weatherResult = {
            completed: false,
            error: null,
            data: null,
        };
        let providerRequest = null;
        let providerCompleted = false;
        let weatherRequest = null;
        let weatherCompleted = false;
        const maybeComplete = () => {
            if (!airQualityResult.completed || !weatherResult.completed)
                return;

            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            const combinedData = EnvironmentAssembler.combineEnvironmentalData({
                airQualityData: airQualityResult.error ? null : airQualityResult.data,
                weatherData: weatherResult.error ? null : weatherResult.data,
                cachedData,
            });

            if (!combinedData) {
                this._useCachedResponse(
                    airQualityResult.error ||
                    weatherResult.error ||
                    new Error('Data unavailable')
                );
                return;
            }

            if (airQualityResult.error)
                this._logError(airQualityResult.error);

            if (weatherResult.error)
                this._logError(weatherResult.error);

            this._cache.writeResponse(combinedData);
            this._applyProviderData(
                combinedData,
                airQualityResult.error !== null && cachedData !== null,
                airQualityResult.error || weatherResult.error
            );
        };
        const providerCallback = (error, data) => {
            providerCompleted = true;

            if (this._activeProviderRequest === providerRequest)
                this._activeProviderRequest = null;

            airQualityResult = {
                completed: true,
                error: error || null,
                data: error ? null : data,
            };
            maybeComplete();
        };
        const weatherCallback = (error, data) => {
            weatherCompleted = true;

            if (this._activeWeatherRequest === weatherRequest)
                this._activeWeatherRequest = null;

            weatherResult = {
                completed: true,
                error: error || null,
                data: error ? null : data,
            };
            maybeComplete();
        };

        providerRequest = OpenMeteoProvider.fetchForecastAsync(
            locationResult.coordinates,
            {
                forecastDays: requestDays,
                timeoutSeconds: 15,
            },
            providerCallback
        );
        weatherRequest = OpenMeteoWeatherProvider.fetchForecastAsync(
            locationResult.coordinates,
            {
                forecastDays: requestDays,
                timeoutSeconds: 15,
            },
            weatherCallback
        );

        this._activeProviderRequest = providerCompleted ? null : providerRequest;
        this._activeWeatherRequest = weatherCompleted ? null : weatherRequest;
    }

    _coordinateKey(coordinates) {
        if (!coordinates)
            return null;

        const latitude = Number(coordinates.latitude);
        const longitude = Number(coordinates.longitude);

        if (!_isFiniteNumber(latitude) || !_isFiniteNumber(longitude))
            return null;

        return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    }

    _isCachedPlaceForCoordinates(place, coordinates) {
        if (!place || !place.coordinates || !coordinates)
            return false;

        return Math.abs(place.coordinates.latitude - coordinates.latitude) <= PLACE_COORDINATE_TOLERANCE &&
            Math.abs(place.coordinates.longitude - coordinates.longitude) <= PLACE_COORDINATE_TOLERANCE;
    }

    _cachedPlaceIsFresh(envelope) {
        if (!envelope || !_isFiniteNumber(envelope.savedAt))
            return false;

        return _nowMs() - envelope.savedAt <= PLACE_CACHE_MAX_AGE_MS;
    }

    _ensureLocationDisplayName(locationResult) {
        if (!locationResult || !locationResult.coordinates)
            return;

        const coordinates = locationResult.coordinates;
        const cachedPlace = this._cache.readPlace();

        if (cachedPlace && this._isCachedPlaceForCoordinates(cachedPlace.data, coordinates)) {
            this._locationDisplayName = cachedPlace.data.name;
            this._locationDisplayStatus = 'ready';

            if (this._cachedPlaceIsFresh(cachedPlace))
                return;
        }

        const key = this._coordinateKey(coordinates);

        if (key === null || this._activeReverseGeocodeKey === key)
            return;

        if (this._activeReverseGeocodeRequest)
            this._activeReverseGeocodeRequest.cancel();

        this._locationDisplayStatus = this._locationDisplayName === null
            ? 'loading'
            : 'refreshing';
        this._activeReverseGeocodeKey = key;
        this._activeReverseGeocodeRequest = ReverseGeocoder.fetchPlaceNameAsync(
            coordinates,
            {
                language: GLib.getenv('LANG') || null,
                timeoutSeconds: 10,
            },
            (error, place) => {
                if (this._activeReverseGeocodeKey === key) {
                    this._activeReverseGeocodeRequest = null;
                    this._activeReverseGeocodeKey = null;
                }

                const currentLocationKey = this._lastLocationResult
                    ? this._coordinateKey(this._lastLocationResult.coordinates)
                    : null;

                if (this._destroyed || currentLocationKey !== key)
                    return;

                if (error || !place) {
                    this._logError(error || new Error('Place name unavailable'));
                    this._locationDisplayStatus = this._locationDisplayName === null
                        ? 'unavailable'
                        : 'ready';
                    this._rebuildMenu();
                    return;
                }

                const cachePlace = {
                    provider: place.provider,
                    name: place.name,
                    primaryName: place.primaryName,
                    secondaryName: place.secondaryName,
                    country: place.country,
                    coordinates: {
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                    },
                    fetchedAt: place.fetchedAt,
                };

                this._cache.writePlace(cachePlace);
                this._locationDisplayName = place.name;
                this._locationDisplayStatus = 'ready';
                this._rebuildMenu();
            }
        );
    }

    _useCachedResponse(error) {
        const envelope = this._cache.readResponse();

        if (!envelope) {
            this._providerData = null;
            this._currentRisk = null;
            this._usingStaleData = false;
            this._isRefreshing = false;
            this._setError(error);
            this._updatePanel(_('Unavailable'));
            return;
        }

        this._applyProviderData(envelope.data, true, error);
    }

    _applyProviderData(data, usingStaleData, error = null) {
        this._providerData = data;
        this._usingStaleData = usingStaleData || this._isDataOld(data);
        this._lastError = error;
        this._isRefreshing = false;

        if (!this._lastLocationResult) {
            const providerLocationResult = this._locationResultFromProviderData(data);

            if (providerLocationResult !== null)
                this._lastLocationResult = providerLocationResult;
        }

        if (error)
            this._logError(error);

        this._currentRisk = RiskCalculator.calculateRisk(
            data.current.readings,
            data.current.moldPotential
        );

        if (!this._usingStaleData)
            this._maybeNotifyRiskChange(this._currentRisk);

        this._updatePanel();
        this._rebuildMenu();

        if (this._lastLocationResult)
            this._ensureLocationDisplayName(this._lastLocationResult);
    }

    _isDataOld(data) {
        if (!data || !_isFiniteNumber(data.fetchedAt))
            return true;

        return Formatter.isStale(
            data.fetchedAt,
            _nowMs(),
            this.refreshIntervalMinutes * DATA_STALE_FACTOR
        );
    }

    _logError(error) {
        if (!error)
            return;

        if (typeof global !== 'undefined' && typeof global.logError === 'function')
            global.logError(error);
    }

    _formatVisibleError() {
        if (this._providerData)
            return _('Unable to refresh environmental data; showing cached data.');

        return _('Unable to refresh environmental data.');
    }

    _updatePanel(forcedLabel = null) {
        if (forcedLabel !== null) {
            this._setPanelIconColor(null);
            this.set_applet_label(this.showPanelText ? forcedLabel : '');
            this.set_applet_tooltip(forcedLabel);
            return;
        }

        if (!this._currentRisk) {
            this._setPanelIconColor(null);
            this.set_applet_label(this.showPanelText ? _('Loading') : '');
            this.set_applet_tooltip(_('AirAware: loading environmental conditions'));
            return;
        }

        this._setPanelIconColor(this._currentRisk.category);
        const category = Formatter.formatCategory(this._currentRisk.category);
        const staleMarker = this._usingStaleData ? '*' : '';
        const panelLabel = this.showPanelText ? `${category}${staleMarker}` : '';

        this.set_applet_label(panelLabel);
        const tooltipTemplate = this._usingStaleData
            ? _('{category} (stale data)')
            : _('{category}');

        this.set_applet_tooltip(_replace(tooltipTemplate, {
            category,
        }));
    }

    _setPanelIconColor(category) {
        if (!this._applet_icon)
            return;

        const categoryId = category && typeof category.id === 'string'
            ? category.id
            : 'unavailable';
        const iconPath = this._panelIconPaths[categoryId] ||
            this._panelIconPaths.unavailable;

        if (this._panelIconColorId === categoryId)
            return;

        this.set_applet_icon_path(iconPath);
        this._panelIconColorId = categoryId;
    }

    _buildPanelIconPaths(basePath) {
        const iconDirectory = GLib.build_filenamev([basePath, 'icons']);

        return {
            low: GLib.build_filenamev([iconDirectory, 'airaware-low.svg']),
            moderate: GLib.build_filenamev([iconDirectory, 'airaware-moderate.svg']),
            high: GLib.build_filenamev([iconDirectory, 'airaware-high.svg']),
            'very-high': GLib.build_filenamev([iconDirectory, 'airaware-very-high.svg']),
            unavailable: GLib.build_filenamev([iconDirectory, 'airaware-unavailable.svg']),
        };
    }

    _maybeNotifyRiskChange(risk) {
        const categoryId = risk.category.id;
        const previousCategoryId = this._lastFreshCategoryId;

        this._lastFreshCategoryId = categoryId;

        if (previousCategoryId === null || previousCategoryId === categoryId)
            return;

        if (!NotificationPolicy.shouldNotifyRiskChange(
            previousCategoryId,
            categoryId,
            this.notificationLevel
        ))
            return;

        this._sendRiskNotification(
            risk,
            _('Environmental allergy burden is now {category}.')
        );
    }

    _sendRiskNotification(risk, messageTemplate) {
        Main.notify(
            _('AirAware'),
            _replace(messageTemplate, {
                category: Formatter.formatCategory(risk.category),
            })
        );
    }

    _sendTestNotification() {
        this._sendRiskNotification(
            {
                category: RiskCalculator.categoryFromScore(70),
            },
            _('Test notification: environmental allergy burden is {category}.')
        );
    }

    _rebuildMenu() {
        this.menu.removeAll();

        this._addHeader();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (!this._providerData || !this._currentRisk) {
            this._addEmptyState();
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._addRefreshAction();
            return;
        }

        this._addCurrentSection();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addForecastSection();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addLegendSection();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addRefreshAction();
    }

    _addHeader() {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const box = new St.BoxLayout({
            vertical: true,
        });
        const title = new St.Label({
            text: _('AirAware'),
            style_class: 'airaware-title',
        });
        const subtitle = new St.Label({
            text: _('Environmental pollen, air pollution, and mold potential burden'),
            style_class: 'airaware-subtitle',
        });

        title.clutter_text.line_wrap = true;
        subtitle.clutter_text.line_wrap = true;
        box.add(title);
        box.add(subtitle);
        item.addActor(box);
        this.menu.addMenuItem(item);
    }

    _addEmptyState() {
        const message = this._lastError
            ? this._formatVisibleError()
            : _('Waiting for environmental data');

        this._addTextBlock(message, 'airaware-muted');
    }

    _addCurrentSection() {
        const current = this._providerData.current.readings;
        const risk = this._currentRisk;

        this._addSectionTitle(_('Current environmental allergy risk'));
        this._addScoreSummary(risk);
        this._addInfoRow(_('Tree pollen'), Formatter.formatPollen(current.treePollen));
        this._addInfoRow(_('Grass pollen'), Formatter.formatPollen(current.grassPollen));
        this._addInfoRow(_('Weed pollen'), Formatter.formatPollen(current.weedPollen));
        this._addInfoRow(
            _('Mold potential'),
            Formatter.formatMoldPotential(this._providerData.current.moldPotential)
        );
        this._addInfoRow(_('PM2.5'), Formatter.formatPollutant(current.pm25));
        this._addInfoRow(_('PM10'), Formatter.formatPollutant(current.pm10));
        this._addInfoRow(_('NO₂'), Formatter.formatPollutant(current.nitrogenDioxide));
        this._addInfoRow(_('O₃'), Formatter.formatPollutant(current.ozone));
        this._addInfoRow(
            _('SO₂'),
            Formatter.formatSulfurDioxide(current.sulfurDioxide)
        );
        this._addInfoRow(_('CO'), Formatter.formatCarbonMonoxide(current.carbonMonoxide));
        this._addInfoRow(_('Dust'), Formatter.formatPollutant(current.dust));
        this._addInfoRow(
            _('Aerosol optical depth'),
            Formatter.formatAerosolOpticalDepth(current.aerosolOpticalDepth)
        );
        this._addInfoRow(_('Last update'), Formatter.formatTimestamp(this._providerData.fetchedAt));

        if (this._lastError)
            this._addTextBlock(this._formatVisibleError(), 'airaware-muted');
    }

    _formatLocationLabel() {
        if (typeof this._locationDisplayName === 'string' &&
            this._locationDisplayName.trim() !== '')
            return this._locationDisplayName;

        if (this._locationDisplayStatus === 'loading' ||
            this._locationDisplayStatus === 'refreshing')
            return _('Resolving location');

        if (this._locationDisplayStatus === 'unavailable')
            return _('Place name unavailable');

        if (this._lastLocationResult && this._lastLocationResult.coordinates) {
            const coordinates = this._lastLocationResult.coordinates;

            return `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
        }

        if (this._providerData &&
            _isFiniteNumber(this._providerData.latitude) &&
            _isFiniteNumber(this._providerData.longitude))
            return `${this._providerData.latitude.toFixed(4)}, ${this._providerData.longitude.toFixed(4)}`;

        return _('Unknown');
    }

    _addForecastSection() {
        const requestedDays = this.forecastLength + 1;
        const days = this._providerData.forecast.slice(0, requestedDays);

        if (days.length === 0) {
            this._addSectionTitle(_('Forecast'));
            this._addTextBlock(_('Forecast unavailable'), 'airaware-muted');
            return;
        }

        this._addSectionTitle(_('Forecast'));

        if (days.length < requestedDays) {
            this._addTextBlock(_replace(_('Only {days} forecast days are currently available from the data source.'), {
                days: days.length,
            }), 'airaware-muted');
        }

        for (let index = 0; index < days.length; index++) {
            const day = days[index];
            const risk = RiskCalculator.calculateRisk(day.readings, day.moldPotential);
            const label = this._formatForecastDayLabel(day, index);
            const value = this._formatForecastValue(risk);

            this._addInfoRow(label, value);
        }
    }

    _formatForecastValue(risk) {
        const replacements = {
            category: Formatter.formatCategory(risk.category),
            score: Formatter.formatScore(risk.score),
        };

        return risk.isPartial
            ? _replace(_('{category} ({score}, partial)'), replacements)
            : _replace(_('{category} ({score})'), replacements);
    }

    _formatForecastDayLabel(day, index) {
        if (index === 0)
            return _('Today');

        if (index === 1)
            return _('Tomorrow');

        return _formatWeekdayLabel(day.date);
    }

    _addLegendSection() {
        this._addSectionTitle(_('Legend'));
        this._addTextBlock(
            _('Score blends highest pollen burden (50%), particulates (25%), gases and atmospheric irritants (10%), and mold potential (15%). Environmental conditions only; not a medical symptom prediction.'),
            'airaware-muted airaware-legend'
        );
    }

    _addRefreshAction() {
        const label = this._isRefreshing
            ? _('Refreshing...')
            : _('Refresh now');
        const refreshItem = new PopupMenu.PopupIconMenuItem(
            label,
            'xsi-view-refresh',
            St.IconType.SYMBOLIC
        );

        refreshItem.connect('activate', () => {
            this._refreshData(true);
        });
        this.menu.addMenuItem(refreshItem);
    }

    _addSectionTitle(text) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const label = new St.Label({
            text,
            style_class: 'airaware-title',
        });

        label.clutter_text.line_wrap = true;
        item.addActor(label);
        this.menu.addMenuItem(item);
    }

    _addTextBlock(text, styleClass) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const label = new St.Label({
            text,
            style_class: styleClass,
        });

        label.clutter_text.line_wrap = true;
        item.addActor(label);
        this.menu.addMenuItem(item);
    }

    _addScoreSummary(risk) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'airaware-score-summary',
        });
        const topRow = new St.BoxLayout({
            style_class: 'airaware-score-top-row',
        });
        const score = new St.Label({
            text: Formatter.formatScore(risk.score),
            style_class: 'airaware-score-value',
        });
        const category = new St.Label({
            text: Formatter.formatCategory(risk.category),
            style_class: 'airaware-score-category',
        });
        const location = new St.Label({
            text: this._formatLocationLabel(),
            style_class: 'airaware-score-place',
        });

        score.clutter_text.line_wrap = true;
        category.clutter_text.line_wrap = true;
        location.clutter_text.line_wrap = true;
        topRow.add(score);
        topRow.add(location);
        box.add(topRow);
        box.add(category);
        item.addActor(box);
        this.menu.addMenuItem(item);
    }

    _addInfoRow(label, value) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const box = new St.BoxLayout({
            style_class: 'airaware-row',
        });
        const labelActor = new St.Label({
            text: label,
            style_class: 'airaware-row-label',
        });
        const valueActor = new St.Label({
            text: value,
            style_class: 'airaware-row-value',
        });

        labelActor.clutter_text.line_wrap = true;
        valueActor.clutter_text.line_wrap = true;
        box.add(labelActor);
        box.add(valueActor);
        item.addActor(box);
        this.menu.addMenuItem(item);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    _uuid = metadata.uuid || DEFAULT_UUID;
    Gettext.bindtextdomain(_uuid, GLib.build_filenamev([
        GLib.get_home_dir(),
        '.local',
        'share',
        'locale',
    ]));

    return new AirAwareApplet(metadata, orientation, panelHeight, instanceId);
}
