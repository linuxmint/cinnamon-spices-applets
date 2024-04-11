const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const { MoonTimesUi } = require('./js/ui/moonTimesUi');

class Menu {
    constructor(applet) {
        this.applet = applet;
        this.applet.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.applet.menuManager.addMenu(this.applet.menu);
    }

    buildClutterMenu(heading, menuItems) {
        this.applet.menu.removeAll();
        const layout = new Clutter.GridLayout();
        const headerLabel = `${heading} v${this.applet.metadata.version}`;
        layout.insert_row(5);

        const header = new St.Label();
        header.set_text(headerLabel);
        layout.attach(header, 1, 1, 3, 1);

        this.applet.menu.addMenuItem(layout);
    }

    testBoxLayout() {
        const moonTimesUi = new MoonTimesUi(this.applet);
        this.applet.menu.addActor(moonTimesUi.create());
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

class Icon extends St.Icon {
    constructor(iconName, iconSize) {
        super();
        this.set_icon_name(iconName);
        this.set_icon_size(iconSize);
    }
}