declare namespace imports.misc.interfaces {

    export function getDBusAsync(callback: Function): any;

    export function getDBusProxyWithOwnerAsync(which: string, owner: string, callback: Function): any;

    export function getDBusPropertiesAsync(name: string, path: string, callback: Function): any;
}
