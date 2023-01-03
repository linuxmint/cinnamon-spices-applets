const Util = imports.misc.util
const GLib = imports.gi.GLib

function _launchDialog(type, metadata, callback, deviceName) {
    let args = ["python3", `${metadata.path}/py/dialogs.py`, type, deviceName]
    Util.spawnCommandLineAsyncIO("", callback, {"argv": args});
}

function openSendFilesDialog(metadata, callback, deviceName) {
    _launchDialog("sendfiles", metadata, callback, deviceName)
}

function openSendURLDialog(metadata, callback, deviceName) {
    _launchDialog("sendurl", metadata, callback, deviceName)
}

function openSendSMSDialog(metadata, callback, deviceName) {
    _launchDialog("sendsms", metadata, callback, deviceName)
}

function openSendTextDialog(metadata, callback, deviceName) {
    _launchDialog("sendtext", metadata, callback, deviceName)
}

function openReceivePhotoDialog(metadata, callback, deviceName) {
    _launchDialog("receivephoto", metadata, callback, deviceName)
}
