"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installMpvWithMpris = void 0;
const promiseHelpers_1 = require("functions/promiseHelpers");
const consts_1 = require("consts");
const GenericNotification_1 = require("ui/Notifications/GenericNotification");
const { find_program_in_path, file_test, FileTest } = imports.gi.GLib;
async function installMpvWithMpris() {
    const mprisPluginDownloaded = checkMprisPluginDownloaded();
    const mpvInstalled = checkMpvInstalled();
    !mprisPluginDownloaded && await downloadMrisPluginInteractive();
    if (!mpvInstalled) {
        const notificationText = `Please ${mprisPluginDownloaded ? '' : 'also'} install the mpv package.`;
        GenericNotification_1.notify({ text: notificationText });
        await installMpvInteractive();
    }
}
exports.installMpvWithMpris = installMpvWithMpris;
function checkMpvInstalled() {
    return find_program_in_path('mpv');
}
function checkMprisPluginDownloaded() {
    return file_test(consts_1.MPRIS_PLUGIN_PATH, FileTest.IS_REGULAR);
}
function installMpvInteractive() {
    return new Promise(async (resolve, reject) => {
        if (checkMpvInstalled())
            return resolve();
        if (!find_program_in_path("apturl"))
            return reject();
        const [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`
            apturl apt://mpv`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}
function downloadMrisPluginInteractive() {
    return new Promise(async (resolve, reject) => {
        if (checkMprisPluginDownloaded()) {
            return resolve();
        }
        let [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`python3  ${__meta.path}/download-dialog-mpris.py`);
        if (stdout.trim() !== 'Continue') {
            return reject();
        }
        [stderr, stdout, exitCode] = await promiseHelpers_1.spawnCommandLinePromise(`
            wget ${consts_1.MPRIS_PLUGIN_URL} -O ${consts_1.MPRIS_PLUGIN_PATH}`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}
