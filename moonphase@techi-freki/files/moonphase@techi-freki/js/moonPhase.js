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
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instance_id);
        this.orientation = orientation;
        this.config = new Config(this);
        this.config.bindSettings();
        this.moon = new Moon(this);

        this.updateApplet();
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }
        this.settings.finalize();
    }

    on_applet_clicked() {
        if (!this.enablePopup) return;
        if (!this.showCurrentPhaseInfo && !this.showRiseSet) return;

        if (this.popupOpen) {
            this.menu.toggle();
            this.popupOpen = false;
        } else {
            this.menuManager = new PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menuManager.addMenu(this.menu);
            this.buildPopupMenu();
            this.menu.toggle();
            this.popupOpen = true;
        }
    }

    buildPopupMenu() {
        const menu = new Menu(this);
        menu.buildMenu();
    }

    updateApplet() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }

        this.moon = new Moon(this);
        const phaseLabel = this._createPhaseLabel(this.showNameLabel, this.showPercentageLabel);
        const phaseTooltip = this._createPhaseTooltip(this.showPhaseTooltip, this.showPercentageTooltip);
        this.set_applet_icon_symbolic_name(this.moon.currentPhaseIcon);

        if (this.showTooltip) {
            this.set_applet_tooltip(phaseTooltip);
        } else {
            this.set_applet_tooltip('');
        }

        if (this.showPhaseLabel) {
            this.set_applet_label(phaseLabel);
        } else {
            this.set_applet_label('');
        }

        this.updateLoopId = Mainloop.timeout_add((this.updateInterval * 1000), Lang.bind(this, this.updateApplet));
    }

    _createPhaseLabel(showNameLabel, showPercentageLabel) {
        return this._createAppletDisplay(showNameLabel, showPercentageLabel);
    }

    _createPhaseTooltip(showPhaseTooltip, showPercentageTooltip) {
        return this._createAppletDisplay(showPhaseTooltip, showPercentageTooltip);
    }

    _createAppletDisplay(showName, showPercentage) {
        const percent = Math.floor(this.moon.illumination.fraction * 100 * 100) / 100;
        if (showName && showPercentage) return `${ this.moon.currentPhaseName } (${ percent }%)`;
        if (showName) return `${ this.moon.currentPhaseName }`;
        if (showPercentage) return `${ percent }%`;
        return this.metadata.name;
    }
}