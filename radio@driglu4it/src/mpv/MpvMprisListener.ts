import { PlaybackStatus, MediaPropChanges, PlayPause, AdvancedPlaybackStatus } from 'types'
import { MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH } from 'consts'
import { MpvMprisBase } from 'mpv/MpvMprisBase';
const { getDBusProperties } = imports.misc.interfaces


export interface MprisListenerArguments {
    onInitialized: { (playbackStatus: PlaybackStatus, volume: number): void },
    onPlaybackstatusChanged: { (playbackStatus: Omit<AdvancedPlaybackStatus, 'Stopped'>): void },
    onUrlChanged: { (url: string): void },
    onVolumeChanged: { (volume: number): void },
    onTitleChanged: { (title: string): void },
    checkUrlValid: { (url: string): boolean },

    initialUrl: string,
    mprisBase: MpvMprisBase
}

export function listenToMpvMpris(args: MprisListenerArguments) {
    const {
        onInitialized,
        onPlaybackstatusChanged,
        onUrlChanged,
        onVolumeChanged,
        onTitleChanged,
        checkUrlValid,
        initialUrl,
        mprisBase
    } = args

    const {
        mediaServerPlayer,
        getPlaybackStatus,
        getVolume
    } = mprisBase


    // When no inital Url is passed and mpv is running, it is assumed that mpv is not used for the radio applet (and therefore the playbackstatus is Stopped)
    const initialPlaybackStatus = !initialUrl ? 'Stopped' : getPlaybackStatus()
    const initialVolume = initialPlaybackStatus === 'Stopped' ? null : getVolume()

    onInitialized(initialPlaybackStatus, initialVolume)

    let currentUrl = initialPlaybackStatus !== "Stopped" ? initialUrl : null
    let currentTitle: string = null
    let currentLength: number = getLength()

    let lastVolume: number = initialVolume || null

    let propsChangeListener: Function

    const mediaProps = getDBusProperties(
        MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)

    if (initialPlaybackStatus !== "Stopped") activateListener()




    function activateListener() {
        propsChangeListener = mediaProps.connectSignal('PropertiesChanged',
            (...args: any) => {
                const props: MediaPropChanges = args[2][1]

                // theoretically it could be used recursiveUnpack but this doesn't work on cinnamon 20 yet (but on 20.1)
                const metadata = props.Metadata?.deep_unpack()
                const volume = props.Volume?.deep_unpack()
                const playbackStatus = props.PlaybackStatus?.deep_unpack() as PlayPause

                // @ts-ignore
                const url = metadata?.['xesam:url']?.deep_unpack()
                // @ts-ignore
                const title = metadata?.['xesam:title']?.deep_unpack()
                // @ts-ignore
                const length = metadata?.["mpris:length"]?.deep_unpack()

                const newUrlValid = checkUrlValid(url)
                const relevantEvent = newUrlValid || currentUrl

                if (!relevantEvent) return // happens when mpv is running with a file/stream not managed by the applet

                if (length != null) handleLengthChanged(length)

                if (volume != null) handleVolumeChanged(volume)

                playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus)
                url && newUrlValid && url !== currentUrl && handleUrlChanged(url)
                title && handleTitleSet(title)

            }
        )
    }

    function handleLengthChanged(length: number) {

        if (length === 0) {
            onPlaybackstatusChanged('Loading')
        }

        if (currentLength === 0 && length !== 0) onPlaybackstatusChanged('Playing')

        currentLength = length


    }

    function handleMprisPlaybackStatusChanged(playbackStatus: PlayPause) {

        if (currentLength === 0) {
            onPlaybackstatusChanged('Loading')
        } else {
            onPlaybackstatusChanged(playbackStatus)
        }

    }


    function handleUrlChanged(newUrl: string) {
        currentUrl = newUrl
        handleLengthChanged(0)
        onUrlChanged(newUrl)
    }

    function handleVolumeChanged(mprisVolume: number) {
        const normalizedVolume = Math.round(mprisVolume * 100)
        lastVolume = normalizedVolume
        onVolumeChanged(normalizedVolume)
    }

    function handleTitleSet(title: string) {

        if (title === currentTitle) return
        currentTitle = title
        onTitleChanged(title)
    }

    function deactivateListener() {
        currentLength = 0
        currentUrl = null
        currentTitle = null
        mediaProps.disconnectSignal(propsChangeListener)
    }

    function getLength(): number {

        // @ts-ignore
        let length = mediaServerPlayer?.Metadata?.["mpris:length"]?.unpack() || 0
        return length
    }

    return {
        getLastVolume: () => lastVolume,
        activateListener,
        deactivateListener
    }

}