import { PlayPause, AdvancedPlaybackStatus } from 'types'
import { MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH, MPRIS_PLUGIN_PATH, MAX_VOLUME, MEDIA_PLAYER_2_NAME, MEDIA_PLAYER_2_PLAYER_NAME, MPV_CVC_NAME } from 'consts'
import { MprisMediaPlayerDbus, MprisPropsDbus, PlaybackStatus } from 'MprisTypes';
const { getDBusProperties, getDBus, getDBusProxyWithOwner } = imports.misc.interfaces
const { spawnCommandLine } = imports.misc.util;
// see https://lazka.github.io/pgi-docs/Cvc-1.0/index.html
const { MixerControl } = imports.gi.Cvc;


export interface Arguments {
    onPlaybackstatusChanged: (playbackStatus: AdvancedPlaybackStatus) => void,
    onUrlChanged: (url: string) => void,
    onVolumeChanged: (volume: number) => void,
    onTitleChanged: (title: string) => void,
    /** length in seconds */
    onLengthChanged: (length: number) => void,
    /** position in seconds */
    onPositionChanged: (position: number) => void,
    checkUrlValid: (url: string) => boolean,
    /** the lastUrl is used to determine if mpv is initially (i.e. on cinnamon restart) running for radio purposes and not for something else. It is not sufficient to get the url from a dbus interface and check if the url is valid because some streams (such as .pls streams) change their url dynamically. This approach in not 100% foolproof but probably the best possible approach */
    lastUrl: string,

    // TODO make as setter
    getInitialVolume: { (): number }

}

export function createMpvHandler(args: Arguments) {
    const {
        onPlaybackstatusChanged,
        onUrlChanged,
        onVolumeChanged,
        onTitleChanged,
        onLengthChanged,
        onPositionChanged,
        checkUrlValid,
        lastUrl,
        getInitialVolume,

    } = args

    const dbus = getDBus()

    const mediaServerPlayer = getDBusProxyWithOwner(
        MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME) as MprisMediaPlayerDbus

    const mediaProps = getDBusProperties(
        MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH) as MprisPropsDbus

    const control = new MixerControl({ name: __meta.name })
    let cvcStream: imports.gi.Cvc.MixerStream

    control.open()
    control.connect('stream-added', (ctrl, id) => {

        const addedStream = control.lookup_stream_id(id)

        if (addedStream?.name !== MPV_CVC_NAME)
            return

        cvcStream = addedStream
        cvcStream.connect('notify::volume', () => {
            handleCvcVolumeChanged()
        })
    })

    // When no last Url is passed and mpv is running, it is assumed that mpv is not used for the radio applet (and therefore the playbackstatus is Stopped)
    const initialPlaybackStatus = !lastUrl ? 'Stopped' : getPlaybackStatus()

    let currentUrl = initialPlaybackStatus !== "Stopped" ? lastUrl : null
    let currentLength: number = getLength() // in seconds
    let positionTimerId: ReturnType<typeof setInterval>

    let bufferExceeded = false

    let mediaPropsListenerId: number
    let seekListenerId: number

    if (initialPlaybackStatus !== "Stopped") {
        activateMprisPropsListener();
        activeSeekListener()

        onUrlChanged(currentUrl)
        onPlaybackstatusChanged(initialPlaybackStatus)
        onVolumeChanged(getVolume())
        onTitleChanged(getCurrentTitle())
        onLengthChanged(currentLength)
        onPositionChanged(getPosition())

        startPositionTimer()
    }

    dbus.connectSignal('NameOwnerChanged', (...args) => {

        const name = args[2][0]
        const oldOwner = args[2][1]
        const newOwner = args[2][2]

        if (name !== MPV_MPRIS_BUS_NAME) return

        if (newOwner) {
            activateMprisPropsListener()
            activeSeekListener()
            pauseAllOtherMediaPlayers()
        }

        if (oldOwner) {
            currentLength = 0
            currentUrl = null
            stopPositionTimer()
            mediaProps.disconnectSignal(mediaPropsListenerId)
            mediaServerPlayer.disconnectSignal(seekListenerId)
            onPlaybackstatusChanged('Stopped')
        }
    })

    function activateMprisPropsListener() {
        mediaPropsListenerId = mediaProps.connectSignal('PropertiesChanged',
            (proxy, nameOwner, [interfaceName, props]) => {

                // theoretically it could be used recursiveUnpack but this doesn't work on cinnamon 20 yet (but on 20.1)
                const metadata = props.Metadata?.deep_unpack()
                const volume = props.Volume?.unpack()

                const playbackStatus = props.PlaybackStatus?.unpack() as PlayPause

                //global.log(`metadata: ${JSON.stringify(props.Metadata?.recursiveUnpack())}, playbackStatus: ${playbackStatus}, volume: ${volume}`)

                const url = metadata?.['xesam:url']?.unpack()
                const title = metadata?.['xesam:title']?.unpack()

                const length = metadata?.["mpris:length"]?.unpack()

                const newUrlValid = checkUrlValid(url)
                const relevantEvent = newUrlValid || currentUrl

                if (!relevantEvent) return // happens when mpv is running with a file/stream not managed by the applet


                if (length != null) handleLengthChanged(length)

                if (volume != null) handleMprisVolumeChanged(volume)

                playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus)
                url && newUrlValid && url !== currentUrl && handleUrlChanged(url)
                title && handleTitleSet(title)

            }
        )
    }

    function activeSeekListener() {
        seekListenerId = mediaServerPlayer.connectSignal('Seeked', (id, sender, value) => {
            handlePositionChanged(microSecondsToRoundedSeconds(value))
        })
    }

    /** @param length in microseconds */
    function handleLengthChanged(length: number) {

        const lengthInSeconds = microSecondsToRoundedSeconds(length);

        onLengthChanged(lengthInSeconds);

        const startLoading = (length === 0);
        const finishedLoading = length !== 0 && currentLength === 0;

        currentLength = lengthInSeconds;

        if (startLoading) {
            onPlaybackstatusChanged('Loading')
        }

        if (finishedLoading || bufferExceeded) {
            const position = finishedLoading ? 0 : getPosition()
            handlePositionChanged(position)
            onPlaybackstatusChanged(getPlaybackStatus())
            bufferExceeded = false
        }
    }

    /**  @param position in seconds! */
    function handlePositionChanged(position: number) {

        stopPositionTimer()
        onPositionChanged(position)
        startPositionTimer()
    }

    function startPositionTimer() {

        if (getPlaybackStatus() !== 'Playing') return

        positionTimerId = setInterval(() => {

            const position = Math.min(getPosition(), currentLength)

            onPositionChanged(position)

            if (position === currentLength) {
                onPlaybackstatusChanged('Loading')
                bufferExceeded = true
                stopPositionTimer()
            }
        }, 1000)
    }

    function stopPositionTimer() {

        if (!positionTimerId) return

        clearInterval(positionTimerId)
        positionTimerId = null
    }

    function handleMprisPlaybackStatusChanged(playbackStatus: PlayPause) {
        if (currentLength !== 0) {
            onPlaybackstatusChanged(playbackStatus)

            playbackStatus === 'Paused' ? stopPositionTimer()
                : handlePositionChanged(getPosition())
        }
    }

    function handleUrlChanged(newUrl: string) {
        currentUrl = newUrl
        handleLengthChanged(0)

        if (positionTimerId) stopPositionTimer()
        onPositionChanged(0)

        onUrlChanged(newUrl)
    }

    function handleMprisVolumeChanged(mprisVolume: number) {

        if (mprisVolume * 100 > MAX_VOLUME) {
            mediaServerPlayer.Volume = MAX_VOLUME / 100
            return
        }

        const normalizedVolume = Math.round(mprisVolume * 100)
        setCvcVolume(normalizedVolume)
        onVolumeChanged(normalizedVolume)
    }

    function handleCvcVolumeChanged() {
        const normalizedVolume = Math.round(cvcStream.volume / control.get_vol_max_norm() * 100)
        setMprisVolume(normalizedVolume)
    }

    function handleTitleSet(title: string) {
        onTitleChanged(title)
    }

    /** @returns length in seconds */
    function getLength(): number {
        const lengthMicroSeconds = mediaServerPlayer.Metadata?.["mpris:length"]?.unpack() || 0
        return microSecondsToRoundedSeconds(lengthMicroSeconds)
    }

    /** @returns position in seconds */
    function getPosition(): number {

        if (getPlaybackStatus() === 'Stopped') return 0

        // for some reason, this only return the right value the first time it is called. When calling this multiple times, it returns always the same value which however is wrong when radio is playing
        // const positionMicroSeconds = mediaServerPlayer.Position
        const positionMicroSeconds = mediaProps.GetSync('org.mpris.MediaPlayer2.Player', 'Position')[0].deep_unpack()

        return microSecondsToRoundedSeconds(positionMicroSeconds)
    }


    function setUrl(url: string) {

        if (getPlaybackStatus() === 'Stopped') {

            const initialVolume = getInitialVolume()

            if (initialVolume == null) {
                throw new Error('initial Volume must not be undefined or null')
            }

            const command = `mpv --script=${MPRIS_PLUGIN_PATH} ${url} 
                --volume=${initialVolume}`
            spawnCommandLine(command)
            return
        }

        mediaServerPlayer.OpenUriRemote(url)
        mediaServerPlayer.PlaySync()

    }

    function increaseDecreaseVolume(volumeChange: number) {

        // newVolume is the current Volume plus(or minus) volumeChange 
        // but at least 0 and maximum Max_Volume
        const newVolume = Math.min(
            MAX_VOLUME,
            Math.max(0, getVolume() + volumeChange)
        )

        setMprisVolume(newVolume)
    }

    /** @param newVolume volume in percent */
    function setMprisVolume(newVolume: number) {

        if (getVolume() === newVolume || getPlaybackStatus() === 'Stopped') return

        mediaServerPlayer.Volume = newVolume / 100
    }

    /** @param newVolume volume in percent */
    function setCvcVolume(newVolume: number) {
        const newStreamVolume = newVolume / 100 * control.get_vol_max_norm()

        if (!cvcStream) return

        if (cvcStream.volume === newStreamVolume) return

        cvcStream.is_muted && cvcStream.change_is_muted(false)
        cvcStream.volume = newStreamVolume
        cvcStream.push_volume()
    }

    function togglePlayPause() {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.PlayPauseSync()
    }

    function stop() {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.StopSync()
    }

    function getCurrentTitle(): string {
        if (getPlaybackStatus() === "Stopped") return

        return mediaServerPlayer.Metadata["xesam:title"].unpack()
    }

    /**
     * pauses all MediaPlayers with MPRIS Support except mpv
     */
    function pauseAllOtherMediaPlayers() {

        dbus.ListNamesSync()[0].forEach(busName => {

            if (!busName.includes(MEDIA_PLAYER_2_NAME) || busName === MPV_MPRIS_BUS_NAME)
                return

            const nonMpvMediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, busName) as MprisMediaPlayerDbus

            nonMpvMediaServerPlayer.PauseSync()
        })
    }

    function getPlaybackStatus(): PlaybackStatus {

        // this is necessary because when a user stops mpv and afterwards start vlc (or maybe also an other media player), mediaServerPlayer.PlaybackStatus wrongly returns "Playing"  
        const mpvRunning = dbus.ListNamesSync()[0].includes(MPV_MPRIS_BUS_NAME)

        return mpvRunning ? mediaServerPlayer.PlaybackStatus : 'Stopped'
    }


    function getVolume(): number | null {

        if (getPlaybackStatus() === 'Stopped')
            return null

        return Math.round(mediaServerPlayer.Volume * 100)
    }

    function microSecondsToRoundedSeconds(microSeconds: number) {
        const seconds = microSeconds / 1_000_000
        const secondsRounded = Math.round(seconds)
        return secondsRounded
    }


    /** @param newPosition in seconds */
    function setPosition(newPosition: number) {
        const positioninMicroSeconds = Math.min(newPosition * 1_000_000, currentLength * 1_000_000)
        const trackId = mediaServerPlayer.Metadata['mpris:trackid'].unpack()
        mediaServerPlayer?.SetPositionRemote(trackId, positioninMicroSeconds)
    }

    return {
        increaseDecreaseVolume,
        setVolume: setMprisVolume,
        setUrl,
        togglePlayPause,
        stop,
        getCurrentTitle,
        setPosition,
        // it is very confusing but dbus must be returned!
        // Otherwilse all listeners stop working after about 20 seconds which is fucking difficult to debug
        dbus

    }
}