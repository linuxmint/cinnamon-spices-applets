
const GLib = imports.gi.GLib;

const uuid = 'download-and-upload-speed@cardsurf';
let AppletConstants, Files, FilesCsv, Dates, Compatibility;
if (typeof require !== 'undefined') {
    AppletConstants = require('./appletConstants')
    Files = require('./files');
    FilesCsv = require('./filesCsv');
    Dates = require('./dates');
    Compatibility = require('./compatibility');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletConstants = AppletDirectory.appletConstants
    Files = AppletDirectory.files;
    FilesCsv = AppletDirectory.filesCsv;
    Dates = AppletDirectory.dates;
    Compatibility = AppletDirectory.compatibility;
}





function NetworkInterfaceInfo(network_interface) {
    this._init(network_interface);
};

NetworkInterfaceInfo.prototype = {

    _init: function(network_interface) {
        this.network_directory = "/sys/class/net/";
        this.network_interface = network_interface;
        this.applet_directory = this._get_applet_directory();
        this.bytes_directory = this.applet_directory + "/bytes/";
        this.cinnamon_version_adapter = new Compatibility.CinnamonVersionAdapter();

        this.bytes_received_previous = 0;
        this.bytes_received_iteration = 0;
        this.bytes_received_user_session = 0;
        this.bytes_received_interface_session = 0;
        this.bytes_received_last_write_before_midnight = 0;
        this.bytes_received_last_write_after_midnight = 0;
        this.bytes_received_total = 0;
        this.bytes_sent_previous = 0;
        this.bytes_sent_iteration = 0;
        this.bytes_sent_user_session = 0;
        this.bytes_sent_interface_session = 0;
        this.bytes_sent_last_write_before_midnight = 0;
        this.bytes_sent_last_write_after_midnight = 0;
        this.bytes_sent_total = 0;
        this.bytes_total = 0;

        this.filepath_bytes_received = "";
        this.filepath_bytes_sent = "";
        this.filepath_bytes_total = "";
        this.file_bytes_received = null;
        this.file_bytes_sent = null;
        this.file_bytes_total = null;
        this.midnight_date = null;
        this.custom_start_date = "";
        this.bytes_start_time = AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION;

        this._init_filename_properties();
        this._init_files();
        this._init_dates();
    },

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    },

    _init_filename_properties: function () {
        this.filepath_bytes_received = this.network_directory + this.network_interface + '/statistics/rx_bytes';
        this.filepath_bytes_sent = this.network_directory + this.network_interface + '/statistics/tx_bytes';
        this.filepath_bytes_total = this.bytes_directory + this.network_interface + '.csv';
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
        this._init_midnight_date();
        this._init_custom_start_date();
    },

    _init_midnight_date: function () {
        this.midnight_date = new Dates.ConvertableDate();
        this.midnight_date.add_days(1);
        this.midnight_date.set_hour(0);
        this.midnight_date.set_minute(0);
        this.midnight_date.set_second(0);
        this.midnight_date.set_millisecond(0);
    },

    _init_custom_start_date: function () {
        if(this.custom_start_date.length == 0) {
            let today = new Dates.ConvertableDate();
            this.custom_start_date = today.to_year_month_day_string("-");
        }
    },

    calculate_speed: function () {
        this.update_bytes_received();
        this.update_bytes_sent();
        this.update_bytes_last_write();
        this.update_bytes_total();
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

    calculate_bytes_difference: function (bytes, previous_bytes) {
        let difference = bytes - previous_bytes;
        if(difference < 0 || previous_bytes == 0) {
            difference = 0;
        }
        return difference;
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
        if(date_now.is_earlier(this.midnight_date)) {
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

    reset_bytes: function () {
        this._reset_bytes_previous();
        this._reset_bytes_iteration();
        this._reset_bytes_interface_session();
        this._reset_bytes_last_write();
    },

    _reset_bytes_previous: function () {
        this.bytes_received_previous = 0;
        this.bytes_sent_previous = 0;
    },

    _reset_bytes_iteration: function () {
        this.bytes_received_iteration = 0;
        this.bytes_sent_iteration = 0;
    },

    _reset_bytes_interface_session: function () {
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

    read_bytes_total: function() {
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

    write_bytes_total: function() {
        this._write_bytes_total_file();
        this._reset_bytes_last_write();
        this._init_midnight_date();
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
        let date = this.midnight_date.get_deep_copy();
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
        let date = this.midnight_date;
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

    update_bytes_user_session: function () {
        this.bytes_received_user_session += this.bytes_received_interface_session;
        this.bytes_sent_user_session += this.bytes_sent_interface_session;
    },

    set_bytes_total_to_user_session: function () {
        this.bytes_received_total = this.bytes_received_user_session + this.bytes_received_interface_session;
        this.bytes_sent_total = this.bytes_sent_user_session + this.bytes_sent_interface_session;
        this.update_bytes_total();
    },

}


