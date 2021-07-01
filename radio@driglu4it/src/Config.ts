import { Channel, IconType } from "types";

const { AppletSettings } = imports.ui.settings;

interface Arguments {
    uuid: string,
    instanceId: number,
    onIconChanged: (iconType: IconType) => void,
    onIconColorPlayingChanged: (color: string) => void,
    onIconColorPausedChanged: (color: string) => void,
    onChannelOnPanelChanged: (channelOnPanel: boolean) => void,
    onMyStationsChanged: (stations: Channel[]) => void,
}

export interface Settings {
    iconType: IconType,
    symbolicIconColorWhenPlaying: string,
    symbolicIconColorWhenPaused: string,
    channelNameOnPanel: boolean,
    customInitVolume: number,
    keepVolume: boolean,
    lastVolume: number,
    initialVolume: number,
    userStations: Channel[]
    lastUrl: string,
    musicDownloadDir: string
}

export const createConfig = (args: Arguments) => {

    const {
        uuid,
        instanceId,
        onIconChanged,
        onIconColorPlayingChanged,
        onIconColorPausedChanged,
        onChannelOnPanelChanged,
        onMyStationsChanged,
    } = args

    // all settings are saved to this object
    const settingsObject = {
        get initialVolume() { return getInitialVolume() }
    } as Settings

    const appletSettings = new AppletSettings(settingsObject, uuid, instanceId)

    appletSettings.bind('icon-type', 'iconType',
        (iconType: IconType) => onIconChanged(iconType))

    appletSettings.bind('color-on', 'symbolicIconColorWhenPlaying',
        (newColor: string) => onIconColorPlayingChanged(newColor))

    appletSettings.bind('color-paused', 'symbolicIconColorWhenPaused',
        (newColor: string) => onIconColorPausedChanged(newColor))

    appletSettings.bind('channel-on-panel', 'channelNameOnPanel',
        (channelOnPanel: boolean) => onChannelOnPanelChanged(channelOnPanel))

    appletSettings.bind('keep-volume-between-sessions', "keepVolume")

    appletSettings.bind('initial-volume', 'customInitVolume')

    appletSettings.bind('last-volume', 'lastVolume')

    appletSettings.bind('tree', "userStations",
        onMyStationsChanged)

    appletSettings.bind('last-url', 'lastUrl')

    appletSettings.bind('music-download-dir-select', 'musicDownloadDir',
        () => handleMusicDirChanged())

    function getInitialVolume() {
        const {
            keepVolume,
            lastVolume,
            customInitVolume
        } = settingsObject

        let initialVolume = keepVolume ? lastVolume : customInitVolume

        if (initialVolume == null){
            global.logWarning('initial Volume was null or undefined. Applying 50 as a fallback solution to prevent radio stop working')
            initialVolume = 50
        }


        return initialVolume
    }

    function handleMusicDirChanged() {

        // By Default the value is set to ~/Music/Radio but when changing to another location and back again to the default value in the settings dialog, the music dir is set to null instead of the default value again. As workaround the music dir is set programmatically to default value again if value is set to null (and the settings dialog can't be opened anymore). 
        if (settingsObject.musicDownloadDir === null) {
            settingsObject.musicDownloadDir = "~/Music/Radio"
        }
    }


    onIconChanged(settingsObject.iconType)
    onIconColorPlayingChanged(settingsObject.symbolicIconColorWhenPlaying)
    onIconColorPausedChanged(settingsObject.symbolicIconColorWhenPaused)
    onChannelOnPanelChanged(settingsObject.channelNameOnPanel)

    // TODO also onMyStationChanged should be called (and removed as arg from  ChannelStore)

    return settingsObject

}