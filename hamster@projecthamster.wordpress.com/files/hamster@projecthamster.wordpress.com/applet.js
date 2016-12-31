/*
 * Simple Hamster applet for Cinnamon
 * Copyright (c) 2013 Jon Brett <jonbrett.dev@gmail.com>
 *
 * Based on the Hamster Gnome shell extension
 * Copyright (c) 2011 Jerome Oufella <jerome@oufella.com>
 * Copyright (c) 2011-2012 Toms Baugis <toms.baugis@gmail.com>
 * Icons Artwork Copyright (c) 2012 Reda Lazri <the.red.shortcut@gmail.com>
 *
 * Portions originate from the gnome-shell source code, Copyright (c)
 * its respectives authors.
 * This project is released under the GNU GPL License.
 * See COPYING for details.
 *
 */

const AppletUUID = "hamster@projecthamster.wordpress.com";
const HAMSTER_APPLET_SCHEMA = "org.cinnamon.hamster-applet";

const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

/* Local imports */
const AppletDir = imports.ui.appletManager.appletMeta[AppletUUID].path;
imports.searchPath.unshift(AppletDir);
const Stuff = imports.stuff;
const Convenience = imports.convenience;

// TODO - why are we not using dbus introspection here or something?
let ApiProxy = DBus.makeProxyClass({
    name: 'org.gnome.Hamster',
    methods: [
        {name: 'GetTodaysFacts', inSignature: '', outSignature: 'a(iiissisasii)'},
        {name: 'StopTracking', inSignature: 'i'},
        {name: 'Toggle', inSignature: ''},
        {name: 'AddFact', inSignature: 'siib', outSignature: 'i'},
        {name: 'GetActivities', inSignature: '', outSignature: 'a(ss)'},
    ],
    signals: [
        {name: 'TagsChanged', inSignature: ''},
        {name: 'FactsChanged', inSignature: ''},
        {name: 'ActivitiesChanged', inSignature: ''},
        {name: 'ToggleCalled', inSignature: ''},
    ]
});


let WindowsProxy = DBus.makeProxyClass({
    name: 'org.gnome.Hamster.WindowServer',
    methods: [
        {name: 'edit', inSignature: 'i'},
        {name: 'overview', inSignature: ''},
        {name: 'about', inSignature: ''},
        {name: 'statistics', inSignature: ''},
        {name: 'preferences', inSignature: ''},
    ]
});



/* a little box or something */
function HamsterBox() {
    this._init.apply(this, arguments);
}

HamsterBox.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(itemParams) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {reactive: false});

        let box = new St.BoxLayout();
        box.set_vertical(true);

        let label = new St.Label({style_class: 'popup-menu-content popup-subtitle-menu-item'});
        label.set_text(_("What are you doing?"))
        box.add(label);

        this._textEntry = new St.Entry({name: 'searchEntry',
                                        can_focus: true,
                                        track_hover: false,
                                        hint_text: _("Enter activity..."),
                                        style_class: 'popup-menu-item',
                                        style: 'selected-color: black;'});
        this._textEntry.clutter_text.connect('activate', Lang.bind(this, this._onEntryActivated));
        this._textEntry.clutter_text.connect('key-release-event', Lang.bind(this, this._onKeyReleaseEvent));


        box.add(this._textEntry);

        // autocomplete popup - couldn't spark it up just yet
        //this._popup = new PopupMenu.PopupComboMenu(this._textEntry)

        label = new St.Label({style_class: 'popup-menu-content popup-subtitle-menu-item'});
        label.set_text(_("Todays activities"))
        box.add(label);

        let scrollbox = new St.ScrollView();
        box.add(scrollbox);

        // Since St.Table does not implement StScrollable, we create a
        // container object that does.
        let container = new St.BoxLayout({});
        container.set_vertical(true);
        scrollbox.add_actor(container);

        this.activities = new St.Table()
        container.add(this.activities)

        this.summaryLabel = new St.Label({style_class: 'popup-menu-content popup-subtitle-menu-item'});
        box.add(this.summaryLabel);


        this.addActor(box);

        this.autocompleteActivities = [];
        this.runningActivitiesQuery = null;

        this._prevText = "";
    },

    focus: function() {
        global.stage.set_key_focus(this._textEntry);
    },

    blur: function() {
        global.stage.set_key_focus(null);
    },

    _onEntryActivated: function() {
        this.emit('activate');
        this._textEntry.set_text('');
    },


    _getActivities: function() {
        if (this.runningActivitiesQuery)
            return this.autocompleteActivities

        this.runningActivitiesQuery = true;
        this.proxy.GetActivitiesRemote(DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            this.runningActivitiesQuery = false;
            this.autocompleteActivities = response;
        }));

        return this.autocompleteActivities;
    },

    _onKeyReleaseEvent: function(textItem, evt) {
        let symbol = evt.get_key_symbol();
        let text = this._textEntry.get_text().toLowerCase();

        // if nothing has changed or we still have selection then that means
        // that special keys are at play and we don't attempt to autocomplete
        if (this._prevText == text ||
            this._textEntry.clutter_text.get_selection()) {
            return;
        }
        this._prevText = text;

        // ignore deletions
        let ignoreKeys = [Clutter.BackSpace, Clutter.Delete, Clutter.Escape]
        for each (var key in ignoreKeys) {
            if (symbol == key)
                return;
        }


        let allActivities = this._getActivities();
        for each (var rec in allActivities) {
            if (rec[0].toLowerCase().substring(0, text.length) == text) {
                this.prevText = text;

                this._textEntry.set_text(rec[0]);
                this._textEntry.clutter_text.set_selection(text.length, rec[0].length)

                this._prevText = rec[0].toLowerCase();

                return;
            }
        }
    }
};


function HamsterApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

HamsterApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height);

        this._proxy = new ApiProxy(DBus.session, 'org.gnome.Hamster', '/org/gnome/Hamster');
        this._proxy.connect('FactsChanged',      Lang.bind(this, this.refresh));
        this._proxy.connect('ActivitiesChanged', Lang.bind(this, this.refreshActivities));
        this._proxy.connect('TagsChanged',       Lang.bind(this, this.refresh));


        this._windowsProxy = new WindowsProxy(DBus.session,
                                              "org.gnome.Hamster.WindowServer",
                                              "/org/gnome/Hamster/WindowServer")

        this._settings = Convenience.getAppletSettings(HAMSTER_APPLET_SCHEMA,
                metadata.path + "/schemas/");
        this.path = metadata.path;

        // Set initial label, icon, activity
        this._label = _("Loading...");
        this.set_applet_label(this._label);

        Gtk.IconTheme.get_default().append_search_path(metadata.path + "/images/");
        this._trackingIcon = "hamster-tracking";
        this._idleIcon = "hamster-idle";
        this.set_applet_icon_symbolic_name("hamster-tracking");

        this.currentActivity = null;

        // Create applet menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Add HamsterBox to menu
        let item = new HamsterBox()
        item.connect('activate', Lang.bind(this, this._onActivityEntry));
        this.activityEntry = item;
        this.activityEntry.proxy = this._proxy; // lazy proxying
        this.menu.addMenuItem(item);

        // overview
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        item = new PopupMenu.PopupMenuItem(_("Show Overview"));
        item.connect('activate', Lang.bind(this, this._onShowHamsterActivate));
        this.menu.addMenuItem(item);

        // stop tracking
        item = new PopupMenu.PopupMenuItem(_("Stop Tracking"));
        item.connect('activate', Lang.bind(this, this._onStopTracking));
        this.menu.addMenuItem(item);

        // add new task
        item = new PopupMenu.PopupMenuItem(_("Add Earlier Activity"));
        item.connect('activate', Lang.bind(this, this._onNewFact));
        this.menu.addMenuItem(item);

        // settings
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        item = new PopupMenu.PopupMenuItem(_("Tracking Settings"));
        item.connect('activate', Lang.bind(this, this._onShowSettingsActivate));
        this.menu.addMenuItem(item);

        // applet settings
        item = new PopupMenu.PopupMenuItem(_("Applet Settings"));
        item.connect('activate', Lang.bind(this, this._onAppletSettingsActivate));
        this.menu.addMenuItem(item);

        // Focus HamsterBox when menu is opened
        this.menu.connect('open-state-changed', Lang.bind(this,
            function(menu, open) {
                if (open) {
                    this.activityEntry.focus();
                } else {
                    this.activityEntry.blur();
                }
            }
        ));

        // Add global hotkey (works in Cinnamon >= 1.8)
        this.hotkey = "" + this._settings.get_strv("show-hamster-dropdown");
        try {
            Main.keybindingManager.addHotKey("show-hamster-menu",
                    this.hotkey,
                    Lang.bind(this, this.on_hotkey_triggered));
        } catch (e) {
            global.logError(e);
        }

        // load data
        this.facts = null;
        // refresh the label every 60 secs
        this.timeout = GLib.timeout_add_seconds(0, 60, Lang.bind(this, this.refresh))
        this.refresh();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        let text = this.activityEntry._textEntry.set_text('');
    },

    on_hotkey_triggered: function() {
        this.menu.toggle();
        let text = this.activityEntry._textEntry.set_text('');
    },

    refreshActivities: function() {
        this.activityEntry.autocompleteActivities = [];
        this.refresh();
    },

    refresh: function() {
        this._proxy.GetTodaysFactsRemote(DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            let facts = Stuff.fromDbusFacts(response);

            this.currentActivity = null;
            let fact = null;
            if (facts.length) {
                fact = facts[facts.length - 1];
                if (!fact.endTime)
                    this.currentActivity = fact;
            }
            this.updatePanelDisplay(fact);

            let activities = this.activityEntry.activities
            activities.destroy_all_children() // remove previous entries

            var i = 0;
            for each (var fact in facts) {
                let label;

                label = new St.Label({style_class: 'popup-menu-item'});
                let text = "%02d:%02d - ".format(fact.startTime.getHours(), fact.startTime.getMinutes());
                if (fact.endTime) {
                    text += "%02d:%02d".format(fact.endTime.getHours(), fact.endTime.getMinutes());
                }
                label.set_text(text)
                activities.add(label, {row: i, col: 0, x_expand: false});

                label = new St.Label({style_class: 'popup-menu-item'});
                label.set_text(fact.name + (0 < fact.tags.length ? (" #" + fact.tags.join(", #")) : ""));
                activities.add(label, {row: i, col: 1});

                label = new St.Label({style_class: 'popup-menu-item'});
                label.set_text(Stuff.formatDurationHuman(fact.delta))
                activities.add(label, {row: i, col: 2, x_expand: false});


                let icon;
                let button;

                button = new St.Button();

                icon = new St.Icon({icon_name: "document-open-symbolic",
                                    style_class: 'popup-menu-icon'});

                button.set_child(icon);
                button.fact = fact;
                button.connect('clicked', Lang.bind(this, function(button, event) {
                    this._windowsProxy.editRemote(button.fact.id, DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
                        // TODO - handle exceptions perhaps
                    }));
                    this.menu.close();
                }));
                activities.add(button, {row: i, col: 3});


                if (!this.currentActivity ||
                    this.currentActivity.name != fact.name ||
                    this.currentActivity.category != fact.category ||
                    this.currentActivity.tags.join(",") != fact.tags.join(",")) {
                    button = new St.Button();

                    icon = new St.Icon({icon_name: "media-playback-start-symbolic",
                                    style_class: 'popup-menu-icon'});

                    button.set_child(icon);
                    button.fact = fact;

                    button.connect('clicked', Lang.bind(this, function(button, event) {
                        let factStr = button.fact.name
                                      + "@" + button.fact.category
                                      + ", " + (button.fact.description);
                        if (button.fact.tags) {
                            factStr += " #" + button.fact.tags.join(", #");
                        }

                        this._proxy.AddFactRemote(factStr,
                                                  0, 0, false, DBus.CALL_FLAG_START,
                                                  Lang.bind(this, function(response, err) {
                            // not interested in the new id - this shuts up the warning
                        }));
                        this.menu.close();
                    }));

                    activities.add(button, {row: i, col: 4});
                }

                i += 1;
            }

            let byCategory = {};
            let categories = [];
            for each (var fact in facts) {
                byCategory[fact.category] = (byCategory[fact.category] || 0) + fact.delta;
                if (categories.indexOf(fact.category) == -1)
                    categories.push(fact.category)
            };

            let label = "";
            for each (var category in categories) {
                label += category + ": " + Stuff.formatDurationHours(byCategory[category]) +  ", ";
            }
            label = label.slice(0, label.length - 2); // strip trailing comma
            this.activityEntry.summaryLabel.set_text(label);

        }));

        return true;
    },


    updatePanelDisplay: function(fact) {
        // 0 = show label, 1 = show icon + duration, 2 = just icon
        let appearance = this._settings.get_int("panel-appearance");

        /* Format label strings and icon */
        if (fact && !fact.endTime) {
            this._label_short = Stuff.formatDuration(fact.delta);
            this._label_long = this._label_short + " " + fact.name;
            this._icon_name = "hamster-tracking";
        } else {
            this._label_short = _("No Activity");
            this._label_long = this._label_short;
            this._icon_name = "hamster-idle";
        }

        /* Configure based on appearance setting */
        if (appearance == 0) {
            this.set_applet_icon_symbolic_name("none");
            this.set_applet_label(this._label_long);
        } else if (appearance == 1) {
            this.set_applet_icon_symbolic_name(this._icon_name);
            this.set_applet_label(this._label_short);
        } else {
            this.set_applet_icon_symbolic_name(this._icon_name);
            this.set_applet_label("");
        }
        this.set_applet_tooltip(this._label_long);
    },


    _onStopTracking: function() {
        let now = new Date();
        let epochSeconds = Date.UTC(now.getFullYear(),
                                    now.getMonth(),
                                    now.getDate(),
                                    now.getHours(),
                                    now.getMinutes(),
                                    now.getSeconds());
        epochSeconds = Math.floor(epochSeconds / 1000);
        this._proxy.StopTrackingRemote(epochSeconds, DBus.CALL_FLAG_START);
    },

    _onShowHamsterActivate: function() {
        this._windowsProxy.overviewRemote(DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            // TODO - handle exceptions perhaps
        }));
    },

    _onNewFact: function() {
        this._windowsProxy.editRemote(0, DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            // TODO - handle exceptions perhaps
        }));
    },

    _onShowSettingsActivate: function() {
        this._windowsProxy.preferencesRemote(DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            // TODO - handle exceptions perhaps
        }));
    },

    _onAppletSettingsActivate: function() {
        GLib.spawn_command_line_async(this.path + '/prefs.js');
    },

    _onActivityEntry: function() {
        let text = this.activityEntry._textEntry.get_text();
        this._proxy.AddFactRemote(text, 0, 0, false, DBus.CALL_FLAG_START, Lang.bind(this, function(response, err) {
            // not interested in the new id - this shuts up the warning
        }));
    }
};

function main(metadata, orientation, panel_height) {
    /* Use local translations
     * TODO: Update translations to make them specific to this applet */
    Gettext.bindtextdomain("hamster-shell-extension", metadata.path + "/locale");
    Gettext.textdomain("hamster-shell-extension");
    return new HamsterApplet(metadata, orientation, panel_height);
}
