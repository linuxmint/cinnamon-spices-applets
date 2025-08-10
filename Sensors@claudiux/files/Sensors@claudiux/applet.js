const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const Extension = imports.ui.extension;
const ModalDialog = imports.ui.modalDialog;
//util
const {spawnCommandLineAsyncIO, spawnCommandLineAsync, spawnCommandLine, unref} = require("./lib/util");
//to-string
const {to_string} = require("./lib/to-string");
//checkDependencies
const {Dependencies} = require("./lib/checkDependencies");
//mainloopTools
const {
  _sourceIds,
  timeout_add_seconds,
  timeout_add,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
} = require("./lib/mainloopTools");

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

const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");

const {SensorsReaper} = require("./lib/sensorsReaper");

const ENABLED_APPLETS_KEY = "enabled-applets";

var C_TEMP = '🌡'; //'⦿' '🌡'
var C_FAN = '𖣘'; //'🤂'
var C_VOLT = '⚡'; //'🗲' '🔌'
var C_INTRU = '🪛'; // '⮿'
var DEFAULT_APPLET_LABEL = [C_TEMP, C_FAN, C_VOLT, C_INTRU];

const LOG_HIGH_SCRIPT = SCRIPTS_DIR+"/log_high_value.sh";
const LOG_CRIT_SCRIPT = SCRIPTS_DIR+"/log_crit_value.sh";

var COUNT_LOG = 0;

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
 * Class LoggerTemp
 */
class LoggerTemp {
  constructor() {
    this.previous_values = {};
  }

  log(value, high_limit, crit_limit, sensor, unit="°C") {
    if (!value || isNaN(value*100)) return;
    let category = "Temperature";
    let category_sensor = ""+category+"_"+sensor;
    if (!this.previous_values[category_sensor])
      this.previous_values[category_sensor] = 35;
    let prev = this.previous_values[category_sensor];
    this.previous_values[category_sensor] = value;
    if (value == prev) return;
    if (crit_limit && !isNaN(crit_limit) && (value >= crit_limit || (prev >= crit_limit && value < crit_limit))) {
      spawnCommandLineAsync(LOG_CRIT_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value+unit);
      return;
    }
    if (high_limit && !isNaN(high_limit) && (value >= high_limit || (prev >= high_limit && value < high_limit))) {
      spawnCommandLineAsync(LOG_HIGH_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value+unit);
    }
  }
}

/**
 * Class LoggerFan
 */
class LoggerFan {
  constructor() {
    this.previous_values = {};
  }

  log(value, min_limit, sensor, unit="rpm") {
    if (!value || isNaN(value)) return;
    if (!min_limit || isNaN(min_limit)) return;
    let category = "Fan";
    let category_sensor = ""+category+"_"+sensor;
    if (!this.previous_values[category_sensor])
      this.previous_values[category_sensor] = min_limit + 100;
    let prev = this.previous_values[category_sensor];
    this.previous_values[category_sensor] = value;
    if (value == prev) return;
    if (value <= min_limit || (prev <= min_limit && value > min_limit)) {
      spawnCommandLineAsync(LOG_CRIT_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value+unit);
    }
  }
}

/**
 * Class LoggerVoltage
 */
class LoggerVoltage {
  constructor() {
    this.previous_values = {};
  }

  log(value, min_limit, max_limit, sensor, unit="V") {
    if (!value || Number.isNaN(Number(value*1000))) return;
    if (!min_limit || Number.isNaN(Number(min_limit*1000))) return;
    if (!max_limit || Number.isNaN(Number(max_limit*1000))) return;
    let category = "Voltage";
    let category_sensor = ""+category+"_"+sensor;
    if (!this.previous_values[category_sensor])
      this.previous_values[category_sensor] = (min_limit + max_limit) / 2;
    let prev = this.previous_values[category_sensor];
    this.previous_values[category_sensor] = value;
    if (value == prev) return;
    if (value <= min_limit || (prev <= min_limit && value > min_limit)) {
      spawnCommandLineAsync(LOG_CRIT_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value+unit);
      return
    }
    if (value >= max_limit || (prev >= max_limit && value < max_limit)) {
      spawnCommandLineAsync(LOG_CRIT_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value+unit);
    }
  }
}

/**
 * Class LoggerIntrusion
 */
class LoggerIntrusion {
  constructor() {
    this.previous_values = {};
  }

  log(value, sensor) {
    if (!value || isNaN(value)) return;
    let category = "Intrusion";
    let category_sensor = ""+category+"_"+sensor;
    if (!this.previous_values[category_sensor])
      this.previous_values[category_sensor] = 0;
    let prev = this.previous_values[category_sensor];
    this.previous_values[category_sensor] = value;
    if (value == prev) return;
    if (value != 0) {
      spawnCommandLineAsync(LOG_CRIT_SCRIPT+" "+category+ " "+sensor.replace(/ /g, "_")+" "+value);
    }
  }
}

/**
 * Class SensorsApplet
 */
class SensorsApplet extends Applet.Applet {

  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);
    this.orientation = orientation;
    this.instanceId = instance_id;
    this.applet_version = metadata.version;
    this.applet_name = metadata.name;
    this._temp = [];
    this.suspended = false;
    this.loopId = null;

    // Both types of panel: horizontal and vertical:
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    // To be sure that the scripts will be executable:
    spawnCommandLineAsync(`/bin/bash -c 'cd ${SCRIPTS_DIR} && chmod 755 *.py *.sh'`, null, null);

    this.sudo_or_wheel = "none";
    let subProcess = spawnCommandLineAsyncIO("/usr/bin/env bash -c 'groups'", (out, err, exitCode) => {
      if (exitCode == 0) {
        let groups = out.trim().split(' ');
        if (groups.indexOf("wheel") > -1) this.sudo_or_wheel = "wheel";
        if (groups.indexOf("sudo") > -1) this.sudo_or_wheel = "sudo";
      }
      subProcess.send_signal(9);
    });

    // Detect language for numeric format:
    this.num_lang = this._get_lang();

    // To check dependencies:
    this.dependencies = new Dependencies();
    //this.depCount = 0;

    // Applet tooltip:
    this.set_applet_tooltip(_('Sensors Monitor'));
    if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
      this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
    } else {
      this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
    }

    // Loggers:
    this.loggerTemp = new LoggerTemp();
    this.loggerFan = new LoggerFan();
    this.loggerVoltage = new LoggerVoltage();
    this.loggerIntrusion = new LoggerIntrusion();

    // Applet menu:
    this.pids = []; // pids of all opened windows, about settings, from the menu.
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);

    // get settings defined in settings-schema.json:
    this.get_user_settings();
    this._variables();

    // Applet default UI:
    this.set_default_UI();

    // Style class name:
    let _monospace = (this.keep_size) ? "sensors-monospace" : "applet-box"; //"applet-label";
    let _border_type = (this.remove_border) ? "-noborder" : "";
    this.actor.set_style_class_name("%s sensors-label%s vertalign-%s".format(_monospace, _border_type, this.vertical_align));

    // Initialize some properties:
    this.isRunning = false;

    // Sensors Reaper:
    this.reaper = new SensorsReaper(this, this.interval);
    this.reaper.reap_sensors(
      this.strictly_positive_temp ? 1 : 0,
      this.strictly_positive_fan ? 1 : 0,
      this.strictly_positive_volt ? 1 : 0
    );
    this.reaper.reap_nvidia_smi();

    // Events:
    this._connectIds = [];
    this._connectReaperId = this.reaper.connect("sensors-data-available", () => this.updateUI());
    this._connectIds.push(this.actor.connect("enter-event", (actor, event) => this.on_enter_event(actor, event)));
    this._connectIds.push(this.actor.connect("leave-event", (actor, event) => this.on_leave_event(actor, event)));
  }

  set_default_UI() {
    this.actor.destroy_all_children();
    for (let i=0; i<DEFAULT_APPLET_LABEL.length; i++) {
      let layoutBin = new St.Bin();
      let c = DEFAULT_APPLET_LABEL[i];
      let l = new St.Label({text: c});
      layoutBin.set_child(l);
      this.actor.add(layoutBin, { y_align: St.Align.MIDDLE,
                                  y_fill: false,
                                });
    }
  }

  get_user_settings() {
    this.s = new AppletSettings(this, UUID, this.instanceId);

    // General tab
    this.s.bind("show_tooltip", "show_tooltip", () => { this.on_settings_changed() });
    this.s.bind("has_set_markup", "has_set_markup");
    this.s.bind("interval", "interval", () => { this.on_settings_changed() });
    this.s.bind("keep_size", "keep_size", () => { this.updateUI() });
    this.s.bind("char_size", "char_size", () => { this.updateUI() });
    this.s.bind("horizontal_width", "horizontal_width", () => { this.updateUI() });
    this.s.bind("separator_type", "separator_type", () => { this.updateUI() });
    this.s.bind("vertical-align", "vertical_align", () => { this.updateUI() });
    this.s.bind("char_color_customized", "char_color_customized", () => { this.updateUI() });
    this.s.bind("char_color", "char_color", () => { this.updateUI() });
    this.s.bind("crit_color", "crit_color", () => { this.updateUI() });
    this.s.bind("high_color", "high_color", () => { this.updateUI() });
    this.s.bind("remove_border", "remove_border", () => { this.updateUI() });
    this.s.bind("remove_icons", "remove_icons", () => { this.updateUI() });
    this.s.bind("bold_values", "bold_values", () => { this.updateUI() });
    this.s.bind("bold_italics_main_sensors", "bold_italics_main_sensors", () => { this.updateUI() });
    this.s.bind("restart_in_menu", "restart_in_menu");

    this.detect_markup();

    // Custom names (generic)
    this.s.bind("custom_names", "custom_names");

    // sensors version (generic)
    this.s.bind("sensors_version", "sensors_version");

    // Temperature tab
    this.s.bind("show_temp", "show_temp", () => { this.populate_temp_sensors_in_settings() });
    this.s.bind("show_temp_name", "show_temp_name");
    this.s.bind("chars_temp", "chars_temp", () => { this._on_chars_temp_modified() });
    this._on_chars_temp_modified();
    this.s.bind("strictly_positive_temp", "strictly_positive_temp", () => { this.populate_temp_sensors_in_settings() });
    this.s.bind("use_fahrenheit", "use_fahrenheit", () => { this.updateUI() });
    this.s.bind("only_integer_part", "only_integer_part", () => { this.updateUI() });
    this.s.bind("show_unit", "show_unit", () => { this.updateUI() });
    this.s.bind("show_unit_letter", "show_unit_letter", () => { this.updateUI() });
    this.s.bind("always_show_unit_in_line", "always_show_unit_in_line", () => { this.updateUI() });
    this.s.bind("temp_sensors", "temp_sensors");
    this.s.bind("numberOfTempSensors", "numberOfTempSensors");
    this.s.bind("temp_disks", "temp_disks");
    this.s.bind("journalize_temp", "journalize_temp");

    // Fan tab
    this.s.bind("show_fan", "show_fan", () => { this.populate_fan_sensors_in_settings() });
    this.s.bind("show_fan_name", "show_fan_name");
    this.s.bind("chars_fan", "chars_fan", () => { this._on_chars_fan_modified() });
    this._on_chars_fan_modified();
    this.strictly_positive_fan = false;
    this.s.bind("show_fan_unit", "show_fan_unit", () => { this.updateUI() });
    this.s.bind("fan_unit", "fan_unit", () => { this.updateUI() });
    this.s.bind("fan_sensors", "fan_sensors");
    this.s.bind("numberOfFanSensors", "numberOfFanSensors");
    this.s.bind("journalize_fan", "journalize_fan");

    // Voltage tab
    this.s.bind("show_volt", "show_volt", () => { this.populate_volt_sensors_in_settings() });
    this.s.bind("show_volt_name", "show_volt_name");
    this.s.bind("chars_volt", "chars_volt", () => { this._on_chars_volt_modified() });
    this._on_chars_volt_modified();
    this.s.bind("strictly_positive_volt", "strictly_positive_volt", () => { this.populate_volt_sensors_in_settings() });
    this.s.bind("show_volt_unit", "show_volt_unit", () => { this.updateUI() });
    this.s.bind("volt_unit", "volt_unit", () => { this.updateUI() });
    this.s.bind("volt_sensors", "volt_sensors");
    this.s.bind("numberOfVoltageSensors", "numberOfVoltageSensors");
    this.s.bind("journalize_volt", "journalize_volt");

    // Intrusion tab
    this.s.bind("show_intrusion", "show_intrusion", () => { this.populate_intrusion_sensors_in_settings() });
    this.s.bind("show_intrusion_name", "show_intrusion_name");
    this.s.bind("chars_intrusion", "chars_intrusion", () => { this._on_chars_intrusion_modified() });
    this._on_chars_intrusion_modified();
    this.s.bind("strictly_positive_intrusion", "strictly_positive_intrusion", () => { this.updateUI() });
    this.s.bind("intrusion_sensors", "intrusion_sensors");
    this.s.bind("numberOfIntrusionSensors", "numberOfIntrusionSensors");
    this.s.bind("journalize_intrusion", "journalize_intrusion");

    // Custom tab
    this.s.bind("custom_sensors", "custom_sensors");

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
    this.s.setValue("disktemp_is_user_readable", this.is_disktemp_user_readable());
  }

  _on_chars_temp_modified() {
    var selected = "⦿";
    if (this.chars_temp.length > 0)
      selected = this.chars_temp[0]["emoji"];
    C_TEMP = "" + selected;
    DEFAULT_APPLET_LABEL[0] = "" + selected;
    this.set_default_UI();
  }

  _on_chars_fan_modified() {
    var selected = "𖣘";
    if (this.chars_fan.length > 0)
      selected = this.chars_fan[0]["emoji"];
    C_FAN = "" + selected;
    DEFAULT_APPLET_LABEL[1] = "" + selected;
    this.set_default_UI();
  }

  _on_chars_volt_modified() {
    var selected = "⚡";
    if (this.chars_volt.length > 0)
      selected = this.chars_volt[0]["emoji"];
    C_VOLT = "" + selected;
    DEFAULT_APPLET_LABEL[2] = "" + selected;
    this.set_default_UI();
  }

  _on_chars_intrusion_modified() {
    var selected = "🪛";
    if (this.chars_intrusion.length > 0)
      selected = this.chars_intrusion[0]["emoji"];
    C_INTRU = "" + selected;
    DEFAULT_APPLET_LABEL[3] = "" + selected;
    this.set_default_UI();
  }

  is_disktemp_user_readable() {
    var ret = false;
    const sudoers_smartctl_path = "/etc/sudoers.d/smartctl";
    const sudoers_smartctl_file = Gio.file_new_for_path(sudoers_smartctl_path);
    if (sudoers_smartctl_file.query_exists(null)) {
    try {
        let contents = to_string(GLib.file_get_contents(sudoers_smartctl_path)[1]);
        if (contents.includes("NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL:"))
          ret = true;
      } catch (e) {
      ret = false
    }
    }
    log("is_disktemp_user_readable: "+ret);
    return ret
  }

  detect_markup() {
    if (this._applet_tooltip.set_markup === undefined) {
      this.bold_values = false;
      this.bold_italics_main_sensors = false;
      this.has_set_markup = false;
    } else {
      this.has_set_markup = true;
    }
  }

  reap_sensors() {
    if (this.checkDepInterval != null) {
      clearTimeout(this.checkDepInterval);
      this.checkDepInterval = null;
    }

    if (!this.isLooping) return false;

    // this.reaper.set_fahrenheit(this.use_fahrenheit); // Useless because toooo buggy! Let this applet do the job.

    if (!this.suspended) {
      this.reaper.reap_sensors(
        this.strictly_positive_temp ? 1 : 0,
        this.strictly_positive_fan ? 1 : 0,
        this.strictly_positive_volt ? 1 : 0
      );
      this.reaper.reap_nvidia_smi();
    } else {
      this.set_applet_label(_("Suspended"));
    }

    this.loopId = timeout_add_seconds(this.interval, () => { this.reap_sensors(); });
    return this.isLooping
  }

  set_applet_label(label) {
    var labels = label.split(this.separator);
    this.actor.destroy_all_children();
    for (let i=0; i<labels.length; i++) {
      var high = false;
      var crit = false;
      let layoutBin = new St.Bin();
      let c = labels[i];
      let l_style = null;
      if (c.endsWith("$")) { // critical value
        c = c.slice(0, -1);
        l_style = "color: " + this.crit_color + ";";
      } else if (c.endsWith("£")) { // high value
        c = c.slice(0, -1);
        l_style = "color: " + this.high_color + ";";
      } else if (this.char_color_customized) {
        l_style = "color: " + this.char_color + ";";
      }
      let l = new St.Label({text: (i===0 || this.separator == "NO_SEP") ? c : this.separator + c});
      if (l_style)
        l.set_style(l_style);

      layoutBin.set_child(l);
      this.actor.add(layoutBin, { y_align: St.Align.MIDDLE,
                                  y_fill: false,
                                });
    }
  }

  get separator() {
    let vertical = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    if (vertical) {
      switch (this.separator_type) {
        case "bar":
          return "───\n";
        case "blank":
          return "\r\n";
        default:
          return "NO_SEP";
      }
    } else {
      switch (this.separator_type) {
        case "bar":
          return "│";
        case "blank":
          return " ";
        default:
          return "NO_SEP";
      }
    }
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

    let _to = setTimeout( () => {
      clearTimeout(_to);
      if (modified) {
        this.sensors_list[type].set_value(ret);
        this.updateUI();
      }
      //unref(ret);
      ret = null;
      _known_keys = null;
      //unref(toPush);
      toPush = null;
      name = null;
      modified = null;
    }, 2100);
  }

  populate_temp_sensors_in_settings(force = true) {
    if (this.show_temp)
      this.populate_sensors_in_settings("temps", force);
  }

  read_disk_temps() {
    if (this.show_temp && this.temp_disks.length > 0) {
      for (let disk of this.temp_disks) {
        if (!disk["show_in_tooltip"] && !disk["show_in_panel"]) continue;

        let _disk_name = disk["disk"].trim();
        let command = "/usr/bin/env bash -c '"+SCRIPTS_DIR+"/get_disk_temp.sh "+_disk_name+"'";

        if (!this._temp[_disk_name]) this._temp[_disk_name] = "??";
        let _temp;
        let subProcess = spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
          if (exitCode === 0) {
            if (typeof stdout === "object")
              _temp = to_string(stdout);
            else
              _temp = ""+stdout;

            _temp = 1.0*parseInt(_temp);

            if (!isNaN(_temp)) {
              if (disk["user_formula"] && disk["user_formula"].length > 0) {
                let _user_formula = disk["user_formula"].replace(/\$/g, _temp);
                _temp = 1.0*eval(_user_formula)
              }
            }

            if (typeof _temp === "number") {
              disk["value"] = _temp;
              this._temp[_disk_name] = _temp;
            }
          }
          subProcess.send_signal(9);
        });
      }
    }
  }

  populate_temp_disks_in_settings() {
    let command = SCRIPTS_DIR+"/get_disk_list.sh";
    var temp_disks = this.temp_disks;
    let subProcess = spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
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
      };
      subProcess.send_signal(9);
    });
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
    if (!this.show_tooltip) {
      this.set_applet_tooltip("");
      return
    }
    if (!this.isUpdatingUI) return;

    var _tooltip = "";
    var _tooltips = [];

    // Temperatures:
    if (this.show_temp
      && ((this.temp_disks.length > 0)
         || (this.temp_sensors.length > 0 && this.data !== undefined && Object.keys(this.data["temps"]).length > 0)
        )
    ) {

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
              let _max_temp = (t["high_by_user"] && t["high_by_user"].length > 0 && !isNaN(t["high_by_user"])) ?
                1.0*t["high_by_user"] : 1.0*this._get_max_temp(this.data["temps"][t["sensor"]]);
              _tooltip += "  "+ _("high:") + " " + ((_max_temp < 0) ? _("n/a") : this._formatted_temp(_max_temp));
              let _crit_temp = (t["crit_by_user"] && t["crit_by_user"].length > 0 && !isNaN(t["crit_by_user"])) ?
                1.0*t["crit_by_user"] : 1.0*this._get_crit_temp(this.data["temps"][t["sensor"]]);
              _tooltip += "  "+ _("crit:") + " " + ((_crit_temp < 0) ? _("n/a") : this._formatted_temp(_crit_temp));
              _tooltip += "\n";
              _crit_temp = null;
              _max_temp = null;
              str_value = null;
              name = null
            }
          }
        }
      }

      if (this.show_temp && this.s.getValue("disktemp_is_user_readable") && this.temp_disks.length > 0) {
        for (let disk of this.temp_disks) {
          let _disk_name = disk["disk"].trim();
          if (disk["show_in_tooltip"]) {
            if (!this._temp[_disk_name]) this._temp[_disk_name] = "??";
            let _temp;
            if (disk["value"])
              _temp = disk["value"];

            if (!isNaN(_temp)) {

              let _temp_max = 1*disk["high"];
              let _temp_crit = 1*disk["crit"];

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
        this.read_disk_temps()
      }

      if (_tooltip.length !== 0) {
        _tooltip = C_TEMP + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }

    // Fans:
    _tooltip = "";
    if (this.show_fan && this.fan_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["fans"]).length != 0
        && !this.nothingToShow(this.fan_sensors, true)) {
      if (this.fan_sensors.length > 0) {
        for (let f of this.fan_sensors) {
          if (this.data["fans"][f["sensor"]] !== undefined) {
            if (f["show_in_tooltip"]) {
              let name = (!f["shown_name"]) ?  f["sensor"] : f["shown_name"];
              _tooltip +=  (f["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let _value = 1.0*this.data["fans"][f["sensor"]]["input"];
              if (f["user_formula"] && f["user_formula"].length > 0) {
                let _formula_result = f["user_formula"].replace(/\$/g, _value);
                _value = 1.0*eval(_formula_result)
              }
              let str_value = this._formatted_fan(_value).padStart(10, " ");
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
        _tooltip = C_FAN + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }

    // Voltages:
    _tooltip = "";
    if (this.show_volt && this.volt_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["voltages"]).length != 0
        && !this.nothingToShow(this.volt_sensors, true)) {
      if (this.volt_sensors.length > 0) {
        for (let v of this.volt_sensors) {
          if (this.data["voltages"][v["sensor"]] !== undefined) {
            if (v["show_in_tooltip"]) {
              let name = (!v["shown_name"]) ?  v["sensor"] : v["shown_name"];
              _tooltip += (v["show_in_panel"] && this.bold_italics_main_sensors) ?
                " <i><b>" + name + "</b></i>\n" :
                " " + name + "\n";
              let _value = 1.0*this.data["voltages"][v["sensor"]]["input"];
              if (v["user_formula"] && v["user_formula"].length > 0) {
                let _formula_result = v["user_formula"].replace(/\$/g, _value);
                _value = 1.0*eval(_formula_result)
              }
              let str_value = this._formatted_voltage(_value).padStart(10, " ");
              _tooltip += (this.bold_values) ?
                "  <b>" + str_value + "</b>" :
                "  " + str_value;

              let _max_defined_by_user = v["max_by_user"];
              let _min_defined_by_user = v["min_by_user"];

              let _voltage_max = (_max_defined_by_user && _max_defined_by_user.length > 0 && !isNaN(_max_defined_by_user)) ? 1.0*_max_defined_by_user : 1.0*this._get_max_voltage(this.data["voltages"][v["sensor"]]);
              let _voltage_min = (_min_defined_by_user && _min_defined_by_user.length > 0 && !isNaN(_min_defined_by_user)) ? 1.0*_min_defined_by_user : 1.0*this._get_min_voltage(this.data["voltages"][v["sensor"]]);

              _tooltip += "  "+ _("min:") + " " + this._formatted_voltage(_voltage_min);
              _tooltip += " ";
              _tooltip += "  "+ _("max:") + " " + this._formatted_voltage(_voltage_max);
              _tooltip += "\n";
              str_value = null;
              name = null
            }
          }
        }
      }
      if (_tooltip !== "") {
        _tooltip = C_VOLT + "\n" + _tooltip;
        _tooltips.push(_tooltip.trim());
      }
    }


    //Intrusion:
    _tooltip = "";
    if (this.show_intrusion && this.intrusion_sensors.length !== 0
        && this.data !== undefined && Object.keys(this.data["intrusions"]).length != 0
        && !this.nothingToShow(this.intrusion_sensors, true)) {
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
        _tooltip = C_INTRU + "\n" + _tooltip;
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

  nothingToShow(data, isForTooltip=false) {
      if (data.length === 0) return true;
      var nothing = true;
      for (let d of data) {
          if (!isForTooltip && d["show_in_panel"] === true) {
              nothing = false;
              break
          }
          if (isForTooltip && d["show_in_tooltip"] === true) {
              nothing = false;
              break
          }
      }
      return nothing
  }

  /**
   * updateUI: updates the user interface (that is displayed in the panel).
   */
  updateUI() {
    if (this.isUpdatingUI) return;

    this.isUpdatingUI = true;

    var _appletLabel = "";
    let _monospace = (this.keep_size) ? "sensors-monospace" : "applet-box";
    let _border_type = (this.remove_border) ? "-noborder" : "";
    var _actor_style = "%s sensors-label%s sensors-size%s vertalign-%s".format(_monospace, _border_type, this.char_size, this.vertical_align);

    let vertical = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    let sep = this.separator;
    let _shown_name;
    this.label_parts = [];

    this.data = this.reaper.get_sensors_data();

    // Customs:
    if (this.custom_sensors.length !== 0) {
      for (let cs of this.custom_sensors) {
        let cs_sensor = "CUSTOM: "+cs.shown_name;
        switch (cs.sensor_type) {
          case "temperature":
            if (!this.data["temps"][cs_sensor]) continue;
            let dict = {};
            dict["sensor"] = cs_sensor;
            dict["shown_name"] = cs.shown_name;
            dict["show_in_panel"] = cs.show_in_panel;
            dict["show_in_tooltip"] = cs.show_in_tooltip;
            dict["high_by_user"] = cs.high_by_user;
            dict["crit_by_user"] = cs.crit_by_user;
            dict["user_formula"] = cs.user_formula;
            dict["input"] = this.data["temps"][cs_sensor]["input"];
            this.temp_sensors[cs_sensor] = dict;
            break;
          case "fan":

            break;
          case "voltage":

            break;
          case "intrusion":

            break;
        }
      }
    }

    // Temperatures:
    var nbr_already_shown = 0;
    if (this.show_temp //&& this.temp_sensors.length !== 0
        && this.data !== undefined
        && Object.keys(this.data["temps"]).length != 0
        && !this.nothingToShow(this.temp_sensors)) {
      for (let t of this.temp_sensors) {
        if (this.data["temps"][t["sensor"]] !== undefined) {
          if (t["show_in_panel"]) {
            let _temp = 1.0*this.data["temps"][t["sensor"]]["input"];
            _shown_name = "";
            if (this.show_temp_name) {
              if (vertical)
                _shown_name = t["shown_name"]+"\n";
              else
                _shown_name = t["shown_name"]+" ";
            }

            if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push(C_TEMP);

            if (t["user_formula"] && t["user_formula"].length > 0) {
              let _formula_result = t["user_formula"].replace(/\$/g, _temp);
              _temp = 1.0*eval(_formula_result)
            }

            let _temp_max = (t["high_by_user"] && t["high_by_user"].length > 0 && !isNaN(t["high_by_user"])) ?
              1.0*t["high_by_user"] : 1.0*this._get_max_temp(this.data["temps"][t["sensor"]]);
            let _temp_crit = (t["crit_by_user"] && t["crit_by_user"].length > 0 && !isNaN(t["crit_by_user"])) ?
              1.0*t["crit_by_user"] : 1.0*this._get_crit_temp(this.data["temps"][t["sensor"]]);

            if (isNaN(_temp_crit)) _temp_crit = null;
            if (isNaN(_temp_max)) _temp_max = null;

            if (this.journalize_temp)
              this.loggerTemp.log(_temp, _temp_max, _temp_crit, t["sensor"], (this.use_fahrenheit) ? "°F" : "°C");

            if (!isNaN(_temp_crit) && _temp_crit > 0 && _temp >= _temp_crit) {
              this.label_parts.push(_shown_name + this._formatted_temp(_temp, vertical) + "$");
            } else if (!isNaN(_temp_max) && _temp_max > 0 && _temp >= _temp_max) {
              this.label_parts.push(_shown_name + this._formatted_temp(_temp, vertical) + "£");
            } else {
              this.label_parts.push(_shown_name+this._formatted_temp(_temp, vertical));
            }

            nbr_already_shown += 1;
          }
        }
      }
    }
    if (this.show_temp && this.s.getValue("disktemp_is_user_readable") && this.temp_disks && !this.nothingToShow(this.temp_disks)) {
      for (let disk of this.temp_disks) {
        let _disk_name = disk["disk"].trim();
        if (disk["show_in_panel"] && _disk_name.length > 0) {
          if (!this._temp[_disk_name]) this._temp[_disk_name] = "??";
          if (disk["value"]) this._temp[_disk_name] = disk["value"];
          let _temp;

          _temp = (disk["value"]) ? disk["value"] : '??';
          if (isNaN(_temp)) continue;
          let _temp_max = disk["high"];
          let _temp_crit = disk["crit"];

          if (this.journalize_temp)
            this.loggerTemp.log(_temp, _temp_max, _temp_crit, _disk_name, (this.use_fahrenheit) ? "°F" : "°C");

          _shown_name = "";
          if (this.show_temp_name) {
            if (vertical)
              _shown_name = (disk["shown_name"].length > 0) ? disk["shown_name"]+"\n" : _disk_name+"\n";
            else
              _shown_name = (disk["shown_name"].length > 0) ? disk["shown_name"]+" " : _disk_name+" ";
          }
          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push(C_TEMP);
          let _label_part = _shown_name+this._formatted_temp(_temp, vertical);

          if (_temp >= _temp_crit) {
            this.label_parts.push(""+_label_part+"$");
          } else if (_temp >= _temp_max) {
            this.label_parts.push(""+_label_part+"£");
          } else {
            this.label_parts.push(""+_label_part);
          }
          nbr_already_shown += 1;
        }
      }
      this.read_disk_temps()
    }

    // Fans:
    if (this.show_fan && !this.nothingToShow(this.fan_sensors)
        && this.data !== undefined && Object.keys(this.data["fans"]).length != 0) {

      if (vertical && nbr_already_shown > 0)
        this.label_parts.push("━");
      nbr_already_shown = 0;
      // This pushed "" is useless when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let f of this.fan_sensors) {
        if (f["show_in_panel"]) {
          _shown_name = "";
          if (this.show_fan_name) {
            if (vertical)
              _shown_name = f["shown_name"]+"\n";
            else
              _shown_name = f["shown_name"]+" ";
          }

          let _fan = 1.0*this.data["fans"][f["sensor"]]["input"];
          if (f["user_formula"] && f["user_formula"].length > 0) {
            let _formula_result = f["user_formula"].replace(/\$/g, _fan);
            _fan = 1.0*eval(_formula_result)
          }

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push(C_FAN); //✇

          let _fan_min = (f["min_by_user"] && f["min_by_user"].length > 0 && !isNaN(f["min_by_user"])) ?
            1.0*f["min_by_user"] : 1.0*this._get_min_fan(this.data["fans"][f["sensor"]]);

          if (_fan < _fan_min) {
            this.label_parts.push(_shown_name+this._formatted_fan(_fan, vertical)+"$");
          } else {
            this.label_parts.push(_shown_name+this._formatted_fan(_fan, vertical));
          }

          if (this.journalize_fan)
            this.loggerFan.log(_fan, _fan_min, f["sensor"]);


          nbr_already_shown += 1;
        }
      }
    }

    // Voltages:
    if (this.show_volt && !this.nothingToShow(this.volt_sensors)
        && this.data !== undefined && Object.keys(this.data["voltages"]).length != 0) {

      if (vertical && nbr_already_shown > 0)
        this.label_parts.push("━");
      nbr_already_shown = 0;
      // This pushed "" is useful when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let v of this.volt_sensors) {
        if (v["show_in_panel"]) {
          let _voltage = 1.0*this.data["voltages"][v["sensor"]]["input"];
          _shown_name = "";
          if (this.show_volt_name) {
            if (vertical)
            _shown_name = v["shown_name"]+"\n";
            else
              _shown_name = v["shown_name"]+" ";
          }

          if (v["user_formula"] && v["user_formula"].length > 0) {
            let _formula_result = v["user_formula"].replace(/\$/g, _voltage);
            _voltage = 1.0*eval(_formula_result)
          }
          let str_value = this._formatted_voltage(_voltage).padStart(10, " ");

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push(C_VOLT);

          let _max_defined_by_user = v["max_by_user"];
          let _min_defined_by_user = v["min_by_user"];

          let _voltage_max = (_max_defined_by_user && _max_defined_by_user.length > 0 && !isNaN(_max_defined_by_user)) ? 1.0*_max_defined_by_user : 1.0*this._get_max_voltage(this.data["voltages"][v["sensor"]]);
          let _voltage_min = (_min_defined_by_user && _min_defined_by_user.length > 0 && !isNaN(_min_defined_by_user)) ? 1.0*_min_defined_by_user : 1.0*this._get_min_voltage(this.data["voltages"][v["sensor"]]);

          if (_voltage >= _voltage_max || _voltage < _voltage_min) {
            this.label_parts.push(_shown_name+this._formatted_voltage(_voltage, vertical)+"$");
          } else {
            this.label_parts.push(_shown_name+this._formatted_voltage(_voltage, vertical));
          }

          if (this.journalize_volt)
            this.loggerVoltage.log(_voltage, _voltage_min, _voltage_max, v["sensor"]);

          nbr_already_shown += 1;
        }
      }
    }

    // Intrusion:
    if (this.show_intrusion && !this.strictly_positive_intrusion && !this.nothingToShow(this.intrusion_sensors)
        && this.data !== undefined && Object.keys(this.data["intrusions"]).length != 0) {

      if (vertical && nbr_already_shown > 0)
        this.label_parts.push("━");
      nbr_already_shown = 0;

      // This pushed "" is useless when there is no sensor to display:
      if (this.label_parts.length > 0) this.label_parts.push("");

      for (let i of this.intrusion_sensors) {
        if (i["show_in_panel"]) {
          let _intrusion = this.data["intrusions"][i["sensor"]]["alarm"];
          _shown_name = "";
          if (this.show_intrusion_name) {
            if (vertical)
              _shown_name = i["shown_name"]+"\n";
            else
              _shown_name = i["shown_name"]+" ";
          }

          if (nbr_already_shown === 0 && !this.remove_icons) this.label_parts.push(C_INTRU);
          this.label_parts.push(_shown_name+this._formatted_intrusion(_intrusion, vertical));

          let _intrusion_alarm = this._get_alarm_intrusion(this.data["intrusions"][i["sensor"]]);

          if (_intrusion_alarm)
            _actor_style = "%s sensors-critical%s sensors-size%s vertalign-%s".format(_monospace, _border_type, this.char_size, this.vertical_align);

          if (this.journalize_intrusion)
            this.loggerIntrusion.log(_intrusion_alarm, i["sensor"]);


          nbr_already_shown += 1;
        }
      }
    }

    if (this.label_parts.length === 0) {
      _appletLabel = this._get_default_applet_label();
    } else {
      _appletLabel = this.label_parts.join(sep);
      if (!this.keep_size) {
        while (_appletLabel.includes("  ")) {
          _appletLabel = _appletLabel.replace(/  /g, " ");
        }
      }

      while (_appletLabel.includes("\n\n")) {
        _appletLabel = _appletLabel.replace(/\n\n/g, "\n");
      }
      var sep_twice = "" + this.separator.trim() + " " + this.separator.trim();
      if (sep_twice.length > 1) {
        while (_appletLabel.indexOf(sep_twice) > -1) {
          _appletLabel = _appletLabel.replace(sep_twice, this.separator.trim());
        }
      }
      sep_twice = "" + this.separator + this.separator;
      if (sep_twice.length > 1) {
        while (_appletLabel.includes(sep_twice)) {
          _appletLabel = _appletLabel.replace(sep_twice, this.separator);
        }
      }
      while (_appletLabel.slice(-1) === this.separator) {
        _appletLabel = _appletLabel.slice(0, -1)
      }
    }
    this.set_applet_label(_appletLabel);

    this.actor.set_style_class_name(_actor_style);
    if (this.horizontal_width > 0 && (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM))
      this.actor.set_style(`width: ${this.horizontal_width}px;`);
    else
      this.actor.set_style(null);

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
    if (this.menu.isOpen) this.menu.close();
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
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.menu.isOpen) this.menu.close();
            this.pids.push(spawnCommandLine("/usr/bin/xlet-settings applet %s &".format(UUID)));
          },
          300
        );
      }
    );
    this.menu.addMenuItem(_general_button);

    // Button Temperature:
    let _temp_button = new PopupMenu.PopupMenuItem("  " + _("%s Temperature sensors").format(C_TEMP));
    _temp_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.menu.isOpen) this.menu.close();
            this.pids.push(spawnCommandLineAsync("%s applet %s -t 1 &".format(XS_PATH, UUID)));
          },
          300
        );
      }
    );
    this.menu.addMenuItem(_temp_button);

    // Button Fan:
    let _fan_button = new PopupMenu.PopupMenuItem("  " + _("%s Fan sensors").format(C_FAN));
    _fan_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.menu.isOpen) this.menu.close();
            this.pids.push(spawnCommandLine("%s applet %s -t 2 &".format(XS_PATH, UUID)));
          },
          300
        );
      }
    );
    this.menu.addMenuItem(_fan_button);

    // Button Voltage:
    let _voltage_button = new PopupMenu.PopupMenuItem("  " + _("%s Voltage sensors").format(C_VOLT));
    _voltage_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.menu.isOpen) this.menu.close();
            this.pids.push(spawnCommandLine("%s applet %s -t 3 &".format(XS_PATH, UUID)));
          },
          300
        );
      }
    );
    this.menu.addMenuItem(_voltage_button);

    // Button Intrusion:
    let _intrusion_button = new PopupMenu.PopupMenuItem("  " + _("%s Intrusion sensors").format(C_INTRU));
    _intrusion_button.connect("activate",
      (event) => {
        this.kill_all_pids();
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.menu.isOpen) this.menu.close();
            this.pids.push(spawnCommandLine("%s applet %s -t 4 &".format(XS_PATH, UUID)));
          },
          300
        );
      }
    );
    this.menu.addMenuItem(_intrusion_button);

    // Button Custom:
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Button xsensors
    let _values_in_real_time_button = new PopupMenu.PopupIconMenuItem(_("Run xsensors"),
                                                                      "application-x-executable",
                                                                      St.IconType.SYMBOLIC
    );
    _values_in_real_time_button.connect("activate", this._on_xsensors_pressed);
    this.menu.addMenuItem(_values_in_real_time_button);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Button suspend
    let suspend_switch = new PopupMenu.PopupSwitchMenuItem(_("Suspend Sensors"), this.suspended);
    suspend_switch.connect("toggled", () => {
      this.menu.toggle();
      this.suspended = !this.suspended;
    });
    this.menu.addMenuItem(suspend_switch);
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

    if (this.use_fahrenheit) {
      _t = this._toFahrenheit(t);
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
        if (0 < _v < 1) {
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
      return 127.0
    }
  }

  _get_min_voltage(dico) {
    if (dico["min"] !== undefined && !isNaN(dico["min"])) {
      return 1.0 * dico["min"]
    } else {
      return 0.0
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
    if (this.loopId != null) {
        source_remove(this.loopId);
        this.loopId = null;
    }
    this.detect_markup();
    this.isLooping = true;
    this.loopId = timeout_add_seconds(this.interval, () => { this.reap_sensors(); });
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

    if (this.checkDepInterval != null) {
      clearInterval(this.checkDepInterval);
      this.checkDepInterval = null;
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

    this.loggerTemp.previous_values = {};
    this.loggerFan.previous_values = {};
    this.loggerVoltage.previous_values = {};
    this.loggerIntrusion.previous_values = {};
  }

  on_applet_removed_from_panel() {
    this.on_applet_reloaded();
    remove_all_sources();
  }

  on_applet_added_to_panel(userEnabled) {
    // Check about dependencies:
    this.checkDepInterval = null;
    if (this.dependencies.areDepMet()) {
      // All dependencies are installed. Now, run the loop!:
      this.isLooping = true;
      this.reap_sensors();
    } else {
      // Some dependencies are missing. Suggest to the user to install them.
      this.isLooping = false;
      this.checkDepInterval = setInterval(
        () => {
          clearInterval(this.checkDepInterval);
          this.dependencies.check_dependencies();
          this.checkDepInterval = null;
        },
        10000
      );
    }
  }

  kill_all_pids() {
    if (!this.pids) return;

    while (this.pids.length != 0) {
      let pid = this.pids.pop();
      if (pid != undefined)
        spawnCommandLineAsync("kill -9 %s".format(pid.toString()));
    }
  }

  _get_default_applet_label() {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
      return DEFAULT_APPLET_LABEL.join("\n");
    else
      return DEFAULT_APPLET_LABEL.join("");
  }

  /**
   * Buttons in settings
   */
  on_option_menu_reload_this_applet_clicked() {
    if (this.menu.isOpen) this.menu.close();
    // Reload this applet:
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
  }

  /**
   * General tab: buttons
   */
  _on_report_button_pressed() {
    let text = this.reaper.get_sensors_data_formatted_text();

    GLib.file_set_contents(XDG_RUNTIME_DIR + "/Sensors_report.txt", text);
    if (this.menu.isOpen) this.menu.close();
    let _to = setTimeout( () => {
        clearTimeout(_to);
        spawnCommandLineAsync("%s/show_sensor_values.sh".format(SCRIPTS_DIR));
      },
      300
    );
  }

  _on_xsensors_pressed() {
    let _to = setTimeout( () => {
        clearTimeout(_to);
        spawnCommandLineAsync("/usr/bin/xsensors &");
      },
      300
    );
  }

  _on_open_README() {
    if (this.menu.isOpen) this.menu.close();
    let _to = setTimeout( () => {
        clearTimeout(_to);
        spawnCommandLineAsync("xdg-open "+APPLET_DIR+"/README.pdf");
      },
      300
    );
  }

  _on_remove_temperatureATfevimu_from_panels() {
    if (this.menu.isOpen) this.menu.close();
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

  _on_disktemp_button_pressed() {
    let subProcess = spawnCommandLineAsyncIO(
      "/usr/bin/env bash -c '%s/pkexec_make_smartctl_usable_by_sudoers.sh %s'".format(SCRIPTS_DIR, this.sudo_or_wheel),
      (out, err, exitCode) => {
        this.s.setValue("disktemp_is_user_readable", this.is_disktemp_user_readable());
        subProcess.send_signal(9);
    });
  }

  /**
   * Events
   */
  on_enter_event(actor, event) {
    this.isActorEntered = true;
    this.onEnterEventInterval = setInterval( () => {
        this.tooltip_must_be_updated = true;
        this.reap_sensors();
        this.isUpdatingUI = false; //new
        this.updateUI();
        this.isUpdatingUI = true;
        this.updateTooltip();
        return this.isActorEntered;
      },
      1000
    );
  }

  on_leave_event(actor, event) {
    this.isActorEntered = false;
    if (this.onEnterEventInterval != null) {
      clearInterval(this.onEnterEventInterval);
      this.onEnterEventInterval = false;
    }
    this.tooltip_must_be_updated = false;
    this.isUpdatingUI = false;
    this.isActorEntered = false;
    remove_all_sources();
    this.loopId = timeout_add_seconds(this.interval, () => { this.reap_sensors(); });
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
