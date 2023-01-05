const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio; // Needed for file infos
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
//const Gettext = imports.gettext;
const Extension = imports.ui.extension; // Needed to reload this applet
const ModalDialog = imports.ui.modalDialog;
const Lang = imports.lang;

const Util = require("./lib/util");
const {to_string} = require("./lib/to-string");
const {Dependencies} = require("./lib/checkDependencies");

const {
  UUID,
  HOME_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  XS_PATH,
  _,
  DEBUG,
  RELOAD,
  QUICK,
  log,
  logError
} = require("./lib/constants");

const {SensorsReaper} = require("./lib/sensorsReaper");

const ENABLED_APPLETS_KEY = "enabled-applets";

const DEFAULT_APPLET_LABEL = ['🌡', '🤂', '🗲', '⮿'];

/**
 * spawnCommandAsyncAndGetPid:
 *
 * The functions in /usr/share/cinnamon/js/misc/util.js
 * don't return the pid, we need the pid so we can stop sounds
 *
 * @param {string} command
 * @returns {number} process id
 *
 * N.B Code from the pomodoro@gregfreeman.org applet. Thanks to its author.
 * FOR FUTURE DEVELOPMENT
 */
function spawnCommandAsyncAndGetPid(command, callback = null) {
  let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
  if (callback === null)
    flags = flags | GLib.SpawnFlags.STDOUT_TO_DEV_NULL;
  let argv = GLib.shell_parse_argv(command)[1];
  let pid = GLib.spawn_async(null, argv, null, flags, null, null)[1];

  return pid;
}

/**
 * Class SensorsApplet
 */
class SensorsApplet extends Applet.TextApplet {

  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);
    this.orientation = orientation;
    this.instanceId = instance_id;
    this.applet_version = metadata.version;
    this.applet_name = metadata.name;
    this._temp = [];

    // Both types of panel: horizontal and vertical:
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    // To be sure that the scripts will be executable:
    Util.spawnCommandLineAsync("/bin/bash -c 'cd %s && chmod 755 *.py *.sh'".format(SCRIPTS_DIR), null, null);

    // Detect language for numeric format:
    this.num_lang = this._get_lang();

    // To check dependencies:
    this.dependencies = new Dependencies();
    //this.depCount = 0;

    // Applet label:
    this.set_applet_label(this._get_default_applet_label());

    // Applet tooltip:
    this.set_applet_tooltip(_('Sensors Monitor'));
    if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
      this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
    } else {
      this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
    }

    // Applet menu:
    this.pids = []; // pids of all opened windows, about settings, from the menu.
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);

    // get settings defined in settings-schema.json:
    this.get_user_settings();
    this._variables();

    // Style class name:
    let _border_type = (this.remove_border) ? "-noborder" : "";
    this.actor.set_style_class_name("sensors-label%s".format(_border_type));

    // Initialize some properties:
    this.isRunning = false;

    //~ // Permissions on hddtemp:
    //~ this.future_hddtemp_check = Math.ceil(Date.now() / 1000) - 7200;
    //~ this.check_hddtemp_permissions(true);

    // Sensors Reaper:
    this.reaper = new SensorsReaper(this, this.interval);
    this.reaper.reap_sensors(
      this.strictly_positive_temp ? 1 : 0,
      this.strictly_positive_fan ? 1 : 0,
      this.strictly_positive_volt ? 1 : 0
    );

    // Events:
    this._connectIds = [];
    this._connectReaperId = this.reaper.connect("sensors-data-available", () => this.updateUI());
    this._connectIds.push(this.actor.connect("enter-event", (actor, event) => this.on_enter_event(actor, event)));
    this._connectIds.push(this.actor.connect("leave-event", (actor, event) => this.on_leave_event(actor, event)));
  }

  get_user_settings() {
    this.s = new AppletSettings(this, UUID, this.instanceId);

    // General tab
    this.s.bind("has_set_markup", "has_set_markup", null, null);
    this.s.bind("interval", "interval", this.on_settings_changed, null);
    this.s.bind("keep_size", "keep_size", this.updateUI, null);
    this.s.bind("char_size", "char_size", this.updateUI, null);
    this.s.bind("char_color", "char_color", this.updateUI, null);
    this.s.bind("remove_border", "remove_border", this.updateUI, null);
    this.s.bind("remove_icons", "remove_icons", this.updateUI, null);
    this.s.bind("bold_values", "bold_values", this.updateUI, null);
    this.s.bind("bold_italics_main_sensors", "bold_italics_main_sensors", this.updateUI, null);
    this.s.bind("restart_in_menu", "restart_in_menu", null, null);


    if (this._applet_tooltip.set_markup === undefined) {
      this.bold_values = false;
      this.bold_italics_main_sensors = false;
      this.has_set_markup = false;
    } else {
      this.has_set_markup = true;
    }

    // Custom names (generic)
    this.s.bind("custom_names", "custom_names", null, null);

    // sensors version (generic)
    this.s.bind("sensors_version", "sensors_version", null, null);

    // Temperature tab
    this.s.bind("show_temp", "show_temp", this.populate_temp_sensors_in_settings, null);
    this.s.bind("show_temp_name", "show_temp_name", null, null);
    this.s.bind("strictly_positive_temp", "strictly_positive_temp", this.populate_temp_sensors_in_settings, null);
    this.s.bind("use_fahrenheit", "use_fahrenheit", this.updateUI, null);
    this.s.bind("only_integer_part", "only_integer_part", this.updateUI, null);
    this.s.bind("show_unit", "show_unit", this.updateUI, null);
    this.s.bind("show_unit_letter", "show_unit_letter", this.updateUI, null);
    this.s.bind("always_show_unit_in_line", "always_show_unit_in_line", this.updateUI, null);
    this.s.bind("temp_sensors", "temp_sensors", null, null);
    this.s.bind("numberOfTempSensors", "numberOfTempSensors", null, null);
    this.s.bind("temp_disks", "temp_disks", null, null);

    // Fan tab
    this.s.bind("show_fan", "show_fan", this.populate_fan_sensors_in_settings, null);
    this.s.bind("show_fan_name", "show_fan_name", null, null);
    this.s.bind("strictly_positive_fan", "strictly_positive_fan", this.populate_fan_sensors_in_settings, null);
    this.s.bind("show_fan_unit", "show_fan_unit", this.updateUI, null);
    this.s.bind("fan_unit", "fan_unit", this.updateUI, null);
    this.s.bind("fan_sensors", "fan_sensors", null, null);
    this.s.bind("numberOfFanSensors", "numberOfFanSensors", null, null);

    // Voltage tab
    this.s.bind("show_volt", "show_volt", this.populate_volt_sensors_in_settings, null);
    this.s.bind("show_volt_name", "show_volt_name", null, null);
    this.s.bind("strictly_positive_volt", "strictly_positive_volt", this.populate_volt_sensors_in_settings, null);
    this.s.bind("show_volt_unit", "show_volt_unit", this.updateUI, null);
    this.s.bind("volt_unit", "volt_unit", this.updateUI, null);
    this.s.bind("volt_sensors", "volt_sensors", null, null);
    this.s.bind("numberOfVoltageSensors", "numberOfVoltageSensors", null, null);

    // Intrusion tab
    this.s.bind("show_intrusion", "show_intrusion", this.populate_intrusion_sensors_in_settings, null);
    this.s.bind("show_intrusion_name", "show_intrusion_name", null, null);
    this.s.bind("strictly_positive_intrusion", "strictly_positive_intrusion", this.updateUI, null);
    this.s.bind("intrusion_sensors", "intrusion_sensors", null, null);
    this.s.bind("numberOfIntrusionSensors", "numberOfIntrusionSensors", null, null);

    // Whether temperature@fevimu is loaded:
    let enabledApplets = global.settings.get_strv(ENABLED_APPLETS_KEY);
    var _temperatureATfevimu_is_loaded = false;
    for (let appData of enabledApplets) {
      if (appData.toString().split(":")[3] === "temperature@fevimu") {
        _temperatureATfevimu_is_loaded = true;
        break;
      }
    }
    this.s.setValue("temperatureATfevimu_is_loaded", _temperatureATfevimu_is_loaded);
  }

  reap_sensors() {
    if (this.checkDepInterval) {
      clearTimeout(this.checkDepInterval);
      this.checkDepInterval = undefined
    }

    if (!this.isLooping) return;

    // this.reaper.set_fahrenheit(this.use_fahrenheit); // Useless because toooo buggy! Let this applet do the job.

    this.reaper.reap_sensors(
      this.strictly_positive_temp ? 1 : 0,
      this.strictly_positive_fan ? 1 : 0,
      this.strictly_positive_volt ? 1 : 0
    );

    this.loopId = Mainloop.timeout_add(this.interval * 1000, () => this.reap_sensors());
    return false
  }

  /**
   * populate_xxx_sensors_in_settings
   */

  populate_sensors_in_settings(type, force) {
    if (this.data === undefined) return;

    let _sensors = Object.keys(this.data[type]);

    if (_sensors.length === 0 && this.sensors_list[type].get_value().length != 0) {
      this.sensors_list[type].set_value([]);
      return
    }

    var ret = [];
    var _known_keys = [];

    for (let k of this.sensors_list[type].get_value()) {
      let _sensor = k["sensor"];

      _known_keys.push(_sensor);

      if (k["shown_name"].length > 0) {
        //if (this.custom_names[_sensor]) log("custom_names: \"" + this.custom_names[_sensor] + "\"", true);

        if (this.custom_names[_sensor] && (_sensor.toString() === k["shown_name"].toString())) {
          delete this.custom_names[_sensor];
          k["shown_name"] = ""
        } else {
          this.custom_names[_sensor] = k["shown_name"];
        }
      }
    }

    var name, toPush, index;
    var modified = (force ||
                    this.number_of_sensors[type].get_value() === 0 ||
                    this.number_of_sensors[type].get_value() !== _sensors.length ||
                    this.sensors_list[type].get_value().length === 0
    );
    this.number_of_sensors[type].set_value(_sensors.length);

    for (let sensor of _sensors) {
      name = sensor.toString().trim();
      toPush = {};
      index = _known_keys.indexOf(name);
      if (type === "temps") this.minimumIntegerDigitsTemp = 2;

      toPush["sensor"] = name;

      if (index < 0) {
        toPush["show_in_panel"] = false;
        toPush["show_in_tooltip"] = false;

        modified = true;
        if (type === "temps") {
          this.minimumIntegerDigitsTemp = Math.max(this.minimumIntegerDigitsTemp,
                                          (Math.ceil(this._get_crit_temp(this.data["temps"][name]))).toString().length);
        }
      } else {
        toPush["show_in_panel"] = this.sensors_list[type].get_value()[index]["show_in_panel"];
        toPush["show_in_tooltip"] = this.sensors_list[type].get_value()[index]["show_in_tooltip"];
      }

      if (this.custom_names[name]) {
        toPush["shown_name"] = this.custom_names[name]
      } else if (index > -1) {
        toPush["shown_name"] = (this.sensors_list[type].get_value())[index]["shown_name"]
      } else {
        toPush["shown_name"] = ""
      }

      if (Object.keys(toPush).length != 0)
        ret.push(toPush);
    }

    if (modified) {
      this.sensors_list[type].set_value(ret);
      this.updateUI();
    }
    Util.unref(ret);
    _known_keys = null;
    Util.unref(toPush);
    name = null;
    modified = null;
  }

  populate_temp_sensors_in_settings(force = true) {
    if (this.show_temp)
      this.populate_sensors_in_settings("temps", force);
  }

  populate_temp_disks_in_settings() {
    let command = SCRIPTS_DIR+"/get_disk_list.sh";
    var temp_disks = this.temp_disks;
    Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function(stdout, stderr, exitCode) {
      if (exitCode === 0) {
        let out = stdout.trim();
        let disks = out.split(" ");
        for (let d of disks) {
          var found = false;
          for (let k of temp_disks)
            if (k["disk"] === d) found = true;

          if (!found)
            temp_disks.push({"disk": d, "shown_name": d});
        }
        this.temp_disks = temp_disks
      }
    }))
  }

  populate_fan_sensors_in_settings(force = true) {
    if (this.show_fan)
      this.populate_sensors_in_settings("fans", force);
  }

  populate_volt_sensors_in_settings(force = true) {
    if (this.show_volt)
      this.populate_sensors_in_settings("voltages", force);
  }

  populate_intrusion_sensors_in_settings(force = true) {
    if (this.show_intrusion)
      this.populate_sensors_in_settings("intrusions", force);
  }

  /**
   * updateTooltip: updates the tooltil of this applet.
   */
  updateTooltip() {
    if (!this.isUpdatingUI) return;

    var _tooltip = "";
    var _tooltips = [];

    // Temperatures:
    if (this.show_temp && this.temp_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["temps"]).length != 0) {
      if (this.temp_sensors.length > 0) {
        for (let t of this.temp_sensors) {
          if (this.data["temps"][t["sensor"]] !== undefined) {
            if (t["show_in_tooltip"]) {
              if (t["shown_name"] && t["sensor"].toString() === t["shown_name"].toString()) {
                if (this.custom_names[t["sensor"]]) delete this.custom_names[t["sensor"]];
                t["shown_name"] = ""
              }
              let name = (!t["shown_name"]) ?  t["sensor"] : t["shown_name"];
              _tooltip +=  (t["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let str_value = this._formatted_temp(this.data["temps"][t["sensor"]]["input"]).padStart(10, " ");
              _tooltip += (this.bold_values) ?
                "  <b>" + str_value + "</b>" :
                "  " + str_value;
              let _max_temp = this._get_max_temp(this.data["temps"][t["sensor"]]);
              _tooltip += "  "+ _("high:") + " " + ((_max_temp === 0) ? _("n/a") : this._formatted_temp(_max_temp));
              let _crit_temp = this._get_crit_temp(this.data["temps"][t["sensor"]]);
              _tooltip += "  "+ _("crit:") + " " + ((_crit_temp === 0) ? _("n/a") : this._formatted_temp(_crit_temp));
              _tooltip += "\n";
              _crit_temp = null;
              _max_temp = null;
              str_value = null;
              name = null
            }
          }
        }
      }

      for (let disk of this.temp_disks) {
        let _disk_name = disk["disk"].trim();
        if (disk["show_in_tooltip"]) {
          let command = "bash -c '"+SCRIPTS_DIR+"/get_disk temp.sh "+_disk_name+"'";

          if (!this._temp[_disk_name]) this._temp[_disk_name] = "??";
          let _temp;
          if (disk["value"])
            _temp = disk["value"];
          Util.spawnCommandLineAsyncIO(command, Lang.bind (this, function(stdout, stderr, exitCode) {
            this._temp[_disk_name] = stdout;
            //~ log("typeof _temp: "+typeof _temp, true);


            if (typeof this._temp[_disk_name] === "object")
              _temp = to_string(this._temp[_disk_name]);
            else
              _temp = this._temp[_disk_name];

            //~ log(""+_disk_name+": "+_temp+"°C", true);
          }));
          if (!isNaN(_temp)) {
            let _temp_max = disk["high"];
            let _temp_crit = disk["crit"];

            let _shown_name = "";
            if (this.show_temp_name) _shown_name = disk["shown_name"]+" ";
            else _shown_name = disk["disk"]+" ";

            _tooltip +=  (disk["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + _shown_name + "</b></i>\n" :
                " " + _shown_name + "\n";

            let str_value = this._formatted_temp(_temp).padStart(10, " ");
            _tooltip += (this.bold_values) ?
              "  <b>" + str_value + "</b>" :
              "  " + str_value;

            _tooltip += "  "+ _("high:") + " " + ((_temp_max === 0) ? _("n/a") : this._formatted_temp(_temp_max));

            _tooltip += "  "+ _("crit:") + " " + ((_temp_crit === 0) ? _("n/a") : this._formatted_temp(_temp_crit));
            _tooltip += "\n";
            _temp_crit = null;
            _temp_max = null;
            str_value = null;
            _shown_name = null
          }
        }
      }

      if (_tooltip.length !== 0) {
        _tooltip = "🌡" + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }

    // Fans:
    _tooltip = "";
    if (this.show_fan && this.fan_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["fans"]).length != 0) {
      if (this.fan_sensors.length > 0) {
        for (let f of this.fan_sensors) {
          if (this.data["fans"][f["sensor"]] !== undefined) {
            if (f["show_in_tooltip"]) {
              let name = (!f["shown_name"]) ?  f["sensor"] : f["shown_name"];
              _tooltip +=  (f["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let str_value = this._formatted_fan(this.data["fans"][f["sensor"]]["input"]).padStart(10, " ");
              _tooltip += (this.bold_values) ?
                "  <b>" + str_value + "</b>" :
                "  " + str_value;
              let _min_fan = this._get_min_fan(this.data["fans"][f["sensor"]]);
              _tooltip += "  "+ _("min:") + " " + ((_min_fan === 0) ? _("n/a") : this._formatted_fan(_min_fan));
              _tooltip += "\n";
              _min_fan = null;
              str_value = null;
              name = null
            }
          }
        }
      }
      if (_tooltip !== "") {
        _tooltip = "🤂" + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }

    // Voltages:
    _tooltip = "";
    if (this.show_volt && this.volt_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["voltages"]).length != 0) {
      if (this.volt_sensors.length > 0) {
        for (let v of this.volt_sensors) {
          if (this.data["voltages"][v["sensor"]] !== undefined) {
            if (v["show_in_tooltip"]) {
              let name = (!v["shown_name"]) ?  v["sensor"] : v["shown_name"];
              _tooltip += (v["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let str_value = this._formatted_voltage(this.data["voltages"][v["sensor"]]["input"]).padStart(10, " ");
              _tooltip += (this.bold_values) ?
                "  <b>" + str_value + "</b>" :
                "  " + str_value;
              _tooltip += "  "+ _("max:") + " " + this._formatted_voltage(this._get_max_voltage(this.data["voltages"][v["sensor"]]));
              _tooltip += "\n";
              str_value = null;
              name = null
            }
          }
        }
      }
      if (_tooltip !== "") {
        _tooltip = "🗲" + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }


    //Intrusion:
    _tooltip = "";
    if (this.show_intrusion && this.intrusion_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["intrusions"]).length != 0) {
      if (this.intrusion_sensors.length > 0) {
        for (let i of this.intrusion_sensors) {
          if (this.data["intrusions"][i["sensor"]] !== undefined) {
            if (i["show_in_tooltip"]) {
              let name = (!i["shown_name"]) ?  i["sensor"] : i["shown_name"];
              _tooltip +=  (i["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let value = this.data["intrusions"][i["sensor"]]["alarm"];
              let message = (value == 0) ? _("No intrusion detected") : _("INTRUSION DETECTED!");
              _tooltip += (this.bold_values) ?
                "  <b>" + message + "</b>" :
                "  " + message;
              _tooltip += "\n";
              message = null;
              value = null;
              name = null
            }
          }
        }
      }
      if (_tooltip !== "") {
        _tooltip = "⮿" + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }

    _tooltip = "";
    if (_tooltips.length === 0)
      _tooltip = _("Must be configured!");
    else
      _tooltip = _tooltips.join("\n");

    if (this._applet_tooltip.set_markup === undefined)
      this.set_applet_tooltip(_tooltip);
    else
      this._applet_tooltip.set_markup(_tooltip);

    _tooltip = null;
    _tooltips = null
  }

  /**
   * updateUI: updates the user interface (that is displayed in the panel).
   */
  updateUI() {
    if (this.isUpdatingUI) return;

    this.isUpdatingUI = true;

    //~ this.check_hddtemp_permissions();

    var _appletLabel = "";
    let _border_type = (this.remove_border) ? "-noborder" : "";
    var _actor_style = "sensors-label%s sensors-size%s".format(_border_type, this.char_size);

    let vertical = (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT);
    let sep = (vertical) ? "\n" : "│";
    let _shown_name;
    this.label_parts = [];

    this.data = this.reaper.get_sensors_data();

    // Temperatures:
    var nbr_already_shown = 0;
    if (this.show_temp && this.temp_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["temps"]).length != 0) {
      for (let t of this.temp_sensors) {
        if (this.data["temps"][t["sensor"]] !== undefined) {
          if (t["show_in_panel"]) {
            let _temp = this.data["temps"][t["sensor"]]["input"];
            _shown_name = "";
            if (this.show_temp_name && !vertical) _shown_name = t["shown_name"]+" ";

            if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push("🌡");
            this.label_parts.push(_shown_name+this._formatted_temp(_temp, vertical));

            let _temp_max = this._get_max_temp(this.data["temps"][t["sensor"]]);
            let _temp_crit = this._get_crit_temp(this.data["temps"][t["sensor"]]);

            if (!isNaN(_temp_crit) && _temp_crit > 0 && _temp >= _temp_crit)
              _actor_style = "sensors-critical%s sensors-size%s".format(_border_type, this.char_size);
            else if (!isNaN(_temp_max) && _temp_max > 0 && _temp >= _temp_max)
              _actor_style = "sensors-high%s sensors-size%s".format(_border_type, this.char_size);

            nbr_already_shown += 1;
          }
        }
      }
    }
    if (this.show_temp && this.temp_disks && this.temp_disks.length > 0) {
      for (let disk of this.temp_disks) {
        let _disk_name = disk["disk"].trim();
        if (disk["show_in_panel"] && _disk_name.length > 0) {
          if (!this._temp[_disk_name]) this._temp[_disk_name] = "??";
          if (disk["value"]) this._temp[_disk_name] = disk["value"];
          let command = "bash -c '"+SCRIPTS_DIR+"/get_disk_temp.sh "+_disk_name+"'";
          //~ log("command: "+command, true);
          let _temp;
          Util.spawnCommandLineAsyncIO(command, Lang.bind (this, function(stdout, stderr, exitCode) {
            //~ this._temp[_disk_name] = stdout;
            if (exitCode === 0) {


              if (typeof stdout === "object") {
                _temp = to_string(stdout);
              } else {
                _temp = ""+stdout;
              }

              _temp = 0+parseInt(_temp);
              this._temp[_disk_name] = _temp;

              //~ log("typeof _temp: "+typeof _temp, true);

              if (typeof _temp === "number") {
                //~ log(_disk_name+": "+this._temp[_disk_name], true);
                disk["value"] = _temp;


              }
            }
          }));
          _temp = (disk["value"]) ? disk["value"] : '??';
          if (isNaN(_temp)) continue;
          let _temp_max = disk["high"];
          let _temp_crit = disk["crit"];
          if (_temp >= _temp_crit)
            _actor_style = "sensors-critical%s sensors-size%s".format(_border_type, this.char_size);
          else if (_temp >= _temp_max)
            _actor_style = "sensors-high%s sensors-size%s".format(_border_type, this.char_size);

          _shown_name = "";
          if (this.show_temp_name && !vertical)
            _shown_name = (disk["shown_name"].length > 0) ? disk["shown_name"]+" " : _disk_name+" ";

          let _label_part = _shown_name+this._formatted_temp(_temp, vertical);

          //~ log("_label_part: "+_label_part, true);

          this.label_parts.push(""+_label_part);
          //~ log("_label_parts.length: "+this.label_parts.length, true);
          nbr_already_shown += 1;
        }
      }
    }

    // Fans:
    nbr_already_shown = 0;
    if (this.show_fan && this.fan_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["fans"]).length != 0) {

      // This pushed "" is useless when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let f of this.fan_sensors) {
        if (f["show_in_panel"]) {
          let _fan = this.data["fans"][f["sensor"]]["input"];
          _shown_name = "";
          if (this.show_fan_name && !vertical) _shown_name = f["shown_name"]+" ";

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push("🤂");
          this.label_parts.push(_shown_name+this._formatted_fan(_fan, vertical));

          let _fan_min = this._get_min_fan(this.data["fans"][f["sensor"]]);

          if (_fan < _fan_min)
            _actor_style = "sensors-critical%s sensors-size%s".format(_border_type, this.char_size);

          nbr_already_shown += 1;
        }
      }

      //~ if (nbr_already_shown === 0) this.label_parts.pop(); // Deletes the useless "" pushed in this.label_parts.
    }

    // Voltages:
    nbr_already_shown = 0;
    if (this.show_volt && this.volt_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["voltages"]).length != 0) {

      // This pushed "" is useless when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let v of this.volt_sensors) {
        if (v["show_in_panel"]) {
          let _voltage = this.data["voltages"][v["sensor"]]["input"];
          _shown_name = "";
          if (this.show_volt_name && !vertical) _shown_name = v["shown_name"]+" ";

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push("🗲");
          this.label_parts.push(_shown_name+this._formatted_voltage(_voltage, vertical));

          let _voltage_max = this._get_max_voltage(this.data["voltages"][v["sensor"]]);

          if (_voltage >= _voltage_max)
            _actor_style = "sensors-critical%s sensors-size%s".format(_border_type, this.char_size);

          nbr_already_shown += 1;
        }
      }

      //~ if (nbr_already_shown === 0) this.label_parts.pop(); // Deletes the useless "" pushed in this.label_parts.
    }

    // Intrusion:
    nbr_already_shown = 0;
    if (this.show_intrusion && !this.strictly_positive_intrusion && this.intrusion_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["intrusions"]).length != 0) {

      // This pushed "" is useless when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let i of this.intrusion_sensors) {
        if (i["show_in_panel"]) {
          let _intrusion = this.data["intrusions"][i["sensor"]]["alarm"];
          _shown_name = "";
          if (this.show_intrusion_name && !vertical) _shown_name = i["shown_name"]+" ";

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push("⮿");
          this.label_parts.push(_shown_name+this._formatted_intrusion(_intrusion, vertical));

          let _intrusion_alarm = this._get_alarm_intrusion(this.data["intrusions"][i["sensor"]]);

          if (_intrusion_alarm)
            _actor_style = "sensors-critical%s sensors-size%s".format(_border_type, this.char_size);

          nbr_already_shown += 1;
        }
      }

      //~ log("nbr_already_shown: '"+nbr_already_shown+"'", true);
      //~ if (nbr_already_shown === 0) this.label_parts.pop(); // Deletes the useless "" pushed in this.label_parts.
    }

    if (this.label_parts.length === 0) {
      _appletLabel = this._get_default_applet_label();
    } else {
      //~ log("Final _label_parts.length: "+this.label_parts.length, true);
      _appletLabel = this.label_parts.join(sep);
      //~ log("_appletLabel754: '"+_appletLabel+"'", true);
      if (!this.keep_size) {
        while (_appletLabel.includes("  ")) {
          _appletLabel = _appletLabel.replace(/  /g, " ");
        }
      }
      while (_appletLabel.includes("││")) {
        _appletLabel = _appletLabel.replace(/││/g, "│");
      }
      while (_appletLabel.includes("\n\n")) {
        _appletLabel = _appletLabel.replace(/\n\n/g, "\n");
      }
      //~ log("_appletLabel777: '"+_appletLabel+"'", true);
      //~ log("Last character: '"+_appletLabel.slice(-1)+"'", true);
      if (_appletLabel.slice(-1) === '│') {
        //~ log("_appletLabel780 ends with '│'.", true);
        _appletLabel = _appletLabel.slice(0, -1)
      }
      //~ log("_appletLabel783: '"+_appletLabel+"'", true);
    }



    this.set_applet_label(_appletLabel);

    //~ log("_actor_style: "+_actor_style, true);
    this.actor.set_style_class_name(_actor_style);
    this._applet_label.set_style_class_name("tcolor"+this.char_color);

    if (this.tooltip_must_be_updated)
      this.updateTooltip();
    this.isUpdatingUI = false;
    _appletLabel = null;
  }

  updateUI_from_settings() {
    this.tooltip_must_be_updated = true;
    this.updateUI()
  }

  /**
   * updateMenu: updates the menu of the applet.
   */
  updateMenu() {
    this.menu.removeAll();

    // Head
    let menuitemHead1 = new PopupMenu.PopupMenuItem(_(this.applet_name) + " " + this.applet_version, {
      reactive: false
    });
    this.menu.addMenuItem(menuitemHead1);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let menuitemHead2 = new PopupMenu.PopupMenuItem(_("Settings") + _(":"), {
      reactive: false
    });
    this.menu.addMenuItem(menuitemHead2);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Button General:
    let _general_button = new PopupMenu.PopupMenuItem("  " + _("⚙ General"));
    _general_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        this.pids.push(Util.spawnCommandLine("/usr/bin/xlet-settings applet %s &".format(UUID)))
      }
    );
    this.menu.addMenuItem(_general_button);

    // Button Temperature:
    let _temp_button = new PopupMenu.PopupMenuItem("  " + _("🌡 Temperature sensors"));
    _temp_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        Util.spawnCommandLineAsync("%s applet %s -t 1 &".format(XS_PATH, UUID))
      }
    );
    this.menu.addMenuItem(_temp_button);

    // Button Fan:
    let _fan_button = new PopupMenu.PopupMenuItem("  " + _("🤂 Fan sensors"));
    _fan_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        this.pids.push(Util.spawnCommandLine("%s applet %s -t 2 &".format(XS_PATH, UUID)))
      }
    );
    this.menu.addMenuItem(_fan_button);

    // Button Voltage:
    let _voltage_button = new PopupMenu.PopupMenuItem("  " + _("🗲 Voltage sensors"));
    _voltage_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        this.pids.push(Util.spawnCommandLine("%s applet %s -t 3 &".format(XS_PATH, UUID)))
      }
    );
    this.menu.addMenuItem(_voltage_button);

    // Button Intrusion:
    let _intrusion_button = new PopupMenu.PopupMenuItem("  " + _("⮿ Intrusion sensors"));
    _intrusion_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        this.pids.push(Util.spawnCommandLine("%s applet %s -t 4 &".format(XS_PATH, UUID)))
      }
    );
    this.menu.addMenuItem(_intrusion_button);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Button xsensors
    let _values_in_real_time_button = new PopupMenu.PopupIconMenuItem(_("Run xsensors"),
                                                                      "application-x-executable",
                                                                      St.IconType.SYMBOLIC
    );
    _values_in_real_time_button.connect("activate", this._on_xsensors_pressed);
    this.menu.addMenuItem(_values_in_real_time_button);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    if (RELOAD() || this.restart_in_menu) {
      // Button 'Reload this applet':
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      let _reload_button = new PopupMenu.PopupIconMenuItem(_("Reload this applet"), "edit-redo", St.IconType.SYMBOLIC);
      _reload_button.connect("activate", (event) => this.on_option_menu_reload_this_applet_clicked());
      this.menu.addMenuItem(_reload_button);
    }
  }

  /**
   * Temperature methods
   */
  _toFahrenheit(t) {
    return 1.8 * t + 32;
  }

  _formatted_temp(t, vertical = false) {
    let _t = t;
    let _letter = "";
    let ret;

    //let _minimumIntegerDigits = 3;
    if (this.use_fahrenheit) {
      _t = this._toFahrenheit(t);
      //_minimumIntegerDigits = 3;
    }

    //let _lang = GLib.getenv("LANGUAGE").replace("_", "-");
    let _lang = this.num_lang;
    if (this.only_integer_part) {
      _t = Math.round(_t);
      ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: this.minimumIntegerDigitsTemp }).format(_t)).toString();
    } else {
      ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: this.minimumIntegerDigitsTemp, minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(_t)).toString();
    }

    let _repl = (vertical) ? "" : " ";
    if (ret[0] === "0") ret = ret.replace(/^0/, _repl);


    if (this.show_unit) {
      ret += (vertical && !this.always_show_unit_in_line && this.show_unit_letter) ? "\n°" : "°";
      if (this.show_unit_letter) ret += this.use_fahrenheit ? "F" : "C";
    }

    //if (vertical) ret = "\n" + ret + "\n";

    return ret
  }

  _get_lang() {
    if (GLib.getenv("LC_NUMERIC")) {
      return GLib.getenv("LC_NUMERIC").split(".")[0].replace("_", "-")
    } else if (GLib.getenv("LANG")) {
      return GLib.getenv("LANG").split(".")[0].replace("_", "-")
    } else if (GLib.getenv("LANGUAGE")) {
      return GLib.getenv("LANGUAGE").replace("_", "-")
    }
    return "en-US"
  }

  _get_max_temp(dico) {
    if (dico["max"] !== undefined && !isNaN(dico["max"])) {
      return 1.0 * dico["max"]
    } else if (dico["crit"] !== undefined && !isNaN(dico["crit"])) {
      return 1.0 * Math.round(0.9 * dico["crit"])
    } else {
      return 0
    }
  }

  _get_crit_temp(dico) {
    if (dico["crit"] !== undefined && !isNaN(dico["crit"])) {
      return 1.0 * dico["crit"]
    } else if (dico["max"] !== undefined && !isNaN(dico["max"])) {
      return 1.0 * Math.round(1.1 * dico["max"])
    } else {
      return 0
    }

  }


  /**
   * Fan methods
   */
  _formatted_fan(f, vertical = false) {
    let _sep = (vertical) ? "\n" : " ";
    let _unit = (this.fan_unit != "") ? _sep + this.fan_unit : "";

    if (!this.show_fan_unit)
      _unit = "";

    let ret = (vertical) ?
      (Math.ceil(f)).toString() + _unit :
      (Math.ceil(f)).toString().padStart(4, " ") + _unit;

    return ret
  }

  _get_min_fan(dico) {
    if (dico["min"] !== undefined && !isNaN(dico["min"])) {
      return 1.0 * dico["min"]
    } else {
      return 0
    }
  }



  /**
   * Voltage methods
   */
  _formatted_voltage(v, vertical = false) {
    let _v = v;
    let _unit = "V";
    let _sep = (vertical) ? "\n" : " ";
    let ret;
    //let _lang = GLib.getenv("LANGUAGE").replace("_", "-");
    let _lang = this.num_lang;

    let _padstart = 8;

    switch(this.volt_unit) {
      case "V":
        ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: 1, minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(_v)).toString();
        ret += (this.show_volt_unit) ? _sep + "V" : "";
        _padstart = 7;
        break;
      case "mV":
        _v = Math.ceil(_v * 1000);
        ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: 3 }).format(_v)).toString();
        ret += (this.show_volt_unit) ? _sep + "mV" : "";
        break;
      case "both":
        if (_v < 1) {
          _v = Math.ceil(_v * 1000);
          ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: 3 }).format(_v)).toString();
          ret += (this.show_volt_unit) ? _sep + "mV" : "";
        } else {
          ret = (new Intl.NumberFormat(_lang, { minimumIntegerDigits: 1, minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(_v)).toString();
          ret += (this.show_volt_unit) ? _sep + " V" : "";
        }
    }

    if (ret[0] === "0" && _v >=1) ret = ret.replace(/^0+/, " ");
    if (!vertical) ret = ret.padStart(_padstart, " ");

    //if (vertical) ret = "\n" + ret;

    return ret;
  }

  _get_max_voltage(dico) {
    if (dico["max"] !== undefined && !isNaN(dico["max"])) {
      return 1.0 * dico["max"]
    } else {
      return 10
    }
  }


  /**
   * Intrusion methods
   */
  _formatted_intrusion(i, vertical = false) {
    let ret = Math.ceil(i) != 0 ? "😧" : "😊";
    return ret;
  }

  _get_alarm_intrusion(dico) {
    if (dico["alarm"] !== undefined && !isNaN(dico["alarm"]))
      return Math.ceil(dico["alarm"]) != 0;
    else
      return false;
  }


  /**
   * Applet system methods
   */
  on_settings_changed() {
    this.isLooping = false;
    if (this.loopId != undefined && this.loopId > 0) {
        Mainloop.source_remove(this.loopId);
        this.loopId = 0;
    }
    this.isLooping = true;
    this.reap_sensors();
  }

  on_applet_clicked() {
    this.updateMenu();
    this.menu.toggle();
  }

  on_orientation_changed(orientation) {
    this.orientation = orientation;
    this.isUpdatingUI = false;
  }

  on_applet_reloaded() {
    this.isLooping = false;

    if ((this.loopId != undefined) && (this.loopId > 0)) {
      Mainloop.source_remove(this.loopId);
      this.loopId = 0;
    }

    if (this.checkDepInterval && (this.checkDepInterval != 0)) {
      clearInterval(this.checkDepInterval);
      this.checkDepInterval = 0;
    }

    if (this.reaper && this._connectReaperId) {
      try {
        this.reaper.disconnect(this._connectReaperId);
      } catch(e) {
        log("on_applet_reloaded: Unable to disconnect signal %s.".format(this._connectReaperId));
      }
    }

    while (this._connectIds.length > 0) {
      this.actor.disconnect(this._connectIds.pop());
    }

    this.kill_all_pids();
  }

  on_applet_removed_from_panel() {
    this.on_applet_reloaded();

    this.s.finalize();
  }

  on_applet_added_to_panel(userEnabled) {
    // Check about dependencies:
    this.checkDepInterval = undefined;
    if (this.dependencies.areDepMet()) {
      // All dependencies are installed. Now, run the loop!:
      this.isLooping = true;
      this.loopId = 0;
      this.reap_sensors();
    } else {
      // Some dependencies are missing. Suggest to the user to install them.
      this.isLooping = false;
      this.checkDepInterval = setInterval(() => this.dependencies.check_dependencies(), 10000);
    }
  }

  kill_all_pids() {
    if (!this.pids) return;

    while (this.pids.length != 0) {
      let pid = this.pids.pop();
      Util.spawnCommandLineAsync("kill -9 %s".format(pid.toString()));
    }
  }

  _get_default_applet_label() {
    if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
      return DEFAULT_APPLET_LABEL.join("\n");
    else
      return DEFAULT_APPLET_LABEL.join("");
  }

  /**
   * Buttons in settings
   */
  on_option_menu_reload_this_applet_clicked() {
    // Reload this applet:
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
  }

  /**
   * General tab: buttons
   */
  _on_report_button_pressed() {
    let text = this.reaper.get_sensors_data_formatted_text();

    GLib.file_set_contents(SCRIPTS_DIR + "/report.txt", text);

    Util.spawnCommandLineAsync("%s/show_sensor_values.sh".format(SCRIPTS_DIR));
  }

  _on_xsensors_pressed() {
    Util.spawnCommandLineAsync("/usr/bin/xsensors &");
  }

  _on_remove_temperatureATfevimu_from_panels() {
    let dialog = new ModalDialog.ConfirmDialog(
      _("Are you sure you want to remove '%s'?").format("temperature@fevimu"),
      () => {
        Extension.unloadExtension("temperature@fevimu", Extension.Type.APPLET, false, false);

        let oldList = global.settings.get_strv(ENABLED_APPLETS_KEY);
        let newList = [];

        for (let i = 0; i < oldList.length; i++) {
          let info = oldList[i].split(':');
          if (info[3] != "temperature@fevimu") {
              newList.push(oldList[i]);
          }
        }
        global.settings.set_strv(ENABLED_APPLETS_KEY, newList);
        this.s.setValue("temperatureATfevimu_is_loaded", false);
      }
    );
    dialog.open();
  }

  //~ _on_hddtemp_button_pressed() {
    //~ Util.spawnCommandLine("/bin/bash -c '%s/pkexec_make_hddtemp_usable_by_user.sh'".format(SCRIPTS_DIR));
  //~ }

  //~ check_hddtemp_permissions(force=false) {
    //~ let quickly = false;
    //~ let now = 1*Math.ceil(Date.now() / 1000);
    //~ let old_value = this.s.getValue("hddtemp_is_user_accessible");
    //~ if (force || now - this.future_hddtemp_check > 0) {
      //~ Util.spawnCommandLineAsyncIO("/bin/bash -c '%s/is_hddtemp_usable_by_user.sh'".format(SCRIPTS_DIR),
                                    //~ (out, err, exitCode) => {
        //~ if (exitCode == 0) {
          //~ this.s.setValue("hddtemp_is_user_accessible", true);
          //~ if (!old_value || force) {
              //~ log(_("hddtemp is now executable by any user."), true);
          //~ }
        //~ } else {
          //~ this.s.setValue("hddtemp_is_user_accessible", false);
          //~ if (exitCode == 1) {
            //~ logError(_("hddtemp is NOT executable by any user else root."));
            //~ if (!force) {
              //~ let userSettings = JSON.parse(to_string(GLib.file_get_contents(HOME_DIR + "/.cinnamon/configs/" + UUID + "/" + UUID + ".json")[1]));
              //~ let tabTemperatures = 1*userSettings["layoutsensors"]["pages"].indexOf("page_Temperatures");
              //~ userSettings = null;
              //~ this.kill_all_pids();
              //~ Util.spawnCommandLineAsync("%s applet %s -t %s &".format(XS_PATH, UUID, ""+tabTemperatures))
            //~ }
          //~ } else { //exitCode is 2.
            //~ logError(_("hddtemp is NOT installed."));
            //~ if (!force) {
              //~ this.isLooping = false;
              //~ this.checkDepInterval = setInterval(() => this.dependencies.check_dependencies(), 10000);
              //~ quickly = true;
            //~ }
          //~ }
        //~ }
        //~ if (force)
          //~ this.future_hddtemp_check = now;
        //~ else if (quickly)
          //~ this.future_hddtemp_check = now + 10;
        //~ else
          //~ this.future_hddtemp_check = now + 60;
      //~ });
    //~ }
  //~ }

  /**
   * Events
   */
  on_enter_event(actor, event) {
    this.tooltip_must_be_updated = true;
  }

  on_leave_event(actor, event) {
    this.tooltip_must_be_updated = false;
  }

  /**
   * _variables
   */

  _variables() {
    this.sensors_list = {
      "temps": {
        get_value:  () => {return this.temp_sensors;},
        set_value: (v) => {this.temp_sensors = v}
      },
      "fans": {
        get_value:  () => {return this.fan_sensors;},
        set_value: (v) => {this.fan_sensors = v}
      },
      "voltages": {
        get_value:  () => {return this.volt_sensors;},
        set_value: (v) => {this.volt_sensors = v}
      },
      "intrusions": {
        get_value:  () => {return this.intrusion_sensors;},
        set_value: (v) => {this.intrusion_sensors = v}
      }
    };

    this.number_of_sensors = {
      "temps": {
        get_value:  () => {return this.numberOfTempSensors;},
        set_value: (v) => {this.numberOfTempSensors = v}
      },
      "fans": {
        get_value:  () => {return this.numberOfFanSensors;},
        set_value: (v) => {this.numberOfFanSensors = v}
      },
      "voltages": {
        get_value:  () => {return this.numberOfVoltageSensors;},
        set_value: (v) => {this.numberOfVoltageSensors = v}
      },
      "intrusions": {
        get_value:  () => {return this.numberOfIntrusionSensors;},
        set_value: (v) => {this.numberOfIntrusionSensors = v}
      }
    }
  }
}

function main(metadata, orientation, instance_id) {
  return new SensorsApplet(metadata, orientation, instance_id);
}
