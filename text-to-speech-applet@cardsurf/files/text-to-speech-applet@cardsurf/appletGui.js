
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;




function AppletGui(panel_height) {
	this._init(panel_height);
};

AppletGui.prototype = {

    _init: function(panel_height) {

		this.panel_height = panel_height;

		this.actor = new St.BoxLayout();
		this.icon = new St.Icon();

		this._init_icon();
		this._init_actor();
    },

	_init_icon: function() {
		let size = this.panel_height * 0.85;
		this.icon.set_icon_size(size);
	},

	_init_actor: function() {
		this.actor.add(this.icon);
	},

	set_icon: function(icon_path) {
		let icon_file = this._load_icon_file(icon_path);
   	    this._set_gicon(icon_file);
	},

    _load_icon_file: function(icon_path) {
		icon_path = this._replace_tilde_with_home_directory(icon_path)
        let icon_file = Gio.file_new_for_path(icon_path);
        let icon_file = new Gio.FileIcon({ file: icon_file });
		return icon_file;
    },

	_replace_tilde_with_home_directory: function (path) {
		let home_directory = GLib.get_home_dir();
		path = path.replace("~", home_directory);
		return path;
	},

    _set_gicon: function(file_icon) {
		this.icon.set_gicon(file_icon);
    },

};





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




