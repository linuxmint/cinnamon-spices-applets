/* This is a VPN Look-Out Applet.
It is not only useful in its own right
but is also provides a 'tutorial' framework for other more
complex applets - for example it provides a settings screen 
and a 'standard' right click (context) menu which opens 
the settings panel and a Housekeeping submenu accessing
help and a version/update files and also the nVidia settings program,
the gnome system monitor program and the Power monitor
in case you want to find out how much resources this applet is 
using at various update rates. 
Items with a ++ in the comment are useful for re-use
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  ++ Needed for menus
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Mainloop = imports.mainloop; // Needed for timer update loop
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for criticalNotify()

// ++ Always needed if you want localisation/translation support
// New l10n support thanks to ideas from @Odyseus, @lestcape and @NikoKrause

var UUID;
function _(str) {
	let customTrans = Gettext.dgettext(UUID, str);
	if (customTrans !== str && customTrans !== "")
		return customTrans;
	return Gettext.gettext(str);
}

/* 
Function to provide a Modal Dialog. This approach is thanks to Mark Bolin
It works, even if I do not fully understand it, and has done for years in NUMA! 
*/

function AlertDialog(value) {
	this._init(value);
};

AlertDialog.prototype = {
	__proto__: ModalDialog.ModalDialog.prototype,
	_init: function (value) {
		ModalDialog.ModalDialog.prototype._init.call(this);
		let label = new St.Label({
			text: value ,
			style_class: "centered"
		});
		this.contentLayout.add(label);
		this.setButtons([{
			style_class: "centered",
			label: _("Ok"),
			action: Lang.bind(this, function () {
				this.close();
			})
		}]);
	}
};



// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
	this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype, // Now TextIcon Applet

	_init: function (metadata, orientation, panelHeight, instance_id) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
		//try {
			this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

			if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
				 this.setAllowedLayout(Applet.AllowedLayout.BOTH); 
			}

			this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
				"refreshInterval-spinner", // The setting key
				"refreshInterval", // The property to manage (this.refreshInterval)
				this.on_settings_changed, // Callback when value changes
				null); // Optional callback data

			this.settings.bindProperty(Settings.BindingDirection.IN,
				"vpnInterface",
				"vpnInterface",
				this.on_settings_changed,
				null);
			this.settings.bindProperty(Settings.BindingDirection.IN,
				"vpnName",
				"vpnName",
				this.on_settings_changed,
				null);

			this.settings.bindProperty(Settings.BindingDirection.IN,
				"displayType",
				"displayType",
				this.on_settings_changed,
				null);
			
			this.settings.bindProperty(Settings.BindingDirection.IN,
				"useSoundAlert",
				"useSoundAlert",
				this.on_settings_changed,
				null);
			
			this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
				"reconnect",
				"reconnect",
				this.on_settings_changed,
				null);
			
			this.settings.bindProperty(Settings.BindingDirection.IN,
				"useSoundAlertAtBeginning",
				"useSoundAlertAtBeginning",
				this.on_settings_changed,
				null);
			
			this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
				"stopTransmission",
				"stopTransmission",
				this.on_settings_changed,
				null);
			
			this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
				"restartTransmission",
				"restartTransmission",
				this.on_settings_changed,
				null);
			
			
			// ++ Make metadata values available within applet for context menu.

			this.appletPath = metadata.path;
			//this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
			this.changelog = metadata.path + "/CHANGELOG.md";
			this.helpfile = metadata.path + "/README.md";
			this.vpnscript = metadata.path + "/scripts/vpn_status.sh";
			this.vpnon = metadata.path + "/icons/vpn-on3.png";
			this.vpnoff = metadata.path + "/icons/vpn-off2.png";
			this.vpnwait = metadata.path + "/icons/vpn-wait2.png";
			this.stoptransmissionscript = metadata.path + "/scripts/stop_transmission.sh";
			this.starttransmissionscript = metadata.path + "/scripts/start_transmission.sh";
			this.transmissionstoppedbyapplet = false ;
			
			this.homedir = GLib.get_home_dir() ;
			this.localePath = this.homedir + '/.local/share/locale';


			// Set initial value
			this.set_applet_icon_path(this.vpnwait);

			// Install Languages (from .po files)
			this.execInstallLanguage();
			
			
			// ++ Part of new l10n support
			UUID = metadata.uuid;
			this.uuid = metadata.uuid;
			Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

			this.nvidiagputemp = 0;
			this.flashFlag = true; // flag for flashing background 
			this.flashFlag2 = true; // flag for second flashing background 
			this.vpnStatus = "waiting"; // Initialise lastBatteryPercentage
			this.vpnStatusOld = "invalid";
			this.alertFlag = !this.useSoundAlertAtBeginning; // Flag says alert has been tripped to avoid repeat notifications
			
			
			this.on_orientation_changed(orientation); // Initialise for panel orientation

			this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel

			// Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
			if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.0") <= 0) {
				this.textEd = "gedit";
			} else {
				this.textEd = "xed";
			}

			// Check that all Dependencies Met by presence of sox and zenity 
			if (GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity") && GLib.find_program_in_path("nmcli") ) {
				 this.dependenciesMet = true;
			} else {
				 let icon = new St.Icon({ icon_name: 'error',
				 icon_type: St.IconType.FULLCOLOR,
				 icon_size: 36 });
				 Main.criticalNotify("Some Dependencies not Installed", "You appear to be missing some of the programs required for this applet to have all it's facilities including notifications and audible alerts .\n\nPlease read the help file on how to install them.", icon);
				 this.dependenciesMet = false;
			}

			// ++ Set up left click menu
			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			// ++ Build Context (Right Click) Menu
			this.buildContextMenu();
			this.makeMenu();

			// Make sure the temp files are created

			GLib.spawn_command_line_async('touch /tmp/.vpn_status /tmp/.vpn_name');

			// Finally setup to start the update loop for the applet display running
			if (this.displayType == "compact") {
				this.set_applet_label("");
			} else {
				this.set_applet_label("VPN");
			}
			this.set_applet_tooltip(_("Waiting"));
			this.on_settings_changed()   // This starts the MainLoop timer loop

		//} catch (e) {
		//	global.logError(e);
		//}
	},

	execInstallLanguage: function() {
		//let poPath = "~/.local/share/cinnamon/applets/vpnLookOut@claudiux/po";
		//let poDir = Gio.file_new_for_path(poPath);
		//let poList = poDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
		//GLib.spawn_command_line_async('sh -c echo "'+ poList + '" >> /tmp/poList.txt');

		
		let generatemoPath = this.appletPath + '/scripts/generate_mo.sh'; // script to generate .mo files
		let moFrPath = this.localePath + '/fr/LC_MESSAGES/vpnLookOut@claudiux.mo'
		let moFile = Gio.file_new_for_path(moFrPath);
		
		let potFrPath = this.appletPath + '/po/vpnLookOut@claudiux.pot';
		let potFile = Gio.file_new_for_path(potFrPath);
				
		if (potFile.query_exists(null)) { // .pot file exists
			if (!moFile.query_exists(null)) { // .mo file doesn't exist
				GLib.spawn_command_line_async('bash -c "' + generatemoPath + '"'); // generate all .mo files
			} else { // .mo file exists
				let potModified = potFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
				let moModified = moFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
				if (potModified > moModified) { // .pot file is most recent than .mo file
					GLib.spawn_command_line_async('bash -c "' + generatemoPath + '"'); // generate all .mo files
				}
			}
		}
	},

  
	on_orientation_changed: function (orientation) {
		this.orientation = orientation;
		if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){    
			 if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) { 
				 // vertical
				 this.isHorizontal = false;
			 } else { 
				 // horizontal
				 this.isHorizontal = true;
			 }
		 } else {
				this.isHorizontal = true;  // Do not check unless >= 3.2
		 }
	},


	// Compare two version numbers (strings) based on code by Alexey Bass (albass)
	// Takes account of many variations of version numers including cinnamon.
	versionCompare: function(left, right) {
		if (typeof left + typeof right != 'stringstring')
			return false;
		var a = left.split('.'),
			b = right.split('.'),
			i = 0,
			len = Math.max(a.length, b.length);
		for (; i < len; i++) {
			if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
				return 1;
			} else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
				return -1;
			}
		}
		return 0;
	},

	// ++ Function called when settings are changed
	on_settings_changed: function() {
		//this.slider_demo.setValue((this.alertPercentage - 10) / 30);
		if (this.displayType == "compact") {
			this.set_applet_label("");
		} else {
			this.set_applet_label("VPN");
		}
		this.checkbox_reconnect.setToggleState(this.reconnect); // in left-click menu
		this.checkbox_reconnect2.setToggleState(this.reconnect); // in right-click menu
		this.updateLoop();
	},

	// ++ Null function called when Generic (internal) Setting changed
	on_generic_changed: function() {},
	
	on_checkbox_reconnect_changed: function() {
		this.reconnect = !this.reconnect ; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
		if (this.reconnect) {
			this.button_connect.actor.hide();
			this.button_connect2.actor.hide()
		} else {
			this.button_connect.actor.show();
			this.button_connect2.actor.show()
		}
	},
	
	on_checkbox_stopTransmission_changed: function() {
		this.stopTransmission = !this.stopTransmission ; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
		this.checkbox_stopTransmission.setToggleState(this.stopTransmission); // update Left Click Menu
		this.checkbox_stopTransmission2.setToggleState(this.stopTransmission);// update Right Click Context Menu
	},
	
	on_checkbox_restartTransmission_changed: function() {
		this.restartTransmission = !this.restartTransmission ; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
		this.checkbox_restartTransmission.setToggleState(this.restartTransmission); // update Left Click Menu
		this.checkbox_restartTransmission2.setToggleState(this.restartTransmission);// update Right Click Context Menu
	},
	
	on_button_connect: function() {
		this.vpnStatus == "waiting";
		this.vpnIcon = this.vpnwait ;
		this.set_applet_icon_path(this.vpnIcon) ;
		if (this.vpnInterface != "" && this.vpnName != "") {
			if (this.vpnStatus != "on") {
				GLib.spawn_command_line_async('bash -c "/usr/bin/nmcli connection up ' + this.vpnName + '"')
			} else {
				GLib.spawn_command_line_async('bash -c "/usr/bin/nmcli connection down ' + this.vpnName + '"')
			}
		}
	},

	// ++ Build the Right Click Context Menu
	buildContextMenu: function() {
		//try {
			this._applet_context_menu.removeAll();

			this.contextmenuitemHead1 = new PopupMenu.PopupMenuItem(_("VPN Look-Out Applet"), {
				reactive: false
			});
			this._applet_context_menu.addMenuItem(this.contextmenuitemHead1);

			this.contextmenuitemInfo2 = new PopupMenu.PopupMenuItem("     " + _("Waiting for VPN interface information"), {
				reactive: false
			});
			this._applet_context_menu.addMenuItem(this.contextmenuitemInfo2);
			

			this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
			this.checkbox_reconnect2 = new PopupMenu.PopupSwitchMenuItem(_("Try to reconnect to VPN when it shuts down incidentally."), this.reconnect);
			this.checkbox_reconnect2.connect("toggled", Lang.bind(this, this.on_checkbox_reconnect_changed));
			this._applet_context_menu.addMenuItem(this.checkbox_reconnect2);

			// checkboxes Transmission
			this.checkbox_stopTransmission2 = new PopupMenu.PopupSwitchMenuItem(_("Shut down properly Transmission as soon as VPN falls."), this.stopTransmission);
			this.checkbox_stopTransmission2.connect("toggled", Lang.bind(this, this.on_checkbox_stopTransmission_changed));
			this._applet_context_menu.addMenuItem(this.checkbox_stopTransmission2);
			
			this.checkbox_restartTransmission2 = new PopupMenu.PopupSwitchMenuItem(_("Try to restart Transmission as soon as VPN restarts."), this.restartTransmission);
			this.checkbox_restartTransmission2.connect("toggled", Lang.bind(this, this.on_checkbox_restartTransmission_changed));
			this._applet_context_menu.addMenuItem(this.checkbox_restartTransmission2);
			
			this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
			// button connect/disconnect
			this.button_connect2 = new PopupMenu.PopupSwitchMenuItem(_("Connection ON/OFF"), false);
			this.button_connect2.connect("toggled", Lang.bind(this, this.on_button_connect));
			this._applet_context_menu.addMenuItem(this.button_connect2);
			// this button must appear only if auto-reconnect is inactive
			if (this.vpnInterface != "" && this.vpnName != "" && this.reconnect) {
				this.button_connect2.actor.hide()
			}
		//} catch (e) {
		//	global.logError(e);
		//}
	},

	//++ Build the Left Click Menu 
	makeMenu: function() {
		//try {
			this.menu.removeAll();

			this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("VPN Look-Out Applet"), {
				reactive: false
			});
			this.menu.addMenuItem(this.menuitemHead1);

			this.menuitemInfo2 = new PopupMenu.PopupMenuItem("     " + _("Waiting for VPN interface information"), {
				reactive: false
			});
			this.menu.addMenuItem(this.menuitemInfo2);
			
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
			// checkbox reconnect
			this.checkbox_reconnect = new PopupMenu.PopupSwitchMenuItem(_("Try to reconnect to VPN when it shuts down incidentally."), this.reconnect);
			this.checkbox_reconnect.connect("toggled", Lang.bind(this, this.on_checkbox_reconnect_changed));
			this.menu.addMenuItem(this.checkbox_reconnect);
			
			// checkboxes Transmission
			this.checkbox_stopTransmission = new PopupMenu.PopupSwitchMenuItem(_("Shut down properly Transmission as soon as VPN falls."), this.stopTransmission);
			this.checkbox_stopTransmission.connect("toggled", Lang.bind(this, this.on_checkbox_stopTransmission_changed));
			this.menu.addMenuItem(this.checkbox_stopTransmission);
			
			this.checkbox_restartTransmission = new PopupMenu.PopupSwitchMenuItem(_("Try to restart Transmission as soon as VPN restarts."), this.restartTransmission);
			this.checkbox_restartTransmission.connect("toggled", Lang.bind(this, this.on_checkbox_restartTransmission_changed));
			this.menu.addMenuItem(this.checkbox_restartTransmission);
			
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
			// button connect/disconnect
			this.button_connect = new PopupMenu.PopupSwitchMenuItem(_("Connection ON/OFF"), false);
			this.button_connect.connect("toggled", Lang.bind(this, this.on_button_connect));
			this.menu.addMenuItem(this.button_connect);
			// this button must appear only if auto-reconnect is inactive
			if (this.vpnInterface != "" && this.vpnName != "" && this.reconnect) {
				this.button_connect.actor.hide()
			}

		//} catch (e) {
		//	global.logError(e);
		//}
	},

	//++ Handler for when the applet is clicked. 
	on_applet_clicked: function(event) {
		this.updateLoop();
		this.menu.toggle();
	},

	// This updates the numerical display in the applet and in the tooltip
	updateUI: function() {

		//try {
			this.vpnStatus = GLib.file_get_contents("/tmp/.vpn_status").toString();
			if ( this.vpnStatus.trim().length > 6 ) { // this.vpnStatus string starts by 'true,'
				 this.vpnStatus = this.vpnStatus.trim().substr(5); // removing 'true,'
				 this.vpnStatusOld = this.vpnStatus;
			} else { 
				 this.vpnStatus =  this.vpnStatusOld;
			}
 

			this.vpnMessage = " " ;

			// Now select icon to display
			if (this.vpnStatus == "on") {
				this.vpnIcon = this.vpnon ;
				if (this.vpnInterface != "" && this.vpnName != "") {
					this.button_connect.setStatus(_("Click to disconnect from VPN")+' '+this.vpnName);
					this.button_connect.setToggleState(true);
					this.button_connect2.setStatus(_("Click to disconnect from VPN")+' '+this.vpnName);
					this.button_connect2.setToggleState(true)
				}
				this.alertFlag = false ;
				let vpnName = GLib.file_get_contents("/tmp/.vpn_name").toString().trim().substr(5);
				if (vpnName != "") {
					this.vpnName = vpnName
				} ;
				this.vpnMessage = _("Connected") + ' (' + this.vpnName + ')' ;
				if (this.restartTransmission && this.transmissionstoppedbyapplet) {
					command = 'sh ' + this.starttransmissionscript ;
					GLib.spawn_command_line_async(command) 
				}
			} else if (this.vpnStatus == "off") {
				this.vpnIcon = this.vpnoff ;
				this.vpnMessage = _("Disconnected") ;
				if (this.vpnInterface != "" && this.vpnName != "") {
					this.button_connect.setStatus(_("Click to connect to VPN")+' '+this.vpnName);
					this.button_connect.setToggleState(false);
					this.button_connect2.setStatus(_("Click to connect to VPN")+' '+this.vpnName);
					this.button_connect2.setToggleState(false)
				}
				if ( !this.alertFlag ) {
					if ( this.useSoundAlert ) { // Sound alert
						GLib.spawn_command_line_async('play "/usr/share/sounds/freedesktop/stereo/phone-outgoing-busy.oga"') ;
					} ;
					if ( this.reconnect ) {
						command = 'nmcli connection up ' + this.vpnName ;
						GLib.spawn_command_line_async(command)
					} ;
					if ( this.stopTransmission ) {
						command = 'sh ' + this.stoptransmissionscript ;
						this.transmissionstoppedbyapplet = GLib.spawn_command_line_async(command) ;
					} ;
					this.alertFlag = true
				}
			} else {
				this.vpnIcon = this.vpnwait ;
			}
			// set Tooltip
			this.set_applet_tooltip(_("VPN:") + " " + this.vpnMessage ) ;
			// set Icon
			this.set_applet_icon_path(this.vpnIcon) ;
			// set Menu Item Info
			this.menuitemInfo2.label.text = "    " + _("VPN:") + " " + this.vpnMessage ;
			this.contextmenuitemInfo2.label.text = "    " + _("VPN:") + " " + this.vpnMessage ;
			// Get VPN Status via asyncronous script ready for next cycle
			GLib.spawn_command_line_async('sh ' + this.vpnscript + ' ' + this.vpnInterface);

		//} catch (e) {
		//	global.logError(e);
		//}
	},

	// This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
	updateLoop: function() {
		this.updateUI();
		// Also inhibit when applet after has been removed from panel
		if (this.applet_running == true) {
			Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
		}
	},

	// ++ This finalises the settings when the applet is removed from the panel
	on_applet_removed_from_panel: function() {
		// inhibit the update timer when applet removed from panel
		this.applet_running = false;
		this.settings.finalize();
	}

};

function main(metadata, orientation, panelHeight, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
	return myApplet;
}
/*
Version   1.0.0
v32_1.0.0   Developed using code from BAMS, NUMA, Bumblebee and Timer Applets
			(Many thanks to the authors of these applets!)
			Works with Mint 18.2 and Cinnamon 3.2.
*/

