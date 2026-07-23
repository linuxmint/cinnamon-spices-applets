const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const UUID = "tailscale-manager@inventor96";

class TailscaleManager extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);

        this._tailscaleState = "Stopped";
        this._usingExitNode = false;
        this._exitNodeName = "";
        this._exitNodes = [];
        this._loopId = 0;
        this._acceptRoutes = null;
        this._acceptRoutesError = "";

        this._prevTooltip = "";
        this._prevConnected = false;
        this._prevUsingExitNode = false;
        this._prevExitNodeName = "";
        this._prevExitNodesJson = "";
        this._prevIconColor = "";
        this._prevAcceptRoutes = null;
        this._prevAcceptRoutesError = "";

        this.set_applet_icon_symbolic_name("network-vpn");
        this._applet_icon.style = "color: grey;";
        this.set_applet_tooltip("Tailscale: Disconnected");
        this.hideLabel();

        try {
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "update-interval", "_updateInterval",
                this._onSettingsChanged, null);
        } catch (e) {
            global.logError(e);
        }

        this.buildContextMenu();
        this._refreshStatus();
        this._startLoop();
    }

    buildContextMenu() {
        this._applet_context_menu.removeAll();

        this._headerItem = new PopupMenu.PopupMenuItem("Tailscale Manager", {
            reactive: false
        });
        this._applet_context_menu.addMenuItem(this._headerItem);

        this._statusItem = new PopupMenu.PopupMenuItem("Status: \u2026", {
            reactive: false
        });
        this._applet_context_menu.addMenuItem(this._statusItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._upItem = new PopupMenu.PopupIconMenuItem("Tailscale Up",
            "network-vpn", St.IconType.SYMBOLIC);
        this._upItem.connect('activate', () => {
            Util.spawn(["tailscale", "up"]);
        });
        this._applet_context_menu.addMenuItem(this._upItem);

        this._downItem = new PopupMenu.PopupIconMenuItem("Tailscale Down",
            "network-offline", St.IconType.SYMBOLIC);
        this._downItem.connect('activate', () => {
            Util.spawn(["tailscale", "down"]);
        });
        this._applet_context_menu.addMenuItem(this._downItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._acceptRoutesSwitch = new PopupMenu.PopupSwitchMenuItem("Accept Routes", false);
        this._acceptRoutesSwitch.connect('activate', () => {
            let newState = this._acceptRoutesSwitch.state;
            this._acceptRoutes = newState;
            this._acceptRoutesError = "";
            this._updateAcceptRoutesUI();
            Util.spawn(["tailscale", "set", "--accept-routes=" + (newState ? 'true' : 'false')]);
        });
        this._applet_context_menu.addMenuItem(this._acceptRoutesSwitch);

        this._acceptRoutesErrorItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this._acceptRoutesErrorItem.actor.hide();
        this._applet_context_menu.addMenuItem(this._acceptRoutesErrorItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._exitNodeSubMenu = new PopupMenu.PopupSubMenuMenuItem("Exit Node");
        this._applet_context_menu.addMenuItem(this._exitNodeSubMenu);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._refreshExitNodesItem = new PopupMenu.PopupIconMenuItem("Refresh Exit Nodes",
            "view-refresh", St.IconType.SYMBOLIC);
        this._refreshExitNodesItem.connect('activate', () => {
            this._refreshExitNodes();
        });
        this._applet_context_menu.addMenuItem(this._refreshExitNodesItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._populateExitNodeSubMenu();
    }

    _refreshStatus() {
        let proc = Gio.Subprocess.new(
            ['tailscale', 'status', '--json'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                if (proc.get_successful() && stdout && stdout.length > 0) {
                    let data = JSON.parse(stdout);
                    this._processStatus(data);
                } else {
                    this._tailscaleState = "Stopped";
                    this._updateUI();
                }
            } catch (e) {
                this._tailscaleState = "Stopped";
                this._updateUI();
            }
        });
    }

    _processStatus(data) {
        let oldState = this._tailscaleState;
        this._tailscaleState = data.BackendState || "Stopped";

        let exitNodeName = "";
        if (data.Peer) {
            for (let key in data.Peer) {
                let peer = data.Peer[key];
                if (peer.ExitNode) {
                    exitNodeName = peer.DNSName || peer.HostName || "";
                    if (exitNodeName.endsWith('.')) {
                        exitNodeName = exitNodeName.slice(0, -1);
                    }
                    break;
                }
            }
        }

        if (exitNodeName) {
            this._usingExitNode = true;
            this._exitNodeName = exitNodeName;
        } else {
            this._usingExitNode = false;
            this._exitNodeName = "";
        }

        this._detectAcceptRoutes(() => {
            this._updateUI();

            if ((this._tailscaleState === "Running" &&
                this._exitNodes.length === 0) ||
                (oldState !== "Running" &&
                this._tailscaleState === "Running")) {
                this._refreshExitNodes();
            }
        });
    }

    _refreshExitNodes() {
        let proc = Gio.Subprocess.new(
            ['tailscale', 'exit-node', 'list'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                if (proc.get_successful() && stdout && stdout.length > 0) {
                    this._parseExitNodeList(stdout);
                }
            } catch (e) {
                global.logError(e);
            }
        });
    }

    _parseExitNodeList(output) {
        this._exitNodes = [];
        let lines = output.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;
            let parts = line.split(/\s+/);
            if (parts.length >= 2) {
                this._exitNodes.push({
                    ip: parts[0],
                    hostname: parts[1]
                });
            }
        }
        this._populateExitNodeSubMenu();
    }

    _detectAcceptRoutes(callback) {
        let proc = Gio.Subprocess.new(
            ['tailscale', 'debug', 'prefs'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                if (proc.get_successful()) {
                    let data = JSON.parse(stdout);
                    if (typeof data.RouteAll === 'boolean') {
                        this._acceptRoutes = data.RouteAll;
                        this._acceptRoutesError = "";
                    } else {
                        this._acceptRoutes = null;
                        this._acceptRoutesError = "Cannot detect accept-routes: unexpected output";
                    }
                } else {
                    this._acceptRoutes = null;
                    this._acceptRoutesError = "Cannot detect accept-routes: unexpected output";
                }
            } catch (e) {
                this._acceptRoutes = null;
                this._acceptRoutesError = "Cannot detect accept-routes: unexpected output";
            }
            this._updateAcceptRoutesUI();
            if (callback) callback();
        });
    }

    _updateAcceptRoutesUI() {
        if (this._acceptRoutes === this._prevAcceptRoutes &&
            this._acceptRoutesError === this._prevAcceptRoutesError) {
            return;
        }
        this._prevAcceptRoutes = this._acceptRoutes;
        this._prevAcceptRoutesError = this._acceptRoutesError;

        if (this._acceptRoutes !== null) {
            this._acceptRoutesSwitch.setToggleState(this._acceptRoutes);
            this._acceptRoutesErrorItem.actor.hide();
        } else {
            this._acceptRoutesSwitch.setToggleState(false);
            this._acceptRoutesErrorItem.label.text = this._acceptRoutesError;
            this._acceptRoutesErrorItem.actor.show();
        }
    }

    _populateExitNodeSubMenu() {
        let exitNodesJson = JSON.stringify(this._exitNodes);
        if (exitNodesJson === this._prevExitNodesJson &&
            this._usingExitNode === this._prevUsingExitNode &&
            this._exitNodeName === this._prevExitNodeName) {
            return;
        }
        this._prevExitNodesJson = exitNodesJson;
        this._prevUsingExitNode = this._usingExitNode;
        this._prevExitNodeName = this._exitNodeName;

        this._exitNodeSubMenu.menu.removeAll();

        let noneItem = new PopupMenu.PopupIndicatorMenuItem("None");
        if (!this._usingExitNode) {
            noneItem.setShowDot(true);
        }
        noneItem.connect('activate', () => {
            Util.spawn(["tailscale", "set", "--exit-node="]);
            this._usingExitNode = false;
            this._exitNodeName = "";
            this._updateUI();
        });
        this._exitNodeSubMenu.menu.addMenuItem(noneItem);

        if (this._exitNodes.length > 0) {
            this._exitNodeSubMenu.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem());
        }

        for (let node of this._exitNodes) {
            let label = node.hostname;
            let item = new PopupMenu.PopupIndicatorMenuItem(label);
            if (this._usingExitNode && this._exitNodeName === label) {
                item.setShowDot(true);
            }
            item.connect('activate', () => {
                Util.spawn(["tailscale", "set", "--exit-node=" + label]);
                this._usingExitNode = true;
                this._exitNodeName = label;
                this._updateUI();
            });
            this._exitNodeSubMenu.menu.addMenuItem(item);
        }
    }

    _updateUI() {
        let connected = this._tailscaleState === "Running";
        let tooltip, iconColor;

        if (connected) {
            if (this._usingExitNode && this._exitNodeName) {
                iconColor = "#3584e4";
                tooltip = "Tailscale: Connected via " + this._exitNodeName;
            } else {
                iconColor = "#4DC84D";
                tooltip = "Tailscale: Connected";
            }
        } else {
            iconColor = "grey";
            tooltip = "Tailscale: Disconnected";
        }

        if (tooltip !== this._prevTooltip) {
            this.set_applet_tooltip(tooltip);
            this._prevTooltip = tooltip;
        }

        if (iconColor !== this._prevIconColor) {
            this._applet_icon.style = "color: " + iconColor + ";";
            this._prevIconColor = iconColor;
        }

        if (connected !== this._prevConnected) {
            if (connected) {
                this._statusItem.label.text = "Status: Connected";
                this._upItem.actor.hide();
                this._downItem.actor.show();
            } else {
                this._statusItem.label.text = "Status: Disconnected";
                this._upItem.actor.show();
                this._downItem.actor.hide();
            }
            this._prevConnected = connected;
        }

        this._updateAcceptRoutesUI();
        this._populateExitNodeSubMenu();
    }

    _startLoop() {
        if (this._loopId) {
            Mainloop.source_remove(this._loopId);
        }
        this._loopId = Mainloop.timeout_add_seconds(this._updateInterval, () => {
            this._refreshStatus();
            return true;
        });
    }

    _onSettingsChanged() {
        this._startLoop();
    }

    on_applet_clicked(event) {
        this._refreshStatus();
    }

    on_applet_removed_from_panel() {
        if (this._loopId) {
            Mainloop.source_remove(this._loopId);
            this._loopId = 0;
        }
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new TailscaleManager(metadata, orientation, panelHeight, instance_id);
}
