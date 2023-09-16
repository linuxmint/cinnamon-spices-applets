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
          
    	// set update intervall:
		//  1 beat = 86.4 sec.  Shorter update interval means more precise changing time of the .beat
		this.timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.refresh));         
		// only update, if the applet is running
        this.keepUpdating = true;          
    },

	refresh: function() {
		let d = new Date();
		let h = d.getUTCHours() + 1;
		let m = d.getUTCMinutes();
		let s = d.getUTCSeconds();
		//let tzoff = 60 + d.getTimezoneOffset();
		//let beats = ('000' + Math.floor((s + (m + tzoff) * 60 + h * 3600) / 86.4) % 1000).slice(-3);

		// calculation fix
		let beatSecs = (s + m * 60 + h * 3600);
		let netBeats = beatSecs / 86.4;
		let beats = ("000" + parseInt(netBeats)).slice(-3);

		this.set_applet_label(_("@" + beats));
		// only update, if the applet is running
		return this.keepUpdating;
	},
	
	on_applet_removed_from_panel: function() {
	// if the applet is removed, stop updating, stop Mainloop
    this.keepUpdating = false;
    if (this.timeout) Mainloop.source_remove(this.timeout);
    this.timeout = 0;
  }	
};

function main(metadata, orientation, panel_height, instance_id) {
    return new NetBeatApplet(orientation, panel_height, instance_id);
}
