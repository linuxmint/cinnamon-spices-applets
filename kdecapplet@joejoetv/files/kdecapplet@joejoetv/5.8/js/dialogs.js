const Util = require("misc.util");
const GLib = require("gi.GLib");

const Logging = require("./js/logging.js");
const Utils = require("./js/utils.js");

const LOGGER = new Logging.Logger(Utils.UUID, "dialogs");

const DialogStatus = {
    SUCCESS: 0,
    CANCEL: 1,
    ERROR: 2
}

const ExitCode = {
    OK: 0,
    CANCEL: 10,
    ARGERROR: 2,
    ERROR: 1
}

function _launchDialog(type, metadata, args, callback) {
    let argv = ["python3", `${metadata.path}/py/dialogs.py`, type].concat(args)
    LOGGER.debug(`Starting dialog process with argv: ${args.join(" ")}`)

    Util.spawnCommandLineAsyncIO(
        "",
        function(stdout, stderr, exitCode) {
            switch (exitCode) {
                case ExitCode.OK:
                    try {
                        let result = JSON.parse(stdout);

                        if (result !== null) {
                            callback(DialogStatus.SUCCESS, result, null);
                        } else {
                            callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                        }
                    } catch (error) {
                        callback(DialogStatus.ERROR, null, "Error while parsing returned JSON data: "+error);
                    }
                    break;
                case ExitCode.CANCEL:
                    callback(DialogStatus.CANCEL, null, null);
                    break;
                default:
                    callback(DialogStatus.ERROR, null, stderr);
                    break;
            }
        },
        {"argv": argv}
    );
}

function openSendFilesDialog(metadata, deviceName, callback) {
    _launchDialog("sendfiles", metadata, [deviceName], callback);
}

function openSendURLDialog(metadata, deviceName, callback) {
    _launchDialog("sendurl", metadata, [deviceName], callback);
}

function openSendSMSDialog(metadata, deviceName, callback) {
    _launchDialog("sendsms", metadata, [deviceName], callback);
}

function openSendTextDialog(metadata, deviceName, callback) {
    _launchDialog("sendtext", metadata, [deviceName], callback);
}

function openReceivePhotoDialog(metadata, deviceName, callback) {
    _launchDialog("receivephoto", metadata, [deviceName], callback)
}

function openSelectRemoteDirectoryDialog(metadata, deviceName, mountPoint, directories, callback) {
    _launchDialog("selectdirectory", metadata, [deviceName, mountPoint].concat(directories.flat()), callback)
}
