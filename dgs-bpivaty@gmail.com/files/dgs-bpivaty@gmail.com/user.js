#!/usr/bin/gjs

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Secret = imports.gi.Secret;
const Notify = imports.gi.Notify;

let MyWindow;

Gtk.init(null);

MyWindow = function() {
    this._init(this);
}

MyWindow.prototype = {

    _init: function() {

        this.main_win = new Gtk.Window({title:"Dragongoserver logging"});
        
        this.main_win.border_width = 10;

        let main_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        main_box.set_spacing(10);

        this.main_win.set_default_size(350, 100);

        this.main_win.add(main_box);

        main_box.add(new Gtk.Label({label: 'Enter your DGS userid and password'}))

        let box = new Gtk.Box({spacing: 6});
        main_box.add(box);

        let user_label = new Gtk.Label({label: "DGS user:"});
        box.pack_start(user_label, true, true, 0);

        this.username = new Gtk.Entry();
        box.pack_start(this.username, true, true, 0);

        if (ARGV.length > 0) {
            this.username.set_text(ARGV[0]);
        }

        let box2 = new Gtk.Box({spacing: 6});
        main_box.add(box2);

        let passwd_label = new Gtk.Label({label: "Password:"});
        box2.pack_start(passwd_label, true, true, 0);

        this.password = new Gtk.Entry({visibility: false});
        box2.pack_start(this.password, true, true, 0);

        let sep = new Gtk.Separator();
        main_box.pack_start(sep, true, true, 0);

        let box3 = new Gtk.Box({spacing: 6});
        main_box.add(box3);

        this.ok_button = new Gtk.Button({label: 'OK'});
        this.ok_button.connect("clicked", Lang.bind(this, this.on_ok_clicked));
        this.cancel_button = new Gtk.Button({label: 'Cancel'});
        this.cancel_button.connect("clicked", this.on_cancel_clicked);

        box3.pack_start(this.ok_button, true, true, 0);
        box3.pack_start(this.cancel_button, true, true, 0);

        this.ok_button.set_can_default(true);
        this.ok_button.grab_default();

        this.main_win.connect("delete-event", Gtk.main_quit);
    },

    show: function() {
        this.main_win.show_all();
    },

    on_cancel_clicked: function(widget) {
        print (-1);
        Gtk.main_quit();
    },

    on_ok_clicked: function(widget, event) {
        print (this.username.get_text() + ',' + this.password.get_text());
        Gtk.main_quit();
    }
};

let win = new MyWindow();
win.show();
Gtk.main();
