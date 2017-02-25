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

const Lang = imports.lang;
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const NMClient = imports.gi.NMClient;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

var UUID;

function _(aStr) {
    let customTrans = Gettext.dgettext(UUID, aStr);

    if (customTrans != aStr)
        return customTrans;

    return Gettext.gettext(aStr);
}

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.Applet.prototype._init.call(this, aOrientation);

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);

        this.update_id = 0;
        this.applet_dir = aMetadata.path;
        this.main_applet_dir = this.applet_dir;

        // Prepare translation mechanism.
        UUID = aMetadata.uuid;
        Gettext.bindtextdomain(aMetadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

        try {
            // Use the this.main_applet_dir directory for imports shared by all supported Cinnamon versions.
            // If I use just this.applet_dir, I would be forced to put the files to be imported
            // repeatedly inside each version folder. ¬¬
            let regExp = new RegExp("(" + aMetadata.uuid + ")$", "g");
            if (!regExp.test(this.main_applet_dir)) {
                let tempFile = Gio.file_new_for_path(this.main_applet_dir);
                this.main_applet_dir = tempFile.get_parent().get_path();
            }

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

            let ncpu = GTop.glibtop_get_sysinfo().ncpu;

            if (this.pref_show_cpu_graph) {
                this.addGraph(new CpuDataProvider(), [
                    this._parseColor(this.pref_cpu_graph_color_user),
                    this._parseColor(this.pref_cpu_graph_color_nice),
                    this._parseColor(this.pref_cpu_graph_color_kernel),
                    this._parseColor(this.pref_cpu_graph_color_iowait),
                ], this.pref_cpu_graph_width);
            }

            if (this.pref_show_memmory_graph) {
                this.addGraph(new MemDataProvider(), [
                    this._parseColor(this.pref_memory_graph_color_used),
                    this._parseColor(this.pref_memory_graph_color_cached),
                ], this.pref_memory_graph_width);
            }

            if (this.pref_show_swap_graph) {
                this.addGraph(new SwapDataProvider(),
                    this._parseColor(this.pref_swap_graph_color_used),
                    this.pref_swap_graph_width);
            }

            if (this.pref_show_network_graph) {
                this.addGraph(new NetDataProvider(), [
                    this._parseColor(this.pref_network_graph_color_download),
                    this._parseColor(this.pref_network_graph_color_upload),
                ], this.pref_network_graph_width).setAutoScale(1024);
            }

            if (this.pref_show_load_graph) {
                this.addGraph(new LoadAvgDataProvider(),
                    this._parseColor(this.pref_load_graph_color_load),
                    this.pref_load_graph_width).setAutoScale(2 * ncpu);
            }

            this.update();
        } catch (e) {
            global.logError(e);
        }
    },

    _restart_cinnamon: function() {
        global.reexec_self();
    },

    _bindSettings: function() {
        let bD = Settings.BindingDirection || null;
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

    on_applet_clicked: function(aE) {
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

        let graph = new Graph(area, aProvider, aColors,
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
                global.logError("System Monitor (Fork By Odyseus): " + aErr.message);
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
        } catch (aErr) {}
        return [
            rgba[0] / 255,
            rgba[1] / 255,
            rgba[2] / 255,
            "3" in rgba ? rgba[3] : 1
        ];
    },

    _expand_applet_context_menu: function() {
        let menuItem = new PopupMenu.PopupIconMenuItem(
            _("Help"),
            "dialog-information",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawnCommandLine("xdg-open " + this.main_applet_dir + "/HELP.html");
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

function Graph(aArea, aProvider, aColors, aBackground, aBorder) {
    this._init(aArea, aProvider, aColors, aBackground, aBorder);
}

Graph.prototype = {
    _init: function(aArea, aProvider, aColors, aBackground, aBorder) {
        this.area = aArea;
        this.provider = aProvider;
        this.colors = aColors;
        this.background = aBackground;
        this.border = aBorder;
        this.smooth = false;
        let datasize = this.area.get_width() - 2;
        this.data = new Array(datasize);
        this.dim = this.provider.getDim();
        this.autoScale = false;
        this.scale = 1;

        let i = 0,
            iLen = this.data.length;
        for (; i < iLen; ++i) {
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

        if (this.autoScale) {
            let maxVal = this.minScale;
            let i = 0,
                iLen = this.data.length;
            for (; i < iLen; ++i) {
                let sum = this.dataSum(i, this.dim - 1);
                if (sum > maxVal)
                    maxVal = sum;
            }
            this.scale = 1.0 / maxVal;
        }
    },

    dataSum: function(aIndex, aDepth) {
        let sum = 0;
        for (let j = 0; j <= aDepth; ++j)
            sum += this.data[aIndex][j];
        return sum;
    },

    paint: function() {
        let cr = this.area.get_context();
        let [width, height] = this.area.get_size();
        //background
        if (this.background !== null) {
            cr.setSourceRGBA(this.background[0], this.background[1], this.background[2], this.background[3]);
            cr.setLineWidth(1);
            cr.rectangle(0.5, 0.5, width - 1, height - 1);
            cr.fill();
        }
        //data
        if (this.smooth) {
            for (let j = this.dim - 1; j >= 0; --j) {
                cr.translate(0, 0);
                cr.moveTo(1.5, height);
                this.setColor(cr, j);
                let i = 0,
                    iLen = this.data.length;
                for (; i < iLen; ++i)
                    cr.lineTo(i + 1.5, height - Math.round((height - 1) * this.scale * this.dataSum(i, j)));
                cr.lineTo(width - 1.5, height);
                cr.lineTo(1.5, height);
                cr.fillPreserve();
                cr.stroke();
            }
        } else {
            let i = 0,
                iLen = this.data.length;
            for (; i < iLen; ++i) {
                for (let j = this.dim - 1; j >= 0; --j) {
                    this.setColor(cr, j);
                    cr.moveTo(i + 1.5, height - 1);
                    cr.relLineTo(0, -Math.round((height - 2) * this.scale * this.dataSum(i, j)));
                    cr.stroke();
                }
            }
        }
        //border
        if (this.border !== null) {
            cr.setSourceRGBA(this.border[0], this.border[1], this.border[2], this.border[3]);
            cr.rectangle(0.5, 0.5, width - 1, height - 1);
            cr.stroke();
        }
    },

    setColor: function(aCtx, aIndex) {
        let c = this.colors[aIndex % this.colors.length];
        aCtx.setSourceRGBA(c[0], c[1], c[2], c[3]);
    },

    setAutoScale: function(aMinScale) {
        if (aMinScale > 0) {
            this.autoScale = true;
            this.minScale = aMinScale;
        } else {
            this.autoScale = false;
        }
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
        let used = 1 - idle - nice - sys - iowait;
        this.text = [_("CPU: "), Math.round(100 * used) + " %"];
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
        this.text = [_("Memory: "), Math.round((this.gtop.used - this.gtop.cached - this.gtop.buffer) / (1024 * 1024)) + " / " + Math.round(this.gtop.total / (1024 * 1024)) + _(" MB")];
        return [used - cached, cached];
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
        this.text = [_("Swap: "), Math.round(this.gtop.used / (1024 * 1024)) + " / " + Math.round(this.gtop.total / (1024 * 1024)) + _(" MB")];
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
    _init: function() {
        this.gtop = new GTop.glibtop_netload();

        if (typeof GTop.glibtop.get_netlist === "function") {
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist());
        } else {
            let dev = NMClient.Client.new().get_devices();
            this.devices = [];
            for (let i = 0; i < dev.length; ++i)
                this.devices.push(dev[i].get_iface());
        }

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
        this.text = [_("Network D/U: "), Math.round(down_delta / 1024) + " / " + Math.round(up_delta / 1024) + _(" KB/s")];
        return [down_delta, up_delta];
    },

    getText: function() {
        return this.text;
    },

    getNetLoad: function() {
        let down = 0;
        let up = 0;
        let i = 0,
            iLen = this.devices.length;
        for (; i < iLen; ++i) {
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
        this.text = [_("Load average: "), this.gtop.loadavg[0] + ", " + this.gtop.loadavg[1] + ", " + this.gtop.loadavg[2]];
        return [load];
    },

    getText: function() {
        return this.text;
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    let myApplet = new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
    return myApplet;
}
