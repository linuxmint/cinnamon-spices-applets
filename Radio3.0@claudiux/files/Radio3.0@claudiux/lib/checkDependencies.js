const St = imports.gi.St;
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Extension = imports.ui.extension; // Needed to reload applets
const Cinnamon = imports.gi.Cinnamon;

function _require(relPath) {
  if (Extension.getCurrentExtension) {
    var Me = Extension.getCurrentExtension();
    return Me.imports[relPath];
  } else {
    return require(relPath);
  }
}

const MessageTray = imports.ui.messageTray; // ++ Needed for the criticalNotify() function in this script
const Util = imports.misc.util;
const Main = imports.ui.main; // ++ Needed for notify()
const Gettext = imports.gettext;

var {to_string} = _require("./lib/to-string");

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
 * It may also be a list of interchangeable executables, any one of which is enough.
 *  - 'path_to_a_file' is the full path to a file included in the package; it may be empty if 'executable' is not empty.
 *  - 'package_name' is the name of the package to install when the executable and the file are not present.
 *
 * Example: To install the executable 'sox' and the library 'libsox-fmt-mp3.so', we need to install two packages in
 * Debian and derivatives distros (default) and only one package (named sox) in Arch and Fedora distros.
var DEPENDENCIES = {
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
  "devuan": [
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
    ["pacmd", "/usr/bin/pacmd", "pulseaudio-utils"],
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
    ["", "/usr/share/doc/libmpv-dev/copyright", "libmpv-dev"],
    ["pacmd", "/usr/bin/pacmd", "pulseaudio-utils"],
    ["sox", "/usr/bin/sox", "sox"],
    ["", "/usr/share/doc/libsox-fmt-all/copyright", "libsox-fmt-all"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify-bin"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["ffmpegthumbnailer", "/usr/bin/ffmpegthumbnailer", "ffmpegthumbnailer"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib/python3/dist-packages/polib.py", "python3-polib"],
    ["", "/usr/share/doc/gir1.2-soup-3.0/copyright", "gir1.2-soup-3.0"]
  ],
  "devuan": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
    ["", "/usr/share/doc/libmpv-dev/copyright", "libmpv-dev"],
    ["pacmd", "/usr/bin/pacmd", "pulseaudio-utils"],
    ["sox", "/usr/bin/sox", "sox"],
    ["", "/usr/share/doc/libsox-fmt-all/copyright", "libsox-fmt-all"],
    ["at", "/usr/bin/at", "at"],
    ["notify-send", "/usr/bin/notify-send", "libnotify-bin"],
    ["ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"],
    ["ffmpegthumbnailer", "/usr/bin/ffmpegthumbnailer", "ffmpegthumbnailer"],
    ["yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"],
    ["", "/usr/lib/python3/dist-packages/polib.py", "python3-polib"],
    ["", "/usr/share/doc/gir1.2-soup-3.0/copyright", "gir1.2-soup-3.0"]
  ],
  "fedora": [
    ["mpv", "/usr/bin/mpv",  "mpv"],
    ["wget", "/usr/bin/wget", "wget"],
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
  ],
  "gentoo": []
}

// mpv-mpris is only available from Ubuntu 22.04 (LM 21 LTS, Cinnamon 5.4)
if (versionCompare(GLib.getenv("CINNAMON_VERSION"), "5.4") >= 0) {
  DEPENDENCIES["default"].push(["", "/usr/lib/mpv-mpris/mpris.so", "mpv-mpris"]);
  DEPENDENCIES["arch"].push(["", "/usr/lib/mpv-mpris/mpris.so", "mpv-mpris"]);
  DEPENDENCIES["debian"].push(["", "/usr/lib/mpv-mpris/mpris.so", "mpv-mpris"]);
  DEPENDENCIES["fedora"].push(["", "/usr/lib64/mpv/mpris.so", "mpv-mpris"]);
  DEPENDENCIES["openSUSE"].push(["", "/usr/lib64/mpv/mpris.so", "mpv-mpris"]);
}

// Soup-3 is used instead of Soup-2.4 from LM 21.2, Cinnamon 5.8.
// Also pipewire from Fedora 39, Cinnamon 5.8.
if (versionCompare(GLib.getenv("CINNAMON_VERSION"), "5.8") >= 0) {
  DEPENDENCIES["default"].push(["", "/usr/share/doc/gir1.2-soup-3.0/copyright", "gir1.2-soup-3.0"]);
  DEPENDENCIES["debian"].push(["", "/usr/share/doc/gir1.2-soup-3.0/copyright", "gir1.2-soup-3.0"]);
  DEPENDENCIES["arch"].push(["", "/usr/lib/girepository-1.0/Soup-3.0.typelib", "libsoup3"]);
  DEPENDENCIES["fedora"].push(["", "/usr/share/licenses/libsoup3/COPYING", "libsoup3"]);
  DEPENDENCIES["fedora"].push(["pw-cat", "/usr/bin/pw-cat", "pipewire-utils"]);
  DEPENDENCIES["fedora"].push(["pipewire-pulse", "/usr/bin/pipewire-pulseaudio", "pipewire-pulseaudio"]);
  DEPENDENCIES["openSUSE"].push(["", "/usr/share/licenses/libsoup-3_0-0/COPYING", "libsoup-3_0-0"]);
}

if (GLib.find_program_in_path("pipewire") && versionCompare(GLib.getenv("CINNAMON_VERSION"), "6.2") >= 0) {
  DEPENDENCIES["default"].push(["pipewire-pulse", "/usr/bin/pipewire-pulse", "pipewire-pulse"]);
}

// --- Do not modify from here --- //
if (NEEDS_FONTS_SYMBOLA) {
  DEPENDENCIES["default"].push(["", "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf", "fonts-symbola"]);
  DEPENDENCIES["debian"].push(["", "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf", "fonts-symbola"]);
  DEPENDENCIES["devuan"].push(["", "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf", "fonts-symbola"]);
  DEPENDENCIES["fedora"].push(["", "/usr/share/fonts/gdouros-symbola/Symbola.ttf", "gdouros-symbola-fonts"]);
  DEPENDENCIES["openSUSE"].push(["", "/usr/share/fonts/truetype/Symbola.ttf", "gdouros-symbola-fonts"]);
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

var _ = function(str) {
  let translation = Gettext.gettext(str);
  if (translation !== str) {
    return translation;
  }
  return Gettext.dgettext(UUID, str);
}

const UPDATE = {
  "default": "sudo apt-get update",
  "arch": GLib.find_program_in_path("yay") != null ? "yay -Syu" : "sudo pacman -Syu",
  "debian": "apt-get update",
  "devuan": "apt-get update",
  "fedora": "sudo dnf update",
  "openSUSE": "",
  "gentoo": ""
}

const INSTALL = {
  "default": "sudo apt-get install",
  "arch": GLib.find_program_in_path("yay") != null ? "yay -S" : "sudo pacman -S",
  "debian": "apt-get install",
  "devuan": "apt-get install",
  "fedora": "sudo dnf install",
  "openSUSE": "sudo zypper --non-interactive install",
  "gentoo": ""
}

const USER_DATA_DIR = GLib.get_user_data_dir();

var DISTRO = function() {
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
function criticalNotify(msg, details, icon, button=[]) {
  let source = new MessageTray.SystemNotificationSource();
  messageTray.add(source);
  let notification = new MessageTray.Notification(source, UUID + ": " + msg, details, { icon: icon });
  notification.setTransient(false);
  notification.setUrgency(MessageTray.Urgency.CRITICAL);
  if (button.length === 2) {
    notification.addButton("callback", button[0]); // button[0]: label
    notification.connect("action-invoked", button[1]); // button[1]: callback
  }
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
  let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
  let ret1 = _interface_settings.get_string(_SETTINGS_KEY1);
  if (ret1 == null) {
    ret1 = get_terminal();
  }
  return "" + ret1;
} // End of get_default_terminal

function get_default_terminal_separator() {
  let _SETTINGS_SCHEMA='org.cinnamon.desktop.default-applications.terminal';
  let _SETTINGS_KEY2 = 'exec-arg'; // Ex: '-x'
  let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
  let ret2 = _interface_settings.get_string(_SETTINGS_KEY2);
  if (ret2 == null) {
    ret2 = '-e';
  }
  return " " + ret2 + " ";
} // End of get_default_terminal_separator

function isFedora() {
  return GLib.find_program_in_path("dnf")
} // End of isFedora

function isArchLinux() {
  return Gio.file_new_for_path("/etc/arch-release").query_exists(null)
} // End of isArchLinux

function isDebian() {
  return DISTRO() === 'debian' || DISTRO() === 'devuan'
} // End of isDebian

function isOpenSUSE() {
  return GLib.find_program_in_path("zypper")
}

function isGentoo() {
  return Gio.file_new_for_path("/etc/gentoo-release").query_exists(null)
} // End of isGentoo

function is_apturl_present() {
  return (GLib.find_program_in_path("apturl") != null)
} // End of is_apturl_present


function is_pkexec_present() {
  return (GLib.find_program_in_path("pkexec") != null)
} // End of is_pkexec_present

function is_pkcon_present() {
  return (GLib.find_program_in_path("pkcon") != null && GLib.find_program_in_path("pkexec") != null)
} // End of is_pkcon_present

function is_pkgcli_present() {
  return (GLib.find_program_in_path("pkgcli") != null && GLib.find_program_in_path("pkexec") != null)
} // End of is_pkgcli_present

function get_distro() {
  let distro = DISTRO();
  switch (distro) {
    case "debian":
    case "devuan":
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
      } else if (isGentoo) {
        return "gentoo"
      }
      return "default"; // linuxmint or ubuntu
  }
} // End of get_distro

function get_pkg_to_install() {
  let distro = get_distro();
  var pkgs = [];
  for (let d of DEPENDENCIES[distro]) {
    var isInstalled = false;
    let executables = Array.isArray(d[0]) ? d[0] : [d[0]];
    var find_program_in_path;
    if (Cinnamon.find_program_in_path) {
      find_program_in_path = (p, s) => Cinnamon.find_program_in_path(p, () => {});
    } else {
      find_program_in_path = (p, s) => GLib.find_program_in_path(p);
    }
    if (executables.some(e => e.length > 0 && find_program_in_path(e, null))) {
      isInstalled = true;
    } else {
      if (d[1].length > 0 && Gio.file_new_for_path(d[1]).query_exists(null)) {
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
      Gio.file_new_for_path("/usr/share/fonts/ttf-ancient-fonts/Symbola_hint.ttf").query_exists(null) ||
      Gio.file_new_for_path("%s/fonts/Symbola_Hinted.ttf".format(USER_DATA_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/fonts/Symbola.ttf".format(USER_DATA_DIR)).query_exists(null) ||
      Gio.file_new_for_path("%s/fonts/Symbola.otf".format(USER_DATA_DIR)).query_exists(null)
    )
    if (!_fonts_installed && (isArchLinux() || isGentoo())) {
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
      let separator = get_default_terminal_separator();
      // apturl is it present?
      let _is_apturl_present = is_apturl_present();
      let _is_pkcon_present = is_pkcon_present();
      let _is_pkgcli_present = is_pkgcli_present();
      let _is_pkexec_present = is_pkexec_present();
      // Detects the distrib in use and make adapted message and notification:
      let _isFedora = isFedora();
      let _isArchlinux = isArchLinux();
      let _isDebian = isDebian();
      let _isOpenSUSE = isOpenSUSE();
      let distro = get_distro();
      let _apt_update = UPDATE[distro];
      let _install = INSTALL[distro];
      let _pkg_to_install = get_pkg_to_install();
      let _and = " \\\\&\\\\& ";
      if (_apt_update.length === 0)
        _and = "";
      let _apt_install = "%s %s".format(_install, _pkg_to_install.join(" "));
      let criticalMessagePart1 = _("You appear to be missing some of the programs required for this applet to have all its features.");
      let criticalMessage = _is_apturl_present ? criticalMessagePart1 : criticalMessagePart1+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
      this.alertNotif = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);

      let pkgs_with_commas = _pkg_to_install.join(", ");
      let pkgs_wo_commas = _pkg_to_install.join(" ");
      if (_is_pkcon_present && _is_pkexec_present) {
        GLib.spawn_command_line_async(`${terminal} ${separator} sh -c "echo 'Radio3.0 message: Some packages needed'; echo 'List of needed packages: ${pkgs_with_commas}'; pkexec pkcon -y install ${pkgs_wo_commas}"`);
        this.depAreMet = false;
        return
      }

      if (_is_pkgcli_present && _is_pkexec_present) {
        GLib.spawn_command_line_async(`${terminal} ${separator} sh -c "echo 'Radio3.0 message: Some packages needed'; echo 'List of needed packages: ${pkgs_with_commas}'; pkexec pkgcli -y install ${pkgs_wo_commas}"`);
        this.depAreMet = false;
        return
      }

      if (!_is_apturl_present) {
        if (terminal != "") {
          // TRANSLATORS: The next messages should not be translated.
          if (_isDebian === true) {
            GLib.spawn_command_line_async(`${terminal} ${separator} sh -c "echo 'Radio3.0 message: Some packages needed'; echo 'To complete the installation, please become root with su then execute the command: ${_apt_update}${_and}${_apt_install}'; sleep 1; exec bash"`);
          } else {
            GLib.spawn_command_line_async(`${terminal} ${separator} 'sh -c "echo Radio3.0 message: Some packages needed; echo To complete the installation, please enter then execute the command: ${_apt_update}${_and}${_apt_install}'; sleep 1; exec bash"`);
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

if (!Extension.getCurrentExtension) {
  module.exports = {
    Dependencies,
    criticalNotify
  }
}
