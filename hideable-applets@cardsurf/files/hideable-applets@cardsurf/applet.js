
const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const ModalDialog = imports.ui.modalDialog;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

const uuid = "hideable-applets@cardsurf";

let AppletGui, AppletConstants, FilesCsv;

if (typeof require !== 'undefined') {
    AppletGui = require('./appletGui');
    AppletConstants = require('./appletConstants');
    FilesCsv = require('./filesCsv');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletGui = AppletDirectory.appletGui;
    AppletConstants = AppletDirectory.appletConstants;
    FilesCsv = AppletDirectory.filesCsv;
}






function AppletInfo(applet, is_visible) {
    this._init(applet, is_visible);
};

AppletInfo.prototype = {
    _init: function(applet, is_visible) {
        this.applet = applet;
        this.is_visible = is_visible;

        this.default_handler_id = 0;
        this.show_handler_id = this.default_handler_id;
        this.removed_children = [];
    },

    get actor() {
        return this.applet.actor;
    },

    get instance_id() {
        return this.applet.instance_id;
    },

    get uuid() {
        return this.applet._uuid;
    },

    get applet_name() {
        return this.applet._meta["name"];
    },

    get system_icon() {
        return this.applet._meta["icon"];
    },

    get cache_icon() {
        return GLib.get_home_dir() + "/.cinnamon/spices.cache/applet/" + this.uuid + ".png";
    },

    get usr_icon() {
        return "/usr/share/cinnamon/applets/" + this.uuid + "/icon.png";
    },

    get local_icon() {
        return GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + this.uuid + "/icon.png";
    },

    has_applet_name: function () {
        return "name" in this.applet._meta;
    },

    has_system_icon: function () {
        return "icon" in this.applet._meta;
    },

    has_cache_icon: function () {
        return this.file_exists(this.cache_icon);
    },

    has_usr_icon: function () {
        return this.file_exists(this.usr_icon);
    },

    has_local_icon: function () {
        return this.file_exists(this.local_icon);
    },

    file_exists: function (path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    },

    add_show_handler: function (handler_id) {
        this.show_handler_id = handler_id;
    },

    remove_show_handler: function () {
        this.show_handler_id = this.default_handler_id;
    },

    has_show_handler: function () {
        return this.show_handler_id != this.default_handler_id;
    },

    remove_children: function () {
        let removed = this.has_removed_children();
        if(!removed) {
            this.removed_children = this.actor.get_children();
            this.actor.remove_all_children();
        }
    },

    has_removed_children: function () {
        return this.removed_children.length > 0;
    },

    add_removed_children: function () {
        let removed = this.has_removed_children();
        if(removed) {
            for(let i = 0; i < this.removed_children.length; ++i) {
                let child = this.removed_children[i];
                this.actor.add_child(child);
            }
            this.removed_children = [];
        }
    },

}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.applet_directory = this._get_applet_directory();
        this.values_directory = this.applet_directory + "values/";
        this.icons_directory = this.applet_directory + "icons/";
        this.icon_unknown = this.icons_directory + "question-mark.png";
        this.file_schema = "file://";
        this.home_shortcut = "~";
        this.applet_popup_gap = 10;
        this.restore_hidden_separator = new RegExp("\\s*,\\s*");
        this.is_running = true;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.action_type = AppletConstants.ActionType.TOGGLE_POPUP;
        this.action_trigger_type = AppletConstants.ActionTriggerType.CLICK;
        this.side_type = St.Side.LEFT;
        this.restore_hidden_string = "network@cinnamon.org, sound@cinnamon.org, removable-drives@cinnamon.org, keyboard@cinnamon.org";
        this.restore_hidden_array = ["network@cinnamon.org", "sound@cinnamon.org", "removable-drives@cinnamon.org, keyboard@cinnamon.org"];
        this.save_every = 60;
        this.gui_sort_type = AppletConstants.GuiSortType.ALPHABETICALLY;
        this.applet_popup_close_leave = true;
        this.applet_popup_columns = 3;
        this.applet_popup_icons_size = 40;
        this.applet_popup_icons_css = "";
        this.applet_popup_table_css = "";
        this.match_panel_icons_size = false;
        this.show_icon_tooltips = true;
        this.show_grayscale_icons = false;
        this.grayscale_brightness = 80;
        this.gui_icon_type = AppletConstants.GuiIconType.FILEPATH;
        this.gui_icon_filepath = "";
        this.gui_icon_symbolic_name = "";

        this.applet_infos = [];
        this.filepath_last_values = "";
        this.file_last_values = null;
        this.menu_item_visibility = null;
        this.applet_popup = null;

        this._init_layout();
        this._bind_settings();
        this._connect_signals();
        this._init_filepaths();
        this._init_files();
        this._init_restore_hidden();
        this._init_menu_item_visibility();
        this._init_applet_popup();
        this._init_gui();
    },

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    },

    _init_layout: function () {
        this._enable_hotizontal_vertical_layout();
    },

    _enable_hotizontal_vertical_layout: function() {
        let supported = this.is_vertical_layout_supported();
        if(supported) {
            this._try_enable_hotizontal_vertical_layout();
        }
    },

    is_vertical_layout_supported: function() {
        return this._is_set_allowed_layout_defined();
    },

    _is_set_allowed_layout_defined: function() {
        return this.is_function_defined(this.setAllowedLayout);
    },

    is_function_defined: function(reference) {
        return typeof reference === "function";
    },

    _try_enable_hotizontal_vertical_layout: function() {
        try {
             this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }
        catch(e) {
            global.log("Error while enabling vertical and horizontal layout: " + e);
        }
    },

    _bind_settings: function () {
        for(let [binding, property_name, callback] of [
                [Settings.BindingDirection.IN, "action_type", null],
                [Settings.BindingDirection.IN, "action_trigger_type", null],
                [Settings.BindingDirection.IN, "side_type", null],
                [Settings.BindingDirection.IN, "save_every", null],
                [Settings.BindingDirection.IN, "applet_popup_close_leave", null],
                [Settings.BindingDirection.IN, "restore_hidden_string", this.on_restore_hidden_string_changed],
                [Settings.BindingDirection.IN, "gui_sort_type", this.on_gui_sort_type_changed],
                [Settings.BindingDirection.IN, "applet_popup_columns", this.on_applet_popup_columns_changed],
                [Settings.BindingDirection.IN, "applet_popup_icons_size", this.on_applet_popup_icons_size_changed],
                [Settings.BindingDirection.IN, "applet_popup_icons_css", this.on_applet_popup_icons_css_changed],
                [Settings.BindingDirection.IN, "applet_popup_table_css", this.on_applet_popup_table_css_changed],
                [Settings.BindingDirection.IN, "match_panel_icons_size", this.on_match_panel_icons_size_changed],
                [Settings.BindingDirection.IN, "show_icon_tooltips", this.on_show_icon_tooltips_changed],
                [Settings.BindingDirection.IN, "show_grayscale_icons", this.on_show_grayscale_icons_changed],
                [Settings.BindingDirection.IN, "grayscale_brightness", this.on_grayscale_brightness_changed],
                [Settings.BindingDirection.IN, "gui_icon_type", this.on_gui_icon_type_changed],
                [Settings.BindingDirection.IN, "gui_icon_filepath", this.on_gui_icon_filepath_changed],
                [Settings.BindingDirection.IN, "gui_icon_symbolic_name", this.on_gui_icon_symbolic_name_changed] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_restore_hidden_string_changed: function () {
        this.update_gui();
        this.update_restore_hidden_array();
        this.update_restore_hidden_signals();
    },

    on_gui_sort_type_changed: function () {
        this.reload_gui();
    },

    on_applet_popup_columns_changed: function () {
        this.reload_gui();
    },

    on_applet_popup_icons_size_changed: function () {
        if(!this.match_panel_icons_size) {
            this.set_applet_popup_icons_custom_size();
        }
    },

    set_applet_popup_icons_custom_size: function () {
        this.applet_popup.set_icons_size(this.applet_popup_icons_size);
    },

    on_applet_popup_icons_css_changed: function () {
        this.applet_popup.set_icons_style(this.applet_popup_icons_css);
    },

    on_applet_popup_table_css_changed: function () {
        this.applet_popup.set_table_style(this.applet_popup_table_css);
    },

    on_match_panel_icons_size_changed: function () {
        if(this.match_panel_icons_size) {
            this.set_applet_popup_icons_panel_size();
        }
        else {
            this.set_applet_popup_icons_custom_size();
        }
    },

    set_applet_popup_icons_panel_size: function () {
        this.applet_popup.set_icons_size(this._panelHeight);
    },

    on_show_icon_tooltips_changed: function () {
        this.update_gui();
        this.set_applet_popup_tooltip_texts();
    },

    on_show_grayscale_icons_changed: function () {
        this.update_gui();
        this.set_applet_popup_icons_grayscale();
    },

    on_grayscale_brightness_changed: function () {
        this.reload_gui();
    },

    on_gui_icon_type_changed: function () {
        switch(this.gui_icon_type) {
            case AppletConstants.GuiIconType.FILEPATH: {
                 this.on_gui_icon_filepath_changed();
                 break;
            }
            case AppletConstants.GuiIconType.SYMBOLIC: {
                 this.on_gui_icon_symbolic_name_changed();
                 break;
            }
        }
    },

    on_gui_icon_filepath_changed: function () {
        this.set_gui_icon_filepath();
    },

    set_gui_icon_filepath: function () {
        let path = this.format_path(this.gui_icon_filepath);
        let exists = this.file_exists(path);
        if (exists) {
            this.set_applet_icon_path(path);
        }
    },

    format_path: function (path) {
        path = this.remove_file_schema(path);
        path = this.replace_tilde_with_home_directory(path);
        return path;
    },

    remove_file_schema: function (path) {
        path = path.replace(this.file_schema, "");
        return path;
    },

    replace_tilde_with_home_directory: function (path) {
        let home_directory = GLib.get_home_dir();
        path = path.replace(this.home_shortcut, home_directory);
        return path;
    },

    file_exists: function (path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    },

    on_gui_icon_symbolic_name_changed: function () {
        this.set_gui_icon_symbolic();
    },

    set_gui_icon_symbolic: function () {
        this.set_applet_icon_name(this.gui_icon_symbolic_name);
    },

    _connect_signals: function() {
         this.actor.connect("enter-event", Lang.bind(this, this.on_hover_enter));
         this.actor.connect("leave-event", Lang.bind(this, this.on_hover_leave));
         global.settings.connect("changed::panel-edit-mode", Lang.bind(this, this.on_panel_edit_mode_changed));
    },

    on_hover_leave: function(actor, event) {
        if(this.applet_popup_close_leave) {
            this.close_applet_popup_no_pointer(actor, event);
        }
    },

    close_applet_popup_no_pointer: function(actor, event) {
        let has_pointer = this.applet_or_popup_has_pointer();
        if(!has_pointer) {
            this.applet_popup.close();
        }
    },

    applet_or_popup_has_pointer: function() {
        return this.applet_has_pointer() || this.applet_popup_has_pointer();
    },

    applet_has_pointer: function() {
        let margin_top = this.get_gap_bottom();
        let margin_right = this.get_gap_left();
        let margin_bottom = this.get_gap_top();
        let margin_left = this.get_gap_right();
        return this.actor_has_pointer(this.actor, margin_top, margin_right, margin_bottom, margin_left);
    },

    get_gap_bottom: function() {
        return this.orientation == St.Side.BOTTOM ? this.applet_popup_gap : 0;
    },

    get_gap_left: function() {
        return this.orientation == St.Side.LEFT ? this.applet_popup_gap : 0;
    },

    get_gap_top: function() {
        return this.orientation == St.Side.TOP ? this.applet_popup_gap : 0;
    },

    get_gap_right: function() {
        return this.orientation == St.Side.RIGHT ? this.applet_popup_gap : 0;
    },

    actor_has_pointer: function(actor, margin_top, margin_right, margin_bottom, margin_left) {
        let [x, y, modifiers] = global.get_pointer();
        let [actor_x, actor_y] = actor.get_transformed_position();
        let [actor_width, actor_height] = actor.get_transformed_size();

        let x1 = actor_x - margin_left;
        let x2 = actor_x + actor_width + margin_right;
        let y1 = actor_y - margin_top;
        let y2 = actor_y + actor_height + margin_bottom;

        let has_pointer = x >= x1 && x <= x2 && y >= y1 && y <= y2;
        return has_pointer;
    },

    applet_popup_has_pointer: function() {
        return this.actor_has_pointer(this.applet_popup.menu.actor, 0, 0, 0, 0);
    },

    on_hover_enter: function(actor, event) {
        let triggered = this.action_trigger_type == AppletConstants.ActionTriggerType.HOVER;
        if(triggered) {
            this.on_hover_triggered(actor, event);
        }
    },

    on_hover_triggered: function(actor, event) {
        let edit_mode = this.panel._panelEditMode;
        let first_hover = this.is_first_hover(actor);
        if(!edit_mode && first_hover) {
            this.perform_action_hover();
        }
    },

    is_first_hover: function(actor) {
        let source_name = actor.toString();
        let first_hover = !this.string_contains(source_name, "hover");
        return first_hover;
    },

    string_contains: function(string1, string2) {
        return string1.indexOf(string2) >= 0;
    },

    perform_action_hover: function() {
        switch(this.action_type) {
            case AppletConstants.ActionType.TOGGLE_POPUP: {
                 this.perform_action_show_applet_popup();
                 break;
            }
            case AppletConstants.ActionType.TOGGLE_APPLETS_SIDE: {
                 this.perform_action_toggle_applets_side();
                 break;
            }
        }
    },

    perform_action_show_applet_popup: function() {
        this.update_gui();
        this.set_applet_popup_icons_grayscale();
        this.applet_popup.open();
    },

    update_gui: function () {
        let reload = this.is_applet_modified();
        if(reload) {
            this.reload_gui();
        }
    },

    is_applet_modified: function () {
        let applets = this.get_other_applets();
        let modified = applets.length == this.applet_infos.length ? this.is_id_modified(applets) : true;
        return modified;
    },

    get_other_applets: function () {
        let applets = this.get_applets();
        applets = applets.filter(function(applet) {
            return applet != null && applet._uuid != uuid;
        });
        return applets;
    },

    get_applets: function () {
        let actors = this.get_actors();
        let applets = actors.map(function(actor) {
              return actor._applet;
        });
        return applets;
    },

    get_actors: function() {
        let box = this.get_box();
        let actors = box.get_children();
        return actors;
    },

    get_box: function() {
        if(this.is_right_box()) {
            return this.panel._rightBox;
        }
        if(this.is_left_box()) {
            return this.panel._leftBox;
        }
        return this.panel._centerBox;
    },

    is_right_box: function() {
        return this.panel._rightBox.contains(this.actor);
    },

    is_left_box: function() {
        return this.panel._leftBox.contains(this.actor);
    },

    is_id_modified: function (applets) {
        for(let i = 0; i < applets.length; ++i) {
            if(applets[i].instance_id != this.applet_infos[i].instance_id) {
                return true;
            }
        }
        return false;
    },

    reload_gui: function () {
        this.update_applet_infos();
        this.reload_applet_popup();
        this.reload_menu_item_visibility();
    },

    update_applet_infos: function () {
        let applets = this.get_other_applets();
        this.applet_infos = applets.map(this.get_applet_info, this);
    },

    get_applet_info: function (applet) {
        let index = this.find_applet_info_index(applet);
        return index >= 0 ? this.applet_infos[index] : this.create_applet_info(applet);
    },

    find_applet_info_index: function (applet) {
        for(let i = 0; i < this.applet_infos.length; ++i) {
            let applet_info = this.applet_infos[i];
            if(applet_info.instance_id == applet.instance_id) {
                return i;
            }
        }
        return -1;
    },

    create_applet_info: function (applet) {
        let is_visible = true;
        let applet_info = new AppletInfo(applet, is_visible);
        this.update_restore_hidden_signal(applet_info);
        return applet_info;
    },

    update_restore_hidden_signal: function (applet_info) {
        let connect = this.is_restore_hidden_applet(applet_info);
        if(connect) {
             this.connect_show_signal(applet_info);
        }
        else {
             this.disconnect_show_signal(applet_info);
        }
    },

    is_restore_hidden_applet: function(applet_info) {
        return this.array_contains(this.restore_hidden_array, applet_info.uuid);
    },

    array_contains: function (array, element) {
        return array.indexOf(element) > -1;
    },

    connect_show_signal: function (applet_info) {
        let is_connected = applet_info.has_show_handler();
        if(!is_connected) {
             let handler_id = applet_info.actor.connect("show", Lang.bind(this, this.on_actor_show));
             applet_info.add_show_handler(handler_id);
        }
    },

    on_actor_show: function(actor, event) {
        let index = this.find_applet_info_index(actor._applet);
        if(index >= 0) {
            let applet_info = this.applet_infos[index];
            let is_visible = applet_info.is_visible;
            this.set_visibility_changed(actor, is_visible);
        }
    },

    set_visibility_changed: function(actor, is_visible) {
        if(actor.visible != is_visible) {
            this.set_visibility(actor, is_visible);
        }
    },

    disconnect_show_signal: function (applet_info) {
        let is_connected = applet_info.has_show_handler();
        if(is_connected) {
             applet_info.actor.disconnect(applet_info.show_handler_id);
             applet_info.remove_show_handler();
        }
    },

    reload_applet_popup: function () {
        this.applet_popup.set_columns(this.applet_popup_columns);
        this.applet_popup.set_grayscale_brightness(this.grayscale_brightness)
        let icon_paths = this.get_applet_icon_paths();
        let icon_names = this.get_applet_names();
        this.applet_popup.reload_icons(icon_paths, icon_names);
        this.on_match_panel_icons_size_changed();
        this.on_applet_popup_icons_css_changed();
        this.on_applet_popup_table_css_changed();
        this.set_applet_popup_tooltip_texts();
        this.set_applet_popup_icons_grayscale();
    },

    get_applet_icon_paths: function () {
        let icons = this.applet_infos.map(this.get_applet_icon, this);
        return icons;
    },

    get_applet_icon: function (applet_info) {
        if(applet_info.has_cache_icon()) {
            return applet_info.cache_icon;
        }
        if(applet_info.has_usr_icon()) {
            return applet_info.usr_icon;
        }
        if(applet_info.has_local_icon()) {
            return applet_info.local_icon;
        }
        if(applet_info.has_system_icon()) {
            return applet_info.system_icon;
        }
        return this.icon_unknown;
    },

    set_applet_popup_tooltip_texts: function () {
        let tooltip_texts = this.get_applet_popup_tooltip_texts();
        this.applet_popup.set_icon_tooltip_texts(tooltip_texts);
    },

    get_applet_popup_tooltip_texts: function () {
        let applet_names = this.get_applet_names();
        if(!this.show_icon_tooltips) {
            applet_names = applet_names.map(function(applet_name) {
                return "";
            });
        }
        return applet_names;
    },

    set_applet_popup_icons_grayscale: function () {
        let is_grayscale_on_array = this.get_is_grayscale_on_array();
        this.applet_popup.set_grayscales(is_grayscale_on_array);
    },

    get_is_grayscale_on_array: function () {
        let is_grayscale_on_array = this.show_grayscale_icons ?
                                    this.get_applet_visibilities_reversed() : this.get_grayscale_off_array();
        return is_grayscale_on_array;
    },

    get_applet_visibilities_reversed: function () {
        let visibilities_reversed = this.applet_infos.map(function(info) {
              return !info.is_visible;
        });
        return visibilities_reversed;
    },

    get_grayscale_off_array: function () {
        let grayscale_off_array = this.applet_infos.map(function(info) {
              return false;
        });
        return grayscale_off_array;
    },

    get_applet_names: function () {
        let names = this.applet_infos.map(function(info) {
              return info.has_applet_name() ? info.applet_name : "Unknown applet";
        });
        return names;
    },

    reload_menu_item_visibility: function () {
        let names = this.get_applet_names();
        let visibilities = this.get_applet_visibilities();
        this.menu_item_visibility.reload_options(names, visibilities);
    },

    get_applet_visibilities: function () {
        let visibilities = this.applet_infos.map(function(info) {
              return info.is_visible;
        });
        return visibilities;
    },

    perform_action_toggle_applets_side: function() {
        this.update_gui();
        this.toggle_applets_side();
    },

    toggle_applets_side: function() {
        let is_match = this.is_match_panel_side();
        if(is_match) {
            this.toggle_actors_side();
        }
    },

    is_match_panel_side: function() {
        let panel_horizontal = this.is_panel_horizontal();
        let side_vertical = this.is_side_vertical();
        let is_match = (panel_horizontal && side_vertical) || (!panel_horizontal && !side_vertical);
        return is_match;
    },

    is_panel_horizontal: function() {
        return this.orientation == St.Side.BOTTOM || this.orientation == St.Side.TOP;
    },

    is_side_vertical: function() {
        return this.side_type == St.Side.LEFT || this.side_type == St.Side.RIGHT;
    },

    toggle_actors_side: function() {
        let actors = this.get_actors_side();
        this.toggle_actors(actors);
        this.update_applet_infos_toggle(actors);
    },

    get_actors_side: function() {
        let panel_horizontal = this.is_panel_horizontal();
        let actors = panel_horizontal ? this.get_actors_panel_horizontal() : this.get_actors_panel_vertical();
        return actors;
    },

    get_actors_panel_horizontal: function() {
        let actors = this.side_type == St.Side.LEFT ? this.get_actors_left() : this.get_actors_right();
        return actors;
    },

    get_actors_left: function() {
        let actors = this.get_actors();
        let start = 0;
        let end = actors.indexOf(this.actor);
        return actors.slice(start, end);
    },

    get_actors_right: function() {
        let actors = this.get_actors();
        let start = actors.indexOf(this.actor) + 1;
        let end = actors.length;
        return actors.slice(start, end);
    },

    toggle_actors: function(actors) {
        for(let actor of actors) {
            this.toggle_actor(actor);
        }
    },

    toggle_actor: function(actor) {
        let is_visible = !actor.visible;
        this.set_visibility(actor, is_visible);
    },

    set_visibility: function (actor, is_visible) {
        if(is_visible) {
            this.show_actor(actor);
        }
        else {
            this.hide_actor(actor);
        }
    },

    show_actor: function (actor) {
        actor.show();
        this.toggle_removed_children_actor(actor, false);
    },

    toggle_removed_children_actor: function (actor, remove) {
        let index = this.find_applet_info_index(actor._applet);
        if(index >= 0) {
            let applet_info = this.applet_infos[index];
            this.toggle_removed_children_applet(applet_info, remove);
        }
    },

    toggle_removed_children_applet: function (applet_info, remove) {
        if(remove) {
            this.remove_children(applet_info);
        }
        else {
            this.add_removed_children(applet_info);
        }
    },

    remove_children: function (applet_info) {
        let remove = this.is_click_registered_when_hidden_applet(applet_info);
        if(remove) {
            applet_info.remove_children();
        }
    },

    is_click_registered_when_hidden_applet: function(applet_info) {
        return applet_info.uuid == "systray@cinnamon.org";
    },

    add_removed_children: function (applet_info) {
        let add = this.is_click_registered_when_hidden_applet(applet_info);
        if(add) {
            applet_info.add_removed_children();
        }
    },

    hide_actor: function (actor) {
        actor.hide();
        this.toggle_removed_children_actor(actor, true);
    },

    get_actors_panel_vertical: function() {
        let actors = this.side_type == St.Side.TOP ? this.get_actors_left() : this.get_actors_right();
        this.toggle_actors(actors);
    },

    update_applet_infos_toggle: function(actors) {
        if(actors.length > 0) {
            this.update_applet_infos();
            this.update_applet_infos_visibilities();
            this.reload_applet_popup();
            this.reload_menu_item_visibility();
        }
    },

    update_applet_infos_visibilities: function() {
        for(let applet_info of this.applet_infos) {
            applet_info.is_visible = applet_info.actor.visible;
        }
    },

    on_panel_edit_mode_changed: function() {
        let edit_mode = this.panel._panelEditMode;
        if(edit_mode) {
            this.update_applet_infos();
            this.save_last_values();
        }
        else {
            this.update_gui();
            this.set_visibilities();
        }
    },

    set_visibilities: function () {
        for(let applet_info of this.applet_infos) {
            let actor = applet_info.actor;
            let is_visible = applet_info.is_visible;
            this.set_visibility(actor, is_visible);
        }
    },

    _init_filepaths: function () {
        this.filepath_last_values = this.values_directory + 'last_values.csv';
    },

    _init_files: function () {
        this.file_last_values = new FilesCsv.LastValuesFileCsv(this.filepath_last_values);
        if(!this.file_last_values.exists()) {
            this.file_last_values.create();
        }
    },

    _init_restore_hidden: function () {
        this.update_restore_hidden_array();
    },

    update_restore_hidden_array: function () {
        this.restore_hidden_array = this.restore_hidden_string.split(this.restore_hidden_separator);
    },

    _init_menu_item_visibility: function () {
        this.menu_item_visibility = new AppletGui.CheckboxMenuItem(this, "Visibility");
        this.menu_item_visibility.set_callback_option_toggled(this, this.on_menu_item_visibility_toggled);
        this._applet_context_menu.addMenuItem(this.menu_item_visibility);
        this._applet_context_menu.connect('open-state-changed', Lang.bind(this, this.on_context_menu_state_changed));
    },

    on_menu_item_visibility_toggled: function (option_index, option_name, checked) {
        this.update_visibility(option_index, checked);
    },

    update_visibility: function (index, is_visible) {
        try{
            let applet_info = this.applet_infos[index];
            let actor = applet_info.actor;
            this.applet_infos[index].is_visible = is_visible;
            this.set_visibility(actor, is_visible);
        }
        catch(e) {
            global.log("Error while updating applet visibility: " + e);
        }
    },

    on_context_menu_state_changed: function (actor, event) {
        this.applet_popup.close();
        let opened = event;
        if(opened) {
            this.update_gui();
            this.update_gui_menu_item_visibility_modified();
        }
    },

    update_gui_menu_item_visibility_modified: function () {
        let reload = this.is_menu_item_visibility_modified();
        if(reload) {
            this.reload_gui();
        }
    },

    is_menu_item_visibility_modified: function () {
        let options = this.menu_item_visibility.options;
        let modified = this.applet_infos.length == this.menu_item_visibility.options.length ?
                       this.is_menu_item_visibility_option_modified() : true;
        return modified;
    },

    is_menu_item_visibility_option_modified: function () {
        for(let i = 0; i < this.applet_infos.length; ++i) {
            if(this.applet_infos[i].is_visible != this.menu_item_visibility.options[i].state) {
                return true;
            }
        }
        return false;
    },

    _init_gui: function () {
        this.on_gui_icon_type_changed();
    },

    _init_applet_popup: function () {
        this.applet_popup = new AppletGui.HoverMenuIcons(this, this.orientation);
        this.applet_popup.set_callback_icon_clicked(this, this.on_applet_popup_icon_clicked);
    },

    on_applet_popup_icon_clicked: function (icon_index) {
        this.toggle_visibility(icon_index);
        this.toggle_grayscale_enabled(icon_index);
    },

    toggle_visibility: function (index) {
        try{
            let applet_info = this.applet_infos[index];
            let is_visible = !applet_info.is_visible;
            this.update_visibility(index, is_visible);
        }
        catch(e) {
            global.log("Error while toggling applet visibility: " + e);
        }
    },

    toggle_grayscale_enabled: function (index) {
        if(this.show_grayscale_icons) {
            this.toggle_grayscale(index);
        }
    },

    toggle_grayscale: function (index) {
        try{
            let applet_info = this.applet_infos[index];
            let is_grayscale_on = !applet_info.is_visible;
            this.applet_popup.set_grayscale(index, is_grayscale_on);
        }
        catch(e) {
            global.log("Error while toggling applet icon grayscale: " + e);
        }
    },

    update_restore_hidden_signals: function () {
        for(let applet_info of this.applet_infos) {
           this.update_restore_hidden_signal(applet_info);
        }
    },

    get_sorted_indexes: function(array) {
        let indexes = [];

        for(let i = 0; i < array.length; ++i) {
            let item = array[i];
            let insert = 0;
            while(insert < indexes.length) {
                let sorted_index = indexes[insert];
                let sorted_item = array[sorted_index];
                if(item.localeCompare(sorted_item) >= 0) {
                    ++insert;
                }
                else {
                    break;
                }
            }
            indexes.splice(insert, 0, i);
        }

        return indexes;
    },

    is_gui_sorted_alphabetically: function () {
        return this.gui_sort_type == AppletConstants.GuiSortType.ALPHABETICALLY;
    },

    // Override
    on_applet_clicked: function(event) {
        let triggered = this.action_trigger_type == AppletConstants.ActionTriggerType.CLICK;
        if(triggered) {
            this.on_click_triggered();
        }
    },

    on_click_triggered: function() {
        let edit_mode = this.panel._panelEditMode;
        if(!edit_mode) {
            this.perform_action_click();
        }
    },

    perform_action_click: function() {
        switch(this.action_type) {
            case AppletConstants.ActionType.TOGGLE_POPUP: {
                 this.perform_action_toggle_applet_popup();
                 break;
            }
            case AppletConstants.ActionType.TOGGLE_APPLETS_SIDE: {
                 this.perform_action_toggle_applets_side();
                 break;
            }
        }
    },

    perform_action_toggle_applet_popup: function() {
        this.update_gui();
        this.applet_popup.toggle();
    },

    // Override
    on_panel_height_changed: function() {
        if(this.match_panel_icons_size) {
            this.set_applet_popup_icons_panel_size();
        }
    },

    // Override
    on_applet_added_to_panel: function(userEnabled) {
        this.run();
    },

    // Override
    on_applet_removed_from_panel: function() {
        this.is_running = false;
    },

    save_last_values: function() {
        try {
            let rows = this.applet_infos.map(function(info) {
                return new FilesCsv.LastValuesRowCsv(info.uuid, info.is_visible);
            });
            this.file_last_values.overwrite(rows);
        }
        catch(e) {
            global.log("Error while saving last values to a file: " + e);
        }
    },










    run: function () {
        this._run_init_applets_loaded();
    },

    _run_init_applets_loaded_running: function () {
        if(this.is_running) {
            this._run_init_applets_loaded();
        }
    },

    _run_init_applets_loaded: function () {
        if(AppletManager.appletsLoaded) {
            this._init_applets_loaded();
        }
        else {
            Mainloop.timeout_add(500, Lang.bind(this, this._run_init_applets_loaded_running));
        }
    },

    _init_applets_loaded: function () {
        this.update_applet_infos();
        this.load_last_values();
        this.set_visibilities();
        this.reload_menu_item_visibility();
        this.reload_applet_popup();
        this._run_save_last_values_running();
    },

    load_last_values: function() {
        try {
            let rows = this.file_last_values.get_rows();
            for(let applet_info of this.applet_infos) {
                rows = this.load_applet_info(rows, applet_info);
            }
        }
        catch(e) {
            global.log("Error while loading last values from a file: " + e);
        }
    },

    load_applet_info: function(rows, applet_info) {
        for(let i = 0; i < rows.length; ++i) {
             let row = rows[i];
             if(applet_info.uuid == row.uuid) {
                applet_info.is_visible = row.is_visible;
                rows.splice(i, 1);
                break;
             }
        }
        return rows;
    },

    _run_save_last_values_running: function () {
        if(this.is_running) {
            this._run_save_last_values();
        }
    },

    _run_save_last_values: function () {
        if(this.save_every > 0) {
            this.update_gui();
            this.save_last_values();
            Mainloop.timeout_add(this.save_every * 1000, Lang.bind(this, this._run_save_last_values_running));
        }
    },

};











function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

