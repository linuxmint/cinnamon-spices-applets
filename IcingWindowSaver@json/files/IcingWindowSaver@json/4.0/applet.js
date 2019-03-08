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

const getWindowActorPosition = function(metaWindowActor) {
  let [x, y] = metaWindowActor.get_position();
  let [width, height] = metaWindowActor.get_size();
  return [width, height, x, y];
};

const getFocusState = function(metaWindow) {
  if (!metaWindow || metaWindow.minimized) {
      return false;
  }

  if (metaWindow.appears_focused) {
      return true;
  }

  let transientHasFocus = false;
  metaWindow.foreach_transient(function(transient) {
      if (transient && transient.appears_focused) {
          transientHasFocus = true;
          return false;
      }
      return true;
  });
  return transientHasFocus;
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
      {key: 'restartOccurred', value: 'restartOccurred', cb: null},
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
    this.restartId = global.display.connect('restart', () => this.onRestart());
    this.shutdownId = global.connect('shutdown', () => this.onShutdown());

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

    if (this.state.restartOccurred) this.restoreWindows(false);
  }

  get windows() {
    return global.window_group.get_children();
  }

  onMonitorsChanged() {
    if (!this.state.restoreOnMonitorChange) return;
    setTimeout(() => this.restoreWindows(false), 4000);
  }

  onRestart() {
    this.settings.setValue('restartOccurred', true);
    this.saveWindows();
  }

  onShutdown() {
    this.settings.setValue('restartOccurred', false);
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
    let {windows, state} = this;
    let {windowStates} = state;

    each(windows, (metaWindowActor) => {
      let metaWindow = metaWindowActor.meta_window;
      let windowState = find(windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });

      let width, height, x, y;
      if (metaWindow.decorated) {
        [width, height, x, y] = getFramedWindowPosition(metaWindow);
      } else {
        [width, height, x, y] = getWindowActorPosition(metaWindowActor);
      }

      let maximized = metaWindow.maximized_horizontally && metaWindow.maximized_vertically;
      let {minimized} = metaWindow;
      let focused = getFocusState(metaWindow);
      if (windowState) {
        windowState.x = x;
        windowState.y = y;
        windowState.width = width;
        windowState.height = height;
        windowState.maximized = maximized;
        windowState.minimized = minimized;
        windowState.focused = focused;
      } else {
        windowStates.push({
          x,
          y,
          width,
          height,
          maximized,
          minimized,
          focused,
          id: metaWindow.get_xwindow()
        });
      }
    });

    this.settings.setValue('windowStates', windowStates);
  }

  restoreWindows(userAction = true) {
    let {windows, state} = this;
    let {windowStates, restartOccurred} = state;
    let newWindowStates = [];
    each(windows, (metaWindowActor) => {
      let metaWindow = metaWindowActor.meta_window;
      let windowState = find(windowStates, function(window) {
        return metaWindow.get_xwindow() === window.id;
      });
      if (!windowState) return;

      let {x, y, width, height, maximized, minimized, focused} = windowState;

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

      if (focused) metaWindow.activate(global.get_current_time());

      newWindowStates.push(windowState);
    });

    this.settings.setValue('windowStates', newWindowStates);
    if (restartOccurred) this.settings.setValue('restartOccurred', false);
  }

  on_applet_removed_from_panel() {
    if (this.monitorsChangedId) global.screen.disconnect(this.monitorsChangedId);
    if (this.restartId) global.display.disconnect(this.restartId);

    this.unbindHotkeys();
    this.settings.finalize();
  }

  on_applet_clicked() {
    if (!this.menu) return;
    this.menu.toggle();
  }
};

const main = function main(metadata, orientation, panel_height, instance_id) {
  return new WindowSaverApplet(metadata, orientation, panel_height, instance_id);
};
