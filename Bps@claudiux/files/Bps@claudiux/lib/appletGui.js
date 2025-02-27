
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Cairo = imports.cairo;
const Gettext = imports.gettext;
const {
  _sourceIds,
  timeout_add_seconds,
  timeout_add,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
} = require("./lib/mainloopTools");

const UUID = "Bps@claudiux";
const CssStylization = require('./lib/cssStylization');

const DecimalPlaces = {
    AUTO: -1,
    ZERO: 0,
    ONE: 1,
    TWO: 2,
    THREE: 3
}

const BytesStartTime = {
    START_OF_CURRENT_SESSION : -1,
    TODAY: 0,
    YESTERDAY : 1,
    THREE_DAYS_AGO : 3,
    FIVE_DAYS_AGO : 5,
    SEVEN_DAYS_AGO : 7,
    TEN_DAYS_AGO : 10,
    FOURTEEN_DAYS_AGO : 14,
    THIRTY_DAYS_AGO: 30,
    CUSTOM_DATE : -2
}


function _(str) {
    return Gettext.dgettext(UUID, str);
}

function IconLabel() {
    this._init();
};

IconLabel.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.icon = new St.Icon();
        this.label = new St.Label();

        this.actor.add(this.icon);
        this.actor.add(this.label);
    },

    set_gicon: function(file_icon) {
        this.icon.set_gicon(file_icon);
    },

    set_icon_size: function(size) {
        this.icon.set_icon_size(size);
    },

    set_label_style: function(css_style) {
        this.label.set_style(css_style);
    },

    set_label_width: function(width) {
        this.label.set_width(width);
    },

    set_label_text: function(text) {
        this.label.set_text(text);
    },

    set_label_to_preferred_width: function() {
        this.set_label_width(-1);
    },

    set_label_fixed_width: function(fixed_width_text) {
        timeout_add_seconds(1, () => {
            this.set_label_to_preferred_width();
            this.set_label_text(fixed_width_text);

            let text = this.label.get_text();
            let fixed_width = this.label.get_width();

            if (fixed_width) {
                this.set_label_width(fixed_width);
            }

            if (text) {
                this.set_label_text(text);
            }

            return false;
        });
    },

};








function GuiSpeed(panel_height, gui_speed_type, gui_value_order, decimal_places, is_binary) {
    this._init(panel_height, gui_speed_type, gui_value_order, decimal_places, is_binary);
};

GuiSpeed.prototype = {

    _init: function(panel_height, gui_speed_type, gui_value_order, decimal_places, is_binary=false) {

        this.panel_height = panel_height;
        this.gui_speed_type = gui_speed_type;
        this.gui_value_order = gui_value_order;
        this.decimal_places = decimal_places;
        this.text_spacing = 5;
        this.is_binary = is_binary;

        this.actor = new St.BoxLayout();
        this.iconlabel_received = new IconLabel();
        this.iconlabel_sent = new IconLabel();
        this.css_styler = new CssStylization.CssStringStyler();

        this._init_actor();
    },

    _init_actor: function() {
        if (this.panel_height >= 40 * global.ui_scale)
            this.actor.set_vertical(true);

        if(this.gui_value_order === 0) { // download first
            this._init_actor_download_first();
        }
        else { // upload first
            this._init_actor_upload_first();
        }
    },

    _init_actor_download_first: function(){
        this.actor.add(this.iconlabel_received.actor);
        this.actor.add(this.iconlabel_sent.actor);
    },

    _init_actor_upload_first: function(){
        this.actor.add(this.iconlabel_sent.actor);
        this.actor.add(this.iconlabel_received.actor);
    },

    set_reveived_icon: function(icon_path) {
        this._set_icon(this.iconlabel_received, icon_path);
    },

    set_sent_icon: function(icon_path) {
        this._set_icon(this.iconlabel_sent, icon_path);
    },

    _set_icon: function(iconlabel, icon_path) {
        let icon_file = this._load_icon_file(icon_path);
           iconlabel.set_gicon(icon_file);
    },

    _load_icon_file: function(icon_path) {
        icon_path = this._remove_file_schema(icon_path);
        icon_path = this._replace_tilde_with_home_directory(icon_path)
        let icon_file = Gio.file_new_for_path(icon_path);
        icon_file = new Gio.FileIcon({ file: icon_file });
        return icon_file;
    },

    _remove_file_schema: function (path) {
        path = path.replace("file://", "");
        return path;
    },

    _replace_tilde_with_home_directory: function (path) {
        let home_directory = GLib.get_home_dir();
        path = path.replace("~", home_directory);
        return path;
    },

    set_text_style: function(css_style) {
        css_style = this.add_font_size(css_style);
        for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
            iconlabel.set_label_style(css_style);
        }

        this._resize_gui_elements_to_match_text(css_style);
    },

    add_font_size: function(css_style) {
        let font_size = this.css_styler.get_numeric_value_or_null(css_style, "font-size");
        if(font_size == null) {
            css_style = this._calculate_font_size_and_add(css_style);
        }
        return css_style;
    },

    _calculate_font_size_and_add: function(css_style) {
        let font_size = this._calculate_font_size();
        let attributes = ["font-size: " + font_size + "px"];
        css_style = this.css_styler.set_attributes(css_style, attributes);
        return css_style;
    },

    _calculate_font_size: function() {
         let size = this.panel_height * 0.5;
         size /= global.ui_scale;
         size -= this.text_spacing;
         return size;
    },

    _resize_gui_elements_to_match_text: function(css_style) {
        this._set_icons_height_to_font_size(css_style);
        this._set_labels_width_fixed_or_styled(css_style);
    },

    _set_icons_height_to_font_size: function(css_style) {
        let font_size = this.css_styler.get_numeric_value_or_null(css_style, "font-size");
        for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
            iconlabel.set_icon_size(font_size);
        }
    },

    _set_labels_width_fixed_or_styled: function(css_style) {
        let width = this.css_styler.get_numeric_value_or_null(css_style, "width");
        if(width == null) {
            this._set_labels_fixed_width();
        }
        else {
            this._set_labels_styled_width(width);
        }
    },

    _set_labels_fixed_width: function() {
        let fixed_width_text = this._get_fixed_width_text();
        for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
            iconlabel.set_label_fixed_width(fixed_width_text);
        }
    },

    _get_fixed_width_text: function() {
        let text = "";
        if(this.decimal_places == DecimalPlaces.AUTO) {
            text = (this.is_binary) ? " 999.9 MiB " : " 999.9 MB ";
        }
        else {
            text = " 999." + this.repeat_string("9", this.decimal_places);
            text += (this.is_binary) ? " MiB " : " MB ";
        }
        return text;
    },

    repeat_string: function(str, repetitions) {
        let array = Array(repetitions + 1);
        let output_string = array.join(str);
        return output_string;
    },

    _set_labels_styled_width: function(width) {
        for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
            iconlabel.set_label_width(width);
        }
    },

    set_received_text: function(text) {
        let label = this.iconlabel_received.label;
        label.set_text(text);
    },

    set_sent_text: function(text) {
        let label = this.iconlabel_sent.label;
        label.set_text(text);
    },

    set_decimal_places: function(decimal_places) {
        this.decimal_places = decimal_places;
        this._set_labels_fixed_width();
    },

};






function RadioMenuItem(title, option_names) {
    this._init(title, option_names);
};

RadioMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(title, option_names) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, title, false);

        this.options = [];
        this.active_option_index = -1;
        this.callback_object = null;
        this.callback_option_clicked = null;
        this._add_options(option_names);
    },

    _add_options: function(option_names) {
        for(let option_name of option_names) {
             let option = new PopupMenu.PopupMenuItem(option_name, false);
             option.connect('activate', (option, event) => { this._on_option_clicked(option, event) });
             this.menu.addMenuItem(option);
             this.options.push(option);
        }
    },

    _on_option_clicked: function (option, event) {
        let index_clicked = this.options.indexOf(option);
        this.set_active_option(index_clicked);
        this._invoke_callback_option_clicked();
    },

    reload_options: function(option_names) {
        this._remove_options();
        this._add_options(option_names);
    },

    _remove_options: function() {
         this.menu.removeAll()
         this.options = [];
         this.active_option_index = -1;
    },

    set_active_option: function(index) {
        if(this.active_option_index != index) {
            if(this.active_option_index != -1) {
                this.set_font_weight(this.active_option_index, "normal");
            }
            this.set_font_weight(index, "bold");
            this.active_option_index = index;
        }
    },

    set_font_weight: function(option_index, font_weight) {
        let css_style = "font-weight: " + font_weight + ";";
        let option = this.options[option_index];
        this.set_option_style(option, css_style);
    },

    set_option_style: function(option, css_style) {
        option.label.set_style(css_style);
    },

    _invoke_callback_option_clicked: function() {
        if(this.callback_option_clicked != null) {
            let option = this.get_active_option();
            let option_name = this.get_option_name(option);
            this.callback_option_clicked.call(this.callback_object, option_name, this.active_option_index);
        }
    },

    get_active_option: function() {
        return this.options[this.active_option_index];
    },

    get_option_name: function(option) {
        return option.label.get_text();
    },

    get_active_option_index: function(active_option_index) {
        return this.active_option_index;
    },

    set_callback_option_clicked: function(callback_object, callback_option_clicked) {
        this.callback_object = callback_object;
        this.callback_option_clicked = callback_option_clicked;
    },
};








function CheckboxMenuItem( title) {
    this._init(title);
};

CheckboxMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(title) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, title, false);

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
             option.connect('toggled', (option, checked) => { this._on_option_toggled(option, checked) });
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
        for(let option of this.options) {
            this.menu.addMenuItem(option);
        }
    },

    set_callback_option_toggled: function(callback_object, callback_option_toggled) {
        this.callback_object = callback_object;
        this.callback_option_toggled = callback_option_toggled;
    },

};







//~ function HoverMenuTotalBytes(applet, orientation, gui_value_order){
    //~ this._init(applet, orientation, gui_value_order);
//~ }

//~ HoverMenuTotalBytes.prototype={

    //~ _init: function(applet, orientation, gui_value_order) {

        //~ this.applet = applet;
        //~ this.orientation = orientation;
        //~ this.gui_value_order = gui_value_order;

        //~ this.default_handler_id = 0;
        //~ this.enter_handler_id = this.default_handler_id;
        //~ this.leave_handler_id = this.default_handler_id;

        //~ this.menu = new Applet.AppletPopupMenu(applet, this.orientation);
        //~ this.actor = new St.Table({style_class: "switcher-list"});
        //~ this.label_text_received = new St.Label();
        //~ this.label_bytes_received = new St.Label();
        //~ this.label_text_sent = new St.Label();
        //~ this.label_bytes_sent = new St.Label();

        //~ this._init_labels();
        //~ this._init_actor();
        //~ this._init_menu();
        //~ this._add_menu_to_applet();
        //~ this.enable();
    //~ },

    //~ _init_labels: function(){
        //~ this.label_text_received.set_text(_("Total download:"));
        //~ this.label_text_sent.set_text(_("Total upload:"));
    //~ },

    //~ set_text_style: function(css_style) {
        //~ this._set_widgets_style(css_style, [this.label_text_received, this.label_text_sent]);
    //~ },

    //~ set_numbers_style: function(css_style) {
        //~ this._set_widgets_style(css_style, [this.label_bytes_received, this.label_bytes_sent]);
    //~ },

    //~ _set_widgets_style: function(css_style, widgets){
        //~ css_style = this._append_semicolon(css_style);
        //~ for(let widget of widgets){
            //~ widget.set_style(css_style);
        //~ }
    //~ },

    //~ _append_semicolon: function(css_style){
        //~ css_style = css_style.trim();
        //~ let last_char = css_style.slice(-1);
        //~ let semicolon = ';';
        //~ if (last_char != semicolon) {
            //~ css_style += semicolon;
        //~ }
        //~ return css_style;
    //~ },

    //~ _init_actor: function(){
        //~ if(this.gui_value_order === 0) { // download first
            //~ this._init_actor_download_first();
        //~ }
        //~ else { // upload first
            //~ this._init_actor_upload_first();
        //~ }
    //~ },

    //~ _init_actor_download_first: function(){
        //~ this.actor.add(this.label_text_received, {row: 0, col: 0});
        //~ this.actor.add(this.label_bytes_received, {row: 0, col: 1});
        //~ this.actor.add(this.label_text_sent, {row: 1, col: 0});
        //~ this.actor.add(this.label_bytes_sent, {row: 1, col: 1});
    //~ },

    //~ _init_actor_upload_first: function(){
        //~ this.actor.add(this.label_text_sent, {row: 0, col: 0});
        //~ this.actor.add(this.label_bytes_sent, {row: 0, col: 1});
        //~ this.actor.add(this.label_text_received, {row: 1, col: 0});
        //~ this.actor.add(this.label_bytes_received, {row: 1, col: 1});
    //~ },

    //~ _init_menu: function(){
        //~ this.menu.box.style_class = null;
        //~ this.menu.addActor(this.actor);
    //~ },

    //~ _add_menu_to_applet: function(){
        //~ this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        //~ this.menuManager.addMenu(this.menu);
    //~ },

    //~ enable: function(){
        //~ this._connect_hover_signals();
    //~ },

    //~ disable: function(){
        //~ this._disconnect_hover_signals();
    //~ },

    //~ _connect_hover_signals: function(){
        //~ if(!this._hover_handlers_connected()) {
            //~ let applet_actor = this.applet.actor;
            //~ this.enter_handler_id = applet_actor.connect("enter-event", () => { this._on_hover_enter() });
            //~ this.leave_handler_id = applet_actor.connect("leave-event", () => { this._on_hover_leave() });
        //~ }
    //~ },

    //~ _hover_handlers_connected: function(){
        //~ return this.enter_handler_id != this.default_handler_id &&
               //~ this.leave_handler_id != this.default_handler_id;
    //~ },

    //~ _disconnect_hover_signals: function(){
        //~ let applet_actor = this.applet.actor;
        //~ applet_actor.disconnect(this.enter_handler_id);
        //~ applet_actor.disconnect(this.leave_handler_id);
        //~ this._set_default_id_hover_handlers();
    //~ },

    //~ _set_default_id_hover_handlers: function(){
        //~ this.enter_handler_id = this.default_handler_id;
        //~ this.leave_handler_id = this.default_handler_id;
    //~ },

    //~ _on_hover_enter: function(){
        //~ this.open();
    //~ },

    //~ _on_hover_leave: function(){
        //~ this.close();
    //~ },

    //~ open: function(){
        //~ this.menu.open();
    //~ },

    //~ close: function(){
        //~ this.menu.close();
    //~ },

    //~ set_text: function(received_total, sent_total){
        //~ this.label_bytes_received.set_text(received_total.toString());
        //~ this.label_bytes_sent.set_text(sent_total.toString());
    //~ },

//~ }
