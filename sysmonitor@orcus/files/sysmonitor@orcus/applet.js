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
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const NMClient = imports.gi.NMClient;
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

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation) {
        Applet.Applet.prototype._init.call(this, orientation);

        try {
            this.dir = metadata.path;
            this.loadSettings();
            this.initContextMenu();
            
            this.areas = [];
            this.graphs = [];
            
            let ncpu = GTop.glibtop_get_sysinfo().ncpu;
            if (this.cfg.cpu.enabled)
                this.addGraph(new CpuDataProvider(),  this.cfg.cpu.colors);
            if (this.cfg.mem.enabled)
                this.addGraph(new MemDataProvider(),  this.cfg.mem.colors);
            if (this.cfg.swap.enabled)
                this.addGraph(new SwapDataProvider(), this.cfg.swap.colors);
            if (this.cfg.net.enabled)
                this.addGraph(new NetDataProvider(),  this.cfg.net.colors).setAutoScale(1024);
            if (this.cfg.load.enabled)
                this.addGraph(new LoadAvgDataProvider(), this.cfg.load.colors).setAutoScale(2 * ncpu);

            this.update();
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async('gnome-system-monitor');
    },
    
    on_orientation_changed: function(orientation) {
        this.initContextMenu();
    },
    
    initContextMenu: function() {
        let settings_menu_item = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, this.launchSettings));
        this._applet_context_menu.addMenuItem(settings_menu_item);
    },
    
    addGraph: function(provider, colors) {
        let index = this.areas.length;
        let area = new St.DrawingArea();
        area.set_width(this.cfg.graphWidth);
        area.connect('repaint', Lang.bind(this, function() {this.graphs[index].paint();}));
        this.actor.add(area, {y_fill : true});
        let graph = new Graph(area, provider, colors, this.cfg.backgroundColor, this.cfg.borderColor);
        provider.refreshRate = this.cfg.refreshRate;
        graph.smooth = this.cfg.smooth;
        
        this.areas.push(area);
        this.graphs.push(graph);
        return graph;
    },

    update: function() {
        let tooltip = "";
        for (let i = 0; i < this.graphs.length; ++i)
        {
            this.graphs[i].refresh();
            if (i > 0)
                tooltip = tooltip + "\n";
            tooltip = tooltip + this.graphs[i].provider.getText(false);
        }
        this.set_applet_tooltip(tooltip);
        Mainloop.timeout_add(this.cfg.refreshRate, Lang.bind(this, this.update));
    },
    
    loadSettings: function() {
        try {
            let path = GLib.build_filenamev([this.dir, CONFIG_FILE]);
            let content = Cinnamon.get_file_contents_utf8_sync(path);
            this.cfg = JSON.parse(content);
        } catch (e) {
            //global.log("Failed to load settings: " + e);
            this.cfg = DEFAULT_CONFIG;
        }
    },
    
    launchSettings: function() {
        GLib.spawn_async(this.dir, ["gjs", "settings.js"], null,
            GLib.SpawnFlags.SEARCH_PATH, null);
    }
};

function Graph(area, provider, colors, background, border) {
    this._init(area, provider, colors, background, border);
}

Graph.prototype = {
    _init: function(area, provider, colors, background, border) {
        this.area = area;
        this.provider = provider;
        this.colors = colors;
        this.background = background;
        this.border = border;
        this.smooth = false;
        let datasize = this.area.get_width() - 2;
        this.data = new Array(datasize);
        this.dim = this.provider.getDim();
        this.autoScale = false;
        this.scale = 1;
        
        for (let i = 0; i < this.data.length; ++i)
        {
            this.data[i] = new Array(this.dim);
            for (let j = 0; j < this.data[i].length; ++j)
                this.data[i][j] = 0;
        }
    },
    
    refresh: function() {
        let d = this.provider.getData();
        this.data.push(d);
        this.data.shift();
        this.area.queue_repaint();
        
        if (this.autoScale)
        {
            let maxVal = this.minScale;
            for (let i = 0; i < this.data.length; ++i)
            {
                let sum = this.dataSum(i, this.dim - 1);
                if (sum > maxVal)
                    maxVal = sum;
            }
            this.scale = 1.0 / maxVal;
        }
    },
    
    dataSum: function(i, depth) {
        let sum = 0;
        for (let j = 0; j <= depth; ++j)
            sum += this.data[i][j];
        return sum;
    },
    
    paint: function() {
        let cr = this.area.get_context();
        let [width, height] = this.area.get_size();
        //background
        cr.setSourceRGBA(this.background[0], this.background[1], this.background[2], this.background[3]);
        cr.setLineWidth(1);
        cr.rectangle(0.5, 0.5, width - 1, height - 1);
        cr.fill();
        //data
        if (this.smooth)
        {
            for (let j = this.dim - 1; j >= 0; --j) {
                cr.moveTo(1.5, height);
                this.setColor(cr, j);
                for (let i = 0; i < this.data.length; ++i)
                    cr.lineTo(i + 1.5, height - Math.round((height - 1) * this.scale * this.dataSum(i, j)));
                cr.lineTo(width - 1.5, height);
                cr.lineTo(1.5, height);
                cr.fillPreserve();
                cr.stroke();
            }
        }
        else
        {
            for (let i = 0; i < this.data.length; ++i) {
                for (let j = this.dim - 1; j >= 0; --j) {
                    this.setColor(cr, j);
                    cr.moveTo(i + 1.5, height - 1);
                    cr.relLineTo(0, -Math.round((height - 2) * this.scale * this.dataSum(i, j)));
                    cr.stroke();
                }
            }
        }
        //border
        cr.setSourceRGBA(this.border[0], this.border[1], this.border[2], this.border[3]);
        cr.rectangle(0.5, 0.5, width - 1, height - 1);
        cr.stroke();
    },
    
    setColor: function(cr, i) {
        let c = this.colors[i % this.colors.length];
        cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
    },
    
    setAutoScale: function(minScale)
    {
        if (minScale > 0)
        {
            this.autoScale = true;
            this.minScale = minScale;
        }
        else
            this.autoScale = false;
    }
};

function CpuDataProvider() {
    this._init();
}

CpuDataProvider.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_cpu();
        this.idle_last = 0;
        this.nice_last = 0;
        this.sys_last = 0;
        this.iowait_last = 0;
        this.total_last = 0;
    },
    
    getDim: function() {
        return 3;
    },
    
    getData: function() {
        GTop.glibtop_get_cpu(this.gtop);
        let delta = (this.gtop.total - this.total_last);
        let idle = 0;
        let nice = 0;
        let sys = 0;
        let iowait = 0;
        if (delta > 0) {
	        idle = (this.gtop.idle - this.idle_last) / delta;
	        nice = (this.gtop.nice - this.nice_last) / delta;
	        sys = (this.gtop.sys - this.sys_last) / delta;
	        iowait = (this.gtop.iowait - this.iowait_last) / delta;
        }
        this.idle_last = this.gtop.idle;
        this.nice_last = this.gtop.nice;
        this.sys_last = this.gtop.sys;
        this.iowait_last = this.gtop.iowait;
        this.total_last = this.gtop.total;
        let used = 1-idle-nice-sys-iowait;
        this.text = "CPU: " + Math.round(100 * used) + " %";
        return [used, nice, sys, iowait];
    },
    
    getText: function() {
        return this.text;
    }
};

function MemDataProvider() {
    this._init();
}

MemDataProvider.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_mem();
    },
    
    getDim: function() {
        return 2;
    },
    
    getData: function() {
        GTop.glibtop_get_mem(this.gtop);
        let used = this.gtop.used / this.gtop.total;
        let cached = (this.gtop.buffer + this.gtop.cached) / this.gtop.total;
        this.text = "Memory: " + Math.round((this.gtop.used - this.gtop.cached - this.gtop.buffer) / (1024 * 1024))
            + " / " + Math.round(this.gtop.total / (1024 * 1024)) + " MB";
        return [used-cached, cached];
    },
    
    getText: function() {
        return this.text;
    }
};

function SwapDataProvider() {
    this._init();
}

SwapDataProvider.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_swap();
    },
    
    getDim: function() {
        return 1;
    },
    
    getData: function() {
        GTop.glibtop_get_swap(this.gtop);
        let used = this.gtop.used / this.gtop.total;
        this.text = "Swap: " + Math.round(this.gtop.used / (1024 * 1024))
            + " / " + Math.round(this.gtop.total / (1024 * 1024)) + " MB";
        return [used];
    },
    
    getText: function() {
        return this.text;
    }
};

function NetDataProvider() {
    this._init();
}

NetDataProvider.prototype = {
    _init: function () {
        this.gtop = new GTop.glibtop_netload();
        let dev = NMClient.Client.new().get_devices();
        this.devices = [];
        for (let i = 0; i < dev.length; ++i)
            this.devices.push(dev[i].get_iface());
        
        [this.down_last, this.up_last] = this.getNetLoad();
    },
    
    getDim: function() {
        return 2;
    },
    
    getData: function() {
        let [down, up] = this.getNetLoad();
        let down_delta = (down - this.down_last) * 1000 / this.refreshRate;
        let up_delta = (up - this.up_last) * 1000 / this.refreshRate;
        this.down_last = down;
        this.up_last = up;
        this.text = "Network D/U: " + Math.round(down_delta/1024) + " / " + Math.round(up_delta/1024) + " KB/s";
        return [down_delta, up_delta];
    },
    
    getText: function() {
        return this.text;
    },

    getNetLoad: function() {
        let down = 0;
        let up = 0;
        for (let i = 0; i < this.devices.length; ++i)
        {
            GTop.glibtop.get_netload(this.gtop, this.devices[i]);
            down += this.gtop.bytes_in;
            up += this.gtop.bytes_out;
        }
        return [down, up];
    }
};

function LoadAvgDataProvider() {
    return this._init();
}

LoadAvgDataProvider.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_loadavg();
    },
    
    getDim: function() {
        return 1;
    },
    
    getData: function() {
        GTop.glibtop_get_loadavg(this.gtop);
        let load = this.gtop.loadavg[0];
        this.text = "Load average: " + this.gtop.loadavg[0]
            + ", " + this.gtop.loadavg[1]
            + ", " + this.gtop.loadavg[2];
        return [load];
    },
    
    getText: function() {
        return this.text;
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}
