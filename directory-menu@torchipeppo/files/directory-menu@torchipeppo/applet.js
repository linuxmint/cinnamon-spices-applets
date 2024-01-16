/**
 * Cinnamon applet that attempts to replicate the functionality of the "Directory Menu" plugin from Xfce.
 * Written fron scratch, not strictly translating the code of said plugin, as the author's first experiment in Cinnamon development.
 * 
 * Took major cues from: Xfce's Directory Menu, Cinnamon's Favorites applet, and Nemo.
 * And of course the documentation for GLib/Gtk/Gdk/Gio.
 * 
 * "Cassettone" is the codename of this applet. (Italian for "large drawer".)
 * I didn't want to call it directly "Directory Menu" in the code,
 * since a "Menu" is an already existing concept here, i.e. a dropwown menu object.
 */

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const UUID = "directory-menu@torchipeppo";



class CassettoneApplet extends Applet.IconApplet {

    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("starting-uri", "starting_uri", this.normalize_tilde, this.starting_uri);
        this.settings.bind("show-hidden", "show_hidden", null, null);
        this.settings.bind("just-clicked-timeout", "justclicked_timeout", null, null);
        this.starting_uri = this.normalize_tilde(this.starting_uri);

        this.set_applet_icon_symbolic_name("folder-symbolic");
        this.set_applet_tooltip(_("Directory Menu"));

        this.main_menu = Gtk.Menu.new();

        // this prevents the menu from disappearing immediately,
        // since a GTK popup menu will disappear if the mouse is released while
        // the cursor sprite is not over the menu
        // (which can happen b/c the menu is forbidden from appearing
        // on the panel)
        this.just_clicked = false;
        // so, if menu would be hidden when it was "just clicked",
        // nevermind that and show it anyway
        this.main_menu.connect("hide", () => {
            if (this.just_clicked) {
                this.just_clicked = false;
                this.main_menu.popup(null, null, null, 0, Gtk.get_current_event_time());
            }
            else {
                this.destroy_all_children_later(this.main_menu);
            }
        });
    }

    populate_menu_with_directory(menu, directory_uri) {
        const directory = Gio.File.new_for_uri(directory_uri);
        // First, the two directory actions: Open Folder and Open In Terminal

        let open_item = Gtk.ImageMenuItem.new_with_label("Open Folder");
        let open_image = Gtk.Image.new_from_icon_name("folder", Gtk.IconSize.MENU);
        open_item.set_image(open_image);
        open_item.connect("activate", () => {
            this.launch(directory.get_uri(), Gtk.get_current_event_time());
        });
        menu.append(open_item);

        let term_item = Gtk.ImageMenuItem.new_with_label("Open in Terminal");
        let term_image = Gtk.Image.new_from_icon_name("terminal", Gtk.IconSize.MENU);
        term_item.set_image(term_image);
        term_item.connect("activate", () => {
            this.open_terminal_at_path(directory.get_path());
        });
        menu.append(term_item);

        menu.append(Gtk.SeparatorMenuItem.new());

        const iter = directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

        let dirs = [];
        let nondirs = [];

        var info = iter.next_file(null);
        while (info != null) {
            if (!info.get_is_hidden() || this.show_hidden) {     // <-- skip hidden files
                info.display_name = info.get_display_name();
                info.content_type = info.get_content_type();
                info.file = directory.get_child_for_display_name(info.display_name);
                info.is_directory = (info.get_content_type() == "inode/directory");
    
                if (info.is_directory) {
                    dirs.push(info);
                }
                else {
                    nondirs.push(info);
                }
            }

            var info = iter.next_file(null);
        }

        dirs.sort((a,b) => strcmp_insensitive(a.display_name, b.display_name));
        nondirs.sort((a,b) => strcmp_insensitive(a.display_name, b.display_name));

        dirs.forEach(info => this.add_to_menu_from_gioinfo(menu, info));
        nondirs.forEach(info => this.add_to_menu_from_gioinfo(menu, info));
    }

    add_to_menu_from_gioinfo(menu, info) {
        let display_text = info.display_name;

        let icon = Gio.content_type_get_icon(info.content_type);
        let image = Gtk.Image.new_from_gicon(icon, Gtk.IconSize.MENU);

        let uri = info.file.get_uri();

        let item = Gtk.ImageMenuItem.new_with_label(display_text);
        item.set_image(image);

        if (info.is_directory) {
            let subMenu = this.create_subdirectory_submenu(uri);
            item.set_submenu(subMenu);
        }
        else {
            item.connect("activate", () => {
                this.launch(uri, Gtk.get_current_event_time());
            });
        }
        menu.append(item);
    }

    create_subdirectory_submenu(uri) {
        let subMenu = Gtk.Menu.new();

        subMenu.connect("show", () => {
            this.populate_menu_with_directory(subMenu, uri);
            subMenu.show_all();
        });

        subMenu.connect("hide", () => {
            this.destroy_all_children_later(subMenu);
        });

        return subMenu;
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

    destroy_all_children_later(menu) {
        menu.foreach((subItem)=>{
            // destroy at some future instant, but not right now so we have time for the activate event
            GLib.idle_add(GLib.G_PRIORITY_HIGH_IDLE, ()=>{
                subItem.destroy();
                return false;
            });
        });
    }

    normalize_tilde(path) {
        if (path[0] == "~") {
            path = "file://" + GLib.get_home_dir() + path.slice(1);
        }
        return path;
    }

    on_applet_clicked() {
        this.starting_uri = this.normalize_tilde(this.starting_uri);

        // the applet is considered "just clicked" for a short time in order
        // to prevent instant disappearing (see constructor).
        // in the author's empirical tests, 75 ms are fine for a mouse,
        // 175~180 ms for a touchpad.
        this.just_clicked = true;
        Util.setTimeout(()=>{this.just_clicked = false;}, this.justclicked_timeout);

        this.populate_menu_with_directory(this.main_menu, this.starting_uri);
        this.main_menu.show_all();

        this.main_menu.popup(null, null, null, 0, Gtk.get_current_event_time());
    }

}

// now unused
// function sleep(ms) {
//     return new Promise(r => Util.setTimeout(r, ms));
// }

function strcmp_insensitive(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CassettoneApplet(orientation, panel_height, instance_id);
}

