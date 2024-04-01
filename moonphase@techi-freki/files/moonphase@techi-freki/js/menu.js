const PopupMenu = imports.ui.popupMenu;

class Menu {
    constructor(applet) {
        this.applet = applet;
        this.applet.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.applet.menuManager.addMenu(this.applet.menu);
    }

    buildMenu(heading, menuItems) {
        // TODO: need to format this to look more like the weather applet (icons, styling, etc)
        this.applet.menu.addMenuItem(new PopupMenu.PopupMenuItem(`${heading} v${this.applet.metadata.version}`, { reactive: false }));

        menuItems.forEach((menuItem) => {
            const item = new PopupMenu.PopupMenuItem(`${menuItem.title}: ${menuItem.value}`, { reactive: menuItem.reactive || false });

            this.applet.menu.addMenuItem(item);
        });
    }
}