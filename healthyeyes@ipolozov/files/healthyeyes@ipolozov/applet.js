const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const UUID = 'healthyeyes@ipolozov';

var myDate = new Date();
var last_hour = myDate.getHours() - 1;
var last_minute = myDate.getMinutes() - 10; // Takes away a few minutes in case the time is already at the time it should change

function log(message, type = "debug") {
    const finalLogMessage = `[${UUID}] ${message}`;

    if (type === "error") {
        global.logError(finalLogMessage);
    } else if (type === "warning") {
        global.logWarning(finalLogMessage);
    } else {
        global.log(finalLogMessage);
    }
}


function MyApplet(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.set_applet_icon_name("green");
        this.set_applet_tooltip("Look away from the screen for a while when the circle is red, then click the circle to turn it back to green.");

        this.refresh();
	  	  this.timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.refresh));
        this.keepUpdating = true;
  },

    refresh: function() {
        //log("refresh!");
        let myDate = new Date();
        let hour = myDate.getHours();
        let minute = myDate.getMinutes();
        
        //log(hour);
        //log(minute);
        //log(last_hour);
        //log(last_minute);
	
        // Checks if it should change, and makes sure that it isn't the same time as when it last changed
        if ((minute == 0 || minute == 30) && (minute != last_minute || hour != last_hour)) {
            log("change!");
            this.set_applet_icon_name("red");
        } 
        last_hour = hour;
        last_minute = minute;
        

        return this.keepUpdating;
    },

    on_applet_clicked: function() {
	    this.set_applet_icon_name("green");
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
