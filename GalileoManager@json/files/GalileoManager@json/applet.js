const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const MessageTray = imports.ui.messageTray;

// l10n
const Gettext = imports.gettext;
const UUID = 'GalileoManager@json';

const _ = function(str) {
  let cinnamonTranslation = Gettext.gettext(str);
  if (cinnamonTranslation !== str) {
    return cinnamonTranslation;
  }
  return Gettext.dgettext(UUID, str);
}

const defaultTooltipString = _('Galileo Manager');

const exec = function(command, cb) {
  let subprocess = new Gio.Subprocess({
    argv: ['bash', '-c', command],
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDERR_MERGE,
  });
  subprocess.init(null);
  subprocess.communicate_utf8_async(null, null, (obj, res) => {
    let [success, out] = obj.communicate_utf8_finish(res);
    if (typeof cb === 'function') {
      cb(success, out);
    }
  });
};

const GalileoManager = function(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

GalileoManager.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panelHeight, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

    this.path = metadata.path;
    this.orientation = orientation
    this.defaultIconPath = this.path + '/icon.png';

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.set_applet_icon_path(this.defaultIconPath);
    this.set_applet_tooltip(defaultTooltipString);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this._contentSection = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this._contentSection);

    exec('which galileo', success => this.buildMenu(success));
  },

  buildMenu: function(galileoInstalled) {
    let item;
    if (galileoInstalled) {
      item = new PopupMenu.PopupIconMenuItem(_('Sync Fitness Tracker'), 'view-refresh', St.IconType.SYMBOLIC);
      item.connect('activate', () => this.syncGalileo());
      this.menu.addMenuItem(item);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      item = new PopupMenu.PopupIconMenuItem(_('Uninstall Galileo'), 'user-trash', St.IconType.SYMBOLIC);
      item.connect('activate', () => this.removeGalileo());
      this.menu.addMenuItem(item);
    } else {
      item = new PopupMenu.PopupIconMenuItem(_('Install Galileo'), 'system-software-install', St.IconType.SYMBOLIC);
      item.connect('activate', () => this.setupGalileo());
      this.menu.addMenuItem(item);
    }
  },

  notify: function(heading, body) {
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(
      source,
      heading,
      body
    );
    notification.setTransient(true);
    notification.setUrgency(MessageTray.Urgency.NORMAL);
    source.notify(notification);
  },

  setErrorStatus: function(status) {
    this.set_applet_icon_path(this.path + '/icon_error.png');
    this.set_applet_tooltip(status);
  },


  setupGalileo: function() {
    this.notify(_('Setting up Galileo'), _('Please wait...'));
    let scriptPath = this.path + '/resources/setup.sh';
    let description = _('This script will install Galileo and its dependencies using PIP.') + '\n';
    exec('gnome-terminal -x sh -c \'echo "' + description + '"; sudo ' + scriptPath + '; exec bash\'', (success) => {
      if (!success) {
        this.setErrorStatus(_('An error occurred while installing Galileo.'));
        return;
      }
      this.menu.removeAll();
      this.buildMenu(true);
      this.notify(
        _('Setup Complete'),
        _('You must re-insert your Fitbit dongle to be able to use it as a non-root user.')
      );
    });
  },

  removeGalileo: function() {
    this.notify(_('Removing Galileo'), _('Please wait...'));
    let scriptPath = this.path + '/resources/uninstall.sh';
    let description = _('This script will remove Galileo.') + '\n';
    exec('gnome-terminal -x sh -c \'echo "' + description + '"; sudo ' + scriptPath + '; exec bash\'', (success) => {
      if (!success) {
        this.setErrorStatus(_('An error occurred while removing Galileo.'));
        return;
      }
      this.menu.removeAll();
      this.buildMenu(false);
    });
  },

  syncGalileo: function() {
    this.set_applet_icon_path(this.path + '/icon_sync.png');
    this.set_applet_tooltip(_('Syncing fitness tracker...'));
    exec('galileo --force', (success, stdout) => {
      this.notify('Sync Status', stdout);
      if (!success) {
        this.setErrorStatus(_('An error occurred while syncing.'));
        log(stdout);
        return;
      }
      this.set_applet_icon_path(this.defaultIconPath);
      this.set_applet_tooltip(defaultTooltipString);
    });
  },

  on_applet_clicked(){
    this.menu.toggle();
  },
};

const main = function(metadata, orientation, panel_height, instance_id) {
  return new GalileoManager(metadata, orientation, panel_height, instance_id)
};