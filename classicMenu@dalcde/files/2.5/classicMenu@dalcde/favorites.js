const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const MENU_SCHEMAS = "org.cinnamon.applets.classicMenu";

let menuSettings = new Gio.Settings({schema: MENU_SCHEMAS});

const FAV_ICON_SIZE = menuSettings.get_int("favorites-icon-size");

let appsys = Cinnamon.AppSystem.get_default();

function FavButton(app, menu){
    this._init(app, menu);
}

FavButton.prototype = {
    _init: function(app, menu){
        this.actor = new St.Button({reactive: true, track_hover: true});
	this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
        this.app = app;
        this.menu = menu;
        this.name = this.app.get_name();
        this.description = this.app.get_description();
        if (this.description ==null) this.description = "";

        this.nameLabel = new St.Label({text: this.name, style_class: "favorites-label"});
        this.descriptionLabel = new St.Label({text: this.description});
        this.icon = this.app.create_icon_texture(FAV_ICON_SIZE);

        this.vertBox = new St.BoxLayout({vertical: true});
        this.vertBox.add(this.nameLabel);
        this.vertBox.add(this.descriptionLabel);

        this.horBox = new St.BoxLayout();
        this.horBox.style = "width: 225px;";
        this.horBox.add(this.icon, {y_align: St.Align.MIDDLE});
        this.horBox.add(this.vertBox, {y_align: St.Align.MIDDLE});

        this.actor.set_child(this.horBox);

        this.setActive(false);
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1)
            this.activate();
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
        this.app.open_new_window(-1);
        this.menu.close();
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

        this._load();
        this.scrollBox.add_actor(this.box);
        global.settings.connect("changed::favorite-apps", Lang.bind(this, this._load));
    },

    _load: function(){
        let favList = global.settings.get_strv('favorite-apps');
        let leftCol = new St.BoxLayout({vertical: true});
        let rightCol = new St.BoxLayout({vertical: true});
        let appSys = Cinnamon.AppSystem.get_default();
        this.scrollBox.remove_actor(this.box);
        this.box = new St.BoxLayout();
        this.box.add_actor(leftCol);
        this.box.add_actor(rightCol);

        for (let i = 0; i < favList.length; i++){
            let j = i % 2
            let app = appSys.lookup_app(favList[i]);
            if (!app) app = appSys.lookup_settings_app(favList[i]);
            if (app){
                let button = new FavButton(app, this.menu);
                if (j == 0)
                    leftCol.add_actor(button.actor);
                else
                    rightCol.add_actor(button.actor);
            }
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