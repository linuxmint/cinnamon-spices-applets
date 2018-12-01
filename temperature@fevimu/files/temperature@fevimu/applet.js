const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const sensorRegex = /^([\sA-z\w]+[\s|:|\d]{1,4})(?:\s+\+)(\d+\.\d+)°[FC]|(?:\s+\()([a-z]+)(?:[\s=+]+)(\d+\.\d)°[FC],\s([a-z]+)(?:[\s=+]+)(\d+\.\d)/gm;
const cpuIdentifiers = ['Tctl', 'CPU Temperature'];

const _ = function(str) {
  let translation = Gettext.gettext(str);
  if (translation !== str) {
    return translation;
  }
  return Gettext.dgettext('temperature@fevimu', str);
}

function CPUTemperatureApplet(metadata, orientation, instance_id) {
  this._init(metadata, orientation, instance_id);
}

CPUTemperatureApplet.prototype = {
  __proto__: Applet.TextApplet.prototype,

  _init: function(metadata, orientation, instance_id) {
    Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

    this.isLooping = true;
    this.menuItems = [];
    this.state = {};
    this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);

    this.settings.bindProperty(Settings.BindingDirection.IN, 'use-fahrenheit', 'useFahrenheit', this.updateTemperature, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'only-integer-part', 'onlyIntegerPart', this.updateTemperature, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval');

    this.lang = {
      acpi: 'ACPI Adapter',
      pci: 'PCI Adapter',
      virt: 'Virtual Thermal Zone'
    };
    this.statusLabel = new St.Label({
      text: '--',
      style_class: 'temperature-label'
    });

    // Create the popup menu
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.sensorsPath = this._detectSensors();
    if (this.sensorsPath) {
      this.title = _('Error');
      this.content = _('Run sensors-detect as root. If it doesn\'t help, click here to report with your sensors output!');
    } else {
      this.title = _('Warning');
      this.content = _('Please install lm_sensors. If it doesn\'t help, click here to report with your sensors output!');
    }

    this.set_applet_tooltip(_('Temperature'));

    this.updateTemperature();
    this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateTemperature());
  },

  on_applet_clicked: function() {
    this.buildMenu(this.menuItems);
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function() {
    Mainloop.source_remove(this.loopId);
    this.loopId = 0;
    this.isLooping = false;
    this.settings.finalize();
  },

  _detectSensors: function() {
    // detect if sensors is installed
    let ret = GLib.spawn_command_line_sync('which sensors');
    if (ret[0] && ret[3] === 0) {
      return ret[1].toString().split('\n', 1)[0]; // find the path of the sensors
    }
    return null;
  },

  buildMenu: function(items) {
    this.menu.removeAll();
    let isOpen = this.menu.isOpen;
    let section = new PopupMenu.PopupMenuSection(_('Temperature'));
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        section.addMenuItem(new PopupMenu.PopupMenuItem(items[i]));
      }
    } else {
      let item = new PopupMenu.PopupMenuItem(this.content);
      item.connect('activate', function() {
        Util.trySpawn(['xdg-open', 'https://github.com/linuxmint/cinnamon-spices-applets/issues?utf8=%E2%9C%93&q=is%3Aissue+temperature%40fevimu+']);
      });
      section.addMenuItem(item);
    }
    this.menu.addMenuItem(section);
    if (isOpen) {
      this.menu.open();
    }
  },

  updateTemperature: function() {
    if (!this.isLooping) {
      return false;
    }
    let items = [];
    let tempInfo = null;
    let temp = 0;

    if (this.sensorsPath) {
      let sensorsOutput = GLib.spawn_command_line_sync(this.sensorsPath); //get the output of the sensors command

      if (sensorsOutput[0]) {
        tempInfo = this._findTemperatureFromSensorsOutput(sensorsOutput[1].toString()); //get temperature from sensors
      }

      if (tempInfo) {
        let critical = 0;
        let high = 0;
        let packageIds = 0;
        let packageCount = 0;
        let s = 0;
        let n = 0; //sum and count

        for (let i = 0; i < tempInfo.length; i++) {
          if (tempInfo[i].label.indexOf('Package') > -1) {
            critical = tempInfo[i].crit ? tempInfo[i].crit : 0;
            high = tempInfo[i].high ? tempInfo[i].high : 0;
            packageIds += tempInfo[i].value;
            packageCount++;
          }
          if (tempInfo[i].label.indexOf('Core') > -1) {
            s += tempInfo[i].value;
            n++;
          }
          if (cpuIdentifiers.indexOf(tempInfo[i].label) > -1) {
            temp = tempInfo[i].value;
          }
          items.push(tempInfo[i].label + ': ' + this._formatTemp(tempInfo[i].value));
        }
        if (packageCount > 0) {
            temp = packageIds / packageCount;
        } else if (n > 0) {
            temp = s / n;
        }
        let label = this._formatTemp(temp);
        if (critical && temp >= critical) {
          this.title = _('Critical') + ': ' + label;
        } else if (high && temp >= high) {
          this.title = _('High') + ': ' + label;
        } else {
          this.title = label;
        }
      }
    }

    if (!tempInfo || !temp) {
      // if we don't have the temperature yet, use some known files
      tempInfo = this._findTemperatureFromFiles();
      if (tempInfo.temp) {
        this.title = this._formatTemp(tempInfo.temp);
        items.push(_('Current Temperature') + ': ' + this._formatTemp(tempInfo.temp));
        if (tempInfo.crit) {
          items.push(_('Critical Temperature') + ': ' + this._formatTemp(tempInfo.crit));
        }
      }
    }

    if (this._applet_label.text !== this.title) {
      this.set_applet_label(this.title);
    }

    if (this.menu.isOpen) {
      this.buildMenu(items);
    } else {
      this.menuItems = items;
    }

    return true;
  },

  _findTemperatureFromFiles: function() {
    let info = {};
    let tempFiles = [
      // hwmon for new 2.6.39, 3.x linux kernels
      '/sys/class/hwmon/hwmon0/temp1_input',
      '/sys/devices/platform/coretemp.0/temp1_input',
      '/sys/bus/acpi/devices/LNXTHERM:00/thermal_zone/temp',
      '/sys/devices/virtual/thermal/thermal_zone0/temp',
      '/sys/bus/acpi/drivers/ATK0110/ATK0110:00/hwmon/hwmon0/temp1_input',
      // old kernels with proc fs
      '/proc/acpi/thermal_zone/THM0/temperature',
      '/proc/acpi/thermal_zone/THRM/temperature',
      '/proc/acpi/thermal_zone/THR0/temperature',
      '/proc/acpi/thermal_zone/TZ0/temperature',
      // Debian Sid/Experimental on AMD-64
      '/sys/class/hwmon/hwmon0/device/temp1_input'
    ];
    for (let i = 0; i < tempFiles.length; i++) {
      if (GLib.file_test(tempFiles[i], 1 << 4)) {
        let temperature = GLib.file_get_contents(tempFiles[i]);
        if (temperature[0]) {
          info.temp = parseInt(temperature[1]) / 1000;
          break;
        }
      }
    }
    let critFiles = [
      '/sys/devices/platform/coretemp.0/temp1_crit',
      '/sys/bus/acpi/drivers/ATK0110/ATK0110:00/hwmon/hwmon0/temp1_crit',
      // hwmon for new 2.6.39, 3.0 linux kernels
      '/sys/class/hwmon/hwmon0/temp1_crit',
      // Debian Sid/Experimental on AMD-64
      '/sys/class/hwmon/hwmon0/device/temp1_crit'
    ];
    for (let i = 0; i < critFiles.length; i++) {
      if (GLib.file_test(critFiles[i], 1 << 4)) {
        let temperature = GLib.file_get_contents(critFiles[i]);
        if (temperature[0]) {
          info.crit = parseInt(temperature[1]) / 1000;
        }
      }
    }
    return info;
  },

  _findTemperatureFromSensorsOutput: function(txt) {
    let match;
    let entries = [];
    while ((match = sensorRegex.exec(txt)) !== null) {
      if (match.index === sensorRegex.lastIndex) {
          sensorRegex.lastIndex++;
      }
      let entry = {};
      for (let i = 0; i < match.length; i++) {
        if (!match[i]) {
          continue;
        }
        if (i % 2) {
          match[i] = match[i].trim();
          if (match[i].indexOf(':') > -1) {
            entry.label = match[i].replace(/:/, '').trim();
          }
        } else {
          match[i] = parseFloat(match[i].trim());
          if (isNaN(match[i])) {
            continue;
          }
          if (match[i - 1].indexOf(':') > -1) {
            entry.value = match[i];
          } else if (entries[entries.length - 1].value) {
            entries[entries.length - 1][match[i - 1]] = match[i];
          }
        }
      }
      if (!entry.label || !entry.value) {
        continue;
      }
      entries.push(entry);
    }
    return entries;
  },

  _toFahrenheit: function(c) {
    return 9 / 5 * c + 32;
  },

  _formatTemp: function(t) {
    let precisionDigits;
    precisionDigits = this.state.onlyIntegerPart ? 0 : 1;
    if (this.state.useFahrenheit) {
      return (
        this._toFahrenheit(t)
          .toFixed(precisionDigits)
          .toString() + ' °F'
      );
    } else {
      return (Math.round(t * 10) / 10).toFixed(precisionDigits).toString() + ' °C';
    }
  }
};

function main(metadata, orientation, instance_id) {
  return new CPUTemperatureApplet(metadata, orientation, instance_id);
}
