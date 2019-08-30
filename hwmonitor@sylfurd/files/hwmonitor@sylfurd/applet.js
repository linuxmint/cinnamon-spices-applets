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
    global.logError("HWMONITOR : " + message);
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
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("graph_width", "graph_width", this.settings_changed);
        this.settings.bind("graph_height", "graph_height", this.settings_changed);
        this.settings.bind("frequency", "frequency", this.settings_changed);
        this.settings.bind("theme", "theme", this.settings_changed);
        this.settings.bind("border_color", "border_color", this.settings_changed);
        this.settings.bind("background_color1", "background_color1", this.settings_changed);
        this.settings.bind("background_color2", "background_color2", this.settings_changed);
        this.settings.bind("label_color", "label_color", this.settings_changed);
        this.settings.bind("graph_color1", "graph_color1", this.settings_changed);
        this.settings.bind("graph_color2", "graph_color2", this.settings_changed);
        this.settings.bind("graph_color3", "graph_color3", this.settings_changed);
        this.settings.bind("graph_color4", "graph_color4", this.settings_changed);
        this.settings.bind("graph_offset2", "graph_offset2", this.settings_changed);
        this.settings.bind("graph_offset3", "graph_offset3", this.settings_changed);
        this.settings.bind("custom_labels", "custom_labels", this.settings_changed);
        this.settings.bind("cpu_label", "cpu_label", this.settings_changed);
        this.settings.bind("mem_label", "mem_label", this.settings_changed);
        
        this.create_theme_object();

        this.area = new AppletArea();
        this.area.init(this.isHorizontal,this.get_width(), this.get_height());

        this.graphArea = new St.DrawingArea();
        this.graphArea.height = this.area.height;
        this.graphArea.width = this.area.width;

        this.graphArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));
        this.actor.add_actor(this.graphArea);
        this.update_graphs(this.area);

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

    update_graphs: function (area) {
        let cpuProvider =  new CpuDataProvider();
        let memProvider =  new MemDataProvider();

        this.graphs = [
            new Graph(cpuProvider, area, area.graph[0], this.theme_object),
            new Graph(memProvider, area, area.graph[1], this.theme_object)
        ];
    },

    update_applet_area: function() {
        if (this.area)
            this.area = null;

        this.area = new AppletArea();
        this.area.init(this.isHorizontal,this.get_width(), this.get_height());

        if (this.graphArea) {
            this.actor.remove_actor(this.graphArea);    
            this.graphArea = null;        
        }
            
        this.graphArea = new St.DrawingArea();
        this.graphArea.height = this.area.height;
        this.graphArea.width = this.area.width;
        this.graphArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));
        this.actor.add_actor(this.graphArea);

        this.update_graphs(this.area);
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
        this.update_applet_area();
    },

    on_panel_height_changed: function() {  
        this.panel_height = this._panelHeight
        this.update_applet_area();
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

    // Redraws the graphs
    onGraphRepaint: function (area) {
        let [width, height] = [this.get_width(), this.get_height()];

        for (let index = 0; index < 2; index++) {
            if (this.isHorizontal)
                area.get_context().translate(index * width, 0);
            else
                area.get_context().translate(0, index * height);

            this.graphs[index].paint(area);
        }
    },

    // Called when the settings have changed
    settings_changed: function () {        
        this.restartGHW();
    },

    // Gets color on format 'rgba(255,255,255,0.5) and returns an array of four values
    get_colors:function (rgb) {
        let colors = rgb.replace(/[^\d,]/g, '').split(',');
        for(let i=0;i<3;i++) {
            colors[i] /= 255;
        }

        return colors;
    },

    // Creates an object containing the users selected theme settings
    create_theme_object: function() {
        this.theme_object = new Object();
        this.theme_object.theme = this.theme;
        this.theme_object.border_colors = this.get_colors(this.border_color);
        this.theme_object.background_colors1 = this.get_colors(this.background_color1);
        this.theme_object.background_colors2 = this.get_colors(this.background_color2);
        this.theme_object.label_color = this.get_colors(this.label_color);
        this.theme_object.graph_color1 = this.get_colors(this.graph_color1);
        this.theme_object.graph_color2 = this.get_colors(this.graph_color2);
        this.theme_object.graph_color3 = this.get_colors(this.graph_color3);
        this.theme_object.graph_color4 = this.get_colors(this.graph_color4);
        this.theme_object.graph_offset2 = this.graph_offset2;
        this.theme_object.graph_offset3 = this.graph_offset3;
        this.theme_object.custom_labels = this.custom_labels;
        this.theme_object.cpu_label = this.cpu_label;
        this.theme_object.mem_label = this.mem_label;
    },

    // Restarts GHW if something stopped it from working.
    // Can happen for example after computer comes back from a suspend
    restartGHW: function() {
        // Refresh the update loop with the new frequency
        this.create_theme_object();
        this.remove_update_loop();
        this.add_update_loop(this.frequency);
        this.update_applet_area();        
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

// Class responsible for drawing an instance of one graph
function Graph(provider, appletArea, graphArea, theme) {    
    this._init(provider, appletArea, graphArea, theme);
}

Graph.prototype = {

    _init: function (provider, appletArea, graphArea, theme) {
        this.provider = provider;
        this.area = appletArea;
        this.graph = graphArea;
        this.theme = theme;

        this.datas = Array(this.graph.inner.width-1);

        for (let i = 0; i < this.datas.length; i++) {
            this.datas[i] = 0;
        }
    },

    paint: function (area) {
        let uiScale7x = global.ui_scale * 7;
        let cr = area.get_context();

        // Since Cairo uses antialiasing, we need to translate all coordinates
        // by half a pixel rather than having to deal with half a pixel everywhere
        // See for example: https://stackoverflow.com/questions/8696631/canvas-drawings-like-lines-are-blurry
        // We also translate to the (outer.left,outer.top) corner.
        cr.translate(this.graph.outer.left + 0.5, this.graph.outer.top + 0.5);

        // Draw border
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.5);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.5);
        }
        cr.setLineWidth(1);
        cr.rectangle(0, 0, 
                    this.graph.outer.width, this.graph.outer.height);
        cr.stroke();

		// Draw background
        let pattern = new Cairo.LinearGradient(0, 0, 0, this.graph.inner.height);
        
        if (this.theme.theme=="light") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.4);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.4);
        } else if (this.theme.theme=="dark") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.3);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.3);
        } else {
            pattern.addColorStopRGBA(0, this.theme.background_colors1[0], this.theme.background_colors1[1], this.theme.background_colors1[2], 0.7);
            pattern.addColorStopRGBA(1, this.theme.background_colors2[0], this.theme.background_colors2[1], this.theme.background_colors2[2], 0.7);
        }
        cr.setSource(pattern);
        cr.rectangle(0, 0, this.graph.inner.width, this.graph.inner.height);
        cr.fill();

        // Draw graph grid lines
        let widthOffset1 = Math.round(this.graph.inner.width * 0.5);
        let widthOffset2 = Math.round(this.graph.inner.width * 0.25);
        let widthOffset3 = Math.round(this.graph.inner.width * 0.75);
        let heightOffset1 = Math.round(this.graph.inner.height * 0.5);
        let heightOffset2 = Math.round(this.graph.inner.height * 0.25);
        let heightOffset3 = Math.round(this.graph.inner.height * 0.75);
        cr.setLineWidth(1);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.4);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.4);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.4);
        }
        // Center horizontal line
        cr.moveTo(1, heightOffset1);
        cr.lineTo(this.graph.inner.width, heightOffset1);
        cr.stroke();
        // Center vertical line
        cr.moveTo(widthOffset1, 1);
        cr.lineTo(widthOffset1, this.graph.inner.height);
        cr.stroke();
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.2);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.2);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.2);
        }
        // 25% horizontal line
        cr.moveTo(1, heightOffset2);
        cr.lineTo(this.graph.inner.width, heightOffset2);
        cr.stroke();
        // 75% horizontal line
        cr.moveTo(1, heightOffset3);
        cr.lineTo(this.graph.inner.width, heightOffset3);
        cr.stroke();
        // 25% vertical line
        cr.moveTo(widthOffset2, 1);
        cr.lineTo(widthOffset2, this.graph.inner.height);
        cr.stroke();
        // 75% vertical line
        cr.moveTo(widthOffset3, 1);
        cr.lineTo(widthOffset3, this.graph.inner.height);
        cr.stroke();

        // Draw data points
        cr.setLineWidth(0);
        cr.moveTo(1, this.graph.inner.height - this.datas[0]);
        for (let i = 1; i < this.datas.length; i++) {
        	cr.lineTo(i + 1, this.graph.inner.height - this.datas[i]);
        }
    	cr.lineTo(this.datas.length, this.graph.inner.height);
        cr.lineTo(1, this.graph.inner.height);
    	cr.closePath();

        pattern = new Cairo.LinearGradient(0, this.graph.inner.top, 0, this.graph.inner.top + this.graph.inner.height);
        cr.setSource(pattern);
        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(0, this.theme.graph_color4[0], this.theme.graph_color4[1], this.theme.graph_color4[2], 1);
        else 
            pattern.addColorStopRGBA(0, 1, 0, 0, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(this.theme.graph_offset3, this.theme.graph_color3[0], this.theme.graph_color3[1], this.theme.graph_color3[2], 1);
        else 
            pattern.addColorStopRGBA(0.5, 1, 1, 0.2, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(this.theme.graph_offset2, this.theme.graph_color2[0], this.theme.graph_color2[1], this.theme.graph_color2[2], 1);
        else 
            pattern.addColorStopRGBA(0.7, 0.4, 1, 0.3, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(1, this.theme.graph_color1[0], this.theme.graph_color1[1], this.theme.graph_color1[2], 1);        
        else 
            pattern.addColorStopRGBA(1, 0.2, 0.7, 1, 1);
        cr.fill();

        // Draw label
        cr.setFontSize(uiScale7x);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.5);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 0.5);
        }
        cr.moveTo(global.ui_scale * 2.5, global.ui_scale * 7.5 + 0.5);

        if (this.theme.custom_labels) {
            if (this.provider.type == "CPU")
                cr.showText(this.theme.cpu_label);
            else
                cr.showText(this.theme.mem_label);
        }
        else
            cr.showText(this.provider.name);

        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 1);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 1);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 1);
        }
		cr.moveTo(global.ui_scale * 2, uiScale7x + 0.5);
        if (this.theme.custom_labels) {
            if (this.provider.type == "CPU")
                cr.showText(this.theme.cpu_label);
            else
                cr.showText(this.theme.mem_label);
        }
        else
            cr.showText(this.provider.name);

        // Reset translation
        cr.translate(- (this.graph.outer.left + 0.5), -(this.graph.outer.top + 0.5));
    },

    refreshData: function() {
        let data = this.provider.getData() * (this.graph.inner.height - 1);

        if (this.datas.push(data) > this.graph.inner.width - 2) {
            this.datas.shift();
        }
    }
};

// Class responsible for getting CPU data
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
        this.type = "CPU";
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

// Class responsible for getting memory data
function MemDataProvider() {
    this._init();
}

MemDataProvider.prototype = {

    _init: function() {
        this.gtopMem = new GTop.glibtop_mem();
        this.name = _("MEM");
        this.type = "MEM";
    },

    getData: function() {
        GTop.glibtop_get_mem(this.gtopMem);

        return 1 - (this.gtopMem.buffer + this.gtopMem.cached + this.gtopMem.free) / this.gtopMem.total;
    },
};

// Class responsible for keeping track of the entire applet area
class AppletArea {
    init(isHorizontal, graphWidth, graphHeight) {
        this.isHorizontal = isHorizontal;

        if (this.isHorizontal) {
            // An area big enough to have two graphs next to each other
            this.height = graphHeight;
            this.width = graphWidth * 2;

        } else {
            // An area big enough to have two graphs on top of each other
            this.height = graphHeight * 2;
            this.width = graphWidth;
        }

        this.graph = [];
        this.graph[0] = new GraphArea();
        this.graph[0].init(this, graphWidth, graphHeight);
        this.graph[1] = new GraphArea();
        this.graph[1].init(this, graphWidth, graphHeight);
    }
}

// Class responsible for keeping track of the area for one of the graphs
class GraphArea {    
    init(parent, width, height) {
        // Set the actual drawing area of the graph
        // which is sligthly smaller because of themes,
        // borders and space between graphs etc
        if (parent.isHorizontal) {
            this.outer = new Box();
            this.outer.init(2, 0, width - 4, height - 6);

            this.inner = new Box();
            this.inner.initFromBox(this.outer, 1);
        } else {
            this.outer = new Box();
            this.outer.init(0, 3, width - 8, height - 4);

            this.inner = new Box();
            this.inner.initFromBox(this.outer, 1);
        }
    }
}

// Just a square class
class Box {
    init(top, left, width, height) {
        this.top = top;
        this.left = left;
        this.width = width;
        this.height = height;
    }

    initFromBox(box, delta) {
        this.top = box.top + delta;
        this.left = box.left + delta;
        this.width = box.width;
        this.height = box.height;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id);
}
