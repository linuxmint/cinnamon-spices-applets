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


type VolumeUpdateTarget = "cvcStream" | "mpris" | "both"


interface MetaValue {
    unpack: { (): string }
}

// these are the values which playerctl returns (not mandatory complete)
interface Metadata {
    ["xesam:title"]: MetaValue,
    ["mpris:trackid"]: MetaValue,
    ["xesam:url"]: MetaValue,
    ["mpris:length"]: MetaValue
}

interface MprisMediaPlayer {
    Volume: number
    Metadata: Metadata
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
    onChannelChanged: { (newUrl: string, oldUrl?: string): void },
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
    private _volume: number
    public initialVolume: number
    private _playbackStatus: PlaybackStatus

    private _validUrls: string[]
    public currentUrl: string

    private onVolumeChanged: { (newVolume: number): void }
    private onStarted: { (channelUrl: string): void }
    private onChannelChanged: { (oldUrl: string, newUrl: string): void }
    private onPaused: { (channelUrl: string): void }
    private onStopped: { (stoppedUrl: string): void }
    private onResumed: { (channelUrl: string): void }

    private propsChangeListener: Function

    public constructor(args: Arguments) {

        const { validUrls, ...others } = args

        this._validUrls = validUrls
        Object.assign(this, others)
    }

    public async init() {

        this.dbus = await getDBusPromise()
        this.mediaServerPlayer = await getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME)
        this.mediaProps = await getDBusPropertiesPromise(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)

        const mpvRunning = (await this.getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)

        if (mpvRunning) {
            this._playbackStatus = this.mediaServerPlayer.PlaybackStatus
            this.propsChangeListener = this.initMediaPropsChangeListener()
            this._volume = this.normalizeMprisVolume(this.mediaServerPlayer.Volume)
        } else {
            this._playbackStatus = "Stopped"
            this.currentUrl = null
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
                this.updateCvcVolume(this.normalizeMprisVolume(this.mediaServerPlayer.Volume))

                this.stream.connect("notify::volume", () => {
                    this.handleCvcVolumeChanged()
                })
            }
        })
    }

    private handleCvcVolumeChanged() {

        const normalizedVolume = this.normalizeCvcStreamVolume(this.stream.volume)
        this.updateVolume('mpris', normalizedVolume)
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
                this._playbackStatus = "Stopped"
                this.onStopped(this.currentUrl)
                this.currentUrl = null
                this.mediaProps.disconnectSignal(this.propsChangeListener)
            }
        })
    }

    public set validUrls(urls: string[]) {
        this._validUrls = urls
        if (!this._validUrls.includes(this.currentUrl)) {
            this.stop()
        }
    }

    private handleMetadataChange(metadata: any) {

        const url = metadata["xesam:url"].unpack()

        if (url === this.currentUrl || !this._validUrls.includes(url)) {
            return
        }

        this._playbackStatus = this.mediaServerPlayer.PlaybackStatus
        this.currentUrl ? this.onChannelChanged(url, this.currentUrl) : this.onStarted(url)
        this.currentUrl = url

    }

    private handlePlaybackStatusChanged(playbackStatus: PlaybackStatus) {

        if (this._playbackStatus === playbackStatus) return
        this._playbackStatus = playbackStatus

        playbackStatus === "Paused" && this.onPaused(this.currentUrl)
        playbackStatus === "Playing" && this.onResumed(this.currentUrl)
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
        this._volume = this.initialVolume

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
        if (this._playbackStatus === "Stopped") return
        this.mediaServerPlayer.PlayPauseRemote()
    }

    public stop() {
        if (this._playbackStatus === "Stopped") return
        this.mediaServerPlayer.StopRemote()
    }

    private updateCvcVolume(newNormalizedVolume: number) {
        this.stream.is_muted && this.stream.change_is_muted(false)
        this.stream.volume = this.normalizedVolumeToCvcStreamVolume(newNormalizedVolume)
        this.stream.push_volume()
    }

    private updateMprisVolume(newNormalizedVolume: number) {
        this.mediaServerPlayer.Volume = this.normalizedVolumeToMprisVolume(newNormalizedVolume)
    }

    /**
     * @param newVolume: a value between 0 - 100
     */
    public set volume(newVolume: number) {
        this.updateVolume('both', newVolume)
    }

    public get volume() {
        return this._volume
    }

    private updateVolume(target: VolumeUpdateTarget, newVolume: number) {

        newVolume = Math.min(MAX_VOLUME, Math.max(0, newVolume))

        if (newVolume === this._volume || this.playbackStatus === "Stopped") return

        if (target === "cvcStream" || target === "both") {
            if (!this.stream || this.normalizeCvcStreamVolume(this.stream.volume) === newVolume) return
            this.updateCvcVolume(newVolume)
        }

        if (target === "mpris" || target === "both") {
            if (this.normalizeMprisVolume(this.mediaServerPlayer.Volume) === newVolume) return
            this.updateMprisVolume(newVolume)
        }

        this._volume = newVolume
        this.onVolumeChanged(newVolume)
    }


    public get currentSong() {
        if (this._playbackStatus === "Stopped") return

        return this.mediaServerPlayer.Metadata["xesam:title"].unpack()
    }

    public get playbackStatus() {
        return this._playbackStatus
    }


}