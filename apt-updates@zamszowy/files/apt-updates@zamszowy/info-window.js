#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

function onKeyPress(actor, event) {
    const [, key] = event.get_keyval();
    const [, modifier] = event.get_state();

    if ((key === 65307 /* ESC */) || (key === 119 /* w */ && modifier == 20 /* ctrl */)) {
        actor.close();
        Gtk.main_quit();
    }
}

Gtk.init(null);

let win = new Gtk.Window({ title: ARGV[0] });

let scroll = new Gtk.ScrolledWindow();
scroll.set_size_request(640, 640);

let textview = new Gtk.TextView();
textview.set_editable(false);
textview.buffer.text = new TextDecoder().decode(GLib.file_get_contents(ARGV[1])[1]);

scroll.add(textview);
win.add(scroll);

win.connect("delete-event", () => Gtk.main_quit());
win.connect("key-press-event", onKeyPress);

win.show_all();
Gtk.main();
