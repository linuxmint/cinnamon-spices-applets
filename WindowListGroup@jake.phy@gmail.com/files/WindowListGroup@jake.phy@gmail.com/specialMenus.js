const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const Gettext = imports.gettext;

const AppletDir = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
const MainApplet = AppletDir.applet;
const SpecialButtons = AppletDir.specialButtons;

const THUMBNAIL_ICON_SIZE = 20;
const OPACITY_OPAQUE = 255;

const FavType = {
    favorites: 0,
    pinnedApps: 1,
    none: 2
}


function _(str) {
   let resultConf = Gettext.dgettext('WindowListGroup@jake.phy@gmail.com', str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
}


function AppMenuButtonRightClickMenu() {
    this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function (parent, actor) {
        //take care of menu initialization        
        PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.0, parent.orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        this.metaWindow = parent.metaWindow;
        this._parentActor = actor;
        this._parentActor.connect('button-release-event', Lang.bind(this, this._onParentActorButtonRelease));

        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = parent.orientation;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
        this._applet = parent._applet;
        let PinnedFavorites = this._applet.pinned_app_contr();

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));

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

        this.launchItem = new PopupMenu.PopupMenuItem(_("New Window"));
        this.launchItem.connect('activate', Lang.bind(this, this._launchMenu));
		// Settings in pinned apps menu;
        this.settingItem = new PopupMenu.PopupMenuItem(_("Go to Settings"));
        this.settingItem.connect('activate', Lang.bind(this, this._settingMenu));

		this.reArrange = new PopupMenu.PopupSwitchMenuItem(_("ReArrange"), this._applet.arrangePinned);
		this.reArrange.connect('toggled', Lang.bind(this, function(item) { this._applet.arrangePinned = item.state; }));

		this.showPinned = new PopupMenu.PopupSwitchMenuItem(_("Show Pinned"), this._applet.showPinned);
		this.showPinned.connect('toggled', Lang.bind(this, function(item) { this._applet.showPinned = item.state; }));

		this.groupApps = new PopupMenu.PopupSwitchMenuItem(_("Group Apps"), this._applet.groupApps);
		this.groupApps.connect('toggled', Lang.bind(this, function(item) { this._applet.groupApps = item.state; }));

		this.showThumbs = new PopupMenu.PopupSwitchMenuItem(_("Show Thumbs"), this._applet.showThumbs);
		this.showThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.showThumbs = item.state; }));

		this.verticalThumbs = new PopupMenu.PopupSwitchMenuItem(_("Vertical Thumbs"), this._applet.verticalThumbs);
		this.verticalThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.verticalThumbs = item.state; }));

		this.stackThumbs =  new PopupMenu.PopupSwitchMenuItem(_("Stack Thumbs"), this._applet.stackThumbs);
		this.stackThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.stackThumbs = item.state; }));

		this.enablePeek = new PopupMenu.PopupSwitchMenuItem(_("Hover to Peek"), this._applet.enablePeek);
		this.enablePeek.connect('toggled', Lang.bind(this, function(item) { this._applet.enablePeek = item.state; }));

        this.favs = PinnedFavorites, this.favId = this.app.get_id(), this.isFav = this.favs.isFavorite(this.favId);
        if (this._applet.showPinned != FavType.none) {
            if (this.isFav) {
                this.itemtoggleFav = new PopupMenu.PopupMenuItem(_("Unpin App"));
                this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
            } else {
                this.itemtoggleFav = new PopupMenu.PopupMenuItem(_("Pin App"));
                this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
            }
        }
        if (this.isFavapp) this._isFavorite(true);
        else this._isFavorite(false);
    },

    _isFavorite: function (isFav) {
        let showFavs = this._applet.showPinned;
        if (isFav) {
            this.addMenuItem(this.settingItem);
            this.addMenuItem(this.reArrange);
            this.addMenuItem(this.showPinned);
            this.addMenuItem(this.groupApps);
            this.addMenuItem(this.showThumbs);
            this.addMenuItem(this.stackThumbs);
            this.addMenuItem(this.enablePeek);
            this.addMenuItem(this.verticalThumbs);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.launchItem);
            this.addMenuItem(this.itemtoggleFav);
        } else if (this.orientation == St.Side.BOTTOM) {
            this.addMenuItem(this.itemOnAllWorkspaces);
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.launchItem);
            if (showFavs) this.addMenuItem(this.itemtoggleFav);
            else this.addMenuItem(this.settingItem);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMinimizeWindow);
            //this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);
        } else {
            this.addMenuItem(this.itemCloseWindow);
            //this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            if (showFavs) this.addMenuItem(this.itemtoggleFav);
            else this.addMenuItem(this.settingItem);
            this.addMenuItem(this.launchItem);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(this.itemOnAllWorkspaces);
        }
    },

    _onParentActorButtonRelease: function (actor, event) {

        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
            if (this.isOpen) {
                this.toggle();
            }
        } else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK) {
            this.close(false);
        } else if (event.get_state() & Clutter.ModifierType.BUTTON3_MASK && !global.settings.get_boolean("panel-edit-mode")) {
            this.mouseEvent = event;
            this.toggle();
        }
    },

    _onToggled: function (actor, event) {
        if (!event || !this.metaWindow) return;

        if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.text = _("Only on this workspace");
            this.itemMoveToLeftWorkspace.actor.hide();
            this.itemMoveToRightWorkspace.actor.hide();
        } else {
            this.itemOnAllWorkspaces.label.text = _("Visible on all workspaces");
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace()) this.itemMoveToLeftWorkspace.actor.show();
            else this.itemMoveToLeftWorkspace.actor.hide();

            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace()) this.itemMoveToRightWorkspace.actor.show();
            else this.itemMoveToRightWorkspace.actor.hide();
        }
        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.text = _("Unmaximize");
        } else {
            this.itemMaximizeWindow.label.text = _("Maximize");
        }
        if (this.metaWindow.minimized) this.itemMinimizeWindow.label.text = _("Restore");
        else this.itemMinimizeWindow.label.text = _("Minimize");
    },

    _onWindowMinimized: function (actor, event) {},

    _onCloseWindowActivate: function (actor, event) {
        this.metaWindow.delete(global.get_current_time());
        //this.destroy();
    },

    _onMinimizeWindowActivate: function (actor, event) {
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            this.metaWindow.activate(global.get_current_time());
        } else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function (actor, event) {
        if (this.metaWindow.get_maximized()) {
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        } else {
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },

    _onMoveToLeftWorkspace: function (actor, event) {
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT);
        if (workspace) {
            //this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _onMoveToRightWorkspace: function (actor, event) {
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT);
        if (workspace) {
            //this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _toggleOnAllWorkspaces: function (actor, event) {
        if (this.metaWindow.is_on_all_workspaces()) this.metaWindow.unstick();
        else this.metaWindow.stick();
    },

    _toggleFav: function (actor, event) {
        if (this.isFav) {
            this.close(false);
            this.favs.removeFavorite(this.favId)
            this.itemtoggleFav.label.text = _("Pin App");
        } else {
            this.close(false);
            this.favs.addFavorite(this.favId);
            this.itemtoggleFav.label.text = _("Unpin App");
        }
    },

    _launchMenu: function () {
        this.app.open_new_window(-1);
    },

    _settingMenu: function () {
        Util.spawnCommandLine("cinnamon-settings applets WindowListGroup@jake.phy@gmail.com");
    },

    removeItems: function () {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
        }
    },

	destroy: function () {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
			item.actor.destroy();
        }
		this.box.destroy();
		this.actor.destroy();
    },

    _onSourceKeyPress: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen) this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else return false;
    },

    setMetaWindow: function (metaWindow) {
        this.metaWindow = metaWindow;
    }
};

function HoverMenuController(owner) {
    this._init(owner);
}

HoverMenuController.prototype = {
    __proto__: PopupMenu.PopupMenuManager.prototype,

    _onEventCapture: function (actor, event) {
        return false;
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function (parent) {
        PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.45, parent.orientation);
		this._applet = parent._applet;
        this.metaWindow = parent.metaWindow;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
		//need to impliment this class or cinnamon outputs a bunch of errors
        this.actor.style_class = "hide-arrow";
        this.actor.hide();
        this.parentActor = parent.actor;

        Main.layoutManager.addChrome(this.actor, this.orientation);

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this);
        this.addMenuItem(this.appSwitcherItem);

        this.parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this.parentActor.connect('leave-event', Lang.bind(this, this._onLeave));
        this.parentActor.connect('button-release-event', Lang.bind(this, this._onButtonPress));

        this.actor.connect('enter-event', Lang.bind(this, this._onMenuEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onMenuLeave));

        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonPress));
        this._applet.settings.connect('thumbnail-timeout', Lang.bind(this, function () { this.hoverTime =  this._applet.settings.getValue("thumbnail-timeout")}));
        this.hoverTime =  this._applet.settings.getValue("thumbnail-timeout");
    },

    _onButtonPress: function (actor, event) {
		if(this.parentActor == actor && this._applet.onclickThumbs) return;
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    _onMenuEnter: function () {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverOpen));
    },

    _onMenuLeave: function () {
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    _onEnter: function () {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverOpen));
    },

    _onLeave: function () {
        this.shouldClose = true;
        this.shouldOpen = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    hoverOpen: function () {
        if (this.shouldOpen && !this.isOpen) {
            this.open(true);
        }
    },

    hoverClose: function () {
        if (this.shouldClose) {
            this.close(true);
        }
    },

    open: function (animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
	    this.appSwitcherItem._refresh();
	    this.appSwitcherItem.actor.show();
	    PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    close: function (animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        PopupMenu.PopupMenu.prototype.close.call(this, animate);
        this.appSwitcherItem.actor.hide();
    },

	destroy: function () {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
			item.actor.destroy();
        }
		this.box.destroy();
		this.actor.destroy();
    },


    setMetaWindow: function (metaWindow) {
        this.metaWindow = metaWindow;
        this.appSwitcherItem.setMetaWindow(metaWindow);
    }
};

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail

function PopupMenuAppSwitcherItem() {
    this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (parent, params) {
        params = Params.parse(params, {
            hover: false
        });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        
		this._applet = parent._applet;
        this.metaWindow = parent.metaWindow;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
		this._parentContainer = parent;

        this.actor.style_class = null;

        this.box = new St.BoxLayout({
			vertical: true,
       });
        this.appContainer = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer.style = "margin: 0px;padding: 8px;";
        this.appContainer2 = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer2.style = "margin: 0px;padding: 8px;";
		this.appContainer2.hide();
        this.appContainer3 = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer3.style = "margin: 0px;padding: 8px;";
		this.appContainer3.hide();
        this.appThumbnails = {};
        this.appThumbnails2 = {};
        this.appThumbnails3 = {};

        this._applet.settings.connect("changed::vertical-thumbnails", Lang.bind(this, this._setVerticalSetting));
		this._setVerticalSetting();
		this.addActor(this.box);

        this._refresh();
    },

	_setVerticalSetting: function() {
		let vertical = this._applet.settings.getValue("vertical-thumbnails");
		if(vertical){
			if(this.box.get_children() > 0) {
				this.box.remove_actor(this.appContainer3);
        		this.box.remove_actor(this.appContainer2);
				this.box.remove_actor(this.appContainer);
		        this.box.add_actor(this.appContainer);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer3);
			}else{
		        this.box.add_actor(this.appContainer);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer3);
			}	
		}else{
			if(this.box.get_children() > 0) {
				this.box.remove_actor(this.appContainer3);
        		this.box.remove_actor(this.appContainer2);
				this.box.remove_actor(this.appContainer);
		        this.box.add_actor(this.appContainer3);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer);
			}else{
		        this.box.add_actor(this.appContainer3);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer);
			}
		}
		this.appContainer.vertical = vertical;
		this.appContainer2.vertical = vertical;
		this.appContainer3.vertical = vertical;
		this.box.vertical = !vertical;
	},

    setMetaWindow: function (metaWindow) {
        this.metaWindow = metaWindow;
    },

    _isFavorite: function (isFav) {
        if (isFav) this.isFavapp = true;
        else this.isFavapp = false;
    },

    _refresh: function () {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
		if(this.metaWindowThumbnai && !this.metaWindowThumbnail.needs_refresh())
			this.metaWindowThumbnail == null;
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
            this.metaWindowThumbnail._isFavorite(this.isFavapp);
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.isFavapp) {
                this.metaWindowThumbnail = new WindowThumbnail(this, this.metaWindow);
                this.appContainer.insert_actor(this.metaWindowThumbnail.actor, 0);
            }
        }

        // Get a list of all windows of our app that are running in the current workspace
        let windows = this.app.get_windows().filter(Lang.bind(this, function (win) {
            let metaWorkspace = null;
            if (this.metaWindow) metaWorkspace = this.metaWindow.get_workspace();
            //let isDifferent = (win != this.metaWindow);
            let isSameWorkspace = (win.get_workspace() == metaWorkspace);
            return isSameWorkspace;
        })).reverse();
        // Update appThumbnails to include new programs
		this.addNewWindows(windows);
        // Update appThumbnails to remove old programs
		this.removeOldWindows(windows);
    },
	addNewWindows: function (windows) {
        let ThumbnailWidth = Math.floor((Main.layoutManager.primaryMonitor.width / 70) * this._applet.thumbSize) + 16;
        let ThumbnailHeight = Math.floor((Main.layoutManager.primaryMonitor.height / 70) * this._applet.thumbSize) + 16;
		let moniterSize, thumbnailSize;
			if(this._applet.settings.getValue("vertical-thumbnails")){
				moniterSize = Main.layoutManager.primaryMonitor.height;
				thumbnailSize = ThumbnailHeight;
			}else{
				moniterSize = Main.layoutManager.primaryMonitor.width;
				thumbnailSize = ThumbnailWidth;
			}
		if ((thumbnailSize * windows.length) + thumbnailSize >= moniterSize && this._applet.settings.getValue("stack-thumbnails")) {
			this.thumbnailsSpace = Math.floor((moniterSize - 100) / thumbnailSize);
			let firstLoop = this.thumbnailsSpace;
			let nextLoop = firstLoop + this.thumbnailsSpace;
    		if(windows.length < firstLoop)
				firstLoop = windows.length;
			this.addWindowsLoop(0,firstLoop,this.appContainer,windows,1);
			if(windows.length > nextLoop){
				this.addWindowsLoop(firstLoop,nextLoop,this.appContainer2,windows,2);
			}else if(windows.length > firstLoop)
				this.addWindowsLoop(firstLoop,windows.length,this.appContainer2,windows,2);
			if(windows.length > nextLoop)
				this.addWindowsLoop(nextLoop,windows.length,this.appContainer3,windows,3);			
		} else {
			this.addWindowsLoop(0,windows.length,this.appContainer,windows,1);
		}
	},
	
	addWindowsLoop: function(i, winLength, actor, windows,containerNum) {
		for(let i = i; i < winLength; i++) {
			let metaWindow = windows[i];
			if (this.appThumbnails[metaWindow]) {
	            this.appThumbnails[metaWindow].thumbnail._isFavorite(this.isFavapp);
	        } else {
	            let thumbnail = new WindowThumbnail(this, metaWindow);
	            this.appThumbnails[metaWindow] = {
	                metaWindow: metaWindow,
	                thumbnail: thumbnail,
					cont: containerNum
	            };
	        	actor.add_actor(this.appThumbnails[metaWindow].thumbnail.actor);
	        }
		}
		actor.show();
	},

	removeOldWindows: function(windows) {
		for (let win in this.appThumbnails) {
            if (windows.indexOf(this.appThumbnails[win].metaWindow) == -1) {
				if(this.appThumbnails[win].cont == 1){
		            this.appContainer.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}else if(this.appThumbnails[win].cont == 2){
		            this.appContainer2.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}else if(this.appThumbnails[win].cont == 3){
		            this.appContainer3.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}
	            this.appThumbnails[win].thumbnail.destroy();
	            delete this.appThumbnails[win];
            }
        }
		if(this.appContainer.get_children().length < this.thumbnailsSpace && this.appContainer2.get_children().length > 0){
			let actor = this.appContainer2.get_children()[0];
			this.appContainer2.remove_actor(actor);
			this.appContainer.add_actor(actor);
		}
		if(this.appContainer2.get_children().length <= 0)
			this.appContainer2.hide();
		if(this.appContainer2.get_children().length < this.thumbnailsSpace && this.appContainer3.get_children().length > 0){
			let actor = this.appContainer3.get_children()[0];
			this.appContainer3.remove_actor(actor);
			this.appContainer2.add_actor(actor);
		}
		if(this.appContainer3.get_children().length <= 0)
			this.appContainer3.hide();
	}
};

function WindowThumbnail() {
    this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {

    _init: function (parent, metaWindow) {
    	this._applet = parent._applet;
        this.metaWindow = metaWindow || null;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp || false;
        this.wasMinimized = false;
		this._parent = parent;
		//this._parentContainer = parent._parentContainer

        // Inherit the theme from the alt-tab menu
        this.actor = new St.BoxLayout({
            style_class: 'item-box',
            reactive: true,
            track_hover: true,
            vertical: true
        });
        this.thumbnailActor = new St.Bin();

        this._container = new St.BoxLayout({		
			style_class: 'thumbnail-iconLabel',
        });

        let bin = new St.BoxLayout({
        });

        this.icon = this.app.create_icon_texture(THUMBNAIL_ICON_SIZE);

        this._container.add_actor(this.icon);
        this._label = new St.Label();
		this._label.style = "padding: 2px;";
        this._container.add_actor(this._label);
        this.button = new St.BoxLayout({
            style_class: 'window-close',
            reactive: true
        });
		this.button.style = "width: 20px; height: 20px;";
        //this._container.add_actor(this.button);
        this.button.hide();
		bin.add_actor(this._container);
		bin.add_actor(this.button);
		bin.style = "padding-bottom: 3px;"
        this.actor.add_actor(bin);
        this.actor.add_actor(this.thumbnailActor);

        if (this.isFavapp) this._isFavorite(true);
        else this._isFavorite(false);

        if (this.metaWindow) this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            this._label.text = this.metaWindow.get_title();
        }));
        this.actor.connect('enter-event', Lang.bind(this, function () {
            if (!this.isFavapp) {
                this._hoverPeek(this._applet.peekOpacity, this.metaWindow);
                this.actor.add_style_pseudo_class('outlined');
                this.actor.add_style_pseudo_class('selected');
				if(this._applet.showThumbs)
                	this.button.show();
		        if (this.metaWindow.minimized && this._applet.enablePeek) {
		            this.metaWindow.unminimize();
		            this.wasMinimized = true;
		        } else this.wasMinimized = false;
            }
        }));
        this.actor.connect('leave-event', Lang.bind(this, function () {
            if (!this.isFavapp) {
                this._hoverPeek(OPACITY_OPAQUE, this.metaWindow);
                this.actor.remove_style_pseudo_class('outlined');
                this.actor.remove_style_pseudo_class('selected');
                this.button.hide();
		        if (this.wasMinimized) {
		            this.metaWindow.minimize(global.get_current_time());
		        }

            }
        }));
        this.button.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        this.actor.connect('button-release-event', Lang.bind(this, this._connectToWindow));
    },

    _isFavorite: function (isFav) {
        // Whether we create a favorite tooltip or a window thumbnail
        if (isFav) {
            //this.thumbnailActor.height = 0;
            //this.thumbnailActor.width = 0;
            this.thumbnailActor.child = null;
            let apptext = this.app.get_name();
            // not sure why it's 7
            this.ThumbnailWidth = THUMBNAIL_ICON_SIZE + Math.floor(apptext.length * 7.0);
            this._label.text = apptext;
            this.isFavapp = true;
			this.actor.style = "border-width:2px;padding: 0px;";
			this._container.style = "width: " + this.ThumbnailWidth + "px";
        } else {
			this._refresh();
			this.actor.style = "border-width:2px;padding: 6px;";
		}
    },

    destroy: function () {
        this.actor.destroy();
    },

    needs_refresh: function () {
        return Boolean(this.thumbnail);
    },

    _getThumbnail: function () {
        // Create our own thumbnail if it doesn't exist
        let thumbnail = null;
        let muffinWindow = this.metaWindow.get_compositor_private();
        if (muffinWindow) {
            let windowTexture = muffinWindow.get_texture();
            let[width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, this.ThumbnailWidth / width, this.ThumbnailHeight / height);
            thumbnail = new Clutter.Clone({
                source: windowTexture,
                reactive: true,
                width: width * scale,
                height: height * scale
            });
        }

        return thumbnail;
    },

    _onButtonRelease: function (actor, event) {
        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && actor == this.button) {
            this._hoverPeek(OPACITY_OPAQUE, this.metaWindow);
            this.metaWindow.delete(global.get_current_time());
            /*this._parentContainer.shouldOpen = true;
            this._parentContainer.shouldClose = false;
            this._parentContainer.hoverOpen();*/
        	this.stopClick = true;
        }
    },

    _connectToWindow: function (actor, event) {
        this.wasMinimized = false;
        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && !this.stopClick && !this.isFavapp) {
            this.metaWindow.activate(global.get_current_time());
        }else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK && !this.stopClick) {
            this.metaWindow.delete(global.get_current_time());
		}
        this.stopClick = false;
    },

    _refresh: function () {
        // Turn favorite tooltip into a normal thumbnail
        this.ThumbnailHeight = Math.floor(Main.layoutManager.primaryMonitor.height / 70) * this._applet.thumbSize;
        this.ThumbnailWidth = Math.floor(Main.layoutManager.primaryMonitor.width / 70) * this._applet.thumbSize;
        //this.thumbnailActor.height = this.ThumbnailHeight;
        //this.thumbnailActor.width = this.ThumbnailWidth;
		this._container.style = "width: " + Math.floor(this.ThumbnailWidth - 20) + "px";
        this.isFavapp = false;

        // Replace the old thumbnail
		let title = this.metaWindow.get_title();
        this._label.text = title;
		if (this._applet.showThumbs){
		    this.thumbnail = this._getThumbnail();
        	this.thumbnail.height = this.ThumbnailHeight;
        	this.thumbnail.width = this.ThumbnailWidth;
		    this.thumbnailActor.child = this.thumbnail;
		} else {
			this.thumbnailActor.child = null;
		}
    },

    _hoverPeek: function (opacity, metaWin) {
    	let applet = this._applet;
        if (applet.enablePeek == false) return;

        function setOpacity(window_actor, target_opacity) {
            Tweener.addTween(window_actor, {
                time: applet.peekTime * 0.001,
                transition: 'easeOutQuad',
                opacity: target_opacity,
            });
        }

        let above_current = new Array();

        global.get_window_actors().forEach(function (wa) {
            var meta_win = wa.get_meta_window();
            if (metaWin == meta_win) return;

            if (meta_win.get_window_type() != Meta.WindowType.DESKTOP) setOpacity(wa, opacity);


        });
    }
};
