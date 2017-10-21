const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;

var UUID;

function _(aStr) {
    let customTrans = Gettext.dgettext(UUID, aStr);

    if (customTrans !== aStr)
        return customTrans;

    return Gettext.gettext(aStr);
}

function MyPopupMenuItem() {
    this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(icon, text, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        this.icon = icon;
        this.addActor(this.icon);
        this.label = new St.Label({
            text: text
        });
        this.addActor(this.label);
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        try {
            this._bindSettings();
            UUID = metadata.uuid;
            this.display_id = 0;
            this.orientation = orientation;
            this.instance_id = instance_id;

            this.menuManager = new PopupMenu.PopupMenuManager(this);

            Main.placesManager.connect("places-updated", Lang.bind(this, this._display));

            this._display();
            this._updateIconAndLabel();
        } catch (e) {
            global.logError(e);
        }
    },

    _bindSettings: function() {
        let bD = Settings.BindingDirection || null;
        let settingsArray = [
            [bD.IN, "pref_applet_label", this._updateIconAndLabel],
            [bD.IN, "pref_applet_icon", this._updateIconAndLabel],
            [bD.IN, "pref_icon_size", this._display],
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this._display();
        this._updateIconAndLabel();
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_applet_icon !== "" ||
                !(this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM)) {
                if (this.pref_applet_icon === "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.pref_applet_icon) &&
                    GLib.file_test(this.pref_applet_icon, GLib.FileTest.EXISTS)) {
                    if (this.pref_applet_icon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.pref_applet_icon);
                    else
                        this.set_applet_icon_path(this.pref_applet_icon);
                } else if (Gtk.IconTheme.get_default().has_icon(this.pref_applet_icon)) {
                    if (this.pref_applet_icon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.pref_applet_icon);
                    else
                        this.set_applet_icon_name(this.pref_applet_icon);
                }
            } else {
                this.hide_applet_icon();
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"%s\" for menu button."
                .format(this.pref_applet_icon));
        }

        if (this.pref_applet_icon === "") {
            if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM)
                this._applet_icon_box.hide();
            else // Display icon box anyways in vertical panels.
                this._applet_icon_box.show();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM) { // no menu label if in a vertical panel
            if (this.pref_applet_label !== "")
                this.set_applet_label(_(this.pref_applet_label));
            else
                this.set_applet_label("");
        } else {
            this.set_applet_label("");
        }

        this.update_label_visible();
    },

    update_label_visible: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _display: function() {
        if (this.display_id > 0) {
            Mainloop.source_remove(this.display_id);
            this.display_id = 0;
        }

        this.display_id = Mainloop.timeout_add(300,
            Lang.bind(this, function() {
                if (this.menu)
                    this.menu.destroy();

                this.menu = new Applet.AppletPopupMenu(this, this.orientation, this.instance_id);
                this.menuManager.addMenu(this.menu);

                let placeid = 0;
                this.placeItems = [];

                this.defaultPlaces = Main.placesManager.getDefaultPlaces();
                this.bookmarks = Main.placesManager.getBookmarks();

                // Display default places
                for (placeid; placeid < this.defaultPlaces.length; placeid++) {
                    let icon = this.defaultPlaces[placeid].iconFactory(this.pref_icon_size);
                    this.placeItems[placeid] = new MyPopupMenuItem(icon, _(this.defaultPlaces[placeid].name));
                    this.placeItems[placeid].place = this.defaultPlaces[placeid];

                    this.menu.addMenuItem(this.placeItems[placeid]);
                    this.placeItems[placeid].connect('activate', function(actor, event) {
                        actor.place.launch();
                    });
                }

                // Display Computer / Filesystem
                let icon = new St.Icon({
                    icon_name: "computer",
                    icon_size: this.pref_icon_size,
                    icon_type: St.IconType.FULLCOLOR
                });
                // TO TRANSLATORS: Could be left blank.
                this.computerItem = new MyPopupMenuItem(icon, _("Computer"));

                this.menu.addMenuItem(this.computerItem);
                this.computerItem.connect('activate', function(actor, event) {
                    Main.Util.spawnCommandLine("xdg-open computer://");
                });

                icon = new St.Icon({
                    icon_name: "harddrive",
                    icon_size: this.pref_icon_size,
                    icon_type: St.IconType.FULLCOLOR
                });
                // TO TRANSLATORS: Could be left blank.
                this.filesystemItem = new MyPopupMenuItem(icon, _("File System"));

                this.menu.addMenuItem(this.filesystemItem);
                this.filesystemItem.connect('activate', function(actor, event) {
                    Main.Util.spawnCommandLine("xdg-open /");
                });

                // Separator
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                let bookmarkid = 0;
                // Display default bookmarks
                for (bookmarkid; bookmarkid < this.bookmarks.length; bookmarkid++, placeid++) {
                    let icon = this.bookmarks[bookmarkid].iconFactory(this.pref_icon_size);
                    this.placeItems[placeid] = new MyPopupMenuItem(icon, _(this.bookmarks[bookmarkid].name));
                    this.placeItems[placeid].place = this.bookmarks[bookmarkid];

                    this.menu.addMenuItem(this.placeItems[placeid]);
                    this.placeItems[placeid].connect('activate', function(actor, event) {
                        actor.place.launch();
                    });
                }
            }));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
