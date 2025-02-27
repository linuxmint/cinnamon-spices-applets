
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

const UUID = "Bps@claudiux";
const ShellUtils = require('./lib/shellUtils');

function Translator(path) {
    this._init(path);
};

Translator.prototype = {

    _init: function() {

    },

    bind_domain: function() {
        let path = this._get_mo_directory();
        Gettext.bindtextdomain(UUID, path);
    },

    _get_mo_directory: function() {
        let path = GLib.get_home_dir() + "/.local/share/locale";
        return path;
    },

    generate_files: function () {
        let script_path =  this._get_script_path();
        this._grant_executable_permission(script_path);
        this._generate_mo_files(script_path);
    },

    _get_script_path: function() {
        let path = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/scripts/translation.sh";
        return path;
    },

    _grant_executable_permission: function(script_path) {
        let process = new ShellUtils.ShellOutputProcess(['chmod', '755', script_path]);
        let output = process.spawn_sync_and_get_output();
        return output;
    },

    _generate_mo_files: function(script_path) {
        let process = new ShellUtils.ShellOutputProcess([script_path]);
        let output = process.spawn_sync_and_get_output();
        return output;
    },

};


