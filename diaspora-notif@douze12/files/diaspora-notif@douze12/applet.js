const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;

const AppletDir = imports.ui.appletManager.appletMeta['diaspora-notif@douze12'].path;
const Settings = imports.ui.settings;

const UUID = 'diaspora-notif@douze12';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/**
 * Settings keys
 */
const LOGIN_KEY = "login";
const PASSWORD_KEY = "password";
const POD_URL_KEY = "podUrl";
const REFRESH_DELAY_KEY = "refreshDelay";

const KEYS = [
	LOGIN_KEY,
	PASSWORD_KEY,
	POD_URL_KEY,
	REFRESH_DELAY_KEY
];


/**
 * Constants
 */
const APPLET_ICON_NAME = "diaspora_asterisk_32.png";
const APPLET_ICON_NAME_ERROR = "diaspora_asterisk_32_error.png";
const APPLET_ICON_NAME_NOTIF = "diaspora_asterisk_32_notif.png";
const NOTIFS_FILE_NAME = "notifs.json";
const NOTIFICATION_URL = "/notifications";


function DiasporaNotif(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._init(orientation);
}

DiasporaNotif.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
			log("Intitalisation");

			this.orientation = orientation;

			this.path = AppletDir + "/";

			//set the default icon & tooltip
			this.set_applet_icon_path(this.path+APPLET_ICON_NAME);
			this.set_applet_tooltip(_("Diaspora* notifications"));

			this.bindSettings();

			this.buildMenu();

			this.loadNotifications();

			log("END Initialisation");
        }
        catch (e) {
            logError("Initialisation error " + e);
        }
     },

	/**
	 * Method used to bind the settings with an attribute
	 */
	bindSettings : function() {
		for (let k in KEYS) {
			let key = KEYS[k];
			let keyProp = "_" + key;
			this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp, this.refreshConf, null);
		}
	},

	/**
	 * Method used to call the python script which extract the notifications
	 */
	loadNotifications : function(){
		log("Call the notifications extractor");
		try{
			//call the script
			[success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(this.path,
				["/usr/bin/python3","diaspora_get_notifs.py", this._podUrl, this._login, this._password], null,
				GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

			//defines a callback when the script ends
			GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.onNotificationsExtracted));

		} catch (e) {
			logError("Error when trying to call the notifications extractor script " + e);
		}

		//call a loop to refesh the data after a delay set by the conf
		let refreshDelay = parseInt(this._refreshDelay) * 60;
		Mainloop.timeout_add_seconds(refreshDelay, Lang.bind(this, function() {
			this.loadNotifications();
		}));

	},

	/**
	 * Callback when the python script has finished
	 */
	onNotificationsExtracted: function(){
		try{
			log("Load notifications file");

			//get the notifications file created by the script
		 	let file = Gio.file_new_for_path(this.path + NOTIFS_FILE_NAME);
		 	if(!file.query_exists(null)){
				log("File doesn't exists "+ this.path + NOTIFS_FILE_NAME);
		 		this.set_applet_icon_path(this.path + APPLET_ICON_NAME_ERROR);
		 		return;
		 	}

		 	//load the JSON object from the file
			[success, jsonString, tag] = file.load_contents(null);
			this.notifications = JSON.parse(jsonString);

			//if the result is OK (no error message)
			if(this.notifications && !this.notifications.error){
				if(this.notifications.length > 0){
					this.set_applet_tooltip(_("You have %d new notifications").format(this.notifications.length));
					this.set_applet_icon_path(this.path + APPLET_ICON_NAME_NOTIF);
				}
				else{
					this.set_applet_icon_path(this.path+APPLET_ICON_NAME);
					this.set_applet_tooltip(_("Diaspora* notifications"));
				}
			}
			else{
				//an error occured
				this.set_applet_icon_path(this.path + APPLET_ICON_NAME_ERROR);
				if(this.notifications.error){
					this.set_applet_tooltip(this.notifications.error);
					log("Error : "+this.notifications.error);
				}
			}
			this.displayNotifications();
		} catch (e) {
			logError("Error when trying to read notifications " + e);
		}
	},

	/**
	 * Method which build the menu opened when the user click on the applet icon
	 */
	buildMenu : function(){
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, this.orientation);
		this.menuManager.addMenu(this.menu);

		this.notifArea = new St.Table({style_class:'notifArea'});
		this.menu.addActor(this.notifArea);
	},

	displayNotifications: function(){
		//delete the elements before refresh
		let children = this.notifArea.get_children();
        for (let i = 0; i < children.length; i++){
            children[i].destroy();
       	}

		//task name label
		if(this.notifications && !this.notifications.error){
			if(this.notifications.length > 0){
				for(let i = 0; i < this.notifications.length; i++){
					let notif = this.notifications[i];


					let date = new Date(notif.time);
					let dateStr = date.toLocaleFormat("%e/%m/%Y %H:%M");

					let notifLabel = new St.Label({style_class:"notifLabel"});
					notifLabel.set_text(notif.text + " | " + dateStr);



					let labelButton = new St.Button({child : notifLabel, style_class:'labelButton',x_align: St.Align.START});

					this.notifArea.add(labelButton, {row:i,col:0});

					//connect events
					labelButton.connect('clicked', Lang.bind(this, function(){
						this.onGoToDiaspora();
					}));
				}
			}
			else{
				let noNotifLabel = new St.Label({style_class:"noNotifLabel"});
		        noNotifLabel.set_text(_("No Notification"));
				this.notifArea.add(noNotifLabel, {row:0,col:0});
			}
		}else{
			let errorLabel = new St.Label({style_class:"errorLabel"});
			if(this.notifications.error){
				errorLabel.set_text(this.notifications.error);
			}
			else{
				errorLabel.set_text(_("Technical error"));
			}

			this.notifArea.add(errorLabel, {row:0,col:0});
		}
	},

	onGoToDiaspora:function(){
		try{
			//call the xdg_open program to open the diaspora website
			[success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(this.path,
				["/usr/bin/xdg-open",this._podUrl + NOTIFICATION_URL], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

			//close the menu
			this.menu.toggle();
		} catch (e) {
			logError("Error when trying to call xdg-open " + e);
		}
	},

	/**
	 * Click on the applet icon in the command bar in order to open the menu
	 */
	on_applet_clicked : function(event) {
		this.menu.toggle();
	},
};



/*------------------------
 * Logging
 * ------------------------*/
function log(message) {
	global.log(UUID + "::" + message);
}

function logError(message) {
	global.logError(UUID + "::" + message);
}



function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new DiasporaNotif(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
