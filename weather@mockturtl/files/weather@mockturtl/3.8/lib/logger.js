"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
const consts_1 = require("consts");
class Log {
    constructor(_instanceId) {
        this.debug = false;
        this.level = 1;
        this.ID = _instanceId;
        this.appletDir = imports.ui.appletManager.appletMeta[consts_1.UUID].path;
        this.debug = this.DEBUG();
    }
    static get Instance() {
        if (this.instance == null)
            this.instance = new Log();
        return this.instance;
    }
    DEBUG() {
        let path = this.appletDir + "/../DEBUG";
        let _debug = imports.gi.Gio.file_new_for_path(path);
        let result = _debug.query_exists(null);
        if (result)
            this.Print("DEBUG file found in " + path + ", enabling Debug mode");
        return result;
    }
    ;
    Print(message) {
        let msg = "[" + consts_1.UUID + "#" + this.ID + "]: " + message.toString();
        global.log(msg);
    }
    Error(error, e) {
        global.logError("[" + consts_1.UUID + "#" + this.ID + "]: " + error.toString());
        if (e != null)
            global.logError(e.stack);
    }
    ;
    Debug(message) {
        if (this.debug) {
            this.Print(message);
        }
    }
    Debug2(message) {
        if (this.debug && this.level > 1) {
            this.Print(message);
        }
    }
    UpdateInstanceID(instanceID) {
        this.ID = instanceID;
    }
}
exports.Log = Log;
Log.instance = null;
