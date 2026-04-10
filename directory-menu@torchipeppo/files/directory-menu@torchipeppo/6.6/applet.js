/**
 * Cinnamon applet that replicates the functionality of the "Directory Menu" plugin from Xfce.
 * Written from scratch, not strictly translating the code of said plugin, as the author's first experiment in Cinnamon development.
 * 
 * Took major cues from: Xfce's Directory Menu, Cinnamon's Favorites applet, Mint's XApp status icons and the corresponding applet, and Nemo.
 * And of course the documentation for GLib/Gtk/Gdk/Gio.
 * 
 * "Cassettone" is the codename of this applet. (Italian for "large drawer".)
 * I didn't want to call it directly "Directory Menu" in the code,
 * since a "Menu" is an already existing concept here, i.e. a dropdown menu object.
 */

const Main = imports.ui.main;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;

const { UUID } = require('./helpers');
const { ClassicCassettoneHandler } = require('./cassettoneClassic');
const { NativeCassettoneHandler } = require('./cassettoneNative');

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    let locText = Gettext.dgettext(UUID, text);
    if (locText == text) {
        locText = window._(text);
    }
    return locText;
}


class CassettoneApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this._menuHandler = null;

        this.signalManager = new SignalManager.SignalManager(null);

        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("starting-uri", "starting_uri", this.on_settings_changed);
        this.settings.bind("menu-type", "menu_type", this.on_menu_type_changed);
        this.settings.bind("prefer-native-wayland", "prefer_native_wayland", this.on_menu_type_changed);
        this.settings.bind("show-hidden", "show_hidden", this.on_settings_changed);
        this.settings.bind("icon-name", "icon_name", this.set_applet_icon_symbolic_name);
        this.settings.bind("label", "label", this.set_applet_label);
        this.settings.bind("tooltip", "tooltip_text", (txt) => this.set_applet_tooltip(_(txt)));
        this.settings.bind("show-menu", "show_menu", this.set_keybinding);
        this.settings.bind("limit-characters", "limit_characters", this.on_settings_changed);
        this.settings.bind("character-limit", "character_limit", this.on_settings_changed);
        this.settings.bind("favorites-first", "favorites_first", this.on_settings_changed);
        this.settings.bind("pinned-first", "pinned_first", this.on_settings_changed);
        this.settings.bind("order-by", "order_by", this.on_settings_changed);
        this.settings.bind("show-header", "show_header", this.on_settings_changed);

        this.set_applet_tooltip(_(this.tooltip_text));
        this.set_applet_icon_symbolic_name(this.icon_name);
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_label(this.label)

        this.signalManager.connect(this.actor, 'enter-event', this.on_enter_event, this);
        this.signalManager.connect(this.actor, 'button-release-event', this.on_button_release_event, this);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._initMenuHandler();

        this.set_keybinding();
    }

    _isWaylandSession() {
        try {
            return GLib.getenv("XDG_SESSION_TYPE") === "wayland";
        } catch (e) {
            return false;
        }
    }

    _getEffectiveMenuType() {
        // Handle if classic is selected but we're on Wayland and prefer_native_wayland is true
        if (this.menu_type === "classic" && this.prefer_native_wayland && this._isWaylandSession()) {
            return "native";
        }
        return this.menu_type;
    }

    _initMenuHandler() {
        if (this._menuHandler) {
            this._menuHandler.destroy();
            this._menuHandler = null;
        }

        let effectiveType = this._getEffectiveMenuType();

        if (effectiveType === "native") {
            this._menuHandler = new NativeCassettoneHandler(this);
        } else {
            this._menuHandler = new ClassicCassettoneHandler(this);
        }
    }

    on_settings_changed() {
        if (this._menuHandler && this._menuHandler.onSettingsChanged) {
            this._menuHandler.onSettingsChanged();
        }
    }

    on_menu_type_changed() {
        this._initMenuHandler();
        this.set_keybinding();
    }

    on_enter_event(actor, event) {
        this._applet_tooltip.preventShow = false;
    }

    on_button_release_event(actor, event) {
        let button = event.get_button();

        if (global.menuStackLength && this._getEffectiveMenuType() === "classic") {
            // If we attempt to open the GTK menu while a Cinnamon panel menu is open,
            // Cinnamon will freeze. Return early for classic menu.
            return false;
        }

        if (button !== 1) {
            return true;
        }

        // Start of Cinnamon wrappings
        if (!this._applet_enabled) {
            return false;
        }
        if (!this._draggable.inhibit) {
            return false;
        } else {
            if (this._applet_context_menu.isOpen) {
                this._applet_context_menu.toggle();
            }
        }
        // End of Cinnamon wrappings

        this.open_menu();
        return true;
    }

    open_menu() {
        if (this._menuHandler) {
            this._menuHandler.open();
        }
    }

    set_keybinding() {
        Main.keybindingManager.addHotKey("show-directory-menu-" + this.instance_id,
            this.show_menu, this.open_menu.bind(this));
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("show-directory-menu-" + this.instance_id);

        if (this._menuHandler) {
            this._menuHandler.destroy();
            this._menuHandler = null;
        }

        this.settings.finalize();
        this.signalManager.disconnectAllSignals();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CassettoneApplet(metadata, orientation, panel_height, instance_id);
}
