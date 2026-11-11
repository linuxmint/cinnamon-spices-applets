const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;

const UUID = "window-opacity@ChadXSO";
const MIN = 20; // never let a window go fully invisible

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

// Cinnamon's own window opacity keeps the windows underneath visible.
// Setting only the actor's opacity made Cinnamon skip drawing what was behind.
const NATIVE = typeof Meta.Window.prototype.set_opacity === "function";

function setOpacity(win, actor, value) {
    if (NATIVE) {
        if (actor.opacity !== 255)
            actor.opacity = 255;
        win.set_opacity(value);
    } else {
        actor.opacity = value;
    }
}

function isNormal(win) {
    if (!win)
        return false;
    let type = win.get_window_type();
    if (type !== Meta.WindowType.NORMAL && type !== Meta.WindowType.DIALOG)
        return false;
    return !win.is_skip_taskbar();
}

function appKey(win) {
    return win.get_wm_class() || "unknown";
}

function appName(win) {
    let key = appKey(win);
    if (key.startsWith("crx_") || key === "unknown")
        return (win.get_title() || key).slice(0, 40);
    return key;
}

function toVal(pct) { return (pct - MIN) / (100 - MIN); }
function toPct(val) { return Math.round(MIN + val * (100 - MIN)); }

class WindowOpacityApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.set_applet_icon_symbolic_name("display-brightness-symbolic");
        this.set_applet_tooltip(_("Window opacity (click, or scroll on this icon)"));

        this.target = null;
        this.timers = new Set();
        this.signals = new SignalManager.SignalManager(null);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("default-opacity", "defaultPct", () => {
            this.applyAll();
            this.refresh(true);
        });
        this.apps = this.settings.getValue("apps") || {};

        this._buildMenu(orientation);

        this.signals.connect(global.display, "notify::focus-window", () => this._onFocus());
        this.signals.connect(global.window_manager, "map", (wm, actor) => this._applyLater(actor.get_meta_window()));
        this.signals.connect(global.window_manager, "unminimize", (wm, actor) => this._applyLater(actor.get_meta_window()));

        this.actor.connect("scroll-event", (actor, event) => {
            let dir = event.get_scroll_direction();
            let cur = this._currentPct();
            if (dir === Clutter.ScrollDirection.UP)
                this._setAppPct(Math.min(100, cur + 5), true);
            else if (dir === Clutter.ScrollDirection.DOWN)
                this._setAppPct(Math.max(MIN, cur - 5), true);
            return Clutter.EVENT_STOP;
        });

        this._onFocus();
        this.applyAll();
    }

    _buildMenu(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.appLabel = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this.appLabel);
        this.appSlider = new PopupMenu.PopupSliderMenuItem(1);
        this.appSlider.connect("value-changed", (slider, val) => this._setAppPct(toPct(val), false));
        this.menu.addMenuItem(this.appSlider);

        let solid = new PopupMenu.PopupMenuItem(_("Make this app solid"));
        solid.connect("activate", () => this._setAppPct(100, true));
        this.menu.addMenuItem(solid);

        let useDefault = new PopupMenu.PopupMenuItem(_("Put this app back on the default"));
        useDefault.connect("activate", () => {
            if (!this._targetOk())
                return;
            delete this.apps[appKey(this.target)];
            this._saveApps();
            this.applyAll();
            this.refresh(true);
        });
        this.menu.addMenuItem(useDefault);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.defaultLabel = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this.defaultLabel);
        this.defaultSlider = new PopupMenu.PopupSliderMenuItem(toVal(this.defaultPct));
        this.defaultSlider.connect("value-changed", (slider, val) => {
            this.settings.setValue("default-opacity", toPct(val));
            this.applyAll();
            this.refresh(false);
        });
        this.menu.addMenuItem(this.defaultSlider);
    }

    _saveApps() {
        // pass a copy so the settings layer sees a changed value
        this.settings.setValue("apps", JSON.parse(JSON.stringify(this.apps)));
    }

    _targetOk() {
        return this.target !== null && this.target.get_compositor_private() !== null;
    }

    _pctFor(win) {
        let own = this.apps[appKey(win)];
        return own !== undefined ? own : this.defaultPct;
    }

    _currentPct() {
        return this._targetOk() ? this._pctFor(this.target) : 100;
    }

    _onFocus() {
        let win = global.display.focus_window;
        if (isNormal(win)) {
            this.target = win;
            this._apply(win);
        }
    }

    _apply(win) {
        let actor = win.get_compositor_private();
        if (!actor)
            return;
        let pct = win.is_fullscreen() ? 100 : this._pctFor(win);
        setOpacity(win, actor, Math.round(pct * 2.55));
    }

    _applyLater(win) {
        if (!isNormal(win))
            return;
        // some apps finish mapping a moment after the signal, so apply a few times
        for (let ms of [250, 700, 1500]) {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                this.timers.delete(id);
                if (win.get_compositor_private())
                    this._apply(win);
                return GLib.SOURCE_REMOVE;
            });
            this.timers.add(id);
        }
    }

    applyAll() {
        global.get_window_actors().forEach(actor => {
            let win = actor.get_meta_window();
            if (isNormal(win))
                this._apply(win);
        });
    }

    _setAppPct(pct, moveSlider) {
        if (!this._targetOk())
            return;
        this.apps[appKey(this.target)] = pct;
        this._saveApps();
        this.applyAll();
        this.refresh(moveSlider);
    }

    refresh(moveSlider) {
        this.defaultLabel.label.set_text(_("Default for all apps: %s").format(this.defaultPct + "%"));
        this.defaultSlider.setValue(toVal(this.defaultPct));
        if (!this._targetOk()) {
            this.appLabel.label.set_text(_("Click on a window first"));
            return;
        }
        let pct = this._currentPct();
        let text = appName(this.target) + ": " + pct + "%";
        if (this.apps[appKey(this.target)] === undefined)
            text = _("%s (default)").format(text);
        this.appLabel.label.set_text(text);
        if (moveSlider)
            this.appSlider.setValue(toVal(pct));
    }

    on_applet_clicked() {
        this.refresh(true);
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
        this.timers.forEach(id => GLib.source_remove(id));
        this.timers.clear();
        this.settings.finalize();
        global.get_window_actors().forEach(actor => {
            actor.opacity = 255;
            let win = actor.get_meta_window();
            if (NATIVE && win)
                win.set_opacity(255);
        });
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new WindowOpacityApplet(metadata, orientation, panelHeight, instanceId);
}
