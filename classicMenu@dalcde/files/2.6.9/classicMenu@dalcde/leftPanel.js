// -*- indent-tabs-mode: nil -*-
const PopupMenu = imports.ui.popupMenu;
const DND = imports.ui.dnd;
const ModalDialog = imports.ui.modalDialog;
const Main = imports.ui.main;

const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Util = imports.misc.util;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const MENU_SCHEMAS = "org.cinnamon.applets.classicMenu";
let menuSettings = new Gio.Settings({schema: MENU_SCHEMAS});
let appSys = Cinnamon.AppSystem.get_default();

const LEFT_ICON_SIZE = menuSettings.get_int("left-icon-size");
const PACKAGE_MANAGER = menuSettings.get_string("package-manager");

let session = new GnomeSession.SessionManager();
let screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

function PackageItem(parent){
    this._init(parent);
}

PackageItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(parent){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
	this.app = appSys.lookup_settings_app(PACKAGE_MANAGER);
	if (!this.app) this.app = appSys.lookup_app(PACKAGE_MANAGER);

	this.icon = this.app.create_icon_texture(LEFT_ICON_SIZE);
	let name = this.app.get_name();
        this.actor.set_style_class_name('menu-category-button');
	this.parent = parent;
	this.label = new St.Label({text: " " + name});
	this.addActor(this.icon);
	this.addActor(this.label);
    },

    setActive: function(active){
        if (active)
            this.actor.set_style_class_name('menu-category-button-selected');
        else
            this.actor.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1){
            this.activate(event);
        }
    },

    activate: function(event){
	this.app.open_new_window(-1);
	this.parent.close();
    }
}

function AddPlacesDialog(pos, string) {
    this._init(pos, string);
}

AddPlacesDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(pos, string) {
        ModalDialog.ModalDialog.prototype._init.call(this, {styleClass: 'panel-launcher-add-dialog'});

        this.pos = pos;
        this.string = string;
        let box = new St.BoxLayout({ styleClass: 'panel-launcher-add-dialog-content-box'});
        let leftBox = new St.BoxLayout({vertical: true, styleClass: 'panel-launcher-add-dialog-content-box-left'});
        let rightBox = new St.BoxLayout({vertical: true, styleClass: 'panel-launcher-add-dialog-content-box-right'});
        let label = new St.Label({text: _("Label")});
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        this._nameEntry = new St.Entry({ styleClass: 'panel-launcher-add-dialog-entry', can_focus: true});
        rightBox.add(this._nameEntry, {x_align: St.Align.END, x_fill: false, x_expand: false});

        label = new St.Label();
        label.set_text(_("Destination"));
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        this._destinationEntry = new St.Entry({ styleClass: 'panel-launcher-add-dialog-entry', can_focus: true});
        rightBox.add(this._destinationEntry, {x_align: St.Align.END, x_fill: false, x_expand: false});

        label = new St.Label();
        label.set_text(_("Icon"));
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        this._iconEntry = new St.Entry({ styleClass: 'panel-launcher-add-dialog-entry', can_focus: true});
        rightBox.add(this._iconEntry, {x_align: St.Align.END, x_fill: false, x_expand: false});

        box.add(leftBox);
        box.add(rightBox);
        this.contentLayout.add(box, {y_align: St.Align.START});

        this._errorBox = new St.BoxLayout({style_class: 'run-dialog-error-box'});
        this.contentLayout.add(this._errorBox, {expand: true});
        let errorIcon = new St.Icon({ icon_name: 'dialog-error', icon_size: 24, style_class: 'run-dialog-error-icon'});
        this._errorBox.add(errorIcon, {y_align: St.Align.MIDDLE});
        this._errorMessage = new St.Label({style_class: 'run-dialog-error-label' });
        this._errorMessage.clutter_text.line_wrap = true;
        this._errorBox.add(this._errorMessage, {expand: true,
                                               y_align: St.Align.MIDDLE,
                                               y_fill: false});
        this._errorBox.hide();

        this.connect('opened', Lang.bind(this, this._onOpened));
    },

    _onOpened: function() {
        this._nameEntry.grab_key_focus();
    },

    _validateAdd: function() {
        if (this._nameEntry.clutter_text.get_text()==""){
            this._errorMessage.clutter_text.set_text(_("Label cannot be empty!"));
            this._errorBox.show();
            return false;
        }

        let string = this._nameEntry.clutter_text.get_text() + "::" + this._iconEntry.clutter_text.get_text() + "::" + this._destinationEntry.clutter_text.get_text();
        this.savePlace(string);
        this.close();
        return true;
    },

    savePlace: function(string){
        let strings = menuSettings.get_strv("places-list");
        if (this.string)
            strings.splice(this.pos, 1, string);
        else
            strings.splice(this.pos+1, 0, string);

        menuSettings.set_strv("places-list", strings);
    },

    open: function(timestamp){
        if (this.string){
            let props = this.string.split("::");
            this._nameEntry.clutter_text.set_text(props[0]);
            this._iconEntry.clutter_text.set_text(props[1]);
            this._destinationEntry.clutter_text.set_text(props[2]);
        }

        this._errorBox.hide();
        if (this.string)
            this.setButtons([
                {
                    label: _("Edit"),
                    action: Lang.bind(this, this._validateAdd)
                },
                {
                    label: ("Cancel"),
                    key: Clutter.KEY_Escape,
                    action: Lang.bind(this, function(){this.close();})
                }
            ]);
        else 
            this.setButtons([
                {
                    label: _("Add"),
                    action: Lang.bind(this, this._validateAdd)
                },
                {
                    label: ("Cancel"),
                    key: Clutter.KEY_Escape,
                    action: Lang.bind(this, function(){this.close();})
                }
            ]);

        ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
    }
}


function LeftBoxItem(label, icon, func, parent){
    this._init(label, icon, func, parent);
}

LeftBoxItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(label, icon, func, parent){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor.set_style_class_name('menu-category-button');
	this.parent = parent;
        this.func = func;
	this.label = new St.Label({text: " " + label});
	this.icon = new St.Icon({style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR, icon_name: icon, icon_size: LEFT_ICON_SIZE });
	this.addActor(this.icon);
	this.addActor(this.label);
    },

    setActive: function(active){
        if (active)
            this.actor.set_style_class_name('menu-category-button-selected');
        else
            this.actor.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1){
            this.activate(event);
        }
    },

    activate: function(event){
        eval(this.func);
	this.parent.close();
    }
}

function PlacesMenuItem(label, icon, func, parent, string){
    this._init(label, icon, func, parent, string);
}

PlacesMenuItem.prototype = {
    __proto__: LeftBoxItem.prototype,

    _init: function(label, icon, func, parent, string){
        LeftBoxItem.prototype._init.call(this, label, icon, func, parent);

        this.string = string;

        this._menu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.BOTTOM, 0);
        this._menu.blockSourceEvents = true;
        this._menu._source = this;
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this._menu);

        this._menu.addAction(_("Remove"), Lang.bind(this, this.remove));
        this._menu.addAction(_("Edit Place"), Lang.bind(this, function(event){
            let dialog = new AddPlacesDialog(menuSettings.get_strv("places-list").indexOf(this.string), this.string);
            dialog.open(event.get_time());
        }));

        this._menu.addAction(_("New Place"), Lang.bind(this, function(event){
            let dialog = new AddPlacesDialog(menuSettings.get_strv("places-list").indexOf(this.string), "::folder::");
            dialog.open(event.get_time());
        }));
        this._menu.close();
        this._draggable = DND.makeDraggable(this.actor);
    },

    _onButtonReleaseEvent: function(actor, event){
        if (event.get_button()==1){
            if (this._menu.isOpen)
                this._menu.toggle();
            else
                this.activate(event);
        }
        if (event.get_button() == 3){
            this._menu.toggle();
        }
    },

    remove: function(){
        let list = menuSettings.get_strv("places-list");
        for (let i = 0; i < list.length; i++){
            if (list[i] == this.string){
                list.splice(i, 1);
                break;
            }
        }
        menuSettings.set_strv("places-list", list);
    },

    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    getDragActorSource: function() {
        return this.actor;
    },
}

function PlacesBox(menu){
    this._init(menu);
}

PlacesBox.prototype = {
    _init: function(menu){
        this.actor = new St.BoxLayout({vertical: true});
        this.buttons = new St.BoxLayout({vertical: true});
	this.menu = menu;
	this.label = new St.Label({text: "Places", style_class: 'largeBold'});
	this.actor.add(this.label);
	this.actor.add(this.buttons);

        this.addButtons();

        menuSettings.connect("changed::places-list", Lang.bind(this, this.addButtons));
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;

        this.buttons._delegate = this;
    },

    addButtons: function(){
        this.actor.remove_actor(this.buttons);
        this.buttons.get_children().forEach(Lang.bind(this, function(child){
            child.destroy();
        }));

        this.actor.add_actor(this.buttons);
        this.buttonList = menuSettings.get_strv("places-list");

        for (let i = 0; i < this.buttonList.length; i++){
            let prop = this.buttonList[i].split("::");
            let item = new PlacesMenuItem(_(prop[0]), prop[1], "Util.spawnCommandLine('nautilus " + prop[2] + "')", this.menu, this.buttonList[i]);
            let buttonBox = new St.BoxLayout({vertical: true});
            buttonBox.add_actor(item.actor);
            buttonBox.item = item;
            this.buttons.add_actor(buttonBox);
        }
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (!(source instanceof PlacesMenuItem)) return DND.DragMotionResult.NO_DROP;
        let children = this.buttons.get_children();
        let windowPos = children.indexOf(source.actor.get_parent());

        let pos = 0;
        for (var i in children){
            if (y > children[i].get_allocation_box().y1 + children[i].height / 2) pos = i;
        }

        if (pos != this._dragPlaceholderPos){
            this._dragPlaceholderPos = pos;
            if (windowPos != -1 && pos == windowPos) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                                                        Lang.bind(this, function() {
                                                            this._animatingPlaceholdersCount --;
                                                        }));
                }
                this._dragPlaceholder = null;
                return DND.DragMotionResult.CONTINUE;
            }

            let fadeIn = true;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width(source.actor.width);
            this._dragPlaceholder.child.set_height(source.actor.height);

            this.buttons.insert_actor(this._dragPlaceholder.actor, this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }
        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (!(source instanceof PlacesMenuItem)) return false;

        this.buttons.move_child(source.actor.get_parent(), this._dragPlaceholderPos);
        let removePos = this.buttonList.indexOf(source.actor._delegate.string);
        if (this._dragPlaceholderPos < removePos)
            removePos++;

        this.buttonList.splice(this._dragPlaceholderPos, 0, source.actor._delegate.string);
        this.buttonList.splice(removePos, 1);
        this._clearDragPlaceholder();
        actor.destroy();

        Mainloop.timeout_add(100, Lang.bind(this, this.writeSettings));
        return true;
    },

    writeSettings: function(){
        menuSettings.set_strv("places-list", this.buttonList);
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder){
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }
}

function SystemBox(menu){
    this._init(menu);
}

SystemBox.prototype = {
    _init: function(menu){
        this.actor = new St.BoxLayout({vertical: true});
        this.buttons = new St.BoxLayout({vertical: true});
	this.menu = menu;
        this.addButtons();
    },

    addButtons: function(){
	this.label = new St.Label({text: "System", style_class: 'largeBold'});

	this.packageItem = new PackageItem(this.menu);
        this.control = new LeftBoxItem(_("Control Center"), "gnome-control-center", "Util.spawnCommandLine('gnome-control-center')", this.menu);
        this.terminal = new LeftBoxItem(_("Terminal"), "terminal", "Util.spawnCommandLine('gnome-terminal')", this.menu);
        this.lock = new LeftBoxItem(_("Lock"), "gnome-lockscreen", "screenSaverProxy.LockRemote()", this.menu);
        this.logout = new LeftBoxItem(_("Logout"), "gnome-logout", "session.LogoutRemote(0)", this.menu);
        this.shutdown = new LeftBoxItem(_("Quit"), "gnome-shutdown", "session.ShutdownRemote()", this.menu);

 	this.actor.add(this.label);
        this.actor.add(this.buttons);

        this.buttons.add(this.packageItem.actor);
        this.buttons.add(this.control.actor);
        this.buttons.add(this.terminal.actor);
        this.buttons.add(this.lock.actor);
        this.buttons.add(this.logout.actor);
        this.buttons.add(this.shutdown.actor);
    }
}
