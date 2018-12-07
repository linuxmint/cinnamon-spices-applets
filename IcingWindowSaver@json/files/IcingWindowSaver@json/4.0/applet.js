const {get_home_dir} = imports.gi.GLib;
const {IconType} = imports.gi.St;
const {MaximizeFlags} = imports.gi.Meta;
const {bindtextdomain, dgettext} = imports.gettext;
const {IconApplet, AllowedLayout, AppletPopupMenu} = imports.ui.applet;
const {PopupMenuManager, PopupIconMenuItem} = imports.ui.popupMenu;
const {AppletSettings} = imports.ui.settings;
const {each, find} = imports.misc.util;
const {keybindingManager} = imports.ui.main;

const UUID = 'IcingWindowSaver@json';
const MAXIMIZE_FLAGS = MaximizeFlags.HORIZONTAL | MaximizeFlags.VERTICAL;

bindtextdomain(UUID, get_home_dir() + '/.local/share/locale')

function _(str) {
  return dgettext(UUID, str);
}

const getFramedWindowPosition = function(metaWindow) {
  let clientRect = metaWindow.get_rect();
  let {width, height, x, y} = metaWindow.get_outer_rect();
  height -= (height - clientRect.height);
  x -= (width - clientRect.width);
  return [width, height, x, y];
};

const getWindowActorPosition = function(metaWindow) {
  let metaWindowActor = metaWindow.get_compositor_private();
  let [x, y] = metaWindowActor.get_position();
  let [width, height] = metaWindowActor.get_size();
  return [width, height, x, y];
};

class WindowSaverApplet extends IconApplet {
  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);

    this.orientation = orientation;

    this.setAllowedLayout(AllowedLayout.BOTH);

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

    this.menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.monitorsChangedId = global.screen.connect_after('monitors-changed', () => this.onMonitorsChanged());

    var item = new PopupIconMenuItem(_('Save'), 'media-floppy', IconType.SYMBOLIC);
    item.connect('activate', () => {
      this.saveWindows();
    });
    this.menu.addMenuItem(item);

    item = new PopupIconMenuItem(_('Restore'), 'view-restore', IconType.SYMBOLIC);
    item.connect('activate', () => {
      this.restoreWindows();
    });
    this.menu.addMenuItem(item);

    this.bindHotkeys();
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
    keybindingManager.addHotKey('save-windows-positions', this.state.saveHotkey, () => {
      this.saveWindows();
    });
    keybindingManager.addHotKey('restore-windows-positions', this.state.restoreHotkey, () => {
      this.restoreWindows();
    });
  }

  unbindHotkeys() {
    keybindingManager.removeHotKey('save-windows-positions');
    keybindingManager.removeHotKey('restore-windows-positions');
  }

  saveWindows() {
    let windows = global.display.list_windows(0);
    each(windows, (metaWindow) => {
      let windowState = find(this.state.windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });

      let width, height, x, y;
      if (metaWindow.decorated) {
        [width, height, x, y] = getFramedWindowPosition(metaWindow);
      } else {
        [width, height, x, y] = getWindowActorPosition(metaWindow);
      }

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

      if (metaWindow.decorated) metaWindow.move_frame(userAction, x, y);
      else metaWindow.move(userAction, x, y);

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
