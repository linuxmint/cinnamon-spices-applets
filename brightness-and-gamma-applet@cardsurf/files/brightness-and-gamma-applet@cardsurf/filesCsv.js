
const uuid = "brightness-and-gamma-applet@cardsurf";

let Files;
if (typeof require !== 'undefined') {
    Files = require('./files');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    Files = AppletDirectory.files
}







function LastValuesRowCsv(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue) {
    this._init(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue);
};

LastValuesRowCsv.prototype = {

    _init: function(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue) {
        this.screen_name = screen_name;
        this.output_indexes_string = output_indexes_string;
        this.brightness = brightness;
        this.gamma_red = gamma_red;
        this.gamma_green = gamma_green;
        this.gamma_blue = gamma_blue;
    },
};





LastValuesFileCsv.ScreenNameColumnName = "Screen name";
LastValuesFileCsv.OutputIndexesStringColumnName = "Output indexes";
LastValuesFileCsv.BrightnessColumnName = "Brightness";
LastValuesFileCsv.GammaRedColumnName = "Gamma red";
LastValuesFileCsv.GammaGreenColumnName = "Gamma green";
LastValuesFileCsv.GammaBlueColumnName = "Gamma blue";

LastValuesFileCsv.ScreenNameColumnIndex = 0;
LastValuesFileCsv.OutputIndexesStringColumnIndex = 1;
LastValuesFileCsv.BrightnessColumnIndex = 2;
LastValuesFileCsv.GammaRedColumnIndex = 3;
LastValuesFileCsv.GammaGreenColumnIndex = 4;
LastValuesFileCsv.GammaBlueColumnIndex = 5;

function LastValuesFileCsv(path) {
    this._init(path);
};

LastValuesFileCsv.prototype = {

    _init: function(path) {
        this.path = path;
        this.csv_separator = ",";
        this.file = new Files.File(this.path);
    },

    get_last_value_rows: function() {
        let array_strings = this.file.read();
        array_strings = this.remove_headers(array_strings);
        return this.to_last_value_rows(array_strings);
    },

    to_last_value_rows: function(array_strings) {
        let rows = [];
        let row;
        for (let i = 0; i < array_strings.length; ++i) {
            row = this.to_last_value_row(array_strings[i]);
            rows.push(row);
        }
        return rows;
    },

    to_last_value_row: function(string) {
        let values = string.split(this.csv_separator);
        let screen_name = values[LastValuesFileCsv.ScreenNameColumnIndex];
        let output_indexes_string = values[LastValuesFileCsv.OutputIndexesStringColumnIndex];
        let brightness = parseInt(values[LastValuesFileCsv.BrightnessColumnIndex]);
        let gamma_red = parseInt(values[LastValuesFileCsv.GammaRedColumnIndex]);
        let gamma_green = parseInt(values[LastValuesFileCsv.GammaGreenColumnIndex]);
        let gamma_blue = parseInt(values[LastValuesFileCsv.GammaBlueColumnIndex]);
        let row = new LastValuesRowCsv(screen_name, output_indexes_string, brightness, gamma_red, gamma_green,
                                       gamma_blue);
        return row;
    },

    remove_headers: function(array_strings) {
        array_strings.shift(0);
        return array_strings;
    },

    overwrite: function(array_last_value_rows) {
        let array_strings = this.to_csv_strings(array_last_value_rows);
        array_strings = this.add_headers(array_strings);
        return this.file.overwrite(array_strings);
    },

    to_csv_strings: function(array_last_value_rows) {
        let strings = [];
        let string;
        for (let i = 0; i < array_last_value_rows.length; ++i) {
            string = this.to_csv_string(array_last_value_rows[i]);
            strings.push(string);
        }
        return strings;
    },

    to_csv_string: function(row) {
        let string_csv = row.screen_name + this.csv_separator;
        string_csv += row.output_indexes_string + this.csv_separator;
        string_csv += row.brightness + this.csv_separator;
        string_csv += row.gamma_red + this.csv_separator;
        string_csv += row.gamma_green + this.csv_separator;
        string_csv += row.gamma_blue;
        return string_csv;
    },

    add_headers: function(array_strings) {
        let headers = this.get_headers();
        array_strings.unshift(headers);
        return array_strings;
    },

    get_headers: function() {
        let headers = LastValuesFileCsv.ScreenNameColumnName + this.csv_separator;
        headers += LastValuesFileCsv.OutputIndexesStringColumnName + this.csv_separator;
        headers += LastValuesFileCsv.BrightnessColumnName + this.csv_separator;
        headers += LastValuesFileCsv.GammaRedColumnName + this.csv_separator;
        headers += LastValuesFileCsv.GammaGreenColumnName + this.csv_separator;
        headers += LastValuesFileCsv.GammaBlueColumnName;
        return headers;
    },

    exists: function() {
        return this.file.exists();
    },

    create: function() {
        return this.file.create();
    }

};

