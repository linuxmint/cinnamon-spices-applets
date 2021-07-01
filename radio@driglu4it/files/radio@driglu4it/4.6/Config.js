"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfig = void 0;
const { AppletSettings } = imports.ui.settings;
const createConfig = (args) => {
    const { uuid, instanceId, onIconChanged, onIconColorPlayingChanged, onIconColorPausedChanged, onChannelOnPanelChanged, onMyStationsChanged, } = args;
    const settingsObject = {
        get initialVolume() { return getInitialVolume(); }
    };
    const appletSettings = new AppletSettings(settingsObject, uuid, instanceId);
    appletSettings.bind('icon-type', 'iconType', (iconType) => onIconChanged(iconType));
    appletSettings.bind('color-on', 'symbolicIconColorWhenPlaying', (newColor) => onIconColorPlayingChanged(newColor));
    appletSettings.bind('color-paused', 'symbolicIconColorWhenPaused', (newColor) => onIconColorPausedChanged(newColor));
    appletSettings.bind('channel-on-panel', 'channelNameOnPanel', (channelOnPanel) => onChannelOnPanelChanged(channelOnPanel));
    appletSettings.bind('keep-volume-between-sessions', "keepVolume");
    appletSettings.bind('initial-volume', 'customInitVolume');
    appletSettings.bind('last-volume', 'lastVolume');
    appletSettings.bind('tree', "userStations", onMyStationsChanged);
    appletSettings.bind('last-url', 'lastUrl');
    appletSettings.bind('music-download-dir-select', 'musicDownloadDir', () => handleMusicDirChanged());
    function getInitialVolume() {
        const { keepVolume, lastVolume, customInitVolume } = settingsObject;
        let initialVolume = keepVolume ? lastVolume : customInitVolume;
        if (initialVolume == null) {
            global.logWarning('initial Volume was null or undefined. Applying 50 as a fallback solution to prevent radio stop working');
            initialVolume = 50;
        }
        return initialVolume;
    }
    function handleMusicDirChanged() {
        if (settingsObject.musicDownloadDir === null) {
            settingsObject.musicDownloadDir = "~/Music/Radio";
        }
    }
    onIconChanged(settingsObject.iconType);
    onIconColorPlayingChanged(settingsObject.symbolicIconColorWhenPlaying);
    onIconColorPausedChanged(settingsObject.symbolicIconColorWhenPaused);
    onChannelOnPanelChanged(settingsObject.channelNameOnPanel);
    return settingsObject;
};
exports.createConfig = createConfig;
