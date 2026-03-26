#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;

Gtk.init(null);

let win = new Gtk.Window({title:""});

let box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
win.add(box);

let label = new Gtk.Label({"label":" Device:  "});
box.add(label);

let cbox = new Gtk.ComboBoxText();
for (let i = 0; i < (ARGV.length > 1 ? ARGV.length - 1 : ARGV.length); i+=1) {
   cbox.append("text", ARGV[i]);
}
// last param is active index
cbox.set_active(ARGV.length > 1 ? parseInt(ARGV[ARGV.length - 1], 10) : 0);
box.add(cbox);

let butOK = new Gtk.Button({"label":"OK"});
butOK.connect("clicked", function() {print(cbox.get_active_text()); Gtk.main_quit()});
box.add(butOK);

win.connect("delete-event", () => Gtk.main_quit());
win.connect("key-press-event", function(unused, event) {
   let [ok, key] = event.get_keycode();
   /* ESC */
   if (key == 9) {
      Gtk.main_quit();
   }});

win.show_all();
Gtk.main();
