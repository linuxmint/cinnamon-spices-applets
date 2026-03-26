/**
 * Code from the download-and-upload-speed@cardsurf applet.
 * Many thanks to @cardsurf!
 */
let Files= require('./lib/files');

/** Constants
 */
const {
    UUID,
    HOME_DIR,
    APPLET_DIR,
    SCRIPTS_DIR,
    ICONS_DIR,
    IFACES_DIR,
    SOUNDS_DIR,
    DEFAULT_SYMBOLIC_ICON,
    _,
    exists,
    DEBUG,
    RELOAD,
    log,
    logError
} = require("./lib/constants");

const DEFAULT_CSV_PATH = APPLET_DIR + "/data/symbola_flag_codes.csv";

/**
 * @COLUMNS: columns of the .csv file.
 */
const COLUMNS = {
    0: "ISO",
    1: "Emoji",
    2: "Unicode",
    3: "Name"
}



/**
 * class FlagsRowsCsv
 */
class FlagsRowCsv {
    constructor (iso, emoji, unicode, name) {
        this.iso = iso;
        this.emoji = emoji;
        this.unicode = unicode;
        this.name = name;
    }
}


/**
 * class FlagsFileCsv
 */
class FlagsFileCsv {
    constructor (path = DEFAULT_CSV_PATH) {
        this.path = path;
        this.csv_separator = ";";
        this.file = new Files.File(this.path);
    }

    to_flags_rows (array_strings) {
        let rows = [];
        let row;
        for (let i = 0; i < array_strings.length; ++i) {
            row = this.to_flags_row(array_strings[i]);
            rows.push(row);
        }
        return rows;
    }

    to_flags_row (string) {
        let values = string.split(this.csv_separator);
        let iso = values[0];
        let emoji = values[1];
        let unicode = values[2];
        let name = values[3];
        let row = new FlagsRowCsv(iso, emoji, unicode, name);
        return row;
    }

    to_csv_strings (array_flags_rows) {
        let strings = [];
        let string;
        for (let i = 0; i < array_flags_rows.length; ++i) {
            string = this.to_csv_string(array_flags_rows[i]);
            strings.push(string);
        }
        return strings;
    }

    to_csv_string (row) {
        let string_csv = row.iso + this.csv_separator;
        string_csv += row.emoji + this.csv_separator;
        string_csv += row.unicode + this.csv_separator;
        string_csv += row.name;
        return string_csv;
    }

    get_flags_rows () {
        let array_strings = this.file.read();
        array_strings = this.remove_headers(array_strings);
        return this.to_flags_rows(array_strings);
    }

    remove_headers (array_strings) {
        array_strings.shift(0);
        return array_strings;
    }

    overwrite (array_flags_rows) {
        let array_strings = this.to_csv_strings(array_flags_rows);
        array_strings = this.add_headers(array_strings);
        return this.file.overwrite(array_strings);
    }

    add_headers (array_strings) {
        let headers = this.get_headers();
        array_strings.unshift(headers);
        return array_strings;
    }

    get_headers () {
        let headers = COLUMNS[0] + this.csv_separator;
        headers += COLUMNS[1] + this.csv_separator;
        headers += COLUMNS[2] + this.csv_separator;
        headers += COLUMNS[3];
        return headers;
    }

    exists () {
        return this.file.exists();
    }

    create () {
        return this.file.create();
    }

    get_json () {
        let rows = this.get_flags_rows();
        let _json = {};
        for (let row of rows) {
            _json["%s".format(row.iso)] = {
                "emoji": "%s".format(row.emoji),
                "name": "%s".format(row.name)
            }
        }
        return _json
    }

}
