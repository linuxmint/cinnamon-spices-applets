//ScreenShot+Record Applet By Infektedpc
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const UUID = 'ScreenShot+RecordDesktop@tech71';
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}
function ConfirmDialog(){
    this._init();
}


function MyApplet(orientation, panelHeight, instanceId) {
    this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    defineScreenShotDefault: function () {
        //Advanced Screenshot - opens gnome-screenshot
        this.menu.addAction(_("ScreenShot"), function(event) {
            Util.spawnCommandLine("gnome-screenshot --interactive");
        });         

        //Current Window
        this.menu.addAction(_("Current Window"), function(event) {
            Util.spawnCommandLine("gnome-screenshot -w --delay=1");
        }); 

        //Selected Area
        this.menu.addAction(_("Selected Area"), function(event) {
            Util.spawnCommandLine("gnome-screenshot -a");
        });
    },
    defineScreenShotMenuItem: function () {
		//Whole Screen - Dropdown Menu		
		this.screenshotItem = new PopupMenu.PopupSubMenuMenuItem(_("Whole Screen")); 
		//1 Sec Delay
		this.screenshotItem.menu.addAction(_("1 Second Delay"), function(actor, event) {
		    Util.spawnCommandLine("gnome-screenshot --delay=1");
		});
		//3 Sec Delay
		this.screenshotItem.menu.addAction(_("3 Second Delay"), function(actor, event) {
		    Util.spawnCommandLine("gnome-screenshot --delay=3");
		}); 
		//5 Sec Delay
		this.screenshotItem.menu.addAction(_("5 Second Delay"), function(actor, event) {
	          Util.spawnCommandLine("gnome-screenshot --delay=5");
        });
        
        this.menu.addMenuItem(this.screenshotItem); 
    },
    defineRecordMenuItem: function () {
        this.recordItem = new PopupMenu.PopupSubMenuMenuItem(_("Record Screencast"));
        
        var self = this;
        //Start Recording With Audio
        this.recordItem.menu.addAction(_("Record Desktop With Audio"), function(actor, event) {
            self.set_applet_icon_symbolic_name("media-record");
            Util.spawnCommandLine("bash " + GLib.get_home_dir() + "/.local/share/cinnamon/applets/ScreenShot+RecordDesktop@tech71/screencapturesound.sh");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording") + "' '" + _("With-Audio") + "'");
        });
        //Start Recording No Audio
        this.recordItem.menu.addAction(_("Record Desktop Without Audio"), function(actor, event) {
            self.set_applet_icon_symbolic_name("media-record");
            Util.spawnCommandLine("bash " + GLib.get_home_dir() + "/.local/share/cinnamon/applets/ScreenShot+RecordDesktop@tech71/screencapture.sh");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording") + "' '" + _("No-Audio") + "'");
        });
        
        //Start Recording With Audio
        this.recordItem.menu.addAction(_("Record Current Window With Audio"), function(actor, event) {
            self.set_applet_icon_symbolic_name("media-record");
            Util.spawnCommandLine("bash " + GLib.get_home_dir() + "/.local/share/cinnamon/applets/ScreenShot+RecordDesktop@tech71/screencapturesoundwindow.sh");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording") + "' '" + _("With-Audio") + "'");
        });
        //Start Recording No Audio
        this.recordItem.menu.addAction(_("Record Current Window Without Audio"), function(actor, event) {
            self.set_applet_icon_symbolic_name("media-record");
            Util.spawnCommandLine("bash " + GLib.get_home_dir() + "/.local/share/cinnamon/applets/ScreenShot+RecordDesktop@tech71/screencapturewindow.sh");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording") + "' '" + _("No-Audio") + "'");
        });
        
        //Stop Recording
        this.recordItem.menu.addAction(_("Stop Recording"), function(actor, event) {
            self.set_applet_icon_symbolic_name("camera-photo-symbolic");
            Util.spawnCommandLine("killall -SIGTERM screencapture.sh");
            Util.spawnCommandLine("killall -SIGTERM screencapturesound.sh");
            Util.spawnCommandLine("killall -SIGTERM ffmpeg");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording-Stopped") + "'");
            Util.spawnCommandLine("notify-send --icon=gtk-add '" + _("Recording-Finished") + "'");
        });
        
        this.menu.addMenuItem(this.recordItem);
    },
    _init: function(orientation, panelHeight, instanceId) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        
        try {        
            this.set_applet_icon_symbolic_name("camera-photo-symbolic");
            this.set_applet_tooltip(_("Take A Snapshot or Record Your Desktop"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                
        	this.defineScreenShotDefault();

            this.defineScreenShotMenuItem();   

        	//Record My Desktop - Dropdown Menu
            this.defineRecordMenuItem();

        	//Open Screenshot Pictures Folder
        	this.menu.addAction(_("Pictures Folder"), function(actor, event) {
        	// For the Pictures user folder
        	Util.spawn_async(["xdg-open", GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)], null);
        	});  

        	//Open Recorded Video Folder
        	this.menu.addAction(_("Videos Folder"), function(actor, event) {
        	// For the Videos user folder
        	Util.spawn_async(["xdg-open", GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS)], null);
        	});   
                        
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
        
    
};

function main(metadata, orientation, panelHeight, instanceId) {  
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;      
}
