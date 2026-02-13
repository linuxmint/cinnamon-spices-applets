
const GLib = imports.gi.GLib;

const uuid = 'text-to-speech-applet@cardsurf';
let AppletConstants, ShellUtils;
if (typeof require !== 'undefined') {
    AppletConstants = require('./appletConstants');
    ShellUtils = require('./shellUtils');
} else {
    const AppletDirectory = imports.ui.appletManager.applets[uuid];
    AppletConstants = AppletDirectory.appletConstants;
    ShellUtils = AppletDirectory.shellUtils;
}






function ClipboardReader() {
    this._init();
};

ClipboardReader.prototype = {

    _init: function() {
    },

    read_text: function(clipboard_type) {
        let text = "";
        switch(clipboard_type) {
        	case AppletConstants.ClipboardType.SELECTION_PRIMARY:
        		text = this.read_text_selection_primary();
        		break;
        	case AppletConstants.ClipboardType.SELECTION_CLIPBOARD:
        		text = this.read_text_selection_clipboard();
        		break;
        }
        return text;
    },

    read_text_selection_primary: function() {
        let script = this._get_filepath("read_text_selection_primary.py");
        let text = this._execute_script_and_get_output(script);
        return text;

    },

    read_text_selection_clipboard: function() {
        let script = this._get_filepath("read_text_selection_clipboard.py");
        let text = this._execute_script_and_get_output(script);
        return text;
    },

    _get_filepath: function(script_name) {
        let directory = this._get_applet_directory();
        let script = directory + script_name;
        return script;
    },

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    },

    _execute_script_and_get_output: function(script) {
        let process = new ShellUtils.ShellOutputProcess(['python3', script]);
        let output = process.spawn_sync_and_get_output();
        return output;
    },

};



