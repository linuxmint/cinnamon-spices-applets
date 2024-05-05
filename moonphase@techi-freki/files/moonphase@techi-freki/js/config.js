const { Moon } = require('./js/moon');

class Config {
    constructor(app) {
        this.app = app;
    }

    bindSettings() {
        this.app.settings.bind('useAltIcons', 'useAltIcons', this.updateSettings.bind(this.app));

        this.app.settings.bind('showTooltip', 'showTooltip', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPhaseTooltip', 'showPhaseTooltip', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPercentageTooltip', 'showPercentageTooltip', this.updateSettings.bind(this.app));

        this.app.settings.bind('showPhaseLabel', 'showPhaseLabel', this.updateSettings.bind(this.app));
        this.app.settings.bind('showNameLabel', 'showNameLabel', this.updateSettings.bind(this.app));
        this.app.settings.bind('showPercentageLabel', 'showPercentageLabel', this.updateSettings.bind(this.app));

        this.app.settings.bind('enableGeolocation', 'enableGeolocation', this.updateSettings.bind(this.app));
        this.app.settings.bind('latitude', 'latitude', this.updateSettings.bind(this.app));
        this.app.settings.bind('longitude', 'longitude', this.updateSettings.bind(this.app));

        this.app.settings.bind('enablePopup', 'enablePopup', this.updateSettings.bind(this.app));
        this.app.settings.bind('showCurrentPhaseInfo', 'showCurrentPhaseInfo', this.updateSettings.bind(this.app));
        this.app.settings.bind('showRiseSet', 'showRiseSet', this.updateSettings.bind(this.app));

        this.app.settings.bind('updateInterval', 'updateInterval', this.updateSettings.bind(this.app));
    }

    updateSettings() {
        this.app.useAltIcons = this.app.settings.getValue('useAltIcons');

        this.app.showTooltip = this.app.settings.getValue('showTooltip');
        this.app.showPhaseTooltip = this.app.settings.getValue('showPhaseTooltip');
        this.app.showPercentageTooltip = this.app.settings.getValue('showPercentageTooltip');

        this.app.showPhaseLabel = this.app.settings.getValue('showPhaseLabel');
        this.app.showNameLabel = this.app.settings.getValue('showNameLabel');
        this.app.showPercentageLabel = this.app.settings.getValue('showPercentageLabel');

        this.app.enableGeolocation = this.app.settings.getValue('enableGeolocation');
        this.app.latitude =  this.app.settings.getValue('latitude');
        this.app.longitude = this.app.settings.getValue('longitude');

        this.app.enablePopup = this.app.settings.getValue('enablePopup');
        this.app.showCurrentPhaseInfo = this.app.settings.getValue('showCurrentPhaseInfo');
        this.app.showRiseSet = this.app.settings.getValue('showRiseSet');

        this.app.updateInterval = this.app.settings.getValue('updateInterval');

        this.app.buildPopupMenu();
        this.app.updateApplet();
    }
}