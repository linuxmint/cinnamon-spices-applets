const Gettext = imports.gettext; // ++ Needed for translations
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos

const UUID="Sensors@claudiux";

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

const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";

// ++ l10n support
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str, uuid=UUID) {
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

/**
 * dummy variable for translation
 */

let dummy = _("⚙ General");
dummy = _("🌡 Temperature");
dummy = _("🤂 Fan");
dummy = _("🗲 Voltage");
dummy = _("⮿ Intrusion");


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

module.exports = {
  UUID,
  HOME_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  _,
  DEBUG,
  RELOAD,
  QUICK,
  log,
  logError
};
