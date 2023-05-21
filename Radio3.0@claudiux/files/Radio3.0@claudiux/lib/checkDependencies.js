const St = imports.gi.St;
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Extension = imports.ui.extension; // Needed to reload applets
const MessageTray = imports.ui.messageTray; // ++ Needed for the criticalNotify() function in this script
const Util = imports.misc.util; // Needed for spawnCommandLine()
const Main = imports.ui.main; // ++ Needed for notify()
const Gettext = imports.gettext;

const {to_string} = require("./lib/to-string");

//const Util = require("./lib/util");


// --- To adapt to the applet --- //
/**
 * UUDI is the Universal Unique IDentifier of the applet using this dependencies management.
 */
const APPNAME = "Radio3.0";
const UUID = APPNAME + "@claudiux";

/**
 * NEEDS_FONTS_SYMBOLA must be set to true when the 'symbola' fonts are needed by the applet.
 * Once NEEDS_FONTS_SYMBOLA is set to true, it is not necessary to specify in DEPENDENCIES
 * which package must be installed to obtain the 'symbola' fonts.
 */
const NEEDS_FONTS_SYMBOLA = false;

/**
 * DEPENDENCIES for each type of distro.
 * The "default" distro is a distro, like Mint or Ubuntu,
 * which uses 'sudo apt-get install foo' to install the foo package.
 *
 * Stucture of each line:
 * ["executable", "path_to_a_file", "package_name"]
 * where:
 *  - 'executable' is the name of an executable included in the package; it may be empty (when the package is a library).
 *  - 'path_to_a_file' is the full path to a file included in the package; it may be empty if 'executable' is not empty.
 *  - 'package_name' is the name of the package to install when the executable and the file are not present.
 *
 * Example: To install the executable 'sox' and the library 'libsox-fmt-mp3.so', we need to install two packages in
 * Debian and derivatives distros (default) and only one package (named sox) in Arch and Fedora distros.
const DEPENDENCIES = {
  "default": [
    ["sox", "/usr/bin/sox",  "sox"],
    ["", "/usr/share/doc/libsox-fmt-mp3/copyright", "libsox-fmt-mp3"]
  ],
  "arch": [
    ["", "/usr/lib/sox/libsox_fmt_mp3.so", "sox"]
  ],
  "debian": [
    ["sox", "/usr/bin/sox",  "sox"],
    ["", "/usr/share/doc/libsox-fmt-mp3/copyright", "libsox-fmt-mp3"]
  ],
  "fedora": [
    ["sox", "/usr/bin/sox",  "sox"]
  ],
  "openSUSE": [
    ["sox", "/usr/bin/sox",  "sox"]
  ]
}


 */
var DEPENDENCIES = {
  "default": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["", "/usr/share/doc/libmpv1/copyright", "libmpv1"],
    ["", "/usr/share/doc/libmpv-dev/copyright", "libmpv-dev"],
    ["pacmd", "/usr/bin/pacmd", "pulseaudio-utils"],
    ["pulseaudio", "/usr/bin/pulseaudio", "pulseaudio"],
    ["sox", "/usr/bin/sox", "sox"],
    ["", "/usr/share/doc/libsox-fmt-all/copyright", "libsox-fmt-all"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify-bin"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["ffmpegthumbnailer", "/usr/bin/ffmpegthumbnailer", "ffmpegthumbnailer"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib/python3/dist-packages/polib.py", "python3-polib"]
  ],
  "arch": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["pulseaudio", "/usr/bin/pulseaudio", "pulseaudio"],
    ["sox", "/usr/bin/sox", "sox"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["ffmpegthumbnailer", "/usr/bin/ffmpegthumbnailer", "ffmpegthumbnailer"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/share/licenses/python-brotli/LICENSE", "python-brotli"]
  ],
  "debian": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["", "/usr/lib/x86_64-linux-gnu/libmpv.so", "libmpv?"],
    ["", "/usr/share/doc/libmpv-dev/copyright", "libmpv-dev"],
    ["pacmd", "/usr/bin/pacmd", "pulseaudio-utils"],
    ["pulseaudio", "/usr/bin/pulseaudio", "pulseaudio"],
    ["sox", "/usr/bin/sox", "sox"],
    ["", "/usr/share/doc/libsox-fmt-all/copyright", "libsox-fmt-all"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify-bin"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["ffmpegthumbnailer", "/usr/bin/ffmpegthumbnailer", "ffmpegthumbnailer"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib/python3/dist-packages/polib.py", "python3-polib"]
  ],
  "fedora": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["pulseaudio", "/usr/bin/pulseaudio", "pulseaudio"],
    ["sox", "/usr/bin/sox", "sox"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["", "/usr/share/licenses/python3-brotli/LICENSE", "python3-brotli"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib64/gstreamer-1.0/libgstlibav.so", "gstreamer1-libav"],
    ["", "/usr/share/licenses/python3-polib/LICENSE", "python3-polib"]
  ],
  "openSUSE": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["sox", "/usr/bin/sox",  "sox"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["", "/usr/share/licenses/brotli/LICENSE", "brotli"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib64/gstreamer-1.0/libgstlibav.so", "gstreamer-plugins-libav"],
    ["", "/usr/share/licenses/python310-polib/LICENSE", "python3-polib"]
  ]
}


// --- Do not modify from here --- //
if (NEEDS_FONTS_SYMBOLA) {
  DEPENDENCIES["default"].push(["", "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf", "fonts-symbola"]);
  DEPENDENCIES["debian"].push(["", "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf", "fonts-symbola"]);
  DEPENDENCIES["fedora"].push(["", "/usr/share/fonts/gdouros-symbola/Symbola.ttf", "gdouros-symbola-fonts"]);
  DEPENDENCIES["openSUSE"].push(["", "/usr/share/fonts/truetype/Symbola.ttf", "gdouros-symbola-fonts"]);
}

const _ = function(str) {
  let translation = Gettext.gettext(str);
  if (translation !== str) {
    return translation;
  }
  return Gettext.dgettext(UUID, str);
}

const UPDATE = {
  "default": "sudo apt-get update",
  "arch": "sudo pacman -Syu",
  "debian": "apt-get update",
  "fedora": "sudo dnf update",
  "openSUSE": ""
}

const INSTALL = {
  "default": "sudo apt-get install",
  "arch": "sudo pacman -S",
  "debian": "apt-get install",
  "fedora": "sudo dnf install",
  "openSUSE": "sudo zypper --non-interactive install"
}

const HOME_DIR = GLib.get_home_dir();

const DISTRO = function() {
  let osRelease = to_string(GLib.file_get_contents("/usr/lib/os-release")[1]);
  let lines = osRelease.split("\n");
  var distro = "";
  for (let line of lines) {
    line = ""+line;
    if (line.startsWith("ID=")) {
      distro = line.trim().substr(3);
      break;
    }
  }
  return ""+distro;
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
  let notification = new MessageTray.Notification(source, UUID + ": " + msg, details, { icon: icon });
  notification.setTransient(false);
  notification.setUrgency(MessageTray.Urgency.CRITICAL);
  source.notify(notification);
  return notification
}

var alertNotif = null;

function get_terminal() {
  var term_found = "";
  var _terminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "xterm"];
  var t;
  for (t=0; t < _terminals.length ; ++t) {
    if (GLib.find_program_in_path(_terminals[t])) {
      term_found = _terminals[t];
      break
    }
  }
  return term_found
} // End of get_terminal

function get_default_terminal() {
  let _SETTINGS_SCHEMA='org.cinnamon.desktop.default-applications.terminal';
  let _SETTINGS_KEY1 = 'exec'; // Ex: 'gnome-terminal'
  //let _SETTINGS_KEY2 = 'exec-arg'; // Ex: '-x'
  let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
  let ret1 = _interface_settings.get_string(_SETTINGS_KEY1);
  //let ret2 = _interface_settings.get_string(_SETTINGS_KEY2);
  if (ret1 == null) {
    ret1 = get_terminal();
    //ret2 = '-e';
  }
  //return [ret1, ret2];
  return "" + ret1;
} // End of get_default_terminal

function isFedora() {
  return GLib.find_program_in_path("dnf")
} // End of isFedora

function isArchLinux() {
  return Gio.file_new_for_path("/etc/arch-release").query_exists(null)
} // End of isArchLinux

function isDebian() {
  return DISTRO() === 'debian'
} // End of isDebian

function isOpenSUSE() {
  return GLib.find_program_in_path("zypper")
}

function is_apturl_present() {
  return GLib.find_program_in_path("apturl")
} // End of is_apturl_present

function get_distro() {
  let distro = DISTRO();
  switch (distro) {
    case "debian":
    case "arch":
    case "fedora":
      return distro;
    case "linuxmint":
    case "ubuntu":
      return "default";
    default:
      if (isArchLinux()) {
        return "arch";
      } else if (isFedora()) {
        return "fedora";
      } else if (isOpenSUSE()) {
        return "openSUSE"
      }
      return "default"; // linuxmint or ubuntu
  }
} // End of get_distro

function get_pkg_to_install() {
  let distro = get_distro();
  var pkgs = [];
  for (let d of DEPENDENCIES[distro]) {
    let isInstalled = false;
    if (d[0] != "" && GLib.find_program_in_path(d[0])) {
      isInstalled = true;
    } else {
      if (d[1] != "" && Gio.file_new_for_path(d[1]).query_exists(null)) {
        isInstalled = true;
      }
    }
    if (isInstalled === false) {
      pkgs.push(d[2])
    }
  }
  return pkgs
} // End of get_pkg_to_install

function Dependencies() {
  this._init.apply(this, arguments);
}

Dependencies.prototype = {
  _init: function() {
    this.depAreMet = this.are_dependencies_installed();
    this.alertNotif = null;
    this.check_dependencies();
  },

  areDepMet: function() {
    return this.depAreMet;
  },

  are_dependencies_installed: function() {
    let pkgs = get_pkg_to_install();

    if (!NEEDS_FONTS_SYMBOLA)
      return (pkgs.length == 0);

    let _fonts_installed = (
      Gio.file_new_for_path("/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf").query_exists(null) ||
      Gio.file_new_for_path("/usr/share/fonts/TTF/Symbola.ttf").query_exists(null) ||
      Gio.file_new_for_path("/usr/share/fonts/gdouros-symbola/Symbola.ttf").query_exists(null) ||
      Gio.file_new_for_path("/usr/share/fonts/truetype/Symbola.ttf").query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola_Hinted.ttf".format(HOME_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola.ttf".format(HOME_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/.local/share/fonts/Symbola.otf".format(HOME_DIR)).query_exists(null)
    )
    if (!_fonts_installed && isArchLinux()) {
      Util.spawnCommandLineAsync("/bin/sh -c \"%s/install_symbola_on_Arch.sh\"".format(SCRIPTS_DIR), null, null);
      _fonts_installed = true
    }

    return (pkgs.length == 0 && _fonts_installed);
  }, // End of are_dependencies_installed

  check_dependencies: function() {
    if (!this.depAreMet && this.are_dependencies_installed()) {
      // At this time, the user just finished to install all dependencies.
      this.depAreMet=true;
      try {
        if (this.alertNotif != null) {
          this.alertNotif.destroy(2) // Destroys the precedent critical notification.
        }
      } catch(e) {
        // Not an error. Simply, the user has clicked on the notification, destroying it.
        this.alertNotif = null;
      }
      // Notification (temporary)
      let notifyMessage = _("The applet %s is fully functional.").format(UUID);
      Main.notify(_("All dependencies are installed"), notifyMessage);

      // Reload this applet with dependencies installed
      Extension.reloadExtension(UUID, Extension.Type.APPLET);
    } else if (!this.are_dependencies_installed() && this.alertNotif === null) {
      let icon = new St.Icon({
        icon_name: 'error',
        icon_type: St.IconType.FULLCOLOR,
        icon_size: 32 });
      // Got a terminal used on this system:
      let terminal = get_default_terminal();
      // apturl is it present?
      let _is_apturl_present = is_apturl_present();
      // Detects the distrib in use and make adapted message and notification:
      let _isFedora = isFedora();
      let _isArchlinux = isArchLinux();
      let _isDebian = isDebian();
      let _isOpenSUSE = isOpenSUSE();
      //let _apt_update = _isFedora ? "sudo dnf update" : _isArchlinux ? "" : _isDebian ? "apt update" : "sudo apt update";
      let distro = get_distro();
      let _apt_update = UPDATE[distro];
      let _install = INSTALL[distro];
      let _pkg_to_install = get_pkg_to_install();
      let _and = " \\\\&\\\\& ";
      if (_apt_update.length === 0)
        _and = "";
      let _apt_install = "%s %s".format(_install, _pkg_to_install.join(" "));
      //var _apt_install = _isFedora ? "sudo dnf install libnotify gdouros-symbola-fonts" : _isArchlinux ? "sudo pacman -Syu libnotify" : _isDebian ? "apt install libnotify-bin fonts-symbola" : "sudo apt install libnotify-bin fonts-symbola";
      let criticalMessagePart1 = _("You appear to be missing some of the programs required for this applet to have all its features.");
      let criticalMessage = _is_apturl_present ? criticalMessagePart1 : criticalMessagePart1+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
      this.alertNotif = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);

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
        Util.spawnCommandLine("apturl apt:%s".format(_pkg_to_install.join(",")));
      }
      this.depAreMet = false;
    }
    //return this.depAreMet
  } // End of check_dependencies

} // End of Dependencies.prototype

module.exports = {
  Dependencies,
  criticalNotify
}
