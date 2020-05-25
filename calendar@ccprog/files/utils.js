/* global imports */
/* eslint camelcase: "off" */

const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const glib = imports.gi.GLib;

const re = /(\w+)=("?)(.*(?=")|.*)/;

function getInfo (env) {
    let [error, standard_output, standard_error, exit_status] = glib.spawn_command_line_sync("locale -k " + env);
    const info = {};

    standard_output.toString().split("\n").forEach((line) => {
        const match = re.exec(line);
        if (!match) {
            return;
        }

        const [, key, quoted, value] = match;

        if (quoted) {
            info[key] = value;
        } else if (key) {
            info[key] = parseInt(value, 10);
        }
    });

    return info;
}

function readJsonFile (file) {
    if(file.query_exists(null)) {
        const rawData = Cinnamon.get_file_contents_utf8_sync(file.get_path());
        return JSON.parse(rawData);
    }
    return {};
}

function writeJsonFile (file, data) {
    const rawData = JSON.stringify(data);
    try {
        let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out_file, rawData);
        out_file.close(null);
    } catch (e) {
        global.log(e);
    }
}