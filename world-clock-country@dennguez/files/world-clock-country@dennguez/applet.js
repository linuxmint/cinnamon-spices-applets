const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const UUID = "world-clock-country@dennguez";
const UPDATE_SECONDS = 1;
const FALLBACK_PRESET = "UTC";

const PRESETS = {
    "UTC": {
        label: "UTC",
        timezone: "UTC",
        flag: "utc.svg",
        code: "UTC"
    },
    "BO_LPB": {
        label: "Bolivia - La Paz",
        timezone: "America/La_Paz",
        flag: "bo.svg",
        code: "BO"
    },
    "MX_MEX": {
        label: "Mexico - Mexico City",
        timezone: "America/Mexico_City",
        flag: "mx.svg",
        code: "MX"
    },
    "US_NYC": {
        label: "United States - New York",
        timezone: "America/New_York",
        flag: "us.svg",
        code: "US"
    },
    "US_LAX": {
        label: "United States - Los Angeles",
        timezone: "America/Los_Angeles",
        flag: "us.svg",
        code: "US"
    },
    "CO_BOG": {
        label: "Colombia - Bogota",
        timezone: "America/Bogota",
        flag: "co.svg",
        code: "CO"
    },
    "PE_LIM": {
        label: "Peru - Lima",
        timezone: "America/Lima",
        flag: "pe.svg",
        code: "PE"
    },
    "EC_UIO": {
        label: "Ecuador - Quito",
        timezone: "America/Guayaquil",
        flag: "ec.svg",
        code: "EC"
    },
    "CL_SCL": {
        label: "Chile - Santiago",
        timezone: "America/Santiago",
        flag: "cl.svg",
        code: "CL"
    },
    "AR_BUE": {
        label: "Argentina - Buenos Aires",
        timezone: "America/Argentina/Buenos_Aires",
        flag: "ar.svg",
        code: "AR"
    },
    "UY_MVD": {
        label: "Uruguay - Montevideo",
        timezone: "America/Montevideo",
        flag: "uy.svg",
        code: "UY"
    },
    "BR_SAO": {
        label: "Brazil - Sao Paulo",
        timezone: "America/Sao_Paulo",
        flag: "br.svg",
        code: "BR"
    },
    "GB_LON": {
        label: "United Kingdom - London",
        timezone: "Europe/London",
        flag: "gb.svg",
        code: "GB"
    },
    "ES_MAD": {
        label: "Spain - Madrid",
        timezone: "Europe/Madrid",
        flag: "es.svg",
        code: "ES"
    },
    "FR_PAR": {
        label: "France - Paris",
        timezone: "Europe/Paris",
        flag: "fr.svg",
        code: "FR"
    },
    "DE_BER": {
        label: "Germany - Berlin",
        timezone: "Europe/Berlin",
        flag: "de.svg",
        code: "DE"
    },
    "IT_ROM": {
        label: "Italy - Rome",
        timezone: "Europe/Rome",
        flag: "it.svg",
        code: "IT"
    },
    "PT_LIS": {
        label: "Portugal - Lisbon",
        timezone: "Europe/Lisbon",
        flag: "pt.svg",
        code: "PT"
    },
    "IN_CCU": {
        label: "India - Kolkata",
        timezone: "Asia/Kolkata",
        flag: "in.svg",
        code: "IN"
    },
    "TH_BKK": {
        label: "Thailand - Bangkok",
        timezone: "Asia/Bangkok",
        flag: "th.svg",
        code: "TH"
    },
    "JP_TYO": {
        label: "Japan - Tokyo",
        timezone: "Asia/Tokyo",
        flag: "jp.svg",
        code: "JP"
    },
    "CN_SHA": {
        label: "China - Shanghai",
        timezone: "Asia/Shanghai",
        flag: "cn.svg",
        code: "CN"
    },
    "KR_SEL": {
        label: "South Korea - Seoul",
        timezone: "Asia/Seoul",
        flag: "kr.svg",
        code: "KR"
    },
    "AU_SYD": {
        label: "Australia - Sydney",
        timezone: "Australia/Sydney",
        flag: "au.svg",
        code: "AU"
    },
    "NZ_AKL": {
        label: "New Zealand - Auckland",
        timezone: "Pacific/Auckland",
        flag: "nz.svg",
        code: "NZ"
    }
};

function CountryClockApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

CountryClockApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.instanceId = instanceId;
        this.appletPath = metadata.path;
        this.timer = null;

        this.timezonePreset = FALLBACK_PRESET;
        this.customTimezone = "";
        this.customFlagImage = "";
        this.customCountryCode = "";
        this.countryIndicator = "flag";
        this.timeFormat = "24";
        this.showTimezoneTooltip = true;

        try {
            if (!this.appletPath) {
                this.appletPath = imports.ui.appletManager.appletMeta[UUID].path;
            }

            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this._bindSettings();

            this._updateClock();
            this._startTimer();
        } catch (e) {
            global.logError(e);
            this.set_applet_icon_path(this._getFlagPath("utc.svg"));
            this.set_applet_label("Clock error");
            this.set_applet_tooltip("Country Clock could not start. Check Cinnamon logs.");
        }
    },

    _bindSettings: function() {
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "timezone-preset",
            "timezonePreset",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "custom-timezone",
            "customTimezone",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "custom-flag-image",
            "customFlagImage",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "custom-country-code",
            "customCountryCode",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "country-indicator",
            "countryIndicator",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "time-format",
            "timeFormat",
            this._onSettingsChanged,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "show-timezone-tooltip",
            "showTimezoneTooltip",
            this._onSettingsChanged,
            null);
    },

    _onSettingsChanged: function() {
        this._updateClock();
    },

    _startTimer: function() {
        var self = this;

        this._removeTimer();
        this.timer = Mainloop.timeout_add_seconds(UPDATE_SECONDS, function() {
            self._updateClock();
            return true;
        });
    },

    _removeTimer: function() {
        if (this.timer) {
            Mainloop.source_remove(this.timer);
            this.timer = null;
        }
    },

    _updateClock: function() {
        var timezoneId = this._getActiveTimezone();
        var timezone = this._createTimezone(timezoneId);
        var usingFallback = false;

        if (!timezone) {
            timezoneId = "UTC";
            timezone = this._createTimezone(timezoneId);
            usingFallback = true;
        }

        var now = GLib.DateTime.new_now(timezone);
        var timeText = this._formatTime(now);

        this._setPanelDisplay(timeText);
        this._setTooltip(timezoneId, usingFallback);
    },

    _formatTime: function(dateTime) {
        if (this.timeFormat === "ampm") {
            return this._trim(dateTime.format("%l:%M %p"));
        }

        return dateTime.format("%H:%M");
    },

    _setPanelDisplay: function(timeText) {
        if (this.countryIndicator === "code") {
            this._hideCountryIcon();
            this.set_applet_label(this._getActiveCountryCode() + " " + timeText);
            return;
        }

        this._showCountryIcon();
        this._setFlagIcon();
        this.set_applet_label(timeText);
    },

    _createTimezone: function(timezoneId) {
        try {
            if (GLib.TimeZone.new_identifier) {
                return GLib.TimeZone.new_identifier(timezoneId);
            }

            return GLib.TimeZone.new(timezoneId);
        } catch (e) {
            return null;
        }
    },

    _getActivePreset: function() {
        return PRESETS[this.timezonePreset] || PRESETS[FALLBACK_PRESET];
    },

    _getActiveTimezone: function() {
        if (this.timezonePreset === "CUSTOM") {
            var customTimezone = this._trim(this.customTimezone);
            return customTimezone || "UTC";
        }

        return this._getActivePreset().timezone;
    },

    _setFlagIcon: function() {
        var icon = this._getActiveFlagIcon();

        if (this._looksLikeFilePath(icon)) {
            this.set_applet_icon_path(icon);
        } else {
            this.set_applet_icon_name(icon);
        }
    },

    _getActiveFlagIcon: function() {
        if (this.timezonePreset === "CUSTOM") {
            var customFlag = this._trim(this.customFlagImage);

            if (customFlag) {
                return customFlag;
            }

            return this._getFlagPath("utc.svg");
        }

        return this._getFlagPath(this._getActivePreset().flag);
    },

    _getActiveCountryCode: function() {
        if (this.timezonePreset === "CUSTOM") {
            var customCode = this._trim(this.customCountryCode).toUpperCase();
            return customCode || "TZ";
        }

        return this._getActivePreset().code || this.timezonePreset.split("_")[0];
    },

    _hideCountryIcon: function() {
        if (typeof this.hide_applet_icon === "function") {
            this.hide_applet_icon();
            return;
        }

        if (this._applet_icon_box) {
            this._applet_icon_box.hide();
        }
    },

    _showCountryIcon: function() {
        if (typeof this.show_applet_icon === "function") {
            this.show_applet_icon();
            return;
        }

        if (this._applet_icon_box) {
            this._applet_icon_box.show();
        }
    },

    _setTooltip: function(timezoneId, usingFallback) {
        if (usingFallback) {
            this.set_applet_tooltip("Invalid custom time zone. Using UTC.");
            return;
        }

        if (!this.showTimezoneTooltip) {
            this.set_applet_tooltip("Country Clock");
            return;
        }

        this.set_applet_tooltip(this._getActiveLabel() + "\n" + timezoneId);
    },

    _getActiveLabel: function() {
        if (this.timezonePreset === "CUSTOM") {
            return "Custom";
        }

        return this._getActivePreset().label;
    },

    _getFlagPath: function(fileName) {
        return this.appletPath + "/flags/" + fileName;
    },

    _looksLikeFilePath: function(value) {
        return value.indexOf("/") >= 0 || value.indexOf(".svg") > -1 || value.indexOf(".png") > -1;
    },

    _trim: function(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value).replace(/^\s+|\s+$/g, "");
    },

    on_applet_removed_from_panel: function() {
        this._removeTimer();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new CountryClockApplet(metadata, orientation, panelHeight, instanceId);
}
