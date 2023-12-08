const {
  get_home_dir,
  file_get_contents
} = imports.gi.GLib; //GLib

const {to_string} = require("./lib/to-string");

/** Constants
 */
const APPNAME = "Radio3.0";
const UUID = APPNAME + "@claudiux";
const HOME_DIR = get_home_dir();
const DOT_CONFIG_DIR = HOME_DIR + "/.config/" + APPNAME;
const RADIO_LISTS_DIR = DOT_CONFIG_DIR + "/radio-lists";
const DEFAULT_JSON_PATH = RADIO_LISTS_DIR + "/Radio3.0_EXAMPLES.json";

/**
 * class StationsFileJson
 */
class StationsFileJson {
  constructor (path = DEFAULT_JSON_PATH) {
    this.path = path;
    this.contents = JSON.parse(to_string(file_get_contents(this.path)[1]));
  }

  get_all_unselected_json () {
    let rows = [];

    for (let row of this.contents) {
      let _row = {};
      if (row["url"].length > 0) {
        rows.push({"select": false,"name": row.name, "bitrate": row.bitrate, "url": row.url})
      }
    }

    return rows
  }
}
