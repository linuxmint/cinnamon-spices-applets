const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
imports.gi.versions.Soup = '3.0';
const Soup = imports.gi.Soup;
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
const MONTH_LABELS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/*
 * TODO roadmap:
 * - manual location search/geocoding
 * - multiple saved locations
 * - multiple providers
 * - custom weighting
 * - graphs
 */

let _uuid = DEFAULT_UUID;
let Cache = null;
let DailySummaryBuilder = null;
let DailySummaryFormatter = null;
let EnvironmentAssembler = null;
let Formatter = null;
let LocationService = null;
let NotificationPolicy = null;
let OpenMeteoProvider = null;
let OpenMeteoWeatherProvider = null;
let OpenStreetMapVegetationProvider = null;
let PersonalAllergyProfile = null;
let PersonalizedForecastCalculator = null;
let PersonalizedRiskCalculator = null;
let ReverseGeocoder = null;
let RiskCalculator = null;

function _(text) {
    return Gettext.dgettext(_uuid, text);
}

function _markDateStringsForExtraction() {
    return [
        _('Sunday'),
        _('Monday'),
        _('Tuesday'),
        _('Wednesday'),
        _('Thursday'),
        _('Friday'),
        _('Saturday'),
        _('January'),
        _('February'),
        _('March'),
        _('April'),
        _('May'),
        _('June'),
        _('July'),
        _('August'),
        _('September'),
        _('October'),
        _('November'),
        _('December'),
        _('{weekday}, {day} {month}'),
    ];
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
    DailySummaryBuilder = imports.dailySummaryBuilder;
    DailySummaryFormatter = imports.dailySummaryFormatter;
    EnvironmentAssembler = imports.environmentAssembler;
    Formatter = imports.formatter;
    LocationService = imports.locationService;
    NotificationPolicy = imports.notificationPolicy;
    OpenMeteoProvider = imports.openMeteoProvider;
    OpenMeteoWeatherProvider = imports.openMeteoWeatherProvider;
    OpenStreetMapVegetationProvider = imports.openStreetMapVegetationProvider;
    PersonalAllergyProfile = imports.personalAllergyProfile;
    PersonalizedForecastCalculator = imports.personalizedForecastCalculator;
    PersonalizedRiskCalculator = imports.personalizedRiskCalculator;
    ReverseGeocoder = imports.reverseGeocoder;
    RiskCalculator = imports.riskCalculator;

    Formatter.setTranslator(_);
    DailySummaryFormatter.setTranslator(_);
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
        this._forecastRisks = [];
        this._personalizedRisk = null;
        this._personalizedForecast = null;
        this._locationDisplayName = null;
        this._locationDisplayStatus = 'unknown';
        this._lastFreshNotificationCategoryId = null;
        this._lastError = null;
        this._usingStaleData = false;
        this._isRefreshing = false;
        this._lastLocationResult = null;
        this._menuTarget = null;
        this._panelIconColorId = null;
        this._panelIconPaths = this._buildPanelIconPaths(metadata.path);

        this.refreshIntervalMinutes = 60;
        this.showPanelText = true;
        this.notificationLevel = 'disabled';
        this.forecastLength = 3;
        this.enableVegetationContext = true;
        this.vegetationRadiusMeters = 2000;
        this.enablePersonalizedRisk = false;
        this.panelScoreMode = 'environmental';
        this.outdoorWindowDurationHours = 2;
        this.usePersonalizedNotifications = false;
        this.dailySummaryScoreMode = 'environmental';
        this.dailySummaryLocationMode = 'place';
        this.popupPollenExpanded = true;
        this.popupRegulatedPollutionExpanded = true;
        this.popupAtmosphericIrritantsExpanded = true;
        this.popupMoldExpanded = true;
        this.popupSunExpanded = false;
        this.popupVegetationExpanded = false;
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
        this.profileCarbonMonoxide = true;
        this.profileAerosolOpticalDepth = true;
        this.profileDust = true;
        this.profileWildfirePm10 = true;
        this.profileUvIndex = false;
        this.locationMode = 'automatic';
        this.manualLatitude = '';
        this.manualLongitude = '';
        this._locationSettingsSignature = null;
        this._personalizedCalculationSignature = null;
        this._refreshIntervalValue = null;
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

        this._httpSession = new Soup.Session();

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
        this.settings.bind('notification-level', 'notificationLevel',
            () => this._onSettingsChanged());
        this.settings.bind('use-personalized-notifications', 'usePersonalizedNotifications',
            () => this._onSettingsChanged());
        this.settings.bind('enable-vegetation-context', 'enableVegetationContext',
            () => this._onSettingsChanged());
        this.settings.bind('vegetation-radius', 'vegetationRadiusMeters',
            () => this._onSettingsChanged());
        this.settings.bind('enable-personalized-risk', 'enablePersonalizedRisk',
            () => this._onSettingsChanged());
        this.settings.bind('outdoor-window-duration', 'outdoorWindowDurationHours',
            () => this._onSettingsChanged());
        this.settings.bind('daily-summary-score', 'dailySummaryScoreMode',
            () => this._onSummarySettingsChanged());
        this.settings.bind('daily-summary-location', 'dailySummaryLocationMode',
            () => this._onSummarySettingsChanged());
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
        this.settings.bind('profile-carbon-monoxide', 'profileCarbonMonoxide',
            () => this._onSettingsChanged());
        this.settings.bind('profile-aerosol-optical-depth', 'profileAerosolOpticalDepth',
            () => this._onSettingsChanged());
        this.settings.bind('profile-dust', 'profileDust',
            () => this._onSettingsChanged());
        this.settings.bind('profile-wildfire-pm10', 'profileWildfirePm10',
            () => this._onSettingsChanged());
        this.settings.bind('profile-uv-index', 'profileUvIndex',
            () => this._onSettingsChanged());
        this.settings.bind('location-mode', 'locationMode',
            () => this._onSettingsChanged());
        this.settings.bind('manual-latitude', 'manualLatitude',
            () => this._onSettingsChanged());
        this.settings.bind('manual-longitude', 'manualLongitude',
            () => this._onSettingsChanged());
        this.settings.bind('popup-pollen-expanded', 'popupPollenExpanded');
        this.settings.bind('popup-regulated-pollution-expanded', 'popupRegulatedPollutionExpanded');
        this.settings.bind('popup-atmospheric-irritants-expanded', 'popupAtmosphericIrritantsExpanded');
        this.settings.bind('popup-mold-expanded', 'popupMoldExpanded');
        this.settings.bind('popup-sun-expanded', 'popupSunExpanded');
        this.settings.bind('popup-vegetation-expanded', 'popupVegetationExpanded');

        this.refreshIntervalMinutes = this._normalizeRefreshInterval(
            this.refreshIntervalMinutes
        );
        this.locationMode = this._normalizeLocationMode(this.locationMode);
        this.panelScoreMode = this._normalizePanelScoreMode(this.panelScoreMode);
        this.vegetationRadiusMeters = this._normalizeVegetationRadius(
            this.vegetationRadiusMeters
        );
        this.outdoorWindowDurationHours = this._normalizeOutdoorWindowDuration(
            this.outdoorWindowDurationHours
        );
        this.dailySummaryScoreMode = this._normalizeDailySummaryScoreMode(
            this.dailySummaryScoreMode
        );
        this.dailySummaryLocationMode = this._normalizeDailySummaryLocationMode(
            this.dailySummaryLocationMode
        );
        this._locationSettingsSignature = this._getLocationSettingsSignature();
        this._personalizedCalculationSignature = this._getPersonalizedCalculationSignature();
        this._refreshIntervalValue = this.refreshIntervalMinutes;

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

        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }

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

        const previousRefreshInterval = this._refreshIntervalValue;
        const previousPersonalizedSignature = this._personalizedCalculationSignature;

        this.refreshIntervalMinutes = this._normalizeRefreshInterval(
            this.refreshIntervalMinutes
        );
        this.forecastLength = 3;
        this.locationMode = this._normalizeLocationMode(this.locationMode);
        this.panelScoreMode = this._normalizePanelScoreMode(this.panelScoreMode);
        this.vegetationRadiusMeters = this._normalizeVegetationRadius(
            this.vegetationRadiusMeters
        );
        this.outdoorWindowDurationHours = this._normalizeOutdoorWindowDuration(
            this.outdoorWindowDurationHours
        );

        const locationSettingsSignature = this._getLocationSettingsSignature();
        const locationSettingsChanged = this._locationSettingsSignature !== null &&
            locationSettingsSignature !== this._locationSettingsSignature;
        const personalizedCalculationSignature = this._getPersonalizedCalculationSignature();
        const personalizedCalculationChanged = previousPersonalizedSignature !== null &&
            personalizedCalculationSignature !== previousPersonalizedSignature;
        const refreshIntervalChanged = previousRefreshInterval !== null &&
            previousRefreshInterval !== this.refreshIntervalMinutes;

        this._locationSettingsSignature = locationSettingsSignature;
        this._personalizedCalculationSignature = personalizedCalculationSignature;
        this._refreshIntervalValue = this.refreshIntervalMinutes;

        if (personalizedCalculationChanged)
            this._recalculatePersonalizedRisk();

        this._updatePanel();
        this._rebuildMenu();

        if (refreshIntervalChanged)
            this._scheduleRefresh();

        if (locationSettingsChanged && this._canRefreshForCurrentLocationSettings())
            this._refreshData(false);
    }

    _onSummarySettingsChanged() {
        if (this._destroyed)
            return;

        this.dailySummaryScoreMode = this._normalizeDailySummaryScoreMode(
            this.dailySummaryScoreMode
        );
        this.dailySummaryLocationMode = this._normalizeDailySummaryLocationMode(
            this.dailySummaryLocationMode
        );
        this._rebuildMenu();
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

    _normalizeOutdoorWindowDuration(value) {
        const allowed = [1, 2, 3];
        const numericValue = Number(value);

        if (allowed.indexOf(numericValue) !== -1)
            return numericValue;

        return 2;
    }

    _normalizeDailySummaryScoreMode(value) {
        return value === 'personalized' ? 'personalized' : 'environmental';
    }

    _normalizeDailySummaryLocationMode(value) {
        return value === 'hidden' ? 'hidden' : 'place';
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

    _getPersonalizedCalculationSignature() {
        return [
            this.enablePersonalizedRisk === true ? '1' : '0',
            this._normalizeOutdoorWindowDuration(this.outdoorWindowDurationHours),
            PersonalAllergyProfile.profileFingerprint(this._personalProfileFromSettings()),
        ].join('|');
    }

    _recalculatePersonalizedRisk() {
        if (!this.enablePersonalizedRisk ||
            !this._providerData ||
            !this._providerData.current) {
            this._personalizedRisk = null;
            this._personalizedForecast = null;
            return;
        }

        const profile = this._personalProfileFromSettings();

        this._personalizedRisk = PersonalizedRiskCalculator.calculatePersonalizedRisk(
            this._providerData.current,
            this._providerData.current.moldPotential,
            profile
        );
        this._personalizedForecast = PersonalizedForecastCalculator.calculatePersonalizedForecast(
            this._providerData,
            profile,
            {
                horizonHours: 24,
                windowDurationHours: this.outdoorWindowDurationHours,
            }
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
        this._forecastRisks = [];
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
                this._showUnavailableError(new Error('Manual location coordinates are invalid'));
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
                coordinates: locationResult.coordinates,
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
                    new Error('Data unavailable'),
                    refreshGeneration,
                    locationResult.coordinates
                );
                return;
            }

            if (airQualityResult.error)
                this._logError(airQualityResult.error);

            if (weatherResult.error)
                this._logError(weatherResult.error);

            if (vegetationResult.error)
                this._logError(vegetationResult.error);

            if (airQualityResult.data !== null || weatherResult.data !== null) {
                this._cache.writeResponseAsync(combinedData, (cacheWriteError, result) => {
                    if (cacheWriteError)
                        this._logError(cacheWriteError);
                    else if (result && result.ok === false)
                        this._logError(new Error(result.error || 'Response cache write failed'));
                });
            }

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
                session: this._httpSession,
            },
            providerCallback
        );
        weatherRequest = OpenMeteoWeatherProvider.fetchForecastAsync(
            locationResult.coordinates,
            {
                forecastDays: requestDays,
                timeoutSeconds: 15,
                session: this._httpSession,
            },
            weatherCallback
        );

        if (shouldFetchVegetation) {
            vegetationRequest = OpenStreetMapVegetationProvider.fetchVegetationAsync(
                locationResult.coordinates,
                {
                    radiusMeters: this.vegetationRadiusMeters,
                    timeoutSeconds: 20,
                    session: this._httpSession,
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
                session: this._httpSession,
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

    _showUnavailableError(error) {
        this._providerData = null;
        this._currentRisk = null;
        this._forecastRisks = [];
        this._personalizedRisk = null;
        this._personalizedForecast = null;
        this._usingStaleData = false;
        this._isRefreshing = false;
        this._setError(error);
        this._updatePanel(_('Unavailable'));
    }

    _useCachedResponse(error, refreshGeneration = this._refreshGeneration, coordinates = null) {
        this._cache.readResponseAsync((cacheError, envelope) => {
            if (this._destroyed || refreshGeneration !== this._refreshGeneration)
                return;

            if (cacheError)
                this._logError(cacheError);

            if (!envelope ||
                !EnvironmentAssembler.providerDataMatchesCoordinates(envelope.data, coordinates)) {
                this._showUnavailableError(error);
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
        this._forecastRisks = this._calculateForecastRisks(data);
        this._recalculatePersonalizedRisk();

        if (!this._usingStaleData)
            this._maybeNotifyRiskChange(this._currentRisk, this._personalizedRisk);

        this._updatePanel();
        this._rebuildMenu();

        if (this._lastLocationResult)
            this._ensureLocationDisplayName(this._lastLocationResult);
    }

    _calculateForecastRisks(data) {
        if (!data || !Array.isArray(data.forecast))
            return [];

        return data.forecast.map(day => RiskCalculator.calculateRisk(
            day,
            day.moldPotential
        ));
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
        if (this._providerData && this._lastLocationResult)
            return _('Unable to refresh environmental data; showing cached data.');

        if (this._providerData)
            return _('Unable to refresh environmental data; showing cached data for the last known location.');

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
        this._menuTarget = null;

        this._addHeader();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (!this._providerData || !this._currentRisk) {
            this._addEmptyState();
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._addShareSummaryAction();
            this._addRefreshAction();
            return;
        }

        this._addCurrentSection();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        if (this._addBestOutdoorWindowSection())
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addForecastSection();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addShareSummaryAction();
        this._addRefreshAction();
    }

    _addMenuItem(item) {
        const target = this._menuTarget || this.menu;

        target.addMenuItem(item);
    }

    _useMutedMenuText(item) {
        if (item && item.actor)
            item.actor.change_style_pseudo_class('insensitive', true);
    }

    _addCollapsibleSection(title, settingKey, expandedFallback, buildContents) {
        const header = new PopupMenu.PopupBaseMenuItem({
            activate: false,
        });
        const headerBox = new St.BoxLayout({
            style_class: 'airaware-submenu-header-box',
        });
        const titleLabel = new St.Label({
            text: title,
            style_class: 'airaware-submenu-title',
        });
        const arrow = new St.Icon({
            icon_name: 'xsi-pan-end',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-arrow',
        });
        const section = new PopupMenu.PopupMenuSection();
        const previousTarget = this._menuTarget;
        let expanded = this._popupSectionExpanded(settingKey, expandedFallback);

        const applyExpandedState = () => {
            arrow.icon_name = expanded ? 'xsi-pan-down' : 'xsi-pan-end';

            if (expanded)
                section.actor.show();
            else
                section.actor.hide();
        };
        const toggleExpandedState = () => {
            expanded = !expanded;
            applyExpandedState();
            this._persistPopupSectionState(settingKey, expanded);
            return true;
        };

        header.actor.add_style_class_name('airaware-submenu-header');
        this._useMutedMenuText(header);
        headerBox.add(titleLabel, {
            expand: true,
        });
        headerBox.add(arrow);
        header.addActor(headerBox, {
            expand: true,
            span: -1,
        });
        header.actor.connect('button-release-event', () => toggleExpandedState());
        header.actor.connect('key-press-event', (actor, event) => {
            const symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_space ||
                symbol === Clutter.KEY_Return ||
                symbol === Clutter.KEY_KP_Enter)
                return toggleExpandedState();

            return false;
        });

        applyExpandedState();
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(section);
        this._menuTarget = section;

        try {
            buildContents();
        } finally {
            this._menuTarget = previousTarget;
        }
    }

    _popupSectionExpanded(settingKey, fallback) {
        return typeof this[settingKey] === 'boolean'
            ? this[settingKey]
            : fallback === true;
    }

    _persistPopupSectionState(settingKey, expanded) {
        if (typeof settingKey !== 'string' || settingKey === '')
            return;

        this[settingKey] = expanded === true;

        if (this.settings)
            this.settings.setValue(this._popupSectionSettingName(settingKey), this[settingKey]);
    }

    _popupSectionSettingName(settingKey) {
        return settingKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
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
        this._addMenuItem(item);
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

        this._addCollapsibleSection(_('Pollen'), 'popupPollenExpanded', true, () => {
            this._addPollenRows(pollen);
        });

        this._addCollapsibleSection(_('Regulated pollution'), 'popupRegulatedPollutionExpanded', true, () => {
            this._addPollutantAqiRow(_('PM2.5'), rawPollutants.pm25, pollutantAqi.pm25, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('PM10'), rawPollutants.pm10, pollutantAqi.pm10, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('NO₂'), rawPollutants.nitrogenDioxide, pollutantAqi.nitrogenDioxide, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('O₃'), rawPollutants.ozone, pollutantAqi.ozone, current.pollutantAqiLabel);
            this._addPollutantAqiRow(_('SO₂'), rawPollutants.sulfurDioxide, pollutantAqi.sulfurDioxide, current.pollutantAqiLabel);
        });

        this._addCollapsibleSection(_('Atmospheric irritants'), 'popupAtmosphericIrritantsExpanded', true, () => {
            this._addInfoRow(_('CO'), Formatter.formatCarbonMonoxide(rawPollutants.carbonMonoxide));
            this._addInfoRow(_('Dust'), Formatter.formatPollutant(context.dust));
            if (_isFiniteNumber(context.wildfirePm10))
                this._addInfoRow(_('Wildfire-related PM10'), Formatter.formatPollutant(context.wildfirePm10));
            this._addInfoRow(
                _('Aerosol optical depth'),
                Formatter.formatAerosolOpticalDepth(context.aerosolOpticalDepth)
            );
        });

        this._addCollapsibleSection(_('Mold'), 'popupMoldExpanded', true, () => {
            this._addInfoRow(
                _('Mold potential'),
                Formatter.formatMoldPotential(current.moldPotential)
            );
        });

        if (_isFiniteNumber(current.uvIndex)) {
            this._addCollapsibleSection(_('Sun'), 'popupSunExpanded', false, () => {
                this._addInfoRow(_('UV index'), Formatter.formatUvIndex(current.uvIndex));
            });
        }

        this._addVegetationSection();

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
            this._addTextBlock(_('Pollen data unavailable for this location or season'), 'airaware-muted');
    }

    _addPersonalizedRiskSection() {
        if (!this.enablePersonalizedRisk ||
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

        this._addCollapsibleSection(_('Nearby vegetation'), 'popupVegetationExpanded', false, () => {
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
        });

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

    _addBestOutdoorWindowSection() {
        if (!this.enablePersonalizedRisk || !this._personalizedForecast)
            return false;

        const window = this._personalizedForecast.bestWindow;

        if (!window || window.available !== true)
            return false;

        this._addSectionTitle(_('Best outdoor window'));
        this._addInfoRow(
            Formatter.formatTimeRange(window.startTime, window.endTime),
            _replace(_('{category} ({score})'), {
                category: Formatter.formatCategory(window.category),
                score: Formatter.formatScore(window.averageScore),
            }),
            this._scoreCategoryStyleClass(window.category)
        );

        return true;
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
            const risk = this._forecastRisks[index] || null;
            const label = this._formatForecastDayLabel(day, index);
            const value = risk ? this._formatForecastValue(risk) : _('Unavailable');
            const valueStyleClass = risk ? this._scoreCategoryStyleClass(risk.category) : '';

            this._addInfoRow(label, value, valueStyleClass);
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
        const refreshItem = this._createBottomActionItem({
            iconName: 'xsi-view-refresh',
            labelText: this._isRefreshing ? _('Refreshing...') : _('Refresh now'),
            labelStyleClass: 'airaware-refresh-label',
            onActivate: () => {
                this._refreshData(true);
            },
        });
        const ageLabel = this._formatRefreshActionAgeLabel();
        const content = refreshItem._airawareContent;

        if (ageLabel !== null && content) {
            const spacer = new St.Widget();
            const age = new St.Label({
                text: ageLabel,
                style_class: 'airaware-refresh-age',
            });

            age.clutter_text.line_wrap = false;
            age.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            content.add(spacer, {
                expand: true,
            });
            content.add(age);
        }

        this.menu.addMenuItem(refreshItem);
    }

    _addShareSummaryAction() {
        const shareItem = this._createBottomActionItem({
            iconText: '😷',
            labelText: _('Share daily summary'),
            labelStyleClass: 'airaware-refresh-label',
            onActivate: () => {
                this._shareDailySummary();
            },
        });

        this.menu.addMenuItem(shareItem);
    }

    _createBottomActionItem(options) {
        const item = new PopupMenu.PopupBaseMenuItem();
        const iconSlot = new St.Bin({
            style_class: 'airaware-action-icon-slot',
        });
        const content = new St.BoxLayout({
            style_class: 'airaware-action-content',
        });
        const label = new St.Label({
            text: options.labelText,
            style_class: options.labelStyleClass || '',
        });

        if (typeof options.iconText === 'string') {
            iconSlot.child = new St.Label({
                text: options.iconText,
                style_class: 'airaware-action-emoji',
            });
        } else {
            iconSlot.child = new St.Icon({
                icon_name: options.iconName,
                icon_type: St.IconType.SYMBOLIC,
                style_class: 'popup-menu-icon',
            });
        }

        item.connect('activate', options.onActivate);
        content.add(label);
        item.addActor(iconSlot, {
            span: 0,
        });
        item.addActor(content, {
            expand: true,
            span: -1,
        });
        item._airawareContent = content;

        return item;
    }

    _shareDailySummary() {
        const summary = this._buildDailySummaryModel();

        if (!summary || summary.available !== true) {
            Main.notify(_('AirAware'), _('No environmental data is available to share.'));
            return;
        }

        const text = DailySummaryFormatter.formatDailySummary(summary);

        if (typeof text !== 'string' || text.trim() === '') {
            Main.notify(_('AirAware'), _('No environmental data is available to share.'));
            return;
        }

        if (this._copyTextToClipboard(text))
            Main.notify(_('AirAware'), _('Daily summary copied to clipboard.'));
        else
            Main.notify(_('AirAware'), _('Could not copy the daily summary.'));
    }

    _copyTextToClipboard(text) {
        try {
            const clipboard = St.Clipboard.get_default();

            if (!clipboard || typeof clipboard.set_text !== 'function')
                return false;

            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            return true;
        } catch (error) {
            this._logError(error);
            return false;
        }
    }

    _buildDailySummaryModel() {
        if (!this._providerData || !this._currentRisk)
            return {
                available: false,
                reason: 'no_environmental_data',
            };

        return DailySummaryBuilder.buildDailySummary({
            providerData: this._providerData,
            environmentalRisk: this._currentRisk,
            personalizedRisk: this._personalizedRisk,
            personalizedForecast: this._personalizedForecast,
            panelScoreMode: this.panelScoreMode,
            summaryScore: this.dailySummaryScoreMode,
            includeMainFactor: true,
            includeBestOutdoorWindow: true,
            includeUvPeak: true,
            locationName: this.dailySummaryLocationMode === 'hidden'
                ? null
                : this._summaryLocationName(),
            locationHidden: this.dailySummaryLocationMode === 'hidden',
            stale: this._usingStaleData === true,
            dateLabel: this._formatDailySummaryDateLabel(
                this._providerData.current
                    ? this._providerData.current.timestamp || this._providerData.current.time || null
                    : null
            ),
            generatedAt: this._providerData.current
                ? this._providerData.current.timestamp || this._providerData.current.time || null
                : null,
        });
    }

    _summaryLocationName() {
        if (typeof this._locationDisplayName === 'string' &&
            this._locationDisplayName.trim() !== '')
            return this._locationDisplayName.trim();

        return null;
    }

    _formatDailySummaryDateLabel(timeText = null) {
        const date = this._dateFromProviderTime(timeText) || new Date();
        const weekday = _(WEEKDAY_LABELS[date.getDay()]);
        const month = _(MONTH_LABELS[date.getMonth()]);

        return _replace(_('{weekday}, {day} {month}'), {
            weekday,
            day: date.getDate(),
            month,
        });
    }

    _dateFromProviderTime(timeText) {
        if (typeof timeText !== 'string' || timeText.length < 10)
            return null;

        const dateText = timeText.substring(0, 10);
        const parts = dateText.split('-');

        if (parts.length !== 3)
            return null;

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
            return null;

        const date = new Date(year, month - 1, day);

        if (date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day)
            return null;

        return date;
    }

    _formatRefreshActionAgeLabel() {
        if (!this._providerData)
            return null;

        const updatedAt = _isFiniteNumber(this._providerData.airQualityFetchedAt)
            ? this._providerData.airQualityFetchedAt
            : this._providerData.fetchedAt;

        if (!_isFiniteNumber(updatedAt))
            return null;

        return _replace(_('({updated})'), {
            updated: Formatter.formatUpdateAge(updatedAt),
        });
    }

    _addSectionTitle(text) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const label = new St.Label({
            text,
            style_class: 'airaware-title',
        });

        this._useMutedMenuText(item);
        label.clutter_text.line_wrap = true;
        item.addActor(label);
        this._addMenuItem(item);
    }

    _addTextBlock(text, styleClass) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const label = new St.Label({
            text,
            style_class: styleClass,
        });

        this._useMutedMenuText(item);
        label.clutter_text.line_wrap = true;
        item.addActor(label);
        this._addMenuItem(item);
    }

    _addScoreSummary(risk, options = {}) {
        const showLocation = options.showLocation !== false;
        const categoryStyleClass = this._scoreCategoryStyleClass(risk.category);
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
            style_class: `airaware-score-value airaware-column-label ${categoryStyleClass}`,
        });
        const category = new St.Label({
            text: Formatter.formatCategory(risk.category),
            style_class: `airaware-score-category ${categoryStyleClass}`,
        });

        score.clutter_text.line_wrap = true;
        category.clutter_text.line_wrap = true;
        topRow.add(score);

        if (showLocation) {
            const spacer = new St.Widget({
                style_class: 'airaware-column-middle',
            });
            const location = new St.Label({
                text: this._formatLocationLabel(),
                style_class: 'airaware-score-place airaware-column-value',
            });

            location.clutter_text.line_wrap = true;
            topRow.add(spacer);
            topRow.add(location);
        }

        box.add(topRow);
        box.add(category);
        item.addActor(box);
        this._addMenuItem(item);
    }

    _scoreCategoryStyleClass(category) {
        const categoryId = category && typeof category.id === 'string'
            ? category.id
            : 'unavailable';

        return `airaware-score-risk-${categoryId}`;
    }

    _addInfoRow(label, value, valueStyleClass = '') {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
        });
        const box = new St.BoxLayout({
            style_class: 'airaware-row',
        });
        const labelActor = new St.Label({
            text: label,
            style_class: 'airaware-row-label airaware-column-label',
        });
        const spacer = new St.Widget({
            style_class: 'airaware-column-middle',
        });
        const valueActor = new St.Label({
            text: value,
            style_class: `airaware-row-value airaware-column-value ${valueStyleClass}`,
        });

        this._useMutedMenuText(item);
        labelActor.clutter_text.line_wrap = true;
        valueActor.clutter_text.line_wrap = true;
        box.add(labelActor);
        box.add(spacer);
        box.add(valueActor);
        item.addActor(box);
        this._addMenuItem(item);
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
            style_class: 'airaware-row-label airaware-column-label',
        });
        const rawActor = new St.Label({
            text: Formatter.formatPollutant(rawValue),
            style_class: 'airaware-pollutant-value airaware-column-value',
        });
        const aqiActor = new St.Label({
            text: Formatter.formatAqi(aqiValue, aqiSourceLabel),
            style_class: 'airaware-aqi-value airaware-column-middle',
        });

        this._useMutedMenuText(item);
        labelActor.clutter_text.line_wrap = true;
        rawActor.clutter_text.line_wrap = true;
        aqiActor.clutter_text.line_wrap = false;
        box.add(labelActor);
        box.add(aqiActor);
        box.add(rawActor);
        item.addActor(box);
        this._addMenuItem(item);
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
