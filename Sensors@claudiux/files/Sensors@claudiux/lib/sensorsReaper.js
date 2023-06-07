const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio; // Needed for file infos
//const Util = imports.misc.util;
const Lang = imports.lang;
const Signals = imports.signals;
const Util = require("./lib/util");

const {to_string} = require("./lib/to-string");

const {
  UUID,
  HOME_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  _,
  DEBUG,
  RELOAD,
  QUICK,
  log,
  logError,
  versionCompare
} = require("./lib/constants");

/**
 * Class SensorsReaper
 */
class SensorsReaper {
  constructor(applet, refresh_interval) {
    this.applet = applet;
    this.refresh_interval = refresh_interval; // seconds
    this.last_attempt_DateTime= undefined;  // the last time we checked sensors

    this.sensors_json_data = {};
    this.sensors_program = ""+GLib.find_program_in_path("sensors");
    this.get_sensors_command();

    this.in_fahrenheit = false;
    this.raw_data = {};
    this.data = {
      "temps": {},
      "fans": {},
      "voltages": {},
      "intrusions": {}
    };
    this.isRunning = false;
  }

  get_sensors_command()  {
    if (this.sensors_command != undefined)
      return this.sensors_command;

    //this.sensors_program = GLib.find_program_in_path("sensors");

    if (this.sensors_program) {
      let sensors_version = this.applet.sensors_version;

      if (versionCompare(sensors_version, "3.6.0") >= 0) {
        this.sensors_command = this.sensors_program + " -j";
        this.sensors_is_json_compatible = true
      } else {
        this.sensors_command = this.sensors_program + " -u";
        this.sensors_is_json_compatible = false;
        let command = "%s -v".format(this.sensors_program);
        let subProcess = Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function(stdout, stderr, exitCode) {
          if (exitCode === 0) {
            let output = stdout;
            if (typeof stdout === "object") output = to_string(stdout);
            sensors_version = output.split(" ")[2];
            this.applet.sensors_version = sensors_version;
          }
          subProcess.send_signal(9);
        }));
      }
      return this.sensors_command;
    } else {
      return undefined
    }
  }

  reap_sensors(hide_zero_temp=0, hide_zero_fan=0, hide_zero_voltage=0) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.hide_zero_temp = hide_zero_temp;
    this.hide_zero_fan = hide_zero_fan;
    this.hide_zero_voltage = hide_zero_voltage;
    //if (this.in_fahrenheit)
      //command += "f"; // The -f option of sensors is full of bugs !!!
    if (this.sensors_command != undefined) {
      let subProcess = Util.spawnCommandLineAsyncIO(this.sensors_command, Lang.bind (this, function(stdout, stderr, exitCode) {
        if (exitCode === 0) {
          if (this.sensors_is_json_compatible)
            this._sensors_reaped(stdout);
          else
            this._sensors_reaped(convert_to_json(stdout));
        }
        //Util.unref(subProcess);
        subProcess.send_signal(9);
      }));
    }
  }

  _sensors_reaped(output) {
    //~ global.log("output: "+JSON.stringify(output, null, 4));
    this.raw_data = JSON.parse(output);
    var data = {
      "temps": {},
      "fans": {},
      "voltages": {},
      "intrusions": {}
    };
    let chips = Object.keys(this.raw_data);
    var adapter = "";
    for (let chip of chips) {
      let features = Object.keys(this.raw_data[chip]);

      var complete_name = "";

      for (let feature of features) {
        var feature_dico = {};
        var type_of_feature = "";

        if (feature == "Adapter") {
          adapter = this.raw_data[chip]["Adapter"];
          complete_name = adapter + " " + chip;
          continue;
        }

        let subfeatures =  Object.keys(this.raw_data[chip][feature]);
        var subfeature_name = "";
        for (let subfeature of subfeatures) {
          let subfeat = subfeature;
          subfeature_name = subfeat.substring(subfeature.indexOf("_")+1);

          if (subfeat.startsWith("fan")) {
            if  (type_of_feature === "" &&
                (!this.hide_zero_fan ||
                  (subfeat.endsWith("input") && this.raw_data[chip][feature][subfeat] > 0)
                )
            ) {
              type_of_feature = "fans";
            }
          } else if (subfeat.startsWith("temp")) {
            if  (type_of_feature === "" &&
                (!this.hide_zero_temp ||
                  (subfeat.endsWith("input") && this.raw_data[chip][feature][subfeat] > 0)
                )
            ) {
              type_of_feature = "temps";
            }
          } else if (subfeat.startsWith("intrusion")) {
            if  (type_of_feature === "") {
              type_of_feature = "intrusions";
            }
          } else if (subfeat.startsWith("in")) {
            if  (type_of_feature === "" &&
                (!this.hide_zero_voltage ||
                  (subfeat.endsWith("input") && this.raw_data[chip][feature][subfeat] > 0)
                )
            ) {
              type_of_feature = "voltages";
            }
          }
          feature_dico[subfeature_name] = this.raw_data[chip][feature][subfeat];
        }

        Util.unref(subfeatures);

        if (type_of_feature !== "") {
          data[type_of_feature][complete_name + ": " + feature] = feature_dico;
          type_of_feature = null;
          feature_dico = null;
        }
      }
      complete_name = null;
      Util.unref(features)
    }
    //log("data: " + JSON.stringify(data, null, "\t"));
    this.data = data;
    data = null;
    Util.unref(chips);
    adapter = null;
    this.isRunning = false;
    this.emit("sensors-data-available");
  }

  get_sensors_data() {
    return this.data
  }

  get_sensors_data_formatted_text() {
    return JSON.stringify(this.data, null, "\t");
  }

  set_fahrenheit(fahrenheit=true) {
    this.in_fahrenheit = fahrenheit
  }

  set_celsius(celsius=true) {
    this.in_fahrenheit = !celsius
  }

  set_refresh_interval(interval_in_seconds) {
    this.refresh_interval = interval_in_seconds;
  }

  get_refresh_interval() {
    return this.refresh_interval
  }

  get_refresh_interval_ms() {
    return 1000 * this.refresh_interval
  }
}

function convert_to_json(raw) {
  let ret = {};
  let lines = raw.split("\n");

  var new_chip = true;
  var chip = "";
  var feature = "";
  //~ var subfeature_numbers = {};
  for (let line of lines) {
    if (line.trim() == "") {
      new_chip = true;
      continue;
    }
    if (new_chip) {
      chip = line.trim();
      ret[chip] = {};
      new_chip = false;
      continue;
    }
    if (line.startsWith("Adapter:")) {
      ret[chip]["Adapter"] = line.split(": ")[1];
      continue;
    }
    if (line.startsWith("  ")) {
      let [subfeature, value] = line.trim().split(": ");
      //~ let sf_keys = Object.keys(subfeature_numbers);
      //~ if (sf_keys.indexOf(subfeature) > -1) {
        //~ subfeature_numbers[subfeature] = subfeature_numbers[subfeature] + 1;
        //~ subfeature = subfeature + " - " + subfeature_numbers[subfeature];
      //~ } else {
        //~ subfeature_numbers[subfeature] = 0
      //~ }
      ret[chip][feature][subfeature] = (value*1000/1000).toFixed(3);
      continue;
    }
    feature = line.split(":")[0];
    ret[chip][feature] = {};
  }
  lines = null;
  ret = JSON.stringify(ret, null, "\t");
  log(ret);
  return ret;
}

Signals.addSignalMethods(SensorsReaper.prototype);

module.exports = {SensorsReaper}
