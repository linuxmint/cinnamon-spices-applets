const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const MAX_BYTES = 65536;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    settings: null,

    menu: null,
    menuManager: null,

    menuItemBrightnessValue: null,
    menutItemBrightnessSlider: null,
    menutItemBrightnessDefault1: null,
    menutItemBrightnessDefault2: null,

    menuItemContrastValue: null,
    menutItemContrastSlider: null,

    currBrightnessValue: undefined,
    currContrastValue: undefined,
 

    _init: function (orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("notification-display-brightness");
        this.set_applet_tooltip(_("Adjust external monitor brightness and contrast"));

        // Init menu
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.connect('open-state-changed', Lang.bind(this, this._on_menu_toggle_change));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        // Init settings
        this.settings = new Settings.AppletSettings(this, 'ddcci-monitor-control@andr35', instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'brightness-default-label-1', 'brightness_default_label_1', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'brightness-default-value-1', 'brightness_default_value_1', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'brightness-default-label-2', 'brightness_default_label_2', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'brightness-default-value-2', 'brightness_default_value_2', this.onSettingsChanged, null);

    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    _on_menu_toggle_change: function () {

        this.menu.removeAll();

        if (this.menu.isOpen) {

            // Add menu items /////////////////////////////////////////////////////////////////////

            this.menuItemBrightnessValue = new MonitorPropertyItem(this._get_brightness_label(this.currBrightnessValue), 'display-brightness-high');
            this.menu.addMenuItem(this.menuItemBrightnessValue);

            this.menutItemBrightnessSlider = new PopupMenu.PopupSliderMenuItem(this.currBrightnessValue || 0); // Value
            this.menu.addMenuItem(this.menutItemBrightnessSlider);

            this.menutItemBrightnessDefault1 = new PopupMenu.PopupMenuItem(
                this._get_default_button_label(this.brightness_default_label_1, this.brightness_default_value_1),
                { reactive: true }
            );
            this.menu.addMenuItem(this.menutItemBrightnessDefault1);

            this.menutItemBrightnessDefault2 = new PopupMenu.PopupMenuItem(
                this._get_default_button_label(this.brightness_default_label_2, this.brightness_default_value_2),
                { reactive: true }
            );
            this.menu.addMenuItem(this.menutItemBrightnessDefault2);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menuItemContrastValue = new MonitorPropertyItem(this._get_contrast_label(this.currContrastValue), 'display-brightness');
            this.menu.addMenuItem(this.menuItemContrastValue);

            this.menutItemContrastSlider = new PopupMenu.PopupSliderMenuItem(this.currContrastValue || 0); // Value
            this.menu.addMenuItem(this.menutItemContrastSlider);


            // Initialize menu items //////////////////////////////////////////////////////////////

            this.menutItemBrightnessSlider.connect("drag-end", Lang.bind(this, this._brightness_slider_changed));

            this.menutItemBrightnessDefault1.connect('activate', Lang.bind(this, function () {
                this._set_current_brightness(this.brightness_default_value_1);
            }));
            this.menutItemBrightnessDefault2.connect('activate', Lang.bind(this, function () {
                this._set_current_brightness(this.brightness_default_value_2);
            }));

            this.menutItemContrastSlider.connect("drag-end", Lang.bind(this, this._contrast_slider_changed));

            // Init applet ////////////////////////////////////////////////////////////////////////


            this._get_current_brightness()
                .then(Lang.bind(this, function () {
                    this._get_current_contrast()
                }));

            this._update();
        }
    },

    _on_settings_changed() {
        this._update();
    },

    _update: function () {
        this.menuItemBrightnessValue.set_text(this._get_brightness_label(this.currBrightnessValue));
        this.menuItemContrastValue.set_text(this._get_contrast_label(this.currContrastValue));

        if (this.currBrightnessValue === undefined) {
            this.menutItemBrightnessSlider.actor.hide();
        } else {
            this.menutItemBrightnessSlider.setValue(this.currBrightnessValue);
            this.menutItemBrightnessSlider.actor.show();
        }

        if (this.currContrastValue === undefined) {
            this.menutItemContrastSlider.actor.hide();
        } else {
            this.menutItemContrastSlider.setValue(this.currContrastValue);
            this.menutItemContrastSlider.actor.show();
        }
    },


    _brightness_slider_changed: function (slider) {
        if (slider._value) {
            let nextBrightnessValue = Math.round(slider._value * 100);
            this._set_current_brightness(nextBrightnessValue);
        }
    },

    _contrast_slider_changed: function (slider) {
        if (slider._value) {
            let nextContrastValue = Math.round(slider._value * 100);
            this._set_current_contrast(nextContrastValue);
        }
    },


    _get_current_brightness: function () {
        return new Promise(Lang.bind(this, function (resolve, reject) {

            this.menutItemBrightnessSlider.actor.hide();

            // this._spawn_cmd(['ddcutil', 'capabilities', '|', 'grep', 'Brightness'])
            this._spawn_cmd(['ddcutil', 'getvcp', '10'])
                .then(Lang.bind(this, function (res) {
                    const matchRes = res.match(/current value =\s*(\d+)/);

                    if (matchRes[1]) {
                        const value = parseInt(matchRes[1]);
                        this.currBrightnessValue = value / 100;
                        this._update();
                    }

                    resolve();
                }))
                .catch(Lang.bind(this, function (err) {
                    reject();
                }));

        }));
    },

    _set_current_brightness: function (value) {

        // Ensure is a number
        if (typeof value !== 'number') {
            return;
        }

        // Ensure is value
        if (value > 100 || value <= 0) {
            return;
        }

        this._spawn_cmd(['ddcutil', 'setvcp', '10', '' + value])

        this.currBrightnessValue = value / 100;
        this._update();
    },


    _get_brightness_label(brightness) {
        let label = "Current Brightness: %s";
        return label.format(brightness === undefined ? 'N.A.' : ("%d%".format(brightness * 100)));
    },


    _get_current_contrast: function () {
        return new Promise(Lang.bind(this, function (resolve, reject) {

            this.menutItemContrastSlider.actor.hide();

            // this._spawn_cmd(['ddcutil', 'capabilities', '|', 'grep', 'Contrast'])
            this._spawn_cmd(['ddcutil', 'getvcp', '12'])
                .then(Lang.bind(this, function (res) {
                    const matchRes = res.match(/current value =\s*(\d+)/);

                    if (matchRes[1]) {
                        const value = parseInt(matchRes[1]);
                        this.currContrastValue = value / 100;
                        this._update();
                    }

                    resolve();
                }))
                .catch(Lang.bind(this, function (err) {
                    reject();
                }));

        }));
    },

    _set_current_contrast: function (value) {

        // Ensure is a number
        if (typeof value !== 'number') {
            return;
        }

        // Ensure is value
        if (value > 100 || value <= 0) {
            return;
        }

        this._spawn_cmd(['ddcutil', 'setvcp', '12', '' + value])

        this.currContrastValue = value / 100;
        this._update();
    },

    _get_contrast_label(contrast) {
        let label = "Current Contrast: %s";
        return label.format(contrast === undefined ? 'N.A.' : ("%d%".format(contrast * 100)));
    },

    _get_default_button_label(label, value) {
        return label + " (" + value + "%)";
    },


    _spawn_cmd: function (cmd) {
        return new Promise(Lang.bind(this, function (resolve, reject) {

            try {

                // Spawn cmd
                let proc = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                let res = '';
                let resErr = '';

                // Read from stdout
                let streamOut = proc.get_stdout_pipe();
                streamOut.read_bytes_async(MAX_BYTES, 0, null, Lang.bind(this, function (o, result) {
                    let data = o.read_bytes_finish(result);
                    res = res + data.get_data().toString();
                }));

                // Read from stderr
                let streamErr = proc.get_stderr_pipe();
                streamErr.read_bytes_async(MAX_BYTES, 0, null, Lang.bind(this, function (o, result) {
                    let data = o.read_bytes_finish(result);
                    resErr = resErr + data.get_data().toString();
                }));

                proc.wait_async(null, Lang.bind(this, function (o, result) {
                    proc = null;
                    o.wait_finish(result);

                    if (res) {
                        resolve(res);
                    } else {
                        reject(resErr);
                    }
                }));

            } catch (e) {

                reject(e);

                if (e.code === 8) { // Program not found
                    this._show_help_msg();
                }

            }

        }));
    },

    _show_help_msg: function () {

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let item = new PopupMenu.PopupMenuItem(
            "This applet requires \"ddcutil\" to work.\n" +
            "Please, install it running the following commands (with sudo):\n" +
            "  - \"apt install ddcutil i2c-tools\"\n" +
            "  - \"usermod -aG i2c $USER\"",
            { reactive: false }
        );
        this.menu.addMenuItem(item);

    },

};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}


class MonitorPropertyItem extends PopupMenu.PopupBaseMenuItem {
    constructor(label, icon) {
        super({ reactive: false });

        this._box = new St.BoxLayout({ style_class: 'popup-device-menu-item' });
        this._vbox = new St.BoxLayout({ style_class: 'popup-device-menu-item', vertical: true });

        this.label = new St.Label({ text: label });
        this._icon = new St.Icon({ icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });

        this._box.add_actor(this._icon);
        this._box.add_actor(this.label);

        this._vbox.add_actor(this._box);

        this.addActor(this._vbox);
    }

    set_text(text) {
        this.label.set_text(text);
    }


}