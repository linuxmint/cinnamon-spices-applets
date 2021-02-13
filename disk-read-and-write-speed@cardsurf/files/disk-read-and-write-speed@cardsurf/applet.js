
const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

const uuid = "disk-read-and-write-speed@cardsurf";
let AppletConstants, ShellUtils, Files, AppletGui, Compatibility;
if (typeof require !== 'undefined') {
    AppletConstants = require('./appletConstants');
    ShellUtils = require('./shellUtils');
    Files = require('./files');
    AppletGui = require('./appletGui');
    Compatibility = require('./compatibility');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletConstants = AppletDirectory.appletConstants;
    ShellUtils = AppletDirectory.shellUtils;
    Files = AppletDirectory.files;
    AppletGui = AppletDirectory.appletGui;
    Compatibility = AppletDirectory.compatibility;
}






function InputOutputInfo() {
    this._init();
};

InputOutputInfo.prototype = {

    _init: function() {

        this.reads_completed = 0;
        this.reads_merged = 0;
        this.sectors_read = 0;
        this.time_reading_ms = 0;
        this.writes_completed = 0;
        this.writes_merged = 0;
        this.sectors_written = 0;
        this.time_writing_ms = 0;
        this.inputs_outputs_in_progress = 0;
        this.time_inputs_outputs_ms = 0;
        this.weighted_time_inputs_outputs_ms = 0;
        this.discards_completed = 0;
        this.discards_merged = 0;
        this.sectors_discarded = 0;
        this.time_discarding = 0;

        this.bytes_read = 0;
        this.bytes_written = 0;

        this.previous_sectors_read = 0;
        this.previous_sectors_written = 0;
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
        this.is_running = true;
        this.cinnamon_version_adapter = new Compatibility.CinnamonVersionAdapter();

        this.major_number_index = 0;
        this.minor_number_index = 1;
        this.device_name_index = 2;
        this.reads_completed_index = 3;
        this.reads_merged_index = 4;
        this.sectors_read_index = 5;
        this.time_reading_ms_index = 6;
        this.writes_completed_index = 7;
        this.writes_merged_index = 8;
        this.sectors_written_index = 9;
        this.time_writing_ms_index = 10;
        this.inputs_outputs_in_progress_index = 11;
        this.time_inputs_outputs_ms_index = 12;
        this.weighted_time_inputs_outputs_ms_index = 13;
        this.discards_completed_index = 14;
        this.discards_merged_index = 15;
        this.sectors_discarded_index = 16;
        this.time_discarding_index = 17;

        this.bytes_read_index = -1;
        this.bytes_written_index = -1;
        this.byte_indexes = [this.bytes_read_index, this.bytes_written_index];

        this.pair_device_index = 0;
        this.pair_alias_index = 1;
        this.default_sector_size = 512;
        this.word_separator = " ";
        this.string_separator = ",";
        this.pair_separator = ":";
        this.line_end = "\n";
        this.whitespaces_regex = new RegExp("\\s+");
        this.newlines_regex = new RegExp("\\n+");
        this.numbers_comma_regex = new RegExp("(\\s*\\d+)(,\\s*\\d+)*");
        this.numbers_regex = new RegExp("\\d+", "g");
        this.non_whitespace_end_regex = new RegExp("[^\\s]+$");
        this.letter_regex = new RegExp("[a-zA-Z]+");
        this.non_whitespace_regex = new RegExp("[^\\s]+");

        this.filepath_partitions = "/proc/partitions";
        this.filepath_diskstats = "/proc/diskstats";
        this.disk_names = [];
        this.disk_sector_sizes = {};
        this.disk_name = "";
        this.file_partitions = null;
        this.file_diskstats = null;
        this.input_output_infos = {};
        this.diskstats_table = [ [] ];
        this.devices_regex = new RegExp("sd");
        this.device_aliases = {};
        this.terminal_process = null;
        this.terminal_command = "";
        this.gui_speed = null;
        this.menu_item_gui = null;
        this.menu_item_disks = null;
        this.hover_popup = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.update_every = 1.0;
        this.show_hover = true;
        this.show_total_bytes_read = true;
        this.show_total_bytes_written = true;
        this.total_bytes_read_column_name = "Read";
        this.total_bytes_written_column_name = "Written";
        this.gui_speed_type = AppletConstants.GuiSpeedType.COMPACT;
        this.gui_decimal_places = AppletConstants.DecimalPlaces.AUTO;
        this.gui_text_css = ""
        this.gui_read_icon_filename = "";
        this.gui_written_icon_filename = "";
        this.devices_regex_string = "";
        this.device_aliases_string = "";
        this.hover_popup_headers_css = "";
        this.hover_popup_rows_css = "";
        this.column_names_string = "";
        this.column_names = [];
        this.column_names_insert = [];
        this.column_indexes_string = "";
        this.column_indexes_insert = [];
        this.column_spaces = 3;
        this.column_index_sort = 2;
        this.column_type_sort = AppletConstants.SortColumn.OTHER;
        this.column_sort_order = AppletConstants.SortOrder.ASCENDING;
        this.hover_popup_decimal_places = AppletConstants.DecimalPlaces.AUTO;
        this.launch_terminal = true;

        this._bind_settings();
        this._init_files();
        this._init_disks();
        this._init_byte_indexes();
        this._init_columns();
        this._init_terminal_process();
        this._init_menu_item_gui();
        this._init_menu_item_disks();
        this._init_hover_popup();
        this._init_gui();

        this.run();
    },

    _bind_settings: function () {
        for(let [binding, property_name, callback] of [
                [Settings.BindingDirection.IN, "display_mode", null],
                [Settings.BindingDirection.IN, "unit_type", null],
                [Settings.BindingDirection.IN, "update_every", null],
                [Settings.BindingDirection.IN, "column_spaces", null],
                [Settings.BindingDirection.IN, "column_type_sort", null],
                [Settings.BindingDirection.IN, "column_index_sort", null],
                [Settings.BindingDirection.IN, "column_sort_order", null],
                [Settings.BindingDirection.IN, "hover_popup_decimal_places", null],
                [Settings.BindingDirection.IN, "launch_terminal", null],
                [Settings.BindingDirection.IN, "gui_decimal_places", this.on_decimal_places_changed],
                [Settings.BindingDirection.IN, "gui_text_css", this.on_gui_css_changed],
                [Settings.BindingDirection.IN, "gui_read_icon_filename", this.on_gui_icon_changed],
                [Settings.BindingDirection.IN, "gui_written_icon_filename", this.on_gui_icon_changed],
                [Settings.BindingDirection.IN, "show_hover", this.on_show_hover_changed],
                [Settings.BindingDirection.IN, "show_total_bytes_read", this.on_column_indexes_string_changed],
                [Settings.BindingDirection.IN, "show_total_bytes_written", this.on_column_indexes_string_changed],
                [Settings.BindingDirection.IN, "total_bytes_read_column_name", this.on_column_indexes_string_changed],
                [Settings.BindingDirection.IN, "total_bytes_written_column_name",
                                                this.on_column_indexes_string_changed],
                [Settings.BindingDirection.IN, "hover_popup_headers_css", this.on_hover_popup_css_changed],
                [Settings.BindingDirection.IN, "hover_popup_rows_css", this.on_hover_popup_css_changed],
                [Settings.BindingDirection.IN, "devices_regex_string", this.on_devices_regex_string_changed],
                [Settings.BindingDirection.IN, "device_aliases_string", this.on_device_aliases_string_changed],
                [Settings.BindingDirection.IN, "column_names_string", this.on_column_names_string_changed],
                [Settings.BindingDirection.IN, "column_indexes_string", this.on_column_indexes_string_changed],
                [Settings.BindingDirection.IN, "terminal_command", this.on_terminal_command_changed],
                [Settings.BindingDirection.BIDIRECTIONAL, "gui_speed_type", this.on_gui_speed_type_changed],
                [Settings.BindingDirection.BIDIRECTIONAL, "disk_name", null] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_decimal_places_changed: function () {
        this.gui_speed.set_decimal_places(this.gui_decimal_places);
    },

    on_gui_css_changed: function () {
        this.gui_speed.set_text_style(this.gui_text_css);
    },

    on_gui_icon_changed: function () {
        this.gui_speed.set_reveived_icon(this.gui_read_icon_filename);
        this.gui_speed.set_sent_icon(this.gui_written_icon_filename);
    },

    on_show_hover_changed: function () {
        if(this.show_hover) {
            this.hover_popup.enable();
        }
        else {
            this.hover_popup.disable();
        }
    },

    on_hover_popup_css_changed: function () {
        this.hover_popup.set_headers_style(this.hover_popup_headers_css);
        this.hover_popup.set_rows_style(this.hover_popup_rows_css);
    },

    on_devices_regex_string_changed: function () {
        this.devices_regex = new RegExp(this.devices_regex_string);
    },

    on_device_aliases_string_changed: function () {
        this.device_aliases = this.get_device_aliases_aliases();
    },

    get_device_aliases_aliases: function () {
        let device_aliases = {};
        let pairs = this.device_aliases_string.split(this.string_separator);
        for(let pair of pairs) {
            let device_alias = pair.split(this.pair_separator);
            if(device_alias.length == 2) {
                let device = device_alias[this.pair_device_index];
                let alias = device_alias[this.pair_alias_index];
                device_aliases[device] = alias;
            }
        }
        return device_aliases;
    },

    on_column_names_string_changed: function () {
        this.column_names = this.column_names_string.split(this.string_separator);
        this.column_names_insert = this.get_column_names_insert();
    },

    get_column_names_insert: function () {
        let column_names_insert = [];
        for(let column_index of this.column_indexes_insert) {
            if(column_index < this.bytes_read_index) {
                let column_name = this.column_names[column_index];
                column_names_insert.push(column_name);
            }
        }
        let is_bytes_read_column = this.array_contains(this.column_indexes_insert, this.bytes_read_index);
        if(is_bytes_read_column) {
            column_names_insert.push(this.total_bytes_read_column_name);
        }
        let is_bytes_written_column = this.array_contains(this.column_indexes_insert, this.bytes_written_index);
        if(is_bytes_written_column) {
            column_names_insert.push(this.total_bytes_written_column_name);
        }
        return column_names_insert;
    },

    on_column_indexes_string_changed: function () {
        let is_valid = this.numbers_comma_regex.test(this.column_indexes_string);
        if(is_valid) {
            this.column_indexes_insert = this.get_column_indexes_insert();
            this.on_column_names_string_changed();
        }
    },

    get_column_indexes_insert: function () {
        let column_indexes_insert = [];
        let index_matches = this.column_indexes_string.match(this.numbers_regex);
        for(let index_match of index_matches) {
            let column_index = parseInt(index_match);
            if(column_index <= this.column_names.length) {
                column_indexes_insert.push(column_index);
            }
        }
        if(this.show_total_bytes_read) {
            column_indexes_insert.push(this.bytes_read_index);
        }
        if(this.show_total_bytes_written) {
            column_indexes_insert.push(this.bytes_written_index);
        }
        return column_indexes_insert;
    },

    on_terminal_command_changed: function () {
        this.terminal_process.bash_command = this.terminal_command;
    },

    // Override
    on_applet_clicked: function(event) {
        if(this.launch_terminal) {
            let is_running = this.terminal_process.is_running();
            if(is_running){
                this.terminal_process.kill();
            }
            else {
                this.terminal_process.spawn_async();
            }
        }

        this.close_hover_popup();
    },

    close_hover_popup: function () {
        this.hover_popup.close();
    },

    // Override
    on_panel_height_changed: function() {
        this._init_gui();
    },

    // Override
    on_applet_removed_from_panel: function() {
        this.is_running = false;
    },

    _init_files: function () {
        this.file_partitions = new Files.File(this.filepath_partitions);
        this.file_diskstats = new Files.File(this.filepath_diskstats);
    },

    _init_disks: function () {
        this.disk_names = this._init_disk_names();
        this.disk_sector_sizes = this._init_disk_sector_sizes();
        this.disk_name = this._init_disk_name();
    },

    _init_disk_names: function () {
        let disk_names = [];
        let string = this.read_partitions();
        string = string.trim();
        let lines = string.split(this.newlines_regex);
        for(let i = 1; i < lines.length; ++i) {
            let disk_name_match = lines[i].match(this.non_whitespace_end_regex);
            this.add_string_if_match_found(disk_names, disk_name_match);
        }
        return disk_names;
    },

    read_partitions: function () {
        let string = this.read_string(this.file_partitions, "");
        return string;
    },

    read_string: function (file, default_string) {
        try {
            let array_bytes = file.read_chars();
            let string = array_bytes.length > 0 ?
                this.cinnamon_version_adapter.byte_array_to_string(array_bytes) :
                default_string.toString();
            return string;
        }
        catch(exception) {
            return default_string;
        }
    },

    add_string_if_match_found: function (array, match_result) {
        if(match_result != null) {
            var str = match_result.toString();
            array.push(str);
        }
    },

    _init_disk_sector_sizes: function () {
        let sector_sizes = {};
        for(let disk_name of this.disk_names) {
            let sector_size = this.read_sectors_size(disk_name);
            sector_sizes[disk_name] = sector_size;
        }
        return sector_sizes;
    },

    read_sectors_size: function (disk_name) {
        let sector_size = -1;
        sector_size = this.read_sector_size_letter(sector_size, disk_name);
        sector_size = this.read_sector_size_non_whitespace(sector_size, disk_name);
        let number = sector_size >= 0 ? sector_size : this.default_sector_size;
        return number;
    },

    read_sector_size_letter: function (sector_size, disk_name) {
        var match_result = disk_name.match(this.letter_regex);
        sector_size = this.read_sector_size(sector_size, match_result);
        return sector_size;
    },

    read_sector_size: function (sector_size, match_result) {
        if(sector_size < 0 && match_result != null) {
            let device = match_result.toString();
            let filepath_sector_size = "/sys/block/" + device + "/queue/hw_sector_size";
            let file_sectors_size = new Files.File(filepath_sector_size);
            let exists = file_sectors_size.exists();
            if(exists) {
                sector_size = this.read_number(file_sectors_size, -1);
            }
        }
        return sector_size;
    },

    read_number: function (file, default_number) {
        try {
            let array_bytes = file.read_chars();
            let string = array_bytes.length > 0 ?
                this.cinnamon_version_adapter.byte_array_to_string(array_bytes) :
                default_number.toString();
            let number = parseInt(string);
            return number;
        }
        catch(exception) {
            return default_number;
        }
    },

    read_sector_size_non_whitespace: function (sector_size, disk_name) {
        var match_result = disk_name.match(this.non_whitespace_regex);
        sector_size = this.read_sector_size(sector_size, match_result);
        return sector_size;
    },

    _init_disk_name: function () {
        let disk_name = this.settings.getValue("disk_name");
        let is_valid = this.array_contains(this.disk_names, disk_name);
        if(!is_valid && this.disk_names.length > 0) {
            disk_name = this.disk_names[0];
        }
        return disk_name;
    },

    array_contains: function (array, element) {
        return array.indexOf(element) > -1;
    },

    _init_byte_indexes: function () {
        let string = this.read_diskstats().trim();
        let lines = string.split(this.newlines_regex);
        let line = lines[0].trim();
        let values = line.split(this.whitespaces_regex);
        let index = values.length;

        this.bytes_read_index = index;
        this.bytes_written_index = index + 1;
        this.byte_indexes = [this.bytes_read_index, this.bytes_written_index];
    },

    read_diskstats: function () {
        let string = this.read_string(this.file_diskstats, "");
        return string;
    },

    _init_columns: function () {
        this.on_devices_regex_string_changed();
        this.on_device_aliases_string_changed();
        this.on_column_names_string_changed();
        this.on_column_indexes_string_changed();
    },

    _init_terminal_process: function () {
        this.terminal_process = new ShellUtils.TerminalProcess(this.terminal_command);
        this.terminal_process.maximized = true;
    },

    _init_menu_item_gui: function () {
        this.menu_item_gui = new AppletGui.RadioMenuItem("Gui", ["Compact", "Large"]);
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

    on_gui_speed_type_changed: function () {
        this.menu_item_gui.set_active_option(this.gui_speed_type);
        this._init_gui();
    },

    on_context_menu_state_changed: function (actor, event) {
        this.close_hover_popup();
        let opened = event;
        if(opened) {
            this.update_disks();
        }
    },

    update_disks: function () {
         let updated = this.is_disk_updated();
         if(updated) {
             this._update_disks();
             this._reload_menu_item_disks();
         }
    },

    is_disk_updated: function () {
         let disk_names = this._init_disk_names();
         let updated = !this.arrays_equal(this.disk_names, disk_names);
         return updated;
    },

    arrays_equal: function (array1, array2) {
        return array1.length == array2.length &&
               array1.every(function(value, index) { return value === array2[index]; });
    },

    _update_disks: function () {
         this.disk_names = this._init_disk_names();
         this.disk_sector_sizes = this._init_disk_sector_sizes();
         let disk_name = this._init_disk_name();
         this.on_menu_item_disks_clicked(disk_name, -1);
    },

    _reload_menu_item_disks: function () {
        this.menu_item_disks.reload_options(this.disk_names);
        this._set_menu_item_disks_active_option();
    },

    _set_menu_item_disks_active_option: function () {
        let index = this.disk_names.indexOf(this.disk_name);
        this.menu_item_disks.set_active_option(index);
    },

    _init_menu_item_disks: function () {
        this.menu_item_disks = new AppletGui.RadioMenuItem("Disk", this.disk_names);
        this.menu_item_disks.set_callback_option_clicked(this, this.on_menu_item_disks_clicked);
        this._applet_context_menu.addMenuItem(this.menu_item_disks);
        this._set_menu_item_disks_active_option();
    },

    on_menu_item_disks_clicked: function (option_name, option_index) {
        if(this.disk_name != option_name) {
            this.disk_name = option_name;
            this._set_menu_item_disks_active_option();
        }
    },

    _init_hover_popup: function () {
        this.hover_popup = new AppletGui.HoverMenuTable(this, this.orientation);
        this.on_hover_popup_css_changed();
        this.on_show_hover_changed();
    },

    _init_gui: function () {
        this.gui_speed = new AppletGui.GuiSpeed(this._panelHeight, this.gui_speed_type, this.gui_decimal_places);
        this.actor.destroy_all_children();
        this._add_gui_speed();
    },

    _add_gui_speed: function () {
        this.actor.add(this.gui_speed.actor,
                      { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
        this.on_gui_icon_changed();
        this.on_gui_css_changed();
    },









    run: function () {
        this._run_calculate_speed_running();
    },

    _run_calculate_speed_running: function () {
        if(this.is_running) {
            this._run_calculate_speed();
        }
    },

    _run_calculate_speed: function () {
        this._calculate_speed();
        Mainloop.timeout_add(this.update_every * 1000, Lang.bind(this, this._run_calculate_speed_running));
    },

    _calculate_speed: function () {
        try {
            this.update_disks();
            this.update_input_output_diskstats();

            let read = this.get_bytes_read_iteration();
            let written = this.get_bytes_written_iteration();

            this.gui_speed.set_received_text(read);
            this.gui_speed.set_sent_text(written);
            this.update_hover_popup();
        }
        catch(e) {
            global.log("Error while calculating disk read and write speed: " + e);
        }
    },

    update_input_output_diskstats: function () {
        let string = this.read_diskstats();
        this.update_input_output_infos(string);
        this.udpate_diskstats_table(string);
    },

    update_input_output_infos: function (string) {
        string = string.trim();
        let lines = string.split(this.newlines_regex);
        for(let line of lines) {
            this.update_input_output_info(line);
        }
    },

    update_input_output_info: function (line) {
        line = line.trim();
        let values = line.split(this.whitespaces_regex);
        let device_name = values[this.device_name_index];
        let info = device_name in this.input_output_infos ? this.input_output_infos[device_name] :
                                                            new InputOutputInfo();
        this.update_input_output_info_values(info, values);
        this.update_input_output_info_bytes(info, device_name);
        this.input_output_infos[device_name] = info;
    },

    update_input_output_info_values: function (info, values) {
        info.previous_sectors_read = info.sectors_read;
        info.previous_sectors_written = info.sectors_written;

        info.reads_completed = parseInt(values[this.reads_completed_index]);
        info.reads_merged = parseInt(values[this.reads_merged_index]);
        info.sectors_read = parseInt(values[this.sectors_read_index]);
        info.time_reading_ms = parseInt(values[this.time_reading_ms_index]);
        info.writes_completed = parseInt(values[this.writes_completed_index]);
        info.writes_merged = parseInt(values[this.writes_merged_index]);
        info.sectors_written = parseInt(values[this.sectors_written_index]);
        info.time_writing_ms = parseInt(values[this.time_writing_ms_index]);
        info.inputs_outputs_in_progress = parseInt(values[this.inputs_outputs_in_progress_index]);
        info.time_inputs_outputs_ms = parseInt(values[this.time_inputs_outputs_ms_index]);
        info.weighted_time_inputs_outputs_ms = parseInt(values[this.weighted_time_inputs_outputs_ms_index]);

        if(values.length >= this.discards_completed_index)
        {
            info.discards_completed = parseInt(values[this.discards_completed_index]);
            info.discards_merged = parseInt(values[this.discards_merged_index]);
            info.sectors_discarded = parseInt(values[this.sectors_discarded_index]);
            info.time_discarding = parseInt(values[this.time_discarding_index]);
        }
    },

    update_input_output_info_bytes: function (info, device_name) {
        let exists = device_name in this.disk_sector_sizes;
        if(exists) {
            let sector_size = this.disk_sector_sizes[device_name];
            info.bytes_read = info.sectors_read * sector_size;
            info.bytes_written = info.sectors_written * sector_size;
        }
    },

    udpate_diskstats_table: function(string) {
        string = this.remove_multiple_whitespaces(string);
        let lines = this.get_lines(string);
        lines = this.trim_lines(lines);
        lines = this.match_lines_devices(lines);
        let table = this.get_table(lines);
        table = this.remove_nonexistent_devices(table);
        table = this.append_byte_columns(table);
        table = this.replace_device_names_aliases(table);
        table = this.sort_columns(table);
        table = this.round_byte_columns(table);
        table = this.cut_columns(table);
        table = this.prepend_headers(table);
        table = this.align_columns(table);
        this.diskstats_table = table;
    },

    remove_multiple_whitespaces: function (string) {
        string = string.replace(this.whitespaces_regex, this.word_separator);
        return string;
    },

    get_lines: function (string) {
        let lines = string.split(this.newlines_regex);
        return lines;
    },

    trim_lines: function (lines) {
        lines = lines.map(this.trim_string, this);
        return lines;
    },

    trim_string: function (string) {
        string = string.trim();
        return string;
    },

    match_lines_devices: function (lines) {
        lines = lines.filter(this.get_device_regex_lines, this);
        return lines;
    },

    get_device_regex_lines: function (line) {
        return this.devices_regex.test(line);
    },

    get_table: function (lines) {
        let table = lines.map(this.split_lines_whitespaces, this);
        return table;
    },

    split_lines_whitespaces: function (line) {
         return line.split(this.whitespaces_regex);
    },

    remove_nonexistent_devices: function (table) {
        table = table.filter(this.remove_nonexistent_device_row, this);
        return table;
    },

    remove_nonexistent_device_row: function (row_values) {
        let device_name = row_values[this.device_name_index];
        let exists = device_name in this.input_output_infos;
        return exists;
    },

    append_byte_columns: function (table) {
        table = table.map(this.append_byte_column_values, this);
        return table;
    },

    append_byte_column_values: function (row_values) {
        let device_name = row_values[this.device_name_index];
        let info = this.input_output_infos[device_name];
        row_values.push(info.bytes_read);
        row_values.push(info.bytes_written);
        return row_values;
    },

    replace_device_names_aliases: function (table) {
        table = table.map(this.replace_device_names_alias, this);
        return table;
    },

    replace_device_names_alias: function (row_values) {
        let device_name = row_values[this.device_name_index];
        let exists = device_name in this.device_aliases;
        if(exists) {
            row_values[this.device_name_index] = this.device_aliases[device_name];
        }
        return row_values;
    },

    sort_columns: function (table) {
        if(this.column_type_sort == AppletConstants.SortColumn.OTHER &&
           this.column_index_sort >= this.bytes_read_index) {
           return table;
        }

        let column_index = this.get_integer_column_index_sort();
        table = this.column_type_sort == AppletConstants.SortColumn.OTHER &&
                this.column_index_sort == this.device_name_index ?
                table.sort(this.sort_string_rows(this.column_index_sort, this.column_sort_order)) :
                table.sort(this.sort_integer_rows(column_index, this.column_sort_order));
        return table;
    },

    get_integer_column_index_sort: function () {
        let column_index = this.column_index_sort;
        if(this.column_type_sort == AppletConstants.SortColumn.BYTES_READ) {
            column_index = this.bytes_read_index;
        };
        if(this.column_type_sort == AppletConstants.SortColumn.BYTES_WRITTEN) {
            column_index = this.bytes_written_index;
        };
        return column_index;
    },

    sort_string_rows: function (column_index, sort_order) {
        return function(row_values_1, row_values_2) {
                let string1 = row_values_1[column_index];
                let string2 = row_values_2[column_index];
                return sort_order == AppletConstants.SortOrder.ASCENDING ? string1.localeCompare(string2) :
                                                                           string2.localeCompare(string1);
            }
    },

    sort_integer_rows: function (column_index, sort_order) {
        return function(row_values_1, row_values_2) {
                let integer1 = parseInt(row_values_1[column_index]);
                let integer2 = parseInt(row_values_2[column_index]);
                return sort_order == AppletConstants.SortOrder.ASCENDING ? integer1 - integer2 : integer2 - integer1;
            }
    },

    round_byte_columns: function (table) {
        table = table.map(this.round_byte_column_values, this);
        return table;
    },

    round_byte_column_values: function (row_values) {
        for(let index of this.byte_indexes) {
            if(index < row_values.length) {
                row_values[index] = this.convert_byte_column_value_to_readable_string(row_values[index]);
            }
        }
        return row_values;
    },

    convert_byte_column_value_to_readable_string: function (bytes) {
        let [number, unit] = this.convert_bytes_to_readable_unit(bytes);
        number = this.round_byte_column_number(number, unit);
        let output = number.toString() + unit;
        return output;
    },

    round_byte_column_number: function (number, unit) {
        let output_number = this.hover_popup_decimal_places == AppletConstants.DecimalPlaces.AUTO ?
                            this.round_byte_column_auto(number, unit) : number.toFixed(this.hover_popup_decimal_places);
        return output_number;
    },

    round_byte_column_auto: function (number, unit) {
        let output_number = this.is_less_gigabyte(unit) ? number.toFixed(0) : number.toFixed(2);
        return output_number;
    },

    is_less_gigabyte: function (unit) {
        return unit == "B" || unit == "kB" || unit == "MB";
    },

    cut_columns: function (table) {
        table = table.map(this.cut_column_indexes, this);
        return table;
    },

    cut_column_indexes: function (row_values) {
        let values = []
        for(let column_index of this.column_indexes_insert) {
            let row_value = row_values[column_index];
            values.push(row_value);
        }
        return values;
    },

    prepend_headers: function (table) {
        let headers = this.column_names_insert.slice();
        table.unshift(headers);
        return table;
    },

    align_columns: function (table) {
        let columns = table.length == 0 ? 0 : table[0].length;
        let max_lengths = this.get_max_string_lengths(table, columns);
        let last_column_index = columns - 1;
        for(let i = 0; i < table.length; ++i) {
            for(let j = 0; j < columns; ++j) {
                let min_length = j == last_column_index ? max_lengths[j] : max_lengths[j] + this.column_spaces;
                table[i][j] = this.pad_right_spaces(table[i][j], min_length);
            }
        }
        return table;
    },

    get_max_string_lengths: function (table, columns) {
        let max_lengths = [];
        for(let i = 0; i < columns; ++i) {
            let max_length = this.get_max_string_length(table, i);
            max_lengths.push(max_length);
        }
        return max_lengths;
    },

    get_max_string_length: function (table, column_index) {
        let max_length = 0;
        for(let row_values of table) {
            let string_length = row_values[column_index].length;
            if(string_length > max_length) {
                max_length = string_length;
            }
        }
        return max_length;
    },

    pad_right_spaces: function (string, min_length) {
        let difference = min_length - string.length;
        if(difference > 0) {
            ++difference;
            let array = new Array(difference);
            let spaces = array.join(this.word_separator);
            string += spaces;
        }
        return string;
    },

    get_bytes_read_iteration: function () {
        let sectors = this.get_sectors_read_iteration();
        let sector_size = this.get_sector_size();
        let bytes = sectors * sector_size;
        bytes = this.scale(bytes);
        let read = this.convert_to_readable_string(bytes);
        return read;
    },

    get_sectors_read_iteration: function () {
        let info = this.input_output_infos[this.disk_name];
        let sectors_read_iteration = this.calculate_bytes_difference(info.sectors_read, info.previous_sectors_read);
        return sectors_read_iteration;
    },

    calculate_bytes_difference: function (bytes, previous_bytes) {
        let difference = bytes - previous_bytes;
        if(difference < 0 || previous_bytes == 0) {
            difference = 0;
        }
        return difference;
    },

    get_sector_size: function () {
        let sector_size = this.disk_name in this.disk_sector_sizes ? this.disk_sector_sizes[this.disk_name] :
                                                                     this.default_sector_size;
        return sector_size;
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
        return [bits, "b"];
    },

    is_base: function (unit) {
        return unit == "B" || unit == "b";
    },

    round_output_number: function (number) {
        let output_number = this.gui_decimal_places == AppletConstants.DecimalPlaces.AUTO ?
                            this.round_output_number_auto(number) : number.toFixed(this.gui_decimal_places);
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

    get_bytes_written_iteration: function () {
        let sectors = this.get_sectors_written_iteration();
        let sector_size = this.get_sector_size();
        let bytes = sectors * sector_size;
        bytes = this.scale(bytes);
        let written = this.convert_to_readable_string(bytes);
        return written;
    },

    get_sectors_written_iteration: function () {
        let info = this.input_output_infos[this.disk_name];
        let sectors_written_iteration = this.calculate_bytes_difference(info.sectors_written,
                                                                        info.previous_sectors_written);
        return sectors_written_iteration;
    },

    update_hover_popup: function () {
        if(this.diskstats_table.length > 0) {
            let lines = this.join_table(this.diskstats_table);
            let headers_array = lines.splice(0, 1);
            let headers = headers_array[0];
            let rows = lines.join(this.line_end);
            this.hover_popup.set_headers_text(headers);
            this.hover_popup.set_rows_text(rows);
        }
    },

    join_table: function (table) {
        let lines = table.map(this.join_row_values, this);
        return lines;
    },

    join_row_values: function (row_values) {
         return row_values.join("");
    },

};





function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

