const Lang = imports.lang;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Cairo = imports.cairo;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const tfpf = "/tmp/cnmna_inklvlmnt_o9_i";
const vertdelta = 2;
const UUID = "ink-level-monitor@r0p01ach";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation);
        try {
            this.phase = 1; // 1=starting, 2=visible, 3=removed
            this.metadata = metadata;
            this.instance_id = instance_id;
            this.orientation = orientation;
            this.panel_height = panel_height;
            this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "appletWidth", "appletWidth", this.setAppletWidth);
            this.settings.bindProperty(Settings.BindingDirection.IN, "lpPort", "lpPort", this.setLpPort);
            this.settings.bindProperty(Settings.BindingDirection.IN, "updateInterval", "updateInterval", this.setUpdateInterval);
            this.drArea = new St.DrawingArea();
            this.drArea.width = this.appletWidth;
            this.drArea.connect('repaint', Lang.bind(this, this.onrepaint));
            this.actor.add_actor(this.drArea);
            this.width = this.appletWidth;
            this.height = this.panel_height - 2 * vertdelta;
            this.repeatdo1();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_panel_height_changed: function() {
        this.panel_height = this.panel.actor.get_height();
        this.height = this.panel_height - 4;
        this._init_gui();
    },

    setAppletWidth: function() {
        this.drArea.width = this.appletWidth;
        this.width = this.appletWidth;
    },

    setLpPort: function() {
        this.repeatdo();
    },

    setUpdateInterval: function() {
        GLib.source_remove(this.repeatf);
        this.planrepeat();
    },

    repeatdo1: function() {
        this.doupdate();
        if ((this.phase < 2) && this.drArea.get_paint_visibility())
            this.phase = 2;
        if ((this.phase > 1) && !this.drArea.get_paint_visibility())
            this.phase = 3;
        if (this.phase < 3) // This is the way how to detect if the applet has been removed
            this.planrepeat();
    },

    repeatdo: function() {
        GLib.source_remove(this.repeatf);
        this.repeatdo1();
    },

    planrepeat: function() {
        this.repeatf = Mainloop.timeout_add(1000 * this.updateInterval, Lang.bind(this, this.repeatdo));
    },

    doupdate: function() {
        let dev_ok =  Gio.file_new_for_path("/dev/lp" + this.lpPort.toString()).query_exists(null) ||
            Gio.file_new_for_path("/dev/usb/lp" + this.lpPort.toString()).query_exists(null) || 
            Gio.file_new_for_path("/dev/usblp" + this.lpPort.toString()).query_exists(null);
        if (dev_ok) {
            try {
                this.ddac = 0;
                this.dda1 = Array();
                this.dda2 = Array();
                let flgs = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
                let [rslt, pid] = GLib.spawn_async(this.metadata.path, 
                    ["sh", "-c", "ink -p usb -n " + this.lpPort.toString() + " > " + tfpf + this.instance_id], null, flgs, null);
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.ontfclosed), null);
            } catch(e) {
                global.logError(e);
            }
        }
        else {
            this.set_applet_tooltip(_("Unable to connect printer at port ") + this.lpPort.toString());
            this.ddac = 0;
            this.dda1 = Array();
            this.dda2 = Array();
            this.drArea.queue_repaint();
        }
    },

    ontfclosed: function(pid, status) {
        let f = Gio.file_new_for_path(tfpf + this.instance_id);
        if(!f.query_exists(null)) {
            this.set_applet_tooltip(_("Error reading data..."));
            return;
        }
        [success, out, tag] = f.load_contents(null);
        let tta = out.toString().split('\n');
        tt = tta.slice(2, tta.length - 1).join('\n').replace(/ +/g, ' ');
        this.set_applet_tooltip(tt);
        let dda = tt.split('\n');
        dda = dda.slice(2, dda.length);
        this.ddac = dda.length;
        this.dda1 = Array();
        this.dda2 = Array();
        for (i = 0; i < this.ddac; i++) {
            let ll = dda[i].split(": ");
            this.dda1[i] = ll[0];
            this.dda2[i] = ll[1].split("%")[0];
        }
        this.drArea.queue_repaint();
    },

    onrepaint: function(area) {
        try {
            let cr = area.get_context();
            cr.setLineWidth = 0.01;
            cr.setSourceRGBA(0.34, 0.34, 0.34, 0.9);
            cr.rectangle(0, vertdelta, this.width, this.height);
            cr.fill();

            let ww = (this.width + 1) * 1.0 / this.ddac;
            let hh = this.height;
            let aa = 0.9;
            for (i = 0; i < this.ddac; i++) {
                if (this.dda1[i] == "Photoblack") {
                    cr.setSourceRGBA(0.1, 0.1, 0.1, aa);
                } else if (this.dda1[i] == "Photocyan") {
                    cr.setSourceRGBA(0.2, 0.8, 0.8, aa);
                } else if (this.dda1[i] == "Photomagenta") {
                    cr.setSourceRGBA(0.8, 0.2, 0.8, aa);
                } else if (this.dda1[i] == "Photoyellow") {
                    cr.setSourceRGBA(0.8, 0.8, 0.2, aa);
                } else if (this.dda1[i] == "Black") {
                    cr.setSourceRGBA(0.0, 0.0, 0.0, aa);
                } else if (this.dda1[i] == "Cyan") {
                    cr.setSourceRGBA(0.1, 0.7, 0.7, aa);
                } else if (this.dda1[i] == "Magenta") {
                    cr.setSourceRGBA(0.7, 0.1, 0.7, aa);
                } else if (this.dda1[i] == "Yellow") {
                    cr.setSourceRGBA(0.7, 0.7, 0.1, aa);
                } else if (this.dda1[i] == "Light Black") {
                    cr.setSourceRGBA(0.2, 0.2, 0.2, aa);
                } else if (this.dda1[i] == "Light Cyan") {
                    cr.setSourceRGBA(0.3, 0.9, 0.9, aa);
                } else if (this.dda1[i] == "Light Magenta") {
                    cr.setSourceRGBA(0.9, 0.3, 0.9, aa);
                } else if (this.dda1[i] == "Light Yellow") {
                    cr.setSourceRGBA(0.9, 0.9, 0.3, aa);
                } else if (this.dda1[i] == "Light Light Black") {
                    cr.setSourceRGBA(0.3, 0.3, 0.3, aa);
                } else if (this.dda1[i] == "Medium Grey") {
                    cr.setSourceRGBA(0.4, 0.4, 0.4, aa);
                } else if (this.dda1[i] == "Photogrey") {
                    cr.setSourceRGBA(0.5, 0.5, 0.5, aa);
                } else if (this.dda1[i] == "Light Grey") {
                    cr.setSourceRGBA(0.6, 0.6, 0.6, aa);
                } else if (this.dda1[i] == "White") {
                    cr.setSourceRGBA(0.8, 0.8, 0.8, aa);
                } else if (this.dda1[i] == "Red") {
                    cr.setSourceRGBA(0.7, 0.1, 0.1, aa);
                } else if (this.dda1[i] == "Green") {
                    cr.setSourceRGBA(0.1, 0.7, 0.1, aa);
                } else if (this.dda1[i] == "Blue") {
                    cr.setSourceRGBA(0.1, 0.1, 0.7, aa);
                } else
                /*"Color", "Photo", "Matte Black", "Gloss Optimizer", "Unknown", "Light Cyan, Light Magenta, Photoblack",
                "2x Grey and Black", "Black, Cyan, Magenta, Yellow", "Photocyan and Photomagenta", "Yellow and Magenta",
                "Cyan and Black", "Light Grey and Photoblack"*/ {
                    cr.setSourceRGBA(0.7, 0.7, 0.7, aa);
                }
                let vv = 0.01 * parseInt(this.dda2[i]);
                cr.rectangle(i * ww, vertdelta + hh * (1 - vv), ww, hh * vv);
                cr.fill();
            }
        } catch(e) {
            global.logError(e);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

