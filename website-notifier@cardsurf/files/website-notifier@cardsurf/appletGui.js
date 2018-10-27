
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Cairo = imports.cairo;

const uuid = "website-notifier@cardsurf";
let AppletConstants, CssStylization;
if (typeof require !== 'undefined') {
    AppletConstants = require('./appletConstants');
    CssStylization = require('./cssStylization');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletConstants = AppletDirectory.appletConstants;
    CssStylization = AppletDirectory.cssStylization;
}






function AppletMenuNotification(applet, orientation){
    this._init(applet, orientation);
}

AppletMenuNotification.prototype={

    _init: function(applet, orientation) {

        this.applet = applet;
        this.orientation = orientation;

        this.default_handler_id = 0;
        this.enter_handler_id = this.default_handler_id;
        this.leave_handler_id = this.default_handler_id;

        this.menu = new Applet.AppletPopupMenu(applet, this.orientation);
        this.actor = new St.BoxLayout();
        this.label_title = new St.Label();
        this.label_message = new St.Label();

        this._init_labels();
        this._init_actor();
        this._init_menu();
        this._add_menu_to_applet();
    },

    _init_labels: function(){
        this.label_title.set_text("");
        this.label_message.set_text("");
        this.label_title.clutter_text.set_line_wrap(true);
        this.label_message.clutter_text.set_line_wrap(true);
    },

    _init_actor: function(){
        this.actor.set_vertical(true);
        this.actor.add(this.label_title);
        this.actor.add(this.label_message);
    },

    _init_menu: function(){
        this.menu.box.style_class = null;
        this.menu.addActor(this.actor);
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

    toggle: function(){
        this.menu.toggle();
    },

    set_title_style: function(css_style) {
        this._set_widgets_style(css_style, [this.label_title]);
    },

    _set_widgets_style: function(css_style, widgets){
        css_style = this._append_semicolon(css_style);
        for(let widget of widgets){
            widget.set_style(css_style);
        }
    },

    _append_semicolon: function(css_style){
        css_style = css_style.trim();
        let last_char = css_style.slice(-1);
        let semicolon = ';';
        if (last_char != semicolon) {
            css_style += semicolon;
        }
        return css_style;
    },

    set_message_style: function(css_style) {
        this._set_widgets_style(css_style, [this.label_message]);
    },

    set_text: function(title_text, message_text){
        this.label_title.set_text(title_text);
        this.label_message.set_text(message_text);
    },

    set_size: function(width, height){
        this.actor.width = width;
        this.actor.height = height;
    },

    connect_pressed_signal: function(callback_object, callback_function){
        this.menu.actor.connect('button-press-event', Lang.bind(callback_object, callback_function));
    },

}


