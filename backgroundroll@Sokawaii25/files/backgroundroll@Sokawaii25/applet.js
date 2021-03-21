const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const AppletDirectory = imports.ui.appletManager.appletMeta["backgroundroll@Sokawaii25"].path;

class BackgroundRoll extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        //VARIABLES
        this.command=AppletDirectory + "/background";

        //Applet Decoration
        try {
            this.set_applet_icon_path(AppletDirectory + "/icons/icon.svg");
            this.set_applet_tooltip("Click to change the background");
        }
        catch (e) {
            global.logError(e);
        };

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.drawMenu();
        } catch (e) {
            global.logError(e);
        };

        //Applet Settings
        this.settings = new Settings.AppletSettings(this, "backgroundroll@Sokawaii25", instanceId);
        this.settings.bind("Notifications", "notifs", this.on_notifs_changed);
    }

    drawMenu() {
        let roll = new PopupMenu.PopupImageMenuItem("Roll", "insert-image");
        roll.connect('activate', Lang.bind(this, function() {
                Util.spawnCommandLine(this.command + " roll");
                if (this.notifs) {
                    Util.spawnCommandLine("notify-send \"Background Roll\" \"Background changed\"");
                }
            }));
        this.menu.addMenuItem(roll);

        let previous = new PopupMenu.PopupImageMenuItem("Roll Back", "document-revert-symbolic.symbolic");
        previous.connect('activate', Lang.bind(this, function() {
                Util.spawnCommandLine(this.command + " previous");
                if (this.notifs) {
                    Util.spawnCommandLine("notify-send \"Background Roll\" \"Background retrieved\"");
                }
            }));
        this.menu.addMenuItem(previous);
    }

    on_notifs_changed() {
        if (this.notifs) {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Notifications activated\"");
        } else {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Notifications deactivated\"");
        }
    }

    on_applet_clicked(event) {
        Util.spawnCommandLine(this.command + " roll");

        if (this.notifs) {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Background changed\"");
        }
    }

    on_applet_middle_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new BackgroundRoll(metadata, orientation, panel_height, instanceId);
}
