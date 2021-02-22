const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;

const getDBusProxyWithOwnerPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusProxyWithOwnerAsync(...Object.values(arguments), (p, e) => {
            resolve(p)
        })
    })
}

const getDBusPropertiesPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusPropertiesAsync(...Object.values(arguments), (p, e) => {
            resolve(p)
        })
    })
}

const getDBusPromise = function () {
    return new Promise((resolve, reject) => {
        getDBusAsync((p, e) => {
            resolve(p)
        })
    })
}