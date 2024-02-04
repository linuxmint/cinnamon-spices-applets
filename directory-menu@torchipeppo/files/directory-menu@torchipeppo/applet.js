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

const Lang = imports.lang;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;
const UUID = "directory-menu@torchipeppo";



class CassettoneApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;

        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("starting-uri", "starting_uri", this.normalize_tilde, this.starting_uri);
        this.settings.bind("show-hidden", "show_hidden", null, null);
        this.settings.bind("icon-name", "icon_name", this.set_applet_icon_symbolic_name, null);
        this.settings.bind("tooltip", "tooltip_text", (newtext) => {this.set_applet_tooltip(_(newtext))}, null);
        this.starting_uri = this.normalize_tilde(this.starting_uri);

        this.set_applet_icon_symbolic_name(this.icon_name);
        this.set_applet_tooltip(_(this.tooltip_text));

        this.actor.connect('enter-event', Lang.bind(this, this.on_enter_event));
        this.actor.connect('button-release-event', Lang.bind(this, this.on_button_release_event));
    }

    // essentially an independent JS translation of xapp_favorites_launch from the Favorites Xapp.
    launch(uri, timestamp) {
        let display = Gdk.Display.get_default();
        let launch_context = display.get_app_launch_context();
        launch_context.set_timestamp(timestamp);
        Gio.AppInfo.launch_default_for_uri_async(uri, launch_context, null, this.launch_callback);
    }

    // emulates how nemo handles opening in terminal (using the same flags as Util.spawn)
    open_terminal_at_path(path) {
        let gnome_terminal_preferences = Gio.Settings.new("org.cinnamon.desktop.default-applications.terminal");
        let default_terminal = gnome_terminal_preferences.get_string("exec");
        let argv = [default_terminal];
        let spawn_flags = GLib.SpawnFlags.SEARCH_PATH
                    | GLib.SpawnFlags.STDOUT_TO_DEV_NULL
                    | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
        GLib.spawn_async(path, argv, null, spawn_flags, null);
    }

    launch_callback(source_object, result) {
        if (!Gio.AppInfo.launch_default_for_uri_finish(result)) {
            log("An error has occurred while launching an item of the Directory Menu.")
        }
    }

    normalize_tilde(path) {
        if (path[0] == "~") {
            path = "file://" + GLib.get_home_dir() + path.slice(1);
        }
        return path;
    }

    // straight from https://github.com/linuxmint/cinnamon/blob/master/files/usr/share/cinnamon/applets/xapp-status%40cinnamon.org/applet.js#L293
    getEventPositionInfo() {
        let allocation = Cinnamon.util_get_transformed_allocation(this.actor);

        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale)
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale)

        let final_x, final_y, final_o;

        switch (this._orientation) {
            case St.Side.TOP:
                final_x = x;
                final_y = y + h;
                final_o = Gtk.PositionType.TOP;
                break;
            case St.Side.BOTTOM:
            default:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.BOTTOM;
                break;
            case St.Side.LEFT:
                final_x = x + w;
                final_y = y
                final_o = Gtk.PositionType.LEFT;
                break;
            case St.Side.RIGHT:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.RIGHT;
                break;
        }

        return [final_x, final_y, final_o];
    }

    on_enter_event(actor, event) {
        this._applet_tooltip.preventShow = false;
    }

    on_button_release_event(actor, event) {
        let button = event.get_button();

        if (global.menuStackLength) {
            // If we attempt to open this GTK menu while a Cinnamon panel menu is open,
            // Cinnamon will freeze.
            // This can happen with the panel's context menu (but not an applet's).
            // Returning is a simple fix, but it would be nicer (and riskier?) if it caused the open menu to close.
            return false;
        }

        // this is only for left button release, but it's not like that's a fail condition
        if (button !== 1) {
            return true;
        }

        // start of Cinnamon wrappings
        // https://github.com/linuxmint/cinnamon/blob/master/js/ui/applet.js#L267
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
        // end of Cinnamon wrappings

        this._applet_tooltip.hide();
        this._applet_tooltip.preventShow = true;

        this.starting_uri = this.normalize_tilde(this.starting_uri);

        let [x,y,o] = this.getEventPositionInfo();

        let args = {
            "starting_uri": this.starting_uri,
            "show_hidden": this.show_hidden,
            "x": x,
            "y": y,
            "orientation": o,
        }

        Util.spawn_async(
            ['python3', `${this.metadata.path}/popup_menu.py`, JSON.stringify(args)],
            (response) => {
                if (response) {  // empty response signifies no action
                    response = JSON.parse(response);
                    if (response !== null) {
                        if (response.action == "launch_default_for_uri") {
                            this.launch(response.uri, response.timestamp);
                        }
                        else if (response.action == "open_terminal_at_path") {
                            this.open_terminal_at_path(response.path);
                        }
                        else {
                            log("Python-based menu returned unknown action " + response.action)
                        }
                    }
                }
            }
        );

        return true;
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new CassettoneApplet(metadata, orientation, panel_height, instance_id);
}
