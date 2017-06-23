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
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

const _ = imports.applet._;
const Graph = imports.applet.graph.Graph;
const Providers = imports.applet.providers;

function colorToArray(c) {
    c = c.match(/\((.*)\)/)[1].split(",").map(Number);
    c = [c[0]/255, c[1]/255, c[2]/255, 3 in c ? c[3] : 1]
    return c;
}

function MyTooltip(panelItem, initTitle, orientation) {
    this._init(panelItem, initTitle, orientation);
}

MyTooltip.prototype = {
    __proto__: Tooltips.PanelItemTooltip.prototype,

    _init: function(panelItem, initTitle, orientation) {
        Tooltips.PanelItemTooltip.prototype._init.call(this, panelItem, initTitle, orientation);
        this._tooltip.set_style("text-align:left");
    },

    set_text: function(text) {
        this._tooltip.get_clutter_text().set_markup(text);
    }
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.graph_ids = ["cpu", "mem", "swap", "net", "load"];
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            let binds = [
                ["onclick_program"],
                ["smooth", this.on_cfg_changed_smooth],
                ["refresh_rate", this.on_cfg_changed_refresh_rate],
                ["draw_border", this.on_cfg_changed_draw_border],
                ["bg_color", this.on_cfg_changed_bg_border_color],
                ["border_color", this.on_cfg_changed_bg_border_color],
                ["graph_width", this.on_cfg_changed_graph_width],
                ["cpu_enabled", this.on_cfg_changed_graph_enabled, 0],
                ["cpu_override_graph_width", this.on_cfg_changed_graph_width, 0],
                ["cpu_graph_width", this.on_cfg_changed_graph_width, 0],
                ["cpu_color_0", this.on_cfg_changed_color, 0],
                ["cpu_color_1", this.on_cfg_changed_color, 0],
                ["cpu_color_2", this.on_cfg_changed_color, 0],
                ["cpu_color_3", this.on_cfg_changed_color, 0],
                ["mem_enabled", this.on_cfg_changed_graph_enabled, 1],
                ["mem_override_graph_width", this.on_cfg_changed_graph_width, 1],
                ["mem_graph_width", this.on_cfg_changed_graph_width, 1],
                ["mem_color_0", this.on_cfg_changed_color, 1],
                ["mem_color_1", this.on_cfg_changed_color, 1],
                ["swap_enabled", this.on_cfg_changed_graph_enabled, 2],
                ["swap_override_graph_width", this.on_cfg_changed_graph_width, 2],
                ["swap_graph_width", this.on_cfg_changed_graph_width, 2],
                ["swap_color_0", this.on_cfg_changed_color, 2],
                ["net_enabled", this.on_cfg_changed_graph_enabled, 3],
                ["net_override_graph_width", this.on_cfg_changed_graph_width, 3],
                ["net_graph_width", this.on_cfg_changed_graph_width, 3],
                ["net_color_0", this.on_cfg_changed_color, 3],
                ["net_color_1", this.on_cfg_changed_color, 3],
                ["load_enabled", this.on_cfg_changed_graph_enabled, 4],
                ["load_override_graph_width", this.on_cfg_changed_graph_width, 4],
                ["load_graph_width", this.on_cfg_changed_graph_width, 4],
                ["load_color_0", this.on_cfg_changed_color, 4]
            ];
            let use_bind = typeof this.settings.bind === "function";
            for (let [prop, callback, arg] of binds) {
                if (use_bind)
                    this.settings.bind(prop, "cfg_" + prop, callback, arg);
                else
                    this.settings.bindProperty(Settings.BindingDirection.IN, prop, "cfg_" + prop, callback, arg);
            }

            try {
                this.tooltip = new MyTooltip(this, "", orientation);
            }
            catch (e) {
                global.logError("Error while initializing tooltip: " + e.message);
            }

            this.bg_color = colorToArray(this.cfg_bg_color);
            this.border_color = colorToArray(this.cfg_border_color);
            this.areas = new Array(this.graph_ids.length).fill(null);
            this.graphs = new Array(this.graph_ids.length).fill(null);
            this.graph_order = [0,1,2,3,4];
            this.graph_indices = new Array(this.graph_ids.length).fill(null);
            
            this.on_cfg_changed_graph_enabled();
            this.update();
        }
        catch (e) {
            global.logError(e.message);
        }
    },
    
    addGraph: function(provider, graph_idx) {
        let graph_id = this.graph_ids[graph_idx];

        let area = new St.DrawingArea();
        this.actor.insert_child_at_index(area, this.graph_indices[graph_idx]);
        let graph = new Graph(area, provider);
        this.areas[graph_idx] = area;
        this.graphs[graph_idx] = graph;

        provider.refresh_rate = this.cfg_refresh_rate;
        graph.smooth = this.cfg_smooth;
        graph.setWidth(this.getGraphWidth(graph_idx));
        graph.setColors(this.getGraphColors(graph_idx));
        graph.setDrawBorder(this.cfg_draw_border);
        graph.bg_color = this.bg_color;
        graph.border_color = this.border_color;
        
        return graph;
    },

    update: function() {
        let tooltip = "";
        for (let i = 0; i < this.graphs.length; ++i)
        {
            if (this.graphs[i]) {
                this.graphs[i].refresh();
                if (i > 0)
                    tooltip = tooltip + "\n";
                let text = this.graphs[i].provider.getText();
                if (this.tooltip)
                    tooltip = tooltip + "<b>" + text[0] + "</b> " + text[1];
                else
                    tooltip = tooltip + text[0] + " " + text[1];
            }
        }
        if (this.tooltip)
            this.tooltip.set_text(tooltip);
        else
            this.set_applet_tooltip(tooltip);
        this.update_timeout_id = Mainloop.timeout_add(Math.max(100, this.cfg_refresh_rate), Lang.bind(this, this.update));
    },
    
    recalcGraphIndices: function() {
        let idx = 0;
        for (let i = 0; i < this.graph_ids.length; i++) {
            let graph_id = this.graph_ids[i];
            let enabled = this["cfg_" + graph_id + "_enabled"];
            if (!enabled)
                continue;
            this.graph_indices[i] = idx++;
        }
    },

    getGraphWidth: function(graph_idx) {
        let graph_id = this.graph_ids[graph_idx];
        return this["cfg_" + graph_id + "_override_graph_width"] ? this["cfg_" + graph_id + "_graph_width"] : this.cfg_graph_width;
    },

    getGraphColors: function(graph_idx) {
        let graph_id = this.graph_ids[graph_idx];
        let c = [];
        for (let j = 0; j < this.graphs[graph_idx].dim; j++) {
            let prop = "cfg_" + graph_id + "_color_" + j;
            if (this.hasOwnProperty(prop))
                c.push(colorToArray(this[prop]));
            else
                break;
        }
        return c;
    },
    
    //Cinnamon callbacks
    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async(this.cfg_onclick_program);
    },

    on_applet_removed_from_panel: function() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        this.settings.finalize();
    },

    //Configuration change callbacks
    on_cfg_changed_graph_enabled: function(enabled, graph_idx) {
        this.recalcGraphIndices();
        let enable = (i) => {
            let graph_id = this.graph_ids[i];
            if (this["cfg_" + graph_id + "_enabled"]) {
                if (this.graphs[i])
                    return;
                if (i == 0)
                    this.addGraph(new Providers.CpuData(), i);
                else if (i == 1)
                    this.addGraph(new Providers.MemData(), i);
                else if (i == 2)
                    this.addGraph(new Providers.SwapData(), i);
                else if (i == 3)
                    this.addGraph(new Providers.NetData(), i).setAutoScale(1024);
                else if (i == 4) {
                    let ncpu = GTop.glibtop_get_sysinfo().ncpu;
                    this.addGraph(new Providers.LoadAvgData(), i).setAutoScale(2 * ncpu);
                }
            }
            else {
                if (!this.graphs[i])
                    return;
                this.actor.remove_child(this.areas[i]);
                this.graphs[i] = null;
                this.areas[i] = null;
            }
        };
        if (graph_idx)
            enable(graph_idx);
        else
            for (let i = 0; i < this.graphs.length; i++)
                enable(i);
    },

    on_cfg_changed_smooth: function() {
        for (let g of this.graphs) {
            g.smooth = this.cfg_smooth;
            g.repaint();
        }
    },

    on_cfg_changed_refresh_rate: function() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        for (let g of this.graphs)
            g.provider.refresh_rate = this.cfg_refresh_rate;
        this.update();
    },

    on_cfg_changed_draw_border: function() {
        for (let g of this.graphs) {
            g.setDrawBorder(this.cfg_draw_border);
            g.repaint();
        }
    },

    on_cfg_changed_bg_border_color: function() {
        this.bg_color = colorToArray(this.cfg_bg_color);
        this.border_color = colorToArray(this.cfg_border_color);
        for (let g of this.graphs) {
            g.bg_color = this.bg_color;
            g.border_color = this.border_color;
            g.repaint();
        }
    },

    on_cfg_changed_graph_width: function(width, graph_idx) {
        if (graph_idx) {
            if (this.graphs[graph_idx])
                this.graphs[graph_idx].setWidth(this.getGraphWidth(graph_idx));
        }
        else
            for (let i = 0; i < this.graphs.length; i++)
                if (this.graphs[i])
                    this.graphs[i].setWidth(this.getGraphWidth(i));
    },

    on_cfg_changed_color: function(width, graph_idx) {
        if (graph_idx) {
            if (this.graphs[graph_idx])
                this.graphs[graph_idx].setColors(this.getGraphColors(graph_idx));
        }
        else
            for (let i = 0; i < this.graphs.length; i++)
                if (this.graphs[i])
                    this.graphs[i].setColors(this.getGraphColors(i));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
