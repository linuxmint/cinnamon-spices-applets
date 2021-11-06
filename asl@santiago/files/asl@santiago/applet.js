const Applet = imports.ui.applet;
const Util = imports.misc.util;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const website = "https://www.handspeak.com/";

// l10n/translation support
const UUID = "asl@santiago";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}
//****************************************************************************

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

            //Submenu 1: Alphabet ASL
            //***********************************************************************************************
            this.AbecedarioASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Alphabet"));

            //Item 1 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " A", () => {
            Main.notify("A - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2460'], null);
            });

            //Item 2 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " B", () => {
            Main.notify("B - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2461'], null);
            });

            //Item 3 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " C", () => {
            Main.notify("C - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2462'], null);
            });

            //Item 4 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " D", () => {
            Main.notify("D - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2463'], null);
            });

            //Item 5 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " E", () => {
            Main.notify("E - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2464'], null);
            });

            //Item 6 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " F", () => {
            Main.notify("F - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2465'], null);
            });

            //Item 7 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " G", () => {
            Main.notify("G - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2466'], null);
            });

            //Item 8 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " H", () => {
            Main.notify("H - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2467'], null);
            });

            //Item 9 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " I", () => {
            Main.notify("I - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2468'], null);
            });

            //Item 10 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " J", () => {
            Main.notify("J - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2469'], null);
            });

            //Item 11 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " K", () => {
            Main.notify("K - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2470'], null);
            });

            //Item 12 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " L", () => {
            Main.notify("L - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2471'], null);
            });

            //Item 13 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " M", () => {
            Main.notify("M - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2472'], null);
            });

            //Item 14 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " N", () => {
            Main.notify("N - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2473'], null);
            });

            //Item 15 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " O", () => {
            Main.notify("O - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2474'], null);
            });

            //Item 16 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " P", () => {
            Main.notify("P - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2475'], null);
            });

            //Item 17 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " Q", () => {
            Main.notify("Q - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2476'], null);
            });

            //Item 18 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " R", () => {
            Main.notify("R - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2477'], null);
            });

            //Item 19 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " S", () => {
            Main.notify("S - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2478'], null);
            });

            //Item 20 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " T", () => {
            Main.notify("T - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2479'], null);
            });

            //Item 21 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " U", () => {
            Main.notify("U - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2480'], null);
            });

            //Item 22 Submenu 11
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " V", () => {
            Main.notify("V - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2481'], null);
            });

            //Item 23 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " W", () => {
            Main.notify("W - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2482'], null);
            });

            //Item 24 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " X", () => {
            Main.notify("X - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2483'], null);
            });

            //Item 25 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " Y", () => {
            Main.notify("Y - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2484'], null);
            });

            //Item 26 Submenu 1
            this.AbecedarioASLItem.menu.addAction(_("Letter") + " Z", () => {
            Main.notify("Z - " + _("ASL"));
            Util.spawn_async(["xdg-open", website + 'word/search/index.php?id=2485'], null);
            });

            this.menu.addMenuItem(this.AbecedarioASLItem); //Add the menu with the items created
            //***********************************************************************************************

            /*//Submenú 2: Números cardinales en ASL
            //***********************************************************************************************
            this.NumCardinalesASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Números cardinales"));

            //Item 1 Submenu 2
            this.NumCardinalesASLItem.menu.addAction("Número 1", () => {
            Main.notify("Title", "Número 1 en ASL");
            });

            //Item 2 Submenu 2
            this.NumCardinalesASLItem.menu.addAction("Número 2", () => {
            Main.notify("Title", "Número 2 en ASL");
            });

            //Item 3 Submenu 2
            this.NumCardinalesASLItem.menu.addAction("Número 3", () => {
            Main.notify("Title", "Número 3 en ASL");
            });


            this.menu.addMenuItem(this.NumCardinalesASLItem); //Add the menu with the items created
            //************************************************************************************************/

            /*//Submenú 3: Números ordinales en ASL
            //***********************************************************************************************
            this.NumOrdinalesASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Números ordinales"));

            //Item 1 Submenu 3
            this.NumOrdinalesASLItem.menu.addAction("Número 1", () => {
            Main.notify("Title", "Número 1 en ASL");
            });

            //Item 2 Submenu 3
            this.NumOrdinalesASLItem.menu.addAction("Número 2", () => {
            Main.notify("Title", "Número 2 en ASL");
            });

            //Item 3 Submenu 3
            this.NumOrdinalesASLItem.menu.addAction("Número 3", () => {
            Main.notify("Title", "Número 3 en ASL");
            });


            this.menu.addMenuItem(this.NumOrdinalesASLItem); //Add the menu with the items created
            //************************************************************************************************/

            /*//Submenú 4: Vestimenta en ASL
            //***********************************************************************************************
            this.VestimentaASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Vestimenta"));
            //this.

            //Item 1 Submenu 3
            this.VestimentaASLItem.menu.addAction("Camisa", () => {
            Main.notify("Title", "Número 1 en ASL");
            });

            //Item 2 Submenu 3
            this.VestimentaASLItem.menu.addAction("Blusa", () => {
            Main.notify("Title", "Número 2 en ASL");
            });

            //Item 3 Submenu 3
            this.VestimentaASLItem.menu.addAction("Pantalón", () => {
            Main.notify("Title", "Número 3 en ASL");
            });


            this.menu.addMenuItem(this.VestimentaASLItem); //Add the menu with the items created
            //************************************************************************************************/

            /*//Submenú 5: Otro menu en ASL
            //***********************************************************************************************
            this.Vestimenta1ASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Otro menu"));

            this.menu.addMenuItem(this.Vestimenta1ASLItem); //Add the menu with the items created*/
            //********************************************************************************************

            /*//Submenú Nth: Miscelánea; palabras que no tengan categoría definida, mas de una categoría
            //o que se manejen de manera diferente
            //***********************************************************************************************
            this.RandomASLItem = new PopupMenu.PopupSubMenuMenuItem(_("Miscelánea"));


            this.RandomASLItem.menu.addAction("Camisa", () => {
            Main.notify("Title", "Número 1 en ASL");
            });

            this.RandomASLItem.menu.addAction("Blusa", () => {
            Main.notify("Title", "Número 2 en ASL");
            });

            this.RandomASLItem.menu.addAction("Pantalón", () => {
            Main.notify("Title", "Número 3 en ASL");
            });


            this.menu.addMenuItem(this.RandomASLItem); //Add the menu with the items created
            //************************************************************************************************/

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            //Access this website to check more vocabulary
            let websiteASL = new PopupMenu.PopupIconMenuItem(
                _("Check more vocabulary"),
                "starred",
                St.IconType.SYMBOLIC
                );

            websiteASL.connect("activate", () => {
                Util.spawn_async(["xdg-open", website], null);
            });

            this.menu.addMenuItem(websiteASL);

            //Switcher test
            //let editMode = global.settings.get_boolean("panel-edit-mode");
            //let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel Edit Mode"), editMode);
            /*panelEditMode.connect('toggled', function(item) {
                global.settings.set_boolean("panel-edit-mode", item.state);
            }); //*/
            //this.menu.addMenuItem(panelEditMode);
            /*global.settings.connect('changed::panel-edit-mode', function() {
                panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));
            });*/




    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
