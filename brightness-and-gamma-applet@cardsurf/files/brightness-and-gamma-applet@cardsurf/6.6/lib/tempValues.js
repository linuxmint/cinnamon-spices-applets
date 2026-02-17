

class TempLastValuesRow {
    constructor(screen_name, output_indexes_string, brightness, temperature=6500) {
        this.screen_name = screen_name;
        this.output_indexes_string = output_indexes_string;
        this.brightness = brightness;
        this.temperature = temperature;
    }
}

TempLastValuesRow.ScreenNameColumnIndex = 0;
TempLastValuesRow.OutputIndexesStringColumnIndex = 1;
TempLastValuesRow.BrightnessColumnIndex = 2;
TempLastValuesRow.TemperatureColumnIndex = 3;
TempLastValuesRow.CsvSeparator = ",";

function to_last_values_row_temp(string) {
    let values = string.split(TempLastValuesRow.CsvSeparator);
    let screen_name = values[TempLastValuesRow.ScreenNameColumnIndex];
    let output_indexes_string = values[TempLastValuesRow.OutputIndexesStringColumnIndex];
    let brightness = parseInt(values[TempLastValuesRow.BrightnessColumnIndex]);
    let temperature = (values[TempLastValuesRow.TemperatureColumnIndex] != null) ? parseInt(values[TempLastValuesRow.TemperatureColumnIndex]) : 6500;
    let row = new TempLastValuesRow(screen_name, output_indexes_string, brightness, temperature);
    return row;
};

function to_csv_string_temp (row) {
    let string_csv = row.screen_name + TempLastValuesRow.CsvSeparator;
    string_csv += row.output_indexes_string + TempLastValuesRow.CsvSeparator;
    string_csv += row.brightness + TempLastValuesRow.CsvSeparator;
    string_csv += row.temperature;
    return string_csv;
};

