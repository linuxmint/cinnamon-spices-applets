/**
 * Version: 1.0
 *
 * Author: jakub@foobar.beer
 * Description: see metadata.json
 *
 * License: WTFPL 2019 (wtfpl.net)
 */
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = 'sshconnect@foobar-beer';
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.set_applet_tooltip('SSH Connect');

    try {
      this.set_applet_icon_path(AppletDir + '/icon.png');
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this.gsettings = Gio.Settings.new('org.gnome.desktop.default-applications.terminal');
      this.msgSource = new MessageTray.SystemNotificationSource('SSH Connect');

      Main.messageTray.add(this.msgSource);

      this.updateMenu();
    } catch (e) {
      global.logError(e);
    }
  },

  updateMenu: function() {
    this.menu.removeAll();

    let menuitemEdit = new PopupMenu.PopupMenuItem(_('Edit Config JSON'));
    menuitemEdit.connect('activate', Lang.bind(this, this.editConfig));
    this.menu.addMenuItem(menuitemEdit);

    let menuitemReload = new PopupMenu.PopupMenuItem(_('Reload Config'));
    menuitemReload.connect('activate', Lang.bind(this, this.updateMenu));
    this.menu.addMenuItem(menuitemReload);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let configFile = Gio.file_new_for_path(AppletDir + '/config.json');
    configFile.load_contents_async(null, function(file, res) {
      try {
        let content = configFile.load_contents_finish(res)[1];
        let json = JSON.parse(content);

        json.forEach(function(group) {
          let subMenu = new PopupMenu.PopupSubMenuMenuItem(group.groupName);
          group.group.forEach(function(entry) {
            let label = entry.name;
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', function() { this.connectTo(label, entry.host, entry.flags, entry.profile); }.bind(this));
            subMenu.menu.addMenuItem(item);
          }.bind(this));
          this.menu.addMenuItem(subMenu);
        }.bind(this));
      } catch (error) {
        global.logError(error);
      }
    }.bind(this));
  },

  connectTo: function(name, host, flags, profile) {
    let terminal = this.gsettings.get_string('exec');

    let addProfile = (profile !== undefined && profile !== '' ? ' --profile="' + profile + '"' : '');
    let addFlag = (flags !== undefined && flags !== '' ? flags : '');
    
    Main.Util.spawnCommandLine(terminal + ' -t "' + name + '"' + addProfile + ' -e "ssh ' + addFlag + ' ' + host + '"');

    let notification = new MessageTray.Notification(this.msgSource, 'SSH Connect', _('Connection opened for ') + name);
    notification.setTransient(true);
    this.msgSource.notify(notification);
  },

  editConfig: function() {
    Main.Util.spawn_async(["xdg-open", AppletDir + '/config.json'], null);
  },

  on_applet_clicked: function(event) {
    this.menu.toggle();
  }

};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
