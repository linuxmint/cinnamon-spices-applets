
const uuid = 'download-and-upload-speed@cardsurf';
let Files;
if (typeof require !== 'undefined') {
    Files = require('./files');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    Files = AppletDirectory.files;
}





function BytesRowCsv(date, bytes_received, bytes_sent) {
    this._init(date, bytes_received, bytes_sent);
};

BytesRowCsv.prototype = {

    _init: function(date, bytes_received, bytes_sent) {
        this.date = date;
        this.bytes_received = bytes_received;
        this.bytes_sent = bytes_sent;
    },
};






BytesFileCsv.DataColumnName = "Date";
BytesFileCsv.BytesReceivedColumnName = "Received";
BytesFileCsv.BytesSentColumnName = "Sent";

BytesFileCsv.DataColumnIndex = 0;
BytesFileCsv.BytesReceivedColumnIndex = 1;
BytesFileCsv.BytesSentColumnIndex = 2;

function BytesFileCsv(path) {
    this._init(path);
};

BytesFileCsv.prototype = {

    _init: function(path) {
        this.path = path;
        this.csv_separator = ",";
        this.file = new Files.File(this.path);
    },

    to_byte_rows: function(array_strings) {
        let rows = [];
        let row;
        for (let i = 0; i < array_strings.length; ++i) {
            row = this.to_byte_row(array_strings[i]);
            rows.push(row);
        }
        return rows;
    },

    to_byte_row: function(string) {
        let values = string.split(this.csv_separator);
        let date = parseInt(values[BytesFileCsv.DataColumnIndex]);
        let bytes_received = parseInt(values[BytesFileCsv.BytesReceivedColumnIndex]);
        let bytes_sent = parseInt(values[BytesFileCsv.BytesSentColumnIndex]);
        let row = new BytesRowCsv(date, bytes_received, bytes_sent);
        return row;
    },

    to_csv_strings: function(array_byte_rows) {
        let strings = [];
        let string;
        for (let i = 0; i < array_byte_rows.length; ++i) {
            string = this.to_csv_string(array_byte_rows[i]);
            strings.push(string);
        }
        return strings;
    },

    to_csv_string: function(row) {
        let string_csv = row.date + this.csv_separator;
        string_csv += row.bytes_received + this.csv_separator;
        string_csv += row.bytes_sent;
        return string_csv;
    },

    get_byte_rows: function() {
        let array_strings = this.file.read();
        array_strings = this.remove_headers(array_strings);
        return this.to_byte_rows(array_strings);
    },

    remove_headers: function(array_strings) {
        array_strings.shift(0);
        return array_strings;
    },

    overwrite: function(array_byte_rows) {
        let array_strings = this.to_csv_strings(array_byte_rows);
        array_strings = this.add_headers(array_strings);
        return this.file.overwrite(array_strings);
    },

    add_headers: function(array_strings) {
        let headers = this.get_headers();
        array_strings.unshift(headers);
        return array_strings;
    },

    get_headers: function() {
        let headers = BytesFileCsv.DataColumnName + this.csv_separator;
        headers += BytesFileCsv.BytesReceivedColumnName + this.csv_separator;
        headers += BytesFileCsv.BytesSentColumnName;
        return headers;
    },

    exists: function() {
        return this.file.exists();
    },

    create: function() {
        return this.file.create();
    }

};




