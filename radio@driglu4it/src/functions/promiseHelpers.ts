const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;
const { spawnCommandLineAsyncIO } = imports.misc.util;

import { Dbus } from 'types'

export const getDBusProxyWithOwnerPromise = function (name: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // ts is complaining when using ...Object.values(arguments)
        getDBusProxyWithOwnerAsync(name, path, (p: any, e: Error) => {
            resolve(p)
        })
    })
}


export const getDBusPropertiesPromise = function (name: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // ts is complaining when using ...Object.values(arguments)
        getDBusPropertiesAsync(name, path, (p: any, e: Error) => {
            resolve(p)
        })
    })
}

export const getDBusPromise = function () {
    return new Promise<Dbus>((resolve, reject) => {
        getDBusAsync((p: any, e: Error) => {
            resolve(p)
        })
    })
}

export const spawnCommandLinePromise = function (command: string) {
    return new Promise<[stdout: string | null, stderr: string | null, exitCode: number]>((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode])
        })
    })
}


