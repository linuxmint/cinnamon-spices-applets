const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Tweener = imports.ui.tweener;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const Util = imports.misc.util;
const DND = imports.ui.dnd;

const ICON_SIZE = 16;
const MAX_FAV_ICON_SIZE = 32;
const CATEGORY_ICON_SIZE = 32;
const APPLICATION_ICON_SIZE = 16;
const HOVER_ICON_SIZE =48;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

var Session = new GnomeSession.SessionManager();

function ApplicationContextMenuItem(appButton, label, action) {
    this._init(appButton, label, action);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (appButton, label, action) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            focusOnHover: false
        });

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({
            text: label
        });
        this.addActor(this.label);
    },

    activate: function (event) {
        this._appButton.toggleMenu();
        switch (this._action) {
        case "add_to_panel":
            let winListApplet = false;
            try{
                winListApplet = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
            }catch (e) {
            }
            if (winListApplet)
                winListApplet.applet.GetAppFavorites().addFavorite(this._appButton.app.get_id());
            else{
                let settings = new Gio.Settings({
                    schema: 'org.cinnamon'
                });
                let desktopFiles = settings.get_strv('panel-launchers');
                desktopFiles.push(this._appButton.app.get_id());
                settings.set_strv('panel-launchers', desktopFiles);
            }
            break;
        case "add_to_desktop":
            let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
            let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + "/" + this._appButton.app.get_id());
            try {
                file.copy(destFile, 0, null, function () {});
                // Need to find a way to do that using the Gio library, but modifying the access::can-execute attribute on the file object seems unsupported
                Util.spawnCommandLine("chmod +x \"" + USER_DESKTOP_PATH + "/" + this._appButton.app.get_id() + "\"");
            } catch (e) {
                global.log(e);
            }
            break;
        case "add_to_favorites":
            AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
            break;
        case "remove_from_favorites":
            AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
            break;
        }
        return false;
    }
};

function GenericApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

GenericApplicationButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (appsMenuButton, app, withMenu) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });

        this.withMenu = withMenu;

        if (this.withMenu) {
            this.menu = new ApplicationMenu(this.actor);
            this.menu.actor.set_style_class_name('menu-context-menu');
        }
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        if (event.get_button() == 2) {
            this.appsMenuButton._clearSelections(this.appsMenuButton.categoriesBox);
        }
        if (event.get_button() == 3) {
            this.appsMenuButton.closeApplicationsContextMenus(this.app, true);
            this.toggleMenu();
        }
        return true;
    },

    activate: function (event) {
        this.app.open_new_window(-1);
        this.appsMenuButton.menu.close();
    },

    closeMenu: function () {
        if (this.withMenu) this.menu.close();
    },

    toggleMenu: function () {
        if (!this.withMenu) return;

        if (!this.menu.isOpen) {
            let children = this.menu.box.get_children();
            for (var i in children) {
                children[i].destroy();
            }
            let menuItem;
            menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel");
            this.menu.addMenuItem(menuItem);
            if (USER_DESKTOP_PATH) {
                menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop");
                this.menu.addMenuItem(menuItem);
            }
            if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())) {
                menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites");
                this.menu.addMenuItem(menuItem);
            } else {
                menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites");
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle();
    },
}

function ApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

ApplicationButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function (appsMenuButton, app) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);

        this.actor.add_style_class_name('menu-category-button');
        this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE);
        this.label = new St.Label({
            text: this.app.get_name(),
            style_class: 'menu-application-button-label'
        });
        this.addActor(this.icon);
        this.addActor(this.label);

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },

    get_app_id: function () {
        return this.app.get_id();
    },

    getDragActor: function () {
        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let nbFavorites = favorites.length;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size;
        if (icon_size > MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        return this.app.create_icon_texture(icon_size);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function () {
        return this.actor;
    }
};
Signals.addSignalMethods(ApplicationButton.prototype);

function PlaceButton(appsMenuButton, place, button_name) {
    this._init(appsMenuButton, place, button_name);
}

PlaceButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (appsMenuButton, place, button_name) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.actor.add_style_class_name('menu-category-button');
        this.place = place;
        this.button_name = button_name;
        this.label = new St.Label({
            text: this.button_name,
            style_class: 'menu-application-button-label'
        });
        this.icon = place.iconFactory(APPLICATION_ICON_SIZE);
        this.addActor(this.icon);
        this.addActor(this.label);
    },

    activate: function () {
        this.place.launch();
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1 | 2) {
            this.activate();
        }
        return true;
    }
};
Signals.addSignalMethods(PlaceButton.prototype);

function ApplicationMenu() {
    this._init.apply(this, arguments);
}

ApplicationMenu.prototype = {
    __proto__: PopupMenu.PopupMenuBase.prototype,

    _init: function (sourceActor) {
        PopupMenu.PopupMenuBase.prototype._init.call(this, sourceActor);

        this.actor = new St.BoxLayout({ style_class: 'popup-sub-menu'});

        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
        //this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.hide();
    },

    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;

        this.actor.show();

        if (animate) {
            let [minHeight, naturalHeight] = this.actor.get_preferred_height(-1);
            this.actor.height = 0;
            Tweener.addTween(this.actor,
                             { height: naturalHeight,
                               time: 0.25,
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', true);
                               }
                             });
        } else {
            this.emit('open-state-changed', true);
        }
    },

    close: function(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;


        if (animate) {
            Tweener.addTween(this.actor,
                             { height: 0,
                               time: 0.25,
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.hide();
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', false);
                               },
                             });
            } else {
                this.actor.hide();

                this.isOpen = false;
                this.emit('open-state-changed', false);
            }
    },

};

function CategoryButton(category) {
    this._init(category);
}

CategoryButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (category) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        var label;
        this.actor.add_style_class_name('menu-category-button');
        if (category) {
            let icon = category.get_icon();
            if (icon && icon.get_names) this.icon_name = icon.get_names().toString();
            else this.icon_name = "";
            label = category.get_name();
        } else label = _("All Applications");
        this.label = new St.Label({
            text: label,
            style_class: 'menu-category-button-label'
        });
        if (category && this.icon_name) {
            this.icon = new St.Icon({
                icon_name: this.icon_name,
                icon_size: CATEGORY_ICON_SIZE,
                icon_type: St.IconType.FULLCOLOR
            });
            this.addActor(this.icon);
        }
        this.addActor(this.label);
        //this.actor.set_tooltip_text(category.get_name());
        this.menu = new ApplicationMenu(this.actor);
        this.menu.actor.set_style_class_name('menu-context-menu');
    },

    activate: function () {
        this.menu.toggle();
    },

    removeItems: function () {
        let children = this.menu._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.menu.box.remove_actor(item.actor);
            if (item.menu)
                this.menu.box.remove_actor(item.menu.actor);
        }
    },

    destroy: function() {
        this.menu.destroy();
        PopupBaseMenuItem.prototype.destroy.call(this);
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1 | 2) {
            this.activate();
        }
        return true;
    }
};
Signals.addSignalMethods(CategoryButton.prototype);

function PlaceCategoryButton() {
    this._init();
}

PlaceCategoryButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function () {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.actor.add_style_class_name('menu-category-button');
        this.label = new St.Label({
            text: _("Places"),
            style_class: 'menu-category-button-label'
        });
        this.icon = new St.Icon({
            icon_name: "folder",
            icon_size: CATEGORY_ICON_SIZE,
            icon_type: St.IconType.FULLCOLOR
        });
        this.addActor(this.icon);
        this.addActor(this.label);
        this.menu = new ApplicationMenu(this.actor);
        this.menu.actor.set_style_class_name('menu-context-menu');
    },

    activate: function () {
        this.menu.toggle();
    },

    removeItems: function () {
        let children = this.menu._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.menu.box.remove_actor(item.actor);
            if (item.menu)
                this.menu.box.remove_actor(item.menu.actor);
        }
    },

    destroy: function() {
        this.menu.destroy();
        PopupBaseMenuItem.prototype.destroy.call(this);
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1 | 2) {
            this.activate();
        }
        return true;
    }
};
Signals.addSignalMethods(PlaceCategoryButton.prototype);

function FavoritesButton(appsMenuButton, app, nbFavorites) {
    this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function (appsMenuButton, app, nbFavorites) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size;
        if (icon_size > MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        this.actor.style = "padding-top: " + (icon_size / 3) + "px;padding-bottom: " + (icon_size / 3) + "px; margin:auto;"

        this.actor.add_style_class_name('menu-favorites-button');
        this.addActor(app.create_icon_texture(icon_size));

        this.label = new St.Label({
            text: this.app.get_name(),
            style_class: 'menu-application-button-label'
        });
        this.addActor(this.label);

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },

    get_app_id: function () {
        return this.app.get_id();
    },

    getDragActor: function () {
        return new Clutter.Clone({
            source: this.actor
        });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function () {
        return this.actor;
    }
};

function TextBoxItem(label, icon, func, parent, hoverIcon) {
    this._init(label, icon, func, parent, hoverIcon);
}

TextBoxItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (label, icon, func, parent, hoverIcon) {
        this.parent = parent;
        this.hoverIcon = hoverIcon;
        this.icon = icon;
        this.func = func;
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, label);

        this.actor.add_style_class_name('menu-category-button');
        this.removeActor(this.label);
        this.removeActor(this._triangle);
        this._triangle = new St.Label();

        this.label = new St.Label({
            text: label,
            style_class: 'menu-application-button-label'
        });
        this.addActor(this.label);
    },

    setActive: function (active) {
        if (active) { 
            this.actor.set_style_class_name('menu-category-button-selected');
            this.hoverIcon._refresh(this.icon);
        }
        else this.actor.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
    },

    activate: function (event) {
        eval(this.func);
        this.parent.close();
    }
};

function AllProgramsItem(label, icon, parent, rightP, leftP) {
    this._init(label, icon, parent, rightP, leftP);
}

AllProgramsItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (label, icon, parent) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, label);

        this.actor.set_style_class_name('menu-category-button');
        this.parent = parent;
        this.removeActor(this.label);
        this.removeActor(this._triangle);
        this._triangle = new St.Label();
	this.label = new St.Label({text: " " + label});
	this.icon = new St.Icon({style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR, icon_name: icon, icon_size: ICON_SIZE });
	this.addActor(this.icon);
	this.addActor(this.label);
    },

    setActive: function(active){
        if (active)
            this.actor.add_style_class_name('menu-category-button-selected');
        else
            this.actor.remove_style_class_name('menu-category-button-selected');
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1){
            this.activate(event);
        }
    },

    activate: function(event){
        if (this.parent.leftPane.get_child() == this.parent.favsBox) {
            this.parent.leftPane.set_child(this.parent.categoriesScrollBox, {
                y_align: St.Align.END,
                y_fill: false
            });
            this.label.set_text(" Favorites");
            this.parent.selectedAppBox.show();
            this.parent._appletStyles();
        }else {
            this.parent.leftPane.set_child(this.parent.favsBox, {
                y_align: St.Align.END,
                y_fill: false
            });
            this.label.set_text(" All Programs");
            this.parent.selectedAppBox.hide();
        }
    }
};

function HoverIcon() {
    this._init();
}

HoverIcon.prototype = {
    _init: function () {
        this.actor = new St.Bin();
        this.icon = new St.Icon({
            icon_size: HOVER_ICON_SIZE,
            icon_type: St.IconType.FULLCOLOR
        });
        this.hover_delay = 0.1;
        this.actor.cild = this.icon;
        this._refresh('folder-home');
    },
    _refresh: function (icon) {
        Tweener.addTween(this, {
            time: this.hover_delay,
            onComplete: function () {
                this.icon.set_icon_name(icon);
            }
        });
    }
};

function ShutdownContextMenuItem(parentMenu, menu, label, action) {
    this._init(parentMenu, menu, label, action);
}

ShutdownContextMenuItem.prototype = {
    __proto__: ApplicationContextMenuItem.prototype,

    _init: function (parentMenu, menu, label, action) {
        this.parentMenu = parentMenu;
        ApplicationContextMenuItem.prototype._init.call(this, menu, label, action);
        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    },

    activate: function (event) {
        switch (this._action) {
        case "logout":
            this._session.LogoutRemote(0);
            break;
        case "lock":
            this._screenSaverProxy.LockRemote();
            break;
        }
        this._appButton.toggle();
        this.parentMenu.toggle();
        return false;
    }

};

function ShutdownMenu(parent, hoverIcon) {
    this._init(parent, hoverIcon);
}

ShutdownMenu.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (parent, hoverIcon) {
        let label = '';
        this.hoverIcon = hoverIcon;
        this.parent = parent;
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, label);
        this.actor.set_style_class_name('menu-category-button');
        this.removeActor(this.label);
        this.removeActor(this._triangle);
        this._triangle = new St.Label();
	    this.icon = new St.Icon({style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR, icon_name: 'forward', icon_size: ICON_SIZE });
	    this.addActor(this.icon);

        this.menu = new ApplicationMenu(this.actor);
        this.menu.actor.remove_style_class_name("popup-sub-menu");

        let menuItem;
        menuItem = new ShutdownContextMenuItem(this.parent, this.menu, _("Logout"), "logout");
        this.menu.addMenuItem(menuItem);
        menuItem = new ShutdownContextMenuItem(this.parent, this.menu, _("Lock Screen"), "lock");
        this.menu.addMenuItem(menuItem);

    },

    setActive: function (active) {
        if (active) { 
            this.actor.set_style_class_name('menu-category-button-selected');
            this.hoverIcon._refresh('system-log-out');
        }
        else this.actor.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1) {
            this.menu.toggle();
        }

    }
};


