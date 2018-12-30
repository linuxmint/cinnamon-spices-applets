/* Spices Update (SpicesUpdate@claudiux)
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++ Needed for icons
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  Needed for on_response function call
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Mainloop = imports.mainloop; // Needed for timer update loop
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for notify()
const MessageTray = imports.ui.messageTray; // ++ Needed for the criticalNotify() function in this script
const Util = imports.misc.util; // Needed for spawnCommandLine()
const Extension = imports.ui.extension; // Needed to reload applets
const Json = imports.gi.Json;
const Soup = imports.gi.Soup;
const Signals = imports.signals;
const Cinnamon = imports.gi.Cinnamon; // Needed to read/write into a file

var UUID="SpicesUpdater@claudiux";

const HOME_DIR = GLib.get_home_dir();
// ++ Set DEBUG to true to display log messages in ~/.cinnamon/glass.log
// ++ Set DEBUG to false in production.
// ++ DEBUG is true only if the DEBUG file is present in this applet directory ($ touch DEBUG)
var _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
const DEBUG = _debug.query_exists(null);

const URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com";
const CONFIG_DIR = HOME_DIR + "/.cinnamon/configs";
const SU_CONFIG_DIR = CONFIG_DIR + "/" + UUID;
const CACHE_DIR = HOME_DIR + "/.cinnamon/spices.cache";

const TYPES = ['applets', 'themes', 'desklets', 'extensions'];

const URL_MAP = {
  'applets': URL_SPICES_HOME + "/json/applets.json",
  'themes': URL_SPICES_HOME + "/json/themes.json",
  'desklets': URL_SPICES_HOME + "/json/desklets.json",
  'extensions': URL_SPICES_HOME + "/json/extensions.json"
}

const CACHE_MAP = {
  'applets': CACHE_DIR + "/applet/index.json",
  'themes': CACHE_DIR + "/theme/index.json",
  'desklets': CACHE_DIR + "/desklet/index.json",
  'extensions': CACHE_DIR + "/extension/index.json"
}

const DIR_MAP = {
  'applets': HOME_DIR + "/.local/share/cinnamon/applets",
  'themes': HOME_DIR + "/.themes",
  'desklets': HOME_DIR + "/.local/share/cinnamon/desklets",
  'extensions': HOME_DIR + "/.local/share/cinnamon/extensions"
}

const DCONFCACHEUPDATED = {
  'applets': "org.cinnamon",
  'themes': "org.cinnamon.theme",
  'desklets': "org.cinnamon",
  'extensions': "org.cinnamon"
}

// ++ Needed if some http(s) requests are required
const _httpSession = new Soup.SessionAsync();
_httpSession.timeout=60;
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

// ++ l10n support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str) {
  var customTrans = Gettext.dgettext(UUID, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Dummy bidon variable for translation (don't remove these lines):
let bidon = _("Applet");
bidon = _("Desklet");
bidon = _("Extension");
bidon = _("Theme");
bidon = _("Applets");
bidon = _("Desklets");
bidon = _("Extensions");
bidon = _("Themes");
bidon = _("One desklet needs update:");
bidon = _("One applet needs update:");
bidon = _("One extension needs update:");
bidon = _("One theme needs update:");
bidon = _("Some desklets need update:");
bidon = _("Some applets need update:");
bidon = _("Some extensions need update:");
bidon = _("Some themes need update:");
bidon = _("Reloaded applet:");
bidon = _("Reloaded desklet:");
bidon = _("Reloaded extension:");
bidon = null;

// ++ Useful for logging in .xsession_errors
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG is set to true.
 * log("Any message here", true) to log the message even if DEBUG is set to false.
 * logError("Any error message") log the error message regardless of the DEBUG value.
 */
function log(message, alwaysLog=false) {
  if (DEBUG || alwaysLog) global.log("\n[" + UUID + "]: " + message + "\n");
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

/**
 * criticalNotify:
 * (Code from imports.ui.main ; modified to return notification, to allow to destroy it.)
 * @msg: A critical message
 * @details: Additional information
 */
var messageTray = new MessageTray.MessageTray();
function criticalNotify(msg, details, icon) {
  let source = new MessageTray.SystemNotificationSource();
  messageTray.add(source);
  let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
  notification.setTransient(false);
  notification.setUrgency(MessageTray.Urgency.CRITICAL);
  source.notify(notification);
  return notification
}

const NOTIFY_OK = true;
/**
 * notify_send:
 * Interface with the notify-send command.
 * @message: message to display.
 * @icon_path: path to the icon to display beside the message (default: the path to the icon of this applet).
 * @duration: duration, in seconds, of the display of the message on the screen (default: 10 seconds).
 * @urgency: must be "low", "normal" or "critical" (default: "low").
 */
function notify_send(message, duration=5000, urgency="normal", icon_path=null) {
  if (NOTIFY_OK === true) {
    let _icon;
    if (icon_path) {
      _icon = icon_path
    } else {
      _icon = HOME_DIR + '/.local/share/cinnamon/applets/' + UUID + '/icons/spices-updater-symbolic.svg'
    }
    let notification = "notify-send \""+ message + "\" -i " + _icon + " -t "+ duration.toString() +" -u " + urgency;
    Util.spawnCommandLine(notification);
  }
}

function deleteGFile(file) {
  // Work around 'delete' being a keyword in JS.
  return file['delete'](null);
}

function recursivelyDeleteDir(dir, deleteParent) {
  let children = dir.enumerate_children('standard::name,standard::type',
                                        Gio.FileQueryInfoFlags.NONE, null);

  let info, child;
  while ((info = children.next_file(null)) != null) {
    let type = info.get_file_type();
    let child = dir.get_child(info.get_name());
    if (type == Gio.FileType.REGULAR)
      deleteGFile(child);
    else if (type == Gio.FileType.DIRECTORY)
      recursivelyDeleteDir(child, true);
  }

  if (deleteParent)
    deleteGFile(dir);
}

function recursivelyMoveDir(srcDir, destDir) {
  let children = srcDir.enumerate_children('standard::name,standard::type',
                                           Gio.FileQueryInfoFlags.NONE, null);

  if (!destDir.query_exists(null))
    destDir.make_directory_with_parents(null);

  let info, child;
  while ((info = children.next_file(null)) != null) {
    let type = info.get_file_type();
    let srcChild = srcDir.get_child(info.get_name());
    let destChild = destDir.get_child(info.get_name());
    if (type == Gio.FileType.REGULAR)
      srcChild.move(destChild, Gio.FileCopyFlags.NONE, null, null);
    else if (type == Gio.FileType.DIRECTORY)
      recursivelyMoveDir(srcChild, destChild);
  }
}

/**
 * spawnCommandLineAsync:
 * @command: a command
 * @callback (function): called on success or failure
 * @opts (object): options: argv, flags, input
 *
 * Runs @command in the background. Callback has three arguments -
 * stdout, stderr, and exitCode.
 *
 * Returns (object): a Gio.Subprocess instance
 */
function spawnCommandLineAsync(command, callback, opts = {}) {
    let {argv, flags, input} = opts;
    if (!input) input = null;

    let subprocess = new Gio.Subprocess({
        argv: argv ? argv : ['bash', '-c', command],
        flags: flags ? flags
            : Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    subprocess.init(null);
    let cancellable = new Gio.Cancellable();

    subprocess.communicate_utf8_async(input, cancellable, (obj, res) => {
        let success, stdout, stderr, exitCode;
        // This will throw on cancel with "Gio.IOErrorEnum: Operation was cancelled"
        tryFn(() => [success, stdout, stderr] = obj.communicate_utf8_finish(res));
        if (typeof callback === 'function' && !cancellable.is_cancelled()) {
            if (stderr && stderr.indexOf('bash: ') > -1) {
                stderr = stderr.replace(/bash: /, '');
            }
            exitCode = success ? subprocess.get_exit_status() : -1;
            callback(stdout, stderr, exitCode);
        }
        subprocess.cancellable = null;
    });
    subprocess.cancellable = cancellable;

    return subprocess;
}; // End of spawnCommandLineAsync

class ActivityLogging {
  constructor(metadata, nbdays=30, active=true) {
    this.metadata = metadata;
    this.uuid = metadata.uuid;
    this.set_active(active);
    this.set_lifetime(nbdays); // to cut logfile
    this.time_options = {year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
      hour12: !this._get_system_use24h(), timeZone: this._get_timezone(), timeZoneName: "short"};

    GLib.spawn_command_line_async("bash -c 'touch "+ this.log_file_path() +"'");
  } // End of constructor

  log_file_path() {
    let ret = GLib.get_home_dir() + "/.cinnamon/configs/" + this.uuid + "/SU_activity.log";
    return ret
  } // End of log_file_path

  _get_epoch(d) {
    return Math.round(Date.parse(d)/1000);
  } // End of _get_epoch

  _get_system_use24h() {
    let _SETTINGS_SCHEMA='org.cinnamon.desktop.interface';
    let _SETTINGS_KEY = 'clock-use-24h';
    let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
    let ret = _interface_settings.get_boolean(_SETTINGS_KEY);
    return ret
  } // End of get_system_icon_theme

  _get_timezone() {
    let [res, out, err, status] = GLib.spawn_command_line_sync("timedatectl show -p Timezone");
      // res is a boolean : true if command line has been correctly executed
      // out is the return of the script (as that is sent by 'echo' command in a bash script)
      // err is the error message, if an error occured
      // status is the status code (as that is sent by an 'exit' command in a bash script)
    return out.toString().trim().split("=")[1];
  } // End of _get_timezone

  _get_user_language() {
    return GLib.getenv("LANG").split(".")[0].replace("_","-")
  } // End of get_user_language

  set_active(active) {
    this.is_active = active
  } // End of set_active

  set_lifetime(days) {
    this.lifetime = 86400 * days; // 1 day = 84600 seconds
  } // End of set_lifetime

  truncate_log_file() {
    if (this.is_active) {
      let date = new Date();
      let limit = this._get_epoch(date)-this.lifetime;
      // Read file contents:
      let contents = Cinnamon.get_file_contents_utf8_sync(this.log_file_path()).split("\n");
      var line;
      var epoch_date, new_contents = [];
      // keep recent lines:
      for (line of contents) {
        if (line != '') {
          epoch_date = eval(line.split(" - ")[0].valueOf());
          if (epoch_date > limit) new_contents.push(line.trim());
        }
      }
      // Write new contents in log file
      if (new_contents.length !== contents.length) {
        let file = Gio.file_new_for_path(this.log_file_path());
        let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out = Gio.BufferedOutputStream.new_sized (raw, 4096);
        for (line of new_contents) {
          Cinnamon.write_string_to_stream(out, line + "\n")
        }
        out.close(null);
      }
      contents = []; new_contents = [];
    }
  } // End of truncate_log_file

  display_logs() {
    let command;
    command = this.metadata.path + '/egSpawn.js';
    GLib.spawn_command_line_async(command);
  } // End of display_logs

  log(s) {
    if (this.is_active) {
      let d = new Date();
      let date_string = new Intl.DateTimeFormat(this._get_user_language(), this.time_options).format(d);
      let command = "\"echo '"+ this._get_epoch(d).toString() + " - " + date_string + " - " + s + "' >> " + this.log_file_path() + "\"";
      GLib.spawn_command_line_async("bash -c " + command);
    }
  } // End of log
}; //End of class ActivityLogging

class SpicesUpdater extends Applet.TextIconApplet {
  constructor (metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);
    this.instanceId = instance_id;
    this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
    this.appletPath = metadata.path;
    this.set_applet_icon_path(this.appletPath + "/icons/spices-updater-symbolic.svg");
    this._applet_icon.set_icon_size(22);
    this.set_applet_tooltip(_("Spices Updater"));

    this.OKtoPopulateSettingsApplets = true;
    this.OKtoPopulateSettingsDesklets = true;
    this.OKtoPopulateSettingsExtensions = true;
    this.OKtoPopulateSettingsThemes = true;
    this.notification = null;

    this.OKtoPopulateSettings = {
      "applets": true,
      "desklets": true,
      "extensions": true,
      "themes": true
    }

    this.unprotectedDico = {
      "applets": {},
      "desklets": {},
      "extensions": {},
      "themes": {}
    };
    this.unprotectedList = {
      "applets": [],
      "desklets": [],
      "extensions": [],
      "themes": []
    };

    this.cache = {
      "applets": "{}",
      "desklets": "{}",
      "extensions": "{}",
      "themes": "{}"
    };

    this.oldCache = {
      "applets": "{}",
      "desklets": "{}",
      "extensions": "{}",
      "themes": "{}"
    };

    this.ready_to_unzip = {
      "applets": [],
      "desklets": [],
      "extensions": [],
      "themes": []
    };

    this.menuDots = {
      "applets": false,
      "desklets": false,
      "extensions": false,
      "themes": false
    };

    // Make folders to unzip the zip files: // (Became useless.)
    //for (let t of TYPES) {
      //GLib.mkdir_with_parents(SU_CONFIG_DIR + "/" + t.toString(), 0o777);
    //}

    // ++ Settings
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);

    // Applets
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, // Setting type
      "check_applets", // The setting key
      "check_applets", // The property to manage (this.check_applets)
      this.on_settings_changed, // Callback when value changes
      null); // Optional callback data

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "update_applets",
      "update_applets",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "unprotected_applets",
      "unprotected_applets",
      this.populateSettingsUnprotectedApplets,
      null);

    // Desklets
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "check_desklets",
      "check_desklets",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "update_desklets",
      "update_desklets",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "unprotected_desklets",
      "unprotected_desklets",
      this.populateSettingsUnprotectedDesklets,
      null);

    // Extensions
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "check_extensions",
      "check_extensions",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "update_extensions",
      "update_extensions",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "unprotected_extensions",
      "unprotected_extensions",
      this.populateSettingsUnprotectedExtensions,
      null);

    // Themes
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "check_themes",
      "check_themes",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "update_themes",
      "update_themes",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "unprotected_themes",
      "unprotected_themes",
      this.populateSettingsUnprotectedThemes,
      null);

    // General settings
    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_frequency",
      "general_frequency",
      this.on_settings_changed,
      null);
      this.refreshInterval = 3600*this.general_frequency;

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_warning",
      "general_warning",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "events_color",
      "events_color",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_notifications",
      "general_notifications",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "doLogActivity",
      "doLogActivity",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "logLifetime",
      "logLifetime",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "displayType",
      "displayType",
      this.on_settings_changed,
      null);

    // Logging activity:
    this.activityLog = new ActivityLogging(metadata, this.logLifetime, this.doLogActivity);
    this.activityLog.truncate_log_file();
    this.next_truncation = 86400;

    this.on_orientation_changed(orientation);

    this.populateSettingsUnprotectedApplets();
    this.populateSettingsUnprotectedDesklets();
    this.populateSettingsUnprotectedExtensions();
    this.populateSettingsUnprotectedThemes();
    /*
    for (let t of TYPES) {
      log("t = " + t.toString());
      this.populateSettingsUnprotected(t.toString());
    }
    */

    // Dependencies:
    this.dependenciesMet = this.are_dependencies_installed();
    if (!this.dependenciesMet) this.refreshInterval = 5;

    // ++ Set up Left Click Menu
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    // Default icon color
    let themeNode = this.actor.get_theme_node();
    this.icon_color = themeNode.get_icon_colors();
    this.defaultColor = "rgba("+this.icon_color.red+","+this.icon_color.green+","+this.icon_color.blue+","+this.icon_color.alpha+")";

    this.testblink = [];
    this.forceRefresh = false;
    this.applet_running = true;
    this.first_loop = true; // To do nothing for 2 minutes.
    this.on_settings_changed();
  }; // End of constructor

  on_orientation_changed (orientation) {
    this.orientation = orientation;
    this.isHorizontal = !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    this._set_main_label();
  }; // End of on_orientation_changed

  _set_main_label() {
    if (this.displayType === "compact") {
      this.set_applet_label("");
    } else {
      if (this.isHorizontal === true) {
        this.set_applet_label("Spices Updater");
      } else {
        this.set_applet_label("SpU");
      }
    }
  }; // End of _set_main_label

  // ++ Function called when settings are changed
  on_settings_changed() {
    // Label
    this._set_main_label();

    // Refresh intervall:
    this.refreshInterval = 3600*this.general_frequency;

    this.activityLog.set_active(this.doLogActivity);
    if (this.doLogActivity === true) {
      this.activityLog.set_lifetime(this.logLifetime);
      this.activityLog.truncate_log_file();
      this.next_truncation = 86400; // 86400 seconds = 1 day
    }

    // Types to check / to update
    this.types_to_check = [];
    this.types_to_update = [];

    // Applets
    let _dir_applets = Gio.file_new_for_path(DIR_MAP["applets"]);
    if (!_dir_applets.query_exists(null)) {
      this.check_applets = false;
      this.update_applets = false;
    }
    if (this.check_applets) {
      this.types_to_check.push('applets');
      if (this.update_applets) this.types_to_update.push('applets');
    } else {
      this.update_applets = false;
      this.menuDots['applets'] = false;
    }

    // Desklets
    let _dir_desklets = Gio.file_new_for_path(DIR_MAP["desklets"]);
    if (!_dir_desklets.query_exists(null)) {
      this.check_desklets = false;
      this.update_desklets = false;
    }
    if (this.check_desklets) {
      this.types_to_check.push('desklets');
      if (this.update_desklets) this.types_to_update.push('desklets');
    } else {
      this.update_desklets = false;
      this.menuDots['desklets'] = false;
    }

    // Themes
    let _dir_themes = Gio.file_new_for_path(DIR_MAP["themes"]);
    if (!_dir_themes.query_exists(null)) {
      this.check_themes = false;
      this.update_themes = false;
    }
    if (this.check_themes) {
      this.types_to_check.push('themes');
      if (this.update_themes) this.types_to_update.push('themes');
    } else {
      this.update_themes = false;
      this.menuDots['themes'] = false;
    }

    // Extensions
    let _dir_extensions = Gio.file_new_for_path(DIR_MAP["extensions"]);
    if (!_dir_extensions.query_exists(null)) {
      this.check_extensions = false;
      this.update_extensions = false;
    }
    if (this.check_extensions) {
      this.types_to_check.push('extensions');
      if (this.update_extensions) this.types_to_update.push('extensions');
    } else {
      this.update_extensions = false;
      this.menuDots['extensions'] = false;
    }
    //log("this.types_to_check = " + this.types_to_check);
    //log("this.types_to_update = " + this.types_to_update);

    //this.settings._checkSettings();
    // Run the loop !
    this.updateLoop();
  }; // End of on_settings_changed

  // Buttons in settings:
  on_btn_cs_applets_pressed() {
    GLib.spawn_command_line_async('bash -c \'cinnamon-settings applets\'');
  }; // End of on_btn_cs_applets_pressed
  on_btn_cs_desklets_pressed() {
    GLib.spawn_command_line_async('bash -c \'cinnamon-settings desklets\'');
  }; // End of on_btn_cs_desklets_pressed
  on_btn_cs_extensions_pressed() {
    GLib.spawn_command_line_async('bash -c \'cinnamon-settings extensions\'');
  }; // End of on_btn_cs_extensions_pressed
  on_btn_cs_themes_pressed() {
    GLib.spawn_command_line_async('bash -c \'cinnamon-settings themes\'');
  }; // End of on_btn_cs_themes_pressed

  /**
   * #populateSettingsUnprotectedApplets:
   *
   * this.unprotectedAppletsDico example:
   {
   "batterymonitor@pdcurtis" : true,
   "Cinnamenu@json" : true,
   "github-projects@morgan-design.com" : true,
   "IcingTaskManager@json" : true,
   "multicore-sys-monitor@ccadeptic23" : true,
   "placesCenter@scollins" : true,
   "sessionManager@scollins" : false,
   "spices-notifier@germanfr" : true,
   "SpicesUpdater@claudiux" : false,
   "sound150@claudiux" : false,
   "vpnLookOut@claudiux" : false, etc...
   }
   * this.unprotectedAppletsList example:
   [
      {
        "name" : "batterymonitor@pdcurtis",
        "isunprotected" : true
      },
      {
        "name" : "Cinnamenu@json",
        "isunprotected" : true
      }, etc...
    ]
    * (true when updates are requested by the user)
  */
  populateSettingsUnprotectedApplets() {
    if (this.OKtoPopulateSettingsApplets === true) {
      this.OKtoPopulateSettingsApplets = false; // Prevents multiple access to the json config file of SpiceUpdater@claudiux.
      //log("!!!! populate Settings APPLETS !!!!");
      this.unprotectedAppletsDico = {};
      this.unprotectedAppletsList = [];
      // populateSettings this.unprotectedApplets with the this.unprotected_applets elements:
      let a;
      for (var i=0; i < this.unprotected_applets.length; i++) {
        a = this.unprotected_applets[i];
        this.unprotectedAppletsDico[a["name"]] = a["isunprotected"];
        this.unprotectedAppletsList.push({"name": a["name"], "isunprotected": a["isunprotected"]});
      }

      // Are there new applets installed? If there are, then push them in this.unprotectedApplets:
      let dir = Gio.file_new_for_path(DIR_MAP["applets"]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, type;
        var name;
        while ((info = children.next_file(null)) != null) {
          type = info.get_file_type();
          if (type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedAppletsDico[name] === undefined) {
              this.unprotectedAppletsList.push({"name": name, "isunprotected": true});
              this.unprotectedAppletsDico[name] = {"name": name, "isunprotected": true};
            }
          }
        }
        //this.unprotected_applets = this.unprotectedAppletsList.sort((a,b) => (a["name"].toLowerCase() > b["name"].toLowerCase() ? 1 : ((b["name"].toLowerCase() > a["name"].toLowerCase()) ? -1 : 0)));
        this.unprotected_applets = this.unprotectedAppletsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedApplets

  populateSettingsUnprotectedDesklets() {
    if (this.OKtoPopulateSettingsDesklets === true) {
      this.OKtoPopulateSettingsDesklets = false;
      //log("!!!! populate Settings DESKLETS !!!!");
      this.unprotectedDeskletsDico = {};
      this.unprotectedDeskletsList = [];
      // populateSettings this.unprotectedDesklets with the this.unprotected_desklets elements:
      let a;
      for (var i=0; i < this.unprotected_desklets.length; i++) {
        a = this.unprotected_desklets[i];
        this.unprotectedDeskletsDico[a["name"]] = a["isunprotected"];
        this.unprotectedDeskletsList.push({"name": a["name"], "isunprotected": a["isunprotected"]});
      }

      // Are there new desklets installed? If there are, then push them in this.unprotectedDesklets:
      let dir = Gio.file_new_for_path(DIR_MAP["desklets"]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, type;
        var name;
        while ((info = children.next_file(null)) != null) {
          type = info.get_file_type();
          if (type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedDeskletsDico[name] === undefined) {
              this.unprotectedDeskletsList.push({"name": name, "isunprotected": true});
              this.unprotectedDeskletsDico[name] = {"name": name, "isunprotected": true};
            }
          }
        }
        //this.unprotected_desklets = this.unprotectedDeskletsList.sort((a,b) => (a["name"].toLowerCase() > b["name"].toLowerCase() ? 1 : ((b["name"].toLowerCase() > a["name"].toLowerCase()) ? -1 : 0)));
        this.unprotected_desklets = this.unprotectedDeskletsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedDesklets

  populateSettingsUnprotectedExtensions() {
    if (this.OKtoPopulateSettingsExtensions === true) {
      this.OKtoPopulateSettingsExtensions = false;
      //log("!!!! populate Settings EXTENSIONS !!!!");
      this.unprotectedExtensionsDico = {};
      this.unprotectedExtensionsList = [];
      // populateSettings this.unprotectedExtensions with the this.unprotected_extensions elements:
      let a;
      for (var i=0; i < this.unprotected_extensions.length; i++) {
        a = this.unprotected_extensions[i];
        this.unprotectedExtensionsDico[a["name"]] = a["isunprotected"];
        this.unprotectedExtensionsList.push({"name": a["name"], "isunprotected": a["isunprotected"]});
      }

      // Are there new extensions installed? If there are, then push them in this.unprotectedExtensions:
      let dir = Gio.file_new_for_path(DIR_MAP["extensions"]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, type;
        var name;
        while ((info = children.next_file(null)) != null) {
          type = info.get_file_type();
          if (type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedExtensionsDico[name] === undefined) {
              this.unprotectedExtensionsList.push({"name": name, "isunprotected": true});
              this.unprotectedExtensionsDico[name] = {"name": name, "isunprotected": true};
            }
          }
        }
        //this.unprotected_extensions = this.unprotectedExtensionsList.sort((a,b) => (a["name"].toLowerCase() > b["name"].toLowerCase() ? 1 : ((b["name"].toLowerCase() > a["name"].toLowerCase()) ? -1 : 0)));
        this.unprotected_extensions = this.unprotectedExtensionsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedExtensions

  populateSettingsUnprotectedThemes() {
    if (this.OKtoPopulateSettingsThemes === true) {
      this.OKtoPopulateSettingsThemes = false;
      //log("!!!! populate Settings THEMES !!!!");
      this.unprotectedThemesDico = {};
      this.unprotectedThemesList = [];
      // populateSettings this.unprotectedThemes with the this.unprotected_themes elements:
      let a;
      for (var i=0; i < this.unprotected_themes.length; i++) {
        a = this.unprotected_themes[i];
        this.unprotectedThemesDico[a["name"]] = a["isunprotected"];
        this.unprotectedThemesList.push({"name": a["name"], "isunprotected": a["isunprotected"]});
      }

      // Are there new themes installed? If there are, then push them in this.unprotectedThemes:
      let dir = Gio.file_new_for_path(DIR_MAP["themes"]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, type;
        var name;
        while ((info = children.next_file(null)) != null) {
          type = info.get_file_type();
          if (type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedThemesDico[name] === undefined) {
              this.unprotectedThemesList.push({"name": name, "isunprotected": true});
              this.unprotectedThemesDico[name] = {"name": name, "isunprotected": true};
            }
          }
        }
        //this.unprotected_themes = this.unprotectedThemesList.sort((a,b) => (a["name"].toLowerCase() > b["name"].toLowerCase() ? 1 : ((b["name"].toLowerCase() > a["name"].toLowerCase()) ? -1 : 0)));
        this.unprotected_themes = this.unprotectedThemesList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedThemes

  _compare(a,b) {
    // We know that a["name"] and b["name"] are different.
    if (a["name"].toLowerCase() < b["name"].toLowerCase()) {
      return -1
    }
    return 1
  }; // End of _compare

  _get_singular_type(t) {
    return t.substr(0, t.length-1);
  }; // End of _get_singular_type

  are_dependencies_installed() {
    return (GLib.find_program_in_path("unzip") && GLib.find_program_in_path("notify-send"))
  }; // End of are_dependencies_installed

  get_terminal() {
    var term_found = "";
    var _terminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "xterm"];
    var t;
    for (t=0; t < _terminals.length ; t++) {
      if (GLib.find_program_in_path(_terminals[t])) {
        term_found = _terminals[t];
        break
      }
    }
    return term_found
  }; // End of get_terminal

  check_dependencies() {
    if (!this.dependenciesMet && this.are_dependencies_installed()) {
      // At this time, the user just finished to install all dependencies.
      this.dependenciesMet=true;
      try {
        if (this.notification != null) {
          this.notification.destroy(2) // Destroys the precedent critical notification.
        }
      } catch(e) {
        // Not an error. Simply, the user has clicked on the notification, destroying it.
        this.notification = null;
      }
      // Notification (temporary)
      let notifyMessage = _(this.appletName) + " " + _("is fully functional.");
      Main.notify(_("All dependencies are installed"), notifyMessage);

      // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
      this.on_applet_removed_from_panel();
      // Reload this applet with dependencies installed
      this.reloadThisApplet()
    } else if (!this.are_dependencies_installed() && this.notification === null) {
      let icon = new St.Icon({
        icon_name: 'error',
        icon_type: St.IconType.FULLCOLOR,
        icon_size: 36 });
      // Got a terminal used on this system:
      let terminal = this.get_terminal();
      // Detects the distrib in use and make adapted message and notification:
      let _isFedora = GLib.find_program_in_path("dnf");
      let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
      let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
      let _apt_update =  _isFedora ? "sudo dnf update" : _isArchlinux ? "" : "sudo apt update";
      let _and = _isArchlinux ? "" : " \\\\&\\\\& ";
      var _apt_install = _isFedora ? "sudo dnf install unzip libnotify" : _isArchlinux ? "sudo pacman -Syu unzip libnotify" : "sudo apt install unzip libnotify-bin";
      let criticalMessage = _("You appear to be missing some of the programs required for this applet to have all its features.")+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
      this.notification = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);
      // TRANSLATORS: The next message should not be translated.
      if (terminal != "")
        GLib.spawn_command_line_async(terminal + " -e 'sh -c \"echo vpnLookOut Applet message: Some packages needed!; echo To complete the installation, please enter and execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'");
      this.dependenciesMet = false;
    }
  }; // End of check_dependencies

  _load_cache(type) {
    let jsonFileName = CACHE_MAP[type];
    let jsonFile = Gio.file_new_for_path(jsonFileName);
    if (!jsonFile.query_exists(null)) {
      let jsonDirName = CACHE_DIR + "/" + this._get_singular_type(type);
      GLib.mkdir_with_parents(jsonDirName, 0o755);
      GLib.file_set_contents(jsonFileName,"{}");
    }
    if (jsonFile.query_exists(null)) {
      //let jsonParser = new Json.Parser();
      this.oldCache[type] = this.cache[type];
      this.cache[type] = GLib.file_get_contents(jsonFileName).toString().substr(5)
    } else {
      this.cache[type] = "{}"
    }
  }; // End of _load_cache


  download_cache(type) {
    let jsonFile = Gio.file_new_for_path(CACHE_MAP[type]);

    //Should we renew the cache?
    let is_to_download = false;
    if (this.forceRefresh===true) {
      is_to_download = true;
    } else {
      if (jsonFile.query_exists(null)) {
        let jsonModifTime = jsonFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
        let currentTime = Math.round(new Date().getTime()/1000.0); // GLib.date_time_new_local();
        if (currentTime-jsonModifTime>Math.round(this.refreshInterval/2)) {
          // the cache is too old
          is_to_download = true
        }
      } else {
        // the cache doesn't exist
        is_to_download = true
      }
    }

    if (is_to_download === true) {
      // replace local json cache file by the remote one
      let message = Soup.Message.new('GET', URL_MAP[type]);
      _httpSession.queue_message(message, Lang.bind(this, this._on_response_download_cache, type));
      this.testblink[type]=null;
    }
  }; // End of download_cache

  _on_response_download_cache(session, message, type) {
    //log(type + ': _on_response_download_cache()');
    if (message.status_code===Soup.KnownStatusCode.OK) {
      let data = message.response_body.data.toString();
      GLib.file_set_contents(CACHE_MAP[type], data); // Records the new cache in the right place.
      this._load_cache(type)
    }
  }; // End of _on_response_download_cache

  _get_last_edited_from_cache(type, uuid) {
    var cacheParser = new Json.Parser();
    cacheParser.load_from_data(this.cache[type], -1);
    var ok = false;
    var lastEdited = null;
    var message;
    try {
      lastEdited = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member("last_edited").get_value();
      if (lastEdited) {
        ok = true;
        message = "The last_edited member exists for the " + this._get_singular_type(type) + " " + uuid + ". Value = " + lastEdited.toString();
        //log(message);
      }
    } catch(e) {
      // The "last-edited" member doesn't exists
      message = "The last_edited member doesn't exist for the " + this._get_singular_type(type) + " " + uuid + ".";
      //log(message);
    }

    if (ok === true) {
      return lastEdited
    } else {
      return null
    }
  }; // End of _get_last_edited_from_cache

  _get_member_from_cache(type, uuid, memberId) {
    var cacheParser = new Json.Parser();
    cacheParser.load_from_data(this.cache[type], -1);
    var ok = false;
    var memberValue = null;
    var message;
    try {
      memberValue = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member(memberId).get_value();
      if (memberValue) {
        ok = true;
        message = "The " + memberId + " member exists for the " + this._get_singular_type(type) + " " + uuid + ". Value = " + memberValue.toString();
        //log(message);
      }
    } catch(e) {
      // The "last-edited" member doesn't exists
      message = "The " + memberId + " member doesn't exist for the " + this._get_singular_type(type) + " " + uuid + ".";
      //log(message);
    }

    if (ok === true) {
      return memberValue
    } else {
      return null
    }
  }; // End of _get_member_from_cache

  _get_last_edited_from_metadata(type, uuid) {
    var lastEdited = null;
    let metadataParser = new Json.Parser();
    let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
    let metadataFile = Gio.file_new_for_path(metadataFileName);

    // For some themes, the metadata.json file is in the subfolder /cinnamon:
    if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
      metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
      metadataFile = Gio.file_new_for_path(metadataFileName);
    }

    if (metadataFile.query_exists(null)) {
      // substr(5) is needed to remove the 'true,' at begin:
      let metadataData = GLib.file_get_contents(metadataFileName).toString().substr(5);
      //log("!!! metadataData = " + metadataData);
      metadataParser.load_from_data(metadataData, -1);
      let node = metadataParser.get_root();
      if (node.get_node_type() === Json.NodeType.OBJECT) {
        let obj = node.get_object();
        try {
          lastEdited = obj.get_member("last-edited").get_value();
        } catch(e) {
          // The last-edited member doesn't exist
          lastEdited = null;
          let message = "The last-edited member doesn't exist for the " + this._get_singular_type(type) + " " + uuid + ".";
          //log(message);
          // Replace the last-edited member's value by the last modification time of the metadate file, in epoch format.
          try {
            lastEdited = metadataFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
            message = "The last-edited value for the " + this._get_singular_type(type) + " " + uuid + " has been fixed to " + lastEdited.toString();
            //log(message)
          } catch(e) {
            // Sure, the metadata file doesn't exist!
            lastEdited = null;
            message = "The last-edited value for the " + this._get_singular_type(type) + " " + uuid + " has been fixed to null";
            //log(message)
          }
        }
      }
    }
    return lastEdited
  }; // End of _get_last_edited_from_metadata

  download_image(type, uuid) {
    //log("! download_image("+ type +", " + uuid + ")")
    let memberName, url, target;
    let is_theme = (type === "themes");
    if (is_theme) {
      memberName = "screenshot"
    } else {
      memberName = "icon"
    }
    url = URL_SPICES_HOME + this._get_member_from_cache(type, uuid, memberName);
    if (is_theme) {
      url = url.replace("/files/themes/", "/uploads/themes/thumbs/")
    }
    //log(" ! url = " + url);
    target = CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";
    //log(" ! target = " + target);

    // Variables for the progress bar
    var total_size = 0;
    var bytes_so_far = 0;

    let file = Gio.file_new_for_path(target);
    let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

    // Create an http message
    var request = Soup.Message.new('GET', url);
    // got_headers event
    request.connect('got_headers', Lang.bind(this, function(message){
      total_size = message.response_headers.get_content_length()
    }));

    // got_chunk event
    var fraction = 0.0, percent = 0;
    request.connect('got_chunk', Lang.bind(this, function(message, chunk){
      bytes_so_far += chunk.length;
      if (total_size) {
        fraction = bytes_so_far / total_size;
        percent = Math.floor(fraction * 100);
        //log("Download icon "+percent+"% done ("+bytes_so_far+" / "+total_size+" bytes)");

        // write each chunk to file
        //fstream.write(chunk.get_data(), null, chunk.length);
        fstream.write(chunk.get_data(), null);
      }
    }));

    // Queue of the http request
    _httpSession.queue_message(request, Lang.bind(this, function(_httpSession, message) {
      // Download is done
      log("Download of png file is done");
      // close the file
      fstream.close(null);
    }));
  }; // End of download_image

  gotSpiceZipFile(session, message, type, uuid, dir, callback, errback) {
    if (message.status_code != Soup.KnownStatusCode.OK) {
      errback('DownloadSpiceError', message.status_code);
      return;
    }

    try {
      if (!dir.query_exists(null))
        dir.make_directory_with_parents(null);
    } catch (e) {
      errback('CreateSpiceDirectoryError', e);
      return;
    }

    let [file, stream] = Gio.File.new_tmp('XXXXXX.Spice.zip');
    let contents = message.response_body.flatten().get_as_bytes();
    stream.output_stream.write_bytes(contents, null);
    stream.close(null);

    let [success, pid] = GLib.spawn_async(null,
                                          ['unzip', '-uod', dir.get_path(), '--', file.get_path()],
                                          null,
                                          GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                          null);

    if (!success) {
      errback('ExtractSpiceError');
      return;
    }

    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function(pid, status) {
      GLib.spawn_close_pid(pid);

      if (status != 0)
        errback('ExtractSpiceError');
      else {
        //file.delete(null); // Delete zip file after extract.
        deleteGFile(file);
        callback();
      }
    });
  }; // End of gotSpiceZipFile

  download_zip_and_install_spice(type, uuid) {
    //let oldSpiceTmpDir = GLib.dir_make_tmp('SpicesUpdaterXXXXXX_OLD');
    let newSpiceTmpDir = Gio.file_new_for_path(GLib.dir_make_tmp("SpicesUpdaterXXXXXX"));
    //log(" !!!!!!!!!!!!!!!!!! newSpiceTmpDir = " + newSpiceTmpDir);

    let params = {};

    let url = URL_SPICES_HOME + this._get_member_from_cache(type, uuid, 'file');
    let message = Soup.form_request_new_from_hash('GET', url, params);
    let notifOK = this.general_notifications;

    _httpSession.queue_message(message, Lang.bind(this, function(session, message) {
        var lm = "";
        var ALog = this.activityLog;
        this.gotSpiceZipFile(session, message, type, uuid, newSpiceTmpDir, function() {
          //log("Download of zip file OK for one of the %s: %s".format(type, uuid));
          //Update the applet:
          let [success, pid] = GLib.spawn_async(null,
            ['cinnamon-install-spice', type.substr(0, type.length-1), newSpiceTmpDir.get_path() + "/" + uuid],
            null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null);

          if (!success) {
            lm = _("Error while updating:") + " %s %s".format(type.substr(0, type.length-1), uuid);
            log(lm);
            ALog.log(lm);
            return;
          }

          GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function(pid, status) {
            GLib.spawn_close_pid(pid);

            if (status != 0) {
              lm = _("Error while updating:") + " %s %s".format(type.substr(0, type.length-1), uuid);
              log(lm);
              ALog.log(lm);
            } else {
              recursivelyDeleteDir(newSpiceTmpDir, true); // Delete temp dir after install.
              lm = _("Successfully updated:") + " %s %s".format(type.substr(0, type.length-1), uuid);
              log(lm);
              ALog.log(lm);
              if (notifOK) notify_send(lm);
            }
          });

        }, function(code, message) {
          lm = _("Error while updating:") + " %s %s: %s (%s)".format(type.substr(0, type.length-1), uuid, code, message ? message : '');
          logError(lm);
          ALog.log(lm);
        });
    }));
  }; // End of download_zip_and_install_spice

  /*
  download_zip(type, uuid) {
    log("! download_zip("+ type +", " + uuid + ")")
    let tempdir = GLib.dir_make_tmp("SpicesUpdaterXXXXXX");
    let destdir = SU_CONFIG_DIR + "/" + type;
    log(type + " tempdir = " + tempdir);

    let filePath = tempdir + "/" + uuid + ".zip";
    let file = Gio.file_new_for_path(filePath);
    var fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

    // Variables for the progress bar
    var total_size = 0;
    var bytes_so_far = 0;

    // Create an http message
    let url = URL_SPICES_HOME + this._get_member_from_cache(type, uuid, 'file');
    var request = Soup.Message.new('GET', url);
    // got_headers event
    request.connect('got_headers', Lang.bind(this, function(message){
      total_size = message.response_headers.get_content_length()
    }));

    // got_chunk event
    var fraction = 0.0, percent = 0;
    request.connect('got_chunk', Lang.bind(this, function(message, chunk){
      bytes_so_far += chunk.length;
      if (total_size) {
        fraction = bytes_so_far / total_size;
        percent = Math.floor(fraction * 100);
        //log("Download zip "+percent+"% done ("+bytes_so_far+" / "+total_size+" bytes)");
        // write each chunk to file
        //fstream.write(chunk.get_data(), null, chunk.length);
        fstream.write(chunk.get_data(), null);
      }
    }));

    let ret;
    // Queue of the http request
    _httpSession.queue_message(request, Lang.bind(this, function(session, message) {
      // close the file
      fstream.close(null);
    }));
    let triplet = new Array(uuid, filePath, destdir);
    this.ready_to_unzip[type].push(triplet)
  }; // End of download_zip
  */

  unzip(zipname, dir) {
    log("!!!!! unziping "+ zipname + " in " + dir);
    let [success, pid] = GLib.spawn_async(null,
                                          ['unzip', '-uod', dir, '--', zipname],
                                          null,
                                          GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                          null);
    return success;
  }; // End of unzip

  is_to_check(type) {
    return (this.types_to_check.indexOf(type) > -1);
  }; // End of is_to_check

  is_to_update(type) {
    return (this.types_to_update.indexOf(type) > -1);
  }; // End of is_to_update

  get_can_be_updated(type) {
    var spicesList;
    switch (type) {
      case "applets":
        spicesList = this.unprotectedAppletsList;
        break;
      case "themes":
        spicesList = this.unprotectedThemesList;
        break;
      case "extensions":
        spicesList = this.unprotectedExtensionsList;
        break;
      case "desklets":
        spicesList = this.unprotectedDeskletsList;

    }
    var ret = [];
    for (let s of spicesList) {
      if (s["isunprotected"] === true) {
        ret.push(s["name"])
      }
    }
    log("can_be_updated("+ type + ") = " + JSON.stringify(ret));
    return ret
  }; // End of get_can_be_updated

  get_must_be_updated(type) {
    let can_be_updated = this.get_can_be_updated(type);
    var ret = new Array();
    var lc, lm;
    for (let uuid of can_be_updated) {
      lc = this._get_last_edited_from_cache(type, uuid);
      if (lc !== null) {
        lm = this._get_last_edited_from_metadata(type, uuid);
        if (lm !== null) {
          if (lc > lm) ret.push(uuid);
        }
      }
    }
    //log("!!! get_must_be_updated("+ type + ") = " + ret);
    return ret
  }; // End of get_must_be_updated

  get_active_spices(type) {
    // Returns the list of active spices of type 'type'
    var dconfEnabled;
    var elt = (type.toString() === "applets") ? 3 : 0;
    let listCanBeUpdated = this.get_can_be_updated(type);
    let enabled;
    var listEnabled = new Array();
    let _SETTINGS_SCHEMA, _SETTINGS_KEY;
    let _interface_settings;

    if (type.toString() === "themes") {
      _SETTINGS_SCHEMA = "org.cinnamon.theme";
      _SETTINGS_KEY = "name";
      _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
      enabled = _interface_settings.get_string(_SETTINGS_KEY);
      log('!!!!!!!!!!!! _SETTINGS_SCHEMA='+_SETTINGS_SCHEMA);
      log('!!!!!!!!!!!! _SETTINGS_KEY='+_SETTINGS_KEY);
      log('!!!!!!!!!!!! enabled='+enabled);
      listEnabled.push(enabled);
      log('!!!!!!!!!!!! listEnabled='+ listEnabled.toString());
      return listEnabled
    }

    _SETTINGS_SCHEMA = "org.cinnamon";
    _SETTINGS_KEY = "enabled-%s".format(type.toString());
    _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });

    enabled = _interface_settings.get_strv(_SETTINGS_KEY);
    log('!!!!!!!!!!!! _SETTINGS_SCHEMA='+_SETTINGS_SCHEMA);
    log('!!!!!!!!!!!! _SETTINGS_KEY='+_SETTINGS_KEY);
    log('!!!!!!!!!!!! enabled='+enabled.toString());
    let xlet_uuid;
    for (let xl of enabled) {
      xlet_uuid = xl.split(':')[elt].toString().replace(/'/g,"");
      if (!xlet_uuid.endsWith("@cinnamon.org") && (listCanBeUpdated.indexOf(xlet_uuid)>-1))
        listEnabled.push(xlet_uuid);
    }
    log('!!!!!!!!!!!! listEnabled='+ listEnabled.toString());
    return listEnabled
  }; // End of get_active_spices

  makeMenu() {
    try {
      this.menu.removeAll();

      // Head
      this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("Spices Updater"), {
        reactive: false
      });
      this.menu.addMenuItem(this.menuitemHead1);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Refresh button
      this.refreshButton = new PopupMenu.PopupIconMenuItem(_("Refresh"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
      this.refreshButton.connect('activate', () => this.updateLoop());
      this.menu.addMenuItem(this.refreshButton);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Status of each type of Spices:
      this.spicesMenuItems = {};
      let ts;
      for (let t of TYPES) {
        ts = t.toString();
        this.spicesMenuItems[t] = new PopupMenu.PopupIndicatorMenuItem(_(capitalize(ts)));
        this.spicesMenuItems[t].connect('activate', (event) => {
          Util.spawnCommandLine("cinnamon-settings " + t.toString());
        });
        this.spicesMenuItems[t].setShowDot(this.menuDots[t]);
        this.menu.addMenuItem(this.spicesMenuItems[t]);
      }
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // view log file
      this.view_log = new PopupMenu.PopupIconMenuItem(_("View Activity Logs"), "folder-documents-symbolic", St.IconType.SYMBOLIC);
      this.view_log.connect('activate', (event) => {
        this.activityLog.display_logs();
      });
      this.menu.addMenuItem(this.view_log);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Restart Cinnamon Button
      this.restartButton = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "emblem-synchronizing-symbolic", St.IconType.SYMBOLIC);
      this.restartButton.connect('activate', Lang.bind(this, function(event) {
        this.restart_cinnamon()
      }));
      this.menu.addMenuItem(this.restartButton);

    } catch(e) {
      logError(e)
    }
  }; // End of makeMenu

  // This updates the display of the applet and the tooltip
  updateUI() {
    this._applet_icon.style = "color: %s;".format(this.defaultColor);
    if (this.general_warning === true) {
      for (let t of TYPES) {
        if (this.menuDots[t] === true) {
          this._applet_icon.style = "color: %s;".format(this.events_color);
          break;
        }
      }
    }
  }; // End of updateUI

  // This is the loop run at general_frequency rate to call updateUI() to update the display in the applet and tooltip
  updateLoop() {
    //this.set_icons();
    this.check_dependencies();

    // Inhibits also after the applet has been removed from the panel
    if (this.applet_running == true) {
      this.OKtoPopulateSettingsApplets = true;
      this.OKtoPopulateSettingsDesklets = true;
      this.OKtoPopulateSettingsExtensions = true;
      this.OKtoPopulateSettingsThemes = true;
      var t;
      if (!this.dependenciesMet) {
        this.refreshInterval = 5;
      } else {
        if (!this.first_loop) {
          this.refreshInterval = 3600*this.general_frequency;
          var must_be_updated, ret;
          var _SETTINGS_SCHEMA, _SETTINGS_KEY;
          var _interface_settings;
          for (t of TYPES) {
            if (this.is_to_check(t)) {
              log("!!!! Are to check : " + t);
              if (this.cache[t] === "{}") this._load_cache(t);
              //log(this.cache[t]);
              this.download_cache(t);
              must_be_updated = this.get_must_be_updated(t);
              log(capitalize(t) + " that must be updated = " + must_be_updated);
              if (must_be_updated.length > 0) {
                this.menuDots[t] = true;
                var filePath, tempdir;
                if (this.is_to_update(t)) {
                  /*this.ready_to_unzip[t] = [];*/
                  for (let uuid of must_be_updated) {
                    // Download the zip file in a temp directory, unzip it and install spice:
                    this.download_zip_and_install_spice(t, uuid);
                    // Download the icon (or the screenshot thumbnail, for themes) in the cache directory:
                    this.download_image(t, uuid);
                    // Reload the code of the updated Spice (but theme), if it is active:
                    this.reload_code(t, uuid);
                  }

                  //Changing the last cache update date in dconf:
                  let currentTime = Math.round(new Date().getTime()/1000.0);
                  _SETTINGS_SCHEMA = DCONFCACHEUPDATED[t];
                  _SETTINGS_KEY = "%s-cache-updated".format(this._get_singular_type(t.toString()));
                  _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
                  _interface_settings.set_int(_SETTINGS_KEY, currentTime);

                  this.menuDots[t] = false;
                } else {
                  this.menuDots[t] = true;
                  let message;
                  if (must_be_updated.length === 1) {
                    message = "One " + this._get_singular_type(t) + " needs update:"
                  } else {
                    message = "Some " + t + " need update:"
                  }
                  if (this.general_notifications) notify_send(_(message) + " " + must_be_updated.join(", "));
                }
              } else {
                this.menuDots[t] = false;
              }
            }
          }
          this.updateUI(); // update icon and tooltip

          // Force truncation of the log file, once a day:
          this.next_truncation -= this.refreshInterval;
          if (this.next_truncation < 0) {
            this.next_truncation = 86400; // 86400 seconds = 1 day
            this.activityLog.truncate_log_file();
          }
        } else {
          this.refreshInterval = 120; // 120 seconds
          this.first_loop = false;
        }
      }
      // One more loop !
      Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
    }
  }; // End of updateLoop

  reload_code(type, uuid) {
    // Reloads the code of a Spice (but themes, and this applet).
    if (type.toString() === "themes" || uuid === UUID) return;
    let actives = this.get_active_spices(type);
    if (actives.indexOf(uuid) > -1) {
      switch (type.toString()) {
        case 'applets':
          // Reloads the applet, except if it is this one.
          if (uuid !== UUID) Extension.reloadExtension(uuid, Extension.Type.APPLET);
          break;
        case 'desklets':
          Extension.reloadExtension(uuid, Extension.Type.DESKLET);
          break;
        case 'extensions':
          Extension.reloadExtension(uuid, Extension.Type.EXTENSION);
          break;
        default:;
      }
      let message = "Reloaded %s:".format(capitalize(this._get_singular_type(type)));
      if (this.general_notifications && uuid !== UUID) notify_send(_(message) + " %s".format(uuid));
    }
  }; // End of reload_code

  restart_cinnamon() {
    global.reexec_self()
  }; // End of restart_cinnamon

  //++ Handler for when the applet is clicked.
  on_applet_clicked(event) {
    //this.updateLoop();
    this.makeMenu();
    this.updateUI();
    this.menu.toggle();
  }; // End of on_applet_clicked

  // ++ Null function called when Generic (internal) Setting changed
  on_generic_changed() {};

  // ++ This finalizes the settings when the applet is removed from the panel
  on_applet_removed_from_panel() {
    // inhibit the update timer when applet removed from panel
    this.applet_running = false;
    this.settings.finalize();
    //Main.keybindingManager.removeHotKey(UUID);
  };
} // End of class SpicesUpdate

function main(metadata, orientation, panelHeight, instance_id) {
  return new SpicesUpdater(metadata, orientation, panelHeight, instance_id);
}
