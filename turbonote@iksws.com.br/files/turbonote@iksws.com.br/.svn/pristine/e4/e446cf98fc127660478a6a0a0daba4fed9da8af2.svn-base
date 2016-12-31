const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const NMClient = imports.gi.NMClient;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const Gio = imports.gi.Gio
const ScreenSaver = imports.misc.screenSaver;

owner = GLib.get_user_name();
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/"

function MyApplet(metadata, orientation, panel_height,instance_id) {
    this._init(metadata, orientation, panel_height,instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height,instance_id) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("TurboNote", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);    
            
            this.set_applet_icon_symbolic_name("avatar-default");
            
            this.settings = new Settings.AppletSettings(this, "turbonote@iksws.com.br", instance_id);

            let userBox = new St.BoxLayout({ style_class: 'user-box', reactive: true, vertical: false });

            this._userIcon = new St.Bin({ style_class: 'user-icon'});
            
            this.settings.bindProperty(Settings.BindingDirection.IN, "display-name", "disp_name", this._updateLabel, null);

            userBox.connect('button-press-event', Lang.bind(this, function() {
                this.menu.toggle();
                Util.spawnCommandLine("cinnamon-settings user");
            }));

            this._userIcon.hide();
            userBox.add(this._userIcon,
                        { x_fill:  true,
                          y_fill:  false,
                          x_align: St.Align.END,
                          y_align: St.Align.START });
            this.userLabel = new St.Label(({ style_class: 'user-label'}));
            userBox.add(this.userLabel,
                        { x_fill:  true,
                          y_fill:  false,
                          x_align: St.Align.END,
                          y_align: St.Align.MIDDLE });    

            this.menu.addActor(userBox);                      

	    	this.set_applet_icon_path(path_icon+"mymail-symbolic.svg");
            this.set_applet_tooltip(_("Cinnamon TurboNote"));

            this._client = NMClient.Client.new();
            this._statusSection = new PopupMenu.PopupMenuSection();
            this._statusSection.actor.hide();

            this.menu.addMenuItem(this._statusSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		    this.menu.addAction(_("New Note"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/new_note.py");
	            }));
		    this.menu.addAction(_("Contacts Manager"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/contacts.py");
	            }));
		    this.menu.addAction(_("History Manager"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/historic.py");
	            }));
		    /*this.menu.addAction(_("History Sent Manager"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/historics.py");
	            }));*/
		    this.menu.addAction(_("Attacheds"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/attacheds.py");
	            }));

		    this.menu.addAction(_("Configuration"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/config.py");
	            }));

		    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		    this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Server Status"), this._toggleNotifications);                    
            
            this._statusChanged = this.notificationsSwitch.connect('toggled', Lang.bind(this, function(item, state) {
                if (state){                    							
					Util.trySpawnCommandLine('python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/server.py')	
					Util.trySpawnCommandLine('service turbonote start')			
                }else{
                    Util.trySpawnCommandLine('service turbonote stop')
                }
                this.emit('enabled-changed');
            }));

            s = GLib.spawn_async_with_pipes(null, ["pgrep","python"], null, GLib.SpawnFlags.SEARCH_PATH,null);		

            let [res, pid, in_fd, out_fd, err_fd] =	  GLib.spawn_async_with_pipes(null, ["pgrep","python"], null, GLib.SpawnFlags.SEARCH_PATH, null);
			out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: out_fd}) });
			let [out, size] = out_reader.read_line(null);

            if(out !=null){
            	 this.notificationsSwitch.setToggleState(1);
            }else{
 				this.notificationsSwitch.setToggleState(0);
            }

           
            this.menu.addMenuItem(this.notificationsSwitch);
		   
		    this.menu.addAction(_("SVN Update"), Lang.bind(this, function() {
					Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/svnupdate.py");
	            }));
	        
	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

	        this.menu.addAction(_("About"), Lang.bind(this, function() { 
				Util.spawnCommandLine("python /usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/about.py");
		    }));	        
	                
	        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
            this._userLoadedId = this._user.connect('notify::is_loaded', Lang.bind(this, this._onUserChanged));
            this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));
            this._onUserChanged();                     
	            
	        }
	        catch (e) {
	            global.logError(e);
	        }
    },
    
    _setIcon: function(name) {
        if (this._currentIconName !== name) {
            this.set_applet_icon_symbolic_name(name);
            this._currentIconName = name;
        }
    },

    _updateLabel: function() {
        if (this.disp_name) {
            this.set_applet_label(this._user.get_real_name());
        } else {
            this.set_applet_label("");
        }
    },
    _onUserChanged: function() {
        if (this._user.is_loaded) {
            this.set_applet_tooltip(this._user.get_real_name());   
            this.userLabel.set_text (this._user.get_real_name());            
            if (this._userIcon) {            	
                let iconFileName = this._user.get_icon_file(); 
                let iconFile = Gio.file_new_for_path(iconFileName);
                let icon;
                if (iconFile.query_exists(null)) {
                    icon = new Gio.FileIcon({file: iconFile});
                } else {
                    icon = new Gio.ThemedIcon({name: 'avatar-default'});
                }
                let img = St.TextureCache.get_default().load_gicon(null, icon, 48);
                this._userIcon.set_child (img);
                this._userIcon.show();               
            }else{
            	notifyTray("teste","nao entrei");
            }
            this._updateLabel();
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("TurboNote", this.metadata.uuid);
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

};

function notifyTray(_title,_msg) {	
	Util.trySpawnCommandLine("notify-send --hint=int:transient:1 '" + _title + "' '"+ _msg + "' -i '" + path_icon + "turbo.png" + "'");
}


function main(metadata, orientation, panel_height,instance_id) {  
    let myApplet = new MyApplet(metadata, orientation, panel_height,instance_id);
    return myApplet;      
}
