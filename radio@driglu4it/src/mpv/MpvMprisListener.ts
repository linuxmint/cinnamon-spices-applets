import { getDBusPropertiesPromise } from 'functions/promiseHelpers'
import { PlaybackStatus, MediaPropChanges, Metadata } from 'types'
import { MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH } from 'CONSTANTS'
import { MpvMprisBase } from 'mpv/MpvMprisBase';


export interface MprisListenerArguments {
    onInitialized: { (playbackStatus: PlaybackStatus, volume: number): string },
    onStarted: { (volume: number, url: string): void },
    onChannelChanged: { (newUrl: string): void },
    onVolumeChanged: { (volume: number): void },
    ckeckUrlValid: { (url: string): boolean },
    onPaused: { (): void },
    onResumed: { (): void },
    onTitleChanged: { (title: string): void }

    mprisBase: MpvMprisBase
}

export async function listenToMpvMpris(args: MprisListenerArguments) {
    const {
        onInitialized,
        onStarted,
        onChannelChanged,
        onVolumeChanged,
        ckeckUrlValid,
        onPaused,
        onResumed,
        onTitleChanged,
        mprisBase
    } = args

    const {
        getPlaybackStatus,
        getVolume
    } = mprisBase

    const initialPlaybackStatus = getPlaybackStatus()

    let currentUrl = onInitialized(initialPlaybackStatus, getVolume())

    let currentTitle: string = null
    let propsChangeListener: Function

    const mediaProps = await getDBusPropertiesPromise(
        MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)

    if (initialPlaybackStatus !== "Stopped") activateListener()


    function activateListener() {
        propsChangeListener = mediaProps.connectSignal('PropertiesChanged',
            (...args: any) => {
                const props: MediaPropChanges = args[2][1]

                const metadata = props?.Metadata?.deep_unpack()
                const volume = props?.Volume?.deep_unpack()
                const playbackStatus = props?.PlaybackStatus?.deep_unpack()

                // The order is important as it for example doesn't make sense to call OnVolumeChange before OnStarted
                metadata && handleMetadataChange(metadata)
                playbackStatus && handlePlaybackStatusChange(playbackStatus)
                // TODO why it is not working with ?? 
                if (volume != null) handleVolumeChanged(volume)
            }
        )
    }

    function handlePlaybackStatusChange(plackbackStatus: PlaybackStatus) {
        plackbackStatus === "Paused" && onPaused()
        plackbackStatus === "Playing" && onResumed()

    }

    function handleVolumeChanged(mprisVolume: number) {
        const normalizedVolume = Math.round(mprisVolume * 100)
        onVolumeChanged(normalizedVolume)
    }

    function deactivateListener() {
        currentUrl = null
        mediaProps.disconnectSignal(propsChangeListener)
    }

    function handleMetadataChange(metadata: Metadata) {

        const url = metadata["xesam:url"]?.unpack()
        const title = metadata["xesam:title"]?.unpack()

        if (url !== currentUrl && ckeckUrlValid(url)) {
            currentUrl ? onChannelChanged(url)
                : onStarted(getVolume(), url)
            currentUrl = url
        }

        if (title !== currentTitle) {
            onTitleChanged(title)
            currentTitle = title
        }


    }

    return {
        activateListener,
        deactivateListener
    }

}