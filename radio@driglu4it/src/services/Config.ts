import { isEqual } from "lodash-es";
import { Channel, AppletIcon, ChangeHandler, YouTubeClis } from "../types";
const { AppletSettings } = imports.ui.settings;

interface Settings {
    iconType: AppletIcon,
    symbolicIconColorWhenPlaying: string,
    symbolicIconColorWhenPaused: string,
    channelNameOnPanel: boolean,
    customInitVolume: number,
    keepVolume: boolean,
    lastVolume: number,
    initialVolume: number,
    userStations: Channel[]
    lastUrl: string | null,
    musicDownloadDir: string
    youtubeCli: YouTubeClis
}

// TODO: throw an error when importing without initiallized before
export let configs: ReturnType<typeof createConfig>

export const initConfig = () => {
    configs = createConfig()
}

const createConfig = () => {

    // all settings are saved to this object
    const settingsObject = {} as Omit<Settings, 'initialVolume'>
    const appletSettings = new AppletSettings(settingsObject, __meta.uuid, __meta.instanceId)

    const iconTypeChangeHandler: ChangeHandler<AppletIcon>[] = []
    const colorPlayingChangeHander: ChangeHandler<string>[] = []
    const colorPausedHandler: ChangeHandler<string>[] = []
    const channelOnPanelHandler: ChangeHandler<boolean>[] = []
    const stationsHandler: ChangeHandler<Channel[]>[] = []

    appletSettings.bind<AppletIcon>('icon-type', 'iconType', (newVal) => {
        if (isEqual(previousIconType, newVal)) return
        iconTypeChangeHandler.forEach(changeHandler => changeHandler(newVal))
        previousIconType = newVal
    })

    appletSettings.bind<string>('color-on', 'symbolicIconColorWhenPlaying',
        (newVal) => {
            if (isEqual(newVal, previousColorPlaying)) return
            colorPlayingChangeHander.forEach(changeHandler => changeHandler(newVal))
            previousColorPlaying = newVal
        })

    appletSettings.bind<string>('color-paused', 'symbolicIconColorWhenPaused',
        (newVal) => {
            if (isEqual(previousColorPaused, newVal)) return
            colorPausedHandler.forEach(changeHandler => changeHandler(newVal))
            previousColorPaused = newVal
        })

    appletSettings.bind<boolean>('channel-on-panel', 'channelNameOnPanel',
        (newVal) => {
            if (isEqual(previousChannelOnPanel, newVal)) return
            channelOnPanelHandler.forEach(changeHandler => changeHandler(newVal))
            previousChannelOnPanel = newVal
        })

    appletSettings.bind<boolean>('keep-volume-between-sessions', 'keepVolume')
    appletSettings.bind<number>('initial-volume', 'customInitVolume')
    appletSettings.bind<number>('last-volume', 'lastVolume')

    appletSettings.bind<Channel[]>('tree', 'userStations',
        (newVal) => {
            // temporariy solution to fix typo in settings-schema
            // @ts-ignore
            const trimmedStations = newVal.map(val => { return { ...val, url: val.url?.trim() || val.ur.trim() } })
            if (isEqual(previousUserStations, trimmedStations)) return
            stationsHandler.forEach(changeHandler => changeHandler(trimmedStations))
            previousUserStations = trimmedStations
        })

    appletSettings.bind('last-url', 'lastUrl')
    appletSettings.bind('music-download-dir-select', 'musicDownloadDir')
    appletSettings.bind('youtube-download-cli', 'youtubeCli')

    // The callbacks are for some reason called each time any setting is changed which makes debugging much more difficult. Therefore we are always saving the previous settings to ensure the callbacks are only called when the values have really changed ... 
    let previousUserStations = settingsObject.userStations
    let previousIconType = settingsObject.iconType
    let previousColorPlaying = settingsObject.symbolicIconColorWhenPlaying
    let previousColorPaused = settingsObject.symbolicIconColorWhenPaused
    let previousChannelOnPanel = settingsObject.channelNameOnPanel

    function getInitialVolume() {
        const {
            keepVolume,
            lastVolume,
            customInitVolume
        } = settingsObject

        const initialVolume = keepVolume ? lastVolume : customInitVolume

        return initialVolume
    }


    return {
        settingsObject,

        getInitialVolume,

        addIconTypeChangeHandler: (newIconTypeChangeHandler: ChangeHandler<AppletIcon>) => {
            iconTypeChangeHandler.push(newIconTypeChangeHandler)
        },

        addColorPlayingChangeHandler: (newColorPlayingChangeHandler: ChangeHandler<string>) => {
            colorPlayingChangeHander.push(newColorPlayingChangeHandler)
        },

        addColorPausedChangeHandler: (newColorPausedChangeHandler: ChangeHandler<string>) => {
            colorPausedHandler.push(newColorPausedChangeHandler)
        },

        addChannelOnPanelChangeHandler: (channelOnPanelChangeHandler: ChangeHandler<boolean>) => {
            channelOnPanelHandler.push(channelOnPanelChangeHandler)
        },

        addStationsListChangeHandler: (stationsChangeHandler: ChangeHandler<Channel[]>) => {
            stationsHandler.push(stationsChangeHandler)
        }


        // setIcon

    }

}


