declare namespace imports.misc.interfaces {


    interface DBus extends imports.gi.Gio.DBusProxy {
        ListNamesRemote(callback: (names: string[][]) => void): void,
        ListNamesSync(): string[][],
        GetNameOwnerRemote(name: string, callback: (ownerArr: [owner: string]) => void): void,
        GetNameOwnerSync(name: string): [owner: string]
        connectSignal(signal: 'NameOwnerChanged', callback: (proxy: this, nameOwner: string, args: [name: string, old_owner: string, new_owner: string]) => void): number
    }

    export function getDBus(): DBus

    export function getDBusAsync(callback: (proxy: DBus, error: Error | null) => void): void;

    export function getDBusProperties(name: string, path: string): any;

    export function getDBusPropertiesAsync(name: string, path: string, callback: (proxy: any, error?: Error) => void): void;


    type ProxyNames = 'org.cinnamon.SettingsDaemon.Power' | 'org.cinnamon.SettingsDaemon.Power.Screen' | 'org.cinnamon.SettingsDaemon.Power.Keyboard' | 'org.cinnamon.SettingsDaemon.XRANDR_2'

    export function getDBusProxy(which: string): any

    export function getDBusProxyAsync(which: string, callback: (proxy: any, error?: Error) => void): void


    type ProxyWithOwnerNames = 'org.x.StatusIcon' | 'org.mpris.MediaPlayer2.Player' | 'org.mpris.MediaPlayer2'

    export function getDBusProxyWithOwner(which: ProxyWithOwnerNames, owner: string): any

    export function getDBusProxyWithOwnerAsync(which: ProxyWithOwnerNames, owner: string, callback: (proxy: any, error?: Error) => void): void;

}
