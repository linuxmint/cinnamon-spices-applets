const Applet = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const { Moon } = require('./js/moon');
const { Menu } = require('./js/menu');
const { Translator } = require('./js/translator');

class MoonPhase extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // setting defaults
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.orientation = orientation;
        this.menuManager = new PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);

        this.menuManager.addMenu(this.menu);

        this.settings.bind('useAltIcons', 'useAltIcons', this._onSettingsChanged.bind(this));
        this.settings.bind('showTooltip', 'showTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showNameTooltip', 'showNameTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showPercentageTooltip', 'showPercentageTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showPhaseLabel', 'showPhaseLabel', this._onSettingsChanged.bind(this));
        this.settings.bind('showNameLabel', 'showNameLabel', this._onSettingsChanged.bind(this));
        this.settings.bind('showPercentageLabel', 'showPercentageLabel', this._onSettingsChanged.bind(this));

        this.settings.bind('enableGeolocation', 'enableGeolocation', this._onSettingsChanged.bind(this));
        this.settings.bind('latitude', 'latitude', this._onSettingsChanged.bind(this));
        this.settings.bind('longitude', 'longitude', this._onSettingsChanged.bind(this));
        this.settings.bind('showRiseSet', 'showRiseSet', this._onSettingsChanged.bind(this));

        this.settings.bind('updateInterval', 'updateInterval', this._onSettingsChanged.bind(this));

        this.moon = new Moon(this);

        this._buildPopupMenu();
        this._updateApplet();
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }
        this.settings.finalize();
    }

    on_applet_clicked() {
        if (this.showRiseSet)
            this.menu.toggle();
    }

    _onSettingsChanged(value) {
        this.useAltIcons = this.settings.getValue('useAltIcons');
        this.showTooltip = this.settings.getValue('showTooltip');
        this.showNameTooltip = this.settings.getValue('showNameTooltip');
        this.showPercentageTooltip = this.settings.getValue('showPercentageTooltip');
        this.showPhaseLabel = this.settings.getValue('showPhaseLabel');
        this.showNameLabel = this.settings.getValue('showNameLabel');
        this.showPercentageLabel = this.settings.getValue('showPercentageLabel');

        this.enableGeolocation = this.settings.getValue('enableGeolocation');
        this.latitude =  this.settings.getValue('latitude');
        this.longitude = this.settings.getValue('longitude');
        this.showRiseSet = this.settings.getValue('showRiseSet');

        this.updateInterval = this.settings.getValue('updateInterval');

        this.moon = new Moon(this);

        this._buildPopupMenu();
        this._updateApplet();
    }

    _buildPopupMenu() {
        const menu = new Menu(this);
        menu.testBoxLayout();

        // const menu = new Menu(this);
        // const translator = new Translator(this.metadata.uuid);
        // // TODO: add functions, events, and styling
        // menu.buildMenu(translator.translate('Moon Phase'), [
        //     {
        //         label: translator.translate('Rise'),
        //         value: this.moon.riseSetTimes.rise,
        //         icon: 'moonrise-symbolic',
        //         cssClass: null
        //     },
        //     {
        //         label: translator.translate('Transit'),
        //         value: this.moon.riseSetTimes.transit,
        //         icon: 'night-clear-symbolic',
        //         cssClass: null
        //     },
        //     {
        //         label: translator.translate('Set'),
        //         value: this.moon.riseSetTimes.set,
        //         icon: 'moonset-symbolic',
        //         cssClass: null
        //     }
        // ]);
    }

    _updateApplet() {
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

        this.updateLoopId = Mainloop.timeout_add((this.updateInterval * 1000), Lang.bind(this, this._updateApplet));
    }
}
