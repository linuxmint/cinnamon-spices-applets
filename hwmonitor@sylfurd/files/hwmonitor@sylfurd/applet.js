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
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const UUID = "hwmonitor@sylfurd";

let gtopFailed = false;
let Providers;
let Graph;
let Support;

if (typeof require !== 'undefined') {
    Providers = require('./providers');
    Graph = require('./graph');
    Support = require('./support');
} else {
    Providers = imports.ui.appletManager.applets['hwmonitor@sylfurd'].providers;
    Graph = imports.ui.appletManager.applets['hwmonitor@sylfurd'].graph;
    Support = imports.ui.appletManager.applets['hwmonitor@sylfurd'].support;
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
  return Gettext.dgettext(UUID, str)
}

function debug_message(message) {
    global.logError("HWMONITOR : " + message);
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

        this.area = new Support.AppletArea();
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
        let cpuProvider =  new Providers.CpuDataProvider();
        let memProvider =  new Providers.MemDataProvider();

        this.graphs = [
            new Graph.Graph(cpuProvider, area, area.graph[0], this.theme_object),
            new Graph.Graph(memProvider, area, area.graph[1], this.theme_object)
        ];
    },

    update_applet_area: function() {
        if (this.area)
            this.area = null;

        this.area = new Support.AppletArea();
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

function main(metadata, orientation, panel_height, instance_id) {
    return new GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id);
}
