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

const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;

/* Local imports */
const AppletDir = imports.ui.appletManager.appletMeta[AppletUUID].path;
imports.searchPath.unshift(AppletDir);
const Stuff = imports.stuff;

// dbus-send --session --type=method_call --print-reply --dest=org.gnome.Hamster /org/gnome/Hamster org.freedesktop.DBus.Introspectable.Introspect
const ApiProxyIface = '<node> \
<interface name="org.gnome.Hamster"> \
<method name="GetTodaysFacts"> \
  <arg direction="out" type="a(iiissisasii)" /> \
</method> \
<method name="StopTracking"> \
  <arg direction="in"  type="v" name="end_time" /> \
</method> \
<method name="AddFact"> \
  <arg direction="in"  type="s" name="fact" /> \
  <arg direction="in"  type="i" name="start_time" /> \
  <arg direction="in"  type="i" name="end_time" /> \
  <arg direction="in"  type="b" name="temporary" /> \
  <arg direction="out" type="i" /> \
</method> \
<method name="GetActivities"> \
  <arg direction="in"  type="s" name="search" /> \
  <arg direction="out" type="a(ss)" /> \
</method> \
<method name="GetCategories"> \
  <arg direction="out" type="a(is)" /> \
</method> \
<signal name="FactsChanged"></signal> \
<signal name="ActivitiesChanged"></signal> \
<signal name="TagsChanged"></signal> \
</interface> \
</node>';

let ApiProxy = Gio.DBusProxy.makeProxyWrapper(ApiProxyIface);

// dbus-send --session --type=method_call --print-reply --dest=org.gnome.Hamster.WindowServer /org/gnome/Hamster/WindowServer org.freedesktop.DBus.Introspectable.Introspect
const WindowsProxyIface = '<node> \
<interface name="org.gnome.Hamster.WindowServer"> \
<method name="edit"> \
  <arg direction="in"  type="v" name="id" /> \
</method> \
<method name="overview"></method> \
<method name="preferences"></method> \
</interface> \
</node>';

let WindowsProxy = Gio.DBusProxy.makeProxyWrapper(WindowsProxyIface);

function _(str) {
   let translation = Gettext.gettext(str);
   if(translation != str) {
      return translation;
   }
   return Gettext.dgettext(AppletUUID, str);
};

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
        //cursorPos = this._textEntry.clutter_text.cursor_position(this)
        this._textEntry.clutter_text.connect('key-release-event', Lang.bind(this, this._onKeyReleaseEvent));
        //get_int
        //clutter_text_get_cursor_position (ClutterText *self);


        box.add(this._textEntry);

        // autocomplete popup - couldn't spark it up just yet
        //this._popup = new PopupMenu.PopupComboMenu(this._textEntry);

        label = new St.Label({style_class: 'popup-menu-content popup-subtitle-menu-item'});
        label.set_text(_("Todays activities"));
        box.add(label);

        let scrollbox = new St.ScrollView();
        box.add(scrollbox);

        // Since St.Table does not implement StScrollable, we create a
        // container object that does.
        let container = new St.BoxLayout({});
        container.set_vertical(true);
        scrollbox.add_actor(container);

        this.activities = new St.Table();
        container.add(this.activities);

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
            return this.autocompleteActivities;

        this.runningActivitiesQuery = true;
        this.proxy.GetActivitiesRemote("", Lang.bind(this, function([response], err) {
            this.runningActivitiesQuery = false;
            this.autocompleteActivities = response;
        }));

        return this.autocompleteActivities;
    },

    _getCategories: function() {
        if (this.runningCategoriesQuery)
            return this.autocompleteCategories;

        this.runningCategoriesQuery = true;
        this.proxy.GetCategoriesRemote(Lang.bind(this, function([response], err) {
            this.runningCategoriesQuery = false;
            this.autocompleteCategories = response;
        }));

        return this.autocompleteCategories;
    },

    _onKeyReleaseEvent: function(textItem, evt) {
        let symbol = evt.get_key_symbol();
        let text = this._textEntry.get_text().toLowerCase();
        let starttime = "";
        let activitytext = text;
        // Don't include leading times in the activity autocomplete
        let match = [];
        if ((match = text.match(/^\d\d:\d\d /)) ||
            (match = text.match(/^-\d+ /))) {
            starttime = text.substring(0, match[0].length);
            activitytext = text.substring(match[0].length);
        }

        // if nothing has changed or we still have selection then that means
        // that special keys are at play and we don't attempt to autocomplete
        if (activitytext == "" ||
            this._prevText == text ||
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

        // prevent auto-complete if the cursor is not at the end of the text
        if(this._textEntry.clutter_text.get_cursor_position() != -1  ){
            return;
        }

        // category completion
        let atIndex = text.indexOf("@");
        if (atIndex != -1) {
            activitytext = this._textEntry.get_text().substring(0, atIndex);
            let categorytext = text.substring(atIndex+1);
            let allCategories = this._getCategories();
            for each (var cat in allCategories) {
                let completion = cat[1];
                if (completion.toLowerCase().substring(0, categorytext.length) == categorytext) {
                    this.prevText = text;
                    completion = starttime + activitytext + "@" + completion;

                    this._textEntry.set_text(completion);
                    this._textEntry.clutter_text.set_selection(text.length, completion.length);

                    this._prevText = completion.toLowerCase();

                    return;
                }
            }
        }

        // activity completion
        let allActivities = this._getActivities();
        for each (var rec in allActivities) {
            let completion = rec[0];
            if (rec[1].length > 0)
                completion += "@" + rec[1];
            if (completion.toLowerCase().substring(0, activitytext.length) == activitytext) {
                this.prevText = text;
                completion = starttime + completion;

                this._textEntry.set_text(completion);
                this._textEntry.clutter_text.set_selection(text.length, completion.length);
                this._prevText = completion.toLowerCase();
                return;
            }
        }
    }
};


function HamsterApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

HamsterApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._proxy = new ApiProxy(Gio.DBus.session, 'org.gnome.Hamster', '/org/gnome/Hamster');
        this._proxy.connectSignal('FactsChanged',      Lang.bind(this, this.refresh));
        this._proxy.connectSignal('ActivitiesChanged', Lang.bind(this, this.refreshActivities));
        this._proxy.connectSignal('TagsChanged',       Lang.bind(this, this.refresh));


        this._windowsProxy = new WindowsProxy(Gio.DBus.session,
                                              "org.gnome.Hamster.WindowServer",
                                              "/org/gnome/Hamster/WindowServer");

        this.settings = new Settings.AppletSettings(this, "hamster@projecthamster.wordpress.com", instance_id);

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

        // focus menu upon display
        this.menu.connect('open-state-changed', Lang.bind(this,
            function(menu, open) {
                if (open) {
                    this.activityEntry.focus();
                } else {
                    this.activityEntry.blur();
                }
            }
        ));

        this.settings.bind("panel-appearance", "panel_appearance", this.refresh);
        this.settings.bind("show-hamster-dropdown", "hotkey", this.on_keybinding_changed);
        this.on_keybinding_changed();

        // load data
        this.facts = null;
        // refresh the label every 60 secs
        this.timeout = GLib.timeout_add_seconds(0, 60, Lang.bind(this, this.refresh));
        this.refresh();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        let text = this.activityEntry._textEntry.set_text('');
    },

    on_keybinding_changed: function() {
        try {
            Main.keybindingManager.addHotKey("show-hamster-menu",
                                             this.hotkey,
                                             Lang.bind(this, this.on_hotkey_triggered));
        } catch (e) {
            global.logError(e);
        }
    },

    on_hotkey_triggered: function() {
        this.menu.toggle();
        let text = this.activityEntry._textEntry.set_text('');
    },

    refreshActivities: function(proxy, sender) {
        this.activityEntry.autocompleteActivities = [];
        this.refresh();
    },

    refresh: function(proxy, sender) {
        this._proxy.GetTodaysFactsRemote(Lang.bind(this, this._refresh));
        return true;
    },

    _refresh: function([response], err) {
        let facts = [];

        if (err) {
            log(err);
        } else if (response.length > 0) {
            facts = Stuff.fromDbusFacts(response);
        }

        this.currentActivity = null;
        let fact = null;
        if (facts.length) {
            fact = facts[facts.length - 1];
            if (!fact.endTime)
                this.currentActivity = fact;
        }
        this.updatePanelDisplay(fact);

        let activities = this.activityEntry.activities;
        activities.destroy_all_children(); // remove previous entries

        var i = 0;
        for each (fact in facts.reverse()) {
            let label;

            label = new St.Label({style_class: 'popup-menu-item'});
            let text = "%02d:%02d - ".format(fact.startTime.getHours(), fact.startTime.getMinutes());
            if (fact.endTime) {
                text += "%02d:%02d".format(fact.endTime.getHours(), fact.endTime.getMinutes());
            }else{
                text += '   ....'
            }
            label.set_text(text)
            activities.add(label, {row: i, col: 1, x_expand: false});

            label = new St.Label({style_class: 'popup-menu-item'});
            label.set_text(fact.name + (0 < fact.tags.length ? (" #" + fact.tags.join(", #")) : ""));
            activities.add(label, {row: i, col: 2});

            label = new St.Label({style_class: 'popup-menu-item'});
            label.set_text(Stuff.formatDurationHuman(fact.delta));
            activities.add(label, {row: i, col: 3, x_expand: false});


            let icon;
            let button;

            button = new St.Button();

            //icon = new St.Icon({icon_name: "accessories-text-editor-symbolic",
            icon = new St.Icon({icon_name: "emblem-system-symbolic",
                                style_class: 'popup-menu-icon'});

            button.set_child(icon);
            button.fact = fact;
            button.connect('clicked', Lang.bind(this, function(button, event) {
                this._windowsProxy.editSync(GLib.Variant.new('i', [button.fact.id]));
                this.menu.close();
            }));
            activities.add(button, {row: i, col: 4});


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
                    if (button.fact.tags.length) {
                        factStr += " #" + button.fact.tags.join(", #");
                    }

                    this._proxy.AddFactRemote(factStr, 0, 0, false, Lang.bind(this, function(response, err) {
                        // not interested in the new id - this shuts up the warning
                    }));
                    this.menu.close();
                }));

                activities.add(button, {row: i, col: 0});
            }else{
                button = new St.Button();
                icon = new St.Icon({icon_name: "media-playback-stop-symbolic",
                    style_class: 'popup-menu-icon'});

                button.set_child(icon);
                button.connect('clicked',  Lang.bind(this, this._onStopTracking));
                button.fact = fact;
                activities.add(button, {row: i, col: 0});
            }

            i += 1;
        }

        let byCategory = {};
        let categories = [];
        for each (fact in facts) {
            byCategory[fact.category] = (byCategory[fact.category] || 0) + fact.delta;
            if (categories.indexOf(fact.category) == -1)
                categories.push(fact.category);
        }

        let label = "";
        for each (var category in categories) {
            label += category + ": " + Stuff.formatDurationHours(byCategory[category]) +  ", ";
        }
        label = label.slice(0, label.length - 2); // strip trailing comma
        this.activityEntry.summaryLabel.set_text(label);
    },


    updatePanelDisplay: function(fact) {
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
        if (this.panel_appearance == 0) {
            this.set_applet_icon_symbolic_name(this._icon_name);
            this._applet_icon.hide();
            this.set_applet_label(this._label_long);
        } else if (this.panel_appearance == 1) {
            this._applet_icon.show();
            this.set_applet_icon_symbolic_name(this._icon_name);
            this.set_applet_label("");
        } else {
            this._applet_icon.show();
            this.set_applet_icon_symbolic_name(this._icon_name);
            this.set_applet_label(this._label_short);
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
        this._proxy.StopTrackingRemote(GLib.Variant.new('i', [epochSeconds]));
    },

    _onShowHamsterActivate: function() {
        this._windowsProxy.overviewSync();
    },

    _onNewFact: function() {
        this._windowsProxy.editSync(GLib.Variant.new('i', [0]));
    },

    _onShowSettingsActivate: function() {
        this._windowsProxy.preferencesSync();
    },

    _onActivityEntry: function() {
        let text = this.activityEntry._textEntry.get_text();
        this._proxy.AddFactRemote(text, 0, 0, false, Lang.bind(this, function(response, err) {
            // not interested in the new id - this shuts up the warning
        }));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");
    return new HamsterApplet(metadata, orientation, panel_height, instance_id);
}
