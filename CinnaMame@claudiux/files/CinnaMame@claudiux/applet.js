//!/usr/bin/cjs
/**
 *
 *    _____ _                   __  __
 *   / ____(_)                 |  \/  |
 *  | |     _ _ __  _ __   __ _| \  / | __ _ _ __ ___   ___
 *  | |    | | '_ \| '_ \ / _` | |\/| |/ _` | '_ ` _ \ / _ \
 *  | |____| | | | | | | | (_| | |  | | (_| | | | | | |  __/
 *   \_____|_|_| |_|_| |_|\__,_|_|  |_|\__,_|_| |_| |_|\___|
 *
*/
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const UUID = 'CinnaMame@claudiux';
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const PATH2SCRIPTS = APPLET_DIR + "/scripts";
const MAME_ROMS = HOME_DIR + "/mame/roms/";
//~ const PUCKMAN_ROM = HOME_DIR + "/mame/roms/puckman.zip";
//~ const PUCKMAN_CFG = HOME_DIR + ".mame/cfg/puckman.cfg";

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

var TIP1 = _("Once you've downloaded your roms from your library,\nyou need to copy them to the local folder named here\n‘Local Mame Roms’.\n\nThen go to the ‘Games to show’ tab.");
var TIP2 = _("Do not use [+]; use the 'Refresh Games' button instead.\nDisable games you don't want in the menu.\nRemoving a line do not remove the game from the menu.\nYou can change Titles but not Ids.\nYou can change order to change that of the menu.");

class CinnaMame extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.instance_id = instance_id;

        this.settings = new AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("linkURL", "linkURL");
        this.settings.bind("gamesToShow", "gamesToShow");
        this.settings.bind("useSymbolicIcon", "useSymbolicIcon", () => this.setIcon());
        this.settings.setValue("linkTips", TIP1);
        this.settings.setValue("gamesTips", TIP2);

        this.setIcon();

        Util.spawnCommandLineAsync("bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));
        Util.spawnCommandLineAsync("bash -C '%s/ensure_mame.sh'".format(PATH2SCRIPTS));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.makeMenu();
    }

    setIcon() {
        if (this.useSymbolicIcon)
            this.set_applet_icon_symbolic_name("CinnaMame");
        else
            this.set_applet_icon_name("CinnaMame");
    }

    makeMenu() {
        this.menu.removeAll();

        if (this._mame === null) {
            let mameItem = this.menu.addAction(_("Install mame"), () => {
                Util.spawnCommandLineAsync("bash -C '%s/install_mame.sh'".format(PATH2SCRIPTS));
            });
        } else {
            var games = {};
            var gameIds = [];
            for (let g of this.gamesToShow) {
                let g_id = g.id;
                if (g_id.length > 0) {
                    gameIds.push(g_id);
                    games[g_id] = {"title": g.title, "enabled": g.enabled};
                }
            }
            let dir = Gio.file_new_for_path(HOME_DIR + "/mame/roms");
            let dir_children = dir.enumerate_children("standard::name,standard::type,standard::icon,time::modified", Gio.FileQueryInfoFlags.NONE, null);
            let file = dir_children.next_file(null);
            var actions = []
            while (file != null) {
                let name = file.get_name();
                if (name.endsWith(".zip")) {
                    let shortname = name.slice(0, -4);
                    if (games[shortname] != null) {
                        if (games[shortname]["enabled"]) {
                            actions.push([shortname, games[shortname]["title"], `/usr/games/mame ${name}`]);
                        }
                    } else {
                        actions.push([shortname, shortname, `/usr/games/mame ${name}`]);
                    }
                }
                file = dir_children.next_file(null);
            }
            dir_children.close(null);
            actions.sort( (a, b) => {return gameIds.indexOf(a[0]) > gameIds.indexOf(b[0])});
            for (let action of actions)
                this.menu.addAction(action[1], () => {  Util.spawnCommandLineAsync(action[2]); });

        }
    }

    on_applet_clicked() {
        this.makeMenu();
        let children = this.menu._getMenuItems();
        if (children.length > 0)
            this.menu.toggle();
        else
            Util.spawnCommandLineAsync("/usr/games/mame puckman.zip");
    }

    openRomLibrary() {
        if (!this.linkURL.startsWith("http")) return;
        Util.spawnCommandLineAsync("xdg-open " + this.linkURL);
    }

    resetRomLibrary() {
        this.linkURL = "https://www.planetemu.net/";
    }

    openLocalMameRoms() {
        //~ if (!this.linkURL.startsWith("http")) return;
        Util.spawnCommandLineAsync("xdg-open " + MAME_ROMS);
    }

    refreshGames() {
        var games = this.gamesToShow;
        var gameIds = [];
        for (let g of games)
            gameIds.push(g.id);
        let dir = Gio.file_new_for_path(HOME_DIR + "/mame/roms");
        let dir_children = dir.enumerate_children("standard::name,standard::type,standard::icon,time::modified", Gio.FileQueryInfoFlags.NONE, null);
        let file = dir_children.next_file(null);
        while (file != null) {
            let name = file.get_name();
            if (name.endsWith(".zip")) {
                let shortname = name.slice(0, -4);
                if (gameIds.indexOf(shortname) < 0) {
                    global.log("shortname: " + shortname);
                    games.push({"enabled": true, "id": shortname, "title": shortname});
                    gameIds.push(shortname);
                }
            }
            file = dir_children.next_file(null);
        }
        dir_children.close(null);
        this.gamesToShow = games;
    }

    get _mame() {
        return GLib.find_program_in_path("mame");
    }

    get isHorizontal() {
        return !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnaMame(metadata, orientation, panel_height, instance_id);
}
