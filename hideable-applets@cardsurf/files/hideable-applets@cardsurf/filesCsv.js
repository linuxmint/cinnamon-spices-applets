
const uuid = "hideable-applets@cardsurf";
let Files;
if (typeof require !== 'undefined') {
    Files = require('./files');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    Files = AppletDirectory.files;
}







function FileCsvBase(path) {
    this._init(path);
};

FileCsvBase.prototype = {

    _init: function(path) {
        this.path = path;
        this.csv_separator = ",";
        this.file = new Files.File(this.path);
    },

    get_rows: function() {
        let array_strings = this.file.read();
        array_strings = this.remove_headers(array_strings);
        return this.to_rows(array_strings);
    },

    to_rows: function(array_strings) {
        let rows = [];
        let row;
        for (let i = 0; i < array_strings.length; ++i) {
            row = this.to_row(array_strings[i]);
            rows.push(row);
        }
        return rows;
    },

    remove_headers: function(array_strings) {
        array_strings.shift(0);
        return array_strings;
    },

    overwrite: function(array_rows) {
        let array_strings = this.to_csv_strings(array_rows);
        array_strings = this.add_headers(array_strings);
        return this.file.overwrite(array_strings);
    },

    to_csv_strings: function(array_rows) {
        let strings = [];
        let string;
        for (let i = 0; i < array_rows.length; ++i) {
            string = this.to_csv_string(array_rows[i]);
            strings.push(string);
        }
        return strings;
    },

    add_headers: function(array_strings) {
        let headers = this.get_headers();
        array_strings.unshift(headers);
        return array_strings;
    },

    exists: function() {
        return this.file.exists();
    },

    create: function() {
        return this.file.create();
    },

    // Abstract
    to_csv_string: function(row) {
        throw "Not implemented exception";
    },

    // Abstract
    to_row: function(string) {
        throw "Not implemented exception";
    },

    // Abstract
    get_headers: function() {
        throw "Not implemented exception";
    },

};








LastValuesFileCsv.UuidColumnName = "Applet UUID";
LastValuesFileCsv.IsVisibleColumnName = "Is visible";
LastValuesFileCsv.UuidColumnIndex = 0;
LastValuesFileCsv.IsVisibleColumnIndex = 1;

function LastValuesRowCsv(uuid, is_visible) {
    this._init(uuid, is_visible);
};
LastValuesRowCsv.prototype = {
    _init: function(uuid, is_visible) {
        this.uuid = uuid;
        this.is_visible = is_visible;
    },
};

function LastValuesFileCsv(path) {
    this._init(path);
};

LastValuesFileCsv.prototype = {
    __proto__: FileCsvBase.prototype,

    _init: function(path) {
        FileCsvBase.prototype._init.call(this, path);
    },

    // Override
    to_csv_string: function(row) {
        let string_csv = row.uuid + this.csv_separator;
        string_csv += row.is_visible;
        return string_csv;
    },

    // Override
    to_row: function(string) {
        let values = string.split(this.csv_separator);
        let uuid = values[LastValuesFileCsv.UuidColumnIndex];
        let is_visible = values[LastValuesFileCsv.IsVisibleColumnIndex] == "true" ? true : false;
        let row = new LastValuesRowCsv(uuid, is_visible);
        return row;
    },

    // Override
    get_headers: function() {
        let headers = LastValuesFileCsv.UuidColumnName + this.csv_separator;
        headers += LastValuesFileCsv.IsVisibleColumnName;
        return headers;
    },
};

