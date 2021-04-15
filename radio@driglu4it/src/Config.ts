import { Channel, IconType } from "types";

const { AppletSettings } = imports.ui.settings;

interface Arguments {
    uuid: string,
    instanceId: number,
    onIconChanged: { (iconType: IconType): void },
    onIconColorChanged: { (color: string): void },
    onChannelOnPanelChanged: { (channelOnPanel: boolean): void },
    onMyStationsChanged: { (stations: Channel[]): void },
}

export interface Settings {
    iconType: IconType,
    symbolicIconColorWhenPlaying: string,
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
        onIconColorChanged,
        onChannelOnPanelChanged,
        onMyStationsChanged,
    } = args

    // all settings are saved to this object
    const settingsObject = {
        get initialVolume() { return getInitialVolume() }
    } as Settings

    const appletSettings = new AppletSettings(settingsObject, uuid, instanceId)
    // TODO why does this not work (a function is printed)?
    //const { bind } = appletSettings
    // global.log(`bind: ${bind.toString()}`)

    appletSettings.bind('icon-type', 'iconType',
        (iconType: IconType) => onIconChanged(iconType))

    appletSettings.bind('color-on', 'symbolicIconColorWhenPlaying',
        (newColor: string) => onIconColorChanged(newColor))

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

    // TODO: add proxy to prevent unwanted access (e.g. it is not necessary to have acces to customInitVolume outside of this function)


    function getInitialVolume() {
        const {
            keepVolume,
            lastVolume,
            customInitVolume
        } = settingsObject

        const initialVolume = keepVolume ? lastVolume : customInitVolume
        return initialVolume
    }


    function handleMusicDirChanged() {
        // By Default the value is set to ~/Music/Radio but when changing to another location and back again to the default value in the settings dialog, the music dir is set to null instead of the default value again. As workaround the music dir is set programmatically to default value again if value is set to null (and the settings dialog can't be opened anymore). 
        if (settingsObject.musicDownloadDir === null) {
            settingsObject.musicDownloadDir = "~/Music/Radio"
        }
    }

    return settingsObject

}