const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GTop = imports.gi.GTop;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const UUID = "mem-monitor-text@datanom.net";
const GLib = imports.gi.GLib;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
__proto__:
    Applet.TextApplet.prototype,

_init:
    function(orientation) {
        Applet.TextApplet.prototype._init.call(this, orientation);

        try {
            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "mem-label", "mem_label", this._update, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "warning-usage", "warn_label", this._update, null);

            this.itemOpenSysMon = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
            this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
            this._applet_context_menu.addMenuItem(this.itemOpenSysMon);

            this.gtop = new GTop.glibtop_mem();

            this.defaultStyle = 'min-width: 2.5em; text-align: left;';
            this.warningStyle = this.defaultStyle + ' color: red;'
            this.toggleStyle = false;
            this._applet_label.set_style(this.defaultStyle);

            this.usage = 0;
            this.maxmem = 0;
            this.buffer = 0;
            this.cached = 0;

            this._update();
        }
        catch (e) {
            global.logError(e);
        }
    },

on_applet_clicked:
    function(event) {
        this._runSysMon();
    },

_runSysMonActivate:
    function() {
        this._runSysMon();
    },

_update:
    function() {
        try {
            GTop.glibtop_get_mem(this.gtop);
            this.maxmem = this.gtop.total;
            this.user = this.gtop.user;

            let percent = Math.round((this.user * 100) / this.maxmem);
            this.set_applet_label(this.mem_label + " " + percent.toString().slice(-3) + "%");

            // Warning high memory usage
            if (percent > parseInt(this.warn_label)) {
                this.toggleStyle = !this.toggleStyle;
                this._applet_label.set_style(this.toggleStyle ? this.defaultStyle : this.warningStyle);
            } else if (!this.toggleStyle) {
                this._applet_label.set_style(this.defaultStyle);
            }

            this.set_applet_tooltip(_("Click to open Gnome system monitor"));
        }
        catch (e) {
            global.logError(e);
        }

        Mainloop.timeout_add(2000, Lang.bind(this, this._update));
    },

_runSysMon:
    function() {
        let _appSys = Cinnamon.AppSystem.get_default();
        let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
        _gsmApp.activate();
    },
};

function main(metadata, orientation) {
    return new MyApplet(orientation);
}
