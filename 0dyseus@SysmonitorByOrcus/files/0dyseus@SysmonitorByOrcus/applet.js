/**
 * This applet is a fork of Sysmonitor applet by Josef Michálek (Aka Orcus).
 *
 * [Differences with the original applet]
 * - I enabled the use of alpha to all the color pickers in the settings window.
 * - I added a notification in case the User doesn't have installed the gjs package to make this
 *   applet settings window to work.
 */

/**
 * Copyright 2012 Josef Michálek (Aka Orcus) <0rcus.cz@gmail.com>
 *
 * This file is part of Sysmonitor
 *
 * Sysmonitor is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * Sysmonitor is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along
 * with Sysmonitor. If not, see http://www.gnu.org/licenses/.
 */
const $ = imports.applet.__init__;
const _ = $._;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;


function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.IconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);

        this.update_id = 0;
        this.metadata = aMetadata;
        this.applet_dir = aMetadata.path;

        try {
            this._bindSettings();

            this._expand_applet_context_menu();

            this.areas = [];
            this.graphs = [];

            try {
                this.tooltip = new Tooltips.PanelItemTooltip(this, "", aOrientation);

                this.tooltip._tooltip.get_clutter_text().set_line_alignment(0);
                this.tooltip._tooltip.get_clutter_text().set_line_wrap(true);

                if (this.pref_align_tooltip_text_to_the_left)
                    this.tooltip._tooltip.set_style("text-align:left;");
            } catch (aErr) {
                this.tooltip = false;
            }

            if (!$.GTop) {
                this._informDependency();
                this._applet_icon_box.show();
                return;
            }

            this._applet_icon_box.hide();

            let ncpu = $.GTop.glibtop_get_sysinfo().ncpu;
            let provider = null;

            if (this.pref_show_cpu_graph) {
                try {
                    provider = new $.CpuDataProvider();

                    if (provider && !provider.hasError) {
                        let color_user = this._parseColor(this.pref_cpu_graph_color_user);
                        let color_nice = this._parseColor(this.pref_cpu_graph_color_nice);
                        let color_kernel = this._parseColor(this.pref_cpu_graph_color_kernel);
                        let color_iowait = this._parseColor(this.pref_cpu_graph_color_iowait);
                        this.addGraph(provider, [
                            color_user,
                            color_nice,
                            color_kernel,
                            color_iowait
                        ], this.pref_cpu_graph_width);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            if (this.pref_show_memmory_graph) {
                try {
                    provider = new $.MemDataProvider();

                    if (provider && !provider.hasError) {
                        let color_used = this._parseColor(this.pref_memory_graph_color_used);
                        let color_cached = this._parseColor(this.pref_memory_graph_color_cached);
                        this.addGraph(provider, [
                            color_used,
                            color_cached
                        ], this.pref_memory_graph_width);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            if (this.pref_show_swap_graph) {
                try {
                    provider = new $.SwapDataProvider();

                    if (provider && !provider.hasError) {
                        let color_used = this._parseColor(this.pref_swap_graph_color_used);
                        this.addGraph(provider, [color_used],
                            this.pref_swap_graph_width);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            if (this.pref_show_network_graph) {
                try {
                    provider = new $.NetDataProvider();

                    if (provider && !provider.hasError) {
                        let color_download = this._parseColor(this.pref_network_graph_color_download);
                        let color_upload = this._parseColor(this.pref_network_graph_color_upload);
                        this.addGraph(provider, [
                            color_download,
                            color_upload
                        ], this.pref_network_graph_width).setAutoScale(1024);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            if (this.pref_show_load_graph) {
                try {
                    provider = new $.LoadAvgDataProvider();

                    if (provider && !provider.hasError) {
                        let color_load = this._parseColor(this.pref_load_graph_color_load);
                        this.addGraph(provider, [color_load],
                            this.pref_load_graph_width).setAutoScale(2 * ncpu);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            this.update();
        } catch (e) {
            global.logError(e);
        }
    },

    _informDependency: function() {
        this.set_applet_icon_symbolic_name("dialog-error");
        let msg = [_("Missing dependency!!!"),
            _("This applet needs the GTop library installed on your system for it  to work."),
            _("Read this applet help for more details (Applet context menu > Help item).")
        ];

        let tt = _(this.metadata.name) + "\n\n" + msg.join("\n");

        if (this.tooltip) {
            try {
                this.tooltip._tooltip.get_clutter_text().set_markup(
                    "<span color=\"red\"><b>" + tt + "</b></span>");
            } catch (aErr) {
                global.logError(_(this.metadata.name) + ": " + aErr.message);
            }
        } else {
            this.set_applet_tooltip(tt);
        }

        let icon = new St.Icon({
            icon_name: "dialog-error",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 24
        });

        Main.criticalNotify(_(this.metadata.name), msg.join("\n"), icon);
    },

    _restart_cinnamon: function() {
        global.reexec_self();
    },

    _bindSettings: function() {
        // Needed for retro-compatibility.
        // Mark for deletion on EOL.
        let bD = {
            IN: 1,
            OUT: 2,
            BIDIRECTIONAL: 3
        };
        let settingsArray = [
            [bD.IN, "pref_align_tooltip_text_to_the_left", null],
            [bD.IN, "pref_custom_command", null],
            [bD.IN, "pref_use_smooth_graphs", null],
            [bD.IN, "pref_refresh_rate", null],
            [bD.IN, "pref_background_color", null],
            [bD.IN, "pref_draw_background", null],
            [bD.IN, "pref_draw_border", null],
            [bD.IN, "pref_border_color", null],
            [bD.IN, "pref_show_cpu_graph", null],
            [bD.IN, "pref_cpu_graph_width", null],
            [bD.IN, "pref_cpu_graph_color_user", null],
            [bD.IN, "pref_cpu_graph_color_nice", null],
            [bD.IN, "pref_cpu_graph_color_kernel", null],
            [bD.IN, "pref_cpu_graph_color_iowait", null],
            [bD.IN, "pref_show_memmory_graph", null],
            [bD.IN, "pref_memory_graph_width", null],
            [bD.IN, "pref_memory_graph_color_used", null],
            [bD.IN, "pref_memory_graph_color_cached", null],
            [bD.IN, "pref_show_swap_graph", null],
            [bD.IN, "pref_swap_graph_width", null],
            [bD.IN, "pref_swap_graph_color_used", null],
            [bD.IN, "pref_show_network_graph", null],
            [bD.IN, "pref_network_graph_width", null],
            [bD.IN, "pref_network_graph_color_download", null],
            [bD.IN, "pref_network_graph_color_upload", null],
            [bD.IN, "pref_show_load_graph", null],
            [bD.IN, "pref_load_graph_width", null],
            [bD.IN, "pref_load_graph_color_load", null],
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_applet_clicked: function(aE) { // jshint ignore:line
        GLib.spawn_command_line_async(this.pref_custom_command);
    },

    addGraph: function(aProvider, aColors, aGraphWidth) {
        let index = this.areas.length;
        let area = new St.DrawingArea();
        area.set_width(aGraphWidth);
        area.connect("repaint", Lang.bind(this, function() {
            this.graphs[index].paint();
        }));
        this.actor.add(area, {
            y_fill: true
        });

        let graph = new $.Graph(area, aProvider, aColors,
            this.pref_draw_background ? this._parseColor(this.pref_background_color) : null,
            this.pref_draw_border ? this._parseColor(this.pref_border_color) : null);
        aProvider.refreshRate = this.pref_refresh_rate;
        graph.smooth = this.pref_use_smooth_graphs;

        this.areas.push(area);
        this.graphs.push(graph);

        return graph;
    },

    update: function() {
        if (this.update_id > 0) {
            Mainloop.source_remove(this.update_id);
            this.update_id = 0;
        }

        let tt = "";

        let i = 0,
            iLen = this.graphs.length;

        if (iLen > 0) {
            for (; i < iLen; ++i) {
                this.graphs[i].refresh();
                let txt = this.graphs[i].provider.getText(false);
                if (i > 0)
                    tt = tt + "\n";
                if (this.tooltip)
                    tt = tt + "<b>" + txt[0] + "</b>" + txt[1];
                else
                    tt = tt + txt[0] + txt[1];
            }
        }

        if (this.tooltip) {
            try {
                this.tooltip._tooltip.get_clutter_text().set_markup(tt);
            } catch (aErr) {
                global.logError(_(this.metadata.name) + ": " + aErr.message);
            }
        } else {
            this.set_applet_tooltip(tt);
        }

        this.update_id = Mainloop.timeout_add(this.pref_refresh_rate, Lang.bind(this, this.update));
    },

    _parseColor: function(aColor) {
        let rgba;

        try {
            rgba = aColor.match(/rgba?\((.*)\)/)[1].split(",").map(Number);
        } finally {
            if (!rgba)
                return "";

            return [
                rgba[0] / 255,
                rgba[1] / 255,
                rgba[2] / 255,
                "3" in rgba ? rgba[3] : 1
            ];
        }
    },

    _expand_applet_context_menu: function() {
        let menuItem = new PopupMenu.PopupIconMenuItem(
            _("Help"),
            "dialog-information",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawn_async(["xdg-open", this.applet_dir + "/HELP.html"], null);
        }));
        this._applet_context_menu.addMenuItem(menuItem);
    },

    on_applet_removed_from_panel: function() {
        if (this.update_id > 0) {
            Mainloop.source_remove(this.update_id);
            this.update_id = 0;
        }

        this.settings.finalize();
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    let myApplet = new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
    return myApplet;
}
