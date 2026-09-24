const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;

const UUID = "openhab-item@phoehnel";

// Import local modules
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
imports.searchPath.unshift(AppletDir);
const HttpClient = imports.httpClient;
const ServerConfig = imports.serverConfig;
const ItemRenderers = imports.itemRenderers;
imports.searchPath.shift();

class OpenHABItemApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.instanceId = instanceId;
        this.orientation = orientation;

        // Item data from OpenHAB
        this._itemData = null;
        this._additionalItemData = {};
        this._pollTimerId = null;
        this._isDestroyed = false;
        this._lastClickTime = 0;
        this._clickTimer = null;
        this._menuAutoCloseTimer = null;

        // Initialize HTTP client and shared config
        this._http = new HttpClient.HttpClient();
        this._serverConfig = new ServerConfig.ServerConfig();

        // Color preview swatch on panel — wrapped in a Bin that centers it
        // so the panel layout doesn't stretch its height
        this._colorSwatch = new St.Widget({
            style: "border-radius: 3px;",
            visible: false,
            reactive: false
        });
        let swatchContainer = new St.Bin({
            y_align: St.Align.MIDDLE,
            x_align: St.Align.MIDDLE,
            style: "margin: 2px 4px;",
            child: this._colorSwatch
        });
        this.actor.add_child(swatchContainer);
        this._colorSwatchContainer = swatchContainer;

        // Set up the panel appearance
        this.set_applet_icon_symbolic_name("network-offline-symbolic");
        this.set_applet_label("OpenHAB");
        this.set_applet_tooltip("OpenHAB Item - Not configured");

        // Create popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Bind settings
        this._bindSettings();

        // Load shared server config if own settings are empty
        this._loadSharedConfig();

        // Scroll-wheel dimmer control directly on panel
        this.actor.connect("scroll-event", this._onScrollEvent.bind(this));

        // Auto-close popup menu on timeout
        this.menu.connect("open-state-changed", this._onMenuOpenStateChanged.bind(this));

        // Start monitoring shared config for changes from other instances
        this._serverConfig.startMonitor(this._onSharedConfigChanged.bind(this));

        // Start polling
        this._startPolling();
    }

    _bindSettings() {
        this.settings = new Settings.AppletSettings(this, UUID, this.instanceId);

        this.settings.bind("serverUrl", "serverUrl", this._onServerSettingsChanged.bind(this));
        this.settings.bind("apiToken", "apiToken", this._onServerSettingsChanged.bind(this));
        this.settings.bind("pollInterval", "pollInterval", this._onPollIntervalChanged.bind(this));
        this.settings.bind("itemName", "itemName", this._onItemChanged.bind(this));
        this.settings.bind("itemLabel", "itemLabel", this._onDisplayChanged.bind(this));
        this.settings.bind("additionalItems", "additionalItems", this._onItemChanged.bind(this));
        this.settings.bind("scrollDimmerItem", "scrollDimmerItem");
        this.settings.bind("scrollDimmerStep", "scrollDimmerStep");
        this.settings.bind("showIcon", "optShowIcon", this._onDisplayChanged.bind(this));
        this.settings.bind("customIcon", "customIcon", this._onDisplayChanged.bind(this));
        this.settings.bind("showLabel", "optShowLabel", this._onDisplayChanged.bind(this));
        this.settings.bind("showState", "optShowState", this._onDisplayChanged.bind(this));
        this.settings.bind("panelTextFormat", "panelTextFormat", this._onDisplayChanged.bind(this));
        this.settings.bind("readOnly", "readOnly", this._onDisplayChanged.bind(this));
        this.settings.bind("doubleClickToggle", "doubleClickToggle");
        this.settings.bind("dimmerShowToggle", "dimmerShowToggle", this._onDisplayChanged.bind(this));
        this.settings.bind("colorShowPercent", "colorShowPercent", this._onDisplayChanged.bind(this));
        this.settings.bind("colorPreviewWidth", "colorPreviewWidth", this._onDisplayChanged.bind(this));
        this.settings.bind("colorPreviewHeight", "colorPreviewHeight", this._onDisplayChanged.bind(this));
        this.settings.bind("popupAutoClose", "popupAutoClose");
        this.settings.bind("popupAutoCloseDelay", "popupAutoCloseDelay");
        this.settings.bind("tooltipShowLabel", "tooltipShowLabel", this._onDisplayChanged.bind(this));
        this.settings.bind("tooltipShowType", "tooltipShowType", this._onDisplayChanged.bind(this));
        this.settings.bind("tooltipShowState", "tooltipShowState", this._onDisplayChanged.bind(this));
        this.settings.bind("tooltipShowName", "tooltipShowName", this._onDisplayChanged.bind(this));
        this.settings.bind("tooltipShowServer", "tooltipShowServer", this._onDisplayChanged.bind(this));
    }

    _loadSharedConfig() {
        this._serverConfig.read((shared) => {
            if (this._isDestroyed) return;
            if (shared) {
                // If our settings are at default/empty and shared config has values, use shared
                if (shared.serverUrl && !this.serverUrl) {
                    this.serverUrl = shared.serverUrl;
                }
                if (shared.apiToken && !this.apiToken) {
                    this.apiToken = shared.apiToken;
                }
                if (shared.pollInterval && this.pollInterval === 30) {
                    this.pollInterval = shared.pollInterval;
                }
            }
        });
    }

    _onSharedConfigChanged(config) {
        if (this._isDestroyed) return;

        // Update own settings from shared config
        let changed = false;
        if (config.serverUrl && config.serverUrl !== this.serverUrl) {
            this.serverUrl = config.serverUrl;
            changed = true;
        }
        if (config.apiToken !== undefined && config.apiToken !== this.apiToken) {
            this.apiToken = config.apiToken;
            changed = true;
        }
        if (config.pollInterval && config.pollInterval !== this.pollInterval) {
            this.pollInterval = config.pollInterval;
        }

        if (changed) {
            this._restartPolling();
        }
    }

    _onServerSettingsChanged() {
        // Write to shared config so other instances pick it up
        this._serverConfig.write({
            serverUrl: this.serverUrl,
            apiToken: this.apiToken,
            pollInterval: this.pollInterval
        });
        this._restartPolling();
    }

    _onPollIntervalChanged() {
        this._serverConfig.write({
            serverUrl: this.serverUrl,
            apiToken: this.apiToken,
            pollInterval: this.pollInterval
        });
        this._restartPolling();
    }

    _onItemChanged() {
        this._itemData = null;
        this._additionalItemData = {};
        this._restartPolling();
    }

    _onDisplayChanged() {
        this._updatePanel();
    }

    // --- Polling ---

    _startPolling() {
        this._stopPolling();

        if (!this.serverUrl || !this.itemName) {
            this._showStatus("setup", "Configure server URL and item name");
            return;
        }

        // Fetch immediately
        this._fetchItem();

        // Set up periodic polling
        this._pollTimerId = Mainloop.timeout_add_seconds(
            this.pollInterval,
            () => {
                if (this._isDestroyed) return GLib.SOURCE_REMOVE;
                this._fetchItem();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopPolling() {
        if (this._pollTimerId) {
            Mainloop.source_remove(this._pollTimerId);
            this._pollTimerId = null;
        }
    }

    _restartPolling() {
        this._startPolling();
    }

    // --- HTTP ---

    _getAdditionalItemNames() {
        if (!this.additionalItems) return [];
        return this.additionalItems.split(",")
            .map(function(s) { return s.trim(); })
            .filter(function(s) { return s.length > 0; });
    }

    _fetchItem() {
        if (this._isDestroyed || !this.serverUrl || !this.itemName) return;

        let baseUrl = this.serverUrl.replace(/\/$/, "");
        let url = baseUrl + "/rest/items/" + encodeURIComponent(this.itemName);

        this._http.get(
            url,
            this.apiToken,
            (responseText) => {
                try {
                    let data = JSON.parse(responseText);
                    this._itemData = data;
                    this._updatePanel();
                    // Don't rebuild menu while it's open — it causes a crash
                    if (!this.menu.isOpen) {
                        this._updateMenu();
                    }
                } catch (e) {
                    this._showStatus("error", "Invalid response from server");
                    global.logError("OpenHAB: Failed to parse response: " + e.message);
                }
            },
            (errorMsg, status) => {
                if (status === 404) {
                    this._showStatus("error", "Item '" + this.itemName + "' not found");
                } else if (status === 401 || status === 403) {
                    this._showStatus("error", "Authentication failed - check API token");
                } else {
                    this._showStatus("offline", "Cannot reach server: " + errorMsg);
                }
                global.logError("OpenHAB: Fetch error for " + this.itemName + ": " + errorMsg);
            }
        );

        // Fetch additional items
        let additionalNames = this._getAdditionalItemNames();
        for (let name of additionalNames) {
            this._fetchAdditionalItem(name, baseUrl);
        }
    }

    _fetchAdditionalItem(name, baseUrl) {
        let url = baseUrl + "/rest/items/" + encodeURIComponent(name);

        this._http.get(
            url,
            this.apiToken,
            (responseText) => {
                try {
                    let data = JSON.parse(responseText);
                    this._additionalItemData[name] = data;
                    if (!this.menu.isOpen) {
                        this._updateMenu();
                    }
                } catch (e) {
                    global.logError("OpenHAB: Failed to parse additional item " + name + ": " + e.message);
                }
            },
            (errorMsg) => {
                global.logError("OpenHAB: Fetch error for additional item " + name + ": " + errorMsg);
            }
        );
    }

    _sendCommandToItem(itemName, command) {
        if (this.readOnly) return;
        if (!this.serverUrl || !itemName) return;

        let url = this.serverUrl.replace(/\/$/, "") + "/rest/items/" + encodeURIComponent(itemName);

        this._http.post(
            url,
            command,
            this.apiToken,
            (responseText, status) => {
                // Refresh after a short delay to let OpenHAB process the command
                if (!this._isDestroyed) {
                    Mainloop.timeout_add(500, () => {
                        this._fetchItem();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            },
            (errorMsg, status) => {
                global.logError("OpenHAB: Command error for " + this.itemName + ": " + errorMsg);
            }
        );
    }

    _sendCommand(command) {
        this._sendCommandToItem(this.itemName, command);
    }

    // --- Panel Display ---

    _updatePanel() {
        if (this._isDestroyed) return;

        if (!this._itemData) {
            if (this.itemName) {
                this.set_applet_label("...");
                this.set_applet_tooltip("Loading " + this.itemName + "...");
            }
            return;
        }

        let data = this._itemData;
        let baseType = data.type ? data.type.split(":")[0] : "String";
        let label = this.itemLabel || data.label || data.name;

        // Auto-populate scroll dimmer for Dimmer items
        if (baseType === "Dimmer" && !this.scrollDimmerItem) {
            this.scrollDimmerItem = this.itemName;
        }

        // Pass unitSymbol into stateDescription so formatState can use it
        let stateDesc = data.stateDescription || {};
        if (data.unitSymbol) stateDesc.unitSymbol = data.unitSymbol;
        let formatOpts = {};
        if (baseType === "Color" && !this.colorShowPercent) {
            formatOpts.hideColorPercent = true;
        }
        let state = ItemRenderers.formatState(baseType, data.state, stateDesc, formatOpts);

        // Icon
        if (this.optShowIcon) {
            if (this.customIcon) {
                if (this.customIcon.endsWith(".svg") || this.customIcon.endsWith(".png")) {
                    this.set_applet_icon_path(this.customIcon);
                } else {
                    this.set_applet_icon_symbolic_name(this.customIcon);
                }
            } else {
                let iconName = ItemRenderers.getIconName(baseType);
                this.set_applet_icon_symbolic_name(iconName);
            }
        } else {
            this.hide_applet_icon();
        }

        // Color swatch on panel for Color items
        if (baseType === "Color" && data.state && data.state !== "NULL" && data.state !== "UNDEF") {
            let parts = data.state.split(",");
            if (parts.length === 3) {
                let h = parseFloat(parts[0]) || 0;
                let s = parseFloat(parts[1]) || 0;
                let b = parseFloat(parts[2]) || 0;
                let hex = ItemRenderers.hsbToHex(h, s, Math.max(b, 5));
                let swatchW = this.colorPreviewWidth || 16;
                let swatchH = this.colorPreviewHeight || 16;
                this._colorSwatch.set_size(swatchW, swatchH);
                this._colorSwatch.set_style(
                    "background-color: " + hex + ";"
                    + " border: 1px solid rgba(255,255,255,0.3);"
                    + " border-radius: 3px;"
                );
                this._colorSwatch.show();
                this._colorSwatchContainer.show();
            } else {
                this._colorSwatch.hide();
                this._colorSwatchContainer.hide();
            }
        } else {
            this._colorSwatch.hide();
            this._colorSwatchContainer.hide();
        }

        // Panel text
        let showText = this.optShowLabel || this.optShowState;
        if (showText) {
            let text = this.panelTextFormat
                .replace("{label}", label)
                .replace("{state}", state)
                .replace("{name}", data.name);
            this.set_applet_label(text);
        } else {
            this.set_applet_label("");
        }

        // Tooltip
        let tooltipParts = [];
        if (this.tooltipShowLabel) tooltipParts.push(label);
        if (this.tooltipShowType) tooltipParts.push("Type: " + data.type);
        if (this.tooltipShowState) tooltipParts.push("State: " + state);
        if (this.tooltipShowName) tooltipParts.push("Item: " + data.name);
        if (this.tooltipShowServer) tooltipParts.push("Server: " + this.serverUrl);
        this.set_applet_tooltip(tooltipParts.join("\n") || "OpenHAB Item");
    }

    _showStatus(status, message) {
        if (this._isDestroyed) return;

        let iconName = ItemRenderers.getStatusIcon(status);
        this.set_applet_icon_symbolic_name(iconName);

        if (status === "setup") {
            this.set_applet_label("Setup");
        } else if (status === "offline") {
            this.set_applet_label("!");
        } else {
            this.set_applet_label("?");
        }

        this.set_applet_tooltip("OpenHAB: " + message);
    }

    // --- Popup Menu ---

    _onMenuOpenStateChanged(menu, isOpen) {
        if (isOpen) {
            this._startAutoCloseTimer();
        } else {
            this._stopAutoCloseTimer();
        }
    }

    _startAutoCloseTimer() {
        this._stopAutoCloseTimer();
        if (!this.popupAutoClose) return;

        let delay = this.popupAutoCloseDelay || 10;
        this._menuAutoCloseTimer = Mainloop.timeout_add_seconds(delay, () => {
            this._menuAutoCloseTimer = null;
            if (this.menu.isOpen) {
                this.menu.close(true);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopAutoCloseTimer() {
        if (this._menuAutoCloseTimer) {
            Mainloop.source_remove(this._menuAutoCloseTimer);
            this._menuAutoCloseTimer = null;
        }
    }

    _updateMenu() {
        if (this._isDestroyed) return;

        this.menu.removeAll();

        let menuOpts = {
            dimmerShowToggle: this.dimmerShowToggle,
            readOnly: this.readOnly
        };

        if (this._itemData) {
            let menuItems = ItemRenderers.buildMenuItems(
                this._itemData,
                this._sendCommand.bind(this),
                menuOpts
            );
            for (let item of menuItems) {
                this.menu.addMenuItem(item);
            }
        }

        // Additional items
        let additionalNames = this._getAdditionalItemNames();
        for (let name of additionalNames) {
            let data = this._additionalItemData[name];
            if (data) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let sendCmd = ((itemName) => (cmd) => {
                    this._sendCommandToItem(itemName, cmd);
                })(name);
                let menuItems = ItemRenderers.buildMenuItems(data, sendCmd, menuOpts);
                for (let item of menuItems) {
                    this.menu.addMenuItem(item);
                }
            }
        }

        if (this._itemData || additionalNames.length > 0) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Refresh button
        let refreshItem = new PopupMenu.PopupIconMenuItem(
            "Refresh",
            "view-refresh-symbolic",
            St.IconType.SYMBOLIC
        );
        refreshItem.connect("activate", () => {
            this._fetchItem();
        });
        this.menu.addMenuItem(refreshItem);

        // Configure button
        let configItem = new PopupMenu.PopupIconMenuItem(
            "Configure...",
            "preferences-system-symbolic",
            St.IconType.SYMBOLIC
        );
        configItem.connect("activate", () => {
            this.configureApplet();
        });
        this.menu.addMenuItem(configItem);
    }

    // --- Applet Events ---

    _isToggleable() {
        if (!this._itemData) return false;
        let baseType = this._itemData.type ? this._itemData.type.split(":")[0] : "";
        return baseType === "Switch" || baseType === "Dimmer";
    }

    on_applet_clicked(event) {
        if (!this.doubleClickToggle || !this._isToggleable()) {
            // Read-only items: open menu immediately
            this._updateMenu();
            this.menu.toggle();
            return;
        }

        let now = Date.now();
        let doubleClickThreshold = 400; // ms

        if (now - this._lastClickTime < doubleClickThreshold) {
            if (this._clickTimer) {
                Mainloop.source_remove(this._clickTimer);
                this._clickTimer = null;
            }
            this._lastClickTime = 0;
            this._onDoubleClick();
            return;
        }

        this._lastClickTime = now;

        this._clickTimer = Mainloop.timeout_add(doubleClickThreshold, () => {
            this._clickTimer = null;
            this._updateMenu();
            this.menu.toggle();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onScrollEvent(actor, event) {
        let scrollItem = this.scrollDimmerItem;
        if (!scrollItem) return Clutter.EVENT_PROPAGATE;

        let direction = event.get_scroll_direction();

        // Determine current value from item data
        let currentValue = 0;
        if (scrollItem === this.itemName && this._itemData) {
            currentValue = parseFloat(this._itemData.state) || 0;
        } else if (this._additionalItemData[scrollItem]) {
            currentValue = parseFloat(this._additionalItemData[scrollItem].state) || 0;
        }

        let step = this.scrollDimmerStep || 5;
        if (direction === Clutter.ScrollDirection.UP) {
            currentValue = Math.min(100, currentValue + step);
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            currentValue = Math.max(0, currentValue - step);
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        this._sendCommandToItem(scrollItem, Math.round(currentValue).toString());
        return Clutter.EVENT_STOP;
    }

    _onDoubleClick() {
        if (!this._itemData) return;

        let baseType = this._itemData.type ? this._itemData.type.split(":")[0] : "";
        let state = this._itemData.state;

        if (baseType === "Switch") {
            this._sendCommand(state === "ON" ? "OFF" : "ON");
        } else if (baseType === "Dimmer") {
            this._sendCommand(state === "0" || state === "OFF" ? "ON" : "OFF");
        }
    }

    on_applet_removed_from_panel() {
        this._isDestroyed = true;
        this._stopPolling();
        this._stopAutoCloseTimer();
        if (this._clickTimer) {
            Mainloop.source_remove(this._clickTimer);
            this._clickTimer = null;
        }
        this._serverConfig.stopMonitor();
        if (this._http) {
            this._http.destroy();
            this._http = null;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new OpenHABItemApplet(metadata, orientation, panelHeight, instanceId);
}
