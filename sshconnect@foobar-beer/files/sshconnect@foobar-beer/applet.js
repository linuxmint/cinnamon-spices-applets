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
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const UUID = 'sshconnect@foobar-beer';
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

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
    let ungrouped = [];
    let groups = Object.create(null);

    connections.forEach(function(c) {
      let groupName = (c.group !== undefined && c.group !== null) ? c.group.trim() : '';
      if (groupName === '' || groupName === '/') {
        ungrouped.push(c);
      } else {
        groups[groupName] = (groups[groupName] || []).concat(c);
      }
    });

    for (let group in groups) {
      let subMenu = new PopupMenu.PopupSubMenuMenuItem(group);
      groups[group].forEach(function(entry) {
        let label = entry.name;
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', function() {
          this.connectTo(label, entry.host, entry.flags, entry.profile);
        }.bind(this));
        subMenu.menu.addMenuItem(item);
      }.bind(this));
      this.menu.addMenuItem(subMenu);
    }

    if (Object.keys(groups).length > 0 && ungrouped.length > 0) {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    ungrouped.forEach(function(entry) {
      let label = entry.name;
      let item = new PopupMenu.PopupMenuItem(label);
      item.connect('activate', function() {
        this.connectTo(label, entry.host, entry.flags, entry.profile);
      }.bind(this));
      this.menu.addMenuItem(item);
    }.bind(this));
  },

  connectTo: function(name, host, flags, profile) {
    let terminal = (this.settings.getValue('terminal-exec') || 'gnome-terminal').trim();
    let setTitle = this.settings.getValue('customize-title');
    let titleFlag = (this.settings.getValue('title-flag') || '-t').trim();
    let setProfile = this.settings.getValue('customize-profile');
    let profileFlag = (this.settings.getValue('profile-flag') || '--profile=').trim();
    let execFlag = (this.settings.getValue('exec-flag') || '').trim();

    let argv = [terminal];

    if (setTitle && titleFlag !== '') {
      argv.push(titleFlag);
      argv.push(name);
    }

    if (setProfile && profile && profile.trim() !== '' && profileFlag !== '') {
      if (profileFlag.endsWith('=')) {
        argv.push(profileFlag + profile.trim());
      } else {
        argv.push(profileFlag);
        argv.push(profile.trim());
      }
    }

    let sshArgs = ['ssh'];
    if (flags && flags.trim() !== '') {
      let [res, parsedFlags] = GLib.shell_parse_argv(flags.trim());
      if (res && parsedFlags) {
        sshArgs.push(...parsedFlags);
      } else {
        sshArgs.push(...flags.trim().split(/\s+/));
      }
    }
    if (host && host.trim() !== '') {
      let [res, parsedHost] = GLib.shell_parse_argv(host.trim());
      if (res && parsedHost) {
        sshArgs.push(...parsedHost);
      } else {
        sshArgs.push(...host.trim().split(/\s+/));
      }
    }

    if (execFlag !== '') {
      argv.push(execFlag);
      argv.push(sshArgs.join(' '));
    } else {
      argv.push('--');
      argv.push(...sshArgs);
    }

    try {
      Util.spawn(argv);
    } catch (e) {
      global.logError('SSH Connect error spawning terminal: ' + e);
    }

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
