"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenUrl = exports.SpawnProcess = void 0;
const logger_1 = require("./logger");
const { spawnCommandLineAsyncIO } = imports.misc.util;
async function SpawnProcess(command) {
    let cmd = "";
    for (let index = 0; index < command.length; index++) {
        const element = command[index];
        cmd += "'" + element + "' ";
    }
    try {
        let json = await new Promise((resolve, reject) => {
            spawnCommandLineAsyncIO(cmd, (aStdout, err, exitCode) => {
                if (exitCode != 0) {
                    reject(err);
                }
                else {
                    resolve(aStdout);
                }
            });
        });
        return json;
    }
    catch (e) {
        logger_1.Log.Instance.Error("Error calling command " + cmd + ", error: ");
        global.log(e);
        return null;
    }
}
exports.SpawnProcess = SpawnProcess;
function OpenUrl(element) {
    if (!element.url)
        return;
    imports.gi.Gio.app_info_launch_default_for_uri(element.url, global.create_app_launch_context());
}
exports.OpenUrl = OpenUrl;
