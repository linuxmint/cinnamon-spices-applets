
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const uuid = 'brightness-and-gamma-applet@cardsurf';

const AppletConstants = require('./lib/appletConstants');

// Translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(uuid, str);
}

class RadioMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    constructor(title, option_names) {
        super(title, false);

        this.options = [];
        this.dictionary_option_name_index = {};
        this.active_option_index = -1;
        this.callback_object = null;
        this.callback_option_clicked = null;
        this._init_options(option_names);
    }

    _init_options(option_names) {
        for(let option_name of option_names) {
             let option = new PopupMenu.PopupMenuItem(option_name, false);
             option.connect('activate', Lang.bind(this, this._on_option_clicked));
             this.menu.addMenuItem(option);
             this.options.push(option);
             this.dictionary_option_name_index[option_name] = this.options.length - 1;
        }
    }

    _on_option_clicked(option, event) {
        let index_clicked = this.options.indexOf(option);
        this.set_active_option_index(index_clicked);
        this._invoke_callback_option_clicked();
    }

    set_active_option_name(option_name) {
        let valid = this.is_option_name_valid(option_name);
        if(valid) {
            let index = this.dictionary_option_name_index[option_name];
            this.set_active_option_index(index);
        }
    }

    is_option_name_valid(option_name) {
        return this.dictionary_contains(this.dictionary_option_name_index, option_name);
    }

    dictionary_contains(dictionary, key) {
        return key in dictionary;
    }

    set_active_option_index(index) {
        let valid = this.is_option_index_valid(index);
        if(valid) {
            this.set_active_option_index_valid(index);
        }
    }

    is_option_index_valid(index) {
        return index >= 0 && index < this.options.length;
    }

    set_active_option_index_valid(index) {
        if(this.active_option_index != index) {
            if(this.active_option_index != -1) {
                this.set_font_weight(this.active_option_index, "normal");
            }
            this.set_font_weight(index, "bold");
            this.active_option_index = index;
        }
    }

    set_font_weight(option_index, font_weight) {
        let css_style = "font-weight: " + font_weight + ";";
        let option = this.options[option_index];
        this.set_option_style(option, css_style);
    }

    set_font_weight(option_index, font_weight) {
        let css_style = "font-weight: " + font_weight + ";";
        let option = this.options[option_index];
        this.set_option_style(option, css_style);
    }

    set_option_style(option, css_style) {
        option.label.set_style(css_style);
    }

    _invoke_callback_option_clicked() {
        if(this.callback_option_clicked != null) {
            let option_name = this.get_active_option_name();
            this.callback_option_clicked.call(this.callback_object, option_name, this.active_option_index);
        }
    }

    get_active_option_name() {
        let option = this.get_active_option();
        let option_name = this.get_option_name(option);
        return option_name;
    }

    get_active_option() {
        return this.options[this.active_option_index];
    }

    get_option_name(option) {
        return option.label.get_text();
    }

    get_active_option_index() {
        return this.active_option_index;
    }

    set_callback_option_clicked(callback_object, callback_option_clicked) {
        this.callback_object = callback_object;
        this.callback_option_clicked = callback_option_clicked;
    }
};







class CheckboxMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    constructor(title) {
        super(title, false);

        this.options = [];
        this.callback_object = null;
        this.callback_option_toggled = null;
    }

    reload_options(option_names, options_checked) {
        this.remove_options();
        this.create_options(option_names, options_checked);
        this.add_options(option_names);
    }

    remove_options() {
         this.menu.removeAll()
         this.options = [];
    }

    create_options(option_names, options_checked) {
        for(let i = 0; i < option_names.length; ++i) {
             let option_name = option_names[i];
             let option_checked = options_checked[i];
             let option = new PopupMenu.PopupSwitchMenuItem(option_name, option_checked);
             option.connect('toggled', Lang.bind(this, this._on_option_toggled));
             this.options.push(option);
        }
    }

    _on_option_toggled(option, checked) {
        this._invoke_callback_option_toggled(option, checked);
    }

    _invoke_callback_option_toggled(option, checked) {
        if(this.callback_option_toggled != null) {
            let option_index = this.options.indexOf(option);
            let option_name = this.get_option_name(option);
            this.callback_option_toggled.call(this.callback_object, option_index, option_name, checked);
        }
    }

    get_option_name(option) {
        return option.label.get_text();
    }

    add_options(option_names) {
        for(let option of this.options) {
            this.menu.addMenuItem(option);
        }
    }

    set_callback_option_toggled(callback_object, callback_option_toggled) {
        this.callback_object = callback_object;
        this.callback_option_toggled = callback_option_toggled;
    }

};






class MenuSliders {
    constructor(applet, orientation) {
        this.applet = applet;
        this.orientation = orientation;

        this.menu = new Applet.AppletPopupMenu(applet, this.orientation);
        this.section = new PopupMenu.PopupMenuSection();
        this.labels = {};
        this.sliders = {};
        this.brightness_key = _("Brightness");
        this.gamma_red_key = _("Red");
        this.gamma_green_key = _("Green");
        this.gamma_blue_key = _("Blue");

        this._init_menu();
        this._init_items();
        this._add_menu_to_applet();
    }

    _init_menu() {
        this.menu.addMenuItem(this.section);
    }

    _init_items() {
        this._init_items_brightness_active();
        this._init_items_gamma_active();
    }

    _init_items_brightness_active() {
        let active = this.applet.is_brightness_active();
        if(active) {
            this._init_items_brightness();
        }
    }

    _init_items_brightness() {
        this._init_label(this.brightness_key, this.applet.brightness);
        this._init_slider(this.brightness_key, this.on_brightness_slider_changed, this.applet.minimum_brightness,
                          this.applet.maximum_brightness, this.applet.brightness);
    }

    _init_label(key, value) {
        let label = this.add_label(key, "");
        this.set_label_text(key, value);
    }

    add_label(key, text){
        let label = new PopupMenu.PopupMenuItem(text, { reactive: false });
        this.menu.addMenuItem(label);
        this.labels[key] = label;
        return label;
    }

    set_label_text(key, value) {
        let label = this.labels[key];
        let text = this.get_description_text(key, value);
        label.label.set_text(text);
    }

    get_description_text(key, value) {
        return key + ": " + + value;
    }

    _init_slider(key, callback, min_value, max_value, value) {
        let zero_one_range_value = this.get_zero_one_range_value(min_value, max_value, value);
        let slider = this.add_slider(key, zero_one_range_value);
        slider.connect('value-changed', Lang.bind(this, callback));
    }

    get_zero_one_range_value(min_value, max_value, value) {
        value = this.get_range_value(min_value, max_value, value);
        let offset = min_value;
        let divisor = max_value - min_value;
        let mapped_value = value - offset;
        let value_zero_one_range = mapped_value / divisor;
        return value_zero_one_range;
    }

    get_range_value(min_value, max_value, value) {
        if(value < min_value) {
            return min_value;
        }
        if(value > max_value) {
            return max_value;
        }
        return value;
    }

    add_slider(key, zero_one_range_value) {
        let slider = new PopupMenu.PopupSliderMenuItem(zero_one_range_value);
        this.menu.addMenuItem(slider);
        this.sliders[key] = slider;
        return slider;
    }

    on_brightness_slider_changed(source_event, value) {
        let mapped_value = this.get_slider_value(this.applet.minimum_brightness, this.applet.maximum_brightness, value);
        this.set_label_text(this.brightness_key, mapped_value);
        this.applet.update_brightness(mapped_value);
    }

    get_slider_value(min_value, max_value, value) {
        let offset = min_value;
        let multiplier = max_value - min_value;
        let value_zero_one_range = parseFloat(value);
        let mapped_value = Math.round(offset + value_zero_one_range * multiplier);
        return mapped_value;
    }

    _init_items_gamma_active() {
        let active = this.applet.is_gamma_active();
        if(active) {
            this._init_items_gamma();
        }
    }

    _init_items_gamma() {
        this._init_items_gamma_red();
        this._init_items_gamma_green();
        this._init_items_gamma_blue();
    }

    _init_items_gamma_red() {
        this._init_label(this.gamma_red_key, this.applet.gamma_red);
        this._init_slider(this.gamma_red_key, this.on_gamma_red_slider_changed, this.applet.minimum_gamma,
                          this.applet.maximum_gamma, this.applet.gamma_red);
    }

    on_gamma_red_slider_changed(source_event, value) {
        let mapped_value = this.get_slider_value(this.applet.minimum_gamma, this.applet.maximum_gamma, value);
        this.set_label_text(this.gamma_red_key, mapped_value);
        this.applet.update_gamma_red(mapped_value);
    }

    _init_items_gamma_green() {
        this._init_label(this.gamma_green_key, this.applet.gamma_green);
        this._init_slider(this.gamma_green_key, this.on_gamma_green_slider_changed, this.applet.minimum_gamma,
                          this.applet.maximum_gamma, this.applet.gamma_green);
    }

    on_gamma_green_slider_changed(source_event, value) {
        let mapped_value = this.get_slider_value(this.applet.minimum_gamma, this.applet.maximum_gamma, value);
        this.set_label_text(this.gamma_green_key, mapped_value);
        this.applet.update_gamma_green(mapped_value);
    }

    _init_items_gamma_blue() {
        this._init_label(this.gamma_blue_key, this.applet.gamma_blue);
        this._init_slider(this.gamma_blue_key, this.on_gamma_blue_slider_changed, this.applet.minimum_gamma,
                          this.applet.maximum_gamma, this.applet.gamma_blue);
    }

    on_gamma_blue_slider_changed(source_event, value) {
        let mapped_value = this.get_slider_value(this.applet.minimum_gamma, this.applet.maximum_gamma, value);
        this.set_label_text(this.gamma_blue_key, mapped_value);
        this.applet.update_gamma_blue(mapped_value);
    }

    _add_menu_to_applet() {
        this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.menuManager.addMenu(this.menu);
    }

    update_items_brightness() {
        let active = this.applet.is_brightness_active();
        if(active) {
            let zero_one_range_value = this.get_zero_one_range_value(this.applet.minimum_brightness,
                                                                     this.applet.maximum_brightness,
                                                                     this.applet.brightness);
            this.set_slider_value(this.brightness_key, zero_one_range_value);
            this.set_label_text(this.brightness_key, this.applet.brightness);
        }
    }

    set_slider_value(key, zero_one_range_value) {
        let slider = this.sliders[key];
        slider.setValue(zero_one_range_value);
    }

    update_items_gamma_red() {
        let active = this.applet.is_gamma_active();
        if(active) {
            let zero_one_range_value = this.get_zero_one_range_value(this.applet.minimum_gamma,
                                                                     this.applet.maximum_gamma,
                                                                     this.applet.gamma_red);
            this.set_slider_value(this.gamma_red_key, zero_one_range_value);
            this.set_label_text(this.gamma_red_key, this.applet.gamma_red);
        }
    }

    update_items_gamma_green() {
        let active = this.applet.is_gamma_active();
        if(active) {
            let zero_one_range_value = this.get_zero_one_range_value(this.applet.minimum_gamma,
                                                                     this.applet.maximum_gamma,
                                                                     this.applet.gamma_green);
            this.set_slider_value(this.gamma_green_key, zero_one_range_value);
            this.set_label_text(this.gamma_green_key, this.applet.gamma_green);
        }
    }

    update_items_gamma_blue() {
        let active = this.applet.is_gamma_active();
        if(active) {
            let zero_one_range_value = this.get_zero_one_range_value(this.applet.minimum_gamma,
                                                                     this.applet.maximum_gamma,
                                                                     this.applet.gamma_blue);
            this.set_slider_value(this.gamma_blue_key, zero_one_range_value);
            this.set_label_text(this.gamma_blue_key, this.applet.gamma_blue);
        }
    }

    remove() {
        this.menuManager.removeMenu(this.menu);
    }

    open() {
        this.menu.open();
    }

    close() {
        this.menu.close();
    }

    toggle() {
        this.menu.toggle();
    }

}


