const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = "sshlauncher@sumo";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation) {
  this._init(metadata, orientation);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.set_applet_tooltip(_("SSH Launcher"));

    try {
      this.set_applet_icon_name("network");
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this.appletPath = metadata.path;
      this.gsettings = Gio.Settings.new("org.gnome.desktop.default-applications.terminal");
      this.sshHeadless = false;
      this.sshForwardX = false;
      this.homeDir = GLib.get_home_dir();
	  this.sshConfig = this.homeDir + "/.ssh/config";
      this.msgSource = new MessageTray.SystemNotificationSource(_("SSH Launcher"));
      Main.messageTray.add(this.msgSource);
      let file = Gio.file_new_for_path(this.sshConfig);
      this.monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
      this.monitor.connect("changed", Lang.bind(this, this.updateMenu));
      this.updateMenu();
    }
    catch (e) {
      global.logError(e);
    }
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
      let [res, out, err, status] = GLib.spawn_command_line_sync('grep "^Host " .ssh/config');
      if(out.length!=0) {
        let hosts = out.toString().split("\n");
        for(let i=0; i<hosts.length; i++) {
          let host = hosts[i];
          if(host != "") {
            let hostname = host.replace("Host ", "");
            let item = new PopupMenu.PopupMenuItem(hostname);
            item.connect('activate', Lang.bind(this, function() { this.connectTo(hostname); }));
            this.menu.addMenuItem(item);
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
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    let menuitemUpdate = new PopupMenu.PopupMenuItem(_("Force Update from SSH config"));
    menuitemUpdate.connect('activate', Lang.bind(this, this.updateMenu));
    this.menu.addMenuItem(menuitemUpdate);
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
    Main.Util.spawnCommandLine(terminal + " -T \"" + hostname + "\" -e \"ssh " + flags + hostname + "\"");
    let notification = new MessageTray.Notification(this.msgSource, _("SSH Launcher"), _("Connection opened to ") + hostname);
    notification.setTransient(true);
    this.msgSource.notify(notification);
  },

  editConfig: function() {
	GLib.spawn_command_line_async(this.appletPath + "/launch_editor.sh");
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
