#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Gettext = imports.gettext;

const UUID = "updates-notifier@zamszowy";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(str) { return Gettext.dgettext(UUID, str); }

Gtk.init(null);

let win = new Gtk.Window({ title: _("Error") });
win.set_default_size(600, 400);

let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
vbox.set_margin_top(8);
vbox.set_margin_bottom(8);
vbox.set_margin_start(8);
vbox.set_margin_end(8);

let scroll = new Gtk.ScrolledWindow();
let textview = new Gtk.TextView();
textview.set_editable(false);
textview.set_cursor_visible(false);
textview.set_wrap_mode(Gtk.WrapMode.WORD);
scroll.add(textview);
vbox.pack_start(scroll, true, true, 0);

let errorFilePath = Gio.File.new_for_path(ARGV[0]).get_path();
let [success, contents] = GLib.file_get_contents(errorFilePath);
if (success) {
    let errorText = typeof TextDecoder !== "undefined" ? new TextDecoder().decode(contents) : String(contents);
    textview.buffer.text = errorText;
} else {
    textview.buffer.text = _("Error log file not found.");
}

win.add(vbox);

win.connect("key-press-event", (_actor, event) => {
    const [, key] = event.get_keyval();
    const [, modifier] = event.get_state();

    if ((key === Gdk.KEY_Escape) || (key === Gdk.KEY_w && modifier === Gdk.ModifierType.CONTROL_MASK)) {
        win.destroy();
        Gtk.main_quit();
        return true;
    }
    return false;
});

win.connect("delete-event", () => {
    Gtk.main_quit();
});

win.show_all();
Gtk.main();
