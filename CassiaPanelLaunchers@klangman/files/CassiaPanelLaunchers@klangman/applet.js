/*
 * applet.js
 * Copyright (C) 2022 Kevin Langman <klangman@gmail.com>
 *
 * CassiaPanelLaunchers is a fork of Cinnamon Panel Launchers which is found here:
 * https://github.com/linuxmint/cinnamon/tree/master/files/usr/share/cinnamon/applets/panel-launchers%40cinnamon.org
 *
 * Also borrows code originating from CobiWindowList for the ThumbnailMenu
 * Copyright (C) 2013 Lars Mueller <cobinja@yahoo.de>
 * https://cinnamon-spices.linuxmint.com/applets/view/287
 *
 * CassiaPanelLaunchers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * CassiaPanelLaunchers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const WindowUtils = imports.misc.windowUtils;
const DND = imports.ui.dnd;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Signals = imports.signals;
const SignalManager = imports.misc.signalManager;
const Gettext = imports.gettext;

const UUID = "CassiaPanelLaunchers@klangman";

const PANEL_EDIT_MODE_KEY = 'panel-edit-mode';
const PANEL_LAUNCHERS_KEY = 'panel-launchers';

const STYLE_CLASS_ATTENTION_STATE = "grouped-window-list-item-demands-attention";

const CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers';
const EDITED_LAUNCHERS_PATH = GLib.get_home_dir() + '/.local/share/applications/';

// Standard icons list borrowed from the cinnamon grouped-window-list
const ICON_NAMES = {
   area_shot: 'screenshot-area',
   base: 'x-office-database',
   big_picture: 'view-fullscreen',
   burn_image: 'stock_xfburn',
   calc: 'x-office-spreadsheet',
   calendar: 'view-calendar-month',
   community: 'system-users',
   compose: 'text-editor',
   contacts: 'x-office-address-book',
   create_project: 'project-development-new-template',
   document: 'document-new',
   draw: 'x-office-drawing',
   friends: 'user-available',
   fullscreen: 'view-fullscreen',
   impress: 'x-office-presentation',
   library: 'accessories-dictionary',
   mail: "mail-message",
   math: 'x-office-math',
   memos: 'stock_notes',
   mute: 'audio-volume-muted',
   new_document: 'document-new',
   new_event: 'resource-calendar-insert',
   new_message: 'mail-message',
   new_private_window: 'security-high',  //'view-private',
   new_root_window: 'dialog-password', 
   news: 'news-subscribe',               //'news',
   new_session: 'tab-new-symbolic',
   new_window: 'window-new',
   next: 'media-skip-forward',
   open_calendar: 'view-calendar-month',
   open_computer: 'computer',
   open_home: 'user-home',
   open_trash: 'user-trash',
   play: 'media-playback-start',
   play_pause: 'media-playback-start',
   preferences: 'preferences-other',
   prefs: 'preferences-other',
   previous: 'media-skip-backward',
   profile_manager_window: 'avatar-default-symbolic',
   screen_shot: 'view-fullscreen',     //'screenshot-fullscreen',
   screenshots: 'applets-screenshooter',
   servers: 'network-server',
   settings: 'preferences-other',
   ssa: 'screenshot-area',
   ssf: 'view-fullscreen',           //'screenshot-fullscreen',
   ssw: 'window',                    //'screenshot-window',
   stop_quit: 'media-playback-stop',
   store: 'applications-games',      //'store',
   tasks: 'view-pim-tasks',
   window: 'window-new',
   window_shot: 'window',           //'screenshot-window',
   writer: 'x-office-document'
}

// The possible user Settings for how window list window counts should be displayed
const DisplayNumber = {
  No: 0,            // The number of windows attached to a window list button is never displayed
  All: 1,           // ... always displayed
  Smart: 2          // ... only displayed when 2 of more windows exist
}

// Possible value for the Mouse Action setting
const MouseAction = {
  Preview: 0,         // Toggle the preview menu (open/close)
  PreviewHold: 1,     // Show the window preview menu on button press and hide it again on button release
  Close: 2,           // Close the window
  Minimize: 3,        // Minimize/restore toggle for the window
  Maximize: 4,        // Maximize/restore toggle for the window
  New: 5,             // Open a new window for this application
  MoveWorkspace1: 6,  // Move window to WorkSPace #1
  MoveWorkspace2: 7,  // 2
  MoveWorkspace3: 8,  // 3
  MoveWorkspace4: 9,  // 4
  WS_Visibility: 10,  // Toggle workspace visibility from all to only this workspace
  None: 99,           // No action performed
}

// Possible settings for the left mouse action for launcher buttons with 2+ windows
const LeftClickGrouped = {
   Toggle: 0,         // Restore most resent window or minimize if already in focus
   Cycle: 1,          // Restore most recent window or cycle windows of any window is already in focus
   Thumbnail: 2       // Show the Thumbnail menu of windows
}

const ScrollWheelAction = {
   Off: 0,
   On: 1,
   OnGlobal: 2,
   OnApplication: 3
}

let pressLauncher = null;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  if (locText == text) {
    locText = window._(text);
  }
  return locText;
}

function hasFocus(metaWindow, allowTransient=true) {
    let window = global.display.get_focus_window();
    if (window === metaWindow) {
       return true;
    }
    //if (metaWindow.appears_focused) {
    //    log( "appears_focused" );
    //    return true;
    //}
    if (allowTransient===false) {
       return false;
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

// Represents an item in the Thumbnail popup menu
class ThumbnailMenuItem extends PopupMenu.PopupBaseMenuItem {

  constructor(menu, launcherButton, metaWindow) {
    super();
    this._menu = menu;
    this._launcherButton = launcherButton;
    this._metaWindow = metaWindow;
    this._signalManager = new SignalManager.SignalManager(null);
    this._settings = this._menu._settings;

    this._box = new St.BoxLayout({vertical: true, reactive: true, style: 'border-width:2px;padding:' + 3 * global.ui_scale + 'px;', style_class: 'item-box'});
    this.actor.set_style("padding: 0.5em;");
    this.addActor(this._box);

    this._iconSize = 20 * global.ui_scale;
    this.descSize = 24 * global.ui_scale;
    this._icon = this._launcherButton.app ?
                  this._launcherButton.app.create_icon_texture_for_window(this._iconSize, this._metaWindow) :
                  new St.Icon({ icon_name: "application-default-icon",
                                icon_type: St.IconType.FULLCOLOR,
                                icon_size: this._iconSize });
    this._icon.natural_width = this._iconSize;
    this._icon.natural_height = this._iconSize;
    this._icon.set_width(-1);
    this._icon.set_height(-1);
    let monitor = this._launcherButton._applet.panel.monitor;
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
      text = this._launcherButton.app.get_name();
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

    if (this._launcherButton._windows.length > 1 && this._launcherButton._currentWindow === metaWindow) {
      this._box.add_style_pseudo_class('outlined');
    }

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
    let monitor = this._launcherButton._applet.panel.monitor;
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
    } else {
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
    let mouseBtn = event.get_button();
    if (this._launcherButton._applet.holdPopup === mouseBtn) {
       this._launcherButton._applet.holdPopup = undefined;
       this._launcherButton.closeThumbnailMenu()
       Main.activateWindow(this._metaWindow);
       return true;
    }
    if (mouseBtn == 2) {  // Middle button
      let action = this._settings.getValue("preview-middle-click");
      this._launcherButton._performMouseAction(action, this._metaWindow);
      return true;
    } else if (mouseBtn == 3) { // Right button
      //this._appButton._populateContextMenu(this._metaWindow);
      //this._appButton._contextMenu.open();
      //this._appButton._updateFocus();
      return true;
    } else if(mouseBtn == 8) {
      let action = this._settings.getValue("preview-back-click");
      this._launcherButton._performMouseAction(action, this._metaWindow);
      return true;
    } else if(mouseBtn == 9) {
      let action = this._settings.getValue("preview-forward-click");
      this._launcherButton._performMouseAction(action, this._metaWindow);
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
      this._launcherButton.closeThumbnailMenu()
      Main.activateWindow(this._metaWindow);
    }
  }

  hide() {
    this._menu._inHiding = true;
    this._closeBin.hide();

    if (this._cloneBin) {
      //let animTime = this._settings.getValue("label-animation-time") * 0.001;
      Tweener.addTween(this.actor, {
        width: 0,
        time: 0.5, //animTime,
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
    } else {
      this.actor.hide();
      this._menu._inHiding = false;
      this.destroy();
    }
  }

  updateUrgentState() {
    if (this._metaWindow.urgent || this._metaWindow.demands_attention) {
      this.actor.add_style_class_name(STYLE_CLASS_ATTENTION_STATE);
    } else {
      this.actor.remove_style_class_name(STYLE_CLASS_ATTENTION_STATE);
    }
  }

  destroy() {
    this._signalManager.disconnectAllSignals();
    super.destroy();
  }
}

// The Thumbnail popup menu
class ThumbnailMenu extends PopupMenu.PopupMenu {

  constructor(launcherButton) {
    super(launcherButton.actor, launcherButton.orientation);
    this._launcherButton = launcherButton;
    this._settings = this._launcherButton.settings;
    this._signalManager = new SignalManager.SignalManager(null);
    this.numThumbs = undefined;
    this.setCustomStyleClass("grouped-window-list-thumbnail-menu");

    global.focus_manager.add_group(this.actor);
    this.actor.reactive = true;
    Main.layoutManager.addChrome(this.actor);
    this.actor.hide();

    this._updateOrientation();

    this._signalManager.connect(this.actor, "enter-event", this._onEnterEvent, this);
    this._signalManager.connect(this.actor, "leave-event", this._onLeaveEvent, this);
    this._signalManager.connect(this.actor, "scroll-event", this._onScrollEvent, this);
  }

  _updateOrientation() {
    if (!Main.software_rendering) {
      this.box.set_vertical(false);
    }

    if (this._launcherButton.orientation == St.Side.LEFT ||
        this._launcherButton.orientation == St.Side.RIGHT ||
        !this._settings.getValue("show-previews")) {
      this.box.set_vertical(true);
    }
  }

  _onEnterEvent() {
    this._launcherButton.removeThumbnailMenuDelay();
    return false;
  }

  _onLeaveEvent() {
    this._launcherButton.closeThumbnailMenuDelayed();
    return false;
  }

  _onScrollEvent(actor, event) {
     this._launcherButton._onScrollEvent(actor, event);
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

  openMenu() {
    if (this.isOpen || this._launcherButton._windows.length==0 || global.settings.get_boolean("panel-edit-mode") === true) {
      return;
    }
    this._updateOrientation();
    let windows = this._launcherButton._windows;
    for (let i = windows.length-1; i >= 0; i--) {
      this.addWindow(windows[i]);
    }
    let wheelSetting = this._settings.getValue("wheel-adjusts-preview-size");
    if (wheelSetting===ScrollWheelAction.OnGlobal)
       this.numThumbs = this._launcherButton._applet.thumbnailSize;
    this.updateUrgentState();
    this.recalcItemSizes();

    super.open(false);
  }

  closeMenu() {
    this._launcherButton._applet.holdPopup = undefined;
    if (this._inHiding && this.numMenuItems > 1) {
      return;
    }
    //log( "menu close called!" );
    //var err = new Error();
    //log( "Stack:\n"+err.stack );
    super.close(false);
    this.removeAll();
    if (this._settings.getValue("wheel-adjusts-preview-size")<ScrollWheelAction.OnGlobal) // Off or On
       this.numThumbs = this._settings.getValue("number-of-unshrunk-previews"); // reset the preview window size in case scroll-wheel zooming occurred.
  }

  addWindow(window) {
    if (this._findMenuItemForWindow(window) == null) {
      let btn = this._launcherButton
      if (btn._windows.length == 1 && btn._windows[0] != window) {
         btn = this._launcherButton._applet._lookupAppButtonForWindow(window);
      }
      let menuItem = new ThumbnailMenuItem(this, btn, window);
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

    let monitor = this._launcherButton._applet.panel.monitor;
    let panels = Main.panelManager.getPanelsInMonitor(this._launcherButton._applet.panel.monitorIndex);
    for (let i = 0; i < panels.length; i++) {
      if (panels[i].panelPosition == Panel.PanelLoc.top || panels[i].panelPosition == Panel.PanelLoc.bottom) {
        overheadHeight += panels[i].actor.height;
      } else {
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

    let numThumbs;
    if (this.numThumbs === undefined) {
       numThumbs = this._settings.getValue("number-of-unshrunk-previews");
       this.numThumbs = numThumbs;
    } else {
       numThumbs = this.numThumbs;
    }

    if (this.box.get_vertical()) {
      itemHeight = (availHeight / (Math.max(numItems, numThumbs))) - ((numItems - 1) * spacing * global.ui_scale);
    } else {
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

class ThumbnailMenuManager extends PopupMenu.PopupMenuManager {

  constructor(owner) {
    super(owner);
    this.dragMotion = this.dragMotionHandler.bind(this);
    this._signals.connect(Main.xdndHandler, "drag-end", this.onDragEnd, this);
    this._signals.connect(Main.xdndHandler, "drag-begin", this.onDragBegin, this);
    this._appet = owner;
  }

  onDragBegin() {
    DND.addDragMonitor(this);
  }

  onDragEnd() {
    DND.removeDragMonitor(this);
    this._applet.closeThumbnailMenu();
  }

  dragMotionHandler(dragEvent) {
    if (dragEvent) {
      if (dragEvent.source instanceof WindowListButton || dragEvent.source.isDraggableApp || dragEvent.source instanceof DND.LauncherDraggable) {
        return DND.DragMotionResult.CONTINUE;
      }
      let hoverMenu = this._findMenuForActor(dragEvent);
      if (hoverMenu) {
        if (hoverMenu !== this._activeMenu) {
          if (hoverMenu._launcherButton._windows.length > 1) {
            this._changeMenu(hoverMenu);
          } else if (hoverMenu._launcherButton._windows.length === 1) {
            this._workspace.closeThumbnailMenu();
            Main.activateWindow(hoverMenu._launcherButton._currentWindow);
          }
        }
      } else {
        this._applet.closeThumbnailMenu();
      }
    }
    return DND.DragMotionResult.CONTINUE;
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

/* The launcherButton context menu */
class PanelAppLauncherMenu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        let item;
        super(launcher, orientation);
        this._launcher = launcher;

        let appinfo = this._launcher.getAppInfo();

        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));
        this.addMenuItem(subMenu);

        item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher.launchersBox, this._launcher.launchersBox.openAbout));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher.launchersBox, this._launcher.launchersBox.configureApplet));
        subMenu.menu.addMenuItem(item);

        this.remove_item = new PopupMenu.PopupIconMenuItem(_("Remove '%s'").format(_("Cassia Panel launchers")), "edit-delete", St.IconType.SYMBOLIC);
        subMenu.menu.addMenuItem(this.remove_item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupIconMenuItem(_("Open new window"), "video-display-symbolic", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onLaunchActivate));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._actions = appinfo.list_actions();
        if (this._actions.length > 0) {
            for (let i = 0; i < this._actions.length; i++) {
                let actionName = this._actions[i];
                this.addActionWithIcon(actionName, appinfo.get_action_name(actionName), Lang.bind(this, this._launchAction, actionName));
            }

            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        if (Main.gpu_offload_supported) {
            let item = new PopupMenu.PopupIconMenuItem(_("Run with NVIDIA GPU"), "cpu", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', Lang.bind(this, this._onLaunchOffloadedActivate));
            this.addMenuItem(item);
        }

        item = new PopupMenu.PopupIconMenuItem(_("Add new launcher"), "list-add", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onAddActivate));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Edit this launcher"), "document-properties", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onEditActivate));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove this launcher"), "window-close", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onRemoveActivate));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    addActionWithIcon(action, title, callback) {
        let actionProp = action.replace(/([A-Z])/g, '_$1').replace(/-/g, '_').toLowerCase();
        if (actionProp[0] == '_') actionProp = actionProp.slice(1);

        let menuItem;
        if (ICON_NAMES.hasOwnProperty(actionProp))
           menuItem = new PopupMenu.PopupIconMenuItem(title, ICON_NAMES[actionProp], St.IconType.SYMBOLIC);
        else
           menuItem = new PopupMenu.PopupIconMenuItem(title, "", St.IconType.SYMBOLIC);
        this.addMenuItem(menuItem);
        this._signals.connect(menuItem, 'activate', (menuItem, event) => { callback(event) });

        return menuItem;
    }

    _onLaunchActivate(item, event) {
        this._launcher.launch();
    }

    _onLaunchOffloadedActivate(item, event) {
        this._launcher.launch(true);
    }

    _onRemoveActivate(item, event) {
        this.close();
        this._launcher.launchersBox.removeLauncher(this._launcher, this._launcher.isCustom());
    }

    _onAddActivate(item, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time());
    }

    _onEditActivate(item, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time(), this._launcher);
    }

    _launchAction(event, name) {
        this._launcher.launchAction(name);
    }
}

/* The launcherButton class */
class PanelAppLauncher extends DND.LauncherDraggable {
    constructor(launchersBox, app, appinfo, orientation, icon_size) {
        super(launchersBox);
        this._applet = launchersBox;
        this.settings = launchersBox.settings;
        this.app = app;
        this.appinfo = appinfo;
        this.orientation = orientation;
        this.icon_size = icon_size;

        this._signals = new SignalManager.SignalManager(null);

        this.actor = new St.BoxLayout({
                                  style_class: 'grouped-window-list-item-box', //'launcher',
                                  //important: true,
                                  reactive: true,
                                  can_focus: true,
                                  //x_fill: true,
                                  //y_fill: true,
                                  track_hover: true,
                                  x_align: St.Align.MIDDLE,
                                  y_align: St.Align.MIDDLE
                                  });

        this.actor.set_easing_mode(Clutter.AnimationMode.EASE_IN_QUAD);
        this.actor.set_easing_duration(100);

        this.actor._delegate = this;
        this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonRelease));
        this._signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._onButtonPress));

        //this._iconBox = new St.Bin({ style_class: 'icon-box',
        //                             important: true });
        this._iconBox = new St.Group();
        this._iconBin = new St.Bin({ name: "appMenuIcon",
                                     x_align: St.Align.MIDDLE,
                                     y_align: St.Align.MIDDLE
                                    });

        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;

        this.icon = this._getIconActor();
        this._iconBin.set_child(this.icon);

        let panelHeight = this._applet._panelHeight;
        let iconSize = this._applet.getPanelIconSize(St.IconType.FULLCOLOR);
         if ((panelHeight - iconSize) & 1) {
           panelHeight--;
         }
        this._iconBin.natural_width = panelHeight;
        this._iconBin.natural_height = panelHeight;

        this._iconBox.add_actor(this._iconBin);

        // Build up the window count number badge
        this._labelNumberBox = new St.BoxLayout();
        this._labelNumberBin = new St.Bin({
           important: true,
           style_class: "grouped-window-list-badge",
           x_align: St.Align.MIDDLE,
           y_align: St.Align.MIDDLE});
        this._labelNumber = new St.Label({
           style_class: "grouped-window-list-number-label"});
        this._iconBox.add_actor(this._labelNumberBox);
        this._labelNumberBox.add_actor(this._labelNumberBin);
        this._labelNumberBin.add_actor(this._labelNumber);
        this._labelNumberBox.hide();

        // Window tracking data
        this._windows = [];
        this._currentWindow = null;

        //log( "Calling _updateOrientation from constructor!" );
        //var err = new Error();
        //log( "Stack:\n"+err.stack );

        this._updateOrientation();

        this._signals.connect(this._iconBox, 'style-changed',
                              Lang.bind(this, this._updateIconSize));
        this._signals.connect(this._iconBox, 'notify::allocation',
                              Lang.bind(this, this._updateIconSize));

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._contextMenu = new PanelAppLauncherMenu(this, orientation);
        this._signals.connect(this._contextMenu.remove_item, 'activate', (actor, event) => launchersBox.confirmRemoveApplet(event));

        this._menuManager.addMenu(this._contextMenu);

        this.menu = null;  // The ThumbnailMenu

        let tooltipText = this.isCustom() ? appinfo.get_name() : app.get_name();
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText, orientation);
        this._tooltip.preventShow = !this.settings.getValue("show-tooltips");

        this._dragging = false;
        this._draggable = DND.makeDraggable(this.actor);

        this._signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));

        this._updateInhibit();
        //this._signals.connect(this.settings, "changed::show-tooltips", this._updateTooltip, this);
        this._signals.connect(this.launchersBox, 'launcher-draggable-setting-changed', Lang.bind(this, this._updateInhibit));
        this._signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._updateInhibit));
        this._signals.connect(this.actor, "scroll-event", this._onScrollEvent, this);
        this._signals.connect(this.actor, "enter-event", this._onEnterEvent, this);
        this._signals.connect(this.actor, "leave-event", this._onLeaveEvent, this);
    }

    _updateTooltip(){
       let showTooltips = this.settings.getValue("show-tooltips");
       let showMenuOnHover = this.settings.getValue("menu-show-on-hover");
       if (showTooltips && (!showMenuOnHover || this._windows.length === 0)){
          this._tooltip.preventShow = false
       } else {
          this._tooltip.preventShow = true
       }
    }

    _onEnterEvent() {
       let curMenu = this._applet.currentMenu;
       if (curMenu && curMenu != this.menu && curMenu.isOpen) {
          let holdPopup = this._applet.holdPopup;
          this.closeThumbnailMenu();
          this.openThumbnailMenu();
          this._applet.holdPopup = holdPopup;
       } else if (this._windows.length > 0 && this.settings.getValue("menu-show-on-hover")) {
          this.openThumbnailMenuDelayed();
       }
    }

    _onLeaveEvent() {
       let curMenu = this._applet.currentMenu;
       if (curMenu) {
          this.closeThumbnailMenuDelayed();
       } else {
          this.removeThumbnailMenuDelay()
       }
    }

    // zoom in and out the preview menu based on the movement of the mouse scroll wheel
    _onScrollEvent(actor, event) {
        let wheelSetting = this.settings.getValue("wheel-adjusts-preview-size");
        if (wheelSetting===ScrollWheelAction.Off || !this.menu || !this.menu.isOpen) {
           return;
        }
        let numThumbs = this.menu.numThumbs;
        let direction = event.get_scroll_direction();
        if (numThumbs > this.menu.numMenuItems && numThumbs > 2 && direction == 0 /*UP*/) {
           numThumbs -= 0.5;
        } else if (numThumbs < 15 && direction == 1 /*Down*/){
           numThumbs += 0.5;
        } else {
           return;
        }
        this.menu.numThumbs = numThumbs;
        this.menu.recalcItemSizes();
        if (wheelSetting===ScrollWheelAction.OnGlobal) {
           this._applet.thumbnailSize = numThumbs;
        }
    }

    findMostRecentlyUsedWindow(){
       let window = null;
       let time = Number.MAX_SAFE_INTEGER;
       for( let idx=0 ; idx < this._windows.length ; idx++ ){
          if (this._windows[idx].get_user_time() < time) {
             window  = this._windows[idx];
             time = this._windows[idx].get_user_time();
          }
       }
       return(window);
    }

    workspaceChanged(wsWindows) {
       this.dspNumber = this.settings.getValue("display-number");
       this._windows = [];
       let windowCnt = 0;
       if (this.menu) {
          this.menu.removeAll();
          this._applet.thumbnailMenuManager.removeMenu(this.menu);
       }
       //log( `Looking for ${this.app.get_id()}` );
       for ( let idx=0 ; idx < wsWindows.length ; idx++ ){
          let app = this.launchersBox._windowTracker.get_window_app(wsWindows[idx]);
          if (!app) {
             app = this.launchersBox._windowTracker.get_app_from_pid(wsWindows[idx].get_pid());
          }
          if (Main.isInteresting(wsWindows[idx]) && app === this.app) {
             windowCnt++;
             if (windowCnt === 1){
                this.menu = new ThumbnailMenu(this);
                this._applet.thumbnailMenuManager.addMenu(this.menu);
             }
             this._windows.push(wsWindows[idx]);
             this.menu.addWindow(wsWindows[idx]);
          }
       }
       this._currentWindow = this.findMostRecentlyUsedWindow();
       this._updateTooltip();
       if (windowCnt > 0) {
           this.actor.add_style_pseudo_class("active");
       } else {
           this.actor.remove_style_pseudo_class("active");
       }
       if ((this.dspNumber === DisplayNumber.All && windowCnt >= 1) || (this.dspNumber === DisplayNumber.Smart && windowCnt >= 2)) {
           this._labelNumber.set_text(windowCnt.toString());
           this._labelNumberBox.show();
           let [width, height] = this._labelNumber.get_size();
           let size = Math.max(width, height);
           this._labelNumberBin.width = size;
           this._labelNumberBin.height = size;
       } else {
          this._labelNumberBox.hide();
       }
    }

    windowAdded(metaWindow) {
        this._windows.push(metaWindow);
        let windowCnt = this._windows.length;
        if (windowCnt === 1){
           this.menu = new ThumbnailMenu(this);
           this._applet.thumbnailMenuManager.addMenu(this.menu);
           this._updateTooltip();
        }
        if (this._applet.currentMenu === this.menu) {
           this.closeThumbnailMenu();
        }
        this.menu.addWindow(metaWindow);
        this.actor.add_style_pseudo_class("active");
        if (this.dspNumber === DisplayNumber.All || (this.dspNumber === DisplayNumber.Smart && windowCnt >= 2)) {
            this._labelNumber.set_text(windowCnt.toString());
        }
        if ((this.dspNumber === DisplayNumber.All && windowCnt === 1) || (this.dspNumber === DisplayNumber.Smart && windowCnt === 2)) {
           this._labelNumberBox.show();
           let [width, height] = this._labelNumber.get_size();
           let size = Math.max(width, height);
           this._labelNumberBin.width = size;
           this._labelNumberBin.height = size;
        }
        this._signals.connect(metaWindow, "workspace-changed", this._applet._onWindowWorkspaceChanged, this);

    }

    windowRemoved(metaWindow) {
        let idx = this._windows.indexOf(metaWindow);
        this._windows.splice(idx, 1);
        let windowCnt = this._windows.length;
        this.menu.removeWindow(metaWindow);
        if (windowCnt === 0) {
           this.actor.remove_style_pseudo_class("active");
           this.actor.remove_style_pseudo_class("focus" );
           this._applet.thumbnailMenuManager.removeMenu(this.menu);
           this.menu.destroy();
           this.menu= null;
           this._updateTooltip();
        }
        if (metaWindow === this._currentWindow) {
           this._currentWindow = this.findMostRecentlyUsedWindow()
        }
        if ((this.dspNumber === DisplayNumber.All && windowCnt >= 1) || (this.dspNumber === DisplayNumber.Smart && windowCnt >= 2)) {
            this._labelNumber.set_text(windowCnt.toString());
        } else {
            this._labelNumberBox.hide();
        }
        this._signals.disconnect("workspace-changed", metaWindow);
    }

    _onDragBegin() {
        this._dragging = true;
        this._tooltip.hide();
        this._tooltip.preventShow = true;
        this.actor.set_hover(false);
    }

    _onDragEnd(source, time, success) {
        this._dragging = false;
        this._tooltip.preventShow = false;
        this.actor.sync_hover();
        if (!success)
            this.launchersBox._clearDragPlaceholder();
    }

    _updateInhibit() {
        let editMode = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
        this._draggable.inhibit = !this.launchersBox.allowDragging || editMode;
        this.actor.reactive = !editMode;
    }

    getDragActor() {
        return this._getIconActor();
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.icon;
    }

    _getIconActor() {
        if (this.isCustom()) {
            let icon = this.appinfo.get_icon();
            if (icon == null)
                icon = new Gio.ThemedIcon({name: "gnome-panel-launcher"});
            return new St.Icon({gicon: icon, icon_size: this.icon_size, icon_type: St.IconType.FULLCOLOR});
        } else {
            return this.app.create_icon_texture(this.icon_size);
        }
    }

    _animateIcon(step) {
        if (step >= 3) return;
        this.icon.set_pivot_point(0.5, 0.5);
        Tweener.addTween(this.icon,
                         { scale_x: 0.7,
                           scale_y: 0.7,
                           time: 0.2,
                           transition: 'easeOutQuad',
                           onComplete() {
                               Tweener.addTween(this.icon,
                                                { scale_x: 1.0,
                                                  scale_y: 1.0,
                                                  time: 0.2,
                                                  transition: 'easeOutQuad',
                                                  onComplete() {
                                                      this._animateIcon(step + 1);
                                                  },
                                                  onCompleteScope: this
                                                });
                           },
                           onCompleteScope: this
                         });
    }

    launch(offload=false) {
        if (this.isCustom()) {
            this.appinfo.launch([], null);
        } else {
            if (offload) {
                try {
                    this.app.launch_offloaded(0, [], -1);
                } catch (e) {
                    logError(e, "Could not launch app with dedicated gpu: ");
                }
            } else {
                this.app.open_new_window(-1);
            }
        }
        this._animateIcon(0);
    }

    launchAction(name) {
        this.getAppInfo().launch_action(name, null);
        this._animateIcon(0);
    }

    getId() {
        if (this.isCustom()) return Gio.file_new_for_path(this.appinfo.get_filename()).get_basename();
        else return this.app.get_id();
    }

    isCustom() {
        return (this.app==null);
    }

    _onButtonPress(actor, event) {
        if (this._contextMenu.isOpen) {
            this._contextMenu.toggle();
        }
        pressLauncher = this; //this.getAppname();
        let mouseBtn = event.get_button(); 
        if (mouseBtn == 2) {
           let action = this.settings.getValue("middle-click");
           if (action == MouseAction.PreviewHold) {
              this.openThumbnailMenu();
              this._applet.holdPopup = 2;
           }
        } else if (mouseBtn == 8) {
           let action = this.settings.getValue("back-click");
           if (action == MouseAction.PreviewHold) {
              this.openThumbnailMenu();
              this._applet.holdPopup = 8;
           }
        } else if (mouseBtn == 9) {
           let action = this.settings.getValue("forward-click");
           if (action == MouseAction.PreviewHold) {
              this.openThumbnailMenu();
              this._applet.holdPopup = 9;
           }
        }
    }

    _onButtonRelease(actor, event) {
        let button = event.get_button();
        if (button==1) { // Left Button
            let leftActionGrouped = this.settings.getValue("grouped-left-click");
            if (this._currentWindow === null) {
               this.closeThumbnailMenu();
               this.launch();
            } else if (this._windows.length > 1 && leftActionGrouped != LeftClickGrouped.Toggle) {
               //let thumbnailOnClick = this.settings.getValue("menu-show-on-click");
               if (leftActionGrouped === LeftClickGrouped.Thumbnail ){
                  if (this.menu.isOpen === false) {
                     this.openThumbnailMenu();
                  } else {
                     this.closeThumbnailMenu();
                  }
               } else if (leftActionGrouped === LeftClickGrouped.Cycle) {
                  if ( hasFocus(this._currentWindow)) {
                     for( let idx=0 ; idx < this._windows.length ; idx++ ) {
                        if (this._windows[idx] === this._currentWindow) {
                           this.closeThumbnailMenu();
                           if (idx === this._windows.length-1) {
                              Main.activateWindow(this._windows[0]);
                           } else {
                              Main.activateWindow(this._windows[idx+1]);
                           }
                           break;
                        }
                     }
                  } else {
                     this.closeThumbnailMenu();
                     Main.activateWindow(this._currentWindow);
                  }
               }
            } else {
               if (hasFocus(this._currentWindow) && this._currentWindow.minimized===false) {
                  this._currentWindow.minimize();
               } else {
                  this.closeThumbnailMenu();
                  Main.activateWindow(this._currentWindow);
               }
            }
        } else if (button==2) { // Middle Button
            let action = this.settings.getValue("middle-click");
            this._performMouseAction(action, this._currentWindow);
        } else if (button==3) { // Right Button
            this._contextMenu.toggle();
        } else if (button==8) { // Back Button
            let action = this.settings.getValue("back-click");
            this._performMouseAction(action, this._currentWindow);
        } else if (button==9) { // Forward Button
            let action = this.settings.getValue("forward-click");
            this._performMouseAction(action, this._currentWindow);
        }
    }

    // Perform the action defined by the passed in action integer
    _performMouseAction(action, window) {
        switch (action) {
           case MouseAction.Preview:
              let curMenu = this._applet.currentMenu;
              if (curMenu) {
                 this.closeThumbnailMenu();
              } else {
                 this.openThumbnailMenu();
              }
              break;
           case MouseAction.PreviewHold:
              this.closeThumbnailMenu();
              break;
           case MouseAction.Close:
              if (window)
                 window.delete(global.get_current_time());
              break;
           case MouseAction.Minimize:
              if (window) {
                 if (window.minimized===false) {
                    window.minimize();
                 } else {
                   this.closeThumbnailMenu();
                   Main.activateWindow(window); 
                 }
              }
              break;
           case MouseAction.Maximize:
              if (window) {
                 if (window.get_maximized()) {
                    window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL)
                 } else {
                    window.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
                 }
              }
              break;
           case MouseAction.New:
              this.launch();
              break;
           case MouseAction.MoveWorkspace1:
              if (window) {
                 if (this.menu != undefined) this.menu.removeWindow(window);
                 window.change_workspace_by_index(0, false, 0);
              }
              break;
           case MouseAction.MoveWorkspace2:
              {
                 let nWorkspaces = global.screen.get_n_workspaces();
                 if (window && nWorkspaces <= 2) {
                    if (this.menu != undefined) this.menu.removeWindow(window);
                       window.change_workspace_by_index(1, false, 1);
                 }
              }
              break;
           case MouseAction.MoveWorkspace3:
              {
                 let nWorkspaces = global.screen.get_n_workspaces();
                 if (window && nWorkspaces <= 3)
                    if (this.menu != undefined) this.menu.removeWindow(window);
                    window.change_workspace_by_index(2, false, 0);
              }
              break;
           case MouseAction.MoveWorkspace4:
              {
                 let nWorkspaces = global.screen.get_n_workspaces();
                 if (window && nWorkspaces <= 4)
                    if (this.menu != undefined) this.menu.removeWindow(window);
                    window.change_workspace_by_index(3, false, 0);
              }
              break;
           case MouseAction.WS_Visibility:
              if (window.is_on_all_workspaces()) {
                 window.unstick();
              } else {
                 window.stick();
              }
              break;
        }
    }

    _updateIconSize() {
        //log( `CPL IconSize: pannelHeigth: ${this.launchersBox._panelHeight}  iconSize: ${this.icon.get_icon_size()}` );
        if (this.icon.get_icon_size() > this.launchersBox._panelHeight - 2)
           this.icon.set_icon_size(this.launchersBox._panelHeight - 2);
    }

   _updateOrientation() {
      //log( `in _updateOrientation for app ${this.app.get_name()} with ${this._windows.length} windows` )
      //var err = new Error();
      //log( "Stack:\n"+err.stack );
      this.actor.remove_style_class_name("top");
      this.actor.remove_style_class_name("bottom");
      this.actor.remove_style_class_name("left");
      this.actor.remove_style_class_name("right");
      switch (this.orientation) {
         case St.Side.LEFT:
            this.actor.add_style_class_name("left");
            this.actor.set_style("margin: 0px; padding: 0px; margin-top: 2px; margin-bottom: 2px;");
            break;
         case St.Side.RIGHT:
            this.actor.add_style_class_name("right");
            this.actor.set_style("margin: 0px; padding: 0px; margin-top: 2px; margin-bottom: 2px;");
            break;
         case St.Side.TOP:
            this.actor.add_style_class_name("top");
            this.actor.set_style("margin: 0px; padding: 0px; margin-left: 2px; margin-right: 2px;");
            break;
         case St.Side.BOTTOM:
            this.actor.add_style_class_name("bottom");
            this.actor.set_style("margin: 0px; padding: 0px; margin-left: 2px; margin-right: 2px;");
            break;
      }
   }

    getAppInfo() {
        return (this.isCustom() ? this.appinfo : this.app.get_app_info());
    }

    getCommand() {
        return this.getAppInfo().get_commandline();
    }

    //getAppname() {
    //    return this.getAppInfo().get_name();
    //}

    getIcon() {
        let icon = this.getAppInfo().get_icon();
        if (icon) {
            if (icon instanceof Gio.FileIcon) {
                return icon.get_file().get_path();
            }
            else {
                return icon.get_names().toString();
            }
        }
        return null;
    }

    openThumbnailMenu(){
        if (this._windows.length > 0 && !this._contextMenu.isOpen) {
           this.removeThumbnailMenuDelay();
           this.menu.openMenu();
           this._applet.currentMenu = this.menu;
        }
    }

    openThumbnailMenuDelayed(){
        if (!this._contextMenu.isOpen) {
           this.removeThumbnailMenuDelay();
           this._applet._delayId = Mainloop.timeout_add(this.settings.getValue("preview-timeout-show"), Lang.bind(this, this.openThumbnailMenu));
        }
    }

    closeThumbnailMenu(){
        this._applet.closeThumbnailMenu();
    }

    closeThumbnailMenuDelayed(){
        this.removeThumbnailMenuDelay();
        this._applet._delayId = Mainloop.timeout_add(this.settings.getValue("preview-timeout-hide"), Lang.bind(this, this.closeThumbnailMenu));
    }

    removeThumbnailMenuDelay(){
        this._applet.removeThumbnailMenuDelay();
    }

    destroy() {
        for (let idx=this._windows.length ; idx > 0 ; idx--) {
           this.windowRemoved(this._windows[idx]);
        }
        this._signals.disconnectAllSignals();
        this._contextMenu.destroy();
        this._menuManager.destroy();
        this.closeThumbnailMenu();
        if (this.menu) {
           this._applet.thumbnailMenuManager.removeMenu(this.menu);
           this.menu.destroy();
        }
        this.icon.destroy();
        this._iconBin.destroy();
        this._iconBox.destroy();
        this._labelNumberBin.destroy();
        this._labelNumberBox.destroy();
        this._tooltip.destroy();
        this.actor.destroy();
    }
}

// holds launchers and contains DND functionality, instead of the
// applet actor handling DND so that we don't have to apply extra
// transformations to do hit testing. dnd methods get event coords
// pre-transformed to be actor-relative.
class LaunchersBox {
    constructor(applet) {
        this.actor = new St.BoxLayout({ style_class: 'panel-launchers', important: true });
        this.actor._delegate = this;
        this.actor.connect("destroy", () => this._destroy());

        this.applet = applet;
        this._dragAnimating = false;
        this._dragPlaceholder = null;
        this._dragTargetIndex = null;
        this._dragLocalOriginInfo = null;
    }

    _createDragPlaceholder(index, skipAnimation=false) {
        if (this._dragPlaceholder)
            return;

        let vertical = this.applet.orientation == St.Side.LEFT || this.applet.orientation == St.Side.RIGHT;
        this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
        let placeholderSize = vertical ? [1, this.applet.icon_size * global.ui_scale] : [this.applet.icon_size * global.ui_scale, 1];
        this._dragPlaceholder.child.set_size(...placeholderSize);
        this.actor.insert_child_at_index(this._dragPlaceholder.actor, index);

        if (!skipAnimation) {
            this._dragAnimating = true;
            this._dragPlaceholder.animateIn(() => this._dragAnimating = false);
        }
    }

    // this resets drag placeholder and local drag state but is also used by DND so we can't rename it
    _clearDragPlaceholder(skipAnimation=false) {
        if (this._dragLocalOriginInfo != null) {
            this.actor.set_child_at_index(this._dragLocalOriginInfo.actor, this._dragLocalOriginInfo.index);
        }

        if (this._dragPlaceholder) {
            if (skipAnimation) {
                this._dragPlaceholder.actor.destroy();
            } else {
                this._dragAnimating = true;
                this._dragPlaceholder.animateOutAndDestroy(() => this._dragAnimating = false);
            }
        }

        this._dragPlaceholder = null;
        this._dragLocalOriginInfo = null;
        this._dragTargetIndex = null;
    }

    handleDragOver(source, actor, x, y, time) {
        let isLauncher = source instanceof DND.LauncherDraggable;
        // don't present drop if the source isn't an app/launcher type, or if a drag hover
        // was just cancelled and we are still animating out a placeholder
        if (!(source.isDraggableApp || isLauncher) ||
            (!this._dragPlaceholder && this._dragAnimating)) {
            return DND.DragMotionResult.NO_DROP;
        }

        let originalIndex = this.applet._launchers.indexOf(source);

        let vertical = this.applet.orientation == St.Side.LEFT || this.applet.orientation == St.Side.RIGHT;
        let boxSize = vertical ? this.actor.height : this.actor.width;
        let mPos = vertical ? y : x;
        let children = this.actor.get_children();

        if(!vertical && St.Widget.get_default_direction () === St.TextDirection.RTL) //in RTL the dropIndex should be reversed
            mPos = boxSize - mPos;

        let dropIndex = Math.floor(mPos / boxSize * children.length);

        // -1 is end, 0 is start
        if (dropIndex >= children.length)
            dropIndex = -1;
        else if (dropIndex < -1)
            dropIndex = 0;

        if (this._dragTargetIndex != dropIndex) {
            if (originalIndex > -1) {
                // local drag without placeholder
                if (!this._dragLocalOriginInfo)
                    this._dragLocalOriginInfo = { actor: source.actor, index: originalIndex };
                this.actor.set_child_at_index(source.actor, dropIndex);
                this._dragTargetIndex = dropIndex;
            } else if (!this._dragAnimating) {
                // if we are already showing a placeholder (animate in) we don't update and
                // just return the correct DragMotionType, otherwise we create/set position
                if (!this._dragPlaceholder) {
                    // animates in a new placeholder
                    this._createDragPlaceholder(dropIndex);
                } else {
                    this.actor.set_child_at_index(this._dragPlaceholder.actor, dropIndex);
                }
                this._dragTargetIndex = dropIndex;
            }
        }

        if (isLauncher)
            return DND.DragMotionResult.MOVE_DROP;

        return DND.DragMotionResult.COPY_DROP;
    }

    handleDragOut() {
        this._clearDragPlaceholder();
    }

    acceptDrop(source, actor, x, y, time) {
        let isLauncher = source instanceof DND.LauncherDraggable;
        if (this._dragTargetIndex == null || !(source.isDraggableApp || isLauncher)) {
            // this _should_ be a no-drop-eligibility case only with no existing state, but just in
            this._clearDragPlaceholder(true);
            return false;
        }

        let dropIndex = this._dragTargetIndex;
        this._clearDragPlaceholder(true);

        if (this.applet._launchers.indexOf(source) != -1) {
            this.applet._reinsertAtIndex(source, dropIndex);
        } else {
            let sourceId;
            if (isLauncher) {
                sourceId = source.getId();
                source.launchersBox.removeLauncher(source, false);
            } else {
                sourceId = source.get_app_id();
            }
            this.applet.addForeignLauncher(sourceId, dropIndex, source);
        }

        actor.destroy();
        return true;
    }

    _destroy() {
        this.actor._delegate = null;
        this.actor.destroy();
        this.actor = null;
        this.applet = null;
    }
}

class CassiaPanelLaunchersApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.actor.set_track_hover(false);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.orientation = null;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) -2;

        // LaunchersBox() handles DND. This would be cleaner as a BoxLayout class but
        // would also add pointless overhead.
        this.launchersBox = new LaunchersBox(this);
        this.myactor = this.launchersBox.actor;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("launcherList", "launcherList", this._reload);
        this.settings.bind("allow-dragging", "allowDragging", this._updateLauncherDrag);

        this._signalManager = new SignalManager.SignalManager(null);
        this._windowTracker = Cinnamon.WindowTracker.get_default();

        this.uuid = metadata.uuid;

        this._settings_proxy = [];
        this._launchers = [];

        this.actor.add(this.myactor);
        this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        this.do_gsettings_import();

        this.thumbnailMenuManager = new ThumbnailMenuManager(this);

        this.on_orientation_changed(orientation);

        this.currentMenu = undefined; // The currently open Thumbnail menu
        this.currentFocus = null;
    }

    lookupLauncherForApp(app) {
        for ( let idx=0 ; idx < this._launchers.length ; idx++ ) {
            if (this._launchers[idx].app === app) {
                return(this._launchers[idx]);
            }
        }
        return(null);
    }

    lookupLauncherForWindow(metaWindow) {
       for ( let idx=0 ; idx < this._launchers.length ; idx++ ) {
          if ( this._launchers[idx]._windows.indexOf(metaWindow) != -1 ) {
             return(this._launchers[idx]);
          }
       }
    }

    on_applet_added_to_panel() {
        this._signalManager.connect(global.window_manager, "switch-workspace", this._updateCurrentWorkspace, this);
        this._signalManager.connect(this._windowTracker, "notify::focus-app", this._updateFocus, this);
        this._signalManager.connect(global.screen, "workspace-added", this._onWorkspaceAdded, this);
        this._signalManager.connect(global.screen, "workspace-removed", this._onWorkspaceRemoved, this);
        this._signalManager.connect(global.screen, "window-added", this._windowAdded, this);
        this._signalManager.connect(global.screen, "window-removed", this._windowRemoved, this);
        this._signalManager.connect(global.screen, "window-monitor-changed", this._windowMonitorChanged, this);
        this._signalManager.connect(Main.layoutManager, "monitors-changed", this._updateMonitor, this);
        this._signalManager.connect(this.settings, "changed::display-number", this._updateCurrentWorkspace, this);
        this._updateCurrentWorkspace();
        this._registerExistingWindows();
        this.updateCassiaWindowList();
    }

    updateCassiaWindowList(){
        let applets = AppletManager.getRunningInstancesForUuid("CassiaWindowList@klangman");
        for (let i=0 ; i < applets.length ; i++) {
           applets[i].cassiaPanelLaunchersUpdate();
        }
    }

    on_applet_removed_from_panel() {
       this._signalManager.disconnectAllSignals();
    }

    _registerExistingWindows(){
       let nWorkspaces = global.screen.get_n_workspaces();
       for (let wsIdx=0 ; wsIdx < nWorkspaces ; wsIdx++) {
          let ws = global.screen.get_workspace_by_index(wsIdx);
          let wsWindows = ws.list_windows();
          for ( let idx=0 ; idx < wsWindows.length ; idx++ ) {
             this._signalManager.connect(wsWindows[idx], "workspace-changed", this._onWindowWorkspaceChanged, this);
          }
       }
    }

    _updateFocus(){
        let window = global.display.get_focus_window();
        if (window) {
           let launcher = this.lookupLauncherForWindow(window);
           if (this.currentFocus && this.currentFocus != launcher)
              this.currentFocus.actor.remove_style_pseudo_class("focus");
           this.currentFocus = launcher;
           if (launcher) {
              launcher._currentWindow = window;
              launcher.actor.add_style_pseudo_class("focus");
           }
        }
    }

    _updateCurrentWorkspace() {
       let curWorkspaceIdx = global.screen.get_active_workspace_index();
       let ws = global.screen.get_workspace_by_index(curWorkspaceIdx);
       let wsWindows = ws.list_windows();
       for ( let idx=0 ; idx < this._launchers.length ; idx++ ) {
          this._launchers[idx].workspaceChanged(wsWindows);
       }
       this._updateFocus();
    }

    _onWorkspaceAdded(screen, wsNum) {
        //log( "_onWorkspaceAdded" );
    }

    _onWorkspaceRemoved(screen, wsNum) {
        //log( "_onWorkspaceRemoved" );
    }

    _windowAdded(screen, metaWindow, monitor) {
        if (!Main.isInteresting(metaWindow)) {
           return;
        }
        let app = this._windowTracker.get_window_app(metaWindow);
        if (!app) {
           app = this._windowTracker.get_app_from_pid(metaWindow.get_pid());
        }
        let launcher = this.lookupLauncherForApp(app);
        if (launcher) {
           launcher.windowAdded(metaWindow);
        }
        this._signalManager.connect(metaWindow, "workspace-changed", this._onWindowWorkspaceChanged, this);
    }

    _windowRemoved(screen, metaWindow, monitor) {
        let launcher = this.lookupLauncherForWindow(metaWindow);
        if (launcher) {
           this._signalManager.disconnect("workspace-changed", metaWindow);
           launcher.windowRemoved(metaWindow);
        }
    }

    _onWindowWorkspaceChanged(window, wsNum) {
       let currentWs = global.screen.get_active_workspace_index();
       let launcher = this.lookupLauncherForWindow(window);
       if (launcher) {
          if (wsNum === currentWs) {
             // Window removed from workspace
             launcher.windowRemoved(window);
          } else {
             // Window added to workspace
             launcher.windowAdded(window);
          }
       }
    }

    _windowMonitorChanged(screen, window, monitor) {
        //log( "windowMonitorChanged" );
    }

    _updateMonitor() {
        //log( "_updateMonitor" );
    }

    _updateLauncherDrag() {
        this.emit("launcher-draggable-setting-changed");
    }

    do_gsettings_import() {
        let old_launchers = global.settings.get_strv(PANEL_LAUNCHERS_KEY);
        if (old_launchers.length >= 1 && old_launchers[0] != "DEPRECATED") {
            this.launcherList = old_launchers;
        }

        global.settings.set_strv(PANEL_LAUNCHERS_KEY, ["DEPRECATED"]);
    }

    _onPanelEditModeChanged() {
        this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
    }

    sync_settings_proxy_to_settings() {
        this.settings.unbind("launcherList");
        this.launcherList = this._settings_proxy.map(x => x.file);
        this.settings.setValue("launcherList", this.launcherList);
        this.settings.bind("launcherList", "launcherList", this._reload);
        this.updateCassiaWindowList();
    }

    _remove_launcher_from_proxy(visible_index) {
        let j = -1;
        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].valid) {
                j++;
                if (j == visible_index) {
                    this._settings_proxy.splice(i, 1);
                    break;
                }
            }
        }
    }

    _move_launcher_in_proxy(launcher, new_index) {
        let proxy_member;
        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].launcher == launcher) {
                proxy_member = this._settings_proxy.splice(i, 1)[0];
                break;
            }
        }

        if (!proxy_member)
            return;

        this._insert_proxy_member(proxy_member, new_index);
    }

    _insert_proxy_member(member, visible_index) {
        if (visible_index == -1) {
            this._settings_proxy.push(member);
            return;
        }

        let j = -1;
        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].valid) {
                j++;
                if (j == visible_index) {
                    this._settings_proxy.splice(i, 0, member);
                    return;
                }
            }
        }

        if (visible_index == j + 1)
            this._settings_proxy.push(member);
    }

    _loadLauncher(path) {
        let appSys = Cinnamon.AppSystem.get_default();
        let app = appSys.lookup_app(path);
        let appinfo = null;
        if (!app) {
            appinfo = CMenu.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH+"/"+path);
            if (!appinfo) {
                global.logWarning(`Failed to add launcher from path: ${path}`);
                return null;
            }
        }
        return new PanelAppLauncher(this, app, appinfo, this.orientation, this.icon_size);
    }

    on_panel_height_changed() {
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);
        this._reload();
    }

    on_panel_icon_size_changed(size) {
        this.icon_size = size;
        this._reload();
    }

    on_orientation_changed(neworientation) {
        if (this.orientation != neworientation) {
           this.orientation = neworientation;
           if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
               this.myactor.remove_style_class_name('vertical');
               this.myactor.set_vertical(false);
               this.myactor.set_x_expand(false);
               this.myactor.set_y_expand(true);
           } else {
               this.myactor.add_style_class_name('vertical');
               this.myactor.set_vertical(true);
               this.myactor.set_x_expand(true);
               this.myactor.set_y_expand(false);
           }
           this._reload();
        }
    }

    _reload() {
        //var err = new Error();
        //log( "Stack:\n"+err.stack );
        //let startTime = Date.now();
        this._launchers.forEach(l => l.destroy());
        this._launchers = [];
        this._settings_proxy = [];

        for (let file of this.launcherList) {
            let launcher = this._loadLauncher(file);
            let proxyObj = { file: file, valid: false, launcher: null };
            if (launcher) {
                this.myactor.add(launcher.actor);
                this._launchers.push(launcher);
                proxyObj.valid = true;
                proxyObj.launcher = launcher;
            }
            this._settings_proxy.push(proxyObj);
        }
        this._updateCurrentWorkspace();
        //let endTime = Date.now();
        //log(`Call to _reload took ${endTime - startTime} milliseconds`)
    }

    removeLauncher(launcher, delete_file) {
        let i = this._launchers.indexOf(launcher);
        if (i >= 0) {
            launcher.destroy();
            this._launchers.splice(i, 1);
            this._remove_launcher_from_proxy(i);
        }
        if (delete_file) {
            let appid = launcher.getId();
            let file = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH+"/"+appid);
            if (file.query_exists(null)) file.delete(null);
        }

        this.sync_settings_proxy_to_settings();
    }

    acceptNewLauncher(path) {
        this.addForeignLauncher(path, -1);
    }

    addForeignLauncher(path, position) {
        let newLauncher = this._loadLauncher(path);
        if (!newLauncher)
            return;

        this.myactor.insert_child_at_index(newLauncher.actor, position);
        this._launchers.splice(position, 0, newLauncher);
        this._insert_proxy_member({ file: path, valid: true, launcher: newLauncher }, position);
        this.sync_settings_proxy_to_settings();
    }

    showAddLauncherDialog(timestamp, launcher){
        if (launcher) {
           // Create a new desktop file in ~/.local/share/applications/
           let desktopFullPath = launcher.app.get_app_info().get_filename();
           let id = launcher.getId();
           let desktopPath = desktopFullPath.slice(0, desktopFullPath.length-id.length);  // full path with the file name removed.
           Util.spawnCommandLine( "cinnamon-desktop-editor -m launcher -f " + launcher.getId() + " -o " + desktopPath + " -d " + EDITED_LAUNCHERS_PATH);
        } else {
            Util.spawnCommandLine("cinnamon-desktop-editor -mcinnamon-launcher " + this.settings.file.get_path());
        }
    }

    _reinsertAtIndex(launcher, newIndex) {
        let originalIndex = this._launchers.indexOf(launcher);
        if (originalIndex == -1)
            return;

        if (originalIndex != newIndex) {
            this.myactor.set_child_at_index(launcher.actor, newIndex);
            this._launchers.splice(originalIndex, 1);
            this._launchers.splice(newIndex, 0, launcher);
            this._move_launcher_in_proxy(launcher, newIndex);
            this.sync_settings_proxy_to_settings();
        }
    }

    // backwards compatibility passthrough method for launcher code expecting DND on applet
    _clearDragPlaceholder(skipAnimation=false) {
        this.launchersBox._clearDragPlaceholder(skipAnimation);
    }

    closeThumbnailMenu(){
       let menu = this.currentMenu; //this.menu;
       if (menu && menu.isOpen) {
          this.removeThumbnailMenuDelay();
          menu.closeMenu();
       }
       this.currentMenu = undefined;
    }

    removeThumbnailMenuDelay(){
       if (this._delayId) {
          let doIt = GLib.MainContext.default().find_source_by_id(this._delayId);
          if (doIt) {
             Mainloop.source_remove(this._delayId);
          }
          this._delayId = null;
       }
    }

    // An API that returns a list of applications that have buttons on this launcher applet
    getApplicationList(){
       let result = [];
       for ( let idx=0 ; idx < this._launchers.length ; idx++ ) {
          result.push(this._launchers[idx].app);
       }
       return(result);
    }
}
Signals.addSignalMethods(CassiaPanelLaunchersApplet.prototype);

function main(metadata, orientation, panel_height, instance_id) {
    return new CassiaPanelLaunchersApplet(metadata, orientation, panel_height, instance_id);
}
