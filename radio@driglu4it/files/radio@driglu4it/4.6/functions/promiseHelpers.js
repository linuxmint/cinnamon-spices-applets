"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnCommandLinePromise = exports.getDBusPromise = exports.getDBusPropertiesPromise = exports.getDBusProxyWithOwnerPromise = void 0;
const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;
const { spawnCommandLineAsyncIO } = imports.misc.util;
const getDBusProxyWithOwnerPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusProxyWithOwnerAsync(name, path, (p, e) => {
            resolve(p);
        });
    });
};
exports.getDBusProxyWithOwnerPromise = getDBusProxyWithOwnerPromise;
const getDBusPropertiesPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusPropertiesAsync(name, path, (p, e) => {
            resolve(p);
        });
    });
};
exports.getDBusPropertiesPromise = getDBusPropertiesPromise;
const getDBusPromise = function () {
    return new Promise((resolve, reject) => {
        getDBusAsync((p, e) => {
            resolve(p);
        });
    });
};
exports.getDBusPromise = getDBusPromise;
const spawnCommandLinePromise = function (command) {
    return new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode]);
        });
    });
};
exports.spawnCommandLinePromise = spawnCommandLinePromise;
