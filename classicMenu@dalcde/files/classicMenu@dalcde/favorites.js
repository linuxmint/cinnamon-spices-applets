//-*- indent-tabs-mode: nil-*-
const Lang = imports.lang;

const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;

let menuSettings = new Gio.Settings({schema: "org.cinnamon.applets.classicMenu"});

const FAV_ICON_SIZE = menuSettings.get_int("favorites-icon-size");

let appSys = Cinnamon.AppSystem.get_default();

const AppletMeta = imports.ui.appletManager.applets["classicMenu@dalcde"];
const FavSys = AppletMeta.favSys;

let favInstance = FavSys.getFavSys();

let listInUse = new Array();

const LOCAL_APPLICATIONS_PATH = imports.gi.GLib.get_home_dir() + "/.local/share/applications";

const AppletDir = imports.ui.appletManager.appletMeta["classicMenu@dalcde"].path;

function App(desktopFile){
    this._init(desktopFile);
}

App.prototype = {
    _init: function(desktopFile){
	this.desktopFile = desktopFile;
        this.exists = false;
        this.name = "";
        this.description = "";
        this.icon = "";
        this.appinfo;
        this.app = appSys.lookup_app(this.desktopFile)
        if (!this.app) this.app = appSys.lookup_settings_app(this.desktopFile);
        if (!this.app){
            this.appinfo = Gio.DesktopAppInfo.new_from_filename(LOCAL_APPLICATIONS_PATH + "/" + this.desktopFile);
            if (this.appinfo){
                this.name = this.appinfo.get_name();
                this.icon = St.TextureCache.get_default().load_gicon(null, this.appinfo.get_icon(), FAV_ICON_SIZE);
                this.description = this.appinfo.get_description();
            }
        } else {
            this.name = this.app.get_name();
            this.description = this.app.get_description();
            this.icon = this.app.create_icon_texture(FAV_ICON_SIZE);
        }
        if (this.app || this.appinfo) this.exists = true;
    },

    open: function(){
        if (this.app)
            this.app.open_new_window(-1);
        else if (this.appinfo){
            this.appinfo.launch([], null);
        }
    }            
}

function FavButton(i, j, menu){
    this._init(i, j, menu);
}

FavButton.prototype = {
    _init: function(i, j, menu){
	this.i = i;
	this.j = j;
        this.menu = menu;

	this.actor = new St.Bin({reactive: true, track_hover: true});
        this._id = listInUse[i][j];
        this.app = new App(this._id);
	if (this.app.exists){
            this.name = this.app.name;
            this.description = this.app.description;

            if (this.description ==null) this.description = "";

            this.nameLabel = new St.Label({text: this.name, style_class: "favorites-label"});
            this.descriptionLabel = new St.Label({text: this.description});
            this.icon = this.app.icon;

            this.vertBox = new St.BoxLayout({vertical: true});
            this.vertBox.add(this.nameLabel);
            this.vertBox.add(this.descriptionLabel, {y_align: St.Align.END});

            this.horBox = new St.BoxLayout();
            this.horBox.style = "width: 225px;";
            this.horBox.add(this.icon, {y_align: St.Align.MIDDLE});
            this.horBox.add(this.vertBox, {y_align: St.Align.MIDDLE});

	    this.actor.set_child(this.horBox);

 	    this.actor._delegate = this;

            this.setActive(false);

	    this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
            this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));

            this._menuManager = new PopupMenu.PopupMenuManager(this);
            let side = St.Side.LEFT;
            if (St.Widget.get_default_direction() == St.TextDirection.RTL)
		side = St.Side.RIGHT;
            this._menu = new PopupMenu.PopupMenu(this.actor, 0.5, St.Side.TOP);
            Main.uiGroup.add_actor(this._menu.actor);
            this._menu.actor.hide()
            this._menuManager.addMenu(this._menu);
	    this._menu.addAction(_("Remove favorite"), Lang.bind(this, function(){favInstance.removeFavorite(listInUse[this.i][this.j]);}));
            this._menu.addAction(_("Add Separator"), Lang.bind(this, function(){favInstance.addSeparatorAtPos(this.i, this.j);}));
            this._menu.addAction(_("Advanced Editor"), Lang.bind(this, function(){Util.spawnCommandLine(AppletDir + "/favoritesEditor.py " + AppletDir + "/"); this.menu.toggle()}))
	}
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1)
            this.activate();
        else if (event.get_button()==3){
            this._menu.toggle();
        }
    },

    _onHoverChanged: function(actor){
        this.setActive(actor.hover);
    },

    setActive: function(active){
        if (active)
            this.actor.style_class = 'menu-category-button-selected';
        else
            this.actor.style_class = 'menu-category-button';
    },

    activate: function(){
        this.app.open();
        this.menu.close();
    }
}

function FavSubBox(menu, parent){
    this._init(menu, parent);
}

FavSubBox.prototype = {
    _init: function(menu, parent){
        this.menu = menu;
	this.parent = parent;
        this.actor = new St.BoxLayout();
	this.box = new St.BoxLayout();
	this.actor._delegate = this;
        this.actor.add_actor(this.box);
    },

    load: function(i){
	this.i = i;
	this.box.get_children().forEach(Lang.bind(this, function(child){child.destroy();}));

        this.leftCol = new St.BoxLayout({vertical: true});
        this.rightCol = new St.BoxLayout({vertical: true});

        this.box.add_actor(this.leftCol);
        this.box.add_actor(this.rightCol);
	this.buttons = new Array();
        for (let j in listInUse[i]){
            let k = j % 2;
            let button = new FavButton(i, j, this.menu);
            if (k == 0)
                this.leftCol.add_actor(button.actor);
            else
                this.rightCol.add_actor(button.actor);
	    this.buttons.push(button);
        }
    }
}

function FavBox(menu, leftBox, rightHeader){
    this._init(menu, leftBox, rightHeader);
}

FavBox.prototype = {
    _init: function(menu, leftBox, rightHeader){
        this.menu = menu;
        this.leftBox = leftBox;
        this.rightHeader = rightHeader;

        this.actor = new St.BoxLayout();
        this.box = new St.BoxLayout();

        this.scrollBox = new St.ScrollView({x_fill: true, y_fill: true, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox'});
        this.scrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.actor.add_actor(this.scrollBox);

        this.load();
        this.scrollBox.add_actor(this.box);
        favInstance.connect("changed", Lang.bind(this, this.load));
    },

    load: function(){
        listInUse = favInstance._list;

        this.scrollBox.remove_actor(this.box);
	this.box.destroy();
        this.box = new St.BoxLayout({vertical: true});
	this.subBox = new Array();
//loading first section
	if (listInUse.length != 0){
	    let sub = new FavSubBox(this.menu, this);
	    sub.load(0);
	    this.subBox.push(sub);
	    this.box.add_actor(sub.actor);
	}
//loading other sections
	for (let i = 1; i < listInUse.length; i++){
	    let sub = new FavSubBox(this.menu, this);
	    sub.load(i);
	    this.subBox.push(sub);
	    this.box.add_actor(new PopupMenu.PopupSeparatorMenuItem().actor);
	    this.box.add_actor(sub.actor);
	}
        this.scrollBox.add_actor(this.box);
    },

    _onOpenStateChangedFav: function(menu, open){
        if(open){
            let scrollBoxHeight = this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1 - (this.rightHeader.get_allocation_box().y2 - this.rightHeader.get_allocation_box().y1);

            this.scrollBox.style = "height: " + scrollBoxHeight+"px;"
        }
    }
};