const Gettext = imports.gettext; // Needed for translations
const GLib = imports.gi.GLib; // Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Extension = imports.ui.extension;

var UUID="Sensors@claudiux";

var HOME_DIR = GLib.get_home_dir();
var USER_DATA_DIR = GLib.get_user_data_dir();
var APPLET_DIR = USER_DATA_DIR + "/cinnamon/applets/" + UUID;
var SCRIPTS_DIR = APPLET_DIR + "/scripts";
var ICONS_DIR = APPLET_DIR + "/icons";

var NVIDIA_SMI_VERSION_REGEX = /(?<=nvidia-smi version  : )\d+\.\d+\.\d+/gi;

var versionCompare = (left, right) => {
  if (typeof left + typeof right != "stringstring")
    return false;

  let a = left.split(".");
  let b = right.split(".");
  let len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    let l = parseInt(a[i], 10);
    let r = parseInt(b[i], 10);
    if (isNaN(l) || isNaN(r))
      return false;
    if (l > r) {
      return 1;
    } else if (l < r) {
      return -1;
    }
  }
  return 0;
}

//~ var xs_path = "/usr/bin/xlet-settings";
//~ if (versionCompare(GLib.getenv('CINNAMON_VERSION').toString(), "4.2") < 0)
  //~ xs_path = SCRIPTS_DIR + "/xs.py";
//~ const XS_PATH = xs_path;
var XS_PATH = "/usr/bin/xlet-settings";

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory ($ touch DEBUG)
 * Used by the log function above.
 */

var DEBUG = () => {
  let _debug = Gio.file_new_for_path(USER_DATA_DIR + "/cinnamon/applets/" + UUID + "/DEBUG");
  return _debug.query_exists(null);
}

/**
 * RELOAD:
 * Returns whether or not the RELOAD file is present in this applet directory ($ touch RELOAD)
 * Used to show the 'Reload this applet' button in menu.
 */

var RELOAD = () => {
  let _reload = Gio.file_new_for_path("%s/RELOAD".format(APPLET_DIR));
  return _reload.query_exists(null);
}

/**
 * QUICK:
 * Returns whether or not the QUICK file is present in this applet directory ($ touch QUICK)
 * Used to refresh every 2 minutes.
 */
var QUICK = () => {
  let _quick = Gio.file_new_for_path(USER_DATA_DIR + "/cinnamon/applets/" + UUID + "/QUICK");
  return _quick.query_exists(null);
}

/**
 * ENGLISH:
 * Returns whether or not the ENGLISH file is present in this applet directory ($ touch ENGLISH)
 * Used to by-pass translation (only used by the author of this applet).
 */
var ENGLISH = () => {
  let _english = Gio.file_new_for_path(USER_DATA_DIR + "/cinnamon/applets/" + UUID + "/ENGLISH");
  let _english_exists = _english.query_exists(null);
  let _locale_saved_mo = Gio.file_new_for_path(USER_DATA_DIR + "/locale/fr/" + UUID + ".mo");
  let _locale_fr_mo =  Gio.file_new_for_path(USER_DATA_DIR + "/locale/fr/LC_MESSAGES/" + UUID + ".mo");
  if (_english_exists) {
    if (_locale_fr_mo.query_exists(null)) {
      _locale_fr_mo.move(_locale_saved_mo, Gio.FileCopyFlags.OVERWRITE, null, null)
    }
  } else {
    if (_locale_saved_mo.query_exists(null) && !_locale_fr_mo.query_exists(null)) {
      _locale_saved_mo.move(_locale_fr_mo, Gio.FileCopyFlags.OVERWRITE, null, null);
    }
  }
  return _english_exists;
}

// l10n support
Gettext.bindtextdomain(UUID, USER_DATA_DIR + "/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// Always needed if you want localisation/translation support
var _ = (str, uuid=UUID) => {
  if (ENGLISH()) return str;
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

// Useful for logging in .xsession_errors
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") log the error message regardless of the DEBUG() return.
 */
var log = (message, alwaysLog=false) => {
  if (DEBUG() || alwaysLog) global.log("\n[" + UUID + "] " + GLib.DateTime.new_now_local().format("%X") + ": " + message + "\n");
}

var logError = (error) => {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

if (!Extension.getCurrentExtension) {
  module.exports = {
    UUID,
    HOME_DIR,
    USER_DATA_DIR,
    APPLET_DIR,
    SCRIPTS_DIR,
    ICONS_DIR,
    XS_PATH,
    NVIDIA_SMI_VERSION_REGEX,
    _,
    DEBUG,
    RELOAD,
    QUICK,
    log,
    logError,
    versionCompare
  }
}
