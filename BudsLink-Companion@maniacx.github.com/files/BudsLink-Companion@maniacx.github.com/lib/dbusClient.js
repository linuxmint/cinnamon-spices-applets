const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];
const {createConfig, createProperties, DataHandler} = Me.lib.dataHandler;

const SERVICE_VERSION = '0.0.1';
const ID = 'BudsLink-Companion@maniacx.github.com-Cinnamon-Applet';
const BUS_NAME = 'io.github.maniacx.BudsLink';
const OBJECT_PATH = '/io/github/maniacx/BudsLink';
const MANAGER_IFACE = 'io.github.maniacx.BudsLink.DeviceManager';
const DEVICE_IFACE = 'io.github.maniacx.BudsLink.Device';

const HEARTBEAT_INTERVAL = 120;

async function flatpakExists(appId) {
    const proc = new Gio.Subprocess({
        argv: ['flatpak', 'info', '--app', appId],
        flags: Gio.SubprocessFlags.NONE,
    });

    proc.init(null);

    const ok = await proc.wait_check_async(null);
    return ok;
}

const Device = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_Device',
    Properties: {
        'alias': GObject.ParamSpec.string('alias', 'Alias', '', GObject.ParamFlags.READWRITE, ''),
    },
}, class Device extends GObject.Object {
    _init(path) {
        super._init();
        this.path = path;
        this.dataHandler = new DataHandler(
            createConfig(),
            createProperties()
        );
    }

    async init() {
        this._proxy = await Gio.DBusProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            null,
            BUS_NAME,
            this.path,
            DEVICE_IFACE,
            null
        );

        this._syncInitial();

        this._proxy.connectObject('g-properties-changed', (_, changed) => {
            this._onPropertiesChanged(changed);
        }, this);

        this.dataHandler.connectObject('ui-action', (_, action, value) => {
            this._sendUiAction(action, value);
        }, this);
    }

    _syncInitial() {
        this.alias = this._proxy.get_cached_property('Alias')?.deepUnpack();
        const configStr = this._proxy.get_cached_property('Config')?.unpack();
        const stateStr = this._proxy.get_cached_property('State')?.unpack();

        if (configStr)
            this.dataHandler.setConfig(JSON.parse(configStr));

        if (stateStr)
            this.dataHandler.setProps(JSON.parse(stateStr));
    }

    _onPropertiesChanged(changed) {
        const unpacked = changed.deepUnpack();

        for (const [key, variant] of Object.entries(unpacked)) {
            const value = variant.unpack();

            if (key === 'Alias')
                this.alias = value;

            if (key === 'Config')
                this.dataHandler.setConfig(JSON.parse(value));

            if (key === 'State')
                this.dataHandler.setProps(JSON.parse(value));
        }
    }

    async _sendUiAction(action, value) {
        try {
            await this._proxy.call(
                'UiAction',
                new GLib.Variant('(si)', [action, value]),
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
        } catch (e) {
            global.log(e);
        }
    }
});

var DbusClient = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_DbusClient',
    Signals: {
        'device-added': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_OBJECT],
        },
        'device-removed': {
            param_types: [GObject.TYPE_STRING],
        },
        'service-vanished': {},
    },
}, class DbusClient extends GObject.Object {
    _init(instanceId) {
        super._init();
        this._managerProxy = null;
        this._Id = `${ID}-${instanceId}`;
        this._watchId = 0;
        this._watchId = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            () => this._onServiceAppeared(),
            () => this._onServiceVanished()
        );
    }

    async holdService() {
        try {
            await Gio.DBus.session.call(
                BUS_NAME,
                OBJECT_PATH,
                MANAGER_IFACE,
                'HoldService',
                GLib.Variant.new('(s)', [this._Id]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
            if (!this._heartbeatId) {
                this._heartbeatId = GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    HEARTBEAT_INTERVAL,
                    () => {
                        this.holdService();
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }
        } catch (e) {
            const isInstalled = await flatpakExists(BUS_NAME);
            if (isInstalled)
                global.log(e);
            else
                global.log('APP not installed');
        }
    }

    async releaseService() {
        try {
            if (this._heartbeatId) {
                GLib.source_remove(this._heartbeatId);
                this._heartbeatId = 0;
            }

            await Gio.DBus.session.call(
                BUS_NAME,
                OBJECT_PATH,
                MANAGER_IFACE,
                'ReleaseService',
                GLib.Variant.new('(s)', [this._Id]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
        } catch (e) {
            global.log(e);
        }
    }

    async _onServiceAppeared() {
        if (this._managerProxy)
            return;

        try {
            this._managerProxy = await Gio.DBusProxy.new_for_bus(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                BUS_NAME,
                OBJECT_PATH,
                MANAGER_IFACE,
                null
            );

            const version = await this._managerProxy.call(
                'ServiceVersion',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            const [serviceVersion] = version.deepUnpack();

            if (serviceVersion !== SERVICE_VERSION) {
                this._managerProxy = null;
                return;
            }

            await this._syncDevices();

            this._managerProxy.connectObject('g-signal', (_, sender, signal, params) => {
                if (signal === 'DeviceAdded') {
                    const [path] = params.deepUnpack();
                    this._addDevice(path);
                }

                if (signal === 'DeviceRemoved') {
                    const [path] = params.deepUnpack();
                    this.emit('device-removed', path);
                }
            }, this);
        } catch (e) {
            global.log(e);
        }
    }

    _onServiceVanished() {
        if (this._managerProxy) {
            this._managerProxy.disconnectObject(this);
            this._managerProxy = null;
        }
        this.emit('service-vanished');
    }

    async _syncDevices() {
        const result = await this._managerProxy.call(
            'ListDevices',
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null
        );

        const [devices] = result.deepUnpack();

        /* eslint-disable no-await-in-loop */
        for (const path of devices)
            await this._addDevice(path);
        /* eslint-enable no-await-in-loop */
    }

    async _addDevice(path) {
        const device = new Device(path);
        await device.init();
        this.emit('device-added', path, device);
    }

    destroy() {
        if (this._heartbeatId) {
            GLib.source_remove(this._heartbeatId);
            this._heartbeatId = 0;
        }

        if (this._managerProxy) {
            this._managerProxy.disconnectObject(this);
            this._managerProxy = null;
        }

        if (this._watchId) {
            Gio.bus_unwatch_name(this._watchId);
            this._watchId = 0;
        }
    }
});
