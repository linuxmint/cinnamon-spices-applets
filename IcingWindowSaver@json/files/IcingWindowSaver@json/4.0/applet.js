const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const {MaximizeFlags} = imports.gi.Meta;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const {each, find} = imports.misc.util;
const Main = imports.ui.main;

const UUID = 'IcingWindowSaver@json';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

function _(str) {
  return Gettext.dgettext(UUID, str);
}

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

class WindowSaverApplet extends Applet.IconApplet {
  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);

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

      this.windowStates = [];

      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);
      this._contentSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._contentSection);

      this.monitorsChangedId = global.screen.connect_after('monitors-changed', () => this.onMonitorsChanged());

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
  }

  onMonitorsChanged() {
    setTimeout(() => this.restoreWindows(), 2000);
  }

  saveWindows() {
    let windows = global.display.list_windows(0);
    each(windows, (metaWindow) => {
      let windowState = find(this.windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });

      let metaWindowActor = metaWindow.get_compositor_private();
      let [x, y] = metaWindowActor.get_position();
      let [width, height] = metaWindowActor.get_size();
      if (windowState) {
        windowState.x = x;
        windowState.y = y;
        windowState.width = width;
        windowState.height = height;
        windowState.maximized = metaWindow.maximized_horizontally && metaWindow.maximized_vertically;
        windowState.matched = false;
      } else {
        this.windowStates.push({
          x,
          y,
          width,
          height,
          maximized: metaWindow.maximized_horizontally && metaWindow.maximized_vertically,
          id: metaWindow.get_xwindow(),
          matched: false
        });
      }
    });
  }

  restoreWindows() {
    let windows = global.display.list_windows(0);
    each(windows, (metaWindow) => {
      let windowState = find(this.windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });
      if (!windowState) return;
      metaWindow.matched = true;

      let {x, y, width, height, maximized} = windowState;

      metaWindow.move(true, x, y);
      metaWindow.resize(true, width, height);

      if (maximized) metaWindow.maximize(MaximizeFlags.HORIZONTAL | MaximizeFlags.VERTICAL);
      else metaWindow.unmaximize(MaximizeFlags.HORIZONTAL | MaximizeFlags.VERTICAL);
    });
  }

  on_applet_removed_from_panel() {
    if (this.monitorsChangedId) global.screen.disconnect(this.monitorsChangedId)
  }

  on_applet_clicked(event) {
    if (!this.menu) return;
    this.menu.toggle();
  }
};

const main = function main(metadata, orientation, panel_height, instance_id) {
  return new WindowSaverApplet(metadata, orientation, panel_height, instance_id);
};
