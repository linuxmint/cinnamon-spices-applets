const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util; // Needed for spawnCommandLine()
const MessageTray = imports.ui.messageTray;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = "sshlauncher@sumo";
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const ByteArray = imports.byteArray;

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory (which can be created by the 'touch DEBUG' command).
 * @returns {boolean}
 */
function DEBUG() {
  let _debug = Gio.file_new_for_path(AppletDir + "/DEBUG");
  return _debug.query_exists(null);
};

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const KEYS = {
  CUSTOM_COMMAND: 'customCommand',
};
const CUSTOM_ICON_KEY = "themeIcon";
const SYMBOLIC_ICON_KEY = "symbolicIcon";

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.set_applet_tooltip(_("SSH Launcher"));
    // Settings
    this._customCommand = "";

    try {
      this.settings = new Settings.AppletSettings(this, UUID, instance_id);
      this.bindSettings();
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this.appletPath = metadata.path;
      this.gsettings = Gio.Settings.new("org.cinnamon.desktop.default-applications.terminal");
      this.sshHeadless = false;
      this.sshForwardX = false;
      this.homeDir = GLib.get_home_dir();
	    this.sshConfig = this.homeDir + "/.ssh/config";
      this.msgSource = new MessageTray.SystemNotificationSource(_("SSH Launcher"));
      Main.messageTray.add(this.msgSource);
      let file = Gio.file_new_for_path(this.sshConfig);
      this.monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
      this.monitor.connect("changed", Lang.bind(this, this.updateMenu));
      this.addRefreshButton();
      this.updateMenu();
    }
    catch (e) {
      global.logError(e);
    }
  },

  bindSettings: function() {
    for (let k in KEYS) {
      let key = KEYS[k];
      let keyProp = "_" + key;
      this.settings.bindProperty(Settings.BindingDirection.IN,
        key, keyProp, null, null);
    }

    this.setAppletIcon();

    this.settings.connect("changed::" + CUSTOM_ICON_KEY, Lang.bind(this, function () {
      this.setAppletIcon();
    }))
    this.settings.connect("changed::" + SYMBOLIC_ICON_KEY, Lang.bind(this, function () {
      this.setAppletIcon();
    }))
  },

  setAppletIcon: function() {
    let _themeIcon = this.settings.getValue(CUSTOM_ICON_KEY);
    let _symbolic = this.settings.getValue(SYMBOLIC_ICON_KEY);
    if (_themeIcon) {
      let icon = "folder-remote";
      if (_symbolic) icon += "-symbolic";

      if (Gtk.IconTheme.get_default().has_icon(icon)) {
        if (_symbolic) this.set_applet_icon_symbolic_name(icon); else this.set_applet_icon_name(icon);
        return;
      }

      this.sendNotification(_("SSH Launcher"), _("No suitable icon found, falling back to custom icon"));
    }
    this.set_applet_icon_path(AppletDir + "/icon.png");
  },

  addRefreshButton: function() {
    let itemLabel = _("Force Update from SSH config");
    let refreshMenuItem = new Applet.MenuItem(itemLabel, 'view-refresh', Lang.bind(this, this.updateMenu));
    this._applet_context_menu.addMenuItem(refreshMenuItem);
  },

  getTermOptions: function(terminal) {
    let t = terminalOptions[terminal];
    return (!t) ? null : t;
  },

  /**
   * Trust our own options first, then
   * the exec-arg stored in cinnamon-settings.
   * @param {string} terminal name of terminal
   * @returns {string} terminal's execute flag
   */
  getTermExecuteFlag: function(terminal) {
      let termOptions = this.getTermOptions(terminal);
      if (!!termOptions) {
        return (termOptions.execute[0] + " ");
      }
      else {
        let termArg = this.gsettings.get_string("exec-arg");
        return (termArg + " ");
      }
  },

  /**
   * Adds title if option available in terminal.
   * @param {string} terminal name of terminal
   * @param {string} hostName hostname stored in ssh-config
   * @returns {string} all extra terminal options if available
   */
  buildTermFlags: function(terminal, hostName) {
    let termOptions = this.getTermOptions(terminal);
    let options = "";
    if (termOptions == null) return options;
    if (termOptions.title != null) options += (termOptions.title + " \"" + hostName + "\" ");

    return options;
  },

  buildSshFlags: function() {
    let flags = "";
    if (this.sshForwardX) flags += " -X ";
    if (this.sshHeadless) flags += " -fN ";

    return flags;
  },

  /**
   * @param {string} terminal name of terminal
   * @param {string} arg execute argument of terminal
   * @returns {boolean}
   */
  isExecArgCorrect: function(terminal, arg) {
    let termOptions = this.getTermOptions(terminal);
    if (termOptions == null) return true; // No info stored on terminal, no way to validate
    if (!this.arrayIncludes(termOptions.execute, arg)) {
      global.log("'org.cinnamon.desktop.default-applications.terminal exec-arg' might be incorrectly set for " + terminal + " terminal emulator: '" + arg + "' instead of options '" + JSON.stringify(termOptions.execute) + "'");
      return false;
    }
    return true;
  },

  updateMenu: function() {
    this.menu.removeAll();
    let menuitemHeadless = new PopupMenu.PopupSwitchMenuItem(_("Background (-fN)"));
    menuitemHeadless.connect('activate', Lang.bind(this, this.toggleHeadless));
    this.menu.addMenuItem(menuitemHeadless);
    let menuitemForwardX = new PopupMenu.PopupSwitchMenuItem(_("Forward X11 (-X)"));
    menuitemForwardX.connect('activate', Lang.bind(this, this.toggleForwardX));
    this.menu.addMenuItem(menuitemForwardX);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    try {
      let [res, out, err, status] = GLib.spawn_command_line_sync('grep -e "^Host " -e "^#GroupStart" -e "^#GroupEnd" .ssh/config');
      if(out.length!=0) {
        let inGroup = false;
        let hosts = ByteArray.toString(out).split("\n");
        let Grouper = null;

        for(let i=0; i<hosts.length; i++) {
          let host = hosts[i];
          if(host != "") {
           if (host.startsWith("#GroupStart")) {
                let hostname = host.replace("#GroupStart", "").trim();
                if (hostname != "") {
                    Grouper = new PopupMenu.PopupSubMenuMenuItem(hostname);
                    this.menu.addMenuItem(Grouper);
                    inGroup = true;
                }
                continue;
           } else if (host === "#GroupEnd") {
                inGroup = false;
                continue;
           }

            let hostname = host.replace("Host ", "");
            let item = new PopupMenu.PopupMenuItem(hostname);
            item.connect('activate', Lang.bind(this, function() { this.connectTo(hostname); }));
            if (inGroup) {
              Grouper.menu.addMenuItem(item);
            } else {
              this.menu.addMenuItem(item);
            }
          }
        }
      }
    } catch(e) {
      this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("ERROR. ") + e, { reactive: false }));
    }
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    let menuitemEdit = new PopupMenu.PopupMenuItem(_("Edit SSH config"));
    menuitemEdit.connect('activate', Lang.bind(this, this.editConfig));
    this.menu.addMenuItem(menuitemEdit);
  },

  connectTo: function(hostname) {
    let command = "";
    let terminal = "";

    if (!this.empty(this._customCommand)) { // Custom command set in settings
      command = this._customCommand;
      terminal = command.split(" ")[0]; // Get terminal name from custom command
    }
    else {
      terminal = this.gsettings.get_string("exec");
      if (this.empty(terminal)) {
        this.sendNotification(_("SSH Launcher"), _("Error: I can't open the terminal.\nYou need to set a default terminal first in Preferred Applications!\n\n(More help in Right Click->About->More Info)"));
        return;
      }
      command = terminal + " ";
      command += this.buildTermFlags(terminal, hostname);
      command += this.getTermExecuteFlag(terminal);
    }

    command += (" ssh " + this.buildSshFlags() + hostname);

    // TODO: capture of the command output in the event of success/failure
    // to provide better feedback on issues
    Util.spawnCommandLine(command);
    if (DEBUG()) global.log("Terminal opened with command '" + command + "'");
    this.sendNotification(_("SSH Launcher"), _("Connection opened to ") + hostname + _(" using ") + terminal);
  },

  editConfig: function() {
  GLib.spawn_command_line_async(this.appletPath + "/launch_editor.sh");
  },

  empty: function(text) {
    if (!text) return true;
    return (text.trim().length == 0)
  },

  on_applet_clicked: function(event) {
    this.menu.toggle();
  },

  toggleHeadless: function(event) {
    this.sshHeadless = event.state;
  },

  toggleForwardX: function(event) {
    this.sshForwardX = event.state;
  },

  sendNotification: function(title, message) {
    let notification = new MessageTray.Notification(this.msgSource, title, message);
    notification.setTransient(true);
    this.msgSource.notify(notification);
  },

  arrayIncludes: function(arr, item) {
    if (!arr) return false;
    if (!item) return false;
    return (arr.indexOf(item) != -1);
  }
};


const terminalOptions = {
  "gnome-terminal": {
    "title": "-t",
    "execute": ["-x"]
  },
  "tilix": {
    "title": "-t",
    "execute": ["--new-process -e", "", "-e"]
  },
  "alacritty": {
    "title": "-t",
    "execute": ["-e"]
  },
  "xterm": {
    "title": "-T",
    "execute": ["-e"]
  },
  "rxvt": {
    "title": "-title",
    "execute": ["-e"]
  },
  "urxvt": {
    "title": "-title",
    "execute": ["-e"]
  },
  "cool-retro-term": {
    "title": "-T",
    "execute": ["-e"]
  },
  "p-term": {
    "title": "-T",
    "execute": ["-e"]
  },
  "konsole": {
    "title": null,
    "execute": ["-e"]
  },
  "qterminal": {
    "title": null,
    "execute": ["-e"]
  },
  "kitty": {
    "title": null,
    "execute": [""]
  },
  "terminology": {
    "title": "-n",
    "execute": ["-e"]
  },
  "lxterminal": {
    "title": "-t",
    "execute": ["-e"]
  },
  "termite": {
    "title": "-t",
    "execute": ["-e"]
  },
  "xfce4-terminal": {
    "title": "-T",
    "execute": ["-x"]
  },
  "sakura": {
    "title": "-t",
    "execute": ["-x"]
  },
  "io.elementary.terminal": { //wtf?
    "title": null,
    "execute": ["-e"]
  },
}

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
