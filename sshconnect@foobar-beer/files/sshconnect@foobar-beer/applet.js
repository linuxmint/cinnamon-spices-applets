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
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
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

    this.settings = new Settings.AppletSettings(this, UUID, instance_id);

    try {
      this.set_applet_icon_path(AppletDir + '/icon.png');
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this.msgSource = new MessageTray.SystemNotificationSource('SSH Connect');

      Main.messageTray.add(this.msgSource);

      this.updateMenu();
    } catch (e) {
      global.logError(e);
    }
  },

  updateMenu: function() {
    this.menu.removeAll();

    let menuitemReload = new PopupMenu.PopupMenuItem(_('Reload Config'));
    menuitemReload.connect('activate', Lang.bind(this, this.updateMenu));
    this.menu.addMenuItem(menuitemReload);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let connections = this.settings.getValue('connections');
    let groups = connections.reduce(function(r, c) {
      r[c.group] = (r[c.group] || []).concat(c);
      return r;
    }, Object.create(null));

    for (let group in groups) {
      let subMenu = new PopupMenu.PopupSubMenuMenuItem(group);
      groups[group].forEach(function(entry) {
        let label = entry.name;
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', function() { this.connectTo(label, entry.host, entry.flags, entry.profile); }.bind(this));
        subMenu.menu.addMenuItem(item);
      }.bind(this));
      this.menu.addMenuItem(subMenu);
    }
  },

  connectTo: function(name, host, flags, profile) {
    let terminal = this.settings.getValue('terminal-exec');

    let setTitle = this.settings.getValue('customize-title');
    let addTitle = setTitle ? ' ' + this.settings.getValue('title-flag') + '"' + name + '"' : '';

    let setProfile = this.settings.getValue('customize-profile');
    let addProfile = (setProfile && profile !== undefined && profile !== '' ? ' ' + this.settings.getValue('profile-flag') + '"' + profile + '"' : '');

    let addFlag = (flags !== undefined && flags !== '' ? flags : '');
    let addExecStr = ' ' + this.settings.getValue('exec-flag') + '"ssh ' + addFlag + ' ' + host + '"';
    
    Main.Util.spawnCommandLine(terminal + addTitle + addProfile + addExecStr);

    let notification = new MessageTray.Notification(this.msgSource, 'SSH Connect', _('Connection opened for ') + name);
    notification.setTransient(true);
    this.msgSource.notify(notification);
  },

  on_applet_clicked: function(event) {
    this.menu.toggle();
  }

};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
