'use strict';
// infos on use strict: https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Strict_mode
//Applet:
const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
//AppletManager:
const AppletManager = imports.ui.appletManager;
//Cinnamon:
const { WindowTracker, AppSystem } = imports.gi.Cinnamon;
//Lang:
const Lang = imports.lang;
//PopupMenu:
const { PopupMenu, PopupMenuManager, PopupMenuItem, PopupSeparatorMenuItem, PopupIconMenuItem, PopupSwitchMenuItem, PopupMenuSection, PopupSubMenuMenuItem, PopupBaseMenuItem, PopupSubMenu, arrowIcon } = imports.ui.popupMenu;
// Settings:
const { AppletSettings } = imports.ui.settings;
// ./lib/util:
const { spawnCommandLineAsyncIO, spawnCommandLineAsync, spawnCommandLine, spawn_async, trySpawnCommandLine, setTimeout, clearTimeout } = require("./lib/util");
//Clutter:
const { ScrollDirection, Image, Actor, Color, RotateAxis } = imports.gi.Clutter;
//Gettext:
const { bindtextdomain, dgettext, gettext } = imports.gettext;
//GLib:
const { get_home_dir, get_language_names, get_user_name, get_user_runtime_dir, get_user_special_dir, UserDirectory, find_program_in_path, markup_escape_text, DateTime, file_test, FileTest, file_get_contents, file_set_contents, mkdir_with_parents, uuid_string_random, random_int_range, getenv, PRIORITY_LOW, SOURCE_REMOVE, SOURCE_CONTINUE } = imports.gi.GLib;
//Gtk:
const { FileChooserDialog, FileFilter, FileChooserAction, STOCK_CANCEL, STOCK_OPEN, ResponseType, PolicyType, DirectionType } = imports.gi.Gtk;
//Gdk:
const { Display } = imports.gi.Gdk;
//FileDialog:
const FileDialog = imports.misc.fileDialog;
//ModalDialog:
const ModalDialog = imports.ui.modalDialog;
//Gio:
const { network_monitor_get_default, NetworkConnectivity, file_new_for_path, app_info_get_default_for_type, FileInfo, FileQueryInfoFlags, FileType, FileIcon, FileMonitorFlags, DataInputStream, UnixInputStream, Settings } = imports.gi.Gio;
//St:
const { Icon, IconType, Button, Widget, ScrollView, Align, Label, BoxLayout, Bin, Side, Clipboard, ClipboardType } = imports.gi.St;
//Tooltips:
const { Tooltip } = imports.ui.tooltips;
//MessageTray:
const { Urgency, MessageTray, SystemNotificationSource, Notification } = imports.ui.messageTray;

var RADIO_NOTIFICATION_TIMEOUT = 2;
const RADIO_NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET = 10;
//Mainloop:
const { timeout_add_seconds, source_remove } = imports.mainloop;
//Pango
const { parse_markup, WrapMode, EllipsizeMode } = imports.gi.Pango;
//Extension:
const { reloadExtension, Type } = imports.ui.extension;
//Clutter:
const Clutter = imports.gi.Clutter;
//GdkPixbuf:
const { Pixbuf } = imports.gi.GdkPixbuf;
//Cogl:
const { PixelFormat } = imports.gi.Cogl;
//Main:
const { notificationDaemon, keybindingManager, uiGroup } = imports.ui.main;
//Atk:
const Atk = imports.gi.Atk;
//Cvc:
const Cvc = imports.gi.Cvc;
//Signals:
const Signals = imports.signals;
// checkDependencies:
const { Dependencies, criticalNotify } = require("./lib/checkDependencies");
// htmlEncodeDecode:
let HtmlEncodeDecode = require('./lib/htmlEncodeDecode');
// xml2json.min:
const { xml2json } = require('./lib/xml2json.min');
// filesCsv:
const FilesCsv = require("./lib/filesCsv");
// filesPls:
const FilesPls = require("./lib/filesPls");
// filesM3u:
const FilesM3u = require("./lib/filesM3u");
// filesXspf:
const FilesXspf = require("./lib/filesXspf");
// filesJson:
const FilesJson = require("./lib/filesJson");
// files:
const Files = require("./lib/files");
// volumeslider:
const VolumeSlider = require("./lib/volumeslider");
// screensaverInhibitor:
const ScreensaverInhibitor = require("./lib/screensaverInhibitor");
// to-string:
const {to_string} = require("./lib/to-string");
// httpLib:
const {HttpLib} = require("./lib/httpLib");
// fixedEncodeURIComponent:
const { fixedEncodeURIComponent } = require("./lib/fixedEncodeURIComponent");
// checkTranslations:
const { are_translations_installed, install_translations } = require("./lib/checkTranslations");

//~ const {
  //~ Shoutcast
//~ } = require("./lib/shoutcast");

const range = (start, stop, step) =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);
var validChars = range("A".charCodeAt(0), "Z".charCodeAt(0), 1).map((x) =>
  String.fromCharCode(x)
);
validChars += "," + range("a".charCodeAt(0), "z".charCodeAt(0), 1).map((x) =>
  String.fromCharCode(x)
);
validChars += "," + range("0".charCodeAt(0), "9".charCodeAt(0), 1).map((x) =>
  String.fromCharCode(x)
);
validChars = validChars.replace(/,/g, "");
validChars = Array.from(validChars);

// To capitalize each word
function capitalize_each_word(s) {
    return s.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
}

function _get_system_natural_scroll() {
  var _SETTINGS_SCHEMA;
  if (versionCompare(getenv("CINNAMON_VERSION"), "5.1") <= 0) {
    _SETTINGS_SCHEMA='org.cinnamon.settings-daemon.peripherals.mouse';
  } else {
    _SETTINGS_SCHEMA='org.cinnamon.desktop.peripherals.mouse';
  }
  let _SETTINGS_KEY = 'natural-scroll';
  let _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
  let ret = _interface_settings.get_boolean(_SETTINGS_KEY);
  return ret
}

function getImageAtScale(imageFileName, width, height) {
  let pixBuf = Pixbuf.new_from_file_at_size(imageFileName, width, height);
  let image = new Image();
  image.set_data(
    pixBuf.get_pixels(),
    pixBuf.get_has_alpha() ? PixelFormat.RGBA_8888 : PixelFormat.RGBA_888,
    width, height,
    pixBuf.get_rowstride()
  );
  let actor = new Actor({width: width, height: height});
  actor.set_content(image);
  return actor;
}

function versionCompare(left, right) {
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
}

const APPNAME = "Radio3.0";
const UUID = APPNAME + "@claudiux";

const HOME_DIR = get_home_dir();
const USER_NAME = get_user_name();
const RUNTIME_DIR = get_user_runtime_dir();
const DOT_CONFIG_DIR = HOME_DIR + "/.config/" + APPNAME;
const COVER_ART_DIR = DOT_CONFIG_DIR + "/cover-art";
const SONG_ART_DIR = DOT_CONFIG_DIR + "/song-art";
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const HELP_DIR = APPLET_DIR + "/help";
const RADIO30_OLD_CONFIG_FILE = HOME_DIR + "/.cinnamon/configs/" + UUID + "/" + UUID + ".json";
const RADIO30_NEW_CONFIG_FILE = HOME_DIR + "/.config/cinnamon/spices/" + UUID + "/" + UUID + ".json";
var RADIO30_CONFIG_FILE = "" + RADIO30_OLD_CONFIG_FILE;
if (  versionCompare(getenv("CINNAMON_VERSION"), "5.6") >= 0 &&
      !file_test(RADIO30_OLD_CONFIG_FILE, FileTest.EXISTS) ) {
  RADIO30_CONFIG_FILE = "" + RADIO30_NEW_CONFIG_FILE;
}
const RADIO30_SETTINGS_SCHEMA = APPLET_DIR + "/settings-schema.json";
const DB_SERVERS_FILE = APPLET_DIR + "/radiodb/server-list.json";
const XS_PATH = "%s/xs/xlet-settings.py".format(APPLET_DIR, );
const APPLET_ICON = APPLET_DIR + "/icons/icon.svg";
const ANIMATED_ICON = APPLET_DIR + "/icons/animated-symbolic.svg";
var MANUAL_HTML = HELP_DIR + "/MANUAL.html";

const USER_MUSIC_DIR = get_user_special_dir(UserDirectory.DIRECTORY_MUSIC);
const DEFAULT_RADIO30_MUSIC_DIR = USER_MUSIC_DIR + "/" + APPNAME;
var RADIO30_MUSIC_DIR = USER_MUSIC_DIR + "/" + APPNAME;

const USER_DOWNLOAD_DIR = get_user_special_dir(UserDirectory.DIRECTORY_DOWNLOAD);

const YTDLP_UPDATE_BASH_SCRIPT = SCRIPTS_DIR + "/update-yt-dlp.sh";
const MPV_BITRATE_BASH_SCRIPT = SCRIPTS_DIR + "/mpvWatchBitrate.sh";
const MPV_TITLE_BASH_SCRIPT = SCRIPTS_DIR + "/mpvWatchTitle.sh";
const DEL_SONG_ARTS_SCRIPT = SCRIPTS_DIR + "/del_song_arts.sh";
const MPV_LUA_SCRIPT = SCRIPTS_DIR + "/mpvWatchTitle.lua";
const MPV_PID_FILE = RUNTIME_DIR + "/mpv_radio_PID";
const MPV_SOCKET = RUNTIME_DIR + "/mpvradiosocket";
const MPV_TITLE_FILE = RUNTIME_DIR + "/mpv_radio_title.txt";
const MPV_BITRATE_FILE = RUNTIME_DIR + "/mpv_radio_bitrate.txt";
const MPV_CODEC_FILE = RUNTIME_DIR + "/mpv_radio_codec.txt";
const R30STOP = RUNTIME_DIR + "/R30Stop";
const R30NEXT = RUNTIME_DIR + "/R30Next";
const R30PREVIOUS = RUNTIME_DIR + "/R30Previous";

const CATEGORY_ROW_FILE = RUNTIME_DIR + "/radio_category_row.txt";
const UPDATE_OPTIONS_FILE = RUNTIME_DIR + "/radio_update_options.txt";

const DEFAULT_DB_SERVERS = [
  "https://api.radiodb.fr",
  "https://de1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info"
];
const RADIO_LISTS_DIR = DOT_CONFIG_DIR + "/radio-lists";
const JOBS_DIR = DOT_CONFIG_DIR + "/scheduled-jobs";
// Note: find_program_in_path("mpv") returns '/usr/bin/mpv' or null.
const MPV_PROGRAM = () => {return find_program_in_path("mpv")};
const SOX_PROGRAM = () => {return find_program_in_path("sox")};
const YTDL_PROGRAM = () => {
  //returns : path to yt-dlp or youtube-dl; or null.
  let ret = find_program_in_path("yt-dlp");
  if (ret != null) return ret;
  return find_program_in_path("youtube-dl");
};

// mpv --no-terminal --no-video --input-ipc-server=/tmp/mpvsocket http://95.217.68.35:8352/stream

const REFRESH_INTERVAL = 5; // (seconds)

const VERTICAL = 2;
const QUEUE = 1;

var VERSION;

/* Check if string is valid UUID */
function isValidUUID(str) {
  // Regular expression to check if string is a valid UUID
  const regexUUID = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

  return regexUUID.test(str);
}

function isValidURL(str) {
  // Regular expression to check if string is a valid UUID
  const regexURL =  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/;

  return regexURL.test(str);
}

function spaceAvailable(path) {
  try {
    let dir = file_new_for_path(path);
    let info = dir.query_filesystem_info('filesystem::free', null);
    let free = info.get_attribute_as_string('filesystem::free');
    return parseInt(free)
  } catch(e) {logError(e)}
}

function get_nemo_size_prefixes() {
  let _SETTINGS_SCHEMA='org.nemo.preferences';
  let _SETTINGS_KEY = 'size-prefixes';
  let _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
  return _interface_settings.get_string(_SETTINGS_KEY)
}

function set_nemo_size_prefixes(value='base-10') {
  let valid_values = ['base-10', 'base-10-full', 'base-2', 'base-2-full'];
  if (valid_values.indexOf(value) < 0) {
    logError("Nemo size prefixes must be: 'base-10', 'base-10-full', 'base-2' or 'base-2-full', which is not the case of '"+value+"'.");
    return
  }
  let _SETTINGS_SCHEMA='org.nemo.preferences';
  let _SETTINGS_KEY = 'size-prefixes';
  let _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
  _interface_settings.set_string(_SETTINGS_KEY, value)
}
//Object.defineProperty(Object.prototype, 'watch', {
    //value: function(prop, handler){
        //var setter = function(val){
            //return val = handler.call(this, val);
        //};
        //Object.defineProperty(this, prop, {
            //set: setter
        //});
    //}
//});

//var title_obj = {};

function ENGLISH() {
  let _english = file_new_for_path(APPLET_DIR + "/ENGLISH");
  return _english.query_exists(null);
};

bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
  if (ENGLISH()) return str;
  let customTranslation = dgettext(UUID, str);
  if(customTranslation != str) {
    return customTranslation;
  }
  return gettext(str);
}

/**
 * get_user_language()
 * Returns the language of the user.
 */
function get_user_language() {
  //~ log("get_language_names(): "+get_language_names());
  let _language;
  try {
    _language = ""+get_language_names()[0].split("_")[0];
  } catch(e) {
    // Unable to detect language. Return English by default.
    _language = "en";
  }
  return _language;
}

if (file_test(HELP_DIR+"/"+get_user_language()+"/MANUAL.html", FileTest.EXISTS))
  MANUAL_HTML = HELP_DIR+"/"+get_user_language()+"/MANUAL.html";

let stations_help_text = _("This is your own list of Categories and Radio Stations.")+"\n"+
_("You can add more using the [+] button.")+"\n"+
_("For a category, fill in only its name; leave the other fields empty.")+"\n"+
_("For a radio station, enter only its name and its streaming URL.")+"\n"+
_("You can order the rows by dragging and dropping or by using the buttons and tools below the list.")+"\n"+
_("The buttons on the right below the list allow you to navigate page by page or category by category.")+"\n"+
_("To search for one of your stations, click on the list and start writing its name.")+"\n"+
_("To easily add stations to your list, use the following 2 tabs: Search and Import.")+"\n"+
_("Check its 'Menu' box to display a station or category in the menu.")+"\n"+
_("Check its '♪/➟' box to listen to the station or move it to another category using the tools below the list.");

let button_update_help_text = _("You can have your list of stations checked by internet databases.")+"\n"+
_("Any station recognized by one of these databases will receive a Universal Unique Identifier (UUID) provided by this database.")+"\n"+
_("So, if a streaming URL was changed, a next check would update it and you can continue to listen to the affected station.");

let search_help_text = _("Here you can search for other stations in a free radio database accessible via the Internet.")+"\n"+
_("Fill in at least a few fields of the form below then click on the 'Search ...' button.")+"\n"+
_("Each time this button is clicked, a new results page is displayed in the second part of this page, where you can test certain stations and include them in the menu.")+"\n"+
_("A station already in your menu will only appear in search results if its streaming URL has changed.")+"\n"+
_("When no new page appears, it means that all results matching your search criteria have been displayed.");

let import_help_text = _("You can import a file containing the name and streaming URL of at least one radio station.")+"\n"+
_("These radio stations are displayed in the list below. You can test them by checking their ♪ box.")+"\n"+
_("Then manage this list with the buttons at the bottom of this tab.");

let import_shoutcast_help_text = _("In the Shoutcast directory, click the download button to the left of the station name.")+"\n"+
_("Select the open format (.XSPF) and save the file giving it the same name as the station.")+"\n"+
_("This file can then be imported here.");

let limits_hd_space_left_label_text = _("%s bytes = %s GB = %s GiB");

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory ($ touch DEBUG)
 * Used by the log function above.
 */

function DEBUG() {
  let _debug = file_new_for_path(APPLET_DIR + "/DEBUG");
  return _debug.query_exists(null);
};

/**
 * RELOAD:
 * Returns whether or not the RELOAD file is present in this applet directory ($ touch RELOAD)
 * Used to show the 'Reload this applet' button in menu.
 */

function RELOAD() {
  let _reload = file_new_for_path(APPLET_DIR + "/RELOAD");
  return _reload.query_exists(null);
};

/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") to log the error message regardless of the DEBUG() return.
 */
function log(message, alwaysLog=false) {
  if (DEBUG() || alwaysLog) global.log("[" + UUID + "]: " + message);
}

function logDebug(message) {
    log(message, true);
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

function _get_lang() {
  if (getenv("LC_NUMERIC")) {
    return getenv("LC_NUMERIC").split(".")[0].replace("_", "-")
  } else if (getenv("LANG")) {
    return getenv("LANG").split(".")[0].replace("_", "-")
  } else if (getenv("LANGUAGE")) {
    return getenv("LANGUAGE").replace("_", "-")
  }
  return "en-US"
}

function formatNumber(value, decimals=1) {
  if (typeof(value) === "number") {
    if (_get_lang() === "C") return ""+value;

    return ""+new Intl.NumberFormat(
      _get_lang(),
      { minimumIntegerDigits: 1, minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    ).format(value);
  } else {
    return ""+value;
  }
}


function R3AppletSettings(xlet, uuid, instance_id) {
  this._init(xlet, uuid, instance_id);
}

R3AppletSettings.prototype = {
  __proto__: AppletSettings.prototype,

  /**
   * _init:
   * @xlet (Object): the object variables are binded to (usually `this`)
   * @uuid (string): uuid of the applet
   * @instanceId (int): instance id of the applet
   */
  _init: function (xlet, uuid, instanceId) {
    AppletSettings.prototype._init.call(this, xlet, uuid, instanceId);
    this.applet = xlet;
  },

  _are_equal: function(a, b) {
    if (a.length != b.length) return false;

    for (let key in a) {
      let a_obj = a[key][1];
      let b_obj = b[key][1];
      for (let k of Object.keys(a_obj)) {
        if (""+a_obj[k] != ""+b_obj[k]) return false;
      };
    }

    return true
  },

  _checkSettings: function() {
      let oldSettings = this.settingsData;
      try {
          this.settingsData = this._loadFromFile();
      } catch(e) {
          // looks like we're getting a premature signal from the file monitor
          // we should get another when the file is finished writing
          return;
      }

      var changed = false;
      var options_changed = false;
      for (let key in this.settingsData) {
          if (!this.settingsData[key]
              || this.settingsData[key].value === undefined
              || !oldSettings[key]
              || oldSettings[key].value === undefined) continue;

          let oldValue = oldSettings[key].value;
          let value = this.settingsData[key].value;

          var options_unchanged = true;
          if (this.settingsData[key].options != undefined) {
            let old_options = oldSettings[key].options;
            let old_items = Object.keys(old_options).map((k) => { return old_options[k] });

            let options = this.settingsData[key].options;
            let items = Object.keys(options).map((k) => { return options[k] });

            var items_to_add = [];
            Object.keys(options).map((k) => {
              if (old_items.indexOf(options[k]) < 0) items_to_add.push(""+options[k]);
            });
            var items_to_remove = [];
            Object.keys(old_options).map((k) => {
              if (items.indexOf(options[k]) < 0) items_to_remove.push(""+old_options[k]);
            });

            //options_unchanged = old_options != options;
            options_unchanged = (items_to_add.length === 0 && items_to_remove.length === 0);

            //if (key === "category-to-move" && !options_unchanged) {
              //global.log("old_items for %s: %s".format(key, old_items));
              //global.log("    items for %s: %s".format(key, items));
              //log("old_items: "+old_items, true);
              //log("items: "+items, true);
              //log("\nitems_to_add for %s: %s".format(key, items_to_add));
              //log("\nitems_to_remove for %s: %s".format(key, items_to_remove));
              //global.log("options_unchanged for %s: %s".format(key, options_unchanged));
            //}
          }

          // Note that value === oldValue is always 'false' when they are objects.
          if (value === oldValue && options_unchanged) continue;

          if (key === "radios") {
            let oldValueWithoutSave = Object.keys(oldValue).map((k) => {return [k, oldValue[k]]});
            oldValueWithoutSave.pop();
            let newValues = Object.keys(value).map((k) => {return [k, value[k]]});
            //log("\noldValueWithoutSave: "+oldValueWithoutSave, true);
            //log("\n             value :"+newValues, true);
            //if (Object.values(oldValueWithoutSave) != Object.values(newValues))
            if (!this._are_equal(oldValueWithoutSave, newValues)) {
              //log("\nradios have changed!!!\n");

              let old_category = this.getValue("category-to-move");
              let categories = {};
              categories["%s".format(_("(Undefined)"))] = "";
              for (let cat of this.applet.station_categories) {
                categories[""+cat] = ""+cat;
              }
              this.settingsData["category-to-move"].options = categories;
              let value_to_set;
              if (old_category.length !== 0 || categories.length === 1)
                value_to_set = "";
              else
                value_to_set = ""+this.applet.station_categories[0];
              this.settingsData["category-to-move"].value = value_to_set;

              let old_sched_radio = this.getValue("sched-radio");
              let sched_radios_options = {};
              sched_radios_options["%s".format(_("(Undefined)"))] = "";
              var items = Object.keys(value).map((k) => { return [value[k].name, value[k].url] });
              // Sort the items array based on the first element (the name)
              items.sort( (a, b) => { return a[0] > b[0] });
              for (let item of items)
                if (item[1] && item[1].length > 0) // Ignores categories
                  sched_radios_options[item[0]] = item[1];
              this.settingsData["sched-radio"].options = sched_radios_options;

              this.settingsData["sched-radio"].value = "";

              this._saveToFile();
              this.emit("changed", "category-to-move", old_category, "");
              this.emit("changed", "sched-radio", old_sched_radio, "");
            }
          }

          changed = true;
          if (key in this.bindings) {
              for (let info of this.bindings[key]) {
                  // if the property had a save function, it is gone now and we need to re-add it
                  if (info.isObject && !this.settingsData[key].value.save) {
                      this.settingsData[key].value.save = Lang.bind(this, this._saveToFile);
                  }

                  if (info.callback) info.callback(value);
              }
          }

          /**
           * SIGNAL: changed::'key'
           * @key (string): The settings key who's value changed
           * @oldValue: The value of the key before the setting changed
           * @newValue: The value of the key after the setting changed
           *
           * Emitted when the value of the setting changes
           */
          this.emit("changed::" + key, key, oldValue, value);
      }

      /**
       * SIGNAL: settings-changed
       *
       * Emitted when any of the settings changes
       */
      if (changed) {
          this.emit("settings-changed");
      }
  },

  setOptions: function (key, options) {
    if (!(key in this.settingsData)) {
      key_not_found_error(key, this.uuid);
      return;
    }

    if (!("options" in this.settingsData[key])) {
      options_not_supported_error(key, this.uuid, this.settingsData[key].type);
      return;
    }

    if (this.settingsData[key].options != options) {
      //log("options have changed!");
      this.settingsData[key].options = {}
      Object.keys(options).map((k) => {
        this.settingsData[key].options[k] = options[k];
      });
      this._saveToFile();
      let id = setTimeout( Lang.bind(this, () => {
        this._checkSettings();
        //this.emit('changed::'+this.settingsData[key].id, this.settingsData[key].id,  [this.settingsData[key].options]);
        clearTimeout(id);
      }), 300); // 300 ms

      //this._ensureSettingsFiles();
    }
  }
};

Signals.addSignalMethods(R3AppletSettings.prototype);


function RadioMessageTray() {
  this._init();
}

RadioMessageTray.prototype = {
  __proto__: MessageTray.prototype,
  _init: function() {
    MessageTray.prototype._init.call(this);
  },

  _showNotificationCompleted: function() {
    this._updateNotificationTimeout(0);

    if (this._notification.urgency != Urgency.CRITICAL) {
      this._updateNotificationTimeout(RADIO_NOTIFICATION_TIMEOUT * 1000);
    } else if (AppletManager.get_role_provider_exists(AppletManager.Roles.NOTIFICATIONS)) {
      this._updateNotificationTimeout(RADIO_NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET * 1000);
    }
  }
}
Signals.addSignalMethods(RadioMessageTray.prototype);

function RadioNotificationSource() {
  this._init();
}

RadioNotificationSource.prototype = {
  __proto__: SystemNotificationSource.prototype,
  _init: function() {
    SystemNotificationSource.prototype._init.call(this);
    this.notifications = [];
  },

  destroyAllNotifications: function() {
    if (this.notifications.length > 0) {
      for (let i = this.notifications.length - 1; i >= 0; i--) {
        try {
          this.notifications[i].destroy();
        } catch(e) {
          // Do nothing.
        }
      }
    }
    this.notifications = [];

    this._updateCount();
    //log("All notifications have been destroyed.");
  }
}



const messageTray = new RadioMessageTray();
const source = new RadioNotificationSource("Radio3.0");
messageTray.add(source);

//~ class R3Button {
    //~ constructor(icon, tooltip, callback, small = false) {
        //~ this.actor = new Bin();

        //~ this.button = new Button({
          //~ reactive: true,
          //~ can_focus: true,
          //~ style_class: "popup-menu-item",
          //~ style: "height:20px; width:20px; padding:10px!important"
        //~ });
        //~ this.button.connect('clicked', callback);

        //~ if (small)
            //~ this.button.add_style_pseudo_class("small");

        //~ this.icon = new Icon({
            //~ icon_type: IconType.SYMBOLIC,
            //~ icon_name: icon
        //~ });
        //~ this.button.set_child(this.icon);
        //~ this.actor.add_actor(this.button);

        //~ this.tooltip = new Tooltip(this.button, tooltip);
    //~ }

    //~ getActor() {
        //~ return this.actor;
    //~ }

    //~ setData(icon, tooltip) {
        //~ this.icon.icon_name = icon;
        //~ this.tooltip.set_text(tooltip);
    //~ }

    //~ setActive(status) {
        //~ this.button.change_style_pseudo_class("active", status);
    //~ }

    //~ setEnabled(status) {
        //~ this.button.change_style_pseudo_class("insensitive", !status);
        //~ this.button.can_focus = status;
        //~ this.button.reactive = status;
    //~ }

    //~ destroy() {
      //~ this.button.destroy();
      //~ this.actor.destroy();
    //~ }
//~ }

class R3WebpageMenuItem extends PopupBaseMenuItem {
  constructor(parent, score, params) {
    super(params);
    this.parent = parent;

    let boxIconLabel = new BoxLayout({ style: 'spacing: 1em;' });
    //~ logDebug("boxIconLabel: "+boxIconLabel);

    let web_icon = new Icon({ icon_name: 'web-browser', icon_type: IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    boxIconLabel.add_actor(web_icon);
    let label = new Label({ text: _("Radio3.0 web page...") });
    boxIconLabel.add_actor(label);
    this.addActor(boxIconLabel);

    let stars = new BoxLayout({ style: 'spacing: 0.25em;' });
    //~ logDebug("stars: "+stars);

    let star_icon = new Icon({ icon_name: 'starred', icon_type: IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    let star_count = new Label({ text: score.toString() });
    stars.add_actor(star_icon);
    stars.add_actor(star_count);
    this.addActor(stars);
  }

  activate() {
    spawnCommandLineAsync("bash -c 'xdg-open https://cinnamon-spices.linuxmint.com/applets/view/360'");
    super.activate();
  }

  destroy() {
    super.destroy();
  }
}

class TitleSeparatorMenuItem extends PopupBaseMenuItem {
  constructor(title, icon_name, reactive=false) {
    super({ reactive: reactive });
    if (typeof icon_name === 'string') {
      let icon = new Icon({ icon_name, icon_type: IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
      this.addActor(icon, { span: 0 });
    }
    this.label = new Label({ text: title, style_class: 'popup-subtitle-menu-item' });
    this.addActor(this.label);
  }
}

var RadioPopupSubMenuMenuItem = class RadioPopupSubMenuMenuItem extends PopupSubMenuMenuItem {
  _init(text, needScrollbar=true) {

    super._init.call(this);

    this.needScrollbar = needScrollbar;

    let icon_box = new BoxLayout({ style: 'spacing: .25em;' });
    //~ logDebug("icon_box: "+icon_box);

    let radio_icon = new Icon({ icon_name: 'audio-input-microphone', icon_type: IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    icon_box.add_actor(radio_icon);
    this.addActor(icon_box, { expand: false, span: 0, align: Align.START });

    this._triangle = null;

    // This check allows PopupSubMenu to be used as a generic scrollable container.
    if (typeof text === 'string') {
      this.actor.add_style_class_name('popup-submenu-menu-item');

      this.label = new Label({ text: text,
                                  y_expand: true,
                                  y_align: Clutter.ActorAlign.CENTER });
      this.addActor(this.label);
      this.actor.label_actor = this.label;

      this._triangleBin = new Bin({ x_align: Align.END });
      this.addActor(this._triangleBin, { expand: true,
                                         span: -1,
                                         align: Align.END });

      this._triangle = arrowIcon(Side.RIGHT);
      this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.5 });
      this._triangleBin.child = this._triangle;
    }

    this.menu = new PopupSubMenu(this.actor, this._triangle);
    this._signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
  }

  _needsScrollbar() {
    if (!this.needScrollbar) return false;

    let topMenu = this._getTopMenu();
    if(!topMenu)
        return false;
    let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
    let topThemeNode = topMenu.actor.get_theme_node();

    let topMaxHeight = topThemeNode.get_max_height();
    return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
  }
}

var StationsPopupSubMenuMenuItem = class StationsPopupSubMenuMenuItem extends PopupSubMenuMenuItem {
  _connectSubMenuSignals(object, menu) {
        /**
         * SIGNAL:activate
         * @menuItem (PopupBaseMenuItem): the item activated
         * @keepMenu (boolean): whether the menu should remain opened
         *
         * Emitted when an item of the menu is activated.
         */

        /**
         * SIGNAL:active-changed
         * @menuItem (PopupBaseMenuItem): the current active item (possibly null)
         *
         * Emitted when the active item of menu is changed.
         */

        this._signals.connect(menu, 'activate', (submenu, submenuItem, keepMenu) => {
            this.emit('activate', submenuItem, true); //keepMenu replaced with true
            //~ if (!keepMenu){
                //~ this.close(true);
            //~ }
        });
        this._signals.connect(menu, 'active-changed', (submenu, submenuItem) => {
            if (this._activeMenuItem && this._activeMenuItem != submenuItem)
                this._activeMenuItem.setActive(false);
            this._activeMenuItem = submenuItem;
            this.emit('active-changed', submenuItem);
        });
    }

    _connectItemSignals(menuItem) {
        this._signals.connect(menuItem, 'active-changed', (menuItem, active) => {
            if (active && this._activeMenuItem != menuItem) {
                if (this._activeMenuItem)
                    this._activeMenuItem.setActive(false);
                this._activeMenuItem = menuItem;
                this.emit('active-changed', menuItem);
            } else if (!active && this._activeMenuItem == menuItem) {
                this._activeMenuItem = null;
                this.emit('active-changed', null);
            }
        });
        this._signals.connect(menuItem, 'sensitive-changed', (menuItem, sensitive) => {
            if (!sensitive && this._activeMenuItem == menuItem) {
                if (!this.actor.navigate_focus(menuItem.actor,
                                               Gtk.DirectionType.TAB_FORWARD,
                                               true))
                    this.actor.grab_key_focus();
            } else if (sensitive && this._activeMenuItem == null) {
                if (global.stage.get_key_focus() == this.actor)
                    menuItem.actor.grab_key_focus();
            }
        });
        this._signals.connect(menuItem, 'activate', (menuItem, event, keepMenu) => {
            this.emit('activate', menuItem, true); //keepMenu replaced with true
            //~ if (!keepMenu){
                //~ this.close(true);
            //~ }
        });
        this._signals.connect(menuItem, 'destroy', (emitter) => {
            this._signals.disconnect('activate', menuItem);
            this._signals.disconnect('active-changed', menuItem);
            this._signals.disconnect('sensitive-changed', menuItem);
            if (menuItem.menu) {
                this._signals.disconnect('activate', menuItem.menu);
                this._signals.disconnect('active-changed', menuItem.menu);
                this._signals.disconnect('open-state-changed', this);
            }
            if (menuItem == this._activeMenuItem)
                this._activeMenuItem = null;
            this.length--;
        });
    }

    addMenuItem(menuItem, position) {
        let before_item = null;
        if (position == undefined) {
            this.box.add(menuItem.actor);
        } else {
            let items = this._getMenuItems();
            if (position < items.length) {
                before_item = items[position].actor;
                this.box.insert_child_below(menuItem.actor, before_item);
            } else
                this.box.add(menuItem.actor);
        }
        if (menuItem instanceof PopupMenuSection) {
            this._connectSubMenuSignals(menuItem, menuItem);
            this._signals.connect(menuItem, 'destroy', () => {
                this._signals.disconnect('activate', menuItem);
                this._signals.disconnect('active-changed', menuItem);

                this.length--;
            });
        } else if (menuItem instanceof PopupSubMenuMenuItem) {
            if (before_item == null)
                this.box.add(menuItem.menu.actor);
            else
                this.box.insert_child_below(menuItem.menu.actor, before_item);
            this._connectSubMenuSignals(menuItem, menuItem.menu);
            this._connectItemSignals(menuItem);
            this._signals.connect(this, 'open-state-changed', function(self, open) {
                //~ if (!open && menuItem.menu.isOpen) {
                    //~ if (this.animating) {
                        //~ menuItem.menu.closeAfterUnmap();
                    //~ } else {
                        //~ menuItem.menu.close(false);
                    //~ }
                //~ }
            }, this);
        } else if (menuItem instanceof PopupSeparatorMenuItem) {
            this._connectItemSignals(menuItem);

            // updateSeparatorVisibility needs to get called any time the
            // separator's adjacent siblings change visibility or position.
            // open-state-changed isn't exactly that, but doing it in more
            // precise ways would require a lot more bookkeeping.
            let updateSeparatorVisibility = this._updateSeparatorVisibility.bind(this, menuItem);
            this._signals.connect(this, 'open-state-changed', updateSeparatorVisibility);
        } else if (menuItem instanceof PopupBaseMenuItem)
            this._connectItemSignals(menuItem);
        else
            throw TypeError("Invalid argument to PopupMenuBase.addMenuItem()");

        this.length++;
    }

    toggle () {
      this.open()
    }

    close(animate) {

    }
}

class CategoriesStationsBox {
    constructor() {
        this.actor = new St.BoxLayout({ vertical: false });
        this.actor._delegate = this;
    }
}

/**
 * #R3PopupMenu:
 * @short_description: Applet left-click menu
 *
 * A popupmenu menu (left-click menu) to be used by an applet
 *
 * Inherits: PopupMenu.PopupMenu
 */
var R3PopupMenu = class R3PopupMenu extends PopupMenu {

  /**
   * _init:
   * @launcher (Applet.Applet): The applet that contains the context menu
   * @orientation (St.Side): The orientation of the applet
   *
   * Constructor function
   */
  _init(launcher, orientation) {
    super._init(launcher.actor, orientation);
    uiGroup.add_actor(this.actor);
    this.actor.hide();
    this.launcher = launcher;
    if (launcher instanceof Applet) {
      this.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged, launcher));
      launcher.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
    } else if (launcher._applet) {
      launcher._applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
    }
  }

  _onOrientationChanged(a, orientation) {
    this.setArrowSide(orientation);
  }

  _onOpenStateChanged(menu, open, sourceActor) {
    if (!sourceActor._applet_context_menu.isOpen)
      sourceActor.actor.change_style_pseudo_class("checked", open);
  }
}

class WebRadioReceiverAndRecorder extends TextIconApplet {
  constructor(orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.rec_folder = "file://" + RADIO30_MUSIC_DIR;

    this.radiosHash = {};

    // List of Databases:
    this.server_name = null;
    this.DB_SERVERS = [];
    if (file_test(DB_SERVERS_FILE, FileTest.IS_REGULAR)) {
      let [db_is_accessible, ] = file_get_contents(DB_SERVERS_FILE);

      if (db_is_accessible) {
        try {
          let json_servers = JSON.parse((to_string(file_get_contents(DB_SERVERS_FILE)[1])).trim());
          for (let s of json_servers) {
            this.DB_SERVERS.push(s["server"]);
          }
        } catch(e) {
          logError("Can't parse JSON file: "+DB_SERVERS_FILE+". Default values will be used.");
          this.DB_SERVERS = DEFAULT_DB_SERVERS;
        }
      }
    } else {
      logError(DB_SERVERS_FILE + ": this file does not exist yet. Default values will be used.");
      this.DB_SERVERS = DEFAULT_DB_SERVERS;
    }

    spawnCommandLineAsync("bash -c '%s/stop-mpv-else-recordings.sh'".format(SCRIPTS_DIR));
    spawnCommandLineAsync("bash -c '%s/create-db-server-list.sh'".format(SCRIPTS_DIR));

    file_set_contents(MPV_TITLE_FILE, "");
    // Ensure right permissions and structure:
    spawnCommandLineAsync("bash -c 'cd "+ SCRIPTS_DIR + " && chmod 755 *.sh *.py'");
    spawnCommandLineAsync("bash -c 'cd "+ SCRIPTS_DIR + " && chmod 700 *.lua'");

    if (!file_test(RADIO_LISTS_DIR, FileTest.EXISTS))
      mkdir_with_parents(RADIO_LISTS_DIR, 0o755);
    if (!file_test(JOBS_DIR, FileTest.EXISTS))
      mkdir_with_parents(JOBS_DIR, 0o755);
    if (!file_test(COVER_ART_DIR, FileTest.EXISTS))
      mkdir_with_parents(COVER_ART_DIR, 0o755);
    if (!file_test(SONG_ART_DIR, FileTest.EXISTS))
      mkdir_with_parents(SONG_ART_DIR, 0o755);
    spawnCommandLineAsync("bash -c 'cp -a "+ APPLET_DIR +"/stations/Radio3.0_*.json "+ RADIO_LISTS_DIR +"/'");
    if (!file_test(DOT_CONFIG_DIR +"/icon.svg", FileTest.EXISTS)) {
      spawnCommandLineAsync("bash -c 'cp -a "+ APPLET_ICON +" "+ DOT_CONFIG_DIR +"/'")
    }

    this.set_folders_icon();

    TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    if (this.setAllowedLayout) this.setAllowedLayout(AllowedLayout.BOTH);

    this.hideLabel();

    this.angle = 0;
    this.rot_interval = 0;
    this.do_rotation = false;

    // Clipboard:
    this.clipboard = Clipboard.get_default();

    // Window Tracker:
    this.tracker = WindowTracker.get_default();

    // User Country Code:
    this.user_countrycode = getenv("LANG").split(".")[0].split("_")[1];

    // Applet properties:
    this.orientation = orientation;
    this.isHorizontal = !(this.orientation == Side.LEFT || this.orientation == Side.RIGHT);
    this.instanceId = instance_id;
    this.hasMarkup = (this._applet_tooltip.set_markup) ? true : false;

    // yt-dlp updated?
    this.ytdlp_updated = false;

    // To get json data from radiodb:
    this.http = new HttpLib();

    // Progressive change of icon color starting a radio:
    this.progress = 0;
    this.interval = 0;

    // Old tooltip (to restore it quickly):
    this.oldTooltip = "";
    this.tooltip_updated = false;

    // Json string containing old registered radios:
    this.oldRadios = "{}";

    // Current song title:
    this.songTitle = "";

    // Scroll event signal connect Id:
    this.connectIdScroll = -1;
    // Enter event signal connect Id:
    this.connectIdEnter = -1;
    // Leave event signal connect Id:
    this.connectIdLeave = -1;

    // Current mpv status (may be STOP or PLAY):
    this.mpvStatus = "STOP";

    // Current radio Id (this is the URL of the stream):
    this.radioId = "";

    // Recording:
    this.record_pid = null;
    this.stopRecordingId = null;
    this.notifications_about_recordings = {};

    // YT downloads:
    this.yt_downloads = [];

    // Menu:
    this.menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.menuItems = [];
    this.currentMenuItem = null;
    //~ this.stopItem = new PopupMenuItem(_("Stop"));
    //~ this.stopItem.connect('activate', Lang.bind(this, this.stop_mpv));

    // Contextual menu:
    this.context_menu_item_slider = null;
    this.context_menu_yt_downloads = [];

    // User's settings:
    this.settings = new R3AppletSettings(this, UUID, this.instanceId);
    let userSettings = JSON.parse(to_string(file_get_contents(RADIO30_CONFIG_FILE)[1]));
    this.get_user_settings();
    this.set_MPV_ALIAS();

    this.on_rec_path_changed();

    this.tabNumberOfScheduling = 1*userSettings["layoutradio"]["pages"].indexOf("pageScheduling");
    this.tabNumberOfSearch = 1*userSettings["layoutradio"]["pages"].indexOf("pageSearch");
    this.tabNumberOfNetwork = 1*userSettings["layoutradio"]["pages"].indexOf("pageNetwork");
    this.tabNumberOfRecording = 1*userSettings["layoutradio"]["pages"].indexOf("pageRecording");
    this.tabNumberOfYT = 1*userSettings["layoutradio"]["pages"].indexOf("pageYT");
    userSettings = null;

    let nemo_size_prefixes = get_nemo_size_prefixes();
    if (nemo_size_prefixes !== this.settings.getValue("limits-hd-size-prefixes")) {
      this.settings.setValue("limits-hd-size-prefixes", nemo_size_prefixes)
    }
    this.check_hd_space_left();

    // Database:
    let favorite_options = { "Random": "random" };
    for (let _server of this.DB_SERVERS) {
      favorite_options[_server] = _server;
    }
    this.settings.setOptions("database-favorite", favorite_options);
    this.get_random_server_name();
    favorite_options = null;

    // Screensaver Inhibitor:
    this.screensaver_inhibitor = new ScreensaverInhibitor.ScreensaverInhibitor(this);

    // The hash table is useful to get the name of a radio knowing its Id.
    // (This must be made after getting the user's settings.)
    this.set_radio_hashtable();

    // Current stream (managed by the following MixerControl):
    this.stream = null;
    this.streamId = null;

    // MixerControl
    this._control = new Cvc.MixerControl({ name: "Radio Volume Control" });

    this._volumeMax = this._control.get_vol_max_norm();
    this._volumeNorm = this._control.get_vol_max_norm(); // Same as this._volumeMax.

    this._control.connect('stream-added', (...args) => this._onStreamAdded(...args));
    this._control.connect('stream-removed', (...args) => this._onStreamRemoved(...args));

    this._control.open();

    // Any shoutcast list management is now deactivated!
    //~ this._connectShoutcastId = null;
    //~ this.shoutcast = new Shoutcast();
    //~ this._connectShoutcastId = this.shoutcast.connect("shoutcast-options-available", () => this.renew_shoutcast_options());

    this.change_symbolic_icon();
    let _radios = this.settings.getValue("radios");
    if (_radios.length > 0)
      this.oldRadios = JSON.stringify(_radios);
    _radios = null;

    // Net monitor:
    this.netMonitor = null;
    this.netMonitorId = 0;

    // Song title monitor:
    this.titleMonitor = null;
    this.titleMonitorId = 0;

    // Scheduled Jobs monitor:
    this.jobsMonitor = null;
    this.jobsMonitorId = 0;

    // Recordings Directory monitor:
    this.recMonitor = null;
    this.recMonitorId = 0;

    // Run all monitors:
    this.on_network_monitoring_changed();
    this.monitor_mpv_title();
    this.monitor_jobs_dir();
    this.monitor_rec_folder();
    this.monitor_r30stop();
    this.monitor_r30next();
    this.monitor_r30previous();

    // Connect signals:
    this._connect_signals();

    // Shortcuts:
    this.onShortcutChanged();

    //title_obj.watch('prop', function(value){
      //this._on_mpv_title_changed();
      ////global.log('wow!',value);
    //});
  }

  get_user_settings() {
    this.settings.bind("show-volume-level-near-icon", "show_volume_level_near_icon", this.volume_near_icon.bind(this));
    this.settings.bind("dont-check-dependencies", "dont_check_dependencies");
    this.settings.bind("recentRadios", "recentRadios");
    this.settings.bind("volume-magnetic-on", "magnetic25On");
    this.settings.bind("volume-step", "volume_step");
    this.settings.bind("volume-at-startup", "volume_at_startup");
    this.settings.bind("volume-percentage", "percentage");

    this.settings.bind("show-title-and-version", "show_version");
    this.settings.bind("recent-number", "recent_number");
    this.settings.bind("show-system-items", "show_system_items");
    this.settings.bind("show-reload", "show_reload");
    this.settings.bind("show-bitrate", "show_bitrate", (...args) => this.set_show_bitrate(...args));
    this.settings.bind("show-codec", "show_codec");
    this.settings.bind("volume-show-osd-starting-radio","showOSDonStartup");
    this.settings.bind("volume-show-osd", "volume_show_osd");
    this.showOSD = this.volume_show_osd && this.showOSDonStartup;

    this.settings.bind("import-list", "import_list");
    this.settings.bind("import-dir", "import_dir");

    this.settings.bind("recording-path", "recording_path", this.on_rec_path_changed.bind(this));
    this.settings.bind("recording-format", "rec_format", this.set_MPV_ALIAS.bind(this));
    this.settings.bind("recording-ends-auto", "recording_ends_auto");

    this.settings.bind("limits-hd-size-prefixes", "size_prefixes", (...args) => set_nemo_size_prefixes(...args));

    this.settings.bind("last-radio-listened-to", "last_radio_listened_to");
    this.settings.bind("last-category", "last_category");
    this.settings.bind("switch-on-last-station-at-start-up", "switch_on_last_station_at_start_up",
      this.on_switch_on_last_station_at_start_up.bind(this));
    this.settings.bind("notif-station-change", "notif_station_change");
    this.settings.bind("notif-song-change", "notif_song_change");
    this.settings.bind("notif-buttons-allowed", "notif_buttons_allowed");
    this.settings.bind("radios", "radios");
    this.settings.bind("show-help-in-tooltip", "show_help_in_tooltip", this.updateUI.bind(this));

    // Shoutcast: Deactivated!
    //~ this.settings.bind("shoucast-categories", "shoucast_categories", this.on_shoutcast_categories_changed.bind(this));
    //~ this.settings.bind("shoutcast-radios", "shoutcast_radios");

    this.settings.bind("default-color", "defaultColor");
    this.settings.bind("color-on", "color_on", this.set_color.bind(this));
    this.settings.bind("color-off", "color_off", this.set_color.bind(this));
    this.settings.bind("color-recording", "color_recording", this.set_color.bind(this));
    this.settings.bind("show-favicon", "show_favicon",
      this.on_switch_show_favicon.bind(this));
    // Menu:
    this.settings.bind("show-by-category", "show_by_category");
    this.settings.bind("shortcut-volume-up", "shortcutVolUp", this.onShortcutChanged.bind(this));
    this.settings.bind("shortcut-volume-down", "shortcutVolDown", this.onShortcutChanged.bind(this));
    this.settings.bind("shortcut-volume-cut", "shortcutVolCut", this.onShortcutChanged.bind(this));
    this.settings.bind("shortcut-radio-on-off", "shortcutOnOff", this.onShortcutChanged.bind(this));
    this.settings.bind("shortcut-next-recent-radio", "shortcutNext", this.onShortcutChanged.bind(this));
    this.settings.bind("shortcut-previous-recent-radio", "shortcutPrevious", this.onShortcutChanged.bind(this));

    //Scheduling:
    this.settings.bind("sched-recordings", "sched_recordings");

    // Network:
    this.settings.bind("network-monitoring", "network_monitoring", this.on_network_monitoring_changed.bind(this));
    this.settings.bind("network-quality", "network_quality");
    this.settings.bind("database-url", "database_url");
    this.settings.bind("database-favorite", "database_favorite", this.on_database_favorite_changed.bind(this));
    // Cache:
    this.settings.bind("cache-no-cache", "cache_no_cache", this.set_MPV_ALIAS.bind(this));
    this.settings.bind("cache-stream-size", "cache_stream_size", this.set_MPV_ALIAS.bind(this));
    this.settings.bind("cache-mins", "cache_minutes", this.set_MPV_ALIAS.bind(this));
    this.settings.bind("cache-on-disk", "cache_on_disk", this.set_MPV_ALIAS.bind(this));
    this.settings.bind("cache-dir", "cache_dir", this.set_MPV_ALIAS.bind(this));

    // YT:
    this.settings.bind("yt-progress-interval", "yt_interval");
    this.settings.bind("yt-cookies-from", "cookies_from");

    // Score:
    this.settings.bind("score", "score");

    // Help TextViews:
    this.populate_help_textviews()
  }

  ensure_radio30_music_dir() {
    if (!file_test(RADIO30_MUSIC_DIR, FileTest.EXISTS)) {
      mkdir_with_parents(RADIO30_MUSIC_DIR, 0o755);
      this.set_folders_icon(true);
    }
  }

  volume_near_icon() {
    if (this.show_volume_level_near_icon) {
      this.set_applet_label(""+this.percentage+"%")
    } else {
      this.set_applet_label("")
    }

    if (this._applet_context_menu == null || this.context_menu_item_showVolumeNearIcon == null) return;

    let items = this._applet_context_menu._getMenuItems();
    let index = items.indexOf(this.context_menu_item_showVolumeNearIcon);

    if (index > -1 && this.context_menu_item_showVolumeNearIcon._switch.state != this.show_volume_level_near_icon) {
      this.context_menu_item_showVolumeNearIcon._switch.setToggleState(this.show_volume_level_near_icon);
    }
  }

  on_database_favorite_changed() {
    if (this.database_favorite !== "random") {
      //~ this.database_url = ""+this.database_favorite;

      let id_to = setTimeout( Lang.bind(this, () => {
        //~ var fav = ""+this.settings.getValue("database-favorite");
        //~ this.settings.setValue("database-url", ""+fav);
        //~ this.settings.getValue("database-url");
        this.settings.setValue("database-url", ""+this.settings.getValue("database-favorite"));
        //~ this.configureApplet(this.tabNumberOfNetwork);
        //~ this.settings.emit("settings-changed");
        this.get_random_server_name();
        clearTimeout(id_to);
      }), 1000);
    } else {
      this.get_random_server_name();
    }
    //~ this.get_random_server_name()
  }

  onShortcutChanged() {
    keybindingManager.addHotKey("shortcutVolUp", this.shortcutVolUp, (event) => {
      let step = this.volume_step;
      let percentage = this.percentage;
      this.percentage = Math.min(100, percentage + step);
      let value = this.percentage / 100;
      if (this.context_menu_item_slider != null) {
        this.context_menu_item_slider.slider._value = value;
        this.context_menu_item_slider.slider._slider.queue_repaint();
        this.context_menu_item_slider.slider.emit('value-changed', value);
      }
    });
    keybindingManager.addHotKey("shortcutVolDown", this.shortcutVolDown, (event) => {
      let step = this.volume_step;
      let percentage = this.percentage;
      this.percentage = Math.max(0, percentage - step);
      let value = this.percentage / 100;
      if (this.context_menu_item_slider != null) {
        this.context_menu_item_slider.slider._value = value;
        this.context_menu_item_slider.slider._slider.queue_repaint();
        this.context_menu_item_slider.slider.emit('value-changed', value);
      }
    });
    keybindingManager.addHotKey("shortcutVolCut", this.shortcutVolCut, (event) => {
      if (this.context_menu_item_slider != null) {
        let volume_at_startup = this.get_volume_at_startup();

        if (volume_at_startup <= 0) volume_at_startup = 50;

        let value = 0;
        let old_value = this.context_menu_item_slider.slider._value;

        if (old_value !== 0) this.old_percentage = Math.round(old_value * 100);
        else value = (this.old_percentage) ? this.old_percentage / 100 : volume_at_startup / 100;

        this.context_menu_item_slider.slider._value = value;
        this.context_menu_item_slider.slider._slider.queue_repaint();
        this.context_menu_item_slider.slider.emit('value-changed', value);
      }
    });
    keybindingManager.addHotKey("shortcutOnOff", this.shortcutOnOff, (event) => {
      this.on_applet_middle_clicked(event);
    });
    keybindingManager.addHotKey("shortcutNext", this.shortcutNext, (event) => {
      this.on_next_event(event);
    });
    keybindingManager.addHotKey("shortcutPrevious", this.shortcutPrevious, (event) => {
      this.on_previous_event(event);
    });

  }

  on_next_event(event) {
    spawnCommandLine("rm -f %s".format(R30NEXT));
    if (this.recentRadios.length < 2) return;
    let next_radio = this.recentRadios[this.recent_number - 1];
    this.stop_mpv_radio(false);
    this.start_mpv_radio(next_radio);
  }

  on_previous_event(event) {
    spawnCommandLine("rm -f %s".format(R30PREVIOUS));
    if (this.recentRadios.length < 2) return;
    let prev_radio = this.recentRadios[1];
    this.stop_mpv_radio(false);
    this.start_mpv_radio(prev_radio);
  }

  on_rec_path_changed() {
    //~ log("on_rec_path_changed");
    let recording_path = this.settings.getValue("recording-path");
    if (  recording_path.length !== 0 &&
          recording_path !== "file://"+RADIO30_MUSIC_DIR) {
      RADIO30_MUSIC_DIR = recording_path.slice("file://".length, recording_path.length);
    }
    this.rec_folder = "file://" + RADIO30_MUSIC_DIR;
    this.recording_path = ""+this.rec_folder;
    this.ensure_radio30_music_dir();
    //~ log("RADIO30_MUSIC_DIR: "+RADIO30_MUSIC_DIR);
    //~ log("this.rec_folder: "+this.rec_folder);
  }

  set_rec_path_to_default() {
    RADIO30_MUSIC_DIR = DEFAULT_RADIO30_MUSIC_DIR;
    this.rec_folder = "file://" + RADIO30_MUSIC_DIR;
    this.recording_path = ""+this.rec_folder;
  }

  id2str(id) {
    let idarray = Array.from(id);
    var idstr = "";
    for (let ch of idarray) {
      if (validChars.indexOf(ch) >= 0) idstr += ch
    }
    return idstr;
  }

  /**
   * set_applet_icon_path:
   * @icon_path (string): path of the icon
   *
   * Sets the icon of the applet to the image file at @icon_path
   *
   * The icon will be full color
   */
  set_applet_icon_path (icon_path) {
    this._ensureIcon();

    try {
      let file = file_new_for_path(icon_path);
      this._applet_icon.set_gicon(new FileIcon({ file: file }));
      this._applet_icon.set_icon_type(IconType.FULLCOLOR);
      this._setStyle();
    } catch (e) {
      // global.log(e);
    }
  }

  /**
   * set_applet_icon_symbolic_path:
   * @icon_path (string): path of the icon
   *
   * Sets the icon of the applet to the image file at @icon_path
   *
   * The icon will be symbolic
   */
  set_applet_icon_symbolic_path(icon_path) {
    this._ensureIcon();

    try {
      let file = file_new_for_path(icon_path);
      this._applet_icon.set_gicon(new FileIcon({ file: file }));
      this._applet_icon.set_icon_type(IconType.SYMBOLIC);
      this._setStyle();
    } catch (e) {
      // global.log(e);
    }
  }

  set_applet_icon_from_url(url="") {
    let name = this.id2str(this.get_radio_name(this.radioId));
    this.change_symbolic_icon();
    let png_path = COVER_ART_DIR+"/%s.png".format(name);
    if (file_test(png_path, FileTest.EXISTS)) {
      try {
        this.set_applet_icon_path(png_path);
      } catch (e) {
        // Nothing to do.
      }
      return
    }
    if (!url || url.length === 0) {
      return
    }
    let command = SCRIPTS_DIR+'/download-favicon.sh "'+url+'" "'+name+'.png"';
    let subProcess = spawnCommandLineAsyncIO(command, Lang.bind(this, (out, err, exitCode) => {
      if (exitCode === 0) {
        this.set_applet_icon_path(png_path);
      }
      subProcess.send_signal(9);
    }));
  }

  async set_folders_icon(force=false) {
    let path_to_icon = DOT_CONFIG_DIR + "/icon.svg";
    let icon_attr = "metadata::custom-icon";

    if (file_test(path_to_icon, FileTest.EXISTS)) {
      path_to_icon = "file://"+path_to_icon;
    }
    else {
      path_to_icon = "folder-music";
      icon_attr += "-name";
    }

    try {
      let config_dir = file_new_for_path(DOT_CONFIG_DIR);
      // Remove old attributes:
      config_dir.set_attribute_string('metadata::custom-icon', "", 0, null);
      config_dir.set_attribute_string('metadata::custom-icon-name', "", 0, null);
      // Set the right attribute:
      config_dir.set_attribute_string(icon_attr, path_to_icon, 0, null);

      if (force || (this.recording_path && this.recording_path.length > 0)) {
        let radio30_music_dir = file_new_for_path(RADIO30_MUSIC_DIR);
        // Remove old attributes:
        radio30_music_dir.set_attribute_string('metadata::custom-icon', "", 0, null);
        radio30_music_dir.set_attribute_string('metadata::custom-icon-name', "", 0, null);
        // Set the right attribute:
        radio30_music_dir.set_attribute_string(icon_attr, path_to_icon, 0, null);
      }
    } catch(e) {
      logError(e)
    }
  }

  set_MPV_ALIAS() {
    //log("set_MPV_ALIAS");
    this.MPV_ALIAS = MPV_PROGRAM() + " --no-resume-playback --no-stop-screensaver --script=%s --no-terminal --no-video --metadata-codepage=auto --input-ipc-server=%s".format(MPV_LUA_SCRIPT, MPV_SOCKET); //--reset-on-next-file=all
    let proxy = ""+this.settings.getValue("http-proxy");
    proxy = proxy.trim();
    if (proxy.length > 0 && proxy.startsWith("http://"))
      this.MPV_ALIAS += " --http-proxy="+proxy;
    let no_cache = this.cache_no_cache;
    let cache_secs = (this.cache_minutes == 0) ? 3600000 : 60*this.cache_minutes;
    if (no_cache)
      this.MPV_ALIAS += " --no-cache"
    else {
      let stream_size = this.cache_stream_size;
      if (stream_size.length == 1 && !this.cache_on_disk) // "0" value
        this.MPV_ALIAS += " --cache=auto";
      else {
        this.MPV_ALIAS += " --cache=yes";
        this.MPV_ALIAS += " --stream-buffer-size="+stream_size;
        if (this.cache_on_disk) {
          this.MPV_ALIAS += " --cache-on-disk=yes --cache-unlink-files=immediate"; //whendone
          this.MPV_ALIAS += " --cache-secs=" + cache_secs;
          let cache_dir = this.cache_dir.replace("file://", "");
          this.MPV_ALIAS += " --cache-dir=" + cache_dir;
          this.MPV_ALIAS += " --stream-record=" + cache_dir + "/stream_record."+this.rec_format;
        } else {
          this.MPV_ALIAS += " --cache-on-disk=no";
        }
      }
    }
  }

  get_notifwbuttons_timeout() {
    //log("get_notifwbuttons_timeout");
    return 1*this.settings.getValue("notif-song-duration")
  }

  get_volume_step() {
    //log("get_volume_step");
    return this.volume_step;
  }

  get_volume_at_startup() {
    //log("get_volume_at_startup");
    let vol = this.settings.getValue("volume-at-startup");
    if (vol === -1) vol = this.settings.getValue("volume-percentage");
    return vol
  }

  get_recording_ends_auto() {
    //log("get_recording_ends_auto");
    return this.settings.getValue("recording-ends-auto")
  }

  get_mpv_pid() {
    //log("get_mpv_pid");
    if (file_test(MPV_PID_FILE, FileTest.EXISTS)) {
      return to_string(file_get_contents(MPV_PID_FILE)[1]);
    }

    return null;
  }

  get_mpv_title() {
    //log("get_mpv_title");
    if (file_test(MPV_TITLE_FILE, FileTest.EXISTS)) {
      return (to_string(file_get_contents(MPV_TITLE_FILE)[1])).trim();
    }

    return "";
  }

  set_show_bitrate() {
    //this.get_mpv_bitrate();
    this.set_radio_tooltip_to_default_one();
  }

  on_progress_change() {
    //log("on_progress_change");
    if (this.progress > 0 && this.progress < 100) {
      let reg = new RegExp(`rgb[(]([0-9]+),([0-9]+),([0-9]+)[)]`);
      let color = "%s".format(this.settings.getValue("color-on"));
      let [, red, green, blue] = reg.exec(color);
      let alpha_value = Math.ceil(2.55 * this.progress);
      let alpha = ""+alpha_value;
      this.actor.style = "color: rgba(%s,%s,%s,%s)".format(red, green, blue, alpha);

      this.actor.set_opacity(alpha_value);

      this.progress = this.progress + 10.0/REFRESH_INTERVAL;
    } else {
      this.progress = 0;
      clearInterval(this.interval);
      this.interval = 0;
      this.actor.set_opacity(255);
      this.set_color();
    }
    this.actor.queue_relayout();
  }

  set_radio_hashtable() {
    //log("set_radio_hashtable", true);
    //if (this.radiosHash == null || this.radiosHash == undefined)
    this.radiosHash = {};

    let radios = this.settings.getValue("radios");

    for (let station of radios) {
      if (station.name == undefined || station.url == undefined || station.inc == undefined)
        continue;
      if (station.url.length > 0 && station.url != "null") {
        this.radiosHash[""+station.url] = {
          "inc": station.inc,
          "name": ""+station.name,
          "bitrate": ""+station.bitrate,
          "codec": ""+station.codec,
          "uuid": station.uuid,
          "homepage": station.homepage,
          "tags": station.tags,
          "favicon": station.favicon ? station.favicon : "",
          "author_title_swap": station.author_title_swap == undefined ? false : station.author_title_swap
        };
      }
    }

    for (let id of this.recentRadios)
      if (!this.radiosHash[""+id])
        this.search_name_by_url_on_RDB(""+id);
  }

  monitor_interfaces() {
    if (!this.network_monitoring) {
      //log("MONITOR INTERFACES: Refused!");
      return;
    }

    if (this.netMonitor != null) {
      //log("MONITOR INTERFACES: Useless!");
      return;
    }
    //log("MONITOR INTERFACES");

    try {
      this.netMonitor = network_monitor_get_default();
      this.netMonitorId = this.netMonitor.connect('network-changed',
                                                  //(monitor, network_available) => this.on_network_changed()
                                                  Lang.bind(this, (monitor, network_available) => this.on_network_changed(monitor, network_available))
                                                  );
    } catch(e) {
      logError("Unable to monitor the network interfaces!", e)
    }
  } // End of monitor_interfaces

  unmonitor_interfaces() {
    if (this.netMonitor == null) {
      //log("UNMONITOR INTERFACES: Useless!");
      return;
    }
    //log("UNMONITOR INTERFACES");

    try {
      if (this.netMonitorId > 0) {
        this.netMonitor.disconnect(this.netMonitorId);
        this.netMonitor = null;
        this.netMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor the network interfaces!", e)
    }
  } // End of unmonitor_interfaces

  on_network_changed(monitor, network_available) {
    //log("on_network_changed");
    if (this.last_radio_listened_to.length === 0 || this.netMonitor == null) return;

    //let monitor = this.netMonitor;
    //let network_available = monitor.get_network_available();
    let connectivity = monitor.get_connectivity();

    if (this.mpvStatus === "PLAY") {
      if (network_available && (connectivity === NetworkConnectivity.FULL)) {
        let songTitle = this.songTitle;
        this.stop_mpv_radio(false);
        this.songTitle = songTitle;
        let idtemp = setTimeout (Lang.bind(this, () => {
          this.start_mpv_radio(this.last_radio_listened_to);
          clearTimeout(idtemp);
        }), (this.network_quality === "high") ? 5000 : 12000); // 5 or 12 seconds
      } else {
        this.stop_mpv_radio();
      }
      this.make_menu();
      this.updateUI();
    }
  } // End of on_network_changed

  monitor_mpv_title() {
    //log("monitor_mpv_title");
    if (this.titleMonitor != null) return;

    let file = file_new_for_path(MPV_TITLE_FILE);

    if (file.query_exists(null)) {
      try {
        this.titleMonitor = file.monitor_file(0, null);
        //this.titleMonitor.set_rate_limit(300); // 300 ms (default value: 800)

        this.titleMonitorId = this.titleMonitor.connect('changed', Lang.bind(this, this._on_mpv_title_changed));

      } catch(e) {
        logError("Unable to monitor %s!".format(MPV_TITLE_FILE), e)
      }
    }
  }

  monitor_r30stop() {
    if (this.r30stopMonitor != null) return;

    let file = file_new_for_path(R30STOP);

    //if (file.query_exists(null)) {
      try {
        this.r30stopMonitor = file.monitor_file(FileMonitorFlags.WATCH_MOVES, null);
        //this.r30stopMonitor.set_rate_limit(300); // 300 ms (default value: 800)

        this.r30stopMonitorId = this.r30stopMonitor.connect('changed', Lang.bind(this, this._on_r30stop_changed));

      } catch(e) {
        logError("Unable to monitor %s!".format(R30STOP), e)
      }
    //}
  }

  monitor_r30next() {
    if (this.r30nextMonitor != null) return;

    let file = file_new_for_path(R30NEXT);

    //if (file.query_exists(null)) {
      try {
        this.r30nextMonitor = file.monitor_file(FileMonitorFlags.WATCH_MOVES, null);
        //this.r30nextMonitor.set_rate_limit(300); // 300 ms (default value: 800)

        this.r30nextMonitorId = this.r30nextMonitor.connect('changed', Lang.bind(this, this.on_next_event));

      } catch(e) {
        logError("Unable to monitor %s!".format(R30NEXT), e)
      }
    //}
  }

  monitor_r30previous() {
    if (this.r30previousMonitor != null) return;

    let file = file_new_for_path(R30PREVIOUS);

    //if (file.query_exists(null)) {
      try {
        this.r30previousMonitor = file.monitor_file(FileMonitorFlags.WATCH_MOVES, null);
        //this.r30previousMonitor.set_rate_limit(300); // 300 ms (default value: 800)

        this.r30previousMonitorId = this.r30previousMonitor.connect('changed', Lang.bind(this, this.on_previous_event));

      } catch(e) {
        logError("Unable to monitor %s!".format(R30PREVIOUS), e)
      }
    //}
  }

  unmonitor_mpv_title() {
    //log("unmonitor_mpv_title");
    if (this.titleMonitor == null) return;

    try {
      if (this.titleMonitorId > 0) {
        //this.titleMonitor.cancel();
        this.titleMonitor.disconnect(this.titleMonitorId);
        this.titleMonitor = null;
        this.titleMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(MPV_TITLE_FILE), e)
    }
  }

  unmonitor_r30stop() {
    if (this.r30stopMonitor == null) return;

    try {
      if (this.r30stopMonitorId > 0) {
        //this.r30stopMonitor.cancel();
        this.r30stopMonitor.disconnect(this.r30stopMonitorId);
        this.r30stopMonitor = null;
        this.r30stopMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(R30STOP), e)
    }
  }

  unmonitor_r30previous() {
    if (this.r30previousMonitor == null) return;

    try {
      if (this.r30previousMonitorId > 0) {
        //this.r30previousMonitor.cancel();
        this.r30previousMonitor.disconnect(this.r30previousMonitorId);
        this.r30previousMonitor = null;
        this.r30previousMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(R30PREVIOUS), e)
    }
  }

  unmonitor_r30next() {
    if (this.r30nextMonitor == null) return;

    try {
      if (this.r30nextMonitorId > 0) {
        //this.r30nextMonitor.cancel();
        this.r30nextMonitor.disconnect(this.r30nextMonitorId);
        this.r30nextMonitor = null;
        this.r30nextMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(R30NEXT), e)
    }
  }

  _on_r30stop_changed() {
    let file = file_new_for_path(R30STOP);
    if (file.query_exists(null)) {
      this.stop_mpv();
    }
  }

  _on_mpv_title_changed() {
    //log("_on_mpv_title_changed: " + MPV_TITLE_FILE);

    let title = to_string(file_get_contents(MPV_TITLE_FILE)[1]).trim();
    //let title = title_obj.prop;

    if (title.length === 0 || (title.length > 0 && this.songTitle == title)) return;

    if (title.includes("xml")) {
      let xml_string = title.replace(/>\s*</g, "><"); // deletes all useless spaces.
      try {
        xml_string = HtmlEncodeDecode.decode(xml_string);
        let json_data = xml2json(xml_string);
        if (json_data ["ZettaLite"]) {
          let json_title = ""+json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Title"];
          let json_artist = ""+json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Artist1"];
          if (!json_title) json_title = "";
          if (!json_artist) json_artist = "";
          if (json_title && json_artist)
            title = capitalize_each_word(json_artist) + " - " + capitalize_each_word(json_title);
          else if(json_title)
            title = capitalize_each_word(json_title);
          else if(json_artist)
            title = capitalize_each_word(json_artist);
          else
            title = "";
        } else
          title = "";
      } catch(e) {
        title = "";
        //~ logError("XML error: "+e);
      }
    }

    //this.get_mpv_bitrate();

    this.on_song_changed(this.get_radio_name(this.radioId), title);
  }

  monitor_rec_folder() {
    if (this.recMonitor != null || this.recMonitorId > 0) return;

    let file = file_new_for_path(RADIO30_MUSIC_DIR);

    if (file.query_exists(null)) {
      try {
        this.recMonitor = file.monitor_directory(8, null);
        this.recMonitorId = this.recMonitor.connect('changed', Lang.bind(this, () => this._on_rec_folder_changed()));
      } catch(e) {
        logError("Unable to monitor %s!".format(RADIO30_MUSIC_DIR), e)
      }
    }
  }

  unmonitor_rec_folder() {
    if (this.recMonitor == null) return;

    try {
      if (this.recMonitorId > 0) {
        //this.recMonitor.cancel();
        this.recMonitor.disconnect(this.recMonitorId);
        this.recMonitor = null;
        this.recMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(RADIO30_MUSIC_DIR), e)
    }
  }

  _on_rec_folder_changed() {
    let now = Math.ceil(Date.now() / 1000); // now in seconds.
    if (this.future_check_date <= now) {
      this.check_hd_space_left()
    }
  }

  monitor_jobs_dir() {
    //log("monitor_jobs_dir");
    if (this.jobsMonitor != null || this.jobsMonitorId > 0) return;

    let file = file_new_for_path(JOBS_DIR);

    if (file.query_exists(null)) {
      try {
        //this.jobsMonitor = file.monitor_directory(0, null);
        this.jobsMonitor = file.monitor_directory(0, null);
        //this.jobsMonitor.set_rate_limit(300); // 300 ms (default value: 800)
        this.jobsMonitorId = this.jobsMonitor.connect('changed', Lang.bind(this, this._on_jobs_dir_changed));
      } catch(e) {
        logError("Unable to monitor %s!".format(JOBS_DIR), e)
      }
    }
  }

  unmonitor_jobs_dir() {
    //log("unmonitor_jobs_dir");
    if (this.jobsMonitor == null) return;

    try {
      if (this.jobsMonitorId > 0) {
        //this.jobsMonitor.cancel();
        this.jobsMonitor.disconnect(this.jobsMonitorId);
        this.jobsMonitor = null;
        this.jobsMonitorId = 0;
      }
    } catch(e) {
      logError("Unable to unmonitor %s!".format(JOBS_DIR), e)
    }
  }

  _on_jobs_dir_changed() {
    //log("_on_jobs_dir_changed: " + JOBS_DIR);

    let dir = file_new_for_path(JOBS_DIR);
    if (dir.query_exists(null)) {
        let children = dir.enumerate_children("standard::name,standard::type,time::modified", FileQueryInfoFlags.NONE, null);
        let info, file_type;
        var name;
        var json_files = [];
        var pid_files = [];

        while ((info = children.next_file(null)) != null) {
          file_type = info.get_file_type();
          if (file_type === FileType.REGULAR) {
            name = ""+info.get_name();

            if (name.endsWith(".json")) {
              json_files.push([name, info.get_modification_time().tv_sec])
            }

            if (name.startsWith("pid_") && pid_files.indexOf(name) < 0) {
              pid_files.push(name)
            }
          }
        }

        if (json_files.length > 1)
          json_files = json_files.sort((a,b) => this._compare(a,b));

        children.close(null);
    }

    var scheduled_recordings = [];

    this.highlight(false);
    let highlight_while_background_recording = this.settings.getValue("highlight-icon-while-background-recording");

    for (let file of json_files) {
      let path = JOBS_DIR + "/" + file[0];
      let fileName = ""+file; // Ex: desc_20201228115700_20201228115900_cdc839c0-82b0-4556-b08e-2c647b0cd4c2.json
      let _uuid = fileName.slice(35).split(".")[0];
      let inProgress = pid_files.indexOf("pid_" + _uuid) > -1;

      if (highlight_while_background_recording)
        this.highlight(inProgress);

      let contents = JSON.parse(to_string(file_get_contents(path)[1]));

      scheduled_recordings.push({
        "inprogress": inProgress,
        "action": ""+_("Start"),
        "date": ""+this._simplify_datetime(contents.begin),
        "station": ""+contents.name,
        "uuid": ""+_uuid
      });

      scheduled_recordings.push({
        "inprogress": false,
        "action": ""+_("Stop"),
        "date": ""+this._simplify_datetime(contents.end),
        "station": ""+contents.name,
        "uuid": ""+_uuid
      })
    }

    this.sched_recordings = scheduled_recordings
  }

  _compare(a,b) {
    if (a[1] < b[1])
      return -1;
    return 1;
  }

  _simplify_datetime(datetimestring) {
    let now = DateTime.new_now_local();
    let timezone = now.get_timezone();
    let dt = DateTime.new_from_iso8601(datetimestring, timezone);
    let zeroh = DateTime.new_from_iso8601(now.format("%F") + " 00:00:00", timezone);
    let difference = Math.ceil(dt.difference(zeroh)/1000000); // DateTime.difference() returns µs.

    if (difference >= 0 && difference < 86400)
      return dt.format("%R");
    return dt.format("%x %R");
  }

  set_color() {
    if (this.interval != 0) return;
    if (this.mpvStatus === "PLAY") {
      if (this.record_pid == null)
        this.actor.style = "color: %s".format(this.settings.getValue("color-on"));
      else
        this.actor.style = "color: %s".format(this.settings.getValue("color-recording"));
    } else {
      this.actor.style = "color: %s;".format(this.settings.getValue("color-off"));
    }
  }

  change_symbolic_icon(name='webradioreceiver') {
    this.do_rotation = (name === 'animated');
    this.set_applet_icon_symbolic_name(name);
    this.set_color();
  }

  get_radio_name(id) {
    var name = "";

    if (this.radiosHash != null && this.radiosHash[""+id] != null) { // && this.radiosHash[""+id].inc == true) {
      return "" + this.radiosHash[""+id].name;
    } else {
      let radios = this.settings.getValue("radios");
      for (let i = 0, _length = radios.length; i < _length; i++) {
        if ((id == radios[i].url) && (radios[i].inc)) {
          name = "" + radios[i].name;
          break;
        }
      }
      radios = null;
    }

    if (name.length === 0) {
      // Search on Radio Database
      let prom = this.search_name_by_url_on_RDB(id).then( Lang.bind(this, (result) => {
        let id_to = setTimeout( () => {
          this.settings.setValue("name_found", ""+result);
          clearTimeout(id_to)
        }, 800);
      })).catch(e => logError(e));
      name = this.settings.getValue("name_found");
    }

    return name;
  }

  get_radio_favicon(id) {
    let radios = this.settings.getValue("radios");

    var favicon = "";

    if (this.radiosHash && this.radiosHash[""+id] != null && this.radiosHash[""+id].inc == true) {
      return "" + this.radiosHash[""+id].favicon;
    } else {
      for (let i = 0, _length = radios.length; i < _length; i++) {
        if ((id == radios[i].url) && (radios[i].inc)) {
          favicon = "" + radios[i].favicon;
          break;
        }
      }
    }

    if (favicon.length === 0) {
      // Search on Radio Database
      // FIXME!
      //this.search_favicon_by_url_on_RDB(id);
    }

    radios = null;
    return favicon;
  }

  get_radio_homepage(id) {
    let radios = this.settings.getValue("radios");

    var homepage = "";

    if (this.radiosHash && this.radiosHash[""+id] != null && this.radiosHash[""+id].inc == true) {
      return "" + this.radiosHash[""+id].homepage;
    } else {
      for (let i = 0, _length = radios.length; i < _length; i++) {
        if ((id == radios[i].url) && (radios[i].inc)) {
          homepage = "" + radios[i].homepage;
          break;
        }
      }
    }

    //if (homepage.length === 0) {
      // Search on Radio Database
      // FIXME!
      //this.search_homepage_by_url_on_RDB(id);
    //}

    radios = null;
    return homepage;
  }

  async search_name_by_url_on_RDB(station_url) {
    var name = await this.searchFetch("url=" + station_url, "byurl").then(Lang.bind(this, (resultJson) => { // Do not use encodeURIComponent()!
      if (resultJson.length > 0) {
        let r = resultJson[0];
        this.radiosHash[""+station_url] = {
          // Name given by the user must have precedence:
          "name": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].name != undefined) ? this.radiosHash[""+station_url].name : ""+r.name,
          "inc": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].inc != undefined) ? this.radiosHash[""+station_url].inc : true,
          "codec": r.codec,
          "bitrate": r.bitrate,
          "homepage": r.homepage,
          "uuid": r.stationuuid,
          "tags": `${r.tags}`,
          "favicon": r.favicon ? r.favicon : "",
          "author_title_swap": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].author_title_swap != undefined) ? this.radiosHash[""+station_url].author_title_swap : false
        };
        return r.name;
      }
    })).catch(e => logError(e));
    return name;
  }

  async search_uuid_by_url_on_RDB(station_url) {
    var uuid = await this.searchFetch("url=" + station_url, "byurl").then(Lang.bind(this, (resultJson) => { // Do not use encodeURIComponent()!
      if (resultJson.length > 0) {
        let r = resultJson[0];
        this.radiosHash[""+station_url] = {
          // Name given by the user must have precedence:
          "name": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].name != undefined) ? this.radiosHash[""+station_url].name : ""+r.name,
          "inc": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].inc != undefined) ? this.radiosHash[""+station_url].inc : true,
          "codec": (!r.codec) ? "" : ""+r.codec,
          "bitrate": (!r.bitrate) ? "" : ""+r.bitrate,
          "homepage": (!r.homepage) ? "" : ""+r.homepage,
          "uuid": (!r.stationuuid) ? "" : ""+r.stationuuid,
          "tags": (!r.tags) ? "" : ""+r.tags, // `${r.tags}`
          "favicon": r.favicon ? r.favicon : "",
          "author_title_swap": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].author_title_swap != undefined) ? this.radiosHash[""+station_url].author_title_swap : false
        };
        return r.stationuuid;
      }
    })).catch(e => logError(e));
    return uuid;
  }

  async search_url_by_uuid_on_RDB(station_uuid, old_url=null) {
    var url = await this.searchFetch("uuids=" + station_uuid, "byuuid").then(Lang.bind(this, (resultJson) => { // Do not use encodeURIComponent()!
      if (resultJson.length > 0) {
        let r = resultJson[0];

        // If r.url is different than old_url,
        // then change directly the url in radios
        // (at the right place) and update radiosHash.
        if (old_url != null && r.url != old_url) {
          let stations = this.settings.getValue("radios");
          var new_stations = [];
          for (let station of stations) {
            if (station.url === old_url) station.url = ""+r.url;
            new_stations.push(station);
          }
          this.settings.setValue("radios", new_stations);
          this.radiosHash[""+r.url] = {
            // Name given by the user must have precedence:
          "name": (this.radiosHash[""+old_url] != undefined && this.radiosHash[""+old_url].name != undefined) ? this.radiosHash[""+old_url].name : ""+r.name,
          "inc": (this.radiosHash[""+old_url] != undefined && this.radiosHash[""+old_url].inc != undefined) ? this.radiosHash[""+old_url].inc : true,
          "codec": (!r.codec) ? "" : ""+r.codec,
          "bitrate": (!r.bitrate) ? "" : ""+r.bitrate,
          "homepage": (!r.homepage) ? "" : ""+r.homepage,
          "uuid": (!r.stationuuid) ? "" : ""+r.stationuuid,
          "tags": (!r.tags) ? "" : ""+r.tags, // `${r.tags}`
          "favicon": r.favicon ? r.favicon : "",
          "author_title_swap": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].author_title_swap != undefined) ? this.radiosHash[""+station_url].author_title_swap : false
          }
          try {
            delete this.radiosHash[""+old_url];
          } catch(e) {logError(e)}
        } else {
          this.radiosHash[""+r.url] = {
            // Name given by the user must have precedence:
            "name": (this.radiosHash[""+r.url] != undefined && this.radiosHash[""+r.url].name != undefined) ? this.radiosHash[""+r.url].name : ""+r.name,
            "inc": (this.radiosHash[""+r.url] != undefined && this.radiosHash[""+r.url].inc != undefined) ? this.radiosHash[""+r.url].inc : true,
            "codec": (!r.codec) ? "" : ""+r.codec,
            "bitrate": (!r.bitrate) ? "" : ""+r.bitrate,
            "homepage": (!r.homepage) ? "" : ""+r.homepage,
            "uuid": (!r.stationuuid) ? "" : ""+r.stationuuid,
            "tags": (!r.tags) ? "" : ""+r.tags, // `${r.tags}`
            "favicon": r.favicon ? r.favicon : "",
            "author_title_swap": (this.radiosHash[""+station_url] != undefined && this.radiosHash[""+station_url].author_title_swap != undefined) ? this.radiosHash[""+station_url].author_title_swap : false
          };
        }
        return r.url;
      }
    })).catch(e => logError(e));
    return url;
  }

  in_bold(str) {
    if (this.hasMarkup) {
      return "<b>" + str + "</b>";
    }
    return str;
  }

  set_radio_tooltip(new_tooltip) {
    //log("set_radio_tooltip");

    let tooltip = "" + new_tooltip;
    if (this.record_pid != null)
      tooltip = tooltip + "\n<i>" + _("Middle-Click: Stop Recording") + "</i>";

    if (this.oldTooltip === tooltip) {
      return;
    }

    if (this.hasMarkup)
      this.set_applet_tooltip(this._clean_str(tooltip), true);
    else
      this.set_applet_tooltip(tooltip);

    this.oldTooltip = "" + new_tooltip;
  }

  change_volume_in_radio_tooltip() {
    var title = "" + this.songTitle;
    title = title.replace(/\"/g, "");

    if (this.radioNameBolded === undefined)
      this.radioNameBolded = this.in_bold(this.get_radio_name(this.last_radio_listened_to));

    let _tooltip = "" + this.radioNameBolded + this.codecAndBitrate + "\n";
    if (title.length > 0) {
      var artist = "";
      if (title.includes(" - ")) {
        [artist, title] = title.split(" - ");
        if (artist.length > 0)
          _tooltip += "<i><b>" + artist.replace(/\"/g, "") + "</b></i>\n";
      }
      _tooltip += title.replace(/\"/g, "") + "\n";
    }
    if (this.percentage !== "undefined")
      _tooltip += _("Volume: %s%").format(this.percentage);

    if (this.show_help_in_tooltip) {
      if (this.record_pid != null)
        _tooltip += "\n<i>" + _("Middle-Click: Stop Recording") + "</i>";
      else
        _tooltip += "\n<i>" + _("Middle-click: ON/OFF") + "</i>";

      _tooltip += "\n<i>" + _("Click: Select another station") + "</i>";
    }

    this.set_applet_tooltip(this._clean_str(_tooltip), true);
    //this._applet_tooltip.show();
    this._applet_tooltip.preventShow = false;

    _tooltip = null;
    title = null;
    this.volume_near_icon();
  }

  set_radio_tooltip_to_default_one() {
    let _tooltip = _("Click to select a station");

    if (this.last_radio_listened_to != null && this.last_radio_listened_to.length > 0) {
      this.radioNameBolded = this.in_bold(this.get_radio_name(this.last_radio_listened_to));
      _tooltip = "" + this.radioNameBolded + this.codecAndBitrate;

      var title = "" + this.songTitle;

      if (title.length > 0) {
        var artist = "";
        if (title.includes(" - ")) {
          [artist, title] = title.split(" - ");
        if (artist.length > 0)
            _tooltip += "\n<i><b>" + artist.replace(/\"/g, "") + "</b></i>";
        }
        _tooltip += "\n" + title.replace(/\"/g, "");
      }

      if (this.context_menu_item_slider != null) {
        let percentage = this.context_menu_item_slider.slider.percentage;
        if (""+percentage !== "undefined") {
          if (percentage !== this.percentage)
            this.percentage = percentage;
        }
        percentage = null;
      }
      _tooltip += "\n" + _("Volume: %s%").format(this.percentage);

      if (this.show_help_in_tooltip) {
        if (this.record_pid != null)
          _tooltip += "\n<i>" + _("Middle-Click: Stop Recording") + "</i>";
        else
          _tooltip += "\n<i>" + _("Middle-click: ON/OFF") + "</i>";

        _tooltip += "\n<i>" + _("Click: Select another station") + "</i>";
        if(this.mpvStatus === "PLAY")
          _tooltip += "\n<i>" + _("Scroll wheel: volume change") + "</i>";
      }
    }

    this.set_applet_tooltip(this._clean_str(_tooltip), true);

    _tooltip = null;
  }

  icon_or_favicon(_id) {
    let change2symbolic = false;
    if (this.show_favicon && _id != null) {
      let favicon = this.get_radio_favicon(_id);
      if (favicon.length > 0 && favicon.startsWith("http")) {
        try {
          this.set_applet_icon_from_url(favicon);
        } catch(e) {
          logError("Unable to display the station logo");
          change2symbolic = true
        }
      } else {
        change2symbolic = true
      }
    } else {
      change2symbolic = true
    }

    if (change2symbolic) {
      this.change_symbolic_icon();
      this.set_color();
    }
  }

  updateUI() {
    //log("updateUI");
    this.set_color();
    this.set_radio_tooltip_to_default_one();
  }

  minimal_menu() {
    this.menu.removeAll();
    this.currentMenuItem = null;
    this.menuItems = [];
    if (this.show_version) {
      let menuitemHead1 = new PopupIconMenuItem("" + APPNAME + "  v" + VERSION, "webradioreceiver", IconType.SYMBOLIC, { reactive: false });
      // menuitemHead1.actor.set_style("text-align: center;");
      this.menu.addMenuItem(menuitemHead1);
      this.menu.addMenuItem(new PopupSeparatorMenuItem());
    }

    let configureItem = new PopupIconMenuItem(_("Configure..."), "system-run", IconType.SYMBOLIC);
    configureItem.connect('activate', Lang.bind(this, this.configureApplet));
    this.menu.addMenuItem(configureItem);

    let searchItem = new PopupIconMenuItem(_("Search for new stations..."), "system-search", IconType.SYMBOLIC);
    searchItem.connect('activate', Lang.bind(this, () => {
      let pidOfSearch = this.configureApplet(this.tabNumberOfSearch);
    } ));
    this.menu.addMenuItem(searchItem);

    let soundSettingsItem = new PopupIconMenuItem(_("Sound Settings"), "audio-card", IconType.SYMBOLIC);
    soundSettingsItem.connect('activate', () => { spawnCommandLine("cinnamon-settings sound") });
    this.menu.addMenuItem(soundSettingsItem);
  }

  make_menu(force=false, notify_user=true, change_tooltip=true) {
    //log("!!!! make_menu: this.radios: "+JSON.stringify(this.radios, null, 2));

    // MINIMAL MENU:
    if (!this.radios || this.radios.length === 0) {
      this.minimal_menu();
      return;
    }

    // NORMAL MENU
    if (force || this.oldRadios != JSON.stringify(this.radios)) {
      this.set_radio_hashtable();

      if (change_tooltip) this.set_radio_tooltip_to_default_one();

      //~ this.menu.removeAll();
      if (this.menu) this.menu.destroy();

      this.menu = new AppletPopupMenu(this, this.orientation);
      this.menuManager.addMenu(this.menu);

      this.currentMenuItem = null;
      this.menuItems = [];
      var item_homepage = null;

      // APPLET NAME and VERSION:
      if (this.show_version) {
        let menuitemHead1 = new PopupIconMenuItem("" + APPNAME + "  v" + VERSION, "webradioreceiver", IconType.SYMBOLIC, { reactive: false });
        //menuitemHead1.label.set_style("text-align: center; min-width: 200px;");
        this.menu.addMenuItem(menuitemHead1);
        this.menu.addMenuItem(new PopupSeparatorMenuItem());
      }

      // SONG TITLE, BRAINZ LINK, YT LINK:
      if (this.songTitle && this.songTitle.length > 0) {
        let title = this.songTitle.replace(/\//g, " & ");
        let query = fixedEncodeURIComponent(title);
        let proxy = ""+this.settings.getValue("http-proxy");
        proxy = proxy.trim();
        let proxy_option = (proxy.length > 0) ? ` --proxy "${proxy}"` : "";
        let brainz_link = `https://musicbrainz.org/search?type=recording&query=${query}`;
        let yt_watch_link = `https://www.youtube.com/results?search_query=${query}`;

        let ytdl_program = ""+YTDL_PROGRAM();
        let yt_format = ""+this.rec_format;
        let output_title = ""+title.replace(/"/g, '');
        let yt_title = ""+title .replace(/"/g, '\\\"')
                                .replace(/'/g, "\\\'")
                                .replace(/&/g, '\\\&');

        let yt_dl_command = `${ytdl_program} --output "${RADIO30_MUSIC_DIR}/${output_title}.%(ext)s"`
          + proxy_option
          + ` --buffer-size 4096 -x --audio-format ${yt_format} --audio-quality 0`
          + ` --add-metadata --embed-thumbnail --newline "ytsearch1:${yt_title}&page=1"`;

        //~ log("yt_dl_command: "+yt_dl_command);

        let brainz_item = new PopupIconMenuItem(""+title, "audio-x-generic", IconType.SYMBOLIC, { reactive: true });
        brainz_item.label.clutterText.line_wrap_mode = WrapMode.WORD_CHAR;
        brainz_item.label.clutterText.ellipsize = EllipsizeMode.NONE;
        brainz_item.connect('activate', Lang.bind(this, function() {
          spawnCommandLineAsync("xdg-open " + brainz_link);
        }));
        this.menu.addMenuItem(brainz_item);

        let yt_watch_item  = new PopupIconMenuItem(_("Watch on YT"), "media-playback-start", IconType.SYMBOLIC, { reactive: true });
        yt_watch_item.connect('activate', Lang.bind(this, function() {
          spawnCommandLineAsync("xdg-open " + yt_watch_link);
        }));
        this.menu.addMenuItem(yt_watch_item);

        if (this.yt_downloads.indexOf(title) < 0 && this.check_hd_space_left(false)) {
          let yt_dl_item  = new PopupIconMenuItem(_("Try to download it from YT (unsafe)"), "folder-download-symbolic", IconType.SYMBOLIC, { reactive: true });

          yt_dl_item.connect('activate', Lang.bind(this, function() {
            this.download_from_YT(title, yt_dl_command, RADIO30_MUSIC_DIR);
          }));

          if (YTDL_PROGRAM() != null && this.yt_downloads.indexOf(title) < 0) {
            this.menu.addMenuItem(yt_dl_item)
          } else {
            yt_dl_item.destroy();
            yt_dl_item = null
          }
        }

        //~ let trackInfo = new BoxLayout({ style_class: 'sound-player-overlay', important: true, vertical: true });
        //~ let songBox = new PopupMenuSection();

        //~ let song_toolbar = new BoxLayout(
          //~ { style_class: "sound-player",
            //~ important: true,
            //~ vertical: true,
            //~ style: 'padding: 10px;',
            //~ x_align: Align.MIDDLE
          //~ }
        //~ );

        //~ songBox.addActor(song_toolbar, { expand: true });

        //~ let songButtons = new Bin({ x_align: Align.MIDDLE });

        //~ let brainzBtn = new R3Button(
          //~ "audio-x-generic",
          //~ _("Infos on: %s").format(title),
          //~ Lang.bind(this, function() {
            //~ spawnCommandLineAsync("xdg-open " + brainz_link)
          //~ }),
          //~ false
        //~ );

        //~ let watchOnYT = new R3Button(
          //~ "media-playback-start",
          //~ _("Watch on YT"),
          //~ Lang.bind(this, function() {
            //~ spawnCommandLineAsync("xdg-open " + yt_watch_link);
          //~ }),
          //~ false
        //~ );

        //~ song_toolbar.add_actor(songButtons);
        //~ songButtons.add_actor(brainzBtn.getActor());
        //~ songButtons.add_actor(watchOnYT.getActor());

        //trackInfo.add_actor(songButtons);
        //~ songBox.set_child(song_toolbar);

        //this.menu.addMenuItem(songBox);

        this.menu.addMenuItem(new PopupSeparatorMenuItem());
      }

      // RECENTS STATIONS:
      var to_remove_from_recentRadios = [];
      if (this.recent_number > 0) {
        let menuitemHead2 = new TitleSeparatorMenuItem(_("Recently Played Stations:"), "pan-down");
        this.menu.addMenuItem(menuitemHead2);

        var titles = [];

        var indexRecentRadios = 0;
        for (let id of this.recentRadios) {
          let title = ""+this.get_radio_name(id);
          if (titles.indexOf(title) > -1) continue;

          if (!title || title.length === 0 || title === "undefined" || title ==="null") {
            to_remove_from_recentRadios.push(""+id);
            continue;
          }

          titles.push(title);

          indexRecentRadios += 1;
          if (indexRecentRadios > this.recent_number)
            break;

          let item = new PopupMenuItem(title, { reactive: true });
          item.connect('activate', Lang.bind(this, function() {
            if (this.currentMenuItem === null || this.currentMenuItem != item) {
              if (change_tooltip) {
                this.set_radio_tooltip_to_default_one();
              }

              this.stop_mpv_radio(false);
              this.which_category_for_id(id);
              this.start_mpv_radio(id);

              this.menu.close();
              item.setShowDot(true);
            }
          }));

          if (""+id == ""+this.last_radio_listened_to && this.mpvStatus === "PLAY") {
            item.setShowDot(true);
            let homepage = this.get_radio_homepage(id);
            item_homepage = null;
            if (homepage && homepage != 'null' && homepage.length > 0) {
              item_homepage = new PopupIconMenuItem(_("Visit the home page of this station"), "web-browser", IconType.SYMBOLIC, { reactive: true });
              item_homepage.connect('activate', () => { spawnCommandLineAsync(`xdg-open ${homepage}`) });
            }
          }

          this.menu.addMenuItem(item);
        }
        titles = [];
        titles = null;
      }

      while (to_remove_from_recentRadios && to_remove_from_recentRadios.length > 0) {
        let to_remove = to_remove_from_recentRadios.shift();
        this.recentRadios.splice(this.recentRadios.indexOf(to_remove), 1);
      }
      this.menu.addMenuItem(new PopupSeparatorMenuItem());

      if (this.show_by_category && this.number_of_categories > 0) {
        // Category list beside of Radio Station list:
        let cws = JSON.parse(JSON.stringify(this.categories_with_stations));
        let _cats = Object.keys(cws);
        //~ logDebug("Nbr of categories: "+_cats.length);
        //~ logDebug("categories_with_stations: \n"+JSON.stringify(cws, null, 4));

        let section = new PopupMenuSection();
        section.box.set_vertical(false);
        section.box.set_style("width: 900px;");
        this.menu.addMenuItem(section);

        let sectionCats = new PopupMenuSection();
        sectionCats.box.set_vertical(true);
        //~ sectionCats.box.set_style("width: 200px;");
        section.addMenuItem(sectionCats);

        let sectionStations = new PopupMenuSection();
        sectionStations.box.set_vertical(true);
        //~ sectionStations.box.set_style("width: 500px;");
        section.addMenuItem(sectionStations);

        this.categoriesMenu = new StationsPopupSubMenuMenuItem(_("Categories"));

        this.stationsMenu = new PopupSubMenuMenuItem(_("Radio Stations"));

        sectionCats.addMenuItem(this.categoriesMenu, { expand: true, span: 1, align: Align.START });
        sectionStations.addMenuItem(this.stationsMenu, { expand: true, span: 1, align: Align.START });

        var catItems = [];
        var iCats = -1;
        for (let c of _cats) {
          iCats++;
          let _keys = Object.keys(cws[c]);
          let catItem = new PopupMenuItem((c=="All Categories") ? _("All Categories") + " (" + _keys.length + ")" : c + " (" + _keys.length + ")", { reactive: true });
          catItem.setShowDot(c == this.last_category);
          catItems.push(catItem);
          this.categoriesMenu.menu.addMenuItem(catItems[iCats]);
          catItems[iCats].actor.connect("enter-event", Lang.bind(this, function() {
            this.stationsMenu.menu.removeAll();
            this.stationsMenu.menu.open();
            for (let s of _keys) {
              let id = cws[c][s];
              let item = new PopupMenuItem(s, { reactive: true });
              item.setShowDot(id == this.last_radio_listened_to);
              if (id == this.last_radio_listened_to && c!="All Categories") {
                catItem.setShowDot(true);
                this.last_category = c;
              }
              item.connect('activate', Lang.bind(this, function() {
                this.last_category = c;
                this.set_radio_tooltip_to_default_one();

                this.stop_mpv_radio(false);
                this.start_mpv_radio(id);

                this.menu.close();
              }));
              this.stationsMenu.menu.addMenuItem(item);
            }
          }));
        }
      } else {
        // MY RADIO STATIONS:
        let allRadiosMenu = new RadioPopupSubMenuMenuItem(_("My Radio Stations") + "  (%s)".format(""+this.number_of_stations));
        this.menu.addMenuItem(allRadiosMenu);

        for (let i = 0, _length = (this.radios) ? this.radios.length : 0; i < _length; i++) {
          let title = ""+this.radios[i].name;
          let id = (this.radios[i].url) ? ""+this.radios[i].url : "";
          let isCategory = id.length === 0;
          let reactive = !isCategory;

          if (isCategory) {
            title = "── " + title + " ──";
          } else {
            let elts = []
            let bitrate = (this.show_bitrate) ? ""+parseInt(this.radios[i].bitrate) : "";
            if (bitrate === "NaN") bitrate = "";
            if (bitrate.length > 0) elts.unshift(bitrate);
            let codec = (this.show_codec) ? ""+this.radios[i].codec : "";
            if (codec.length > 0) elts.unshift(codec);

            if (elts.length > 0) elts.unshift(" ─");
            if (this.show_favicon && this.radios[i].favicon && this.radios[i].favicon.length > 0)
              elts.push(" *");

            title = title + elts.join(" ");
          }

          if (this.radios[i] != null && this.radios[i].inc === true) {
            this.menuItems[i] = new PopupMenuItem(title, { reactive: reactive });
            allRadiosMenu.menu.addMenuItem(this.menuItems[i]);

            if (reactive) this.menuItems[i].connect('activate', Lang.bind(this, function() {
              if (this.currentMenuItem === null || this.currentMenuItem != this.menuItems[i]) {
                if (change_tooltip) {
                  this.set_radio_tooltip_to_default_one();
                }

                this.stop_mpv_radio(false);
                this.start_mpv_radio(id);

                this.menu.close();
                this.active_menu_item_changed(this.menuItems[i]);
              }
            }));

            if (force && id && id.length > 0 && this.radioId === id)
              this.menuItems[i].setShowDot(true);

            if (this.radioId === id && change_tooltip)
              this.set_radio_tooltip_to_default_one();
          }
        }
      }

      this.menu.addMenuItem(new PopupSeparatorMenuItem());

      // STOP:
      if (this.stopItem) this.stopItem.destroy();
      this.stopItem = new TitleSeparatorMenuItem(_("Stop"), "media-playback-stop", true);
      this.stopItem.connect('activate', Lang.bind(this, this.stop_mpv));
      this.menu.addMenuItem(this.stopItem);
      if (force) {
        if (this.mpvStatus === "STOP") this.stopItem.setShowDot(true);
        if (change_tooltip) this.set_radio_tooltip_to_default_one();
      }

      // SEARCH FOR NEW STATIONS:
      this.menu.addMenuItem(new PopupSeparatorMenuItem());
      let searchItem = new PopupIconMenuItem(_("Search for new stations..."), "system-search", IconType.SYMBOLIC);
      searchItem.connect('activate', Lang.bind(this, () => {
        let pidOfSearch = this.configureApplet(this.tabNumberOfSearch);
      } ));
      this.menu.addMenuItem(searchItem);

      // CONFIGURE APPLET and SOUND SETTINGS:
      if (this.show_system_items) {
        let configureItem = new PopupIconMenuItem(_("Configure..."), "system-run", IconType.SYMBOLIC);
        configureItem.connect('activate', Lang.bind(this, this.configureApplet));
        this.menu.addMenuItem(configureItem);

        let soundSettingsItem = new PopupIconMenuItem(_("Sound Settings"), "audio-card", IconType.SYMBOLIC);
        soundSettingsItem.connect('activate', () => { spawnCommandLine("cinnamon-settings sound") });
        this.menu.addMenuItem(soundSettingsItem);
      }

      //HOMEPAGE:
      if (item_homepage != null) {
        this.menu.addMenuItem(new PopupSeparatorMenuItem());
        this.menu.addMenuItem(item_homepage)
      }

      this.oldRadios = JSON.stringify(this.radios);
    }
  }

  which_category_for_id(id) {
    // this.last_category
    let cws = JSON.parse(JSON.stringify(this.categories_with_stations));
    let _cats = Object.keys(cws);
    for (let c of _cats) {
      if (c == "All Categories") continue;
      let _keys = Object.keys(cws[c]);
      for (let s of _keys) {
        if (id == cws[c][s]) {
          this.last_category = c;
          return;
        }
      }
    }
    this.last_category = "All Categories"
  }

  number_of_files(dir_path, reg) {
    let nbr = 0;
    let dir = file_new_for_path(dir_path);
    if (dir.query_exists(null)) {
      let children = dir.enumerate_children("standard::name", FileQueryInfoFlags.NONE, null);
      let info, file_type;
      var name;

      while ((info = children.next_file(null)) != null) {
        file_type = info.get_file_type();
        if (file_type === FileType.REGULAR) {
          name = ""+info.get_name();

          if (reg.test(name)) {
            nbr += 1
          }
        }
      }

      children.close(null);
    }
    return nbr
  }

  number_of_video_files(dir_path) {
    let regFile = /^.*\.webm$/;
    return this.number_of_files(dir_path, regFile)
  }

  number_of_sound_files(dir_path) {
    let regFile;
    switch (this.rec_format) {
      case "mp3": regFile = /^.*\.mp3$|^.*\.part$/;
        break;
      case "flac": regFile = /^.*\.flac$|^.*\.part$/;
        break;
      case "ogg": regFile = /^.*\.ogg$|^.*\.part$/;
        break;
      case "raw": regFile = /^.*\.raw$|^.*\.part$/;
        break;
      case "wav": regFile = /^.*\.wav$|^.*\.part$/;
        break;
    }
    return this.number_of_files(dir_path, regFile)
  }

  download_from_YT(title, yt_dl_command, dir) {
    if (!this.check_hd_space_left(true)) {
      this.change_symbolic_icon();
      return
    }
    this.change_symbolic_icon("yt");
    this.yt_downloads.push(title);
    this.context_menu_yt_downloads.push([title, Lang.bind(this, () => {
        this.settings.setValue("recordings-extract-update", 0.0);
        this.settings.setValue("show-recordings-extract-update", false);
        cancel_download();
      })
    ]);

    let titles = title.split("\n");
    let total = titles.length;

    var yt_dl_exitCode = 0;
    var yt_dl_errMsg = "";
    let yt_dl_process = spawnCommandLineAsyncIO(`%s`.format(yt_dl_command), (out, err, exitCode) => {
      if (exitCode != 0) {
        yt_dl_exitCode = exitCode;
      }
      yt_dl_errMsg = ""+err;
      yt_dl_process.send_signal(9);
    });
    let yt_dl_pid = yt_dl_process.get_identifier();
    let yt_dl_proc_dir = "/proc/"+yt_dl_pid;
    let progress_filepath = '%s/radio3_progress_%s'.format(
      RUNTIME_DIR,
      ""+yt_dl_pid
    );

    if (file_test(yt_dl_proc_dir, FileTest.EXISTS)) {
      let progress_pid = spawnCommandLineAsync("bash -c '%s/progress.sh %s'".format(
        SCRIPTS_DIR,
        ""+yt_dl_pid
      ));

      this.change_symbolic_icon("yt");

      this.radio_notify(
        _("Downloading..."),
        ""+title,
        [ _("Stop downloading"),
          "callback",
          Lang.bind(this, () => {
            this.settings.setValue("recordings-extract-update", 0.0);
            this.settings.setValue("show-recordings-extract-update", false);
            cancel_download();
            this.change_symbolic_icon();
          })
        ]
      );

      this.settings.setValue("recordings-extract-update", 0.0);

      let ytInterval;
      if (this.yt_interval === 0) {
        ytInterval = (this.network_quality === "high") ? 300 : 3000; // 0.3 or 3 seconds.
      } else {
        ytInterval = this.yt_interval
      }
      var intervalId = null;
      let oldr = "\n00:00";
      let oldpValue = 0.0;
      let nbr = 1;
      let old_nbr = 1;
      const tirets =    "▪▪▪▪"; // https://www.copyandpastesymbols.net/
      const no_tirets = "▫▫▫▫";
      let l_tirets = 0;
      const regexPercentage = /^((100)|(\d{1,2}(\.\d*)?))%?$/;
      intervalId = setInterval(() => {
        if (file_test(yt_dl_proc_dir, FileTest.IS_DIR) && file_test(progress_filepath, FileTest.EXISTS)) {

          let p_r = to_string(file_get_contents(progress_filepath)[1]).split(" ");    // progress and remaining time
          if (p_r.length !== 2) return true;

          let [p, r] = p_r; // p: progress ; r: remaining time.
          if (r.includes(`[`)) return true;

          let pValue = 0.0; // Value shown in the settings progress bar.
          let pInt = 0;
          let n = "";
          if (regexPercentage.test(p)) {
            p = p.trim();

            if (!r.includes(":")) {
              r = ""+oldr
            } else {
              r = "\n"+r;
              oldr = ""+r
            }

            if (p.startsWith("100") || this.number_of_video_files(dir) > 0) {
              p = "100%";
              r = "\n00:00";
              oldr = "\n00:00";
            }

            if (!this.settings.getValue("show-yt-progress")) {
              this.set_applet_label("")
            } else {
              n = "";

              if (total > 1) {
                nbr = this.number_of_sound_files(dir);
                if (nbr < old_nbr) nbr = old_nbr;
                if (nbr === 0) nbr = 1;
                if (nbr > total) nbr = total;
                old_nbr = nbr;
                n = "\n"+nbr+"/"+total;
              }
            }

            if (p.length > 0 && p !== "100%") {
              pValue = 1*p.replace("%", "");
              pInt = Math.round(pValue);
              l_tirets = (pInt >= 75) ? 4 : Math.round((pInt+25)/25) % 4;
              oldpValue = pValue;
              if (this.settings.getValue("show-yt-progress")) {
                //this.set_applet_label(""+p+r+n);
                this.set_applet_label(""+tirets.slice(0, l_tirets)+no_tirets.slice(0, 4 - l_tirets)+r+n);
              }
              this.settings.setValue("recordings-extract-update", pValue);
              this.settings.setValue("show-recordings-extract-update", true);
              this.change_symbolic_icon("yt");
            } else {
              pValue = 0.0;
              oldpValue = 0.0;
              pInt = 0;
              l_tirets = 0;
              if (this.settings.getValue("show-yt-progress")) {
                //this.set_applet_label("100%\n00:00"+n);
                this.set_applet_label(""+tirets+"\n00:00"+n);
              }
              this.settings.setValue("recordings-extract-update", 0.0);
              this.settings.setValue("show-recordings-extract-update", false);
              this.change_symbolic_icon("animated");
            }
          }
          return true
        } else {
          this.set_applet_label("");
          //QUESTION: Is negative yt_dl_exitCode important? It seems no.
          // Often, yt_dl_exitCode is not 0, yet the download is successfully completed.
          if (0+yt_dl_exitCode <= 0 || yt_dl_errMsg.length === 0) {
            this.radio_notify(
              _("Download complete"),
              ""+title,
              [ _("Open the recordings folder"),
                "callback",
                () => {spawnCommandLineAsync(`bash -c 'xdg-open "%s"'`.format(dir))}
              ]
            )
          } else {
            this.radio_notify(
              _("An error seems to have occurred during recording!"),
              _("Please check this record.") + "\n" + yt_dl_errMsg.trim(),
              [ _("Open the recordings folder"),
                "callback",
                () => {spawnCommandLineAsync(`bash -c 'xdg-open "%s"'`.format(RADIO30_MUSIC_DIR))}
              ]
            )
          }
          this.change_symbolic_icon();
          finished();
          this.settings.setValue("recordings-extract-update", 0.0);
          this.settings.setValue("show-recordings-extract-update", false);
          spawnCommandLine(`bash -c "kill -15 %s"`.format(""+progress_pid));
          spawnCommandLine(`bash -c "rm -f %s"`.format(progress_filepath.replace("progress", "*")));
          if (this.yt_downloads.indexOf(title) > -1) {
            let index = this.yt_downloads.indexOf(title);
            this.yt_downloads.splice(index, 1);
            this.context_menu_yt_downloads.splice(index, 1);
          }
          if (this.yt_downloads.length === 0) {
            // No more download to do.
            // Empty cache directory to avoid future 'HTTP Error 403: Forbidden':
            spawnCommandLineAsync(`bash -c "sleep 1 && %s --rm-cache-dir"`.format(YTDL_PROGRAM()))
          }
          return false
        }
      }, ytInterval); // every 'ytInterval' seconds.
    } else {
      logError("File "+yt_dl_proc_dir+" doesn't exist!");
    }

    function finished() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null
      }
    }

    function cancel_download() {
      try {
        finished()
      } catch(e) {
        logError(e)
      }

      spawnCommandLine(`bash -c "kill -15 %s"`.format(""+yt_dl_pid))
    }
  }

  on_song_changed(radio="", title="") {
    //log("on_song_changed");
    source.destroyAllNotifications();
    let pid = this.record_pid;

    let is_recording = pid != null;

    let has_no_title = title.length===0 || title.endsWith(".mp3") || title.endsWith(".aac");

    if (!has_no_title && title.includes(" - ") && this.artist_title_swap) {
      let [_title, _artist] = title.split(" - ");
      title = ""+_artist+" - "+_title;
    }

    this.songTitle = title;

    let _rec_folder = RADIO30_MUSIC_DIR;

    let date = DateTime.new_now_local().format("%F_%X").replace(/:/g, "-");

    let command;

    if (!has_no_title) {
      let title_with_date = title.replace(/\"/g, '') + "_" + date;

      if (this.network_quality !== "high" && this._control.get_default_sink() != null) {
        let sound_source = this._control.get_default_sink().get_name() + ".monitor";

        command = `%s -t pulseaudio %s -t %s "%s/%s.%s"`.format(
          SOX_PROGRAM(),
          sound_source,
          this.rec_format,
          _rec_folder,
          title_with_date,
          this.rec_format
        );
      } else {
        command = `%s --no-stop-screensaver --no-terminal --no-video --no-cache --load-scripts=no %s --metadata-codepage=auto --stream-dump="%s/%s.%s" %s &`.format(
          MPV_PROGRAM(),
          (""+this.rec_format === "flac") ? "--oac=flac" : "",
          _rec_folder,
          title_with_date,
          this.rec_format,
          this.radioId
        );
      }
    }

    if (is_recording) {
      if (this.recording_ends_auto) {
        this.stop_recording_later(pid);

        if (this.notif_song_change) {
          if (has_no_title) {
            if (this.settings.getValue("notif-station-change") === true)
              this.radio_notify(radio)
          } else if (this.check_hd_space_left(false)) {
            // button structure: [label, action, command]
            this.radio_notify(radio + this.codecAndBitrate, title, [
              _("Record from now"),
              "record",
              command
            ])
          } else {
            this.radio_notify(radio + this.codecAndBitrate, title)
          }
        }
      } else { // Manual end recording
        this.stop_recording_later(pid, true);

        if (this.notif_song_change) {
          if (has_no_title) {
            if (this.settings.getValue("notif-station-change") === true)
              this.radio_notify(radio + this.codecAndBitrate);
          } else {
            // button structure: [label, action, command]
            this.radio_notify(radio + this.codecAndBitrate, title, [
              _("Stop Current Recording"),
              "stop-recording",
              ""
            ])
          }
        }
      }

    } else { // Not recording
      if (this.notif_song_change) {
        if (has_no_title) {
          if (this.settings.getValue("notif-station-change") === true)
            this.radio_notify(radio + this.codecAndBitrate)
        } else if (this.check_hd_space_left(false)) {
          // button structure: [label, action, command]
          this.radio_notify(radio + this.codecAndBitrate, title, [
            _("Record from now"),
            "record",
            command
          ])
        } else {
          this.radio_notify(radio + this.codecAndBitrate, title)
        }
      }
    }

    this.updateUI();

    if (!has_no_title)
      this.download_songArt(title);

    pid = null;
  }

  download_songArt(title) {
    if (!YTDL_PROGRAM().includes("yt-dlp")) return;

    let command = '%s/get_song_art.sh "%s"'.format(SCRIPTS_DIR, title);
    //~ log("command: "+command, true);
    spawnCommandLineAsync(command);
  }

  change_selected_item() {
    //log("change_selected_item");
    var radios = this.settings.getValue("radios");
    if (!radios) return;

    for (let i = 0, _length = radios.length; i < _length; i++) {
      if (radios[i].name == undefined || radios[i].url == undefined || radios[i].inc == undefined)
        continue;
      let title = radios[i].name;
      let id = radios[i].url;

      if (this.menuItems[i])
        this.menuItems[i].setShowDot(false);

      if (id.length > 0 && radios[i].inc === true && this.radioId === id) {
        if (this.menuItems[i]) {
          this.menuItems[i].setShowDot(true);
          //this._increase_click_number(""+id);
        }
      }
    }

    radios = null;
  }

  active_menu_item_changed(activatedMenuItem) {
    //log("active_menu_item_changed");
    if(this.currentMenuItem == undefined || this.currentMenuItem == null) {
        this.currentMenuItem = activatedMenuItem;
    } else {
        this.currentMenuItem.setShowDot(false);
        this.currentMenuItem = activatedMenuItem;
    }

    this.currentMenuItem.setShowDot(true);
  }

  test_mpv_radio(name, url, homepage=null) {
    //if (!this.radiosHash) this.radiosHash = {};
    this.radiosHash[""+url] = {"name": ""+name, "inc": true, "homepage": homepage};
    //global.log(JSON.stringify(this.radiosHash, null, 4));
    this.stop_mpv_radio();
    this.start_mpv_radio(url);
  }

  start_mpv_radio(id) {
    this.showOSD = this.volume_show_osd && this.showOSDonStartup;
    source.destroyAllNotifications();
    let _id = ""+id;
    //log("start_mpv_radio: " + _id);
    if (_id.length === 0) return;

    this.last_radio_listened_to = _id;

    let recentRadios = this.recentRadios; // this.settings.getValue("recentRadios");

    let index_of_id = recentRadios.indexOf(_id);

    while (index_of_id >= 0) {
      recentRadios.splice(index_of_id, 1); // Removes _id from the list of recent radios.
      index_of_id = recentRadios.indexOf(_id);
    }

    recentRadios.unshift(_id);

    while (recentRadios.length > 12) recentRadios.pop();

    this.recentRadios = recentRadios; // this.settings.setValue("recentRadios", recentRadios);

    this.radioId = _id;

    this.icon_or_favicon(_id);

    this.progress = 10/REFRESH_INTERVAL;
    this.interval = setInterval(() => this.on_progress_change(), 100);  // 100 ms.

    this.monitor_mpv_title();
    this.monitor_r30stop();
    this.monitor_r30next();
    this.monitor_r30previous();
    spawnCommandLine("%s %s".format(this.MPV_ALIAS, _id));
    this.mpvStatus = "PLAY";

    this._connect_signals();

    if (this.settings.getValue("notif-station-change") === true) {
      this.radio_notify(_("Playing %s%s").format(this.get_radio_name(_id), this.codecAndBitrate));
    }

    this.set_radio_tooltip_to_default_one();


    this._increase_click_number(_id);

    _id = null;
    recentRadios = null;

    this.appletRunning = true;
  }

  stop_mpv_radio(notify_user=true) {
    //log("stop_mpv_radio");
    let pid = this.get_mpv_pid();

    if (!this.radioId || this.radioId.length === 0 || pid == null) return;

    this.update_radio_with_codec_and_bitrate(this.radioId, this.codec, this.bitrate);

    this.set_radio_tooltip_to_default_one();

    if (this.stopItem) this.active_menu_item_changed(this.stopItem);

    this.mpvStatus = "STOP";
    this.radioId = "";
    this.songTitle = "";

    this.unmonitor_mpv_title();
    this.unmonitor_r30stop();
    this.unmonitor_r30previous();
    this.unmonitor_r30next();

    spawnCommandLine("kill -15 " + pid);
    spawnCommandLine("rm -f %s %s %s %s".format(MPV_PID_FILE, MPV_SOCKET, MPV_BITRATE_FILE, MPV_CODEC_FILE));
    spawnCommandLine("bash -c '%s'".format(DEL_SONG_ARTS_SCRIPT));
    file_set_contents(MPV_TITLE_FILE, "");

    this.change_symbolic_icon();

    this._disconnect_signals(false);

    if (this.context_menu_item_slider != null) {
      this.context_menu_item_slider.destroy();
      this.context_menu_item_slider = null;
    }

    this.updateUI();

    if (notify_user) {
      source.destroyAllNotifications();
      this.radio_notify(_("Radio OFF"));
    }

    let idtemp = setTimeout (() => {
          clearTimeout(idtemp);
    }, 3000);

    //pid = null;
  }

  async update_radio_with_codec_and_bitrate(id, codec, bitrate) {
    let radios = this.settings.getValue("radios");
    var new_radios = [];
    var modified = false;
    var found = false;
    for (let radio of radios) {
      if (radio.url && radio.url.length > 0 && radio.url === id) {
        found = true;
        let radio_codec = (radio.codec) ? ""+radio.codec : null;
        let radio_bitrate = (radio.bitrate) ? 0+radio.bitrate : 0;
        let _codec = (codec) ? ""+codec : null;
        let _bitrate = (bitrate && (0+bitrate > 0)) ? 0+bitrate : 0;

        if (_codec && radio_codec != _codec) {
          radio["codec"] = _codec;
          modified = true;
        }
        if (_bitrate > 0) {
          radio["bitrate"] = ""+_bitrate;
          modified = true;
        }
      }
      new_radios.push(radio);
    }

    if (modified) {
      this.settings.setValue("radios", new_radios);
    }

    if (!found) {
      radios = this.settings.getValue("search-list");
      new_radios = [];
      modified = false;
      for (let radio of radios) {
        if (radio.url && radio.url.length > 0 && radio.url === id) {
          found = true;
          let radio_codec = (radio.codec) ? ""+radio.codec : null;
          let radio_bitrate = (radio.bitrate) ? 0+radio.bitrate : 0;
          let _codec = (codec) ? ""+codec : null;
          let _bitrate = (bitrate && (0+bitrate > 0)) ? 0+bitrate : 0;

          if (_codec && radio_codec != _codec) {
            radio["codec"] = _codec;
            modified = true;
          }

          if (_bitrate > 0) {
            radio["bitrate"] = ""+_bitrate;
            modified = true;
          }
        }
        new_radios.push(radio);
      }
      if (modified) {
        this.settings.setValue("search-list", new_radios);
      }
    }

    if (!found) {
      radios = this.settings.getValue("import-list");
      new_radios = [];
      modified = false;
      for (let radio of radios) {
        if (radio.url && radio.url.length > 0 && radio.url === id) {
          found = true;
          let radio_codec = (radio.codec) ? ""+radio.codec : null;
          let radio_bitrate = (radio.bitrate) ? 0+radio.bitrate : 0;
          let _codec = (codec) ? ""+codec : null;
          let _bitrate = (bitrate && (0+bitrate > 0)) ? 0+bitrate : 0;

          if (_codec && radio_codec != _codec) {
            radio["codec"] = _codec;
            modified = true;
          }

          if (_bitrate > 0) {
            radio["bitrate"] = ""+_bitrate;
            modified = true;
          }
        }
        new_radios.push(radio);
      }
      if (modified) {
        this.settings.setValue("import-list", new_radios);
      }
    }

    //radios = null;
    //new_radios = null
  }

  check_hd_space_left(notify=true) {
    let now = Math.ceil(Date.now() / 1000);
    if (this.future_check_date != undefined && now < this.future_check_date && this.result_of_last_hd_space_check != undefined) {
      return this.result_of_last_hd_space_check
    }

    this.last_check_date = now;
    this.future_check_date = this.last_check_date + 60; // +60 seconds.
    let available = spaceAvailable(RADIO30_MUSIC_DIR);
    this.settings.setValue("limits-hd-space-left-label", limits_hd_space_left_label_text.format(
      formatNumber(available, 0), // 0 decimal
      formatNumber(Math.round(available / Math.pow(10, 8))/10, 1), // 1 decimal
      formatNumber(Math.round(available / Math.pow(2, 30) * 10)/10, 1) // 1 decimal
    ));
    let min_space_left = this.min_hd_space_left;

    if (available < min_space_left) { //Remove '/100000' after 'available' (for tests only).
      // Disk space is insufficient.
      this.settings.setValue("scheduling-allowed", false);
      if (this.record_pid != null)
        this.stop_recording(this.record_pid);
      if (notify) {
        let icon = new Icon({
          icon_name: 'music-folder-full',
          icon_type: IconType.SYMBOLIC,
          icon_size: 32
        });
        criticalNotify(_("Unable to record anything!"), _("Insufficient space")+"\n"+_("The limit you set has been reached."), icon);
      }
      this.result_of_last_hd_space_check = false;
      return false
    }
    // Disk space is OK.
    this.settings.setValue("scheduling-allowed", true);
    this.settings.setValue("sched-radio", "");
    this.result_of_last_hd_space_check = true;
    return true
  }

  start_recording() {
    this.ensure_radio30_music_dir();
    if (!this.check_hd_space_left()) return;

    //log("start_recording");

    this.screensaver_inhibitor.inhibit_screensaver();

    let title = this.songTitle;
    let date = DateTime.new_now_local().format("%F_%X").replace(/:/g, "-");

    if (!title || title.length === 0) {
      title = this._clean_str(this.get_radio_name(this.radioId));
    }

    title = title + "_" + date;

    //let _rec_folder = this.rec_folder.slice("file://".length, this.rec_folder.length);
    let _rec_folder = RADIO30_MUSIC_DIR;
    //log("start_recording: _rec_folder: "+_rec_folder);

    let command;
    if (this.network_quality !== "high") {
      let sink = this._control.get_default_sink();
      let sound_source = sink.get_name() + ".monitor";
      //log("  Source: " + sound_source);



      this.context_menu_item_slider.slider._value = 1;
      this.context_menu_item_slider.slider._onValueChanged();

      command = `%s -t pulseaudio %s -t %s "%s/%s.%s"`.format(
        SOX_PROGRAM(),
        sound_source,
        this.rec_format,
        _rec_folder,
        title.replace(/\"/g, '') + "_" + date,
        this.rec_format
      );
    } else {
      command = `%s --no-stop-screensaver --no-terminal --no-video --no-cache --load-scripts=no %s --metadata-codepage=auto --stream-dump="%s/%s.%s" %s &`.format(
        MPV_PROGRAM(),
        (""+this.rec_format === "flac") ? "--oac=flac" : "",
        _rec_folder,
        title.replace(/\"/g, '') + "_" + date,
        this.rec_format,
        this.radioId
      );
      //log("start_recording: command: "+command, true);
    }

    if (this.record_pid != null)
      this.stop_recording(this.record_pid);

    let pid = trySpawnCommandLine(command);
    //log("start_recording: pid: "+pid, true);
    this.record_pid = pid;
    this.updateUI();
  }

  stop_recording(pid) {
    //log("stop_recording("+pid+")");

    this.screensaver_inhibitor.uninhibit_screensaver();

    if (pid == null && this.record_pid == null) {
      this.updateUI();
      return;
    }

    if (pid == null) pid = this.record_pid;

    if (this.notifications_about_recordings[""+pid] != undefined) {
      let notification = this.notifications_about_recordings[""+pid];
      notification.setUrgency(0);
      notification.setResident(false);
      notification.destroy(3);
      delete this.notifications_about_recordings[""+pid];
    }

    spawnCommandLine("kill -15 " + pid);

    if (this.record_pid === pid)
      this.record_pid = null;

    this.updateUI();
  }

  stop_recording_later(pid, continue_recording=false) {
    //log("stop_recording_later");
    let id = setTimeout(() => {
      this.stop_recording(pid);
      this.stopRecordingId = null;
      if (continue_recording) this.start_recording();
      clearTimeout(id);
    }, 1000); // 1000 ms

    this.stopRecordingId = id;
  }

  stop_mpv(notify_user=true) {
    //log("stop_mpv");
    this.stop_mpv_radio(notify_user);

    this.unmonitor_interfaces();

    //~ spawnCommandLine("rm -f %s %s %s %s %s".format(MPV_PID_FILE, MPV_SOCKET, MPV_BITRATE_FILE, MPV_CODEC_FILE, `${SONG_ART_DIR}/R3SongArt*`));
    spawnCommandLine("rm -f %s %s %s %s".format(MPV_PID_FILE, MPV_SOCKET, MPV_BITRATE_FILE, MPV_CODEC_FILE));
    spawnCommandLine("rm -f %s".format(R30STOP));
    spawnCommandLine("rm -f %s".format(R30NEXT));
    spawnCommandLine("rm -f %s".format(R30PREVIOUS));
    spawnCommandLine("bash -c '%s'".format(DEL_SONG_ARTS_SCRIPT));
  }

  on_applet_clicked(event) {
    //log("on_applet_clicked");
    if (!this.menu || !this.menu.isOpen) {
      this.make_menu(true, false, false);
      this.change_selected_item();
      this.menu.open();
      if (this.categoriesMenu) {
        this.categoriesMenu.menu.open();
        this.stationsMenu.menu.open();
      }
      return
    }

    if (this.menu) {
      this.menu.toggle();
      this.menu.destroy();
    }
  }

  on_applet_middle_clicked(event) {
    if (this.menu.isOpen) this.menu.close();

    if (this.record_pid != null) {
      this.stop_recording(this.record_pid);
      return
    }

    if (this.radioId && this.radioId.length !== 0) {
      this.stop_mpv_radio();
    } else {
      if (this.last_radio_listened_to && this.last_radio_listened_to.length > 0) {
        this.stop_mpv_radio(false);
        this.start_mpv_radio(this.last_radio_listened_to);
      }
    }
  }

  _onButtonPressEvent(actor, event) {
    if (!this._applet_enabled) {
      return false;
    }

    let button = event.get_button();
    if (button < 3) {
      if (!this._draggable.inhibit) {
        return false;
      } else {
        if (this._applet_context_menu.isOpen) {
            this._applet_context_menu.close();
        }
      }
    }

    if (button === 1) {
      this.on_applet_clicked(event);
    } else if (button === 2) {
      this.on_applet_middle_clicked(event);
    } else if (button === 3) {
      this.finalizeContextMenu();
      if (this._applet_context_menu._getMenuItems().length > 0) {
        this._applet_context_menu.toggle();
      }
    }

    return true;
  }


  _connect_signals() {
    //log("_connect_signals");
    try {
      if (this.connectIdScroll === -1)
        this.connectIdScroll = this.actor.connect("scroll-event", (...args) => this._onScrollEvent(...args));
      if (this.connectIdEnter === -1)
        this.connectIdEnter = this.actor.connect("enter-event", (...args) => this._onEnterEvent(...args));
      if (this.connectIdLeave === -1)
        this.connectIdLeave = this.actor.connect("leave-event", (...args) => this._onLeaveEvent(...args));
    }
    catch(e) {
      logError("Error while connecting signals: " + e);
    }
  }

  _disconnect_signals(disconnectScroll=true) {
    //log("_disconnect_signals");
    if (this.connectIdScroll > -1 && disconnectScroll) {
      try {
        this.actor.disconnect(this.connectIdScroll);
        this.connectIdScroll = -1;
      } catch(e) {
        logError("Error while disconnecting signals: " + e);
      }
    }

    if (this.connectIdEnter > -1) {
      try {
        this.actor.disconnect(this.connectIdEnter);
        this.connectIdEnter = -1;
      } catch(e) {
        logError("Error while disconnecting signals: " + e);
      }
    }

    if (this.connectIdLeave > -1) {
      try {
        this.actor.disconnect(this.connectIdLeave);
        this.connectIdLeave = -1;
      } catch(e) {
        logError("Error while disconnecting signals: " + e);
      }
    }
  }

  _onScrollEvent(actor, event) {
    //log("_onScrollEvent");
    let invert = _get_system_natural_scroll();
    if (!this.context_menu_item_slider) {
      let direction = event.get_scroll_direction();
      let step = this.volume_step;
      let percentage = this.percentage;
      if ((direction == ScrollDirection.DOWN && !invert) || (direction == ScrollDirection.UP && invert)) {
        this.percentage = Math.max(0, percentage - step);
      }
      else if ((direction == ScrollDirection.UP && !invert) || (direction == ScrollDirection.DOWN && invert)) {
        this.percentage = Math.min(100, percentage + step);
      }
      this.change_volume_in_radio_tooltip();
      return;
    }

    this.context_menu_item_slider.slider._onScrollEvent(this.context_menu_item_slider.slider.actor, event);
  }

  _onEnterEvent(actor, event) {
    if (!this.tooltip_updated) {
      this.set_radio_tooltip_to_default_one()
    }

    this.tooltip_updated = true;
    //this.test_httpSockect();
  }

  _onLeaveEvent(actor, event) {
    this.tooltip_updated = false;
  }


  /**
   * on_applet_reloaded:
   * Executed before on_applet_removed_from_panel,
   * only if the reload of the applet is requested.
   **/
  on_applet_reloaded() {
    //log("on_applet_reloaded", true);
    this.songTitle = "";
    // Register recent Radios:
    this.recentRadios = this.recentRadios;

    //this.set_radio_hashtable();

    this.get_radio_name(this.last_radio_listened_to)
  }

  _set_default_volume() {

    let volume_at_startup = this.get_volume_at_startup();

    if (volume_at_startup > -1) {
      let value = volume_at_startup / 100;
      if (this.context_menu_item_slider != null) {
        this.context_menu_item_slider.slider._value = value;
        this.context_menu_item_slider.slider._slider.queue_repaint();
        this.context_menu_item_slider.slider.emit('value-changed', value);
      }
    }

    this.page_label = undefined;
    this.settingsWindow = undefined;
    this.volume_near_icon();
  }

  listen_to_last_station() {
    let id = this.last_radio_listened_to;

    if (this.switch_on_last_station_at_start_up && id && id.length > 0) {
      this.start_mpv_radio(id);
    }

    id = null;
  }

  on_orientation_changed(orientation) {
    this.orientation = orientation;
    this.isHorizontal = !(this.orientation == Side.LEFT || this.orientation == Side.RIGHT);
    // End of on_orientation_changed
  }

  on_applet_added_to_panel() {
    // Install or update translations, if any:
    if (!are_translations_installed()) install_translations();

    spawnCommandLineAsync("bash -c '"+DEL_SONG_ARTS_SCRIPT+"'");

    let subProcess = spawnCommandLineAsyncIO(SCRIPTS_DIR+"/get-score.sh", Lang.bind(this, (stdout, err, exitCode) => {
      try {
        this.settings.setValue("score", 1*stdout);
      } catch(e) {
        logError("Reading score error: "+e)
      }
      subProcess.send_signal(9);
    }));

    // Check about dependencies:
    this.checkDepInterval = undefined;
    this.dependencies = null;

    if (!this.dont_check_dependencies)
      this.dependencies = new Dependencies();
    this.depCount = 0;
    if (this.dont_check_dependencies || (this.dependencies && this.dependencies.areDepMet())) {
      // (Consider) All dependencies are installed.
      if (this.checkDepInterval != undefined) {
        clearInterval(this.checkDepInterval);
        this.checkDepInterval = undefined;
      }



      this.songTitle = "";
      if (this.settings.getValue("reset-recents"))
        this.empty_recents();
      this.appletRunning = true;
      this.listen_to_last_station();
      this.set_radio_tooltip_to_default_one();
    } else {
      // Some dependencies are missing. Suggest to the user to install them.
      this.appletRunning = false;
      if (!this.dont_check_dependencies) {
        this.checkDepInterval = setInterval(() => this.dependencies.check_dependencies(), 10000);
      }
    }

    if (!this.ytdlp_updated) {
      log("Updating yt-dlp.");
      this.checkYTDLPInterval = setInterval(
        () => {
          let subProcess2 = spawnCommandLineAsyncIO(
            YTDLP_UPDATE_BASH_SCRIPT,
            Lang.bind(this, (out, err, exitCode) => {
              if (exitCode === 0) {
                this.ytdlp_updated = true;
                clearInterval(this.checkYTDLPInterval);
                this.checkYTDLPInterval = undefined;
              } else {
                let icon = new Icon({
                  icon_name: 'webradioreceiver',
                  icon_type: IconType.SYMBOLIC,
                  icon_size: 32
                });
                criticalNotify(_("Please Log Out then Log In"), _("to finalize yt-dlp update"), icon)
              }
              subProcess2.send_signal(9);
            })
          )
        },
        60000
      );
    }

    this.volume_near_icon();
    //~ let cws = JSON.parse(JSON.stringify(this.categories_with_stations));
    //~ logDebug("Nbr of categories: "+Object.keys(cws).length);
    //~ logDebug("categories_with_stations: \n"+JSON.stringify(this.categories_with_stations, null, 4));
  }

  on_applet_removed_from_panel() {
    //log("on_applet_removed_from_panel", true);

    // Stop looping:
    this.appletRunning = false;

    // Stop checks:
    if (this.checkDepInterval != undefined) {
      clearInterval(this.checkDepInterval);
      this.checkDepInterval = undefined;
    }
    if (this.checkYTDLPInterval != undefined) {
      clearInterval(this.checkYTDLPInterval);
      this.checkYTDLPInterval = undefined;
    }

    // Stop mpv:
    this.stop_mpv(false);

    this.radiosHash = {};
    this.radiosHash = null;
    this.oldRadios = "{}";
    this.oldRadios = null;

    if (this._control) this._control.close();
    if (this.menu) this.menu.destroy();
    if (this._applet_context_menu) this._applet_context_menu.destroy();

    // Unmonitor all:
    this.unmonitor_interfaces();
    this.unmonitor_jobs_dir();
    this.unmonitor_mpv_title();
    this.unmonitor_r30stop();
    this.unmonitor_r30previous();
    this.unmonitor_r30next();
    this.unmonitor_rec_folder();

    // Remove shortcuts:
    keybindingManager.removeHotKey("shortcutVolUp");
    keybindingManager.removeHotKey("shortcutVolDown");
    keybindingManager.removeHotKey("shortcutVolCut");
    keybindingManager.removeHotKey("shortcutOnOff");
    keybindingManager.removeHotKey("shortcutNext");
    keybindingManager.removeHotKey("shortcutPrevious");

    // Finalize settings:
    this.settings.finalize();
  }

  _clean_str(str) {
    //log("_clean_str");
    let ret = str.replace(/\\'/gi, "'");
    ret = ret.replace(/\\"/gi, '"');

    // Support &amp;, &quot;, &apos;, &lt; and &gt;, escape all other
    // occurrences of '&'.
    ret = ret.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');

    // Support <b>, <i>, and <u>, escape anything else
    // so it displays as raw markup.
    ret = ret.replace(/<(?!\/?[biu]>)/g, '&lt;');

    try {
      parse_markup(ret, -1, "");
      return ret;
    } catch (e) {
      logError(e);
      return markup_escape_text(ret, -1);
    }
  }

  on_network_monitoring_changed() {
    //log("on_network_monitoring_changed");
    if (this.network_monitoring === true)
      this.monitor_interfaces();
    else
      this.unmonitor_interfaces();
  }

  on_sound_settings() {
    spawnCommandLineAsync("cinnamon-settings sound");
  }

  on_button_radios_save_clicked() {
    if (!this.radios || this.radios.length === 0) {
      this.radio_notify(_("Nothing to save."));
      return;
    }

    let date = DateTime.new_now_local().format("%F_%X").replace(/:/g, "-");
    let radios = this.settings.getValue("radios");

    let fileName = "Radios_" + date + ".json";
    let path = RADIO_LISTS_DIR + "/" + fileName;
    let radio_json = JSON.stringify(radios, null, 4);
    //log("radio_json:"+radio_json, true);
    file_set_contents(path, radio_json);

    this.radio_notify(_("List of saved radio stations"), fileName);

    radios = null;
    path = null;
    fileName = null;
    date = null;
  }

  on_button_radios_restore_clicked() {
    if (this.radios == null) return;

    let filters = [];
    let filter = new FileDialog.Filter("JSON");
    filter.addMimeType("application/json");
    filters.push(filter);

    let params =  { directory: RADIO_LISTS_DIR, filters: filters };
    let messages = [
      _("This will replace all current radio stations."),
      _("Are you sure you want to continue?")
    ];

    new ModalDialog.ConfirmDialog(messages.join("\n"), Lang.bind(this, function() {
      FileDialog.open(Lang.bind(this, function(path) {
        let fileName = path.slice(0,-1);
        let file = file_new_for_path(fileName);

        if ( !file.query_exists(null) ) return;

        let json_contents = JSON.parse((to_string(file_get_contents(fileName)[1])).trim());

        let columns = JSON.parse((to_string(file_get_contents(RADIO30_CONFIG_FILE)[1])).trim()).radios.columns;
        //log("on_button_radios_restore_clicked: columns:"+JSON.stringify(columns, null, 4));

        var ids = [];
        var defaults = [];
        for (let column of columns) {
          ids.push(""+column.id)
          defaults.push(column['default'])
        }
        //log("on_button_radios_restore_clicked: ids:"+ids);
        //log("on_button_radios_restore_clicked: defaults:"+defaults);

        if (ids.length > 0 && json_contents && json_contents.length > 0) {
          let new_radios = [];
          for (let entry of json_contents) {
            let new_station = {};
            for (let id of ids) {
              if (entry[id] != null) {
                new_station[id] = entry[id]
              } else {
                new_station[id] = defaults[ids.indexOf(id)]
              }
            }
            new_radios.push(new_station);
          }
          //log("on_button_radios_restore_clicked: new_radios:"+JSON.stringify(new_radios, null, 4));
          this.settings.setValue("radios", new_radios);
        }
      }), params);
    })).open();
  }

  on_settings_rec_folder_changed() {
    try {
      if (!this.context_menu_item_openRecordingsFolder) return;

      this.context_menu_item_openRecordingsFolder.destroy();
      this.context_menu_item_openRecordingsFolder = null;
    } catch(e) {logError(e)}
  }

  on_button_radios_open_folder_clicked() {
    let appOpeningFolders = app_info_get_default_for_type('inode/directory', false).get_executable(); // usually returns: nemo
    let command = `%s "%s"`.format(appOpeningFolders, RADIO_LISTS_DIR);
    spawnCommandLineAsync(command);
  }

  async on_button_radios_update_clicked() {
    this.radio_notify(_("Update in progress"), _("It may take a while ... Please wait."));
    this.settings.setValue("scale-update", 0);
    this.settings.setValue("show-scale-update", true);

    let stations = this.settings.getValue("radios");
    let nb_real_stations = this.number_of_stations;
    var i = 1;

    for (let station of stations) {
      let uuid_ok = station.uuid != null && isValidUUID(""+station.uuid);
      let url_ok  = station.url  != null && isValidURL(""+station.url);

      if (!uuid_ok && !url_ok) continue; // Ignore categories.

      if (uuid_ok) {
        await this.search_url_by_uuid_on_RDB(station.uuid, (url_ok) ? ""+station.url : null).then(Lang.bind(this, () => {
          //log(""+i+"/"+nb_of_urls+": OK!");
          let scale_value = Math.ceil(100 * (i / nb_real_stations));
          this.settings.setValue("scale-update", scale_value);
        })).catch(e => logError(e))
      } else { // url_ok
        await this.search_uuid_by_url_on_RDB(station.url).then(Lang.bind(this, () => {
          //log(""+i+"/"+nb_of_urls+": OK!");
          let scale_value = Math.ceil(100 * (i / nb_real_stations));
          this.settings.setValue("scale-update", scale_value);
        })).catch(e => logError(e))
      }
      i++
    }
    stations = this.settings.getValue("radios");
    var new_stations = [];
    i = 1;
    for (let station of stations) {
      let id = station.url;
      let uuid = ((station.uuid != null) && isValidUUID(station.uuid)) ? ""+station.uuid : "";
      var new_station = {};
      try {

        if (id && (id.length > 0) && this.radiosHash[id]) {
          //log("NEW: "+i+"/"+nb_of_urls);
          let rh = this.radiosHash[id];
          new_station["inc"] = station.inc;
          new_station["play"] = false;
          new_station["name"] = station.name;

          new_station["codec"] = ((rh.codec != null) &&
            (""+rh.codec != "undefined") && (""+rh.codec.length > 0)
          ) ? ""+rh.codec : (station.codec) ? station.codec : "";

          new_station["bitrate"] = ( (rh.bitrate != null) &&
            (""+rh.bitrate != "undefined") && (""+rh.bitrate.length > 0)
          ) ? ""+rh.bitrate : (station.bitrate) ? station.bitrate : "";

          new_station["url"] = ""+id;

          new_station["uuid"] = (rh.uuid != null && ""+rh.uuid != "undefined") ? ""+rh.uuid : "";

          new_station["homepage"] = ( (rh.homepage != null) &&
            (""+rh.homepage != "undefined") && (""+rh.homepage.length > 0)
          ) ? ""+rh.homepage : (station.homepage) ? station.homepage : "";

          //log(""+station.name+" - tags: "+`${rh.tags}`);
          new_station["tags"] = (`${rh.tags}`.length > 0) ? ""+`${rh.tags}` : "";
          new_station["favicon"] = rh.favicon ? rh.favicon : "";
          new_station["author_title_swap"] = rh.author_title_swap != undefined ? rh.author_title_swap : false;
        } else {
          new_station["inc"] = station.inc;
          new_station["play"] = false;
          new_station["name"] = station.name;
          new_station["codec"] = (station.codec && (station.codec.length > 0)) ? station.codec : "";
          new_station["bitrate"] = (station.bitrate && (station.bitrate.length > 0)) ? station.bitrate : "";
          new_station["url"] = ""+id;
          new_station["uuid"] = "";
          new_station["homepage"] = (station.homepage && (station.homepage.length > 0)) ? station.homepage : "";
          new_station["tags"] = "";
          new_station["favicon"] = (station.favicon && (station.favicon.length > 0)) ? station.favicon : "";
          new_station["author_title_swap"] = station.author_title_swap != undefined ? station.author_title_swap : false;
        }

        new_stations.push(new_station);
        i++
      } catch(e) {
        logError(e)
      }
    }
    this.settings.setValue("radios", new_stations);

    this.settings.setValue("scale-update", 0);
    this.settings.setValue("show-scale-update", false);

    this.radio_notify(_("Update completed successfully"));
  }

  //~ async on_button_radios_update_clicked_OLD() {
    //~ //FIXME!: Make update in two times: firstly for stations wich have uuid, then for those they don't.
    //~ this.radio_notify(_("Update in progress"), _("It may take a while ... Please wait."));
    //~ this.settings.setValue("scale-update", 0);
    //~ this.settings.setValue("show-scale-update", true);
    //~ let urls = this.radio_urls;
    //~ let nb_of_urls = urls.length;
    //~ var i = 1;
    //~ for (let url of urls) {
      //~ await this.search_uuid_by_url_on_RDB(url).then(Lang.bind(this, () => {
        //~ //log(""+i+"/"+nb_of_urls+": OK!");
        //~ let scale_value = Math.ceil(100 * (i / nb_of_urls));
        //~ this.settings.setValue("scale-update", scale_value);
      //~ })).catch(e => logError(e));
      //~ i++
    //~ }
    //~ this.settings.setValue("scale-update", 100);

    //~ urls = null;

    //~ let stations = this.settings.getValue("radios");
    //~ var new_stations = [];
    //~ i = 1;
    //~ for (let station of stations) {
      //~ let id = station.url;
      //~ let uuid = ((station.uuid != null) && (station.uuid.length > 0)) ? ""+station.uuid : "";
      //~ var new_station = {};
      //~ try {

        //~ if ((id != null) && (id.length > 0) && this.radiosHash[id]) {
          //~ //log("NEW: "+i+"/"+nb_of_urls);
          //~ let rh = this.radiosHash[id];
          //~ new_station["inc"] = station.inc;
          //~ new_station["play"] = false;
          //~ new_station["name"] = station.name;

          //~ new_station["codec"] = ((rh.codec != null) &&
            //~ (""+rh.codec != "undefined") && (""+rh.codec.length > 0)
          //~ ) ? ""+rh.codec : (station.codec) ? station.codec : "";

          //~ new_station["bitrate"] = ( (rh.bitrate != null) &&
            //~ (""+rh.bitrate != "undefined") && (""+rh.bitrate.length > 0)
          //~ ) ? ""+rh.bitrate : (station.bitrate) ? station.bitrate : "";

          //~ new_station["url"] = ""+id;

          //~ new_station["uuid"] = (rh.uuid != null && ""+rh.uuid != "undefined") ? ""+rh.uuid : "";

          //~ new_station["homepage"] = ( (rh.homepage != null) &&
            //~ (""+rh.homepage != "undefined") && (""+rh.homepage.length > 0)
          //~ ) ? ""+rh.homepage : (station.homepage) ? station.homepage : "";

          //~ //log(""+station.name+" - tags: "+`${rh.tags}`);
          //~ new_station["tags"] = (`${rh.tags}`.length > 0) ? ""+`${rh.tags}` : "";
          //~ new_station["favicon"] = rh.favicon.length > 0 ? ""+rh.favicon : "";
        //~ } else {
          //~ //log("OLD: "+i+"/"+nb_of_urls);
          //~ new_station["inc"] = station.inc;
          //~ new_station["play"] = false;
          //~ new_station["name"] = station.name;
          //~ new_station["codec"] = (station.codec && (station.codec.length > 0)) ? station.codec : "";
          //~ new_station["bitrate"] = (station.bitrate && (station.bitrate.length > 0)) ? station.bitrate : "";
          //~ new_station["url"] = ""+id;
          //~ new_station["uuid"] = "";
          //~ new_station["homepage"] = (station.homepage && (station.homepage.length > 0)) ? station.homepage : "";
          //~ //log(""+station.name+" - tags: "+`${station.tags}`);
          //~ new_station["tags"] = "";
          //~ new_station["favicon"] = "";
        //~ }

        //~ new_stations.push(new_station);
        //~ i++
      //~ } catch(e) {
        //~ logError(e)
      //~ }
    //~ }

    //~ this.settings.setValue("radios", new_stations);

    //~ this.radio_notify(_("Update completed successfully"));


    //~ this.settings.setValue("scale-update", 0);
    //~ this.settings.setValue("show-scale-update", false)
  //~ }

  on_option_menu_reload_this_applet_clicked() {
    //log("on_option_menu_reload_this_applet_clicked");
    this.stop_mpv(false);
    // Reload this applet
    reloadExtension(UUID, Type.APPLET);
  }

  on_switch_on_last_station_at_start_up() {
    //log("on_switch_on_last_station_at_start_up");
    if (this._applet_context_menu == null || this.context_menu_item_onAtStartup == null) return;

    let items = this._applet_context_menu._getMenuItems();
    let index = items.indexOf(this.context_menu_item_onAtStartup);

    if (index > -1 && this.context_menu_item_onAtStartup._switch.state != this.switch_on_last_station_at_start_up) {
      this.context_menu_item_onAtStartup._switch.setToggleState(this.switch_on_last_station_at_start_up);
    }
  }

  on_switch_show_favicon() {
    //log("on_switch_on_last_station_at_start_up");
    if (this._applet_context_menu == null || this.context_menu_item_showLogo == null) return;

    let items = this._applet_context_menu._getMenuItems();
    let index = items.indexOf(this.context_menu_item_showLogo);

    if (index > -1 && this.context_menu_item_showLogo._switch.state != this.show_favicon) {
      this.context_menu_item_showLogo._switch.setToggleState(this.show_favicon);
    }

    this.icon_or_favicon(this.radioId);
  }

  on_button_radios_moving_clicked() {
    let to_category = ""+this.settings.getValue("category-to-move");
    if (to_category.length == 0) return;

    let radios = this.settings.getValue("radios");
    var removed = [];
    var category_index = -1;

    // Removes selected stations from radios; stores them in 'removed':
    var i = 0;
    while (i < radios.length) {
      if (radios[i].play === true) {
        radios[i].play = false;
        removed = removed.concat(radios.splice(i, 1));
      } else {
        i++;
      }
    }
    if (removed.length == 0) return;

    // Determines the index of the category:
    for (let r in radios) {
      if (radios[r].name.trim().localeCompare(to_category.trim()) == 0 && radios[r].url.length === 0) {
        category_index = r;
        break
      }
    }

    // Put the selected stations at the right place, just below the category's title:
    while (removed.length > 0) {
      let station = removed.pop();
      radios.splice(Math.ceil(category_index) + 1, 0, station);
    }

    // Rewrite radios:
    let id = setTimeout(() => {
      this.settings.setValue("radios", radios);
      radios = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_radios_go_to_category_clicked() {
    let to_category = ""+this.settings.getValue("category-to-move");
    if (to_category.length == 0) return;

    let radios = this.settings.getValue("radios");
    var category_index = -1;

    for (let r in radios) {
      if (radios[r].name.trim().localeCompare(to_category.trim()) == 0 && radios[r].url.length === 0) {
        category_index = r;
        break
      }
    }

    file_set_contents(CATEGORY_ROW_FILE, ""+category_index)
  }

  set_show_all_radios_to(show=true) {
    if (!this.radios || this.radios.length == 0) return;

    var radios = this.settings.getValue("radios");

    for (let i=0, _length=radios.length; i<_length; i++) {
      radios[i].inc = show;
    }

    // Rewrite radios:
    let id = setTimeout(() => {
      this.settings.setValue("radios", radios);
      radios = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_radios_show_all_clicked() {
    this.set_show_all_radios_to(true)
  }

  on_button_radios_hide_all_clicked() {
    this.set_show_all_radios_to(false)
  }

  on_button_paste_clicked() {
    this.clipboard.get_text(ClipboardType.CLIPBOARD, Lang.bind(this,
      function(clipboard, text) {
        if (!text || !text.startsWith("https://www.youtube.com/")) {
          this.radio_notify(_("ERROR: Invalid YT video URL!"));
          return
        }
        this.settings.setValue("recordings-extract-url", text)
      }
    ));
  }

  on_button_extract_clicked() {
    let ytdl_program = ""+YTDL_PROGRAM();
    let yt_url = this.settings.getValue("recordings-extract-url");
    let isList = yt_url.includes("list=");

    let yes_no_playlist = " --no-playlist";

    if (isList) {
      yes_no_playlist = this.settings.getValue("recordings-yesno-playlist");
      if (yes_no_playlist != " --no-playlist" && yt_url.includes("watch?v=")) {
        yt_url = yt_url.replace(/watch\?v=.*&list=/, "playlist?list="); // Removes video reference.
        yt_url = yt_url.replace(/&index=.*/, ""); // Removes index of playlist.
      } else if (yes_no_playlist === " --no-playlist") {
        if (yt_url.includes("watch?v=")) {
          yt_url = yt_url.replace(/&list=.*/, ""); // Removes the reference to the list.
          isList = false
        } else {
          this.radio_notify(_("Unable to extract a single soundtrack"), _("Maybe it's a playlist?"));
          return
        }
      }
    }

    let dir = ""+RADIO30_MUSIC_DIR;
    let subdir = ""+this.settings.getValue("recordings-subdirectory");
    let dir_to_open = ""+dir;

    // subdir entry has precedence on `%(channel)s` in case of playlist:
    if (subdir.length > 0) {
      // Remove leading slashes:
      while (subdir.startsWith("/")) subdir = subdir.slice(1, subdir.length);
      // Remove trailing slashes:
      while (subdir.endsWith("/")) subdir = subdir.slice(0, -1);
      dir = ""+dir+"/"+subdir;
      dir_to_open = ""+dir
    } else if (isList) {
      dir = ""+dir+"/"+`%(channel)s`;
      dir_to_open = ""+dir;

    }
    if (yes_no_playlist != " --no-playlist") dir_to_open += `/%(playlist)s`;

    let is_valid_url =
      yt_url.startsWith("https://www.youtube.com/") &&
      (yt_url.includes("v=") || yt_url.includes("list="));

    if (!is_valid_url) {
      this.radio_notify(
        _("ERROR: Invalid YT video URL!"),
        yt_url,
        [_("Close"), "callback", () => {}]
      );
      return
    }

    let proxy = ""+this.settings.getValue("http-proxy");
    proxy = proxy.trim();
    let proxy_option = "";
    if (proxy.length > 0) proxy_option = ` --proxy "%s"`.format(proxy);

    let cookies_option = "";
    let no_abort_option = "";
    if (ytdl_program.includes("yt-dlp")) {
      if (this.cookies_from.length > 0)
        cookies_option = " --cookies-from-browser "+this.cookies_from;
      no_abort_option = " --no-abort-on-error";
    }

    let yt_title_and_dir_command = `%s%s%s%s --flat-playlist -i -c -w -e --get-filename --output "%s" "%s"`.format(
      ytdl_program,
      proxy_option,
      cookies_option,
      no_abort_option,
      dir_to_open,
      yt_url
    );
    //~ log("yt_title_and_dir_command: "+yt_title_and_dir_command);

    let titles = [];
    let title = "";

    this.change_symbolic_icon("animated");

    if (this.rot_interval === 0) {
      this.rot_interval = setInterval(() => {
        if (this.do_rotation) {
          this.icon_rotate()
        } else {
          clearInterval();
          this.rot_interval = 0
        }
      }, 50);
    }

    let subProcess = spawnCommandLineAsyncIO(yt_title_and_dir_command, Lang.bind(this, (out, err, exitCode) => {
      var errors = [];
      if (err.length > 0) {
        let all_errors = err.trim().split("\n");
        for (let e of all_errors) {
          let e_trim = e.trim();
          if (!e_trim.includes(" INFO "))
            errors.push(""+e_trim);
        }
      }

      if (out == null || exitCode !== 0 || errors.length > 0) {
        if (err.length > 0) {
          this.radio_notify(
            _("An error seems to have occurred during recording!"),
            //_("Please check this record.") + "\n" + err.trim().slice(0, Math.min(100, err.length)),
            _("Please check this record.") + "\n" + errors.join("\n"),
            [ _("Open the recordings folder"),
              "callback",
              () => {spawnCommandLineAsync(`bash -c 'xdg-open "%s"'`.format(RADIO30_MUSIC_DIR))}
            ]
          );
        } else if (exitCode !== 0) {
          this.radio_notify(
            _("An error seems to have occurred during recording!"),
            _("Please check this record.") + "\nExitCode: " + exitCode,
            [ _("Open the recordings folder"),
              "callback",
              () => {spawnCommandLineAsync(`bash -c 'xdg-open "%s"'`.format(RADIO30_MUSIC_DIR))}
            ]
          );
        } else if (out == null) {
          this.radio_notify(
            _("An error seems to have occurred during recording!"),
            _("Please check this record.") + "\nOutput is null!",
            [ _("Open the recordings folder"),
              "callback",
              () => {spawnCommandLineAsync(`bash -c 'xdg-open "%s"'`.format(RADIO30_MUSIC_DIR))}
            ]
          );
        }


        if (this.yt_downloads.length === 0) {
          this.change_symbolic_icon()
        }
        return;
      }

      if (!dir.includes(`%(channel)s`)) mkdir_with_parents(""+dir, 0o755);

      let keep_video = this.settings.getValue("recordings-keep-video") ? " -k" : "";

      let output_options = `%s%s --output "%s/`.format(ytdl_program, keep_video,
        dir)+`%(title)s`+`.%(ext)s"`;

      let yes_no_playlist = " --no-playlist";

      if (isList) {
        yes_no_playlist = this.settings.getValue("recordings-yesno-playlist");
        if (yes_no_playlist != " --no-playlist") {
          output_options = `%s%s -i -c -w --output "%s/`.format(ytdl_program, keep_video,
            dir)+`%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"`;
        }
      }

      let downloader = "";

      // TODO: Using aria2c (a speed downloader) needs to analyze its output (which displays no percentage but remaining time).
      //if (find_program_in_path("aria2c") != null) downloader = " --external-downloader aria2c";

      let i = 0;
      let indexes = [];
      var real_dir = ""+RADIO30_MUSIC_DIR;
      for (let line of out.trim().split("\n")) {
        if (i % 2 === 0) {
          if (!line.startsWith("[Private video]")) {
            titles.push(""+line.trim());
            indexes.push(""+(i/2 + 1))
          }
        } else if (i === 1) {
          real_dir = ""+line.trim();
        }
        i+=1
      }
      let str_indexes = this.to_ranges(indexes);

      let items_option = ""
      if (indexes.length > 0) items_option = ` --playlist-items `+str_indexes;

      let yt_dl_command = output_options
        + proxy_option
        + cookies_option
        + no_abort_option
        + yes_no_playlist
        + downloader
        + items_option
        +` --buffer-size 4096 -x --audio-format %s --audio-quality 0 --add-metadata --embed-thumbnail --newline "%s"`.format(
        ""+this.rec_format.toLowerCase(),
        ""+yt_url
      );

      //~ log("yt_dl_command: "+yt_dl_command);

      title = titles.join("\n");

      this.download_from_YT(title, yt_dl_command, "%s".format(real_dir));

      subProcess.send_signal(9);
    }));
  }

  on_button_YT_open_dir() {
    spawnCommandLineAsync(`bash -c 'xdg-open "%s/%s"'`.format(
      RADIO30_MUSIC_DIR,
      this.settings.getValue("recordings-subdirectory")
    ))
  }

  //~ on_network_button_favDB_clicked() {
    //~ this.database_url = ""+this.database_favorite;
    //~ this.settings._checkSettings();
  //~ }

  to_ranges(arr) {
    // Ex: arr = ['1', '2', '3', '5', '7', '8', '9']
    if (arr.length === 0) return "";
    if (arr.length < 3) return arr.join(',');
    var new_indexes = [];

    var i = 0;
    let myArray = arr;
    var elt = 1*myArray[i];
    var first_elt = elt;
    var next_elt = 1*myArray[i+1];
    var ok = (elt+1 == next_elt);

    myArray.forEach(function(item, index) {
      if (index > 0) {
        if (1*elt+1 === 1*item) {
          ok = true
        } else {
          if (ok) {
            new_indexes.push(""+first_elt+"-"+elt);
            first_elt = 1*item;
            ok = false;
          } else {
            new_indexes.push(""+elt);
            first_elt = 1*item;
            ok = true;
          }
        }
        elt = 1*item
        if (index == myArray.length -1 ) {
          if (ok) new_indexes.push(""+first_elt+"-"+elt);
          else new_indexes.push(""+item);
        }
      }
    }, elt)

    return new_indexes.join(',')
  }

  finalizeContextMenu() {
    //~ logDebug("finalizeContextMenu");

    // Add default context menus if we're in panel edit mode, ensure their removal if we're not
    if (this.context_menu_item_manageRecording)
      this.context_menu_item_manageRecording.destroy();
    this.context_menu_item_manageRecording = null;

    let items = this._applet_context_menu._getMenuItems();
    //~ logDebug("items.length: "+items.length);

    // About...
    if (this.context_menu_item_about == null) {
      this.context_menu_item_about = new PopupIconMenuItem(_("About..."),
        "dialog-question",
        IconType.SYMBOLIC);
      this.context_menu_item_about.connect('activate', Lang.bind(this, this.openAbout));
    }
    //~ if (this.context_menu_item_about == null)
      //~ logDebug("Unable to create this.context_menu_item_about!!!");
    //~ else
      //~ logDebug("this.context_menu_item_about is well created!!!");
    if (items.indexOf(this.context_menu_item_about) == -1) {
      this._applet_context_menu.addMenuItem(this.context_menu_item_about);
    }

    // Web page...
    if (this.context_menu_item_webpage == null) {
      this.context_menu_item_webpage = new R3WebpageMenuItem(this, this.score);
    }
    if (items.indexOf(this.context_menu_item_webpage) == -1) {
      this._applet_context_menu.addMenuItem(this.context_menu_item_webpage);
    }

    // Manual...
    if (this.context_menu_item_manual == null) {
      this.context_menu_item_manual = new PopupIconMenuItem(_("Manual..."),
        "help-faq", //"gtk-help",
        IconType.SYMBOLIC);
      this.context_menu_item_manual.connect('activate', Lang.bind(this, this.openManual));
    }
    if (items.indexOf(this.context_menu_item_manual) == -1) {
      this._applet_context_menu.addMenuItem(this.context_menu_item_manual);
    }

    // Separator
    if (this.context_menu_separator == null && this._applet_context_menu.numMenuItems > 0) {
      this.context_menu_separator = new PopupSeparatorMenuItem();
      this._applet_context_menu.addMenuItem(this.context_menu_separator);
    }

    // Configure and Schedule a recording
    if (!this._meta["hide-configuration"] && file_test(this._meta["path"] + "/settings-schema.json", FileTest.EXISTS)) {
      //this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
      if (this.context_menu_item_configure == null) {
        this.context_menu_item_configure = new PopupIconMenuItem(_("Configure..."),
          "system-run",
          IconType.SYMBOLIC);
        this.context_menu_item_configure.connect('activate', Lang.bind(this, this.configureApplet));
      }
      if (items.indexOf(this.context_menu_item_configure) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
      }

      if (this.context_menu_item_scheduleARecording != null)
        this.context_menu_item_scheduleARecording.destroy();
      this.context_menu_item_scheduleARecording = null;

      this.context_menu_item_scheduleARecording = new PopupIconMenuItem(_("Schedule a background record..."),
        "system-run",
        IconType.SYMBOLIC);
      this.context_menu_item_scheduleARecording.connect('activate', Lang.bind(this, () => this.configureApplet(this.tabNumberOfScheduling)));

      if (items.indexOf(this.context_menu_item_scheduleARecording) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_scheduleARecording);
      }

      if (this.context_menu_item_recording != null)
        this.context_menu_item_recording.destroy();
      this.context_menu_item_recording = null;
      this.context_menu_item_recording = new PopupIconMenuItem(_("Extract soundtrack from YouTube video..."),
        "yt",
        IconType.SYMBOLIC);
      this.context_menu_item_recording.connect('activate', Lang.bind(this, () => this.configureApplet(this.tabNumberOfYT)));

      if (items.indexOf(this.context_menu_item_recording) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_recording);
      }
    }

    // Sound Settings
    if (this.context_menu_item_systemSoundSettings == null) {
      this.context_menu_item_systemSoundSettings = new PopupIconMenuItem(_("Sound Settings"), "audio-card", IconType.SYMBOLIC);
      this.context_menu_item_systemSoundSettings.connect('activate', () => { spawnCommandLine("cinnamon-settings sound") });
      if (items.indexOf(this.context_menu_item_systemSoundSettings) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_systemSoundSettings);
      }
    }

    // PulseEffects (if any)
    if (find_program_in_path("pulseeffects") && this.context_menu_item_pulseEffects == null) {
      this.context_menu_item_pulseEffects = new PopupIconMenuItem(_("Pulse Effects"), "pulseeffects", IconType.SYMBOLIC);
      this.context_menu_item_pulseEffects.connect('activate', async () => { spawnCommandLine("pulseeffects") });
      if (items.indexOf(this.context_menu_item_pulseEffects) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_pulseEffects);
      }
    }

    // Remove applet
    if (this.context_menu_item_remove == null) {
      this.context_menu_item_remove = new PopupIconMenuItem(_("Remove '%s'")
        .format(this._(this._meta.name)),
          "edit-delete",
          IconType.SYMBOLIC);
      this.context_menu_item_remove.connect('activate', (actor, event) => this.confirmRemoveApplet(event));
    }
    if (items.indexOf(this.context_menu_item_remove) == -1) {
      this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
      this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
    }

    // Radio ON at startup
    if (this.context_menu_item_onAtStartup == null) {
        this.context_menu_item_onAtStartup = new PopupSwitchMenuItem(_("Radio ON at startup"),
          this.switch_on_last_station_at_start_up,
          null);
        this.context_menu_item_onAtStartup.connect("toggled", Lang.bind(this, function() {
          this.switch_on_last_station_at_start_up = !this.switch_on_last_station_at_start_up;
        }));
    }
    if (items.indexOf(this.context_menu_item_onAtStartup) == -1) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this._applet_context_menu.addMenuItem(this.context_menu_item_onAtStartup);
    }

    // Show Station Logo
    if (this.context_menu_item_showLogo == null) {
        this.context_menu_item_showLogo = new PopupSwitchMenuItem(_("Display Station Logo"),
          this.show_favicon,
          null);
        this.context_menu_item_showLogo.connect("toggled", Lang.bind(this, function() {
          this.show_favicon = !this.show_favicon;
          this.icon_or_favicon(this.radioId);
        }));
    }
    if (items.indexOf(this.context_menu_item_showLogo) == -1) {
        this._applet_context_menu.addMenuItem(this.context_menu_item_showLogo);
    }

    // Do not check about dependencies
    if (this.context_menu_item_dontCheckDep == null) {
        this.context_menu_item_dontCheckDep = new PopupSwitchMenuItem(_("Do not check about dependencies"),
          this.dont_check_dependencies,
          null);
        this.context_menu_item_dontCheckDep.connect("toggled", Lang.bind(this, function() {
          this.dont_check_dependencies = !this.dont_check_dependencies;
          this.on_option_menu_reload_this_applet_clicked();
        }));
    }
    if (items.indexOf(this.context_menu_item_dontCheckDep) == -1) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this._applet_context_menu.addMenuItem(this.context_menu_item_dontCheckDep);
    }

    // Open Recordings Folder
    if (this.context_menu_item_openRecordingsFolder != null) {
      this.context_menu_item_openRecordingsFolder.destroy();
    }
    this.context_menu_item_openRecordingsFolder = null;

    this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());

    this.context_menu_item_openRecordingsFolder = new PopupIconMenuItem(
      _("Open the recordings folder"),
      "folder-music",
      IconType.SYMBOLIC
    );
    this.context_menu_item_openRecordingsFolder.connect("activate", Lang.bind(this, function(event) {
      this.open_rec_folder()
    }));

    this._applet_context_menu.addMenuItem(this.context_menu_item_openRecordingsFolder);


    // Start / Stop recording:
    if (this.mpvStatus == "PLAY" && this.context_menu_item_manageRecording == null) {
      let record_pid = this.record_pid;
      let recording = (record_pid != null);

      this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
      let message_about_ending_recording = this.get_recording_ends_auto() ? _("(auto)") : _("(manual)");
      let sufficient_space_left = this.check_hd_space_left(false);
      this.context_menu_item_manageRecording = new PopupIconMenuItem(
        recording ? _("Stop Recording") + "\n" + message_about_ending_recording : sufficient_space_left ? _("Start Recording") : _("Insufficient space"),
        recording ? "media-playback-stop": sufficient_space_left ? "media-record" : "music-folder-full",
        IconType.SYMBOLIC
      );
      this.context_menu_item_manageRecording.connect("activate", Lang.bind(this, function(event) {
        if (recording) {
          this.stop_recording(record_pid)
        } else if (sufficient_space_left) {
          this.start_recording()
        } else {
          this.configureApplet(this.tabNumberOfRecording)
        }
      }));

      this._applet_context_menu.addMenuItem(this.context_menu_item_manageRecording);
    }

    // Reload this applet
    if (RELOAD() === true || this.show_reload) {
      if (this.context_menu_item_reloadThisApplet == null) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this.context_menu_item_reloadThisApplet = new PopupIconMenuItem(_("Reload this applet"), "reload", IconType.SYMBOLIC);
        this.context_menu_item_reloadThisApplet.connect("activate", (event) => this.on_option_menu_reload_this_applet_clicked());
      }
    } else {
      if (this.context_menu_item_reloadThisApplet != null) {
        this.context_menu_item_reloadThisApplet.destroy();
        this.context_menu_item_reloadThisApplet = null;
      }
    }
    if (this.context_menu_item_reloadThisApplet != null && items.indexOf(this.context_menu_item_reloadThisApplet) == -1) {
      this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
      this._applet_context_menu.addMenuItem(this.context_menu_item_reloadThisApplet);
    }

    // Display volume level near icon?
    if (this.context_menu_item_showVolumeNearIcon == null) {
        this.context_menu_item_showVolumeNearIcon = new PopupSwitchMenuItem(_("Display volume level near icon"),
          this.show_volume_level_near_icon,
          null);
        this.context_menu_item_showVolumeNearIcon.connect("toggled", Lang.bind(this, function() {
          this.show_volume_level_near_icon = !this.show_volume_level_near_icon;
          this.volume_near_icon();
        }));
    }
    if (items.indexOf(this.context_menu_item_showVolumeNearIcon) == -1) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this._applet_context_menu.addMenuItem(this.context_menu_item_showVolumeNearIcon);
    }

    // Submenu Cancel YT downloads
    if (this.submenu_cancel_yt_downloads != null)
      this.submenu_cancel_yt_downloads.destroy();
    this.submenu_cancel_yt_downloads = null;
    if (this.context_menu_yt_downloads.length > 0) {
      this.submenu_cancel_yt_downloads = new RadioPopupSubMenuMenuItem(_("Cancel downloads from YT"));
      this._applet_context_menu.addMenuItem(this.submenu_cancel_yt_downloads);

      for (let dl of this.context_menu_yt_downloads) {
        // dl[0] contains the title; dl[1] contains the callback.
        let submenu_cancel_yt_downloads_item = new PopupMenuItem(dl[0], { reactive: true });
        submenu_cancel_yt_downloads_item.connect('activate', () => {
          dl[1]();
          this.set_applet_label("");
          let i = this.yt_downloads.indexOf(dl[0]);
          this.yt_downloads.splice(i, 1);
          this.context_menu_yt_downloads.splice(i, 1);
          if (this.yt_downloads.length === 0) {
            this.change_symbolic_icon()
          }
        });
        this.submenu_cancel_yt_downloads.menu.addMenuItem(submenu_cancel_yt_downloads_item);
      }
    }

  }

  open_rec_folder() {
    spawnCommandLineAsync(app_info_get_default_for_type('inode/directory', false).get_executable() + " " + this.rec_folder);
  }

  _onStreamAdded(control, id) {
    //log("_onStreamAdded");
    let stream = this._control.lookup_stream_id(id);
    let name = ""+stream.name;
    name = name.toLowerCase();

    //log("  name: " + name);
    if (!name.startsWith("mpv")) return;
    //log("   That's Mpv Media Player!!!");

    this.stream = stream;
    this.streamId = id;

    if (this.context_menu_item_slider != null) {
      this.context_menu_item_slider.emit("destroy");
      //this.context_menu_item_slider.destroy();
      this.context_menu_item_slider = null;
    }

    this.context_menu_item_slider = new VolumeSlider.StreamMenuSection(this, this.stream);
    this._applet_context_menu.addMenuItem(this.context_menu_item_slider);

    this._set_default_volume();
    //log("   Stream Added!");
  }

  _onStreamRemoved(control, id) {
    //log("_onStreamRemoved");
    if (this.streamId == null || id !== this.streamId) return;

    if (this.context_menu_item_slider == null) return;

    this.context_menu_item_slider.emit("destroy");
    //this.context_menu_item_slider.destroy();
    this.context_menu_item_slider = null;
    this.stream = null;
    this.streamId = null;
    //log("Stream Removed!");
  }

  radio_notify(msg, submsg="", button=[]) {
    //log("radio_notify:  msg:" + msg + " - submsg: " + submsg);

    RADIO_NOTIFICATION_TIMEOUT = 2;

    let icon = new Icon();
    icon.set_icon_name("webradioreceiver");
    icon.set_icon_type(IconType.SYMBOLIC);
    icon.set_icon_size(24);

    let notification = new Notification(source, msg, submsg, { icon: icon, silent: true });
    notification.setTransient(false);

    if (button.length === 3 && this.notif_buttons_allowed) {
      RADIO_NOTIFICATION_TIMEOUT = 1*this.get_notifwbuttons_timeout();

      if (button[1] === "callback") {
        notification.addButton("callback", button[0]); // button[0]: label
        notification.connect("action-invoked", button[2]); // button[2]: callback
        source.notify(notification);
        return notification;
      } else if (this.record_pid != null && !this.get_recording_ends_auto() && button[1] !== "stop-recording") {
        notification.addButton("stop-recording", _("Stop Current Recording"));
      } else {
        // button structure: [label, action, command]
        notification.addButton(button[1], button[0]);
      }

      notification.connect("action-invoked", Lang.bind(this, function(self, action) {  // function(self, action)


        notification.setResident(true);

        if (action === "stop-recording") {
          if (this.stopRecordingId != null) {
            clearTimeout(this.stopRecordingId);
            this.stopRecordingId = null;
          }

          this.stop_recording(this.record_pid);
          notification.setUrgency(0);
          notification.setResident(false);
          notification.destroy(3);

          return
        }

        if (action === button[1]) {
          this.screensaver_inhibitor.inhibit_screensaver();

          if (this.stopRecordingId != null) {
            clearTimeout(this.stopRecordingId);
            this.stopRecordingId = null;
            this.stop_recording(this.record_pid);
          }

          notification.setTransient(false);
          notification.setUrgency(3);
          if (this.record_pid != null) {
            spawnCommandLine("kill -15 " + this.record_pid);
            this.record_pid = null;
            this.updateUI();
          }

          let pid = trySpawnCommandLine(button[2]);
          this.record_pid = pid;

          this.notifications_about_recordings[""+pid] = notification;
          this.updateUI();
          notification.clearButtons();
          //notification.resident = true;
          notification.addButton("stop-recording", _("Stop Recording"));
          notification.addButton("close-and-continue", _("Close without stopping recording"));
          notification.connect("action-invoked", Lang.bind(this, function(self, action) {
            //log("action: "+action);
            //log("pid: "+pid);
            if (action === "stop-recording") {
              this.stop_recording(pid);
            } else if (action === "close-and-continue") {
              notification.setUrgency(0);
              notification.setResident(false);
              notification.destroy(3);
              delete this.notifications_about_recordings[""+pid];
            }
          }));
        }
      }));
    }

    source.notify(notification);
    return notification;
  }

  set_scheduling_tab() {
    let now = DateTime.new_now_local();
    now = now.add_minutes(2);

    this.settings.setValue("sched-begin-date", {"y": now.get_year(), "m": now.get_month(), "d": now.get_day_of_month()});
    this.settings.setValue("sched-begin-time", {"h": now.get_hour(), "m": now.get_minute(), "s": 0});

    let radios = this.settings.getValue("radios");
    var sched_radios_options = {};

    if (radios && radios.length > 0) {
      var items = Object.keys(radios).map((key) => { return [radios[key].name, radios[key].url] });

      // Sort the items array based on the first element (the name)
      items.sort( (a, b) => { return a[0] > b[0] });

      for (let item of items)
        if (item[1] && item[1].length > 0) // Ignores categories
          sched_radios_options[item[0]] = item[1];

      this.settings.setOptions("sched-radio", sched_radios_options);
      this.settings.setValue("sched-radio", (this.settings.getValue("scheduling-allowed")) ? this.last_radio_listened_to : "");
    } else {
      sched_radios_options[""+_("(Undefined)")] = "";
      this.settings.setOptions("sched-radio", sched_radios_options);
      this.settings.setValue("sched-radio", "");
    }

    //radios = null;

  }

  set_radios_tab() {
    let old_categories = this.settings.getOptions("category-to-move");
    let categories = {};
    categories["%s".format(_("(Undefined)"))] = "";
    for (let cat of this.station_categories) {
      categories[""+cat] = ""+cat;
    }

    let old_items = Object.keys(old_categories).map((key) => { return old_categories[key] });
    //log("old_items: "+old_items, true);
    let items = Object.keys(categories).map((key) => { return categories[key] });
    //log("items: "+items, true);
    var new_items = [];
    Object.keys(categories).map((key) => {
      if (old_items.indexOf(categories[key]) < 0) new_items.push(""+categories[key]); //return categories[key];
      //else return null;
    });
    //log("new_items: "+new_items, true);

    this.settings.setOptions("category-to-move", categories);
    this.settings.setValue("category-to-move", "")
  }

  _set_settings_options() {
    //global.log("_set_settings_options");

    this.set_radios_tab();
    this.set_scheduling_tab();

    if (this.page_label != undefined)
      this.settings.setValue("search-list-page-label", ""+this.page_label);
    else {
      if (this.settings.getValue("search-list").length === 0)
        this.settings.setValue("search-list-page-label", ""+this.settings.getValue("search-page"));
      else
        this.settings.setValue("search-list-page-label", ""+(this.settings.getValue("search-page")-1));
    }

    let _idto = setTimeout(Lang.bind(this, () => {
      file_set_contents(UPDATE_OPTIONS_FILE, ""+uuid_string_random());
      clearTimeout(_idto);
    }), 300);


    //if (this.settingsWindow != undefined) {
      //this.settingsWindow.delete(300); // 300 ms before deleting ; 0 is unauthorized.
      //this.configureApplet((this.settingsTab != undefined) ? this.settingsTab : 0);
    //}
  }

  _set_settings_options_from_radios() {
    this.settingsTab = 0;
    this._set_settings_options()
  }

  _set_settings_options_from_sched() {
    this.settingsTab = this.tabNumberOfScheduling;
    this._set_settings_options()
  }

  openManual() {
    spawnCommandLineAsync('xdg-open "%s"'.format(MANUAL_HTML))
  }

  configureApplet(tab=0, maximize_vertically=true) {
    this.menu.close(false);

    let nemo_size_prefixes = get_nemo_size_prefixes();
    if (nemo_size_prefixes !== this.size_prefixes) {
      this.size_prefixes = nemo_size_prefixes
    }

    this.settingsWindow = undefined;

    this._set_settings_options();

    let pid = spawnCommandLine(XS_PATH + " applet " + this._uuid + " -i " + this.instance_id + " -t " + tab);

    if (maximize_vertically) {
      var app = null;
      var intervalId = null;
      intervalId = setInterval(() => {
        app = this.tracker.get_app_from_pid(pid);
        if (app != null) {
          let window = app.get_windows()[0];
          this.settingsTab = tab;
          //window.default_width = 1000;
          //window.default_height = 600;
          // window.resize(QUEUE, 1000, 600); // Obsolete.
          window.maximize(VERTICAL);
          window.activate(300);
          this.settingsWindow = window;

          clearInterval(intervalId);
          return false;
        } else {
          return true
        }
      }, 100);
    }

    // Returns the pid:
    return pid;
  }

  /// Scheduling ///
  on_button_sched_clicked() {
    //log("on_button_sched_clicked");
    let radio =  this.settings.getValue("sched-radio");
    let radioName = this._clean_str(this.get_radio_name(radio));
    let job_uid = uuid_string_random();

    let begin_date = this.settings.getValue("sched-begin-date");
    let begin_time = this.settings.getValue("sched-begin-time");
    let begin_datetime = DateTime.new_local(
      begin_date.y,
      begin_date.m,
      begin_date.d,
      begin_time.h,
      begin_time.m,
      begin_time.s
    );

    let duration = this.settings.getValue("sched-duration");
    let duration_minutes = (duration.s > 0) ? 1 + duration.m : duration.m;
    let nb_seconds = 3600 * duration.h + 60 * duration_minutes;

    let end_datetime = begin_datetime.add_seconds(nb_seconds);

    let at_begin_time = "%s%s%s%s%s.00".format(
      (begin_date.y < 100) ? "20"+begin_date.y : ""+begin_date.y,
      (begin_date.m < 10) ? "0"+begin_date.m : ""+begin_date.m,
      (begin_date.d < 10) ? "0"+begin_date.d : ""+begin_date.d,
      (begin_time.h < 10) ? "0"+begin_time.h : ""+begin_time.h,
      (begin_time.m < 10) ? "0"+begin_time.m : ""+begin_time.m
    );

    let at_end_time = end_datetime.format("%F%H%M.%S").replace(/:/g, "").replace(/-/g, "");
    let end_hour = end_datetime.get_hour();
    let end_minute = end_datetime.get_minute();

    let json_description = {
      "name": "%s".format(radioName),
      "begin": "%s".format(begin_datetime.format("%F %R:00")),
      "end": "%s".format(end_datetime.format("%F %R:00"))
    }

    let json_description_file = JOBS_DIR + "/desc_" +
      at_begin_time.replace(/\./, "") + "_" +
      at_end_time.replace(/\./, "") + "_" +
      job_uid + ".json";

    file_set_contents(json_description_file, JSON.stringify(json_description, null, 4)+"\n");

    let job = "/usr/bin/notify-send -i %s -u low \"%s\" \"%s\"\n".format(
      APPLET_DIR + "/icon.svg",
      radioName,
      _("Starting recording from %s:%s to %s:%s").format(
        (begin_time.h < 10) ? "0"+begin_time.h : ""+begin_time.h,
        (begin_time.m < 10) ? "0"+begin_time.m : ""+begin_time.m,
        (end_hour < 10)     ? "0"+end_hour     : ""+end_hour,
        (end_minute < 10)   ? "0"+end_minute   : ""+end_minute
      )
    );

    job += "/usr/bin/mpv --no-terminal --no-video --metadata-codepage=auto" +
      " --script=" + SCRIPTS_DIR + "/radioSchedJob.lua" +
      " --script-opts=jobscript-BT=" + at_begin_time +
      ",jobscript-ET=" + at_end_time +
      ",jobscript-EM=" + "\"%s\"".format(_("Recording completed")) +
      ",jobscript-RN=" + "\"%s\"".format(radioName) +
      ",jobscript-ID=" + "\"%s\"".format(job_uid) +
      ""+` --stream-dump="` +
      RADIO30_MUSIC_DIR +
      "/" + radioName.replace(/\ /g, "_") +
      "_" + at_begin_time.replace(/\./, "") +
      "_" + at_end_time.replace(/\./, "") +
      "." + this.rec_format +
      ""+`" ` + radio +
      "\n";

    let begin_job_file = JOBS_DIR + "/job_" + at_begin_time.replace(/\./, "") + "_" + job_uid;
    file_set_contents(begin_job_file, job);

    let command = `%s/create-job.sh "%s" "%s"`.format(SCRIPTS_DIR, begin_job_file, at_begin_time);
    let subProcess = spawnCommandLineAsyncIO(command, Lang.bind(this, function(out, err, exitCode) {
      if (exitCode != 0 || out == null) return;

      let jobId = parseInt(out.trim());
      let begin_jobId_file = JOBS_DIR + "/idBegin_" + job_uid;

      file_set_contents(begin_jobId_file, ""+jobId+"\n");
      subProcess.send_signal(9);
    }));
  }

  on_button_sched_remove_clicked() {
    var schedRec = [];
    var uuidToRemove = [];

    for (let job of this.sched_recordings) {
      if (job.rm === false) {
        continue;
      }

      let uuid = ""+job.uuid;
      uuidToRemove.push(uuid);

      let pidFileName = JOBS_DIR + "/pid_" + uuid;
      if (file_test(pidFileName, FileTest.EXISTS)) {
        let json = JSON.parse(to_string(file_get_contents(pidFileName)[1]));
        if (json[uuid].pid != undefined)
          spawnCommandLine("kill -15 "+json[uuid].pid);
      }

      let idBeginFileName = JOBS_DIR + "/idBegin_" + uuid;
      if (file_test(idBeginFileName, FileTest.EXISTS)) {
        let atBeginJobId = (to_string(file_get_contents(idBeginFileName)[1])).trim();
        spawnCommandLine("bash -c 'atrm " + atBeginJobId + "'");
      }

      let idEndFileName = JOBS_DIR + "/idEnd_" + uuid;
      if (file_test(idEndFileName, FileTest.EXISTS)) {
        let atEndJobId = (to_string(file_get_contents(idEndFileName)[1])).trim();
        spawnCommandLine("bash -c 'atrm " + atEndJobId + "'");
      }
    }

    for (let j of this.sched_recordings) {
      if (uuidToRemove.indexOf(j.uuid) < 0) {
        schedRec.push(j);
      } else {
        let id = setTimeout(() => {
          spawnCommandLine("bash -c 'rm -f %s/*%s*'".format(JOBS_DIR, j.uuid));
          clearTimeout(id);
        }, 800); // 800 ms
      }
    }

    this.sched_recordings = [];
    this.settings.setValue("sched-recordings", []);
    this.sched_recordings = schedRec;
    this.settings.setValue("sched-recordings", schedRec)
  }


  /// Import ///
  on_button_import_shoutcast_clicked() {
    spawnCommandLineAsync("xdg-open https://directory.shoutcast.com/")
  }

  on_button_import_file_clicked() {
    let filters = [];
    let filter = new FileDialog.Filter("RADIO");
    filter.addMimeType("text/csv");
    filter.addMimeType("application/xspf+xml");
    filter.addMimeType("audio/mpegurl");
    filter.addMimeType("audio/x-mpegurl");
    filter.addMimeType("audio/x-scpls");
    filter.addMimeType("application/json");
    filters.push(filter);

    let params =  { directory: this.import_dir, filters: filters };
    let messages = [
      _("This will import a new file containing radio stations."),
      _("Do you want to continue?")
    ];

    new ModalDialog.ConfirmDialog(messages.join("\n"), Lang.bind(this, function() {
      FileDialog.open(Lang.bind(this, function(path) {
        let fileName = path.slice(0,-1);
        let dirPath = path.split("/");
        dirPath.splice(- 1, 1);
        dirPath = dirPath.join("/");
        this.import_dir = dirPath;
        let file = file_new_for_path(fileName);

        if ( !file.query_exists(null) ) return;

        let contents = null;

        if (fileName.endsWith(".csv")) {          // MIME: text/csv
          let stationsFileCsv = new FilesCsv.StationsFileCsv(fileName);
          contents = stationsFileCsv.get_all_unselected_json();
        } else if (fileName.endsWith(".xspf")) {  // MIME: application/xspf+xml
          let stationsFileXspf = new FilesXspf.StationsFileXspf(fileName);
          contents = stationsFileXspf.get_all_unselected_json();
        } else if (fileName.endsWith(".m3u")) {   // MIME: audio/mpegurl,audio/x-mpegurl
          let stationsFileM3u = new FilesM3u.StationsFileM3u(fileName);
          contents = stationsFileM3u.get_all_unselected_json();
        } else if (fileName.endsWith(".pls")) {   // MIME: audio/x-scpls
          let stationsFilePls = new FilesPls.StationsFilePls(fileName);
          contents = stationsFilePls.get_all_unselected_json();
        } else if (fileName.endsWith(".json")) {   // MIME: application/json
          let stationsFileJson = new FilesJson.StationsFileJson(fileName);
          contents = stationsFileJson.get_all_unselected_json();
        } else {
          // Nothing to do with this file!
          return
        }

        this.set_radio_hashtable();

        let i=0;
        while (i<contents.length) {
          // log("i: "+i+" - url: "+contents[i].url, true);
          if (this.radiosHash[""+contents[i].url])
            contents.splice(i,1);
          else
            i++;
        }

        let id = setTimeout(() => {
          this.settings.setValue("import-list", contents);
          clearTimeout(id);
        }, 800); // 800 ms
      }), params);
    })).open();
  }

  on_button_import_list_clicked() {
    let imports = this.settings.getValue("import-list");
    let radios = this.settings.getValue("radios");

    var count = 0;

    for (let _import of imports) {
      if (_import.inc === true) {
        radios.unshift(_import);
        count++;
      }
    }

    let id = setTimeout(() => {
      this.settings.setValue("radios", radios);
      if (count === 0)  {
        this.radio_notify(_("No new radio in your list."))
      } else if (count === 1) {
        this.radio_notify(_("One more radio in your list."))
      } else {
        this.radio_notify(_("%s more radios in your list.").format(""+count))
      }
      imports = null;
      radios = null;
      this.on_button_import_remove_clicked();
      this._set_settings_options();
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_import_remove_clicked() {
    let imports = this.settings.getValue("import-list");
    let new_imports = [];

    for (let _import of imports) {
      if (!_import.inc) {
        new_imports.push(_import);
      }
    }

    let id = setTimeout(() => {
      this.settings.setValue("import-list", new_imports);
      imports = null;
      new_imports = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  _select_all(whichList, select=true) {
    let imports = this.settings.getValue(whichList);

    for (let _import of imports) {
      _import.inc = select;
    }

    let id = setTimeout(() => {
      this.settings.setValue(whichList, imports);
      imports = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_import_select_all_clicked() {
    this._select_all("import-list", true)
  }

  on_button_import_unselect_all_clicked() {
    this._select_all("import-list", false)
  }


  /// Search ///
  on_button_search_reset_clicked() {
    let id = setTimeout(() => {
      for (let val of [ "search-name", "search-country", "search-tag",
                        "search-codec", "search-limit", "search-page",
                        "search-order", "search-minimalBitrate"]) {
        this.settings.setValue(val, this.settings.getDefaultValue(val));
      }
      clearTimeout(id);
    }, 800); // 800 ms
    this.settings.setValue("search-list-page-label", "0");
    this.on_button_search_select_all_clicked();
    this.on_button_search_remove_clicked();
  }

  async searchFetch(params, query="search") {
    let _url = "" + this.get_random_server_name() + "/json/stations/" + query + "?" + params;
    //log("searchFetch: _url: "+_url);
    let response = await this.http.LoadJsonAsync(_url);
    if (!response.Success) {
      logError(`HTTP Error! status : ${response.status}`);
      this.get_random_server_name(this.DB_SERVERS.indexOf(""+this.server_name));
      return null;
    }
    return response.Data;
  }

  async fetch(url, params="") {
    let _url = ""+url;
    if (params.length > 0)
      _url += "?" + params.trim();

    let response = await this.http.LoadJsonAsync(_url);
    if (!response.Success) {
      logError(`HTTP Error! status : ${response.status}`);
      this.get_random_server_name(this.DB_SERVERS.indexOf(""+this.server_name));
      // NEW:
      return null;
    }
    return response.Data;
  }

  on_button_search_clicked() {
    let name = this.settings.getValue("search-name").trim();
    let countryCode = this.settings.getValue("search-country");
    if (countryCode === "MyCountry")
      countryCode = this.user_countrycode;
    let tag = this.settings.getValue("search-tag").trim();
    let codec = this.settings.getValue("search-codec");
    let bitrateMin = this.settings.getValue("search-minimalBitrate");
    let order = this.settings.getValue("search-order");
    var limit = this.settings.getValue("search-limit");
    let page = this.settings.getValue("search-page");
    let searchOffset = limit * (page - 1);
    let radio_urls = this.radio_urls;


    let searchOptions = "hidebroken=true&limit=" + limit;
    if (searchOffset > 0)
      searchOptions += "&offset=" + searchOffset;
    if (countryCode.length > 0)
      searchOptions += "&countrycode=" + countryCode;
    if (order.length > 0) {
      searchOptions += "&order=" + order;
      let theyReverseOrder = ["votes", "bitrate", "lastcheckok", "lastchecktime", "clicktimestamp", "clickcount", "clicktrend", "changetimestamp"];
      if (theyReverseOrder.indexOf(order) > -1)
        searchOptions += "&reverse=true";
    }
    if (tag.length > 0)
      searchOptions += "&tag=" + tag;
    if (codec.length > 0)
      searchOptions += "&codec=" + codec;
    if (bitrateMin > 0)
      searchOptions += "&bitrateMin=" + bitrateMin;
    if (name.length > 0)
      searchOptions += "&name=" + name;

    //log("searchOptions: "+searchOptions);

    this.searchFetch(searchOptions).then((resultJson) => {
      //global.log(resultJson);
      var rows = [];
      for (let station of resultJson) {
        let url = ""+station.url;
        if (url.length === 0) {
          url = ""+station.url_resolved;
        }
        if (radio_urls.indexOf(url) > -1 || url.length === 0) {
          limit -= 1;
          continue;
        }

        let row = {};
        row.inc = false;
        row.name = "" + station.name.trim().split("\n").join(" - ").replace(" -  - ", " - ");
        row.bitrate = ""+station.bitrate;
        row.codec = ""+station.codec;
        row.tags = ""+station.tags.trim();
        row.favicon = ""+station.favicon.trim();
        row.countrycode = ""+station.countrycode.trim();
        row.url = url;
        row.country = ""+station.country.trim();
        row.uuid = ""+station.stationuuid.trim();
        row.homepage = ""+station.homepage.trim();

        rows.push(row);
        //global.log("Name: %s ; Url: %s".format(row.name, row.url));
      }
      //global.log(JSON.stringify(rows, null, 4));

      let id = setTimeout(() => {
        this.settings.setValue("search-list-page-label", ""+page);
        this.page_label = page;
        this.settings.setValue("search-list", rows);
        if (rows.length === limit)
          this.settings.setValue("search-page", page + 1);
        clearTimeout(id);
      }, 800); // 800 ms
    }).catch(e => logError(e));
  }

  on_button_search_list_clicked() {
    let imports = this.settings.getValue("search-list");
    let radios = this.settings.getValue("radios");

    let urls_already_here = [];
    for (let radio of radios) {
      let url = ""+radio.url;
      if (url.length > 0)
        urls_already_here.push(url);
    }

    var count = 0;

    for (let _import of imports) {
      if (_import.inc === true && urls_already_here.indexOf(_import.url) < 0) {
        radios.unshift({
          "inc": true,
          "play": false,
          "name": ""+_import.name,
          "bitrate": ""+_import.bitrate,
          "codec": ""+_import.codec,
          "url": ""+ _import.url,
          "uuid": ""+_import.uuid,
          "homepage": ""+_import.homepage,
          "tags": ""+_import.tags,
          "favicon": ""+_import.favicon
        });
        urls_already_here.unshift(_import.url);
        count++;
      }
    }

    let id = setTimeout(() => {
      this.settings.setValue("radios", radios);
      if (count === 0)  {
        this.radio_notify(_("There are no new stations to add to the Radio3.0 applet menu"))
      } else if (count === 1) {
        this.radio_notify(_("A new station has been added to the Radio3.0 applet menu"))
      } else {
        this.radio_notify(_("%s new stations have been added to the Radio3.0 applet menu").format(""+count))
      }
      imports = null;
      radios = null;
      urls_already_here = null;
      this.on_button_search_remove_clicked();
      this._set_settings_options();
      clearTimeout(id);
    }, 800); // 800 ms
  }

  _play_tested_station(whichList="radios") {
    var to_test = this.settings.getValue(whichList);

    for (let t of to_test) {
      if (t.play && t.url.length > 0) {
        this.stop_mpv_radio(false);
        t.play = false;
        if (t.homepage)
          this.test_mpv_radio(t.name, t.url, t.homepage);
        else
          this.test_mpv_radio(t.name, t.url);
        break
      }
    }

    let id = setTimeout(() => {
      this.settings.setValue(whichList, to_test);
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_radios_play_clicked() {
    this._play_tested_station("radios")
  }

  on_button_search_play_clicked() {
    this._play_tested_station("search-list")
  }

  on_button_import_play_clicked() {
    this._play_tested_station("import-list")
  }

  on_button_search_remove_clicked() {
    let imports = this.settings.getValue("search-list");
    let new_imports = [];

    for (let _import of imports) {
      if (!_import.inc) {
        new_imports.push(_import);
      }
    }

    let id = setTimeout(() => {
      this.settings.setValue("search-list", new_imports);
      imports = null;
      new_imports = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_search_select_all_clicked() {
    let imports = this.settings.getValue("search-list");

    for (let _import of imports) {
      _import.inc = true;
    }

    let id = setTimeout(() => {
      this.settings.setValue("search-list", imports);
      imports = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  on_button_search_unselect_all_clicked() {
    let imports = this.settings.getValue("search-list");

    for (let _import of imports) {
      _import.inc = false;
    }

    let id = setTimeout(() => {
      this.settings.setValue("search-list", imports);
      imports = null;
      clearTimeout(id);
    }, 800); // 800 ms
  }

  empty_recents() {
    this.recentRadios = []; // this.settings.setValue("recentRadios", []);
  }

  icon_rotate() {
    this.angle = Math.round(this.angle + 6) % 360;
    let size = Math.round(this.getPanelIconSize(IconType.SYMBOLIC)); // * global.ui_scale);
    this.img_icon = getImageAtScale(ANIMATED_ICON, size, size);
    this.img_icon.set_pivot_point(0.5, 0.5);
    this.img_icon.set_rotation_angle(RotateAxis.Z_AXIS, this.angle);
    this._applet_icon_box.set_child(this.img_icon);
    if (this.isHorizontal === true)
      this._applet_icon_box.set_fill(true, false);
    else
      this._applet_icon_box.set_fill(false, true);
    this._applet_icon_box.set_alignment(Align.MIDDLE,Align.MIDDLE);
    // End of icon_rotate
  }

  async _increase_click_number(id) {
    //log("_increase_click_number: id: "+id);
    if (!id || id.length === 0) return;
    //log("_increase_click_number: id est valide.");


    var clicks = this.settings.getValue("clicks");

    let now = Math.ceil(Date.now() / 1000);
    //log("now: "+now+"   id: "+id);

    var i = 0;
    //log("now - 86400: "+(now - 86400));

    var new_clicks={};
    var modified = false;
    for (let key of Object.keys(clicks)) {
      //global.log(""+key+": "+(clicks[key] < (now - 86400)));
      if (clicks[key] > (now - 86400)) {
        modified = true;
        new_clicks[key] = clicks[key]
      }
    }

    //global.log("new_clicks: "+JSON.stringify(new_clicks, null, 4));

    let already_clicked = false;

    if (new_clicks[id] && now - new_clicks[id] < 86400) return;

    // Send a request to increase the click count:
    let stationuuid = await this.search_uuid_by_url_on_RDB(""+id.trim()).then( (result) => {
      //global.log("stationuuid: "+result);
      return result
    }).catch(e => logError(e));
    //global.log("stationuuid: "+stationuuid);

    if (stationuuid) {
      modified = true;
      //global.log("!!!! OK1 !!!!");
      let url = this.get_random_server_name() + "/json/url/" + stationuuid;
      await this.fetch(url).then((resultJson) => { // Do not use encodeURIComponent()!
        if (""+resultJson.ok == "true") {
          //global.log("!!!! OK2 !!!!: "+ resultJson.name);
          new_clicks[id] = now;
          modified = true;
        } else {
          this.get_random_server_name(this.DB_SERVERS.indexOf(""+this.server_name));
          //global.log("!!! BAD2 !!!");
        }
        //this.settings.setValue("clicks", clicks);
      }).catch(e => logError(e));
      //global.log("!!!! OK3 !!!!");
    } else log("UNKNOWN in database: id: "+id+" name: "+this.get_radio_name(id));

    //global.log("modified: "+modified);

    if (modified === true) {
      try {
      this.settings.setValue("clicks", new_clicks);
      //global.log("!!!! OK4 !!!!");
      } catch(e) {logError(e)}
    }
  }

  populate_help_textviews() {
    this.settings.setValue("stations-help", stations_help_text);
    this.settings.setValue("button-update-help", button_update_help_text);
    this.settings.setValue("search-help", search_help_text);
    this.settings.setValue("import-help", import_help_text);
    this.settings.setValue("import-shoutcast-help", import_shoutcast_help_text);
  }

  //get mpvTitle() {
    //return "" + title_obj.prop;
  //}

  get codecAndBitrate() {
    let show_bitrate = this.settings.getValue("show-bitrate") === true;
    let show_codec = this.settings.getValue("show-codec") === true;

    let rets = [];

    if (show_codec) {
      let codec = this.codec;
      if (codec.length > 0)
        rets.push(codec)
    }

    if (show_bitrate) {
      let bitrate = this.bitrate;
      if (bitrate > 0)
        rets.push(_("%s kbps").format(""+parseInt(bitrate)));
    }

    let ret = "    " + rets.join("  ").trim();
    rets = null;
    return ret
  }

  get codec() {
    if (file_test(MPV_CODEC_FILE, FileTest.EXISTS)) {
      let codec = (to_string(file_get_contents(MPV_CODEC_FILE)[1])).trim().toUpperCase();
      codec = codec.replace("VORBIS", "OGG");
      return codec
    } else if (this.radiosHash
            && this.radiosHash[this.radioId]
            && this.radiosHash[this.radioId].codec
            && this.radiosHash[this.radioId].codec.length > 0) {
      return ""+this.radiosHash[this.radioId].codec;
    }
    return ""
  }

  get bitrate() {
    if (file_test(MPV_BITRATE_FILE, FileTest.EXISTS)) {
      let bitrate = (to_string(file_get_contents(MPV_BITRATE_FILE)[1])).trim();
      bitrate = Math.round(parseInt(bitrate)/1000);
      return bitrate
    } else if (this.radiosHash
            && this.radiosHash[this.radioId]
            && this.radiosHash[this.radioId].bitrate
            && this.radiosHash[this.radioId].bitrate.length > 0) {
      return ""+parseInt(this.radiosHash[this.radioId].bitrate);
    }
    return 0
  }

  get_random_server_name(pos=null) {
    var _ret;

    let _favorite_database = this.settings.getValue("database-favorite");
    if (_favorite_database === "random") {
      if (pos != null && typeof(pos) === "number") {
        // Change of server was requested:
        _ret = ""+this.DB_SERVERS[pos-1]
      } else if (this.server_name != null) {
        // Ensure that the server is the same during all session:
        _ret = ""+this.server_name
      } else {
        // Random server:
        //log("this.DB_SERVERS.length: "+this.DB_SERVERS.length, true);
        _ret = ""+this.DB_SERVERS[random_int_range(0, this.DB_SERVERS.length)]
      }
    } else {
      _ret = ""+_favorite_database;
    }

    //log("get_random_server_name: "+_ret+"; length: "+this.DB_SERVERS.length, true);
    this.server_name = ""+_ret;

    this.settings.setValue("database-url", ""+_ret);

    return ""+_ret
  }

  _on_open_cache_dir() {
    spawnCommandLineAsync("xdg-open "+this.cache_dir);
  }

  get radio_urls() {
    var _ret = [];
    let radios = this.settings.getValue("radios");
    for (let radio of radios) {
      if (radio.url == undefined || radio.url == null || radio.url == 'null' || radio.url == 'undefined')
        continue;
      let url = "" + radio.url.trim();
      if (url.length > 0) {
        _ret.push(url)
      }
    }
    _ret = _ret.sort();
    radios = null;
    return _ret
  }

  get radioWithoutUUID_urls() {
    var _ret = [];
    let radios = this.settings.getValue("radios");
    for (let radio of radios) {
      if (radio.url == undefined || radio.url == null || radio.url == 'null' || radio.url == 'undefined')
        continue;
      let url = "" + radio.url.trim();
      let uuid = "" + radio.uuid.trim();
      if (url.length > 0 && uuid.length === 0) {
        _ret.push(url)
      }
    }
    _ret = _ret.sort();
    radios = null;
    return _ret
  }

  get radio_uuids() {
    var _ret = [];
    let radios = this.settings.getValue("radios");
    for (let radio of radios) {
      if (radio.uuid == undefined || radio.uuid == null || radio.uuid == 'null' || radio.uuid == 'undefined')
        continue;
      let uuid = "" + radio.uuid.trim();
      if (uuid.length > 0) {
        _ret.push(uuid)
      }
    }
    radios = null;
    return _ret
  }

  get number_of_categories(){
    var _ret = 0;
    let radios = this.settings.getValue("radios");

    for (let radio of radios) {
      if (radio.url == undefined || radio.name == undefined || !radio.inc)
        continue;
      let url = "" + radio.url.trim();
      if (url.length === 0) {
        _ret++
      }
    }

    radios = null;
    return _ret
  }

  get number_of_stations(){
    var _ret = 0;
    let radios = this.settings.getValue("radios");

    for (let radio of radios) {
      if (radio.url == undefined || radio.name == undefined || !radio.inc)
        continue;
      let url = "" + radio.url.trim();
      if (url.length !== 0) {
        _ret++
      }
    }

    radios = null;
    return _ret
  }

  get artist_title_swap() {
    var _ret = false;
    let radios = this.settings.getValue("radios");
    for (let radio of radios) {
      if (radio.url == undefined || radio.name == undefined || !radio.inc)
        continue;
      let url = "" + radio.url.trim();
      if (url.length !== 0 && url === this.last_radio_listened_to) {
        _ret = (radio.author_title_swap != undefined && radio.author_title_swap === true);
        break;
      }
    }
    radios = null;
    return _ret
  }

  get station_categories() {
    var _ret = [];
    let radios = this.settings.getValue("radios");

    for (let radio of radios) {
      if (radio.url == undefined || radio.name == undefined)
        continue;
      let url = "" + radio.url.trim();
      if (url.length === 0) {
        _ret.push(`%s`.format(radio.name))
      }
    }

    _ret = _ret.sort((a, b) => a.localeCompare(b) > 0);

    radios = null;
    return _ret
  }

  get station_names() {
    var _ret = [];
    let radios = this.settings.getValue("radios");

    for (let radio of radios) {
      if (radio.url == undefined || radio.name == undefined)
        continue;
      let url = "" + radio.url.trim();
      if (url.length > 0) {
        _ret.push(`%s`.format(radio.name))
      }
    }

    _ret = _ret.sort((a, b) => a.localeCompare(b) > 0);

    radios = null;
    return _ret
  }

  get min_hd_space_left() {
    let value = ""+this.settings.getValue("limits-hd-value");
    let unit = ""+this.size_prefixes;
    if (unit.startsWith('base-2')) {
      value = Math.pow(2, 30) * value
    } else {
      value = Math.pow(10, 9) * value
    }
    return value
  }

  get categories_with_stations() {
    var cws = {"All Categories": {}};
    let radios = this.radios;
    var currentCat = "All Categories";
    for (let radio of radios) {
      if (radio.url.trim().length === 0) {
        currentCat = radio.name;
        cws[currentCat] = {};
      } else {
        let title = radio.name;
        let elts = []
        let bitrate = (this.show_bitrate) ? ""+parseInt(radio.bitrate) : "";
        if (bitrate === "NaN") bitrate = "";
        if (bitrate.length > 0) elts.unshift(bitrate);
        let codec = (this.show_codec) ? ""+radio.codec : "";
        if (codec.length > 0) elts.unshift(codec);

        if (elts.length > 0) elts.unshift(" ─");
        if (this.show_favicon && radio.favicon && radio.favicon.length > 0)
          elts.push(" *");

        title = title + elts.join(" ");

        cws[currentCat][title] = radio.url.trim();
        cws["All Categories"][title] = radio.url.trim();
      }
    }
    radios = null;
    currentCat = null;
    return cws;
  }
};

// Loading: In this order:
// _init()
// on_applet_added_to_panel()
// Loaded applet Radio3.0@claudiux in 157 ms

// Reloading: In this order:
// Reloading applet: Radio3.0@claudiux/<instance number>
// on_applet_reloaded()
// on_applet_removed_from_panel()
// _init()
// on_applet_added_to_panel()
// Loaded applet Radio3.0@claudiux in 132 ms

function main(metadata, orientation, panel_height, instance_id) {
  VERSION = metadata.version;
  return new WebRadioReceiverAndRecorder(orientation, panel_height, instance_id);
}
