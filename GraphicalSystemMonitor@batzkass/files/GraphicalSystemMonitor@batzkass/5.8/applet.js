/*
Copyright 2026 François Kneib

This file is part of GraphicalSystemMonitor

GraphicalSystemMonitor is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

GraphicalSystemMonitor is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along
with Sysmonitor. If not, see http://www.gnu.org/licenses/.
*/

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Util = imports.misc.util;

const Graph = require('./graph').Graph;
const Providers = require('./providers');
const init = require('./init');
const _ = init._;
const GTop = init.GTop;

class TheApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id){
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.panel_height = panel_height;

        if (!GTop) {
            var icon = new St.Icon();
            icon.set_icon_size(panel_height);
            icon.set_icon_name("face-sad");
            var label = new St.Label();
            label.set_text("Error initializing applet");
            this.actor.add(icon);
            this.actor.add(label);
            this.set_applet_tooltip("glibtop not found, please install glibtop with GObject introspection and reload the applet.\n\nLinux Mint, Ubuntu: sudo apt-get install gir1.2-gtop-2.0\nFedora: sudo dnf install libgtop2");
            return;
        }
        this.orientation = orientation
        this.vertical = orientation == St.Side.LEFT || orientation == St.Side.RIGHT;
        this.horizontal = !this.vertical;

        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            var binds = [
                ["onclick_program"],
                ["refresh_rate", this.on_cfg_changed_refresh_rate],
                ["draw_border", this.on_cfg_changed_draw_border],
                ["use_padding", this.on_cfg_changed_padding],
                ["padding_lr", this.on_cfg_changed_padding],
                ["padding_tb", this.on_cfg_changed_padding],
                ["show_values", this.on_cfg_changed_show_values],
                ["values_fontsize", this.on_cfg_changed_show_values],
                ["values_color", this.on_cfg_changed_show_values],
                ["bg_color", this.on_cfg_changed_bg_border_color],
                ["border_color", this.on_cfg_changed_bg_border_color],
                ["graph_width", this.on_cfg_changed_graph_width, null],
                ["graph_spacing", this.on_cfg_changed_graph_spacing],
                ["cpu_enabled", this.on_cfg_changed_graph_enabled, 'cpu'],
                ["cpu_override_graph_width", this.on_cfg_changed_graph_width, 'cpu'],
                ["cpu_graph_width", this.on_cfg_changed_graph_width, 'cpu'],
                ["cpu_color_0", this.on_cfg_changed_color, 'cpu'],
                ["cpu_color_1", this.on_cfg_changed_color, 'cpu'],
                ["cpu_color_2", this.on_cfg_changed_color, 'cpu'],
                ["cpu_color_3", this.on_cfg_changed_color, 'cpu'],
                ["mem_enabled", this.on_cfg_changed_graph_enabled, 'mem'],
                ["mem_override_graph_width", this.on_cfg_changed_graph_width, 'mem'],
                ["mem_graph_width", this.on_cfg_changed_graph_width, 'mem'],
                ["mem_color_0", this.on_cfg_changed_color, 'mem'],
                ["mem_color_1", this.on_cfg_changed_color, 'mem'],
                ["swap_enabled", this.on_cfg_changed_graph_enabled, 'swap'],
                ["swap_override_graph_width", this.on_cfg_changed_graph_width, 'swap'],
                ["swap_graph_width", this.on_cfg_changed_graph_width, 'swap'],
                ["swap_color_0", this.on_cfg_changed_color, 'swap'],
                ["net_enabled", this.on_cfg_changed_graph_enabled, 'net'],
                ["net_override_graph_width", this.on_cfg_changed_graph_width, 'net'],
                ["net_graph_width", this.on_cfg_changed_graph_width, 'net'],
                ["net_minimum_graph_scale", this.on_cfg_changed_net_graph_scale],
                ["net_color_0", this.on_cfg_changed_color, 'net'],
                ["net_color_1", this.on_cfg_changed_color, 'net'],
                ["load_enabled", this.on_cfg_changed_graph_enabled, 'load'],
                ["load_override_graph_width", this.on_cfg_changed_graph_width, 'load'],
                ["load_graph_width", this.on_cfg_changed_graph_width, 'load'],
                ["load_color_0", this.on_cfg_changed_color, 'load'],
                ["tooltip_background_color", this.on_cfg_tooltip_style],
                ["tooltip_tick_labels_border_color"],
                ["tooltip_grid_color"],
                ["tooltip_label_color", this.on_cfg_tooltip_style],
                ["tooltip_history_seconds"],
            ];
            for (var [prop, callback, arg] of binds) {
                this.settings.bind(prop, "cfg_" + prop, callback, arg);
            }
        } catch (e) {
            global.logError(e); // write to ~/.xsession-errors
        }

        this.graphs = [
            {type:"cpu", provider_cls:Providers.CpuData, obj:null, actor:new St.Widget({reactive: true})},
            {type:"mem", provider_cls:Providers.MemData, obj:null, actor:new St.Widget({reactive: true})},
            {type:"swap", provider_cls:Providers.SwapData, obj:null, actor:new St.Widget({reactive: true})},
            {type:"net", provider_cls:Providers.NetData, obj:null, actor:new St.Widget({reactive: true})},
            {type:"load", provider_cls:Providers.LoadAvgData, obj:null, actor:new St.Widget({reactive: true})},
        ]
        this.graphs.forEach(g=>this.actor.add_child(g.actor)) // add one empty Box per potential graph
        this.actor.set_vertical(this.vertical);
        this.style = `
            spacing: 0px;
        `;
        this.on_cfg_changed_padding(); // update this.actor styles
        this.on_cfg_changed_graph_enabled(); // add each graph and trigger callbacks
        this.update();
    }

    /*******************
    HELPERS
    ********************/
    _graphs_prop_set(prop, value, callback = true) {
        this.graphs.forEach(g=>{
            if(g.obj) {
                g.obj._set_prop(prop, value, callback)
            }
        })
    }

    _providers_prop_set(prop,value, callback = true) {
        this.graphs.forEach(g=>{
            if(g.obj) {
                g.obj.provider._set_prop(prop, value, callback)
            }
        })
    }

    _get_graph_from_type(type) {
        return this.graphs.find(g=>g.type==type)
    }

    _get_widget_size() {
        // height in the case of horizontal, width if vertical
        if(this.horizontal) return this.panel_height - (this.cfg_use_padding ? 2*this.cfg_padding_tb : 0) ;
        else return this.panel_height - (this.cfg_use_padding ? 2*this.cfg_padding_lr : 0) ;
    }

    _set_graph_size(g, callback = true) {
        if(g.obj){
            var width, height
            if(this.horizontal) {
                width = this[`cfg_${g.type}_override_graph_width`] ? this[`cfg_${g.type}_graph_width`] : this[`cfg_graph_width`];
                height = this._get_widget_size()
            }
            else {
                width = this._get_widget_size()
                height = this[`cfg_${g.type}_override_graph_width`] ? this[`cfg_${g.type}_graph_width`] : this[`cfg_graph_width`];
            }
            g.obj._set_prop('width', width, callback)
            g.obj._set_prop('height', height, callback)
        }
    }

    _get_graph_colors(g) {
        var c = [];
        for (var j = 0; j < g.obj.dim; j++) {
            var prop = `cfg_${g.type}_color_${j}`;
            if (this.hasOwnProperty(prop))
                c.push(this[prop]);
            else
                break;
        }
        return c;
    }

    _get_net_graph_min_scale() {
        if (!this.cfg_net_minimum_graph_scale)
            return 1024;
        return this.cfg_net_minimum_graph_scale * 1024 * 1024;
    }

    _set_graphs_locations() {
        const enabled_graphs = this.graphs.filter(g=>g.obj!=null)
        enabled_graphs.forEach(g=>g.obj.location="plain")
        if(this.graphs.length) {
            enabled_graphs.at(-1).obj.location="last"
            enabled_graphs.at(0).obj.location="first"
        }
        enabled_graphs.forEach(g=>g.obj.refresh_actor_styles())
    }
    
    /*******************
    MAIN FUNCTIONS
    ********************/
    create_graph(g) {        
        g.obj = new Graph(g.actor, g.provider_cls, this);

        if (g.type == 'net') {
            g.obj.set_auto_scale(this._get_net_graph_min_scale());
        } else if (g.type == 'load') {
            var ncpu = GTop.glibtop_get_sysinfo().ncpu;
            g.obj.set_auto_scale(2 * ncpu);
        }
        g.obj.colors = this._get_graph_colors(g);

        this._set_graph_size(g);
        g.obj.refresh_all();
    }

    enable_disable_graph(g) {
        const enabled = g.obj != null
        const enable = this[`cfg_${g.type}_enabled`]
        if (enable == enabled) return
        if (!enable && enabled) {
            g.obj.delete()
            g.obj = null
            return
        }
        if (enable && !enabled) {
            this.create_graph(g)
        }
    }

    update() {
        // MAIN LOOP CALLBACK
        this.graphs.forEach(g=>{
            if(g.obj) {
                g.obj.update();
            }
        })
        this.update_timeout_id = Mainloop.timeout_add(Math.max(100, this.cfg_refresh_rate), ()=>this.update());
    }
    
    /*******************
    CINNAMON EVENTS
    ********************/
    on_applet_clicked() {
        if (this.cfg_onclick_program)
            Util.spawn_async([this.cfg_onclick_program]);
    }

    on_applet_removed_from_panel() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        if (this.settings)
            this.settings.finalize();
    }

    on_panel_height_changed() {
        this.panel_height = this._panelHeight;
        this.graphs.forEach(g=>this._set_graph_size(g))
    }

    on_orientation_changed(orientation) {
        this.vertical = orientation == St.Side.LEFT || orientation == St.Side.RIGHT;
        this.horizontal = !this.vertical;
        this.actor.set_vertical(this.vertical);
        this.on_cfg_changed_graph_width();
    }

    /*******************
    CONFIGURATION CHANGES
    ********************/

    on_cfg_changed_refresh_rate() {
        if (this.update_timeout_id > 0) {
            Mainloop.source_remove(this.update_timeout_id);
            this.update_timeout_id = 0;
        }
        this._providers_prop_set('refresh_rate', this.cfg_refresh_rate)
        this.update();
    }

    on_cfg_changed_draw_border() {
        this._graphs_prop_set('draw_border', this.cfg_draw_border)
    }

    on_cfg_changed_padding() {
        if (this.cfg_use_padding) {
            this.actor.set_style(
                this.style+
                `padding:${this.cfg_padding_tb}px ${this.cfg_padding_lr}px;`
            )
        }
        else
            this.actor.set_style(this.style);
        this.graphs.forEach(g=>this._set_graph_size(g))
    }

    on_cfg_changed_show_values() {
        this._graphs_prop_set("values_color", this.cfg_values_color, false);
        this._graphs_prop_set("values_fontsize", this.cfg_values_fontsize, false);
        this._graphs_prop_set("show_values", this.cfg_show_values, true); //trigger the callback once.
    }

    on_cfg_changed_bg_border_color() {
        this._graphs_prop_set("bg_color", this.cfg_bg_color, false)
        this._graphs_prop_set("border_color", this.cfg_border_color, true) //trigger the callback once.
    }

    on_cfg_changed_graph_width(value, graph_type) {
        if (graph_type==null) {
            this.graphs.forEach(g=>this._set_graph_size(g))
        } else {
            this._set_graph_size(this._get_graph_from_type(graph_type))
        }
    }

    on_cfg_changed_graph_spacing() {
        this._graphs_prop_set('spacing', this.cfg_graph_spacing)
    }

    on_cfg_changed_graph_enabled(enabled, graph_type) {
        if (graph_type != undefined) { // toggle a specific graph
            this.enable_disable_graph(this._get_graph_from_type(graph_type))
        } else { // initial call to loop on all graphs
            this.graphs.forEach(g=>{
                this.enable_disable_graph(g)
            })
        }
        this._set_graphs_locations()
    }

    on_cfg_changed_net_graph_scale() {
        this._get_graph_from_type('net').obj.set_auto_scale(this._get_net_graph_min_scale());
    }

    on_cfg_changed_color(color, graph_type){
        const g=this._get_graph_from_type(graph_type)
        if (g.obj) {
            g.obj._set_prop('colors', this._get_graph_colors(g));
        }
    }

    on_cfg_tooltip_style() {
        this.graphs.forEach(g=>{
            if(g.obj) {
                g.obj._tooltip.set_boxlayout_styles();
                g.obj._tooltip.set_label_styles();
            }
        })
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new TheApplet(metadata, orientation, panel_height, instance_id);
}
