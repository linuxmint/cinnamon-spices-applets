const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Dialog = imports.ui.dialog;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

const UUID = "battery-view@ccarnivore";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

/**
 * Decides what to do about the charge alert.
 * `armed` means the alert has not fired yet for the current charge cycle.
 * Re-arming uses a hysteresis drop instead of "condition no longer true", because a full
 * battery stops charging and would otherwise re-trigger on every top-up.
 * Returns "fire", "rearm" or "hold".
 */
function evaluateAlert(soc, charging, alertSoc, rearmDrop, armed) {
    if (armed && charging && soc >= alertSoc) return "fire";
    if (!armed && soc < alertSoc - rearmDrop) return "rearm";
    return "hold";
}

/**
 * Maps the current power flow to a REST action.
 * "on"  = battery is charging with at least `chargeWatts` (surplus production)
 * "off" = battery is discharging and below `offSoc`
 * null  = neutral, no action (the last action stays in effect)
 */
function determineRestAction(soc, pAkku, chargeWatts, offSoc) {
    if (pAkku === null || pAkku === undefined) return null;
    if (pAkku < 0 && Math.abs(pAkku) >= chargeWatts) return "on";
    if (pAkku > 0 && soc < offSoc) return "off";
    return null;
}

class SolarBatteryApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._appletDir = metadata.path;
        this.set_applet_tooltip("Solar Battery View");
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Create solar icon and add it to the panel actor
        this._solarIcon = new St.Icon({
            icon_type: St.IconType.FULLCOLOR,
            icon_size: Math.floor(panel_height * 0.5)
        });
        this.actor.add(this._solarIcon, { y_align: St.Align.MIDDLE, y_fill: false });
        // Move solar icon to the front (before battery icon and label)
        this.actor.set_child_below_sibling(this._solarIcon, null);

        this._httpSession = new Soup.Session();
        this._updateTimer = 0;
        this._lastSOC = null;

        this._alertArmed = true;
        this._alertDialog = null;

        this._pendingRestAction = null;
        this._pendingRestCount = 0;
        this._restInFlight = false;

        this._bindSettings(instance_id);
        this._setErrorState();
        this._startPolling();
    }

    on_applet_clicked(event) {
        this._fetchData();
    }

    on_panel_height_changed() {
        const size = this._panelHeight - 4;
        this._solarIcon.set_icon_size(size);
    }

    _bindSettings(instance_id) {
        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("inverter_ip", "inverter_ip", this._onSettingsChanged.bind(this));
        this.settings.bind("poll_interval", "poll_interval", this._onIntervalChanged.bind(this));
        this.settings.bind("threshold_green", "threshold_green", this._onSettingsChanged.bind(this));
        this.settings.bind("threshold_yellow", "threshold_yellow", this._onSettingsChanged.bind(this));
        this.settings.bind("threshold_production", "threshold_production", this._onSettingsChanged.bind(this));
        this.settings.bind("threshold_export", "threshold_export", this._onSettingsChanged.bind(this));

        this.settings.bind("alert_enabled", "alert_enabled");
        this.settings.bind("alert_soc", "alert_soc");
        this.settings.bind("alert_rearm_drop", "alert_rearm_drop");
        this.settings.bind("alert_mode", "alert_mode");

        this.settings.bind("rest_enabled", "rest_enabled");
        this.settings.bind("rest_confirm_polls", "rest_confirm_polls");
        this.settings.bind("rest_charge_watts", "rest_charge_watts");
        this.settings.bind("rest_off_soc", "rest_off_soc");
        this.settings.bind("rest_on_url", "rest_on_url");
        this.settings.bind("rest_on_method", "rest_on_method");
        this.settings.bind("rest_on_body", "rest_on_body");
        this.settings.bind("rest_on_content_type", "rest_on_content_type");
        this.settings.bind("rest_off_url", "rest_off_url");
        this.settings.bind("rest_off_method", "rest_off_method");
        this.settings.bind("rest_off_body", "rest_off_body");
        this.settings.bind("rest_off_content_type", "rest_off_content_type");
        this.settings.bind("rest_last_action", "rest_last_action");
    }

    _onSettingsChanged() {
        this._fetchData();
    }

    _onIntervalChanged() {
        this._startPolling();
    }

    _startPolling() {
        this._stopPolling();
        this._fetchData();
        this._updateTimer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.poll_interval,
            () => {
                this._fetchData();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopPolling() {
        if (this._updateTimer > 0) {
            GLib.source_remove(this._updateTimer);
            this._updateTimer = 0;
        }
    }

    _fetchData() {
        const url = `http://${this.inverter_ip}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`;
        const request = Soup.Message.new("GET", url);

        if (!request) {
            this._setErrorState();
            return;
        }

        this._httpSession.send_and_read_async(
            request,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                try {
                    const status = request.get_status();
                    if (status !== 200) {
                        this._setErrorState();
                        return;
                    }
                    const bytes = this._httpSession.send_and_read_finish(result);
                    const responseText = ByteArray.toString(bytes.get_data());
                    const data = JSON.parse(responseText);
                    this._updateDisplay(data);
                } catch (e) {
                    global.logError("battery-view: " + e.message);
                    this._setErrorState();
                }
            }
        );
    }

    _updateDisplay(data) {
        const site = data.Body.Data.Site;
        const inverters = data.Body.Data.Inverters;

        // SOC from first inverter
        let soc = null;
        for (let key in inverters) {
            if (inverters[key].SOC !== undefined && inverters[key].SOC !== null) {
                soc = inverters[key].SOC;
                break;
            }
        }

        const pAkku = site.P_Akku;   // positive = discharging, negative = charging (verified on real device)
        const pGrid = site.P_Grid;   // positive = importing, negative = exporting (verify on real device)
        const pPV = site.P_PV;

        if (soc === null) {
            this._setErrorState();
            return;
        }

        this._lastSOC = soc;

        const charging = pAkku !== null && pAkku < 0;

        this._checkAlert(soc, charging);
        this._checkRestTriggers(soc, pAkku);

        // Battery icon: color by SOC, direction by charge/discharge
        const direction = charging ? "charging" : "discharging";
        let color;
        if (soc >= this.threshold_green) {
            color = "green";
        } else if (soc >= this.threshold_yellow) {
            color = "yellow";
        } else {
            color = "red";
        }
        this.set_applet_icon_path(this._appletDir + "/icons/battery-" + color + "-" + direction + ".svg");

        // Solar icon: 3 states based on thresholds
        // Green >>: significant export (P_Grid negative and above export threshold)
        // Red <<: significant import (P_Grid positive and above export threshold)
        // Blue neutral: everything in between (low production or low grid exchange)
        const pvActive = pPV !== null && pPV > this.threshold_production;
        const gridAbs = pGrid !== null ? Math.abs(pGrid) : 0;
        const significantGrid = gridAbs >= this.threshold_export;
        let solarIcon;
        if (significantGrid && pGrid < 0) {
            solarIcon = "solar-export";    // green >>
        } else if (significantGrid && pGrid > 0) {
            solarIcon = "solar-import";    // red <<
        } else {
            solarIcon = "solar-neutral";   // blue =
        }
        this._setSolarIcon(this._appletDir + "/icons/" + solarIcon + ".svg");

        // Label: just SOC%
        this.set_applet_label(`${Math.round(soc)}%`);

        // Tooltip
        const battPower = pAkku !== null ? Math.abs(pAkku) : 0;
        const battStatus = charging ? _("Charging") : _("Discharging");
        const gridPower = pGrid !== null ? Math.abs(pGrid) : 0;
        const gridStatus = (pGrid !== null && pGrid < 0) ? _("Exporting") : _("Importing");
        const pvPower = pPV !== null ? pPV : 0;

        this.set_applet_tooltip(
            _("Battery: %s%% (%s %s)").format(Math.round(soc), battStatus, this._formatPower(battPower)) + "\n" +
            _("PV Power: %s").format(this._formatPower(pvPower)) + "\n" +
            _("Grid: %s %s").format(gridStatus, this._formatPower(gridPower))
        );
    }

    _checkAlert(soc, charging) {
        if (!this.alert_enabled) {
            return;
        }

        const action = evaluateAlert(
            soc, charging, this.alert_soc, this.alert_rearm_drop, this._alertArmed
        );

        if (action === "fire") {
            this._alertArmed = false;
            this._showAlert(soc);
        } else if (action === "rearm") {
            this._alertArmed = true;
        }
    }

    _showAlert(soc) {
        const title = _("Battery charged");
        const body = _("The battery reached %s%% (alert level: %s%%).")
            .format(Math.round(soc), this.alert_soc);

        if (this.alert_mode === "notification" || this.alert_mode === "both") {
            Main.criticalNotify(title, body, this._alertIcon());
        }
        if (this.alert_mode === "dialog" || this.alert_mode === "both") {
            this._showAlertDialog(title, body);
        }
    }

    // MessageTray.Notification adds the icon to its table, so this has to be an actor,
    // not a Gio.Icon.
    _alertIcon() {
        const file = Gio.File.new_for_path(this._appletDir + "/icons/battery-green-charging.svg");
        return new St.Icon({
            gicon: new Gio.FileIcon({ file: file }),
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 24
        });
    }

    _showAlertDialog(title, description) {
        if (this._alertDialog) {
            return;
        }

        const dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.add_child(new Dialog.MessageDialogContent({ title, description }));
        dialog.setButtons([
            {
                label: _("OK"),
                action: () => {
                    this._alertDialog = null;
                    dialog.destroy();
                },
                key: Clutter.KEY_Escape,
                default: true
            }
        ]);

        this._alertDialog = dialog;
        dialog.open();
    }

    _checkRestTriggers(soc, pAkku) {
        if (!this.rest_enabled) {
            return;
        }

        const action = determineRestAction(
            soc, pAkku, this.rest_charge_watts, this.rest_off_soc
        );

        // Neutral does not reset rest_last_action: the plug stays in its last commanded
        // state until the opposite condition is actually met.
        if (action === null) {
            this._pendingRestAction = null;
            this._pendingRestCount = 0;
            return;
        }

        if (action === this._pendingRestAction) {
            this._pendingRestCount++;
        } else {
            this._pendingRestAction = action;
            this._pendingRestCount = 1;
        }

        if (this._pendingRestCount < this.rest_confirm_polls) {
            return;
        }
        if (action === this.rest_last_action) {
            return;
        }

        this._fireRest(action, true);
    }

    onTestRestOn() {
        this._fireRest("on", false);
    }

    onTestRestOff() {
        this._fireRest("off", false);
    }

    /**
     * @commit: when true, a successful call is remembered as the new plug state.
     *          Test-button calls pass false so they do not disturb the state machine.
     */
    _fireRest(action, commit) {
        if (this._restInFlight) {
            return;
        }

        const url = action === "on" ? this.rest_on_url : this.rest_off_url;
        if (!url) {
            global.logWarning("battery-view: no URL configured for REST action '" + action + "'");
            return;
        }

        const method = (action === "on" ? this.rest_on_method : this.rest_off_method) || "GET";
        const body = action === "on" ? this.rest_on_body : this.rest_off_body;
        const contentType =
            (action === "on" ? this.rest_on_content_type : this.rest_off_content_type)
            || "application/json";

        const message = Soup.Message.new(method, url);
        if (!message) {
            global.logError("battery-view: invalid REST URL: " + url);
            return;
        }

        if (method === "POST" && body) {
            message.set_request_body_from_bytes(
                contentType,
                GLib.Bytes.new(ByteArray.fromString(body))
            );
        }

        this._restInFlight = true;
        this._httpSession.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                this._restInFlight = false;
                try {
                    this._httpSession.send_and_read_finish(result);
                    const status = message.get_status();
                    if (status < 200 || status >= 300) {
                        global.logError(
                            "battery-view: REST '" + action + "' returned HTTP " + status
                        );
                        return;
                    }
                    // Only commit on success, so a failed call is retried on the next poll.
                    if (commit) {
                        this.rest_last_action = action;
                    }
                    global.log("battery-view: REST '" + action + "' called: " + method + " " + url);
                } catch (e) {
                    global.logError("battery-view: REST '" + action + "' failed: " + e.message);
                }
            }
        );
    }

    _setSolarIcon(path) {
        const file = Gio.File.new_for_path(path);
        const gicon = new Gio.FileIcon({ file: file });
        this._solarIcon.set_gicon(gicon);
    }

    _formatPower(watts) {
        if (Math.abs(watts) >= 1000) {
            return (watts / 1000).toFixed(1) + " kW";
        }
        return Math.round(watts) + " W";
    }

    _setErrorState() {
        this.set_applet_icon_path(this._appletDir + "/icons/battery-error.svg");
        this._setSolarIcon(this._appletDir + "/icons/solar-import.svg");
        this.set_applet_label("--%");
        this.set_applet_tooltip(_("Connection error: Inverter not reachable"));
    }

    on_applet_removed_from_panel() {
        this._stopPolling();
        if (this._alertDialog) {
            this._alertDialog.destroy();
            this._alertDialog = null;
        }
        if (this._httpSession) {
            this._httpSession.abort();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SolarBatteryApplet(metadata, orientation, panel_height, instance_id);
}
