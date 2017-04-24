/*
 system-monitor@ebbes applet
 
 Cinnamon applet displaying system informations in gnome shell status bar, such as memory usage, cpu usage, network rates…
 forked from gnome-shell extension (for gnome-shell 3.2) to Cinnamon applet by ebbes.ebbes@gmail.com
 Changes that were done:
    * Removed battery functionality
    * Removed tooltips (as they were crashing Cinnamon)
    * Implemented simpler tooltips
    * Some backports from gnome-shell 3.4 extension
    * Some small changes I liked

 Copyright (C) 2011 Florian Mounier aka paradoxxxzero
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 Original author: Florian Mounier aka paradoxxxzero
*/
let smaDepsGtop = true;
let smaDepsNM = true;

const Applet = imports.ui.applet;

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;

try {
    const NMClient = imports.gi.NMClient;
    const NetworkManager = imports.gi.NetworkManager;
} catch (e) {
    global.logError(e);
    smaDepsNM = false;
}

try {
    const GTop = imports.gi.GTop;
} catch (e) {
    global.logError(e);
    smaDepsGtop = false;
}

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const UUID = "system-monitor@ebbes";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const MESSAGE = _("Dependencies missing. Please install \n\
libgtop, Network Manager and gir bindings \n\
\t    on Ubuntu: gir1.2-gtop-2.0, gir1.2-networkmanager-1.0 \n\
\t    on Fedora: libgtop2-devel, NetworkManager-glib-devel \n\
\t    on Arch: libgtop, networkmanager\n\
and restart Cinnamon.\n");

let ElementBase, Cpu, Mem, Swap, Net, Disk, Thermal, Freq, Graph, Bar, Pie, Chart, Icon;
let Schema, Background, IconSize;
let UsePython2 = false;

function l_limit(t) {
    return (t > 0) ? t : 1000;
}

function change_text() {
    this.label.visible = Schema.get_boolean(this.elt + '-show-text');
}

function change_style() {
    let style = Schema.get_string(this.elt + '-style');
    this.text_box.visible = style == 'digit' || style == 'both';
    this.chart.actor.visible = style == 'graph' || style == 'both';
}

function init(metadata) {
    //Should find schema even if installed in /usr/share/glib-2.0/schemas
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(metadata.path,
	    Gio.SettingsSchemaSource.get_default(), false);
    let schema = schemaSource.lookup('org.cinnamon.applets.system-monitor', true);
    Schema = new Gio.Settings({ settings_schema: schema });
    
    Background = new Clutter.Color();
    Background.from_string(Schema.get_string('background'));
    //IconSize = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);
    //Constant doesn't exist. Took me ages to figure out WHAT caused Net() to break...
    IconSize = 16;
    
    //Determine python binary to use
    [status, stdout, stderr] = GLib.spawn_command_line_sync("python --version");
    
    //Somehow python seems to print version on stderr?
    //Output: e.g. "Python 2.7.3"
    if (stderr && stderr.length > 7)
    {
        UsePython2 = (stderr[7] != 50); //50 == ASCII for '2'
    }
}

ErrorDialog = function() {
    this._init.apply(this, arguments);
};

ErrorDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    
    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);
        let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout', vertical: false });
        this.contentLayout.add(mainContentBox, { x_fill: true, y_fill: true });
        let messageBox = new St.BoxLayout({ style_class: 'polkit-dialog-message-layout', vertical: true });
        mainContentBox.add(messageBox, { y_align: St.Align.START });
        this._subjectLabel = new St.Label({ style_class: 'sma-dialog-headline', text: _("System Monitor Applet: Error") });
        messageBox.add(this._subjectLabel, {y_fill: false, y_align: St.Align.START });
        this._descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description', text: MESSAGE });
        messageBox.add(this._descriptionLabel, { y_fill: true, y_align: St.Align.START });
        this.setButtons([
            {
                label: _("OK"),
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            }
        ]);
    },
};

Chart = function () {
    this._init.apply(this, arguments);
};

Chart.prototype = {
    _init: function(width, height, parent) {
        this.actor = new St.DrawingArea({ style_class: "sma-chart", reactive: false});
        this.parent = parent;
        this.actor.set_width(this.width=width);
        this.actor.set_height(this.height=height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.data = [];
        for (let i = 0;i < this.parent.colors.length;i++)
            this.data[i] = [];
    },
    update: function() {
        let data_a = this.parent.vals;
        if (data_a.length != this.parent.colors.length) return;
        let accdata = [];
        for (let l = 0 ; l < data_a.length ; l++) {
            accdata[l] = (l == 0) ? data_a[0] : accdata[l - 1] + ((data_a[l] > 0) ? data_a[l] : 0);
            this.data[l].push(accdata[l]);
            if (this.data[l].length > this.width)
                this.data[l].shift();
        }
        if (!this.actor.visible) return;
        this.actor.queue_repaint();
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        
        let max;
        if (this.parent.max) {
            max = this.parent.max;
        } else {
            max = Math.max.apply(this, this.data[this.data.length - 1]);
            max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
        }
        Clutter.cairo_set_source_color(cr, Background);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.parent.colors.length - 1;i >= 0;i--) {
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1;j >= 0;j--)
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.parent.colors[i]);
            cr.fill();
        }
    },
    resize: function(schema, key) {
        let old_width = this.width;
        this.width = Schema.get_int(key);
        if (old_width == this.width) return;
        this.actor.set_width(this.width);
        if (this.width < this.data[0].length)
            for (let i = 0;i < this.parent.colors.length;i++)
                this.data[i] = this.data[i].slice(-this.width);
    }
};

ElementBase = function () {
    throw new TypeError('Trying to instantiate abstract class ElementBase');
};

ElementBase.prototype = {
    elt: '',
    color_name: [],
    text_items: [],
    menu_items: [],
    _init: function(orientation) {
        this.actor = new St.BoxLayout({ reactive: true });
        this.actor._delegate = this;

        this.vals = [];
        this.tip_vals = [];
        this.tip_unit_labels = [];

        this.colors = [];
        for(let color in this.color_name) {
            let clutterColor = new Clutter.Color();
            let name = this.elt + '-' + this.color_name[color] + '-color';
            clutterColor.from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(
                clutterColor, function (schema, key) {
                    this.from_string(Schema.get_string(key));
            }));
            Schema.connect('changed::' + name,
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));
            this.colors.push(clutterColor);
        }

        this.chart = new Chart(Schema.get_int(this.elt + '-graph-width'), IconSize, this);
        Schema.connect('changed::background',
                       Lang.bind(this,
                                 function() {
                                     this.chart.actor.queue_repaint();
                                 }));

        this.actor.visible = Schema.get_boolean(this.elt + "-display");
        Schema.connect(
            'changed::' + this.elt + '-display',
            Lang.bind(this,
                      function(schema, key) {
                          this.actor.visible = Schema.get_boolean(key);
                      }));

        this.interval = l_limit(Schema.get_int(this.elt + "-refresh-time"));
        this.timeout = Mainloop.timeout_add(this.interval,
                                            Lang.bind(this, this.update));
        Schema.connect(
            'changed::' + this.elt + '-refresh-time',
            Lang.bind(this,
                      function(schema, key) {
                          Mainloop.source_remove(this.timeout);
                          this.interval = l_limit(Schema.get_int(key));
                          this.timeout = Mainloop.timeout_add(this.interval,
                                                              Lang.bind(this, this.update));
                      }));
        Schema.connect('changed::' + this.elt + '-graph-width',
                       Lang.bind(this.chart, this.chart.resize));

        this.label = new St.Label({ text: this.elt == _("memory") ? _("mem") : _(this.elt),
                                    style_class: "sma-status-label"});
        change_text.call(this);
        Schema.connect('changed::' + this.elt + '-show-text', Lang.bind(this, change_text));

        this.actor.add_actor(this.label);
        this.text_box = new St.BoxLayout();
        
        this.tooltip = new Tooltips.PanelItemTooltip(this, "", orientation);
        
        this.actor.add_actor(this.text_box);
        this.text_items = this.create_text_items();
        for (let item in this.text_items)
            this.text_box.add_actor(this.text_items[item]);
        this.actor.add_actor(this.chart.actor);
        change_style.call(this);
        Schema.connect('changed::' + this.elt + '-style', Lang.bind(this, change_style));
        this.menu_items = this.create_menu_items();
        for (let item in this.menu_items)
            this.menu_item.addActor(this.menu_items[item]);
    },
    tip_format: function(unit) {
        typeof(unit) == 'undefined' && (unit = '%');
        if(typeof(unit) == 'string') {
            let all_unit = unit;
            unit = [];
            for (let i = 0;i < this.tip_names.length;i++) {
                unit.push(all_unit);
            }
        }

        for (let i = 0;i < this.color_name.length;i++) {
            this.tip_unit_labels[i] = unit[i];
        }
    },
    set_tip_unit: function(unit) {
        for (let i = 0;i < this.tip_unit_labels.length;i++) {
            this.tip_unit_labels[i] = unit[i];
        }
    },
    update: function() {
        this.refresh();
        this._apply();
        this.chart.update();
        let text = "";
        for (let i = 0;i < this.tip_vals.length;i++) {
            text += this.tip_names[i] + " " + this.tip_vals[i].toString() + " " + this.tip_unit_labels[i];
            if (i != this.tip_vals.length - 1)
                text += "\n";
        }
        
        this.tooltip._tooltip.set_text(text);
        return true;
    },
    destroy: function() {
        Mainloop.source_remove(this.timeout);
    }
};

Cpu = function () {
    this._init.apply(this, arguments);
};

Cpu.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'cpu',
    color_name: ['user', 'system', 'nice', 'iowait', 'other'],
    tip_names: [_("User"), _("System"), _("Nice"), _("Wait"), _("Other")],
    max: 100,
    _init: function(orientation) {
        this.gtop = new GTop.glibtop_cpu();
        this.last = [0,0,0,0,0];
        this.current = [0,0,0,0,0];
        try {
            this.total_cores = GTop.glibtop_get_sysinfo().ncpu;
            this.max *= this.total_cores;
        } catch(e) {
            this.total_cores = 1;
            global.logError(e);
            global.logError("Assuming 1 core");
        }
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        this.menu_item = new PopupMenu.PopupMenuItem(_("Cpu"), {reactive: false});
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_cpu(this.gtop);
        this.current[0] = this.gtop.user;
        this.current[1] = this.gtop.sys;
        this.current[2] = this.gtop.nice;
        this.current[3] = this.gtop.idle;
        this.current[4] = this.gtop.iowait;
        
        let delta = (this.gtop.total - this.last_total)/(100*this.total_cores) ;
        if (delta > 0){
            for (let i = 0;i < 5;i++){
                this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                this.last[i] = this.current[i];
            }
            
            this.last_total = this.gtop.total;
        }
    },
    _apply: function() {
        let percent = Math.round(((100*this.total_cores)-this.usage[3])/this.total_cores);
        this.text_items[0].text = this.menu_items[3].text = percent.toString();
        let other = 100 * this.total_cores;
        for (let i = 0;i < this.usage.length;i++)
            other -= this.usage[i];
        //Not to be confusing
        other = Math.max(0, other);
        this.vals = [this.usage[0], this.usage[1], this.usage[2], this.usage[4], other];
        for (let i = 0;i < 5;i++)
            this.tip_vals[i] = Math.round(this.vals[i] / this.total_cores);
    },

    create_text_items: function() {
        return [new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: '%', style_class: "sma-perc-label"})];

    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: '%', style_class: "sma-label"})];
    }
};



Mem = function () {
    this._init.apply(this, arguments);
};

Mem.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'memory',
    color_name: ['program', 'buffer', 'cache'],
    tip_names: [_("Program"), _("Buffer"), _("Cache")],
    max: 1,
    _init: function(orientation) {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Memory"), {reactive: false});
        this.gtop = new GTop.glibtop_mem();
        this.mem = [0, 0, 0];
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_mem(this.gtop);
        this.mem[0] = Math.round(this.gtop.user / 1024 / 1024);
        this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024);
        this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0,0,0];
        } else {
            for (let i = 0;i < 3;i++) {
                this.vals[i] = this.mem[i] / this.total;
                this.tip_vals[i] = Math.round(this.vals[i] * 100);
            }
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.mem[0].toString();
        this.menu_items[3].text = this.total.toString();
    },
    create_text_items: function() {
        return [new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: '%', style_class: "sma-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: "/", style_class: "sma-label"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: "MiB", style_class: "sma-label"})];
    }
};


Swap = function () {
    this._init.apply(this, arguments);
};

Swap.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'swap',
    color_name: ['used'],
    tip_names: [_("Used")],
    max: 1,
    _init: function(orientation) {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false});
        this.gtop = new GTop.glibtop_swap();
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_swap(this.gtop);
        this.swap = Math.round(this.gtop.used / 1024 / 1024);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0];
        } else {
            this.vals[0] = this.swap / this.total;
            this.tip_vals[0] = Math.round(this.vals[0] * 100);
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.swap.toString();
        this.menu_items[3].text = this.total.toString();
    },

    create_text_items: function() {
        return [new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: '%', style_class: "sma-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: "/", style_class: "sma-label"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: "MiB", style_class: "sma-label"})];
    }
};


Net = function () {
    this._init.apply(this, arguments);
};

Net.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'net',
    color_name: ['down', 'downerrors', 'up', 'uperrors', 'collisions'],
    tip_names: [_("Down"), _("Down errors"), _("Up"), _("Up errors"), _("Collisions")],
    speed_in_bits: false,
    _init: function(orientation) {
        this.ifs = [];
        this.client = NMClient.Client.new();
        this.update_iface_list();

        if(!this.ifs.length){
            let net_lines = Cinnamon.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
            for(let i = 3; i < net_lines.length - 1 ; i++) {
                let ifc = net_lines[i].replace(/^\s+/g, '').split(":")[0];
                if(Cinnamon.get_file_contents_utf8_sync('/sys/class/net/' + ifc + '/operstate')
                .replace(/\s/g, "") == "up" && 
                ifc.indexOf("br") < 0 && 
                ifc.indexOf("lo") < 0) {
                        this.ifs.push(ifc);
                }
            }
        }

        this.gtop = new GTop.glibtop_netload();
        this.last = [0, 0, 0, 0, 0];
        this.usage = [0, 0, 0, 0, 0];
        this.last_time = 0;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Network"), {reactive: false});
        
        ElementBase.prototype._init.call(this, orientation);
        
        this.tip_format(['kiB/s', '/s', 'kiB/s', '/s', '/s']);
        this.update_units();
        Schema.connect('changed::' + this.elt + '-speed-in-bits', Lang.bind(this, this.update_units));
            
        try {
            let iface_list = this.client.get_devices();
            this.NMsigID = []
            for(let j = 0; j < iface_list.length; j++){
                this.NMsigID[j] = iface_list[j].connect('state-changed' , Lang.bind(this, this.update_iface_list));
            }
        }
        catch(e) {
            global.logError("Please install Network Manager GObject Introspection Bindings");
        }
        this.update();
    },
    update_units: function() {
        let previous_setting = this.speed_in_bits;
        this.speed_in_bits = Schema.get_boolean(this.elt + '-speed-in-bits');
        if (this.speed_in_bits) {
            this.set_tip_unit(['kbps', '/s', 'kbps', '/s', '/s']);
            this.text_items[2].text = 'kbps';
            this.text_items[5].text = 'kbps';
            if (!previous_setting) {
                this.last[0] *= 8;
                this.last[1] *= 8;
                this.usage[0] *= 8;
                this.usage[1] *= 8;
            }
        } else {
            this.set_tip_unit(['kiB/s', '/s', 'kiB/s', '/s', '/s']);
            this.text_items[2].text = 'kB/s';
            this.text_items[5].text = 'kB/s';
            if (previous_setting) {
                this.last[0] /= 8;
                this.last[1] /= 8;
                this.usage[0] /= 8;
                this.usage[1] /= 8;
            }
        }
    },     
    update_iface_list: function(){
        try {
            this.ifs = []
            let iface_list = this.client.get_devices();
            for(let j = 0; j < iface_list.length; j++){
                if (iface_list[j].state == NetworkManager.DeviceState.ACTIVATED){
                   //this.ifs.push(iface_list[j].get_iface());
                   this.ifs.push(iface_list[j].get_ip_iface());
                }
            }
        }
        catch(e) {
            global.logError("Please install Network Manager GObject Introspection Bindings");
        }
    },
    refresh: function() {
        let accum = [0, 0, 0, 0, 0];

        for (let ifn in this.ifs) {
            GTop.glibtop_get_netload(this.gtop, this.ifs[ifn]);
            accum[0] += this.gtop.bytes_in * (this.speed_in_bits ? 8 : 1);
            accum[1] += this.gtop.errors_in;
            accum[2] += this.gtop.bytes_out * (this.speed_in_bits ? 8 : 1);
            accum[3] += this.gtop.errors_out;
            accum[4] += this.gtop.collisions;
        }

        let time = GLib.get_monotonic_time() / 1000;
        let delta = time - this.last_time;
        if (delta > 0)
            for (let i = 0;i < 5;i++) {
                this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.tip_vals = this.vals = this.usage;
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[2].toString();
    },
    create_text_items: function() {
        return [new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 2 * IconSize / 3,
                              icon_name:'go-down'}),
                new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: 'kiB/s', style_class: "sma-unit-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 2 * IconSize / 3,
                              icon_name:'go-up'}),
                new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: 'kiB/s', style_class: "sma-unit-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-value"}),
                new St.Label({ text:'k', style_class: "sma-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 16, icon_name:'go-down'}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ text:'k', style_class: "sma-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 16, icon_name:'go-up'})];
    }
};


Disk = function () {
    this._init.apply(this, arguments);
};

Disk.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'disk',
    color_name: ['read', 'write'],
    tip_names: [_("Read"), _("Write")],
    _init: function(orientation) {
        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        let mount_lines = Cinnamon.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        this.mounts = [];
        for(let mount_line in mount_lines) {
            let mount = mount_lines[mount_line].split(" ");
            if(mount[0].indexOf("/dev/") == 0 && this.mounts.indexOf(mount[1]) < 0) {
                this.mounts.push(mount[1]);
            }
        }
        this.gtop = new GTop.glibtop_fsusage();
        this.last = [0,0];
        
        this.usage = [0,0];
        this.last_time = 0;
        GTop.glibtop_get_fsusage(this.gtop, this.mounts[0]);
        this.block_size = this.gtop.block_size/1024/1024/8;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Disk"), {reactive: false});
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format('kB/s');
        this.update();
    },
    refresh: function() {
        let accum = [0, 0];

        for(let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            accum[0] += this.gtop.read;
            accum[1] += this.gtop.write;
        }
        let time = GLib.get_monotonic_time() / 1000;
        let delta = (time - this.last_time) / 1000;
        
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] =(this.block_size* (accum[i] - this.last[i]) / delta) ;
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.vals = this.usage.slice();
        for (let i = 0;i < 2;i++) {    
                if (this.usage[i] < 10)
                    this.usage[i] = this.usage[i].toFixed(1);
                else
                    this.usage[i] = Math.round(this.usage[i]);
        }
        this.tip_vals = [this.usage[0] , this.usage[1] ];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    },
    create_text_items: function() {
        return [new St.Label({ text: _("R"), style_class: "sma-status-label"}),
                new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: 'MiB/s', style_class: "sma-perc-label"}),
                new St.Label({ text: _("W"), style_class: "sma-status-label"}),
                new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: 'MiB/s', style_class: "sma-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-value"}),
                new St.Label({ text:'MiB/s', style_class: "sma-label"}),
                new St.Label({ text:_("R"), style_class: "sma-label"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ text:'MiB/s', style_class: "sma-label"}),
                new St.Label({ text:_("W"), style_class: "sma-label"})];
    }
};

Thermal = function() {
    this._init.apply(this, arguments);
};

Thermal.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'thermal',
    color_name: ['tz0'],
    tip_names: [_("Temperature")],
    _init: function(orientation) {
        this.temperature = -273.15;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Thermal"), {reactive: false});
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format('\u00b0C');
        Schema.connect('changed::' + this.elt + '-sensor-file', Lang.bind(this, this.refresh));
        this.update();
    },
    refresh: function() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if(GLib.file_test(sfile,1<<4)){
            //global.logError("reading sensor");
            let t_str = Cinnamon.get_file_contents_utf8_sync(sfile).split("\n")[0];
            this.temperature = parseInt(t_str)/1000.0;
        }            
        else 
            global.logError("error reading: " + sfile);
    },
    _apply: function() {
        this.text_items[0].text = this.menu_items[3].text = this.temperature.toString();
        this.vals = [this.temperature];
        this.tip_vals[0] = Math.round(this.vals[0]);
    },
    create_text_items: function() {
        return [new St.Label({ style_class: "sma-status-value"}),
                new St.Label({ text: '\u00b0C', style_class: "sma-unit-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: '\u00b0C', style_class: "sma-label"})];
    }
};

Freq = function () {
    this._init.apply(this, arguments);
};

Freq.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'freq',
    color_name: ['freq'],
    tip_names: [_("Frequency")],
    _init: function(orientation) {
        this.freq = 0;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Frequency"), {reactive: false});
        ElementBase.prototype._init.call(this, orientation);
        this.tip_format('MHz');
        this.update();
    },
    refresh: function() {
        let lines = Cinnamon.get_file_contents_utf8_sync('/proc/cpuinfo').split("\n");
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if(line.search(/cpu mhz/i) < 0)
                continue;
            
            this.freq = parseInt(line.substring(line.indexOf(':') + 2));
            break;
        }
    },
    _apply: function() {
        let value = this.freq.toString();
        this.text_items[0].text = value + ' ';
        this.tip_vals[0] = value;
        this.menu_items[3].text = value;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: "sma-big-status-value"}),
                new St.Label({ text: 'MHz', style_class: "sma-perc-label"})];

    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ style_class: "sma-value"}),
                new St.Label({ style_class: "sma-void"}),
                new St.Label({ text: 'MHz', style_class: "sma-label"})];
    }
};

/* Battery was removed because
 * a) There is an app(let) for that
 * b) I would have had to change much of its implementation
 * c) I was too lazy to change much of its implementation.
 */

Graph = function() {
    this._init.apply(this, arguments);
};

Graph.prototype = {
    menu_item: '',
    _init: function() {
        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        let mount_lines = Cinnamon.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        this.mounts = [];
        for(let mount_line in mount_lines) {
            let mount = mount_lines[mount_line].split(" ");
            if(mount[0].indexOf("/dev/") == 0 && this.mounts.indexOf(mount[1]) < 0) {
                this.mounts.push(mount[1]);
            }
        }
        
        this.actor = new St.DrawingArea({ style_class: "sma-chart", reactive: false});
        this.width = arguments[0][1];
        this.height = arguments[0][1];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.gtop = new GTop.glibtop_fsusage();
        // FIXME Handle colors correctly
        this.colors = ["#444", "#666", "#888", "#aaa", "#ccc", "#eee"];
        for(let color in this.colors) {
            let clutterColor = new Clutter.Color();
            clutterColor.from_string(this.colors[color]);
            this.colors[color] = clutterColor;
        }
    },
    create_menu_item: function() {
        this.menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu_item.addActor(this.actor, {span: -1, expand: true});
    },
    show: function(visible) {
        this.menu_item.actor.visible = visible;
    }
};

Bar = function () {
    this._init.apply(this, arguments);
};

Bar.prototype = {
    __proto__: Graph.prototype,
    
    _init: function() {
        this.thickness = 15;
        this.fontsize = 14;
        Graph.prototype._init.call(this, arguments);
        this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2);
    },
    
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();

        let x0 = width/8;
        let y0 = this.thickness/2;

        cr.setLineWidth(this.thickness);
        cr.setFontSize(this.fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            let perc_full = (this.gtop.blocks - this.gtop.bfree)/this.gtop.blocks;
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            cr.moveTo(2*x0,y0)
            cr.relLineTo(perc_full*0.6*width, 0);
            cr.moveTo(0, y0+this.thickness/3);
            cr.showText(this.mounts[mount]);
            //cr.stroke();
            cr.moveTo(width - x0, y0+this.thickness/3);
            cr.showText(Math.round(perc_full*100).toString()+'%');
            cr.stroke();
            y0 += (3 * this.thickness) / 2;
        }
    }
};

Pie = function () {
    this._init.apply(this, arguments);
};

Pie.prototype = {
    __proto__: Graph.prototype,
    
    _init: function() {
        Graph.prototype._init.call(this, arguments);
    },
    
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let xc = width / 2;
        let yc = height / 2;
        let rc = Math.min(xc, yc);
        let pi = Math.PI;
        
        function arc(r, value, max, angle) {
            if(max == 0) return angle;
            let new_angle = angle + (value * 2 * pi / max);
            cr.arc(xc, yc, r, angle, new_angle);
            return new_angle;
        }
        
        let rings = (this.mounts.length < 7 ? this.mounts.length : 7);
        let thickness = (2 * rc) / (3 * rings);
        let fontsize = 14;
        let r = rc - (thickness / 2);
        cr.setLineWidth(thickness);
        cr.setFontSize(fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            arc(r, this.gtop.blocks - this.gtop.bfree, this.gtop.blocks, -pi/2);
            cr.moveTo(0, yc - r + thickness / 2);
            cr.showText(this.mounts[mount]);
            cr.stroke();
            r -= (3 * thickness) / 2;
        }
    }
};

Icon = function () {
    this._init.apply(this, arguments);
};

Icon.prototype = {
    _init: function() {
        this.actor = new St.Icon({ icon_name: 'utilities-system-monitor',
                                   icon_type: St.IconType.SYMBOLIC,
                                       style_class: 'system-status-icon'});
        this.actor.visible = Schema.get_boolean("icon-display");
        Schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean("icon-display");
                      }));
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
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            let elts = {
                cpu: new Cpu(orientation),
                freq: new Freq(orientation),
                memory: new Mem(orientation),
                swap: new Swap(orientation),
                net: new Net(orientation),
                disk: new Disk(orientation),
                thermal: new Thermal(orientation),
            }
            let icon = new Icon();
            
            let box = new St.BoxLayout();
            
            this.actor.add_actor(box);
            box.add_actor(icon.actor);
            for (let elt in elts) {
                box.add_actor(elts[elt].actor);
                this.menu.addMenuItem(elts[elt].menu_item);
            }
            
            this.pie = new Pie(300, 300);
            this.pie.create_menu_item();
            this.menu.addMenuItem(this.pie.menu_item);
            
            this.bar = new Bar(300, 150);
            this.bar.create_menu_item();
            this.menu.addMenuItem(this.bar.menu_item);
            
            this.change_usage();
            
            Schema.connect('changed::' + 'disk-usage-style', Lang.bind(this, this.change_usage));
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            let menu_timeout;
            this.menu.connect(
                'open-state-changed',
                function (menu, isOpen) {
                    if(isOpen) {
                        pie.actor.queue_repaint();
                        menu_timeout = Mainloop.timeout_add_seconds(
                            1,
                            function () {
                                pie.actor.queue_repaint();
                                return true;
                            });
                    } else {
                        Mainloop.source_remove(menu_timeout);
                    }
                }
            );
            
            let _appSys = Cinnamon.AppSystem.get_default();
            let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');

            item = new PopupMenu.PopupMenuItem(_("System Monitor"));
            item.connect('activate', function () {
                _gsmApp.activate();
            });
            this.menu.addMenuItem(item);

            item = new PopupMenu.PopupMenuItem(_("Preferences"));
            item.connect('activate', function () {
                if (UsePython2)
                {
                    GLib.spawn_command_line_async('python2 ' + metadata.path + '/config.py');
                }
                else
                {
                    GLib.spawn_command_line_async('python ' + metadata.path + '/config.py');
                }
            });
            this.menu.addMenuItem(item);

        } catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    
    change_usage: function() {
        let usage = Schema.get_string('disk-usage-style');
        this.pie.show(usage == 'pie');
        this.bar.show(usage == 'bar');
    },
};

function ErrorApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

ErrorApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
        this.set_applet_icon_symbolic_name("dialog-error-symbolic");
        this.set_applet_tooltip(_("Error"));
    },
    
    on_applet_clicked: function(event) {
        let errorDialog = new ErrorDialog();
        errorDialog.open();
    },
};


function main(metadata, orientation) {
    if (!smaDepsGtop || !smaDepsNM) {
        let errorDialog = new ErrorDialog();
        
        let dialog_timeout = Mainloop.timeout_add_seconds(
            1,
            function () {
                errorDialog.open();
                Mainloop.source_remove(dialog_timeout);
                return true;
            });
        return new ErrorApplet(metadata, orientation);
    }
    init(metadata);
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}
