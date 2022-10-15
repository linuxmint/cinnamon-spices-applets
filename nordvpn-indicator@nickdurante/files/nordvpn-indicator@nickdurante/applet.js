const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const UUID = "nordvpn-indicator@nickdurante";

// pull: https://github.com/linuxmint/cinnamon-spices-applets

function NordVPNApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

NordVPNApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("network-vpn");
        this.set_applet_tooltip(_("Manage your NordVPN connection"));
        this.set_applet_label("NordVPN");
        this.connected = false;
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
            let item = new PopupMenu.PopupIconMenuItem("Connect", "connect_established", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("nordvpn connect");
                         }));
            this.menu.addMenuItem(item);


            item = new PopupMenu.PopupIconMenuItem("Connect P2P", "connect_established", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("nordvpn connect --group p2p");
                         }));
            this.menu.addMenuItem(item);

            // Second item: Turn off
            item = new PopupMenu.PopupIconMenuItem("Disconnect", "connect_no", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           Util.spawnCommandLine("nordvpn disconnect");
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
          return stdout.toString();
        }
      }
      catch (e) {
        global.logError(e);
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
        let status = this._run_cmd("nordvpn status");
        let regex = /Status: ([a-zA-Z]+)/i;
        let result = regex.exec(status)[1];
        let outString;
        if (result === "Connected"){
            this.connected = true;
            outString = "ON";
        }else if (result === "Disconnected"){
            this.connected = false;
            outString = "OFF";
        }else{
            this.connected = false,
            outString = "..."
        }
        this.set_applet_label(outString);
    },

    _update_loop: function () {
		this._get_status();
		this._updateLoopID = Mainloop.timeout_add(this.update_interval, Lang.bind(this, this._update_loop));
	},

};


function main(metadata, orientation, panel_height, instance_id) {
    return new NordVPNApplet(orientation, panel_height, instance_id);
}
