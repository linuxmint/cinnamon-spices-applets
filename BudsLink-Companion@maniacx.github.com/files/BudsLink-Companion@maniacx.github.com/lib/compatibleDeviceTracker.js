const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;


const BLUEZ = 'org.bluez';
const OBJ_MANAGER_IFACE = 'org.freedesktop.DBus.ObjectManager';
const FD_PROPS_IFACE = 'org.freedesktop.DBus.Properties';
const DEVICE_IFACE = 'org.bluez.Device1';

const AirpodsUUID = '74ec2172-0bad-4d01-8f77-997b2be0722a';
const SonyUUIDv1 = '96cc203e-5068-46ad-b32d-e316f5e069ba';
const SonyUUIDv2 = '956c7b26-d49a-4ba8-b03f-b17d393cb6e2';
const SamsungMepSppUUID = 'f8620674-a1ed-41ab-a8b9-de9ad655729d';
const NothingBudsUUID = 'aeac4a03-dff5-498f-843a-34487cf133eb';
const MaestroUUID = '25e97ff7-24ce-4c4c-8951-f764a708f7b5';
const BoseBudsUUID = '00000000-deca-fade-deca-deafdecacaff';
const RedmiBudsUUID = '0000fd2d-0000-1000-8000-00805f9b34fb';
const SenhBudsUUID = 'a2129ff3-081b-4c45-8afe-469d9c4842ec';
const GfpsUUID = 'df21fe2c-2515-4fdb-8886-f12c4d67927c';

const CompatibleUUIDs = [
    AirpodsUUID,
    SonyUUIDv1,
    SonyUUIDv2,
    SamsungMepSppUUID,
    NothingBudsUUID,
    MaestroUUID,
    BoseBudsUUID,
    RedmiBudsUUID,
    SenhBudsUUID,
    GfpsUUID,
];

function isCompatible(uuids) {
    return uuids?.some(uuid => CompatibleUUIDs.includes(uuid)) ?? false;
}

var CompatibleDeviceTracker = GObject.registerClass({
    Properties: {
        'device-connected': GObject.ParamSpec.boolean('device-connected', '', '',
            GObject.ParamFlags.READWRITE, false),
    },
}, class CompatibleDeviceTracker extends GObject.Object {
    _init() {
        super._init();
        this._bus = Gio.DBus.system;
        this._devices = new Map();
    }

    async initClient() {
        try {
            const rawManaged = await this._bus.call(
                BLUEZ,
                '/',
                OBJ_MANAGER_IFACE,
                'GetManagedObjects',
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            const managed = rawManaged.get_child_value(0).deepUnpack();

            for (const [path, ifaces] of Object.entries(managed)) {
                if (DEVICE_IFACE in ifaces) {
                    const props = ifaces[DEVICE_IFACE];
                    const paired = props?.Paired?.deepUnpack?.();
                    if (paired) {
                        const connected = props?.Connected?.deepUnpack?.();
                        const uuids = props?.UUIDs?.deepUnpack?.();
                        this._devices.set(path, {connected, uuids});
                    }
                }
            }

            this._propChangeId = this._bus.signal_subscribe(
                BLUEZ,
                FD_PROPS_IFACE,
                'PropertiesChanged',
                null,
                DEVICE_IFACE,
                Gio.DBusSignalFlags.NONE,
                this._onPropertiesChanged.bind(this)
            );

            this._ifaceAddedId = this._bus.signal_subscribe(
                BLUEZ,
                OBJ_MANAGER_IFACE,
                'InterfacesAdded',
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                this._onInterfacesAdded.bind(this)
            );

            this._ifaceRemovedId = this._bus.signal_subscribe(
                BLUEZ,
                OBJ_MANAGER_IFACE,
                'InterfacesRemoved',
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                this._onInterfacesRemoved.bind(this)
            );

            this.deviceConnected = [...this._devices.values()].some(
                ({connected, uuids}) => connected && isCompatible(uuids)
            );
        } catch (e) {
            global.log(e);
        }
    }


    _onInterfacesAdded(conn, sender, emitterPath, iface, signal, params) {
        const [path, ifaces] = params.deepUnpack();

        if (!(DEVICE_IFACE in ifaces))
            return;

        const props = ifaces[DEVICE_IFACE];

        const paired = props?.Paired?.deepUnpack?.();
        if (!paired)
            return;

        const connected = props?.Connected?.deepUnpack?.();
        const uuids = props?.UUIDs?.deepUnpack?.();

        this._devices.set(path, {
            connected,
            uuids,
        });

        this._updateDeviceConnected();
    }

    _onInterfacesRemoved(conn, sender, emitterPath, iface, signal, params) {
        const [path, ifaces] = params.deepUnpack();
        if (!ifaces.includes(DEVICE_IFACE))
            return;

        if (this._devices.delete(path))
            this._updateDeviceConnected();
    }

    _onPropertiesChanged(conn, sender, path, iface, signal, params) {
        const [ifaceName, changed] = params.deepUnpack();
        if (ifaceName !== DEVICE_IFACE)
            return;

        if (!('Connected' in changed || 'Paired' in changed))
            return;

        const device = this._devices.get(path);
        if (!device)
            return;

        if ('Paired' in changed && !changed.Paired.deepUnpack()) {
            this._devices.delete(path);
            this._updateDeviceConnected();
            return;
        }

        if ('Connected' in changed)
            device.connected = changed.Connected.deepUnpack();

        this._devices.set(path, device);

        this._updateDeviceConnected();
    }

    _updateDeviceConnected() {
        const deviceConnected = [...this._devices.values()].some(
            ({connected, uuids}) => connected && isCompatible(uuids)
        );
        if (this.deviceConnected !== deviceConnected)
            this.deviceConnected = deviceConnected;
    }

    destroy() {
        if (this._bus) {
            if (this._propChangeId)
                this._bus.signal_unsubscribe(this._propChangeId);

            if (this._ifaceAddedId)
                this._bus.signal_unsubscribe(this._ifaceAddedId);

            if (this._ifaceRemovedId)
                this._bus.signal_unsubscribe(this._ifaceRemovedId);
        }
        this._devices.clear();
    }
});
