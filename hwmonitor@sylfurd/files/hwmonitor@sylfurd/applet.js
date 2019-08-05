/*
Copyright 2012 Renaud Delcoigne (Aka Sylfurd)

This file is part of HWMonitor

HWMonitor is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

Foobar is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along
with Foobar. If not, see http://www.gnu.org/licenses/.
*/

const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cairo = imports.cairo;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;

const UUID = "hwmonitor@sylfurd";
let gtopFailed = false;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
  return Gettext.dgettext(UUID, str)
}

function debug_message(message) {
    global.logError(message);
}

let GTop;
try {
    GTop = imports.gi.GTop;
} catch (e) {
    let icon = new St.Icon({ icon_name: 'utilities-system-monitor',
                           icon_type: St.IconType.FULLCOLOR,
                           icon_size: 24 });
    Main.criticalNotify(_("Dependency missing"), _("Please install the GTop package\n" +
      "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
      "\tFedora: libgtop2-devel\n" +
      "\tArch: libgtop\n" +_(
			"to use the applet %s")).format(UUID), icon);
    gtopFailed = true;
}

function GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

GraphicalHWMonitorApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.get_orientation(orientation); // Initialise for panel orientation
        this.panel_height = panel_height;
        this.graphs = [];

        if (gtopFailed) {
            this.set_applet_icon_path(metadata.path + "/icon.png");
            this.set_applet_tooltip(metadata.description);
            return;
        }

        this.itemOpenSysMon = new PopupMenu.PopupMenuItem(_("Open System Monitor"));        
        this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
        this._applet_context_menu.addMenuItem(this.itemOpenSysMon);

        this.itemReset = new PopupMenu.PopupMenuItem(_("Restart 'Graphical hardware monitor'"));        
        this.itemReset.connect('activate', Lang.bind(this, this.restartGHW));
        this._applet_context_menu.addMenuItem(this.itemReset);

        // Setup the applet settings 
        this.graph_width = 100; // Default width (horizontal panels)
        this.graph_height = 50; // Default height (vertical panels)
        this.frequency = 1;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("graph_width", "graph_width", this.settings_changed);
        this.settings.bind("graph_height", "graph_height", this.settings_changed);
        this.settings.bind("frequency", "frequency", this.settings_changed);

        let height = this.get_height();
        let width = this.get_width();

        this.graphArea = new St.DrawingArea();
        if (this.isHorizontal) {
            this.graphArea.height = height;
            this.graphArea.width = width * 2;

        } else {
            this.graphArea.height = height * 2;
            this.graphArea.width = width;
        }
        this.graphArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));
        this.actor.add_actor(this.graphArea);
        this.setup_graphs(width, height);

        this.actor.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        this.add_update_loop(this.frequency);
    },

    get_height: function() {
        if (this.isHorizontal) 
            return this.panel_height;
         else 
            return this.graph_height;
    },

    get_width: function() {
        if (this.isHorizontal) 
            return this.graph_width;
        else
            return this.panel_height;
    },

    setup_graphs: function (width, height) {
        let cpuProvider =  new CpuDataProvider();
        let memProvider =  new MemDataProvider();

        this.graphs = [
            new Graph(cpuProvider, width, height, this.isHorizontal),
            new Graph(memProvider, width, height, this.isHorizontal)
        ];
    },

    change_graph_area_size: function(refresh_graphs = true) {
        let width = this.get_width();
        let height = this.get_height();

        if (this.isHorizontal) {
            this.graphArea.set_width(width * 2);
            this.graphArea.set_height(height);
        } else {
            this.graphArea.set_width(width);
            this.graphArea.set_height(height * 2);
        }

        if (refresh_graphs)
            this.setup_graphs(width, height);

        return [width, height];
    },

    get_orientation: function (orientation) {
        this.orientation = orientation;
        if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
            if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {                 
                this.isHorizontal = false;  // vertical
            } else {                 
                this.isHorizontal = true;   // horizontal
            }
        } else {
            this.isHorizontal = true;  // Do not check unless >= 3.2
        }
    },

    on_orientation_changed: function(orientation) {
        this.get_orientation(orientation);
        this.change_graph_area_size();
    },

    on_panel_height_changed: function() {  
        this.panel_height = this._panelHeight
        let [width, height] = this.change_graph_area_size();
        this._update();
    },

    on_applet_removed_from_panel: function() {
        if (gtopFailed) return;
        this.remove_update_loop();
    },

    on_applet_clicked: function(event) {
        this._runSysMon();
    },

    add_update_loop: function(frequency) {
        // Start the update loop and allow updates
        this.loopId = Mainloop.timeout_add(frequency*1000, Lang.bind(this, this.update));
        this.shouldUpdate = true;
    },

    remove_update_loop: function() {
        // Remove the update loop and stop updates
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }
        this.shouldUpdate = false;
    },

    update: function() {
        Mainloop.idle_add_full(Mainloop.PRIORITY_LOW, () => this._update());
        return this.shouldUpdate;
    },

    _update: function() {
    	for (let i = 0; i < this.graphs.length; i++) {
            this.graphs[i].refreshData();
        }
        this.graphArea.queue_repaint();
    },

    onGraphRepaint: function (area) {
        let [width, height] = [this.get_width(), this.get_height()];

        for (let index = 0; index < 2; index++) {
            if (this.isHorizontal)
                area.get_context().translate(index * width, 0);
            else
                area.get_context().translate(0, index * height);

            this.graphs[index].paint(area, width, height);
        }
    },

    // Called when the settings have changed
    settings_changed: function () {
        this.restartGHW();
    },

    restartGHW: function() {
        // Refresh the update loop with the new frequency
        this.remove_update_loop();
        this.add_update_loop(this.frequency);
        this.change_graph_area_size();        
    },

    _runSysMon: function() {
    	let _appSys = Cinnamon.AppSystem.get_default();
    	let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
    	_gsmApp.activate();
    },
    
    _runSysMonActivate: function() {
        this._runSysMon();
    },
    
    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function(left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;
        var a = left.split('.'),
            b = right.split('.'),
            i = 0,
            len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
        return 0;
    }
};

function Graph(provider, width, height, horizontal) {
    this._init(provider, width, height, horizontal);
}

Graph.prototype = {

    _init: function (provider, width, height, horizontal) {
        this.provider = provider;

        if (horizontal) {
            this.width = width - 3;     // Adjust for border and space between graphs
            this.height = height - 2;   // Adjust for border
        } else {
            this.width = width - 2;     // Adjust for border
            this.height = height - 3;   // Adjust for border and space between graphs
        }

        this.datas = Array(this.width);

        for (let i = 0; i < this.datas.length; i++) {
            this.datas[i] = 0;
        }
    },

    paint: function (area) {
        let widthOffset1 = Math.round(this.width * 0.5) + 0.5;
        let widthOffset2 = Math.round(this.width * 0.25) + 0.5;
        let widthOffset3 = Math.round(this.width * 0.75) + 0.5;
        let heightOffset1 = Math.round(this.height / 2) + 0.5;
        let heightOffset2 = Math.round(this.height * 0.25) + 0.5;
        let heightOffset3 = Math.round(this.height * 0.75) + 0.5;
        let uiScale7x = global.ui_scale * 7;
        let cr = area.get_context();

		// Border
        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.setLineWidth(1);
        cr.rectangle(0.5, 0.5, this.width + 0.5, this.height + 0.5);
        cr.stroke();

		// Background
        let gradientHeight = this.height - 1;
        let gradientWidth = this.width - 1;
        let gradientOffset = 1;
        let pattern = new Cairo.LinearGradient(0, 0, 0, this.height);
        pattern.addColorStopRGBA(0, 1, 1, 1, 0.3);
        pattern.addColorStopRGBA(1, 0, 0, 0, 0.3);
        cr.setSource(pattern);
        cr.rectangle(1, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();

        // Grid
        cr.setLineWidth(1);
        cr.setSourceRGBA(1, 1, 1, 0.4);
        cr.moveTo(0, heightOffset1);
        cr.lineTo(this.width, heightOffset1);
        cr.stroke();
        cr.moveTo(widthOffset1, 0);
        cr.lineTo(widthOffset1, this.height);
        cr.stroke();
        cr.setSourceRGBA(1, 1, 1, 0.2);
        cr.moveTo(0, heightOffset2);
        cr.lineTo(this.width, heightOffset2);
        cr.stroke();
        cr.moveTo(0, heightOffset3);
        cr.lineTo(this.width, heightOffset3);
        cr.stroke();
        cr.moveTo(widthOffset2, 0);
        cr.lineTo(widthOffset2, this.height);
        cr.stroke();
        cr.moveTo(widthOffset3, 0);
        cr.lineTo(widthOffset3, this.height);
        cr.stroke();

        // Datas
        cr.setLineWidth(0);
        cr.moveTo(1, this.height - this.datas[0]);

        for (let i = 1; i < this.datas.length; i++) {
        	cr.lineTo(i + 1, this.height - this.datas[i]);
        }

    	cr.lineTo(this.datas.length, this.height);
    	cr.lineTo(1, this.height);

    	cr.closePath();

        pattern = new Cairo.LinearGradient(0, 0, 0, this.height);
        cr.setSource(pattern);
        pattern.addColorStopRGBA(0, 1, 0, 0, 1);
        pattern.addColorStopRGBA(0.5, 1, 1, 0.2, 1);
        pattern.addColorStopRGBA(0.7, 0.4, 1, 0.3, 1);
        pattern.addColorStopRGBA(1, 0.2, 0.7, 1, 1);

        cr.fill();

        // Label
		cr.setFontSize(uiScale7x);
        cr.setSourceRGBA(0, 0, 0, 0.5);
		cr.moveTo(global.ui_scale * 2.5, global.ui_scale * 7.5);
		cr.showText(this.provider.name);
        cr.setSourceRGBA(1, 1, 1, 1);
		cr.moveTo(global.ui_scale * 2, uiScale7x);
		cr.showText(this.provider.name);

    },

    refreshData: function() {
        let data = this.provider.getData() * (this.height - 1);

        if (this.datas.push(data) > this.width - 2) {
            this.datas.shift();
        }
    }
};

function CpuDataProvider() {
	this._init();
}

CpuDataProvider.prototype = {

    _init: function(){
        this.gtop = new GTop.glibtop_cpu();
        this.current = 0;
        this.last = 0;
        this.usage = 0;
        this.last_total = 0;
        this.name = _("CPU");
    },

    getData: function() {
        GTop.glibtop_get_cpu(this.gtop);

        this.current = this.gtop.idle;

        let delta = this.gtop.total - this.last_total;
        if (delta > 0) {
            this.usage = (this.current - this.last) / delta;
            this.last = this.current;
            this.last_total = this.gtop.total;
        }

        return 1 - this.usage;
    }
};

function MemDataProvider() {
    this._init();
}

MemDataProvider.prototype = {

    _init: function() {
        this.gtopMem = new GTop.glibtop_mem();
        this.name = _("MEM");
    },

    getData: function() {
        GTop.glibtop_get_mem(this.gtopMem);

        return 1 - (this.gtopMem.buffer + this.gtopMem.cached + this.gtopMem.free) / this.gtopMem.total;
    },
};


function main(metadata, orientation, panel_height, instance_id) {
    return new GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id);
}
