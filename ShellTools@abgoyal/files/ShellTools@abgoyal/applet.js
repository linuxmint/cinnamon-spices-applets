
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;


function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {

    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        this._orientation = orientation;
        this.metadata = metadata;
        this.configFilePath = GLib.get_home_dir() + '/.cinnamon/configs/' + metadata.uuid;
        let configFile = Gio.file_new_for_path(this.configFilePath);
        if (!configFile.query_exists(null)) {
            Util.spawnCommandLine('mkdir ' + this.configFilePath);
            Mainloop.timeout_add(2000, ()=>this.__init());
        } else {
            this.__init();
        }
    },

    __init: function() {

        this.iconsFile = GLib.build_filenamev([this.metadata.path, 'icon.svg']);
        this.toolsFile = GLib.build_filenamev([this.configFilePath, 'tools.json']);
        this.toolsProcessor = GLib.build_filenamev([this.configFilePath, 'processTools.sh']);
        this.toolsDir = GLib.build_filenamev([this.configFilePath, 'tools']);
        this.stateFile = GLib.build_filenamev([this.configFilePath, 'state.sh']);

        const setupApplet = () => {
            this.set_applet_icon_path(this.iconsFile);
            this.set_applet_tooltip(_("Shell Tools"));
            this._updateFrequencySeconds = 15;
            // make sure the helper scripts have execute permissions, or things break
            // by default, after install, the scripts do not have execute permissions
            Util.spawnCommandLine("chmod  744 " + this.toolsProcessor);
            Util.spawnCommandLine("chmod -R 744 " + this.toolsDir);
            Util.spawnCommandLine("rm -f " + this.stateFile);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._periodicProcessTools();
            Mainloop.timeout_add(2000, Lang.bind(this, this.setupDynamicMenu, this.toolsFile));
        };

        let scriptDir = Gio.file_new_for_path(this.toolsFile);
        if (!scriptDir.query_exists(null)) {
            let cmd = 'bash -c "' + 'cp -avrf ' + this.metadata.path + '/scripts/* ' + this.configFilePath + '"'
            Util.spawnCommandLine(cmd);
            Mainloop.timeout_add(2000, setupApplet);
        } else {
            setupApplet();
        }
    },

    on_applet_clicked: function(event) {
        this.setupDynamicMenu(this.toolsFile);
        this.menu.toggle();
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    _periodicProcessTools: function() {
        this._updateFrequencySeconds = Math.max(10, this._updateFrequencySeconds);
        this._processTools();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(this._updateFrequencySeconds, Lang.bind(this, this._periodicProcessTools));
    },

    _processTools: function() {
        Util.spawnCommandLine(this.toolsProcessor + " " + "\"" +  this.configFilePath + "\"" + " " + this._updateFrequencySeconds);
    },

    setupDynamicMenu: function(f) {

            this.menu.removeAll();
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            tools = eval(Cinnamon.get_file_contents_utf8_sync(f));

            for (let i = 0; i < tools.length; i++) {
                let tool = tools[i];
                let toolName = tool[0].trim(' ');

                if (toolName == "-") {
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
                else if (toolName[0] == "!") {
                    toolName = toolName.substr(1);
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem(toolName, { reactive: false }));
                }
                else {
                    this.menu.addAction(_(toolName), function(event) {
                        let toolCmd =  tool[1].trim(' ');
                        Util.spawnCommandLine(toolCmd);
                    })
                }
            }

    },



};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}

