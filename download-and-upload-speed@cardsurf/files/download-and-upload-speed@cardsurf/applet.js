
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const uuid = 'download-and-upload-speed@cardsurf';
let AppletGui, AppletConstants, ShellUtils, Dates, Translation, Infos;
if (typeof require !== 'undefined') {
    AppletGui = require('./appletGui');
    AppletConstants = require('./appletConstants')
    ShellUtils = require('./shellUtils');
    Dates = require('./dates');
    Translation = require('./translation');
    Infos = require('./infos');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletGui = AppletDirectory.appletGui;
    AppletConstants = AppletDirectory.appletConstants
    ShellUtils = AppletDirectory.shellUtils;
    Dates = AppletDirectory.dates;
    Translation = AppletDirectory.translation;
    Infos = AppletDirectory.infos;
}

function _(str) {
    return Gettext.dgettext(uuid, str);
}







function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.is_running = true;

        this.network_directory = "/sys/class/net/";
        this.byte_start_times = [];
        this.dictionary_interface_to_info = {};
        this.network_interfaces = [];
        this.checked_interfaces = [];
        this.checked_interfaces_string = "";
        this.filepath_bytes_received = "";
        this.filepath_bytes_sent = "";
        this.filepath_bytes_total = "";
        this.file_bytes_received = null;
        this.file_bytes_sent = null;
        this.file_bytes_total = null;
        this.list_connections_command = "";
        this.list_connections_process = null;
        this.data_limit_command_invoked = false;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings_separator = ",";

        this.display_mode = AppletConstants.DisplayMode.SPEED;
        this.unit_type = AppletConstants.UnitType.BYTES;
        this.update_every = 1.0;
        this.custom_start_date = "";
        this.gui_speed_type = 0;
        this.gui_data_limit_type = 0;
        this.decimal_places = AppletConstants.DecimalPlaces.AUTO;
        this.show_hover = true;
        this.launch_terminal = true;
        this.data_limit_command_enabled = false;
        this.data_limit_command = "";
        this.data_limit = 0;
        this.gui_text_css = "";
        this.gui_received_icon_filename = "";
        this.gui_sent_icon_filename = "";
        this.hover_popup_text_css = "";
        this.hover_popup_numbers_css = "";
        this.bytes_start_time = AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION;

        this.gui_speed = null;
        this.gui_data_limit = null;
        this.menu_item_gui = null;
        this.menu_item_network = null;
        this.menu_item_network = null;
        this.menu_item_byte_start_times = null;
        this.hover_popup = null;

        this._init_translations();
        this._init_scripts();
        this._bind_settings();
        this._connect_signals();
        this._init_network_properties();
        this._init_dictionaries();
        this._init_byte_start_times();
        this._init_custom_start_date();
        this._init_list_connections_process();
        this._init_menu_item_gui();
        this._init_menu_item_network();
        this._init_menu_item_byte_start_times();
        this._init_hover_popup();
        this._init_gui();
        this._read_bytes_total();

        this.run();
    },

    _init_translations: function() {
        try {
            let translator = new Translation.Translator();
            translator.bind_domain();
            translator.generate_files();
        }
        catch(exception) {
            global.log(uuid + " error while initializing translations: " + exception);
        }
    },

    _init_scripts: function() {
        try {
            let path = this._get_scripts_path();
            let error = this._grant_executable_permission(path);
            if(error.length > 0) {
                global.log(uuid + " error while granting executable permission to scripts: " + error);
            }
        }
        catch(exception) {
            global.log(uuid + " error while initializing scripts: " + exception);
        }
    },

    _get_scripts_path: function() {
        let path = this._get_applet_directory();
        path += "scripts"
        return path;
    },

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    },

    _grant_executable_permission: function(directory_path) {
        let process = new ShellUtils.ShellOutputProcess(['chmod', '-R', '755', directory_path]);
        let error = process.spawn_sync_and_get_error();
        return error;
    },

    _bind_settings: function () {
        for(let [binding, property_name, callback] of [
                        [Settings.BindingDirection.IN, "display_mode", null],
                        [Settings.BindingDirection.IN, "unit_type", null],
                        [Settings.BindingDirection.IN, "update_every", null],
                        [Settings.BindingDirection.IN, "launch_terminal", null],
                        [Settings.BindingDirection.IN, "list_connections_command",
                                                        this.on_list_connections_command_changed],
                        [Settings.BindingDirection.IN, "write_every", null],
                        [Settings.BindingDirection.IN, "custom_start_date", this.on_custom_start_date_changed],
                        [Settings.BindingDirection.IN, "data_limit_command", null],
                        [Settings.BindingDirection.IN, "data_limit", this.on_data_limit_changed],
                        [Settings.BindingDirection.IN, "data_limit_command_enabled", this.on_data_limit_changed],
                        [Settings.BindingDirection.IN, "decimal_places", this.on_decimal_places_changed],
                        [Settings.BindingDirection.IN, "show_hover", this.on_show_hover_changed],
                        [Settings.BindingDirection.IN, "gui_data_limit_type", this.on_gui_data_limit_type_changed],
                        [Settings.BindingDirection.IN, "gui_text_css", this.on_gui_css_changed],
                        [Settings.BindingDirection.IN, "gui_received_icon_filename", this.on_gui_icon_changed],
                        [Settings.BindingDirection.IN, "gui_sent_icon_filename", this.on_gui_icon_changed],
                        [Settings.BindingDirection.IN, "hover_popup_text_css", this.on_hover_popup_css_changed],
                        [Settings.BindingDirection.IN, "hover_popup_numbers_css", this.on_hover_popup_css_changed],
                        [Settings.BindingDirection.BIDIRECTIONAL, "gui_speed_type", this.on_gui_speed_type_changed],
                        [Settings.BindingDirection.BIDIRECTIONAL, "bytes_start_time", this.on_bytes_start_time_changed],
                        [Settings.BindingDirection.BIDIRECTIONAL, "checked_interfaces_string", null] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    _connect_signals: function() {
        global.connect("shutdown", Lang.bind(this, this.on_shutdown));
        global.connect("scale-changed", Lang.bind(this, this.on_panel_height_changed));
    },

    on_shutdown: function () {
        this._write_bytes_total();
    },

    on_list_connections_command_changed: function () {
        this.list_connections_process.bash_command = this.list_connections_command;
    },

    on_bytes_start_time_changed: function () {
        this._update_menu_item_byte_start_times_option();
        this._update_bytes_start_times();
        if(this.bytes_start_time == AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION) {
            this._set_bytes_total_to_user_session();
        }
        else {
            this._read_bytes_total();
        }
    },

    _update_bytes_start_times: function () {
        for (let network_interface in this.dictionary_interface_to_info) {
            let info = this.dictionary_interface_to_info[network_interface];
            info.bytes_start_time = this.bytes_start_time;
        }
    },

    _set_bytes_total_to_user_session: function () {
        for (let network_interface in this.dictionary_interface_to_info) {
            let info = this.dictionary_interface_to_info[network_interface];
            info.set_bytes_total_to_user_session();
        }
    },

    _read_bytes_total: function () {
        for (let network_interface in this.dictionary_interface_to_info) {
            let info = this.dictionary_interface_to_info[network_interface];
            info.read_bytes_total();
        }
    },

    on_data_limit_changed: function () {
        this.data_limit_command_invoked = this.data_limit_exceeded() ? true : false;
    },

    data_limit_exceeded: function () {
        let enabled = this.is_data_limit_enabled();
        if(enabled) {
            let data_limit_bytes = this.convert_data_limit_bytes();
            let bytes_total = this.get_bytes_totals();
            return bytes_total > data_limit_bytes;
        }
        return false;
    },

    get_bytes_totals: function () {
        let bytes = 0;
        for (let network_interface of this.checked_interfaces) {
            let info = this.dictionary_interface_to_info[network_interface];
            bytes += info.bytes_total;
        }
        return bytes;
    },

    is_data_limit_enabled: function () {
        return this.data_limit > 0;
    },

    convert_data_limit_bytes: function () {
        return this.data_limit * 1000000;
    },

    on_gui_data_limit_type_changed: function () {
        this.gui_data_limit.set_gui(this.gui_data_limit_type);
    },

    on_decimal_places_changed: function () {
        this.gui_speed.set_decimal_places(this.decimal_places);
    },

    on_show_hover_changed: function () {
        if(this.show_hover) {
            this.hover_popup.enable();
        }
        else {
            this.hover_popup.disable();
        }
    },

    on_gui_icon_changed: function () {
        this.gui_speed.set_reveived_icon(this.gui_received_icon_filename);
        this.gui_speed.set_sent_icon(this.gui_sent_icon_filename);
    },

    on_gui_css_changed: function () {
        this.gui_speed.set_text_style(this.gui_text_css);
    },

    on_hover_popup_css_changed: function () {
        this.hover_popup.set_text_style(this.hover_popup_text_css);
        this.hover_popup.set_numbers_style(this.hover_popup_numbers_css);
    },

    on_gui_speed_type_changed: function () {
        this.menu_item_gui.set_active_option(this.gui_speed_type);
        this._init_gui();
    },

    on_custom_start_date_changed: function () {
        this._update_custom_start_dates();
        this._read_bytes_total();
    },

    _update_custom_start_dates: function () {
        for (let network_interface in this.dictionary_interface_to_info) {
            let info = this.dictionary_interface_to_info[network_interface];
            info.custom_start_date = this.custom_start_date;
            info.read_bytes_total();
        }
    },

    // Override
    on_applet_clicked: function(event) {
        if(this.launch_terminal) {
            let is_running = this.list_connections_process.is_running();
            if(is_running){
                this.list_connections_process.kill();
            }
            else {
                this.list_connections_process.spawn_async();
            }
        }

        this.close_hover_popup();
    },

    // Override
    on_panel_height_changed: function() {
        this._init_gui();
    },

    // Override
    on_applet_removed_from_panel: function() {
        this.is_running = false;
    },

    _init_network_properties: function () {
        this.network_interfaces = this._init_network_interfaces();
        this.checked_interfaces = this._init_checked_interfaces();
    },

    _init_network_interfaces: function () {
        let network_interfaces = this.list_network_interfaces();
        network_interfaces = network_interfaces.split('\n');
        network_interfaces.splice(network_interfaces.length - 1, 1);
        return network_interfaces;
    },

    list_network_interfaces: function () {
        let process = new ShellUtils.ShellOutputProcess(['ls', this.network_directory]);
        let output = process.spawn_sync_and_get_output();
        return output;
    },

    _init_checked_interfaces: function () {
        let checked_interfaces = [];
        let checked_interfaces_string = this.settings.getValue("checked_interfaces_string");
        let network_interfaces = checked_interfaces_string.split(this.settings_separator);
        for(let network_interface of network_interfaces) {
            let is_valid = this.array_contains(this.network_interfaces, network_interface);
            if(is_valid) {
                checked_interfaces.push(network_interface);
            }
        }
        return checked_interfaces;
    },

    array_contains: function (array, element) {
        return array.indexOf(element) > -1;
    },

    _init_dictionaries: function () {
        for (let network_interface of this.network_interfaces) {
            let exists = (network_interface in this.dictionary_interface_to_info);
            if(!exists) {
                this.dictionary_interface_to_info[network_interface] =
                                                                this._create_network_interface_info(network_interface);
            }
        }
    },

    _create_network_interface_info: function (network_interface) {
        let info = new Infos.NetworkInterfaceInfo(network_interface);
        info.bytes_start_time = this.bytes_start_time;
        info.custom_start_date = this.custom_start_date;
        info.read_bytes_total();
        return info;
    },

    _init_list_connections_process: function () {
        this.list_connections_process = new ShellUtils.TerminalProcess(this.list_connections_command);
        this.list_connections_process.maximized = true;
    },

    _init_menu_item_network: function () {
        this.menu_item_network = new AppletGui.CheckboxMenuItem(_("Network interfaces"));
        this.menu_item_network.set_callback_option_toggled(this, this.on_menu_item_network_toggled);
        this._reload_menu_item_network();
        this._applet_context_menu.addMenuItem(this.menu_item_network);
    },

    on_menu_item_network_toggled: function (option_index, option_name, is_checked) {
        if(is_checked) {
            this.check_network_interface(option_name);
        }
        else {
            this.uncheck_network_interface(option_name);
        }
        this.on_data_limit_changed();
        this.update_checked_interfaces_string();
    },

    check_network_interface: function (network_interface) {
        let exists = this.array_contains(this.checked_interfaces, network_interface);
        if(!exists) {
            this.checked_interfaces.push(network_interface);
        }
    },

    uncheck_network_interface: function (network_interface) {
        let exists = this.array_contains(this.checked_interfaces, network_interface);
        if(exists) {
            this._reset_network_interface(network_interface);
            this.array_remove(this.checked_interfaces, network_interface);
        }
    },

    _reset_network_interface: function (network_interface) {
        let info = this.dictionary_interface_to_info[network_interface];
        info.update_bytes_user_session();
        info.write_bytes_total();
        info.reset_bytes();
    },

    array_remove: function (array, element) {
        let index = array.indexOf(element);
        array.splice(index, 1);
    },

    update_checked_interfaces_string: function () {
        this.checked_interfaces_string = this.checked_interfaces.join(this.settings_separator);
    },

    _reload_menu_item_network: function () {
        let names = this.network_interfaces;
        let checked = this.get_is_checked();
        this.menu_item_network.reload_options(names, checked);
    },

    get_is_checked: function () {
        let checked = []
        for(let network_interface of this.network_interfaces) {
            let exists = this.array_contains(this.checked_interfaces, network_interface);
            checked.push(exists);
        }
        return checked;
    },

    _init_menu_item_byte_start_times: function () {
        let start_times = this._get_byte_start_time_options();
        this.menu_item_byte_start_times = new AppletGui.RadioMenuItem(_("Total data start"), start_times);
        this._update_menu_item_byte_start_times_option();
        this.menu_item_byte_start_times.set_callback_option_clicked(this, this.on_menu_item_byte_start_times_clicked);
        this._applet_context_menu.addMenuItem(this.menu_item_byte_start_times);
    },

    _get_byte_start_time_options: function () {
         return [ _("Launch of applet"),
                  _("Today"),
                  _("Yesterday"),
                  _("3 days ago"),
                  _("5 days ago"),
                  _("7 days ago"),
                  _("10 days ago"),
                  _("14 days ago"),
                  _("30 days ago"),
                  _("Custom date") ];
    },

    _update_menu_item_byte_start_times_option: function () {
        let index = this.byte_start_times.indexOf(this.bytes_start_time);
        this.menu_item_byte_start_times.set_active_option(index);
    },

    on_menu_item_byte_start_times_clicked: function (option_name, option_index) {
        let start_time = this.byte_start_times[option_index];
        if(this.bytes_start_time != start_time) {
           this.bytes_start_time = start_time;
           this.on_bytes_start_time_changed();
        }
    },

    _init_custom_start_date: function () {
        if(this.custom_start_date.length == 0) {
            let today = new Dates.ConvertableDate();
            this.custom_start_date = today.to_year_month_day_string("-");
        }
    },

    _init_byte_start_times: function () {
         this.byte_start_times = [ AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION,
                                   AppletConstants.BytesStartTime.TODAY,
                                   AppletConstants.BytesStartTime.YESTERDAY,
                                   AppletConstants.BytesStartTime.THREE_DAYS_AGO,
                                   AppletConstants.BytesStartTime.FIVE_DAYS_AGO,
                                   AppletConstants.BytesStartTime.SEVEN_DAYS_AGO,
                                   AppletConstants.BytesStartTime.TEN_DAYS_AGO,
                                   AppletConstants.BytesStartTime.FOURTEEN_DAYS_AGO,
                                   AppletConstants.BytesStartTime.THIRTY_DAYS_AGO,
                                   AppletConstants.BytesStartTime.CUSTOM_DATE ];
    },

    _init_menu_item_gui: function () {
        this.menu_item_gui = new AppletGui.RadioMenuItem(_("Gui"), [_("Compact"), _("Large")]);
        this.menu_item_gui.set_active_option(this.gui_speed_type);
        this.menu_item_gui.set_callback_option_clicked(this, this.on_menu_item_gui_clicked);
        this._applet_context_menu.addMenuItem(this.menu_item_gui);
        this._applet_context_menu.connect('open-state-changed', Lang.bind(this, this.on_context_menu_state_changed));
    },

    on_menu_item_gui_clicked: function (option_name, option_index) {
        if(this.gui_speed_type != option_index) {
            this.gui_speed_type = option_index;
            this.on_gui_speed_type_changed();
        }
    },

    on_context_menu_state_changed: function (actor, event) {
        this.close_hover_popup();
        let opened = event;
        if(opened) {
            this.update_network_interfaces();
        }
    },

    close_hover_popup: function () {
        this.hover_popup.close();
    },

    update_network_interfaces: function () {
         let updated = this.is_network_interface_updated();
         if(updated) {
             this._update_network_properties();
             this._reload_menu_item_network();
         }
    },

    is_network_interface_updated: function () {
         let network_interfaces = this._init_network_interfaces();
         let updated = !this.arrays_equal(this.network_interfaces, network_interfaces);
         return updated;
    },

    arrays_equal: function (array1, array2) {
        return array1.length == array2.length &&
               array1.every(function(value, index) { return value === array2[index]; });
    },

    _update_network_properties: function () {
         this.network_interfaces = this._init_network_interfaces();
         this._init_dictionaries();
         this.checked_interfaces = this._reset_network_interfaces();
         this.update_checked_interfaces_string();
    },

    _reset_network_interfaces: function () {
        let checked_interfaces = []
        for(let network_interface of this.checked_interfaces) {
            let exists = this.array_contains(this.network_interfaces, network_interface);
            if(exists) {
                checked_interfaces.push(network_interface);
            }
            else {
                this._reset_network_interface(network_interface);
            }
        }
        return checked_interfaces;
    },

    _init_hover_popup: function () {
        this.hover_popup = new AppletGui.HoverMenuTotalBytes(this, this.orientation);
        this.on_hover_popup_css_changed();
        this.on_show_hover_changed();
    },

    _init_gui: function () {
        this.gui_speed = new AppletGui.GuiSpeed(this._panelHeight, this.gui_speed_type, this.decimal_places);
        this.gui_data_limit = new AppletGui.GuiDataLimit(this._panelHeight, this.gui_data_limit_type);
        this.actor.destroy_all_children();
        this._add_gui_speed();
        this._add_gui_data_limit();
    },

    _add_gui_speed: function () {
        this.actor.add(this.gui_speed.actor,
                      { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
        this.on_gui_icon_changed();
        this.on_gui_css_changed();
    },

    _add_gui_data_limit: function () {
        this.actor.add(this.gui_data_limit.actor,
                      { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
    },






    run: function () {
        this._run_calculate_speed_running();
        this._run_write_bytes_running();
    },

    _run_calculate_speed_running: function () {
        if(this.is_running) {
            this._run_calculate_speed();
        }
    },

    _run_calculate_speed: function () {
        if(this.update_every > 0) {
            this._calculate_speed();
            Mainloop.timeout_add(this.update_every * 1000, Lang.bind(this, this._run_calculate_speed_running));
        }
        else {
            Mainloop.timeout_add(1000, Lang.bind(this, this._run_calculate_speed_running));
        }
    },

    _calculate_speed: function () {
        try {
            let bytes_received_iteration = 0;
            let bytes_sent_iteration = 0;
            let bytes_received_total = 0;
            let bytes_sent_total = 0;

            for(let network_interface of this.checked_interfaces) {
                let info = this.dictionary_interface_to_info[network_interface];
                info.calculate_speed();
                bytes_received_iteration += info.bytes_received_iteration;
                bytes_sent_iteration += info.bytes_sent_iteration;
                bytes_received_total += info.bytes_received_total;
                bytes_sent_total += info.bytes_sent_total;
            }

            let received = this.scale(bytes_received_iteration);
            received = this.convert_to_readable_string(received);
            let sent = this.scale(bytes_sent_iteration);
            sent = this.convert_to_readable_string(sent);
            let received_total = this.convert_to_two_decimals_string(bytes_received_total);
            let sent_total = this.convert_to_two_decimals_string(bytes_sent_total);

            this.gui_speed.set_received_text(received);
            this.gui_speed.set_sent_text(sent);
            this.update_gui_data_limit(bytes_received_total, bytes_sent_total);
            this.hover_popup.set_text(received_total, sent_total);
            this.invoke_data_limit_command_if_exceeded();
        }
        catch(e) {
             global.logError(uuid + " error while calculating download and upload speed: " + e);
        }
    },

    calculate_bytes_difference: function (bytes, previous_bytes) {
        let difference = bytes - previous_bytes;
        if(difference < 0 || previous_bytes == 0) {
            difference = 0;
        }
        return difference;
    },

    scale: function (bytes) {
        return this.display_mode == AppletConstants.DisplayMode.SPEED ? Math.round(bytes / this.update_every) : bytes;
    },

    convert_to_readable_string: function (bytes) {
        let [number, unit] = this.convert_to_readable_unit(bytes);
        if(!this.is_base(unit)) {
            number = this.round_output_number(number);
        }

        let output = number.toString() + unit;
        return output;
    },

    convert_to_readable_unit: function (bytes) {
        if(this.unit_type == AppletConstants.UnitType.BYTES) {
            let [number, unit] = this.convert_bytes_to_readable_unit(bytes);
            return [number, unit];
        }
        else {
            let bits = this.convert_to_bits(bytes);
            let [number, unit] = this.convert_bits_to_readable_unit(bits);
            return [number, unit];
        }
    },

    convert_bytes_to_readable_unit: function (bytes) {
        if(bytes >= 1000000000000) {
            return [bytes/1000000000000, "TB"];
        }
        if(bytes >= 1000000000) {
            return [bytes/1000000000, "GB"];
        }
        if(bytes >= 1000000) {
            return [bytes/1000000, "MB"];
        }
        if(bytes >= 1000) {
            return [bytes/1000, "kB"];
        }
        return [bytes, "B"];
    },

    convert_to_bits: function (bytes) {
        return bytes * 8;
    },

    convert_bits_to_readable_unit: function (bits) {
        if(bits >= 1000000000000) {
            return [bits/1000000000000, "Tb"];
        }
        if(bits >= 1000000000) {
            return [bits/1000000000, "Gb"];
        }
        if(bits >= 1000000) {
            return [bits/1000000, "Mb"];
        }
        if(bits >= 1000) {
            return [bits/1000, "kb"];
        }
        return [bits, _("b")];
    },

    is_base: function (unit) {
        return unit == "B" || unit == "b";
    },

    round_output_number: function (number) {
        let output_number = this.decimal_places == AppletConstants.DecimalPlaces.AUTO ?
                            this.round_output_number_auto(number) : number.toFixed(this.decimal_places);
        return output_number;
    },

    round_output_number_auto: function (number) {
        if(number > 100) {
            return number.toFixed(0);
        }
        if(number > 10) {
            return number.toFixed(1);
        }
        return number.toFixed(2);
    },

    convert_to_two_decimals_string: function (bytes) {
        let [number, unit] = this.convert_bytes_to_readable_unit(bytes);
        let output = number.toFixed(2).toString() + " " + unit;
        return output;
    },

    update_gui_data_limit: function (bytes_received_total, bytes_sent_total) {
        let bytes_total = bytes_received_total + bytes_sent_total;
        let percentage = this.is_zero(this.data_limit) ? 0 : bytes_total / this.convert_data_limit_bytes();
        percentage = percentage * 100;
        this.gui_data_limit.set_percentage(percentage);
    },

    is_zero: function (number) {
        let decimals = 15;
        let precision = decimals - 1;
        let rounded = number.toFixed(precision);
        let zero = 0.0;
        zero = zero.toFixed(precision);
        return rounded == zero;
    },

    invoke_data_limit_command_if_exceeded: function () {
        if(!this.data_limit_command_invoked && this.data_limit_command_enabled && this.data_limit_exceeded()) {
            this.invoke_data_limit_command();
            this.data_limit_command_invoked = true;
        }
    },

    invoke_data_limit_command: function () {
        let terminal_process = new ShellUtils.TerminalProcess(this.data_limit_command);
        terminal_process.maximized = true;
        terminal_process.spawn_async();
    },

    _run_write_bytes_running: function () {
        if(this.is_running) {
            this._run_write_bytes();
        }
    },

    _run_write_bytes: function () {
        if(this.write_every > 0) {
            this._write_bytes_total();
            Mainloop.timeout_add(this.write_every * 1000, Lang.bind(this, this._run_write_bytes_running));
        }
        else {
            Mainloop.timeout_add(1000, Lang.bind(this, this._run_write_bytes_running));
        }
    },

    _write_bytes_total: function () {
        for(let network_interface of this.checked_interfaces) {
            let info = this.dictionary_interface_to_info[network_interface];
            info.write_bytes_total();
        }
    },

};












function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}



