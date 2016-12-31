/*
Copyright 2012 Josef Michálek (Aka Orcus) <0rcus.cz@gmail.com>

This file is part of Sysmonitor

Sysmonitor is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

Sysmonitor is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along
with Sysmonitor. If not, see http://www.gnu.org/licenses/.
*/

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

const CONFIG_FILE = "settings.json";
const DEFAULT_CONFIG = {
    "graphWidth": 40,
    "refreshRate": 1000,
    "backgroundColor": [0,0,0,1],
    "borderColor": [0.7294117647058823,0.7411764705882353,0.7137254901960784,1],
    "smooth": false,
    "cpu": {
        "enabled": true,
        "colors": [
            [0.9882352941176471,0.9137254901960784,0.30980392156862746,1],
            [0.9882352941176471,0.6862745098039216,0.24313725490196078,1],
            [0.9372549019607843,0.1607843137254902,0.1607843137254902,1],
            [0.3666666666666667,0,0,1]
        ]
    },
    "mem": {
        "enabled": true,
        "colors": [
            [0.4633333333333334,0.8236395759717317,1,1],
            [0.20392156862745098,0.396078431372549,0.6431372549019608,1]
        ]
    },
    "swap": {
        "enabled": true,
        "colors":[
            [0.4470588235294118,0.6235294117647059,0.8117647058823529,1]
        ]
    },
    "net": {
        "enabled": true,
        "colors": [
            [0.5411764705882353,0.8862745098039215,0.20392156862745098,1],
            [0.9372549019607843,0.1607843137254902,0.1607843137254902,1]
        ]
    },
    "load": {
        "enabled": true,
        "colors": [
            [0.8,0,0,1]
        ]
    }
};

Gtk.init(null);

function Settings() {
    this._init();
}

Settings.prototype = {
    _init: function() {
        this.builder = new Gtk.Builder();
        this.builder.add_from_file("settings.xml");
        
        this.win = this.builder.get_object("windowMain");
        this.win.connect("destroy", Gtk.main_quit);
        
        this.builder.get_object("btnOK").connect("clicked", Lang.bind(this, function () {
            this.save();
            let msg = new Gtk.MessageDialog({
                transient_for: this.win,
                modal: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.QUESTION,
                text: _("Cinnamon should be restarted for changes to take effect.\nRestart now?")});
            let ret = msg.run();
            if (ret == Gtk.ResponseType.YES)
            {
                GLib.spawn_command_line_async("nohup cinnamon --replace > /dev/null 2>&1 &");
            }
            msg.destroy();
            this.win.destroy();
        }));
        this.builder.get_object("btnCancel").connect("clicked", Lang.bind(this, function() {
            this.win.destroy();
        }));
        
        this.load();
        this.win.show_all();
    },
    
    load: function() {
        let cfg;
        try {
            let file = Gio.File.new_for_path(CONFIG_FILE);
            let [ret, content] = file.load_contents(null, null);
            cfg = JSON.parse(content);
        } catch (e) {
            cfg = DEFAULT_CONFIG;
        }
        this.builder.get_object("spinbtnGraphWidth").set_value(cfg.graphWidth);
        this.builder.get_object("spinbtnRefreshRate").set_value(cfg.refreshRate);
        this.setColor("clrbtnBackground", cfg.backgroundColor);
        this.setColor("clrbtnBorder", cfg.borderColor);
        this.builder.get_object("checkbtnSmooth").set_active(cfg.smooth);
        this.builder.get_object("checkbtnCpu").set_active(cfg.cpu.enabled);
        this.builder.get_object("checkbtnMem").set_active(cfg.mem.enabled);
        this.builder.get_object("checkbtnSwap").set_active(cfg.swap.enabled);
        this.builder.get_object("checkbtnNet").set_active(cfg.net.enabled);
        this.builder.get_object("checkbtnLoad").set_active(cfg.load.enabled);
        this.setColor("clrbtnCpuUser",   cfg.cpu.colors[0]);
        this.setColor("clrbtnCpuNice",   cfg.cpu.colors[1]);
        this.setColor("clrbtnCpuKernel", cfg.cpu.colors[2]);
        this.setColor("clrbtnCpuIOWait", cfg.cpu.colors[3]);
        this.setColor("clrbtnMemUsed",   cfg.mem.colors[0]);
        this.setColor("clrbtnMemCached", cfg.mem.colors[1]);
        this.setColor("clrbtnSwapUsed",  cfg.swap.colors[0]);
        this.setColor("clrbtnNetD",      cfg.net.colors[0]);
        this.setColor("clrbtnNetU",      cfg.net.colors[1]);
        this.setColor("clrbtnLoad",      cfg.load.colors[0]);
    },

    save: function() {
        try {
            let cfg = {
                graphWidth: this.builder.get_object("spinbtnGraphWidth").get_value(),
                refreshRate: this.builder.get_object("spinbtnRefreshRate").get_value(),
                backgroundColor: this.getColor("clrbtnBackground"),
                borderColor: this.getColor("clrbtnBorder"),
                smooth: this.builder.get_object("checkbtnSmooth").get_active(),
                cpu: {
                    enabled: this.builder.get_object("checkbtnCpu").get_active(),
                    colors: [
                        this.getColor("clrbtnCpuUser"),
                        this.getColor("clrbtnCpuNice"),
                        this.getColor("clrbtnCpuKernel"),
                        this.getColor("clrbtnCpuIOWait")]
                },
                mem: {
                    enabled: this.builder.get_object("checkbtnMem").get_active(),
                    colors: [
                        this.getColor("clrbtnMemUsed"),
                        this.getColor("clrbtnMemCached")]
                },
                swap: {
                    enabled: this.builder.get_object("checkbtnSwap").get_active(),
                    colors: [
                        this.getColor("clrbtnSwapUsed")]
                },
                net: {
                    enabled: this.builder.get_object("checkbtnNet").get_active(),
                    colors: [
                        this.getColor("clrbtnNetD"),
                        this.getColor("clrbtnNetU")]
                },
                load: {
                    enabled: this.builder.get_object("checkbtnLoad").get_active(),
                    colors: [
                        this.getColor("clrbtnLoad")]
                }
            };
            let content = JSON.stringify(cfg);
            let file = Gio.File.new_for_path(CONFIG_FILE);
            let out = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            out.write_all(content, null);
            out.close(null);
        } catch (e) {
            print(_("Error while saving file: ") + e);
        }
    },
    
    getColor: function(widget) {
        let c = this.builder.get_object(widget).get_rgba();
        return [c.red, c.green, c.blue, c.alpha];
    },
    
    setColor: function(widget, c) {
        let color = new Gdk.RGBA({red: c[0], green: c[1], blue: c[2], alpha: c[3]});
        this.builder.get_object(widget).set_rgba(color);
    }
};

let s = new Settings();
Gtk.main();
