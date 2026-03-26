// Turns a simple text file based todo list into a ticker on your panel.
// Author: Thomas Scott
// Based on Andreas' stock ticker app here:http://cinnamon-spices.linuxmint.com/applets/view/187


// First, we need to import some Libs:
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const AppletDir = imports.ui.appletManager.appletMeta['todo@threefi'].path;
const Settings = imports.ui.settings;
// for repeated updating:
const Mainloop = imports.mainloop;
// Translation support
const Gettext = imports.gettext;
const UUID = "todo@threefi";

const emptyTodoListMessage = '---';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// debug flag
var debug=false;

// in play vars
var currItem=0;
var windowPos=0;
var currTime=0;
var totalTime=0;

var tickerMessage;


function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
	
	_init: function(orientation,instanceId) {        

		// bind settings
		this._preferences = {};
		this.settings = new Settings.AppletSettings(this._preferences, "todo@threefi", instanceId);

		this.settings.bindProperty(Settings.BindingDirection.IN,
                         "text_width",
                         "text_width",
                         this.on_settings_changed,
                         null);

		this.settings.bindProperty(Settings.BindingDirection.IN,
                         "lead_trail_time",
                         "lead_trail_time",
                         this.on_settings_changed,
                         null);

		this.settings.bindProperty(Settings.BindingDirection.IN,
                         "list_editor",
                         "list_editor",
                         this.on_settings_changed,
                         null);

		this.settings.bindProperty(Settings.BindingDirection.IN,
                         "important_color",
                         "important_color",
                         this.on_settings_changed,
                         null);

	        Applet.TextIconApplet.prototype._init.call(this, orientation);
   		try {
			// Set the Tooltip-Text
			this.set_applet_tooltip(_("Click to edit the list"));
			// Get the todo list update
			this.update_todolist();                                    
		}
        	catch (e) {
        		global.logError(e);
        	}		
	},
	
	// Openthe todo list when clicked
	on_applet_clicked: function(event) {
		Util.spawnCommandLine(this._preferences.list_editor + " " + AppletDir + '/todo.list');
	},
	
	update_todolist: function() {   

		// move to the next item
		if(currTime >= totalTime)
		{
			let list = [];

			// grab the file contents 
			// TODO check whether file is updated rather than grabbing every time)
		    	this.file = AppletDir + '/todo.list';
			if (GLib.file_test(this.file, GLib.FileTest.EXISTS)) {
				let content = GLib.file_get_contents(this.file)

				let isReadSuccessful = content[0];
				if (isReadSuccessful){
					list = content[1].toString().split('\n').filter(val => !(typeof val == 'undefined' || val.substring(0,1) == "#" || val == ""));
				}
			}

			if (list.length > 0) {
				tickerMessage = list[currItem]
			} else {
				tickerMessage = emptyTodoListMessage;
			}

			currItem++;
			if (currItem >= list.length) {
				currItem = 0;
			}

			currTime=0;
			windowPos=0;

			// work out the display time for the item
			// if scrolling then the scroll time should be added
			totalTime=tickerMessage.length + (this._preferences.lead_trail_time*2) - this._preferences.text_width;
			
			// if not scrolling just use twice the time out (once for lead in once for lead out)
			if(totalTime<this._preferences.lead_trail_time*2)
			{	
				totalTime=this._preferences.lead_trail_time*2;
			}
		}

		// if scrolling is necessary then scroll
		if(windowPos < totalTime && currTime > this._preferences.lead_trail_time && windowPos+this._preferences.text_width < tickerMessage.length)
		{
			windowPos++;
		}

		// increment the time displayed for
		currTime++;

		// build debug data
		var debugString = "currItem=" + currItem + ":currTime=" + currTime + ":totalTime=" + totalTime;

		// add formatting if important item
		if(tickerMessage.substring(0,3)=="***")
		{
			this.actor.style = "background-color:" + this._preferences.important_color;
		}else{
	 		this.actor.style = "";
		}

		// render the values onto the applet 
		this.set_applet_label(tickerMessage.substring(windowPos,windowPos+this._preferences.text_width) + (debug?debugString:""));

	      	//update every X seconds
		Mainloop.timeout_add(300, Lang.bind(this, this.update_todolist));
	},
};

function main(metadata, orientation, panel_height, instanceId) {  
    let myApplet = new MyApplet(orientation,instanceId);
    return myApplet;      
}
