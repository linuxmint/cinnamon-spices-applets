"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInstallMrisPlugin = exports.checkInstallMpv = void 0;
const notify_1 = require("functions/notify");
const promiseHelpers_1 = require("functions/promiseHelpers");
const CONSTANTS_1 = require("CONSTANTS");
const { file_new_for_path } = imports.gi.Gio;
const { find_program_in_path } = imports.gi.GLib;
function checkInstallMpv() {
    return new Promise(async (resolve, reject) => {
        if (find_program_in_path("mpv"))
            return resolve();
        if (!find_program_in_path("apturl"))
            return reject();
        notify_1.notifySend("Please also install the mpv package.");
        const [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`
            apturl apt://mpv`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}
exports.checkInstallMpv = checkInstallMpv;
function checkInstallMrisPlugin() {
    return new Promise(async (resolve, reject) => {
        if (file_new_for_path(CONSTANTS_1.MPRIS_PLUGIN_PATH).query_exists(null)) {
            return resolve();
        }
        let [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`python3  ${__meta.path}/download-dialog-mpris.py`);
        if (stdout.trim() !== 'Continue') {
            return reject();
        }
        [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`
            wget ${CONSTANTS_1.MPRIS_PLUGIN_URL} -O ${CONSTANTS_1.MPRIS_PLUGIN_PATH}`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}
exports.checkInstallMrisPlugin = checkInstallMrisPlugin;
