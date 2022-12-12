// Redshift Cinnamon applet
// Marvin Uhlmann 7/8/17
// Version 1.0

const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop; //timer stuff
const Settings = imports.ui.settings;

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "redshift@marvel4u";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

// Schema keys
const ENABLED_ON_STARTUP = 'enabledOnStartup';
const BRIGHTNESS = 'brightness';
const REDSHIFT_DAY_BRIGHTNESS = 'redshiftDayBrightness';
const DAY_COLOUR = 'dayColour';
const CHANGE_ON_NIGHT = 'changeOnNight';
const REDSHIFT_NIGHT_BRIGHTNESS = 'redshiftNightBrightness';
const NIGHT_COLOUR = 'nightColour';
const LATITUDE = 'latitude';
const LONGITUDE = 'longitude';

const ICON_PATH = GLib.get_home_dir() + '/.local/share/cinnamon/applets/redshift@marvel4u/';
const ICON_OFF = ICON_PATH + "Material_Design_Icons/lightbulb.svg";
const ICON_ON = ICON_PATH + "Material_Design_Icons/lightbulb-on-outline.svg";
const ICON_SUNSET = ICON_PATH + "Material_Design_Icons/weather-sunset.svg";

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  return locText;
}


//const SetBrightnessCmd = 'gdbus call --session --dest org.gnome.SettingsDaemon --object-path /org/gnome/SettingsDaemon/Power --method org.gnome.SettingsDaemon.Power.Screen.SetPercentage ';
//const GetBrightnessCmd = 'gdbus call --session --dest org.gnome.SettingsDaemon --object-path /org/gnome/SettingsDaemon/Power --method org.gnome.SettingsDaemon.Power.Screen.GetPercentage';


function MyApplet(orientation, panelHeight, instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_symbolic_path(ICON_OFF);

            this.set_applet_tooltip(_("Brightness")); // applet tooltip

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this.brightnessMenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.brightnessMenuItem);

            //brightness slider control
            this._brightnessSlider = new PopupMenu.PopupSliderMenuItem(0);
            this._brightnessSlider.connect('value-changed', Lang.bind(this, this.brightnessSliderChanged));
            this.menu.addMenuItem(this._brightnessSlider);


            //redshift switch control
            this.redshiftSwitch = new PopupMenu.PopupSwitchMenuItem(_("Redshift"));
            this.redshiftSwitch.connect('toggled', Lang.bind(this, this.doRedshiftSwitch));
            this.menu.addMenuItem(this.redshiftSwitch);

            //redshift colour slider
            this.c_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.c_MenuItem);
            this.c_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.c_Slider.connect('value-changed', Lang.bind(this, this.dayColorSliderChanged));
            this.menu.addMenuItem(this.c_Slider);

            //redshift brightness slider
            this.b_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.b_MenuItem);
            this.b_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.b_Slider.connect('value-changed', Lang.bind(this, this.redshiftDayBrightnessSliderChanged));
            this.menu.addMenuItem(this.b_Slider);

            //redshift change on night control
            this.changeOnNightSwitch = new PopupMenu.PopupSwitchMenuItem(_("Transition on night"));
            this.changeOnNightSwitch.connect('toggled', Lang.bind(this, this.changeOnNightChanged));
            this.menu.addMenuItem(this.changeOnNightSwitch);

            //redshift night colour slider
            this.cn_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.cn_MenuItem);
            this.cn_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.cn_Slider.connect('value-changed', Lang.bind(this, this.nightColorSliderChanged));
            this.menu.addMenuItem(this.cn_Slider);

            //redshift night brightness slider
            this.bn_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.bn_MenuItem);
            this.bn_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.bn_Slider.connect('value-changed', Lang.bind(this, this.redshiftNightBrightnessSliderChanged));
            this.menu.addMenuItem(this.bn_Slider);


            // delay for UI to allow time to get system power level
            Mainloop.timeout_add(500, Lang.bind(this, this.do_UI_update_probe));
            // crashing HD intel, nvidia without ? uncertain why... hack

            // attach scroll event to icon
            //let x = this.get_applet_icon;
            //this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
            // todo: use a St icon with a St box and connect
        }
        catch (e) {
            global.logError(e);
        }


        // bind settings to variables
        this.settings.bindProperty(Settings.BindingDirection.IN,
            ENABLED_ON_STARTUP, "enabled", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            BRIGHTNESS, "brightness", this.do_UI_update_slider, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            REDSHIFT_DAY_BRIGHTNESS, "redshiftDayBrightness", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            DAY_COLOUR, "dayColor", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            CHANGE_ON_NIGHT, "changeOnNight", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            REDSHIFT_NIGHT_BRIGHTNESS, "redshiftNightBrightness", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            NIGHT_COLOUR, "nightColor", this.refreshRedshiftValues, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            LATITUDE, "latitude", this.doRedshiftSwitch, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            LONGITUDE, "longitude", this.doRedshiftSwitch, null);


        this.maxColor = 7000;
        this.minColor = 1000;

        this.maxBrightness = 100;
        this.minBrightness = 10;
        this.appletClicked = false;

        this.do_UI_update_slider();
        this.refreshRedshiftValues();
    },

    on_applet_clicked: function (event) {
        // update brightness UI if values altered by system
        // todo: use watcher on dbus instead
        this.appletClicked = true;
        this.do_UI_update_probe();
        this.menu.toggle();
    },

    getSystemBrightness: function () {
        try {
            let currentBright = GLib.spawn_command_line_sync('gdbus call --session --dest org.cinnamon.SettingsDaemon.Power --object-path /org/cinnamon/SettingsDaemon/Power --method org.cinnamon.SettingsDaemon.Power.Screen.GetPercentage'); //crashes if not hard coded
            currentBright = currentBright.toString();

            // (uint32 53,) std output of getbrightnesscmd, just want 53 value on end
            // split string and get second part numeric value only
            let strArray = currentBright.split(' ');
            currentBright = strArray[1];
            currentBright = parseInt(currentBright); // strip non-numeric
            // global.log("currentbright: " + currentBright);

            if (isNaN(currentBright)) {
                currentBright = 100; // 100% bright as fallback
                global.log("Error getting Cinnamon backlight power settings " + strArray[0] + ' ' + strArray[1]);
            }

            return currentBright / 100;
        } catch (e) {
            global.logError(e);

            return 1; // 100% bright as fallback
        }
    },

    do_UI_update_probe: function () {
        let currentBrightness = this.getSystemBrightness();
        if (this.appletClicked) {
            this._brightnessSlider.setValue(this.brightness / 100); // slider position
        } else {
            this._brightnessSlider.setValue(currentBrightness); // slider position
        }
        this.do_UI_update_slider();
        this.appletClicked = false;
    },

    do_UI_update_colortag: function () {
        this.c_Slider.setValue((this.dayColor - this.minColor) / (this.maxColor - this.minColor));
        let colorStr = _("Redshift day colour") + ": " + this.dayColor + "K";
        this.c_MenuItem.label.text = colorStr; // GUI Label Colour:
    },
    do_UI_update_brightnesstag: function () {
        this.b_Slider.setValue((this.redshiftDayBrightness - this.minBrightness) / (this.maxBrightness - this.minBrightness));
        let brightnessStr = _("Redshift day brightness") + ": " + Math.round(this.redshiftDayBrightness) + "%";
        this.b_MenuItem.label.text = brightnessStr; // GUI Label Brightness:
    },
    do_UI_update_nightColortag: function () {
        this.cn_Slider.setValue((this.nightColor - this.minColor) / (this.maxColor - this.minColor));
        let colorStr = _("Redshift night colour") + ": " + this.nightColor + "K";
        this.cn_MenuItem.label.text = colorStr; // GUI Label Colour:
    },
    do_UI_update_nightBrightnesstag: function () {
        this.bn_Slider.setValue((this.redshiftNightBrightness - this.minBrightness) / (this.maxBrightness - this.minBrightness));
        let brightnessStr = _("Redshift night brightness") + ": " + Math.round(this.redshiftNightBrightness) + "%";
        this.bn_MenuItem.label.text = brightnessStr; // GUI Label Brightness:
    },


    do_UI_update_slider: function () {
        let brightnessStr = _("Brightness") + ": " + this.brightness + "%";
        this.updateTooltip();
        this.brightnessMenuItem.label.text = brightnessStr; // GUI Label Brightness

        try {
            Util.spawnCommandLine('gdbus call --session --dest org.cinnamon.SettingsDaemon.Power --object-path /org/cinnamon/SettingsDaemon/Power --method org.cinnamon.SettingsDaemon.Power.Screen.SetPercentage ' + this.brightness); //crashes if not hard coded
        }
        catch (e) {
            global.logError(e);
        }

    },

    brightnessSliderChanged: function (slider, value) {
        let brightness = parseFloat(value);
        brightness = Math.round(brightness * 100);

        if (brightness < 5) brightness = 5 // safe minimum
        this.brightness = brightness;

        this.do_UI_update_slider(); //update UI from slider value
    },

    dayColorSliderChanged: function (slider, value) {
        this.enabled = true;

        this.dayColor = Math.round(parseFloat(value) * (this.maxColor - this.minColor) + this.minColor);

        this.refreshRedshiftValues();
    },
    nightColorSliderChanged: function (slider, value) {
        this.enabled = true;
        this.changeOnNight = true;

        this.nightColor = Math.round(parseFloat(value) * (this.maxColor - this.minColor) + this.minColor);

        this.refreshRedshiftValues();
    },
    redshiftDayBrightnessSliderChanged: function (slider, value) {
        this.enabled = true;

        this.redshiftDayBrightness = Math.round(parseFloat(value) * (this.maxBrightness - this.minBrightness) + this.minBrightness);

        this.refreshRedshiftValues();
    },
    redshiftNightBrightnessSliderChanged: function (slider, value) {
        this.enabled = true;
        this.changeOnNight = true;

        this.redshiftNightBrightness = Math.round(parseFloat(value) * (this.maxBrightness - this.minBrightness) + this.minBrightness);

        this.refreshRedshiftValues();
    },

    refreshRedshiftValues: function () {
        this.do_UI_update_colortag(); //update UI from slider value
        this.do_UI_update_brightnesstag(); //update UI from slider value
        this.do_UI_update_nightColortag(); //update UI from slider value
        this.do_UI_update_nightBrightnesstag(); //update UI from slider value

        this.changeOnNightSwitch.setToggleState(this.changeOnNight);
        this.redshiftSwitch.setToggleState(this.enabled);
        this.changeOnNightChanged();
    },

    changeOnNightChanged: function () {
        this.changeOnNight = this.changeOnNightSwitch.state;

        this.doRedshiftSwitch();
    },

    doRedshiftSwitch: function () {
        this.enabled = this.redshiftSwitch.state;
        this.updateTooltip();
        // Stop redshift before launch another instance
        Util.spawnCommandLine('redshift -r -x');
        Util.killall('redshift');
        if (this.enabled) {
            // Icon on
            if (this.changeOnNight) {
                this.set_applet_icon_symbolic_path(ICON_SUNSET);

                if (this.latitude && this.longitude) {
                    Util.spawnCommandLine('redshift -r -l ' + this.latitude + ':' + this.longitude
                        + ' -t ' + this.dayColor + ':' + this.nightColor
                        + ' -b ' + (this.redshiftDayBrightness / 100) + ':' + (this.redshiftNightBrightness / 100));
                } else {
                    Util.spawnCommandLine('redshift -r -l geoclue2' + ' -t ' + this.dayColor + ':' + this.nightColor
                        + ' -b ' + (this.redshiftDayBrightness / 100) + ':' + (this.redshiftNightBrightness / 100));
                }
            } else {
                this.set_applet_icon_symbolic_path(ICON_ON);

                Util.spawnCommandLine('redshift -r -O ' + this.dayColor + ' -b ' + (this.redshiftDayBrightness / 100));
            }
        } else {
            // Icon off
            this.set_applet_icon_symbolic_path(ICON_OFF);

            // reset Redshift configuration
            Util.spawnCommandLine('redshift -r -x');
        }
    },

    updateTooltip: function () {
        let tooltip = _('Brightness') + ': ' + this.brightness + '%\n';
        tooltip += _('Redshift') + ': ' + _(this.enabled ? 'On' : 'Off');
        if (this.enabled) {
            tooltip += '\n';
            if (this.changeOnNight) {
                tooltip += _('Day colour temperature') + ': ' + this.dayColor + 'K\n';
                tooltip += _('Night colour temperature') + ': ' + this.nightColor + 'K\n';
                tooltip += _('Day Redshift brightness') + ': ' + this.redshiftDayBrightness + '%\n';
                tooltip += _('Night Redshift brightness') + ': ' + this.redshiftNightBrightness + '%';
            } else {
                tooltip += _('Colour temperature') + ': ' + this.dayColor + 'K\n';
                tooltip += _('Redshift brightness') + ': ' + this.redshiftDayBrightness + '%';
            }
        }
        this.set_applet_tooltip(tooltip);
    },

    // todo: attach to St box using an icon obj
    _onScrollEvent: function (actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            global.log('scrolling down');
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            global.log('scrolling up');
        }
    },
}

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;
}
