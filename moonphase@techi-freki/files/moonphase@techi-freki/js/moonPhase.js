const Applet = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const { Moon } = require('./js/moon');
const { Menu } = require('./js/menu');
const { Config } = require('./js/config');
const { CurrentPhaseUi } = require('./js/ui/currentPhaseUi');
const { RiseSetUi } = require('./js/ui/riseSetUi');

class MoonPhase extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // setting defaults
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instance_id);
        this.orientation = orientation;
        this.config = new Config(this);
        this.config.bindSettings();
        this.menuManager = new PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this.moon = new Moon(this);

        this.buildPopupMenu();
        this.updateApplet();
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }
        this.settings.finalize();
    }

    on_applet_load() {
        if (!this.updateLoopId) {
            this.currentPhaseUi = new CurrentPhaseUi(this);
            this.riseSetUi = new RiseSetUi(this);

            this.currentPhaseUi.create();
            this.riseSetUi.create();
        }
    }

    on_applet_clicked() {
        if (this.showRiseSet) {
            this.menu.toggle();
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
        const phaseLabel = this._createPhaseLabel(this.showPhaseLabel, this.showPercentageLabel);
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

    _createPhaseLabel(showPhaseLabel, showPercentageLabel) {
        const percent  = Math.floor(this.moon.illumination.fraction * 100 * 100) / 100;
        if (showPhaseLabel && showPercentageLabel) return `${ this.moon.currentPhaseName } (${ percent }%)`;
        if (showPhaseLabel) return `${ this.moon.currentPhaseName }`;
        if (showPercentageLabel) return `${ percent }%`
        return 'Moon Phase';
    }

    _createPhaseTooltip(showPhaseTooltip, showPercentageTooltip) {
        const percent = Math.floor(this.moon.illumination.fraction * 100 * 100) / 100;
        if (showPhaseTooltip && showPercentageTooltip) return `${ this.moon.currentPhaseName } (${ percent }%)`;
        if (showPhaseTooltip) return `${ this.moon.currentPhaseName }`;
        if (showPercentageTooltip) return `${ percent }%`;
        return 'Moon Phase';
    }
}