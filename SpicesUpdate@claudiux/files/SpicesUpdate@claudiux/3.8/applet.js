/* Spices Update (SpicesUpdate@claudiux)
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++ Needed for icons
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  Needed for on_response function call
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Gtk = imports.gi.Gtk; // Needed for theme icons
const Mainloop = imports.mainloop; // Needed for timer update loop
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for notify()
const MessageTray = imports.ui.messageTray; // ++ Needed for the criticalNotify() function in this script
const Util = imports.misc.util; // Needed for spawnCommandLine()
const Extension = imports.ui.extension; // Needed to reload applets
const Json = imports.gi.Json;
const Soup = imports.gi.Soup;
//const Signals = imports.signals;
const {SignalManager} = imports.misc.signalManager;
const Cinnamon = imports.gi.Cinnamon; // Needed to read/write into a file

var UUID="SpicesUpdate@claudiux";

const HOME_DIR = GLib.get_home_dir();
// ++ Set DEBUG to true to display log messages in ~/.cinnamon/glass.log
// ++ Set DEBUG to false in production.
// ++ DEBUG is true only if the DEBUG file is present in this applet directory ($ touch DEBUG)
var _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
const DEBUG = _debug.query_exists(null);

const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";
const HELP_DIR = APPLET_DIR + "/help";

const DOWNLOAD_TIME = 10;

Util.spawnCommandLine("sh -c '%s/witness-debian.sh'".format(SCRIPTS_DIR));

const URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com";
const CONFIG_DIR = HOME_DIR + "/.cinnamon/configs";
const SU_CONFIG_DIR = CONFIG_DIR + "/" + UUID;
const CACHE_DIR = HOME_DIR + "/.cinnamon/spices.cache";

const TYPES = ['applets', 'desklets', 'extensions', 'themes'];

const URL_MAP = {
  'applets': URL_SPICES_HOME + "/json/applets.json?",
  'themes': URL_SPICES_HOME + "/json/themes.json?",
  'desklets': URL_SPICES_HOME + "/json/desklets.json?",
  'extensions': URL_SPICES_HOME + "/json/extensions.json?"
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

const EXP1 = {
  "applets": _("If you do not want an applet to be checked, set its first switch to FALSE."),
  "desklets": _("If you do not want a desklet to be checked, set its first switch to FALSE."),
  "extensions": _("If you do not want an extension to be checked, set its first switch to FALSE."),
  "themes": _("If you do not want a theme to be checked, set its first switch to FALSE.")
}

const EXP2 = {
  "applets": _("If you want to get the latest version of an applet now, set its two switches to TRUE."),
  "desklets": _("If you want to get the latest version of a desklet now, set its two switches to TRUE."),
  "extensions": _("If you want to get the latest version of an extension now, set its two switches to TRUE."),
  "themes": _("If you want to get the latest version of a theme now, set its two switches to TRUE.")
}

const EXP3 = _("When all your choices are made, click the Refresh button.");


// ++ Needed if some http(s) requests are required
const _httpSession = new Soup.Session();
_httpSession.timeout=60;
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

// ++ l10n support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str, uuid=UUID) {
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function setInterval(callback, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = Mainloop.timeout_add(ms, () => {
        callback.call(null, ...args);
        return true; // Repeat
    }, null);

    return id;
}

function clearInterval(id) {
    if (id > 0) Mainloop.source_remove(id);
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
bidon = _("New desklet available:");
bidon = _("New applet available:");
bidon = _("New extension available:");
bidon = _("New theme available:");
bidon = _("New desklets available:");
bidon = _("New applets available:");
bidon = _("New extensions available:");
bidon = _("New themes available:");
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
      _icon = HOME_DIR + '/.local/share/cinnamon/applets/' + UUID + '/icons/spices-update-symbolic.svg'
    }
    let notification = "notify-send \"%s\" \"".format(_("Spices Update")) + message + "\" -i " + _icon + " -t "+ duration.toString() +" -u " + urgency;
    Util.spawnCommandLine(notification);
  }
}

function getImageAtScale(imageFileName, width, height) {
    let pixBuf = GdkPixbuf.Pixbuf.new_from_file_at_size(imageFileName, width, height);
    let image = new Clutter.Image();
    image.set_data(
        pixBuf.get_pixels(),
        pixBuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGBA_888,
        width, height,
        pixBuf.get_rowstride()
    );

    let actor = new Clutter.Actor({width: width, height: height});
    actor.set_content(image);

    return actor;
}


class SpicesUpdate extends Applet.TextIconApplet {
  constructor (metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);
    this.instanceId = instance_id;
    this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
    //this.appletPath = metadata.path;
    Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);
    this.set_applet_icon_symbolic_name("spices-update");
    this.default_tooltip = "%s %s".format(_("Spices Update"), metadata.version);
    this.set_applet_tooltip(this.default_tooltip + "\n%s".format(_("Middle-Click to Refresh")));

    this.img_path = ICONS_DIR + "/spices-update-symbolic.svg";
    //this.general_frequency = 10; //(seconds between two loops)
    this.angle = 0;
    this.do_rotation = false;
    this.interval = 0;
    this.ui_scale = global.ui_scale;


    // To be sure that the scripts will be executable:
    GLib.spawn_command_line_async("bash -c 'cd %s && chmod 755 *.py *.sh'".format(SCRIPTS_DIR));

    this.OKtoPopulateSettingsApplets = true;
    this.OKtoPopulateSettingsDesklets = true;
    this.OKtoPopulateSettingsExtensions = true;
    this.OKtoPopulateSettingsThemes = true;
    this.notification = null;
    this.old_message = {
      "applets": "",
      "desklets": "",
      "extensions": "",
      "themes": ""
    }

    this.old_watch_message = {
      "applets": "",
      "desklets": "",
      "extensions": "",
      "themes": ""
    }

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

    this.menuDots = {
      "applets": false,
      "desklets": false,
      "extensions": false,
      "themes": false
    };

    // Default icon color
    this.defaultColor = "#000000FF";

    // Monitoring metadata.json files and png directories
    this.monitors = new Array();

    // Monitoring png directories: Ids
    this.monitorsPngId = {
      "applets": 0,
      "desklets": 0,
      "extensions": 0,
      "themes": 0
    }

    // Count of Spices to update
    this.nb_to_update = 0;
    this.nb_in_menu = {
      "applets": 0,
      "desklets": 0,
      "extensions": 0,
      "themes": 0
    }

    // New Spices
    this.nb_to_watch = 0;
    this.new_Spices = {
      "applets": [],
      "desklets": [],
      "extensions": [],
      "themes": []
    }


    // ++ Settings
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    //this.settings._checkSettings();
    //this.settings._ensureSettingsFiles();

    // Applets
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, // Setting type
      "check_applets", // The setting key
      "check_applets", // The property to manage (this.check_applets)
      this.on_settings_changed, // Callback when value changes
      null); // Optional callback data

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "check_new_applets",
      "check_new_applets",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.OUT,
      "exp_applets",
      "exp_applets",
      null,
      null);
    this.exp_applets = "%s\n%s\n%s".format(EXP1["applets"], EXP2["applets"], EXP3);

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
      "check_new_desklets",
      "check_new_desklets",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.OUT,
      "exp_desklets",
      "exp_desklets",
      null,
      null);
    this.exp_desklets = "%s\n%s\n%s".format(EXP1["desklets"], EXP2["desklets"], EXP3);

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
      "check_new_extensions",
      "check_new_extensions",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.OUT,
      "exp_extensions",
      "exp_extensions",
      null,
      null);
    this.exp_extensions = "%s\n%s\n%s".format(EXP1["extensions"], EXP2["extensions"], EXP3);

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
      "check_new_themes",
      "check_new_themes",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.OUT,
      "exp_themes",
      "exp_themes",
      null,
      null);
    this.exp_themes = "%s\n%s\n%s".format(EXP1["themes"], EXP2["themes"], EXP3);

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      "unprotected_themes",
      "unprotected_themes",
      this.populateSettingsUnprotectedThemes,
      null);

    // General settings
    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_frequency",
      "general_frequency",
      this.on_frequency_changed,
      null);
      this.refreshInterval = 3600 * this.general_frequency;

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_warning",
      "general_warning",
      this.updateUI,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "events_color",
      "events_color",
      this.updateUI,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_notifications",
      "general_notifications",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_details_requested",
      "details_requested",
      null,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_force_notifications",
      "force_notifications",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_type_notif",
      "general_type_notif",
      null,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "displayType",
      "displayType",
      this.on_display_type_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "general_hide",
      "general_hide",
      this.on_display_type_changed,
      null);

    this.check = {
      "applets" : {
        get_value: () => {return this.check_applets;},
        set_value: (v) => {this.check_applets = v}
      },
      "desklets" : {
        get_value: () => {return this.check_desklets;},
        set_value: (v) => {this.check_desklets = v}
      },
      "extensions" : {
        get_value: () => {return this.check_extensions;},
        set_value: (v) => {this.check_extensions = v}
      },
      "themes" : {
        get_value: () => {return this.check_themes;},
        set_value: (v) => {this.check_themes = v}
      }
    };

    this.check_new = {
      "applets" : {
        get_value: () => {return this.check_new_applets;},
        set_value: (v) => {this.check_new_applets = v}
      },
      "desklets" : {
        get_value: () => {return this.check_new_desklets;},
        set_value: (v) => {this.check_new_desklets = v}
      },
      "extensions" : {
        get_value: () => {return this.check_new_extensions;},
        set_value: (v) => {this.check_new_extensions = v}
      },
      "themes" : {
        get_value: () => {return this.check_new_themes;},
        set_value: (v) => {this.check_new_themes = v}
      }
    };

    this.on_orientation_changed(orientation);

    // Translated help file (html)
    this.help_file = this.get_translated_help_file();

    // Init lists of Spices:
    this.populateSettingsUnprotectedApplets();
    this.populateSettingsUnprotectedDesklets();
    this.populateSettingsUnprotectedExtensions();
    this.populateSettingsUnprotectedThemes();

    // Dependencies:
    this.dependenciesMet = this.are_dependencies_installed();
    if (!this.dependenciesMet) this.refreshInterval = 5;

    // ++ Set up Left Click Menu
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    // Badge
    this.badge = null;
    this.define_badge();
    this.signals = new SignalManager(null);
    this.signals.connect(global, 'scale-changed', () => this.updateUI());

    this.details_by_uuid = {};
    this.notifications = new Array();
    this.testblink = [];
    this.forceRefresh = false;
    this.refresh_requested = false;
    this.applet_running = true;
    this.loopId = 0;
    this.first_loop = true; // To do nothing for 1 minute.
    this.on_settings_changed();
    // Run the loop !
    this.iteration = 0;
    this.updateLoop();
  }; // End of constructor

  define_badge() {
    if (this.badge !== null) this.actor.remove_child(this.badge);
    this.badge = new St.BoxLayout({
      style_class: 'SU-badge',
      important: true,
      width: 12 * global.ui_scale,
      height: 12 * global.ui_scale,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE,
      show_on_set_parent: false,
      style: 'margin: 0;',
    });
    this.numberLabel = new St.Label({
      style: 'font-size: 10px;padding: 0px;',
      style_class: 'SU-number-label',
      important: true,
      text: '',
      anchor_x: -3 * global.ui_scale,
      anchor_y: 1 + (global.ui_scale > 1 ? 2 : 0)
    });
    this.numberLabel.clutter_text.ellipsize = false;
    this.badge.add(this.numberLabel, {
      x_align: St.Align.START,
      y_align: St.Align.START,
    });
    this.actor.add_child(this.badge);
  }; // End of define_badge

  /** get_translated_help_file()
   * Returns the help file in html format
   */
  get_translated_help_file() {
    let default_file_name = HELP_DIR + "/en/README.html";
    let help_file = Gio.file_new_for_path(default_file_name);
    let language = "";
    let lang = "";
    if (!help_file.query_exists(null)) {
      return null;
    }
    try {
      language = GLib.get_language_names().toString().split(",")[0].toString();
    } catch(e) {
      // Unable to detect language. Return English help file by default.
      return default_file_name;
    }
    let file_name = "%s/%s/README.html".format(HELP_DIR, language);
    help_file = Gio.file_new_for_path(file_name);
    if (help_file.query_exists(null)) {
      return file_name;
    } else {
      lang = language.split("_")[0].toString();
      if (lang === language) {
        // Not found
        return default_file_name;
      } else {
        file_name = "%s/%s/README.html".format(HELP_DIR, lang);
        help_file = Gio.file_new_for_path(file_name);
        if (help_file.query_exists(null)) {
          return file_name;
        } else {
          return default_file_name;
        }
      }
    }
  }; // End of get_translated_help_file

  notify_with_button(message, type, uuid = null) {
    let source = new MessageTray.SystemNotificationSource();
    if (Main.messageTray) {
      Main.messageTray.add(source);
      let gicon = Gio.icon_new_for_string(APPLET_DIR + "/icon.png");
      let icon = new St.Icon({ gicon: gicon, 'icon-size': 32});
      let notification = new MessageTray.Notification(source, _("Spices Update"), message, {icon: icon});
      notification.setTransient(false);
      notification.setResident(true);
      Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);
      notification.setUseActionIcons(true);
      let img_uri = GLib.filename_to_uri("%s/cs-%s.svg".format(ICONS_DIR, type.toString()), null);
      if (uuid !== null) {
        let uri= CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";
        let file = Gio.file_new_for_path(uri);
        if (file.query_exists(null)) {
          img_uri = GLib.filename_to_uri(uri, null);
        }
      }
      let image = St.TextureCache.get_default().load_uri_async( img_uri,
                                                                Math.round(notification.IMAGE_SIZE/2),
                                                                Math.round(notification.IMAGE_SIZE/2));
      notification.setImage(image);
      let buttonLabel = "%s".format(capitalize(type.toString()));
      let buttonLabel2 = _("Refresh");
      notification.addButton("spices-update", _(buttonLabel));
      notification.addButton("refresh", _(buttonLabel2));
      this.notifications.push(notification);
      notification.connect('action-invoked', Lang.bind(this, function(self, action) {
            if (action == "spices-update") {
              Util.spawnCommandLine("%s/open_download_tab.py %s".format(SCRIPTS_DIR, type.toString()));
            } else {
              if (this.force_notifications === true) {
                while (this.notifications.length != 0) {
                  let n = this.notifications.pop();
                  n.destroy(3)
                }
              } else {
                this.old_message[type] = "";
                this.old_watch_message[type] = "";
                notification.destroy(3)
              }
              this._on_refresh_pressed();
            }
          }));
      source.notify(notification);
    }
  }; // End of notify_with_button

  on_notif_for_new_changed() {
    if (!this.notif_for_new) {
      this.nb_to_watch = 0;
      this.new_Spices = {
        "applets": [],
        "desklets": [],
        "extensions": [],
        "themes": []
      }
      this.old_watch_message = {
        "applets": "",
        "desklets": "",
        "extensions": "",
        "themes": ""
      }
    }
    this._on_refresh_pressed()
  }

  on_orientation_changed (orientation) {
    this.orientation = orientation;
    this.isHorizontal = !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    this._set_main_label();
  }; // End of on_orientation_changed

  _set_main_label() {
    if (this.general_hide === true && this.nb_to_update === 0 && this.nb_to_watch === 0) {
      this.set_applet_label("");
      this.actor.hide();
      return
    }
    this.actor.show();
    if (this.displayType === "compact") {
      this.set_applet_label("");
    } else {
      if (this.isHorizontal === true) {
        this.set_applet_label(_("Spices Update"));
      } else {
        this.set_applet_label("SpU");
      }
    }
  }; // End of _set_main_label

  on_frequency_changed() {
    if (this.loopId) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;
    this.refreshInterval = 3600 * this.general_frequency;
    this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
  }; // End of on_frequency_changed

  on_display_type_changed() {
    // Label
    this._set_main_label();
  }; // End of on_display_type_changed

  // ++ Function called when settings are changed
  on_settings_changed() {
    // Label
    this._set_main_label();

    // Refresh intervall:
    this.refreshInterval = 3600 * this.general_frequency;

    // Types to check
    this.types_to_check = [];
    this.types_to_check_new = [];

    // All xlets
    for (let type of TYPES) {
      let _dir_xlets = Gio.file_new_for_path(DIR_MAP[type]);
      if (!_dir_xlets.query_exists(null)) {
        this.check[type].set_value(false);
      }
      if (this.check[type].get_value()) {
        this.types_to_check.push(type);
        if (this.check_new[type].get_value())
          this.types_to_check_new.push(type);
      } else {
        this.check_new[type].set_value(false);
        this.menuDots[type] = false;
      }
    }
    if (this.check_applets) {
      this.types_to_check.push('applets');
      if (this.check_new_applets)
        this.types_to_check_new.push('applets');
    } else {
      this.check_new_applets = false;
      this.menuDots['applets'] = false;
    }

    // Desklets
    let _dir_desklets = Gio.file_new_for_path(DIR_MAP["desklets"]);
    if (!_dir_desklets.query_exists(null)) {
      this.check_desklets = false;
    }
    if (this.check_desklets) {
      this.types_to_check.push('desklets');
      if (this.check_new_desklets)
        this.types_to_check_new.push('desklets');
    } else {
      this.check_new_desklets = false;
      this.menuDots['desklets'] = false;
    }

    // Extensions
    let _dir_extensions = Gio.file_new_for_path(DIR_MAP["extensions"]);
    if (!_dir_extensions.query_exists(null)) {
      this.check_extensions = false;
    }
    if (this.check_extensions) {
      this.types_to_check.push('extensions');
      if (this.check_new_extensions)
        this.types_to_check_new.push('extensions');
    } else {
      this.check_new_extensions = false;
      this.menuDots['extensions'] = false;
    }

    // Themes
    let _dir_themes = Gio.file_new_for_path(DIR_MAP["themes"]);
    if (!_dir_themes.query_exists(null)) {
      this.check_themes = false;
    }
    if (this.check_themes) {
      this.types_to_check.push('themes');
      if (this.check_new_themes)
        this.types_to_check_new.push('themes');
    } else {
      this.check_new_themes = false;
      this.menuDots['themes'] = false;
    }

  }; // End of on_settings_changed

  // Buttons in settings:
  on_btn_test_notif_pressed() {
    let details = "";
    if (this.details_requested === true) details = _("With details here, when available.")+"\n\t";
    let message = _("One applet needs update:") + "\n%s\n\t".format(UUID) + details + _("Do not matter. This is a FAKE notification, just for the test.");
    if (this.general_type_notif === "minimal") {
      notify_send(message)
    } else {
      this.notify_with_button(message, TYPES[0])
    }
  }; // End of on_btn_test_notif_pressed
  on_btn_refresh_applets_pressed() {
    this._on_refresh_pressed()
  }; // End of on_btn_refresh_applets_pressed
  on_btn_refresh_desklets_pressed() {
    this._on_refresh_pressed()
  }; // End of on_btn_refresh_applets_pressed
  on_btn_refresh_extensions_pressed() {
    this._on_refresh_pressed()
  }; // End of on_btn_refresh_applets_pressed
  on_btn_refresh_themes_pressed() {
    this._on_refresh_pressed()
  }; // End of on_btn_refresh_applets_pressed
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
   "SpicesUpdate@claudiux" : false,
   "sound150@claudiux" : false,
   "vpnLookOut@claudiux" : false, etc...
   }
   * this.unprotectedAppletsList example:
   [
      {
        "name" : "batterymonitor@pdcurtis",
        "isunprotected" : true,
        "requestnewdownload": false
      },
      {
        "name" : "Cinnamenu@json",
        "isunprotected" : true,
        "requestnewdownload": false
      }, etc...
    ]
    * (true when updates are requested by the user)
  */
  populateSettingsUnprotectedApplets() {
    let type = "applets";
    if (this.OKtoPopulateSettingsApplets === true) {
      this.OKtoPopulateSettingsApplets = false; // Prevents multiple access to the json config file of SpiceUpdate@claudiux.
      this.unprotectedAppletsDico = {};
      this.unprotectedAppletsList = [];
      // populate this.unprotectedApplets with the this.unprotected_applets elements, removing uninstalled applets:
      for (var i=0; i < this.unprotected_applets.length; i++) {
        let a = this.unprotected_applets[i];
        let d = Gio.file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
        if (d.query_exists(null)) {
          this.unprotectedAppletsDico[a["name"]] = a["isunprotected"];
          let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
          if (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true) {
            if (this.cache[type] === "{}") this._load_cache(type);
            let created = this._get_member_from_cache(type, a["name"], "created");
            let last_edited = this._get_last_edited_from_cache(type, a["name"]);
            if (created !== null && last_edited !== null && created >= last_edited) created = last_edited - 1;

            if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
          }
          if (!a["isunprotected"]) {
            this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
          }
          this.unprotectedAppletsList.push({"name": a["name"], "isunprotected": a["isunprotected"], "requestnewdownload": false});
        }
      }

      // Are there new applets installed? If there are, then push them in this.unprotectedApplets:
      let dir = Gio.file_new_for_path(DIR_MAP[type]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, file_type;
        var name;
        while ((info = children.next_file(null)) != null) {
          file_type = info.get_file_type();
          if (file_type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedAppletsDico[name] === undefined) {
              this.unprotectedAppletsList.push({"name": name, "isunprotected": true, "requestnewdownload": false});
              this.unprotectedAppletsDico[name] = {"name": name, "isunprotected": true};
              this._get_last_edited_from_metadata(type, name);
            }
          }
        }
        this.unprotected_applets = this.unprotectedAppletsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedApplets

  populateSettingsUnprotectedDesklets() {
    let type = "desklets";
    if (this.OKtoPopulateSettingsDesklets === true) {
      this.OKtoPopulateSettingsDesklets = false;
      this.unprotectedDeskletsDico = {};
      this.unprotectedDeskletsList = [];
      // populate this.unprotectedDesklets with the this.unprotected_desklets elements:
      for (var i=0; i < this.unprotected_desklets.length; i++) {
        let a = this.unprotected_desklets[i];
        let d = Gio.file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
        if (d.query_exists(null)) {
          this.unprotectedDeskletsDico[a["name"]] = a["isunprotected"];
          let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
          if (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true) {
            if (this.cache[type] === "{}") this._load_cache(type);
            let created = this._get_member_from_cache(type, a["name"], "created");
            let last_edited = this._get_last_edited_from_cache(type, a["name"]);
            if (created !== null && last_edited !== null && created >= last_edited) created = last_edited - 1;

            if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
          }
          if (!a["isunprotected"]) {
            this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
          }
          this.unprotectedDeskletsList.push({"name": a["name"], "isunprotected": a["isunprotected"], "requestnewdownload": false});
        }
      }

      // Are there new desklets installed? If there are, then push them in this.unprotectedDesklets:
      let dir = Gio.file_new_for_path(DIR_MAP[type]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, file_type;
        var name;
        while ((info = children.next_file(null)) != null) {
          file_type = info.get_file_type();
          if (file_type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedDeskletsDico[name] === undefined) {
              this.unprotectedDeskletsList.push({"name": name, "isunprotected": true, "requestnewdownload": false});
              this.unprotectedDeskletsDico[name] = {"name": name, "isunprotected": true};
              this._get_last_edited_from_metadata(type, name);
            }
          }
        }
        this.unprotected_desklets = this.unprotectedDeskletsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedDesklets

  populateSettingsUnprotectedExtensions() {
    let type = "extensions";
    if (this.OKtoPopulateSettingsExtensions === true) {
      this.OKtoPopulateSettingsExtensions = false;
      this.unprotectedExtensionsDico = {};
      this.unprotectedExtensionsList = [];
      // populate this.unprotectedExtensions with the this.unprotected_extensions elements:
      for (var i=0; i < this.unprotected_extensions.length; i++) {
        let a = this.unprotected_extensions[i];
        let d = Gio.file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
        if (d.query_exists(null)) {
          this.unprotectedExtensionsDico[a["name"]] = a["isunprotected"];
          let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
          if (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true) {
            if (this.cache[type] === "{}") this._load_cache(type);
            let created = this._get_member_from_cache(type, a["name"], "created");
            let last_edited = this._get_last_edited_from_cache(type, a["name"]);
            if (created !== null && last_edited !== null && created >= last_edited) created = last_edited - 1;

            if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
          }
          if (!a["isunprotected"]) {
            this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
          }
          this.unprotectedExtensionsList.push({"name": a["name"], "isunprotected": a["isunprotected"], "requestnewdownload": false});
        }
      }

      // Are there new extensions installed? If there are, then push them in this.unprotectedExtensions:
      let dir = Gio.file_new_for_path(DIR_MAP[type]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, file_type;
        var name;
        while ((info = children.next_file(null)) != null) {
          file_type = info.get_file_type();
          if (file_type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedExtensionsDico[name] === undefined) {
              this.unprotectedExtensionsList.push({"name": name, "isunprotected": true, "requestnewdownload": false});
              this.unprotectedExtensionsDico[name] = {"name": name, "isunprotected": true};
              this._get_last_edited_from_metadata(type, name);
            }
          }
        }
        this.unprotected_extensions = this.unprotectedExtensionsList.sort((a,b) => this._compare(a,b));
      }
    }
  }; // End of populateSettingsUnprotectedExtensions

  populateSettingsUnprotectedThemes() {
    let type = "themes";
    if (this.OKtoPopulateSettingsThemes === true) {
      this.OKtoPopulateSettingsThemes = false;
      this.unprotectedThemesDico = {};
      this.unprotectedThemesList = [];
      // populate this.unprotectedThemes with the this.unprotected_themes elements:
      for (var i=0; i < this.unprotected_themes.length; i++) {
        let a = this.unprotected_themes[i];
        let d = Gio.file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
        if (d.query_exists(null)) {
          this.unprotectedThemesDico[a["name"]] = a["isunprotected"];
          let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
          let metadataFile = Gio.file_new_for_path(metadataFileName);
          // For some themes, the metadata.json file is in the subfolder /cinnamon:
          if (!metadataFile.query_exists(null) || (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true)) {
            if (this.cache[type] === "{}") this._load_cache(type);
            let created = this._get_member_from_cache(type, a["name"], "created");
            let last_edited = this._get_last_edited_from_cache(type, a["name"]);
            if (created !== null && last_edited !== null && created >= last_edited) created = last_edited - 1;

            if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
          }
          if (!a["isunprotected"]) {
            this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
          }
          this.unprotectedThemesList.push({"name": a["name"], "isunprotected": a["isunprotected"], "requestnewdownload": false});
        }
      }

      // Are there new themes installed? If there are, then push them in this.unprotectedThemes:
      let dir = Gio.file_new_for_path(DIR_MAP[type]);
      if (dir.query_exists(null)) {
        let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info, file_type;
        var name;
        while ((info = children.next_file(null)) != null) {
          file_type = info.get_file_type();
          if (file_type == Gio.FileType.DIRECTORY) {
            name = info.get_name().toString();
            if (this.unprotectedThemesDico[name] === undefined) {
              this.unprotectedThemesList.push({"name": name, "isunprotected": true, "requestnewdownload": false});
              this.unprotectedThemesDico[name] = {"name": name, "isunprotected": true};
              this._get_last_edited_from_metadata(type, name);
            }
          }
        }
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
    let _fonts_installed = (
      Gio.file_new_for_path("/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf").query_exists(null) ||
      Gio.file_new_for_path("/usr/share/fonts/TTF/Symbola.ttf").query_exists(null) ||
      Gio.file_new_for_path("/usr/share/fonts/gdouros-symbola/Symbola.ttf").query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola_Hinted.ttf".format(HOME_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola.ttf".format(HOME_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola.otf".format(HOME_DIR)).query_exists(null)
    )
    if (!_fonts_installed) {
      let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
      let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
      if (_isArchlinux) {
        GLib.spawn_command_line_async("sh -c \"%s/install_symbola_on_Arch.sh\"".format(SCRIPTS_DIR));
        _fonts_installed = true
      }
    }
    this.fonts_installed = _fonts_installed;
    this.notifysend_installed = GLib.find_program_in_path("notify-send");
    return (this.fonts_installed && this.notifysend_installed)
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
      let notifyMessage = _("Spices Update") + " " + _("is fully functional.");
      Main.notify(_("All dependencies are installed"), notifyMessage);

      // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
      //this.on_applet_removed_from_panel();
      // Reload this applet with dependencies installed
      Extension.reloadExtension(UUID, Extension.Type.APPLET);
    } else if (!this.are_dependencies_installed() && this.notification === null) {
      let icon = new St.Icon({
        icon_name: 'error',
        icon_type: St.IconType.FULLCOLOR,
        icon_size: 36 });
      // Got a terminal used on this system:
      let terminal = this.get_terminal();
      // apturl is it present?
      let _is_apturl_present = GLib.find_program_in_path("apturl");
      // Detects the distrib in use and make adapted message and notification:
      let _isFedora = GLib.find_program_in_path("dnf");
      let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
      let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
      let _DebianWitnessFile = Gio.file_new_for_path("/tmp/DEBIAN");
      let _isDebian = _DebianWitnessFile.query_exists(null);
      let _apt_update =  _isFedora ? "sudo dnf update" : _isArchlinux ? "" : _isDebian ? "apt update" : "sudo apt update";
      let _and = _isArchlinux ? "" : " \\\\&\\\\& ";
      var _apt_install = _isFedora ? "sudo dnf install libnotify gdouros-symbola-fonts" : _isArchlinux ? "sudo pacman -Syu libnotify" : _isDebian ? "apt install libnotify-bin fonts-symbola" : "sudo apt install libnotify-bin fonts-symbola";
      let criticalMessagePart1 = _("You appear to be missing some of the programs required for this applet to have all its features.");
      let criticalMessage = _is_apturl_present ? criticalMessagePart1 : criticalMessagePart1+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
      this.notification = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);

      if (!_is_apturl_present) {
        if (terminal != "") {
          // TRANSLATORS: The next messages should not be translated.
          if (_isDebian === true) {
            GLib.spawn_command_line_async(terminal + " -e 'sh -c \"echo Spices Update message: Some packages needed!; echo To complete the installation, please become root with su then execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'");
          } else {
            GLib.spawn_command_line_async(terminal + " -e 'sh -c \"echo Spices Update message: Some packages needed!; echo To complete the installation, please enter and execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'");
          }
        }
      } else {
        if (!this.fonts_installed && !this.notifysend_installed)
          Util.spawnCommandLine("apturl apt://fonts-symbola,libnotify-bin")
        else if (!this.fonts_installed)
          Util.spawnCommandLine("apturl apt://fonts-symbola")
        else if (!this.notifysend_installed)
          Util.spawnCommandLine("apturl apt://libnotify-bin");
      }
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
      let message = Soup.Message.new('GET', URL_MAP[type] + GLib.uuid_string_random());
      _httpSession.queue_message(message, Lang.bind(this, this._on_response_download_cache, type));
      this.testblink[type]=null;
    }
  }; // End of download_cache

  _on_response_download_cache(session, message, type) {
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
    //var message;
    try {
      lastEdited = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member("last_edited").get_value();
      if (lastEdited) {
        ok = true;
        //message = "The last_edited member exists for the " + this._get_singular_type(type) + " " + uuid + ". Value = " + lastEdited.toString();
      }
    } catch(e) {
      // The "last-edited" member doesn't exists
      //message = "The last_edited member doesn't exist for the " + this._get_singular_type(type) + " " + uuid + ".";
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
    //var message;
    try {
      memberValue = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member(memberId).get_value();
      if (memberValue) {
        ok = true;
        //message = "The " + memberId + " member exists for the " + this._get_singular_type(type) + " " + uuid + ". Value = " + memberValue.toString();
      }
    } catch(e) {
      // The "last-edited" member doesn't exists
      //message = "The " + memberId + " member doesn't exist for the " + this._get_singular_type(type) + " " + uuid + ".";
    }

    if (ok === true) {
      return memberValue
    } else {
      return null
    }
  }; // End of _get_member_from_cache

  get_spice_name(type, uuid) {
    return _(this._get_member_from_cache(type, uuid, "name"), uuid)
  }; // End of get_spice_name

  get_spice_description(type, uuid) {
    return _(this._get_member_from_cache(type, uuid, "description"), uuid)
  }; // End of get_spice_name

  _rewrite_metadataFile(fileName, lastEdited) {
    let metadataFile = Gio.file_new_for_path(fileName);
    let metadataData;
    if (metadataFile.query_exists(null)) {
      metadataData = GLib.file_get_contents(fileName).toString().substr(5);
    } else {
      metadataData = "{}";
    }
    let newData = JSON.parse(metadataData);
    newData["last-edited"] = lastEdited;
    let message = JSON.stringify(newData, null, 2);
    GLib.file_set_contents(fileName, message);
    //log("Added missing last-edited field into " + fileName.toString())
  }; // End of _rewrite_metadataFile

  _get_last_edited_from_metadata(type, uuid) {
    var lastEdited = null;
    let metadataParser = new Json.Parser();
    let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
    let metadataFile = Gio.file_new_for_path(metadataFileName);
    let dirName = DIR_MAP[type] + "/" + uuid;
    let dir = Gio.file_new_for_path(dirName);
    let most_recent;

    // For some themes, the metadata.json file is in the subfolder /cinnamon:
    if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
      metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
      metadataFile = Gio.file_new_for_path(metadataFileName);
    }

    if (metadataFile.query_exists(null)) {
      // substr(5) is needed to remove the 'true,' at begin:
      let metadataData = GLib.file_get_contents(metadataFileName).toString().substr(5);
      metadataParser.load_from_data(metadataData, -1);
      let node = metadataParser.get_root();
      if (node.get_node_type() === Json.NodeType.OBJECT) {
        var lastEditedIsToSet = false;
        let obj = node.get_object();
        try {
          lastEdited = obj.get_member("last-edited").get_value();
        } catch(e) {
          // The last-edited member doesn't exist
          most_recent = this._most_recent_file_in(dir);
          // Set the last-edited member's value to the last modification time of the most_recent file, in epoch format.
          if (most_recent !== null) {
            lastEdited = most_recent.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
            this.get_date_of_nearest_commit(type, uuid, lastEdited, metadataFileName);
          }
        }
      }
    }
    return lastEdited
  }; // End of _get_last_edited_from_metadata

  _most_recent_file_in(dir) {
    if (dir.query_exists(null)) {
      var latest_time = dir.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
      var latest_file = dir;
      let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
      let info, file_type;
      let file, file_time;
      while ((info = children.next_file(null)) != null) {
        file = children.get_child(info);
        if (file.get_basename() === "metadata.json") continue; // ignore metadata.json file

        file_time = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
        if (file_time > latest_time) {
          latest_time = file_time;
          latest_file = file;
        }
        file_type = info.get_file_type();
        if (file_type == Gio.FileType.DIRECTORY) {
          file = this._most_recent_file_in(file);
          file_time = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
          if (file_time > latest_time) {
            latest_time = file_time;
            latest_file = file;
          }
        }
      }
      return latest_file;
    } else {
      return null;
    }
  }; // End of _most_recent_file_in

  _on_forget_new_spices_pressed() {
    for (let type of TYPES) {
      for (let uuid of this.new_Spices[type]) this.download_image(type, uuid);
    }
  }; // End of _on_forget_new_spices_pressed

  download_image(type, uuid) {
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
    target = CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";

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
        fstream.write(chunk.get_data(), null);
      }
    }));

    // Queue of the http request
    _httpSession.queue_message(request, Lang.bind(this, function(_httpSession, message) {
      // Download is done; close the file:
      fstream.close(null);
    }));
  }; // End of download_image

  get_last_commit_subject(type, uuid) {
    let marker_begin = "</span>\]";
    let marker_end = "</div>";
    let subject_regexp = new RegExp(`${marker_begin}(.+)${marker_end}`);
    let url = "https://cinnamon-spices.linuxmint.com/%s/view/%s/".format(type.toString(),
                                                                        this._get_member_from_cache(type, uuid, "spices-id").toString());
    var msg = Soup.Message.new('GET', url);

    let iteration = this.iteration;
    // Queue of the http request
    _httpSession.queue_message(msg, Lang.bind(this, function(_httpSession, message) {
      if (message.status_code === Soup.KnownStatusCode.OK && iteration === this.iteration) {
        this.do_rotation = false;
        this.updateUI();
        let data = message.response_body.data;
        let result = subject_regexp.exec(data.toString());
        this.details_by_uuid[uuid] = result[1].toString();
        //log("result[1]="+result[1]);
      } else {
        this.details_by_uuid[uuid] = "";
      }
    }));
    return (this.details_by_uuid[uuid] !== undefined && this.details_by_uuid[uuid] !== "")
  }; // End of get_last_commit_subject

  get_date_of_nearest_commit(type, uuid, timestamp, fileName) {
    let marker_begin = '<relative-time datetime="';
    let marker_end = '" class="no-wrap">';
    let subject_regexp = new RegExp(`${marker_begin}(.+)${marker_end}`, 'g');
    let url = "https://github.com/linuxmint/cinnamon-spices-%s/commits/master/%s".format(type.toString(), uuid);
    var msg = Soup.Message.new('GET', url);

    let iteration = this.iteration;
    // Queue of the http request
    _httpSession.queue_message(msg, Lang.bind(this, function(_httpSession, message) {
      if (message.status_code === Soup.KnownStatusCode.OK && iteration === this.iteration) {
        this.do_rotation = false;
        this.updateUI();
        let data = message.response_body.data;
        let result;
        let commit_time;
        var nearest_commit_time = timestamp;
        var smaller_difference = Math.round(Date.now() / 1000);
        let difference;
        while (result == subject_regexp.exec(data.toString())) {
          commit_time = Date.parse(result[1].toString()) / 1000;
          difference = Math.abs(timestamp - commit_time);
          if (difference < smaller_difference) {
            smaller_difference = difference;
            nearest_commit_time = commit_time;
          }
        }
        this._rewrite_metadataFile(fileName, nearest_commit_time);
      }
    }));
    //return (this.details_by_uuid[uuid] !== undefined && this.details_by_uuid[uuid] !== "")
  }; // End of get_date_of_nearest_commit

  is_to_check(type) {
    return (this.types_to_check.indexOf(type) > -1);
  }; // End of is_to_check

  is_to_check_for_new(type) {
    return (this.types_to_check_new.indexOf(type) > -1);
  }; // End of is_to_check_for_new

  get_can_be_updated(type) {
    var ret = [];
    var spicesList = [];
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
    for (let s of spicesList) {
      if (s["isunprotected"] === true) {
        ret.push(s["name"])
      }
    }
    //log("can_be_updated("+ type + ") = " + JSON.stringify(ret));
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
          if (lc > lm) {
            if (this.details_requested) {
              if (this.get_last_commit_subject(type, uuid)) {
                if (this.details_by_uuid[uuid].trim() !== "") {
                  ret.push("%s (%s)\n\t\t« %s »".format(_(this.get_spice_name(type, uuid)), uuid, this.details_by_uuid[uuid].trim()));
                } else {
                  ret.push("%s (%s)\n\t\t%s".format(_(this.get_spice_name(type, uuid)), uuid, _("(Description unavailable)")));
                }
              } else {
                this.refreshInterval = DOWNLOAD_TIME; // Wait DOWNLOAD_TIME more seconds to avoid the message "(Refresh to see the description)".
                //ret.push("%s (%s)\n\t\t%s".format(_(this.get_spice_name(type, uuid)), uuid, _("(Refresh to see the description)")));
              }
            } else {
              ret.push("%s (%s)".format(_(this.get_spice_name(type, uuid)), uuid));
            }
            this.monitor_metadatajson(type, uuid);
          }
        }
      }
    }
    return ret
  }; // End of get_must_be_updated

  get_are_new(type) {
    var ret = new Array();
    for (let uuid of this.new_Spices[type]) {
      if (this.details_requested === true)
        ret.push("%s (%s)\n\t\t« %s »".format(_(this.get_spice_name(type, uuid)),
                                            uuid,
                                            _(this.get_spice_description(type, uuid))))
      else
        ret.push("%s (%s)".format(_(this.get_spice_name(type, uuid)), uuid))
    }
    return ret
  }; // End of get_are_new

  get_uuids_from_cache(type) {
    var cacheParser = JSON.parse(this.cache[type]);
    let names = Object.keys(cacheParser);
    //log("names = " + names.toString());
    return names
  }; // End of get_uuids_from_cache

  get_new_spices(type) {
    if (!this.is_to_check_for_new(type)) return false;
    var known_spices = [];
    let uuids = this.get_uuids_from_cache(type);
    let png_dir = Gio.file_new_for_path(HOME_DIR + "/.cinnamon/spices.cache/%s".format(this._get_singular_type(type)));
    if (png_dir.query_exists(null)) {
      let children = png_dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
      let info;
      var name;
      while ((info = children.next_file(null)) != null) {
        name = info.get_name().toString();
        if (info.get_file_type() === Gio.FileType.REGULAR && name.substr(name.length - 4, name.length - 1) === ".png") {
          known_spices.push(name.substr(0, name.length - 4))
        }
      }
      known_spices = known_spices.sort((a,b) => { if (a<b) return -1; else return 1;});
    }
    this.new_Spices[type] = [];
    uuids.map(x => {if (known_spices.indexOf(x)<0) this.new_Spices[type].push(x);});
    if (this.new_Spices[type].length > 0) this.monitor_png_directory(type);
    //log("new_Spices[%s] = %s".format(type, this.new_Spices[type].toString()));
    return (this.new_Spices[type].length > 0)
  }; // End of get_new_spices

  monitor_png_directory(type) {
    if (this.monitorsPngId[type] === 0) {
      let pngDirName = HOME_DIR + "/.cinnamon/spices.cache/%s".format(this._get_singular_type(type));
      let pngDir = Gio.file_new_for_path(pngDirName);

      if (pngDir.query_exists(null)) {
        try {
          let monitor = pngDir.monitor_directory(0, null);
          let Id = monitor.connect('changed', (type) => this._on_pngDir_changed(type));
          this.monitors.push([monitor, Id]);
          this.monitorsPngId[type] = Id;
        } catch(e) {
          //log("Unable to monitor the png directory for the %s: %s".format(type.toString(), e))
        }
      }
    }
  }; // End of monitor_png_directory

  _on_pngDir_changed(type) {
    this._on_refresh_pressed()
  }; // End of _on_pngDir_changed

  monitor_metadatajson(type, uuid) {
    let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
    let metadataFile = Gio.file_new_for_path(metadataFileName);

    // For some themes, the metadata.json file is in the subfolder /cinnamon:
    if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
      metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
      metadataFile = Gio.file_new_for_path(metadataFileName);
    }

    if (metadataFile.query_exists(null)) {
      try {
        let monitor = metadataFile.monitor(0, null);
        let Id = monitor.connect('changed', (type, uuid) => this._on_metadatajson_changed(type, uuid));
        this.monitors.push([monitor, Id]);
      } catch(e) {
        //log("Unable to monitor metadata.json of the %s %s: %s".format(this._get_singular_type(type.toString()), uuid, e))
      }
    }
  }; // End of monitor_metadatajson

  _on_metadatajson_changed(type, uuid) {
    this._on_refresh_pressed()
  }; // End of _on_metadatajson_changed

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
      listEnabled.push(enabled);
      //log('listEnabled='+ listEnabled.toString());
      return listEnabled
    }

    _SETTINGS_SCHEMA = "org.cinnamon";
    _SETTINGS_KEY = "enabled-%s".format(type.toString());
    _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });

    enabled = _interface_settings.get_strv(_SETTINGS_KEY);
    let xlet_uuid;
    for (let xl of enabled) {
      xlet_uuid = xl.split(':')[elt].toString().replace(/'/g,"");
      if (!xlet_uuid.endsWith("@cinnamon.org") && (listCanBeUpdated.indexOf(xlet_uuid)>-1))
        listEnabled.push(xlet_uuid);
    }
    //log('listEnabled='+ listEnabled.toString());
    return listEnabled
  }; // End of get_active_spices

  get_default_icon_color() {
    try {
      let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
      let icon_color = themeNode.get_icon_colors();
      this.defaultColor = icon_color.foreground.to_string();
    } catch(e) {
      this.defaultColor = "white";
    }
  }; // End of get_default_icon_color

  makeMenu() {
    this.menu.removeAll();

    // Head
    this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("Spices Update"), {
      reactive: false
    });
    this.menu.addMenuItem(this.menuitemHead1);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    if (this.dependenciesMet) {
      // Refresh button
      this.refreshButton = new PopupMenu.PopupIconMenuItem(_("Refresh"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
      this.refreshButton.connect('activate', (event) => this._on_refresh_pressed());
      this.menu.addMenuItem(this.refreshButton);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    // Status of each type of Spices:
    this.spicesMenuItems = {};
    let ts;
    for (let t of TYPES) {
      ts = _(capitalize(t.toString()));
      if (this.nb_in_menu[t] - this.new_Spices[t].length > 0) ts += "   \u21BB %s".format((this.nb_in_menu[t] - this.new_Spices[t].length).toString());
      if (this.new_Spices[t].length > 0) ts += "   \u2604 %s".format((this.new_Spices[t].length).toString());
      this.spicesMenuItems[t] = new PopupMenu.PopupIndicatorMenuItem(ts);
      this.spicesMenuItems[t].connect('activate', (event) => {
        //Util.spawnCommandLine("cinnamon-settings " + t.toString());
        Util.spawnCommandLine("%s/open_download_tab.py %s".format(SCRIPTS_DIR, t.toString()));
      });
      this.spicesMenuItems[t].setShowDot(this.menuDots[t]);
      this.menu.addMenuItem(this.spicesMenuItems[t]);
    }
    // button Forget
    if (this.nb_to_watch > 0) {
      let _forget_button = new PopupMenu.PopupIconMenuItem(_("Forget new Spices") + " -\u2604-", "emblem-ok", St.IconType.SYMBOLIC);
      _forget_button.connect("activate", (event) => this._on_forget_new_spices_pressed());
      this.menu.addMenuItem(_forget_button);
    }
    // button Download
    if ((this.nb_to_update + this.nb_to_watch) > 0) {
      let _download_tabs_button = new PopupMenu.PopupIconMenuItem(_("Open useful Cinnamon Settings"), "folder-download", St.IconType.SYMBOLIC);
      _download_tabs_button.connect("activate", (event) => this.open_each_download_tab());
      this.menu.addMenuItem(_download_tabs_button);
    }
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // button Configure...
    let configure = new PopupMenu.PopupIconMenuItem(_("Configure") + "...", "system-run", St.IconType.SYMBOLIC);
    configure.connect("activate", (event) => {
        Util.spawnCommandLine("cinnamon-settings applets %s %s".format(UUID, this.instanceId));
    });
    this.menu.addMenuItem(configure);
    if (DEBUG) {
      let _reload_button = new PopupMenu.PopupIconMenuItem("Reload this applet", "edit-redo", St.IconType.SYMBOLIC);
      _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed())
      this.menu.addMenuItem(_reload_button);
    }

    if (this.help_file !== null) {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // button Help...
      this.help_button = new PopupMenu.PopupIconMenuItem(_("Help", "cinnamon-control-center") + "...", "folder-documents-symbolic", St.IconType.SYMBOLIC);
      this.help_button.connect('activate', (event) => {
          GLib.spawn_command_line_async('xdg-open ' + this.help_file);
        });

      this.menu.addMenuItem(this.help_button);
    }

  }; // End of makeMenu

  _on_refresh_pressed() {
    this.first_loop = false;
    this.refresh_requested = true;
    this.do_rotation = true;
    this.updateLoop();
  }; // End of _on_refresh_pressed

  _on_reload_this_applet_pressed() {
    // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
    this.applet_running = false;
    if (this.loopId > 0) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;
    var monitor, Id;
    for (let tuple of this.monitors) {
      [monitor, Id] = tuple;
      monitor.disconnect(Id)
    }
    this.monitors = [];
    for (let type of TYPES) this.monitorsPngId[type] = 0;
    // Reload this applet
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
  }; // End of _on_reload_this_applet_pressed

  _clean_str(str) {
    let ret = str.replace(/\\'/gi, "'");
    ret = ret.replace(/\\"/gi, '"');
    return ret;
  }; // End of _clean_str

  darken_color(str_color) {
    let c = Clutter.Color.from_string(str_color)[1];
    let lc = c.darken();
    return lc.to_string().substr(0,7);
  }

  set_icon_color() {
    if (this.refresh_requested) {
      //this._applet_icon.style = "color: %s;".format("lightgray");
      this._applet_icon.style = "color: %s;".format(this.darken_color(this.defaultColor));
      this.refreshInterval = DOWNLOAD_TIME;
    } else {
      this.get_default_icon_color();
      this._applet_icon.style = "color: %s;".format(this.defaultColor);
    }
    this.refresh_requested = false;
    if (this.general_warning === true) {
      for (let t of TYPES) {
        if (this.menuDots[t] === true) {
          this._applet_icon.style = "color: %s;".format(this.events_color);
          break;
        }
      }
    }
  }; // End of set_icon_color

  icon_rotate() {
    this.angle = Math.round(this.angle + 3) % 360;
    let size = ((this._panelHeight / 25) * 1.14 * 11.5) * global.ui_scale;
    if (this.isHorizontal === false) size = 0.8 * size / global.ui_scale;
    else size = size / global.ui_scale;
    this.img_icon = getImageAtScale(this.img_path, size, size);
    this.img_icon.set_pivot_point(0.5, 0.5);
    this.img_icon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, this.angle);
    this._applet_icon_box.set_child(this.img_icon);
    if (this.isHorizontal === true)
      this._applet_icon_box.set_fill(true, false);
    else
      this._applet_icon_box.set_fill(false, true);
    this._applet_icon_box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
  }; // End of icon_rotate

  // This updates the display of the applet and the tooltip
  updateUI() {
    if (this.ui_scale !== global.ui_scale) {
      this.define_badge();
      this.ui_scale = global.ui_scale;
    }
    if (this.do_rotation) {
      if (this.interval === 0)
        this.interval = setInterval(() => this.icon_rotate(), 10);
    } else if (this.interval != 0){
      clearInterval(this.interval);
      this.interval = 0;
      this.angle = 0;
      this.set_applet_icon_symbolic_name("spices-update");
    }

    this.set_icon_color();
    if (this.nb_to_update > 0 || this.nb_to_watch > 0) {
      var _tooltip = this.default_tooltip;
      var tooltip_was_modified = false;
      for (let type of TYPES) {
        if (this.old_message[type] != "" || this.old_watch_message[type] != "") {
          if (!tooltip_was_modified) {
            _tooltip += "\n%s".format(_("Middle-Click to open useful Cinnamon Settings"));
            tooltip_was_modified = true;
          }
          _tooltip += "\n\n\t\t\t%s".format(_(type).toLocaleUpperCase());
          if (this.old_message[type] != "") _tooltip += "\n\u21BB %s".format(this._clean_str(this.old_message[type].replace(/, /gi, "\n\t")));
          if (this.old_watch_message[type] != "") _tooltip += "\n\u2604 %s".format(this._clean_str(this.old_watch_message[type].replace(/, /gi, "\n\t")));
        }
      }
      if (!tooltip_was_modified) {
        _tooltip += "\n%s".format(_("Middle-Click to Refresh"));
      }
      this.set_applet_tooltip(_tooltip);
      this.numberLabel.text = (this.nb_to_update + this.nb_to_watch).toString();
      this.badge.show();
    } else {
      this.set_applet_tooltip(this.default_tooltip + "\n%s".format(_("Middle-Click to Refresh")));
      this.numberLabel.text = '';
      this.badge.hide();
    }
    if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
      this._applet_tooltip._tooltip.set_style('text-align: right;');
    } else {
      this._applet_tooltip._tooltip.set_style('text-align: left;');
    }
  }; // End of updateUI

  // This is the loop run at general_frequency rate to call updateUI() to update the display in the applet and tooltip
  updateLoop() {
    if (this.loopId > 0) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;
    this.check_dependencies();

    this.iteration = (this.iteration + 1) % 10;

    // Inhibits also after the applet has been removed from the panel
    if (this.applet_running === true) {
      this.get_translated_help_file();
      this.OKtoPopulateSettingsApplets = true;
      this.OKtoPopulateSettingsDesklets = true;
      this.OKtoPopulateSettingsExtensions = true;
      this.OKtoPopulateSettingsThemes = true;
      var t;
      if (!this.dependenciesMet) {
        this.refreshInterval = 5;
      } else {
        if (!this.first_loop) {
          this.refreshInterval = 3600 * this.general_frequency;
          var monitor, Id;
          for (let tuple of this.monitors) {
            [monitor, Id] = tuple;
            monitor.disconnect(Id)
          }
          this.monitors = [];
          for (let type of TYPES) this.monitorsPngId[type] = 0;

          this.populateSettingsUnprotectedApplets();
          this.populateSettingsUnprotectedDesklets();
          this.populateSettingsUnprotectedExtensions();
          this.populateSettingsUnprotectedThemes();

          var must_be_updated;
          this.nb_to_update = 0;
          this.nb_to_watch = 0;
          for (t of TYPES) {
            if (this.is_to_check(t)) {
              if (this.cache[t] === "{}") this._load_cache(t);
              this.download_cache(t);
              must_be_updated = this.get_must_be_updated(t);
              this.nb_in_menu[t] = must_be_updated.length;
              if (must_be_updated.length > 0) {
                this.nb_to_update += this.nb_in_menu[t];
                var filePath, tempdir;
                this.menuDots[t] = true;
                let message = "";
                let uuid = null;
                if (must_be_updated.length === 1) {
                  message = "One " + this._get_singular_type(t) + " needs update:";
                  uuid = must_be_updated[0].split("(")[1].split(")")[0];
                } else {
                  message = "Some " + t + " need update:"
                }
                let new_message = _(message) + "\n\t" + must_be_updated.join("\n\t");
                if (this.force_notifications || new_message != this.old_message[t]) { // One notification is sufficient!
                  if (this.general_notifications) {
                    if (this.general_type_notif === "minimal") notify_send(this._clean_str(new_message));
                    else this.notify_with_button(this._clean_str(new_message), t, uuid);
                  }
                  this.old_message[t] = new_message.toString();
                }

              } else {
                this.menuDots[t] = false;
                this.old_message[t] = "";
              }
              if (this.is_to_check_for_new(t) && this.get_new_spices(t)) {
                this.nb_in_menu[t] += this.new_Spices[t].length;
                this.nb_to_watch += this.new_Spices[t].length;
                this.menuDots[t] = true;
                let watch_message = "";
                if (this.new_Spices[t].length === 1) {
                  watch_message = "New " + this._get_singular_type(t) + " available:"
                } else {
                  watch_message = "New " + t + " available:"
                }
                let new_watch_message = _(watch_message) + "\n\t" + this.get_are_new(t).join("\n\t");
                if (this.force_notifications || new_watch_message != this.old_watch_message[t]) { // One notification is sufficient!
                  if (this.general_notifications) {
                    if (this.general_type_notif === "minimal") notify_send(this._clean_str(new_watch_message));
                    else this.notify_with_button(this._clean_str(new_watch_message), t);
                  }
                  this.old_watch_message[t] = new_watch_message.toString();
                }
              } else {
                this.old_watch_message[t] = "";
              }
            }
          }
          this.updateUI(); // update icon and tooltip
        } else {
          this.refreshInterval = 60; // 60 seconds
          this.first_loop = false;
        }
      }
      this._set_main_label();
      // One more loop !
      //this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
    }
    if (this.applet_running === true && this.loopId === 0) {
      this.do_rotation = false;
      // One more loop !
      this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
    }
  }; // End of updateLoop

  open_each_download_tab() {
    for (let t of TYPES) {
      if (this.nb_in_menu[t] > 0) {
        Util.spawnCommandLine("%s/open_download_tab.py %s".format(SCRIPTS_DIR, t.toString()));
      }
    }
  };  // End of open_each_download_tab

  _onButtonPressEvent(actor, event) {
    if (event.get_button() == 2) {
      if ((this.nb_to_update + this.nb_to_watch) === 0) {
        this._on_refresh_pressed();
      } else {
        this.open_each_download_tab();
      }
    }
    return super._onButtonPressEvent(actor, event);
  };  // End of _onButtonPressEvent

  //++ Handler for when the applet is clicked.
  on_applet_clicked(event) {
    //this.updateLoop();
    this.makeMenu();
    this.updateUI();
    this.menu.toggle();
  }; // End of on_applet_clicked

  // ++ Null function called when Generic (internal) Setting changed
  on_generic_changed() {
    // Nothing to do.
  }; // End of on_generic_changed

  // ++ This finalizes the settings when the applet is removed from the panel
  on_applet_removed_from_panel() {
    // When applet is removed from panel: stop the loop, inhibit the update timer,
    // remove all bindings and disconnect all signals (if any) to avoid errors.
    this.applet_running = false;
    if (this.loopId > 0) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;

    if (this.interval != 0){
      clearInterval(this.interval);
    }

    var monitor, Id;
    for (let tuple of this.monitors) {
      [monitor, Id] = tuple;
      monitor.disconnect(Id)
    }
    this.monitors = [];
    for (let type of TYPES) this.monitorsPngId[type] = 0;
    if (this.settings) {
      try {
        this.settings.finalize();
      } catch(e) {
        logError(e)
      }
    }
    //Main.keybindingManager.removeHotKey(UUID);
  };
} // End of class SpicesUpdate

function main(metadata, orientation, panelHeight, instance_id) {
  return new SpicesUpdate(metadata, orientation, panelHeight, instance_id);
}
