const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;

var find_program_in_path = (programName, varName) => {
    findProgramViaWhich(programName, (path) => {
        varName = path;
    });
}

var findProgramViaWhich = (programName, callback) => {
    const command = "which " + programName;
    Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
        if (exitCode == 0) {
            const cleanPath = stdout ? stdout.trim().split("\n")[0] : "";
            if (callback) {
                    callback(cleanPath.length > 0 ? cleanPath : null);
            }
        } else {
                callback(null);
        }
    });
}
