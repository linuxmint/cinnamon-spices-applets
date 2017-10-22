// This is my first attempt to coding at all, so please do not
// expect beautilful code here...
// As suggested I read through other applets and got some ideas
// here and there, comments are heartly welcome.
// Andreas


// First, we need to import some Libs:
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "stocks@adonut";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

const AppletDir = imports.ui.appletManager.appletMeta['stocks@adonut'].path;
// for repeated updating:
const Mainloop = imports.mainloop;
// for URL-IO-Operations:
const Gio = imports.gi.Gio;
// initialize currency:
var cur = "";
// initialize icon for change:
let ChIcon =""
// Find out where curl is (only needed if get_curl_stocks is used)
// var curl = get_curl();


// var comparray = ["INDEX:DAX","FRA:QGEN","FRA:DTE","MCX:GAZP","QGEN","LON:BP","TYO:9437"];
// var comparray = read_file();
// ["FRA:QGEN","FRA:DTE","QGEN"];
var comparray = read_file();


function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
	
	_init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
   		try {
			// Set the Tooltip-Text
			this.set_applet_tooltip(_("Stocks"));
			// Get the stocks update
			this.update_stocks();                                    
		}
        catch (e) {
        	global.logError(e);
        }		
	},
    // Do nothing, when clicked
	on_applet_clicked: function(event) {

	},
	// The 
    update_stocks: function() {   
		// rotate the list of stocks 
    	var temp = comparray.shift();
   		comparray.push( temp )
   		let company = comparray[0]; 
   		
		// render the values onto the applet 
		this.set_applet_label(get_stocks(company));

		// render the change icon onto the applet
		this.set_applet_icon_path(AppletDir + ChIcon);
   		
      	//update every X seconds
		Mainloop.timeout_add(5000, Lang.bind(this, this.update_stocks));
	},
};

function get_stocks(company) {
	let urlcatch = Gio.file_new_for_uri('http://www.google.com/finance/info?q='+company);
	let loaded = false;
	
	try {
		loaded=urlcatch.load_contents(null)[0]
	} 
	catch (err) {
		ChIcon = "";
		return _("Invalid Stock?:") + " "+company; 
	}		
	
	if (loaded ===true) {
		// load the complete result from http-GET into str
		let str = (urlcatch.load_contents(null)[1]);

		// prepare the array
		// Since google uses crappy Windows Codepage 1252 encoding,
		// whe need to filter and replace for "€" and "¥" (128 / 165) in the urlcatch[1]oject
		// if we don't, the whole thing will break
  		for (var i=0; i<str.length;i++) {
			// If found - replace with "E" for Euro and "Y" for Yen
			if (str[i]==128) {
				str[i]=69;
			}
			if  (str[i]==165) {
				str[i]=89;
			}
		}
		// now finally create a string array 
		let valuelist = (str).toString();
		let j = JSON.parse(valuelist.slice(6,-2));
		// set the currency symbol depending on the exchange
		// more to come...
		switch (j['e']) {
			case "MCX":
			cur = "RUB";
			break;
			case "ETR":
			cur = "\u20AC";
			break;
			case "FRA":
			cur = "\u20AC";
			break;
			case "NASDAQ":
			cur = "$";
			break;
			case "LON":
			cur = "\u00A3";
			break;
			case "TYO":
			cur = "\u00A5";
			break;
			// default to no currency
			default:
			cur = "";
		} 
		// Build the final output for the Applet label
	    MyStock = j['t']+": "+cur+j['l_fix']+"("+j['cp']+"%)";
		
		// Set the change icon:
		if ( parseFloat(j['cp']) > 0)
			ChIcon = "/icons/up.svg";
		if ( parseFloat(j['cp']) < 0)
			ChIcon = "/icons/down.svg";
		if ( parseFloat(j['cp']) == 0) 
			ChIcon = "/icons/eq.svg";		
	}
	else {
		MyStock = "not loaded";
	}
	return MyStock ;
}

function read_file() {
    	this.file = AppletDir + '/stocks.list';
		if (GLib.file_test(this.file, GLib.FileTest.EXISTS)) {
		//	let content = Shell.get_file_contents_utf8_sync(this.file);
			let content = GLib.file_get_contents(this.file)
			let stocklist =content.toString().split('\n').slice(0,-1);
			// get rid of "true," in the first field
			stocklist[0] = stocklist[0].replace("true,", "");
			// 
			return stocklist;
		} 
		else {
			return ['No Companies defined in: ' + this.file]
		}
}	

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
	
	
	
/*
15:35	mtwebsterstfu	for 2, you can just add a style to the actor
15:35	mtwebsterstfu	that defines color:
15:37	mtwebsterstfu	actor.set_style('color: red;') or maybe ('color: ' + this.color + ';')
15:37	mtwebsterstfu	or you can supply a stylesheet.css with your applet that defines style classes
15:37	mtwebsterstfu	and you can add/remove classes to an actor on the fly
15:37	mtwebsterstfu	if you place a stylesheet in your applet's folder, it'll be automatically added to the system theme so your applet can access it
15:38	mtwebsterstfu	for the first thing, you may have to play around with GLib.uri_escape_string() or something to make it valid
*/

	
	




/*old stuff:




function get_curl(){
     let ret = GLib.spawn_command_line_sync("which curl");
     if ( (ret[0]) && (ret[3] == 0) ) {//if yes
     	return ret[1].toString().split("\n", 1)[0];//find the path to curl
       	}
        return null;
}

function get_curl_stocks(company){
	if (curl==null) {
		return "please install curl";
	}
	let urlcatch = GLib.spawn_command_line_sync(curl+" http://www.google.com/finance/info?q="+company);
	if (urlcatch[0]==true) {
	let str = urlcatch[1];
	for (var i=0; i<str.length;i++) {
		// If found - replace it with E for Euro and Y for Yen
		if (str[i]==128) {
			str[i]=69;
		}
		if (str[i]==165) {
			str[i]=89;
		}
	}
	let valuelist = (str).toString();
	let j = JSON.parse(valuelist.slice(6,-2));
	// set the currency symbol depended on the exchange
	switch (j['e']) {
		case "MCX":
			cur = "RUB";
		break;
		case "ETR":
			cur = "\u20AC";
		break;
		case "FRA":
			cur = "\u20AC";
		break;
		case "NASDAQ":
			cur = "$";
		break;
		case "LON":
			cur = "\u00A3";
		break;
		case "TYO":
			cur = "\u00A5";
		break;
		default:
		// default to no currency sing
		cur = "";
	}
	// Set the change icon:
	if ( parseFloat(j['cp']) > 0)
		ChIcon = "/icons/up.svg";
	if ( parseFloat(j['cp']) < 0)
		ChIcon = "/icons/down.svg";
	if ( parseFloat(j['cp']) == 0) 
		ChIcon = "/icons/eq.svg";		
	
	return j['t']+": "+cur+j['l_fix']+"("+j['cp']+"%)";
	}
	return "Error_getting_URL";	
}




*/ 











