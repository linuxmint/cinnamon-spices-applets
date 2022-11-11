const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Settings = imports.ui.settings;
//const QUtils = require('./js/QUtils.js');
//const QIcon = QUtils.QIcon;
const Main = imports.ui.main;


// FOR TRANSLATION
const Gettext = imports.gettext;
const UUID = "internet-indicator@sangorys";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

var nbTry = 0;
var message="init";
var oldStderr="init";
var debug = 0;
var verbose = 0;

////////////////////////////////////////////////////////////////////////////////////////////////////
const TEMP_DIRECTORY = "/tmp";
const LOG_PATH = TEMP_DIRECTORY + "/" + UUID + ".log";

var debug = false;
var debugLevel=0;


function logifLevel(context, text, level) {
    if (level < 0) {debugLevel += level;}
    logif(context, text);
    if (level > 0) {debugLevel += level;}
}

function logif(context, text) {
    if (context)
        log(String(text));
}

function logLevel(text, level) {
    if (level < 0) {debugLevel += level;}
    log(text);
    if (level > 0) {debugLevel += level;}
}


function log(text) {
    if (debug){
        let indent=""
        //global.log(text);
        for (let i=0; i<debugLevel;i++) {indent += "  "}
        if (typeof(text) == "string")
            fileAppend(indent + text.replaceAll("\n",indent + "\n"));
        else
            fileAppend(indent + String(text));
    }
}


function logm(text) {
    if (debug){
        if (typeof(text) == "string")
        global.log(text);
        else
            global.log(String(text));
        //fileAppend(text);
    }
}


function msgbox(text) {
    if (debug){
        //global.log(text);
        ;
    }
}


function fileAppend(text) {
    //if (debug){
        try {
            let file = Gio.file_new_for_path(LOG_PATH);
            let out = file.append_to (Gio.FileCreateFlags.NONE, null);
            out.write (text, null);
            out.write ("\n", null);
            out.close(null);
        } catch(error) { global.logError(error) };
    //}
}


////////////////////////////////////////////////////////////////////////////////////////////////////
function printDebug(text) {
    if (debug == 1){
        global.log(text);
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////
function _(str) {
    return Gettext.dgettext(UUID, str);
}


////////////////////////////////////////////////////////////////////////////////////////////////////
class InternetIndicatorApplet extends Applet.TextIconApplet {


    ////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        printDebug("Start internet-indicator applet");

        this.set_applet_tooltip(_("Initializing"));
        this.set_applet_icon_name("test-internet");

        
        //this.set_applet_label("NordVPN");
        this.connected = false;
        
        this.update_interval = 5; // By default
        this.update_interval_when_no_internet = 3; // By default
        this.update_interval_when_internet = 10; // By default


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
			
            // First item:
            let item = new PopupMenu.PopupIconMenuItem("Test Internet speed", "internet", St.IconType.FULLCOLOR);

            item.connect('activate', Lang.bind(this, function() {
                           this.testInternetFree();
                         }));
            this.menu.addMenuItem(item);


            // START THE PERIODIC TASK TO CHECK INTERNET CONNECTION
            this._update_loop();
        }
        catch (e) {
          log(e);
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
    // THIS FUNCTION SHOULD BE REMOVED SOON IF NOT USED
    _new_freq(){
    	global.log(this.update_interval);
      if (this._updateLoopID) {
        Mainloop.source_remove(this._updateLoopID);
      }
      this._update_loop();
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _update_loop() {
      log("_update_loop()");
      this._send_ping();	
		this._updateLoopID = Mainloop.timeout_add(this.update_interval * 1000, Lang.bind(this, this._update_loop));
	}


    ////////////////////////////////////////////////////////////////////////////////////////////////
    _send_ping() {
        
		// INIT
    log("_send_ping()");
    let TextMessage = "";
		let [result, stdout, stderr] = ["", "", ""];
		nbTry = nbTry + 1;
		printDebug("Scan " + nbTry + " (period=" + this.update_interval + "s)");

		
    this.set_applet_icon_name("test-internet");
    this.set_applet_tooltip(_("Testing Internet connexion in progress..."));


    //////////////////////////////////////////////
    // RUN PING
    // Avoid to use spawn_command_line_sync because it freeze Linux during ping execution

    //Todo : move this gLib code to _run_cmd(command)
    let loop = GLib.MainLoop.new(null, false);


    try {

      let proc = Gio.Subprocess.new(
          //['sleep', '1'],
            ['ping', 'www.google.fr', '-c', '1', '-w', '1000'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                [, stdout, stderr] = proc.communicate_utf8_finish(res);

                if (proc.get_successful()) {
                    log(stdout);
                } else {
                    throw new Error(stderr);
                }
            } catch (e) {
                log(e);
            } finally {
                loop.quit();
            }
        });
    } catch (e) {
        log(e);
    }

    try {
      loop.run();
    } catch (e) {
      log(e);
  }
  
    //////////////////////////////////////////////
    // ANALYZE THE PING ANSWER
		//printDebug("analyse");  
		
		if (stderr == "")
		{
      TextMessage = _("Internet OK");
      this.set_applet_tooltip(TextMessage);
      this.set_applet_icon_name("internet");

      //printDebug("ping OK");  
			if (stderr.toString() != oldStderr)
			{
			  //printDebug("connected");
			  oldStderr = stderr.toString();
			  //Util.spawnCommandLine("/usr/sbin/notify-send '" + TextMessage + "'");
        Main.notify("Internet indicator", TextMessage);
			  this.update_interval = this.update_interval_when_internet;
			}
			//else {printDebug("No change : still connected");}
		}
		else
		{
			//printDebug("ping failed");  
      TextMessage = _("No Internet");
      this.set_applet_tooltip(TextMessage);
      this.set_applet_icon_name("no-internet");

      if (stderr.toString() != oldStderr)
			{
			  //printDebug("connected");
			  oldStderr = stderr.toString();
			  //Util.spawnCommandLine("/usr/sbin/notify-send '" + TextMessage + "'");
        Main.notify("Internet indicator", TextMessage);
			  this.update_interval = this.update_interval_when_no_internet;
			}
			//else {printDebug("No change : still connected");}
		}
		//printDebug("ping.end");
	}


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // WARNING : IS NEVER CALLED !!!! WHY ?
    reloadApplet() {
        let cmd = "dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'internet-indicator@sangorys' string:'APPLET'";
        printDebug(cmd);
        Util.spawnCommandLine(cmd);
    }


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // NOT USED YET. FOR FUTURE USAGE
    testInternetFree() {
        
		// INIT
		let [result, stdout, stderr] = ["", "", ""];
		printDebug("testInternetFree ");


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
