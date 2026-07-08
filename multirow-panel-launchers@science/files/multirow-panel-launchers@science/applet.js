// Multi-Row Panel Launchers — Cinnamon applet
// Copyright (C) 2026 Steve Midgley
// Forked from panel-launchers@cinnamon.org, Copyright (C) the Linux Mint team
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version. See the LICENSE file for details.

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Signals = imports.signals;
const SignalManager = imports.misc.signalManager;
const Gettext = imports.gettext;

const Helpers = require('./helpers');

const UUID = 'multirow-panel-launchers@science';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

// Prefer this applet's translations; fall back to Cinnamon's domain for
// strings the stock applet already translates (Launch, Add, Remove, ...).
function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    if (translated !== str) return translated;
    return Gettext.gettext(str);
}

const PANEL_EDIT_MODE_KEY = 'panel-edit-mode';
const PANEL_LAUNCHERS_KEY = 'panel-launchers';

const COLUMN_SPACING = 2;          // FlowLayout column spacing (pixels)
const OVERFLOW_GRID_SPACING = 4;   // Overflow grid column/row spacing (pixels)
const OVERFLOW_GRID_COLS = 5;      // Columns in the overflow popup grid

// Launcher feedback styles MUST be geometry-neutral: every state declares the
// same border width, so hover/press never changes a launcher's preferred
// width. FlowLayout(homogeneous=true) pitches ALL cells from the widest child
// and the container width is explicit, so a single launcher gaining 2px of
// border rewraps the whole grid to one fewer column (icons clip off-panel).
const LAUNCHER_BASE_STYLE  = 'border: 1px solid transparent; border-radius: 4px;';
const LAUNCHER_HOVER_STYLE = 'border: 1px solid rgba(255,255,255,0.5); border-radius: 4px;';
const LAUNCHER_PRESS_STYLE = 'border: 1px solid rgba(255,255,255,0.8); border-radius: 4px; background-color: rgba(255,255,255,0.2);';

const CUSTOM_LAUNCHERS_PATH = GLib.get_user_data_dir() + "/cinnamon/panel-launchers/";
const OLD_CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers/';

let pressLauncher = null;

class PanelAppLauncherMenu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
        this._launcher = launcher;

        let appinfo = this._launcher.getAppInfo();

        this._actions = appinfo.list_actions();
        if (this._actions.length > 0) {
            for (let i = 0; i < this._actions.length; i++) {
                let actionName = this._actions[i];
                this.addAction(appinfo.get_action_name(actionName), Lang.bind(this, this._launchAction, actionName));
            }

            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        let item = new PopupMenu.PopupIconMenuItem(_("Launch"), "media-playback-start", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onLaunchActivate));
        this.addMenuItem(item);

        if (Main.gpu_offload_supported) {
            let item = new PopupMenu.PopupIconMenuItem(_("Run with dedicated GPU"), "cpu", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', Lang.bind(this, this._onLaunchOffloadedActivate));
            this.addMenuItem(item);
        }

        item = new PopupMenu.PopupIconMenuItem(_("Add"), "list-add", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onAddActivate));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Edit"), "document-properties", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onEditActivate));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove"), "window-close", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, this._onRemoveActivate));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Applet preferences"));
        this.addMenuItem(subMenu);

        item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher.launchersBox, this._launcher.launchersBox.openAbout));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher.launchersBox, this._launcher.launchersBox.configureApplet));
        subMenu.menu.addMenuItem(item);

        this.remove_item = new PopupMenu.PopupIconMenuItem(_("Remove '%s'").format(_("Multi-Row Panel Launchers")), "edit-delete", St.IconType.SYMBOLIC);
        subMenu.menu.addMenuItem(this.remove_item);
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

class PanelAppLauncher extends DND.LauncherDraggable {
    constructor(launchersBox, app, appinfo, orientation, icon_size) {
        super(launchersBox);
        this.app = app;
        this.appinfo = appinfo;
        this.orientation = orientation;
        this.icon_size = icon_size;

        this._signals = new SignalManager.SignalManager(null);

        this.actor = new St.Bin({ style_class: 'launcher',
                                  important: true,
                                  reactive: true,
                                  can_focus: true,
                                  x_fill: true,
                                  y_fill: true,
                                  track_hover: true });

        this.actor.set_easing_mode(Clutter.AnimationMode.EASE_IN_QUAD);
        this.actor.set_easing_duration(100);

        this.actor._delegate = this;
        this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonRelease));
        this._signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._onButtonPress));

        this._iconBox = new St.Bin({ style_class: 'icon-box',
                                     important: true });

        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;

        this.icon = this._getIconActor();
        this._iconBox.set_child(this.icon);

        this._signals.connect(this._iconBox, 'style-changed',
                              Lang.bind(this, this._updateIconSize));
        this._signals.connect(this._iconBox, 'notify::allocation',
                              Lang.bind(this, this._updateIconSize));

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this, orientation);
        this._signals.connect(this._menu.remove_item, 'activate', (actor, event) => launchersBox.confirmRemoveApplet(event));

        this._menuManager.addMenu(this._menu);

        let tooltipText = this.isCustom() ? appinfo.get_name() : app.get_name();
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText, orientation);

        this._dragging = false;
        this._draggable = DND.makeDraggable(this.actor);

        this._signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));

        this._updateInhibit();
        this._signals.connect(this.launchersBox, 'launcher-draggable-setting-changed', Lang.bind(this, this._updateInhibit));
        this._signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._updateInhibit));
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
        pressLauncher = this.getAppname();

        if (event.get_button() == 3)
            this._menu.toggle();
    }

    _onButtonRelease(actor, event) {
        if (pressLauncher == this.getAppname()){
            let button = event.get_button();
            if (button==1) {
                if (this._menu.isOpen) {
                    this._menu.toggle();
                } else {
                    this.launch();
                    // Close overflow popup if this launcher is inside it.
                    // launchersBox is the applet itself (see _loadLauncher).
                    if (this.launchersBox._overflowPanelOpen) {
                        this.launchersBox._closeOverflowPanel();
                    }
                }
            }
        }
    }

    _updateIconSize() {
        let node = this._iconBox.get_theme_node();
        let enforcedSize = 0;

        if (this._iconBox.height > 0) {
            enforcedSize = this._iconBox.height - node.get_vertical_padding();
        }
        else
        if (this._iconBox.width > 0) {
            enforcedSize = this._iconBox.width - node.get_horizontal_padding();
        }
        else
        {
            return; // allocation not valid yet — skip sizing
        }

        if (enforcedSize > 0 && enforcedSize < this.icon.get_icon_size()) {
            this.icon.set_icon_size(enforcedSize);
        }
    }

    getAppInfo() {
        return (this.isCustom() ? this.appinfo : this.app.get_app_info());
    }

    getCommand() {
        return this.getAppInfo().get_commandline();
    }

    getAppname() {
        return this.getAppInfo().get_name();
    }

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

    destroy() {
        this._signals.disconnectAllSignals();
        this._menu.destroy();
        this._menuManager.destroy();
        this.actor.destroy();
    }
}

// LaunchersBox: holds launchers and handles DND.
// Uses Clutter.Actor + FlowLayout for horizontal panels to support multi-row wrapping.
// DND methods receive event coords pre-transformed to actor-relative.
class LaunchersBox {
    constructor(applet, orientation) {
        let isHorizontal = (orientation == St.Side.TOP || orientation == St.Side.BOTTOM);

        let manager;
        if (isHorizontal) {
            manager = new Clutter.FlowLayout({
                orientation: Clutter.FlowOrientation.HORIZONTAL,
                homogeneous: true,
                column_spacing: COLUMN_SPACING,
                row_spacing: 0
            });
        } else {
            manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
        }

        this.manager = manager;
        this.actor = new Clutter.Actor({ layout_manager: manager, clip_to_allocation: true });
        this.actor._delegate = this;
        this.actor.connect("destroy", () => this._destroy());

        // Override FlowLayout's inflated min_width so the panel's _calcBoxSizes()
        // enters the proportional-sharing branch instead of squeezing panel zones.
        if (isHorizontal) {
            this.actor.min_width = 0;
        }

        this.applet = applet;
        this._dragPlaceholder = null;
        this._dragTargetIndex = null;
        this._dragLocalOriginInfo = null;
    }

    _clearDragPlaceholder(skipAnimation=false) {
        if (this._dragLocalOriginInfo != null) {
            this.actor.set_child_at_index(this._dragLocalOriginInfo.actor, this._dragLocalOriginInfo.index);
        }

        if (this._dragPlaceholder) {
            if (skipAnimation) {
                this._dragPlaceholder.actor.destroy();
            } else {
                this._dragPlaceholder.animateOutAndDestroy();
            }
        }

        this._dragPlaceholder = null;
        this._dragLocalOriginInfo = null;
        this._dragTargetIndex = null;
    }

    // 2D DND: find closest child using Euclidean distance to allocation centers.
    // Internal reorder only — no external drops from app menus.
    handleDragOver(source, actor, x, y, time) {
        if (!(source instanceof DND.LauncherDraggable)) {
            return DND.DragMotionResult.NO_DROP;
        }

        let originalIndex = this.applet._launchers.indexOf(source);
        let children = this.actor.get_children();

        // Find closest child by Euclidean distance to allocation center
        let dropIndex = 0;
        let minDist = -1;
        for (let i = 0; i < children.length; i++) {
            if (!children[i].visible) continue;
            let alloc = children[i].get_allocation_box();
            let cx = (alloc.x1 + alloc.x2) / 2;
            let cy = (alloc.y1 + alloc.y2) / 2;
            let dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
            if (dist < minDist || minDist === -1) {
                minDist = dist;
                dropIndex = i;
            }
        }

        if (dropIndex >= children.length)
            dropIndex = -1;

        if (this._dragTargetIndex != dropIndex) {
            if (originalIndex > -1) {
                // Local drag — move source actor directly
                if (!this._dragLocalOriginInfo)
                    this._dragLocalOriginInfo = { actor: source.actor, index: originalIndex };
                this.actor.set_child_at_index(source.actor, dropIndex);
                this._dragTargetIndex = dropIndex;
            }
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    handleDragOut() {
        this._clearDragPlaceholder();
    }

    // Internal reorder only — source must be one of our launchers
    acceptDrop(source, actor, x, y, time) {
        if (!(source instanceof DND.LauncherDraggable)) {
            this._clearDragPlaceholder(true);
            return false;
        }

        if (this._dragTargetIndex == null) {
            this._clearDragPlaceholder(true);
            return false;
        }

        let dropIndex = this._dragTargetIndex;
        this._clearDragPlaceholder(true);

        if (this.applet._launchers.indexOf(source) != -1) {
            this.applet._reinsertAtIndex(source, dropIndex);
        }

        return true;
    }

    _destroy() {
        this.actor._delegate = null;
        this.actor = null;
        this.applet = null;
    }
}

class CinnamonPanelLaunchersApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.actor.set_track_hover(false);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.orientation = orientation;

        this.signals = new SignalManager.SignalManager(null);

        this.launchersBox = new LaunchersBox(this, orientation);
        this.myactor = this.launchersBox.actor;

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("launcherList", "launcherList", this._reload);
        this.settings.bind("allow-dragging", "allowDragging", this._updateLauncherDrag);
        this.settings.bind("max-rows", "maxRows", this._onLayoutSettingsChanged);
        this.settings.bind("icon-size-override", "iconSizeOverride", this._onLayoutSettingsChanged);
        this.settings.bind("max-width", "maxWidth", this._onLayoutSettingsChanged);
        this.settings.bind("debug-logging", "debugLogging", null);

        this.uuid = metadata.uuid;

        this._settings_proxy = [];
        this._launchers = [];
        this._inAllocationUpdate = false;

        // Self-heal watchdog state (see _scheduleVerify / _verifyLayout).
        this._verifySourceId = 0;
        this._healing = false;
        this._verifyRetries = 0;
        this._colsMismatchRetries = 0; // separate from _verifyRetries

        // Telemetry transition caches (logged on change only).
        this._lastCellW = 0;
        this._lastContainerW = 0;
        this._lastSplitIndex = -2; // sentinel: differs from valid -1
        this._lastIconSize = 0;

        // Overflow popup state (horizontal panels only, when max-width clips launchers)
        this._overflowPanel = null;         // St.Bin on global.stage
        this._overflowPanelOpen = false;    // manual open/close tracking
        this._overflowModalPushed = false;  // pushModal active for input routing
        this._capturedEventId = 0;          // for click-outside handler
        this._overflowGrid = null;          // Clutter.Actor with FlowLayout
        this._overflowIndicator = null;     // St.Button (chevron, child of this.actor)
        this._overflowStartIndex = -1;      // -1 = no overflow

        this.actor.add(this.myactor);
        this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
        this.signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, this._onPanelEditModeChanged, this);

        // FlowLayout needs a width constraint to trigger wrapping.
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.signals.connect(this.actor, 'notify::allocation', this._onAllocationChanged, this);
        }

        this._recalcIconSize();

        this.do_gsettings_import();

        this.on_orientation_changed(orientation);
    }

    // Layout diagnostics, gated behind the debug-logging setting so the
    // shipped default stays quiet. State-transition telemetry only.
    _mrplLog(msg) {
        if (this.debugLogging) global.log(msg);
    }

    _recalcIconSize() {
        // Size icons for the rows the layout will actually produce, not the
        // configured maximum — 3 launchers with max-rows=3 render as ONE row,
        // and sizing for 3 rows both shrinks them needlessly and desyncs the
        // container width from FlowLayout's row-height-driven cell allocation.
        let count = this._launchers ? this._launchers.length : 0;
        let rows = Helpers.calcEffectiveRows(count, this.maxRows || 2);
        let override = this.iconSizeOverride || 0;
        // panelHeight can be 0 at constructor time on cold start (panel.height
        // is 0 until _setPanelHeight runs after AppletManager.appletsLoaded).
        // Fall back to the panel zone icon size, which is populated
        // synchronously during panel construction — independent of allocation.
        let zoneSize = this.getPanelIconSize(St.IconType.FULLCOLOR) || 0;
        let newSize = Helpers.calcIconSizeWithFallback(
            this._panelHeight, zoneSize, rows, override
        );
        if (newSize !== this._lastIconSize) {
            this._mrplLog('MRPL: icon_size ' + this._lastIconSize + '->' + newSize +
                ' panelH=' + this._panelHeight + ' zone=' + zoneSize +
                ' rows=' + rows + ' override=' + override);
            this._lastIconSize = newSize;
        }
        this.icon_size = newSize;
    }

    _onLayoutSettingsChanged() {
        this._recalcIconSize();
        this._reload();
    }

    _saveBackup() {
        try {
            let backup = {
                launcherList: this.launcherList,
                'max-rows': this.maxRows,
                'icon-size-override': this.iconSizeOverride,
                'max-width': this.maxWidth,
                'allow-dragging': this.allowDragging
            };
            let dir = this.settings.file.get_parent().get_path();
            let backupPath = dir + '/panel-launchers-backup.json';
            let contents = JSON.stringify(backup, null, 4) + '\n';
            let file = Gio.File.new_for_path(backupPath);
            let bytes = new GLib.Bytes(new TextEncoder().encode(contents));
            file.replace_contents_bytes_async(
                bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null,
                (f, res) => {
                    try {
                        f.replace_contents_finish(res);
                    } catch (e) {
                        global.logWarning('multirow-panel-launchers: backup save failed: ' + e);
                    }
                });
        } catch (e) {
            global.logWarning('multirow-panel-launchers: backup save failed: ' + e);
        }
    }

    // useMaxAcrossAll: when true, walk every launcher and take the largest
    // preferredW. FlowLayout(homogeneous=true) sizes its cells from the
    // widest child, so sampling _launchers[0] alone can undersize the
    // container and silently force one fewer rendered column. The healing
    // path (_verifyLayout cols mismatch) opts into this expensive scan.
    _getCellWidth(useMaxAcrossAll = false) {
        // Always return a positive width when we have launchers — otherwise
        // the container collapses, FlowLayout allocates children at h≈0, and
        // _updateIconSize ratchets the icon_size down to 1px. The watchdog
        // re-runs _updateContainerWidth after CSS resolves, so an oversized
        // fallback gets corrected on the next pass.
        if (this._launchers.length === 0) return 0;
        let [, natW] = this._launchers[0].actor.get_preferred_width(-1);
        if (useMaxAcrossAll) {
            for (let i = 1; i < this._launchers.length; i++) {
                let [, w] = this._launchers[i].actor.get_preferred_width(-1);
                if (w > natW) natW = w;
            }
        }
        return Helpers.pickCellWidth(this.icon_size, natW);
    }

    // Set the container to the content-based width so the panel zone
    // allocates proportionally and FlowLayout has an explicit width
    // for computing row heights (Cinnamon 6.0.4 FlowLayout quirk:
    // without explicit width, children get h=0).
    _updateContainerWidth(useMaxAcrossAll = false) {
        let isHorizontal = (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM);
        if (!isHorizontal) return;

        let count = this.myactor.get_n_children();
        if (count === 0) {
            this.myactor.set_width(-1);
            this.myactor.min_width = 0;
            return;
        }

        let cellW = this._getCellWidth(useMaxAcrossAll);
        if (cellW <= 0) return; // no launchers — leave width untouched
        let spacing = COLUMN_SPACING;
        let maxWidth = this.maxWidth || 0;
        let desiredW = Helpers.calcContainerWidth(count, this.maxRows, cellW, spacing, maxWidth);

        if (desiredW !== this._lastContainerW || cellW !== this._lastCellW) {
            let cols = Helpers.calcContainerColumns(count, this.maxRows);
            this._mrplLog('MRPL: containerW ' + this._lastContainerW + '->' + desiredW +
                ' cellW ' + this._lastCellW + '->' + cellW +
                ' n=' + count + ' cols=' + cols +
                ' max=' + (useMaxAcrossAll ? 'all' : 'first'));
            this._lastContainerW = desiredW;
            this._lastCellW = cellW;
        }

        // Clutter.FlowLayout caches its column pitch (priv->col_width) from
        // the last measurement pass and only re-measures inside allocate()
        // when the container's allocated SIZE changes. If launcher contents
        // change (add/remove/resize) while desiredW lands on the same value,
        // the stale pitch wraps the grid at the wrong column count and
        // set_width alone can never heal it — the cols-mismatch watchdog
        // retries exhausted on exactly this (dev-1, 2026-07-07). Query the
        // layout manager directly to refresh its caches, then force a
        // relayout even when the width is unchanged.
        let lm = this.myactor.layout_manager;
        if (lm) {
            let box = this.myactor.get_allocation_box();
            let allocH = box.y2 - box.y1;
            if (allocH > 0) {
                lm.get_preferred_width(this.myactor, allocH);
                lm.get_preferred_height(this.myactor, desiredW);
            }
        }
        this.myactor.set_width(desiredW);
        this.myactor.min_width = 0;
        this.myactor.queue_relayout();
    }

    _onAllocationChanged() {
        if (this._inAllocationUpdate) return;
        this._inAllocationUpdate = true;
        try {
            this.myactor.min_width = 0;
            // Re-compute width now that children have their CSS-styled sizes.
            this._updateContainerWidth();
        } finally {
            this._inAllocationUpdate = false;
        }
        // Any allocation change may mean FlowLayout rewrapped (natW drift,
        // theme reload). Run the rendered-cols watchdog, not just the width
        // recompute — otherwise a silent column collapse persists until the
        // next _reload(). Collapses to one idle source; a clean pass is cheap.
        this._scheduleVerify();
    }

    // Queue a post-layout verify pass. PRIORITY_LOW fires after Clutter's
    // relayout + style-changed propagation, so reads of panel.height and
    // launcher.get_preferred_width are accurate. Source ID is cached so
    // rapid _reload() calls collapse to one final verify.
    _scheduleVerify() {
        if (this._verifySourceId) {
            GLib.source_remove(this._verifySourceId);
            this._verifySourceId = 0;
        }
        this._verifySourceId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._verifySourceId = 0;
            this._verifyLayout();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Verify that current icon_size and container width match the expected
    // values given the panel state. Heal if they don't. Called from the idle
    // queued by _scheduleVerify, and re-queues itself (bounded) if CSS hasn't
    // resolved yet.
    _verifyLayout() {
        if (this._healing) return;
        let isHorizontal = (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM);
        if (!isHorizontal || this._launchers.length === 0) return;

        // Icon-size check — covers stale _panelHeight at constructor time.
        if (this._panelHeight > 0) {
            let expected = Helpers.calcIconSizeWithFallback(
                this._panelHeight,
                this.getPanelIconSize(St.IconType.FULLCOLOR) || 0,
                Helpers.calcEffectiveRows(this._launchers.length, this.maxRows || 2),
                this.iconSizeOverride || 0
            );
            if (expected !== this.icon_size) {
                this._mrplLog('MRPL: healing icon_size ' +
                    this.icon_size + ' → ' + expected);
                this._healing = true;
                try {
                    this._recalcIconSize();
                    this._reload();
                } finally {
                    this._healing = false;
                }
                return;
            }
        }

        // Width check — covers stale CSS padding at _reload time.
        let [, natW] = this._launchers[0].actor.get_preferred_width(-1);
        if (natW < this.icon_size + 2) {
            this._verifyRetries += 1;
            if (this._verifyRetries < 3) this._scheduleVerify();
            return;
        }
        this._verifyRetries = 0;

        this._updateContainerWidth();

        // Rendered-cols mismatch watchdog: FlowLayout(homogeneous=true) sizes
        // its cells from the WIDEST child, so a container sized off
        // _launchers[0]'s preferredW can quietly fit one fewer column than
        // calcContainerColumns expects. Inspect actual Y-allocations to count
        // rendered cols; on mismatch, clear sticky inline styles (defense vs
        // hover-leak) and re-size with cellW = max(natW) across all launchers.
        // Targets myactor (panel side) only — _overflowGrid uses an explicit
        // OVERFLOW_GRID_COLS width.
        let visibleInPanel = this.myactor.get_n_children();
        if (visibleInPanel >= 2) {
            let children = this.myactor.get_children();
            let firstY = Math.round(children[0].get_allocation_box().y1);
            let actualCols = 0;
            for (let c of children) {
                if (Math.round(c.get_allocation_box().y1) === firstY) actualCols++;
            }
            let expectedCols = Helpers.calcContainerColumns(visibleInPanel, this.maxRows || 2);
            if (actualCols > 0 && actualCols < expectedCols) {
                this._mrplLog('MRPL: cols mismatch actual=' + actualCols +
                    ' expected=' + expectedCols + ' n=' + visibleInPanel +
                    ' rows=' + this.maxRows + ' retries=' + this._colsMismatchRetries);
                this._healing = true;
                try {
                    for (let l of this._launchers) l.actor.set_style(LAUNCHER_BASE_STYLE);
                    this._updateContainerWidth(true);
                } finally {
                    this._healing = false;
                }
                if (this._colsMismatchRetries < 3) {
                    this._colsMismatchRetries += 1;
                    this._scheduleVerify();
                } else {
                    this._mrplLog('MRPL: cols mismatch retries exhausted; giving up');
                }
            } else {
                this._colsMismatchRetries = 0;
            }
        }
    }

    _ensureOverflowUI() {
        if (this._overflowPanel) return; // already created

        let cellW = this._getCellWidth();

        // Chevron button — added to this.actor (applet-box), NOT myactor.
        // This keeps it outside the FlowLayout so DND never touches it.
        this._overflowIndicator = new St.Button({
            style_class: 'launcher',
            important: true,
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: true,
            track_hover: true
        });
        let chevronIcon = new St.Icon({
            icon_name: 'pan-down-symbolic',
            icon_size: this.icon_size,
            icon_type: St.IconType.SYMBOLIC
        });
        this._overflowIndicator.set_child(chevronIcon);
        this._overflowIndicator.connect('clicked', () => this._toggleOverflowPanel());
        this.actor.add(this._overflowIndicator);

        // Overflow grid — FlowLayout for multi-row popup
        let gridManager = new Clutter.FlowLayout({
            orientation: Clutter.FlowOrientation.HORIZONTAL,
            homogeneous: true,
            column_spacing: OVERFLOW_GRID_SPACING,
            row_spacing: OVERFLOW_GRID_SPACING
        });
        this._overflowGrid = new Clutter.Actor({
            layout_manager: gridManager,
            clip_to_allocation: true
        });
        let gridWidth = OVERFLOW_GRID_COLS * cellW + (OVERFLOW_GRID_COLS - 1) * OVERFLOW_GRID_SPACING;
        this._overflowGrid.set_width(gridWidth);

        // DND delegate for reordering within the overflow popup
        let applet = this;
        this._overflowGrid._delegate = {
            handleDragOver(source, actor, x, y, time) {
                if (!(source instanceof DND.LauncherDraggable)) {
                    return DND.DragMotionResult.NO_DROP;
                }
                let children = applet._overflowGrid.get_children();
                let dropIndex = 0;
                let minDist = -1;
                for (let i = 0; i < children.length; i++) {
                    if (!children[i].visible) continue;
                    let alloc = children[i].get_allocation_box();
                    let cx = (alloc.x1 + alloc.x2) / 2;
                    let cy = (alloc.y1 + alloc.y2) / 2;
                    let dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                    if (dist < minDist || minDist === -1) {
                        minDist = dist;
                        dropIndex = i;
                    }
                }
                // Store target index (offset by overflow start)
                applet._overflowGrid._dragTargetIndex = dropIndex;

                // Move actor visually within the grid
                let overflowIndex = applet._launchers.indexOf(source) - applet._overflowStartIndex;
                if (overflowIndex >= 0 && dropIndex !== overflowIndex) {
                    applet._overflowGrid.set_child_at_index(source.actor, dropIndex);
                }

                return DND.DragMotionResult.MOVE_DROP;
            },

            acceptDrop(source, actor, x, y, time) {
                if (!(source instanceof DND.LauncherDraggable)) return false;
                let dropIndex = applet._overflowGrid._dragTargetIndex;
                if (dropIndex == null) return false;
                applet._overflowGrid._dragTargetIndex = null;

                // Compute the global launcher index
                let globalIndex = applet._overflowStartIndex + dropIndex;
                applet._reinsertAtIndex(source, globalIndex);
                return true;
            }
        };

        // Standalone overflow panel on global.stage (topmost paint layer).
        // Placed on the stage so it paints above global.top_window_group
        // (which contains "always on top" windows that occlude Main.uiGroup
        // in Clutter's pick pass, blocking hover/click events).
        // pushModal (in _openOverflowPanel) routes ALL input through the
        // Clutter stage in FULLSCREEN mode — no addChrome needed.
        this._overflowPanel = new St.Bin({
            style_class: 'menu',
            style: 'border: 1px solid rgba(255,255,255,0.3); padding: 4px;',
            important: true,
            reactive: true,
            visible: false
        });
        this._overflowPanel._delegate = this._overflowGrid._delegate;
        this._overflowPanel.set_child(this._overflowGrid);
        global.stage.add_child(this._overflowPanel);
    }

    _destroyOverflowUI() {
        if (this._overflowPanelOpen) this._closeOverflowPanel();
        if (this._overflowPanel) {
            global.stage.remove_child(this._overflowPanel);
            this._overflowPanel.destroy();
            this._overflowPanel = null;
        }
        if (this._overflowGrid) {
            this._overflowGrid._delegate = null;
            this._overflowGrid = null;
        }
        if (this._overflowIndicator) {
            this.actor.remove_child(this._overflowIndicator);
            this._overflowIndicator.destroy();
            this._overflowIndicator = null;
        }
        this._overflowStartIndex = -1;
        this._overflowPanelOpen = false;
    }

    _toggleOverflowPanel() {
        if (this._overflowPanelOpen)
            this._closeOverflowPanel();
        else
            this._openOverflowPanel();
    }

    _openOverflowPanel() {
        if (!this._overflowPanel || this._overflowPanelOpen) return;

        this._overflowPanelOpen = true;

        // Constrain panel to its preferred size before showing.
        // The stage allocates full screen size — set explicit size
        // to avoid allocation stretching the St.Bin.
        let [, pw] = this._overflowPanel.get_preferred_width(-1);
        let [, ph] = this._overflowPanel.get_preferred_height(pw);
        this._overflowPanel.set_width(pw);
        this._overflowPanel.set_height(ph);

        let [x, y] = this._calcOverflowPanelPosition();
        this._overflowPanel.set_position(x, y);
        this._overflowPanel.show();
        this._overflowPanel.raise_top();

        // Update chevron icon direction
        if (this._overflowIndicator) {
            let icon = this._overflowIndicator.get_child();
            if (icon) icon.icon_name = 'pan-up-symbolic';
        }

        // pushModal routes ALL input through the Clutter stage so our
        // captured-event handler sees clicks on application windows too.
        // DND calls pushModal separately — both nest (modalCount increments).
        this._overflowModalPushed = Main.pushModal(this._overflowPanel);

        // Click-outside / Escape detection via captured-event on global.stage
        this._capturedEventId = global.stage.connect('captured-event',
            (stage, event) => this._onOverflowCapturedEvent(event));
    }

    _closeOverflowPanel() {
        if (!this._overflowPanel) return;

        // Disconnect captured-event BEFORE popModal to avoid stale handler
        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }

        if (this._overflowModalPushed) {
            Main.popModal(this._overflowPanel);
            this._overflowModalPushed = false;
        }

        this._overflowPanel.hide();
        this._overflowPanelOpen = false;

        // Update chevron icon direction
        if (this._overflowIndicator) {
            let icon = this._overflowIndicator.get_child();
            if (icon) icon.icon_name = 'pan-down-symbolic';
        }
    }

    _calcOverflowPanelPosition() {
        let alloc = Cinnamon.util_get_transformed_allocation(this.actor);
        let monitor = Main.layoutManager.findMonitorForActor(this.actor);

        // Use preferred size so positioning works even before first allocation.
        // get_preferred_height(width) gives the correct wrapped height because
        // the grid child has an explicit fixed width (set_width in _ensureOverflowUI).
        let [, panelW] = this._overflowPanel.get_preferred_width(-1);
        let [, panelH] = this._overflowPanel.get_preferred_height(panelW);

        // Center horizontally on the applet, clamp to monitor edges
        let x = Math.round((alloc.x1 + alloc.x2) / 2 - panelW / 2);
        if (monitor) {
            x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - panelW));
        }

        // TOP panel → below applet; BOTTOM panel → above applet
        let y;
        if (this.orientation === St.Side.TOP) {
            y = alloc.y2;
        } else {
            y = alloc.y1 - panelH;
        }

        return [x, y];
    }

    _onOverflowCapturedEvent(event) {
        let type = event.type();

        // Escape key closes
        if (type === Clutter.EventType.KEY_PRESS) {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this._closeOverflowPanel();
                return Clutter.EVENT_STOP;
            }
        }

        // Click outside panel, chevron, AND applet closes.
        // Keep open for applet-area clicks so DND from panel into overflow works.
        // Use bounding-box hit test (not get_actor_at_pos) because the
        // overflow grid Clutter.Actor is non-reactive and pick-mode skips it.
        if (type === Clutter.EventType.BUTTON_PRESS) {
            let [ex, ey] = event.get_coords();

            let insidePanel = false;
            if (this._overflowPanel) {
                let [px, py] = this._overflowPanel.get_transformed_position();
                let [pw, ph] = this._overflowPanel.get_transformed_size();
                insidePanel = (ex >= px && ex <= px + pw && ey >= py && ey <= py + ph);
            }

            let insideChevron = false;
            if (this._overflowIndicator) {
                let [cx, cy] = this._overflowIndicator.get_transformed_position();
                let [cw, ch] = this._overflowIndicator.get_transformed_size();
                insideChevron = (ex >= cx && ex <= cx + cw && ey >= cy && ey <= cy + ch);
            }

            let insideApplet = false;
            if (this.actor) {
                let [ax, ay] = this.actor.get_transformed_position();
                let [aw, ah] = this.actor.get_transformed_size();
                insideApplet = (ex >= ax && ex <= ax + aw && ey >= ay && ey <= ay + ah);
            }

            if (!insidePanel && !insideChevron && !insideApplet) {
                this._closeOverflowPanel();
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _calcOverflowSplit() {
        let isHorizontal = (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM);
        if (!isHorizontal) return -1;
        let maxWidth = this.maxWidth || 0;
        if (maxWidth <= 0) return this._reportSplit(-1, 0);
        let cellW = this._getCellWidth();
        if (cellW <= 0) return this._reportSplit(-1, 0); // no launchers
        let visible = Helpers.calcVisibleLauncherCount(
            this._launchers.length, this.maxRows, cellW, 2, maxWidth
        );
        if (visible >= this._launchers.length) return this._reportSplit(-1, cellW); // all fit
        return this._reportSplit(visible, cellW);
    }

    _reportSplit(splitIndex, cellW) {
        if (splitIndex !== this._lastSplitIndex) {
            this._mrplLog('MRPL: split ' + this._lastSplitIndex + '->' + splitIndex +
                ' n=' + this._launchers.length + ' cellW=' + cellW +
                ' maxWidth=' + (this.maxWidth || 0) + ' rows=' + this.maxRows);
            this._lastSplitIndex = splitIndex;
        }
        return splitIndex;
    }

    _connectHoverFeedback(launcher) {
        let actor = launcher.actor;
        if (actor._hoverFeedbackIds) return; // already connected
        // Baseline applied immediately so the transparent border is part of
        // the launcher's preferred width from the start — hover/press then
        // only recolor it and the FlowLayout cell pitch never moves.
        actor.set_style(LAUNCHER_BASE_STYLE);
        let enterId = actor.connect('enter-event', () => {
            actor.set_style(LAUNCHER_HOVER_STYLE);
        });
        let leaveId = actor.connect('leave-event', () => {
            actor.set_style(LAUNCHER_BASE_STYLE);
        });
        let pressId = actor.connect('button-press-event', () => {
            actor.set_style(LAUNCHER_PRESS_STYLE);
        });
        let releaseId = actor.connect('button-release-event', () => {
            actor.set_style(LAUNCHER_BASE_STYLE);
        });
        // Defense vs sticky highlight on press without release (drag start,
        // focus loss, modal change). Styles are geometry-neutral, so a stuck
        // one can no longer rewrap the grid — this just drops the visual.
        let mappedId = actor.connect('notify::mapped', () => {
            if (!actor.mapped) actor.set_style(LAUNCHER_BASE_STYLE);
        });
        actor._hoverFeedbackIds = [enterId, leaveId, pressId, releaseId, mappedId];
    }

    _disconnectHoverFeedback(launcher) {
        let actor = launcher.actor;
        if (!actor._hoverFeedbackIds) return;
        for (let id of actor._hoverFeedbackIds) actor.disconnect(id);
        actor._hoverFeedbackIds = null;
        actor.set_style(null); // true clear; '' trips a libcroco empty-buffer assert
    }

    _redistributeLaunchers() {
        let splitIndex = this._calcOverflowSplit();

        if (splitIndex === -1) {
            // No overflow needed — all launchers in panel
            // Reparent any overflow launchers back to myactor
            for (let i = 0; i < this._launchers.length; i++) {
                this._connectHoverFeedback(this._launchers[i]);
                let actor = this._launchers[i].actor;
                let parent = actor.get_parent();
                if (parent !== this.myactor) {
                    if (parent) parent.remove_child(actor);
                    this.myactor.add_actor(actor);
                }
            }
            this._destroyOverflowUI();
        } else {
            // Overflow needed
            this._ensureOverflowUI();
            this._overflowStartIndex = splitIndex;

            // Launchers [0, splitIndex) → panel
            for (let i = 0; i < splitIndex; i++) {
                this._connectHoverFeedback(this._launchers[i]);
                let actor = this._launchers[i].actor;
                let parent = actor.get_parent();
                if (parent !== this.myactor) {
                    if (parent) parent.remove_child(actor);
                    this.myactor.add_actor(actor);
                }
            }

            // Launchers [splitIndex, length) → overflow grid
            for (let i = splitIndex; i < this._launchers.length; i++) {
                this._connectHoverFeedback(this._launchers[i]);
                let actor = this._launchers[i].actor;
                let parent = actor.get_parent();
                if (parent !== this._overflowGrid) {
                    if (parent) parent.remove_child(actor);
                    this._overflowGrid.add_actor(actor);
                }
            }
        }

        this._updateContainerWidth();
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
            appinfo = CMenu.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH + path);
            if (!appinfo) {
                appinfo = CMenu.DesktopAppInfo.new_from_filename(OLD_CUSTOM_LAUNCHERS_PATH + path);
            }
            if (!appinfo) {
                global.logWarning(`Failed to add launcher from path: ${path}`);
                return null;
            }
        }
        return new PanelAppLauncher(this, app, appinfo, this.orientation, this.icon_size);
    }

    on_panel_height_changed() {
        this._recalcIconSize();
        this._reload();
    }

    on_panel_icon_size_changed(size) {
        this._recalcIconSize();
        this._reload();
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;
        let isHorizontal = (neworientation == St.Side.TOP || neworientation == St.Side.BOTTOM);

        if (isHorizontal) {
            let manager = new Clutter.FlowLayout({
                orientation: Clutter.FlowOrientation.HORIZONTAL,
                homogeneous: true,
                column_spacing: COLUMN_SPACING,
                row_spacing: 0
            });
            this.launchersBox.manager = manager;
            this.myactor.set_layout_manager(manager);
            this.myactor.min_width = 0;

            // Re-add the allocation listener (disconnect first to avoid duplicates)
            this.signals.disconnect('notify::allocation', this.actor);
            this.signals.connect(this.actor, 'notify::allocation', this._onAllocationChanged, this);
        } else {
            this._destroyOverflowUI();

            let manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
            this.launchersBox.manager = manager;
            this.myactor.set_layout_manager(manager);

            // Remove allocation listener and width constraint for vertical
            this.signals.disconnect('notify::allocation', this.actor);
            this.myactor.set_width(-1);
            this.myactor.min_width = -1;
        }

        this._reload();
    }

    _reload() {
        if (this._overflowPanelOpen)
            this._closeOverflowPanel();
        this._destroyOverflowUI();

        this._launchers.forEach(l => l.destroy());
        this._launchers = [];
        this._settings_proxy = [];

        for (let file of this.launcherList) {
            let launcher = this._loadLauncher(file);
            let proxyObj = { file: file, valid: false, launcher: null };
            if (launcher) {
                this._launchers.push(launcher);
                proxyObj.valid = true;
                proxyObj.launcher = launcher;
            }
            this._settings_proxy.push(proxyObj);
        }

        this._redistributeLaunchers();
        this._saveBackup();
        this._scheduleVerify();
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
            let file = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH + appid);
            if (file.query_exists(null)) file.delete(null);
            let old_file = Gio.file_new_for_path(OLD_CUSTOM_LAUNCHERS_PATH + appid);
            if (old_file.query_exists(null)) old_file.delete(null);
        }

        this.sync_settings_proxy_to_settings();
        this._redistributeLaunchers();
    }

    // Called by the Cinnamon menu's "Add to Panel" when this applet holds
    // the panellauncher role. Adds a new launcher via settings reload path.
    acceptNewLauncher(path) {
        let newLauncher = this._loadLauncher(path);
        if (!newLauncher)
            return;

        this._launchers.push(newLauncher);
        this._insert_proxy_member({ file: path, valid: true, launcher: newLauncher }, -1);
        this.sync_settings_proxy_to_settings();
        this._redistributeLaunchers();
    }

    showAddLauncherDialog(timestamp, launcher){
        // argv-array spawn: launcher ids and the settings path come from the
        // filesystem, so never route them through a shell-parsed string.
        if (launcher) {
            Util.spawn(["cinnamon-desktop-editor", "-mcinnamon-launcher",
                "--icon-size", String(this.icon_size),
                "-f", launcher.getId(), this.settings.file.get_path()]);
        } else {
            Util.spawn(["cinnamon-desktop-editor", "-mcinnamon-launcher",
                "--icon-size", String(this.icon_size),
                this.settings.file.get_path()]);
        }
    }

    _reinsertAtIndex(launcher, newIndex) {
        let originalIndex = this._launchers.indexOf(launcher);
        if (originalIndex == -1)
            return;

        if (originalIndex != newIndex) {
            this._launchers.splice(originalIndex, 1);
            this._launchers.splice(newIndex, 0, launcher);
            this._move_launcher_in_proxy(launcher, newIndex);
            this.sync_settings_proxy_to_settings();
            this._redistributeLaunchers();
        }
    }

    _clearDragPlaceholder(skipAnimation=false) {
        this.launchersBox._clearDragPlaceholder(skipAnimation);
    }

    on_applet_removed_from_panel() {
        if (this._verifySourceId) {
            GLib.source_remove(this._verifySourceId);
            this._verifySourceId = 0;
        }
        this._destroyOverflowUI();
        this._launchers.forEach(l => l.destroy());
        this._launchers = [];
        this.signals.disconnectAllSignals();
    }
}
Signals.addSignalMethods(CinnamonPanelLaunchersApplet.prototype);

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonPanelLaunchersApplet(metadata, orientation, panel_height, instance_id);
}
