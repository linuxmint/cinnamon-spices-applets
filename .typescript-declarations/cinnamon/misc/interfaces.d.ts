declare namespace imports.misc.interfaces {

    export function getDBusAsync(callback: Function): void;

    export function getDBusProxyWithOwnerAsync(which: string, owner: string, callback: Function): void;

    export function getDBusPropertiesAsync(name: string, path: string, callback: Function): void;
}
