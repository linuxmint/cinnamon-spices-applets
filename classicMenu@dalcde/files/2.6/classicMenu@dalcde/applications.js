const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;

const USER_DESKTOP_PATH = imports.misc.fileUtils.getUserDesktopDir();

const MENU_SCHEMAS = "org.cinnamon.applets.classicMenu";
let menuSettings = new Gio.Settings({schema: MENU_SCHEMAS});

const APPLICATION_ICON_SIZE = menuSettings.get_int("application-icon-size");
const CATEGORIES_ICON_SIZE = menuSettings.get_int("categories-icon-size");

const BROWSER = imports.gi.GConf.Client.get_default().get_string('/desktop/gnome/applications/browser/exec');
let appsys = Cinnamon.AppSystem.get_default();

const AppletDir = imports.ui.appletManager.appletMeta["classicMenu@dalcde"].path;

function SearchItem(provider, string, parent){
    this._init(provider, string, parent);
}

SearchItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    _init: function(provider, string, parent){
        PopupMenu.PopupMenuItem.prototype._init.call(this, "Search " + provider + " for " + string);
        this.actor.set_style_class_name("menu-category-button");
        this.provider = provider;
        this.string = string;
        this.parent = parent;
    },

    setActive: function(active){
        if (active)
            this.actor.set_style_class_name('menu-category-button-selected');
        else
            this.actor.set_style_class_name('menu-category-button');
    },

    activate: function(event){
        while (this.string.indexOf(" ")!= -1){
            this.string = this.string.replace(" ", "%20");
        }

        switch(this.provider){
        case "Google":
            Util.spawnCommandLine(BROWSER + " https://www.google.com/cse?cx=002683415331144861350%3Atsq8didf9x0&ie=utf-8&sa=Search&q=" + this.string);
            break;
        case "DuckDuckGo":
            Util.spawnCommandLine(BROWSER + " https://duckduckgo.com/?t=lm&q=" + this.string);
            break;
        case "Wikipedia":
            Util.spawnCommandLine(BROWSER + " https://en.wikipedia.org/wiki/Special:Search?search=" + this.string);
            break;
        }
        this.parent.menu.toggle();
    }
}


function ApplicationContextMenuItem(appButton, label, action) {
    this._init(appButton, label, action);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (appButton, label, action) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);
    },

    activate: function (event) {
        switch (this._action){
        case "add_to_panel":
            let settings = new Gio.Settings({ schema: 'org.cinnamon' });
            let desktopFiles = settings.get_strv('panel-launchers');
            desktopFiles.push(this._appButton.app.get_id());
            settings.set_strv('panel-launchers', desktopFiles);
            break;
        case "add_to_desktop":
            let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
            let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH+"/"+this._appButton.app.get_id());
            try{
                file.copy(destFile, 0, null, function(){});
                // Need to find a way to do that using the Gio library, but modifying the access::can-execute attribute on the file object seems unsupported
                Util.spawnCommandLine("chmod +x \""+USER_DESKTOP_PATH+"/"+this._appButton.app.get_id()+"\"");
            }catch(e){
                global.log(e);
            }
            break;
        case "add_to_favorites":
            AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
            break;
        case "remove_from_favorites":
            AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
            break;
        case "uninstall":
            Util.spawnCommandLine('gksu ' + AppletDir + "/remove.py " + this._appButton.app.get_id());
            break;
        }
        this._appButton.actor.grab_key_focus();
        this._appButton.toggleMenu();
        return false;
    }

};

function ApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

ApplicationButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
    
    _init: function(appsMenuButton, app) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        this.app = app;
        this.appsMenuButton = appsMenuButton;
        
        this.menu = new PopupMenu.PopupSubMenu(this.actor);
        this.menu.actor.set_style_class_name('menu-context-menu');
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));

        this.actor.add_style_class_name('menu-application-button');
        this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE);

        this.addActor(this.icon);
        this.label = new St.Label({ text: this.app.get_name(), style_class: 'menu-application-button-label' });
        this.addActor(this.label);
        
        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },
    
    get_app_id: function() {
        return this.app.get_id();
    },
    
    getDragActor: function() {
        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let nbFavorites = favorites.length;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        return this.app.create_icon_texture(icon_size);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        if (event.get_button()==3){
            this.appsMenuButton.closeApplicationsContextMenus(this.app, true);
            this.toggleMenu();
        }
        return true;
    },

    activate: function(event) {
        this.app.open_new_window(-1);
        this.appsMenuButton.menu.close();
    },
    
    closeMenu: function() {
        if (this.withMenu) this.menu.close();
    },
    
    toggleMenu: function() {
        if (!this.menu.isOpen){
            let children = this.menu.box.get_children();
            for (var i in children){
                children[i].destroy();
            }
            let menuItem;
            menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel");
            this.menu.addMenuItem(menuItem);
            if (USER_DESKTOP_PATH){
                menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop");
                this.menu.addMenuItem(menuItem);
            }
            if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
                menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites");
                this.menu.addMenuItem(menuItem);
            }else{
                menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites");
                this.menu.addMenuItem(menuItem);
            }
            menuItem = new ApplicationContextMenuItem(this, _("Uninstall this program"), "uninstall");
            this.menu.addMenuItem(menuItem);
        }
        this.menu.toggle();
    },
    
    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) this.appsMenuButton._scrollToButton(this.menu);
    }
};
Signals.addSignalMethods(ApplicationButton.prototype);

function CategoryButton(app) {
    this._init(app);
}

CategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(category) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        var label;
        this.actor.add_style_class_name('menu-application-button');

        if (category){
           let icon = category.get_icon();
           if (icon && icon.get_names)
               this.icon_name = icon.get_names().toString();
           else
               this.icon_name = "";
           label = category.get_name();
        } else label = _("All Applications");
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'menu-category-button-label' });
        if (category && this.icon_name){
            this.icon = new St.Icon({icon_name: this.icon_name, icon_size: CATEGORIES_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            this.addActor(this.icon);
        }
        this.addActor(this.label);
    }
};
Signals.addSignalMethods(CategoryButton.prototype);

function CategoriesApplicationsBox() {
    this._init();
}

CategoriesApplicationsBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.actor._delegate = this;
    },
    
    acceptDrop : function(source, actor, x, y, time) {
        return false;
    }
}

function ApplicationsPanel(menu, leftBox, rightHeader){
    this._init(menu, leftBox, rightHeader);
}

ApplicationsPanel.prototype = {
    _init: function(menu, leftBox, rightHeader){
        try {
            this.menu = menu;
            this.leftBox = leftBox;
            this.rightHeader = rightHeader;

            this.actor = new St.BoxLayout({vertical: true});
                                   
            this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                               icon_name: 'edit-find',
                                               icon_type: St.IconType.SYMBOLIC });
            this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                             icon_name: 'edit-clear',
                                             icon_type: St.IconType.SYMBOLIC });

            this._searchTimeoutId = 0;
            this._searchIconClickedId = 0;
            this._applicationsButtons = new Array();
            this._selectedItemIndex = null;
            this._previousSelectedItemIndex = null;
            this._activeContainer = null;
            this._applicationsBoxWidth = 0;

            this._load();

             appsys.connect('installed-changed', Lang.bind(this, this._refreshApps));

            this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
            global.settings.connect("changed::menu-hover-delay", Lang.bind(this, function() {
                    this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
            })); 
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    _onOpenStateChanged: function(menu, open) {
        if (!open && this.searchActive) {
	    this.resetSearch();
	    this._select_category(null, this._allAppsCategoryButton);
	}
        if (open) {
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            let scrollBoxHeight = this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1 - (this.searchBox.get_allocation_box().y2-this.searchBox.get_allocation_box().y1) - (this.rightHeader.get_allocation_box().y2 - this.rightHeader.get_allocation_box().y1);
            this.applicationsScrollBox.style = "width: 303px; height: "+scrollBoxHeight+"px;";
            this.categoriesScrollBox.style = "width: 190px; height: " + scrollBoxHeight+"px;";
        } else
            this.closeApplicationsContextMenus(null, false);
    },
    
    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        
        if (symbol==Clutter.KEY_Super_L && this.menu.isOpen) {
            this.menu.close();
            return true;
        }

        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = children.length;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = -1;
        }else if (this._activeContainer === null) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
        }
        
        
        let children = this._activeContainer.get_children();
        
        if (children.length==0){
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
            children = this._activeContainer.get_children();
        }

        let index = this._selectedItemIndex;

        if (symbol == Clutter.KEY_Up) {
            if (this._activeContainer==this.applicationsBox) index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 2;
            else index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 1;
        } else if (symbol == Clutter.KEY_Down) {
            if (this._activeContainer==this.applicationsBox && this._selectedItemIndex!=-1) index = this._selectedItemIndex + 2 >= children.length ? children.length - 2 : this._selectedItemIndex + 2;
            else index = this._selectedItemIndex + 1 == children.length ? children.length - 1 : this._selectedItemIndex + 1;
        } else if (symbol == Clutter.KEY_Right && this._activeContainer === this.categoriesBox) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            index = 0;
            this._previousSelectedItemIndex = this._selectedItemIndex;
            this._selectedItemIndex = -1;
        } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox && !this.searchActive) {
            this._clearSelections(this.applicationsBox);
            this._activeContainer = this.categoriesBox;
            children = this._activeContainer.get_children();
            index = this._previousSelectedItemIndex;
            this._selectedItemIndex = -1;
        } else if (this._activeContainer === this.applicationsBox && (symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
            let item_actor = children[this._selectedItemIndex];
            item_actor._delegate.activate();
            return true;
        } else {
            return false;
        }

        if (index == this._selectedItemIndex) {
            return true;
        }
        
        if (this._activeContainer==this.applicationsBox){
            if (index>=children.length-1) index = children.length-2;
        }else{
            if (index>=children.length) index = children.length-1;
        }

        this._selectedItemIndex = index;
        let item_actor = children[this._selectedItemIndex];

        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }

        item_actor._delegate.emit('enter-event');
        return true;
    },

    _clearSelections: function(container) {
        container.get_children().forEach(function(actor) {
            actor.style_class = "menu-category-button";
        });
    },

    _refreshApps : function() {
        this._applicationsButtons = new Array();
        this._applicationsBoxWidth = 0;
        
        //Remove all categories
    	this.categoriesBox.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        })); 
        
        this._allAppsCategoryButton = new CategoryButton(null);
        this._allAppsCategoryButton.actor.connect('button-release-event', Lang.bind(this, function() {
            this._select_category(null, this._allAppsCategoryButton);
        }));
        this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
            if (!this.searchActive) {
                this._allAppsCategoryButton.isHovered = true;
                Tweener.addTween(this, {
                    time: this.hover_delay,
                    onComplete: function () {
                        if (this._allAppsCategoryButton.isHovered) {
                            this._select_category(null, this._allAppsCategoryButton);
                        }
                    }
                });
            }
        }));
        this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
            this._allAppsCategoryButton.isHovered = false;
        }));
        this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
        
        let trees = [appsys.get_tree(), appsys.get_settings_tree()];
        
        for (var i in trees) {
            let tree = trees[i];
            let root = tree.get_root_directory();
            
            let iter = root.iter();
            let nextType;
            while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
                if (nextType == GMenu.TreeItemType.DIRECTORY) {
                    let dir = iter.get_directory();
                    if (dir.get_is_nodisplay())
                        continue;
                    this.applicationsByCategory[dir.get_menu_id()] = new Array();
                    this._loadCategory(dir);
                    if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                       let categoryButton = new CategoryButton(dir);
                       categoryButton.actor.connect('button-release-event', Lang.bind(this, function() {
                         this._select_category(dir, categoryButton);
                      }));
                      this._addEnterEvent(categoryButton, Lang.bind(this, function() {
                          if (!this.searchActive) {
                             categoryButton.isHovered = true;
                             Tweener.addTween(this, {
                                time: this.hover_delay,
                                onComplete: function () {
                                    if (categoryButton.isHovered) {
                                        this._select_category(dir, categoryButton);
                                    }
                                }
                             });
                          }
                      }));
                      categoryButton.actor.connect('leave-event', function () {
                            categoryButton.isHovered = false;
                      });
                      this.categoriesBox.add_actor(categoryButton.actor);
                    }
                }
            } 
        }
        
        this._select_category(null, this._allAppsCategoryButton);    
        this._setCategoriesButtonActive(!this.searchActive);          
    },
    
    _loadCategory: function(dir, top_dir) {
        var iter = dir.iter();
        var nextType;
        if (!top_dir) top_dir = dir;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
		    var app = appsys.lookup_app_by_tree_entry(entry);
                    if (!app) app = appsys.lookup_settings_app_by_tree_entry(entry);
                 	if (!this.applicationsByCategory[top_dir.get_menu_id()]) this.applicationsByCategory[top_dir.get_menu_id()] = new Array();
					this.applicationsByCategory[top_dir.get_menu_id()].push(app);
		}
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                this._loadCategory(iter.get_directory(), top_dir);
            }
        }
    },
    
    _scrollToButton: function(button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _load : function() {
        this._activeContainer = null;

        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box'});

        this.searchLabel = new St.Label({ text: "Search:  ", style_class: "search-label"});
        this.searchEntry = new St.Entry({ name: 'menu-search-entry',
                                          hint_text: _("Type to search..."),
                                          track_hover: true,
                                          can_focus: true});
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchBox.add_actor(this.searchLabel);
        this.searchBox.add_actor(this.searchEntry);
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();

        this.categoriesScrollBox = new St.ScrollView({x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox'});
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical: true });
        this.categoriesScrollBox.add_actor(this.categoriesBox);
        this.categoriesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.actor.add_actor(this.categoriesScrollBox);

        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        this.applicationsBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical:true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);
        this.actor.add_actor(this.categoriesApplicationsBox.actor);
        this.actor.add_actor(this.searchBox);
        
        this.applicationsByCategory = {};
        this._refreshApps();
    },
    
    _clearApplicationsBox: function(selectedActor){
       let actors = this.applicationsBox.get_children();
	for (var i=0; i<actors.length; i++) {
	    let actor = actors[i];
	    this.applicationsBox.remove_actor(actor);
	}
		       
       let actors = this.categoriesBox.get_children();

         for (var i=0; i<actors.length; i++){
             let actor = actors[i];
             if (this.searchActive) actor.style_class = "menu-category-button-greyed";
             else if (actor==selectedActor) actor.style_class = "menu-category-button-selected";
             else actor.style_class = "menu-category-button";
         }
    },
    
    _select_category : function(dir, categoryButton) {
        this.resetSearch();
        this._clearApplicationsBox(categoryButton.actor);
        if (dir) this._displayButtons(this._listApplications(dir.get_menu_id()));
        else this._displayButtons(this._listApplications(null));
        this.closeApplicationsContextMenus(null, false);
    },
    
    closeApplicationsContextMenus: function(excludeApp, animate) {
        for (var app in this._applicationsButtons){
            if (app!=excludeApp && this._applicationsButtons[app].menu.isOpen){
                if (animate)
                    this._applicationsButtons[app].toggleMenu();
                else
                    this._applicationsButtons[app].closeMenu();
            }
        }
    },
    
    _displayButtons: function(apps){
         if (apps){
            for (var i=0; i<apps.length; i++) {
               let app = apps[i];
               if (!this._applicationsButtons[app]){
                  let applicationButton = new ApplicationButton(this, app);
                  this._addEnterEvent(applicationButton, Lang.bind(this, function() {
                      this._clearSelections(this.applicationsBox);
                      applicationButton.actor.style_class = "menu-category-button-selected";
                      this._scrollToButton(applicationButton);
                  }));
                  this._applicationsButtons[app] = applicationButton;
               }
               this.applicationsBox.add_actor(this._applicationsButtons[app].actor);
               this.applicationsBox.add_actor(this._applicationsButtons[app].menu.actor);
            }
         }
    },

    _displayNoResult: function(string){
        let googleSearch = new SearchItem("Google", string, this);
        this.applicationsBox.add_actor(googleSearch.actor);
        let duckSearch = new SearchItem("DuckDuckGo", string, this);
        this.applicationsBox.add_actor(duckSearch.actor);
        let wikiSearch = new SearchItem("Wikipedia", string, this);
        this.applicationsBox.add_actor(wikiSearch.actor);
    },

    _setCategoriesButtonActive: function(active) {         
        try{
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons){
                let button = categoriesButtons[i];
                let icon = button._delegate.icon;
                if (active){
                    button.remove_style_class_name("menu-category-button-greyed");
                    button.add_style_class_name("menu-category-button");
                }else{
                    button.remove_style_class_name("menu-category-button");
                    button.add_style_class_name("menu-category-button-greyed");
                }
            }
        }catch(e){
            global.log(e);
        }
    },
     
    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        this._setCategoriesButtonActive(true);
        global.stage.set_key_focus(this.searchEntry);
    },
    
    _onSearchTextChanged: function (se, prop) {
        this._clearSelections(this.categoriesBox);
        this._clearSelections(this.applicationsBox);
        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);
            
            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                                                                     Lang.bind(this, function() {
                                                                         this.resetSearch();       
                                                                         this._select_category(null, this._allAppsCategoryButton);                 
                                                                     }));
            }
            
            this._setCategoriesButtonActive(false);
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            
            this._setCategoriesButtonActive(true);
        }
        if (!this.searchActive) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;
        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },
    
    _listApplications: function(category_menu_id, pattern){
        var applist;
        if (category_menu_id) applist = this.applicationsByCategory[category_menu_id];
        else{
            applist = new Array();
            for (directory in this.applicationsByCategory) applist = applist.concat(this.applicationsByCategory[directory]);
        }
        
        var res;
        if (pattern){
            res = new Array();
            for (var i in applist){
                let app = applist[i];
                if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1) || (app.get_id() && app.get_id().slice(0, -8).toLowerCase().indexOf(pattern)!=-1)) res.push(app);
            }
        }else res = applist;
        
        res.sort(function(a,b){
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        
        return res;
    },
    
    _doSearch: function(){
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        if (pattern==this._previousSearchPattern) return false;
        this._previousSearchPattern = pattern;
        
        this._activeContainer = null;
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        
        // _listApplications returns all the applications when the search
        // string is zero length. This will happend if you type a space
        // in the search entry.
        if (pattern.length == 0) {
            return false;
        }
        
        var appResults = this._listApplications(null, pattern);
        this._clearApplicationsBox();

        if (appResults == ""){
            this._displayNoResult(this.searchEntryText.get_text());
        } else
            this._displayButtons(appResults);
        
        let applicationsBoxChilren = this.applicationsBox.get_children();
        if (applicationsBoxChilren.length>0){
            this._activeContainer = this.applicationsBox;
            this._selectedItemIndex = 0;
            let item_actor = applicationsBoxChilren[this._selectedItemIndex];
            if (item_actor && item_actor !== this.searchEntry) {
                item_actor._delegate.emit('enter-event');
            }
        }
        return false;
    },
    
    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousSelectedItemIndex = this._selectedItemIndex;
            }
            this._activeContainer = parent;
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._selectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    }
}