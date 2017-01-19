const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

function Settings() {
    this._init();
}

Settings.prototype = {
    _init: function() {
    	print("Initialisation Settings");
    	try{
    		//settings file name store in the first argument
			this.settingsFile = ARGV[0];
			
			//load the settings window from the glade file
	        this.builder = new Gtk.Builder();
	        this.builder.add_from_file("settings.glade");
	
	        this.window = this.builder.get_object("dialog");
	        this.window.connect("destroy", Gtk.main_quit);
	        
	        //connect the click on save and cancel to methods
			this.builder.get_object("btSave").connect("clicked", Lang.bind(this, this.save));
	        this.builder.get_object("btCancel").connect("clicked", Lang.bind(this, this.close));
	        
	        //put the inputs in variables 
	        this.inputUserID = this.builder.get_object("inputUserID");
	        this.inputKeyID = this.builder.get_object("inputKeyID");
	        this.chkSendNotification = this.builder.get_object("chkSendNotification");
       }
       catch(e){
       		print(e);
       }
        print("FIN Initialisation Settigns");
    },
    
    /**
     * Method calls when click on save button 
     */
    save: function() {
    	//get the inputs values and save them in settings object
		this.settings.userID = this.inputUserID.get_text();
        this.settings.keyID = this.inputKeyID.get_text();
        this.settings.sendNotification = this.chkSendNotification.get_active();
        
        //save the settings in the file
        this.saveSettings();
        
        //check if the settings are corrects
        if(this.checkSettings()){
        	//if they are, we close the settings window
        	this.close();	
        }
	},
	
	/**
	 * Close the settings window
	 */
	close: function() {
		this.window.destroy();
	},
	
	/**
	 * Load the settings from the file
	 */
	loadSettings: function() {
		try {
			//read the settings file
			let file = Gio.file_new_for_path(this.settingsFile);
			[success, jsonString, tag] = file.load_contents(null);
			
			//load the settings in an object
			this.settings = JSON.parse(jsonString);
			
			//bind the settings values from the file in the inputs
			this.inputUserID.set_text(this.settings.userID);
			this.inputKeyID.set_text(this.settings.keyID);
			this.chkSendNotification.set_active(this.settings.sendNotification);
			
			return true;
		} catch(e) {
			print(e);
			errorMessage = new Gtk.MessageDialog({title: "Error loading settings", buttons: Gtk.ButtonsType.OK, text: e+""});
			errorMessage.run();
			return false;
		}
	},
	
	/**
	 * Load the settings in the file
	 */
	saveSettings: function() {
		try {
			let file = Gio.file_new_for_path(this.settingsFile);
			file.replace_contents(JSON.stringify(this.settings), null, false, 0, null);
		} catch(e) {
			print(e);
			errorMessage = new Gtk.MessageDialog({title: "Error saving settings", buttons: Gtk.ButtonsType.OK, text: e+""});
			errorMessage.run();
		}
	},
	
	/**
	 * Check if the settings are corrects
	 * To do that, we check if a request to habitRPG with the userId and keyId responds OK 
	 */
	checkSettings: function(){
		//prepare the command to send a HTTP request to HabitRPG with the new settings
		let command = 'curl -X GET -H "x-api-key:'+this.settings.keyID+'" -H "x-api-user:'+this.settings.userID+'" '+this.settings.baseUrl+'user/';
		print(command);
		[status, stdout, stderr] = GLib.spawn_command_line_sync(command);
		this.result = JSON.parse(stdout);
		
		//check if the result is OK
		if(this.result == null || this.result.err){
			let errorMsg = (this.result == null) ? "Settings Error" : this.result.err
			errorMessage = new Gtk.MessageDialog({title: "Settings Error", buttons: Gtk.ButtonsType.NONE, 
													message_type: Gtk.MessageType.ERROR, text: errorMsg});
			errorMessage.run();
			return false;
		}
		return true;
	}
}


Gtk.init(null);
let settings = new Settings();
let ok = settings.loadSettings();
if(ok) {
	settings.window.show_all();
	Gtk.main();
}
