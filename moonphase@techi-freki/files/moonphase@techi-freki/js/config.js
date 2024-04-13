const { Moon } = require('./js/moon');

class Config {
    constructor(app) {
        this.app = app;
    }

    bindSettings() {
        this.app.settings.bind('useAltIcons', 'useAltIcons', this.updateSettings.bind(this.app));
        this.app.settings.bind('showTooltip', 'showTooltip', this.updateSettings.bind(this.app));
        this.app.settings.bind('showNameTooltip', 'showNameTooltip', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPercentageTooltip', 'showPercentageTooltip', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPhaseLabel', 'showPhaseLabel', this.updateSettings.bind(this.app));
        this.app.settings.bind('showNameLabel', 'showNameLabel', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPercentageLabel', 'showPercentageLabel', this.updateSettings.bind(this.app));

        this.app.settings.bind('enableGeolocation', 'enableGeolocation', this.updateSettings.bind(this.app));
        this.app.settings.bind('latitude', 'latitude', this.updateSettings.bind(this.app));
        this.app.settings.bind('longitude', 'longitude', this.updateSettings.bind(this.app));
        this.app.settings.bind('showRiseSet', 'showRiseSet', this.updateSettings.bind(this.app));

        this.app.settings.bind('updateInterval', 'updateInterval', this.updateSettings.bind(this.app));
    }

    updateSettings() {
        this.app.useAltIcons = this.app.settings.getValue('useAltIcons');
        this.app.showTooltip = this.settings.getValue('showTooltip');
        this.app.showNameTooltip = this.settings.getValue('showNameTooltip');
        this.app.showPercentageTooltip = this.settings.getValue('showPercentageTooltip');
        this.app.showPhaseLabel = this.settings.getValue('showPhaseLabel');
        this.app.showNameLabel = this.settings.getValue('showNameLabel');
        this.app.showPercentageLabel = this.settings.getValue('showPercentageLabel');

        this.app.enableGeolocation = this.settings.getValue('enableGeolocation');
        this.app.latitude =  this.settings.getValue('latitude');
        this.app.longitude = this.settings.getValue('longitude');
        this.app.showRiseSet = this.settings.getValue('showRiseSet');

        this.app.updateInterval = this.settings.getValue('updateInterval');

        this.app.buildPopupMenu();
        this.app.updateApplet();
    }
}