
const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gettext = imports.gettext;

const uuid = 'text-to-speech-applet@cardsurf';
let AppletGui, Clipboard, ShellUtils, Translation, Keyboard;
if (typeof require !== 'undefined') {
    AppletGui = require('./appletGui');
    Clipboard = require('./clipboard');
    ShellUtils = require('./shellUtils');
    Translation = require('./translation');
    Keyboard = require('./keyboard');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletGui = AppletDirectory.appletGui;
    Clipboard = AppletDirectory.clipboard;
    ShellUtils = AppletDirectory.shellUtils;
    Translation = AppletDirectory.translation;
    Keyboard = AppletDirectory.keyboard;
}

function _(str) {
    return Gettext.dgettext(uuid, str);
}




function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.panel_height = panel_height;
        this.orientation = orientation;
        this.python_name = "python3";
        this.tts_engine_name = "espeak";
        this.start_stop_keybind_id = uuid + instance_id + "start-stop";
        this.pause_resume_keybind_id = uuid + instance_id + "pause-resume";

        this.clipboard_reader = new Clipboard.ClipboardReader();
        this.voice_process = null;
        this.previous_text = "";
        this.current_text = "";
        this.line_resume_reading = 0;
        this.line_separator_regex = null;
        this.hover_popup = null;
        this.file_schema = "file://";
        this.home_shortcut = "~";
        this.start_stop_keybind = null;
        this.pause_resume_keybind = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.clipboard_type = 0;
        this.read_lines_and_stop = false;
        this.number_lines_to_read = 1;
        this.line_separator = "";
        this.voice_command = "";
        this.gui_idle_icon_filename = "";
        this.gui_pause_icon_filename = "";
        this.gui_reading_icon_filename = "";
        this.start_stop_keys = "";
        this.pause_resume_keys = "";

        this.is_tts_engine_dialog_confirmed = false;

        this._bind_settings();
        this._init_dependencies_tts_engine_satisfied();
    },

    _bind_settings: function () {
        for(let [binding, property_name, callback] of [
                [Settings.BindingDirection.IN, "clipboard_type", null],
                [Settings.BindingDirection.IN, "read_lines_and_stop", null],
                [Settings.BindingDirection.IN, "number_lines_to_read", null],
                [Settings.BindingDirection.IN, "voice_command", null],
                [Settings.BindingDirection.IN, "line_separator", this.on_line_separator_changed],
                [Settings.BindingDirection.IN, "gui_idle_icon_filename", this.on_gui_idle_icon_changed],
                [Settings.BindingDirection.IN, "gui_pause_icon_filename", this.on_gui_pause_icon_changed],
                [Settings.BindingDirection.IN, "gui_reading_icon_filename", this.on_gui_reading_icon_changed],
                [Settings.BindingDirection.IN, "start_stop_keys", this.on_start_stop_keys_changed],
                [Settings.BindingDirection.IN, "pause_resume_keys", this.on_pause_resume_keys_changed],
                [Settings.BindingDirection.BIDIRECTIONAL, "is_tts_engine_dialog_confirmed", null] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_line_separator_changed: function () {
        this.line_separator_regex = new RegExp(this.line_separator,"g");
    },

    on_gui_idle_icon_changed: function () {
        let is_running = this.is_voice_process_running();
        if(!is_running){
            this.set_gui_idle();
        }
    },

    on_gui_pause_icon_changed: function () {
        let is_paused = this.is_voice_process_paused();
        if(is_paused){
            this.set_gui_paused();
        }
    },

    on_gui_reading_icon_changed: function () {
        let is_running = this.is_voice_process_running();
        if(is_running){
            this.set_gui_reading();
        }
    },

    is_voice_process_running: function () {
        let is_running = this.voice_process.is_running();
        return is_running;
    },

    is_voice_process_paused: function () {
        let is_paused = this.voice_process.is_paused();
        return is_paused;
    },

    set_gui_idle: function () {
        this.set_gui_icon(this.gui_idle_icon_filename);
    },

    set_gui_paused: function () {
        this.set_gui_icon(this.gui_pause_icon_filename);
    },

    set_gui_reading: function () {
        this.set_gui_icon(this.gui_reading_icon_filename);
    },

    set_gui_icon: function (icon_path) {
        let path = this.remove_file_schema(icon_path);
        path = this.replace_tilde_with_home_directory(path);
        let exists = this.file_exists(path);
        if (exists) {
            this.set_applet_icon_path(path);
        }
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

    on_start_stop_keys_changed: function() {
        this.start_stop_keybind.update_binding(this.start_stop_keys);
    },

    on_pause_resume_keys_changed: function() {
        this.pause_resume_keybind.update_binding(this.pause_resume_keys);
    },

    _init_dependencies_tts_engine_satisfied: function () {
        let satisfied = this._check_dependencies();
        if(satisfied) {
            this._init_tts_engine_satisfied();
        }
    },

    _check_dependencies: function() {
        let dependencies = this._get_dependencies();
        if(dependencies.length > 0) {
            this._show_dialog_dependencies(dependencies);
            return false;
        }
        return true;
    },

    _get_dependencies: function() {
        let dependencies = [];
        dependencies = this._check_python(dependencies);
        return dependencies;
    },

    _check_python: function(dependencies) {
        let python_satisfied = this._python_available();
        if(!python_satisfied) {
            let dependency = this._get_dependency(this.python_name);
            dependencies.push(dependency);
        }
        return dependencies;
    },

    _python_available: function() {
        let process = new ShellUtils.ShellOutputProcess(["which", this.python_name]);
        let output = process.spawn_sync_and_get_output();
        return output.length > 0;
    },

    _get_dependency: function(dependency) {
        return dependency;
    },

    _show_dialog_dependencies: function(dependencies) {
        let str = dependencies.join("\n\n");
        let dialog_message = uuid + "\n\n" + _("The following packages were not found:") + "\n\n" +
                             str + "\n\n" + _("Please install the above packages to use the applet");
        let dialog = new ModalDialog.NotifyDialog(dialog_message);
        dialog.open();
    },

    _init_tts_engine_satisfied: function () {
        let satisfied = this._check_tts_engine();
        if(satisfied) {
            this._run_satisfied();
        }
    },

    _check_tts_engine: function() {
        let tts_engine_satisfied = this._tts_engine_available();
        this.is_tts_engine_dialog_confirmed = this.settings.getValue("is_tts_engine_dialog_confirmed");
        if(!tts_engine_satisfied && !this.is_tts_engine_dialog_confirmed) {
            this._show_tts_engine_dialog();
            return false;
        }
        return true;
    },

    _tts_engine_available: function() {
        let process = new ShellUtils.ShellOutputProcess(["which", this.tts_engine_name]);
        let output = process.spawn_sync_and_get_output();
        return output.length > 0;
    },

    _show_tts_engine_dialog: function() {
        let dialog_message =
            uuid + "\n\n" +
            _("The default text-to-speech engine") + " '" + this.tts_engine_name + "' " + _("not found.") + "\n\n" +
            _("To use the applet either install") + " '" + this.tts_engine_name + "' " +
            _("or specify other engine as 'Voice command' parameter in applet configuration.") + "\n\n" +
            _("Do you want to continue ?");
        let dialog = new ModalDialog.ConfirmDialog(dialog_message,
                                        Lang.bind(this, this._set_tts_engine_dialog_confirmed_run_satisfied));
        dialog.open();
    },

    _set_tts_engine_dialog_confirmed_run_satisfied: function() {
        this.is_tts_engine_dialog_confirmed = true;
        this.settings.setValue("is_tts_engine_dialog_confirmed", this.is_tts_engine_dialog_confirmed);
        this._run_satisfied();
    },






    _run_satisfied: function () {
        this._init_layout();
        this._init_translations();
        this._init_keybinds();
        this._init_voice_process();
        this._init_line_separator_regex();
        this._init_hover_popup();
        this._init_gui();
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

    _init_translations: function() {
        try {
            let translator = new Translation.Translator();
            translator.bind_domain();
            translator.generate_files();
        }
        catch(e) {
            global.log(uuid + " error while initializing translations: " + e);
        }
    },

    _init_keybinds: function () {
        this.start_stop_keybind = new Keyboard.KeyBind(this.start_stop_keybind_id, this.start_stop_keys);
        this.pause_resume_keybind = new Keyboard.KeyBind(this.pause_resume_keybind_id, this.pause_resume_keys);
        this.start_stop_keybind.set_callback_key_pressed(this, this.on_applet_clicked);
        this.pause_resume_keybind.set_callback_key_pressed(this, this.pause_or_resume_reading);
        this.on_start_stop_keys_changed();
        this.on_pause_resume_keys_changed();
    },

    _init_voice_process: function () {
        this.voice_process = new ShellUtils.BackgroundProcess([], false);
        this.voice_process.set_callback_process_finished(this, this.on_voice_process_finished);
    },

    _init_line_separator_regex: function () {
        this.on_line_separator_changed();
    },

    _init_hover_popup: function () {
        this.hover_popup = new AppletGui.UnfreezeCinnamonHoverMenu(this, this.orientation);
    },

    _init_gui: function () {
        this.set_gui_idle();
    },

    on_voice_process_finished: function (pid, status) {
        this.set_gui_idle();
    },





    // Override
    on_applet_removed_from_panel: function() {
        this.remove_keybinds();
    },

    remove_keybinds: function () {
        this.start_stop_keybind.remove();
        this.pause_resume_keybind.remove();
    },

    // Override
    _onButtonPressEvent: function (actor, event) {
        let handled = false;
        let button = event.get_button();
        if (button == Clutter.BUTTON_MIDDLE) {
            handled = this.on_middle_mouse_button_clicked(actor, event);
        }
        else {
            handled = Applet.TextApplet.prototype._onButtonPressEvent.call(this, actor, event);
        }
        return handled;
    },

    on_middle_mouse_button_clicked: function (actor, event) {
        let is_running = this.is_voice_process_running();
        if (is_running && this._applet_enabled) {
            this.pause_or_resume_reading();
        }
        return true;
    },

    pause_or_resume_reading: function () {
        let is_paused = this.is_voice_process_paused();
        if(is_paused){
            this.resume_reading();
        }
        else {
            this.pause_reading();
        }
    },

    resume_reading: function () {
        this.voice_process.resume();
        this.set_gui_reading();
    },

    pause_reading: function () {
        this.voice_process.pause();
        this.set_gui_paused();
    },

    // Override
    on_applet_clicked: function(event) {
        let is_paused = this.is_voice_process_paused();
        if(is_paused) {
            this.resume_reading();
        }
        else {
            this.start_or_stop_reading();
        }
    },

    start_or_stop_reading: function () {
        let is_running = this.is_voice_process_running();
        if(is_running){
            this.stop_reading();
        }
        else {
            this.start_reading();
        }
    },

    stop_reading: function () {
        this.voice_process.kill();
    },

    start_reading: function () {
        let argv = this.get_voice_command_argv();
        if(argv != null) {
            this.update_text();
            this.spawn_voice_process(argv);
        }
        else {
            this.notify_parse_error();
        }
    },

    get_voice_command_argv: function () {
        let [success, argv] = this.parse_command_to_argv();
        if(success) {
            argv = this.append_text_to_read(argv);
            return argv;
        }
        return null;
    },

    parse_command_to_argv: function () {
        let [success, argv] = [true, []];
        if(this.voice_command.length > 0) {
            [success, argv] = GLib.shell_parse_argv(this.voice_command);
        }
        return [success, argv];
    },

    append_text_to_read: function (argv) {
        let text = this.get_text_to_read();
        argv.push(text);
        return argv;
    },

    get_text_to_read: function () {
        this.update_current_text();
        let text = this.get_lines_to_read();
        text = this.remove_dash_from_beggining(text);
        return text;
    },

    update_current_text: function () {
        let text = this.clipboard_reader.read_text(this.clipboard_type);
        this.current_text = text.trim();
    },

    get_lines_to_read: function () {
        let text = this.current_text;
        if(this.read_lines_and_stop) {
            let start = this.get_start_line();
            let stop = this.get_stop_line(start);
            text = this.get_lines(start, stop);
        }
        return text;
    },

    get_start_line: function () {
        return this.previous_text == this.current_text ? this.line_resume_reading : 0;
    },

    get_stop_line: function (start) {
        return start + this.number_lines_to_read;
    },

    get_lines: function (start, stop) {
        let array_lines = this.split_lines();
        let lines = this.get_lines_from_array(array_lines, start, stop);
        return lines;
    },

    split_lines: function () {
        let array_lines = this.current_text.split(this.line_separator_regex);
        array_lines = this.remove_last_line_if_whitespace(array_lines);
        return array_lines;
    },

    remove_last_line_if_whitespace: function (array_lines) {
        let last_index = array_lines.length - 1;
        let last_line = array_lines[last_index];
        if(array_lines.length > 1 && this.is_whitespace_string(last_line)) {
            array_lines.pop();
        }
        return array_lines;
    },

    is_whitespace_string: function (str) {
        trimmed_string = str.trim();
        return trimmed_string.length == 0;
    },

    get_lines_from_array: function (array_lines, start, stop) {
        let join_character = "\n";
        array_lines = array_lines.slice(start, stop);
        let lines = array_lines.join(join_character);
        return lines;
    },

    remove_dash_from_beggining: function (lines) {
        lines = lines.replace(/^[\s-]+/i, "");
        return lines;
    },

    update_text: function () {
        this.update_line_resume();
        this.update_previous_text();
    },

    update_line_resume: function () {
        if(this.read_lines_and_stop) {
            let start = this.get_start_line();
            let stop = this.get_stop_line(start);
            let array_lines = this.split_lines();
            this.update_line_resume_reading(array_lines, stop);
        }
    },

    update_line_resume_reading: function (array_lines, stop) {
        if(stop < array_lines.length) {
            this.line_resume_reading = stop;
        }
        else {
            this.line_resume_reading = 0;
        }
    },

    update_previous_text: function () {
        this.previous_text = this.current_text;
    },

    notify_parse_error: function () {
        let title = _("Error parsing command parameters");
        let msg = _("Try to use less parameters to determine which one is causing the error");
        Main.notifyError(title, msg);
    },

    spawn_voice_process: function (argv) {
        try {
            this.voice_process.command_argv = argv;
            this.voice_process.spawn_async();
            this.set_gui_reading();
        }
        catch(e) {
            global.log("Error while spawning voice process: " + e);
        }
    },

};





function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}





