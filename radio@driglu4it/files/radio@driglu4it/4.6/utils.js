"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadSongFromYoutube = exports.checkInstallYoutubeDl = exports.checkInstallMrisPlugin = exports.checkInstallMpv = exports.notifySend = exports.getDBusPromise = exports.getDBusPropertiesPromise = exports.getDBusProxyWithOwnerPromise = void 0;
const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { file_new_for_path } = imports.gi.Gio;
const { find_program_in_path } = imports.gi.GLib;
const { get_home_dir } = imports.gi.GLib;
const constants_1 = require("./constants");
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
const notifySend = function (notifactionMsg) {
    const iconPath = `${__meta.path}/icon.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notifactionMsg + '" -i ' + iconPath);
};
exports.notifySend = notifySend;
const spawnCommandLinePromise = function (command) {
    return new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode]);
        });
    });
};
const checkInstallMpv = function () {
    return new Promise(async (resolve, reject) => {
        if (find_program_in_path("mpv"))
            return resolve();
        if (!find_program_in_path("apturl"))
            return reject();
        exports.notifySend("Please also install the mpv package.");
        const [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            apturl apt://mpv`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
};
exports.checkInstallMpv = checkInstallMpv;
const checkInstallMrisPlugin = function () {
    const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so";
    return new Promise(async (resolve, reject) => {
        if (file_new_for_path(constants_1.MPRIS_PLUGIN_PATH).query_exists(null)) {
            return resolve();
        }
        let [stderr, stdout, exitCode] = await spawnCommandLinePromise(`python3  ${__meta.path}/download-dialog-mpris.py`);
        if (stdout.trim() !== 'Continue') {
            return reject();
        }
        [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            wget ${MPRIS_PLUGIN_URL} -O ${constants_1.MPRIS_PLUGIN_PATH}`);
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
};
exports.checkInstallMrisPlugin = checkInstallMrisPlugin;
const checkInstallYoutubeDl = async function () {
    return new Promise(async (resolve, reject) => {
        const [error, version] = await spawnCommandLinePromise('youtube-dl --version');
        if (version && version.trim() === "2021.02.10")
            return resolve();
        if (!find_program_in_path("apturl")) {
            exports.notifySend("Not the correct version of youtube-dl installed. Please install youtube-dl 2021.02.04.1");
            return reject();
        }
        const [stderr, stdout, errMessage] = await spawnCommandLinePromise(`python3  ${__meta.path}/download-dialog-youtube-dl.py`);
        if (stdout.trim() !== 'Continue')
            return reject();
        await spawnCommandLinePromise(`${__meta.path}/install-latest-youtube-dl.sh`);
        return resolve();
    });
};
exports.checkInstallYoutubeDl = checkInstallYoutubeDl;
const downloadSongFromYoutube = async function (song, downloadDir) {
    if (!song)
        return;
    const music_dir_absolut = downloadDir.replace('~', get_home_dir()).replace('file://', '');
    const downloadCommand = `youtube-dl -o "${music_dir_absolut}/%(title)s.%(ext)s"  --extract-audio --audio-format mp3 ytsearch1:"${song.replace('"', '\"')}" --add-metadata --embed-thumbnail`;
    try {
        await exports.checkInstallYoutubeDl();
        exports.notifySend(`Downloading ${song} ...`);
        const [error, stdout] = await spawnCommandLinePromise(downloadCommand);
        if (error)
            throw new Error(error);
        const arrayOfLines = stdout.match(/[^\r\n]+/g);
        const searchString = '[ffmpeg] Destination: ';
        const filePath = (arrayOfLines.find(line => line.includes(searchString)).split(searchString))[1];
        if (!filePath)
            throw new Error("couldn't download song");
        exports.notifySend(`download finished. File saved to ${filePath}`);
    }
    catch (error) {
        const notifyMsg = ("Couldn't download song from Youtube due to an Error.");
        exports.notifySend(notifyMsg + "See Logs for more information");
        global.logError(`${notifyMsg} The following error occured: ${error} `);
    }
};
exports.downloadSongFromYoutube = downloadSongFromYoutube;
