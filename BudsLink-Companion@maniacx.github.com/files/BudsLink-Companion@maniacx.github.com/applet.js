const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];
const {CompatibleDeviceTracker} = Me.lib.compatibleDeviceTracker;
const {DbusClient} = Me.lib.dbusClient;
const {IndicatorIconWidget} = Me.lib.indicatorIconWidget;
const {PanelPopupMenu} = Me.lib.panelPopupMenu;
const {getAccentColor} = Me.lib.colorHelpers;

Gio._promisify(Gio.DBusProxy, 'new');
Gio._promisify(Gio.DBusProxy, 'new_for_bus');
Gio._promisify(Gio.DBusProxy.prototype, 'call');
Gio._promisify(Gio.DBusConnection.prototype, 'call');

Gettext.bindtextdomain('BudsLink-Companion@maniacx.github.com', `${GLib.get_home_dir()}/.local/share/locale`);

class BudsLinkCompanion extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        try {
            this._metadata = metadata;
            this._orientation = orientation;
            this._instanceId = instance_id;
            this.cssfile = `${metadata.path}/stylesheet.css`;
            this._indicator = null;
            this._widgetMap = new Map();
            this._deviceSignalIds = [];
            this._defaultSelectedPath = null;

            this.gIcon = iconName => Gio.icon_new_for_string(
                `${this._metadata.path}/icons/hicolor/scalable/actions/${iconName}`);

            this._settings = new Settings.AppletSettings(this, 'BudsLink-Companion@maniacx.github.com', instance_id);
            this._menuManager = new PopupMenu.PopupMenuManager(this);
            this._menu = new Applet.AppletPopupMenu(this, this._orientation);
            this._menuManager.addMenu(this._menu);

            const {accentColor, fgColor} =  getAccentColor();

            this.widgetInfo = {
                extPath: this._metadata.path,
                accentColor,
                fgColor,
                cbPinned: this._cbPinned.bind(this),
            };

            this._widgetSize = this.getPanelIconSize(St.IconType.SYMBOLIC);

            this._panelIconSizeChangeId = this.panel.connect('icon-size-changed', () => this._onIconchanged());
            this._themeContext = St.ThemeContext.get_for_stage(global.stage);
            this._themeChangedId = this._themeContext.connect('changed', () => {
                this._onIconchanged(true);
                this._rebuildUI();
            });

            this._defaultSelectedPath = this._settings.getValue('default-selected-path');

            this._initializeDbus();
        } catch (e) {
            global.log(`---------- ERROR: ${e}`);
        }
    }

    _initializeDbus() {
        this._dbusClient = new DbusClient(this._instanceId);

        this._deviceAddedId = this._dbusClient.connect('device-added', (_, path, device) => {
            const widget = new PanelPopupMenu(this._settings, this.gIcon, path, device.alias, this.widgetInfo, device.dataHandler, this._menu, true);
            this._menu.addMenuItem(widget);
            this._widgetMap.set(path, {device, widget});
            this._syncIndicator();
        });

        this._deviceRemovedId = this._dbusClient.connect('device-removed', (_, path) => {
            const entry = this._widgetMap.get(path);
            if (entry) {
                entry.widget.destroy();
                this._widgetMap.delete(path);
            }
            this._syncIndicator();
        });

        this._serviceVanishedId = this._dbusClient.connect('service-vanished', () => {
            for (const {widget} of this._widgetMap.values())
                widget.destroy();

            this._syncIndicator();
        });


        this._startTracker();
    }

    async _startTracker() {
        this._tracker = new CompatibleDeviceTracker();
        await this._tracker.initClient();

        this._tracker.connectObject(
            'notify::device-connected',
            () => {
                if (this._tracker.deviceConnected)
                    this._dbusClient.holdService();
                else
                    this._dbusClient.releaseService();
            },
            this
        );

        if (this._tracker.deviceConnected)
            this._dbusClient.holdService();
    }

    _connectDeviceSignals(device) {
        if (!device?.dataHandler)
            return;

        const id1 = device.dataHandler.connect('configuration-changed', () => {
            const icon = device.dataHandler.getConfig().commonIcon;
            this._indicator?.updateProperties(icon);
        });

        const id2 = device.dataHandler.connect('properties-changed', () => {
            const battery = device.dataHandler.getProps().computedBatteryLevel;
            this._indicator?.updateValues(battery);
        });

        this._deviceSignalIds.push([device.dataHandler, id1]);
        this._deviceSignalIds.push([device.dataHandler, id2]);
    }

    _disconnectDeviceSignals() {
        for (const [obj, id] of this._deviceSignalIds) {
            try {
                obj.disconnect(id);
            } catch (e) {
                global.log(`disconnect error: ${e}`);
            }
        }

        this._deviceSignalIds = [];
    }

    _cbPinned(path) {
        this._defaultSelectedPath = path;
        this._syncIndicator();
        this._settings.setValue('default-selected-path', path);
        for (const {widget} of this._widgetMap.values())
            widget.updatePinButton(path);
    }

    _getPrimaryDevice() {
        if (this._widgetMap.size === 0)
            return null;

        const entries = Array.from(this._widgetMap.entries());

        if (entries.length === 1)
            return entries[0][1].device;

        if (this._defaultSelectedPath) {
            const match = entries.find(([path]) => path === this._defaultSelectedPath);
            if (match)
                return match[1].device;
        }

        return entries[entries.length - 1][1].device;
    }

    _syncIndicator() {
        const device = this._getPrimaryDevice();
        if (!device) {
            this._disconnectDeviceSignals();

            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
            this.set_applet_enabled(false);
            this._currentIndicatordevice = null;

            return;
        }

        if (this._currentIndicatordevice !== device.path) {
            this._currentIndicatordevice = device.path;
            this._disconnectDeviceSignals();
            this._connectDeviceSignals(device);
        }

        const deviceIcon = device.dataHandler.getConfig().commonIcon;
        const batteryLevel = device.dataHandler.getProps().computedBatteryLevel;

        if (!this._indicator) {
            this._indicator = new IndicatorIconWidget(
                this._metadata.path,
                deviceIcon,
                batteryLevel,
                this._widgetSize
            );

            this.actor.add_child(this._indicator);
            this.set_applet_enabled(true);
        } else {
            this._indicator?.updateProperties(deviceIcon);
            this._indicator?.updateValues(batteryLevel);
        }
    }

    _onIconchanged(forceUpdate = false) {
        const size = this.getPanelIconSize(St.IconType.SYMBOLIC);

        if (this._widgetSize !== size || forceUpdate) {
            this._widgetSize = size;
            this._indicator?.updateSize(this._widgetSize);
        }
    }

    _rebuildUI() {
        if (this._widgetMap.size === 0)
            return;

        for (const [path, entry] of this._widgetMap.entries()) {
            entry.widget?.destroy();

            const widget = new PanelPopupMenu(
                this._settings,
                this.gIcon,
                path,
                entry.device.alias,
                this.widgetInfo,
                entry.device.dataHandler,
                this._menu,
                true
            );

            this._menu.addMenuItem(widget);
            entry.widget = widget;
        }
    }

    on_applet_clicked() {
        this._menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._tracker?.destroy();

        this._disconnectDeviceSignals();

        if (this._dbusClient) {
            if (this._deviceAddedId)
                this._dbusClient.disconnect(this._deviceAddedId);
            this._deviceAddedId = null;

            if (this._deviceRemovedId)
                this._dbusClient.disconnect(this._deviceRemovedId);
            this._deviceRemovedId = null;

            if (this._serviceVanishedId)
                this._dbusClient.disconnect(this._serviceVanishedId);
            this._serviceVanishedId = null;
        }

        for (const {widget} of this._widgetMap.values())
            widget.destroy();

        this._widgetMap.clear();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        try {
            if (this._panelIconSizeChangeId)
                this.panel.disconnect(this._panelIconSizeChangeId);
        } catch {}
        this._panelIconSizeChangeId = null;

        if (this._themeChangedId)
            this._themeContext.disconnect(this._themeChangedId);
        this._themeChangedId = null;

        if (this._scaleChangedId)
            this._themeContext.disconnect(this._scaleChangedId);
        this._scaleChangedId = null;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new BudsLinkCompanion(metadata, orientation, panel_height, instance_id);
}
