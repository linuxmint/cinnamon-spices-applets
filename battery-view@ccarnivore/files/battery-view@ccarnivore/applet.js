const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

const UUID = "battery-view@ccarnivore";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
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

        // Battery icon: color by SOC, direction by charge/discharge
        const charging = pAkku !== null && pAkku < 0;
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
        if (this._httpSession) {
            this._httpSession.abort();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SolarBatteryApplet(metadata, orientation, panel_height, instance_id);
}
