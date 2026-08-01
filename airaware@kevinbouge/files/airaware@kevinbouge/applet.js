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
let OpenStreetMapVegetationProvider = null;
let PersonalAllergyProfile = null;
let PersonalizedRiskCalculator = null;
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
    OpenStreetMapVegetationProvider = imports.openStreetMapVegetationProvider;
    PersonalAllergyProfile = imports.personalAllergyProfile;
    PersonalizedRiskCalculator = imports.personalizedRiskCalculator;
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
        this._activeVegetationRequest = null;
        this._activeReverseGeocodeRequest = null;
        this._activeReverseGeocodeKey = null;
        this._refreshGeneration = 0;
        this._providerData = null;
        this._currentRisk = null;
        this._personalizedRisk = null;
        this._locationDisplayName = null;
        this._locationDisplayStatus = 'unknown';
        this._lastFreshNotificationCategoryId = null;
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
        this.showPollenInPopup = true;
        this.showRegulatedPollutionInPopup = true;
        this.showAtmosphericIrritantsInPopup = true;
        this.showMoldInPopup = true;
        this.enableVegetationContext = true;
        this.showVegetationInPopup = false;
        this.vegetationRadiusMeters = 2000;
        this.enablePersonalizedRisk = false;
        this.panelScoreMode = 'environmental';
        this.showPersonalizedRiskInPopup = true;
        this.usePersonalizedNotifications = false;
        this.profilePollenAlder = true;
        this.profilePollenBirch = true;
        this.profilePollenGrass = true;
        this.profilePollenMugwort = true;
        this.profilePollenOlive = true;
        this.profilePollenRagweed = true;
        this.profileMold = true;
        this.profilePm25 = true;
        this.profilePm10 = true;
        this.profileNitrogenDioxide = true;
        this.profileOzone = true;
        this.profileSulphurDioxide = true;
        this.profileDust = true;
        this.profileWildfirePm10 = true;
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
        this.settings.bind('panel-score-mode', 'panelScoreMode',
            () => this._onSettingsChanged());
        this.settings.bind('show-pollen-in-popup', 'showPollenInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('show-regulated-pollution-in-popup', 'showRegulatedPollutionInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('show-atmospheric-irritants-in-popup', 'showAtmosphericIrritantsInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('show-mold-in-popup', 'showMoldInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('notification-level', 'notificationLevel',
            () => this._onSettingsChanged());
        this.settings.bind('use-personalized-notifications', 'usePersonalizedNotifications',
            () => this._onSettingsChanged());
        this.settings.bind('enable-vegetation-context', 'enableVegetationContext',
            () => this._onSettingsChanged());
        this.settings.bind('show-vegetation-in-popup', 'showVegetationInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('vegetation-radius', 'vegetationRadiusMeters',
            () => this._onSettingsChanged());
        this.settings.bind('enable-personalized-risk', 'enablePersonalizedRisk',
            () => this._onSettingsChanged());
        this.settings.bind('show-personalized-risk-in-popup', 'showPersonalizedRiskInPopup',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-alder', 'profilePollenAlder',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-birch', 'profilePollenBirch',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-grass', 'profilePollenGrass',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-mugwort', 'profilePollenMugwort',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-olive', 'profilePollenOlive',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pollen-ragweed', 'profilePollenRagweed',
            () => this._onSettingsChanged());
        this.settings.bind('profile-mold', 'profileMold',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pm25', 'profilePm25',
            () => this._onSettingsChanged());
        this.settings.bind('profile-pm10', 'profilePm10',
            () => this._onSettingsChanged());
        this.settings.bind('profile-nitrogen-dioxide', 'profileNitrogenDioxide',
            () => this._onSettingsChanged());
        this.settings.bind('profile-ozone', 'profileOzone',
            () => this._onSettingsChanged());
        this.settings.bind('profile-sulphur-dioxide', 'profileSulphurDioxide',
            () => this._onSettingsChanged());
        this.settings.bind('profile-dust', 'profileDust',
            () => this._onSettingsChanged());
        this.settings.bind('profile-wildfire-pm10', 'profileWildfirePm10',
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
        this.panelScoreMode = this._normalizePanelScoreMode(this.panelScoreMode);
        this.vegetationRadiusMeters = this._normalizeVegetationRadius(
            this.vegetationRadiusMeters
        );
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

        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }
    }

    _onSettingsChanged() {
        if (this._destroyed)
            return;

        this.refreshIntervalMinutes = this._normalizeRefreshInterval(
            this.refreshIntervalMinutes
        );
        this.forecastLength = 3;
        this.locationMode = this._normalizeLocationMode(this.locationMode);
        this.panelScoreMode = this._normalizePanelScoreMode(this.panelScoreMode);
        this.vegetationRadiusMeters = this._normalizeVegetationRadius(
            this.vegetationRadiusMeters
        );
        this._recalculatePersonalizedRisk();

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

    _normalizePanelScoreMode(value) {
        return value === 'personalized' ? 'personalized' : 'environmental';
    }

    _normalizeVegetationRadius(value) {
        const allowed = [1000, 2000, 5000];
        const numericValue = Number(value);

        if (allowed.indexOf(numericValue) !== -1)
            return numericValue;

        return 2000;
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

    _personalProfileFromSettings() {
        return PersonalAllergyProfile.profileFromSettings(this);
    }

    _recalculatePersonalizedRisk() {
        if (!this.enablePersonalizedRisk ||
            !this._providerData ||
            !this._providerData.current) {
            this._personalizedRisk = null;
            return;
        }

        this._personalizedRisk = PersonalizedRiskCalculator.calculatePersonalizedRisk(
            this._providerData.current,
            this._providerData.current.moldPotential,
            this._personalProfileFromSettings()
        );
    }

    _panelRiskState() {
        const environmental = this._currentRisk;

        if (!environmental)
            return null;

        if (this.enablePersonalizedRisk &&
            this.panelScoreMode === 'personalized') {
            if (this._personalizedRisk &&
                this._personalizedRisk.available === true) {
                return {
                    risk: this._personalizedRisk,
                    mode: 'personalized',
                };
            }

            return {
                risk: environmental,
                mode: 'fallback',
            };
        }

        return {
            risk: environmental,
            mode: 'environmental',
        };
    }

    _manualLocationResultFromSettings(source = 'manual') {
        const coordinates = this._manualCoordinatesFromSettings();

        if (coordinates === null)
            return null;

        this._cache.writeCoordinatesAsync(coordinates);

        return {
            coordinates,
            updatedAt: _nowMs(),
            source,
            isStale: false,
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

        if (this._activeVegetationRequest) {
            this._activeVegetationRequest.cancel();
            this._activeVegetationRequest = null;
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
            this._fetchProviderData(
                this._lastLocationResult,
                refreshGeneration,
                forceLocationRefresh
            );
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
                    this._fetchProviderData(
                        manualFallback,
                        refreshGeneration,
                        forceLocationRefresh
                    );
                    return;
                }

                this._useCachedResponse(error || new Error('Location unavailable'));
                return;
            }

            this._lastLocationResult = locationResult;
            this._ensureLocationDisplayName(locationResult);
            this._fetchProviderData(
                locationResult,
                refreshGeneration,
                forceLocationRefresh
            );
        };

        locationRequest = forceLocationRefresh
            ? this._locationService.refreshLocationAsync(locationOptions, locationCallback)
            : this._locationService.getLocationAsync(locationOptions, locationCallback);

        this._activeLocationRequest = locationCompleted ? null : locationRequest;
    }

    _fetchProviderData(locationResult, refreshGeneration, forceAllSources = false) {
        const requestDays = this.forecastLength + 1;
        const vegetationCacheKey = this._vegetationCacheKeyForLocation(locationResult);

        this._cache.readResponseAsync((cacheError, cachedEnvelope) => {
            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            if (cacheError)
                this._logError(cacheError);

            const cachedData = cachedEnvelope ? cachedEnvelope.data : null;
            this._readVegetationCache(vegetationCacheKey, (vegetationEnvelope) => {
                if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                    return;

                this._startProviderRequests({
                    locationResult,
                    refreshGeneration,
                    requestDays,
                    cachedData,
                    vegetationEnvelope,
                    vegetationCacheKey,
                    forceAllSources,
                });
            });
        });
    }

    _readVegetationCache(cacheKey, callback) {
        if (!this.enableVegetationContext || cacheKey === null) {
            callback(null);
            return;
        }

        this._cache.readVegetationAsync(cacheKey, (error, envelope) => {
            if (error)
                this._logError(error);

            callback(envelope || null);
        });
    }

    _vegetationCacheKeyForLocation(locationResult) {
        if (!this.enableVegetationContext || !locationResult || !locationResult.coordinates)
            return null;

        try {
            return OpenStreetMapVegetationProvider.vegetationCacheKey(
                locationResult.coordinates,
                this.vegetationRadiusMeters
            );
        } catch (error) {
            this._logError(error);
            return null;
        }
    }

    _startProviderRequests(options) {
        const locationResult = options.locationResult;
        const refreshGeneration = options.refreshGeneration;
        const requestDays = options.requestDays;
        const cachedData = options.cachedData;
        const vegetationEnvelope = options.vegetationEnvelope;
        const cachedVegetationData = vegetationEnvelope ? vegetationEnvelope.data : null;
        const cachedVegetationFresh = OpenStreetMapVegetationProvider.isVegetationCacheFresh(
            vegetationEnvelope
        );
        const shouldFetchVegetation = this.enableVegetationContext &&
            options.vegetationCacheKey !== null &&
            (options.forceAllSources || !cachedVegetationData || !cachedVegetationFresh);
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
        let vegetationResult = {
            completed: !shouldFetchVegetation,
            error: null,
            data: shouldFetchVegetation ? null : cachedVegetationData,
            stale: !shouldFetchVegetation && cachedVegetationData !== null && !cachedVegetationFresh,
            fromCache: !shouldFetchVegetation && cachedVegetationData !== null,
        };
        let providerRequest = null;
        let providerCompleted = false;
        let weatherRequest = null;
        let weatherCompleted = false;
        let vegetationRequest = null;
        let vegetationCompleted = !shouldFetchVegetation;
        const maybeComplete = () => {
            if (!airQualityResult.completed ||
                !weatherResult.completed ||
                !vegetationResult.completed)
                return;

            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            const freshVegetationData = vegetationResult.error || vegetationResult.fromCache
                ? null
                : vegetationResult.data;
            const fallbackVegetationData = vegetationResult.fromCache || vegetationResult.error
                ? cachedVegetationData
                : null;
            const combinedData = EnvironmentAssembler.combineEnvironmentalData({
                airQualityData: airQualityResult.error ? null : airQualityResult.data,
                weatherData: weatherResult.error ? null : weatherResult.data,
                cachedData,
                vegetationData: freshVegetationData,
                cachedVegetationData: fallbackVegetationData,
                vegetationIsStale: vegetationResult.error ||
                    vegetationResult.stale === true ||
                    (cachedVegetationData !== null && !cachedVegetationFresh),
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

            if (vegetationResult.error)
                this._logError(vegetationResult.error);

            this._cache.writeResponseAsync(combinedData);
            this._applyProviderData(
                combinedData,
                combinedData.usedCachedAirQuality === true ||
                    combinedData.usedCachedWeather === true,
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
        const vegetationCallback = (error, data) => {
            vegetationCompleted = true;

            if (this._activeVegetationRequest === vegetationRequest)
                this._activeVegetationRequest = null;

            vegetationResult = {
                completed: true,
                error: error || null,
                data: error ? cachedVegetationData : data,
                stale: error ? cachedVegetationData !== null : false,
                fromCache: error && cachedVegetationData !== null,
            };

            if (!error && data) {
                this._cache.writeVegetationAsync(data, (cacheWriteError, result) => {
                    if (cacheWriteError)
                        this._logError(cacheWriteError);
                    else if (result && result.ok === false)
                        this._logError(new Error(result.error || 'Vegetation cache write failed'));
                });
            }

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

        if (shouldFetchVegetation) {
            vegetationRequest = OpenStreetMapVegetationProvider.fetchVegetationAsync(
                locationResult.coordinates,
                {
                    radiusMeters: this.vegetationRadiusMeters,
                    timeoutSeconds: 20,
                },
                vegetationCallback
            );
        }

        this._activeProviderRequest = providerCompleted ? null : providerRequest;
        this._activeWeatherRequest = weatherCompleted ? null : weatherRequest;
        this._activeVegetationRequest = vegetationCompleted ? null : vegetationRequest;

        maybeComplete();
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
        const key = this._coordinateKey(coordinates);

        if (key === null)
            return;

        this._cache.readPlaceAsync((cacheError, cachedPlace) => {
            if (this._destroyed)
                return;

            const currentLocationKey = this._lastLocationResult
                ? this._coordinateKey(this._lastLocationResult.coordinates)
                : null;

            if (currentLocationKey !== key)
                return;

            if (cacheError)
                this._logError(cacheError);

            if (cachedPlace && this._isCachedPlaceForCoordinates(cachedPlace.data, coordinates)) {
                this._locationDisplayName = cachedPlace.data.name;
                this._locationDisplayStatus = 'ready';

                if (this._cachedPlaceIsFresh(cachedPlace)) {
                    this._rebuildMenu();
                    return;
                }
            }

            this._startReverseGeocode(coordinates, key);
        });
    }

    _startReverseGeocode(coordinates, key) {
        if (this._activeReverseGeocodeKey === key)
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

                this._cache.writePlaceAsync(cachePlace);
                this._locationDisplayName = place.name;
                this._locationDisplayStatus = 'ready';
                this._rebuildMenu();
            }
        );
    }

    _useCachedResponse(error, refreshGeneration = this._refreshGeneration) {
        this._cache.readResponseAsync((cacheError, envelope) => {
            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            if (cacheError)
                this._logError(cacheError);

            if (!envelope) {
                this._providerData = null;
                this._currentRisk = null;
                this._personalizedRisk = null;
                this._usingStaleData = false;
                this._isRefreshing = false;
                this._setError(error);
                this._updatePanel(_('Unavailable'));
                return;
            }

            this._applyProviderData(envelope.data, true, error);
        });
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
            data.current,
            data.current.moldPotential
        );
        this._recalculatePersonalizedRisk();

        if (!this._usingStaleData)
            this._maybeNotifyRiskChange(this._currentRisk, this._personalizedRisk);

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

        const panelState = this._panelRiskState();
        const panelRisk = panelState.risk;

        this._setPanelIconColor(panelRisk.category);
        const category = Formatter.formatCategory(panelRisk.category);
        const staleMarker = this._usingStaleData ? '*' : '';
        const panelLabel = this.showPanelText ? `${category}${staleMarker}` : '';

        this.set_applet_label(panelLabel);
        this.set_applet_tooltip(Formatter.formatPersonalizedTooltip(
            panelRisk,
            panelState.mode,
            this._usingStaleData
        ));
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

    _notificationRiskState(environmentalRisk, personalizedRisk) {
        if (this.enablePersonalizedRisk &&
            this.usePersonalizedNotifications &&
            personalizedRisk &&
            personalizedRisk.available === true) {
            return {
                risk: personalizedRisk,
                personalized: true,
            };
        }

        return {
            risk: environmentalRisk,
            personalized: false,
        };
    }

    _maybeNotifyRiskChange(environmentalRisk, personalizedRisk) {
        const state = this._notificationRiskState(environmentalRisk, personalizedRisk);
        const categoryId = state.risk.category.id;
        const previousCategoryId = this._lastFreshNotificationCategoryId;

        this._lastFreshNotificationCategoryId = categoryId;

        if (previousCategoryId === null || previousCategoryId === categoryId)
            return;

        if (!NotificationPolicy.shouldNotifyRiskChange(
            previousCategoryId,
            categoryId,
            this.notificationLevel
        ))
            return;

        this._sendRiskNotification(
            state.risk,
            state.personalized
                ? _('Personalized environmental risk is now {category}.')
                : _('Environmental allergy burden is now {category}.')
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
        const current = this._providerData.current;
        const rawPollutants = current.rawPollutants || {};
        const pollutantAqi = current.pollutantAqi || {};
        const pollen = current.pollen || {};
        const context = current.context || {};
        const risk = this._currentRisk;

        this._addSectionTitle(_('Environmental burden'));
        this._addScoreSummary(risk);
        this._addPersonalizedRiskSection();

        if (this.showPollenInPopup) {
            this._addSectionTitle(_('Pollen'));
            this._addPollenRows(pollen);
        }

        if (this.showRegulatedPollutionInPopup) {
            this._addSectionTitle(_('Regulated pollution'));
            this._addPollutantAqiRow(_('PM2.5'), rawPollutants.pm25, pollutantAqi.pm25, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('PM10'), rawPollutants.pm10, pollutantAqi.pm10, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('NO₂'), rawPollutants.nitrogenDioxide, pollutantAqi.nitrogenDioxide, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('O₃'), rawPollutants.ozone, pollutantAqi.ozone, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('SO₂'), rawPollutants.sulfurDioxide, pollutantAqi.sulfurDioxide, current.pollutantAqiLabel);
        }

        if (this.showAtmosphericIrritantsInPopup) {
            this._addSectionTitle(_('Atmospheric irritants'));
            this._addInfoRow(_('CO'), Formatter.formatCarbonMonoxide(rawPollutants.carbonMonoxide));

            this._addInfoRow(_('Dust'), Formatter.formatPollutant(context.dust));
            if (_isFiniteNumber(context.wildfirePm10))
                this._addInfoRow(_('Wildfire-related PM10'), Formatter.formatPollutant(context.wildfirePm10));
            this._addInfoRow(
                _('Aerosol optical depth'),
                Formatter.formatAerosolOpticalDepth(context.aerosolOpticalDepth)
            );
        }

        if (this.showMoldInPopup) {
            this._addSectionTitle(_('Mold'));
            this._addInfoRow(
                _('Mold potential'),
                Formatter.formatMoldPotential(current.moldPotential)
            );
        }

        this._addVegetationSection();

        this._addInfoRow(_('Last update'), Formatter.formatTimestamp(this._providerData.fetchedAt));

        if (this._lastError)
            this._addTextBlock(this._formatVisibleError(), 'airaware-muted');
    }

    _addPollenRows(pollen) {
        const fields = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
        let added = false;

        for (const field of fields) {
            if (!_isFiniteNumber(pollen[field]))
                continue;

            this._addInfoRow(
                Formatter.formatPollenTypeLabel(field),
                Formatter.formatPollen(pollen[field])
            );
            added = true;
        }

        if (!added)
            this._addTextBlock(_('Pollen data unavailable'), 'airaware-muted');
    }

    _addPersonalizedRiskSection() {
        if (!this.enablePersonalizedRisk ||
            !this.showPersonalizedRiskInPopup ||
            !this._personalizedRisk)
            return;

        this._addSectionTitle(_('Personalized risk'));

        if (this._personalizedRisk.available !== true) {
            if (this._personalizedRisk.reason === 'no_factors_selected') {
                this._addTextBlock(
                    _('Select at least one factor in the Personal Allergy Profile.'),
                    'airaware-muted'
                );
            } else {
                this._addTextBlock(_('Personalized risk unavailable'), 'airaware-muted');
            }

            return;
        }

        this._addScoreSummary(this._personalizedRisk, {
            showLocation: false,
        });

        if (this._personalizedRisk.missingFactorCount > 0) {
            this._addTextBlock(
                Formatter.formatMissingSelectedFactorCount(
                    this._personalizedRisk.missingFactorCount
                ),
                'airaware-muted'
            );
        }
    }

    _addVegetationSection() {
        if (!this.enableVegetationContext ||
            !this.showVegetationInPopup ||
            !this._providerData ||
            !this._providerData.vegetation)
            return;

        const vegetation = this._providerData.vegetation;
        const categoryOrder = [
            'grassland',
            'parkland',
            'woodland',
            'orchard',
            'scrub',
            'farmland',
        ];
        const taxonOrder = ['birch', 'alder', 'olive'];
        let rows = [];

        for (const categoryId of categoryOrder) {
            const category = vegetation.categories
                ? vegetation.categories[categoryId]
                : null;

            if (!category || category.present !== true ||
                !_isFiniteNumber(category.nearestMeters))
                continue;

            rows.push({
                label: Formatter.formatVegetationCategoryLabel(categoryId),
                value: Formatter.formatDistanceMeters(category.nearestMeters),
                distance: category.nearestMeters,
            });
        }

        rows.sort((left, right) => left.distance - right.distance);

        for (const taxonId of taxonOrder) {
            const taxon = vegetation.mappedTaxa
                ? vegetation.mappedTaxa[taxonId]
                : null;

            if (!taxon || !_isFiniteNumber(taxon.featureCount) || taxon.featureCount <= 0)
                continue;

            rows.push({
                label: Formatter.formatMappedTaxonLabel(taxonId),
                value: `${Math.round(taxon.featureCount)}`,
                distance: null,
            });
        }

        this._addSectionTitle(_('Nearby vegetation'));

        if (rows.length === 0) {
            this._addTextBlock(
                _('No nearby vegetation features were found in OpenStreetMap.'),
                'airaware-muted'
            );
        } else {
            for (const row of rows)
                this._addInfoRow(row.label, row.value);
        }

        if (this._providerData.vegetationStatus === 'stale')
            this._addTextBlock(_('Showing cached OpenStreetMap vegetation context.'), 'airaware-muted');

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
            const risk = RiskCalculator.calculateRisk(day, day.moldPotential);
            const label = this._formatForecastDayLabel(day, index);
            const value = this._formatForecastValue(risk);

            this._addInfoRow(label, value);
        }
    }

    _formatForecastValue(risk) {
        return _replace(_('{category} ({score})'), {
            category: Formatter.formatCategory(risk.category),
            score: Formatter.formatScore(risk.score),
        });
    }

    _formatForecastDayLabel(day, index) {
        if (index === 0)
            return _('Today');

        if (index === 1)
            return _('Tomorrow');

        return _formatWeekdayLabel(day.date);
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

    _addScoreSummary(risk, options = {}) {
        const showLocation = options.showLocation !== false;
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

        score.clutter_text.line_wrap = true;
        category.clutter_text.line_wrap = true;
        topRow.add(score);

        if (showLocation) {
            const location = new St.Label({
                text: this._formatLocationLabel(),
                style_class: 'airaware-score-place',
            });

            location.clutter_text.line_wrap = true;
            topRow.add(location);
        }

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

    _addPollutantAqiRow(label, rawValue, aqiValue, aqiSourceLabel) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const box = new St.BoxLayout({
            style_class: 'airaware-pollutant-row',
        });
        const labelActor = new St.Label({
            text: label,
            style_class: 'airaware-row-label',
        });
        const rawActor = new St.Label({
            text: Formatter.formatPollutant(rawValue),
            style_class: 'airaware-pollutant-value',
        });
        const aqiActor = new St.Label({
            text: Formatter.formatAqi(aqiValue, aqiSourceLabel),
            style_class: 'airaware-aqi-value',
        });

        labelActor.clutter_text.line_wrap = true;
        rawActor.clutter_text.line_wrap = true;
        aqiActor.clutter_text.line_wrap = false;
        box.add(labelActor);
        box.add(rawActor);
        box.add(aqiActor);
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
