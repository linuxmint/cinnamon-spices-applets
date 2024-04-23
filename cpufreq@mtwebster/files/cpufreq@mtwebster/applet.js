/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// cpufreq-applet: Gnome shell extension displaying icons in overview mode
// Copyright (C) 2011 Yichao Yu

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Author: Yichao Yu
// Email: yyc1992@gmail.com

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const UUID = "cpufreq@mtwebster";
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Util = imports.misc.util;
const FileUtils = imports.misc.fileUtils;
const Gettext = imports.gettext;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
let PanelMenu;
if (typeof require !== 'undefined') {
    PanelMenu = require('./panelMenu');
} else {
    const AppletDir = imports.ui.appletManager.applets['cpufreq@mtwebster'];
    PanelMenu = AppletDir.panelMenu;
}

const DEFAULT_STYLE = "2";
const DEFAULT_DIGIT_TYPE = "0";
const DEFAULT_CPUS = "0";
// global settings variables;

let refresh_time = 2000;
let background = '#FFFFFF80';
let style = DEFAULT_STYLE;
let graph_width = '6';
let lower_border = 20;
let upper_border = 80;
let digit_type = DEFAULT_DIGIT_TYPE;
let cpus_to_monitor = DEFAULT_CPUS;
let text_color = '#FFFF80';
let low_color = '#00FF00'; // green
let mid_color = '#FFFF00'; // yellow
let hi_color = '#FF0000'; //

const cpu_path = '/sys/devices/system/cpu/';
const cpu_dir = Gio.file_new_for_path(cpu_path);
let height = 22;
const DEC_WHITE = 16777215;

// Translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

//basic functions

function d2h(d) {return '#' + d.toString(16);}
function h2d(h) {return parseInt(h.replace('#',''),16);}

function parseInts(strs) {
    let rec = [];
    for (let i in strs)
        rec.push(parseInt(strs[i]));
    return rec;
}
function rd_frm_file(file) {
    return Cinnamon.get_file_contents_utf8_sync(file).replace(/\n/g, '').replace(/ +/g, ' ').replace(/ +$/g, '').split(' ');
}
function rd_nums_frm_file(file) {
    return parseInts(rd_frm_file(file));
}
function num_to_freq_panel(num) {
    num = Math.round(num);
    if (num < 1000)
        return num + ' kHz';
    if (num < 1000000)
        return Math.round(num / 10) / 100 + ' MHz';
    if (num < 1000000000)
        return Math.round(num / 10000) / 100 + ' GHz';
    return Math.round(num / 10000000) / 100 + ' THz';
}
function num_to_freq(num) {
    num = Math.round(num);
    if (num < 1000)
        return num + ' kHz';
    if (num < 1000000)
        return Math.round(num) / 1000 + ' MHz';
    if (num < 1000000000)
        return Math.round(num / 1000) / 1000 + ' GHz';
    return Math.round(num / 1000000) / 1000 + ' THz';
}
function percent_to_hex(str, num) {
    return str.format(Math.min(Math.floor(num * 256), 255)).replace(' ', '0');
}
function num_to_color(num, lower, upper) {
    if (num > upper )
        return hi_color;
    if (num < lower)
        return low_color;
    return mid_color;
}

function Panel_Indicator() {
    this._init.apply(this, arguments);
}
Panel_Indicator.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function(name, parent, orientation) {
        PanelMenu.Button.prototype._init.call(this);
        if(orientation)
            this.menu._orientation = orientation;
        this.name = name
        this._parent = parent;
        this.buildit();
    },

    buildit: function() {
        this.actor.has_tooltip = true;
        this.actor.tooltip_text = this.name;
        this.actor.remove_style_class_name('panel-button');
        this.actor.add_style_class_name('cfs-panel-button');
        this.label = new St.Label({ text: this.name, style_class: 'cfs-label' });

        this.digit = new St.Label({ style_class: 'cfs-panel-value' });
        this.digit.style = "font-size: 12px; padding: 0 2px 0 2px; color:" + text_color + ";";
        this.graph = new St.DrawingArea({reactive: false});
        this.graph.height = height;
        this.box = new St.BoxLayout();
        this.repaint_id = this.graph.connect('repaint', Lang.bind(this, this._draw));
        this.box.connect('show', Lang.bind(this.graph, function() {
            this.queue_repaint();
        }));

        this.label.visible = false; // override for now - show-text

        this.graph.visible = style == 0 || style == 2;
        this.digit.visible = style == 1 || style == 2;
        this.graph.width = graph_width;

        this.box.add_actor(this.label);
        this.box.add_actor(this.graph);
        this.box.add_actor(this.digit);
        this.actor.add_actor(this.box);
        this.add_menu_items();

        this.set_digit = digit_type == 0 ? function () {
            this.digit.text = ' ' + num_to_freq_panel(this._parent.avg_freq);
        } : function () {
            this.digit.text = ' ' + Math.round(this._parent.avg_freq / this._parent.max * 100) + '%';
        };

        this._onChange();
        this.cur_changed_id = this._parent.connect('cur-changed', Lang.bind(this, this._onChange));
    },

    _draw: function() {
        if ((this.graph.visible || this.box.visible) == false) {
            return;
         }
        let [width, heigth] = this.graph.get_surface_size();
        let cr = this.graph.get_context();
        let value = this._parent.avg_freq / this._parent.max;
        let [res, color] = Clutter.Color.from_string(background);
        Clutter.cairo_set_source_color(cr, color);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        [res, color] = Clutter.Color.from_string(num_to_color(this._parent.avg_freq, this._parent.lower, this._parent.upper));
        Clutter.cairo_set_source_color(cr, color);
        cr.rectangle(0, height * (1 - value), width, height);
        cr.fill();
    },

    _onChange: function() {
        for (let i in this.menu_items) {
            let type = this.menu_items[i].type;
            let id = this.menu_items[i].id;
            this.menu_items[i].setShowDot(this._parent['cur_' + type].indexOf(this._parent['avail_' + type + 's'][id]) >= 0);
        }
        this.set_digit();
        this.graph.queue_repaint();
    },

    add_menu_items: function() {
        this.menu_items = [];
        for (let i in this._parent.avail_freqs) {
            let menu_item = new PopupMenu.PopupBaseMenuItem(null, {reactive: true});
            let val_label = new St.Label({ text: num_to_freq(this._parent.avail_freqs[i]) });
            menu_item.id = i;
            menu_item.type = 'freq';
            menu_item.addActor(val_label);
            this.menu.addMenuItem(menu_item);
            this.menu_items.push(menu_item);
        }
        this._parent.avail_freqs.length && this._parent.avail_governors.length &&
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (let i in this._parent.avail_governors) {
            let menu_item = new PopupMenu.PopupBaseMenuItem(null, {reactive: true});
            let val_label = new St.Label({ text: this._parent.avail_governors[i] });
            menu_item.id = i;
            menu_item.type = 'governor'
            menu_item.addActor(val_label);
            this.menu.addMenuItem(menu_item);
            this.menu_items.push(menu_item);
        }
        for (let i in this.menu_items) {
            this.menu_items[i].connect('activate', Lang.bind(this, function(item) {
                this._parent.set(item.type ,item.id);
            }));
        }
    },
    _onButtonPress: function(actor, event) {
        if ((this.menu._orientation == 0))
            this.menu.setOrientation(St.Side.BOTTOM);
        else if ((this.menu._orientation == 2))
            this.menu.setOrientation(St.Side.TOP);
        if (global.settings.get_boolean("panel-edit-mode"))
            return false;
        if (event.get_button()==3){
            return false;
        }
        if (!this.menu.isOpen) {
            // Setting the max-height won't do any good if the minimum height of the
            // menu is higher then the screen; it's useful if part of the menu is
            // scrollable so the minimum height is smaller than the natural height
            let monitor = Main.layoutManager.primaryMonitor;
            this.menu.actor.style = ('max-height: ' +
                                     Math.round(monitor.height - Main.panel.actor.height) +
                                     'px;');
        }
        this.menu.toggle();
        return true;
    },

    _destroy: function() {
        if (this.repaint_id > 0) {
            this.graph.disconnect(this.repaint_id);
            this.repaint_id = 0;
        }
        if (this.cur_changed_id > 0) {
            this._parent.disconnect(this.cur_changed_id);
            this.cur_changed_id = 0;
        }
    }
};

function CpufreqSelectorBase() {
    this._init.apply(this, arguments);
}
CpufreqSelectorBase.prototype = {
    arg: { governor: '-g', freq: '-f'},
    _init: function(cpu, orientation) {
        this.orientation = orientation;
        this.cpunum = cpu.replace(/cpu/, '');
        this.cpufreq_path = cpu_path + '/' + cpu + '/cpufreq/';
        this.get_avail();
        this.get_cur();
        this.indicator = new Panel_Indicator(cpu, this, orientation);
        // if ('timeout' in this)
            // Mainloop.source_remove(this.timeout);
        this.timeout = Mainloop.timeout_add(refresh_time, Lang.bind(this, this.update));
    },

    get_avail: function() {
        try {
            this.max = rd_nums_frm_file(this.cpufreq_path + '/scaling_max_freq')[0];
            this.min = rd_nums_frm_file(this.cpufreq_path + '/scaling_min_freq')[0];
            this.range = this.max - this.min;
            this.upper = this.min + this.range * upper_border / 100;
            this.lower = this.min + this.range * lower_border / 100;
            this.avail_governors = rd_frm_file(this.cpufreq_path + '/scaling_available_governors');
            try {
                this.avail_freqs = rd_nums_frm_file(this.cpufreq_path + '/scaling_available_frequencies');
            } catch (e) {
                 this.avail_freqs = [];
            }
        } catch (e) {
            let icon = new St.Icon({ icon_name: 'error',
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: 36 });
            Main.criticalNotify(_("CPU frequency scaling unavailable"),
                                _("Your system does not appear to support CPU frequency scaling.  Unfortunately this applet is of no use to you."),
                                icon);
        }
    },

    get_cur: function() {
        this.cur_freq = rd_nums_frm_file(this.cpufreq_path + '/scaling_cur_freq');
        this.avg_freq = this.cur_freq[0];
        this.cur_governor = rd_frm_file(this.cpufreq_path + '/scaling_governor');
    },

    set: function(type, index) {
        Util.spawn(['cpufreq-selector', '-c', this.cpunum.toString(), this.arg[type], this['avail_' + type + 's'][index].toString()]);
    },

    update: function() {
        let old_freq = this.cur_freq;
        let old_governor = this.cur_governor;
        this.get_cur();
        if (old_freq != this.cur_freq || old_governor != this.cur_governor)
            this.emit('cur-changed');
        return true;
    },

    _destroy: function() {
        if (this.indicator) {
            this.indicator._destroy();
            this.indicator = null;
        }

        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = 0;
        }
    }
};
Signals.addSignalMethods(CpufreqSelectorBase.prototype);

function CpufreqSelector() {
    this._init.apply(this, arguments);
}
CpufreqSelector.prototype = {
    __proto__: CpufreqSelectorBase.prototype,

    _init: function(cpu, orientation, selectors) {
        this.orientation = orientation;
        this.selectors = selectors
        this.cpunum = cpu.replace(/cpu/, '');
        this.cpufreq_path = cpu_path + '/' + cpu + '/cpufreq/';
        this.get_avail();
        this.get_cur();
        this.indicator = new Panel_Indicator(cpu, this, orientation);
        // if ('timeout' in this)
            // Mainloop.source_remove(this.timeout);
        this.timeout = Mainloop.timeout_add(refresh_time, Lang.bind(this, this.update));
    },

    get_avail: function() {
        this.max = 0;
        this.min = 0;
        let freqs = {};
        let governors = {};
        for (let i in this.selectors) {
            let selector = this.selectors[i];
            this.max += selector.max;
            this.min += selector.min;
            for (let j in selector.avail_freqs)
                freqs[selector.avail_freqs[j]] = 1;
            for (let j in selector.avail_governors)
                governors[selector.avail_governors[j]] = 1;
        }
        this.max /= this.selectors.length;
        this.min /= this.selectors.length;
        this.avail_freqs = [];
        this.avail_governors = [];
        for (let freq in freqs)
            this.avail_freqs.push(freq);
        for (let governor in governors)
            this.avail_governors.push(governor);
    },

    get_cur: function() {
        this.avg_freq = 0;
        this.cur_freq = [];
        this.cur_governor = [];
        let freqs = {};
        let governors = {};
        for (let i in this.selectors) {
            let selector = this.selectors[i];
            this.avg_freq += selector.avg_freq;
            freqs[selector.avg_freq] = 1;
            for (let j in selector.cur_governor)
                governors[selector.cur_governor[j]] = 1;
        }
        this.avg_freq /= this.selectors.length;
        for (let freq in freqs)
            this.cur_freq.push(freq);
        for (let governor in governors)
            this.cur_governor.push(governor);
    },

    set: function(type, index) {
        for (let i in this.selectors)
            this.selectors[i].set(type, index);
    },
};



function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
        __proto__: Applet.Applet.prototype,

        _init: function(metadata, orientation, panel_height, instance_id) {
            Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
            try {
                    this.uuid = metadata['uuid'];
                    this.orientation = orientation;
                    this.instance_id = instance_id;

                    this.cpu_ids = [];
                    this.selectors = [];
                    this.atomic = false;

                    this.summary = null;
                    this.main_box = null;

                    this._initialize_settings();
                    this.rebuild();
                    Main.themeManager.connect('theme-set', Lang.bind(this, function() {
                        Mainloop.timeout_add(500, Lang.bind(this, this.rebuild));
                    }));

                    if (!GLib.find_program_in_path("cpufreq-selector")) {
                        let icon = new St.Icon({ icon_name: 'error',
                                                 icon_type: St.IconType.FULLCOLOR,
                                                 icon_size: 36 });
                        Main.criticalNotify(_("CPU frequency switcher program not installed"),
                                _("You appear to be missing the required program, 'cpufreq-selector.'  This program is needed to perform scaling or governor switching.\n\n") +
                                _("This program is ordinarily provided by the package: gnome-applets\n\n") +
                                _("If you're on Linux Mint or Ubuntu, you can install this using the following command:\n\n") +
                                _("apt install --no-install-recommends gnome-applets"),
                                icon);
                    }
            } catch (e) {
                global.logError(e);
            }
        },

        _initialize_settings: function() {
            this.settings = new Settings.AppletSettings(this, this.uuid, this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "display-style",
                                       "style",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "digit-type",
                                       "digit_type",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "cpus-to-monitor",
                                       "cpus",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "refresh-rate",
                                       "refresh_rate",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "graph-width",
                                       "graph_width",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "lower-border",
                                       "lower_border",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "upper-border",
                                       "upper_border",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "background",
                                       "background",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "low-color",
                                       "low_color",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "med-color",
                                       "med_color",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "high-color",
                                       "high_color",
                                       this.rebuild,
                                       null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "text-color",
                                       "text_color",
                                       this.rebuild,
                                       null);
        },

        rebuild: function() {
            background = this.background;
            cpus_to_monitor = this.cpus;
            refresh_time = this.refresh_rate;
            style = this.style;
            graph_width = this.graph_width
            lower_border = this.lower_border;
            upper_border = this.upper_border;
            digit_type = this.digit_type;
            text_color = this.text_color;
            low_color = this.low_color;
            mid_color = this.med_color;
            hi_color = this.high_color;

            if (this.atomic)
                return;

            this.atomic = true; // hackity hack - make sure only one rebuild is happening at a time,
            if (this.main_box) {
                this.actor.remove_actor(this.main_box);
            }

            for (let i in this.selectors) {
                this.selectors[i]._destroy();
            }

            if (this.summary) {
                this.summary._destroy()
            }

            this.cpu_ids = [];
            this.selectors = [];

            try {
                if (this._panelHeight)
                    height = Math.floor(this._panelHeight - (this._panelHeight * .05));

                this.main_box = new St.BoxLayout({ pack_start: true });
                this.actor.add(this.main_box);
                FileUtils.listDirAsync(cpu_dir, Lang.bind(this, this.add_cpus_frm_files));
            } catch (e) {
                global.logError(e);
            }
        },

        add_cpus_frm_files(cpu_child) {
            try {
                let pattern = /^cpu[0-9]+/
                for (let i in cpu_child)
                    if (pattern.test(cpu_child[i].get_name()))
                        this.cpu_ids.push(cpu_child[i].get_name());
                for (let i in this.cpu_ids) {
                    this.selectors[i] = new CpufreqSelectorBase(this.cpu_ids[i],this.orientation);
                    this.main_box.add_actor(this.selectors[i].indicator.actor);
                    Main.panel._menus.addMenu(this.selectors[i].indicator.menu);
                }
                this.summary = new CpufreqSelector('cpu', this.orientation, this.selectors);
                this.main_box.add_actor(this.summary.indicator.actor);
                Main.panel._menus.addMenu(this.summary.indicator.menu);
                let visible = [];
                for (let i in this.selectors)
                    visible[i] = true;
                visible[-1] = true;
                switch (cpus_to_monitor) {
                    case 0:
                        break;
                    case 2:
                        for (let i = 0; i < visible.length; i++) {
                            visible[i] = false;
                        }
                        break;
                    case 1:
                        visible[-1] = false;
                        break;
                }
                for (let i in this.selectors)
                    this.selectors[i].indicator.actor.visible = visible[i];
                this.summary.indicator.actor.visible = visible[-1];
            } catch (e) {
                global.logError(e);
            }
            this.atomic = false;
        },

        on_panel_height_changed: function() {
            this.rebuild();
        },

        on_applet_removed_from_panel: function() {
            if (this.main_box) {
                this.actor.remove_actor(this.main_box);
            }

            for (let i in this.selectors) {
                this.selectors[i]._destroy();
            }

            if (this.summary) {
                this.summary._destroy()
            }
        }
};
