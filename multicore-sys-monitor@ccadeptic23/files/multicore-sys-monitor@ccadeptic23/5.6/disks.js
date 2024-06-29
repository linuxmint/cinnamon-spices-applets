const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const { spawnCommandLineAsyncIO } = require("util"); //Misc Util
const { to_string } = require("tostring");
var MOUNTED = {};

function getDiskStats() {
  //~ getMounted();
  let mounted = Object.keys(MOUNTED);
  global.log(to_string(mounted));
  let lines = to_string(GLib.file_get_contents("/proc/diskstats")[1]).trim().split("\n");
  for (let line of lines) {
    let diskstat = line.trim().split(/\s+/);
    if (!diskstat[2].startsWith("loop")) {
      global.log(diskstat[2]+": read: "+diskstat[5]+": write: "+diskstat[9])
    }
  }
}

function getMounted() {
  let command = "/bin/bash -c 'mount -l'";
  let subProcess = spawnCommandLineAsyncIO(
    command,
    (out, err, exitCode) => {
      if (exitCode === 0) {
        let lines = out.split("\n");
        for (let line of lines) {
          if (line.trim().length === 0) continue;
          //~ global.log("line.length = "+line.length);
          if (line.includes("ext") || line.includes("vfat") || line.includes("swap")) {
            let mnted = line.trim().split(/\s+/);
            global.log("mounted:"+mnted[0]+" on "+mnted[2]);
            MOUNTED[mnted[0]] = [mnted[0], mnted[2]]
          }
        }
      }
      getDiskStats();
      subProcess.send_signal(9);
    }
  );
}



module.exports = {
  getDiskStats,
  getMounted,
  MOUNTED
}
