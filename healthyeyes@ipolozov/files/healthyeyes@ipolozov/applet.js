const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const UUID = 'healthyeyes@ipolozov';

function MyApplet(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.set_applet_icon_name("green");
        this.set_applet_tooltip("look away from the screen for a while when the circle is red");

        this.refresh();
	  	  this.timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.refresh));
        this.keepUpdating = true;
  },

    refresh: function() {

        let myDate = new Date();
        let minute = myDate.getMinutes();

        if (minute == 0 || minute == 30) {
            this.set_applet_icon_name("red");
        } 
        else {
            this.set_applet_icon_name("green");
        }

        return this.keepUpdating;
    },

  on_applet_removed_from_panel: function() {
    // if the applet is removed, stop updating, stop Mainloop
      this.keepUpdating = false;
      if (this.timeout) Mainloop.source_remove(this.timeout);
      this.timeout = 0;
  }


}; //prototype

function main(metadata, orientation, panelHeight, instanceId) {
  let myApplet = new MyApplet(orientation, panelHeight, instanceId);
  return myApplet;
}
