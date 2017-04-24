// Copyright (C) 2012 - Nanakos Chrysostomos <chris@include.gr>
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "softyubikey@yubiserver.include.gr";
const Util = imports.misc.util
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

let ykey
let yubikey_icon
let softyubikey_settings

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

PopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.icon = new St.Icon({ icon_name: icon,
                                  icon_type: St.IconType.FULLCOLOR,
                                  style_class: 'popup-menu-icon' });
        this.addActor(this.icon);
        this.label = new St.Label({ text: text });
        this.addActor(this.label);

        this.connect('activate', callback);
    }
};

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
	    this.set_applet_icon_path(yubikey_icon);
//	    this.set_applet_icon_name("softyubikey");
            this.set_applet_tooltip(_("Click here to create a OTP"));

	    this.config_item = new PopupMenuItem(_("Configure your SoftYubikey"), Gtk.STOCK_REMOVE, Lang.bind(this, this.config_yubikey));
            this._applet_context_menu.addMenuItem(this.config_item);
        }
        catch (e) {
            global.logError(e);
        }
     },

    config_yubikey: function() {
                Util.trySpawn(['python',softyubikey_settings]);
    },

    on_applet_clicked: function(event) {
            Util.trySpawn(['python',ykey,'\n']);
    }
};

function main(metadata, orientation) {
    ykey = GLib.build_filenamev([metadata.path,'ykey']);
//  yubikey_icon = GLib.build_filenamev([metadata.path,'softyubikey.png']);
    yubikey_icon = GLib.build_filenamev([metadata.path,'softyubikey2.png']);
    softyubikey_settings = GLib.build_filenamev([metadata.path,'softyubikey-settings']);
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
