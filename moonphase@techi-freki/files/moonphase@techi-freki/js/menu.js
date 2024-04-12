const PopupMenu = imports.ui.popupMenu;
const { MoonTimes } = require('./js/ui/moonTimes');

class Menu {
    constructor(applet) {
        this.applet = applet;
        this.applet.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.applet.menuManager.addMenu(this.applet.menu);
    }

    buildMenu(heading, menuItems) {
        // TODO: need to format this to look more like the weather applet (icons, styling, etc)
        const moonTimes = new MoonTimes(this.applet);
        this.applet.menu.addActor(moonTimes.actor);
    }
}