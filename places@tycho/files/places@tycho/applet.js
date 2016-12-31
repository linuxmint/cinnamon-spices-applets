const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

// this should end up in settings?
const FILE_MANAGER = "nemo";
const ICON_SIZE = 22;

function MyMenuItem() {
    this._init.apply(this, arguments);
}

MyMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(icon, text, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        let box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        box.add(icon);
        box.add(new St.Label({text: text }));
        this.addActor(box);
    }
};

function MyTrashItem() {
    this._init.apply(this, arguments);
}

MyTrashItem.prototype = {
    __proto__: MyMenuItem.prototype,

    _init: function(file, text, params) {
        this.trash = file;
        let icon_name = (this.isEmpty()) ? "trashcan_empty" : "trashcan_full";
        let icon = new St.Icon({ icon_name: icon_name, icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR });
        MyMenuItem.prototype._init.call(this, icon, text, params);

        if(!this.isEmpty()) {
            let icon = new St.Icon({ icon_name: 'edit-clear', icon_size: 16, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
            this.button = new St.Button({child: icon, tooltip_text: _("Empty Trash") });
            this.button.connect('clicked', Lang.bind(this, this.doEmpty));
            this.addActor(this.button);
        }
    },

    doEmpty: function() {
        let children = this.trash.enumerate_children('*', 0, null, null);
        let info = null;
        while ((info = children.next_file(null, null)) != null) {
            this.trash.get_child(info.get_name()).delete(null);
        }
        this.button.hide();
        this.applet.on_applet_clicked();
    },

    isEmpty: function() {
        let children = this.trash.enumerate_children('*', 0, null, null);
        if (children.next_file(null, null) == null) {
            return true;
        }
        return false;
    }
}; 

function MyDeviceItem() {
    this._init.apply(this, arguments);
}

MyDeviceItem.prototype = {
    __proto__: MyMenuItem.prototype,

    _init: function(icon, text, params) {
        MyMenuItem.prototype._init.call(this, icon, text, params);

        let eject_icon = new St.Icon({ icon_name: 'media-eject', icon_size: 16, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.eject = new St.Button({ child: eject_icon, tooltip_text: _("Eject Device") });
        this.eject.connect('clicked', Lang.bind(this, this.doEject));
        this.addActor(this.eject);
    },

    doEject: function() {
        if(this.device) {
            this.device.remove();
            this.eject.hide();
            this.applet.on_applet_clicked();
        }
    }
}; 

function MyPlaceItem() {
    this._init.apply(this, arguments);
}

MyPlaceItem.prototype = {
    __proto__: MyMenuItem.prototype,

    _init: function(icon, text, params) {
        MyMenuItem.prototype._init.call(this, icon, text, params);

        let eject_icon = new St.Icon({ icon_name: 'media-eject', icon_size: 16, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.eject = new St.Button({ child: eject_icon, tooltip_text: _("Eject Bookmark") });
        this.eject.hide();
        this.eject.connect('clicked', Lang.bind(this, this.doEject));
        this.addActor(this.eject);
    },

    doEject: function() {
        if(this.device) {
            this.device.remove();
            this.eject.hide();
            this.applet.on_applet_clicked();
        }
    }
}; 

function MyMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

MyMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(launcher, orientation) {
        this._launcher = launcher;

        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }
};

function MyApplet(orientation, metadata, height, instance) {
    this._init(orientation, metadata, height, instance);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, metadata, height, instance) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, height, instance);
        this.orientation = orientation;
        this.map = {};

        try {

            // bind and apply settings
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance);
            this.settings.bindProperty(Settings.BindingDirection.IN, "panelLabel", "panelLabel", this.doPanelLabel);
            this.settings.bindProperty(Settings.BindingDirection.IN, "showTrash", "showTrash", this.changeTrash);
            this.settings.bindProperty(Settings.BindingDirection.IN, "showDevices", "showDevices", this.changeDevices);

            this.doPanelLabel();
            this.set_applet_tooltip(_("Places"));

            // generate menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new MyMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // generate sections and items
            this.places = new PopupMenu.PopupMenuSection();
            this.devices = new PopupMenu.PopupMenuSection();
            this.trash = new PopupMenu.PopupMenuSection();
            this.trash_file = Gio.file_new_for_uri("trash:///");

            this.createHome();
            this.createPlaces();
            this.createDevices();
            this.separator = new PopupMenu.PopupSeparatorMenuItem();
            this.createComputer();
            this.createConnect();
            this.createNetwork();
            this.createTrash();

            // watch connections...
            this.watchPlaces = Main.placesManager.connect('bookmarks-updated', Lang.bind(this, this.changePlaces));
            this.watchDevices = Main.placesManager.connect('mounts-updated', Lang.bind(this, this.changeDevices));
            this.monitor = this.trash_file.monitor_directory(0, null, null);
            this.watchTrash = this.monitor.connect('changed', Lang.bind(this, this.changeTrash));

            // outline actual menu
            this.menu.addMenuItem(this.homeItem);
            this.menu.addMenuItem(this.places);
            this.menu.addMenuItem(this.devices);
            this.menu.addMenuItem(this.separator);
            this.menu.addMenuItem(this.computerItem);
            this.menu.addMenuItem(this.connectItem);
            this.menu.addMenuItem(this.networkItem);
            this.menu.addMenuItem(this.trash);
        }
        catch(err) {
            global.logError(err);
        };
    },

    destroy: function() {
        Main.placesManager.disconnect(this.watchPlaces);
        Main.placesManager.disconnect(this.watchDevices);
        this.monitor.disconnect(this.watchTrash);
        this.map = {};
        Applet.TextIconApplet.prototype.destroy.call(this);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    createHome: function() {
        let icon = new St.Icon({icon_name: "user-home", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.homeItem = new MyMenuItem(icon, _("Home"));
        this.homeItem.connect('activate', function(actor, event) {
            Main.Util.spawnCommandLine(FILE_MANAGER);
        });
    },

    createComputer: function() {
        let icon = new St.Icon({icon_name: "computer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.computerItem = new MyMenuItem(icon, _("Computer"));
        this.computerItem.connect('activate', function(actor, event) {
            Main.Util.spawnCommandLine(FILE_MANAGER + " computer://");
        });
    },

    createConnect: function() {
        let icon = new St.Icon({icon_name: "gnome-globe", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.connectItem = new MyMenuItem(icon, _("Connect to..."));
        this.connectItem.connect('activate', function(actor, event) {
            Main.Util.spawnCommandLine(FILE_MANAGER + "-connect-server");
        });
    },

    createNetwork: function() {
        let icon = new St.Icon({icon_name: "network-workgroup", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.networkItem = new MyMenuItem(icon, _("Network"));
        this.networkItem.connect('activate', function(actor, event) {
            Main.Util.spawnCommandLine(FILE_MANAGER + " network:///");      
        });
    },

    createTrash: function() {
        if(!this.showTrash) {
            return;
        }

        let item = new MyTrashItem(this.trash_file, _("Trash"));
        item.applet = this;

        item.connect('activate', function(actor, event) {
            Main.Util.spawnCommandLine(FILE_MANAGER + " trash:///");
        });

        this.trash.addMenuItem(item);
    },

    createDevices: function() {
        // hide all active eject buttons...
        for(var key in this.map) {
            this.map[key].eject.hide();
        }

        if(!this.showDevices) {
            return;
        }

        let devices = Main.placesManager.getMounts();
        for(let device = 0; device < devices.length; device++) {
            let icon = devices[device].iconFactory(ICON_SIZE);
            let item = new MyDeviceItem(icon, _(devices[device].name));
            let url = devices[device].id.replace(/^mount:/,'');

            // if mount is also bookmarked, add eject to bookmark directly
            if(this.map[url]) {
                this.map[url].device = devices[device];
                this.map[url].eject.show();
                continue;
            }

            // otherwise create mount reference here...
            this.devices.addMenuItem(item);
            item.applet = this;
            item.device = devices[device];
            item.connect('activate', function(actor, event) {
                actor.device.launch();
			});
        }
    },

    createPlaces: function() {
        let places = Main.placesManager.getBookmarks();
        for(let place = 0; place < places.length; place++) {
            let icon = places[place].iconFactory(ICON_SIZE);
            let url = places[place].id.replace(/^bookmark:/,'');

            let item = new MyPlaceItem(icon, _(places[place].name));
            this.places.addMenuItem(item);
            this.map[url] = item;

            item.url = url;
            item.applet = this;
            item.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine(FILE_MANAGER + " " + actor.url);
            });
        }
    },

    changeDevices: function() {
        this.devices.removeAll();
        this.createDevices();
    },

    changePlaces: function() {
        this.map = {};
        this.places.removeAll();
        this.createPlaces();
        this.changeDevices();   // update bookmark ejects...
    },

    changeTrash: function() {
        this.trash.removeAll();
        this.createTrash();
    },

    doPanelLabel: function() {
        switch(this.panelLabel) {
        case 0:
            this.set_applet_icon_name("user-home");
            this.set_applet_label("");
            break;
        case 1:
            this.set_applet_icon_symbolic_name("user-home");
            this.set_applet_label("");
            break;
        case 2:
            this.set_applet_icon_name("user-home");
            this.set_applet_label(_("Places"));
            break;
        }
    }
}

function main(metadata, orientation, height, instance) {
    let myApplet = new MyApplet(orientation, metadata, height, instance);
    return myApplet;
}
