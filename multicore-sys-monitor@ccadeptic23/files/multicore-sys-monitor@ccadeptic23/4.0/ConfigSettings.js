const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;

let tryFn, map, findIndex, filter;

if (typeof require !== 'undefined') {
  const utils = require('./utils');
  tryFn = utils.tryFn;
  map = utils.map;
  findIndex = utils.findIndex;
  filter = utils.filter;
} else {
  const AppletDir = imports.ui.appletManager.applets['multicore-sys-monitor@ccadeptic23'];
  tryFn = AppletDir.utils.tryFn;
  map = AppletDir.utils.map;
  findIndex = AppletDir.utils.findIndex;
  filter = AppletDir.utils.filter;
}

function ConfigSettings(confpath) {
  this._init(confpath);
}

ConfigSettings.prototype = {
  _init: function(confpath) {
    this.path = confpath;
    this.configFile = 'prefs.json';
    this.readSettings();
  },
  getUseProgressiveColors: function() {
    this.readSettings();
    return this._prefs.cpu.useProgressiveColors;
  },
  getByActivity: function() {
    this.readSettings();
    return this._prefs.cpu.byActivity;
  },
  getThickness: function() {
    this.readSettings();
    return this._prefs.thickness;
  },
  getCPUColorList: function() {
    if (this.getByActivity())
      return this._prefs.cpu.colorsByActivity;
    return this._prefs.cpu.colors;
  },
  getMEMColorList: function() {
    return this._prefs.mem.colors;
  },
  getSwapColorList: function() {
    return this._prefs.mem.swapcolors;
  },
  getNETColorList: function() {
    return this.getDeviceColorList('net');
  },
  getDiskColorList: function() {
    return this.getDeviceColorList('disk');
  },
  getDeviceColorList: function(deviceType) {
    let colorList = [];
    for (let i = 0; i < this._prefs[deviceType].devices.length; i++) {
      if (this._prefs[deviceType].devices[i].enabled) {
        colorList = colorList.concat(this._prefs[deviceType].devices[i].colors);
      } else {
        // its cheating but easiest way to turn the devices off while running
        // Todo - remove disabled devices from colorList
        colorList = colorList.concat([[0, 0, 0, 0], [0, 0, 0, 0]]);
      }
    }
    return colorList;
  },
  getDisabledDevices: function(type) {
    let disabledDeviceList = [];
    for (let i = 0; i < this._prefs[type].devices.length; i++) {
      if (!this._prefs[type].devices[i].enabled) {
        disabledDeviceList.push(this._prefs[type].devices[i].id);
      }
    }
    return disabledDeviceList;
  },
  adjustCPUcount: function(newCPUCount) {
    if (this._prefs.cpu.colors.length !== newCPUCount) {
      // only resize colors if necessary
      // incase the config is screwed up fix it
      if (this._prefs.cpu.colors.length <= 0) {
        this._prefs.cpu.colors = [[1, 0, 0, 1]];
      }

      let oldcpucount = this._prefs.cpu.colors.length;
      let newColors = [];
      for (let i = 0; i < newCPUCount; i++) {
        newColors[i] = this._prefs.cpu.colors[i % oldcpucount];
      }
      this._prefs.cpu.colors = newColors;

      this.saveSettings();
    }
  },
  adjustDevices: function(deviceType, newDeviceList) {
    let isChanged = false;

    let interfaceKeys = map(this._prefs[deviceType].devices, function(device) {
      return device.id;
    });
    let newDeviceKeys = map(newDeviceList, function(device) {
      return device.id;
    });
    let removedIds = [];

    for (let i = 0; i < interfaceKeys.length; i++) {
      if (newDeviceKeys.indexOf(interfaceKeys[i]) === -1) {
        removedIds.push(interfaceKeys[i]);
        isChanged = true;
      }
    }

    if (isChanged) {
      this._prefs[deviceType].devices = filter(this._prefs[deviceType].devices, function(device) {
        return removedIds.indexOf(device.id) === -1;
      })
      interfaceKeys = map(this._prefs[deviceType].devices, function(device) {
        return device.id;
      });
    }

    for (let i = 0; i < newDeviceList.length; i++) {
      let refIndex = findIndex(this._prefs[deviceType].devices, function(device) {
        return device.id === newDeviceList[i].id;
      });
      if (interfaceKeys.indexOf(newDeviceList[i].id) === -1) {
        // Use default values
        this._prefs[deviceType].devices.push({
          id: newDeviceList[i].id,
          enabled: refIndex > -1,
          show: true,
          colors: [[1, 1, 1, 0.8], [0, 0, 0, 0.6]]
        });
        isChanged = true;
      } else {
        // reuse it and its values
        if (refIndex > -1) {
          Object.assign(this._prefs[deviceType].devices[refIndex], newDeviceList[i]);
          this._prefs[deviceType].devices[refIndex].show = 4;
        }
      }
    }

    // save only if the devices have changed
    if (isChanged) {
      this.saveSettings();
    }
  },
  updateSettings: function(newprefsContent) {
    tryFn(() => {
      this._prefs = JSON.parse(newprefsContent);
      this.saveSettings();
    }, (e) => {
      global.logError('Error updating settings: ' + e + ' : ' + newprefsContent);
    });
  },
  saveSettings: function() {
    let f = Gio.file_new_for_path(this.path + '/' + this.configFile);
    let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
    let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
    Cinnamon.write_string_to_stream(out, JSON.stringify(this._prefs, null, ' '));
    out.close(null);
  },
  readSettings: function() {
    // Default Settings for preferences in case we cannot find ours
    this._prefs = {
      labelsOn: true,
      thickness: 1,
      refreshRate: 1000,
      labelColor: [0.9333333333333333, 0.9333333333333333, 0.9254901960784314, 1],
      backgroundColor: [1, 1, 1, 0.1],
      cpu: {
        enabled: true,
        width: 40,
        colors: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
      },
      mem: {
        enabled: true,
        width: 40,
        colors: [[1, 1, 1, 1], [0.6, 0.6, 0.6, 0.8], [0.8, 0.8, 0.8, 0.8], [0.9, 0.9, 0.9, 0.1]],
        swapcolors: [[1, 1, 1, 0.15]]
      },
      net: {
        enabled: true,
        autoscale: true,
        logscale: true,
        width: 40,
        devices: []
      },
      disk: {
        enabled: true,
        autoscale: true,
        logscale: true,
        width: 40,
        devices: [
          {
            id: '/',
            enabled: true,
            show: true,
            colors: [[1, 1, 1, 1], [0.6, 0.6, 0.6, 0.8]]
          }
        ]
      }
    };
    let dir = Gio.file_new_for_path(this.path);
    let prefsFile = dir.get_child(this.configFile);
    if (prefsFile.query_exists(null)) {
      let prefsContent = Cinnamon.get_file_contents_utf8_sync(prefsFile.get_path());
      this._prefs = JSON.parse(prefsContent);
      if (typeof this._prefs.labelColor === 'undefined') {
        this._prefs.labelColor = [0.9333333333333333, 0.9333333333333333, 0.9254901960784314, 1];
      }
      return true;
    } else {
      this.saveSettings(); //We dont have a config file so we attempt to make one for next time
      return false;
    }
  }
};
