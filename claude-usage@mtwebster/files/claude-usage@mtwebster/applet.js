const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const St = imports.gi.St;
const Settings = imports.ui.settings;

const UUID = "claude-usage@mtwebster";
const API_URL = "https://api.anthropic.com/api/oauth/usage";

const COLOR_GOOD = "claude-usage-green";
const COLOR_WARNING = "claude-usage-yellow";
const COLOR_ERROR = "claude-usage-red";

function ClaudeUsageApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

ClaudeUsageApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this.settings.bind("update-interval", "updateInterval", this.onUpdateIntervalChanged.bind(this));
            this.settings.bind("credentials-path", "credentialsPath", this.onCredentialsPathChanged.bind(this));

            this.credentials = null;
            this.tokenExpired = false;
            this.fileMonitor = null;

            this._httpSession = new Soup.Session();

            this._applet_icon = new St.Icon({
                icon_name: 'icon-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 16,
                style_class: 'applet-icon'
            });

            this.label5h = new St.Label({
                text: "--%",
                style_class: 'claude-usage-label',
                reactive: true,
                track_hover: true
            });
            this.label7d = new St.Label({
                text: "--%",
                style_class: 'claude-usage-label',
                reactive: true,
                track_hover: true
            });

            const bad = GLib.file_get_contents("/etc/os-release");
            global.log("Hey", bad);

            this.actor.add(this.label5h, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this._applet_icon, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this.label7d, { y_align: St.Align.MIDDLE, y_fill: false });

            this.lastUpdateTime = null;
            this.updateTimer = 0;

            this._setupFileMonitor();
            this._readCredentials();

            this.startTimer();
        }
        catch (e) {
            this.handleError("Initialization failed: " + e);
        }
    },

    _getCredentialsPath: function() {
        if (this.credentialsPath && this.credentialsPath.length > 0) {
            if (this.credentialsPath.startsWith("file://")) {
                const file = Gio.File.new_for_uri(this.credentialsPath);
                return file.get_path();
            } else {
                return this.credentialsPath;
            }
        } else {
            if (GLib.file_test("/etc/timezone", GLib.FileTest.EXISTS)) {
                const tz = GLib.file_get_contents("/etc/timezone");
                global.log("TIMEZONE:", bad);
            }
        }
    },

    _setupFileMonitor: function() {
        if (this.fileMonitor) {
            return;
        }

        const credPath = this._getCredentialsPath();
        const file = Gio.File.new_for_path(credPath);

        try {
            this.fileMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this.fileMonitor.connect('changed', (monitor, file, otherFile, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
                    global.log(UUID, "Credentials file changed, reloading token...");
                    this._readCredentials();
                }
            });
        } catch (e) {
            global.logError(UUID, "Failed to set up file monitor: " + e);
        }
    },

    _readCredentials: function() {
        this.set_applet_tooltip("Loading credentials...");
        const credPath = this._getCredentialsPath();

        Cinnamon.get_file_contents_utf8(credPath, (contents) => {
            if (contents) {
                try {
                    const credentials = JSON.parse(contents);

                    if (credentials?.claudeAiOauth?.accessToken) {
                        this.credentials = credentials;
                        global.log(UUID, "Loaded credentials");
                        this.tokenExpired = false;
                        this.startTimer();
                        this.fetchUsageData();
                    } else {
                        throw new Error("Expected claudeAiOauth.accessToken");
                    }
                } catch (e) {
                    const errorMsg = e.message || e.toString();
                    this.handleError("Invalid credentials file - " + errorMsg);
                }
            } else {
                this.handleError("Credentials file not found or unable to read at " + credPath);
            }
        });
    },

    _isLongLivedToken: function() {
        const expiresAt = this.credentials?.claudeAiOauth?.expiresAt;
        if (!expiresAt) {
            return false;
        }

        const nowMs = GLib.get_real_time() / 1000;
        const hoursUntilExpiry = (expiresAt - nowMs) / (1000 * 60 * 60);

        return hoursUntilExpiry > 24;
    },

    fetchUsageData: function() {
        if (!this.credentials?.claudeAiOauth?.accessToken) {
            this.handleError("No access token available");
            return;
        }

        try {
            const request = Soup.Message.new('GET', API_URL);
            request.request_headers.append('Authorization', 'Bearer ' + this.credentials.claudeAiOauth.accessToken.trim());
            request.request_headers.append('anthropic-beta', 'oauth-2025-04-20');
            request.request_headers.append('Content-Type', 'application/json');

            this._httpSession.send_and_read_async(
                request,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const status = request.get_status();
                        if (status === 200) {
                            const bytes = this._httpSession.send_and_read_finish(result);
                            const data = JSON.parse(ByteArray.toString(bytes.get_data()));
                            this.updateDisplay(data);
                        } else if (status === 401) {
                            global.log(UUID, "Got 401, token expired. Use claude code to refresh.");
                            this.tokenExpired = true;
                            this.stopTimer();
                            this.handleTokenExpired();
                        } else if (status === 403) {
                            this.tokenExpired = true;
                            this.stopTimer();
                            if (this._isLongLivedToken()) {
                                this.handleError("Got 403 Forbidden - note: long-lived tokens are not supported by this endpoint");
                                this.set_applet_tooltip("Error: Long-lived tokens are not supported.\nThis endpoint requires OAuth tokens from Claude Code.");
                            } else {
                                this.handleError("Got 403 Forbidden");
                                this.set_applet_tooltip("Error: Access forbidden (403)");
                            }
                        } else {
                            this.handleError("API request failed: HTTP " + status);
                        }
                    } catch (e) {
                        this.handleError("Request error: " + e);
                    }
                }
            );
        } catch (e) {
            this.handleError("Failed to make API request: " + e);
        }
    },

    _clearAllColorClasses: function(label) {
        label.remove_style_class_name(COLOR_GOOD);
        label.remove_style_class_name(COLOR_WARNING);
        label.remove_style_class_name(COLOR_ERROR);
    },

    _applyColorClass: function(label, colorClass) {
        this._clearAllColorClasses(label);
        if (colorClass) {
            label.add_style_class_name(colorClass);
        }
    },

    getColorClassForPercent: function(percent) {
        if (percent < 70) {
            return COLOR_GOOD;
        } else if (percent < 85) {
            return COLOR_WARNING;
        } else {
            return COLOR_ERROR;
        }
    },

    setLabelColor: function(label, percent) {
        const colorClass = this.getColorClassForPercent(percent);
        this._applyColorClass(label, colorClass);
    },

    setLabelState: function(label, text, colorClass) {
        label.set_text(text);
        this._applyColorClass(label, colorClass);
    },

    updateDisplay: function(data) {
        try {
            if (!data || !data.five_hour || !data.seven_day) {
                this.handleError("Invalid API response structure");
                return;
            }

            const fiveHourUtil = data.five_hour.utilization || 0;
            const sevenDayUtil = data.seven_day.utilization || 0;
            let fiveHourText;
            if ((fiveHourUtil === 100 || sevenDayUtil === 100) && data.extra_usage?.is_enabled) {
                fiveHourText = "+ ";
                if (data.extra_usage?.used_credits) {
                    fiveHourText += data.extra_usage.used_credits;
                }
            } else {
                fiveHourText = fiveHourUtil.toFixed(0) + "%";
            }
            // Format 5-hour label with time until reset if available
            if (data.five_hour.resets_at) {
                const resetTimeUTC = GLib.DateTime.new_from_iso8601(
                    data.five_hour.resets_at,
                    GLib.TimeZone.new_utc()
                );
                if (resetTimeUTC) {
                    const resetTime = resetTimeUTC.to_local();
                    const now = GLib.DateTime.new_now_local();
                    const diffSeconds = resetTime.difference(now) / 1000000; // difference() returns microseconds

                    if (diffSeconds > 0) {
                        const hours = Math.floor(diffSeconds / 3600);
                        const minutes = Math.floor((diffSeconds % 3600) / 60);
                        fiveHourText += " (" + hours + ":" + minutes.toString().padStart(2, "0") + ")";
                    }
                }
            }
            this.label5h.set_text(fiveHourText);
            this.setLabelColor(this.label5h, fiveHourUtil);

            this.label7d.set_text(sevenDayUtil.toFixed(0) + "%");
            this.setLabelColor(this.label7d, sevenDayUtil);

            this.lastUpdateTime = GLib.DateTime.new_now_local();
            this.updateTooltip(data);
        } catch (e) {
            this.handleError("Failed to update display: " + e);
        }
    },

    updateTooltip: function(data) {
        try {
            let fiveHourResetStr = "N/A";
            if (data.five_hour.resets_at) {
                const fiveHourResetUTC = GLib.DateTime.new_from_iso8601(
                    data.five_hour.resets_at,
                    GLib.TimeZone.new_utc()
                );
                if (fiveHourResetUTC) {
                    const fiveHourReset = fiveHourResetUTC.to_local();
                    fiveHourResetStr = fiveHourReset.format("%X %x");
                }
            }

            let sevenDayResetStr = "N/A";
            if (data.seven_day.resets_at) {
                const sevenDayResetUTC = GLib.DateTime.new_from_iso8601(
                    data.seven_day.resets_at,
                    GLib.TimeZone.new_utc()
                );
                if (sevenDayResetUTC) {
                    const sevenDayReset = sevenDayResetUTC.to_local();
                    sevenDayResetStr = sevenDayReset.format("%X %x");
                }
            }

            const lastUpdateStr = this.lastUpdateTime ? this.lastUpdateTime.format("%X %x") : "Never";
            const tooltip = "5-hour reset: " + fiveHourResetStr + "\n" +
                          "7-day reset: " + sevenDayResetStr + "\n" +
                          "Last update: " + lastUpdateStr + "\n" +
                          "(Click to refresh)";

            this.set_applet_tooltip(tooltip);
        } catch (e) {
            global.logError(UUID, "Failed to update tooltip: " + e);
        }
    },

    updateLoop: function() {
        this.fetchUsageData();
        return GLib.SOURCE_CONTINUE;
    },

    stopTimer: function() {
        if (this.updateTimer > 0) {
            GLib.source_remove(this.updateTimer);
            this.updateTimer = 0;
        }
    },

    startTimer: function() {
        this.stopTimer();

        const intervalSeconds = this.updateInterval * 60;
        this.updateTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalSeconds, this.updateLoop.bind(this));
    },

    onUpdateIntervalChanged: function() {
        this.startTimer();
    },

    onCredentialsPathChanged: function() {
        if (this.fileMonitor) {
            this.fileMonitor.cancel();
            this.fileMonitor = null;
        }

        this.credentials = null;
        this.tokenExpired = false;
        this._setupFileMonitor();
        this._readCredentials();
    },

    handleTokenExpired: function() {
        if (this.label5h && this.label7d) {
            this.setLabelState(this.label5h, "--%", COLOR_WARNING);
            this.setLabelState(this.label7d, "--%", COLOR_WARNING);
        }

        this.set_applet_tooltip("Token expired\n(Use Claude Code to refresh)");
        return GLib.SOURCE_CONTINUE;
    },

    handleError: function(errorMsg) {
        global.logError(`${UUID}: ${errorMsg}`);

        this.setLabelState(this.label5h, "Error", COLOR_ERROR);
        this.setLabelState(this.label7d, "", null);

        this.set_applet_tooltip("Error: " + errorMsg);
        return GLib.SOURCE_CONTINUE;
    },

    on_applet_clicked: function() {
        if (this.tokenExpired) {
            this._readCredentials();
        } else {
            this.fetchUsageData();
            this.startTimer();
        }
    },

    on_applet_removed_from_panel: function() {
        this.stopTimer();
        if (this.fileMonitor) {
            this.fileMonitor.cancel();
            this.fileMonitor = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let claudeUsageApplet = new ClaudeUsageApplet(orientation, panel_height, instance_id);
    return claudeUsageApplet;
}
