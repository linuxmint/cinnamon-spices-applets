const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Signals = imports.signals;

/*
 * The AppletSettings class is intended to allow easy access to user settings file(s)
 *
 * Generally the settings file will consist of comma-delimited entries, with one
 * 'record' per line, and the first entry in each line being known as the 'key'
 *
 * For instance, if I wanted to allow setting of a search provider, and the url to use for it
 * I might put:
 *
 * PROVIDER, Google, http://google.com/search?q=
 *
 * Any blank lines, or lines starting with # will be filtered out
 *
 * To initialize,
 *
 * settingProvider = new AppletSettings(uuid, dist_filename, filename)
 * where:
 * uuid is the uuid of the app (a folder with this name will be created under <userhome>/.cinnamon/
 * dist_filename is the file name packed with the applet, will be the seed file for the user settings file
 * filename is the settings file name that will be created in the .cinnamon/<uuid> folder
 *
 *
 * It will emit the signal 'settings-file-changed' if the settings file is modified while the applet is running
 * You can use this to know when to reload the settings
 *
 *
 */


const SETTINGS_FOLDER = GLib.get_home_dir() + '/.cinnamon/';

function AppletSettings(uuid, dist_filename, filename) {
    this._init(uuid, dist_filename, filename);
}

AppletSettings.prototype = {
        _init: function (uuid, dist_filename, filename) {
            this.uuid = uuid;
            this.dist_filename = dist_filename;
            this.applet_dir = imports.ui.appletManager._find_applet(this.uuid);
            this.filename = filename;
            this.settings = new Array();
            this.parsed_settings = new Array();
            try {
                this.dist_filename = this.applet_dir.get_child(this.dist_filename);
                this.settings_dir = Gio.file_new_for_path(SETTINGS_FOLDER + this.uuid);
                this.settings_file = Gio.file_parse_name(SETTINGS_FOLDER + this.uuid + '/' + this.filename);

                if (!this.settings_file.query_exists(null)) {
                    if (!this.settings_dir.query_exists(null)) this.settings_dir.make_directory_with_parents(null);
                    let fp = this.settings_file.create(0, null);
                    let dist_settings = Cinnamon.get_file_contents_utf8_sync(this.dist_filename.get_path());
                    fp.write(dist_settings, null);
                    fp.close(null);
                }
                let f = this.settings_file;
                this.settings_file_monitor = f.monitor_file(Gio.FileMonitorFlags.NONE, null);
                this.settings_file_monitor.connect('changed', Lang.bind(this, this._on_settings_file_changed));
                this.readSettings();
            } catch (e) {
                global.logError(e);
            }
        },

        _on_settings_file_changed: function () {
            this.emit("settings-file-changed");
        },

        /*
         * readSettings:  Reloads the setting file from the disk
         * You generally want to call this any time 'settings-file-changed'
         * is triggered so you can re-build your applet's state
         *
         */
        readSettings: function () {
            this.parsed_settings = [];
            this.settings = Cinnamon.get_file_contents_utf8_sync(this.settings_file.get_path());
            let lines = this.settings.split('\n');

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (line.substring(0,1) == '#') {
                    this.parsed_settings.push(['_comment_', line]);
                    continue;
                }
                if (line.trim(' ') == '') {
                    this.parsed_settings.push(['_blank_', '_blank_']);
                    continue;
                }
                let component_line_pretrim = line.split(',');
                let component_line = new Array();

                for (let j = 0; j < component_line_pretrim.length; j++) {
                    component_line[j] = component_line_pretrim[j].replace(/^\s+|\s+$/g, "");
                }

                this.parsed_settings.push(component_line);
            }
        },

        writeSettings: function () {
            try {
                let writer = this.settings_file.replace(null, false,
                        Gio.FileCreateFlags.REPLACE_DESTINATION,
                        null);
                for (let i = 0; i < this.parsed_settings.length; i++) {
                    if (this.parsed_settings[i][0] == '_blank_') {
                        writer.write('\n', null);
                    } else if (this.parsed_settings[i][0] == '_comment_') {
                        writer.write(this.parsed_settings[i][1], null);
                        writer.write('\n', null);
                    } else {
                        writer.write(this.parsed_settings[i].toString(), null);
                        writer.write('\n', null);
                    }
                }
                writer.close(null);
            } catch (e) {
                global.logError(e);
            }
        },

        /*
         * editSettingsFile: Open the user settings file using the supplied editor
         * editor: string of editor name to use
         */
        editSettingsFile: function (editor) {
            Main.Util.spawnCommandLine(editor + " " + this.settings_file.get_path());
        },

        /*
         * getArray:  Returns an array of a single setting 'record'
         * key: search string (first entry in a record)
         * def: what you want returned if the search is unsuccessful
         *
         * example entry:
         *
         * PROVIDER, Google, http://google.com/search?q=
         *
         */
        getArray: function (key, def) {
            if (this.parsed_settings.length == 0) {
                return def;
            }
            let res;
            for (i=0; i < this.parsed_settings.length; i++) {
                if(key == this.parsed_settings[i][0]) {
                    res = this.parsed_settings[i]; 
                }
            }
            if (res) {
                return res;
            } else {
                return def;
            }
        },

        getAllArray: function (key, def) {
            if (this.parsed_settings.length == 0) {
                return def;
            }
            let res = [];
            for (i=0; i < this.parsed_settings.length; i++) {
                if(key == this.parsed_settings[i][0]) {
                    res.push(this.parsed_settings[i]); 
                }
            }
            if (res) {
                return res;
            } else {
                return def;
            }
        },

        /*
         * getString: Returns a string - generally the 2nd entry in a record
         * key: search string (first entry in a record)
         * def: what you want returned if the search is unsuccessful
         *
         * example entry:
         *
         * LABEL, Superman
         *
         */
        getString: function (key, def) {
            let res = this.getArray(key, ['null', 'null']);
            if (res[0] == 'null') {
                return def;
            } else {
                return res[1];
            }
        },

        /*
         * getBoolean: Returns true or false based on the 2nd entry in a record
         * key: search string (first entry in a record)
         * def: what you want returned if the search is unsuccessful
         *
         * example entry:
         *
         * SHOW_PROVIDER, true
         *
         */
        getBoolean: function (key, def) {
            let res = this.getString(key, 'null');
            if (res == 'null') {
                return def;
            }
            return (res == 'true') ? true : false;
        },

        /*
         * getRawList: Returns a multi-dimensional array consisting
         * of all the records extracted from the settings file
         */
        getRawList: function () {
            return this.parsed_settings;
        },
        
        _get_combo_setting_raw: function (key) {
            let result = [];
            result.push([key + '_CHOICE', this.getString(key + '_CHOICE', 'null')]);
            let choices = this.getAllArray(key, ['null','null']);
            for (let i=0; i < choices.length; i++) {
                result.push(choices[i]);
            }
            return result;
        },

        setBoolean: function (key, val) {
            let index = this._get_index_of_setting(key);
            let valstring = (val) ? 'true' : 'false';
            if (index != -1) {
                this.parsed_settings[index][1] = valstring;
            } else {
                let newsetting = [key, valstring];
                this.parsed_settings.push(newsetting);
            }
            this.writeSettings();
        },

        _get_index_of_setting: function (key) {
            for (let i = 0; i < this.parsed_settings.length; i++) {
                let item = this.parsed_settings[i][0];
                if (item == key) {
                    return i;
                }
            }
            return -1;
        },

        getComboArray: function (key, def) {
            let raw = this._get_combo_setting_raw(key);
            if (raw[0][1] == 'null') {
                return def;
            }
            let i = parseInt(raw[0][1]);
            raw.splice(0,1);
            return raw[i];
        },

        setComboChoice: function (key, index) {
            let i = this._get_index_of_setting(key + '_CHOICE');
            let valstring = index.toString();
            if (i != -1) {
                this.parsed_settings[i][1] = valstring;
            } else {
                let newsetting = [key + '_CHOICE', valstring];
                this.parsed_settings.push(newsetting);
            }
            this.writeSettings();
        }
};
Signals.addSignalMethods(AppletSettings.prototype);

