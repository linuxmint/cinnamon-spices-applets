import { PlayPause, AdvancedPlaybackStatus, ChangeHandler } from '../../types'
import { MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH, MPRIS_PLUGIN_PATH, MAX_VOLUME, MEDIA_PLAYER_2_NAME, MEDIA_PLAYER_2_PLAYER_NAME, MPV_CVC_NAME } from '../../consts'
import { MprisMediaPlayerDbus, MprisPropsDbus } from '../../types';
import { configs } from '../Config';
const { getDBusProperties, getDBus, getDBusProxyWithOwner } = imports.misc.interfaces
const { spawnCommandLine } = imports.misc.util;
// see https://lazka.github.io/pgi-docs/Cvc-1.0/index.html
const { MixerControl } = imports.gi.Cvc;

export type MpvHandler = ReturnType<typeof createMpvHandler>

// TODO: this is not really right as the mpvHandler is initally undefined but it is much easier that way..
export let mpvHandler: MpvHandler

export const initMpvHandler = () => {

    if (mpvHandler) {
        global.logWarning('mpvHandler already initiallized')
        return
    }

    mpvHandler = createMpvHandler()
}

function createMpvHandler() {

    const {
        settingsObject,
        getInitialVolume,
        addStationsListChangeHandler
    } = configs


    /** the lastUrl is used to determine if mpv is initially (i.e. on cinnamon restart) running for radio purposes and not for something else. It is not sufficient to get the url from a dbus interface and check if the url is valid because some streams (such as .pls streams) change their url dynamically. This approach in not 100% foolproof but probably the best possible approach */
    const lastUrl = settingsObject.lastUrl

    // this is a workaround for now. Optimally the lastVolume should be saved persistently each time the volume is changed but this lead to significant performance issue on scrolling at the moment. However this shouldn't be the case as it is no problem to log the volume each time the volume changes (so it is a problem in the config implementation). As a workaround the volume is only saved persistently when the radio stops but the volume obviously can't be received anymore from dbus when the player has been already stopped ... 
    let lastVolume: number


    const dbus = getDBus()

    const mediaServerPlayer = getDBusProxyWithOwner(
        MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME) as MprisMediaPlayerDbus

    const mediaProps = getDBusProperties(
        MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH) as MprisPropsDbus

    const control = new MixerControl({ name: __meta.name })
    let cvcStream: imports.gi.Cvc.MixerStream
    let isLoading: boolean = false

    const playbackStatusChangeHandler: ChangeHandler<AdvancedPlaybackStatus>[] = []
    const channelNameChangeHandler: ChangeHandler<string>[] = []
    const volumeChangeHandler: ChangeHandler<number>[] = [] //
    const titleChangeHandler: ChangeHandler<string>[] = []
    const lengthChangeHandler: ChangeHandler<number>[] = []
    const positionChangeHandler: ChangeHandler<number>[] = []

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

    let currentUrl: string | null = lastUrl

    // When no last Url is passed and mpv is running, it is assumed that mpv is not used for the radio applet (and therefore the playbackstatus is Stopped)
    const initialPlaybackStatus = getPlaybackStatus()
    if (initialPlaybackStatus === 'Stopped') currentUrl = null

    let currentLength: number = getLength() // in seconds
    let positionTimerId: ReturnType<typeof setInterval> | null = null

    let bufferExceeded = false

    let mediaPropsListenerId: number | null = null
    let seekListenerId: number | null = null

    if (initialPlaybackStatus !== "Stopped") {
        activateMprisPropsListener();
        activateSeekListener()
        startPositionTimer()
    }

    const nameOwnerSignalId = dbus.connectSignal('NameOwnerChanged', (...args) => {

        const name = args[2][0]
        const oldOwner = args[2][1]
        const newOwner = args[2][2]

        if (name !== MPV_MPRIS_BUS_NAME) return

        if (newOwner) {
            activateMprisPropsListener()
            activateSeekListener()
            pauseAllOtherMediaPlayers()
        }

        if (oldOwner) {
            handleMpvStopped()
        }
    })

    function handleMpvStopped(): void {
        isLoading = false
        currentLength = 0
        stopPositionTimer()
        mediaPropsListenerId && mediaProps.disconnectSignal(mediaPropsListenerId)
        seekListenerId && mediaServerPlayer.disconnectSignal(seekListenerId)
        mediaPropsListenerId = seekListenerId = currentUrl = null
        playbackStatusChangeHandler.forEach(handler => handler('Stopped'))
        settingsObject.lastVolume = lastVolume
    }

    function deactivateAllListener(): void {
        if (nameOwnerSignalId) dbus?.disconnectSignal(nameOwnerSignalId)
        if (mediaPropsListenerId) mediaProps?.disconnectSignal(mediaPropsListenerId)
        if (seekListenerId) mediaServerPlayer?.disconnectSignal(seekListenerId)
    }

    function activateMprisPropsListener(): void {
        mediaPropsListenerId = mediaProps.connectSignal('PropertiesChanged',
            (proxy, nameOwner, [interfaceName, props]) => {

                const metadata = props.Metadata?.recursiveUnpack()
                const volume = props.Volume?.unpack()

                const playbackStatus = props.PlaybackStatus?.unpack() as PlayPause

                const url = metadata?.['xesam:url']
                const title = metadata?.['xesam:title']

                const length = metadata?.["mpris:length"]
                const newUrlValid = checkUrlValid(url)
                const relevantEvent = newUrlValid || currentUrl

                if (!relevantEvent) return // happens when mpv is running with a file/stream not managed by the applet

                if (length != null) handleLengthChanged(length)
                if (volume != null) handleMprisVolumeChanged(volume)

                url && newUrlValid && url !== currentUrl && handleUrlChanged(url)
                playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus)

                title && titleChangeHandler.forEach(changeHandler => changeHandler(title))
            }
        )
    }

    function checkUrlValid(channelUrl: string): boolean {
        return settingsObject.userStations.some(cnl => cnl.url === channelUrl && cnl.inc)

    }

    function activateSeekListener(): void {
        seekListenerId = mediaServerPlayer.connectSignal('Seeked', (id, sender, value) => {
            handlePositionChanged(microSecondsToRoundedSeconds(value))
        })
    }

    /** @param length in microseconds */
    function handleLengthChanged(length: number): void {

        const lengthInSeconds = microSecondsToRoundedSeconds(length);

        lengthChangeHandler.forEach(handler => handler(lengthInSeconds))
        const startLoading = (length === 0);
        const finishedLoading = length !== 0 && currentLength === 0;

        currentLength = lengthInSeconds;

        if (startLoading) {
            isLoading = true
            playbackStatusChangeHandler.forEach(handler => handler('Loading'))
        }

        if (finishedLoading || bufferExceeded) {
            isLoading = false
            const position = finishedLoading ? 0 : getPosition()
            handlePositionChanged(position)
            playbackStatusChangeHandler.forEach(handler => handler(getPlaybackStatus()))
            bufferExceeded = false
        }
    }

    /**  @param position in seconds! */
    function handlePositionChanged(position: number): void {

        stopPositionTimer()
        positionChangeHandler.forEach(handler => handler(position))
        startPositionTimer()
    }

    function startPositionTimer(): void {

        if (getPlaybackStatus() !== 'Playing') return

        positionTimerId = setInterval(() => {

            const position = Math.min(getPosition(), currentLength)
            positionChangeHandler.forEach(handler => handler(position))

            if (position === currentLength) {
                isLoading = true
                playbackStatusChangeHandler.forEach(handler => handler('Loading'))
                bufferExceeded = true
                stopPositionTimer()
            }
        }, 1000)
    }

    function stopPositionTimer(): void {

        if (!positionTimerId) return

        clearInterval(positionTimerId)
        positionTimerId = null
    }

    function handleMprisPlaybackStatusChanged(playbackStatus: PlayPause): void {
        if (currentLength !== 0) {
            playbackStatusChangeHandler.forEach(handler => handler(playbackStatus))

            playbackStatus === 'Paused' ? stopPositionTimer()
                : handlePositionChanged(getPosition())
        }
    }

    function handleUrlChanged(newUrl: string): void {
        currentUrl = newUrl
        settingsObject.lastUrl = newUrl
        handleLengthChanged(0)

        if (positionTimerId) stopPositionTimer()
        positionChangeHandler.forEach(handler => handler(0))

        const currentChannelName = getCurrentChannelName()

        if (!currentChannelName) return // TODO: this never happens (the stufff in the props change handler should be here)

        channelNameChangeHandler.forEach(changeHandler => changeHandler(currentChannelName))
    }

    function handleMprisVolumeChanged(mprisVolume: number): void {

        if (mprisVolume * 100 > MAX_VOLUME) {
            mediaServerPlayer.Volume = MAX_VOLUME / 100
            return
        }

        const normalizedVolume = Math.round(mprisVolume * 100)
        setCvcVolume(normalizedVolume)
        volumeChangeHandler.forEach(changeHandler => changeHandler(normalizedVolume))
        lastVolume = normalizedVolume
    }

    function handleCvcVolumeChanged(): void {
        const normalizedVolume = Math.round(cvcStream.volume / control.get_vol_max_norm() * 100)
        setMprisVolume(normalizedVolume)
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
        const positionMicroSeconds = mediaProps.GetSync('org.mpris.MediaPlayer2.Player', 'Position')[0].deepUnpack()

        return microSecondsToRoundedSeconds(positionMicroSeconds)
    }

    function setUrl(url: string): void {

        if (getPlaybackStatus() === 'Stopped') {

            let initialVolume = getInitialVolume()

            if (initialVolume == null) {
                global.logWarning('initial Volume was null or undefined. Applying 50 as a fallback solution to prevent radio stop working')
                initialVolume = 50
            }

            const command = `mpv --config=no --no-video --script=${MPRIS_PLUGIN_PATH} ${url} 
                --volume=${initialVolume}`
            spawnCommandLine(command)
            return
        }

        mediaServerPlayer.OpenUriRemote(url)
        mediaServerPlayer.PlaySync()

    }

    function increaseDecreaseVolume(volumeChange: number): void {

        const currentVolulume = getVolume()

        if (currentVolulume == null) return

        // newVolume is the current Volume plus(or minus) volumeChange 
        // but at least 0 and maximum Max_Volume
        const newVolume = Math.min(
            MAX_VOLUME,
            Math.max(0, currentVolulume + volumeChange)
        )

        setMprisVolume(newVolume)
    }

    /** @param newVolume volume in percent */
    function setMprisVolume(newVolume: number): void {

        if (getVolume() === newVolume || getPlaybackStatus() === 'Stopped') return

        mediaServerPlayer.Volume = newVolume / 100
    }

    /** @param newVolume volume in percent */
    function setCvcVolume(newVolume: number): void {
        const newStreamVolume = newVolume / 100 * control.get_vol_max_norm()

        if (!cvcStream) return

        if (cvcStream.volume === newStreamVolume) return

        cvcStream.is_muted && cvcStream.change_is_muted(false)
        cvcStream.volume = newStreamVolume
        cvcStream.push_volume()
    }

    function togglePlayPause(): void {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.PlayPauseSync()
    }

    function stop(): void {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.StopSync()
    }

    function getCurrentTitle(): string | undefined {
        if (getPlaybackStatus() === "Stopped") return

        return mediaServerPlayer.Metadata["xesam:title"].unpack()
    }

    /**
     * pauses all MediaPlayers with MPRIS Support except mpv
     */
    function pauseAllOtherMediaPlayers(): void {

        dbus.ListNamesSync()[0].forEach(busName => {

            if (!busName.includes(MEDIA_PLAYER_2_NAME) || busName === MPV_MPRIS_BUS_NAME)
                return

            const nonMpvMediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, busName) as MprisMediaPlayerDbus

            nonMpvMediaServerPlayer.PauseSync()
        })
    }

    function getPlaybackStatus(): AdvancedPlaybackStatus {

        if (!currentUrl) return 'Stopped'

        if (isLoading) return 'Loading'

        // this is necessary because when a user stops mpv and afterwards start vlc (or maybe also an other media player), mediaServerPlayer.PlaybackStatus wrongly returns "Playing"  
        const mpvRunning = dbus.ListNamesSync()[0].includes(MPV_MPRIS_BUS_NAME)

        return mpvRunning ? mediaServerPlayer.PlaybackStatus : 'Stopped'
    }

    /** Volume in Percent */
    function getVolume(props?: { dimension?: 'percent' | 'fraction' }): number | null {

        if (getPlaybackStatus() === 'Stopped')
            return null

        const volumeFraction = mediaServerPlayer.Volume

        return (props?.dimension === 'fraction') ? volumeFraction : Math.round(volumeFraction * 100)

    }

    function microSecondsToRoundedSeconds(microSeconds: number): number {
        const seconds = microSeconds / 1_000_000
        const secondsRounded = Math.round(seconds)
        return secondsRounded
    }

    /** @param newPosition in seconds */
    function setPosition(newPosition: number): void {
        const positioninMicroSeconds = Math.min(newPosition * 1_000_000, currentLength * 1_000_000)
        const trackId = mediaServerPlayer.Metadata['mpris:trackid'].unpack()
        mediaServerPlayer?.SetPositionRemote(trackId, positioninMicroSeconds)
    }

    function getCurrentChannelName(): string | undefined {

        if (getPlaybackStatus() === 'Stopped') return

        const currentChannel = currentUrl ? settingsObject.userStations.find(cnl => cnl.url === currentUrl) : undefined

        return currentChannel?.name
    }

    addStationsListChangeHandler(() => {

        if (!currentUrl) return

        const currentStationValid = checkUrlValid(currentUrl)

        if (!currentStationValid) stop()

    })

    return {
        increaseDecreaseVolume,
        setVolume: setMprisVolume,
        setUrl,
        togglePlayPause,
        stop,
        getCurrentTitle,
        setPosition,
        deactivateAllListener,
        getPlaybackStatus,
        getVolume,
        getLength,
        getPosition,
        getCurrentChannelName,


        addPlaybackStatusChangeHandler: (changeHandler: ChangeHandler<AdvancedPlaybackStatus>) => {
            playbackStatusChangeHandler.push(changeHandler)
        },

        addChannelChangeHandler: (changeHandler: ChangeHandler<string>) => {
            channelNameChangeHandler.push(changeHandler)
        },

        addVolumeChangeHandler: (changeHandler: ChangeHandler<number>) => {
            volumeChangeHandler.push(changeHandler)
        },

        addTitleChangeHandler: (changeHandler: ChangeHandler<string>) => {
            titleChangeHandler.push(changeHandler)
        },

        addLengthChangeHandler: (changeHandler: ChangeHandler<number | undefined>) => {
            lengthChangeHandler.push(changeHandler)
        },

        addPositionChangeHandler: (changeHandler: ChangeHandler<number>) => {
            positionChangeHandler.push(changeHandler)
        },

        // it is very confusing but dbus must be returned!
        // Otherwilse all listeners stop working after about 20 seconds which is fucking difficult to debug
        dbus
    }
}