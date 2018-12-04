const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Main = imports.ui.main;

const UUID = 'IcingWindowSaver@json';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const appletPath = '~/.local/share/cinnamon/applets/IcingWindowSaver@json/3.6';

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

const notifyDependencies = function(missing) {
  let icon = new St.Icon({
    icon_type: St.IconType.FULLCOLOR,
    icon_size: 24 * global.ui_scale,
    gicon: new Gio.FileIcon({
      file: Gio.file_new_for_path(
        GLib.get_home_dir() + '/.local/share/cinnamon/applets/' + UUID + '/icon.png'
      )
    })
  });
  let header = _('Dependency missing');
  let pkg = _('package');
  if (missing.length > 1) {
    header = _('Dependencies missing');
    pkg = _('packages');
  }
  Main.criticalNotify(
    header,
    _('Please install the ') + missing.join(', ') + ' ' + pkg + _(' to use Window Position Saver.'),
    icon
  );
}

const checkDependencies = function(cb) {
  let missing = [];
  exec('which wmctrl', (success, stdout) => {
    if (!stdout) missing.push('wmctrl');
    exec('which xwininfo', (success, stdout) => {
      if (!stdout) missing.push('xwininfo');
      cb(missing)
    });
  });
}

const WindowSaverApplet = function(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

WindowSaverApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panelHeight, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

    checkDependencies((missing) => {
      if (missing.length > 0) {
        notifyDependencies(missing);
        this.set_applet_icon_path(metadata.path + '/icon.png');
        this.set_applet_tooltip(metadata.description);
        return;
      }
      this.orientation = orientation;

      this.setAllowedLayout(Applet.AllowedLayout.BOTH);

      this.set_applet_icon_symbolic_name('view-restore');
      this.set_applet_tooltip(_('Window Position Saver'));

      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this._contentSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._contentSection);

      var item = new PopupMenu.PopupIconMenuItem(_('Save'), 'media-floppy', St.IconType.SYMBOLIC);
      item.connect('activate', () => {
        this.saveWindows();
      });
      this.menu.addMenuItem(item);

      item = new PopupMenu.PopupIconMenuItem(_('Restore'), 'view-restore', St.IconType.SYMBOLIC);
      item.connect('activate', () => {
        this.restoreWindows();
      });
      this.menu.addMenuItem(item);

      Main.keybindingManager.addHotKey('save-windows-positions', '<Shift><Ctrl>S', () => {
        this.saveWindows();
      });
      Main.keybindingManager.addHotKey('restore-windows-positions', '<Shift><Ctrl>R', () => {
        this.restoreWindows();
      });
    });
  },

  saveWindows: function() {
    Util.trySpawnCommandLine(`bash -c '${appletPath}/savewindows.sh'`);
  },

  restoreWindows: function() {
    Util.trySpawnCommandLine(`bash -c '${appletPath}/restorewindows.sh'`);
  },

  on_applet_clicked: function(event) {
    if (!this.menu) return;
    this.menu.toggle();
  }
};

const main = function main(metadata, orientation, panel_height, instance_id) {
  return new WindowSaverApplet(metadata, orientation, panel_height, instance_id);
};
