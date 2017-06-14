
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;

const uuid = 'download-and-upload-speed@cardsurf';
const AppletDirectory = imports.ui.appletManager.applets[uuid];
const AppletGui = AppletDirectory.appletGui;
const AppletConstants = AppletDirectory.appletConstants
const ShellUtils = AppletDirectory.shellUtils;
const Files = AppletDirectory.files;
const FilesCsv = AppletDirectory.filesCsv;
const Dates = AppletDirectory.dates;
const Translation = AppletDirectory.translation;

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

        this.panel_height = panel_height;
        this.orientation = orientation;
        this.applet_directory = this._get_applet_directory();
        this.bytes_directory = this.applet_directory + "/bytes/";
        this.is_running = true;

        this.bytes_received_previous = 0;
        this.bytes_received_iteration = 0;
        this.bytes_received_interface_session = 0;
        this.bytes_received_last_write_before_midnight = 0;
        this.bytes_received_last_write_after_midnight = 0;
        this.bytes_received_total = 0;
        this.bytes_sent_previous = 0;
        this.bytes_sent_iteration = 0;
        this.bytes_sent_interface_session = 0;
        this.bytes_sent_last_write_before_midnight = 0;
        this.bytes_sent_last_write_after_midnight = 0;
        this.bytes_sent_total = 0;
        this.bytes_total = 0;
        this.dictionary_interface_bytes_received_user_session = {};
        this.dictionary_interface_bytes_sent_user_session = {};
        this.byte_start_times = [];
        this.date_midnight = null;

        this.network_directory = "/sys/class/net/";
        this.network_interfaces = [];
        this.network_interface = "";
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

        this.menu_item_update_network_position = 4;
        this.gui_speed = null;
        this.gui_data_limit = null;
        this.menu_item_gui = null;
        this.menu_item_network = null;
        this.menu_item_byte_start_times = null;
        this.menu_item_update_network = null;
        this.hover_popup = null;

        this._init_translations();
        this._bind_settings();
        this._connect_signals();
        this._init_network_properties();
        this._init_dictionaries();
        this._init_filename_properties();
        this._init_files();
        this._init_byte_start_times();
        this._init_dates();
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

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
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
                        [Settings.BindingDirection.BIDIRECTIONAL, "network_interface", null] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    _connect_signals: function() {
        global.connect("shutdown", Lang.bind(this, this.on_shutdown));
    },

    on_shutdown: function () {
            this._write_bytes_total();
    },

    on_list_connections_command_changed: function () {
        this.list_connections_process.bash_command = this.list_connections_command;
    },

    on_bytes_start_time_changed: function () {
        this._update_menu_item_byte_start_times_option();
        if(this.bytes_start_time == AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION) {
            this._set_bytes_total_to_user_session();
        }
        else {
            this._read_bytes_total();
        }
    },

    _set_bytes_total_to_user_session: function () {
        this.bytes_received_total = this.network_interface in this.dictionary_interface_bytes_received_user_session ?
        this.dictionary_interface_bytes_received_user_session[this.network_interface] +
        this.bytes_received_interface_session : this.bytes_received_interface_session;

        this.bytes_sent_total = this.network_interface in this.dictionary_interface_bytes_sent_user_session ?
        this.dictionary_interface_bytes_sent_user_session[this.network_interface] +
        this.bytes_sent_interface_session : this.bytes_sent_interface_session;

        this.update_bytes_total();
    },

    on_custom_start_date_changed: function () {
        this._read_bytes_total();
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

    on_data_limit_changed: function () {
        this.data_limit_command_invoked = this.data_limit_exceeded() ? true : false;
    },

    data_limit_exceeded: function () {
        let enabled = this.is_data_limit_enabled();
        if(enabled) {
            let data_limit_bytes = this.convert_data_limit_bytes();
            return this.bytes_total > data_limit_bytes;
        }
        return false;
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
    on_applet_removed_from_panel: function() {
        this.is_running = false;
    },

    // Override
    on_applet_added_to_panel: function(userEnabled) {
        this._init_menu_item_update_network_interfaces();
    },

    _init_menu_item_update_network_interfaces: function () {
        this.menu_item_update_network = new PopupMenu.PopupIconMenuItem("Update network interfaces", "view-refresh",
                                                                        St.IconType.SYMBOLIC);
        this.menu_item_update_network.connect('activate', Lang.bind(this, this.update_network_interfaces));
        this._applet_context_menu.addMenuItem(this.menu_item_update_network, this.menu_item_update_network_position);
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
         let network_interface = this._init_network_interface();
         this.on_menu_item_network_clicked(network_interface, -1);
    },

    _reload_menu_item_network: function () {
        this.menu_item_network.reload_options(this.network_interfaces);
        this._set_menu_item_network_active_option();
    },

    _set_menu_item_network_active_option: function () {
        let index = this.network_interfaces.indexOf(this.network_interface);
        this.menu_item_network.set_active_option(index);
    },

    _init_network_properties: function () {
        this.network_interfaces = this._init_network_interfaces();
        this.network_interface = this._init_network_interface();
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

    _init_network_interface: function () {
        let network_interface = this.settings.getValue("network_interface");
        let is_valid = this.array_contains(this.network_interfaces, network_interface);
        if(!is_valid && this.network_interfaces.length > 0) {
            network_interface = this.network_interfaces[0];
        }
        return network_interface;
    },

    array_contains: function (array, element) {
        return array.indexOf(element) > -1;
    },

    _init_dictionaries: function () {
        for (let i = 0; i < this.network_interfaces.length; i++) {
            let network_interface = this.network_interfaces[i];
            this.dictionary_interface_bytes_received_user_session[network_interface] = 0;
            this.dictionary_interface_bytes_sent_user_session[network_interface] = 0;
        }
    },

    _init_filename_properties: function () {
        this.filepath_bytes_received = this.network_directory + this.network_interface + '/statistics/rx_bytes';
        this.filepath_bytes_sent = this.network_directory + this.network_interface + '/statistics/tx_bytes';
        this.filepath_bytes_total = this.bytes_directory + this.network_interface + '.csv';
    },

    _init_list_connections_process: function () {
        this.list_connections_process = new ShellUtils.TerminalProcess(this.list_connections_command);
        this.list_connections_process.maximized = true;
    },

    _init_menu_item_network: function () {
        this.menu_item_network = new AppletGui.RadioMenuItem(_("Network interface"), this.network_interfaces);
        this.menu_item_network.set_callback_option_clicked(this, this.on_menu_item_network_clicked);
        this._applet_context_menu.addMenuItem(this.menu_item_network);
        this._set_menu_item_network_active_option();
    },

    on_menu_item_network_clicked: function (option_name, option_index) {
        if(this.network_interface != option_name) {
            this._update_bytes_user_session();
            this.network_interface = option_name;
            this._write_bytes_total();
            this._init_filename_properties();
            this._init_files();
            this._reset_bytes();
            this.on_bytes_start_time_changed();
        }
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

    _update_bytes_user_session: function () {
        this.dictionary_interface_bytes_received_user_session[this.network_interface] =
            this.network_interface in this.dictionary_interface_bytes_received_user_session ?
            this.dictionary_interface_bytes_received_user_session[this.network_interface] +
            this.bytes_received_interface_session : this.bytes_received_interface_session;

        this.dictionary_interface_bytes_sent_user_session[this.network_interface] =
            this.network_interface in this.dictionary_interface_bytes_sent_user_session ?
            this.dictionary_interface_bytes_sent_user_session[this.network_interface] +
            this.bytes_sent_interface_session : this.bytes_sent_interface_session;
    },

    _init_files: function () {
        this.file_bytes_received = new Files.File(this.filepath_bytes_received);
        this.file_bytes_sent = new Files.File(this.filepath_bytes_sent);
        this.file_bytes_total = new FilesCsv.BytesFileCsv(this.filepath_bytes_total);
        if(!this.file_bytes_total.exists()) {
            this.file_bytes_total.create();
        }
    },

    _init_dates: function () {
        this.date_midnight = new Dates.ConvertableDate();
        this.date_midnight.add_days(1);
        this.date_midnight.set_hour(0);
        this.date_midnight.set_minute(0);
        this.date_midnight.set_second(0);
        this.date_midnight.set_millisecond(0);
    },

    _reset_bytes: function () {
        this._reset_bytes_previous();
        this._reset_bytes_iteration();
        this._reset_bytes_session();
        this._reset_bytes_last_write();
        this._read_bytes_total();
    },

    _reset_bytes_previous: function () {
        this.bytes_received_previous = 0;
        this.bytes_sent_previous = 0;
    },

    _reset_bytes_iteration: function () {
        this.bytes_received_iteration = 0;
        this.bytes_sent_iteration = 0;
    },

    _reset_bytes_session: function () {
        this.bytes_received_interface_session = 0;
        this.bytes_sent_interface_session = 0;
    },

    _reset_bytes_last_write: function () {
        this.bytes_received_last_write_before_midnight = 0;
        this.bytes_received_last_write_after_midnight = 0;
        this.bytes_sent_last_write_after_midnight = 0;
        this.bytes_sent_last_write_before_midnight = 0;
    },

    _reset_bytes_total: function () {
        this.bytes_received_total = 0;
        this.bytes_sent_total = 0;
        this.bytes_total = 0;
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

    on_context_menu_state_changed: function () {
        this.close_hover_popup();
    },

    close_hover_popup: function () {
        this.hover_popup.close();
    },

    on_panel_height_changed: function() {
        this.panel_height = this.panel.actor.get_height();
        this._init_gui();
    },

    _init_hover_popup: function () {
        this.hover_popup = new AppletGui.HoverMenuTotalBytes(this, this.orientation);
        this.on_hover_popup_css_changed();
        this.on_show_hover_changed();
    },

    _init_gui: function () {
        this.gui_speed = new AppletGui.GuiSpeed(this.panel_height, this.gui_speed_type, this.decimal_places);
        this.gui_data_limit = new AppletGui.GuiDataLimit(this.panel_height, this.gui_data_limit_type);
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
        this.update_bytes_received();
        this.update_bytes_sent();
        this.update_bytes_last_write();
        this.update_bytes_total();

        let received = this.scale(this.bytes_received_iteration);
        received = this.convert_to_readable_string(received);
        let sent = this.scale(this.bytes_sent_iteration);
        sent = this.convert_to_readable_string(sent);
        let received_total = this.convert_to_two_decimals_string(this.bytes_received_total);
        let sent_total = this.convert_to_two_decimals_string(this.bytes_sent_total);

        this.gui_speed.set_received_text(received);
        this.gui_speed.set_sent_text(sent);
        this.update_gui_data_limit();
        this.hover_popup.set_text(received_total, sent_total);
        this.invoke_data_limit_command_if_exceeded();
    },

    update_bytes_received: function () {;
        let bytes_received = this.read_number(this.file_bytes_received, this.bytes_received_previous);
        this.bytes_received_iteration = this.calculate_bytes_difference(bytes_received, this.bytes_received_previous);
        this.bytes_received_previous = bytes_received;
        this.bytes_received_interface_session += this.bytes_received_iteration;
        this.bytes_received_total += this.bytes_received_iteration;
    },

    read_number: function (file, default_number) {
        try {
            let array_bytes = file.read_chars();
            let string = array_bytes.length > 0 ? array_bytes.toString() : default_number.toString();
            let number = parseInt(string);
            return number;
        }
        catch(exception) {
            return default_number;
        }
    },

    scale: function (bytes) {
        return this.display_mode == AppletConstants.DisplayMode.SPEED ? Math.round(bytes / this.update_every) : bytes;
    },

    calculate_bytes_difference: function (bytes, previous_bytes) {
        let difference = bytes - previous_bytes;
        if(difference < 0 || previous_bytes == 0) {
            difference = 0;
        }
        return difference;
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
            bits = this.convert_to_bits(bytes);
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

    update_bytes_sent: function () {
        let bytes_sent = this.read_number(this.file_bytes_sent, this.bytes_sent_previous);
        this.bytes_sent_iteration = this.calculate_bytes_difference(bytes_sent, this.bytes_sent_previous);
        this.bytes_sent_previous = bytes_sent;
        this.bytes_sent_interface_session += this.bytes_sent_iteration;
        this.bytes_sent_total += this.bytes_sent_iteration;
    },

    update_bytes_last_write: function () {
        let date_now = new Dates.ConvertableDate();
        if(date_now.is_earlier(this.date_midnight)) {
            this.bytes_received_last_write_before_midnight += this.bytes_received_iteration;
            this.bytes_sent_last_write_before_midnight += this.bytes_sent_iteration;
        }
        else {
            this.bytes_received_last_write_after_midnight += this.bytes_received_iteration;
            this.bytes_sent_last_write_after_midnight += this.bytes_sent_iteration;
        }
    },

    update_bytes_total: function () {
        this.bytes_total = this.bytes_received_total + this.bytes_sent_total;
    },

    update_gui_data_limit: function () {
        let percentage = this.is_zero(this.data_limit) ? 0 : this.bytes_total / this.convert_data_limit_bytes();
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

    _read_bytes_total: function() {
        try {
            this._read_bytes_total_file();
            this.add_last_write_bytes_to_total();
        }
        catch (exception) {
        }
    },

    _read_bytes_total_file: function() {
        let date_from = this._get_bytes_start_date_int();
        let rows = this.file_bytes_total.get_byte_rows();
        this._reset_bytes_total();

        for (let i = 0; i < rows.length; ++i) {
           let row = rows[i];
           if(row.date >= date_from) {
                this.bytes_received_total += row.bytes_received;
                this.bytes_sent_total += row.bytes_sent;
           }
           else {
               break;
           }
        }
    },

    _get_bytes_start_date_int: function () {
        if(this.bytes_start_time == AppletConstants.BytesStartTime.CUSTOM_DATE) {
            return this._get_custom_start_date_int();
        }

        let today = new Dates.ConvertableDate();
        let days = this.bytes_start_time;
        today.add_days(-1 * days);
        return today.to_year_month_day_int();
    },

    _get_custom_start_date_int : function () {
        let date_string = this.custom_start_date.trim().replace(/-/g, "");
        let date_int =  parseInt(date_string);
        if(!isNaN(date_int)){
            return date_int;
        }
        throw("Failed to parse custom start date to integer");
    },

    add_last_write_bytes_to_total: function () {
        this.bytes_received_total += this.bytes_received_last_write_before_midnight;
        this.bytes_received_total += this.bytes_received_last_write_after_midnight;
        this.bytes_sent_total += this.bytes_sent_last_write_before_midnight;
        this.bytes_sent_total += this.bytes_sent_last_write_after_midnight;
        this.bytes_total = this.bytes_received_total + this.bytes_sent_total;
    },

    _write_bytes_total: function() {
        try {
            if(this.write_every > 0) {
                this._write_bytes_total_file();
                 this._reset_bytes_last_write();
                 this._init_dates();
            }
        }
        catch(exception) {
        }
    },

    _write_bytes_total_file: function() {
        let rows = this.file_bytes_total.get_byte_rows();
        rows = this._update_or_prepend_row_before_midnight(rows);
        rows = this._update_or_prepend_row_after_midnight(rows);
        this.file_bytes_total.overwrite(rows);
    },

    _update_or_prepend_row_before_midnight: function(rows) {
        let date = this._get_date_before_midnight();
        let index = this._get_index(rows, date);
        return index >= 0 ? this._update_row_before_midnight(rows, index) :
                            this._prepend_row_before_midnight(rows, date);
    },

    _get_date_before_midnight: function() {
        let date = this.date_midnight.get_deep_copy();
        date.add_days(-1);
        return date;
    },

    _get_index: function(rows, convertable_date) {
        let date_int = convertable_date.to_year_month_day_int();
        for(let i = 0; i < rows.length; ++i) {
            let row = rows[i];
            if(row.date == date_int) {
                return i;
            }
        }
        return -1;
    },

    _update_row_before_midnight: function(rows, index) {
        let row = rows[index];
        row.bytes_received += this.bytes_received_last_write_before_midnight;
        row.bytes_sent += this.bytes_sent_last_write_before_midnight;
        rows[index] = row;
        return rows;
    },

    _prepend_row_before_midnight: function(rows, convertable_date) {
        let transferred = this._bytes_transferred_before_midnight();
        if(transferred) {
            let date_int = convertable_date.to_year_month_day_int();
            let row = new FilesCsv.BytesRowCsv(date_int,
                                               this.bytes_received_last_write_before_midnight,
                                               this.bytes_sent_last_write_before_midnight);
            rows.unshift(row);
        }
        return rows;
    },

    _bytes_transferred_before_midnight: function() {
       return this.bytes_received_last_write_before_midnight > 0 || this.bytes_sent_last_write_before_midnight > 0;
    },

    _update_or_prepend_row_after_midnight: function(rows) {
        let date = this.date_midnight;
        let index = this._get_index(rows, date);
        return index >= 0 ? this._update_row_after_midnight(rows, index) : this._prepend_row_after_midnight(rows, date);
    },

    _update_row_after_midnight: function(rows, index) {
        let row = rows[index];
        row.bytes_received += this.bytes_received_last_write_after_midnight;
        row.bytes_sent += this.bytes_sent_last_write_after_midnight;
        rows[index] = row;
        return rows;
    },

    _prepend_row_after_midnight: function(rows, convertable_date) {
        let transferred = this._bytes_transferred_after_midnight();
        if(transferred) {
            let date_int = convertable_date.to_year_month_day_int();
            let row = new FilesCsv.BytesRowCsv(date_int,
                                               this.bytes_received_last_write_after_midnight,
                                               this.bytes_sent_last_write_after_midnight);
            rows.unshift(row);
        }
        return rows;
    },

    _bytes_transferred_after_midnight: function() {
       return this.bytes_received_last_write_after_midnight > 0 || this.bytes_sent_last_write_after_midnight > 0;
    },

};












function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}



