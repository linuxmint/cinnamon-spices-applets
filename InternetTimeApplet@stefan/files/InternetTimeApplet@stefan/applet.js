const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

function NetBeatApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

NetBeatApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);
		  this.set_applet_label(_("@Ste"));
		  this.set_applet_tooltip(_("Internet Time\n.beat"));

          this.refresh();
    },

	refresh: function() {
		let d = new Date();
		let h = d.getHours();
		let m = d.getMinutes();
		let s = d.getSeconds();
		let tzoff = 60 + d.getTimezoneOffset();
		let beats = ('000' + Math.floor((s + (m + tzoff) * 60 + h * 3600) / 86.4) % 1000).slice(-3);
		this.set_applet_label(_("@" + beats));
		
		// set update intervall:
		//  1 beat = 86.4 sec.  Shorter update interval means more precise changing time of the .beat
		this.timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.refresh));
	
	},
};

function main(metadata, orientation, panel_height, instance_id) {
    return new NetBeatApplet(orientation, panel_height, instance_id);
}
