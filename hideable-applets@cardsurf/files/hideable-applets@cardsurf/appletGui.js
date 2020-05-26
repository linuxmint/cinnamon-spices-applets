
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Tooltips = imports.ui.tooltips;

const uuid = "hideable-applets@cardsurf";
let AppletConstants;
if (typeof require !== 'undefined') {
    AppletConstants = require('./appletConstants');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletConstants = AppletDirectory.appletConstants;
}








function CheckboxMenuItem(applet, title) {
    this._init(applet, title);
};

CheckboxMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(applet, title) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, title, false);

        this.applet = applet;

        this.options = [];
        this.callback_object = null;
        this.callback_option_toggled = null;
    },

    reload_options: function(option_names, options_checked) {
        this.remove_options();
        this.create_options(option_names, options_checked);
        this.add_options(option_names);
    },

    remove_options: function() {
         this.menu.removeAll()
         this.options = [];
    },

    create_options: function(option_names, options_checked) {
        for(let i = 0; i < option_names.length; ++i) {
             let option_name = option_names[i];
             let option_checked = options_checked[i];
             let option = new PopupMenu.PopupSwitchMenuItem(option_name, option_checked);
             option.connect('toggled', Lang.bind(this, this._on_option_toggled));
             this.options.push(option);
        }
    },

    _on_option_toggled: function (option, checked) {
        this._invoke_callback_option_toggled(option, checked);
    },

    _invoke_callback_option_toggled: function(option, checked) {
        if(this.callback_option_toggled != null) {
            let option_index = this.options.indexOf(option);
            let option_name = this.get_option_name(option);
            this.callback_option_toggled.call(this.callback_object, option_index, option_name, checked);
        }
    },

    get_option_name: function(option) {
        return option.label.get_text();
    },

    add_options: function(option_names) {
        let sort_alphabetically = this.applet.is_gui_sorted_alphabetically();
        if(sort_alphabetically) {
            this.add_options_sorted_alphabetically(option_names);
        }
        else {
            this.add_options_sorted_panel_position();
        }
    },

    add_options_sorted_alphabetically: function(option_names) {
        let indexes = this.applet.get_sorted_indexes(option_names);
        for(let index of indexes) {
            let option = this.options[index];
            this.menu.addMenuItem(option);
        }
    },

    add_options_sorted_panel_position: function() {
        for(let option of this.options) {
            this.menu.addMenuItem(option);
        }
    },

    set_callback_option_toggled: function(callback_object, callback_option_toggled) {
        this.callback_object = callback_object;
        this.callback_option_toggled = callback_option_toggled;
    },

};








function HoverMenuIcons(applet, orientation){
    this._init(applet, orientation);
}

HoverMenuIcons.prototype={

    _init: function(applet, orientation) {

        this.applet = applet;
        this.orientation = orientation;

        this.columns = 3;
        this.icon_size = 40;
        this.max_characters_tooltip_line = 20;
        this.max_tooltip_width = 200;
        this.default_handler_id = 0;
        this.leave_handler_id = this.default_handler_id;
        this.callback_object = null;
        this.callback_icon_clicked = null;
        this.grayscale_effect_name = "grayscale";
        this.grayscale_color = new Clutter.Color({ red: 204, green: 204, blue: 204, alpha: 1 });

        this.menu = new Applet.AppletPopupMenu(applet, this.orientation);
        this.actor = new St.Table({style_class: "switcher-list"});
        this.icons = [];
        this.tooltips = [];
        this.grayscale_effects = [];

        this._init_menu();

        this._add_menu_to_applet();
        this.enable();
    },

    _init_menu: function(){
        this.menu.passEvents = true;
        this.menu.blockSourceEvents = false;
        this.menu.box.style_class = null;
        this.menu.addActor(this.actor);
    },

    _add_menu_to_applet: function(){
        this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.menuManager.addMenu(this.menu);
    },

    reload_icons: function(icon_paths, icon_names) {
        this.remove_icons();
        this.create_icons(icon_paths);
        this.create_tooltips(icon_names);
        this.create_grayscale_effects();
        this.add_icons(icon_names);
    },

    remove_icons: function() {
         this.actor.destroy_all_children();
         this.icons = [];
         this.tooltips = [];
         this.grayscale_effects = [];
    },

    create_icons: function(icon_paths) {
        for(let i = 0; i < icon_paths.length; ++i) {
             let icon_path = icon_paths[i];
             let icon = this.create_icon(icon_path);
             icon.connect('button-press-event', Lang.bind(this, this._on_icon_clicked));
             this.icons.push(icon);
        }
    },

    create_icon: function(icon_path) {
        let icon = this.is_file_icon(icon_path) ? this.create_file_icon(icon_path) :
                                                  this.create_system_icon(icon_path);
        icon.set_icon_size(this.icon_size);
        return icon;
    },

    is_file_icon: function(icon_path) {
        return icon_path.indexOf(".") >= 0;
    },

    create_file_icon: function(icon_path) {
        let icon_file = this.load_icon_file(icon_path);
        let icon = this.create_icon_tooltip_click_support();
        icon.set_gicon(icon_file);
        return icon;
    },

    create_icon_tooltip_click_support: function() {
        let icon = new St.Icon({ reactive: true, track_hover: true });
        return icon;
    },

    load_icon_file: function(icon_path) {
        icon_path = this.applet.format_path(icon_path);
        let icon_file = Gio.file_new_for_path(icon_path);
        icon_file = new Gio.FileIcon({ file: icon_file });
        return icon_file;
    },

    create_system_icon: function(icon_path) {
        let icon = this.create_icon_tooltip_click_support();
        icon.set_icon_name(icon_path);
        icon.set_icon_type(St.IconType.FULLCOLOR);
        return icon;
    },

    _on_icon_clicked: function (actor, event) {
        this._invoke_callback_icon_clicked(actor);
    },

    _invoke_callback_icon_clicked: function(actor) {
        if(this.callback_icon_clicked != null) {
            let icon_index = this.icons.indexOf(actor);
            this.callback_icon_clicked.call(this.callback_object, icon_index);
        }
    },

    create_tooltips: function(icon_names) {
        for(let i = 0; i < this.icons.length; ++i) {
            let icon = this.icons[i];
            let icon_name = icon_names[i];
            let tooltip = this.create_tooltip(icon, icon_name);
            this.tooltips.push(tooltip);
        }
    },

    create_tooltip: function(icon, icon_name) {
        let tooltip = new Tooltips.Tooltip(icon, "");
        tooltip._tooltip.clutter_text.set_line_wrap(true);
        if(icon_name.length > this.max_characters_tooltip_line) {
            tooltip._tooltip.set_width(this.max_tooltip_width);
        }
        return tooltip;
    },

    create_grayscale_effects: function(){
        for(let i = 0; i < this.icons.length; ++i) {
            let effect = this.create_grayscale_effect();
            this.grayscale_effects.push(effect);
        }
    },

    create_grayscale_effect: function(){
        let effect = new Clutter.ColorizeEffect(this.grayscale_color);
        effect.set_tint(this.grayscale_color);
        return effect;
    },

    add_icons: function(icon_names) {
        let sort_alphabetically = this.applet.is_gui_sorted_alphabetically();
        if(sort_alphabetically) {
            this.add_icons_sorted_alphabetically(icon_names);
        }
        else {
            this.add_icons_sorted_panel_position();
        }
    },

    add_icons_sorted_alphabetically: function(icon_names) {
        let indexes = this.applet.get_sorted_indexes(icon_names);
        for(let i = 0; i < this.icons.length; ++i) {
            let index = indexes[i];
            let icon = this.icons[index];
            this.add_icon_table(icon, i);
        }
    },

    add_icon_table: function(icon, icon_index) {
        let row_index = Math.floor(icon_index / this.columns);
        let column_index = icon_index % this.columns;
        this.actor.add(icon, {row: row_index, col: column_index});
    },

    add_icons_sorted_panel_position: function() {
        for(let i = 0; i < this.icons.length; ++i) {
            let icon = this.icons[i];
            this.add_icon_table(icon, i);
        }
    },

    set_columns: function(columns) {
        this.columns = columns;
    },

    set_icons_size: function(icon_size) {
        this.icon_size = icon_size;
        for(let icon of this.icons) {
            icon.set_icon_size(this.icon_size);
        }
    },

    set_icons_style: function(css_style) {
        this._set_widgets_style(css_style, this.icons);
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

    set_table_style: function(css_style) {
        this._set_widgets_style(css_style, [this.actor]);
    },

    set_icon_tooltip_texts: function(tooltip_texts) {
        for(let i = 0; i < this.tooltips.length; ++i) {
            let tooltip_text = tooltip_texts[i];
            let tooltip = this.tooltips[i];
            tooltip.set_text(tooltip_text);
        }
    },

    set_grayscale_brightness: function(brightness_zero_hundred) {
        let brightness_rgb = this.get_brightness_rgb(brightness_zero_hundred);
        this.grayscale_color = new Clutter.Color({ red: brightness_rgb, green: brightness_rgb,
                                                   blue: brightness_rgb, alpha: 1 });
    },

    get_brightness_rgb: function(brightness_zero_hundred) {
        let brightness_zero_one = brightness_zero_hundred / 100;
        let brightness_rgb = this.get_scaled_value(0, 255, brightness_zero_one);
        return brightness_rgb;
    },

    get_scaled_value: function(min_value, max_value, zero_one_range_value) {
        let offset = min_value;
        let multiplier = max_value - min_value;
        let mapped_value = Math.round(offset + zero_one_range_value * multiplier);
        return mapped_value;
    },

    set_grayscales: function(is_grayscale_on_array) {
        for(let icon_index = 0; icon_index < is_grayscale_on_array.length; ++icon_index) {
             let is_grayscale_on = is_grayscale_on_array[icon_index];
             this.set_grayscale(icon_index, is_grayscale_on);
        }
    },

    set_grayscale: function(icon_index, is_grayscale_on) {
        let icon = this.icons[icon_index];
        if(is_grayscale_on) {
            let effect = this.grayscale_effects[icon_index];
            this.add_grayscale(icon, effect);
        }
        else {
            this.remove_grayscale(icon);
        }
    },

    add_grayscale: function(icon, effect) {
        let enabled = this.has_grayscale(icon);
        if(!enabled) {
            icon.add_effect_with_name(this.grayscale_effect_name, effect);
        }
    },

    has_grayscale: function(icon) {
        let effect = icon.get_effect(this.grayscale_effect_name);
        return effect != null;
    },

    remove_grayscale: function(icon) {
        let enabled = this.has_grayscale(icon);
        if(enabled) {
            icon.remove_effect_by_name(this.grayscale_effect_name);
        }
    },

    enable: function(){
        this._connect_hover_signals();
    },

    disable: function(){
        this._disconnect_hover_signals();
    },

    _connect_hover_signals: function(){
        if(!this._hover_handlers_connected()) {
            this.leave_handler_id = this.menu.actor.connect("leave-event", Lang.bind(this, this._on_hover_leave));
        }
    },

    _hover_handlers_connected: function(){
        return this.leave_handler_id != this.default_handler_id;
    },

    _on_hover_leave: function(actor, event) {
        this.applet.on_hover_leave(actor, event);
    },

    _disconnect_hover_signals: function(){
        this.menu.actor.disconnect(this.leave_handler_id);
        this._set_default_id_hover_handlers();
    },

    _set_default_id_hover_handlers: function(){
        this.leave_handler_id = this.default_handler_id;
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

    set_callback_icon_clicked: function(callback_object, callback_icon_clicked) {
        this.callback_object = callback_object;
        this.callback_icon_clicked = callback_icon_clicked;
    },

}



