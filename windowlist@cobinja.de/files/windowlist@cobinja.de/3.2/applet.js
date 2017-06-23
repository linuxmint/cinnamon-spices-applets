/*
 * applet.js
 * Copyright (C) 2013 Lars Mueller <cobinja@yahoo.de>
 * 
 * CobiWindowList is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * CobiWindowList is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const BoxPointer = imports.ui.boxpointer;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const WindowUtils = imports.misc.windowUtils;
const DND = imports.ui.dnd;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;

const UUID = "windowlist@cobinja.de";

const ANIMATION_TIME = 0.5;
const DEFAULT_ICON_SIZE = 22;
const MINIMUM_ICON_SIZE = 16;
const ICON_HEIGHT_FACTOR = 0.8;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const CobiCaptionType = {
  Name: 0,
  Title: 1
}

const CobiDisplayCaption = {
  No: 0,
  All: 1,
  Running: 2,
  Focused: 3
}

const CobiDisplayNumber = {
  No: 0,
  All: 1,
  Smart: 2
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  if (locText == text) {
    locText = window._(text);
  }
  return locText;
}

function _hasFocus(metaWindow) {
  if (metaWindow.appears_focused) {
    return true;
  }
  let transientHasFocus = false;
  metaWindow.foreach_transient(function(transient) {
    if (transient.appears_focused) {
      transientHasFocus = true;
      return false;
    }
    return true;
  });
  return transientHasFocus;
}

function compareArray(x, y) {
  // mimic non-extisting logical xor
  // to determine if one of the
  // parameters is undefined and the other one is not
  if (!(x == undefined) != !(y == undefined)) {
    return false;
  }
  if (x === y) {
    return true;
  }
  if (x.length != y.length) {
    return false;
  }
  for (let key in x) {
    let xHasKey = x.hasOwnProperty(key);
    let yHasKey = y.hasOwnProperty(key);
    if (!xHasKey) {
      continue;
    }
    if(!xHasKey != !yHasKey) {
      return false;
    }
    // recursive call in case of a nested array
    if (!compareArray(x[key], y[key])) {
      return false;
    }
  }
  return true;
}

function mergeArrays(x, y) {
  let result = [];
  if (x && y) {
    for (let i = 0; i < x.length; i++) {
      let a = x[i]
      if (y.indexOf(a) == -1) {
        result.push(a);
      }
    }
    result = [...new Set([...result, ...y])];
  }
  else if (x) {
    result = x;
  }
  else if (y) {
    result = y;
  }
  else {
    result = [];
  }
  return result;
}

function sign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function pointInTriangle (pt, v1, v2, v3) {
  let b1 = sign(pt, v1, v2) < 0.0;
  let b2 = sign(pt, v2, v3) < 0.0;
  let b3 = sign(pt, v3, v1) < 0.0;
  return ((b1 == b2) && (b2 == b3));
}

function resizeActor(actor, time, toWidth) {
  Tweener.addTween(actor, {
    natural_width: toWidth,
    time: time * 0.001,
    transition: "easeInOutQuad"
  });
}

function CobiWindowListSettings(instanceId) {
  this._init(instanceId);
}

CobiWindowListSettings.prototype = {
  __proto__: Settings.AppletSettings.prototype,
  
  _init: function(instanceId) {
    Settings.AppletSettings.prototype._init.call(this, this, UUID, instanceId);
  },
  
  _saveToFile: function() {
    if (!this.monitorId) {
      this.monitorId = this.monitor.connect("changed", Lang.bind(this, this._checkSettings));
    }
    let rawData = JSON.stringify(this.settingsData, null, 4);
    let raw = this.file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
    Cinnamon.write_string_to_stream(out_file, rawData);
    out_file.close(null);
  },
  
  setValue: function(key, value) {
    if (!(key in this.settingsData)) {
      key_not_found_error(key, this.uuid);
      return;
    }
    if (!compareArray(this.settingsData[key].value, value)) {
      this._setValue(value, key);
    }
  },
  
  destroy: function() {
    this.finalize();
  }
}

function CobiPopupMenuItem(menu, appButton, metaWindow) {
  this._init(menu, appButton, metaWindow);
}

CobiPopupMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,
  
  _init: function(menu, appButton, metaWindow) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
    this._menu = menu;
    this._appButton = appButton;
    this._metaWindow = metaWindow;
    this._signalManager = new SignalManager.SignalManager(this);
    this._settings = this._menu._settings;
    
    this._box = new St.BoxLayout({vertical: true, reactive: true});
    this.addActor(this._box);
    
    this._iconSize = 20 * global.ui_scale;
    let descSize = 30 * global.ui_scale;
    this._icon = this._appButton._app ?
                  this._appButton._app.create_icon_texture(this._iconSize) :
                  new St.Icon({ icon_name: "application-default-icon",
                                icon_type: St.IconType.FULLCOLOR,
                                icon_size: this._iconSize });
    this._icon.natural_width = this._iconSize;
    this._icon.natural_height = this._iconSize;
    this._icon.set_width(-1);
    this._icon.set_height(-1);
    let windowActor = metaWindow.get_compositor_private();
    let monitor = Main.layoutManager.findMonitorForActor(windowActor);
    let width = monitor.width;
    let height = monitor.height;
    let aspectRatio = width / height;
    height = Math.round(height / 10);
    width = Math.round(height * aspectRatio);
    
    this._descBox = new St.BoxLayout({natural_width: width});
    this._box.add_actor(this._descBox);
    
    this._iconBin = new St.Bin({natural_width: descSize, natural_height: descSize});
    this._descBox.add_actor(this._iconBin);
    this._iconBin.set_child(this._icon);
    
    this._label = new St.Label();
    let text = this._metaWindow.get_title();
    if (!text) {
      text = this._appButton._app.get_name();
    }
    if (!text) {
      text = "?";
    }
    this._label.set_text(text);
    this._labelBin = new St.Bin();
    this._labelBin.set_alignment(St.Align.START, St.Align.MIDDLE);
    this._descBox.add_actor(this._labelBin);
    this._labelBin.add_actor(this._label);
    
    this._spacer = new St.Widget();
    this._descBox.add(this._spacer, {expand: true});
    
    this._closeBin = new St.Bin({natural_width: descSize, natural_height: descSize, reactive: true});
    this._closeIcon = new St.Bin({style_class: "window-close", natural_width: this._iconSize, height: this._iconSize});
    this._descBox.add_actor(this._closeBin);
    this._closeBin.set_child(this._closeIcon);
    this._closeIcon.hide();
    
    if (!Main.software_rendering && this._settings.getValue("hover-preview")) {
      this._cloneBin = new St.Bin({natural_width: width, height: height});
      this._box.add_actor(this._cloneBin);
      this._cloneBox = new St.Widget();
      this._cloneBin.add_actor(this._cloneBox);
      let clones = WindowUtils.createWindowClone(this._metaWindow, width, height, true, true);
      for (let i = 0; i < clones.length; i++) {
        let clone = clones[i];
        this._cloneBox.add_actor(clone.actor);
        clone.actor.set_position(clone.x, clone.y);
      }
    }
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent);
    //this._signalManager.connect(this.actor, "button-release-event", this._onButtonReleaseEvent);
    this._signalManager.connect(this, "activate", this._onActivate);
  },
  
  _onEnterEvent: function() {
    if (this._closeIcon instanceof St.Bin) {
      // fetch the css icon here, so we don't mess with "not in the stage" in the constructor"
      let icon = St.TextureCache.get_default().load_file_simple(this._closeIcon.get_theme_node().get_background_image());
      icon.natural_width = this._iconSize;
      icon.natural_height = this._iconSize;
      icon.set_opacity(128);
      this._closeBin.set_child(null);
      this._closeIcon = icon;
      this._closeIcon.set_reactive(true);
      this._closeBin.set_child(this._closeIcon);
      this._signalManager.connect(this._closeIcon, "button-release-event", this._onClose);
      this._signalManager.connect(this._closeBin, "enter-event", this._onCloseIconEnterEvent);
      this._signalManager.connect(this._closeBin, "leave-event", this._onCloseIconLeaveEvent);
    }
    this._closeIcon.show();
  },
  
  _onLeaveEvent: function() {
    this._closeIcon.hide();
  },
  
  _onCloseIconEnterEvent: function() {
    this._closeIcon.set_opacity(255);
  },
  
  _onCloseIconLeaveEvent: function() {
    this._closeIcon.set_opacity(128);
  },
  
  _onButtonReleaseEvent: function (actor, event) {
    if (this._settings.getValue("preview-close-on-middle-click") && (event.get_state() & Clutter.ModifierType.BUTTON2_MASK)) {
      this._onClose();
      return true;
    }
    PopupMenu.PopupBaseMenuItem.prototype._onButtonReleaseEvent.call(this, actor, event);
    return true;
  },
  
  _onClose: function() {
    this._inClosing = true;
    this._metaWindow.delete(global.get_current_time());
    this._inClosing = false;
    return true;
  },
  
  _onActivate: function() {
    if (!this._inClosing) {
      Main.activateWindow(this._metaWindow);
    }
  },
  
  hide: function() {
    this._menu._inHiding = true;
    this._closeBin.hide();
    
    if (this._cloneBin) {
      let animTime = this._settings.getValue("label-animation-time") * 0.001;
      Tweener.addTween(this.actor, {
        width: 0,
        time: animTime,
        transition: "easeInOutQuad",
        onUpdate: Lang.bind(this, function() {
          this.actor.set_clip(this.actor.x, this.actor.y, this.actor.width, this.actor.height);
        }),
        onComplete: Lang.bind(this, function () {
          this.actor.hide();
          this.actor.set_width(-1);
          this._menu._inHiding = false;
          this.destroy();
        })
      });
    }
    else {
      this.actor.hide();
      this._menu._inHiding = false;
      this.destroy();
    }
  },
  
  destroy: function() {
    this._signalManager.disconnectAllSignals();
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
}

function CobiPopupMenu(appButton) {
  this._init(appButton);
}

CobiPopupMenu.prototype = {
  __proto__: PopupMenu.PopupMenu.prototype,
  
  _init: function(appButton) {
    PopupMenu.PopupMenu.prototype._init.call(this, appButton.actor, appButton._applet.orientation);
    this._appButton = appButton;
    this._settings = this._appButton._settings;
    this._signalManager = new SignalManager.SignalManager(this);
    
    this._windows = [];
    
    global.focus_manager.add_group(this.actor);
    this.actor.reactive = true;
    Main.layoutManager.addChrome(this.actor);
    this.actor.hide();
    
    this._updateOrientation();
    
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent);
  },
  
  _updateOrientation: function() {
    if (!Main.software_rendering) {
      this.box.set_vertical(false);
    }
    
    if (this._appButton._applet.orientation == St.Side.LEFT ||
        this._appButton._applet.orientation == St.Side.RIGHT ||
        !this._settings.getValue("hover-preview")) {
      this.box.set_vertical(true);
    }
  },
  
  removeDelay: function() {
    if (this._delayId) {
      let doIt = GLib.MainContext.default().find_source_by_id(this._delayId);
      if (doIt) {
        Mainloop.source_remove(this._delayId);
      }
      this._delayId = null;
    }
  },
  
  openDelay: function() {
    this.removeDelay();
    this._delayId = Mainloop.timeout_add(this._settings.getValue("preview-timeout-show"), Lang.bind(this, this.open));
  },
  
  closeDelay: function() {
    this.removeDelay();
    this._delayId = Mainloop.timeout_add(this._settings.getValue("preview-timeout-hide"), Lang.bind(this, function() {
      this.close();
    }));
  },
  
  _onEnterEvent: function() {
    this.removeDelay();
    return false;
  },
  
  _onLeaveEvent: function() {
    this.closeDelay();
    return false;
  },
  
  _findMenuItemForWindow: function(metaWindow) {
    let items = this._getMenuItems();
    items = items.filter(function(item) {
      return item._metaWindow == metaWindow;
    });
    if (items.length > 0) {
      return items[0];
    }
    return null;
  },
  
  open: function() {
    if (this.isOpen) {
      return;
    }
    this._updateOrientation();
    let windows = this._appButton.getWindowsOnCurrentWorkspace();
    for (let i = 0; i < windows.length; i++) {
      let window = windows[i];
      this.addMenuItem(new CobiPopupMenuItem(this, this._appButton, window));
    }
    this._appButton._computeMousePos();
    PopupMenu.PopupMenu.prototype.open.call(this, false);
  },
  
  close: function() {
    if (this._inHiding && this.numMenuItems > 1) {
      return;
    }
    this.removeDelay();
    PopupMenu.PopupMenu.prototype.close.call(this, false);
    this.removeAll();
    this._windows = [];
  },
  
  addWindow: function(metaWindow) {
    if (this._findMenuItemForWindow(metaWindow) == null) {
      this.addMenuItem(new CobiPopupMenuItem(this, this._appButton, metaWindow));
    }
  },
  
  removeWindow: function(metaWindow) {
    let item = this._findMenuItemForWindow(metaWindow);
    if (item && this.numMenuItems > 1) {
      item.hide();
    }
  },
  
  destroy: function() {
    this._signalManager.disconnectAllSignals();
    PopupMenu.PopupMenu.prototype.destroy.call(this);
  }
}

function CobiMenuManager(owner) {
  this._init(owner);
}

CobiMenuManager.prototype = {
  __proto__: PopupMenu.PopupMenuManager.prototype,
  
  _init: function(owner) {
    PopupMenu.PopupMenuManager.prototype._init.call(this, owner);
  },
  
  addMenu: function(menu, position) {
    this._signals.connect(menu, 'open-state-changed', this._onMenuOpenState);
    this._signals.connect(menu, 'child-menu-added', this._onChildMenuAdded);
    this._signals.connect(menu, 'child-menu-removed', this._onChildMenuRemoved);
    this._signals.connect(menu, 'destroy', this._onMenuDestroy);

    let source = menu.sourceActor;

    if (source) {
      this._signals.connect(source, 'enter-event', function() {
        this._onMenuSourceEnter(menu, true);
      });
      this._signals.connect(source, 'key-focus-in', function() {
        this._onMenuSourceEnter(menu, false);
      });
    }

    if (position == undefined) {
      this._menus.push(menu);
    }
    else {
      this._menus.splice(position, 0, menu);
    }
  },
  
  _onMenuSourceEnter: function(menu, checkPointer) {
    if (!this.grabbed || menu == this._activeMenu) {
      return false;
    }
    if (this._activeMenu && this._activeMenu.isChildMenu(menu)) {
      return false;
    }
    if (this._menuStack.indexOf(menu) != -1) {
      return false;
    }
    if (this._menuStack.length > 0 && this._menuStack[0].isChildMenu(menu)) {
      return false;
    }
    
    let allowMenuChange = true;
    
    if (checkPointer) {
      let appButton = this._activeMenu.sourceActor._delegate;
      let srcX = appButton._globalX;
      let srcY = appButton._globalY;
      let [menuX, menuY] = menu.actor.get_transformed_position();
      let [menuW, menuH] = menu.actor.get_transformed_size();
      let [curX, curY, mask] = global.get_pointer();
      
      let v2;
      let v3;
      
      allowMenuChange = false;
      let orientation = menu.sourceActor._delegate._applet.orientation;
      switch (orientation) {
        case St.Side.BOTTOM:
          if (curY >= srcY) {
            allowMenuChange = true;
            break;
          }
          v2 = {x: menuX + menuW, y: menuY + menuH};
          v3 = {x: menuX,         y: menuY + menuH};
          break;
        case St.Side.TOP:
          if (curY <= srcY) {
            allowMenuChange = true;
            break;
          }
          v2 = {x: menuX,         y: menuY};
          v3 = {x: menuX + menuW, y: menuY};
          break;
        case St.Side.LEFT:
          if (curX <= srcX) {
            allowMenuChange = true;
            break;
          }
          v2 = {x: menuX, y: menuY + menuH};
          v3 = {x: menuX, y: menuY};
          break;
        case St.Side.RIGHT:
          if (curX >= srcX) {
            allowMenuChange = true;
            break;
          }
          v2 = {x: menuX + menuW, y: menuY};
          v3 = {x: menuX + menuW, y: menuY + menuH};
          break;
        default:
          break;
      }
      
      if (!allowMenuChange) {
        let pt = {x: curX, y: curY};
        let v1 = {x: srcX, y: srcY};
        allowMenuChange = !pointInTriangle(pt, v1, v2, v3);
      }
    }
    
    if (allowMenuChange) {
      this._changeMenu(menu);
    }
    return false;
  }
}

function CobiAppButton(applet, app) {
  this._init(applet, app);
}

CobiAppButton.prototype = {
  _init: function(applet, app) {
    this._applet = applet;
    this._app = app;
    this._settings = this._applet._settings;
    this._signalManager = new SignalManager.SignalManager(this);
    
    this._pinned = false;
    
    this.actor = new St.BoxLayout({style_class: "window-list-item-box",
                                   track_hover: true,
                                   can_focus: true,
                                   reactive: true
    });
    
    this._label = new St.Label();
    this._labelBox = new St.Bin({natural_width: 0,
                                 x_align: St.Align.START});
    this._labelBox.add_actor(this._label);
    
    this._tooltip = new Tooltips.PanelItemTooltip(this, this._app.get_name(), this._applet.orientation);
    
    this.actor._delegate = this;
    this._iconBox = new St.Group();
    let direction = this.actor.get_text_direction();
    this.actor.add_actor(this._iconBox);
    this.actor.add_actor(this._labelBox);
    
    this._icon = null;
    this._iconBin = new St.Bin({name: "appMenuIcon"});
    this._iconBin._delegate = this;
    this._iconBox.add_actor(this._iconBin);
    
    this._labelNumberBox = new St.BoxLayout();
    this._labelNumber = new St.Label();
    this._iconBox.add_actor(this._labelNumberBox);
    this._labelNumberBox.add_actor(this._labelNumber);
    
    this._windows = [];
    this._currentWindow = null;
    
    this.actor.add_style_pseudo_class("neutral");
    
    this._updateOrientation();
    
    this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new CobiPopupMenu(this);
    this._contextMenu = new Applet.AppletPopupMenu(this, this._applet.orientation);
    this._contextMenuManager.addMenu(this._contextMenu);
    
    this._signalManager.connect(this.actor, "button-release-event", this._onButtonRelease);
    this._signalManager.connect(this._settings, "changed::caption-type", this._updateLabel);
    this._signalManager.connect(this._settings, "changed::display-caption-for", this._updateLabelVisibility);
    this._signalManager.connect(this._settings, "changed::display-number", this._updateNumber);
    this._signalManager.connect(this._settings, "changed::label-width", this._updateLabel);
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent);
    this._signalManager.connect(this.actor, "motion-event", this._onMotionEvent);
    this._signalManager.connect(this.actor, "notify::hover", this._updateVisualState);
    
    this._signalManager.connect(Main.themeManager, "theme-set", Lang.bind(this, function() {
      this.actor.remove_style_pseudo_class("neutral");
      this.updateView();
    }));
    this._signalManager.connect(St.TextureCache.get_default(), "icon-theme-changed", this.updateIcon);
    
    this._draggable = DND.makeDraggable(this.actor);
    this._draggable.inhibit = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
    global.settings.connect("changed::" + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._updateDragInhibit));
    this._draggable.connect("drag-begin", Lang.bind(this, this._onDragBegin));
    this._draggable.connect("drag-end", Lang.bind(this, this._onDragEnd));
    
    this.isDraggableApp = true;
  },
  
  get_app_id: function() {
    return this._app.get_id();
  },
  
  _updateDragInhibit: function() {
    this._draggable.inhibit = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
  },
  
  _onDragBegin: function() {
    this.actor.set_track_hover(false);
    this.actor.set_hover(false);
    this._tooltip.hide();
    this._tooltip.preventShow = true;
    this.menu.close();
  },
  
  _onDragEnd: function() {
    this.actor.set_track_hover(true);
    this._applet._clearDragPlaceholder();
    this._updateVisibility();
    this._updateTooltip();
  },
  
  getDragActor: function() {
    let clone = new Clutter.Clone({ source: this._iconBin });
    clone.width = this._iconBin.width;
    clone.height = this._iconBin.height;
    return clone;
  },

  getDragActorSource: function() {
    return this.actor;
  },
  
  handleDragOver: function(source, actor, x, y, time) {
    if (this._draggable && this._draggable.inhibit) {
      return DND.DragMotionResult.MOVE_DROP;
    }
    if (source instanceof CobiAppButton || source.isDraggableApp || source instanceof DND.LauncherDraggable) {
      return DND.DragMotionResult.CONTINUE;
    }
    if (this._currentWindow) {
      Main.activateWindow(this._currentWindow);
      return DND.DragMotionResult.COPY_DROP;
    }
    return DND.DragMotionResult.CONTINUE;
  },
  
  acceptDrop: function(source, actor, x, y, time) {
    return false;
  },
  
  getPinnedIndex: function() {
    let pinSetting = this._settings.getValue("pinned-apps");
    return this._pinned ? pinSetting.indexOf(this._app.get_id()) : -1;
  },
  
  addWindow: function(metaWindow) {
    this._windows.push(metaWindow);
    if (this.menu.isOpen) {
      this.menu.addWindow(metaWindow);
    }
    this._updateCurrentWindow();
    this._updateNumber();
    this._updateLabel();
    
    this._signalManager.connect(metaWindow, "notify::title", this._updateLabel);
    this._signalManager.connect(metaWindow, "notify::minimized", this._onMinimized);
    this._signalManager.connect(metaWindow, "notify::urgent", this._updateUrgentState);
    this._signalManager.connect(metaWindow, "notify::demands-attention", this._updateUrgentState);
    
    this.actor.remove_style_pseudo_class("neutral");
    this._updateTooltip();
    let wsWindows = this.getWindowsOnCurrentWorkspace();
    if (wsWindows.length == 1) {
      this._applet.menuManager.addMenu(this.menu);
    }
  },
  
  removeWindow: function(metaWindow) {
    this._signalManager.disconnect("notify::title", metaWindow);
    this._signalManager.disconnect("notify::minimized", metaWindow);
    this._signalManager.disconnect("notify::urgent", metaWindow);
    this._signalManager.disconnect("notify::demands-attention", metaWindow);
    
    let arIndex = this._windows.indexOf(metaWindow);
    if (arIndex >= 0) {
      this._windows.splice(arIndex, 1);
      this._updateCurrentWindow();
      if (this.menu.isOpen) {
        this.menu.removeWindow(metaWindow);
      }
    }
    if (this._pinned) {
      if (!this._currentWindow) {
        this.actor.remove_style_pseudo_class("focus");
        this.actor.remove_style_pseudo_class("active");
        this.actor.add_style_pseudo_class("neutral");
        this._applet.menuManager.removeMenu(this.menu);
      }
    }
    this._updateTooltip();
    this._updateNumber();
    this._updateLabelVisibility();
    this._updateVisibility();
  },
  
  getWindowsOnCurrentWorkspace: function() {
    let workspaceIndex = global.screen.get_active_workspace_index();
    return this.getWindowsOnWorkspace(workspaceIndex);
  },
  
  getWindowsOnWorkspace: function(workspaceIndex) {
    let wsWindows = global.screen.get_workspace_by_index(workspaceIndex).list_windows();
    let windows = this._windows.filter(Lang.bind(this, function(win) {
      return wsWindows.indexOf(win) >= 0;
    }));
    return windows;
  },
  
  hasWindowsOnCurrentWorkspace: function() {
    return this.getWindowsOnCurrentWorkspace().length > 0;
  },
  
  hasWindowsOnWorkspace: function(workspaceIndex) {
    return this.getWindowsOnWorkspace(workspaceIndex).length > 0;
  },
  
  _updateCurrentWindow: function() {
    let wsWindows = this.getWindowsOnCurrentWorkspace();
    if (wsWindows.length > 1) {
      wsWindows = wsWindows.sort(function(a, b) {
        return b.user_time - a.user_time;
      });
    }
    this._currentWindow = wsWindows.length > 0 ? wsWindows[0] : null;
    if (this._currentWindow) {
      this._updateLabel();
    }
  },
  
  _updateTooltip: function() {
    this._tooltip.preventShow = this.getWindowsOnCurrentWorkspace().length > 0;
  },
  
  updateIcon: function() {
    let panelHeight = this._applet._panelHeight;
    if (this._applet._scaleMode) {
      this.iconSize = Math.round(panelHeight * ICON_HEIGHT_FACTOR);
    }
    else {
      this.iconSize = ((panelHeight - 4) > DEFAULT_ICON_SIZE) ? DEFAULT_ICON_SIZE : MINIMUM_ICON_SIZE;
    }
    
    let icon = this._app ?
            this._app.create_icon_texture(this.iconSize) :
            new St.Icon({ icon_name: "application-default-icon",
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.iconSize });
    
    this._icon = icon;
    this._iconBin.set_child(this._icon);
    
    if (this._applet.orientation == St.Side.LEFT || this._applet.orientation == St.Side.LEFT) {
      panelHeight--;
    }
    // let the difference between icon size and panel size be even
    // so that the icon can be exactly centered inside the box
    if ((panelHeight - this.iconSize) & 1) {
      panelHeight--;
    }
    this._iconBin.width = panelHeight;
    this._iconBin.height = panelHeight;
    this._labelNumberBox.width = panelHeight;
  },
  
  updateCaption: function() {
    this._updateLabel();
    this._updateLabelVisibility();
  },
  
  _updateNumber: function() {
    let setting = this._settings.getValue("display-number");
    let text = "";
    let number = this.getWindowsOnCurrentWorkspace().length;
    if (((setting == CobiDisplayNumber.All && number >= 1)    ||
         (setting == CobiDisplayNumber.Smart && number >= 2)) &&
        this._settings.getValue("group-windows")) {
      text += number;
    }
    this._labelNumber.set_text(text);
  },
  
  _updateLabel: function(actor, event) {
    let captionType = this._settings.getValue("caption-type");
    let text;
    if (captionType == CobiCaptionType.Title && this._currentWindow) {
      text = this._currentWindow.get_title();
    }
    if (!text) {
      text = this._app.get_name();
    }
    if (!text) {
      text = "?";
    }
    if (this._currentWindow && this._currentWindow.minimized) {
      text = "[" + text + "]";
    }
    this._label.set_text(text);
    
    let width = this._settings.getValue("label-width");
    if (width == this._iconBin.width) {
      return;
    }
    this._updateLabelVisibility();
  },
  
  _updateLabelVisibility: function() {
    let value = this._settings.getValue("display-caption-for");
    let animTime = this._settings.getValue("label-animation") ? this._settings.getValue("label-animation-time") : 0;
    let settingsWidth = this._settings.getValue("label-width");
    let width = 0;
    switch (value) {
      case CobiDisplayCaption.No:
        width = 0;
        break;
      case CobiDisplayCaption.All:
        width = settingsWidth;
        break;
      case CobiDisplayCaption.Running:
        if (this._currentWindow) {
          width = settingsWidth;
        }
        else {
          width = 0;
        }
        break;
      case CobiDisplayCaption.Focused:
        if (this._hasFocus()) {
          width = settingsWidth;
        }
        else {
          width = 0;
        }
        break;
      default:
        break;
    }
    if (this._inhibitLabel) {
      width = 0;
    }
    resizeActor(this._labelBox, animTime, width);
  },
  
  _updateVisualState: function() {
    if (this._currentWindow) {
      if (this.actor.has_style_pseudo_class("neutral")) {
        this.actor.remove_style_pseudo_class("neutral");
      }
    }
    else {
      if (this.actor.has_style_pseudo_class("focus")) {
        this.actor.remove_style_pseudo_class("focus");
      }
      if (!this.actor.has_style_pseudo_class("neutral")) {
        this.actor.add_style_pseudo_class("neutral");
      }
      else if (this.actor.has_style_pseudo_class("hover")) {
        this.actor.remove_style_pseudo_class("neutral");
      }
    }
  },
  
  _updateOrientation: function() {
    this.actor.remove_style_class_name("top");
    this.actor.remove_style_class_name("bottom");
    this.actor.remove_style_class_name("left");
    this.actor.remove_style_class_name("right");
    switch (this._applet.orientation) {
      case St.Side.LEFT:
        this.actor.add_style_class_name("left");
        this.actor.set_style("margin-left 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;");
        this._inhibitLabel = true;
        break;
      case St.Side.RIGHT:
        this.actor.add_style_class_name("right");
        this.actor.set_style("margin-left: 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;");
        this._inhibitLabel = true;
        break;
      case St.Side.TOP:
        this.actor.add_style_class_name("top");
        this.actor.set_style("margin-top: 0px; padding-top: 0px;");
        this._inhibitLabel = false;
        break;
      case St.Side.BOTTOM:
        this.actor.add_style_class_name("bottom");
        this.actor.set_style("margin-bottom: 0px; padding-bottom: 0px;");
        this._inhibitLabel = false;
        break;
    }
  },
  
  _updateUrgentState: function() {
    let wsWindows = this.getWindowsOnCurrentWorkspace();
    let state = wsWindows.some(function(win) {
      return win.urgent || win.demands_attention;
    });
    
    if (state) {
      this.actor.add_style_class_name("window-list-item-demands-attention");
    }
    else {
      this.actor.remove_style_class_name("window-list-item-demands-attention");
    }
  },
  
  _updateFocus: function() {
    let wsWindows = this.getWindowsOnCurrentWorkspace();
    for (let i = 0; i < wsWindows.length; i++) {
      let metaWindow = wsWindows[i];
      if (_hasFocus(metaWindow) && !metaWindow.minimized) {
        this.actor.add_style_pseudo_class("focus");
        this._currentWindow = metaWindow;
        this._updateLabel();
        break;
      }
      else {
        this.actor.remove_style_pseudo_class("focus");
      }
    }
    this._updateUrgentState();
    this.updateCaption();
  },
  
  _updateVisibility: function() {
    if (this.hasWindowsOnCurrentWorkspace()) {
      this.actor.show();
    }
    else if (this._pinned) {
      this.actor.show();
    }
    else {
      this.actor.hide();
    }
  },
  
  updateView: function() {
    this._updateCurrentWindow();
    this._updateVisualState();
    this._updateNumber();
    this._updateFocus();
    this._updateVisibility();
    this._updateTooltip();
    this.updateIcon();
  },
  
  demandAttention: function(metaWindow) {
  },
  
  destroy: function() {
    this._signalManager.disconnectAllSignals();
    this._labelNumber.destroy();
    this._labelNumber = null;
    this._labelBox.destroy();
    this._labelBox = null;
    this._label.destroy();
    this._label = null;
    this._icon.destroy();
    this._icon = null;
    this._iconBin.destroy();
    this._iconBin = null;
    this._tooltip.hide();
    this._tooltip.destroy();
    this._tooltip = null;
    this._app = null;
    this.menu.destroy();
    this._applet.menuManager.removeMenu(this.menu);
    this.menu = null;
    this._contextMenu.destroy();
    this._contextMenuManager.removeMenu(this._contextMenu);
    this._contextMenu = null;
    this._applet = null;
    this._settings = null;
    this.actor.destroy();
    this.actor = null;
  },
  
  _onButtonRelease: function(actor, event) {
    this.menu.removeDelay();
    if (this._contextMenu.isOpen) {
      this._contextMenu.close();
    }
    if (this.menu.isOpen) {
      this.menu.close();
    }
    // left mouse button
    if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
      if (this._currentWindow) {
        if (this.hasWindowsOnCurrentWorkspace()) {
          let wsWindows = this.getWindowsOnCurrentWorkspace();
          if (wsWindows.length == 1) {
            if (_hasFocus(this._currentWindow)) {
              this._currentWindow.minimize();
            }
            else {
              Main.activateWindow(this._currentWindow);
            }
          }
          else {
            this.menu.open();
          }
        }
        else {
          this._startApp();
        }
      }
      else {
        this._startApp();
      }
    }
    // middle mouse button
    else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK) {
      this._startApp();
    }
    // right mouse button
    else if (event.get_state() & Clutter.ModifierType.BUTTON3_MASK) {
      // context menu
      this._populateContextMenu();
      this._contextMenu.open();
      this._updateFocus();
    }
  },
  
  _animateIcon: function(animationTime) {
    Tweener.addTween(this._icon, {
      opacity: 70,
      transition: "easeOutExpo",
      time: animationTime * 0.2,
      onCompleteScope: this,
      onComplete: Lang.bind(this, function() {
        Tweener.addTween(this._icon, {
          opacity: 255,
          transition: "easeOutBounce",
          time: animationTime * 0.8
        })
      })
    });
  },
  
  _startApp: function() {
    this._app.open_new_window(-1);
    let animationTime = this._settings.getValue("animation-time") / 1000;
    this._animateIcon(animationTime);
  },
  
  _onEnterEvent: function() {
    let wsWindows = this.getWindowsOnCurrentWorkspace();
    let state = wsWindows.some(function(win) {
      return win.urgent || win.demands_attention;
    });
    if (state) {
      this.actor.set_track_hover(false);
      this.actor.set_hover(false);
    }
    if (this.getWindowsOnCurrentWorkspace().length > 0) {
      this.menu.openDelay();
    }
  },
  
  _onLeaveEvent: function() {
    if (this.getWindowsOnCurrentWorkspace().length > 0) {
      this.menu.closeDelay();
    }
    this.actor.set_track_hover(true);
    if (this._mousePosUpdateLoop) {
      Mainloop.source_remove(this._mousePosUpdateLoop);
      this._mousePosUpdateLoop = 0;
    }
  },
  
  _onMotionEvent: function() {
    if (this._mousePosUpdateLoop) {
      Mainloop.source_remove(this._mousePosUpdateLoop);
      this._mousePosUpdateLoop = 0;
    }
    this._mousePosUpdateLoop = Mainloop.timeout_add(50, Lang.bind(this, this._computeMousePos));
  },
  
  _computeMousePos: function() {
    let mask;
    [this._globalX, this._globalY, mask] = global.get_pointer();
    
    this._mousePosUpdateLoop = 0;
    return false;
  },
  
  _onMinimized: function(metaWindow) {
    if (this._currentWindow == metaWindow) {
      this._updateFocus();
    }
  },
  
  _hasFocus: function() {
    let windows = this.getWindowsOnCurrentWorkspace();
    for (let i = 0; i < windows.length; i++) {
      let window = windows[i];
      if (_hasFocus(window)) {
        return true;
      }
    }
    return false;
  },
  
  _populateContextMenu: function() {
    this._contextMenu.removeAll();
    let item;
    let length;
    
    // applet-wide
    let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));
    
    this._contextMenu.addMenuItem(subMenu);
    
    item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
    item.connect("activate", Lang.bind(this._applet, this._applet.openAbout));
    subMenu.menu.addMenuItem(item);
    
    item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
    item.connect("activate", Lang.bind(this._applet, this._applet.configureApplet));
    subMenu.menu.addMenuItem(item);
    
    item = new PopupMenu.PopupIconMenuItem(_("Remove '%s'").format(_(this._applet._meta.name)), "edit-delete", St.IconType.SYMBOLIC);
    item.connect("activate", Lang.bind(this, function() {
      AppletManager._removeAppletFromPanel(this._applet._uuid, this._applet.instance_id);
    }));
    subMenu.menu.addMenuItem(item);
    
    // app-wide
    this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    
    item = new PopupMenu.PopupIconMenuItem(_("Open new window"), "video-display-symbolic", St.IconType.SYMBOLIC);
    item.connect("activate", Lang.bind(this, this._startApp));
    this._contextMenu.addMenuItem(item);
    
    if (this._settings.getValue("display-pinned") && !this._app.is_window_backed()) {
      if (this._pinned) {
        item = new PopupMenu.PopupIconMenuItem(_("Unpin app from window list"), "starred", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() {
          this._applet.unpinAppButton(this);
        }));
        this._contextMenu.addMenuItem(item);
      }
      else {
        item = new PopupMenu.PopupIconMenuItem(_("Pin app to window list"), "non-starred", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() {
          this._applet.pinAppButton(this);
        }));
        this._contextMenu.addMenuItem(item);
      }
    }
    
    if (this._currentWindow) {
      this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // window ops for workspaces
      if (this._currentWindow.is_on_all_workspaces()) {
        this._contextMenu.addAction(_("Only on this workspace"), Lang.bind(this, function() {this._currentWindow.unstick()}));
      }
      else {
        this._contextMenu.addAction(_("Visible on all workspaces"), Lang.bind(this, function() {this._currentWindow.stick()}));
        let workspace = this._currentWindow.get_workspace();
        length = global.screen.n_workspaces;
        if (length > 1) {
          item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another workspace"));
          this._contextMenu.addMenuItem(item);

          let curr_index = this._currentWindow.get_workspace().index();
          for (let i = 0; i < length; i++) {
            if (i != curr_index) {
              // Make the index a local variable to pass to function
              let j = i;
              let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
              let ws = new PopupMenu.PopupMenuItem(name);
              ws.connect('activate', Lang.bind(this, function() {
                 this._currentWindow.change_workspace(global.screen.get_workspace_by_index(j));
              }));
              item.menu.addMenuItem(ws);
            }
          }
        }
      }
      
      this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // window specific
      if (!_hasFocus(this._currentWindow)) {
        item = new PopupMenu.PopupIconMenuItem(_("Restore"), "view-sort-descending", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() { Main.activateWindow(this._currentWindow); }));
        this._contextMenu.addMenuItem(item);
      }
      else {
        item = new PopupMenu.PopupIconMenuItem(_("Minimize"), "view-sort-ascending", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() { this._currentWindow.minimize()}));
        this._contextMenu.addMenuItem(item);
      }
      
      if (this._currentWindow.get_maximized()) {
        item = new PopupMenu.PopupIconMenuItem(_("Unmaximize"), "view-restore", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() { this._currentWindow.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL)}));
        this._contextMenu.addMenuItem(item);
      }
      
      this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      let wsWindows = this.getWindowsOnCurrentWorkspace();
      if (wsWindows.length > 1) {
        item = new PopupMenu.PopupIconMenuItem(_("Close others"), "application-exit", St.IconType.SYMBOLIC);
        item.connect("activate", function() {
          for (let i = wsWindows.length - 1; i > 0; i--) {
            wsWindows[i].delete(global.get_current_time());
          }
        });
        this._contextMenu.addMenuItem(item);
        
        item = new PopupMenu.PopupIconMenuItem(_("Close all"), "window-close", St.IconType.SYMBOLIC);
        item.connect("activate", function() {
          for (let i = wsWindows.length - 1; i >= 0; i--) {
            wsWindows[i].delete(global.get_current_time());
          }
        });
        this._contextMenu.addMenuItem(item);
      }
      
      item = new PopupMenu.PopupIconMenuItem(_("Close"), "edit-delete", St.IconType.SYMBOLIC);
      item.connect('activate', Lang.bind(this, function() {this._currentWindow.delete(global.get_current_time())}));
      this._contextMenu.addMenuItem(item);
    }
  }
}

function CobiWindowList(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

CobiWindowList.prototype = {
  __proto__: Applet.Applet.prototype,
  
  _init: function(orientation, panelHeight, instanceId) {
    Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    
    this.actor.set_hover(false);
    this.actor.set_track_hover(false);
    this.actor.add_style_class_name("window-list-box");
    this.orientation = orientation;
    
    this.dragInProgress = false;
    
    this._windowTracker = Cinnamon.WindowTracker.get_default();
    this._appSys = Cinnamon.AppSystem.get_default();
    
    this.menuManager = new CobiMenuManager(this);
    
    this._appButtons = [];
    this._settings = new CobiWindowListSettings(instanceId);
    this._signalManager = new SignalManager.SignalManager(this);
    
    this.on_orientation_changed(orientation);
    
    this._workspaces = [];
  },
  
  _onDragBegin: function() {
    Applet.Applet.prototype._onDragBegin.call(this);
    let children = this.actor.get_children();
    for (let i = 0; i < children.length; i++) {
      let appButton = children[i]._delegate;
      if (appButton instanceof CobiAppButton) {
        appButton.menu.close();
      }
    }
  },
  
  _onButtonReleaseEvent: function (actor, event) {
    // override applet's default context menu toggling
  },
  
  _onButtonPressEvent: function() {
    // override applet's default context menu toggling
  },
  
  on_applet_added_to_panel: function() {
    if (this._settings.getValue("display-pinned")) {
      this._updatePinnedApps();
    }
    this._onWorkspacesChanged();
    this.emit("connect-signals");
    
    this._signalManager.connect(global.window_manager, "switch-workspace", this._onWorkspaceSwitched);
    this._signalManager.connect(global.settings, "changed::panel-edit-mode", this._onPanelEditModeChanged);
    this._signalManager.connect(global.screen, "notify::n-workspaces", this._onWorkspacesChanged);
    this._signalManager.connect(this._windowTracker, "notify::focus-app", this._updateFocus);
    this._signalManager.connect(this._settings, "changed::pinned-apps", this._updatePinnedApps);
    this._signalManager.connect(this._settings, "changed::display-pinned", this._onDisplayPinnedChanged);
    this._signalManager.connect(this._settings, "changed::group-windows", this._onGroupingChanged);
  },
  
  on_applet_removed_from_panel: function() {
    this._signalManager.disconnectAllSignals();
    this.emit("disconnect-signals");
  },
  
  _onPanelEditModeChanged: function () {
    let panelEditMode = global.settings.get_boolean("panel-edit-mode");
    if (panelEditMode) {
      this.actor.set_track_hover(true);
    }
    else {
      this.actor.set_hover(false);
      this.actor.set_track_hover(false);
    }
    
    for (let i = 0; i < this._appButtons.length; i++) {
      this._appButtons[i]._draggable.inihibit = panelEditMode;
    }
  },
  
  on_panel_height_changed: function() {
    for (let i in this._appButtons) {
      this._appButtons[i].updateIcon();
    }
  },
  
  on_orientation_changed: function(orientation) {
    this.orientation = orientation;
    if (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) {
      this.actor.set_vertical(false);
      this.actor.remove_style_class_name("vertical");
      this.actor.set_style("margin-bottom: 0px; padding-bottom: 0px; margin-top: 0px; padding-top: 0px;");
    }
    else {
      this.actor.set_vertical(true);
      this.actor.add_style_class_name("vertical");
      this.actor.set_style("margin-right: 0px; padding-right: 0px; padding-left: 0px; margin-left: 0px;");
    }
    for (let i = 0; i < this._appButtons.length; i++) {
      let appButton = this._appButtons[i];
      appButton._updateOrientation();
    }
  },
  
  _addAppButton: function(app) {
    if (!app) {
      return undefined;
    }
    let appButton = new CobiAppButton(this, app);
    this._appButtons.push(appButton);
    this.actor.add_actor(appButton.actor);
    appButton.updateIcon();
    appButton.actor.show();
    appButton.updateCaption();
    return appButton;
  },
  
  _removeAppButton: function(appButton) {
    let index = this._appButtons.indexOf(appButton);
    if (index >= 0) {
      this._appButtons.splice(index, 1);
      appButton.destroy();
    }
  },
  
  _lookupAppButtonForWindow: function(metaWindow) {
    let appButtons = this._appButtons.filter(function(appButton) {
      return appButton._windows.indexOf(metaWindow) >= 0;
    });
    return appButtons.length > 0 ? appButtons[0] : undefined;
  },
  
  _lookupAllAppButtonsForApp: function(app, startIndex) {
    let children = this.actor.get_children().slice(startIndex);
    let btns = children.map(x => x._delegate);
    return btns.filter(x => { return x._app.get_id() == app.get_id() });
  },
  
  _lookupAppButtonForApp: function(app, startIndex) {
    let appButtons = this._lookupAllAppButtonsForApp(app, startIndex);
    return appButtons.length > 0 ? appButtons[0] : undefined;
  },
  
  _onWorkspacesChanged: function() {
    for (let i in this._workspaces) {
      let ws = this._workspaces[i];
      ws.disconnect(ws._cobiWindowAddedId);
      ws.disconnect(ws._cobiWindowRemovedId);
    }
    
    this._workspaces = [];
    for (let i = 0; i < global.screen.n_workspaces; i++ ) {
      let ws = global.screen.get_workspace_by_index(i);
      this._workspaces[i] = ws;
      let windows = ws.list_windows();
      for (let j = 0; j < windows.length; j++) {
        let metaWindow = windows[j];
        if (!this._lookupAppButtonForWindow(metaWindow)) {
          this._windowAdded(ws, metaWindow);
        }
      }
      ws._cobiWindowAddedId = ws.connect("window-added",
                                     Lang.bind(this, this._windowAdded));
      ws._cobiWindowRemovedId = ws.connect("window-removed",
                                       Lang.bind(this, this._windowRemoved));
    }
  },
  
  _onWorkspaceSwitched: function() {
    this._updateAppButtonVisibility();
  },
  
  _windowAdded: function(metaWorkspace, metaWindow) {
    if (!Main.isInteresting(metaWindow)) {
      return;
    }
    let app = this._windowTracker.get_window_app(metaWindow);
    if (!app) {
      app = this._windowTracker.get_app_from_pid(metaWindow.get_pid());
    }
    if (this._lookupAppButtonForWindow(metaWindow)) {
      return;
    }
    let appButton;
    if (this._settings.getValue("group-windows")) {
      let appButtons = this._lookupAllAppButtonsForApp(app);
      for (let i = 0; i < appButtons.length; i++) {
        let btn = appButtons[i];
        if (btn._pinned) {
          appButton = btn;
          break;
        }
      }
    }
    if (!appButton) {
       appButton = this._lookupAppButtonForApp(app)
    }
    if (!appButton) {
      appButton = this._addAppButton(app);
    }
    else if (!this._settings.getValue("group-windows") && appButton.hasWindowsOnWorkspace(metaWorkspace.index())) {
      appButton = this._addAppButton(app);
    }
    appButton.addWindow(metaWindow);
    this._updateAppButtonVisibility();
  },
  
  _windowRemoved: function(metaWorkspace, metaWindow) {
    let appButton = this._lookupAppButtonForWindow(metaWindow);
    if (appButton) {
      let remove = true;
      appButton.removeWindow(metaWindow);
      if (appButton._windows.length > 0 || (this._settings.getValue("display-pinned") && appButton._pinned)) {
        remove = false;
      }
      if (remove) {
        this._removeAppButton(appButton);
      }
    }
  },
  
  _lookupApp: function(appId) {
    let app = null;
    if (appId) {
      app = this._appSys.lookup_app(appId);
      if (!app) {
        app = this._appSys.lookup_settings_app(appId);
      }
    }
    return app;
  },
  
  _updatePinnedApps: function() {
    // find new pinned apps
    if (this._settings.getValue("display-pinned")) {
      let pinnedApps = this._settings.getValue("pinned-apps");
      for (let i = 0; i < pinnedApps.length; i++) {
        let pinnedAppId = pinnedApps[i];
        let app = this._lookupApp(pinnedAppId);
        let appButton;
        if (!app) {
          continue;
        }
        
        appButton = this._lookupAppButtonForApp(app);
        if (!appButton) {
          appButton = this._addAppButton(app);
          let children = this.actor.get_children();
          let targetIdx = children.length - 1;
          for (let j = children.length - 2; j >= 0; j--) {
            let btn = children[j]._delegate;
            let btnPinIdx = btn.getPinnedIndex()
            if (btnPinIdx >= 0 && btnPinIdx > i) {
              targetIdx = j;
            }
          }
          if (targetIdx >= 0) {
            this.actor.move_child(appButton.actor, targetIdx);
          }
        }
        appButton._pinned = true;
      }
    }
    
    for (let i = this._appButtons.length - 1; i >= 0; i--) {
      let appButton = this._appButtons[i];
      if (!(appButton._pinned) && appButton._windows.length == 0) {
        this._removeAppButton(appButton);
      }
    }
  },
  
  _onDisplayPinnedChanged: function() {
    let setting = this._settings.getValue("display-pinned");
    if (setting) {
      this._updatePinnedApps();
    }
    else {
      for (let i = this._appButtons.length - 1; i >= 0; i--) {
        let appButton = this._appButtons[i];
        if (appButton._windows.length == 0) {
          this._removeAppButton(appButton);
        }
      }
    }
  },
  
  _updatePinSettings: function() {
    let appButtons = this.actor.get_children().map(x => x._delegate);
    let setting = [];
    let pinnedBtns = appButtons.filter(x => { return (x._pinned && !x._app.get_id().startsWith("window:")) });
    for (let i = 0; i < pinnedBtns.length; i++) {
      setting.push(pinnedBtns[i]._app.get_id());
    }
    this._settings.setValue("pinned-apps", setting);
  },
  
  pinAppId: function(appId, actorPos) {
    let app = this._lookupApp(appId);
    if (!app) {
      return false;
    }
    let appButton = this._lookupAppButtonForApp(app);
    if (!appButton) {
      appButton = this._addAppButton(app);
    }
    
    let actIdx = this.actor.get_children().indexOf(appButton.actor);
    
    if (actorPos - actIdx > 0) {
      actorPos--;
    }
    
    this.actor.move_child(appButton.actor, actorPos);
    this.pinAppButton(appButton);
    return true;
  },
  
  pinAppButton: function(appButton) {
    let app = appButton._app;
    let appId = app.get_id();
    
    let appButtons = this._lookupAllAppButtonsForApp(app);
    for (let i = 0; i < appButtons.length; i++) {
      appButtons[i]._pinned = false;
    }
    
    appButton._pinned = true;
    this._updatePinSettings();
  },
  
  unpinAppButton: function(appButton) {
    appButton._pinned = false;
    appButton.updateView();
    if (appButton._windows.length == 0) {
      this._removeAppButton(appButton);
    }
    this._updatePinSettings();
  },
  
  _onGroupingChanged: function() {
    let setting = this._settings.getValue("group-windows");
    if (setting) {
      this._group();
    }
    else {
      this._ungroup();
    }
  },
  
  _group: function() {
    let appButtons = this._appButtons.slice();
    for (let i = 0; i < appButtons.length; i++) {
      let appButton = appButtons[i];
      let app = appButton._app;
      let allButtons = this._lookupAllAppButtonsForApp(app);
      for (let j = 1; j < allButtons.length; j++) {
        let btn = allButtons[j];
        for (let k = 0; k < btn._windows.length; k++) {
          let window = btn._windows[k];
          this._windowRemoved(null, window);
          this._windowAdded(window.get_workspace(), window);
        }
        this._removeAppButton(btn);
      }
    }
    for (let i = 0; i < this._appButtons.length; i++) {
      this._appButtons[i].updateView();
    }
    this._updatePinnedApps();
  },
  
  _ungroup: function() {
    let appButtons = this._appButtons.slice();
    for (let i = 0; i < appButtons.length; i++) {
      let appButton = appButtons[i];
      for (let j = appButton._windows.length - 1; j >= 0; j--) {
        let window = appButton._windows[j];
        if (window != appButton._currentWindow) {
          appButton.removeWindow(window);
          this._windowAdded(window.get_workspace(), window);
        }
      }
      appButton.updateView();
    }
    this._updatePinnedApps();
  },
  
  _updateAppButtonVisibility: function() {
    for (let i = 0; i < this._appButtons.length; i++) {
      let appButton = this._appButtons[i];
      appButton.updateView();
    }
    this.actor.queue_relayout();
  },
  
  _updateFocus: function() {
    for (let i = 0; i < this._appButtons.length; i++) {
      let appButton = this._appButtons[i];
      appButton._updateFocus();
    }
  },
  
  handleDragOver: function(source, actor, x, y, time) {
    if (!(source.isDraggableApp || (source instanceof DND.LauncherDraggable))) {
      return DND.DragMotionResult.CONTINUE;
    }
    
    if (x <= 0 || x > this.actor.width || y <= 0 || y > this.actor.height) {
      this._clearDragPlaceholder();
      return DND.DragMotionResult.CONTINUE;
    }
    
    if (source instanceof CobiAppButton && this.actor.contains(source.actor)) {
      source.actor.hide();
    }
    
    let children = this.actor.get_children();
    
    let pos = children.length;

    if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
      while (--pos && x < children[pos].get_allocation_box().x1);
    }
    else {
      while (--pos && y < children[pos].get_allocation_box().y1);
    }

    this._dragPlaceholderPos = pos;

    if (this._dragPlaceholder == undefined) {
      this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
      this._dragPlaceholder.child.set_width(source.actor.width);
      this._dragPlaceholder.child.set_height(source.actor.height);

      this.actor.insert_child_at_index(this._dragPlaceholder.actor, this._dragPlaceholderPos);
    }
    else {
      this.actor.set_child_at_index(this._dragPlaceholder.actor, this._dragPlaceholderPos);
    }
    
    if (source instanceof CobiAppButton && this.actor.contains(source.actor)) {
      return DND.DragMotionResult.MOVE_DROP;
    }
    else {
      return DND.DragMotionResult.COPY_DROP;
    }
  },
  
  acceptDrop: function(source, actor, x, y, time) {
    if (this._dragPlaceholderPos == undefined) {
      return false;
    }
    if (source.isDraggableApp || source instanceof DND.LauncherDraggable) {
      let actorPos = this._dragPlaceholderPos;
      if (source instanceof CobiAppButton && this.actor.contains(source.actor)) {
        this.actor.set_child_at_index(source.actor, actorPos);
        this._clearDragPlaceholder();
        if (source._pinned) {
          this.pinAppButton(source);
        }
      }
      else {
        let appId;
        if (source.isDraggableApp) {
          appId = source.get_app_id();
        }
        else {
          appId = source.getId();
        }
        this._clearDragPlaceholder();
        let result = this.pinAppId(appId, actorPos);
        if (!result) {
          return false;
        }
      }
    }
    return true;
  },
  
  _clearDragPlaceholder: function() {
    if (this._dragPlaceholder) {
      this._dragPlaceholder.actor.destroy();
      this._dragPlaceholder = undefined;
      this._dragPlaceholderPos = undefined;
    }
  }
}

Signals.addSignalMethods(CobiWindowList.prototype);

function main(metadata, orientation, panelHeight, instanceId) {
  return new CobiWindowList(orientation, panelHeight, instanceId);
}
