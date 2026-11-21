const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;

var find_program_in_path = (programName, varName) => {
    //~ if (Cinnamon.find_program_in_path) {
        //~ Cinnamon.find_program_in_path(programName, (path) => {
            //~ varName = path;
        //~ });
    //~ } else {
        //~ varName = GLib.find_program_in_path(programName);
    //~ }
    findProgramViaWhich(programName, (path) => {
        varName = path;
    });
}

var findProgramViaWhich = (programName, callback) => {
    const command = "which " + programName;
    Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
        if (exitCode == 0) {
            //~ global.log("stdout: " + stdout);
            const cleanPath = stdout ? stdout.trim().split("\n")[0] : "";
            if (callback) {
                //~ global.log("programName: " + programName + " - cleanPath: " + cleanPath);
                callback(cleanPath.length > 0 ? "" + cleanPath : null);
            }
        } else {
                callback(null);
        }
    });
}
