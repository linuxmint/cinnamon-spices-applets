"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseStream = exports.WriteAsync = exports.OverwriteAndGetIOStream = exports.DeleteFile = exports.LoadContents = exports.FileExists = exports.GetFileInfo = void 0;
const logger_1 = require("./logger");
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
async function GetFileInfo(file) {
    return new Promise((resolve, reject) => {
        file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
            let result = file.query_info_finish(res);
            resolve(result);
            return result;
        });
    });
}
exports.GetFileInfo = GetFileInfo;
async function FileExists(file, dictionary = false) {
    try {
        return file.query_exists(null);
    }
    catch (e) {
        logger_1.Log.Instance.Error("Cannot get file info for '" + file.get_path() + "', error: ");
        global.log(e);
        return false;
    }
}
exports.FileExists = FileExists;
async function LoadContents(file) {
    return new Promise((resolve, reject) => {
        file.load_contents_async(null, (obj, res) => {
            let result, contents = null;
            try {
                [result, contents] = file.load_contents_finish(res);
            }
            catch (e) {
                reject(e);
                return e;
            }
            if (result != true) {
                resolve(null);
                return null;
            }
            if (contents instanceof Uint8Array)
                contents = ByteArray.toString(contents);
            resolve(contents.toString());
            return contents.toString();
        });
    });
}
exports.LoadContents = LoadContents;
async function DeleteFile(file) {
    let result = await new Promise((resolve, reject) => {
        file.delete_async(null, null, (obj, res) => {
            let result = null;
            try {
                result = file.delete_finish(res);
            }
            catch (e) {
                let error = e;
                if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                    resolve(true);
                    return true;
                }
                logger_1.Log.Instance.Error("Can't delete file, reason: ");
                global.log(e);
                resolve(false);
                return false;
            }
            resolve(result);
            return result;
        });
    });
    return result;
}
exports.DeleteFile = DeleteFile;
async function OverwriteAndGetIOStream(file) {
    if (!FileExists(file.get_parent()))
        file.get_parent().make_directory_with_parents(null);
    return new Promise((resolve, reject) => {
        file.replace_readwrite_async(null, false, Gio.FileCreateFlags.NONE, null, null, (source_object, result) => {
            let ioStream = file.replace_readwrite_finish(result);
            resolve(ioStream);
            return ioStream;
        });
    });
}
exports.OverwriteAndGetIOStream = OverwriteAndGetIOStream;
async function WriteAsync(outputStream, buffer) {
    let text = ByteArray.fromString(buffer);
    if (outputStream.is_closed())
        return false;
    return new Promise((resolve, reject) => {
        outputStream.write_bytes_async(text, null, null, (obj, res) => {
            let ioStream = outputStream.write_bytes_finish(res);
            resolve(true);
            return true;
        });
    });
}
exports.WriteAsync = WriteAsync;
async function CloseStream(stream) {
    return new Promise((resolve, reject) => {
        stream.close_async(null, null, (obj, res) => {
            let result = stream.close_finish(res);
            resolve(result);
            return result;
        });
    });
}
exports.CloseStream = CloseStream;
