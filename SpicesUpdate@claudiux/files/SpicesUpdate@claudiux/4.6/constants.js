const Gettext = imports.gettext; // ++ Needed for translations
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos

const {
  versionCompare
} = require("./utils");

const UUID="SpicesUpdate@claudiux";

const HOME_DIR = GLib.get_home_dir();

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory ($ touch DEBUG)
 * Used by the log function above.
 */

function DEBUG() {
  let _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
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

function QUICK() {
  let _quick = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/QUICK");
  return _quick.query_exists(null);
};

const DOWNLOAD_TIME = 10;

let sort = "date";
if (versionCompare( GLib.getenv('CINNAMON_VERSION') ,"4.2.4" ) >= 0 ) {
  sort = "update";
}

const TAB = "1";
const SORT = sort;

const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";
const HELP_DIR = APPLET_DIR + "/help";


const CINNAMON_VERSION_ARRAY = GLib.getenv('CINNAMON_VERSION').split(".").slice(0,2);
const CINNAMON_VERSION = CINNAMON_VERSION_ARRAY.join(".");

let cs_path = "%s/cs/%s/cinnamon-settings.py".format(APPLET_DIR, CINNAMON_VERSION, );
if (!GLib.file_test(cs_path, GLib.FileTest.EXISTS))
  cs_path = "%s/cs/latest/cinnamon-settings.py".format(APPLET_DIR, );
const CS_PATH = cs_path;

const URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com";
const CONFIG_DIR = HOME_DIR + "/.cinnamon/configs";
const SU_CONFIG_DIR = CONFIG_DIR + "/" + UUID;
const CACHE_DIR = HOME_DIR + "/.cinnamon/spices.cache";

const TYPES = ["applets", "desklets", "extensions", "themes"];

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

// ++ l10n support
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str, uuid=UUID) {
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

const capitalize = (s) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ++ Useful for logging in .xsession_errors
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") log the error message regardless of the DEBUG() return.
 */
function log(message, alwaysLog=false) {
  if (DEBUG() || alwaysLog) global.log("\n[" + UUID + "] " + GLib.DateTime.new_now_local().format("%X") + ": " + message + "\n");
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
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

const EXP1 = {
  "applets": _("If you do not want an applet to be checked, uncheck its first box."),
  "desklets": _("If you do not want a desklet to be checked, uncheck its first box."),
  "extensions": _("If you do not want an extension to be checked, uncheck its first box."),
  "themes": _("If you do not want a theme to be checked, uncheck its first box.")
}

const EXP2 = {
  "applets": _("If you want to get the latest version of an applet now, check both boxes."),
  "desklets": _("If you want to get the latest version of a desklet now, check both boxes."),
  "extensions": _("If you want to get the latest version of an extension now, check both boxes."),
  "themes": _("If you want to get the latest version of a theme now, check both boxes.")
}

const EXP3 = _("When all your choices are made, click the Refresh button.");

module.exports = {
  UUID,
  HOME_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  HELP_DIR,
  CS_PATH,
  URL_SPICES_HOME,
  CONFIG_DIR,
  SU_CONFIG_DIR,
  CACHE_DIR,
  TYPES,
  URL_MAP,
  CACHE_MAP,
  DIR_MAP,
  DCONFCACHEUPDATED,
  DOWNLOAD_TIME,
  TAB,
  SORT,
  _,
  EXP1, EXP2, EXP3,
  DEBUG,
  RELOAD,
  QUICK,
  capitalize,
  log,
  logError
};
