const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const UUID = "sleepTimer@JDatPNW";

// pull: https://github.com/linuxmint/cinnamon-spices-applets

function sleepTimerApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

sleepTimerApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("appointment-soon");
        this.set_applet_tooltip(_("sleepTimer"));
        this.set_applet_label("sleepTimer");
        this.connected = false;
        this.alerted = false;
		this.update_interval = 5000;

        try {

            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval", "update_interval", this._new_freq, null);

            // Create the popup menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            // First item: Turn on
            let item = new PopupMenu.PopupIconMenuItem("1h", "appointment-soon", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown +60");
                         }));
            this.menu.addMenuItem(item);


            item = new PopupMenu.PopupIconMenuItem("2h", "appointment-soon", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown +120");
                         }));
            this.menu.addMenuItem(item);

            item = new PopupMenu.PopupIconMenuItem("3h", "appointment-soon", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown +180");
                         }));
            this.menu.addMenuItem(item);

            item = new PopupMenu.PopupIconMenuItem("4h", "appointment-soon", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown +240");
                         }));
            this.menu.addMenuItem(item);

            item = new PopupMenu.PopupIconMenuItem("5h", "appointment-soon", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown +300");
                         }));
            this.menu.addMenuItem(item);

            // Second item: Turn off
            item = new PopupMenu.PopupIconMenuItem("Reset", "appointment-missed", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("shutdown -c");
                         }));
            this.menu.addMenuItem(item);

            this._get_status();
			this._update_loop();
		}
		catch (e) {
			global.logError(e);
		}

    },

    on_applet_clicked: function() {

        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
		if (this._updateLoopID) {
			Mainloop.source_remove(this._updateLoopID);
		}

	},

    _run_cmd: function(command) {
      try {
        let [result, stdout, stderr] = GLib.spawn_command_line_sync(command);
        if (stdout != null) {
          let statusString = stdout.toString();
          statusString = statusString.trim();
          statusString = parseInt(statusString.replace("USEC=",""));

          let sleepTime = new Date(statusString/1000);
          let currentTime = new Date(Date.now());

          var diffMs = (sleepTime - currentTime); // milliseconds between now & Christmas
          var diffDays = Math.floor(diffMs / 86400000); // days
          var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
          var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

          let formattedTime = diffHrs.toString() + ":" + diffMins.toString();

          if((diffHrs == 0 && diffMins <= 15) && !this.alerted){
            Util.spawnCommandLine('zenity --error --text="Only less than 15 minutes left until shutdown\!" --title="shutdownTimer\!"');
            Util.spawnCommandLine("notify-send 'shutdownTimer' 'Only less than 15 minutes left until shutdown'");
            this.alerted = true;
          }

          return formattedTime;
        }
      }
      catch (e) {
        global.logError(e);
        return e.toString();
      }

      return "";
    },

    _new_freq: function(){
    	global.log(this.update_interval);
        if (this._updateLoopID) {
			Mainloop.source_remove(this._updateLoopID);
		}
        this._update_loop();
    },

    _get_status: function(){
        let result = this._run_cmd("head -1 /run/systemd/shutdown/scheduled");
        let outString;
        if (result != "NaN:NaN"){
            this.connected = true;
            outString = result;
        }else{
            this.connected = false,
            outString = "Not Set";
        }
        this.set_applet_label(outString);
    },

    _update_loop: function () {
		this._get_status();
		this._updateLoopID = Mainloop.timeout_add(this.update_interval, Lang.bind(this, this._update_loop));
	},

};


function main(metadata, orientation, panel_height, instance_id) {
    return new sleepTimerApplet(orientation, panel_height, instance_id);
}