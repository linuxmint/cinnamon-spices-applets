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

const GLib = imports.gi.GLib;
const Util = imports.misc.util;

function execute_sync(command) {
    try {
        return GLib.spawn_command_line_sync(command);
    } catch (e) {
        global.logError(e);
        return false;
    }
}

function XInputPointerDevice(name, id) {
    this._init(name, id);
}

XInputPointerDevice.prototype = {
    _init: function(name, id) {
        this.name = name;
        this.id = id;
        this.node = this.readNode();
        this.updateInfo();
    },
    
    updateInfo: function() {
        this.touchscreen = this.touchpad = this.mouse = false;
        
        if(this.node) {
            let lines = execute_sync('udevadm info --query=env --name=' + this.node);

            if (lines) {
                lines = lines[1].toString().split('\n');
                for (let line = 0; line < lines.length; line++) {
                    if (lines[line].indexOf('ID_INPUT_TOUCHSCREEN=1') == 0)
                        this.touchscreen = true;
                    else if (lines[line].indexOf('ID_INPUT_TOUCHPAD=1') == 0)
                        this.touchpad = true;
                    else if (lines[line].indexOf('ID_INPUT_MOUSE=1') == 0)
                        this.mouse = true;
                }
            }
        }
    },
    
    readNode: function() {
        let lines = execute_sync('xinput --list-props ' + this.id);
        if (lines) {
            let match = /\sDevice Node \([0-9]+\):\s*\"(.*)\"/g.exec(lines[1].toString());
            if(match)
                return match[1];
        }
        return null;
    },

    setEnabled: function(enabled) {
        Util.spawnCommandLine('xinput set-prop ' + this.id + ' "Device Enabled" ' + (enabled ? '1' : '0'));
    },

    isEnabled: function() {
        var lines = execute_sync('xinput --list-props ' + this.id);
        if (lines) {
            let match = /\sDevice Enabled \([0-9]+\):\s*1/g.exec(lines[1].toString());
            if(match)
                return true;
        }
        return false;
    },
};

function XInputManager() {
}

XInputManager.prototype = {
    refresh: function(config) {
        this.touchscreens = [];
        this.touchpads = [];
        this.trackpoints = [];
        this.mice = [];
        
        let devices = this.getAllPointerDevices();
        for (let i = 0; i < devices.length; i++) {
            let device = devices[i];
            if(device.touchscreen)
                this.touchscreens.push(device);
            else if(device.touchpad)
                this.touchpads.push(device);
            else if(config.fakeTrackpoints.indexOf(device.name) != -1)
                this.trackpoints.push(device);
            else if(device.mouse)
                this.mice.push(device);
        }
    },

    getAllPointerDevices: function() {
        var devices = new Array();
        let lines = execute_sync('xinput --list');
        if (lines) {
            lines = lines[1].toString().split('\n');
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].indexOf('pointer')!=-1 && lines[line].substr(5, 1) == ' ') {
                    let match = /(.+)\sid=([0-9]+)/g.exec(lines[line].substr(6));
                    if(match) {
                        let device = new XInputPointerDevice(match[1].trim(), match[2]);
                        if(device.node)
                            devices.push(device);
                    }
                }
            }
        }
        return devices;
    },

    enableAllDevices: function(devices, enabled) {
        for (let i = 0; i < devices.length; i++)
            devices[i].setEnabled(enabled);
    },

    allDevicesEnabled: function(devices) {
        if (devices.length == 0)
            return false;

        for (let i = 0; i < devices.length; i++) {
            if (!devices[i].isEnabled())
                return false;
        }
        return true;
    },
    
    addCommandDump: function(dump, command) {
        dump.push(command);
        let lines = execute_sync(command);
        if (lines) {
            lines = lines[1].toString().split('\n');
            for (let line = 0; line < lines.length; line++)
                dump.push(lines[line]);
        } else {
            dump.push('no result');
        }
        dump.push('======================');
    },
    
    getDump: function() {
        let devices = this.getAllPointerDevices();
        let dump = [];
        
        this.addCommandDump(dump, 'xinput --list');
    
        for (let i = 0; i < devices.length; i++)
            this.addCommandDump(dump, 'udevadm info --query=env --name=' + devices[i].node);
        return dump.join('\n');
    },
};

