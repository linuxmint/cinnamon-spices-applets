const Applet = imports.ui.applet;
const Util = imports.misc.util;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

const website = "https://www.handspeak.com/";

function MyApplet() {
    this._init.apply(this, arguments);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

        try {
            this.set_applet_icon_path(metadata.path + "/icon.png");
            this.set_applet_tooltip(_("American Sign Language"));

            //Initializing options on the Popup menu
            //********************************************************
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection)
            //********************************************************

            //This function creates the options to show on the applet
            this.populate_menu();
        } catch (e) {
            global.logError(e);
        }

    },

    populate_menu: function() {

            //Submenú 1: Abecedario ASL
            //***********************************************************************************************
            this.AbecedarioASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Abecedario"));

            //Item 1 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra A"), () => {
            //Main.notify(_("A - ASL", "Letra A en ASL"));
            Main.notify(_("A - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2460'], null);
            });

            //Item 2 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra B"), () => {
            Main.notify(_("B - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2461'], null);
            });

            //Item 3 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra C"), () => {
            Main.notify(_("C - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2462'], null);
            });

            //Item 4 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra D"), () => {
            Main.notify(_("D - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2463'], null);
            });

            //Item 5 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra E"), () => {
            Main.notify(_("E - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2464'], null);
            });

            //Item 6 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra F"), () => {
            Main.notify(_("F - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2465'], null);
            });

            //Item 7 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra G"), () => {
            Main.notify(_("G - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2466'], null);
            });

            //Item 8 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra H"), () => {
            Main.notify(_("H - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2467'], null);
            });

            //Item 9 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra I"), () => {
            Main.notify(_("I - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2468'], null);
            });

            //Item 10 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra J"), () => {
            Main.notify(_("J - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2469'], null);
            });

            //Item 11 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra K"), () => {
            Main.notify(_("K - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2470'], null);
            });

            //Item 12 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra L"), () => {
            Main.notify(_("L - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2471'], null);
            });

            //Item 13 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra M"), () => {
            Main.notify(_("M - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2472'], null);
            });

            //Item 14 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra N"), () => {
            Main.notify(_("N - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2473'], null);
            });

            //Item 15 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra O"), () => {
            Main.notify(_("O - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2474'], null);
            });

            //Item 16 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra P"), () => {
            Main.notify(_("P - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2475'], null);
            });

            //Item 17 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra Q"), () => {
            Main.notify(_("Q - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2476'], null);
            });

            //Item 18 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra R"), () => {
            Main.notify(_("R - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2477'], null);
            });

            //Item 19 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra S"), () => {
            Main.notify(_("S - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2478'], null);
            });

            //Item 20 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra T"), () => {
            Main.notify(_("T - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2479'], null);
            });

            //Item 21 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra U"), () => {
            Main.notify(_("U - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2480'], null);
            });

            //Item 22 Submenu 11
            this.AbecedarioASLItem.menu.addAction(_("Letra V"), () => {
            Main.notify(_("V - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2481'], null);
            });

            //Item 23 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra W"), () => {
            Main.notify(_("W - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2482'], null);
            });

            //Item 24 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra X"), () => {
            Main.notify(_("X - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2483'], null);
            });

            //Item 25 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra Y"), () => {
            Main.notify(_("Y - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2484'], null);
            });

            //Item 26 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letra Z"), () => {
            Main.notify(_("Z - ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2485'], null);
            });

            this.menu.addMenuItem(this.AbecedarioASLItem); //Add the menu with the items created
            //***********************************************************************************************

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            //Access this website to check more vocabulary
            let websiteASL = new PopupMenu.PopupIconMenuItem(
                "Check more vocabulary",
                "starred",
                St.IconType.SYMBOLIC
                );

            websiteASL.connect("activate", () => {
                Util.spawn_async(["xdg-open", website], null);
            });

            this.menu.addMenuItem(websiteASL);

    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
