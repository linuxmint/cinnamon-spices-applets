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

            this.accessToken = null;
            this._readCredentials();

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

            this.actor.add(this.label5h, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this._applet_icon, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this.label7d, { y_align: St.Align.MIDDLE, y_fill: false });

            this.set_applet_tooltip("Fetching Claude usage data...");
            this.lastUpdateTime = null;
            this.fetchUsageData();

            this.updateTimer = 0;
            this.startTimer();
        }
        catch (e) {
            global.logError("Claude Usage Applet initialization error: " + e);
            this.handleError("Initialization failed: " + e);
        }
    },

    _readCredentials: function() {
        let credPath;
        if (this.credentialsPath && this.credentialsPath.length > 0) {
            if (this.credentialsPath.startsWith("file://")) {
                const file = Gio.File.new_for_uri(this.credentialsPath);
                credPath = file.get_path();
            } else {
                credPath = this.credentialsPath;
            }
        } else {
            credPath = GLib.get_home_dir() + "/.claude/.credentials.json";
        }

        Cinnamon.get_file_contents_utf8(credPath, (contents) => {
            if (contents) {
                try {
                    const credentials = JSON.parse(contents);

                    if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
                        this.accessToken = credentials.claudeAiOauth.accessToken;
                        if (this.label5h && this.label7d) {
                            this.fetchUsageData();
                        }
                    } else {
                        throw new Error("Invalid credentials structure - expected claudeAiOauth.accessToken");
                    }
                } catch (e) {
                    const errorMsg = e.message || e.toString();
                    global.logError("Claude Usage Applet: Failed to parse credentials - " + errorMsg);
                    if (this.label5h && this.label7d) {
                        this.handleError("Invalid credentials file");
                    }
                }
            } else {
                global.logError("Claude Usage Applet: Credentials file not found at " + credPath + ". Please ensure Claude Code is set up or configure the credentials path in applet settings.");
                if (this.label5h && this.label7d) {
                    this.handleError("Credentials file not found");
                }
            }
        });
    },

    fetchUsageData: function() {
        if (!this.accessToken) {
            this.handleError("No access token available");
            return;
        }

        try {
            const request = Soup.Message.new('GET', API_URL);
            request.request_headers.append('Authorization', 'Bearer ' + this.accessToken);
            request.request_headers.append('anthropic-beta', 'oauth-2025-04-20');
            request.request_headers.append('Content-Type', 'application/json');

            this._httpSession.send_and_read_async(
                request,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        if (request.get_status() === 200) {
                            const bytes = this._httpSession.send_and_read_finish(result);
                            const data = JSON.parse(ByteArray.toString(bytes.get_data()));
                            this.updateDisplay(data);
                        } else {
                            this.handleError("API request failed: HTTP " + request.get_status());
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

    setLabelColor: function(label, percent) {
        let colorClass;
        if (percent < 50) {
            colorClass = "claude-usage-green";
        } else if (percent < 80) {
            colorClass = "claude-usage-yellow";
        } else {
            colorClass = "claude-usage-red";
        }

        label.remove_style_class_name("claude-usage-green");
        label.remove_style_class_name("claude-usage-yellow");
        label.remove_style_class_name("claude-usage-red");
        label.add_style_class_name(colorClass);
    },

    updateDisplay: function(data) {
        try {
            if (!data || !data.five_hour || !data.seven_day) {
                this.handleError("Invalid API response structure");
                return;
            }

            const fiveHourUtil = data.five_hour.utilization || 0;
            const sevenDayUtil = data.seven_day.utilization || 0;

            // Format 5-hour label with time until reset if available
            let fiveHourText = fiveHourUtil.toFixed(0) + "%";
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
            global.logError("Failed to update tooltip: " + e);
        }
    },

    updateLoop: function() {
        this.fetchUsageData();
        return GLib.SOURCE_CONTINUE;
    },

    startTimer: function() {
        if (this.updateTimer > 0) {
            GLib.source_remove(this.updateTimer);
        }

        const intervalSeconds = this.updateInterval * 60;
        this.updateTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalSeconds, this.updateLoop.bind(this));
    },

    onUpdateIntervalChanged: function() {
        this.startTimer();
    },

    onCredentialsPathChanged: function() {
        this.accessToken = null;
        this._readCredentials();

        if (this.accessToken) {
            this.fetchUsageData();
        } else {
            this.handleError("Failed to read credentials from configured path");
        }
    },

    handleError: function(errorMsg) {
        global.logError("Claude Usage Applet: " + errorMsg);

        if (this.label5h && this.label7d) {
            this.label5h.set_text("Error");
            this.label5h.remove_style_class_name("claude-usage-green");
            this.label5h.remove_style_class_name("claude-usage-yellow");
            this.label5h.remove_style_class_name("claude-usage-red");
            this.label5h.add_style_class_name("claude-usage-red");
            this.label7d.set_text("");
            this.label7d.remove_style_class_name("claude-usage-green");
            this.label7d.remove_style_class_name("claude-usage-yellow");
            this.label7d.remove_style_class_name("claude-usage-red");
        }

        this.set_applet_tooltip("Error: " + errorMsg);
        return GLib.SOURCE_CONTINUE;
    },

    on_applet_clicked: function() {
        this.fetchUsageData();
        this.startTimer();
    },

    on_applet_removed_from_panel: function() {
        if (this.updateTimer > 0) {
            GLib.source_remove(this.updateTimer);
            this.updateTimer = 0;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let claudeUsageApplet = new ClaudeUsageApplet(orientation, panel_height, instance_id);
    return claudeUsageApplet;
}
