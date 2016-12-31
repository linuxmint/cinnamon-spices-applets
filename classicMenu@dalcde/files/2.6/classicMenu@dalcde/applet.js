const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const MENU_SCHEMAS = "org.cinnamon.applets.classicMenu";
let menuSettings = new Gio.Settings({schema: MENU_SCHEMAS});

const AppletMeta = imports.ui.appletManager.applets["classicMenu@dalcde"];
const AppletDir = imports.ui.appletManager.appletMeta["classicMenu@dalcde"].path;
const Favorites = AppletMeta.favorites;
const Applications = AppletMeta.applications;
const LeftPanel = AppletMeta.leftPanel;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {
            this.right_app = true;
            this.set_applet_tooltip(_("Menu"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.right_app = menuSettings.get_boolean("right-app");
            menuSettings.connect("changed::right-app", Lang.bind(this, function(){
                this.right_app = menuSettings.get_boolean("right-app");
                this._changeRight();
            }));

            this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
                        
            this.menu.actor.add_style_class_name('menu-background');
            this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

            this._updateIcon();

            global.settings.connect("changed::menu-icon", Lang.bind(this, function() {
                this._updateIcon();
            })); 
            
            this.set_applet_label(_("Menu"));

            let menuLabel = global.settings.get_string("menu-text");
            if (menuLabel != "Menu") {
                this.set_applet_label(menuLabel);
            }
            global.settings.connect("changed::menu-text", Lang.bind(this, function() {
                this.set_applet_label(global.settings.get_string("menu-text"));
            }));

            this._display();

            global.display.connect('overlay-key', Lang.bind(this, function(){
                try{
                    this.menu.toggle();
                }
                catch(e) {
                    global.logError(e);
                }
            }));    

            this.menu_settings_item = new Applet.MenuItem(_("Menu Settings"), "gnome-settings", function(){Util.spawnCommandLine(AppletDir + "/cinnamon-classic-menu-settings.py");});
            this.edit_menu_item = new Applet.MenuItem(_("Edit menu"), Gtk.STOCK_EDIT, Lang.bind(this, this._launch_editor));
            this._applet_context_menu.addMenuItem(this.menu_settings_item);
            this._applet_context_menu.addMenuItem(this.edit_menu_item);
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_orientation_changed: function (orientation) {
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
        this.menu.actor.add_style_class_name('menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        
        this._display();
    },
    
    _launch_editor: function() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();     
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
    },

    _onOpenStateChanged: function(menu, open) {
        if (open)
            this.actor.add_style_pseudo_class('active');            
        else
            this.actor.remove_style_pseudo_class('active');

        if (this.right_app)
            this.applicationsBox._onOpenStateChanged(menu, open);
        else
            this.favBox._onOpenStateChangedFav(menu, open);
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },
    
    _updateIcon: function(){
        let icon_file = global.settings.get_string("menu-icon");
        try{
           this.set_applet_icon_path(icon_file);
        }catch(e){
           global.log("WARNING : Could not load icon file \""+icon_file+"\" for menu button");
        }
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
r
        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }

        item_actor._delegate.emit('enter-event');
        return true;
    },

    _changeRight: function(){
        if (this.right_app){
            this.changeLabel.set_text("Favorites");
            this.rightContent.set_child(this.applicationsBox.actor);
            global.stage.set_key_focus(this.applicationsBox.searchEntry);
            this.applicationsBox._onOpenStateChanged(null, true);
            this.rightLabel.set_text("   Applications");
        } else {
            this.changeLabel.set_text("All Applications");
            global.stage.set_key_focus(this.placesBox.actor);
            this.rightContent.set_child(this.favBox.actor);
            this.rightLabel.set_text("   Favorites");
        }
        this._positionChangeBin();
    },

    _positionChangeBin: function(){
        this.changeBin.set_position(this.rightContent.get_allocation_box().x2 - this.changeBin.get_allocation_box().get_width() - 15, this.rightHeader.get_allocation_box().y1);
    },

    _display : function() {
        this._activeContainer = null;

        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        let leftPane = new St.BoxLayout({ vertical: true });

        this.leftBox = new St.BoxLayout({ vertical: true, style_class: 'left-box'});
        this.placesBox = new LeftPanel.PlacesBox(this.menu);

	this.leftSeparator = new St.Label();

        this.systemBox = new LeftPanel.SystemBox(this.menu);

        this.leftBox.add_actor(this.placesBox.actor);
        this.leftBox.add_actor(this.leftSeparator);
        this.leftBox.add_actor(this.systemBox.actor);
        leftPane.add_actor(this.leftBox);

        let rightPane = new St.BoxLayout({ vertical: true });
 
        this.changeBin = new St.Bin({reactive: true});
        this.changeBox = new St.BoxLayout();
        this.changeIcon = new St.Icon({icon_name: "go-next", icon_type: St.IconType.SYMBOLIC, icon_size: 12});
        this.changeLabel = new St.Label();

        this.changeBox.add_actor(this.changeLabel);
        this.changeBox.add_actor(this.changeIcon);

        this.changeBin.set_child(this.changeBox);

        this.rightLabel = new St.Label({text: "   Applications", style_class: "largeBold"});
        this.rightContent = new St.Bin();
        this.rightHeader = new St.BoxLayout();

        this.rightHeader.add(this.rightLabel);
        this.rightHeader.add(this.changeBin);

        this.applicationsBox = new Applications.ApplicationsPanel(this.menu, this.leftBox, this.rightHeader);
        this.favBox = new Favorites.FavBox(this.menu, this.leftBox, this.rightHeader);

        rightPane.add_actor(this.rightHeader);
        rightPane.add_actor(this.rightContent);

        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-box'});
        this.mainBox.add_actor(leftPane, { span: 1 });
        this.mainBox.add_actor(rightPane, { span: 1 }); 

        this.changeBin.connect("button-release-event", Lang.bind(this, function(actor, event){
            if (event.get_button() == 1){
                this.right_app = !this.right_app;
                menuSettings.set_boolean("right-app", this.right_app);
                this._changeRight();
            }
        }));
  
        section.actor.add_actor(this.mainBox);
        this._changeRight();
    },
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
