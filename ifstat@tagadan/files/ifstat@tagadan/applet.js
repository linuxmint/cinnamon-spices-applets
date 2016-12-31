const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const REFRESH_INTERVAL = 1


// Applet
// ----------
function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_label("...");
            this.set_applet_tooltip(_("Device\nKB/s in: --\nKB/s out: --"));
        }
        catch (error) {
	    global.logError(e);
        }

        this.refreshLocation();
    },

    refreshLocation: function refreshLocation() {
       try {
		GLib.spawn_async(GLib.get_home_dir() + "/.local/share/cinnamon/applets/ifstat@tagadan/",['/bin/bash',GLib.get_home_dir() + "/.local/share/cinnamon/applets/ifstat@tagadan/asd.sh"], null, 0, null);}
        catch (e){
		this.set_applet_tooltip(_("please install ifstat and/or glib libraries"));
		this.set_applet_label("please install ifstat and/or glib libraries");
	}
        
	Mainloop.timeout_add_seconds(REFRESH_INTERVAL, Lang.bind(this, function refreshTimeout() {
			let [res, out] = GLib.spawn_command_line_sync("cat /dev/shm/tmpnetfile");
			let asd = String(out).split("\n")[0];
			let asd = String(asd).trim();
			let out = String(out).split("\n")[2];
			let out = String(out).trim();
			let outa = String(out).split(" ")[0];
			let outb = String(out).split(" ");
			let outb = outb[outb.length-1];

			var printout="\u25bc\u25b2";
			if (outa == "0.00" && outb =="0.00"){
				printout="\u25bd\u25b3";}
			if (outa == "0.00" && outb !="0.00"){
				printout="\u25bd\u25b2";}
			if (outa != "0.00" && outb =="0.00"){
				printout="\u25bc\u25b3";}
			if (outa == "undefined" && outb =="undefined"){
				printout="";}

            		this.set_applet_tooltip(_(asd + "\nKB/s in: " + outa + "\nKB/s out: " + outb));
			this.set_applet_label(printout);
			this.refreshLocation();
        	}));
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
