const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;

function ConfigSettings(confpath) {
  this._init(confpath);
}

ConfigSettings.prototype = {
  _init: function(confpath) {
    this.path = confpath;
    this.configFile = 'prefs.json';
    this.readSettings();
  },
  getCPUColorList: function() {
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
  isDeviceEnabled: function(deviceType, deviceName) {
    return this._prefs[deviceType].devices[deviceName].enabled;
  },
  getNETDisabledDevices: function() {
    let disabledDeviceList = [];
    for (let ifacename in this._prefs.net.devices) {
      if (!this._prefs.net.devices[ifacename].enabled) {
        disabledDeviceList.push(ifacename);
      }
    }
    return disabledDeviceList;
  },
  getDeviceColorList: function(deviceType) {
    let colorList = [];
    // Todo, don't iterate this way
    for (let deviceName in this._prefs[deviceType].devices) {
      if (this.isDeviceEnabled(deviceType, deviceName)) {
        colorList = colorList.concat(this._prefs[deviceType].devices[deviceName].colors);
      } else {
        // its cheating but easiest way to turn the devices off while running
        // Todo - remove disabled devices from colorList
        colorList = colorList.concat([[0, 0, 0, 0], [0, 0, 0, 0]]);
      }
    }
    return colorList;
  },
  getDiskDisabledDevices: function() {
    let disabledDeviceList = [];
    for (let deviceName in this._prefs.disk.devices) {
      if (!this._prefs.disk.devices[deviceName].enabled) {
        disabledDeviceList.push(deviceName);
      }
    }
    return disabledDeviceList;
  },
  getDiskColorList: function() {
    return this.getDeviceColorList('disk');
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
    let interfaceKeys = Object.keys(this._prefs[deviceType].devices);
    let newDevicesObject = {};
    let isChanged = false;
    for (let i = 0; i < newDeviceList.length; i++) {
      if (interfaceKeys.indexOf(newDeviceList[i].id) === -1) {
        //add it with new made up values
        newDevicesObject[newDeviceList[i].id] = {
          enabled: true,
          show: true,
          colors: [[1, 1, 1, 0.8], [0, 0, 0, 0.6]]
        };
        isChanged = true;
      } else {
        //reuse it and its values
        newDevicesObject[newDeviceList[i].id] = this._prefs[deviceType].devices[newDeviceList[i].id];
        newDevicesObject[newDeviceList[i].id].show = true; //make sure it is not ignored
        delete this._prefs[deviceType].devices[newDeviceList[i].id];
      }
    }
    //add unused ones in config, we should keep them you never know what happened
    for (let deviceName in this._prefs[deviceType].devices) {
      newDevicesObject[deviceName] = this._prefs[deviceType].devices[deviceName];
      newDevicesObject[deviceName].show = false;
    }
    this._prefs[deviceType].devices = newDevicesObject;
    // save only if the devices have changed
    if (isChanged) {
      this.saveSettings();
    }
  },
  adjustNetInterfaces: function(newDeviceList) {
    this.adjustDevices('net', newDeviceList);
  },
  adjustDiskDevices: function(newDeviceList) {
    this.adjustDevices('disk', newDeviceList);
  },
  updateSettings: function(newprefsContent) {
    try {
      this._prefs = JSON.parse(newprefsContent);
      this.saveSettings();
    } catch (e) {
      global.logError('Error updating settings: ' + e + ' : ' + newprefsContent);
    }
  },
  saveSettings: function() {
    let f = Gio.file_new_for_path(this.path + '/' + this.configFile);
    let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
    let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
    Cinnamon.write_string_to_stream(out, JSON.stringify(this._prefs, null, ' '));
    out.close(null);
  },
  readSettings: function() {
    //Default Settings for preferences incase we cannot find ours
    this._prefs = {
      labelsOn: true,
      refreshRate: 500,
      height: 21,
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
        devices: {
          eth0: {
            enabled: true,
            show: true,
            colors: [[1, 1, 1, 0.8], [0, 0, 0, 0.6]]
          }
        }
      },
      disk: {
        enabled: true,
        autoscale: true,
        logscale: true,
        width: 40,
        devices: {
          '/': {
            enabled: true,
            show: true,
            colors: [[1, 1, 1, 1], [0.6, 0.6, 0.6, 0.8]]
          }
        }
      }
    };
    let dir = Gio.file_new_for_path(this.path);
    let prefsFile = dir.get_child(this.configFile);
    //let prefsFilePath = prefsFile.get_path();
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
