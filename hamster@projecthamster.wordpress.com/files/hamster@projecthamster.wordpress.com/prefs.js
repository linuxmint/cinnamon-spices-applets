#!/usr/bin/gjs
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

let file_info = getCurrentFile();
const LIB_PATH = file_info[1];
imports.searchPath.unshift(LIB_PATH);
const Convenience = imports.convenience;

const HAMSTER_APPLET_SCHEMA = "org.cinnamon.hamster-applet";

const HamsterSettingsWidget = new GObject.Class({
    Name: 'ProjectHamster.Prefs.HamsterSettingsWidget',
    GTypeName: 'HamsterSettingsWidget',
    Extends: Gtk.VBox,

    _init : function(params) {
        this.parent(params);
        this.margin = 10;

        this._settings = Convenience.getAppletSettings(HAMSTER_APPLET_SCHEMA,
                file_info[1] + "/schemas/");

        let vbox, label;

        label = new Gtk.Label();
        label.set_markup("<b>Positioning</b>")
        label.set_alignment(0, 0.5)
        this.add(label);

        label = new Gtk.Label({margin_top: 20});
        label.set_markup("<b>Appearance in panel</b>")
        label.set_alignment(0, 0.5)
        this.add(label);

        vbox = new Gtk.VBox({margin: 10});
        this.add(vbox);

        let appearanceOptions = new Gtk.ListStore();
        appearanceOptions.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);

        appearanceOptions.set(appearanceOptions.append(), [0, 1], ["Just Label", 0]);
        appearanceOptions.set(appearanceOptions.append(), [0, 1], ["Icon and duration", 1]);
        appearanceOptions.set(appearanceOptions.append(), [0, 1], ["Just icon", 2]);

        let appearanceCombo = new Gtk.ComboBox({model: appearanceOptions});

        let renderer = new Gtk.CellRendererText();
        appearanceCombo.pack_start(renderer, true);
        appearanceCombo.add_attribute(renderer, 'text', 0);
        appearanceCombo.connect('changed', Lang.bind(this, this._onAppearanceChange));
        appearanceCombo.set_active(this._settings.get_int("panel-appearance"))

        vbox.add(appearanceCombo);



        label = new Gtk.Label({margin_top: 20});
        label.set_markup("<b>Global hotkey</b>")
        label.set_alignment(0, 0.5)
        this.add(label);

        vbox = new Gtk.VBox({margin: 10});
        this.add(vbox);
        let entry = new Gtk.Entry({margin_bottom: 10,
                                   margin_top: 5,
                                   text: this._settings.get_strv("show-hamster-dropdown")[0]})
        vbox.add(entry)
        entry.connect('changed', Lang.bind(this, this._onHotkeyChange));

        vbox.add(new Gtk.Label({label: "Reload cinnamon after updating prefs (alt+f2 > r)",
                                margin_top: 70}));
    },

    _onAppearanceChange: function(widget) {
        let [success, iter] = widget.get_active_iter();
        if (!success)
            return;

        let newAppearance = widget.get_model().get_value(iter, 1);

        if (this._settings.get_int("panel-appearance") == newAppearance)
            return;

        this._settings.set_int("panel-appearance", newAppearance)
    },

    _onHotkeyChange: function(widget, bananas) {
        //global.log(widget, bananas)
        let hotkey = widget.get_text()
        let [key, mods] = Gtk.accelerator_parse(hotkey);

        if (key != 0) {
            let parsedName = Gtk.accelerator_name(key, mods);
            this._settings.set_strv("show-hamster-dropdown", [parsedName]);
        }

    }
});

function init() {

}

function buildPrefsWidget() {
    let widget = new HamsterSettingsWidget();
    widget.show_all();

    return widget;
}

const AppletPrefsWindow = new Lang.Class ({
    Name: 'Hamster Applet Preferences',

    _init: function () {
        this.application = new Gtk.Application ();

        this.application.connect('activate', Lang.bind(this, this._onActivate));
        this.application.connect('startup', Lang.bind(this, this._onStartup));
    },

    _onActivate: function () {
        this._window.present ();
    },

    _onStartup: function () {
        this._buildUI ();
    },

    _buildUI: function () {

        this._window = new Gtk.ApplicationWindow  ({
            application: this.application,
            title: "Hamster Applet Preferences",
            default_height: 200,
            default_width: 400,
            window_position: Gtk.WindowPosition.CENTER });

        this._widget = new HamsterSettingsWidget();
        this._window.add (this._widget);
        this._window.show_all();
    },

});

function getCurrentFile() {
    let stack = (new Error()).stack;

    // Assuming we're importing this directly from an extension (and we shouldn't
    // ever not be), its UUID should be directly in the path here.
    let stackLine = stack.split('\n')[1];
    if (!stackLine)
        throw new Error('Could not find current file');

    // The stack line is like:
    //   init([object Object])@/home/user/data/gnome-shell/extensions/u@u.id/prefs.js:8
    //
    // In the case that we're importing from
    // module scope, the first field is blank:
    //   @/home/user/data/gnome-shell/extensions/u@u.id/prefs.js:8
    let match = new RegExp('@(.+):\\d+').exec(stackLine);
    if (!match)
        throw new Error('Could not find current file');

    let path = match[1];
    let file = Gio.File.new_for_path(path);
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}

// Run the application
let app = new AppletPrefsWindow();
app.application.run (ARGV);

