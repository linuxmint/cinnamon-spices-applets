const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const QUtils = require('./js/QUtils.js');
const QIcon = QUtils.QIcon;


const UUID = "internet-indicator@sangorys";

var nbTry = 0;
var message="init";
var oldStderr="init";
var debug = 1;
var verbose = 0;


// pull: https://github.com/linuxmint/cinnamon-spices-applets


////////////////////////////////////////////////////////////////////////////////////////////////////
function printDebug(text) {
    if (debug == 1){
        global.logError(text);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
class InternetIndicatorApplet extends Applet.TextIconApplet {


    ////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        printDebug("Start applet (Cyril)");

        //this.set_applet_icon_name("internet");
        this.set_applet_tooltip(_("Is Internet connected ?"));
        //this.set_applet_label("NordVPN");
        this.connected = false;
        
		this.update_interval = 5; // By default
		this.update_interval_when_no_internet = 3; // By default
		this.update_interval_when_internet = 10; // By default

		//Util.spawnCommandLine("/usr/sbin/notify-send Applet Start"); //OK

        // Reload BTN
        /*let reload_btn = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), 'view-refresh-symbolic', QIcon.SYMBOLIC, {hover: true});
        reload_btn.connect('activate', this.reloadApplet.bind(this));
        this._applet_context_menu.addMenuItem(reload_btn);*/
        // this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        try {

            // READ SETTINGS
            /* Initialize your settings handler instance      this,            the uuid              instance id  */
            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval-when-no-internet", "update_interval_when_no_internet", this.set_update_interval_when_no_internet, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval-when-internet", "update_interval_when_internet", this.set_update_interval_when_internet, null);


            // Create the popup menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);
			
            /*// First item:
            let item = new PopupMenu.PopupIconMenuItem("Test Internet speed", "internet", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           this.testInternetFree();
                         }));
            this.menu.addMenuItem(item);


            // 2nd item:
            item = new PopupMenu.PopupIconMenuItem("Test 2", "no-internet", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           //Util.spawnCommandLine("nordvpn connect --group p2p");
                           //Util.spawnCommandLine("/usr/sbin/notify-send test on"); //OK
                           this._send_ping();	
                         }));
            this.menu.addMenuItem(item);*/r


            // START THE PERIODIC TASK TO CHECK INTERNET CONNECTION
			this._update_loop();
		}
		catch (e) {
			global.logError(e);
		}

    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    on_applet_clicked() {

        this.menu.toggle();
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    on_applet_removed_from_panel() {
		if (this._updateLoopID) {
			Mainloop.source_remove(this._updateLoopID);
		}
	}


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _run_cmd(command) {
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
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // CALLBACK WHEN SETTINGS ARE CHANGED => WARNING THIS CALLBACK IS NEVER CALLED WHEN THE CONFIG IS CHANGED
    set_update_interval_when_no_internet(){
    	global.log("update_interval_when_no_internet=" + this.update_interval_when_no_internet);
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // CALLBACK WHEN SETTINGS ARE CHANGED => WARNING THIS CALLBACK IS NEVER CALLED WHEN THE CONFIG IS CHANGED
    set_update_interval_when_no_internet(){
    	global.log("update_interval_when_ninternet=" + this.update_interval_when_internet);
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _new_freq(){
    	global.log(this.update_interval);
        if (this._updateLoopID) {
			Mainloop.source_remove(this._updateLoopID);
		}
        this._update_loop();
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _get_status(){
        let status = this._run_cmd("nordvpn status");
        let result = status.split("\n")[0].split(": ")[1];
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
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _update_loop() {
		this._send_ping();	
		//Util.spawnCommandLine("/usr/sbin/notify-send Applet '" + this.update_interval + "'"); //OK
		//global.logError(this.update_interval);
		this._updateLoopID = Mainloop.timeout_add(this.update_interval * 1000, Lang.bind(this, this._update_loop));
	}


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _send_ping() {
        
		// INIT
		let [result, stdout, stderr] = ["", "", ""];
		nbTry = nbTry + 1;
		//Util.spawnCommandLine("/usr/sbin/notify-send Applet 'Scan " + nbTry + "'");
		printDebug("Scan " + nbTry + " (period=" + this.update_interval + "s)");

		
        //////////////////////////////////////////////
        // RUN PING
		try {
			[result, stdout, stderr] = GLib.spawn_command_line_sync("ping www.google.fr -c 1 -w 1000");
			//printDebug("result=" + result);
			//printDebug("stderr=" + stderr);
			//printDebug("stdout=" + stdout);
			//printDebug("oldStderr=" + oldStderr);
		  }
		catch (e) {
			global.logError(e);
		}
		
        
        //////////////////////////////////////////////
        // ANALYZE THE PING ANSWER
		//global.logError("analyse");  
		//global.logError(stdout.toString());  
		//global.logError(stderr.toString().length);
		
		if (stderr == "")
		{
			//global.logError("ping OK");  
			if (stderr.toString() != oldStderr)
			{
			  //global.logError("connecté");
			  oldStderr = stderr.toString();
			  Util.spawnCommandLine("/usr/sbin/notify-send 'Internet OK'");
              this.set_applet_tooltip(_("Internet is connected :)"));
			  this.update_interval = this.update_interval_when_internet;
			  this.set_applet_icon_name("internet");
			}
			//else {global.logError("Pas de changement : connecté");}
		}
		else
		{
			//global.logError("ping failed");  
			if (stderr.toString() != oldStderr)
			{
			  //global.logError("déconnecté");
			  oldStderr = stderr.toString();
			  Util.spawnCommandLine("/usr/sbin/notify-send 'Pas d internet'");
              this.set_applet_tooltip(_("No Internet  :("));
			  this.update_interval = this.update_interval_when_no_internet;
			  this.set_applet_icon_name("no-internet");
			}
			//else {global.logError("Pas de changement : déconnecté");}
		}
		//global.logError("ping.fin");
	}


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // WARNING : IS NEVER CALLED !!!!
    reloadApplet() {
        let cmd = `dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'${this.metadata.uuid}' string:'APPLET'`;
        global.logError(cmd);
        Util.spawnCommandLine(cmd);
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    testInternetFree() {
        
		// INIT
		let [result, stdout, stderr] = ["", "", ""];
		global.logError("testInternetFree ");


        //////////////////////////////////////////////
        // RUN PING
		try {
			[result, stdout, stderr] = GLib.spawn_command_line_sync("wget -O /dev/null http://test-debit.free.fr/1048576.rnd");
			//printDebug("result=" + result);
			//printDebug("stderr=" + stderr);
			printDebug("stdout=" + stdout);
			//printDebug("oldStderr=" + oldStderr);
		  }
		catch (e) {
			global.logError(e);
		}
		
	}
        
}


////////////////////////////////////////////////////////////////////////////////////////////////////
function main(metadata, orientation, panel_height, instance_id) {  // Make sure you collect and pass on instanceId
    return new InternetIndicatorApplet(orientation, panel_height, instance_id);
}
