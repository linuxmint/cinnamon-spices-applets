"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfig = void 0;
const { AppletSettings } = imports.ui.settings;
const createConfig = (args) => {
    const { uuid, instanceId, onIconChanged, onIconColorChanged, onChannelOnPanelChanged, onMyStationsChanged, } = args;
    const settingsObject = {
        get initialVolume() { return getInitialVolume(); }
    };
    const appletSettings = new AppletSettings(settingsObject, uuid, instanceId);
    appletSettings.bind('icon-type', 'iconType', (iconType) => onIconChanged(iconType));
    appletSettings.bind('color-on', 'symbolicIconColorWhenPlaying', (newColor) => onIconColorChanged(newColor));
    appletSettings.bind('channel-on-panel', 'channelNameOnPanel', (channelOnPanel) => onChannelOnPanelChanged(channelOnPanel));
    appletSettings.bind('keep-volume-between-sessions', "keepVolume");
    appletSettings.bind('initial-volume', 'customInitVolume');
    appletSettings.bind('last-volume', 'lastVolume');
    appletSettings.bind('tree', "userStations", onMyStationsChanged);
    appletSettings.bind('last-url', 'lastUrl');
    appletSettings.bind('music-download-dir-select', 'musicDownloadDir', () => handleMusicDirChanged());
    function getInitialVolume() {
        const { keepVolume, lastVolume, customInitVolume } = settingsObject;
        const initialVolume = keepVolume ? lastVolume : customInitVolume;
        return initialVolume;
    }
    function handleMusicDirChanged() {
        if (settingsObject.musicDownloadDir === null) {
            settingsObject.musicDownloadDir = "~/Music/Radio";
        }
    }
    return settingsObject;
};
exports.createConfig = createConfig;
