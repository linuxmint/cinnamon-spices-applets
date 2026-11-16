const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Extension = imports.ui.extension;

var NAME = "VPN-Sentinel";
var UUID = NAME + "@claudiux";
var HOME_DIR = GLib.get_home_dir();
var USER_DATA_DIR = GLib.get_user_data_dir();
var APPLET_DIR = "%s/cinnamon/applets/%s".format(USER_DATA_DIR, UUID);
var SCRIPTS_DIR = "%s/scripts".format(APPLET_DIR);
var ICONS_DIR = "%s/icons".format(APPLET_DIR);
var SOUNDS_DIR = "%s/sounds".format(APPLET_DIR);
//~ let settings_file = "%s/.cinnamon/configs/%s/%s.json".format(HOME_DIR, UUID, UUID);
//~ if (!GLib.file_test(settings_file, GLib.FileTest.EXISTS))
  //~ settings_file = "%s/.configs/cinnamon/spices/%s/%s.json".format(HOME_DIR, UUID, UUID);
//~ var SETTINGS_FILE = ""+settings_file;
var SETTINGS_SCHEMA = APPLET_DIR + "/settings-schema.json";
var IFACES_DIR = "/sys/class/net";
var DEFAULT_SYMBOLIC_ICON = "vpn-sentinel";

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory ($ touch DEBUG)
 * Used by the log function above.
 */

function DEBUG() {
  let _debug = Gio.file_new_for_path("%s/DEBUG".format(APPLET_DIR));
  return _debug.query_exists(null);
};

/**
 * RELOAD:
 * Returns whether or not the RELOAD file is present in this applet directory ($ touch RELOAD)
 * Used to show the 'Reload this applet' button in menu.
 */

function RELOAD() {
  let _reload = Gio.file_new_for_path("%s/RELOAD".format(APPLET_DIR));
  return _reload.query_exists(null);
};

/**
 * _:
 * Translation
 */
function _(str, uuid=UUID) {
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
};

/**
 * exists:
 * @fullPathToFile
 */
function exists(fullPathToFile) {
  return GLib.file_test(fullPathToFile, GLib.FileTest.EXISTS);
};

/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") log the error message regardless of the DEBUG() return.
 */
function log(message, alwaysLog=false) {
  if (DEBUG() || alwaysLog) global.log("\n[" + UUID + "]: " + message + "\n");
};

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
};

if (!Extension.getCurrentExtension)
module.exports = {
  NAME,
  UUID,
  HOME_DIR,
  USER_DATA_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  IFACES_DIR,
  SOUNDS_DIR,
  SETTINGS_SCHEMA,
  DEFAULT_SYMBOLIC_ICON,
  _,
  exists,
  DEBUG,
  RELOAD,
  log,
  logError
};
