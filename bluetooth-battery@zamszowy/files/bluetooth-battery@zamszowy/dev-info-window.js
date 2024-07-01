#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;

Gtk.init(null);

let win = new Gtk.Window({title:ARGV[0]});

let scroll = new Gtk.ScrolledWindow();
scroll.set_size_request(640, 480);

let textview = new Gtk.TextView();
textview.set_editable(false);
textview.buffer.text = ARGV[1]

scroll.add(textview);

win.add(scroll);

win.connect("delete-event", () => Gtk.main_quit());
win.connect("key-press-event", function(unused, event) {
   let [ok, key] = event.get_keycode();
   /* ESC */
   if (key == 9) {
      Gtk.main_quit();
   }});

win.show_all();
Gtk.main();
