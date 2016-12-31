/*
 * Copyright 2012 Santo Pfingsten <santo@lusito.info>
 *
 * Original Touchpad Indicator Python by Lorenzo Carbonell Cerezo
 * and Miguel Angel Santamaría Rogado:
 * https://launchpad.net/touchpad-indicator
 *
 * Used some parts of the Gnome 3 Extension from Armin Köhler:
 * https://extensions.gnome.org/extension/131/touchpad-indicator/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const DBus = imports.dbus;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const AppletImports = imports.ui.appletManager.applets["TouchpadIndicatorClassic@lusito.info"];
const AppletDBus = AppletImports.appletDBus;
const Input = AppletImports.input;
const AppletMeta = imports.ui.appletManager.appletMeta["TouchpadIndicatorClassic@lusito.info"];
const AppletDir = AppletMeta.path;
const ConfigFile = AppletDir + '/config.js';

const TP_ICON = 'input-touchpad';
const TP_ICON_DISABLED = 'touchpad-disabled';

const ShutdownListenerInterface = {
    name: 'info.Lusito.ShutdownListener',
    methods: [],
    signals: [{ name: 'Shutdown', inSignature: '' } ]
};

function TouchpadIndicator(orientation) {
    this._init(orientation);
}

TouchpadIndicator.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this._dbus = null;
            this.orientation = orientation;
            this.set_applet_tooltip(_("Touchpad Indicator"));

            this.lastUpdate = 0;
            this.config = {};
            this.onMouseDisable = 'notset';
            this.input = new Input.XInputManager();

            this.createMenu();
            
            this.onStartup();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        for(key in this._toggleItems)
            this._toggleItems[key].setToggleState(this.config[key]);
        
        this._updateTrackpointPopup();

        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this.onShutdown();
    },
    
    on_applet_added_to_panel: function() {
        this.onStartup();
    },
    
    onStartup: function() {
        Util.spawnCommandLine("python " + AppletDir + "/shutdownListener.py");
        this.loadConfigFile();

        this.input.refresh(this.config);
        
        if(this.config['on-start-disable'])
            this.enableTouchpad(false);
        else
            this.enableTouchpad(this.input.allDevicesEnabled(this.input.touchpads), true);

        this.onMousePlugged();

        // Watch some files
        this.file_watches = new Array();
        this.addFileWatch("/dev/input/by-path", this.onMousePlugged);
        this.addFileWatch(ConfigFile, this.loadConfigFile);
        
        DBus.session.watch_name('info.Lusito.ShutdownListener', false, Lang.bind(this, this.onShutdownListenerAppeared), null);
        
        if(this._dbus == null)
            this._dbus = new AppletDBus.AppletDBus(this);
    },

    onShutdownListenerAppeared: function() {
        let ShutdownListenerClass = DBus.makeProxyClass(ShutdownListenerInterface);
        let proxy = new ShutdownListenerClass(DBus.session, 'info.Lusito.ShutdownListener', '/info/Lusito/ShutdownListener');
        proxy.connect('Shutdown', Lang.bind(this, this.onShutdown));
    },
    
    onShutdown: function() {
        if(this._dbus != null) {
            this._dbus.destroy();
            this._dbus = null;
        }
        
        this.removeFileWatches();
        if(this.config['on-exit-enable'])
            this.enableTouchpad(true);
        else if(this.config['on-exit-disable'])
            this.enableTouchpad(false);
    },

    notify: function(icon, title, message, force) {
        if(force || this.config['show-notifications'])
            Util.spawnCommandLine('notify-send --icon="' + icon + '" "' + title + '" "' + message + '"');
    },

    createMenu: function() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this._toggleItems = {};
        this.createToggleEntry("Touchpad Enabled", "touchpad-enabled");
        this.createToggleEntry("Disable if mouse plugged in", "on-mouse-disable");
        this.createToggleEntry("Enable on exit", "on-exit-enable");
        this.createToggleEntry("Disable on exit", "on-exit-disable");
        this.createToggleEntry("Disable on start", "on-start-disable");
        this.createToggleEntry("Show notifications", "show-notifications");
        this.trackpointPopup = new PopupMenu.PopupSubMenuMenuItem(_("Mark device as trackpoint"));
        this.trackpointPopup._tooltip = new Tooltips.Tooltip(this.trackpointPopup.actor, "Use if your trackpoint prevents the touchpad from being re-enabled");
        this.menu.addMenuItem(this.trackpointPopup);
        
        this._applet_context_menu.addAction("Copy XInput info to clipboard", Lang.bind(this, this._onDumpInfo));
    },

    _updateTrackpointPopup: function() {
        let menu = this.trackpointPopup.menu;
        menu.removeAll();
        let addedDeviceNames = [];
        let fakeList = this.config.fakeTrackpoints;
        this._updateTrackpointPopupDevices(menu, addedDeviceNames, fakeList, this.input.mice);
        this._updateTrackpointPopupDevices(menu, addedDeviceNames, fakeList, this.input.trackpoints);
    
        for (let i=fakeList.length-1; i>=0; i--) {
            let fake = fakeList[i];
            if (addedDeviceNames.indexOf(fake) == -1) {
                menu.addAction(_("Remove ") + fake, Lang.bind(this, function() {
                    this._removeAllFromArray(fakeList, fake);
                    this.storeConfigFile();
                }));
            }
        }
    },
    
    _updateTrackpointPopupDevices: function(menu, addedDeviceNames, fakeList, devices) {
        for(let i=0; i<devices.length; i++) {
            let device = devices[i];
            addedDeviceNames.push(device.name);
            
            let entry = new PopupMenu.PopupSwitchMenuItem(device.name, fakeList.indexOf(device.name) != -1);
            entry.connect('toggled', Lang.bind(this, function() {
                if(entry.state)
                    fakeList.push(device.name);
                else
                    this._removeAllFromArray(fakeList, device.name);
                this.storeConfigFile();
            }));
            menu.addMenuItem(entry);
            this._toggleItems[key] = entry;
        }
    },
    
    _removeAllFromArray: function(array, item) {
        for (let i=array.length-1; i>=0; i--) {
            if (array[i] == item)
                array.splice(i, 1);
        }
    },
    
    _onDumpInfo: function() {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(this.input.getDump());
    },

    createToggleEntry: function(text, key) {
        let entry = new PopupMenu.PopupSwitchMenuItem(_(text), this.config[key]);
        entry.key = key;
        entry.connect('toggled', Lang.bind(this, this.onToggleSetting));
        this.menu.addMenuItem(entry);
        this._toggleItems[key] = entry;
    },
    
    toggleSetting: function(key) {
        this._toggleItems[key].toggle();
    },

    onToggleSetting: function(item) {
        this.config[item.key] = item.state;
        this.storeConfigFile();
        if(item.key == 'touchpad-enabled')
            this.enableTouchpad(item.state);
    },

    onConfigUpdate: function() {
        if(this.config["on-mouse-disable"] != this.onMouseDisable) {
            this.onMouseDisable = this.config["on-mouse-disable"];
            this.onMousePlugged();
        }
    },

    loadConfigFile: function() {
        let t = new Date().getTime();
        if(t - this.lastUpdate < 500)
            return;
        this.lastUpdate = t;

        try {
            let file = Gio.file_new_for_path(ConfigFile);
            if(file.query_exists(null)) {
                [flag, data] = file.load_contents(null);
                if(flag) {
                    this.config = eval('(' + data + ')');
                    if(!this.config.fakeTrackpoints)
                        this.config.fakeTrackpoints = [];
                    this.onConfigUpdate();
                    return;
                }
            }
            this.notify('gtk-stop', 'Touchpad Indicator Error', 'Could not load ' + ConfigFile + '.', true);
        } catch(e) {
            this.notify('gtk-stop', 'Touchpad Indicator Error', 'Error parsing ' + ConfigFile + '.', true);
        }
    },

    storeConfigFile: function() {
        try {
            let file = Gio.file_new_for_path(ConfigFile);
            file.replace_contents(JSON.stringify(this.config), null, false, 0, null);
        } catch(e) {
            this.notify('gtk-stop', 'Touchpad Indicator Error', 'Error storing ' + ConfigFile + '.', true);
        }
    },

    onMousePlugged: function() {
        if (this.onMouseDisable === true) {
            this.input.refresh(this.config);
            let has_mouse = this.input.mice.length > 0;

            if (has_mouse && this.isTouchpadEnabled()) {
                this.enableTouchpad(false);
                this.notify('gtk-yes', 'Touchpad Indicator', _("Mouse plugged in - touchpad disabled"), false);
            } else if (!has_mouse && !this.isTouchpadEnabled()) {
                this.enableTouchpad(true);
                this.notify('gtk-yes', 'Touchpad Indicator', _("Mouse unplugged - touchpad enabled"), false);
            }
        }
    },

    enableTouchpad: function(enabled, noset) {
        this.config['touchpad-enabled'] = enabled;
        this.set_applet_icon_symbolic_name(enabled ? TP_ICON : TP_ICON_DISABLED);
        if(!noset)
            this.input.enableAllDevices(this.input.touchpads, enabled);
    },

    isTouchpadEnabled: function() {
        return this.config['touchpad-enabled'];
    },

    addFileWatch: function(path, callback) {
        let file = Gio.file_new_for_path(path);
        let m = file.monitor(Gio.FileMonitorFlags.NONE, null);
        let c = m.connect('changed', Lang.bind(this, callback));
        this.file_watches.push({
            monitor: m, 
            connection: c
        });
    },

    removeFileWatches: function() {
        for(let i=0; i<this.file_watches.length; i++) {
            this.file_watches[i].monitor.disconnect(this.file_watches[i].connection);
            this.file_watches[i].monitor.cancel();
        }

        this.file_watches = new Array();
    }
};

function main(metadata, orientation) {
	return new TouchpadIndicator(orientation);
}
