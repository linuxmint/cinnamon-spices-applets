
LastValuesRow.ScreenNameColumnIndex = 0;
LastValuesRow.OutputIndexesStringColumnIndex = 1;
LastValuesRow.BrightnessColumnIndex = 2;
LastValuesRow.GammaRedColumnIndex = 3;
LastValuesRow.GammaGreenColumnIndex = 4;
LastValuesRow.GammaBlueColumnIndex = 5;
LastValuesRow.CsvSeparator = ",";

function LastValuesRow(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue) {
    this._init(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue);
};

LastValuesRow.prototype = {

    _init: function(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue) {
        this.screen_name = screen_name;
        this.output_indexes_string = output_indexes_string;
        this.brightness = brightness;
        this.gamma_red = gamma_red;
        this.gamma_green = gamma_green;
        this.gamma_blue = gamma_blue;
    },
};






function to_last_values_row(string) {
    let values = string.split(LastValuesRow.CsvSeparator);
    let screen_name = values[LastValuesRow.ScreenNameColumnIndex];
    let output_indexes_string = values[LastValuesRow.OutputIndexesStringColumnIndex];
    let brightness = parseInt(values[LastValuesRow.BrightnessColumnIndex]);
    let gamma_red = parseInt(values[LastValuesRow.GammaRedColumnIndex]);
    let gamma_green = parseInt(values[LastValuesRow.GammaGreenColumnIndex]);
    let gamma_blue = parseInt(values[LastValuesRow.GammaBlueColumnIndex]);
    let row = new LastValuesRow(screen_name, output_indexes_string, brightness, gamma_red, gamma_green, gamma_blue);
    return row;
};

function to_csv_string (row) {
    let string_csv = row.screen_name + LastValuesRow.CsvSeparator;
    string_csv += row.output_indexes_string + LastValuesRow.CsvSeparator;
    string_csv += row.brightness + LastValuesRow.CsvSeparator;
    string_csv += row.gamma_red + LastValuesRow.CsvSeparator;
    string_csv += row.gamma_green + LastValuesRow.CsvSeparator;
    string_csv += row.gamma_blue;
    return string_csv;
};

