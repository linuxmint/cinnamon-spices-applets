const Applet = imports.ui.applet;
const { AppletSettings } = imports.ui.settings;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const SignalManager = imports.misc.signalManager;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const PEEK_FILTER = [
    Meta.WindowType.DESKTOP,
    Meta.WindowType.DOCK,
];

class DesktopPeekToggleApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new AppletSettings(this, "just-desktop@linuxtopia", instance_id);
        this.settings.bind("click-action", "click_action");
        this.settings.bind("shift-click-action", "shift_click_action");
        this.settings.bind("middle-click-action", "middle_click_action");
        this.settings.bind("shift-middle-click-action", "shift_middle_click_action");
        this.settings.bind("hover-peek", "hover_peek");
        this.settings.bind("hover-delay", "hover_delay");
        this.settings.bind("peek-opacity", "peek_opacity");
        this.settings.bind("peek-blur", "peek_blur");
        this.settings.bind("show-indicator", "show_indicator");
        this.settings.bind("startup-mode", "startup_mode");
        this.settings.bind("bar-width", "bar_width");
        this.settings.bind("bar-height", "bar_height");
        this.settings.bind("use-custom-color", "use_custom_color");
        this.settings.bind("bar-color", "bar_color");

        try {
            this._nemoSettings = new Gio.Settings({ schema_id: "org.nemo.desktop" });
        } catch (e) {
            global.logError("just-desktop: org.nemo.desktop schema not found: " + e);
            this._nemoSettings = null;
        }

        this.signals = new SignalManager.SignalManager(null);
        this.actor.connect("enter-event", () => this._on_enter());
        this.actor.connect("leave-event", () => this._on_leave());
        this.signals.connect(global.stage, "notify::key-focus", this._on_leave, this);

        this._did_peek = false;
        this._peek_timeout_id = 0;
        this._hidden_by_us = [];

        // Cornerbar-style thin bar (no big icon)
        this.actor.style_class = "applet-cornerbar-box";
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this._line = null;
        this.on_orientation_changed(orientation);

        this._apply_startup_mode();
        this._update_indicator();
        this._apply_bar_style();
        this._update_tooltip();
        this._build_context_menu();
        this.settings.connect("settings-changed", () => {
            this._update_indicator();
            this._apply_bar_style();
            this._update_tooltip();
        });
    }

    on_applet_removed_from_panel() {
        this._cancel_peek_timeout();
        this.signals.disconnectAllSignals();
    }

    on_panel_height_changed() {
        this.on_orientation_changed(this.orientation);
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;
        if (this._line) {
            this._line.destroy();
            this._line = null;
        }
        if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM) {
            this.actor.remove_style_class_name("vertical");
            this._line = new St.BoxLayout({ style_class: "applet-cornerbar" });
            this.actor.add(this._line, {
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
                y_fill: false,
                y_expand: false,
                x_fill: false,
                x_expand: false,
            });
        } else {
            this.actor.add_style_class_name("vertical");
            this._line = new St.BoxLayout({ style_class: "applet-cornerbar vertical", reactive: true, track_hover: true });
            this.actor.add(this._line, {
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
                y_fill: false,
                y_expand: false,
                x_fill: false,
                x_expand: false,
            });
        }
        this._update_indicator();
        this._apply_bar_style();
    }

    _apply_bar_style() {
        if (!this._line)
            return;
        const width = Math.max(2, Math.min(400, this.bar_width || 8));
        const height = Math.max(2, Math.min(60, this.bar_height || 8));
        const base = "min-width:" + width + "px;min-height:" + height + "px;width:" + width + "px;height:" + height + "px;";
        if (this.use_custom_color && this.bar_color)
            this._line.style = base + "background-color:" + this.bar_color + ";border:none;";
        else
            this._line.style = base;
    }

    // ---------- desktop icons ----------

    _icons_hidden() {
        if (!this._nemoSettings)
            return false;
        try {
            return !this._nemoSettings.get_boolean("show-desktop-icons");
        } catch (e) {
            return false;
        }
    }

    _set_icons_hidden(hidden) {
        if (!this._nemoSettings)
            return false;
        try {
            this._nemoSettings.set_boolean("show-desktop-icons", !hidden);
            this._update_indicator();
            this._update_tooltip();
            return true;
        } catch (e) {
            global.logError("just-desktop: cannot set show-desktop-icons: " + e);
            return false;
        }
    }

    _apply_startup_mode() {
        if (this.startup_mode === "show")
            this._set_icons_hidden(false);
        else if (this.startup_mode === "hide")
            this._set_icons_hidden(true);
    }

    // ---------- desklets ----------

    _desklets_hidden() {
        try { return !Main.deskletContainer.actor.visible; } catch (e) { return false; }
    }

    _set_desklets_hidden(hidden) {
        try {
            if (hidden)
                Main.deskletContainer.actor.hide();
            else
                Main.deskletContainer.actor.show();
        } catch (e) {
            global.logError("just-desktop: cannot toggle desklets: " + e);
        }
    }

    _update_indicator() {
        if (!this._line)
            return;
        if (!this.show_indicator || !this._icons_hidden())
            this._line.set_opacity(255);
        else
            this._line.set_opacity(90);
    }

    _update_tooltip() {
        const hidden = this._icons_hidden();
        const tip = hidden
            ? _("Desktop icons hidden — click to restore")
            : _("Click to show desktop, Shift+click toggles icons, hover peeks");
        this.set_applet_tooltip(tip);
    }

    // ---------- peek ----------

    _cancel_peek_timeout() {
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
    }

    _show_all_windows(time) {
        const actors = global.get_window_actors();
        for (let i = 0; i < actors.length; i++) {
            const compositor = actors[i];
            compositor.ease({
                opacity: 255,
                transition: Clutter.AnimationMode.EASE_OUT_SINE,
                duration: time,
            });
            if (this.peek_blur && compositor.eff)
                compositor.remove_effect(compositor.eff);
        }
    }

    _on_enter() {
        if (!this.hover_peek)
            return;
        this._cancel_peek_timeout();
        this._peek_timeout_id = Mainloop.timeout_add(this.hover_delay, () => {
            if (this.actor.hover &&
                !this._applet_context_menu.isOpen &&
                !global.settings.get_boolean("panel-edit-mode")) {
                const actors = global.get_window_actors();
                for (let i = 0; i < actors.length; i++) {
                    const win = actors[i].meta_window;
                    const compositor = actors[i];
                    if (PEEK_FILTER.indexOf(win.get_window_type()) === -1) {
                        if (this.peek_blur) {
                            if (!compositor.eff)
                                compositor.eff = new Clutter.BlurEffect();
                            compositor.add_effect_with_name("peek-blur", compositor.eff);
                        }
                        compositor.ease({
                            opacity: Math.round(this.peek_opacity / 100 * 255),
                            duration: 275,
                            transition: Clutter.AnimationMode.EASE_IN_SINE,
                        });
                    }
                }
                this._did_peek = true;
            }
            this._peek_timeout_id = 0;
            return false;
        });
    }

    _on_leave() {
        if (this._did_peek) {
            this._show_all_windows(200);
            this._did_peek = false;
        }
        this._cancel_peek_timeout();
    }

    // ---------- actions ----------

    on_applet_clicked(event) {
        const mods = Cinnamon.get_event_state(event);
        const shift = (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
        this._perform_action(shift ? this.shift_click_action : this.click_action);
    }

    on_applet_middle_clicked(event) {
        const mods = Cinnamon.get_event_state(event);
        const shift = (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
        this._perform_action(shift ? this.shift_middle_click_action : this.middle_click_action);
    }

    _build_context_menu() {
        const addItem = (label, action) => {
            const item = new PopupMenu.PopupMenuItem(_(label));
            item.connect("activate", () => this._perform_action(action));
            this._applet_context_menu.addMenuItem(item);
        };
        addItem("Show Desktop", "show_desktop");
        addItem("Toggle Icons + Desktop", "hide_icons_toggle");
        addItem("Toggle Icons + Desklets + Desktop", "hide_all_toggle");
        addItem("Only Toggle Icons", "hide_icons_only");
        addItem("Show Desklets", "show_desklets");
        addItem("Show Expo", "show_expo");
        addItem("Show Scale", "show_scale");
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const settingsItem = new PopupMenu.PopupIconMenuItem(
            _("Applet Settings"), "emblem-system", St.IconType.SYMBOLIC
        );
        settingsItem.connect("activate", () => this._open_settings());
        this._applet_context_menu.addMenuItem(settingsItem);
    }

    _open_settings() {
        try {
            if (this.settings && this.settings.openAppletSettings) {
                this.settings.openAppletSettings();
                return;
            }
        } catch (e) {}
        try {
            Util.spawn(["cinnamon-settings", "applets", "just-desktop@linuxtopia"]);
        } catch (e) {
            global.logError("just-desktop: cannot open settings: " + e);
        }
    }

    _perform_action(action) {
        if (action === "show_desktop")
            this._show_desktop();
        else if (action === "hide_icons_toggle")
            this._toggle_icons_and_desktop();
        else if (action === "hide_all_toggle")
            this._toggle_icons_desklets_and_desktop();
        else if (action === "hide_icons_only")
            this._set_icons_hidden(!this._icons_hidden());
        else if (action === "show_desklets")
            this._show_desklets();
        else if (action === "show_expo")
            this._show_expo();
        else if (action === "show_scale")
            this._show_scale();
    }

    _show_desktop() {
        // State-based (not toggle_desktop): immune to the desktop-click
        // desync that breaks the stock cornerbar applet.
        const wins = this._normal_windows();
        const visible = wins.filter(w => {
            try { return !w.minimized; } catch (e) { return false; }
        });
        if (visible.length > 0)
            this._minimize_windows(visible);
        else
            this._restore_windows();
        this._show_all_windows(0);
        this._cancel_peek_timeout();
        this._did_peek = false;
    }

    _normal_windows() {
        // Only minimizable types: stray actors (e.g. override_other)
        // can never minimize, so they must not count as "visible".
        const OK_TYPES = [
            Meta.WindowType.NORMAL,
            Meta.WindowType.DIALOG,
            Meta.WindowType.MODAL_DIALOG,
            Meta.WindowType.UTILITY,
        ];
        const out = [];
        const actors = global.get_window_actors();
        for (let i = 0; i < actors.length; i++) {
            const mw = actors[i].meta_window;
            if (!mw)
                continue;
            try {
                if (OK_TYPES.indexOf(mw.get_window_type()) === -1)
                    continue;
                out.push(mw);
            } catch (e) {}
        }
        return out;
    }

    _minimize_windows(visible) {
        const minimized = [];
        for (let i = 0; i < visible.length; i++) {
            try {
                visible[i].minimize();
                if (visible[i].minimized)
                    minimized.push(visible[i]);
            } catch (e) {}
        }
        this._hidden_by_us = minimized;
    }

    _restore_windows() {
        let targets = (this._hidden_by_us && this._hidden_by_us.length)
            ? this._hidden_by_us
            : this._normal_windows().filter(w => {
                try { return w.minimized; } catch (e) { return false; }
            });
        for (let i = 0; i < targets.length; i++) {
            try { targets[i].unminimize(); } catch (e) {}
        }
        this._hidden_by_us = [];
    }

    _show_desklets() {
        Main.deskletContainer.toggle();
    }

    _show_expo() {
        if (!Main.expo.animationInProgress)
            Main.expo.toggle();
    }

    _show_scale() {
        if (!Main.overview.animationInProgress)
            Main.overview.toggle();
    }

    _toggle_icons_desklets_and_desktop() {
        const nowHidden = this._icons_hidden();
        this._set_icons_hidden(!nowHidden);
        this._set_desklets_hidden(!nowHidden);
        if (!nowHidden)
            this._minimize_windows(this._normal_windows().filter(w => {
                try { return !w.minimized; } catch (e) { return false; }
            }));
        else
            this._restore_windows();
        this._show_all_windows(0);
        this._cancel_peek_timeout();
        this._did_peek = false;
    }

    _toggle_icons_and_desktop() {
        const nowHidden = this._icons_hidden();
        this._set_icons_hidden(!nowHidden);
        // Keep icons and windows in sync without toggle_desktop,
        // so a desktop click in between never desyncs the restore.
        if (!nowHidden)
            this._minimize_windows(this._normal_windows().filter(w => {
                try { return !w.minimized; } catch (e) { return false; }
            }));
        else
            this._restore_windows();
        this._show_all_windows(0);
        this._cancel_peek_timeout();
        this._did_peek = false;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new DesktopPeekToggleApplet(orientation, panel_height, instance_id);
}
