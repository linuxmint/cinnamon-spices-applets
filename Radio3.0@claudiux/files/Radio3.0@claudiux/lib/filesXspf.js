/**
 * Code from the download-and-upload-speed@cardsurf applet.
 * Many thanks to @cardsurf!
 */

let Files = require('./lib/files');
let HtmlEncodeDecode = require('./lib/htmlEncodeDecode');
const {
  xml2json
} = require('lib/xml2json.min');

const {
  get_home_dir
} = imports.gi.GLib; //GLib

/** Constants
 */
const APPNAME = "Radio3.0";
const UUID = APPNAME + "@claudiux";
const HOME_DIR = get_home_dir();
const DOT_CONFIG_DIR = HOME_DIR + "/.config/" + APPNAME;
const RADIO_LISTS_DIR = DOT_CONFIG_DIR + "/radio-lists";
const DEFAULT_XSPF_PATH = RADIO_LISTS_DIR + "/latest.xspf";

/**
 * @COLUMNS: columns of the .csv file.
 */
const COLUMNS = {
    0: "INC",
    1: "NAME",
    2: "URL"
}

/**
 * class StationsRowCsv
 */
class StationsRowCsv {
    constructor (inc, name, url) {
        this.inc = inc;
        this.name = name;
        this.url = url;
    }
}


/**
 * class StationsFileXspf
 */
class StationsFileXspf {
    constructor (path = DEFAULT_XSPF_PATH) {
        this.path = path;
        this.csv_separator = ";";
        this.file = new Files.File(this.path);
    }

    to_stations_rows (array_strings) {
        let rows = [];
        let row;
        for (let i=0, _length=array_strings.length; i<_length; ++i) {
            row = this.to_stations_row(array_strings[i]);
            rows.push(row);
        }
        return rows;
    }

    to_stations_row (string) {
        let values = string.split(this.csv_separator);
        let inc = values[0];
        let name = values[1];
        let url = values[2];
        let row = new StationsRowCsv(inc, name, url);
        return row;
    }

    to_csv_strings (array_stations_rows) {
        let strings = [];
        let string;
        for (let i=0, _length=array_stations_rows.length; i < _length; ++i) {
            string = this.to_csv_string(array_stations_rows[i]);
            strings.push(string);
        }
        return strings;
    }

    to_csv_string (row) {
        let string_csv = row.inc + this.csv_separator;
        string_csv += row.name + this.csv_separator;
        string_csv += row.url;
        return string_csv;
    }

    get_stations_rows () {
        let xml_array = this.file.read();
        let xml_string = xml_array.join("");
        xml_string = xml_string.replace(/>\s*</g, "><"); // deletes all useless spaces.
        xml_string = HtmlEncodeDecode.decode(xml_string);

        let json_data = xml2json(xml_string);
        //~ global.log("json_data: " + JSON.stringify(json_data, null, 4));

        let strings = [];
        var csv_string = "";

        if (Array.isArray(json_data.playlist.trackList.track)) {
            for (let t of json_data.playlist.trackList.track) {
                csv_string = "false;%s;%s".format(t.title, t.location);
                strings.push(csv_string);
                //~ global.log("csv_string: "+csv_string)
            }
        } else {
            csv_string = "false;%s;%s".format(
                json_data.playlist.trackList.track.title,
                json_data.playlist.trackList.track.location
            );
            strings.push(csv_string);
            //~ global.log("csv_string: "+csv_string)
        }

        return this.to_stations_rows(strings);
    }

    remove_headers (array_strings) {
        array_strings.shift(0);
        return array_strings;
    }

    overwrite (array_stations_rows) {
        let array_strings = this.to_csv_strings(array_stations_rows);
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
        headers += COLUMNS[2];
        return headers;
    }

    exists () {
        return this.file.exists();
    }

    create () {
        return this.file.create();
    }

    get_json () {
        let rows = this.get_stations_rows();
        let _json = [];
        for (let row of rows) {
            let jrow = {};
            jrow["inc"] = (row.inc === "true") ? true : false;
            jrow["name"] = row.name;
            jrow["url"] = row.url;
            _json.push(jrow);
        }
        return _json
    }

    get_all_unselected_json () {
        let rows = this.get_stations_rows();
        let _json = [];
        for (let row of rows) {
            let jrow = {};
            jrow["inc"] = false;
            jrow["name"] = row.name;
            jrow["url"] = row.url;
            _json.push(jrow);
        }
        return _json
    }
}
