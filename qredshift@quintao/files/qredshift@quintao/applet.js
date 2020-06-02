const Applet = imports.ui.applet;

const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
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

const QIcon = QUtils.QIcon;
const QPopupHeader = QUtils.QPopupHeader;
const QPopupIconBar = QUtils.QPopupIconBar;
const QPopupSlider = QUtils.QPopupSlider;
const QPopupSwitch = QUtils.QPopupSwitch;



const BASE_CONF = "/assets/base.conf";
const ICON_OFF = "/assets/light-off.svg";
const ICON_ON = "/assets/light-on.svg";





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
            
            keyToggle: '',
            
            dayTemp: 6500,
            dayBrightness: 1,
            gammaMix: 1,
            
            enabledNight: false,
            nightTemp: 6500,
            nightBrightness: 1,
            
            locationLatitude: '0',
            locationLongitude: '0',
            period: '-'
        };
        
        
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
        
        
        this.settings.bind('dayTemp', 'dayTemp', this.onSettChange.bind(this));
        this.settings.bind('dayBrightness', 'dayBrightness', this.onSettChange.bind(this));
        this.settings.bind('gammaMix', 'gammaMix', this.onSettChange.bind(this));
        
        this.settings.bind('enabledNight', 'enabledNight', this.onSettChange.bind(this));
        this.settings.bind('nightTemp', 'nightTemp', this.onSettChange.bind(this));
        this.settings.bind('nightBrightness', 'nightBrightness', this.onSettChange.bind(this));
        
        this.settings.bind('locationLatitude', 'locationLatitude', this.onSettChange.bind(this));
        this.settings.bind('locationLongitude', 'locationLongitude', this.onSettChange.bind(this));
    
        this.settings.bind("keyToggle", "keyToggle", this.onKeyChanged.bind(this));
        
        if (!this.verifyVersion()) {
            qLOG('Redshift required!');
            
            this.set_applet_icon_symbolic_path(metadata.path + ICON_OFF);
            this.set_applet_label(_("REDSHIFT NOT INSTALLED!"));
            this.set_applet_tooltip(_("Requires Redshift: sudo apt-get install redshift"));
            
            // Reload BTN - view-refresh-symbolic
            let reload_btn = new PopupMenu.PopupMenuItem(_("Reload Applet"), {hover: true});
            reload_btn.connect('activate', this.reloadApplet.bind(this));
            this._applet_context_menu.addMenuItem(reload_btn);
            
            this.menu = this._applet_context_menu;
            
            return this;
        }
        
        
        // Load Informations
        this.setAdjustmentMethods(false);
        this.setLocation(false);
        
        
        
        this.set_applet_icon_symbolic_path(metadata.path + ICON_OFF);
        this.set_applet_label(this.metadata.name);
        
        this.hide_applet_label(!this.opt.iconLabel);
        if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
        
        
        
        qLOG("QRedshift");
        
        this.maxBrightness = 100;
        this.minBrightness = 10;
        this.maxColor = 9000;
        this.minColor = 1000;
        
        this.colorStep = 50;
        
        
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.createPopup();
        
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
        this.doUpdate();
    }
    
    
    loadStyle() {
        const style_path = this.metadata.path + '/css/style.css';
        const theme_path = Main.getThemeStylesheet();
        qLOG('Theme', theme_path);
        
        const fallback = this.menu.actor.get_theme_node().get_theme()['fallback-stylesheet'];
        qLOG('Fallback', fallback);
        
        let theme = new St.Theme({
            application_stylesheet: style_path,
            theme_stylesheet: theme_path,
            default_stylesheet: null,
            fallback_stylesheet: fallback
        });
        
        this.menu.actor.set_theme(theme);
    }
    
    
    verifyVersion() {
        try {
            let [success, out] = GLib.spawn_command_line_sync('redshift -V');
            if (success && out) {
                let res = out.toString();
                let mts = /redshift\s*(\d+.?\d*)/gi.exec(res);
                if (mts.length == 2)
                    this.opt.redshift_version = parseFloat(mts[1]);
                
                // qLOG('success', this.opt);
                return true;
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }
        
    }
    
    setAdjustmentMethods(force = false) {
        let methods = this.settings.getOptions('adjustmentMethod');
        if (!methods.needload && !force) return;
        
        const regex = new RegExp(/^\s+(\w+)$/gm);
        
        let [success, out] = GLib.spawn_command_line_sync('redshift -m list');
        if (success && out) {
            let res = out.toString();
            let mts = res.match(regex).map(s => s.trim());
            let opts = {};
            mts.forEach(value => { opts[value] = value;});
            this.settings.setOptions('adjustmentMethod', opts);
        }
    }
    
    setLocation(force = true) {
        let remoteEnable = this.settings.getValue('locationRemote');
        
        if (this.opt.locationLatitude != "0" &&
            this.opt.locationLongitude != "0" && !force && !remoteEnable) return;
        
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
        
        Main.keybindingManager.addHotKey("keyToggle", this.opt.keyToggle, (event) => {
            
            this.opt.enabled = !this.opt.enabled;
            this.enabledDay.setToggleState(this.opt.enabled);
            this.doUpdate();
            // qLOG("Hotkey");
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
            // sub_label: this.metadata.version + "",
            iconPath: this.metadata.path + '/icon.png'
        });
        this.menu.addMenuItem(this.headerIcon);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        
        
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
            value: this.opt.gammaMix, min: 1, max: 5, step: 0.01
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
    }
    
    
    on_applet_clicked(event) {
        this.menu.toggle();
    }
    
    on_applet_removed_from_panel() {
        qLOG('REMOVED FROM PANEL');
        this.settings.finalize();
        Main.keybindingManager.removeHotKey("keyToggle");
        
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = undefined;
        }
        
        Util.killall('redshift');
        Util.spawnCommandLine(`redshift -x -c ${this.metadata.path + BASE_CONF}`);
        
    }
    
    
    doCommand(command) {
        let [success, out] = GLib.spawn_command_line_sync(command);
        if (!success || out == null) return;
        let resp = out.toString();
        
        let period = resp.match(/Period:\s+\w+/g);
        if (period && period[0]) {
            this.opt.period = period[0].split(':')[1].trim();
        }
    }
    
    
    redShiftUpdate() {
        Util.killall('redshift');
        if (this.opt.enabled) {
            let cmd = `redshift `;
            cmd += `-c ${this.metadata.path + BASE_CONF}  `;
            if (this.opt.redshift_version >= 1.12) cmd += `-P `;
            cmd += `-r -v -o  `;
            
            
            if (this.opt.adjustmentMethod) cmd += `-m ${this.opt.adjustmentMethod} `;
            
            if (this.opt.locationLatitude && this.opt.locationLongitude) {
                if (this.opt.adjustmentMethod) cmd += `-m ${this.opt.adjustmentMethod} `;
                cmd += `-l ${this.opt.locationLatitude}:${this.opt.locationLongitude} `
            }
            
            if (this.opt.enabledNight) {
                cmd += `-t ${this.opt.dayTemp}:${this.opt.nightTemp} `;
                cmd += `-b ${this.opt.dayBrightness / 100}:${this.opt.nightBrightness / 100} `;
            } else {
                cmd += `-t ${this.opt.dayTemp}:${this.opt.dayTemp} `;
                cmd += `-b ${this.opt.dayBrightness / 100}:${this.opt.dayBrightness / 100} `;
            }
            
            if (this.opt.gammaMix) cmd += `-g ${this.opt.gammaMix} `;
            
            // Util.spawnCommandLine(cmd);
            this.doCommand(cmd);
            this.set_applet_icon_symbolic_path(this.metadata.path + ICON_ON);
            
        } else {
            // if(this.opt.period !== '' ){
            Util.spawnCommandLine(`redshift -x -c ${this.metadata.path + BASE_CONF}`);
            this.set_applet_icon_symbolic_path(this.metadata.path + ICON_OFF);
            this.opt.period = '-';
            
            // }
            
        }
        
        this.updateTooltip();
        this.setInfo();
    }
    
    setInfo() {
        this.headerIcon.setStatus(this.opt.period + "");
        
    }
    
    updateTooltip() {
        let tooltiptext = `${this.metadata.name}: ${this.opt.enabled ? _("On") : _("Off")}`;
        // let labeltext = `${this.metadata.name}`;
        let labeltext = _("Off");
        
        if (this.opt.enabled) {
            tooltiptext += '\n';
            tooltiptext += `${this.opt.period}\n\n`;
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
        if (this.opt.enabledNight && this.opt.period.toLowerCase() == 'night') {
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











