const Applet = imports.ui.applet;

const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
// const Gio = imports.gi.Gio;
// const Gtk = imports.gi.Gtk;
// const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Signals = imports.signals;

const Gettext = imports.gettext;
const UUID = "qredshift@quintao";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}


global.DEBUG = true;

const QUtils = require('./js/QUtils.js');

const qLOG = QUtils.qLOG;
const lerp = QUtils.lerp;

const QIcon = QUtils.QIcon;
const QPopupHeader = QUtils.QPopupHeader;
const QPopupIconBar = QUtils.QPopupIconBar;
const QPopupSlider = QUtils.QPopupSlider;
const QPopupSwitch = QUtils.QPopupSwitch;



const BASE_CONF = "/assets/base.conf";
const ICON_OFF = "/assets/light-off.svg";
const ICON_ON = "/assets/light-on.svg";

const S_ICON_OFF = "redshift-status-off-symbolic";
const S_ICON_ON = "redshift-status-on-symbolic";





class QRedshift extends Applet.TextIconApplet {
    
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.metadata = metadata;
        
        this.opt = {
            redshift_version: 0,
            enabled: true,
            autoUpdate: false,
            autoUpdateInterval: 30,
            adjustmentMethod: 'randr',
            labelScrollAction: 'disabled',
            iconLabel: false,
            iconLabelAlways: true,
            symbolicIcon: false,
            
            keyToggle: '',
            keyBrightnessUp: '',
            keyBrightnessDown: '',
            keyTempUp: '',
            keyTempDown: '',
            keyGammaUp: '',
            keyGammaDown: '',
            
            dayTemp: 6500,
            dayBrightness: 1,
            gammaMix: 1,
            
            enabledNight: false,
            manualNightTime: false,
            nightStart: {
                h: 0,
                m: 0
            },
            nightEnd: {
                h: 0,
                m: 0
            },
            nightTemp: 6500,
            nightBrightness: 1,
            
            locationLatitude: '0',
            locationLongitude: '0',
            period: '-'
        };
        
        this.time = {
            nightStart: {
                h: 0,
                m: 0
            },
            nightEnd: {
                h: 0,
                m: 0
            },
        }
        
        // Bind Settings
        this.settings = new Settings.AppletSettings(this.opt, metadata.uuid, instance_id);
        this.settings.getDesc = function (key) {
            if (this.settingsData[key] && this.settingsData[key].description)
                return this.settingsData[key].description;
            return '';
        };
        
        this.settings.bind('enabled', 'enabled', this.onSettChange.bind(this));
        this.settings.bind('autoUpdate', 'autoUpdate', this.onSettChange.bind(this));
        this.settings.bind('autoUpdateInterval', 'autoUpdateInterval', this.onSettChange.bind(this));
        this.settings.bind('adjustmentMethod', 'adjustmentMethod', this.onSettChange.bind(this));
        this.settings.bind('labelScrollAction', 'labelScrollAction');
        this.settings.bind('iconLabel', 'iconLabel', () => {
            this.hide_applet_label(!this.opt.iconLabel);
            this.enabledLabel.setToggleState(this.opt.iconLabel);
            if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
        });
        this.settings.bind('symbolicIcon', 'symbolicIcon', (value) => {
            // this.opt.symbolicIcon = value;
            this.setIcon();
        });
        
        
        this.settings.bind('dayTemp', 'dayTemp', this.onSettChange.bind(this));
        this.settings.bind('dayBrightness', 'dayBrightness', this.onSettChange.bind(this));
        this.settings.bind('gammaMix', 'gammaMix', this.onSettChange.bind(this));
        
        this.settings.bind('enabledNight', 'enabledNight', this.onSettChange.bind(this));
        this.settings.bind('manualNightTime', 'manualNightTime', this.onSettChange.bind(this));
        this.settings.bind('nightTemp', 'nightTemp', this.onSettChange.bind(this));
        this.settings.bind('nightBrightness', 'nightBrightness', this.onSettChange.bind(this));
        
        this.settings.bind('nightTimeStart', 'nightStart', (value) => {
            // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
            if (this.opt.nightStart.h !== this.time.nightStart.h || this.opt.nightStart.m !== this.time.nightStart.m) {
                this.time.nightStart.h = this.opt.nightStart.h;
                this.time.nightStart.m = this.opt.nightStart.m;
                
                // qLOG("NIGHT START", this.opt.nightStart);
                this.doUpdate();
            }
        });
        this.settings.bind('nightTimeEnd', 'nightEnd', (value) => {
            // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
            if (this.opt.nightEnd.h !== this.time.nightEnd.h || this.opt.nightEnd.m !== this.time.nightEnd.m) {
                this.time.nightEnd.h = this.opt.nightEnd.h;
                this.time.nightEnd.m = this.opt.nightEnd.m;
                
                // qLOG("NIGHT END", this.opt.nightEnd);
                this.doUpdate();
            }
        });
        
        
        this.settings.bind('locationLatitude', 'locationLatitude', this.onSettChange.bind(this));
        this.settings.bind('locationLongitude', 'locationLongitude', this.onSettChange.bind(this));
        
        this.settings.bind("keyToggle", "keyToggle", this.onKeyChanged.bind(this));
        this.settings.bind("keyBrightnessUp", "keyBrightnessUp", this.onKeyChanged.bind(this));
        this.settings.bind("keyBrightnessDown", "keyBrightnessDown", this.onKeyChanged.bind(this));
        this.settings.bind("keyTempUp", "keyTempUp", this.onKeyChanged.bind(this));
        this.settings.bind("keyTempDown", "keyTempDown", this.onKeyChanged.bind(this));
        this.settings.bind("keyGammaUp", "keyGammaUp", this.onKeyChanged.bind(this));
        this.settings.bind("keyGammaDown", "keyGammaDown", this.onKeyChanged.bind(this));
        
        
        this.time.nightStart.h = this.opt.nightStart.h;
        this.time.nightStart.m = this.opt.nightStart.m;
        this.time.nightEnd.h = this.opt.nightEnd.h;
        this.time.nightEnd.m = this.opt.nightEnd.m;
        
        
        
        this.setIcon();
        this.set_applet_label("QRedshift Loading...");
        
        this.hide_applet_label(!this.opt.iconLabel);
        if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
        
        
        qLOG("QRedshift", 'Created');
        
        this.maxBrightness = 100;
        this.minBrightness = 10;
        this.maxColor = 9000;
        this.minColor = 1000;
        
        this.colorStep = 50;
        
        
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.createPopup();
        
        this.appMenu = this.menu;
        
        // Reload BTN
        let reload_btn = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), 'view-refresh-symbolic', QIcon.SYMBOLIC, {hover: true});
        reload_btn.connect('activate', this.reloadApplet.bind(this));
        this._applet_context_menu.addMenuItem(reload_btn);
        // this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        let recompile_btn = new PopupMenu.PopupIconMenuItem(_("Recompile Translations"), 'preferences-desktop-locale-symbolic', QIcon.SYMBOLIC, {hover: true});
        recompile_btn.connect('activate', this.recompileTranslations.bind(this));
        this._applet_context_menu.addMenuItem(recompile_btn);
        
        
        
        this.actor.connect('scroll-event', (actor, event) => {
            // this.labelHidden = !this.labelHidden;
            // this.hide_applet_label(this.labelHidden);
            
            let action = this.opt.labelScrollAction;
            if (action === 'on_off') {
                let direction = event.get_scroll_direction();
                if (direction == 0 && !this.opt.enabled) {
                    this.enabledDay.setToggleState(true);
                    this.opt.enabled = true;
                    this.doUpdate();
                } else if (direction == 1 && this.opt.enabled) {
                    this.enabledDay.setToggleState(false);
                    this.opt.enabled = false;
                    this.doUpdate();
                }
            } else if (action === 'temp') {
                this.dc_Slider._onScrollEvent(actor, event);
            } else if (action === 'bright') {
                this.db_Slider._onScrollEvent(actor, event);
                this.nb_Slider._onScrollEvent(actor, event);
            } else if (action === 'gamma') {
                this.gm_Slider._onScrollEvent(actor, event);
            }
            
            // qLOG('Scroll', this.opt.labelScrollAction);
            //
            // let key = event.get_key_symbol();
            //
            // qLOG('Key', key);
            
        });
        
        
        // qLOG("KEY|");
        this.onKeyChanged();
        
        this.running = false;
        this.timeout_info = false;
        
        // --- Async Loading ---
        this.verifyVersion(() => {
            this.menu = this._applet_context_menu;
            
            this.timeout_info = Mainloop.timeout_add_seconds(1, () => {
                qLOG('Redshift required!');
                this.setIcon();
                this.set_applet_label(_("REDSHIFT NOT INSTALLED!"));
                this.set_applet_tooltip(_("Requires Redshift: sudo apt-get install redshift"));
            }, null);
            
        }, (success) => {
            Mainloop.source_remove(this.timeout_info)
            // Set Menu
            this.menu = this.appMenu;
            
            // Disable Redshift
            this.disableRedshiftService();
            
            // Load Informations
            this.setAdjustmentMethods(false);
            this.setLocation(false);
            
            this.doUpdate();
            
        });
        
    }
    
    check_period() {
        let date = new Date();
        let d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), 0);
        
        let date_s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightStart.h, this.time.nightStart.m, 0);
        let date_e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightEnd.h, this.time.nightEnd.m, 0);
        
        let night = false;
        let percent = 1;
        
        if (date_s <= date_e) {
            night = d >= date_s && d <= date_e;
        } else if (date_s > date_e && d >= date_s) {
            night = d >= date_s;
        } else {
            night = d < date_e;
        }
        if (d.getTime() == date_s.getTime()) {
            percent = date.getSeconds() / 60;
        } else if (d.getTime() == date_e.getTime()) {
            percent = date.getSeconds() / 60;
        }
        
        return {'period': night ? 'night' : 'day', 'is_night': night, 'percent': percent};
    }
    
    setIcon() {
        // qLOG('ICON', this.opt.symbolicIcon);
        
        if (this.opt.symbolicIcon) {
            // this.set_applet_icon_symbolic_path('');
            if (this.opt.enabled)
                this.set_applet_icon_symbolic_name(S_ICON_ON);
            else
                this.set_applet_icon_symbolic_name(S_ICON_OFF);
        } else {
            this.set_applet_icon_symbolic_path('');
            if (this.opt.enabled)
                this.set_applet_icon_symbolic_path(this.metadata.path + ICON_ON);
            else
                this.set_applet_icon_symbolic_path(this.metadata.path + ICON_OFF);
        }
    }
    
    
    verifyVersion(before = false, success = false) {
        if (before) before();
        
        try {
            let cmd = "redshift -V";
            Util.spawn_async(GLib.shell_parse_argv(cmd)[1], (out) => {
                let mts = /redshift\s*(\d+.?\d*)/gi.exec(out.trim());
                if (mts.length == 2) this.opt.redshift_version = parseFloat(mts[1]);
                
                // qLOG('DEBUG', this.opt.redshift_version);
                if (success) success(true);
            });
        } catch (e) {}
        
        
    }
    
    disableRedshiftService() {
        Util.spawn_async(GLib.shell_parse_argv("systemctl is-enabled --user redshift")[1], (out) => {
            if (out.toString().trim() === 'enabled') {
                Util.spawnCommandLine('systemctl mask --user redshift');
                qLOG('QRedshift', 'Disabling Service');
            }
        });
        
        Util.spawn_async(GLib.shell_parse_argv("systemctl is-active --user redshift")[1], (out) => {
            if (out.toString().trim() === 'active') {
                Util.spawnCommandLine('systemctl stop --user redshift');
                qLOG('QRedshift', 'Stopping Service');
            }
        });
        
    }
    
    checkLocalConfig() {
        try {
            let home = GLib.get_home_dir();
            let exists = GLib.file_test(home + '/.config/redshift.conf', 16);
            return exists;
        } catch (e) {
            return true;
        }
    }
    
    setAdjustmentMethods(force = false) {
        let methods = this.settings.getOptions('adjustmentMethod');
        if (!methods.needload && !force) return;
        
        const regex = new RegExp(/^\s+(\w+)$/gm);
        
        let cmd = "redshift -m list";
        Util.spawn_async(GLib.shell_parse_argv(cmd)[1], (out) => {
            let mts = out.match(regex).map(s => s.trim());
            let opts = {};
            mts.forEach(value => { opts[value] = value;});
            this.settings.setOptions('adjustmentMethod', opts);
        });
        
    }
    
    setLocation(force = true) {
        let remoteEnable = this.settings.getValue('locationRemote');
        
        if (this.opt.locationLatitude != "0" && this.opt.locationLongitude != "0" && !force && !remoteEnable) return;
        
        Util.spawn_async(['curl', 'https://geolocation-db.com/json/'], (out) => {
            let {city, state, country_name, latitude, longitude} = JSON.parse(out);
            let info = `${city}, ${state}, ${country_name}`;
            this.opt.locationLatitude = `${latitude}`;
            this.opt.locationLongitude = `${longitude}`;
        });
        
    }
    
    doUpdate() {
        this.redShiftUpdate();
        
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = undefined;
        }
        
        if (this.opt.enabled && this.opt.autoUpdate) {
            this.timeout = Mainloop.timeout_add_seconds(this.opt.autoUpdateInterval, this.doUpdate.bind(this), null);
            // qLOG('auto update', this.opt.autoUpdateInterval);
        }
    }
    
    
    onKeyChanged() {
        // Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
        // qLOG("KEY Changed", this.opt.keyToggle + "", typeof this.opt.keyToggle);
        // qLOG(this.opt.keyToggle + "");
        
        Main.keybindingManager.addHotKey("keyBrightnessUp", this.opt.keyBrightnessUp, (event) => {
            this.db_Slider._setValueEmit(this.db_Slider.value + this.db_Slider.STEP);
            this.nb_Slider._setValueEmit(this.nb_Slider.value + this.nb_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyBrightnessDown", this.opt.keyBrightnessDown, (event) => {
            this.db_Slider._setValueEmit(this.db_Slider.value - this.db_Slider.STEP);
            this.nb_Slider._setValueEmit(this.nb_Slider.value - this.nb_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyTempUp", this.opt.keyTempUp, (event) => {
            this.dc_Slider._setValueEmit(this.dc_Slider.value + this.dc_Slider.STEP);
            this.nc_Slider._setValueEmit(this.nc_Slider.value + this.nc_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyTempDown", this.opt.keyTempDown, (event) => {
            this.dc_Slider._setValueEmit(this.dc_Slider.value - this.dc_Slider.STEP);
            this.nc_Slider._setValueEmit(this.nc_Slider.value - this.nc_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyGammaUp", this.opt.keyGammaUp, (event) => {
            this.gm_Slider._setValueEmit(this.gm_Slider.value + this.gm_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyGammaDown", this.opt.keyGammaDown, (event) => {
            this.gm_Slider._setValueEmit(this.gm_Slider.value - this.gm_Slider.STEP);
        });
        
        Main.keybindingManager.addHotKey("keyToggle", this.opt.keyToggle, (event) => {
            this.opt.enabled = !this.opt.enabled;
            this.enabledDay.setToggleState(this.opt.enabled);
            this.doUpdate();
        });
        
        
    }
    
    
    onSettChange() {
        // qLOG('SETTINGS CHANGED', arguments);
        
        this.enabledAuto.setToggleState(this.opt.autoUpdate);
        
        // Day Enabled
        this.enabledDay.setToggleState(this.opt.enabled);
        
        // Day Temp
        this.dc_Slider.setValue(this.opt.dayTemp);
        
        // Day Bright
        this.db_Slider.setValue(this.opt.dayBrightness);
        
        // Gamma mix
        this.gm_Slider.setValue(this.opt.gammaMix);
        
        // Night Enabled
        this.enabledNight.setToggleState(this.opt.enabledNight);
        
        // Night Temp
        this.nc_Slider.setValue(this.opt.nightTemp);
        
        // Night Bright
        this.nb_Slider.setValue(this.opt.nightBrightness);
        
        this.doUpdate();
    }
    
    
    createPopup() {
        
        this.headerIcon = new QPopupHeader({
            label: this.metadata.name,
            sub_label: this.metadata.version + "",
            iconPath: this.metadata.path + '/icon.png'
        });
        this.menu.addMenuItem(this.headerIcon);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        
        if (this.checkLocalConfig()) {
            qLOG('QRedshift', '~/.config/redshift.conf should be removed');
            
            let info = new QPopupHeader({
                label: "~/.config/redshift.conf",
                sub_label: _("may conflict with this applet, it is highly recommended removing it."),
                iconName: "dialog-warning", //dialog-warning-symbolic
                iconSize: 16
            })
            this.menu.addMenuItem(info);
            
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
        }
        
        
        
        
        
        // region -- DAY Settings --
        
        this.enabledDay = new QPopupSwitch({
            label: _("Enabled"),
            active: this.opt.enabled
        });
        this.enabledDay.connect('toggled', this.dayEnabledChange.bind(this));
        this.menu.addMenuItem(this.enabledDay);
        
        // day color
        this.dc_Slider = new QPopupSlider({
            label: _("Temp:"), unit: 'K',
            value: this.opt.dayTemp, min: this.minColor, max: this.maxColor, step: this.colorStep
        });
        this.dc_Slider.connect('value-changed', this.dayColorChange.bind(this));
        this.dc_Slider.connect('right-click', (actor, value) => {
            actor._setValueEmit('6500');
        });
        this.menu.addMenuItem(this.dc_Slider);
        
        // day bright
        this.db_Slider = new QPopupSlider({
            label: _("Bright:"), unit: '%',
            value: this.opt.dayBrightness, min: this.minBrightness, max: 100, step: 1
        });
        this.db_Slider.connect('value-changed', this.dayBrightChange.bind(this));
        this.db_Slider.connect('right-click', (actor, value) => {
            actor._setValueEmit('100');
        });
        this.menu.addMenuItem(this.db_Slider);
        // endregion
        
        // gamma
        this.gm_Slider = new QPopupSlider({
            label: _("Gamma:"), unit: '',
            value: this.opt.gammaMix, min: 0.5, max: 5, step: 0.01
        });
        this.gm_Slider.connect('value-changed', this.gammaMixChange.bind(this));
        this.gm_Slider.connect('right-click', (actor, value) => {
            actor._setValueEmit(1);
        });
        this.menu.addMenuItem(this.gm_Slider);
        // endregion
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // region -- Night Settings --
        
        this.enabledNight = new QPopupSwitch({
            label: _("Night Enabled"),
            active: this.opt.enabledNight
        });
        this.enabledNight.connect('toggled', this.nightEnabledChange.bind(this));
        this.menu.addMenuItem(this.enabledNight);
        
        // night color
        this.nc_Slider = new QPopupSlider({
            label: _("Temp:"), unit: 'K',
            value: this.opt.nightTemp, min: this.minColor, max: this.maxColor, step: this.colorStep
        });
        this.nc_Slider.connect('value-changed', this.nightColorChange.bind(this));
        this.nc_Slider.connect('right-click', (actor, value) => {
            actor._setValueEmit('6500');
        });
        this.menu.addMenuItem(this.nc_Slider);
        
        // night bright
        this.nb_Slider = new QPopupSlider({
            label: _("Bright:"), unit: '%',
            value: this.opt.nightBrightness, min: this.minBrightness, max: 100, step: 1
        });
        this.nb_Slider.connect('value-changed', this.nightBrightChange.bind(this));
        this.nb_Slider.connect('right-click', (actor, value) => {
            actor._setValueEmit('100');
        });
        this.menu.addMenuItem(this.nb_Slider);
        // endregion
        
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // region -- Bottom Bar --
        this.bottomBar = new QPopupIconBar();
        this.menu.addMenuItem(this.bottomBar);
        
        // config button
        let configBtn = new QIcon({
            style_class: 'popup-menu-item',
            icon_name: 'system-run-symbolic',
            icon_size: 20,
            icon_type: QIcon.SYMBOLIC,
            reactive: true, activate: true, hover: true
        });
        configBtn.add_style_class_name('q-icon');
        configBtn.connect('activate', (actor, value) => {
            this.configureApplet();
            this.menu.close();
        });
        this.bottomBar.addOnRight(configBtn);
        
        // auto update
        this.enabledAuto = new QPopupSwitch({
            label: this.settings.getDesc('autoUpdate'),
            active: this.opt.autoUpdate
        });
        this.enabledAuto.actor.add_style_class_name('q-icon');
        this.enabledAuto.connect('toggled', this.autoUpdateChange.bind(this));
        // this.bottomBar.addOnLeft(this.enabledAuto);
        
        // show label
        this.enabledLabel = new QPopupSwitch({
            label: _("Show Label"),
            active: this.opt.iconLabel
        });
        this.enabledLabel.actor.add_style_class_name('q-icon');
        this.enabledLabel.connect('toggled', () => {
            this.opt.iconLabel = !this.opt.iconLabel;
            this.hide_applet_label(!this.opt.iconLabel);
            if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
        });
        // this._applet_context_menu.addMenuItem(this.enabledLabel);
        
        this.bottomBar.addOnLeft(this.enabledLabel);
        // endregion
    }

//region -- ON Slider Changes --
    
    autoUpdateChange(switcher, value) {
        this.opt.autoUpdate = value;
        this.doUpdate();
    }
    
    dayEnabledChange(switcher, value) {
        // qLOG('Day Change', value);
        this.opt.enabled = value;
        this.doUpdate();
    }
    
    dayColorChange(slider, value) {
        // qLOG('Day Color Change', value);
        this.opt.dayTemp = value;
        this.doUpdate();
    }
    
    dayBrightChange(slider, value) {
        // qLOG('Day Bright Change', value);
        this.opt.dayBrightness = value;
        this.doUpdate();
    }
    
    gammaMixChange(slider, value) {
        // qLOG('Gamma Change', value);
        this.opt.gammaMix = value;
        this.doUpdate();
    }
    
    
    nightEnabledChange(switcher, value) {
        // qLOG('Night Change', value);
        this.opt.enabledNight = value;
        this.doUpdate();
    }
    
    nightColorChange(slider, value) {
        // qLOG('Night Color Change', value);
        this.opt.nightTemp = value;
        this.doUpdate();
    }
    
    nightBrightChange(slider, value) {
        // qLOG('Night Bright Changee', value);
        this.opt.nightBrightness = value;
        this.doUpdate();
    }

//endregion
    
    
    on_applet_added_to_panel() {
        qLOG('QRedshift', 'ADDED TO PANEL');
    }
    
    
    on_applet_clicked(event) {
        this.menu.toggle();
    }
    
    on_applet_removed_from_panel() {
        qLOG('QRedshift', 'REMOVED FROM PANEL');
        this.settings.finalize();
        Main.keybindingManager.removeHotKey("keyToggle");
        Main.keybindingManager.removeHotKey("keyBrightnessUp");
        Main.keybindingManager.removeHotKey("keyBrightnessDown");
        Main.keybindingManager.removeHotKey("keyTempUp");
        Main.keybindingManager.removeHotKey("keyTempDown");
        Main.keybindingManager.removeHotKey("keyGammaUp");
        Main.keybindingManager.removeHotKey("keyGammaDown");
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = undefined;
        }
        
        Util.killall('redshift');
        Util.spawnCommandLine(`redshift -x`);
        
    }
    
    
    doCommand(command) {
        // qLOG('QRedshift CMD',  command);
        if (!this.running) {
            this.running = true;
            Util.spawn_async(GLib.shell_parse_argv(command)[1], (out) => {
                let period = out.match(/Period:.+/g);
                if (period && period[0]) {
                    this.opt.period = period[0].split(':')[1].trim();
                }
                // qLOG('QRedshift Command', command);
                // qLOG('QRedshift Period', this.opt.period);
                // this.setIcon();
                this.updateTooltip();
                this.setInfo();
                this.running = false;
            });
        }
        this.setIcon();
    }
    
    doCommandSync(command) {
        // qLOG('QRedshift CMD',  command);
        
        let [success, out] = GLib.spawn_command_line_sync(command);
        if (!success || out == null) return;
        let resp = out.toString();
        
        let period = resp.match(/Period:.+/g);
        if (period && period[0]) {
            this.opt.period = period[0].split(':')[1].trim();
        }
        this.updateTooltip();
        this.setInfo();
        this.setIcon();
    }
    
    redShiftUpdate() {
        Util.killall('redshift');
        if (this.opt.enabled) {
            let cmd = `redshift `;
            // cmd += `-c ${this.metadata.path + BASE_CONF}  `;
            if (this.opt.redshift_version >= 1.12) cmd += `-P `;
            cmd += `-r -v -o  `;
            
            
            if (this.opt.adjustmentMethod) cmd += `-m ${this.opt.adjustmentMethod} `;
            
            if (this.opt.locationLatitude && this.opt.locationLongitude) {
                cmd += `-l ${this.opt.locationLatitude}:${this.opt.locationLongitude} `
            }
            
            if (this.opt.enabledNight) {
                if (this.opt.manualNightTime) {
                    let prd = this.check_period();
                    if (prd.is_night) {
                        let temp = lerp(this.opt.dayTemp, this.opt.nightTemp, prd.percent);
                        cmd += `-t ${temp}:${temp} `;
                        cmd += `-b ${this.opt.nightBrightness / 100}:${this.opt.nightBrightness / 100} `;
                    } else {
                        let temp = lerp(this.opt.nightTemp, this.opt.dayTemp, prd.percent);
                        cmd += `-t ${temp}:${temp} `;
                        cmd += `-b ${this.opt.dayBrightness / 100}:${this.opt.dayBrightness / 100} `;
                    }
                } else {
                    cmd += `-t ${this.opt.dayTemp}:${this.opt.nightTemp} `;
                    cmd += `-b ${this.opt.dayBrightness / 100}:${this.opt.nightBrightness / 100} `;
                }
            } else {
                cmd += `-t ${this.opt.dayTemp}:${this.opt.dayTemp} `;
                cmd += `-b ${this.opt.dayBrightness / 100}:${this.opt.dayBrightness / 100} `;
            }
            
            if (this.opt.gammaMix) cmd += `-g ${this.opt.gammaMix} `;
            
            // Util.spawnCommandLine(cmd);
            this.set_applet_icon_symbolic_path(this.metadata.path + ICON_ON);
            this.doCommandSync(cmd);
            
        } else {
            // if(this.opt.period !== '' ){
            Util.spawnCommandLine(`redshift -x`);
            this.set_applet_icon_symbolic_path(this.metadata.path + ICON_OFF);
            this.opt.period = '-';
            
            // }
            this.updateTooltip();
            this.setInfo();
            this.setIcon();
        }
        
    }
    
    setInfo() {
        let period = this.opt.period + "";
        
        if (this.opt.enabled && this.opt.manualNightTime) {
            if (this.check_period().is_night) period = _("Night");
            else period = _("Day");
        }
        
        this.headerIcon.setStatus(period + "");
    }
    
    updateTooltip() {
        let tooltiptext = `${this.metadata.name}: ${this.opt.enabled ? _("On") : _("Off")}`;
        // let labeltext = `${this.metadata.name}`;
        let labeltext = _("Off");
        
        if (this.opt.enabled) {
            tooltiptext += '\n';
            let period = this.opt.period;
            if (this.opt.manualNightTime) {
                if (this.check_period().is_night) period = _("Night");
                else period = _("Day");
            }
            tooltiptext += `${period}\n\n`;
            
            if (this.opt.enabledNight) {
                tooltiptext += _("Day Temperature") + ": " + `${this.opt.dayTemp}K\n`;
                tooltiptext += _("Day Brightness") + ": " + `${this.opt.dayBrightness}%\n`;
                
                tooltiptext += _("Night Temperature") + ": " + `${this.opt.nightTemp}K\n`;
                tooltiptext += _("Night Brightness") + ": " + `${this.opt.nightBrightness}%\n`;
            } else {
                tooltiptext += _("Temperature") + ": " + `${this.opt.dayTemp}K\n`;
                tooltiptext += _("Brightness") + ": " + `${this.opt.dayBrightness}%\n`;
            }
            tooltiptext += _("Gamma:") + " " + `${this.opt.gammaMix}`;
            
            // Label text
            
        }
        if (this.opt.enabledNight && this.opt.manualNightTime && this.check_period().is_night) {
            labeltext = `${this.opt.nightTemp}k - ${this.opt.nightBrightness}% - `;
        } else if (this.opt.enabledNight && !this.opt.manualNightTime && this.opt.period.toLowerCase().startsWith("n")) {
            labeltext = `${this.opt.nightTemp}k - ${this.opt.nightBrightness}% - `;
        } else {
            labeltext = `${this.opt.dayTemp}k - ${this.opt.dayBrightness}% - `;
        }
        labeltext += `${this.opt.gammaMix.toFixed(2)}`;
        
        this.set_applet_tooltip(tooltiptext);
        
        this.set_applet_label(labeltext);
        this.hide_applet_label(!this.opt.iconLabel);
        if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
    }
    
    
    // Cinnamon should be restarted after this.
    recompileTranslations() {
        let cmd = `cinnamon-xlet-makepot -r ${this.metadata.path}`;
        Util.spawnCommandLine(cmd);
        
        cmd = `cinnamon-xlet-makepot -i ${this.metadata.path}`;
        Util.spawnCommandLine(cmd);
    }
    
    reloadApplet() {
        let cmd = `dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'${this.metadata.uuid}' string:'APPLET'`;
        Util.spawnCommandLine(cmd);
    }
    
    openSettings() {
        Util.spawnCommandLine("xlet-settings applet " + this._uuid + " " + this.instance_id);
    }
    
}


function main(metadata, orientation, panel_height, instance_id) {
    return new QRedshift(metadata, orientation, panel_height, instance_id);
}
