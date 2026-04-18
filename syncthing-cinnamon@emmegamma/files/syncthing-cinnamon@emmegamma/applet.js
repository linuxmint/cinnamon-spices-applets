const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const UUID = "syncthing-cinnamon@emmegamma";

function Syncthing(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

Syncthing.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        try{
            // initialize settings
            this.settings = new Settings.AppletSettings(this, "syncthing-cinnamon@emmegamma", instance_id);
            this.settings.bind("update-interval", "update_interval", this.on_interval_changed);
            this.settings.bind("syncthing-command", "syncthing_command");
            this.settings.bind("syncthing-args", "syncthing_args");
            this.settings.bind("syncthingctl-command", "syncthingctl_command");
            this.settings.bind("syncthing-url", "syncthing_url");
            this.settings.bind("syncthing-port", "syncthing_port");


            // Set icon and tooltip
            this._updateAppletStatus();


            // make menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            let openWebUI = new PopupMenu.PopupMenuItem("Open Web UI", { reactive: true });
            openWebUI.connect('activate', () => {
               Util.spawnCommandLine(`xdg-open http://${this.syncthing_url}:${this.syncthing_port}`);
             });

            let restart = new PopupMenu.PopupMenuItem("Start/restart", { reactive: true });
            restart.connect('activate', () => {
               let status = this._get_syncthingstatus();
               // if syncthing is not running, syncthingctl is not available, so run syncthing command
               if (status.includes("Stopped") || status.includes("failed")) {
                    Util.spawnCommandLineAsync(`${this.syncthing_command} ${this.syncthing_args}`,
                        global.log(`${UUID}: syncthing started successfully`),
                        global.logError(`${UUID}: error on starting syncthing`)
                        );
                }
                else {
                    //Util.spawnCommandLine("syncthingctl restart");
                    this._run_cmd(`${this.syncthingctl_command} restart`);
                    global.log(`${UUID}: syncthing restarted`);
                }
               this._updateAppletStatus();
             });

            let stop = new PopupMenu.PopupMenuItem("Stop", { reactive: true });
            stop.connect('activate', () => {
               //Util.spawnCommandLine("syncthingctl stop");
               this._run_cmd(`${this.syncthingctl_command} stop`);
               global.log(`${UUID}: syncthing stopped`);
               this._updateAppletStatus();
             });

            let showlog = new PopupMenu.PopupMenuItem("Show log", { reactive: true });
            showlog.connect('activate', () => {
                // show the log in terminal with 'less'; should find a better way in the future
               Util.spawnCommandLine(`x-terminal-emulator -e bash -c "${this.syncthingctl_command} log | less"`);
             });

            this.menu.addMenuItem(openWebUI);
            this.menu.addMenuItem(restart);
            this.menu.addMenuItem(stop);
            this.menu.addMenuItem(showlog);

            // start status updater routine
            this._initStatusUpdates();
        }
        catch(err) {
            global.log(`${UUID}: ${err}`);
        }
    },


    on_applet_clicked: function(event) {
        this.menu.toggle();
    },


    on_applet_removed_from_panel: function() {
        this._stopStatusUpdates();
    },


    on_interval_changed: function() {
        //restart StatusUpdate with the new interval
        this._stopStatusUpdates();
        this._initStatusUpdates();
    },


   _run_cmd: function(command) {
        try {
            let [ok, stdout, stderr] = GLib.spawn_command_line_sync(command);

            // GLib returns ByteArray-like objects; convert safely
            let out = stdout ? stdout.toString() : "";
            let err = stderr ? stderr.toString() : "";

            // Return both to be able to detect errors printed to stderr
            return (out + "\n" + err).trim();

        } catch (err) {
            global.log(`${UUID}: ${err}`);
            return ""; // keep it predictable
        }
    },


    _get_syncthingstatus: function() {
        //let status = this._run_cmd("syncthingctl status | grep Status | head -n1  | awk '{print $NF}'");
        let status;
        try {
            let status_output = this._run_cmd("syncthingctl status");
            if (/Connection refused/i.test(status_output) || /^Error:/m.test(status_output)) {
                status = "Stopped";
            } else {
                status = this._extractOverallStatus(status_output);
            }
        }
        catch (err) {
            status = "Command failed (err)";
            global.log(`${UUID}: ${err}`);
        }
        return status;
    },


    _extractOverallStatus: function(output) {
        output = this._stripAnsi(output);

        // grab the first Status under Overall statistics
        const m = output.match(/Overall statistics[\s\S]*?\n\s*Status\s+(.+?)\s*(?:\n|$)/);
        return m ? m[1].trim() : null;
    },


    _stripAnsi: function(s) {
        // Robust ANSI/VT100 escape stripper
        return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    },


     _initStatusUpdates: function() {
        // run once immediately
        this._updateAppletStatus();
        // then every XX seconds as defined by this.update_interval
        this._updateSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.update_interval,
            () => {
                // If the applet is removed, this can stop by returning false
                this._updateAppletStatus();
                return GLib.SOURCE_CONTINUE; // keep repeating
            }
        );
    },


    _stopStatusUpdates: function() {
        if (this._updateSourceId) {
            GLib.Source.remove(this._updateSourceId);
            this._updateSourceId = 0;
        }
    },


    _updateAppletStatus: function() {
        let status = this._get_syncthingstatus();
        this.set_applet_tooltip(`Syncthing status: ${status}`);
        this._updateIcon(status);
    },


    _updateIcon: function(status) {
        //global.log(`_updateIcon: ${status}`)
        switch (status) {
            case "idle":
                this.set_applet_icon_symbolic_name("syncthing-running");
                break;
            case "scanning":
                this.set_applet_icon_symbolic_name("syncthing-scanning");
                break;
            case "Stopped":
                this.set_applet_icon_symbolic_name("syncthing-stopped");
                break;
            case "Command failed (err)":
                this.set_applet_icon_symbolic_name("syncthing-error");
                break;
            default:
                this.set_applet_icon_symbolic_name("syncthing-running");
            }
     }


    //  _updateApplet: function() {
    //     this._updateAppletStatus();
    // },

};


function main(metadata, orientation, panel_height, instance_id) {
    return new Syncthing(metadata, orientation, panel_height, instance_id);
}
