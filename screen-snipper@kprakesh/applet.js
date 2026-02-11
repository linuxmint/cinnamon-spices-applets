const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // Initialize default value to prevent "undefined" in menu before settings load
        this.delaySeconds = 0;

        // Bind settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        
        // Correctly bind the callback using .bind(this)
        this.settings.bindProperty(Settings.BindingDirection.IN, 
            "delay-seconds", 
            "delaySeconds", 
            this.on_settings_changed.bind(this), 
            null
        );

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_tooltip("Screen Snipper");

        // Use the system icon name (as discussed previously)
        this.set_applet_icon_symbolic_name("edit-cut-symbolic");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();
    }

    on_settings_changed() {
        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        // 1. Capture Area Item
        let itemClipboard = new PopupMenu.PopupMenuItem("Capture Area");
        // Use Arrow Function instead of Lang.bind
        itemClipboard.connect('activate', () => this._snipToClipboard());
        this.menu.addMenuItem(itemClipboard);

        // 2. Delayed Capture Item
        let delayText = `Delayed Capture (${this.delaySeconds}s)`;
        let itemDelayed = new PopupMenu.PopupMenuItem(delayText);
        itemDelayed.connect('activate', () => this._fullScreenDelayed());
        this.menu.addMenuItem(itemDelayed);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _snipToClipboard() {
        // -a: area, -c: clipboard
        Util.spawnCommandLine("gnome-screenshot -a -c");
    }

    _fullScreenDelayed() {
        // -c: clipboard, -d: delay
        Util.spawnCommandLine(`gnome-screenshot -c -d ${this.delaySeconds}`);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}