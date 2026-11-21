/*
 * Public IP Cinnamon applet
 * Public IP: https://l2.io/ip.json
 * Country:   https://ipwho.is/<ip>
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "public-ip-cinnamon@mindwork64";
const IP_URL = "https://l2.io/ip.json";
const COUNTRY_URL = "https://ipwho.is/";
const REQUEST_TIMEOUT = 8;
const FALLBACK_INTERVAL_SECONDS = 30;
const MIN_REFRESH_GAP_SECONDS = 3;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

let NM = null;
let nmAvailable = false;

try {
    NM = imports.gi.NM;
    nmAvailable = true;
} catch (e) {
    global.logWarning(UUID + ": NetworkManager GI unavailable; using timer fallback: " + e);
}

class PublicIPApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.set_applet_label("…");
        this.set_applet_tooltip(_("Checking public IP…"));

        this._ip = null;
        this._country = null;
        this._countryCode = null;
        this._busy = false;
        this._removed = false;
        this._refreshAgain = false;
        this._lastRefresh = 0;
        this._lastNetworkSignature = null;
        this._timerId = 0;
        this._debounceId = 0;
        this._retryRefreshId = 0;
        this._nmClient = null;
        this._nmSignals = [];
        this._deviceSignals = [];

        this._menu = new Applet.AppletPopupMenu(this, orientation);
        this._statusItem = new PopupMenu.PopupMenuItem(_("Not checked yet"), { reactive: false });
        this._refreshItem = new PopupMenu.PopupMenuItem(_("Refresh now"));
        this._refreshItem.connect("activate", () => this._requestRefresh(true));
        this._menu.addMenuItem(this._statusItem);
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addMenuItem(this._refreshItem);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this._menu);

        this._startNetworkMonitoring();
        this._checkNetworkSignature();
        this._requestRefresh(true);

        // Safety net and fallback for VPN implementations not reported by NM.
        this._timerId = Mainloop.timeout_add_seconds(FALLBACK_INTERVAL_SECONDS, () => {
            this._checkNetworkSignature();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _startNetworkMonitoring() {
        if (!nmAvailable)
            return;
        try {
            this._nmClient = NM.Client.new(null);
            if (!this._nmClient)
                throw new Error("NM.Client.new returned null");

            this._nmSignals.push([this._nmClient,
                this._nmClient.connect("device-added", () => this._networkChanged(_("a network device was added")))]);
            this._nmSignals.push([this._nmClient,
                this._nmClient.connect("device-removed", () => this._networkChanged(_("a network device was removed")))]);
            this._nmSignals.push([this._nmClient,
                this._nmClient.connect("notify::active-connections", () => this._networkChanged(_("active connections changed")))]);

            this._attachDeviceSignals();
            this._nmSignals.push([this._nmClient,
                this._nmClient.connect("notify::devices", () => {
                    this._attachDeviceSignals();
                    this._networkChanged(_("the device list changed"));
                })]);
        } catch (e) {
            global.logWarning(UUID + ": NetworkManager monitoring failed; timer fallback enabled: " + e);
            this._disconnectSignals(this._nmSignals);
            this._disconnectSignals(this._deviceSignals);
            this._nmClient = null;
        }
    }

    _attachDeviceSignals() {
        if (!this._nmClient)
            return;
        this._disconnectSignals(this._deviceSignals);
        try {
            let devices = this._nmClient.get_devices();
            for (let i = 0; i < devices.length; i++) {
                let device = devices[i];
                let id = device.connect("state-changed", () => this._networkChanged(_("an interface state changed")));
                this._deviceSignals.push([device, id]);
            }
        } catch (e) {
            global.logWarning(UUID + ": Could not attach device state listeners: " + e);
        }
    }

    _disconnectSignals(items) {
        for (let i = 0; i < items.length; i++) {
            try {
                if (items[i][0])
                    items[i][0].disconnect(items[i][1]);
            } catch (e) {
                // Object may already have been destroyed by NetworkManager.
            }
        }
        items.length = 0;
    }

    _networkChanged(reason) {
        if (this._removed)
            return;
        this._statusItem.label.text = _("Refreshing public IP after %s.").format(reason);
        if (this._debounceId)
            Mainloop.source_remove(this._debounceId);
        this._debounceId = Mainloop.timeout_add_seconds(2, () => {
            this._debounceId = 0;
            this._requestRefresh(false);
            return GLib.SOURCE_REMOVE;
        });
    }

    _getNetworkSignature(callback) {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ["ip", "-o", "link", "show"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            callback(null, _("Could not start ip: %s").format(e));
            return;
        }

        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                if (!ok || source.get_exit_status() !== 0) {
                    callback(null, (stderr || _("Could not read network interfaces.")).trim());
                    return;
                }

                let signature = stdout.split(/\r?\n/)
                    .filter(line => line.trim().length > 0)
                    .map(line => {
                        let match = line.match(/^\d+:\s+([^:@]+)(?:@[^:]+)?:\s+<([^>]*)>/);
                        if (!match)
                            return line.trim();
                        let flags = match[2].split(",").sort().join(",");
                        return match[1] + ":" + flags;
                    })
                    .sort()
                    .join("|");

                callback(signature, null);
            } catch (e) {
                callback(null, String(e));
            }
        });
    }

    _checkNetworkSignature() {
        this._getNetworkSignature((signature, error) => {
            if (this._removed)
                return;
            if (error) {
                global.logWarning(UUID + ": Interface scan failed: " + error);
                return;
            }
            if (this._lastNetworkSignature === null) {
                this._lastNetworkSignature = signature;
                return;
            }
            if (signature !== this._lastNetworkSignature) {
                this._lastNetworkSignature = signature;
                this._networkChanged(_("network interfaces changed"));
            }
        });
    }

    _runCurl(url, callback) {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ["curl", "--fail", "--silent", "--show-error", "--location",
                 "--max-time", String(REQUEST_TIMEOUT), "--user-agent",
                 "Public-IP-Cinnamon/1.0", url],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            callback(null, _("Could not start curl: %s").format(e));
            return;
        }
        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                if (!ok || source.get_exit_status() !== 0) {
                    callback(null, (stderr || _("The HTTP request failed.")).trim());
                    return;
                }
                callback(stdout, null);
            } catch (e) {
                callback(null, String(e));
            }
        });
    }

    _requestRefresh(force) {
        if (this._removed)
            return;
        let now = GLib.get_monotonic_time() / 1000000;
        let elapsed = now - this._lastRefresh;
        if (!force && elapsed < MIN_REFRESH_GAP_SECONDS) {
            if (!this._retryRefreshId) {
                let delay = Math.max(1, Math.ceil(MIN_REFRESH_GAP_SECONDS - elapsed));
                this._retryRefreshId = Mainloop.timeout_add_seconds(delay, () => {
                    this._retryRefreshId = 0;
                    this._requestRefresh(true);
                    return GLib.SOURCE_REMOVE;
                });
            }
            return;
        }
        if (this._busy) {
            this._refreshAgain = true;
            return;
        }
        this._busy = true;
        this._lastRefresh = now;
        this._statusItem.label.text = _("Checking public IP…");

        this._runCurl(IP_URL, (body, error) => {
            if (this._removed)
                return;
            if (error) {
                this._finishWithError(_("Could not retrieve the public IP: %s").format(error));
                return;
            }
            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                this._finishWithError(_("l2.io returned invalid JSON."));
                return;
            }
            let ip = data && typeof data.ip === "string" ? data.ip.trim() : "";
            let address = ip ? Gio.InetAddress.new_from_string(ip) : null;
            if (!address) {
                this._finishWithError(_("The l2.io response did not contain a valid IP address."));
                return;
            }
            this._lookupCountry(ip);
        });
    }

    _lookupCountry(ip) {
        this._runCurl(COUNTRY_URL + encodeURIComponent(ip), (body, error) => {
            if (this._removed)
                return;
            if (error) {
                this._ip = ip;
                this._country = null;
                this._countryCode = null;
                this._busy = false;
                this._render();
                this._statusItem.label.text = _("Country lookup failed: %s").format(error);
                this._runQueuedRefresh();
                return;
            }
            try {
                let data = JSON.parse(body);
                if (data.success === false)
                    throw new Error(data.message || _("The geolocation service rejected the request."));
                this._ip = ip;
                this._country = data.country || null;
                this._countryCode = data.country_code || null;
                this._busy = false;
                this._render();
                if (this._country && this._countryCode)
                    this._statusItem.label.text = _("Country: %s (%s)").format(this._country, this._countryCode);
                else if (this._country)
                    this._statusItem.label.text = _("Country: %s").format(this._country);
                else
                    this._statusItem.label.text = _("Country unknown.");
                this._runQueuedRefresh();
            } catch (e) {
                this._ip = ip;
                this._country = null;
                this._countryCode = null;
                this._busy = false;
                this._render();
                this._statusItem.label.text = _("The IP address was retrieved, but the country response could not be parsed.");
                this._runQueuedRefresh();
            }
        });
    }

    _finishWithError(message) {
        this._busy = false;
        if (this._ip)
            this._render();
        else {
            this.set_applet_label(_("IP unavailable"));
            this.set_applet_tooltip(message);
        }
        this._statusItem.label.text = message;
        this._runQueuedRefresh();
    }

    _runQueuedRefresh() {
        if (this._refreshAgain && !this._removed) {
            this._refreshAgain = false;
            Mainloop.timeout_add_seconds(1, () => {
                this._requestRefresh(true);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _flagEmoji(code) {
        if (!code || !/^[A-Za-z]{2}$/.test(code))
            return "";
        let upper = code.toUpperCase();
        return String.fromCodePoint(
            0x1F1E6 + upper.charCodeAt(0) - 65,
            0x1F1E6 + upper.charCodeAt(1) - 65
        );
    }

    _render() {
        if (!this._ip) {
            this.set_applet_label(_("IP unavailable"));
            this.set_applet_tooltip(_("Public IP is not available yet."));
            return;
        }
        let flag = this._flagEmoji(this._countryCode);
        this.set_applet_label((flag ? flag + " " : "") + this._ip);
        let tooltip = _("Public IP: %s").format(this._ip);
        if (this._country)
            tooltip += "\n" + _("Country: %s").format(this._country);
        if (this._countryCode)
            tooltip += "\n" + _("Country code: %s").format(this._countryCode);
        tooltip += "\n" + _("IP source: l2.io");
        this.set_applet_tooltip(tooltip);
    }

    on_applet_clicked(event) {
        this._menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        if (this._timerId)
            Mainloop.source_remove(this._timerId);
        if (this._debounceId)
            Mainloop.source_remove(this._debounceId);
        if (this._retryRefreshId)
            Mainloop.source_remove(this._retryRefreshId);
        this._disconnectSignals(this._nmSignals);
        this._disconnectSignals(this._deviceSignals);
        if (this._menu)
            this._menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new PublicIPApplet(metadata, orientation, panelHeight, instanceId);
}
