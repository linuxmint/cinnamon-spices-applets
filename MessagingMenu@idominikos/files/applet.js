const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gvc = imports.gi.Gvc;
const Main = imports.ui.main;
const Util = imports.misc.util;
const ModalDialog = imports.ui.modalDialog;



/* global values */
let icon_path = "/usr/share/cinnamon/theme/";
let compatible_Apps = [ "skype" , "pidgin", "empathy", "xchat", "kmess", "gajim", "emesene", "qutim", "amsn", "openfetion", "gwibber", "qwit", "turpial", "birdie", "pino", "fbmessenger" ];
let compatible_Emails = [ "evolution", "postler" ]
let geary = [ "geary" ]
let thunderbird = [ "thunderbird" ]
let kmail = [ "KMail2" ]
let claws = [ "claws-mail" ]

const ICON_SIZE = 28;



function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({icon_name: icon});
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },    

setText: function(text) {
        this.text.text = text;
    },



    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },

    // retrieve an icon image
    _getIconImage: function(icon_name) {
         let icon_file = icon_path + icon_name + ".svg";
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();
 
         return St.TextureCache.get_default().load_uri_sync(1, icon_uri, 16, 16);
    },
}



function MessengerLauncher(app, menu) {
    this._init(app, menu);
}

//How the Menu Entries apear.
MessengerLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (app, menu) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._app = app;
        this._menu = menu;
	
		//Icon for the entries.
        	this.label = new St.Label({ text: app.get_name() });
        this.addActor(this.label);
	this._icon = app.create_icon_texture(ICON_SIZE);
        this.addActor(this._icon);
       	//Label for the entries.
    },

    activate: function (event) {
    	this._menu.actor.hide();
        this._app.activate_full(-1, event.get_time());        
        return true;
    }

};

//The actual Applet Menu, deciding the icon and what not, and more.
function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {                                
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                       

            this.set_applet_icon_symbolic_name('mail-unread-symbolic');
            this._messengers = {};
            this._showFixedElements();           
}

        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
  

    
//Needed for the rest to work.
 _nbMessengers: function() {
        return Object.keys(this._messengers).length;
    },

    _showFixedElements: function() {  //fixed Elements (The Apps)

//setting up basic "symbols".       
        if (this._nbMessengers()==0){
        	this._availableApps = new Array();
		this._availableEmails = new Array ();
		this._ifthunderbirdisavailable = new Array ();
		this._availableGeary = new Array ();
		this._ifkmailisavailable = new Array ();
		this._availableClaws = new Array ();
            let appsys = Cinnamon.AppSystem.get_default();
            let allApps = appsys.get_all();
            let listedDesktopFiles = new Array();
            for (let y=0; y<allApps.length; y++) {
            	let app = allApps[y];
            	let entry = app.get_tree_entry();
            	let path = entry.get_desktop_file_path();


//Get Application Desktop Files            	
	for (var p=0; p<compatible_Apps.length; p++) {
                    let desktopFile = compatible_Apps[p]+".desktop";
            		if (path.indexOf(desktopFile) != -1 && listedDesktopFiles.indexOf(desktopFile) == -1) {            		
                		this._availableApps.push(app);
                        listedDesktopFiles.push(desktopFile);
            		}
           		}  
//Get Email Desktop Files    
               for (var p=0; p<compatible_Emails.length; p++) {
                    let desktopFile2 = compatible_Emails[p]+".desktop";
            		if (path.indexOf(desktopFile2) != -1 && listedDesktopFiles.indexOf(desktopFile2) == -1) {            		
                		this._availableEmails.push(app);
                        listedDesktopFiles.push(desktopFile2);
            		}
           		}  
//Get Claws Desktop file
               for (var p=0; p<geary.length; p++) {
                    let desktopFile7 = geary[p]+".desktop";
            		if (path.indexOf(desktopFile7) != -1 && listedDesktopFiles.indexOf(desktopFile7) == -1) {            		
                		this._availableGeary.push(app);
                        listedDesktopFiles.push(desktopFile7);
            		}
           		}   
//Get thunderbird Desktop file
              for (var p=0; p<thunderbird.length; p++) {
                    let thunderbirdFile = thunderbird[p]+".desktop";
            		if (path.indexOf(thunderbirdFile) != -1 && listedDesktopFiles.indexOf(thunderbirdFile) == -1) {            		
                		this._ifthunderbirdisavailable.push(app);
                        listedDesktopFiles.push(thunderbirdFile);
            		}
           		}
//Get kmail Desktop file 
               for (var p=0; p<kmail.length; p++) {
                    let desktopFile5 = kmail[p]+".desktop";
            		if (path.indexOf(desktopFile5) != -1 && listedDesktopFiles.indexOf(desktopFile5) == -1) {            		
                		this._ifkmailisavailable.push(app);
                        listedDesktopFiles.push(desktopFile5);
            		}
           		}  
//Get Claws Desktop file
               for (var p=0; p<claws.length; p++) {
                    let desktopFile6 = claws[p]+".desktop";
            		if (path.indexOf(desktopFile6) != -1 && listedDesktopFiles.indexOf(desktopFile6) == -1) {            		
                		this._availableClaws.push(app);
                        listedDesktopFiles.push(desktopFile6);
            		}
           		}   



}  //ends if Nbmessengers.    	        
                       
            } //ends something else
//Adding Simple Application Menus!           
	if (this._availableApps.length > 0){

                for (var p=0; p<this._availableApps.length; p++){
                    let playerApp = this._availableApps[p];
                    let menuItem = new MessengerLauncher(playerApp, this.menu);
                    this.menu.addMenuItem(menuItem);
                

}
}

//Adding simple EMAIL Menus!
	    if (this._availableEmails.length > 0){
                
                for (var p=0; p<this._availableEmails.length; p++){
                    let emailApp = this._availableEmails[p];
                    let emailItem = new MessengerLauncher(emailApp, this.menu);
                    this.menu.addMenuItem(emailItem);
		}
}
//Adding geary Menu!
	    if (this._availableGeary.length > 0){
                
                for (var p=0; p<this._availableGeary.length; p++){
                    let gearyApp = this._availableGeary[p];
                    let gearyItem = new MessengerLauncher(gearyApp, this.menu);
                    this.menu.addMenuItem(gearyItem);
		
		//geary "Compose New Message..." 
		 this.menu.addAction(_("	Compose New Message..."), function(event) {
                Util.spawnCommandLine("geary mailto:");
            });
} 
//Ending geary Menu.

 //Adding Thunderbird Menu!
	    if (this._ifthunderbirdisavailable.length > 0){
                
                for (var p=0; p<this._ifthunderbirdisavailable.length; p++){
                    let thunderbirdApp = this._ifthunderbirdisavailable[p];
                    let thunderbirdItem = new MessengerLauncher(thunderbirdApp, this.menu);
                    this.menu.addMenuItem(thunderbirdItem);
		
		//Thunderbird "Compose New Message..." 
 this.menu.addAction(_("	Compose New Message..."), function(event) {
                Util.spawnCommandLine("thunderbird -compose");
            });
		//Thunderbird "Contacts"
		 this.menu.addAction(_("	Contacts"), function(event) {
                Util.spawnCommandLine("thunderbird -addressbook");
            });
} //Ending Thunderbird Menu.



//Adding kmail Menu!
	    if (this._ifkmailisavailable.length > 0){
                
                for (var p=0; p<this._ifkmailisavailable.length; p++){
                    let kmailApp = this._ifkmailisavailable[p];
                    let kmailItem = new MessengerLauncher(kmailApp, this.menu);
                    this.menu.addMenuItem(kmailItem);
		
		//kmail "Compose New Message..." 
		 this.menu.addAction(_("	Compose New Message..."), function(event) {
                Util.spawnCommandLine("kmail -compose");
            });
} //Ending kmail Menu.



//Adding claws Menu!
	    if (this._availableClaws.length > 0){
                
                for (var p=0; p<this._availableClaws.length; p++){
                    let clawsApp = this._availableClaws[p];
                    let clawsItem = new MessengerLauncher(clawsApp, this.menu);
                    this.menu.addMenuItem(clawsItem);
		
		//kmail "Compose New Message..." 
		 this.menu.addAction(_("	Compose New Message..."), function(event) {
                Util.spawnCommandLine("claws-mail --compose");
            });
} //Ending claws Menu.


} // AND MORE
} // AND MORE
} // AND MORE
}; // AND MORE
}
     
};//AND MORE

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
} // Ending main.
