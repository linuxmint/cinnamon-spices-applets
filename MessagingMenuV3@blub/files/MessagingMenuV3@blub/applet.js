const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "MessagingMenuV3@blub";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/* global values */
let icon_path = "/usr/share/cinnamon/theme/";
let compatible_Apps = ["skype", "pidgin", "empathy", "xchat", "kmess", "gajim", "emesene", "qutim", "amsn", "openfetion", "gwibber", "qwit", "turpial", "birdie", "pino", "fbmessenger"];
let compatible_Emails = ["evolution", "postler", "geary", "thunderbird", "KMail2", "claws-mail"];
let compose_Commands = ["evolution mailto:", "postler mailto:", "geary mailto:", "thunderbird -compose", "kmail -compose", "claws-mail --compose"];
let contact_Commands = ["evolution -c contacts", null, null, "thunderbird -addressbook", null, null];

const ICON_SIZE = 22;

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}
TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.actor = new St.BoxLayout({
            style_class: style
        });
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({
                icon_name: icon
            });
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({
            text: text
        });
        if (align === "left") {
            this.actor.add_actor(this.icon, {
                span: 0
            });
            this.actor.add_actor(this.text, {
                span: -1
            });
        } else {
            this.actor.add_actor(this.text, {
                span: 0
            });
            this.actor.add_actor(this.icon, {
                span: -1
            });
        }
    },
    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },
    setText: function(text) {
        this.text.text = text;
    },
    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },
    // retrieve an icon image
    _getIconImage: function(icon_name) {
        let icon_file = icon_path + icon_name + ".svg";
        let file = Gio.file_new_for_path(icon_file);
        let icon_uri = file.get_uri();
        return St.TextureCache.get_default().load_uri_sync(1, icon_uri, 16, 16);
    },
}

function MessengerLauncher(app, menu) {
        this._init(app, menu);
    }
    //How the Menu Entries apear.
MessengerLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function(app, menu) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});
        this._app = app;
        this._menu = menu;
        //Icon for the entries.
        this.label = new St.Label({
            text: app.get_name()
        });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this.addActor(this._icon);
        //Label for the entries.
    },
    activate: function(event) {
        this._menu.actor.hide();
        this._app.activate_full(-1, event.get_time());
        return true;
    }
};
//The actual Applet Menu, deciding the icon and what not, and more.
function MyApplet(orientation) {
    this._init(orientation);
}
MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.set_applet_icon_symbolic_name('mail-unread-symbolic');
            this._showFixedElements();
        } catch (e) {
            global.logError(e);
        }
    },
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    _showFixedElements: function() {
        let availableApps = new Array();
        let availableEmails = new Array();
        let availableComposeCommands = new Array();
        let availableContactCommands = new Array();
        let appsys = Cinnamon.AppSystem.get_default();
        let allApps = appsys.get_all();
        let listedDesktopFiles = new Array();
        for (let y = 0; y < allApps.length; y++) {
            let app = allApps[y];
            let info = app.get_app_info();
            let path = info.get_filename();
            //Get Application Desktop Files
            for (var p = 0; p < compatible_Apps.length; p++) {
                let desktopFile = compatible_Apps[p] + ".desktop";
                if (path.indexOf(desktopFile) != -1 && listedDesktopFiles.indexOf(desktopFile) == -1) {
                    availableApps.push(app);
                    listedDesktopFiles.push(desktopFile);
                }
            }
            //Get Email Desktop Files
            for (var p = 0; p < compatible_Emails.length; p++) {
                let desktopFile2 = compatible_Emails[p] + ".desktop";
                if (path.indexOf(desktopFile2) != -1 && listedDesktopFiles.indexOf(desktopFile2) == -1) {
                    availableEmails.push(app);
                    availableComposeCommands.push(compose_Commands[p]);
                    availableContactCommands.push(contact_Commands[p]);
                    listedDesktopFiles.push(desktopFile2);
                }
            }
        }

        //Adding Simple Application Menus!
        if (availableApps.length > 0) {
            for (var p = 0; p < availableApps.length; p++) {
                let playerApp = availableApps[p];
                let menuItem = new MessengerLauncher(playerApp, this.menu);
                this.menu.addMenuItem(menuItem);
            }
        }

        //Adding simple EMAIL Menus!
        if (availableEmails.length > 0) {
            for (var p = 0; p < availableEmails.length; p++) {
                let emailApp = availableEmails[p];
                let emailItem = new MessengerLauncher(emailApp, this.menu);
                this.menu.addMenuItem(emailItem);
                if (availableComposeCommands[p])
                    this._addCustomCommand("	" + _("Compose New Message..."), availableComposeCommands[p]);
                if (availableContactCommands[p])
                    this._addCustomCommand("	" + _("Contacts"), availableContactCommands[p]);
            }
        }
    },

    _addCustomCommand: function(title, cmd) {
        this.menu.addAction(title, function(event) {
            Util.spawnCommandLine(cmd);
        });
    },
}

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
