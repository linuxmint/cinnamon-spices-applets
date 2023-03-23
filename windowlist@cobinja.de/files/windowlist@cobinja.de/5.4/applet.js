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
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
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
const CinnamonDesktop = imports.gi.CinnamonDesktop;

const UUID = "windowlist@cobinja.de";

const ANIMATION_TIME = 0.5;
const DEFAULT_ICON_SIZE = 22;
const MINIMUM_ICON_SIZE = 16;
const ICON_HEIGHT_FACTOR = 0.8;

const FLASH_INTERVAL = 500;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const STYLE_CLASS_ATTENTION_STATE = "grouped-window-list-item-demands-attention";

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

function hasFocus(metaWindow) {
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

function compareObject(x, y) {
  // mimic non-extisting logical xor
  // to determine if one of the
  // parameters is undefined and the other one is not
  if (!(x == undefined) != !(y == undefined)) {
    return false;
  }
  if (x === y) {
    return true;
  }
  
  if (!(x instanceof Object) || !(y instanceof Object)) {
    return false;
  }
  
  if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) {
    return false;
  }
  
  let keysX = Object.keys(x);
  let keysY = Object.keys(y);
  
  if (keysX.length != keysY.length) {
    return false;
  }
  
  for (let i = 0; i < keysX.length; i++) {
    let key = keysX[i];
    if (!y.hasOwnProperty(key)) {
      return false;
    }
    if (!compareObject(x[key], y[key])) {
      return false;
    }
  }
  
  return true;
}

function sign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function pointInTriangle(pt, v1, v2, v3) {
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

function getOverheadSize(actor) {
  if (actor == null) {
    return null;
  }
  let height = 0;
  let width = 0;
  let themeNode = actor.get_theme_node();
  
  width = themeNode.get_padding(St.Side.LEFT);
  width += themeNode.get_padding(St.Side.RIGHT);
  width += themeNode.get_border_width(St.Side.LEFT);
  width += themeNode.get_border_width(St.Side.RIGHT);
  
  height = themeNode.get_padding(St.Side.TOP);
  height += themeNode.get_padding(St.Side.BOTTOM);
  height += themeNode.get_border_width(St.Side.TOP);
  height += themeNode.get_border_width(St.Side.BOTTOM);
  
  width += themeNode.get_margin(St.Side.LEFT);
  width += themeNode.get_margin(St.Side.RIGHT);
  height += themeNode.get_margin(St.Side.TOP);
  height += themeNode.get_margin(St.Side.BOTTOM);
  
  return [width, height];
}

function getMonitors() {
  let result = [];

  try {
    let gdkScreen = Gdk.Screen.get_default();
    let screen = CinnamonDesktop.RRScreen.new(gdkScreen);
    let currentConfig = CinnamonDesktop.RRConfig.new_current(screen);
    let outputInfos = currentConfig.get_outputs();

    for (let index = 0; index < outputInfos.length; index++) {
      let output = outputInfos[index];
      if (output.is_active()) {
        result.push(output.get_display_name());
      }
    }
  } catch (err) {
    return [];
  }

  return result;
}

const dummy = {};

class CobiWindowListSettings extends Settings.AppletSettings {
  
  constructor(instanceId) {
    super(dummy, UUID, instanceId);
  }
  
  _saveToFile() {
    if (!this.monitorId) {
      this.monitorId = this.monitor.connect("changed", Lang.bind(this, this._checkSettings));
    }
    let rawData = JSON.stringify(this.settingsData, null, 4);
    let raw = this.file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
    Cinnamon.write_string_to_stream(out_file, rawData);
    out_file.close(null);
  }
  
  setValue(key, value) {
    if (!(key in this.settingsData)) {
      key_not_found_error(key, this.uuid);
      return;
    }
    if (!compareObject(this.settingsData[key].value, value)) {
      this._setValue(value, key);
    }
  }
  
  destroy() {
    this.finalize();
  }
}

class CobiPopupMenuItem extends PopupMenu.PopupBaseMenuItem {
  
  constructor(menu, appButton, metaWindow) {
    super();
    this._menu = menu;
    this._appButton = appButton;
    this._metaWindow = metaWindow;
    this._signalManager = new SignalManager.SignalManager(null);
    this._settings = this._menu._settings;
    
    this._box = new St.BoxLayout({vertical: true, reactive: true});
    this.actor.set_style("padding: 0.5em;");
    this.addActor(this._box);
    
    this._iconSize = 20 * global.ui_scale;
    this.descSize = 24 * global.ui_scale;
    this._icon = this._appButton._app ?
                  this._appButton._app.create_icon_texture_for_window(this._iconSize, this._metaWindow) :
                  new St.Icon({ icon_name: "application-default-icon",
                                icon_type: St.IconType.FULLCOLOR,
                                icon_size: this._iconSize });
    this._icon.natural_width = this._iconSize;
    this._icon.natural_height = this._iconSize;
    this._icon.set_width(-1);
    this._icon.set_height(-1);
    let monitor = this._appButton._applet.panel.monitor;
    let width = monitor.width;
    let height = monitor.height;
    let aspectRatio = width / height;
    height = Math.round(height / 10) * global.ui_scale;
    width = Math.round(height * aspectRatio);
    
    this._descBox = new St.BoxLayout({natural_width: width});
    this._box.add_actor(this._descBox);
    
    this._iconBin = new St.Bin({min_width: 0, min_height: 0, natural_width: this.descSize, natural_height: this.descSize});
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
    
    this._closeBin = new St.Bin({min_width: 0, min_height: 0, natural_width: this.descSize, natural_height: this.descSize, reactive: true});
    this._closeIcon = new St.Bin({style_class: "window-close", natural_width: this._iconSize, height: this._iconSize});
    this._descBox.add_actor(this._closeBin);
    this._closeBin.set_child(this._closeIcon);
    this._closeIcon.hide();
    
    if (!Main.software_rendering && this._settings.getValue("show-previews")) {
      this._cloneBin = new St.Bin({min_width: 0, min_height: 0});
      this._box.add_actor(this._cloneBin);
      this._cloneBox = new St.Widget();
      this._cloneBin.add_actor(this._cloneBox);
    }
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent, this);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent, this);
    this._signalManager.connect(this, "activate", this._onActivate, this);
  }
  
  handleDragOver(source, actor, x, y, time) {
    this.actor.hover = true;
    Main.activateWindow(this._metaWindow);
    return DND.DragMotionResult.COPY_DROP;
  }
  
  doSize(availWidth, availHeight) {
    if (Main.software_rendering || !this._settings.getValue("show-previews")) {
      return;
    }
    let monitor = this._appButton._applet.panel.monitor;
    let width = monitor.width;
    let height = monitor.height;
    let aspectRatio = width / height;
    
    let [overheadWidth, overheadHeight] = getOverheadSize(this.actor);
    overheadHeight += this.descSize;
    
    this._cloneBox.remove_all_children();
    
    if (this._menu.box.get_vertical()) {
      height = (availHeight - overheadHeight);
      width = Math.floor(height * aspectRatio);
      this._cloneBin.height = height;
      this._cloneBin.width = width;
    }
    else {
      width = (availWidth - overheadWidth);
      height = Math.floor(width / aspectRatio);
      this._cloneBin.height = height;
      this._cloneBin.width = width;
    }
    
    this._descBox.natural_width = width;
    
    let clones = WindowUtils.createWindowClone(this._metaWindow, width, height, true, true);
    for (let i = 0; i < clones.length; i++) {
      let clone = clones[i];
      this._cloneBox.add_actor(clone.actor);
      clone.actor.set_position(clone.x, clone.y);
    }
  }
  
  _onEnterEvent() {
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
      this._signalManager.connect(this._closeIcon, "button-release-event", this._onClose, this);
      this._signalManager.connect(this._closeBin, "enter-event", this._onCloseIconEnterEvent, this);
      this._signalManager.connect(this._closeBin, "leave-event", this._onCloseIconLeaveEvent, this);
    }
    this._closeIcon.show();
  }
  
  _onLeaveEvent() {
    this._closeIcon.hide();
  }
  
  _onCloseIconEnterEvent() {
    this._closeIcon.set_opacity(255);
  }
  
  _onCloseIconLeaveEvent() {
    this._closeIcon.set_opacity(128);
  }
  
  _onButtonReleaseEvent (actor, event) {
    if (this._settings.getValue("preview-close-on-middle-click") && (event.get_state() & Clutter.ModifierType.BUTTON2_MASK)) {
      this._onClose();
      return true;
    }
    super._onButtonReleaseEvent(actor, event);
    return true;
  }
  
  _onClose() {
    this._inClosing = true;
    this._metaWindow.delete(global.get_current_time());
    this._inClosing = false;
    return true;
  }
  
  _onActivate() {
    if (!this._inClosing) {
      Main.activateWindow(this._metaWindow);
    }
  }
  
  hide() {
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
  }
  
  updateUrgentState() {
    if (this._metaWindow.urgent || this._metaWindow.demands_attention) {
      this.actor.add_style_class_name(STYLE_CLASS_ATTENTION_STATE);
    }
    else {
      this.actor.remove_style_class_name(STYLE_CLASS_ATTENTION_STATE);
    }
  }
  
  destroy() {
    this._signalManager.disconnectAllSignals();
    super.destroy();
  }
}

class CobiPopupMenu extends PopupMenu.PopupMenu {
  
  constructor(appButton) {
    super(appButton.actor, appButton._applet.orientation);
    this._appButton = appButton;
    this._settings = this._appButton._settings;
    this._signalManager = new SignalManager.SignalManager(null);
    
    global.focus_manager.add_group(this.actor);
    this.actor.reactive = true;
    Main.layoutManager.addChrome(this.actor);
    this.actor.hide();
    
    this._updateOrientation();
    
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent, this);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent, this);
  }
  
  _updateOrientation() {
    if (!Main.software_rendering) {
      this.box.set_vertical(false);
    }
    
    if (this._appButton._applet.orientation == St.Side.LEFT ||
        this._appButton._applet.orientation == St.Side.RIGHT ||
        !this._settings.getValue("show-previews")) {
      this.box.set_vertical(true);
    }
  }
  
  removeDelay() {
    if (this._delayId) {
      let doIt = GLib.MainContext.default().find_source_by_id(this._delayId);
      if (doIt) {
        Mainloop.source_remove(this._delayId);
      }
      this._delayId = null;
    }
  }
  
  openDelay() {
    this.removeDelay();
    this._delayId = Mainloop.timeout_add(this._settings.getValue("preview-timeout-show"), Lang.bind(this, this.open));
  }
  
  closeDelay() {
    this.removeDelay();
    this._delayId = Mainloop.timeout_add(this._settings.getValue("preview-timeout-hide"), Lang.bind(this, function() {
      this.close();
    }));
  }
  
  _onEnterEvent() {
    this.removeDelay();
    return false;
  }
  
  _onLeaveEvent() {
    this.closeDelay();
    return false;
  }
  
  _findMenuItemForWindow(metaWindow) {
    let items = this._getMenuItems();
    items = items.filter(function(item) {
      return item._metaWindow == metaWindow;
    });
    if (items.length > 0) {
      return items[0];
    }
    return null;
  }
  
  open() {
    if (this.isOpen) {
      return;
    }
    this._updateOrientation();
    let windows = this._appButton._windows;
    for (let i = 0; i < windows.length; i++) {
      let window = windows[i];
      this.addWindow(window);
    }
    this.updateUrgentState();
    this.recalcItemSizes();
    
    this._appButton._computeMousePos();
    super.open(false);
  }
  
  close() {
    if (this._inHiding && this.numMenuItems > 1) {
      return;
    }
    this.removeDelay();
    super.close(false);
    this.removeAll();
  }
  
  addWindow(window) {
    if (this._findMenuItemForWindow(window) == null) {
      let menuItem = new CobiPopupMenuItem(this, this._appButton, window);
      this.addMenuItem(menuItem);
      this.recalcItemSizes();
    }
  }
  
  removeWindow(metaWindow) {
    let item = this._findMenuItemForWindow(metaWindow);
    if (item && this.numMenuItems > 1) {
      item.hide();
    }
  }
  
  recalcItemSizes() {
    let [overheadWidthActor, overheadHeightActor] = getOverheadSize(this.actor);
    let [overheadWidth, overheadHeight] = getOverheadSize(this.box);
    overheadWidth += overheadWidthActor;
    overheadHeight += overheadHeightActor;
    
    let monitor = this._appButton._applet.panel.monitor;
    let panels = Main.panelManager.getPanelsInMonitor(this._appButton._applet.panel.monitorIndex);
    for (let i = 0; i < panels.length; i++) {
      if (panels[i].panelPosition == Panel.PanelLoc.top || panels[i].panelPosition == Panel.PanelLoc.bottom) {
        overheadHeight += panels[i].actor.height;
      }
      else {
        overheadWidth += panels[i].actor.width;
      }
    }
    
    let availWidth = monitor.width - overheadWidth;
    let availHeight = monitor.height - overheadHeight;
    
    let spacing = Math.round(this.box.get_theme_node().get_length("spacing"));
    
    let items = this._getMenuItems();
    let numItems = items.length;
    
    let itemWidth = availWidth;
    let itemHeight = availHeight;
    
    let numThumbs = this._settings.getValue("number-of-unshrunk-previews");
    
    if (this.box.get_vertical()) {
      itemHeight = (availHeight / (Math.max(numItems, numThumbs))) - ((numItems - 1) * spacing * global.ui_scale);
    }
    else {
      itemWidth = (availWidth / (Math.max(numItems, numThumbs))) - ((numItems - 1) * spacing * global.ui_scale);
    }
    
    for (let i = 0; i < numItems; i++) {
      items[i].doSize(itemWidth, itemHeight);
    }
  }
  
  destroy() {
    this._signalManager.disconnectAllSignals();
    super.destroy();
  }
  
  updateUrgentState() {
    let items = this._getMenuItems();
    items.forEach(menuItem => {
      menuItem.updateUrgentState();
    });
  }
}

const CobiMenuManager = class CobiMenuManager extends PopupMenu.PopupMenuManager {
  
  constructor(owner) {
    super(owner);
    this.dragMotion = this.dragMotionHandler.bind(this);
    this._signals.connect(Main.xdndHandler, "drag-end", this.onDragEnd, this);
    this._signals.connect(Main.xdndHandler, "drag-begin", this.onDragBegin, this);
  }
  
  onDragBegin() {
    DND.addDragMonitor(this);
  }
  
  onDragEnd() {
    DND.removeDragMonitor(this);
    this._closeMenu();
  }
  
  dragMotionHandler(dragEvent) {
    if (dragEvent) {
      if (dragEvent.source instanceof CobiAppButton || dragEvent.source.isDraggableApp || dragEvent.source instanceof DND.LauncherDraggable) {
        return DND.DragMotionResult.CONTINUE;
      }
      let hoverMenu = this._findMenuForActor(dragEvent);
      if (hoverMenu) {
        if (hoverMenu !== this._activeMenu) {
          if (hoverMenu._appButton._windows.length > 1) {
            this._changeMenu(hoverMenu);
          }
          else if (hoverMenu._appButton._windows.length === 1) {
            this._closeMenu();
            Main.activateWindow(hoverMenu._appButton._currentWindow);
          }
        }
      }
      else {
        this._closeMenu();
      }
    }
    return DND.DragMotionResult.CONTINUE;
  }
  
  addMenu(menu, position) {
    this._signals.connect(menu, 'open-state-changed', this._onMenuOpenState, this);
    this._signals.connect(menu, 'child-menu-added', this._onChildMenuAdded, this);
    this._signals.connect(menu, 'child-menu-removed', this._onChildMenuRemoved, this);
    this._signals.connect(menu, 'destroy', this._onMenuDestroy, this);

    let source = menu.sourceActor;

    if (source) {
      this._signals.connect(source, 'enter-event', function() {
        this._onMenuSourceEnter(menu, true);
      }, this);
      this._signals.connect(source, 'key-focus-in', function() {
        this._onMenuSourceEnter(menu, false);
      }, this);
    }

    if (position == undefined) {
      this._menus.push(menu);
    }
    else {
      this._menus.splice(position, 0, menu);
    }
  }
  
  _onMenuSourceEnter(menu, checkPointer) {
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
  
  _findMenuForActor(dragEvent) {
    let actor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, dragEvent.x, dragEvent.y);
    
    if (actor.is_finalized()) {
      return null;
    }
    for (let i = 0; i < this._menus.length; i++) {
      let menu = this._menus[i];
      if (menu.actor.contains(actor) || menu.sourceActor.contains(actor)) {
        return menu;
      }
    }
    return null;
  }
}

class CobiAppButton {
  
  constructor(workspace, applet, app) {
    this._workspace = workspace;
    this._applet = applet;
    this._app = app;
    this._settings = this._applet._settings;
    this._needsAttention = [];
    this._signalManager = new SignalManager.SignalManager(null);
    
    this._pinned = false;
    
    this.actor = new St.BoxLayout({style_class: "grouped-window-list-item-box",
                                   track_hover: true,
                                   can_focus: true,
                                   reactive: true
    });
    
    this._label = new St.Label();
    this._labelBox = new St.Bin({natural_width: 0, min_width: 0,
                                 x_align: St.Align.START});
    this._labelBox.add_actor(this._label);
    
    this._tooltip = new Tooltips.PanelItemTooltip(this, this._app.get_name(), this._applet.orientation);
    
    this.actor._delegate = this;
    this._iconBox = new St.Group();
    this.actor.add_actor(this._iconBox);
    this.actor.add_actor(this._labelBox);
    
    this._icon = null;
    this._iconBin = new St.Bin({name: "appMenuIcon"});
    this._iconBin._delegate = this;
    this._iconBox.add_actor(this._iconBin);
    
    this._labelNumberBox = new St.Bin({
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this._labelNumberBin = new St.Bin({
      important: true,
      style_class: "grouped-window-list-badge",
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this._labelNumber = new St.Label({
      important: true,
      style_class: "grouped-window-list-number-label",
      text: " "
    });
    this._iconBox.add_actor(this._labelNumberBox);
    this._labelNumberBox.add_actor(this._labelNumberBin);
    this._labelNumberBin.add_actor(this._labelNumber);
    
    this._windows = [];
    this._currentWindow = null;
    
    this._updateOrientation();
    
    this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new CobiPopupMenu(this);
    this._contextMenu = new Applet.AppletPopupMenu(this, this._applet.orientation);
    this._contextMenuManager.addMenu(this._contextMenu);
    
    this._signalManager.connect(this.actor, "button-release-event", this._onButtonRelease, this);
    this._signalManager.connect(this._settings, "changed::caption-type", this._updateLabel, this);
    this._signalManager.connect(this._settings, "changed::display-caption-for", this._updateLabelVisibility, this);
    this._signalManager.connect(this._settings, "changed::display-number", this._updateNumber, this);
    this._signalManager.connect(this._settings, "changed::label-width", this._updateLabel, this);
    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent, this);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent, this);
    this._signalManager.connect(this.actor, "motion-event", this._onMotionEvent, this);
    this._signalManager.connect(this.actor, "notify::hover", this._updateVisualState, this);
    
    this._signalManager.connect(Main.themeManager, "theme-set", Lang.bind(this, function() {
      this.updateView();
    }), this);
    this._signalManager.connect(St.TextureCache.get_default(), "icon-theme-changed", this.updateIcon, this);
    
    this._draggable = DND.makeDraggable(this.actor);
    this._draggable.inhibit = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
    global.settings.connect("changed::" + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._updateDragInhibit));
    this._draggable.connect("drag-begin", Lang.bind(this, this._onDragBegin));
    this._draggable.connect("drag-end", Lang.bind(this, this._onDragEnd));
    
    this.isDraggableApp = true;
  }
  
  get_app_id() {
    return this._app.get_id();
  }
  
  _updateDragInhibit() {
    this._draggable.inhibit = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
  }
  
  _onDragBegin() {
    this.actor.set_track_hover(false);
    this.actor.set_hover(false);
    this._tooltip.hide();
    this._tooltip.preventShow = true;
    this.menu.close();
  }
  
  _onDragEnd() {
    this.actor.set_track_hover(true);
    this._workspace._clearDragPlaceholder();
    this._updateVisibility();
    this._updateTooltip();
  }
  
  getDragActor() {
    let clone = new Clutter.Clone({ source: this._iconBin });
    clone.width = this._iconBin.width;
    clone.height = this._iconBin.height;
    return clone;
  }

  getDragActorSource() {
    return this.actor;
  }
  
  getPinnedIndex() {
    let pinSetting = this._settings.getValue("pinned-apps")[this._workspace._wsNum];
    return this._pinned ? pinSetting.indexOf(this._app.get_id()) : -1;
  }
  
  _onWmClassChanged(metaWindow) {
    let workspace = this._workspace;
    workspace._windowRemoved(metaWindow);
    workspace._windowAdded(metaWindow);
  }
  
  _onGtkApplicationChanged(metaWindow) {
    let workspace = this._workspace;
    workspace._windowRemoved(metaWindow);
    workspace._windowAdded(metaWindow);
  }
  
  addWindow(metaWindow) {
    this._windows.push(metaWindow);
    if (this.menu.isOpen) {
      this.menu.addWindow(metaWindow);
    }
    this._updateCurrentWindow();
    this._updateNumber();
    this._updateLabel();
    
    this._signalManager.connect(metaWindow, "notify::title", this._updateLabel, this);
    this._signalManager.connect(metaWindow, "notify::minimized", this._onMinimized, this);
    this._signalManager.connect(metaWindow, "notify::urgent", this._updateUrgentState, this);
    this._signalManager.connect(metaWindow, "notify::demands-attention", this._updateUrgentState, this);
    this._signalManager.connect(metaWindow, "notify::gtk-application-id", this._onGtkApplicationChanged, this);
    this._signalManager.connect(metaWindow, "notify::wm-class", this._onWmClassChanged, this);
    this._signalManager.connect(metaWindow, "workspace-changed", this._onWindowWorkspaceChanged, this);
    
    this.actor.add_style_pseudo_class("active");
    this._updateTooltip();
    if (this._windows.length == 1) {
      this._workspace.menuManager.addMenu(this.menu);
    }
  }
  
  removeWindow(metaWindow) {
    this._signalManager.disconnect("notify::title", metaWindow);
    this._signalManager.disconnect("notify::minimized", metaWindow);
    this._signalManager.disconnect("notify::urgent", metaWindow);
    this._signalManager.disconnect("notify::demands-attention", metaWindow);
    this._signalManager.disconnect("notify::gtk-application-id", metaWindow);
    this._signalManager.disconnect("notify::wm-class", metaWindow);
    this._signalManager.disconnect("workspace-changed", metaWindow);
    
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
        this._workspace.menuManager.removeMenu(this.menu);
      }
    }
    this._updateTooltip();
    this._updateNumber();
    this._updateLabelVisibility();
    this._updateVisibility();
  }
  
  _updateCurrentWindow() {
    let windows = this._windows.slice();
    if (windows.length > 1) {
      windows = windows.sort(function(a, b) {
        return b.user_time - a.user_time;
      });
    }
    this._currentWindow = windows.length > 0 ? windows[0] : null;
    if (this._currentWindow) {
      this._updateLabel();
    }
  }
  
  _onWindowWorkspaceChanged(window, wsNum) {
    this._applet.windowWorkspaceChanged(window, wsNum);
  }
  
  _updateTooltip() {
    this._tooltip.preventShow = this._windows.length > 0;
  }
  
  updateIcon() {
    let panelHeight = this._applet._panelHeight;
    // if (this._applet._scaleMode) {
    //   this.iconSize = Math.round(panelHeight * ICON_HEIGHT_FACTOR);
    // }
    // else {
    //   this.iconSize = ((panelHeight - 4) > DEFAULT_ICON_SIZE) ? DEFAULT_ICON_SIZE : MINIMUM_ICON_SIZE;
    // }
    
    this.iconSize = this._applet.getPanelIconSize(St.IconType.FULLCOLOR);
    
    let icon = null;
    
    if (this._app) {
      let appInfo = this._app.get_app_info();
      if (appInfo) {
        let infoIcon = appInfo.get_icon();
        icon = new St.Icon({ gicon: infoIcon,
                             icon_size: this.iconSize
                           });
      }
      else {
        icon = this._app.create_icon_texture(this.iconSize);
      }
    }
    else {
      icon = new St.Icon({ icon_name: "application-default-icon",
                           icon_type: St.IconType.FULLCOLOR,
                           icon_size: this.iconSize });
    }
    
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
    this._iconBin.natural_width = panelHeight;
    this._iconBin.natural_height = panelHeight;
    this._labelNumberBox.natural_width = panelHeight;
  }
  
  updateCaption() {
    this._updateLabel();
    this._updateLabelVisibility();
  }
  
  _updateNumber() {
    let setting = this._settings.getValue("display-number");
    let text = "";
    let number = this._windows.length;
    if (((setting == CobiDisplayNumber.All && number >= 1)    ||
         (setting == CobiDisplayNumber.Smart && number >= 2)) &&
        this._settings.getValue("group-windows")) {
      text = number.toString();
    }
    
    this._labelNumber.set_text(text);
    
    if (text == "") {
      this._labelNumberBin.hide();
    }
    else {
      this._labelNumberBin.show();
      let [width, height] = this._labelNumber.get_size();
      let size = Math.max(width, height);
      this._labelNumberBin.width = size;
      this._labelNumberBin.height = size;
    }
  }
  
  _updateLabel(actor, event) {
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
    
    let width = this._settings.getValue("label-width") * global.ui_scale;
    if (width == this._iconBin.width) {
      return;
    }
    this._updateLabelVisibility();
  }
  
  _updateLabelVisibility() {
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
    width *= global.ui_scale;
    resizeActor(this._labelBox, animTime, width);
  }
  
  _updateVisualState() {
    if (!this._currentWindow) {
      this.actor.remove_style_pseudo_class("focus");
    }
  }
  
  _updateOrientation() {
    this.actor.remove_style_class_name("top");
    this.actor.remove_style_class_name("bottom");
    this.actor.remove_style_class_name("left");
    this.actor.remove_style_class_name("right");
    this._labelNumberBox.set_style("padding: 1pt;");
    switch (this._applet.orientation) {
      case St.Side.LEFT:
        this.actor.add_style_class_name("left");
        this.actor.set_style("margin-left 0px; margin-right: 0px; padding: 0px");
        this._inhibitLabel = true;
        break;
      case St.Side.RIGHT:
        this.actor.add_style_class_name("right");
        this.actor.set_style("margin-left: 0px; margin-right: 0px; padding: 0px;");
        this._inhibitLabel = true;
        break;
      case St.Side.TOP:
        this.actor.add_style_class_name("top");
        this.actor.set_style("margin-top: 0px; padding-top: 0px; padding-left: 0px; padding-right: 0px;");
        this._inhibitLabel = false;
        break;
      case St.Side.BOTTOM:
        this.actor.add_style_class_name("bottom");
        this.actor.set_style("margin-bottom: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px;");
        this._inhibitLabel = false;
        break;
    }
  }
  
  _flashButton() {
    // start over in case more than one window needs attention
    this.flashesLeft = 3;
    this.actor.add_style_class_name(STYLE_CLASS_ATTENTION_STATE);

    if (!this._flashTimeoutID) {
      this._flashTimeoutID = Mainloop.timeout_add(FLASH_INTERVAL, () => {
        if (this.actor.has_style_class_name(STYLE_CLASS_ATTENTION_STATE)) {
          this.actor.remove_style_class_name(STYLE_CLASS_ATTENTION_STATE);
        }
        else if (this.flashesLeft > 0) {
          this.actor.add_style_class_name(STYLE_CLASS_ATTENTION_STATE);
          this.flashesLeft--;
        }
        if (!this.flashesLeft > 0) {
          this._flashTimeoutID = null;
          return false;
        }
        return true;
      });
    }
  }
  
  _unflashButton() {
    this.flashesLeft = 0;
    this.actor.remove_style_class_name(STYLE_CLASS_ATTENTION_STATE);
  }
  
  _updateUrgentState() {
    let newUrgent = false;
    this._windows.forEach(function(win) {
      let isUrgent = win.urgent || win.demands_attention;
      let ar = this._needsAttention.indexOf(win)
      if (ar < 0 && isUrgent) {
        this._needsAttention.push(win);
        newUrgent = true;
      }
      else if (!isUrgent) {
        this._needsAttention.splice(ar, 1);
      }
    }, this);
    
    if (newUrgent) {
      this._flashButton();
    }
    if (this._needsAttention.length == 0) {
      this._unflashButton();
    }
    this.menu.updateUrgentState();
  }
  
  _updateFocus() {
    for (let i = 0; i < this._windows.length; i++) {
      let metaWindow = this._windows[i];
      if (hasFocus(metaWindow) && !metaWindow.minimized) {
        this.actor.add_style_pseudo_class("focus");
        this.actor.remove_style_class_name(STYLE_CLASS_ATTENTION_STATE);
        this._currentWindow = metaWindow;
        this._updateLabel();
        if (metaWindow.urgent || metaWindow.demands_attention) {
          this._unflashButton();
        }
        break;
      }
      else {
        this.actor.remove_style_pseudo_class("focus");
      }
    }
    // this._updateUrgentState();
    this.updateCaption();
  }
  
  _updateVisibility() {
    if (this._windows.length) {
      this.actor.show();
    }
    else if (this._pinned) {
      this.actor.show();
    }
    else {
      this.actor.hide();
    }
  }
  
  updateView() {
    this._updateCurrentWindow();
    this._updateVisualState();
    this._updateNumber();
    this._updateFocus();
    this._updateVisibility();
    this._updateTooltip();
    this.updateIcon();
  }
  
  destroy() {
    this._signalManager.disconnectAllSignals();
    this._tooltip.hide();
    this._tooltip.destroy();
    this._workspace.menuManager.removeMenu(this.menu);
    this.menu.destroy();
    this._contextMenuManager.removeMenu(this._contextMenu);
    this._contextMenu.destroy();
    this.actor.destroy();
  }
  
  _onButtonRelease(actor, event) {
    this.menu.removeDelay();
    if (this._contextMenu.isOpen) {
      this._contextMenu.close();
    }
    if (this.menu.isOpen) {
      this.menu.close();
    }
    let button = event.get_button();
    
    // left mouse button
    if (button == 1) {
      if (this._currentWindow) {
        if (this._windows.length == 1 || !(this._settings.getValue("menu-show-on-click"))) {
          if (hasFocus(this._currentWindow)) {
            this._currentWindow.minimize();
          }
          else {
            Main.activateWindow(this._currentWindow);
          }
        }
        else if (this._settings.getValue("menu-show-on-click")) {
          this.menu.open();
        }
      }
      else {
        this._startApp();
      }
    }
    // middle mouse button
    else if (button == 2) {
      this._startApp();
    }
    // right mouse button
    else if (button == 3) {
      // context menu
      this._populateContextMenu();
      this._contextMenu.open();
      this._updateFocus();
    }
  }
  
  _animateIcon(animationTime) {
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
  }
  
  _startApp() {
    this._app.open_new_window(-1);
    let animationTime = this._settings.getValue("animation-time") / 1000;
    this._animateIcon(animationTime);
  }
  
  _onEnterEvent() {
    let state = this._windows.some(function(win) {
      return win.urgent || win.demands_attention;
    });
    if (state) {
      this.actor.set_track_hover(false);
      this.actor.set_hover(false);
    }
    if (this._windows.length > 0 && this._settings.getValue("menu-show-on-hover")) {
      this.menu.openDelay();
    }
  }
  
  _onLeaveEvent() {
    if (this._windows.length > 0) {
      this.menu.closeDelay();
    }
    this.actor.set_track_hover(true);
    if (this._mousePosUpdateLoop) {
      Mainloop.source_remove(this._mousePosUpdateLoop);
      this._mousePosUpdateLoop = 0;
    }
  }
  
  _onMotionEvent() {
    if (this._mousePosUpdateLoop) {
      Mainloop.source_remove(this._mousePosUpdateLoop);
      this._mousePosUpdateLoop = 0;
    }
    this._mousePosUpdateLoop = Mainloop.timeout_add(50, Lang.bind(this, this._computeMousePos));
  }
  
  _computeMousePos() {
    let mask;
    [this._globalX, this._globalY, mask] = global.get_pointer();
    
    this._mousePosUpdateLoop = 0;
    return false;
  }
  
  _onMinimized(metaWindow) {
    if (this._currentWindow == metaWindow) {
      this._updateFocus();
    }
  }
  
  _hasFocus() {
    for (let i = 0; i < this._windows.length; i++) {
      if (hasFocus(this._windows[i])) {
        return true;
      }
    }
    return false;
  }
  
  _populateContextMenu() {
    this._contextMenu.removeAll();
    let item;
    
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
      let iconName = this._pinned ? "starred" : "non-starred";
      item = new PopupMenu.PopupSwitchIconMenuItem(_("Pin to this workspace"), this._pinned, iconName, St.IconType.SYMBOLIC);
      item.connect("toggled", Lang.bind(this, function(menuItem, state) {
        if (state) {
          this._workspace.pinAppButton(this);
          menuItem.setIconSymbolicName("starred");
        }
        else {
          this._workspace.unpinAppButton(this);
          menuItem.setIconSymbolicName("non-starred");
        }
      }));
      this._contextMenu.addMenuItem(item);
      
      if (global.screen.n_workspaces > 1) {
        item = new PopupMenu.PopupSubMenuMenuItem(_("Pin to other workspaces"));
        let pinSettings = this._settings.getValue("pinned-apps");
        let appId = this._app.get_id();
        for (let i = 0; i < global.screen.n_workspaces; i++) {
          if (i == this._workspace._wsNum) {
            continue;
          }
          let name = Main.getWorkspaceName(i);
          let pinned = pinSettings[i].indexOf(appId) >= 0;
          let iconName = pinned ? "starred" : "non-starred";
          let ws = new PopupMenu.PopupSwitchIconMenuItem(name, pinned, iconName, St.IconType.SYMBOLIC);
          let j = i;
          ws.connect("toggled", Lang.bind(this, function(menuItem, state) {
            if (state) {
              this._applet._workspaces[j].pinAppId(appId);
              menuItem.setIconSymbolicName("starred");
            }
            else {
              this._applet._workspaces[j].unpinAppId(appId);
              menuItem.setIconSymbolicName("non-starred");
            }
          }));
          item.menu.addMenuItem(ws);
        }
        this._contextMenu.addMenuItem(item);
      }
    }
    
    let appInfo = this._app.get_app_info();
    if (appInfo != null) {
      let actions = appInfo.list_actions();
      if (actions.length > 0) {
        let appId = this.get_app_id();
        
        if (appId == "nemo.desktop" || appId == "nemo-home.desktop") {
          let defaultPlaces = Main.placesManager.getDefaultPlaces();
          let bookmarks = Main.placesManager.getBookmarks();
          let places = defaultPlaces.concat(bookmarks);
          
          if (places.length > 0) {
            this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let placesMenu = new PopupMenu.PopupSubMenuMenuItem(_("Places"));
            
            for (let i = 0; i < places.length; i++) {
              let place = places[i];
              let placeItem = new PopupMenu.PopupMenuItem(place.name);
              placeItem.connect("activate", Lang.bind(this, function() {
                place.launch();
              }));
              placesMenu.menu.addMenuItem(placeItem);
            }
            this._contextMenu.addMenuItem(placesMenu);
          }
        }
        
        this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (let i = 0; i < actions.length; i++) {
          let action = actions[i];
          let displayName = appInfo.get_action_name(action);
          
          let actionItem = new PopupMenu.PopupMenuItem(displayName);
          actionItem.connect("activate", Lang.bind(this, function() {
            appInfo.launch_action(action, global.create_app_launch_context());
          }));
          this._contextMenu.addMenuItem(actionItem);
        }
      }
    }
    
    if (this._currentWindow) {
      this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // window ops for workspaces
      if (this._currentWindow.is_on_all_workspaces()) {
        this._contextMenu.addAction(_("Only on this workspace"), Lang.bind(this, function() {this._currentWindow.unstick()}));
      }
      else if (this._applet._workspaces.length > 1) {
        this._contextMenu.addAction(_("Visible on all workspaces"), Lang.bind(this, function() {this._currentWindow.stick()}));
        item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another workspace"));
        this._contextMenu.addMenuItem(item);
        
        for (let i = 0; i < this._applet._workspaces.length; i++) {
          if (i != this._workspace._wsNum) {
            // Make the index a local variable to pass to function
            let j = i;
            let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
            let ws = new PopupMenu.PopupMenuItem(name);
            ws.connect("activate", Lang.bind(this, function() {
                this._currentWindow.change_workspace_by_index(j, false, 0);
            }));
            item.menu.addMenuItem(ws);
          }
        }
      }
      
      let nMonitors = Main.layoutManager.monitors.length;
      if (nMonitors > 1) {
        item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another monitor"));
        this._contextMenu.addMenuItem(item);
        let monitor = this._currentWindow.get_monitor();
        for (let i = 0; i < nMonitors; i++) {
          if (i == monitor) {
            continue;
          }
          let j = i;
          let name = _("Monitor") + " " + j;
          if (this._applet.xrandrMonitors[j] != null) {
            name += " (" + this._applet.xrandrMonitors[j] + ")";
          }

          let monitorItem = new PopupMenu.PopupMenuItem(name);
          monitorItem.connect("activate", Lang.bind(this, function() {
            this._currentWindow.move_to_monitor(j);
          }));
          item.menu.addMenuItem(monitorItem);
        }
      }
      
      this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // window specific
      if (!hasFocus(this._currentWindow)) {
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
      if (this._windows.length > 1) {
        item = new PopupMenu.PopupIconMenuItem(_("Close others"), "application-exit", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() {
          let curIdx = this._windows.indexOf(this._currentWindow);
          this._windows.splice(curIdx, 1);
          this._windows.push(this._currentWindow);
          for (let i = this._windows.length - 2; i >= 0; i--) {
            this._windows[i].delete(global.get_current_time());
          }
        }));
        this._contextMenu.addMenuItem(item);
        
        item = new PopupMenu.PopupIconMenuItem(_("Close all"), "window-close", St.IconType.SYMBOLIC);
        item.connect("activate", Lang.bind(this, function() {
          for (let i = this._windows.length - 1; i >= 0; i--) {
            this._windows[i].delete(global.get_current_time());
          }
        }));
        this._contextMenu.addMenuItem(item);
      }
      
      item = new PopupMenu.PopupIconMenuItem(_("Close"), "edit-delete", St.IconType.SYMBOLIC);
      item.connect('activate', Lang.bind(this, function() {
        this._currentWindow.delete(global.get_current_time());
      }));
      this._contextMenu.addMenuItem(item);
    }
  }
}

class CobiWorkspace {
  constructor(applet, wsNum) {
    this._applet = applet;
    this._wsNum = wsNum;
    this._settings = this._applet._settings;
    this._signalManager = new SignalManager.SignalManager(null);
    
    this.actor = new St.BoxLayout();
    this.actor._delegate = this;
    this.actor.set_hover(false);
    this.actor.set_track_hover(false);
    this.actor.add_style_class_name("window-list-box");
    
    this.dragInProgress = false;
    
    this._windowTracker = Cinnamon.WindowTracker.get_default();
    this._appSys = Cinnamon.AppSystem.get_default();
    
    this.menuManager = new CobiMenuManager(this);
    
    this._appButtons = [];
    this._settings = this._applet._settings;
    
    let pinSetting = this._settings.getValue("pinned-apps");
    if (pinSetting.length < wsNum) {
      let newSetting = pinSetting.slice();
      newSetting.push([]);
      this._settings.setValue("pinned-apps", newSetting);
    }
    
    this._signalManager = new SignalManager.SignalManager(null);
  }
  
  onAddedToPanel() {
    if (this._settings.getValue("display-pinned")) {
      this._updatePinnedApps();
    }
    
    this._updateAllWindowsForMonitor();
    
    this.onOrientationChanged(this._applet.orientation);
    
    this._signalManager.connect(this._windowTracker, "notify::focus-app", this._updateFocus, this);
    this._signalManager.connect(global.settings, "changed::panel-edit-mode", this._onPanelEditModeChanged, this);
    this._signalManager.connect(this._settings, "changed::pinned-apps", this._updatePinnedApps, this);
    this._signalManager.connect(this._settings, "changed::show-windows-for-current-monitor", this._updateAllWindowsForMonitor, this);
    this._signalManager.connect(this._settings, "changed::group-windows", this._onGroupingChanged, this);
  }
  
  onOrientationChanged(orientation) {
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
      this._appButtons[i]._updateOrientation();
    }
  }
  
  _onPanelEditModeChanged () {
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
  }
  
  _onDragBegin() {
    let children = this.actor.get_children();
    for (let i = 0; i < children.length; i++) {
      let appButton = children[i]._delegate;
      if (appButton instanceof CobiAppButton) {
        appButton.menu.close();
      }
    }
  }
  
  onPanelHeightChanged() {
    for (let i in this._appButtons) {
      this._appButtons[i].updateIcon();
    }
  }
  
  _addAppButton(app) {
    if (!app) {
      return undefined;
    }
    let appButton = new CobiAppButton(this, this._applet, app);
    this._appButtons.push(appButton);
    this.actor.add_actor(appButton.actor);
    appButton.updateIcon();
    appButton.actor.show();
    appButton.updateCaption();
    return appButton;
  }
  
  _removeAppButton(appButton) {
    let index = this._appButtons.indexOf(appButton);
    if (index >= 0) {
      this._appButtons.splice(index, 1);
      appButton.destroy();
    }
  }
  
  _lookupAppButtonForWindow(metaWindow) {
    let appButtons = this._appButtons.filter(function(appButton) {
      return appButton._windows.indexOf(metaWindow) >= 0;
    });
    return appButtons.length > 0 ? appButtons[0] : undefined;
  }
  
  _lookupAllAppButtonsForApp(app, startIndex) {
    let children = this.actor.get_children().slice(startIndex);
    let btns = children.map(x => x._delegate);
    return btns.filter(x => { return x._app.get_id() == app.get_id() });
  }
  
  _lookupAppButtonForApp(app, startIndex) {
    let appButtons = this._lookupAllAppButtonsForApp(app, startIndex);
    return appButtons.length > 0 ? appButtons[0] : undefined;
  }
  
  _windowAdded(metaWindow) {
    if (this._settings.getValue("show-windows-for-current-monitor") &&
        this._applet.panel.monitorIndex != metaWindow.get_monitor()) {
      return;
    }
    
    if (!Main.isInteresting(metaWindow)) {
      return;
    }
    
    if (this._lookupAppButtonForWindow(metaWindow)) {
      return;
    }
    
    if (metaWindow.get_workspace().index() != this._wsNum && !metaWindow.is_on_all_workspaces()) {
      return;
    }
    
    let app = this._windowTracker.get_window_app(metaWindow);
    if (!app && metaWindow.get_client_pid) {
      app = this._windowTracker.get_app_from_pid(metaWindow.get_client_pid());
    }
    if (!app) {
      app = this._windowTracker.get_app_from_pid(metaWindow.get_pid());
    }
    if (!app) {
      return false;
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
    else if (!this._settings.getValue("group-windows") && appButton._windows.length > 0) {
      appButton = this._addAppButton(app);
    }
    appButton.addWindow(metaWindow);
    this._updateAppButtonVisibility();
    return false;
  }
  
  _windowRemoved(metaWindow) {
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
  }
  
  _updateAllWindowsForMonitor() {
    let ws = global.screen.get_workspace_by_index(this._wsNum);
    let windows = ws.list_windows();
    let setting = this._settings.getValue("show-windows-for-current-monitor");
    
    for (let i = 0; i < windows.length; i++) {
      let metaWindow = windows[i];
      if (!setting) {
        this._windowAdded(metaWindow);
      }
      else {
        if (metaWindow.get_monitor() != this._applet.panel.monitorIndex) {
          this._windowRemoved(metaWindow);
        }
        else {
          this._windowAdded(metaWindow);
        }
      }
    }
  }
  
  _lookupApp(appId) {
    let app = null;
    if (appId) {
      app = this._appSys.lookup_app(appId);
    }
    return app;
  }
  
  _updatePinnedApps() {
    // find new pinned apps
    if (this._settings.getValue("display-pinned")) {
      let pinnedApps = this._settings.getValue("pinned-apps")[this._wsNum];
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
      if ((appButton.getPinnedIndex() < 0) && appButton._windows.length == 0) {
        this._removeAppButton(appButton);
      }
    }
  }
  
  _onDisplayPinnedChanged() {
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
  }
  
  _updatePinSettings() {
    let appButtons = this.actor.get_children().map(x => x._delegate);
    let newSetting = [];
    let pinnedBtns = appButtons.filter(x => { return (x._pinned && !x._app.get_id().startsWith("window:")) });
    for (let i = 0; i < pinnedBtns.length; i++) {
      newSetting.push(pinnedBtns[i]._app.get_id());
    }
    let pinSetting = this._settings.getValue("pinned-apps").slice();
    pinSetting[this._wsNum] = newSetting;
    this._settings.setValue("pinned-apps", pinSetting);
  }

  pinAppId(appId, actorPos) {
    let app = this._lookupApp(appId);
    if (!app) {
      return false;
    }
    let appButton = this._lookupAppButtonForApp(app);
    if (!appButton) {
      appButton = this._addAppButton(app);
      let actIdx = this.actor.get_children().indexOf(appButton.actor);
      if (actorPos !== undefined && actorPos - actIdx > 0) {
        actorPos--;
      }
    }
    if (actorPos !== undefined) {
      this.actor.move_child(appButton.actor, actorPos);
    }
    this.pinAppButton(appButton);
    return true;
  }
  
  unpinAppId(appId) {
    let app = this._lookupApp(appId);
    if (!app) {
      return false;
    }
    let appButtons = this._lookupAllAppButtonsForApp(app);
    for (let i = 0; i < appButtons.length; i++) {
      let appButton = appButtons[i];
      if (appButton._pinned) {
        this.unpinAppButton(appButton);
        return true;
      }
    }
    return false;
  }
  
  pinAppButton(appButton) {
    let app = appButton._app;
    let appId = app.get_id();
    
    let appButtons = this._lookupAllAppButtonsForApp(app);
    for (let i = 0; i < appButtons.length; i++) {
      appButtons[i]._pinned = false;
    }
    
    appButton._pinned = true;
    this._updatePinSettings();
  }
  
  unpinAppButton(appButton) {
    appButton._pinned = false;
    appButton.updateView();
    if (appButton._windows.length == 0) {
      this._removeAppButton(appButton);
    }
    this._updatePinSettings();
  }
  
  _onGroupingChanged() {
    let setting = this._settings.getValue("group-windows");
    if (setting) {
      this._group();
    }
    else {
      this._ungroup();
    }
  }
  
  _group() {
    let appButtons = this._appButtons.slice();
    for (let i = 0; i < appButtons.length; i++) {
      let appButton = appButtons[i];
      let app = appButton._app;
      let allButtons = this._lookupAllAppButtonsForApp(app);
      for (let j = 1; j < allButtons.length; j++) {
        let btn = allButtons[j];
        for (let k = 0; k < btn._windows.length; k++) {
          let window = btn._windows[k];
          this._windowRemoved(window);
          this._windowAdded(window);
        }
        this._removeAppButton(btn);
      }
    }
    for (let i = 0; i < this._appButtons.length; i++) {
      this._appButtons[i].updateView();
    }
    this._updatePinnedApps();
  }
  
  _ungroup() {
    let appButtons = this._appButtons.slice();
    for (let i = 0; i < appButtons.length; i++) {
      let appButton = appButtons[i];
      for (let j = appButton._windows.length - 1; j >= 0; j--) {
        let window = appButton._windows[j];
        if (window != appButton._currentWindow) {
          appButton.removeWindow(window);
          this._windowAdded(window);
        }
      }
      appButton.updateView();
    }
    this._updatePinnedApps();
  }
  
  _updateAppButtonVisibility() {
    for (let i = 0; i < this._appButtons.length; i++) {
      let appButton = this._appButtons[i];
      appButton.updateView();
    }
    this.actor.queue_relayout();
  }
  
  _updateFocus() {
    for (let i = 0; i < this._appButtons.length; i++) {
      let appButton = this._appButtons[i];
      appButton._updateFocus();
    }
  }
  
  handleDragOver(source, actor, x, y, time) {
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

    if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
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
  }
  
  handleDragOut() {
    this._clearDragPlaceholder();
  }
  
  acceptDrop(source, actor, x, y, time) {
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
  }
  
  _clearDragPlaceholder() {
    if (this._dragPlaceholder) {
      this._dragPlaceholder.actor.destroy();
      this._dragPlaceholder = undefined;
      this._dragPlaceholderPos = undefined;
    }
  }
  
  destroy() {
    this._signalManager.disconnectAllSignals();
    
    let pinSetting = this._settings.getValue("pinned-apps").slice();
    pinSetting.splice(this._wsNum, 1);
    this._settings.setValue("pinned-apps", pinSetting);
    
    for (let i = this._appButtons.length - 1; i >= 0; i--) {
      this._appButtons[i].destroy();
    }
    this._appButtons = null;
    this.actor.destroy();
  }
}

class CobiWindowList extends Applet.Applet {
  
  constructor(orientation, panelHeight, instanceId) {
    super(orientation, panelHeight, instanceId);
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    
    this.actor.set_hover(false);
    this.actor.set_track_hover(false);
    this.orientation = orientation;
    
    this._settings = new CobiWindowListSettings(instanceId);
    this._signalManager = new SignalManager.SignalManager(null);
    
    this._workspaces = [];
    
    this.on_orientation_changed(orientation);
  }
  
  _onDragBegin() {
    super._onDragBegin();
    let children = this.actor.get_children();
    for (let i = 0; i < children.length; i++) {
      let appButton = children[i]._delegate;
      if (appButton instanceof CobiWorkspace) {
        appButton._onDragBegin();
      }
    }
  }
  
  _onButtonReleaseEvent (actor, event) {
    // override applet's default context menu toggling
  }
  
  _onButtonPressEvent() {
    // override applet's default context menu toggling
  }
  
  on_applet_added_to_panel() {
    this._updateMonitor();
    let nWorkspaces = global.screen.get_n_workspaces();
    
    // upgrade pinned-apps
    let pinSetting = this._settings.getValue("pinned-apps");
    let newSetting = [];
    let changed = false;
    if (pinSetting.length > 0 && pinSetting[0] instanceof Array) {
      if (pinSetting.length > nWorkspaces) {
        newSetting = pinSetting.slice(0, nWorkspaces);
        changed = true;
      }
    }
    else {
      let nWorkspaces = global.screen.get_n_workspaces();
      for (let i = 0; i < nWorkspaces; i++) {
        newSetting.push(pinSetting.slice());
      }
      changed = true;
    }
    
    if (changed) {
      this._settings.setValue("pinned-apps", newSetting);
    }
    
    for (let i = 0; i < nWorkspaces; i++) {
      this._onWorkspaceAdded(global.screen, i);
    }
    
    this._signalManager.connect(global.window_manager, "switch-workspace", this._updateCurrentWorkspace, this);
    this._signalManager.connect(global.screen, "workspace-added", this._onWorkspaceAdded, this);
    this._signalManager.connect(global.screen, "workspace-removed", this._onWorkspaceRemoved, this);
    this._signalManager.connect(global.screen, "window-added", this._windowAdded, this);
    this._signalManager.connect(global.screen, "window-removed", this._windowRemoved, this);
    this._signalManager.connect(global.screen, "window-monitor-changed", this.windowMonitorChanged, this);
    this._signalManager.connect(Main.layoutManager, "monitors-changed", this._updateMonitor, this);
  }
  
  on_applet_removed_from_panel() {
    this._signalManager.disconnectAllSignals();
  }
  
  on_panel_height_changed() {
    for (let i = 0; i < this._workspaces.length; i++) {
      this._workspaces[i].onPanelHeightChanged();
    }
  }
  
  on_panel_icon_size_changed() {
    for (let i = 0; i < this._workspaces.length; i++) {
      this._workspaces[i].onPanelHeightChanged();
    }
  }
  
  on_orientation_changed(orientation) {
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
    // TODO: update orientation for workspaces
    for (let i = 0; i < this._workspaces.length; i++) {
      this._workspaces[i].onOrientationChanged(orientation);
    }
  }
  
  _updateMonitor() {
    this.xrandrMonitors = getMonitors();
    this._monitor = Main.layoutManager.findMonitorForActor(this.actor);
  }
  
  _onWorkspaceAdded(screen, wsNum) {
    if (this._workspaces.length <= wsNum) {
      let workspace = new CobiWorkspace(this, wsNum);
      this._workspaces[wsNum] = workspace;
      let pinSettings = this._settings.getValue("pinned-apps");
      if (wsNum >= pinSettings.length) {
        pinSettings = pinSettings.slice();
        pinSettings.push([]);
        this._settings.setValue("pinned-apps", pinSettings);
      }
      this.actor.add_child(workspace.actor);
      this._updateCurrentWorkspace();
      workspace.onAddedToPanel();
    }
  }
  
  _onWorkspaceRemoved(screen, wsNum) {
    if (this._workspaces.length > wsNum) {
      let workspace = this._workspaces[wsNum];
      this._workspaces.splice(wsNum, 1);
      
      for (let i = 0; i < this._workspaces.length; i++) {
        this._workspaces[i]._wsNum = i;
      }
      
      workspace.destroy();
    }
  }
  
  _updateCurrentWorkspace() {
    let currentWs = global.screen.get_active_workspace_index();
    for (let i = 0; i < this._workspaces.length; i++) {
      let ws = this._workspaces[i];
      if (ws._wsNum == currentWs) {
        ws.actor.show();
        ws._updateAppButtonVisibility();
      }
      else {
        ws.actor.hide();
      }
    }
  }
  
  _windowAdded(screen, metaWindow, monitor) {
    if (this._settings.getValue("show-windows-for-current-monitor") &&
        monitor != this.panel.monitorIndex) {
      return;
    }
    for (let i = 0; i < this._workspaces.length; i++) {
      let workspace = this._workspaces[i];
      workspace._windowAdded(metaWindow);
    }
  }
  
  _windowRemoved(screen, metaWindow, monitor) {
    for (let i = 0; i < this._workspaces.length; i++) {
      let workspace = this._workspaces[i];
      workspace._windowRemoved(metaWindow);
    }
  }
  
  windowWorkspaceChanged(window, wsNumOld) {
    let stuck = window.is_on_all_workspaces();
    let wsWindow = window.get_workspace();
    let wsNumNew = wsWindow != null ? wsWindow.index() : 0;
    for (let i = 0; i < this._workspaces.length; i++) {
      let workspace = this._workspaces[i];
      let wsIdx = workspace._wsNum;
      if (stuck) {
        workspace._windowAdded(window);
      }
      else {
        if (wsNumNew == wsIdx) {
          workspace._windowAdded(window);
        }
        else {
          workspace._windowRemoved(window);
        }
      }
    }
  }
  
  windowMonitorChanged(screen, window, monitor) {
    if (!this._settings.getValue("show-windows-for-current-monitor")) {
      return;
    }
    if (monitor == this.panel.monitorIndex) {
      this._windowAdded(screen, window, monitor);
    }
    else {
      this._windowRemoved(screen, window, monitor);
    }
  }
  
  acceptNewLauncher(appId) {
    let currentWs = global.screen.get_active_workspace_index();
    for (let i = 0; i < this._workspaces.length; i++) {
      let ws = this._workspaces[i];
      if (ws._wsNum == currentWs) {
        ws.pinAppId(appId);
        break;
      }
    }
  }
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new CobiWindowList(orientation, panelHeight, instanceId);
}
