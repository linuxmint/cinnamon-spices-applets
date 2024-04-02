const PopupMenu = imports.ui.popupMenu;

class Menu {
    constructor(applet) {
        this.applet = applet;
        this.applet.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.applet.menuManager.addMenu(this.applet.menu);
    }

    buildMenu(heading, menuItems) {
        // TODO: need to format this to look more like the weather applet (icons, styling, etc)

        // kill before updating to prevent multiple menu items being added when settings are changed
        this.applet.menu.removeAll();
        const header = new PopupMenu.PopupMenuItem(`${heading} v${this.applet.metadata.version}`, { reactive: false });
        this.applet.menu.addMenuItem(header);
        let item = null;

        menuItems.forEach((menuItem) => {
            if (!menuItem.icon) {
                item = new PopupMenu.PopupMenuItem(`${menuItem.label}\n${menuItem.value.toLocaleDateString()} ${menuItem.value.toLocaleTimeString()}`, { reactive: menuItem.reactive || false });
            } else {
                const iconLabel = new PopupMenu.PopupImageMenuItem(menuItem.label, menuItem.icon, { reactive: menuItem.reactive || false });
                this.applet.menu.addMenuItem(iconLabel);

                item = new PopupMenu.PopupMenuItem(`${menuItem.value.toLocaleDateString()} ${menuItem.value.toLocaleTimeString()}`, { reactive: menuItem.reactive || false });
            }

            this.applet.menu.addMenuItem(item);
        });
    }
}