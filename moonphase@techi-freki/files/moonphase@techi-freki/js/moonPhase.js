const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const { Moon } = require('./js/moon');

class MoonPhase extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // setting defaults
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.settings.bind('useAltIcons', 'useAltIcons', this._onSettingsChanged.bind(this));
        this.settings.bind('showTooltip', 'showTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showNameTooltip', 'showNameTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showPercentageTooltip', 'showPercentageTooltip', this._onSettingsChanged.bind(this));
        this.settings.bind('showPhaseLabel', 'showPhaseLabel', this._onSettingsChanged.bind(this));
        this.settings.bind('showNameLabel', 'showNameLabel', this._onSettingsChanged.bind(this));
        this.settings.bind('showPercentageLabel', 'showPercentageLabel', this._onSettingsChanged.bind(this));

        this.settings.bind('updateInterval', 'updateInterval', this._onSettingsChanged.bind(this));

        this._updateApplet();
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }
    }

    _onSettingsChanged(value) {
        this.useAltIcons = this.settings.getValue('useAltIcons');
        this.showTooltip = this.settings.getValue('showTooltip');
        this.showNameTooltip = this.settings.getValue('showNameTooltip');
        this.showPercentageTooltip = this.settings.getValue('showPercentageTooltip');
        this.showPhaseLabel = this.settings.getValue('showPhaseLabel');
        this.showNameLabel = this.settings.getValue('showNameLabel');
        this.showPercentageLabel = this.settings.getValue('showPercentageLabel');

        this.updateInterval = this.settings.getValue('updateInterval');

        this._updateApplet();
    }

    _updateApplet() {
        if (this.updateLoopId) {
            Mainloop.source_remove(this.updateLoopId);
        }

        const moon = new Moon(new Date(), this.useAltIcons, this.showNameLabel, this.showPercentageLabel, this.showNameTooltip, this.showPercentageTooltip);

        this.set_applet_icon_symbolic_name(moon.currentPhaseIcon);

        if (this.showTooltip) {
            this.set_applet_tooltip(moon.currentTooltip);
        } else {
            this.set_applet_tooltip('');
        }

        if (this.showPhaseLabel) {
            this.set_applet_label(moon.currentPhaseName);
        } else {
            this.set_applet_label('');
        }

        this.updateLoopId = Mainloop.timeout_add((this.updateInterval * 1000), Lang.bind(this, this._updateApplet));
    }
}
