const Util = imports.misc.util
const GLib = imports.gi.GLib

var DialogStatus = {
    SUCCESS: 0,
    CANCEL: 1,
    ERROR: 2
}

var ExitCode = {
    OK: 0,
    CANCEL: 10,
    ARGERROR: 2,
    ERROR: 1
}

function _launchDialog(type, metadata, deviceName, callback) {
    let args = ["python3", `${metadata.path}/py/dialogs.py`, type, deviceName]
    Util.spawnCommandLineAsyncIO("", callback, {"argv": args});
}

function openSendFilesDialog(metadata, deviceName, callback) {
    _launchDialog("sendfiles", metadata, deviceName, function(stdout, stderr, exitCode) {
        switch (exitCode) {
            case ExitCode.OK:
                let filenameArray = JSON.parse(stdout);
    
                if (filenameArray !== null) {
                    callback(DialogStatus.SUCCESS, filenameArray, null);
                } else {
                    callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                }
                break;
            
            case ExitCode.CANCEL:
                callback(DialogStatus.CANCEL, null, null);
                break;
        
            default:
                callback(DialogStatus.ERROR, null, stderr);
                break;
        }
    })
}

function openSendURLDialog(metadata, deviceName, callback) {
    _launchDialog("sendurl", metadata, deviceName, function(stdout, stderr, exitCode) {
        switch (exitCode) {
            case ExitCode.OK:
                let urlString = JSON.parse(stdout);
    
                if (urlString !== null) {
                    callback(DialogStatus.SUCCESS, urlString, null);
                } else {
                    callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                }
                break;
            
            case ExitCode.CANCEL:
                callback(DialogStatus.CANCEL, null, null);
                break;
        
            default:
                callback(DialogStatus.ERROR, null, stderr);
                break;
        }
    })
}

function openSendSMSDialog(metadata, deviceName, callback) {
    _launchDialog("sendsms", metadata, deviceName, function(stdout, stderr, exitCode) {
        switch (exitCode) {
            case ExitCode.OK:
                let smsObject = JSON.parse(stdout);
    
                if (smsObject !== null) {
                    callback(DialogStatus.SUCCESS, smsObject, null);
                } else {
                    callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                }
                break;
            
            case ExitCode.CANCEL:
                callback(DialogStatus.CANCEL, null, null);
                break;
        
            default:
                callback(DialogStatus.ERROR, null, stderr);
                break;
        }
    })
}

function openSendTextDialog(metadata, deviceName, callback) {
    _launchDialog("sendtext", metadata, deviceName, function(stdout, stderr, exitCode) {
        switch (exitCode) {
            case ExitCode.OK:
                let textString = JSON.parse(stdout);
    
                if (textString !== null) {
                    callback(DialogStatus.SUCCESS, textString, null);
                } else {
                    callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                }
                break;
            
            case ExitCode.CANCEL:
                callback(DialogStatus.CANCEL, null, null);
                break;
        
            default:
                callback(DialogStatus.ERROR, null, stderr);
                break;
        }
    })
}

function openReceivePhotoDialog(metadata, deviceName, callback) {
    _launchDialog("receivephoto", metadata, deviceName, function(stdout, stderr, exitCode) {
        switch (exitCode) {
            case ExitCode.OK:
                let photoFilename = JSON.parse(stdout);
    
                if (photoFilename !== null) {
                    callback(DialogStatus.SUCCESS, photoFilename, null);
                } else {
                    callback(DialogStatus.ERROR, null, "Couldn't parse returned JSON data: "+stdout);
                }
                break;
            
            case ExitCode.CANCEL:
                callback(DialogStatus.CANCEL, null, null);
                break;
        
            default:
                callback(DialogStatus.ERROR, null, stderr);
                break;
        }
    })
}
