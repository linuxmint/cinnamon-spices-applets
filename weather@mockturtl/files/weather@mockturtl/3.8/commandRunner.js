"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenUrl = exports.SpawnProcess = exports.SpawnProcessJson = void 0;
const logger_1 = require("./logger");
const { spawnCommandLineAsyncIO } = imports.misc.util;
async function SpawnProcessJson(command) {
    let response = await SpawnProcess(command);
    if (!response.Success)
        return response;
    try {
        response.Data = JSON.parse(response.Data);
    }
    catch (e) {
        logger_1.Log.Instance.Error("Error: Command response is not JSON. The response: " + response.Data);
        response.Success = false;
        response.ErrorData = {
            Code: -1,
            Message: null,
            Type: "jsonParse",
        };
    }
    finally {
        return response;
    }
}
exports.SpawnProcessJson = SpawnProcessJson;
async function SpawnProcess(command) {
    let cmd = "";
    for (let index = 0; index < command.length; index++) {
        const element = command[index];
        cmd += "'" + element + "' ";
    }
    let response = await new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(cmd, (aStdout, err, exitCode) => {
            let result = {
                Success: exitCode == 0,
                ErrorData: null,
                Data: aStdout !== null && aStdout !== void 0 ? aStdout : null
            };
            if (exitCode != 0) {
                result.ErrorData = {
                    Code: exitCode,
                    Message: err !== null && err !== void 0 ? err : null,
                    Type: "unknown"
                };
            }
            resolve(result);
            return result;
        });
    });
    return response;
}
exports.SpawnProcess = SpawnProcess;
function OpenUrl(element) {
    if (!element.url)
        return;
    imports.gi.Gio.app_info_launch_default_for_uri(element.url, global.create_app_launch_context());
}
exports.OpenUrl = OpenUrl;
