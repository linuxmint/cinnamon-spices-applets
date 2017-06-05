//#!/usr/bin/cjs
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;

function ConfigSettings(confpath) {
  this._init(confpath);
}

ConfigSettings.prototype = {

  _init: function(confpath) {
    this.path = confpath;
    this.conffile = 'prefs.json';

    this.readSettings();
  },

  getCurrentPreferencesString: function() {
    return JSON.stringify(this._prefs);
  },

  getHeight: function() {
    return this._prefs.height;
  },
  getLabelColor: function() {
    return this._prefs.labelColor;
  },
  getBackgroundColor: function() {
    return this._prefs.backgroundColor;
  },
  getLabelsOn: function() {
    return this._prefs.labelsOn;
  },
  getRefreshRate: function() {
    return this._prefs.refreshRate;
  },

  isCPUEnabled: function() {
    return this._prefs.cpu.enabled;
  },
  getCPUColorList: function() {
    return this._prefs.cpu.colors;
  },
  getCPUWidth: function() {
    return this._prefs.cpu.width;
  },

  isMEMEnabled: function() {
    return this._prefs.mem.enabled;
  },
  getMEMColorList: function() {
    return this._prefs.mem.colors;
  },
  getMEMWidth: function() {
    return this._prefs.mem.width;
  },
  getSwapColorList: function() {
    return this._prefs.mem.swapcolors;
  },

  isNETEnabled: function() {
    return this._prefs.net.enabled;
  },
  isDeviceEnabled: function(devtype, devname) {
    return this._prefs[devtype].devices[devname].enabled;
  },
  isNETAutoScaled: function() {
    return this._prefs.net.autoscale;
  },
  isNETLogScaled: function() {
    return this._prefs.net.logscale;
  },
  getNETDisabledDevices: function() {
    var disabledDeviceList = [];
    for (var ifacename in this._prefs.net.devices) {
      if (!this._prefs.net.devices[ifacename].enabled)
        disabledDeviceList.push(ifacename);
    }
    return disabledDeviceList;
  },
  getDeviceColorList: function(devtype) {
    var colorlist = [];
    for (var dname in this._prefs[devtype].devices) {
      if (this.isDeviceEnabled(devtype, dname)) {
        colorlist = colorlist.concat(this._prefs[devtype].devices[dname].colors);
      } else {
        colorlist = colorlist.concat([
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]); //its cheating but easiest way to turn the devices off while running
      }
    }
    return colorlist;
  },
  getNETColorList: function() {
    return this.getDeviceColorList("net");
  },

  getNETWidth: function() {
    return this._prefs.net.width;
  },

  isDiskEnabled: function() {
    return this._prefs.disk.enabled;
  },
  isDiskAutoScaled: function() {
    return this._prefs.disk.autoscale;
  },
  isDiskLogScaled: function() {
    return this._prefs.disk.logscale;
  },
  getDiskWidth: function() {
    return this._prefs.disk.width;
  },
  getDiskDisabledDevices: function() {
    var disabledDeviceList = [];
    for (var dname in this._prefs.disk.devices) {
      if (!this._prefs.disk.devices[dname].enabled)
        disabledDeviceList.push(dname);
    }
    return disabledDeviceList;
  },
  getDiskColorList: function() {
    return this.getDeviceColorList("disk");
  },
  adjustCPUcount: function(newcpucount) {
    if (this._prefs.cpu.colors.length != newcpucount) //only resize colors if necessary
    {
      //incase the config is screwed up fix it
      if (this._prefs.cpu.colors.length <= 0)
        this._prefs.cpu.colors = [
          [1, 0, 0, 1]
        ];

      var oldcpucount = this._prefs.cpu.colors.length;
      var newcolors = [];
      for (var i = 0; i < newcpucount; i++) {
        newcolors[i] = this._prefs.cpu.colors[i % oldcpucount];
      }
      this._prefs.cpu.colors = newcolors;

      //to save or not to save...
      this.saveSettings(); //to save
    }
  },
  adjustDevices: function(devtype, newdevlist) {
    var oldifacecount = Object.keys(this._prefs[devtype].devices).length;
    var ifacekeys = Object.keys(this._prefs[devtype].devices);
    var newdevicesobj = {};
    var ischanged = false;
    for (var i = 0; i < newdevlist.length; i++) {
      if (ifacekeys.indexOf(newdevlist[i]) == -1) {
        //add it with new made up values
        newdevicesobj[newdevlist[i]] = {
          enabled: true,
          show: true,
          colors: [
            [1, 1, 1, 0.8],
            [0, 0, 0, 0.6]
          ]
        };
        ischanged = true;
      } else {
        //reuse it and its values
        newdevicesobj[newdevlist[i]] = this._prefs[devtype].devices[newdevlist[i]];
        newdevicesobj[newdevlist[i]].show = true; //make sure it is not ignored
        delete this._prefs[devtype].devices[newdevlist[i]];
      }
    }

    //add unused ones in config, we should keep them you never know what happened
    for (var devname in this._prefs[devtype].devices) {
      newdevicesobj[devname] = this._prefs[devtype].devices[devname];
      newdevicesobj[devname].show = false;
    }

    this._prefs[devtype].devices = newdevicesobj;
    //to save or not to save... only if the devices have changed
    if (ischanged)
      this.saveSettings(); //to save
  },
  adjustNetInterfaces: function(newdevlist) {
    this.adjustDevices("net", newdevlist);
  },
  adjustDiskDevices: function(newdevlist) {
    this.adjustDevices("disk", newdevlist);
  },
  updateSettings: function(newprefsContent) {
    try {
      this._prefs = JSON.parse(newprefsContent);
      this.saveSettings();
    } catch (e) {
      global.logError("Error updating settings: " + e + " : " + newprefsContent);
    }
  },

  saveSettings: function() {
    let f = Gio.file_new_for_path(this.path + "/" + this.conffile);
    let raw = f.replace(null, false,
      Gio.FileCreateFlags.NONE,
      null);
    let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
    Cinnamon.write_string_to_stream(out, JSON.stringify(this._prefs, null, " "));
    out.close(null);
  },

  readSettings: function() {
    //Default Settings for preferences incase we cannot find ours
    this._prefs = {
      "labelsOn": true,
      "refreshRate": 500,
      "height": 21,
      "labelColor": [0.9333333333333333,0.9333333333333333,0.9254901960784314,1],
      "backgroundColor": [1, 1, 1, 0.1],
      "cpu": {
        "enabled": true,
        "width": 40,
        "colors": [
          [1, 1, 1, 1],
          [1, 1, 1, 1],
          [1, 1, 1, 1],
          [1, 1, 1, 1]
        ]
      },
      "mem": {
        "enabled": true,
        "width": 40,
        "colors": [
          [1, 1, 1, 1],
          [0.6, 0.6, 0.6, 0.8],
          [0.8, 0.8, 0.8, 0.8],
          [0.9, 0.9, 0.9, 0.1]
        ],
        "swapcolors": [
          [1, 1, 1, 0.15]
        ],
      },
      "net": {
        "enabled": true,
        "autoscale": true,
        "logscale": true,
        "width": 40,
        "devices": {
          "eth0": {
            "enabled": true,
            show: true,
            "colors": [
              [1, 1, 1, 0.8],
              [0, 0, 0, 0.6]
            ]
          },
        },
      },
      "disk": {
        "enabled": true,
        "autoscale": true,
        "logscale": true,
        "width": 40,
        "devices": {
          "/": {
            "enabled": true,
            show: true,
            "colors": [
              [1, 1, 1, 1],
              [0.6, 0.6, 0.6, 0.8]
            ]
          },
        },
      }
    };
    try {
      var dir = Gio.file_new_for_path(this.path);
      var prefsFile = dir.get_child(this.conffile);

      var prefsContent = Cinnamon.get_file_contents_utf8_sync(prefsFile.get_path());
      this._prefs = JSON.parse(prefsContent);
      if (typeof this._prefs.labelColor === 'undefined') {
        this._prefs.labelColor = [0.9333333333333333,0.9333333333333333,0.9254901960784314,1];
      }
      return true;
    } catch (e) {
      global.logError('Failed to load prefs.json: ' + e + " Attempting to create it.");
      this.saveSettings(); //We dont have a config file so we attempt to make one for next time
      return false;
    }
  },
};