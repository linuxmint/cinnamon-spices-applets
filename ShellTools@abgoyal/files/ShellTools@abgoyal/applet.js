
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const AppletMeta = imports.ui.appletManager.applets["ShellTools@abgoyal"];
const AppletDir = imports.ui.appletManager.appletMeta["ShellTools@abgoyal"].path;

const IconsFile = GLib.build_filenamev([AppletDir, 'tools_icon.svg']);
const ToolsFile = GLib.build_filenamev([AppletDir, 'tools.json']);
const ToolsProcessor = GLib.build_filenamev([AppletDir, 'processTools.sh']);
const ToolsDir = GLib.build_filenamev([AppletDir, 'tools']);
const StateFile = GLib.build_filenamev([AppletDir, 'state.sh']);


function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {

    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            this.set_applet_icon_path(IconsFile);   
            this.set_applet_tooltip(_("Shell Tools"));
            this._updateFrequencySeconds = 15;
            // make sure the helper scripts have execute permissions, or things break
            // by default, after install, the scripts do not have execute permissions
            Util.spawnCommandLine("chmod  744 " + ToolsProcessor);
            Util.spawnCommandLine("chmod -R 744 " + ToolsDir);
            Util.spawnCommandLine("rm -f " + StateFile);
    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);
        }
        catch (e) {
            global.logError(e);
        }

        this._periodicProcessTools();
        this.setupDynamicMenu(ToolsFile);

    },

    on_applet_clicked: function(event) {
        this.setupDynamicMenu(ToolsFile);
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
        Util.spawnCommandLine(ToolsProcessor + " " + "\"" +  AppletDir + "\"" + " " + this._updateFrequencySeconds);
    },

    setupDynamicMenu: function(f) {

            this.menu.removeAll();
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
 
            tools = eval(Cinnamon.get_file_contents_utf8_sync(f));

            for (let i = 0; i < tools.length; i++) {
                let tool = tools[i];
                toolName = tool[0].trim(' ');
               
                if (toolName == "-") {
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
                else if (toolName[0] == "!") {
                    toolName = toolName.substr(1);
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem(toolName, { reactive: false }));
                }
                else {
                    this.menu.addAction(_(toolName), function(event) {
                        toolCmd =  tool[1].trim(' ');
                        Util.spawnCommandLine(toolCmd);
                    })
                }
            }

    },


    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}

