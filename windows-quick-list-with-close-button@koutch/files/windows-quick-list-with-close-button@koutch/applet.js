const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const UUID = "windows-quick-list-with-close-button@koutch";
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

///Settings
const Settings = imports.ui.settings;  // Needed for settings API
const Util = imports.misc.util;

///Add Close dialog box
/**base on QuitApplet@bownz LogoutDialog **/
const ModalDialog = imports.ui.modalDialog;

function CloseDialog(wks, app_name, nb_windows, menu, msg1, msg2, showmenu ){
    this._init(wks, app_name, nb_windows, menu, msg1, msg2, showmenu );
}

CloseDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(wks, app_name, nb_windows, menu, msg1, msg2, showmenu ){
	ModalDialog.ModalDialog.prototype._init.call(this);
		
    ///Settings
		this.DIALOG_MSG_1 = msg1; 
		this.DIALOG_MSG_2 = msg2;
		this.SHOW_MENU_ON_CLOSE = showmenu;

	let title = ""
	if ( app_name == "Workspace" ) {
		title = Main.getWorkspaceName(wks);
	}
	else {
		title = app_name;
	}

	let label_title = new St.Label({text: title + "\n"});
	this.contentLayout.add(label_title);
	let label_quest = new St.Label({text: this.DIALOG_MSG_1 + " " + nb_windows + " " + this.DIALOG_MSG_2 + "\n"});
	this.contentLayout.add(label_quest);

	this.setButtons([
	    {
			label: _("Yes"),
			action: Lang.bind(this, function(){
				this.close_windows_by_app(wks, app_name);
				this.close();
				if (this.SHOW_MENU_ON_CLOSE && this.nb_windows()>0){
					/// this.nb_windows() prevent display empty menu
					menu.toggle();
				}
			 })
	    },
	   {
			label: _("No"),
			action: Lang.bind(this, function(){ 
				this.close();
				if (this.SHOW_MENU_ON_CLOSE && this.nb_windows()>0){
					/// this.nb_windows() prevent display empty menu
					menu.toggle();
				}
			})
	    }
	]);
    },

    ///Close windows by application
	close_windows_by_app: function(wks, app_name) {
		let tracker = Cinnamon.WindowTracker.get_default();
		try{
			let metaWorkspace = global.screen.get_workspace_by_index(0);
			if ( wks >= 0 ) {
				metaWorkspace = global.screen.get_workspace_by_index(wks);
			}
			let windows = metaWorkspace.list_windows();										
			windows = windows.filter(function(w) {
				if ( wks >= 0 ) {
					return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
				}
				else {
					return !w.is_skip_taskbar() && w.is_on_all_workspaces();
				}				
			}
                                		);
			///Scan workspace windows list
			for ( let i = 0; i < windows.length; ++i ) {
				let metaWindow = windows[i];				
				let app = tracker.get_window_app(windows[i]);
				if (app){
					if ( app_name == app.get_name() | app_name == "Workspace" ) {
						metaWindow.delete(global.get_current_time());
					}
				}
			}
		} catch(e) {
			global.logError(e);			
		}		
	},
	/// Return number of windows
	nb_windows: function() {														
		let nb_windows = 0;															
		try {																	
			for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {									
				let metaWorkspace = global.screen.get_workspace_by_index(wks);								
				let windows = metaWorkspace.list_windows();										

				if ( wks==0 ) {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar(); } );															
				}
				else {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar() && !w.is_on_all_workspaces(); } );
				}
				nb_windows = nb_windows + windows.length;					
			}
			
			return nb_windows;

		}																	
		catch (e) {															
			global.logError(e);												
		}																	
	},				
	
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype, ///change IconApplet to TextIconApplet to display the number of windows

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id); ///change IconApplet to TextIconApplet again

		try {
			///Settings
			this.settings = new Settings.AppletSettings(this, "windows-quick-list-with-close-button@koutch", instance_id);
			this.settings.bindProperty(Settings.BindingDirection.IN, "ACTIV-WKS-BUTTON", "ACTIV_WKS_BUTTON", this.updateMenu, null);                            
			this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-WKS-CLOSE-BUTTON", "SHOW_WKS_CLOSE_BUTTON", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-APP-GROUP", "SHOW_APP_GROUP", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-APP-GROUP-CLOSE-BUTTON", "SHOW_APP_GROUP_CLOSE_BUTTON", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-CLOSE-BUTTON", "SHOW_CLOSE_BUTTON", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-MENU-ON-CLOSE", "SHOW_MENU_ON_CLOSE", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "ICON-GROUP-SIZE", "ICON_GROUP_SIZE", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "ICON-SIZE", "ICON_SIZE", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "DIALOG-MSG-1", "DIALOG_MSG_1", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "DIALOG-MSG-2", "DIALOG_MSG_2", this.updateMenu, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "TITLE-LENGTH", "TITLE_LENGTH", this.updateMenu, null);
			
        
			Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("windows-quick-list-with-close-button");
            this.set_applet_tooltip(_("All windows"));       

			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menuManager.addMenu(this.menu);

			/// ContextMenuItem
            /**base on timer-notifications@markbokil.com 'Edit Options' **/
			this.createContextMenu();
			this.updateMenu();
		}
		catch (e) {
			global.logError(e);
		}
	},
	
	updateMenu: function() {

		/// call display_nb_windows fonction
		this.display_nb_windows();     									      	
		this.menu.removeAll();


		try {
			let tracker = Cinnamon.WindowTracker.get_default();
			let in_sticky = false;
			let sticky_done = false;
			let TL_Dot = "...";/// '...' to add to reduced title
			
			for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {

				if (in_sticky) {///last turn was for windows on all workspace
					in_sticky = false;
					this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
					wks = 0;///to do first workspace's windows
				}
				
				/// build a list with all windows
				let workspace_name = Main.getWorkspaceName(wks);
				let metaWorkspace = global.screen.get_workspace_by_index(wks);
				let windows = metaWorkspace.list_windows();				
				let sticky_windows = windows.filter(function(w) { return !w.is_skip_taskbar() && w.is_on_all_workspaces(); });
				windows = windows.filter(function(w) { return !w.is_skip_taskbar() && !w.is_on_all_workspaces(); });

				if( (windows.length) | (sticky_windows.length && (wks==0) && !sticky_done) ) {					
					if(sticky_windows.length && (wks==0) && !sticky_done) {
						windows = sticky_windows;
						in_sticky = true;
						sticky_done = true;
					}	

					windows = this.sort_list_windows(windows, tracker);

					if(wks>0) {
						this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
					}
					if(global.screen.n_workspaces>1 && !in_sticky) {					
						let item = new PopupMenu.PopupMenuItem("(" + String(windows.length) + ") " + workspace_name);
						item.label.add_style_class_name('popup-subtitle-menu-item');
						if(wks == global.screen.get_active_workspace().index()) {
							item.setShowDot(true);		    
						}
						else {
							if (this.ACTIV_WKS_BUTTON){ item.connect('activate', Lang.bind(this, function() { metaWorkspace.activate(global.get_current_time()); } )); }
						}

						///Add close button to workspace if more than 1 window
						if ( windows.length > 1 && this.SHOW_WKS_CLOSE_BUTTON && this.SHOW_CLOSE_BUTTON ) {
							///Add empty button to align close button	
							let align_wks_button1 = new St.Button({ label: " " });
							let align_wks_button2 = new St.Button({ label: " " });
							item.addActor(align_wks_button1, { align: St.Align.END });	
							item.addActor(align_wks_button2, { align: St.Align.END });	
							/** base on all-in-one-places@jofer DeviceMenuItem eject button**/
							let close_wks_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
							let close_wks_button = new St.Button({ child: close_wks_icon });
							let close_wks_wks = wks;
							let close_wks_dialog_box = new CloseDialog(close_wks_wks , "Workspace" , windows.length , this.menu , this.DIALOG_MSG_1, this.DIALOG_MSG_2, this.SHOW_MENU_ON_CLOSE);
							close_wks_button.connect('clicked', Lang.bind(this, function(){
								this.menu.toggle();    
								close_wks_dialog_box.open()
							} ));
							item.addActor(close_wks_button, { align: St.Align.END });
						}

						this.menu.addMenuItem(item);
					}

					///build menu
					for ( let i = 0; i < windows.length; ++i ) {

						///for SubMenuItem
						let add_item_Menu = false;
						let nb_itemMenu_item = 0;
						let itemMenu = new PopupMenu.PopupSubMenuMenuItem("");

						while ( !add_item_Menu ) {
							
							let metaWindow = windows[i];
							if( windows[i].get_title().length < this.TITLE_LENGTH ) {	
								TL_Dot = "";///no need '...'
							}							
							let item = new PopupMenu.PopupMenuItem(windows[i].get_title().substring(0,this.TITLE_LENGTH) + TL_Dot);			
							TL_Dot = "...";
							let app = tracker.get_window_app(metaWindow);
							item.connect('activate', Lang.bind(this, function() { this.activateWindow(metaWorkspace, metaWindow); } ));

							///Add close button
							/** base on all-in-one-places@jofer DeviceMenuItem eject button**/
							let close_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
							let close_button = new St.Button({ child: close_icon });
							close_button.connect('clicked', Lang.bind(this, function(){				
								this.menu.toggle();    
								metaWindow.delete(global.get_current_time());
								if (this.SHOW_MENU_ON_CLOSE && this.nb_windows()>0){
										/// this.nb_windows() prevent display empty menu
										this.menu.toggle();
								}
							}));
							
							///Add SubMenuItem		
							let next_app_name = "";
							if ( i + 1 <  windows.length ) {
								let next_app = tracker.get_window_app(windows[i+1]);
								next_app_name = next_app.get_name();
							}

							if ( next_app_name == app.get_name()  && this.SHOW_APP_GROUP ) {
								if ( nb_itemMenu_item == 0 ) {
									///Count nb of windows
									let nb_windows = 1
									for (let j = i+1; j < windows.length; ++j){
										let j_app = tracker.get_window_app(windows[j]);
										if ( j_app.get_name() == app.get_name() ) {
											++nb_windows;
										}
									}
									if( app.get_name.length < this.TITLE_LENGTH ) {	
										TL_Dot = "";///no need '...'
									}
									itemMenu = new PopupMenu.PopupSubMenuMenuItem(_("(" + String(nb_windows) + ") " + app.get_name().substring(0,this.TITLE_LENGTH) + TL_Dot ));
									TL_Dot = "...";
									itemMenu._icon = app.create_icon_texture(this.ICON_SIZE);
									itemMenu.addActor(itemMenu._icon, { align: St.Align.END });
									///Add close button to group of windows
									/** base on all-in-one-places@jofer DeviceMenuItem eject button**/
									if ( this.SHOW_APP_GROUP_CLOSE_BUTTON && this.SHOW_CLOSE_BUTTON) {
										let close_app_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
										let close_app_button = new St.Button({ child: close_app_icon });
										let close_app_wks = wks;
										if (in_sticky) { close_app_wks = -1; }
										let close_dialog_box = new CloseDialog(close_app_wks , app.get_name() , nb_windows , this.menu, this.DIALOG_MSG_1, this.DIALOG_MSG_2, this.SHOW_MENU_ON_CLOSE);
										close_app_button.connect('clicked', Lang.bind(this, function(){
											this.menu.toggle();    
											close_dialog_box.open()
										} ));
										itemMenu.addActor(close_app_button, { align: St.Align.END });
									}
								}
								///Add item icon smaller for SubMenu
								item.setShowDot(true);
								item._icon = app.create_icon_texture(this.ICON_GROUP_SIZE);
								item.addActor(item._icon, { align: St.Align.END });									
								if ( this.SHOW_CLOSE_BUTTON) { item.addActor(close_button, { align: St.Align.END }); }

								itemMenu.menu.addMenuItem(item);						
								++nb_itemMenu_item;
								++i; 
							}
							else {
								if ( nb_itemMenu_item == 0 ) {
									///Add empty button to align icon and close button	
									let align_button = new St.Button({ label: " " });
									item.addActor(align_button, { align: St.Align.END });	

									///Add item icon default size without SubMenu									
									item._icon = app.create_icon_texture(this.ICON_SIZE);
									item.addActor(item._icon, { align: St.Align.END });	
									if ( this.SHOW_CLOSE_BUTTON) {item.addActor(close_button, { align: St.Align.END }); }
																	
									this.menu.addMenuItem(item);
								}
								else {
									///Add item icon smaller for SubMenu
									item.setShowDot(true);
									item._icon = app.create_icon_texture(this.ICON_GROUP_SIZE);
									item.addActor(item._icon, { align: St.Align.END });									
									if ( this.SHOW_CLOSE_BUTTON) { item.addActor(close_button, { align: St.Align.END });}
									
									itemMenu.menu.addMenuItem(item);
									this.menu.addMenuItem(itemMenu);
								}
								add_item_Menu = true;
							}	
						}
					}
				}
			}
		} catch(e) {
			global.logError(e);			
		}		
	},

	///ContextMenu
    /**base on timer-notifications@markbokil.com 'Edit Options'**/
	createContextMenu: function () {
		this.edit_menu_item = new PopupMenu.PopupImageMenuItem(_("Settings"), "system-run-symbolic");
		this.edit_menu_item.connect('activate', Lang.bind(this, function () {
			Util.spawnCommandLine('cinnamon-settings applets windows-quick-list-with-close-button@koutch');
		}));
        this._applet_context_menu.addMenuItem(this.edit_menu_item);
    },


	///Display and connect  to workspace events the number of windows
	display_nb_windows: function() {														
		let nb_windows = 0;															
		try {																	
			for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {									
				let metaWorkspace = global.screen.get_workspace_by_index(wks);								
				let windows = metaWorkspace.list_windows();										

				/// connect display_nb_windows to workspace events 
				if (!metaWorkspace._display_nb_windowsID){										
					metaWorkspace._display_nb_windowsID = metaWorkspace.connect('window-added',Lang.bind(this, this.display_nb_windows));
					metaWorkspace.connect('window-removed',Lang.bind(this, function() {
						if(this.menu.isOpen){
							this.menu.toggle();
							this.updateMenu();
							if (this.nb_windows()>0){
								this.menu.toggle();
							}	
						}
						else{
							this.updateMenu();
						}
					}));
				}															
				if ( wks==0 ) {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar(); } );															
				}
				else {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar() && !w.is_on_all_workspaces(); } );
				}
				nb_windows = nb_windows + windows.length;					
			}

			///Add the number of windows																
			if (nb_windows == 0){							
				this.set_applet_label("");									
			}																
			else{															
				this.set_applet_label(String(nb_windows));					
			}
		}																	
		catch (e) {															
			global.logError(e);												
		}																	
	},																		

	/// Return number of windows
	nb_windows: function() {														
		let nb_windows = 0;															
		try {																	
			for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {									
				let metaWorkspace = global.screen.get_workspace_by_index(wks);								
				let windows = metaWorkspace.list_windows();										

				if ( wks==0 ) {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar(); } );															
				}
				else {
					windows = windows.filter( function(w) { return !w.is_skip_taskbar() && !w.is_on_all_workspaces(); } );
				}
				nb_windows = nb_windows + windows.length;					
			}
			
			return nb_windows;

		}																	
		catch (e) {															
			global.logError(e);												
		}																	
	},				

	///Sort the list of windowsby app
	sort_list_windows: function(list, tracker) {
		try{
			let listwindows = list;		
			let window = list[0];	///	define sortedwindow as window
			let listwindows_id = 0;
			while ( listwindows_id < list.length ) {
				let app = 	tracker.get_window_app(listwindows[listwindows_id]);
				let app_name = app.get_name();
				++listwindows_id;
				///looking for same app
				for (let j = listwindows_id; j < list.length; ++j ) {
				app = tracker.get_window_app(listwindows[j]);
					if ( app_name ==  app.get_name()) {
						window=listwindows[listwindows_id];
						listwindows[listwindows_id] = listwindows[j];
						listwindows[j]=window;
						++listwindows_id;
					}
				}
			}				
			return listwindows;
		} catch(e) {
			/// return not sorted list
			return list;
			global.logError(e);			
		}		

	},	

	activateWindow: function(metaWorkspace, metaWindow) {
		if(!metaWindow.is_on_all_workspaces()) { metaWorkspace.activate(global.get_current_time()); }
		metaWindow.unminimize(global.get_current_time());
		metaWindow.activate(global.get_current_time());
	},
	
	on_applet_clicked: function(event) {
		this.updateMenu();
		this.menu.toggle();    
	},
	
	///Settings
    on_applet_removed_from_panel: function() {
        this.settings.finalize();    // This is called when a user removes the applet from the panel.. 
    }
};

function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
	return myApplet;
}
