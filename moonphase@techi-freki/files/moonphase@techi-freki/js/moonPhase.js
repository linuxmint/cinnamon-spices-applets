const Applet = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const { Moon } = require('./js/moon');
const { Menu } = require('./js/menu');
const { Config } = require('./js/config');

class MoonPhase extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // setting defaults
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.orientation = orientation;
        this.config = new Config(this);
        this.config.bindSettings();
        this.moon = new Moon(this);
        this.menuManager = new PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this.buildPopupMenu();
        this.updateApplet();
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }
        this.settings.finalize();
    }

    on_applet_clicked() {
        // TODO: rebuild menu when called to refresh the data on click
        // BoxLayout.kill_all_children();
        if (this.showRiseSet)
            this.menu.toggle();
    }

    buildPopupMenu() {
        const menu = new Menu(this);
        menu.buildMenu();
    }

    updateApplet() {
        this.moon = new Moon(this);

        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }

        this.set_applet_icon_symbolic_name(this.moon.currentPhaseIcon);

        if (this.showTooltip) {
            this.set_applet_tooltip(this.moon.currentTooltip);
        } else {
            this.set_applet_tooltip('');
        }

        if (this.showPhaseLabel) {
            this.set_applet_label(this.moon.currentPhaseName);
        } else {
            this.set_applet_label('');
        }

        this.updateLoopId = Mainloop.timeout_add((this.updateInterval * 1000), Lang.bind(this, this.updateApplet));
    }
}
