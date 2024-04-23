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
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

let _, GTop, Graph, Providers;
if (typeof require !== 'undefined') {
    Graph = require('./graph').Graph;
    Providers = require('./providers');
    let init = require('./init');
    _ = init._;
    GTop = init.GTop;
} else {
    const AppletDir = imports.ui.appletManager.applets['sysmonitor@orcus'];
    _ = AppletDir.init._;
    GTop = AppletDir.init.GTop;
    Graph = AppletDir.graph.Graph;
    Providers = AppletDir.providers;
}

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

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            if (!GTop) {
                let icon = new St.Icon();
                icon.set_icon_size(panel_height);
                icon.set_icon_name("face-sad");
                let label = new St.Label();
                label.set_text("Error initializing applet");
                this.actor.add(icon);
                this.actor.add(label);
                this.set_applet_tooltip("glibtop not found, please install glibtop with GObject introspection and reload the applet.\n\nLinux Mint, Ubuntu: sudo apt-get install gir1.2-gtop-2.0\nFedora: sudo dnf install libgtop2");
                return;
            }
            this.vertical = orientation == St.Side.LEFT || orientation == St.Side.RIGHT;
            this.graph_ids = ["cpu", "mem", "swap", "net", "load"];
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            let binds = [
                ["onclick_program"],
                ["smooth", this.on_cfg_changed_smooth],
                ["refresh_rate", this.on_cfg_changed_refresh_rate],
                ["draw_border", this.on_cfg_changed_draw_border],
                ["use_padding", this.on_cfg_changed_padding],
                ["padding_lr", this.on_cfg_changed_padding],
                ["padding_tb", this.on_cfg_changed_padding],
                ["bg_color", this.on_cfg_changed_bg_border_color],
                ["border_color", this.on_cfg_changed_bg_border_color],
                ["graph_width", this.on_cfg_changed_graph_width],
                ["graph_spacing", this.on_cfg_changed_graph_spacing],
                ["cpu_enabled", this.on_cfg_changed_graph_enabled, 0],
                ["cpu_override_graph_width", this.on_cfg_changed_graph_width, 0],
                ["cpu_graph_width", this.on_cfg_changed_graph_width, 0],
                ["cpu_tooltip_decimals", this.on_cfg_changed_tooltip_decimals, 0],
                ["cpu_color_0", this.on_cfg_changed_color, 0],
                ["cpu_color_1", this.on_cfg_changed_color, 0],
                ["cpu_color_2", this.on_cfg_changed_color, 0],
                ["cpu_color_3", this.on_cfg_changed_color, 0],
                ["mem_enabled", this.on_cfg_changed_graph_enabled, 1],
                ["mem_override_graph_width", this.on_cfg_changed_graph_width, 1],
                ["mem_graph_width", this.on_cfg_changed_graph_width],
                ["mem_color_0", this.on_cfg_changed_color, 1],
                ["mem_color_1", this.on_cfg_changed_color, 1],
                ["swap_enabled", this.on_cfg_changed_graph_enabled, 2],
                ["swap_override_graph_width", this.on_cfg_changed_graph_width, 2],
                ["swap_graph_width", this.on_cfg_changed_graph_width],
                ["swap_color_0", this.on_cfg_changed_color, 2],
                ["net_enabled", this.on_cfg_changed_graph_enabled, 3],
                ["net_override_graph_width", this.on_cfg_changed_graph_width, 3],
                ["net_graph_width", this.on_cfg_changed_graph_width],
                ["net_minimum_graph_scale", this.on_cfg_changed_graph_scale],
                ["net_color_0", this.on_cfg_changed_color, 3],
                ["net_color_1", this.on_cfg_changed_color, 3],
                ["load_enabled", this.on_cfg_changed_graph_enabled, 4],
                ["load_override_graph_width", this.on_cfg_changed_graph_width, 4],
                ["load_graph_width", this.on_cfg_changed_graph_width],
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
            this.areas = new Array(this.graph_ids.length)
            this.graphs = new Array(this.graph_ids.length)
            for (let i = 0; i < this.graph_ids.length; i++)
                this.graphs[i] = null;
            this.resolution_needs_update = true;

            this.area = new St.DrawingArea();
            this.actor.add_child(this.area);
            this.area.connect("repaint", Lang.bind(this, function() { this.paint(); }));
            
            this.on_cfg_changed_graph_enabled();
            this.on_cfg_changed_padding();
            this.update();
        }
        catch (e) {
            global.logError(e.message);
        }
    },
    
    addGraph: function(provider, graph_idx) {
        let graph = new Graph(provider);
        this.graphs[graph_idx] = graph;

        provider.refresh_rate = this.cfg_refresh_rate;
        graph.setSmooth(this.cfg_smooth);
        graph.setDrawBorder(this.cfg_draw_border);
        graph.setColors(this.getGraphColors(graph_idx));
        graph.setBGColor(this.bg_color);
        graph.setBorderColor(this.border_color);
        let tooltip_decimals = this.getGraphTooltipDecimals(graph_idx);
        if (typeof tooltip_decimals !== "undefined")
            provider.setTextDecimals(tooltip_decimals);
        
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

        this.repaint();

        this.update_timeout_id = Mainloop.timeout_add(Math.max(100, this.cfg_refresh_rate), Lang.bind(this, this.update));
    },

    paint: function() {
        if (this.resolution_needs_update) {
            // Drawing area size can be reliably retrieved only in repaint callback
            let [area_width, area_height] = this.area.get_size();
            for (let i = 0; i < this.graphs.length; i++) {
                if (this.graphs[i])
                    this.updateGraphResolution(i, area_width, area_height);
            }
            this.resolution_needs_update = false;
        }

        let cr = this.area.get_context();
        let graph_offset = 0;

        for (let i = 0; i < this.graphs.length; i++) {
            if (this.graphs[i]) {
                if (this.vertical)
                    cr.translate(0, graph_offset);
                else
                    cr.translate(graph_offset, 0);

                this.graphs[i].paint(cr, this.cfg_graph_spacing == -1 && i > 0);

                graph_offset = this.getGraphWidth(i) + this.cfg_graph_spacing;
            }
        }

        cr.$dispose();
    },

    repaint: function() {
        this.area.queue_repaint();
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

    getNetGraphScale: function() {
        if (!this.cfg_net_minimum_graph_scale)
            return 1024;

        return this.cfg_net_minimum_graph_scale * 1000000 / 8; // Mb to MB
    },

    getGraphTooltipDecimals: function(graph_idx) {
        let graph_id = this.graph_ids[graph_idx];
        let prop = "cfg_" + graph_id + "_tooltip_decimals";
        if (this.hasOwnProperty(prop))
            return this[prop];
    },

    resizeArea: function() {
        let total_graph_width = 0;
        let enabled_graphs = 0;
        for (let i = 0; i < this.graphs.length; i++) {
            if (this.graphs[i]) {
                total_graph_width += this.getGraphWidth(i);
                enabled_graphs++;
            }
        }
        if (enabled_graphs > 1)
            total_graph_width += this.cfg_graph_spacing * (enabled_graphs - 1);

        if (this.vertical)
            this.area.set_size(-1, total_graph_width);
        else
            this.area.set_size(total_graph_width, -1);

        this.resolution_needs_update = true;
    },

    updateGraphResolution: function(graph_idx, area_width, area_height) {
        if (this.vertical)
            this.graphs[graph_idx].setResolution(area_width, this.getGraphWidth(graph_idx));
        else
            this.graphs[graph_idx].setResolution(this.getGraphWidth(graph_idx), area_height);
    },
    
    //Cinnamon callbacks
    on_applet_clicked: function(event) {
        if (this.cfg_onclick_program)
            GLib.spawn_command_line_async(this.cfg_onclick_program);
    },

    on_applet_removed_from_panel: function() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        if (this.settings)
            this.settings.finalize();
    },

    on_orientation_changed: function(orientation) {
        this.vertical = orientation == St.Side.LEFT || orientation == St.Side.RIGHT;
        this.on_cfg_changed_graph_width();
    },

    //Configuration change callbacks
    on_cfg_changed_graph_enabled: function(enabled, graph_idx) {
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
                    this.addGraph(new Providers.NetData(), i).setAutoScale(this.getNetGraphScale());
                else if (i == 4) {
                    let ncpu = GTop.glibtop_get_sysinfo().ncpu;
                    this.addGraph(new Providers.LoadAvgData(), i).setAutoScale(2 * ncpu);
                }
            }
            else if (this.graphs[i]) {
                this.graphs[i] = null;
            }
        };
        if (typeof graph_idx !== "undefined")
            enable(graph_idx);
        else
            for (let i = 0; i < this.graphs.length; i++)
                enable(i);

        this.resizeArea();
    },

    on_cfg_changed_smooth: function() {
        for (let g of this.graphs) {
            if (g)
                g.smooth = this.cfg_smooth;
        }
        this.repaint();
    },

    on_cfg_changed_refresh_rate: function() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        for (let g of this.graphs)
            if (g)
                g.provider.refresh_rate = this.cfg_refresh_rate;
        this.update();
    },

    on_cfg_changed_draw_border: function() {
        for (let g of this.graphs) {
            if (g)
                g.setDrawBorder(this.cfg_draw_border);
        }
        this.repaint();
    },

    on_cfg_changed_padding: function() {
        if (this.cfg_use_padding) {
            let style = "padding:" + this.cfg_padding_tb + "px " + this.cfg_padding_lr + "px;";
            this.actor.set_style(style);
        }
        else
            this.actor.set_style("");

        this.resolution_needs_update = true;
        this.repaint();
    },

    on_cfg_changed_bg_border_color: function() {
        this.bg_color = colorToArray(this.cfg_bg_color);
        this.border_color = colorToArray(this.cfg_border_color);
        for (let g of this.graphs) {
            if (g) {
                g.bg_color = this.bg_color;
                g.border_color = this.border_color;
            }
        }
        this.repaint();
    },

    on_cfg_changed_graph_width: function() {
        this.resizeArea();
        this.repaint();
    },

    on_cfg_changed_graph_spacing: function() {
        this.resizeArea();
        this.repaint();
    },

    on_cfg_changed_graph_scale: function() {
        this.graphs[3].setAutoScale(this.getNetGraphScale());
        this.repaint();
    },

    on_cfg_changed_tooltip_decimals: function(decimals, graph_idx) {
        if (typeof graph_idx !== "undefined") {
            let provider = this.graphs[graph_idx].provider;
            if ("setTextDecimals" in provider)
                provider.setTextDecimals(this.getGraphTooltipDecimals(graph_idx));
        }
        else
            for (let i = 0; i < this.graphs.length; i++)
                if (this.graphs[i]) {
                    let provider = this.graphs[i].provider;
                    if ("setTextDecimals" in provider)
                        provider.setTextDecimals(this.getGraphTooltipDecimals(i));
                }
    },

    on_cfg_changed_color: function(width, graph_idx) {
        if (typeof graph_idx !== "undefined") {
            if (this.graphs[graph_idx])
                this.graphs[graph_idx].setColors(this.getGraphColors(graph_idx));
        }
        else
            for (let i = 0; i < this.graphs.length; i++)
                if (this.graphs[i])
                    this.graphs[i].setColors(this.getGraphColors(i));
        this.repaint();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
