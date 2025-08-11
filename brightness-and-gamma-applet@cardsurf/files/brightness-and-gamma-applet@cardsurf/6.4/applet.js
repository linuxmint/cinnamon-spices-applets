
const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Extension = imports.ui.extension;

const uuid = "brightness-and-gamma-applet@cardsurf";

const SunCalc = require('./lib/suncalc');
const AppletGui = require('./lib/appletGui');
const AppletConstants = require('./lib/appletConstants');
const ShellUtils = require('./lib/shellUtils');
const Values = require('./lib/values');
const {
  timeout_add_seconds,
  setTimeout,
  clearTimeout,
  remove_all_sources
} = require('./lib/mainloopTools');

const MinXrandrVersion = 1.4;
const MinRandrVersion = 1.2;

const SCRIPT_NUMBER_OF_MONITORS = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/6.4/scripts/number-of-monitors.sh";

// Translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(uuid, str);
}

const TR_BRIGHTNESS = _("Brightness");
const TR_RED = _("Red");
const TR_GREEN = _("Green");
const TR_BLUE = _("Blue");
const TR_SUNRISE = _("Sunrise");
const TR_SUNSET = _("Sunset");

var MAX_TR_LENGTH = TR_BRIGHTNESS.length;
for (let tr of [TR_RED, TR_GREEN, TR_BLUE, TR_SUNRISE, TR_SUNSET]) {
    if (tr.length > MAX_TR_LENGTH) MAX_TR_LENGTH = tr.length;
}

class Output {
    constructor(output_name, is_connected) {
        this.output_name = output_name;
        this.is_connected = is_connected;
    }
}

class BrightnessAndGamma extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.panel_orientation = orientation;
        this.applet_directory = this._get_applet_directory();
        this.is_running = true;

        this.screen_outputs = {};
        this.menu_item_screen_position = 0;
        this.menu_item_outputs_position = 1;
        this.menu_item_presets_position = 2;
        this.menu_item_configure_presets_position = 3;
        this.menu_item_reload_applet_position = 4;
        this.menu_item_screen = null;
        this.menu_item_outputs = null;
        this.menu_sliders = null;
        this.file_schema = "file://";
        this.home_shortcut = "~";
        this.xrandr_name = "xrandr";
        this.randr_name = "RandR";
        this.xrandr_regex = new RegExp(this.xrandr_name, "i");
        this.randr_regex = new RegExp(this.randr_name, "i");
        this.version_regex = new RegExp("[0-9]+[\.][0-9]+","i");
        this.screen_regex = new RegExp("screen.*:","i");
        this.number_regex = new RegExp("[0-9]+","");
        this.output_line_separator = " ";
        this.output_name_index = 0;
        this.output_status_index = 1;
        this.output_connected = "connected";
        this.output_disconnected = "disconnected";
        this.gamma_separator = ":";
        this.output_indexes_separator = "^";
        this.last_values_string = "";

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.default_screen_name = "";
        this.default_output_indexes = [];
        this.minimum_brightness = 10;
        this.maximum_brightness = 100;
        this.minimum_gamma = 10;
        this.maximum_gamma = 100;
        this.default_save_every = 60;
        this.screen_name = this.default_screen_name;
        this.output_indexes = this.default_output_indexes;
        this.brightness = this.maximum_brightness;
        this.gamma_red = this.maximum_gamma;
        this.gamma_green = this.maximum_gamma;
        this.gamma_blue = this.maximum_gamma;
        this.save_every = this.default_save_every;
        this.update_scroll = true;
        this.scroll_step = 5;
        this.options_type = AppletConstants.OptionsType.ALL;
        this.gui_icon_filepath = "";
        this.apply_startup = true;
        this.apply_every = 0;
        this.apply_asynchronously = true;
        this.gsettings = Gio.Settings.new("org.cinnamon.settings-daemon.plugins.color");
        this.sunrise_sunset();
        //~ this.numberOfMonitors = 0;

        this._init_dependencies_satisfied();
    }

    //~ check_number_of_monitors() {
        //~ if (!this.apply_changing_monitors) return;
        //~ let process = Util.spawnCommandLineAsyncIO(SCRIPT_NUMBER_OF_MONITORS, (stdout, stderr, exitCode) => {
            //~ if (exitCode === 0) {
                //~ let numberOfMonitors = parseInt(stdout.trim());
                //~ if (numberOfMonitors !== this.numberOfMonitors) {
                    //~ this.numberOfMonitors = numberOfMonitors;
                    //~ this.on_number_of_monitors_changed();
                    //~ global.log(uuid + " - this.numberOfMonitors: " + this.numberOfMonitors);
                //~ }
            //~ }
            //~ process.send_signal(9);
        //~ });
    //~ }

    //~ on_number_of_monitors_changed() {
        //~ if (!this.apply_changing_monitors) return;
        //~ this.on_preset_reload_button_clicked();
    //~ }

    sunrise_sunset() {
        let schedule_mode = this.gsettings.get_string("night-light-schedule-mode");
        if (schedule_mode == "manual") {
            let _sunset = this.gsettings.get_value("night-light-schedule-from").unpack(); // type (d)
            let _sunrise = this.gsettings.get_value("night-light-schedule-to").unpack(); // type (d)
            this.sunrise = Math.round(_sunrise * 4)/4;
            this.sunset = Math.round(_sunset * 4)/4;
            return [this.sunrise, this.sunset];
        }
        let [lat, lon] = this.gsettings.get_value("night-light-last-coordinates").unpack(); // type (dd)
        lat = lat.unpack(); // type (d)
        lon = lon.unpack(); // type (d)

        if (  Math.round(lat) == 91 || Math.round(lon) == 181 ) {
          this.sunrise = 6;
          this.sunset = 20;
        } else {
          try {
            var times = SunCalc.getTimes(new Date(), lat, lon);
            this.sunrise = parseInt(times.sunrise.getHours()) + parseInt(times.sunrise.getMinutes()) / 60;
            this.sunset = parseInt(times.sunset.getHours()) + parseInt(times.sunset.getMinutes()) / 60;
          } catch(e) {
            let _sunset = this.gsettings.get_value("night-light-schedule-from").unpack(); // type (d)
            let _sunrise = this.gsettings.get_value("night-light-schedule-to").unpack(); // type (d)
            this.sunrise = Math.round(_sunrise * 4)/4;
            this.sunset = Math.round(_sunset * 4)/4;
            return [this.sunrise, this.sunset];
          }
        }
        this.sunrise = Math.round(this.sunrise * 4)/4;
        this.sunset = Math.round(this.sunset * 4)/4;
        //~ global.log("sunrise: " + this.sunrise + " - sunset: " + this.sunset);
        return [this.sunrise, this.sunset];
    }

    frac_to_h_m(fraction) {
        let hours = Math.trunc(fraction);
        let minutes = Math.trunc((fraction - hours) * 60);
        if (hours < 10)
            hours = "0" + hours.toString();
        else
            hours = hours.toString();
        if (minutes < 10)
            minutes = "0" + minutes.toString();
        else
            minutes = minutes.toString();
        return hours + ":" + minutes;
    }

    _get_applet_directory() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    }

    _init_dependencies_satisfied() {
        let satisfied = this._check_dependencies();
        if(satisfied) {
            this._run_dependencies_satisfied();
        }
    }

    _check_dependencies() {
        return this._check_xrandr() && this._check_randr();
    }

    _check_xrandr() {
        let xrandr_satisfied = this._xrandr_available() && this._xrandr_version_satisfied();
        if(!xrandr_satisfied) {
            let dependencies = this._get_dependencies(this.xrandr_name, MinXrandrVersion);
            this._show_dialog_dependencies(dependencies);
            return false;
        }
        return true;
    }

    _xrandr_available() {
        let process = new ShellUtils.ShellOutputProcess(["which", this.xrandr_name]);
        let output = process.spawn_sync_and_get_output();
        return output.length > 0;
    }

    _xrandr_version_satisfied() {
        let lines = this._get_xrandr_version_lines();
        let line = this.get_line_or_empty_string(lines, this.xrandr_regex);
        return this._is_version_satisfied(line, MinXrandrVersion);
    }

    _get_xrandr_version_lines() {
        let process = new ShellUtils.ShellOutputProcess([this.xrandr_name, "--version"]);
        let output = process.spawn_sync_and_get_output();
        let lines = output.split('\n');
        return lines;
    }

    get_line_or_empty_string(lines, regex) {
        for(let line of lines) {
            if(regex.test(line)) {
                return line;
            }
        }
        return "";
    }

    _is_version_satisfied(line, min_version) {
        if(this.version_regex.test(line)) {
            let matches = line.match(this.version_regex);
            let version_match = matches[0];
            return parseFloat(version_match) >= min_version;
        }
        return false;
    }

    _get_dependencies(dependency, min_version) {
        return ">= " + dependency + " " + min_version;
    }

    _show_dialog_dependencies(dependencies) {
        let dialog_message = uuid + "\n\n" + _("The following packages were not found:") + "\n\n" +
                             dependencies + "\n\n" + _("Please install the above packages to use the applet");
        let dialog = new ModalDialog.NotifyDialog(dialog_message);
        dialog.open();
    }

    _check_randr() {
        let randr_satisfied = this._randr_version_satisfied();
        if(!randr_satisfied) {
            let dependencies = this._get_dependencies(this.randr_name, MinRandrVersion);
            this._show_dialog_dependencies(dependencies);
            return false;
        }
        return true;
    }

    _randr_version_satisfied() {
        let lines = this._get_xrandr_version_lines();
        let line = this.get_line_or_empty_string(lines, this.randr_regex);
        return this._is_version_satisfied(line, MinRandrVersion);
    }







    _run_dependencies_satisfied() {
        this._init_layout();
        this._bind_settings();
        this._connect_signals();
        this._init_values();
        this._init_screen_outputs();
        this._init_screen_output();
        this._init_context_menu();
        this._init_menu_sliders();
        this._init_gui();
        this._update_xrandr_startup();

        this.run();
    }

    _init_layout() {
        this._enable_hotizontal_vertical_layout();
    }

    _enable_hotizontal_vertical_layout() {
        let supported = this.is_vertical_layout_supported();
        if(supported) {
            this._try_enable_hotizontal_vertical_layout();
        }
    }

    is_vertical_layout_supported() {
        return this._is_set_allowed_layout_defined();
    }

    _is_set_allowed_layout_defined() {
        return this.is_function_defined(this.setAllowedLayout);
    }

    is_function_defined(reference) {
        return typeof reference === "function";
    }

    _try_enable_hotizontal_vertical_layout() {
        try {
             this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }
        catch(e) {
            global.log("Error while enabling vertical and horizontal layout: " + e);
        }
    }

    _bind_settings() {
        for(let [property_name, callback] of [
                        ["disable_nightmode", this._run_apply_values_running],
                        //~ ["numberOfMonitors", null],
                        ["apply_asynchronously", null],
                        ["apply_startup", null],
                        ["apply_every", null],
                        ["apply_changing_monitors", null],
                        ["save_every", null],
                        ["update_scroll", null],
                        ["scroll_step", null],
                        ["brightness_up_shortcut", this.on_shortcut_changed],
                        ["brightness_down_shortcut", this.on_shortcut_changed],
                        ["minimum_brightness", this.on_brightness_range_changed],
                        ["maximum_brightness", this.on_brightness_range_changed],
                        ["minimum_gamma", this.on_gamma_range_changed],
                        ["maximum_gamma", this.on_gamma_range_changed],
                        ["options_type", this.on_options_type_changed],
                        ["preset_list", this.on_preset_list_changed],
                        ["gui_icon_filepath", this.on_gui_icon_changed],
                        ["last_values_string", null] ]) {
                this.settings.bind(property_name, property_name, callback, null);
                this.old_preset_list = this.preset_list;
        }
    }

    on_preset_list_changed() {
        this._init_menu_item_presets();
    }

    on_disable_nightmode_changed() {
        if (this.disable_nightmode) {
            let gsettings = Gio.Settings.new("org.cinnamon.settings-daemon.plugins.color");
            let nightmode_is_enabled = gsettings.get_boolean("night-light-enabled");
            if (nightmode_is_enabled)
                gsettings.set_boolean("night-light-enabled", false);
        }
    }

    on_brightness_range_changed() {
        let value = this.get_range_value(this.minimum_brightness, this.maximum_brightness, this.brightness);
        let outside = this.brightness != value;
        this.brightness = value;
        this.menu_sliders.update_items_brightness();
        this.update_brightness_active(outside);
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

    update_brightness_active(outside) {
        let active = this.is_brightness_active();
        if(active) {
            this.update_xrandr_outside(outside);
        }
    }

    is_brightness_active() {
        return this.options_type == AppletConstants.OptionsType.ALL ||
               this.options_type == AppletConstants.OptionsType.BRIGHTNESS;
    }

    update_xrandr_outside(outside) {
        if(outside) {
            this.update_xrandr();
        }
    }

    on_gamma_range_changed() {
        let outside = false;
        outside = this.on_gamma_red_range_changed() || outside;
        outside = this.on_gamma_green_range_changed() || outside;
        outside = this.on_gamma_blue_range_changed() || outside;
        this.update_gamma_active(outside);
    }

    on_gamma_red_range_changed() {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_red);
        let outside = this.gamma_red != value;
        this.gamma_red = value;
        this.menu_sliders.update_items_gamma_red();
        return outside;
    }

    on_gamma_green_range_changed() {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_green);
        let outside = this.gamma_green != value;
        this.gamma_green = value;
        this.menu_sliders.update_items_gamma_green();
        return outside;
    }

    on_gamma_blue_range_changed() {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_blue);
        let outside = this.gamma_blue != value;
        this.gamma_blue = value;
        this.menu_sliders.update_items_gamma_blue();
        return outside;
    }

    update_gamma_active(outside) {
        let active = this.is_gamma_active();
        if(active) {
            this.update_xrandr_outside(outside);
        }
    }

    is_gamma_active() {
        return this.options_type == AppletConstants.OptionsType.ALL ||
               this.options_type == AppletConstants.OptionsType.GAMMA;
    }

    on_options_type_changed() {
        this._init_menu_sliders();
        this.set_MAX_TR_LENGTH();
        this.update_tooltip();
    }

    set_MAX_TR_LENGTH() {
        if (this.options_type == 2) {
            MAX_TR_LENGTH = TR_RED.length;
            for (let tr of [TR_GREEN, TR_BLUE, TR_SUNRISE, TR_SUNSET]) {
                if (tr.length > MAX_TR_LENGTH) MAX_TR_LENGTH = tr.length;
            }
        } else {
            MAX_TR_LENGTH = TR_BRIGHTNESS.length;
            for (let tr of [TR_RED, TR_GREEN, TR_BLUE, TR_SUNRISE, TR_SUNSET]) {
                if (tr.length > MAX_TR_LENGTH) MAX_TR_LENGTH = tr.length;
            }
        }
    }

    on_gui_icon_changed() {
        this.set_gui_icon();
    }

    set_gui_icon() {
        let path = this.remove_file_schema(this.gui_icon_filepath);
        path = this.replace_tilde_with_home_directory(path);
        let exists = this.file_exists(path);
        if (exists) {
            this.set_applet_icon_path(path);
        }
    }

    remove_file_schema(path) {
        path = path.replace(this.file_schema, "");
        return path;
    }

    replace_tilde_with_home_directory(path) {
        let home_directory = GLib.get_home_dir();
        path = path.replace(this.home_shortcut, home_directory);
        return path;
    }

    file_exists(path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    }

    _connect_signals() {
        try {
            this.actor.connect('scroll-event', (actor, event) => { this.on_mouse_scroll(actor, event) });
        }
        catch(e) {
            global.log("Error while connecting signals: " + e);
        }
    }

    on_mouse_scroll(actor, event) {
        if(this.update_scroll) {
            let direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP) {
                this.increase_brightness_scroll();
            }
            else if (direction === Clutter.ScrollDirection.DOWN) {
                this.decrease_brightness_scroll();
            }
        }
    }

    update_brightness_scroll(value) {
        let _value = this.get_range_value(this.minimum_brightness, this.maximum_brightness, value);
        if(_value != this.brightness) {
            this.update_brightness(_value);
            this.menu_sliders.update_items_brightness();
        }
    }

    increase_brightness_scroll() {
        let value = this.brightness + this.scroll_step;
        this.update_brightness_scroll(value);
    }

    decrease_brightness_scroll() {
        let value = this.brightness - this.scroll_step;
        this.update_brightness_scroll(value);
    }

    /** Keybinding
   */
    on_shortcut_changed() {
        try{
            Main.keybindingManager.removeHotKey("brightnessUp");
            Main.keybindingManager.removeHotKey("brightnessDn");
        } catch(e) {}
        if (this.brightness_up_shortcut != null) {
            Main.keybindingManager.addHotKey("brightnessUp", this.brightness_up_shortcut, (event) => this.increase_brightness_scroll())
        }
        if (this.brightness_down_shortcut != null) {
            Main.keybindingManager.addHotKey("brightnessDn", this.brightness_down_shortcut, (event) => this.decrease_brightness_scroll())
        }
    }


    // Override
    on_applet_clicked(event) {
        this.menu_sliders.toggle();
    }

    // Override
    on_applet_added_to_panel() {
        this.on_shortcut_changed();
        this.on_disable_nightmode_changed();
        this.set_MAX_TR_LENGTH();
        this._applet_tooltip._tooltip.set_style('font-family: monospace;');
        this._check_sunrise_sunset(true);
        this.update_tooltip();
        timeout_add_seconds(900, () => { this._check_sunrise_sunset(); return this.is_running; });
        //~ timeout_add_seconds(1, () => { this.check_number_of_monitors(); return this.is_running; });
        Main.layoutManager.connect('monitors-changed', () => { if (this.apply_changing_monitors) this.on_preset_reload_button_clicked(); });
    }

    // Override
    on_applet_removed_from_panel() {
        this.save_last_values();
        try{
            Main.keybindingManager.removeHotKey("brightnessUp");
            Main.keybindingManager.removeHotKey("brightnessDn");
        } catch(e) {}
        this.is_running = false;
        remove_all_sources();
    }

    _init_gui() {
        this.set_gui_icon();
    }

    _init_screen_outputs() {
        let lines = this.list_screen_outputs();
        lines =  lines.split('\n');

        for(let i = 0; i < lines.length; ++i) {
            let line = lines[i];
            if(this._is_screen_line(line)) {
                let screen_name = this._parse_screen_name(line);
                let start_index = i + 1;
                let outputs = this._parse_outputs(lines, start_index);
                this.screen_outputs[screen_name] = outputs;
                i += outputs.length;
            }
        }
    }

    list_screen_outputs() {
        let process = new ShellUtils.ShellOutputProcess([this.xrandr_name, "--query"]);
        let output = process.spawn_sync_and_get_output();
        return output;
    }

    _is_screen_line(line) {
        return this.screen_regex.test(line);
    }

    _parse_screen_name(line) {
        let matches = line.match(this.screen_regex);
        let screen_name = matches[0];
        let last_character_index = screen_name.length - 1;
        screen_name = screen_name.substring(0, last_character_index);
        return screen_name;
    }

    _parse_outputs(lines, start_index) {
        let outputs = [];
        for(let i = start_index; i < lines.length; ++i) {
            let line = lines[i];
            if(this._is_output_line(line)) {
                let output = this._parse_output(line);
                outputs.push(output);
            }
            else if(this._is_screen_line(line)) {
                break;
            }
        }
        return outputs;
    }

    _is_output_line(line) {
        let strings = line.split(this.output_line_separator);
        return strings.length >= 2 && (strings[this.output_status_index] == this.output_connected ||
                                       strings[this.output_status_index] == this.output_disconnected);
    }

    _parse_output(line) {
        let strings = line.split(this.output_line_separator);
        let output_name = strings[this.output_name_index];
        let is_connected = strings[this.output_status_index] == this.output_connected ? true : false;
        let output = new Output(output_name, is_connected);
        return output;
    }

    _init_screen_output() {
        let is_default = this.is_screen_output_default();
        if(is_default) {
            this.set_connected_screen();
        }
    }

    is_screen_output_default() {
        return this.screen_name == this.default_screen_name && this.output_indexes == this.default_output_indexes;
    }

    set_connected_screen() {
        for(let screen_name in this.screen_outputs) {
            let outputs = this.screen_outputs[screen_name];
            if(this.set_connected_outputs(outputs)) {
                this.screen_name = screen_name;
                return true;
            }
        }
        return false;
    }

    set_connected_outputs(outputs) {
        let found = false;
        for(let i = 0; i < outputs.length; ++i) {
            let output = outputs[i];
            if(output.is_connected) {
                this.output_indexes.push(i);
                found = true;
            }
        }
        return found;
    }

    _init_values() {
        this.load_last_values();
    }

    load_last_values() {
        try {
            if(this.last_values_string.length > 0) {
                let row = Values.to_last_values_row(this.last_values_string);
                this.screen_name = row.screen_name;
                let output_indexes = row.output_indexes_string.split(this.output_indexes_separator);
                this.output_indexes = output_indexes.map(function(output_index) { return parseInt(output_index); });
                this.brightness = row.brightness;
                this.gamma_red = row.gamma_red;
                this.gamma_green = row.gamma_green;
                this.gamma_blue = row.gamma_blue;
            }
        }
        catch(e) {
            global.log("Error while loading last values: " + e);
        }
    }

    _init_context_menu() {
        this._init_menu_item_screen();
        this._init_menu_item_outputs();
        this._init_menu_item_presets();
        this._init_menu_item_configure_presets();
        this._init_menu_item_reload_applet();
    }

    _init_menu_item_reload_applet() {
        if (this.menu_item_reload_applet) {
            let children = this._applet_context_menu._getMenuItems();
            children[this.menu_item_reload_applet_position].destroy();
        }
        this.menu_item_reload_applet = this._applet_context_menu.addAction(_("Reload"), () => {
            this.on_preset_reload_button_clicked();
        });
    }

    _init_menu_item_configure_presets() {
        if (this.menu_item_configure_presets) {
            let children = this._applet_context_menu._getMenuItems();
            children[this.menu_item_configure_presets_position].destroy();
        }
        this.menu_item_configure_presets = this._applet_context_menu.addAction(_("Configure Presets"), () => {
            Util.spawnCommandLineAsync(`cinnamon-settings applets ${uuid} -t1`);
        });
    }

    _init_menu_item_presets() {
        if (this.menu_item_presets) {
            let children = this._applet_context_menu._getMenuItems();
            children[this.menu_item_presets_position].destroy();
        }
        this.menu_item_presets = new PopupMenu.PopupSubMenuMenuItem(_("Presets"));
        for (let preset of this.preset_list) {
            if (preset.show) {
                let menuItem = this.menu_item_presets.menu.addAction(preset["name"], () => {
                    this.brightness = Math.max(preset["brightness"], this.minimum_brightness);
                    this.gamma_red = Math.max(preset["gamma_red"], this.minimum_gamma);
                    this.gamma_green = Math.max(preset["gamma_green"], this.minimum_gamma);
                    this.gamma_blue = Math.max(preset["gamma_blue"], this.minimum_gamma);
                    this.menu_sliders.update_items_brightness();
                    this.menu_sliders.update_items_gamma_red();
                    this.menu_sliders.update_items_gamma_green();
                    this.menu_sliders.update_items_gamma_blue();
                    this.update_xrandr();
                    this.update_tooltip();
                    this._init_menu_item_presets();
                });
                if (this.brightness == preset["brightness"] &&
                    this.gamma_red == preset["gamma_red"] &&
                    this.gamma_green == preset["gamma_green"] &&
                    this.gamma_blue == preset["gamma_blue"]) {
                        menuItem.setOrnament(PopupMenu.OrnamentType.DOT, true);
                } else {
                        menuItem.setOrnament(PopupMenu.OrnamentType.DOT, false);
                }
            }
        }
        this._applet_context_menu.addMenuItem(this.menu_item_presets, this.menu_item_presets_position);
    }

    _init_menu_item_screen() {
        let screen_names = this.get_screen_names();
        this.menu_item_screen = new AppletGui.RadioMenuItem(_("Screen"), screen_names);
        this.menu_item_screen.set_callback_option_clicked(this, this.on_menu_item_screen_clicked);
        this.set_menu_item_screen_option();
        this._applet_context_menu.addMenuItem(this.menu_item_screen, this.menu_item_screen_position);
    }

    get_screen_names() {
        let screen_names = [];
        for(let screen_name in this.screen_outputs) {
            screen_names.push(screen_name);
        }
        return screen_names;
    }

    on_menu_item_screen_clicked(option_name, option_index) {
        if(this.screen_name != option_name) {
            this.screen_name = option_name;
            this.reload_outputs();
            this.reload_menu_item_outputs();
            this.update_xrandr();
        }
    }

    set_menu_item_screen_option() {
        let valid = this.is_screen_valid();
        if(valid) {
            this.menu_item_screen.set_active_option_name(this.screen_name);
        }
    }

    is_screen_valid() {
        return this.dictionary_contains(this.screen_outputs, this.screen_name);
    }

    dictionary_contains(dictionary, key) {
        return key in dictionary;
    }

    reload_outputs() {
        let outputs = this.screen_outputs[this.screen_name];
        this.output_indexes = [];
        this.set_connected_outputs(outputs);
    }

    reload_menu_item_outputs() {
        let names = this.get_output_names();
        let checked = this.get_output_checked();
        this.menu_item_outputs.reload_options(names, checked);
    }

    get_output_names() {
        let valid = this.is_screen_valid();
        if(valid) {
            let outputs = this.screen_outputs[this.screen_name];
            return outputs.map(function(output) { return output.output_name; });
        }
        return [];
    }

    get_output_checked() {
        let valid = this.is_screen_valid();
        if(valid) {
            let result = this.get_output_checked_valid();
            return result;
        }
        return [];
    }

    get_output_checked_valid() {
        let checked = [];
        let outputs = this.screen_outputs[this.screen_name];
        let index = 0;
        for(let i = 0; i < outputs.length; ++i) {
            let output_checked = index < this.output_indexes.length && i == this.output_indexes[index];
            checked[i] = index < this.output_indexes.length && i == this.output_indexes[index];
            if(output_checked) {
                ++index;
            }
        }
        return checked;
    }

    _init_menu_item_outputs() {
        this.menu_item_outputs = new AppletGui.CheckboxMenuItem(_("Outputs"));
        this.menu_item_outputs.set_callback_option_toggled(this, this.on_menu_item_outputs_toggled);
        this.reload_menu_item_outputs();
        this._applet_context_menu.addMenuItem(this.menu_item_outputs, this.menu_item_outputs_position);
    }

    on_menu_item_outputs_toggled(option_index, option_name, checked) {
        let array_index = this.output_indexes.indexOf(option_index);
        let contains = array_index > -1;
        if(contains) {
            this.array_remove(this.output_indexes, array_index);
        }
        else {
            this.array_insert(this.output_indexes, option_index);
            this.update_xrandr();
        }
    }

    array_remove(array, index) {
        array.splice(index, 1);
    }

    array_insert(array, number) {
        let index = this.find_insert_index(array, number);
        array.splice(index, 0, number);
    }

    find_insert_index(array, number) {
          let middle = 0;
          let lower = 0;
          let upper = array.length - 1;
          while (lower <= upper) {
              middle = Math.floor((lower + upper) / 2);
              if (number < array[middle]) {
                  upper = middle - 1;
              } else if (number > array[middle]) {
                  lower = middle + 1;
              } else {
                  return middle;
              }
          }
          return lower == array.length ? array.length : middle;
    }

    _init_menu_sliders() {
        this.menu_sliders = new AppletGui.MenuSliders(this, this.panel_orientation);
    }

    update_tooltip() {
        let tips = [];
        if (this.options_type != 2) {
            let s_brightness = "" + this.brightness;
            if (this.brightness < 100) s_brightness = " " + s_brightness;
            if (this.brightness < 10 ) s_brightness = " " + s_brightness;
            tips.push(" ".repeat(MAX_TR_LENGTH - TR_BRIGHTNESS.length) + `${TR_BRIGHTNESS} <b>${s_brightness}</b>`);
        }
        if (this.options_type != 1) {
            let s_gamma_red = "" + this.gamma_red;
            if (this.gamma_red < 100) s_gamma_red = " " + s_gamma_red;
            if (this.gamma_red < 10 ) s_gamma_red = " " + s_gamma_red;
            tips.push(" ".repeat(MAX_TR_LENGTH - TR_RED.length) + `${TR_RED} <b>${s_gamma_red}</b>`);
            let s_gamma_green = "" + this.gamma_green;
            if (this.gamma_green < 100) s_gamma_green = " " + s_gamma_green;
            if (this.gamma_green < 10 ) s_gamma_green = " " + s_gamma_green;
            tips.push(" ".repeat(MAX_TR_LENGTH - TR_GREEN.length) + `${TR_GREEN} <b>${s_gamma_green}</b>`);
            let s_gamma_blue = "" + this.gamma_blue;
            if (this.gamma_blue < 100) s_gamma_blue = " " + s_gamma_blue;
            if (this.gamma_blue < 10 ) s_gamma_blue = " " + s_gamma_blue;
            tips.push(" ".repeat(MAX_TR_LENGTH - TR_BLUE.length) + `${TR_BLUE} <b>${s_gamma_blue}</b>`);
        }
        tips.push("—".repeat(MAX_TR_LENGTH + 6));
        let str_sunrise = _("Sunrise") + " " + this.frac_to_h_m(this.sunrise);
        tips.push(" ".repeat(MAX_TR_LENGTH - TR_SUNRISE.length) + str_sunrise);
        let str_sunset = _("Sunset") + " " + this.frac_to_h_m(this.sunset);
        tips.push(" ".repeat(MAX_TR_LENGTH - TR_SUNSET.length) + str_sunset);
        this.set_applet_tooltip(tips.join("\n"), true);
    }

    update_brightness(value) {
        this.brightness = value;
        this.update_xrandr();
        this.update_tooltip();
        this._init_menu_item_presets();
    }

    update_gamma_red(value) {
        this.gamma_red = value;
        this.update_xrandr();
        this.update_tooltip();
        this._init_menu_item_presets();
    }

    update_gamma_green(value) {
        this.gamma_green = value;
        this.update_xrandr();
        this.update_tooltip();
        this._init_menu_item_presets();
    }

    update_gamma_blue(value) {
        this.gamma_blue = value;
        this.update_xrandr();
        this.update_tooltip();
        this._init_menu_item_presets();
    }

    _update_xrandr_startup() {
        if(this.apply_startup) {
            this.update_xrandr();
        }
    }

    update_xrandr() {
        for(let output_index of this.output_indexes) {
            let valid = this.is_screen_output_valid(output_index);
            if(valid) {
                this.update_xrandr_output(output_index);
            }
        }
    }

    is_screen_output_valid(output_index) {
        return this.is_screen_valid() && this.is_output_valid(output_index);
    }

    is_output_valid(output_index) {
        return output_index >= 0 && output_index < this.screen_outputs[this.screen_name].length;
    }

    update_xrandr_output(output_index) {
        let argv = this.get_xrandr_argv(output_index);
        this.spawn_xrandr_process(argv);
    }

    get_xrandr_argv(output_index) {
        let screen_parameter = this._get_screen_parameter();
        let output_parameter = this._get_output_parameter(output_index);
        let brightness_parameter = this._get_brightness_parameter();
        let gamma_parameter = this._get_gamma_parameter();

        let argv = [this.xrandr_name, "--screen", screen_parameter,
                                      "--output", output_parameter,
                                      "--brightness", brightness_parameter,
                                      "--gamma", gamma_parameter];
        return argv;
    }

    _get_screen_parameter() {
        let matches = this.number_regex.test(this.screen_name) ? this.screen_name.match(this.number_regex) : ["0"];
        let screen_index = matches.length > 0 ? matches[0] : "0";
        let parameter = screen_index.toString();
        return parameter;
    }

    _get_output_parameter(output_index) {
        let output = this.get_active_output(output_index);
        let parameter = output.output_name;
        return parameter;
    }

    get_active_output(output_index) {
        let outputs = this.screen_outputs[this.screen_name];
        let output = outputs[output_index];
        return output;
    }

    _get_brightness_parameter() {
        return this._get_scaled_parameter(this.brightness);
    }

    _get_scaled_parameter(number) {
        number = number / 100;
        let parameter = number.toString();
        return parameter;
    }

    _get_gamma_parameter() {
        let parameter_red = this._get_scaled_parameter(this.gamma_red);
        let parameter_green = this._get_scaled_parameter(this.gamma_green);
        let parameter_blue = this._get_scaled_parameter(this.gamma_blue);
        let parameter = parameter_red + this.gamma_separator + parameter_green + this.gamma_separator + parameter_blue;
        return parameter;
    }

    spawn_xrandr_process(argv) {
        if(this.apply_asynchronously) {
            this.spawn_xrandr_process_async(argv);
        }
        else {
            this.spawn_xrandr_process_sync(argv);
        }
    }

    spawn_xrandr_process_async(argv) {
        try {
            let xrandr_process = new ShellUtils.BackgroundProcess(argv, true);
            xrandr_process.set_callback_process_finished(this, this.on_xrandr_async_finished);
            xrandr_process.spawn_async();
        }
        catch(e) {
            global.log("Error while spawning asynchronously xrandr process: " + e.message);
        }
    }

    on_xrandr_async_finished(xrandr_process, pid, status) {
        let error = xrandr_process.get_standard_error_content();
        if(error.length > 0) {
            let error_message = "Error while updating brightness and gamma asynchronously: " + error;
            this.log_process_error(error_message, xrandr_process.command_argv);
        }
    }

    log_process_error(error_message, argv) {
        let text = error_message + ". Command line arguments: " + argv;
        global.log(text);
    }

    spawn_xrandr_process_sync(argv) {
        let xrandr_process = new ShellUtils.ShellOutputProcess(argv);
        let error = xrandr_process.spawn_sync_and_get_error();
        if(error.length > 0) {
            let error_message = "Error while updating brightness and gamma synchronously: " + error;
            this.log_process_error(error_message, xrandr_process.command_argv);
        }
    }






    run() {
        this._run_apply_values_running();
        this._run_save_last_values_running();
    }

    _run_apply_values_running() {
        this.on_disable_nightmode_changed();
        if(this.is_running) {
            this._apply_values();
        }
    }

    _apply_values() {
        if(this.apply_every > 0) {
            this.update_xrandr();
            timeout_add_seconds(this.apply_every, () => { this._run_apply_values_running() });
        }
        else {
            timeout_add_seconds(1, () => { this._run_apply_values_running() });
        }
    }

    _run_save_last_values_running() {
        if(this.is_running) {
            this._run_save_last_values();
        }
    }

    _run_save_last_values() {
        if(this.save_every > 0) {
            this.save_last_values();
            timeout_add_seconds(this.save_every, () => { this._run_save_last_values_running() });
        }
    }

    save_last_values() {
        try {
            let output_indexes_string = this.output_indexes.join(this.output_indexes_separator);
            let row = new Values.LastValuesRow(this.screen_name, output_indexes_string, this.brightness,
                                               this.gamma_red, this.gamma_green, this.gamma_blue);
            this.last_values_string = Values.to_csv_string(row);
        }
        catch(e) {
            global.log("Error while saving last values: " + e);
        }
    }

    _check_sunrise_sunset(starting=false) {
        let d = new Date();
        let m = d.getMinutes();
        let h = d.getHours();
        let fraction = h + m / 60;
        fraction = Math.round(fraction * 4) / 4;
        //~ global.log(uuid + ": fraction " + fraction);
        if (starting === true) {
            if (fraction >= this.sunrise && fraction < this.sunset)
                this._use_first_sunrise_preset();
            if (fraction >= this.sunset || (fraction >= 0 && fraction < this.sunrise))
                this._use_first_sunset_preset();
        } else {
            if (fraction == this.sunrise)
                this._use_first_sunrise_preset();
            if (fraction == this.sunset)
                this._use_first_sunset_preset();
        }
    }

    _use_first_sunrise_preset() {
        for (let preset of this.preset_list) {
            if (preset.show && preset.start_at_sunrise) {
                this.brightness = preset.brightness;
                this.gamma_blue = preset.gamma_blue;
                this.gamma_green = preset.gamma_green;
                this.gamma_red = preset.gamma_red;
                this._needed_updates();
                break;
            }
        }
    }

    _use_first_sunset_preset() {
        for (let preset of this.preset_list) {
            if (preset.show && preset.start_at_sunset) {
                this.brightness = preset.brightness;
                this.gamma_blue = preset.gamma_blue;
                this.gamma_green = preset.gamma_green;
                this.gamma_red = preset.gamma_red;
                this._needed_updates();
                break;
            }
        }
    }

    _needed_updates() {
        this.menu_sliders.update_items_brightness();
        this.menu_sliders.update_items_gamma_red();
        this.menu_sliders.update_items_gamma_green();
        this.menu_sliders.update_items_gamma_blue();
        this.update_xrandr();
        this.update_tooltip();
        this._init_menu_item_presets();
    }

    on_preset_sunrise_sunset_button_clicked() {
        Util.spawnCommandLineAsync("cinnamon-settings nightlight");
    }

    on_preset_reload_button_clicked() {
        let to = setTimeout(() => {
            clearTimeout(to);
            Extension.reloadExtension(uuid, Extension.Type.APPLET);
        }, 1000);
    }
};








function main(metadata, orientation, panel_height, instance_id) {
    return new BrightnessAndGamma(metadata, orientation, panel_height, instance_id);
}



