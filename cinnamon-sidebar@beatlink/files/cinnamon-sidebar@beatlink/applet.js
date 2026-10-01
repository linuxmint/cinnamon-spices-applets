const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "cinnamon-sidebar@beatlink";

// D-Bus interface for command-line / programmatic control. Any program can drive
// the dock by calling these methods, e.g.:
//   gdbus call --session --dest org.Cinnamon.SidebarDock \
//     --object-path /org/Cinnamon/SidebarDock \
//     --method org.Cinnamon.SidebarDock.DockFocused
const DBUS_NAME = "org.Cinnamon.SidebarDock";
const DBUS_PATH = "/org/Cinnamon/SidebarDock";
const DBUS_IFACE =
    '<node>' +
    '  <interface name="org.Cinnamon.SidebarDock">' +
    '    <method name="DockFocused">' +
    '      <arg type="b" direction="out" name="ok"/>' +
    '    </method>' +
    '    <method name="Undock">' +
    '      <arg type="b" direction="out" name="ok"/>' +
    '    </method>' +
    '    <method name="DockByTitle">' +
    '      <arg type="s" direction="in" name="substring"/>' +
    '      <arg type="b" direction="out" name="ok"/>' +
    '    </method>' +
    '    <method name="DockByApp">' +
    '      <arg type="s" direction="in" name="wmClass"/>' +
    '      <arg type="b" direction="out" name="ok"/>' +
    '    </method>' +
    '    <method name="DockById">' +
    '      <arg type="u" direction="in" name="xid"/>' +
    '      <arg type="b" direction="out" name="ok"/>' +
    '    </method>' +
    '    <method name="ListWindows">' +
    '      <arg type="s" direction="out" name="json"/>' +
    '    </method>' +
    '  </interface>' +
    '</node>';

// Padding (px) between the docked window and the rest of the windows.
const GAP = 0;

// Muffin's Meta.MaximizeFlags GIR only defines HORIZONTAL and VERTICAL (not
// BOTH), so build the "both axes" flag explicitly to be version-safe.
const MAX_BOTH = Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL;

// Debug logging to the Cinnamon log (~/.xsession-errors). Set true to trace.
const DEBUG = false;
function dbg(msg) { if (DEBUG) global.log("[sidebar-dock] " + msg); }
function rectStr(r) {
    return "x=" + r.x + " y=" + r.y + " w=" + r.width + " h=" + r.height +
           " right=" + (r.x + r.width);
}
// Best-effort read of Muffin's live tile-mode for a window (for tracing only).
function tileStr(win) {
    try {
        let tm = win.tile_mode;
        return (tm === undefined || tm === null) ? "?" : String(tm);
    } catch (e) { return "?"; }
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("view-dual-symbolic");
        this.set_applet_tooltip(_("Sidebar Dock"));

        // The single docked window, or null. When set, this is the FIXED slot
        // recorded at dock time (never recomputed from work-area events):
        //   { win, monitor, side, x, y, width, height, saved:{x,y,width,height} }
        this._dock = null;

        // Per-window monitoring signal ids. Keyed by Meta.Window => [id,...].
        this._winSignals = new Map();

        // Global signal ids active while a window is docked: [[obj, id], ...].
        this._globalSignals = [];

        // Re-entrancy guard: true while WE move a window, so our own moves don't
        // re-trigger the handlers.
        this._enforcing = false;

        // Debounced enforcement source id.
        this._enforceIdle = 0;

        // True while the user is interactively dragging/resizing a window.
        this._grabbing = false;

        // Maximize toggle state: windows the user maximized-into-fill, mapped to
        // their pre-maximize rect so a second maximize restores that size.
        this._filled = new Map();

        // Last known NON-maximized, NON-filled rect per window. Captured
        // continuously so that when a maximize fires we already have the true
        // pre-maximize size (unmaximize() is async and can't be read in time).
        this._lastNormalRect = new Map();

        // True while WE call unmaximize(), so the maximize handler ignores the
        // resulting state change (it isn't a user action).
        this._selfUnmax = false;

        // Windows whose fill was deferred until the current grab ends (drag-to-
        // tile fires mid-grab; unmaximizing then leaves Muffin's tile hint).
        this._pendingFill = null;

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "dock-side", "dockSide",
            () => this._onDockGeometryChanged(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "dock-width-mode", "dockWidthMode",
            () => this._onDockGeometryChanged(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "dock-width-fraction", "dockWidthFraction",
            () => this._onDockGeometryChanged(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "dock-width-pixels", "dockWidthPixels",
            () => this._onDockGeometryChanged(), null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "dock-hotkey", "dockHotkey",
            () => this._updateKeybindings(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "undock-hotkey", "undockHotkey",
            () => this._updateKeybindings(), null);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._updateKeybindings();
        this._exportDBus();
    },

    // ----- D-Bus (command-line / programmatic control) -----

    _exportDBus: function() {
        try {
            this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, this);
            this._dbusImpl.export(Gio.DBus.session, DBUS_PATH);
            this._dbusOwnerId = Gio.bus_own_name(
                Gio.BusType.SESSION, DBUS_NAME,
                Gio.BusNameOwnerFlags.REPLACE, null, null, null);
        } catch (e) {
            global.logError("[sidebar-dock] D-Bus export failed: " + e);
        }
    },

    _unexportDBus: function() {
        if (this._dbusImpl) {
            try { this._dbusImpl.unexport(); } catch (e) {}
            this._dbusImpl = null;
        }
        if (this._dbusOwnerId) {
            try { Gio.bus_unown_name(this._dbusOwnerId); } catch (e) {}
            this._dbusOwnerId = 0;
        }
    },

    // D-Bus methods. Each returns a boolean success flag (except ListWindows).
    DockFocused: function() {
        let win = global.display.get_focus_window();
        if (win && this._isDockable(win)) { this._dockWindow(win); return true; }
        return false;
    },

    Undock: function() {
        let had = this._dock != null;
        this._undock();
        return had;
    },

    DockByTitle: function(substring) {
        let needle = (substring || "").toLowerCase();
        for (let win of this._listWindows()) {
            let title = (win.get_title() || "").toLowerCase();
            if (needle && title.indexOf(needle) !== -1) { this._dockWindow(win); return true; }
        }
        return false;
    },

    DockByApp: function(wmClass) {
        let needle = (wmClass || "").toLowerCase();
        for (let win of this._listWindows()) {
            let cls = (win.get_wm_class() || "").toLowerCase();
            let inst = (win.get_wm_class_instance() || "").toLowerCase();
            if (needle && (cls.indexOf(needle) !== -1 || inst.indexOf(needle) !== -1)) {
                this._dockWindow(win); return true;
            }
        }
        return false;
    },

    DockById: function(xid) {
        for (let win of this._listWindows()) {
            if (win.get_xwindow && win.get_xwindow() === xid) { this._dockWindow(win); return true; }
        }
        return false;
    },

    ListWindows: function() {
        let dockedWin = this._dock ? this._dock.win : null;
        let out = this._listWindows().map((win) => {
            return {
                title: win.get_title() || "",
                wm_class: win.get_wm_class() || "",
                wm_class_instance: win.get_wm_class_instance() || "",
                xid: (win.get_xwindow ? win.get_xwindow() : 0),
                monitor: win.get_monitor(),
                docked: win === dockedWin
            };
        });
        return JSON.stringify({ dock_side: this.dockSide, windows: out });
    },

    on_applet_clicked: function() {
        this._buildMenu();
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this._removeKeybindings();
        this._unexportDBus();
        this._undock();
        this.settings.finalize();
    },

    // ----- Keybindings -----

    _updateKeybindings: function() {
        this._removeKeybindings();
        Main.keybindingManager.addHotKey("sidebar-dock", this.dockHotkey,
            () => this._dockFocused());
        Main.keybindingManager.addHotKey("sidebar-undock", this.undockHotkey,
            () => this._undock());
    },

    _removeKeybindings: function() {
        Main.keybindingManager.removeHotKey("sidebar-dock");
        Main.keybindingManager.removeHotKey("sidebar-undock");
    },

    _dockFocused: function() {
        let win = global.display.get_focus_window();
        if (win && this._isDockable(win)) this._dockWindow(win);
    },

    _onDockGeometryChanged: function() {
        if (this._dock && this._isValid(this._dock.win)) {
            this._dockWindow(this._dock.win);
        }
    },

    // ----- Menu -----

    _buildMenu: function() {
        this.menu.removeAll();

        let sideLabel = (this.dockSide === "right") ? _("right") : _("left");

        let windows = this._listWindows();
        if (windows.length === 0) {
            let item = new PopupMenu.PopupMenuItem(_("No dockable windows"), { reactive: false });
            this.menu.addMenuItem(item);
            return;
        }

        for (let win of windows) {
            let title = win.get_title() || _("(untitled)");
            if (title.length > 40) title = title.substring(0, 39) + "…";

            let isDocked = this._dock && this._dock.win === win;
            let item = new PopupMenu.PopupMenuItem((isDocked ? "✓ " : "") + title);
            item.connect("activate", () => {
                if (isDocked) this._undock();
                else this._dockWindow(win);
            });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let hint = new PopupMenu.PopupMenuItem(
            _("Click a window to dock it to the ") + sideLabel +
            _(" (click again to undock)"), { reactive: false });
        this.menu.addMenuItem(hint);
    },

    _listWindows: function() {
        let ws = global.workspace_manager.get_active_workspace();
        return ws.list_windows().filter((w) => {
            return this._isDockable(w);
        });
    },

    _isDockable: function(w) {
        if (!w) return false;
        if (w.minimized) return false;
        if (w.skip_taskbar) return false;
        let type = w.get_window_type();
        return type === Meta.WindowType.NORMAL || type === Meta.WindowType.DIALOG;
    },

    _side: function() {
        return (this.dockSide === "right") ? Meta.Side.RIGHT : Meta.Side.LEFT;
    },

    _computeDockWidth: function(monitorWidth) {
        if (this.dockWidthMode === "pixels") {
            return Math.round(this.dockWidthPixels);
        }
        return Math.round(monitorWidth * this.dockWidthFraction);
    },

    // ----- Docking -----

    _dockWindow: function(win) {
        let reDockingSame = this._dock && this._dock.win === win;
        if (this._dock && !reDockingSame) this._undock();

        let saved = reDockingSame ? this._dock.saved : this._captureRect(win);

        let work = this._workArea(win);
        let monitor = win.get_monitor();
        let side = this._side();
        let dockWidth = Math.min(this._computeDockWidth(work.width), work.width - 100);
        let dockX = (side === Meta.Side.LEFT) ? work.x : work.x + work.width - dockWidth;

        if (win.get_maximized && win.get_maximized()) {
            win.unmaximize(MAX_BOTH);
        }
        // A docked window is NOT forced above; clear any stale always-on-top flag
        // (e.g. left over from an earlier build) so undock restores it normally.
        if (win.is_above && win.is_above()) win.unmake_above();

        // FIXED slot — recorded once, never recomputed from later events.
        this._dock = {
            win: win, monitor: monitor, side: side,
            x: dockX, y: work.y, width: dockWidth, height: work.height,
            saved: saved
        };

        dbg("DOCK '" + win.get_title() + "' side=" + (side === Meta.Side.LEFT ? "L" : "R") +
            " slot x=" + dockX + " y=" + work.y + " w=" + dockWidth + " h=" + work.height);

        this._withGuard(() => {
            this._moveResize(win, dockX, work.y, dockWidth, work.height);
        });
        win.activate(global.get_current_time());

        // The window may refuse to shrink below its minimum width (many apps have
        // one). Read the ACTUAL resulting rect and adopt it as the real slot, so
        // the band and the lock target match reality instead of fighting forever.
        this._syncSlotToWindow();

        this._startMonitoring();
        this._enforceOthers();
    },

    // Adopt the docked window's actual current rect as the slot, re-anchored to
    // the configured edge (so a min-width window still hugs the correct side).
    _syncSlotToWindow: function() {
        if (!this._dock || !this._isValid(this._dock.win)) return;
        let dock = this._dock;
        let work = this._workAreaForMonitor(dock.monitor);
        let r = dock.win.get_frame_rect();
        dock.width = r.width;
        dock.height = r.height;
        dock.y = r.y;
        dock.x = (dock.side === Meta.Side.LEFT)
            ? work.x
            : work.x + work.width - r.width;
        // If the window didn't land exactly on the edge (min-width overshoot),
        // nudge it there now.
        if (r.x !== dock.x || r.y !== dock.y) {
            this._withGuard(() => {
                this._moveResize(dock.win, dock.x, dock.y, dock.width, dock.height);
            });
        }
        dbg("slot synced to real size: x=" + dock.x + " y=" + dock.y +
            " w=" + dock.width + " h=" + dock.height);
    },

    _undock: function() {
        if (!this._dock) return;
        let dock = this._dock;
        this._dock = null;
        this._stopMonitoring();

        if (this._isValid(dock.win)) {
            let s = dock.saved;
            this._withGuard(() => {
                // Clear any always-on-top state (an earlier build set it, and the
                // flag persists on the window until explicitly cleared).
                if (dock.win.is_above && dock.win.is_above()) dock.win.unmake_above();
                this._moveResize(dock.win, s.x, s.y, s.width, s.height);
            });
        }
    },

    // ----- Monitoring -----

    _startMonitoring: function() {
        this._attachAll();
        if (this._globalSignals.length === 0) {
            this._globalSignals.push([global.display,
                global.display.connect("window-created", (display, win) => this._onWindowCreated(display, win))]);
            this._globalSignals.push([global.display,
                global.display.connect("grab-op-begin", (display, win, op) => this._onGrabOpBegin(display, win, op))]);
            this._globalSignals.push([global.display,
                global.display.connect("grab-op-end", (display, win, op) => this._onGrabOpEnd(display, win, op))]);
        }
    },

    _stopMonitoring: function() {
        for (let [obj, id] of this._globalSignals) {
            try { obj.disconnect(id); } catch (e) {}
        }
        this._globalSignals = [];
        for (let win of Array.from(this._winSignals.keys())) this._detachWindow(win);
        if (this._enforceIdle) { GLib.source_remove(this._enforceIdle); this._enforceIdle = 0; }
        this._grabbing = false;
        this._filled.clear();
        this._lastNormalRect.clear();
        this._pendingFill = null;
    },

    _attachAll: function() {
        for (let win of this._listWindows()) this._attachWindow(win);
    },

    _attachWindow: function(win) {
        if (this._winSignals.has(win)) return;
        let ids = [];
        ids.push(win.connect("position-changed", () => { this._onWindowChanged(win); }));
        ids.push(win.connect("size-changed", () => { this._onWindowChanged(win); }));
        // Maximize (incl. tile-to-full) has its own toggle handler.
        ids.push(win.connect("notify::maximized-horizontally", () => { this._onMaximize(win); }));
        ids.push(win.connect("unmanaged", () => {
            this._filled.delete(win);
            this._lastNormalRect.delete(win);
            if (this._pendingFill) this._pendingFill.delete(win);
            this._detachWindow(win);
            if (this._dock && this._dock.win === win) { this._dock = null; this._stopMonitoring(); }
        }));
        this._winSignals.set(win, ids);
    },

    _detachWindow: function(win) {
        let ids = this._winSignals.get(win);
        if (!ids) return;
        for (let id of ids) { try { win.disconnect(id); } catch (e) {} }
        this._winSignals.delete(win);
    },

    _onWindowCreated: function(display, win) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this._dock) return GLib.SOURCE_REMOVE;
            if (this._isDockable(win)) {
                this._attachWindow(win);
                this._enforceWindow(win);
            }
            return GLib.SOURCE_REMOVE;
        });
    },

    _onWindowChanged: function(win) {
        if (this._enforcing) return; // our own move

        dbg("changed '" + win.get_title() + "' " + rectStr(win.get_frame_rect()) +
            " hmax=" + win.maximized_horizontally + " vmax=" + win.maximized_vertically +
            " grabbing=" + this._grabbing +
            (this._dock && win === this._dock.win ? " [DOCKED]" : ""));

        // The docked window is locked to its slot: revert its moves immediately.
        if (this._dock && win === this._dock.win) {
            if (this._grabbing) return; // wait for grab-op-end
            this._withGuard(() => this._repinDocked());
            return;
        }

        // Remember the window's size while it's a normal (not maximized, not
        // filled) window, so a later maximize can restore to exactly this.
        if (!win.maximized_horizontally && !this._filled.has(win)) {
            this._lastNormalRect.set(win, this._captureRect(win));
        }

        this._queueEnforce();
    },

    // Maximize toggle for non-docked windows:
    //   not yet filled  -> maximize means "fill the band" (remember pre-max size)
    //   already filled   -> maximize again means "restore the pre-max size"
    _onMaximize: function(win) {
        dbg("onMaximize '" + (win.get_title ? win.get_title() : "?") + "' hmax=" +
            win.maximized_horizontally + " vmax=" + win.maximized_vertically +
            " tile=" + tileStr(win) + " grab=" + this._grabbing +
            " selfUnmax=" + this._selfUnmax + " enforcing=" + this._enforcing +
            " filled=" + this._filled.has(win));
        if (this._selfUnmax) return;                     // our own unmaximize echo
        if (this._enforcing) return;                     // our own geometry change
        if (this._dock && win === this._dock.win) {      // docked window: just lock
            if (!this._grabbing) this._withGuard(() => this._repinDocked());
            return;
        }
        if (!win.maximized_horizontally) return;         // only act on maximize (true)
        if (!this._band(win.get_monitor())) return;      // not on the docked monitor

        if (this._filled.has(win)) {
            // Second maximize => restore the remembered pre-maximize rect.
            let pre = this._filled.get(win);
            this._filled.delete(win);
            this._selfUnmaximize(win);
            this._hideTilePreview();
            if (pre) {
                dbg("maximize toggle: RESTORE '" + win.get_title() + "' -> " + rectStr(pre));
                this._withGuard(() => {
                    this._moveResize(win, pre.x, pre.y, pre.width, pre.height);
                });
            }
            this._hideTilePreview();
            return;
        }

        // First maximize => fill the band.
        this._fillFromMaximize(win);
    },

    // Turn a maximized (non-docked) window into a band-filling window: remember
    // its pre-maximize size, unmaximize, then expand to fill the band. Safe to
    // call during enforcement (unlike _onMaximize, which bails while enforcing),
    // so it also handles windows that were ALREADY maximized at dock time.
    _fillFromMaximize: function(win) {
        if (this._filled.has(win)) return;
        // Use the pre-maximize rect we captured continuously (unmaximize() is
        // async and unreadable in time). Fall back to the current rect only if
        // we somehow never saw a normal one.
        let pre = this._lastNormalRect.get(win) || this._captureRect(win);
        this._filled.set(win, pre);
        dbg("maximize toggle: FILL '" + win.get_title() + "' (pre-max=" + rectStr(pre) + ")");

        // Drag-to-edge tiling (e.g. drop at the top of the screen) fires this
        // WHILE the pointer grab is still active. If we unmaximize now, Muffin
        // re-asserts its tile state at grab-end and the tile hint/preview lingers
        // even though our geometry is correct. Wait for the grab to finish, then
        // unmaximize + fill so Muffin has no tile op left to re-apply.
        if (this._grabbing) {
            this._pendingFill = this._pendingFill || new Set();
            this._pendingFill.add(win);
            return;
        }
        this._applyFill(win);
    },

    // Actually clear the maximized/tiled state and expand into the band. Assumes
    // the pre-maximize rect is already stored in _filled.
    _applyFill: function(win) {
        if (!this._isValid(win) || !this._filled.has(win)) return;
        dbg("applyFill '" + (win.get_title ? win.get_title() : "?") + "' tile(before)=" +
            tileStr(win) + " maxed=" + (win.get_maximized ? win.get_maximized() : "?"));
        this._selfUnmaximize(win);
        this._hideTilePreview();
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this._isValid(win) && this._filled.has(win) &&
                this._dock && win !== this._dock.win) {
                dbg("applyFill(idle) '" + (win.get_title ? win.get_title() : "?") +
                    "' tile(after-unmax)=" + tileStr(win));
                this._withGuard(() => { this._fillBand(win); });
                // The WM's blue tile-preview overlay is a separate St actor driven
                // by muffin's show/hide-tile-preview signals. When we hijack a
                // drag-tiled window the "hide" can be missed, so hide it ourselves.
                this._hideTilePreview();
            }
            return GLib.SOURCE_REMOVE;
        });
    },

    // Dismiss Cinnamon's blue tile-preview overlay if it's still showing. Guarded:
    // the internals (Main.wm._tilePreview) are private and may vary by version.
    _hideTilePreview: function() {
        try {
            let wm = Main.wm;
            if (wm && wm._tilePreview && typeof wm._tilePreview.hide === "function") {
                wm._tilePreview.hide();
                dbg("tile-preview hidden");
            }
        } catch (e) {
            dbg("hideTilePreview failed: " + e);
        }
    },

    _selfUnmaximize: function(win) {
        let prev = this._selfUnmax;
        this._selfUnmax = true;
        try {
            if (win.get_maximized && win.get_maximized()) win.unmaximize(MAX_BOTH);
        } finally {
            this._selfUnmax = prev;
        }
    },

    _onGrabOpBegin: function(display, win, op) {
        this._grabbing = true;
        dbg("grab-begin op=" + op + " win='" + (win && win.get_title ? win.get_title() : "?") +
            "' tile=" + (win ? tileStr(win) : "-"));
    },

    _onGrabOpEnd: function(display, win, op) {
        this._grabbing = false;
        dbg("grab-end op=" + op + " win='" + (win && win.get_title ? win.get_title() : "?") +
            "' tile=" + (win ? tileStr(win) : "-") +
            " pending=" + (this._pendingFill ? this._pendingFill.size : 0));
        if (!this._dock) return;
        // Flush any fills deferred because they arrived mid-grab (drag-to-tile).
        // Do this before enforceAll so the window's tile state is cleared first.
        if (this._pendingFill && this._pendingFill.size) {
            let pending = this._pendingFill;
            this._pendingFill = null;
            for (let w of pending) this._applyFill(w);
        }
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._enforceAll();
            // A drag that we intercepted (FILL or RESTORE) may leave the WM's
            // tile-preview overlay showing; Muffin can also re-show it as the grab
            // settles. Clear it once more after the dust settles.
            this._hideTilePreview();
            return GLib.SOURCE_REMOVE;
        });
    },

    _queueEnforce: function() {
        if (this._grabbing) return; // defer to grab-op-end
        if (this._enforceIdle) return;
        this._enforceIdle = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60,
            () => {
                this._enforceIdle = 0;
                this._enforceAll();
                return GLib.SOURCE_REMOVE;
            });
    },

    _enforceAll: function() {
        if (!this._dock) return;
        this._withGuard(() => {
            this._repinDocked();
            for (let win of this._listWindows()) {
                if (this._dock && win === this._dock.win) continue;
                this._pushOutOfBand(win);
            }
        });
    },

    _enforceOthers: function() {
        if (!this._dock) return;
        this._withGuard(() => {
            for (let win of this._listWindows()) {
                if (this._dock && win === this._dock.win) continue;
                this._pushOutOfBand(win);
            }
        });
    },

    _enforceWindow: function(win) {
        if (!this._isValid(win) || (this._dock && win === this._dock.win)) return;
        this._withGuard(() => { this._pushOutOfBand(win); });
    },

    // Lock the docked window to its FIXED slot.
    _repinDocked: function() {
        if (!this._dock || !this._isValid(this._dock.win)) return;
        let dock = this._dock;
        let win = dock.win;
        if (win.get_maximized && win.get_maximized()) win.unmaximize(MAX_BOTH);
        let r = win.get_frame_rect();
        if (r.x !== dock.x || r.y !== dock.y || r.width !== dock.width || r.height !== dock.height) {
            dbg("repin docked: " + rectStr(r) + " -> x=" + dock.x + " w=" + dock.width);
            this._moveResize(win, dock.x, dock.y, dock.width, dock.height);
        }
    },

    // ----- Band (the area beside the dock) -----

    // The usable band for other windows: everything on this monitor except the
    // fixed dock slot. Derived ONLY from the stored slot (never live geometry).
    _band: function(monitor) {
        if (!this._dock || this._dock.monitor !== monitor) return null;
        let work = this._workAreaForMonitor(monitor);
        let dock = this._dock;
        let availX, availWidth;
        if (dock.side === Meta.Side.LEFT) {
            availX = dock.x + dock.width + GAP;
            availWidth = (work.x + work.width) - availX;
        } else {
            availX = work.x;
            availWidth = dock.x - GAP - availX;
        }
        return { work: work, availX: availX, availWidth: availWidth };
    },

    _pushOutOfBand: function(win) {
        let band = this._band(win.get_monitor());
        if (!band) return;
        if (band.availWidth < 50) return;

        // A window that's maximized when we enforce (e.g. it was already maximized
        // at dock time) is made to fill the band and gets a remembered pre-maximize
        // size. We call _fillFromMaximize directly rather than _onMaximize because
        // enforcement runs under the _enforcing guard, which _onMaximize bails on.
        // Genuine (interactive) user maximizes come through _onMaximize.
        if (win.maximized_horizontally ||
            (win.get_maximized && (win.get_maximized() & Meta.MaximizeFlags.HORIZONTAL))) {
            if (!this._filled.has(win)) this._fillFromMaximize(win);
            return;
        }
        // Ordinary move/resize: only keep it from covering the dock.
        this._clampIntoBand(win);
    },

    // Expand `win` to fill the whole band (a maximize inside the reserved layout).
    _fillBand: function(win) {
        let band = this._band(win.get_monitor());
        if (!band) return;
        let work = band.work;
        dbg("  fill '" + win.get_title() + "' -> x=" + band.availX + " w=" + band.availWidth);
        this._moveResize(win, band.availX, work.y, band.availWidth, work.height);
    },

    // Keep `win` from OVERLAPPING the dock, but otherwise leave it where the user
    // put it — including partially off-screen on the non-dock side. On overlap we
    // SHIFT the window off the dock (preserving its size), only shrinking if it's
    // too wide to fit the band at all.
    _clampIntoBand: function(win) {
        let band = this._band(win.get_monitor());
        if (!band) return;
        let dock = this._dock;
        let r = win.get_frame_rect();

        let newX = r.x, newW = r.width;

        if (dock.side === Meta.Side.RIGHT) {
            let limit = dock.x - GAP;                 // window right edge max
            if (r.x + r.width > limit) {
                newX = limit - r.width;               // slide left off-screen if needed
                if (newX < band.availX && r.width > band.availWidth) {
                    // Too wide to fit even the band; shrink to the band width.
                    newX = band.availX;
                    newW = band.availWidth;
                }
            }
        } else {
            let limit = dock.x + dock.width + GAP;     // window left edge min
            if (r.x < limit) {
                newX = limit;
                let overflow = (limit + r.width) - (band.availX + band.availWidth);
                if (overflow > 0 && r.width > band.availWidth) {
                    newW = band.availWidth;            // too wide: shrink instead
                }
            }
        }

        if (newX === r.x && newW === r.width) return; // no dock overlap
        dbg("  clamp '" + win.get_title() + "' " + rectStr(r) +
            " -> x=" + newX + " w=" + newW);
        this._moveResize(win, newX, r.y, Math.max(1, newW), r.height);
    },

    // ----- Geometry helpers -----

    _isValid: function(win) {
        try { return win.get_compositor_private() != null; } catch (e) { return false; }
    },

    _workArea: function(win) {
        return this._workAreaForMonitor(win.get_monitor());
    },

    _workAreaForMonitor: function(monitor) {
        let ws = global.workspace_manager.get_active_workspace();
        return ws.get_work_area_for_monitor(monitor);
    },

    _captureRect: function(win) {
        let r = win.get_frame_rect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    },

    _withGuard: function(fn) {
        let prev = this._enforcing;
        this._enforcing = true;
        try { fn(); } finally { this._enforcing = prev; }
    },

    _moveResize: function(win, x, y, width, height) {
        win.move_resize_frame(false, x, y, Math.max(1, width), Math.max(1, height));
    }
};

// Minimal gettext-free translator (falls back to identity).
function _(str) {
    return str;
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
