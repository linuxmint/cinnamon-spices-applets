const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio; // Needed for file infos
const Util = imports.misc.util;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const UUID = "temperature@fevimu";

const HOME_DIR = GLib.get_home_dir();
// ++ DEBUG is true only if the DEBUG file is present in this applet directory ($ touch DEBUG)
var _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
const DEBUG = _debug.query_exists(null);

const sensorRegex = /^([\sA-z\w]+[\s|:|\d]{1,4})(?:\s+\+)(\d+\.\d+)°[FC]|(?:\s+\()([a-z]+)(?:[\s=+]+)(\d+\.\d)°[FC],\s([a-z]+)(?:[\s=+]+)(\d+\.\d)/gm;
const cpuIdentifiers = ['Tctl', 'CPU Temperature'];

const _ = function(str) {
  let translation = Gettext.gettext(str);
  if (translation !== str) {
    return translation;
  }
  return Gettext.dgettext(UUID, str);
}

function CPUTemperatureApplet(metadata, orientation, instance_id) {
  this._init(metadata, orientation, instance_id);
}

CPUTemperatureApplet.prototype = {
  __proto__: Applet.TextApplet.prototype,

  _init: function(metadata, orientation, instance_id) {
    Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

    this.orientation = orientation;
    if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    }
    this.on_orientation_changed(orientation); // Initializes for panel orientation

    this.isLooping = true;
    this.waitForCmd = false;
    this.menuItems = [];
    this.state = {};
    this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);

    this.settings.bindProperty(Settings.BindingDirection.IN, 'use-fahrenheit', 'useFahrenheit', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'only-integer-part', 'onlyIntegerPart', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit', 'showUnit', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit-letter', 'showUnitLetter', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'show-label-prefix', 'showLabelPrefix', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'label-prefix', 'labelPrefix', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval');
    this.settings.bindProperty(Settings.BindingDirection.IN, 'change-color', 'changeColor', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'only-colors', 'onlyColors', () => this.on_settings_changed(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "keep_size", "keep_size", null, null);

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

    this.sensorsPath = null;
    Util.spawn_async(['which', 'sensors'], Lang.bind(this, this._detectSensors));

    this.set_applet_tooltip(_('Temperature'));

    this.updateTemperature();
    this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateTemperature());
  },

  on_settings_changed: function() {
    if (this.loopId > 0) {
        Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;
    this.updateTemperature();
    this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateTemperature());
  },

  on_orientation_changed: function (orientation) {
    this.orientation = orientation;
    if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
      if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
        // vertical
        this.isHorizontal = false;
      } else {
        // horizontal
        this.isHorizontal = true;
      }
    } else {
      this.isHorizontal = true;  // Do not check unless >= 3.2
    }
  }, // End of on_orientation_changed

  versionCompare: function(left, right) {
    if (typeof left + typeof right != 'stringstring')
      return false;
    var a = left.split('.'),
        b = right.split('.'),
        i = 0,
        len = Math.max(a.length, b.length);
    for (; i < len; i++) {
      if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
        return 1;
      } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
        return -1;
      }
    }
    return 0;
  }, // End of versionCompare

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

  _detectSensors: function(ret) {
    // detect if sensors is installed
    if (ret != "") {
      this.sensorsPath = ret.toString().split('\n', 1)[0]; // find the path of the sensors
    } else {
      this.sensorsPath = null;
    }

    if (this.sensorsPath) {
      this.title = _('Error');
      this.content = _('Run sensors-detect as root. If it doesn\'t help, click here to report with your sensors output!');
    } else {
      this.title = _('Warning');
      this.content = _('Please install lm_sensors. If it doesn\'t help, click here to report with your sensors output!');
    }
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

    let _monospace = (this.keep_size) ? "temp-monospace" : "applet-box";
    this.actor.set_style_class_name("%s".format(_monospace));


    if (this.sensorsPath && !this.waitForCmd) {
      this.waitForCmd = true;
      Util.spawn_async([this.sensorsPath], Lang.bind(this, this._updateTemperature));
    }

    return true;
  },

  _updateTemperature: function(sensorsOutput) {
    let items = [];
    let tempInfo = null;
    let temp = 0;

    if (sensorsOutput != "") {
      tempInfo = this._findTemperatureFromSensorsOutput(sensorsOutput.toString()); //get temperature from sensors
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
        } else if (tempInfo[i].label.indexOf('Core') > -1) {
          s += tempInfo[i].value;
          n++;
        }
        if (cpuIdentifiers.indexOf(tempInfo[i].label) > -1) {
          temp = tempInfo[i].value;
        }
        items.push(tempInfo[i].label + ': ' + this._formatTemp(tempInfo[i].value));
      }
      if (high > 0 || critical > 0) {
        items.push("");
        items.push(_("Thresholds Info") + ":")
        if (high > 0) items.push("  " + _("High Temp") + ': ' + this._formatTemp(high));
        if (critical > 0) items.push("  " + _("Crit. Temp") + ': ' + this._formatTemp(critical));
      }
      if (packageCount > 0) {
          temp = packageIds / packageCount;
      } else if (n > 0) {
          temp = s / n;
      }
      let label = this._formatTemp(temp);
      if (DEBUG === true) {critical = 53; high = 49;} // <- For tests only.
      if (this.state.changeColor === false) this.state.onlyColors = false;
      if (critical && temp >= critical) {
        this.title = (this.isHorizontal === true && this.state.onlyColors === false) ? _('Critical') + ': ' + label : this._formatTemp(temp, true);
        this.actor.style = (this.state.changeColor === true) ? "background: FireBrick;" : "background: transparent;";
      } else if (high && temp >= high) {
        this.title = (this.isHorizontal === true && this.state.onlyColors === false) ? _('High') + ': ' + label : this._formatTemp(temp, true);
        this.actor.style = (this.state.changeColor === true) ? "background: DarkOrange;" : "background: transparent;";
      } else {
        this.title = this._formatTemp(temp, true);
        this.actor.style = "background: transparent;";
      }
    }

    if (!tempInfo || !temp) {
      // if we don't have the temperature yet, use some known files
      tempInfo = this._findTemperatureFromFiles();
      if (tempInfo.temp) {
        this.title = this._formatTemp(tempInfo.temp, true);
        items.push(_('Current Temperature') + ': ' + this._formatTemp(tempInfo.temp));
        if (tempInfo.crit) {
          items.push(_('Critical Temperature') + ': ' + this._formatTemp(tempInfo.crit));
        }
      }
    }

    if (this.state.showLabelPrefix) {
      this.title = "%s %s".format(this.state.labelPrefix, this.title);
    }

    if (this._applet_label.text !== this.title) {
      this.set_applet_label(this.title);
    }

    if (this.menu.isOpen) {
      this.buildMenu(items);
    } else {
      this.menuItems = items;
    }

    this.waitForCmd = false;

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
          } else if (entries.length > 0 && entries[entries.length - 1].value) {
            entries[entries.length - 1][match[i - 1]] = match[i];
          } else {
            continue;
          }
        }
      }
      if (!entry.label || !entry.value) {
        continue;
      }
      if (entry != {}) entries.push(entry);
    }
    return entries;
  },

  _toFahrenheit: function(c) {
    return 9 / 5 * c + 32;
  },

  _formatTemp: function(t, line_feed = false) {
    let precisionDigits;
    precisionDigits = this.state.onlyIntegerPart ? 0 : 1;
    let value;
    let unit = "";
    let separator = "";
    if (this.state.showUnit) {
      unit = "°";
      separator = (this.isHorizontal || !line_feed) ? " " : (this.state.showUnitLetter) ? "\n" : "";
    } else if (!line_feed) {
      separator = " ";
      unit = "°";
    }

    if (this.state.useFahrenheit) {
      if (this.state.showUnit && this.state.showUnitLetter) unit = "°F";
      value = (
        this._toFahrenheit(t)
          .toFixed(precisionDigits)
          .toString()
      );
    } else {
      if (this.state.showUnit && this.state.showUnitLetter) unit = "°C";
      value = ((Math.round(t * 10) / 10)
      .toFixed(precisionDigits)
      .toString()
      );
    }
    return '%s%s%s'.format(value, separator, unit)
  }
};

function main(metadata, orientation, instance_id) {
  return new CPUTemperatureApplet(metadata, orientation, instance_id);
}
