
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;








function UnfreezeCinnamonHoverMenu(applet, orientation){
    this._init(applet, orientation);
}

UnfreezeCinnamonHoverMenu.prototype={

    _init: function(applet, orientation) {

        this.applet = applet;
        this.orientation = orientation;

        this.default_handler_id = 0;
        this.enter_handler_id = this.default_handler_id;
        this.leave_handler_id = this.default_handler_id

        this.menu = new Applet.AppletPopupMenu(applet, this.orientation);

        this._init_menu();
        this._add_menu_to_applet();
        this.enable();
    },

    _init_menu: function(){
        this.menu.actor.width = 0;
        this.menu.actor.height = 0;
    },

    _add_menu_to_applet: function(){
        this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.menuManager.addMenu(this.menu);
    },

    enable: function(){
        this._connect_hover_signals();
    },

    disable: function(){
        this._disconnect_hover_signals();
    },

    _connect_hover_signals: function(){
        if(!this._hover_handlers_connected()) {
        	let applet_actor = this.applet.actor;
        	this.enter_handler_id = applet_actor.connect("enter-event", Lang.bind(this, this._on_hover_enter));
        	this.leave_handler_id = applet_actor.connect("leave-event", Lang.bind(this, this._on_hover_leave));
        }
    },

    _hover_handlers_connected: function(){
        return this.enter_handler_id != this.default_handler_id &&
        	   this.leave_handler_id != this.default_handler_id;
    },

    _disconnect_hover_signals: function(){
        let applet_actor = this.applet.actor;
        applet_actor.disconnect(this.enter_handler_id);
        applet_actor.disconnect(this.leave_handler_id);
        this._set_default_id_hover_handlers();
    },

    _set_default_id_hover_handlers: function(){
        this.enter_handler_id = this.default_handler_id;
        this.leave_handler_id = this.default_handler_id;
    },

    _on_hover_enter: function(){
        this.open();
    },

    _on_hover_leave: function(){
        this.close();
    },

    open: function(){
        this.menu.open();
    },

    close: function(){
        this.menu.close();
    },
}




