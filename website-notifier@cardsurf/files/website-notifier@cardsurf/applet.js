
const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

const uuid = "website-notifier@cardsurf";
let AppletDirectory, AppletGui, AppletConstants, ShellUtils, Dates;
if (typeof require !== 'undefined') {
    AppletGui = require('./appletGui');
    AppletConstants = require('./appletConstants');
    ShellUtils = require('./shellUtils');
    Dates = require('./dates');
} else {
    AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletGui = AppletDirectory.appletGui;
    AppletConstants = AppletDirectory.appletConstants;
    ShellUtils = AppletDirectory.shellUtils;
    Dates = AppletDirectory.dates;
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
        this.is_running = true;

        this.sleep_name = "sleep";
        this.sensible_browser_name = "sensible-browser";
        this.chmod_name = "chmod";
        this.notify_send_name = "notify-send";
        this.file_schema = "file://";
        this.home_shortcut = "~";
        this.newline_escapes_regex = new RegExp(/\\n/g);
        this.date_time_separator = ":";
        this.ellipsis_text = "...";

        this.current_url = "";
        this.current_title = "";
        this.current_message = "";
        this.current_others = "";
        this.show_next_notification = false;
        this.index_next_url = 0;
        this.index_next_title = 1;
        this.index_next_message = 2;
        this.index_next_others = 3;
        this.index_show_next_notification = 4;
        this.is_script_scheduled = false;
        this.next_script_date = new Dates.ConvertableDate();
        this.next_script_time = "";
        this.last_script_time = "";
        this.notification_time = "";

        this.wait_process = new ShellUtils.BackgroundProcess([], false);
        this.applet_popup = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.update_every = 60;
        this.notification_type = AppletConstants.NotificationType.SYSTEM;
        this.primary_button_type = AppletConstants.PrimaryButtonType.LEFT;
        this.applet_popup_click_type = AppletConstants.AppletPopupClickType.CLOSE_POPUP_OPEN_BROWSER;
        this.tooltip_type = AppletConstants.TooltipType.TIME_LEFT_NEXT_SCRIPT;
        this.max_title_length = 100;
        this.max_message_length = 500;
        this.applet_popup_title_css = "";
        this.applet_popup_message_css = "";
        this.applet_popup_width = 500;
        this.applet_popup_height = 150;
        this.gui_icon_filepath = "";
        this.script_filepath = "";
        this.script_separator = ":::::";

        this._init_layout();
        this._bind_settings();
        this._connect_signals();
        this._init_gui();
        this._init_applet_popup();
        this._init_wait_process();
        this._init_script();

        this.run();
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
                        [Settings.BindingDirection.IN, "notification_type", null],
                        [Settings.BindingDirection.IN, "primary_button_type", null],
                        [Settings.BindingDirection.IN, "applet_popup_click_type", null],
                        [Settings.BindingDirection.IN, "script_separator", null],
                        [Settings.BindingDirection.IN, "update_every", this.on_update_every_changed],
                        [Settings.BindingDirection.IN, "tooltip_type", this.on_tooltip_type_changed],
                        [Settings.BindingDirection.IN, "max_title_length", this.on_max_length_changed],
                        [Settings.BindingDirection.IN, "max_message_length", this.on_max_length_changed],
                        [Settings.BindingDirection.IN, "applet_popup_width", this.on_applet_popup_size_changed],
                        [Settings.BindingDirection.IN, "applet_popup_height", this.on_applet_popup_size_changed],
                        [Settings.BindingDirection.IN, "applet_popup_title_css", this.on_applet_popup_css_changed],
                        [Settings.BindingDirection.IN, "applet_popup_message_css", this.on_applet_popup_css_changed],
                        [Settings.BindingDirection.IN, "gui_icon_filepath", this.on_gui_icon_changed],
                        [Settings.BindingDirection.IN, "script_filepath", this.on_script_changed] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_update_every_changed: function () {
        if(this.is_running) {
            this.reset_run();
        }
    },

    reset_run: function () {
        if(this.is_script_scheduled) {
            this.reset();
        }
        else {
            this.run();
        }
    },

    reset: function () {
        let waiting = this.wait_process.is_running();
        if(waiting) {
            this.wait_process.kill();
        }
    },

    on_tooltip_type_changed: function () {
        if(this.tooltip_type == AppletConstants.TooltipType.NONE) {
            this.on_tooltip_type_changed_none();
        }
        else {
            this.on_tooltip_type_changed_text();
        }
    },

    on_tooltip_type_changed_none: function () {
        this.set_applet_tooltip("");
    },

    on_tooltip_type_changed_text: function () {
        let text = this.get_tooltip_text();
        this.set_applet_tooltip(text);
    },

    get_tooltip_text: function () {
        switch(this.tooltip_type) {
            case AppletConstants.TooltipType.TIME_LEFT_NEXT_SCRIPT: return this.get_time_left_next_script();
            case AppletConstants.TooltipType.NEXT_SCRIPT_TIME: return this.get_next_script_time();
            case AppletConstants.TooltipType.LAST_SCRIPT_TIME: return this.get_last_script_time();
            case AppletConstants.TooltipType.LAST_NOTIFICATION_TIME: return this.get_last_notification_time();
            default: return "";
        }
    },

    get_time_left_next_script: function () {
        return "Next refresh in: " + this.next_script_date.to_time_left_day_string();
    },

    get_next_script_time: function () {
        return "Next refresh: " + this.next_script_time;
    },

    get_last_script_time: function () {
        return "Last refresh: " + this.last_script_time;
    },

    get_last_notification_time: function () {
        return "Last notification: " + this.notification_time;
    },

    on_max_length_changed: function () {
        this.update_applet_popup_text();
    },

    update_applet_popup_text: function() {
        let title_text = this.get_title_text();
        let message_text = this.get_message_text();
        this.applet_popup.set_text(title_text, message_text);
    },

    get_title_text: function () {
        let text = this.get_max_length_text(this.current_title, this.max_title_length);
        return text;
    },

    get_max_length_text: function (text, max_length) {
        if(text.length > max_length) {
            text = text.substring(0, max_length - 1);
            text += this.ellipsis_text;
        }
        return text;
    },

    get_message_text: function () {
        let text = this.get_max_length_text(this.current_message, this.max_message_length);
        text = this.remove_newline_escapes(text);
        return text;
    },

    remove_newline_escapes: function (text) {
        return text.replace(this.newline_escapes_regex, "\n");
    },

    on_applet_popup_size_changed: function () {
        this.applet_popup.set_size(this.applet_popup_width, this.applet_popup_height);
    },

    on_applet_popup_css_changed: function () {
        this.applet_popup.set_title_style(this.applet_popup_title_css);
        this.applet_popup.set_message_style(this.applet_popup_message_css);
    },

    on_gui_icon_changed: function () {
        this.set_gui_icon();
    },

    set_gui_icon: function () {
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

    on_script_changed: function () {
        let path = this.format_path(this.script_filepath);
        let exists = this.file_exists(path);
        if (exists) {
            this.script_filepath = path;
        }
    },

    // Override
    _onButtonPressEvent: function (actor, event) {
        let edit_mode = this.panel._panelEditMode;
        let handled = edit_mode ? this.on_button_pressed_base(actor, event) :
                                  this.on_button_pressed_no_edit_mode(actor, event);
        return handled;
    },

    on_button_pressed_base: function (actor, event) {
        let handled = Applet.IconApplet.prototype._onButtonPressEvent.call(this, actor, event);
        return handled;
    },

    on_button_pressed_no_edit_mode: function (actor, event) {
        let handled = false;
        let button = event.get_button();

        if(button == Clutter.BUTTON_PRIMARY) {
            handled = this.on_left_mouse_button_clicked();
        }
        else if (button == Clutter.BUTTON_MIDDLE) {
            handled = this.on_middle_mouse_button_clicked();
        }
        else {
            handled = this.on_button_pressed_base(actor, event);
        }
        return handled;
    },

    on_left_mouse_button_clicked: function () {
        let primary = this.primary_button_type == AppletConstants.PrimaryButtonType.LEFT;
        this.on_mouse_button_clicked(primary);
        return true;
    },

    on_mouse_button_clicked: function (primary) {
        if(primary) {
            this.on_primary_button_clicked();
        }
        else {
            this.on_secondary_button_clicked();
        }
    },

    on_primary_button_clicked: function() {
        this.execute_script();
    },

    on_secondary_button_clicked: function() {
        this.applet_popup.toggle();
    },

    on_middle_mouse_button_clicked: function () {
        let primary = this.primary_button_type == AppletConstants.PrimaryButtonType.MIDDLE;
        this.on_mouse_button_clicked(primary);
        return true;
    },

    // Override
    on_applet_removed_from_panel: function() {
        this.is_running = false;
    },

    _connect_signals: function() {
         this.actor.connect("enter-event", Lang.bind(this, this.on_tooltip_type_changed));
    },

    _init_gui: function () {
        this.set_gui_icon();
    },

    _init_applet_popup: function () {
        this.applet_popup = new AppletGui.AppletMenuNotification(this, this.orientation);
        this.on_applet_popup_css_changed();
        this.on_applet_popup_size_changed();
        this.applet_popup.connect_pressed_signal(this, this.on_applet_popup_clicked);
    },

    on_applet_popup_clicked: function(source_event, value) {
         this.applet_popup.close();
         if(this.applet_popup_click_type == AppletConstants.AppletPopupClickType.CLOSE_POPUP_OPEN_BROWSER) {
            this.open_url_browser();
         }
    },

    open_url_browser: function() {
        let process = new ShellUtils.ShellOutputProcess([this.sensible_browser_name, this.current_url]);
        process.spawn_async();
    },

    _init_wait_process: function () {
        this.wait_process.set_callback_process_finished(this, this.on_wait_finished);
    },

    _init_script: function () {
        this.on_script_changed();
    },







    run: function () {
        this.is_script_scheduled = true;
        this.wait_execute_script();
    },

    wait_execute_script: function () {
        let wait = this.is_running && this.update_every > 0;
        if(wait) {
            this.wait_execute_script_finished();
        }
        else {
            this.stop();
        }
    },

    wait_execute_script_finished: function () {
        this.update_next_script_date();
        let seconds = (60 * this.update_every).toString();
        this.wait_process.command_argv = [this.sleep_name, seconds];
        this.wait_process.spawn_async();
    },

    update_next_script_date: function () {
         this.next_script_date = new Dates.ConvertableDate();
         this.next_script_date.add_minutes(this.update_every);
         this.next_script_time = this.next_script_date.to_hour_minute_second_string(this.date_time_separator);
    },

    on_wait_finished: function (process, pid, status) {
        if(this.is_running) {
            this.execute_script_not_killed(status);
            this.wait_execute_script();
        }
    },

    execute_script_not_killed: function (status) {
        let killed = status == ShellUtils.SignalType.SIGKILL;
        if(!killed) {
            this.execute_script();
        }
    },

    execute_script: function() {
        try {
            this.grant_executable_permission();
            this.update_last_script_time();
            this.spawn_script_process();
        }
        catch(e) {
            global.log("Error while executing a script: " + e);
        }
    },

    grant_executable_permission: function() {
        let process = new ShellUtils.ShellOutputProcess([this.chmod_name, '755', this.script_filepath]);
        let error = process.spawn_sync_and_get_error();
        if(error.length > 0) {
            this.log_process_error("Error granting executable permission: " + error, process.command_argv);
            return false;
        }
    },

    log_process_error: function(error, argv) {
        let text = error + ". Command line arguments: " + argv;
        global.log(text);
    },

    update_last_script_time: function () {
         this.last_script_time = this.get_date_time_now_string();
    },

    get_date_time_now_string: function () {
        let date = new Dates.ConvertableDate();
        let time_string = date.to_hour_minute_second_string(this.date_time_separator);
        return time_string;
    },

    spawn_script_process: function () {
        try {
            let argv = this.get_script_argv();
            let script_process = new ShellUtils.BackgroundProcess(argv, true);
            script_process.set_callback_process_finished(this, this.on_script_finished);
            script_process.spawn_async();
        }
        catch(e) {
            global.log("Error while spawning script process: " + e);
        }
    },

    get_script_argv: function () {
        let argv = [ this.script_filepath,
                     this.script_separator,
                     this.current_url,
                     this.current_title,
                     this.current_message,
                     this.current_others ];
        return argv;
    },

    on_script_finished: function (script_process, pid, status) {
        let error = script_process.get_standard_error_content();
        if(error.length > 0) {
            this.log_process_error("Error executing a script: " + error, script_process.command_argv);
        }
        else {
            this.on_script_finished_successfully(script_process);
        }
    },

    on_script_finished_successfully: function (script_process) {
        let success = this.update_script_finished(script_process);
        success = success && this.show_notification_script_finished(script_process);
    },

    update_script_finished: function(script_process) {
        try {
            this.update_parameters(script_process);
            this.update_applet_popup_text();
            return true;
        }
        catch(e) {
            global.log("Error while updating script results: " + e);
            return false;
        }
    },

    update_parameters: function(script_process) {
        let output = script_process.get_standard_output_content();
        let parameters = output.split(this.script_separator);
        this.current_url = this.get_url(parameters);
        this.current_title = this.get_title(parameters);
        this.current_message = this.get_message(parameters);
        this.current_others = this.get_others(parameters);
        this.show_next_notification = this.get_show(parameters);
    },

    get_url: function (parameters) {
        let url = parameters[this.index_next_url];
        url = this.get_empty_string_undefined(url);
        url = this.remove_amp(url);
        return url;
    },

    get_empty_string_undefined: function (text) {
        return text === undefined ? "" : text;
    },

    remove_amp: function (text) {
        return text.replace("&amp;", "&");
    },

    get_title: function (parameters) {
        let title = parameters[this.index_next_title];
        title = this.get_empty_string_undefined(title);
        return title;
    },

    get_message: function (parameters) {
        let message_text = parameters[this.index_next_message];
        message_text = this.get_empty_string_undefined(message_text);
        return message_text;
    },

    get_others: function (parameters) {
        let others = parameters[this.index_next_others];
        others = this.get_empty_string_undefined(others);
        return others;
    },

    get_show: function (parameters) {
        let show = parameters[this.index_show_next_notification];
        show = this.get_empty_string_undefined(show);
        show = show.toLowerCase().trim();
        return show == "true" ? true : false;
    },

    show_notification_script_finished: function(script_process) {
        try {
            if(this.show_next_notification) {
                this.update_notification_time();
                this.show_notification();
            }
            return true;
        }
        catch(e) {
            global.log("Error while showing a notification: " + e);
            return false;
        }
    },

    update_notification_time: function () {
         this.notification_time = this.get_date_time_now_string();
    },

    show_notification: function() {
        if(this.notification_type == AppletConstants.NotificationType.SYSTEM) {
            this.show_system_notification();
        }
        else {
            this.show_applet_notification();
        }
    },

    show_system_notification: function() {
        let argv = this.get_system_notification_argv();
        let process = new ShellUtils.ShellOutputProcess(argv);
        process.spawn_async();
    },

    get_system_notification_argv: function () {
         let title_parameter = this.get_title_text();
         let message_parameter = this.get_message_text();
         let argv = [this.notify_send_name, title_parameter, message_parameter];
         return argv;
    },

    show_applet_notification: function() {
        this.applet_popup.open();
    },

    stop: function () {
        this.is_script_scheduled = false;
        this.next_script_date = new Dates.ConvertableDate();
        this.next_script_time = "";
    },

};





function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

