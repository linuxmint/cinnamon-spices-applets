const { spawnCommandLine } = imports.misc.util;
const Cvc = imports.gi.Cvc; // see https://lazka.github.io/pgi-docs/Cvc-1.0/index.html// 

import { getDBusPromise, getDBusPropertiesPromise, getDBusProxyWithOwnerPromise } from './utils'

import { MPRIS_PLUGIN_PATH } from './constants'

import { PlaybackStatus } from './types'

// See: https://specifications.freedesktop.org/mpris-spec/2.2/Player_Interface.html
// Methods always need a "Remote" as suffix to work
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`

const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value


type UpdateTarget = "cvcStream" | "mpris"


interface MprisMediaPlayer {
    Volume: number
    Metadata: any //TODO: add type
    PlaybackStatus: PlaybackStatus
    LoopStatus: any
    Shuffle: any
    Rate: any
    PlayRemote: { (): void }
    OpenUriRemote: { (uri: string): void }
    StopRemote: { (): void }
    PlayPauseRemote: { (): void }
    NextRemote: { (): void }
    PreviousRemote: { (): void }
    SetPositionRemote: Function
    disconnectSignal: Function

}

interface Arguments {
    currentUrl: string,
    validUrls: string[],
    initialVolume: number,

    onStopped: { (stoppedUrl: string): void },
    onVolumeChanged: { (newVolume: number): void }
    onStarted: { (startedUrl: string): void },
    onChannelChanged: { (oldUrl: string, newUrl: string): void },
    onPaused: { (pausedUrl: string): void },
    onResumed: { (resumedUrl: string): void },
}


export class MpvPlayerHandler {

    // TODO: define types for those
    private dbus: any
    private mediaServerPlayer: MprisMediaPlayer
    private mediaProps: any
    private control: imports.gi.Cvc.MixerControl

    private stream: imports.gi.Cvc.MixerStream
    public volume: number
    public initialVolume: number
    public playbackStatus: PlaybackStatus

    private validUrls: string[]
    public currentUrl: string

    private onVolumeChanged: { (newVolume: number): void }
    private onStarted: { (channelUrl: string): void }
    private onChannelChanged: { (oldUrl: string, newUrl: string): void }
    private onPaused: { (channelUrl: string): void }
    private onStopped: { (stoppedUrl: string): void }
    private onResumed: { (channelUrl: string): void }

    private propsChangeListener: Function

    public constructor(args: Arguments) {
        Object.assign(this, args)
    }

    public async init() {

        this.dbus = await getDBusPromise()
        this.mediaServerPlayer = await getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME)
        this.mediaProps = await getDBusPropertiesPromise(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)

        const mpvRunning = (await this.getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)

        if (mpvRunning) {
            this.playbackStatus = this.mediaServerPlayer.PlaybackStatus
            this.propsChangeListener = this.initMediaPropsChangeListener()
            this.volume = this.normalizeMprisVolume(this.mediaServerPlayer.Volume)
        } else {
            this.playbackStatus = "Stopped"
        }


        this.listenToDBus()
        this.listenToCvcStream()

    }


    private listenToCvcStream() {

        this.control = new Cvc.MixerControl({ name: __meta.name })
        this.control.open();

        this.control.connect('stream-added', (...args: any) => {
            const id: number = args[1]
            const stream = this.control.lookup_stream_id(id)

            if (stream?.name === "mpv Media Player") {
                this.stream = stream
                this.stream.connect("notify::volume", () => {
                    this.handleCvcVolumeChanged()
                })
            }
        })
    }

    private handleCvcVolumeChanged() {
        const newVolume = this.normalizeCvcStreamVolume(this.stream.volume)
        this.updateVolume('mpris', newVolume)
    }

    private initMediaPropsChangeListener() {

        return this.mediaProps.connectSignal('PropertiesChanged', (...args: any) => {

            const props = args[2][1]

            const playbackStatus = props?.PlaybackStatus?.deep_unpack()
            const metadata = props?.Metadata?.deep_unpack();
            const volume = props?.Volume?.deep_unpack()

            volume && this.handleMprisVolumeChanged(volume)

            // HandleMetadataChange must bei caleld before handlebackstatus otherwillse not working when radio started with .pls files!
            metadata && this.handleMetadataChange(metadata);

            playbackStatus && this.handlePlaybackStatusChanged(playbackStatus);

        })

    }

    // theoretically it should also be possible to listen to props.PlaybackStatus but this doesn't work. 
    // Probably because of this: https://github.com/hoyon/mpv-mpris/issues/22 (not sure though)
    private listenToDBus() {
        this.dbus.connectSignal('NameOwnerChanged', (...args: any) => {

            const name = args[2][0] as string
            const newOwner = args[2][2]

            if (name !== MPV_MPRIS_BUS_NAME) return

            if (newOwner) {
                this.propsChangeListener = this.initMediaPropsChangeListener()
            } else {
                this.onStopped(this.currentUrl)
                this.currentUrl = null
                this.playbackStatus = "Stopped"
                this.mediaProps.disconnectSignal(this.propsChangeListener)
            }
        })
    }

    public updateValidUrls(urls: string[]) {
        this.validUrls = urls
        if (!this.validUrls.includes(this.currentUrl)) {
            this.stop()
        }
    }


    private handleMetadataChange(metadata: any) {

        const url = metadata["xesam:url"].unpack()

        if (url === this.currentUrl || !this.validUrls.includes(url)) {
            return
        }

        this.currentUrl ? this.onChannelChanged(this.currentUrl, url,) : this.onStarted(url)
        this.currentUrl = url

        this.playbackStatus = this.mediaServerPlayer.PlaybackStatus

    }


    private handlePlaybackStatusChanged(playbackStatus: PlaybackStatus) {

        if (this.playbackStatus === playbackStatus) return

        playbackStatus === "Paused" && this.onPaused(this.currentUrl)
        playbackStatus === "Playing" && this.onResumed(this.currentUrl)

        this.playbackStatus = playbackStatus

    }


    private handleMprisVolumeChanged(newMprisVolume: number) {
        const normalizedVolume = this.normalizeMprisVolume(newMprisVolume)
        this.updateVolume('cvcStream', normalizedVolume)
    }

    private normalizeMprisVolume(mprisVolume: number): number {
        return Math.round(mprisVolume * 100)
    }

    private normalizedVolumeToMprisVolume(normalizedVolume: number): number {
        return normalizedVolume / 100
    }

    private normalizedVolumeToCvcStreamVolume(normalizedVolume: number): number {
        return normalizedVolume / 100 * this.control.get_vol_max_norm()
    }

    private normalizeCvcStreamVolume(streamVolume: number) {
        return Math.round(streamVolume / this.control.get_vol_max_norm() * 100)
    }


    private getAllMrisPlayerBusNames(): Promise<string[]> {
        const name_regex = /^org\.mpris\.MediaPlayer2\./;

        return new Promise((resolve, reject) => {
            this.dbus.ListNamesRemote((names: string[][]) => {
                const busNames = names[0].filter(busName => name_regex.test(busName))
                const busNamesArr = Object.values(busNames)
                resolve(busNamesArr)
            })
        })
    }


    private async pauseAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await this.getAllMrisPlayerBusNames()

        allMprisPlayerBusNames.forEach(async busName => {

            if (busName === MPV_MPRIS_BUS_NAME) return

            const mediaServerPlayer = await getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, busName)
            mediaServerPlayer.PauseRemote()

        })
    }


    public start(channelUrl: string) {

        this.pauseAllOtherMediaPlayer()
        const command = `mpv --script=${MPRIS_PLUGIN_PATH} ${channelUrl} --volume=${this.initialVolume}`
        spawnCommandLine(command)
    }


    // theoritcally this should also work for starting but it doesn't (probably due to --script). 
    // works also when radio is paused
    public changeChannel(channelUrl: string) {

        if (this.currentUrl === channelUrl) return

        this.mediaServerPlayer.PlayRemote() // ensures that the method is working when radio is paused. Has no effect if playing/stopped 
        this.mediaServerPlayer.OpenUriRemote(channelUrl)
    }


    public togglePlayPause() {
        if (this.playbackStatus === "Stopped") return
        this.mediaServerPlayer.PlayPauseRemote()
    }

    public stop() {
        if (this.playbackStatus === "Stopped") return
        this.mediaServerPlayer.StopRemote()
    }

    public increaseDecreaseVolume(volumeChange: number) {
        if (this.playbackStatus === "Stopped") return

        // as cvc is updated in mpris event listener, both are acutally updated 
        this.updateVolume('mpris', this.volume + volumeChange)

    }


    private updateCvcVolume(newVolume: number) {
        if (this.normalizeCvcStreamVolume(this.stream.volume) === newVolume) return

        this.stream.is_muted && this.stream.change_is_muted(false)
        this.stream.volume = this.normalizedVolumeToCvcStreamVolume(newVolume)
        this.stream.push_volume()

        this.volume = newVolume
        this.onVolumeChanged(this.volume)
    }

    private updateMprisVolume(newVolume: number) {
        if (this.normalizeMprisVolume(this.mediaServerPlayer.Volume) === newVolume) return

        this.mediaServerPlayer.Volume = this.normalizedVolumeToMprisVolume(newVolume)
        // As both targets are synced, it doesn't matter where to set this.volume and calling the cb function 
        this.volume = newVolume
        this.onVolumeChanged(this.volume)
    }


    private updateVolume(target: UpdateTarget, newVolume: number) {

        const realNewVolume = Math.min(MAX_VOLUME, Math.max(0, newVolume));

        (target === "cvcStream") ?
            this.updateCvcVolume(realNewVolume) : this.updateMprisVolume(realNewVolume)
    }



    public get currentSong() {
        if (this.playbackStatus === "Stopped") return

        return this.mediaServerPlayer.Metadata["xesam:title"].unpack()


    }
}