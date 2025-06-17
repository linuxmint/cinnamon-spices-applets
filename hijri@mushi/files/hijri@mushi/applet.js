const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Settings = imports.ui.settings;

const BASE_URL = "https://api.aladhan.com/v1/gToH";
const SETTINGS = {
    'language': 'en',
    'format': 'DD-MM-YYYY',
    'separator': ' ',
    'showMonthName': true,
    'refreshInterval': 3600 // in seconds
};

const convertToArabicDigits = (str) => {
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return str.replace(/\d/g, (d) => arabicDigits[parseInt(d)]);
};

class HijriApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._setAppletLabel("Loading...");

        // Date variables
        this.day;
        this.month;
        this.year;

        // Hijri date
        this.hijri;

        // Session for HTTP requests
        this.session = new Soup.Session();

        // Variables to throttle manual refreshes
        this.isUpdating = false;
        this.lastClickTime = 0;
        this.throttleInterval = 2000; // 2 seconds in ms

        // Setting defaults
        this.language = SETTINGS.language;
        this.format = SETTINGS.format;
        this.showMonthName = SETTINGS.showMonthName;
        this.separator = SETTINGS.separator;
        this.refreshInterval = SETTINGS.refreshInterval;

        this._initSettings(metadata, instanceId);
        this._updateDate();

        this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.refreshInterval, () => {
            this._updateDate();
            return true;
        });
    }

    _initSettings(metadata, instanceId) {
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        for (const setting of Object.keys(SETTINGS)) {
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                setting,
                setting,
                this._updateDate.bind(this),
                null
            );
        }
    }

    async _updateDate() {
        if (this.isUpdating) {
            return;
        }

        this.isUpdating = true;

        try {
            const url = this._buildURL();
            const request = this._buildRequest(url);
            const response = await this._sendRequest(request);
            const date = this._handleResponse(response, request);

            this._setAppletLabel(date || "Error");
        } catch (e) {
            this._logError(e);
            this._setAppletLabel("Error");
        } finally {
            this.isUpdating = false;
        }
    }

    _buildURL() {
        const now = new Date();
        const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;

        return `${BASE_URL}?date=${dateStr}`;
    }

    _buildRequest(url) {
        return Soup.Message.new("GET", url);
    }

    _sendRequest(request) {
        return new Promise((resolve, reject) => {
            this.session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null, (session, res) => {
                try {
                    let result = session.send_and_read_finish(res);
                    resolve(result);
                } catch (e) {
                    this._logError(e);
                    reject(e);
                }
            });
        });
    }

    _handleResponse(response, request) {
        if (!this._isRequestSuccessful(request)) {
            this._handleRequestError(request);
            return null;
        }

        const json = this._parseResponse(response);
        this.hijri = json?.data?.hijri;

        if (!this.hijri) {
            this._handleInvalidStructure();
            return null;
        }

        return this._formatHijriDate();
    }

    _isRequestSuccessful(request) {
        return request.get_status() === Soup.Status.OK;
    }

    _handleRequestError(request) {
        this._logError(`Request failed with status: ${request.get_status()}`);
        this._logError(`Request failed with reason: ${request.get_reason()}`);
    }

    _parseResponse(response) {
        try {
            return JSON.parse(ByteArray.toString(response.get_data()));
        } catch (e) {
            this._logError("Failed to parse JSON response.");
            return {};
        }
    }

    _handleInvalidStructure() {
        this._logError("Invalid response structure for Hijri date.");
    }

    _formatHijriDate() {
        const hijri = this.hijri;

        // Handle showMonthName setting
        if (this.showMonthName) {
            this.month = hijri.month[this.language] || hijri.month.en;
        } else {
            this.month = hijri.month.number.toString().padStart(2, "0");
        }

        // Handle language setting
        if (this.language === "ar") {
            this.day = convertToArabicDigits(hijri.day);
            this.year = convertToArabicDigits(hijri.year);

            if (!this.showMonthName) {
                this.month = convertToArabicDigits(hijri.month.number.toString().padStart(2, "0"));
            }
        } else {
            this.day = hijri.day.toString().padStart(2, "0");
            this.year = hijri.year.toString();
        }

        // Handle format and separator settings
        switch (this.format) {
            case "YYYY-MM-DD":
                return `${this.year}${this.separator}${this.month}${this.separator}${this.day}`;
            case "Month Day, Year":
                return `${this.month}${this.separator}${this.day}${this.separator}${this.year}`;
            default:
                return `${this.day}${this.separator}${this.month}${this.separator}${this.year}`;
        }
    }

    _setAppletLabel(label) {
        this.set_applet_label(label);
    }

    _logError(message) {
        global.logError(`hijri@mushi: ${message}`);
    }

    // Manual refresh
    on_applet_clicked(event) {
        const now = Date.now();

        if (this.isUpdating) {
            return;
        }

        if (now - this.lastClickTime < this.throttleInterval) {
            return;
        }

        this.lastClickTime = now;
        this._updateDate();
    }

    on_applet_removed_from_panel() {
        if (this.timer) {
            GLib.source_remove(this.timer);
            this.timer = null;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new HijriApplet(metadata, orientation, panelHeight, instanceId);
}
