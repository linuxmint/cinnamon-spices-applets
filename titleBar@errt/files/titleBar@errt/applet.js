/*
 *  Title bar applet for Cinnamon
 *  - Adds window title to the panel.
 *
 * Copyright (C) 2012
 *	 Dominik Helm (errt) <errt@gmx.de>
 *
 * based on work by (in no particular order):
 *   Window Buttons: 
 *	   Josiah Messiah
 *	   Daniel Liptrot
 *   Window Title Applet:
 *     rymate1234
 *   Cinnamon Window List:
 *     Clement Lefebvre (Clem)?
 *   Quit Applet:
 *     Bownz
 *
 * Title bar is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Title bar is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Title bar.  If not, see <http://www.gnu.org/licenses/>.
 */

//some imports we need
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;

//path of the configuration data
const CONFIG_FILE    = imports.ui.appletManager.appletMeta["titleBar@errt"].path + '/config.json';

function MyApplet(orientation){
	this._init(orientation);
}

MyApplet.prototype = {
	__proto__: Applet.Applet.prototype,

	_init: function(orientation){
		Applet.Applet.prototype._init.call(this, orientation);

		try{
			//do everything needed to get this running
			this._loadApplet(orientation);
			
			//load the configuration data
			this._loadConfig();

			//run the main method once to get everything in the right position
			this._windowChanged();

			//connect to window change events, don't know if we really need all of them, but having them shouldn't harm
		    Cinnamon.WindowTracker.get_default().connect('notify::focus-app', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('switch-workspace', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('minimize', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('maximize', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('unmaximize', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('map', Lang.bind(this, this._windowChanged));
		    global.window_manager.connect('destroy', Lang.bind(this, this._windowChanged));
		}
		catch(e){
			global.logError(e);
		}
	},

	on_applet_clicked: function(event) {
         switch(this.config.CLICK_ACTION){
				case "MENU":
					if(this.menu){
						this.menu.mouseEvent = event;
						this.menu.toggle();
					}
					break;
				case "CLOSE":
					if(this.oldWindow){
						this.oldWindow.delete(global.get_current_time());
					}					
					break;
				case "NONE":
				default:
					break;
			}    
    },

	_windowChanged: function() {
        let activeWindow = false;
        let hideonnomax = this.config.HIDE_ON_NO_MAX;
		let iconsize = this.config.ICON_SIZE;
        let isActiveWindowMaximized = false;

		//do we want to show the icon?
		if(this.config.SHOW_ICON){
			this.icon.show();
		}else{
			this.icon.hide();
		}

		//disconnect the old events
		if(this.oldWindow){
			this.oldWindow.disconnect(this.windowHandler);
		}

		//on only_max, we need the uppermost maximized window
        if (this.config.ONLY_MAX) {
			activeWindow = this._upperMax();
		}else{
			//else we need the focused window
			activeWindow = global.display.focus_window;
		}

		//remember the current window for the disconnection
		this.oldWindow = activeWindow;

        isActiveWindowMaximized = activeWindow ? activeWindow.get_maximized() : false;

		if(activeWindow){
			//bind to changes of the current window's title and keep the handler needed for disconnection
			this.windowHandler = activeWindow.connect('notify::title', Lang.bind(this, this._windowChanged));

			//get title and app-name
			let title = activeWindow.get_title();
			let name = Cinnamon.WindowTracker.get_default().get_window_app(activeWindow).get_name();

			//there's some options for the label
			switch(this.config.TEXT){
				case "NAME":
					this.label.set_text(_(name));
					break;
				case "TITLE":
				default:
					this.label.set_text(_(title));
					break;
			}
			
			//there's some options for tooltips, too
			switch(this.config.TOOLTIP){
				case "NAME":
					this.set_applet_tooltip(_(name));
					break;
				case "TITLE":
					this.set_applet_tooltip(_(title));
					break;
				case "NONE":
				default:
					//nothing to do here
					break;
			}

			//do we want a left click menu?
			if(this.config.CLICK_ACTION == "MENU"){
				if(this.menu){
					//if there's an old menu, remove it
					this.menuManager.removeMenu(this.menu);
				}
				//add the new one
				this.menu = new LeftClickMenu(this.actor, activeWindow, this.orientation);
	    		this.menuManager.addMenu(this.menu);
			}

			//display the applet
			this.actor.show();
	
			//set the icon, regardless of whether we use it or not
			this.icon.set_child(Cinnamon.WindowTracker.get_default().get_window_app(activeWindow).create_icon_texture(iconsize));
		}else{
			//no window, no applet
			this.actor.hide();
		}

        //hide applet when active window is maximized if option is set.
        if (hideonnomax) {
            if (isActiveWindowMaximized) {
                this.actor.show();
            } else {
                this.actor.hide();
            }
        }
    },

    _upperMax: function() {
        let maxwin = false;
        let winactors = global.get_window_actors();
        let window = null;
        let currentWorkspace = global.screen.get_active_workspace();

        // Return the uppermost maximized window from the current workspace, or false if there is none
        for ( let i = winactors.length - 1; i >= 0; --i ) {
            window = winactors[i].get_meta_window();
            if (window.get_workspace() == currentWorkspace && window.get_maximized() && !window.minimized) {
                // Maximized window get!
                maxwin = window;
                break;
            }
        }

        return maxwin;
    },

	_loadApplet: function(orientation) {
		//remember orientation
		this.orientation = orientation;

		//create a box for the visual elements
		this.box = new St.BoxLayout({ style: 'spacing: 5px;' });
    	this.actor.add(this.box);
		//create a slicer for the app icon
		this.icon = new Cinnamon.Slicer();
		this.box.add_actor(this.icon);
		//and a label for the title
		this.label = new St.Label({ style: 'padding-top: 5px' });
		this.box.add_actor(this.label);
		
		//this manages the left click menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = false;

		//we need that for freeing the resources
		this.oldWindow = false;
		this.windowHandler = false;
	},

	_loadConfig: function() {
		//load and parse the configuration data
		this.config = JSON.parse(Cinnamon.get_file_contents_utf8_sync(GLib.build_filenamev([CONFIG_FILE])));
	}
};

function LeftClickMenu(actor, metaWindow, orientation) {
    this._init(actor, metaWindow, orientation);
};

LeftClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, metaWindow, orientation) {
		this.applet = actor;
        //take care of menu initialization        
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, orientation, 0);        
        Main.uiGroup.add_actor(this.actor);

        this.actor.hide();

        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));        
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));        

        this.metaWindow = metaWindow;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        

        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Restore"));
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Minimize"));
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        
        this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Maximize"));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));  
        
        this.itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        this.itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));
        
        this.itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        this.itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));      
        
        this.itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        this.itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));

        if (orientation == St.Side.BOTTOM) {
            this.addMenuItem(this.itemOnAllWorkspaces);
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(this.itemOnAllWorkspaces);
        }
     },

     _onToggled: function(actor, event){
	if (!event)
            return;

	//Set the position to be below the mouse pointer
	this.actor.set_position(this.mouseEvent.get_coords()[0] - this.applet.get_transformed_position()[0] - this.applet.get_width()/2, 0);

	if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
            this.itemMoveToLeftWorkspace.actor.hide();
            this.itemMoveToRightWorkspace.actor.hide();
        } else {
            this.itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace())
                this.itemMoveToLeftWorkspace.actor.show();
            else
                this.itemMoveToLeftWorkspace.actor.hide();
            
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace())
                this.itemMoveToRightWorkspace.actor.show();
            else
                this.itemMoveToRightWorkspace.actor.hide();
        }
        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }else{
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }
    },
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
        this.destroy();
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            this.metaWindow.activate(global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){      
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },
    
    _onMoveToLeftWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _onMoveToRightWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    }
};

function main(metadata, orientation){
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
