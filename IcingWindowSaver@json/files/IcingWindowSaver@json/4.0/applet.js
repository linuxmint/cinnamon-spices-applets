const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const {MaximizeFlags} = imports.gi.Meta;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const {AppletSettings} = imports.ui.settings;
const {each, find} = imports.misc.util;
const Main = imports.ui.main;

const UUID = 'IcingWindowSaver@json';
const MAXIMIZE_FLAGS = MaximizeFlags.HORIZONTAL | MaximizeFlags.VERTICAL;

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
      this.state = {};
      this.settings = new AppletSettings(this.state, metadata.uuid, instance_id);
      let settingsProps = [
        {key: 'windowStates', value: 'windowStates', cb: null},
        {key: 'restoreOnMonitorChange', value: 'restoreOnMonitorChange', cb: null},
        {key: 'saveHotkey', value: 'saveHotkey', cb: this.onHotkeysChanged},
        {key: 'restoreHotkey', value: 'restoreHotkey', cb: this.onHotkeysChanged},
      ];
      each(settingsProps, (prop) =>  {
        this.settings.bind(
          prop.key,
          prop.value,
          prop.cb ? (...args) => prop.cb.call(this, ...args) : null
        );
      });

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

      this.bindHotkeys();
    });
  }

  onMonitorsChanged() {
    if (!this.state.restoreOnMonitorChange) return;
    setTimeout(() => this.restoreWindows(false), 2000);
  }

  onHotkeysChanged() {
    this.unbindHotkeys();
    this.bindHotkeys();
  }

  bindHotkeys() {
    Main.keybindingManager.addHotKey('save-windows-positions', this.state.saveHotkey, () => {
      this.saveWindows();
    });
    Main.keybindingManager.addHotKey('restore-windows-positions', this.state.restoreHotkey, () => {
      this.restoreWindows();
    });
  }

  unbindHotkeys() {
    Main.keybindingManager.removeHotKey('save-windows-positions');
    Main.keybindingManager.removeHotKey('restore-windows-positions');
  }

  saveWindows() {
    let windows = global.display.list_windows(0);
    each(windows, (metaWindow) => {
      let windowState = find(this.state.windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });

      let metaWindowActor = metaWindow.get_compositor_private();
      let [x, y] = metaWindowActor.get_position();
      let [width, height] = metaWindowActor.get_size();
      let maximized = metaWindow.maximized_horizontally && metaWindow.maximized_vertically;
      let {minimized} = metaWindow;
      if (windowState) {
        windowState.x = x;
        windowState.y = y;
        windowState.width = width;
        windowState.height = height;
        windowState.maximized = maximized;
        windowState.minimized = minimized;

      } else {
        this.state.windowStates.push({
          x,
          y,
          width,
          height,
          maximized,
          minimized,
          id: metaWindow.get_xwindow()
        });
      }
    });

    this.settings.setValue('windowStates', this.state.windowStates);
  }

  restoreWindows(userAction = true) {
    let windows = global.display.list_windows(0);
    let windowStates = [];
    each(windows, (metaWindow) => {
      let windowState = find(this.state.windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });
      if (!windowState) return;

      let {x, y, width, height, maximized, minimized} = windowState;

      if (!maximized && (metaWindow.maximized_horizontally || metaWindow.maximized_vertically)) {
        metaWindow.unmaximize(MAXIMIZE_FLAGS);
      }

      metaWindow.resize(userAction, width, height);
      metaWindow.move(userAction, x, y);

      if (maximized && (!metaWindow.maximized_horizontally || !metaWindow.maximized_vertically)) {
        metaWindow.maximize(MAXIMIZE_FLAGS);
      }

      if (minimized && !metaWindow.minimized) metaWindow.minimize();
      else if (!minimized && metaWindow.minimized) metaWindow.unminimize();

      windowStates.push(windowState);
    });

    this.state.windowStates = windowStates;
    this.settings.setValue('windowStates', this.state.windowStates);
  }

  on_applet_removed_from_panel() {
    if (this.monitorsChangedId) global.screen.disconnect(this.monitorsChangedId)

    this.unbindHotkeys();
    this.settings.finalize();
  }

  on_applet_clicked(event) {
    if (!this.menu) return;
    this.menu.toggle();
  }
};

const main = function main(metadata, orientation, panel_height, instance_id) {
  return new WindowSaverApplet(metadata, orientation, panel_height, instance_id);
};
