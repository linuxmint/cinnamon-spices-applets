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

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var KEYS = {
  CUSTOM_COMMAND: 'customCommand',
  SAFE_MODEL: 'safeMode',
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
    this._safeMode;
    this._customCommand;

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

  /** Runs on init */
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
        this.set_applet_icon_name(icon);
        return;
      }

      let notification = new MessageTray.Notification(this.msgSource, _("SSH Launcher"), _("No suitable icon found, falling back to custom icon"));
      notification.setTransient(true);
      this.msgSource.notify(notification);
    }
    this.set_applet_icon_path(AppletDir + "/icon.png");
  },

   addRefreshButton: function() {
    let itemLabel = _("Force Update from SSH config");
    let refreshMenuItem = new Applet.MenuItem(itemLabel, 'view-refresh', Lang.bind(this, this.updateMenu));
    this._applet_context_menu.addMenuItem(refreshMenuItem);
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
        let hosts = out.toString().split("\n");
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
    let flags = "";
    if (this.sshHeadless) {
      flags = " -fN ";
    }
    if (this.sshForwardX) {
      flags = " -X " + flags;
    }

    let terminal = this.gsettings.get_string("exec");
    let terminalArg = this.gsettings.get_string("exec-arg");

    let command = "";
    if (this.notEmpty(this._customCommand)) {
      command = this._customCommand;
      command += (" \"ssh " + flags + hostname + "\"");
    }
    else {
      command = terminal + " ";
      if (!this._safeMode) command += ("-t \"" + hostname + "\" ");
      command += (terminalArg + " \"ssh " + flags + hostname + "\"");
    }

    Util.spawnCommandLine(command);
    let notification = new MessageTray.Notification(this.msgSource, _("SSH Launcher"), _("Connection opened to ") + hostname + " using " + terminal);
    notification.setTransient(true);
    this.msgSource.notify(notification);
  },

  editConfig: function() {
  GLib.spawn_command_line_async(this.appletPath + "/launch_editor.sh");
  },

  notEmpty: function(text) {
    if (!text) return false;
    return (text.trim().length != 0)
  },

  on_applet_clicked: function(event) {
    this.menu.toggle();
  },

  toggleHeadless: function(event) {
    this.sshHeadless = event.state;
  },

  toggleForwardX: function(event) {
    this.sshForwardX = event.state;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
