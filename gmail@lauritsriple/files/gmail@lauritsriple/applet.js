const APPLET_PATH = imports.ui.appletManager.appletMeta["gmail@lauritsriple"].path;
imports.searchPath.push(APPLET_PATH);
const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Logger=imports.log_util;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const UUID = "gmail@lauritsriple";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MailItem() {
    this._init.apply(this, arguments);
}

MailItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(title,author,email,summary,link) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, { reactive: true ,hover:false});

	this.link=link
    this._box = new St.BoxLayout({ style_class: 'popup-device-menu-item' });
    this._vbox = new St.BoxLayout({ style_class: 'popup-device-menu-item', vertical: true});

    this.label = new St.Label({ text: "%s".format(title) });
    let testlabel = new St.Label({ text: "%s (%s)".format(author,email) ,style_class:'popup-inactive-menu-item'});
    let statusLabel = new St.Label({ text: "%s".format(summary), style_class: 'popup-inactive-menu-item' });

    this._box.add_actor(this.label);
    this._vbox.add_actor(this._box);
	this._vbox.add_actor(testlabel);
    this._vbox.add_actor(statusLabel);

    this.addActor(this._vbox);

    },
    activate: function(event, keepMenu){
		Util.spawnCommandLine("xdg-open "+this.link);
		this.emit('activate', event, true); // keepMenu=True, prevents menu from closing
    }

}

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}


MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
    	Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

		this.oldUsername="";
		this.getJsonFeedTimeout=0;
		this.timerId=0;
    	this.metadata = metadata;
		this.numUnread=0;

		//Settings
   	    this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
		this.settings.bindProperty(Settings.BindingDirection.IN,"settings-username","username",this.on_settings_changed,null);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,"settings-password","password",this.on_settings_changed,null);
		//Set old username to the username in the config
		this.oldUsername=this.username

		//Enable logger
		this.logger=new Logger.Logger({
			uuid:metadata.uuid,
			verbose:"enable-verbose-logging"
		});

		//Tooltip and icon on panel
   	    this.set_applet_tooltip(_("No new mail"));
   	    this.set_applet_icon_symbolic_name('mail-read-symbolic');
		this.set_applet_label("?");

		//Initialize menu
		this.menuItems={};
   	    this.menuManager = new PopupMenu.PopupMenuManager(this);
   	    this.menu = new Applet.AppletPopupMenu(this, orientation);
   	    this.menuManager.addMenu(this.menu);

		//Init functions
		this.getJsonFeed();
		this.ticker();

    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_settings_changed:function(){
    	//Do nothing
    },
    on_settings_save:function(){
    	//Crypt password with pythonscript
		if ((this.oldUsername!=this.username) && (this.password!="Crypted")){
			//Try to delete old password
			Util.spawn_async(['python3',APPLET_PATH+'/removeCredentials.py',this.oldUsername],Lang.bind(this,function(){
				this.oldUsername=this.username
			}));
		}
		//Util.spawn_async(['python3',APPLETPATH+'/storeCredentials.py',this.username,this.password]);
		if(this.password!="Crypted"){
    		Util.spawn_async(['python3',APPLET_PATH+'/storeCredentials.py',this.username,this.password],Lang.bind(this,function(response){
			this.password="Crypted";
			}));
		}
    },

    processJsonFeed: function(response){
    	let data=JSON.parse(response);
		//this.logger.debug("ProcessJsonFeed is called");
		if (("error" in data) | (data==null)){
			this.menu.removeAll();
			this.set_applet_tooltip(_("Something went wrong"));
			this.set_applet_label("?");
			this.set_applet_icon_symbolic_name('mail-read-symbolic');
			let item = new MailItem(_("INFO: Install python libaries from terminal"),_("How To"),_("guide"),_("You need pip3:") + " 'sudo apt-get install pip3'\n" + _("You need python-feedparser:") + " 'sudo pip3 install feedparser'\n" + _("You need python keyring and python keyring-alt:") + " 'sudo pip3 install keyring' " + _("and") + " 'sudo pip3 install keyrings-alt'");
			this.menu.addMenuItem(item,0);
			item = new MailItem(_("INFO: Are you getting this message? You should not!"),_("ERROR"),_("ERROR"),_("Check internet connection\nInstall the needed python libaries\nConfigure password correctly"));
			this.menu.addMenuItem(item,0);
			if ("error" in data){
				item = new MailItem(_("ERROR: Error from json parser"),_(data.error),"https://github.com/linuxmint/cinnamon-spices-applets/tree/master/gmail%40lauritsriple",_(data.info),"https://github.com/linuxmint/cinnamon-spices-applets/tree/master/gmail%40lauritsriple");
				this.menu.addMenuItem(item,0);
			}
			return
		}
		//Get number of unread, and set icon and tooltip accordingly
		var numUnreadInFeed=parseInt(data.unreadCount,10);

		//How many of the mails in the feed is actually new from last time we checked?
		var numMailsToShowNotification=numUnreadInFeed-this.numUnread;
		if (numMailsToShowNotification>3){
			numMailsToShowNotification=3;
		}
		this.numUnread=numUnreadInFeed;

		//Show notifications
		for (var i = data.entries.length-1; i>=(data.entries.length-numMailsToShowNotification); --i){
			Util.spawnCommandLine("notify-send --icon=mail-unread \""+data.entries[i].author+"\" \""+data.entries[i].title+"\"");
		}

		//Set applet icon and tooltip
		if (numUnreadInFeed>0){
			if (numUnreadInFeed<2){
    	    	this.set_applet_tooltip(_("New mail"));
			} else{
				this.set_applet_tooltip(_("New mails"));
			}
			this.set_applet_label(data.unreadCount);
			this.set_applet_icon_symbolic_name('mail-unread-symbolic');
		} else{
			this.menu.removeAll();
			this.set_applet_label("0");
    	   	this.set_applet_tooltip(_("No new mail"));
			this.set_applet_icon_symbolic_name('mail-read-symbolic');
			let item = new MailItem(_("No new mails"),_("Have a nice day")," ͡° ͜ʖ ͡°","","");
			this.menu.addMenuItem(item,0);
			return;
		}

		//Create the dropdown menu
		this.menuItems={};
		this.menu.removeAll();
		var numMailsToShowInPopup=10;
		if (data.entries.length<numMailsToShowInPopup){
			numMailsToShowInPopup=data.entries.length;
		}
		var index=0;
		//this.logger.debug("Before loop");
		for(var i = data.entries.length-numMailsToShowInPopup; i<data.entries.length;++i){
			//this.logger.debug("inside loop");
			var mail = data.entries[i];
			let item = new MailItem(mail.title,mail.author,mail.email,mail.summary,mail.link);
			item.connect('activate',Lang.bind(this, this.launchClient));
			this.menu.addMenuItem(item,0);
			this.menuItems[index]=item;
			index=index++;
		}
    },

    ticker:function(){
		//this.logger.debug("Ticker is runned");
		if (this.timerId){
			Mainloop.source_remove(this.timerId);
			this.timerId=0
		}
		this.getJsonFeedTimeout=this.getJsonFeedTimeout+1;
		//this.logger.debug("GetJsonFeedTimeout is:"+this.getJsonFeedTimeout);
		if (this.getJsonFeedTimeout>20){
			this.getJsonFeedTimeout=0
			this.getJsonFeed();
		}
		this.timerId=Mainloop.timeout_add_seconds(1,Lang.bind(this,this.ticker));
    },

    getJsonFeed: function(){
		//this.logger.debug("getJsonFeed Called");
    	Util.spawn_async(['python3',APPLET_PATH+'/getGmailFeedJson.py',this.username],Lang.bind(this,this.processJsonFeed));
		//this.logger.debug("getJsonFeed finished process. ProcessJsonFeed finished as well");
    },

    launchClient: function(event){
		this.menu.close();
    },

    on_applet_removed_from_panel: function() {
		this.settings.finalize();
		if (this.timerId){
			Mainloop.source_remove(this.timerId);
			this.timerId=0;
		}
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
