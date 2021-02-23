const { spawnCommandLine } = imports.misc.util;
const Cvc = imports.gi.Cvc; // sse https://gitlab.gnome.org/GNOME/libgnome-volume-control/blob/master/gvc-mixer-control.h
const { getDBusProxyWithOwnerPromise, getDBusPropertiesPromise, getDBusPromise } = require('./utils')

const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value

// See: https://specifications.freedesktop.org/mpris-spec/2.2/Player_Interface.html
// I think Methods always need a "Remote" as suffix to work
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`


class MpvPlayerHandler {

    constructor({ mprisPluginPath, _handleRadioStopped, _getInitialVolume, _handleVolumeChanged }) {
        Object.assign(this, arguments[0])
    }

    async init() {

        this._dbus = await getDBusPromise()
        this._mediaServerPlayer = await getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME)
        this._mediaProps = await getDBusPropertiesPromise(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)

        const mpvRunning = (await this._getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)

        this.stopped = mpvRunning ? false : true

        if (mpvRunning) {
            this.stopped = false
            await this._watchStreamAdded()
        } else {
            this.stopped = true
            this._watchStreamAdded()
        }

        this._listenToMediaPropsChanges() // must be after stream init for some reason
        this._listenToRadioStopped()
    }

    // Method updates the stream as soon as a MPV Stream is added. Needs only to be called once - resolving in case it is necessary to ensure that this._stream is not null
    _watchStreamAdded() {
        this._control = new Cvc.MixerControl({ name: 'Radio' });
        this._control.open();

        return new Promise((resolve, reject) => {
            this._control.connect('stream-added', (control, id) => {
                const stream = this._control.lookup_stream_id(id);
                if (!stream) return
                if (stream.name === "mpv Media Player") {
                    this._stream = stream
                    // volume is not mandatory the same as in MPRIS
                    const mprisVolume = Math.round(this._mediaServerPlayer.Volume * 100)
                    this._updateVolume({ updateTarget: "cvcStream", newVolume: mprisVolume })
                    this._stream.connect("notify::volume", () => {
                        this._handleCvcVolumeChanged()
                    })
                    resolve()
                }
            })
        })
    }

    _getMetadata() {
        return this._mediaServerPlayer.Metadata
    }

    _handleCvcVolumeChanged() {
        const newVolume = this._normalizeStreamVolume(this._stream.volume)
        if (this._volume != newVolume) {
            this._updateVolume({ updateTarget: "mpris", newVolume: newVolume })
        }
    }

    // converts the Stream Volume to a Number between 0 and 100 (as Integer)
    _normalizeStreamVolume(streamVolume) {
        return Math.round(streamVolume / this._control.get_vol_max_norm() * 100)
    }

    // convert normalized Volume (0-100) to Stream volume
    _normalizedVolumeToStreamVolume(volume) {
        return volume / 100 * this._control.get_vol_max_norm()

    }

    // theoretically it should also be possible to listen to props.PlaybackStatus but this doesn't work. 
    // Probably because of this: https://github.com/hoyon/mpv-mpris/issues/22 (not sure though)
    _listenToRadioStopped() {
        this._dbus.connectSignal('NameOwnerChanged',
            (proxy, sender, [name, old_owner, new_owner]) => {
                if (name === MPV_MPRIS_BUS_NAME && !new_owner) {
                    // this is a workaround as .getPlaybackStatus() still returns 'playing' for a short moment.
                    this.stopped = true
                    this._handleRadioStopped(this._volume)
                }
            }
        );
    }

    _listenToMediaPropsChanges() {

        let previousUrl
        this._mediaProps.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {

            // this method is sometimes called after the radio has stopped when another player (at least vlc) makes some changes. TODO: proper fix
            if (this.stopped) return

            if (props.Volume) this._handleMprisVolumeChanged(props)

            if (props.Metadata) {
                const metadata = props.Metadata.deep_unpack()
                const newUrl = metadata["xesam:url"].unpack()
                if (newUrl !== previousUrl) {
                    // this is executed when radio channel changes but not when radio starts
                    this._updateVolume({ updateTarget: "Both", newVolume: this._volume })
                    this._handleRadioChannelChangedPaused(newUrl)
                    previousUrl = newUrl
                }
            }

            if (props.PlaybackStatus) {
                // this is executed when radio starts, pauses and resume play but (unfortunately) not when stopped or channel changed
                this._updateVolume({ updateTarget: "Both", newVolume: this._volume })
                this._handleRadioChannelChangedPaused(this.getRunningRadioUrl())
            }
        })
    }

    _handleMprisVolumeChanged(props) {
        let newVolume = Math.round(props.Volume.unpack() * 100)

        if (newVolume > MAX_VOLUME) {
            this._updateVolume({ updateTarget: "Both", newVolume: MAX_VOLUME })
            return
        }

        if (newVolume != this._volume) {
            this._updateVolume({ updateTarget: "cvcStream", newVolume: newVolume })
        }
    }

    // Stops all running media outputs except MPV
    async _stopAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await this._getAllMrisPlayerBusNames()

        allMprisPlayerBusNames.forEach(async busName => {
            if (busName != MPV_MPRIS_BUS_NAME) {
                const mediaServerPlayer = await getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, busName)
                mediaServerPlayer.StopRemote()
            }
        })
    }

    _getAllMrisPlayerBusNames() {
        const name_regex = /^org\.mpris\.MediaPlayer2\./;

        return new Promise((resolve, reject) => {
            this._dbus.ListNamesRemote(names => {
                const busNames = names[0].filter(busName => name_regex.test(busName))
                const busNamesArr = Object.values(busNames)
                resolve(busNamesArr)
            })
        })
    }

    _updateVolume({ updateTarget, newVolume }) {

        if (updateTarget === "cvcStream") this._updateCvcStreamVolume(newVolume)
        if (updateTarget === "mpris") this._mediaServerPlayer.Volume = newVolume / 100
        if (updateTarget === "Both") {
            this._updateCvcStreamVolume(newVolume)
            this._mediaServerPlayer.Volume = newVolume / 100
        }

        this._handleVolumeChanged(newVolume)
        this._volume = newVolume

    }

    _updateCvcStreamVolume(newVolume) {

        if (this._stream.is_muted) this._stream.change_is_muted(false)

        this._stream.volume = this._normalizedVolumeToStreamVolume(newVolume)
        this._stream.push_volume();
    }

    startChangeRadioChannel(channelUrl) {

        this._stopAllOtherMediaPlayer()

        if (this.stopped) {

            this.stopped = false
            const command = `mpv --script=${this.mprisPluginPath} ${channelUrl} --volume=${this._getInitialVolume()}`
            spawnCommandLine(command)

        } else {
            this._mediaServerPlayer.PlayRemote(); // ensures that the method is working when radio is paused. Has no effect if playing/stopped 
            // this actually should also work when no radio is playing but it doesn't (probably due to --script)
            this._mediaServerPlayer.OpenUriRemote(channelUrl)
        }

        // only in case of an error the mpv player doesn't play after 2 secs
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                (!this.stopped) ? resolve() : reject()
            }, 2000)
        })
    }

    // returns true when volume changed and false if not. This is the case when the increased volume would be higher than the max volume or lower than zero
    increaseDecreaseVolume(amount) {

        if (this.stopped) { return "" }

        let volumeChanged = false
        const newVolume = Math.min(MAX_VOLUME, Math.max(0, this._volume + amount))

        if (newVolume !== this._volume) {
            volumeChanged = true
            this._updateVolume({ updateTarget: "Both", newVolume: newVolume })
        }

        return volumeChanged
    }

    stopRadio() {
        if (this.stopped) return
        this._mediaServerPlayer.StopRemote()
    }

    getRunningRadioUrl() {
        if (this.stopped) return

        const radioUrl = this._getMetadata() ? this._getMetadata()["xesam:url"].unpack() : false
        return radioUrl
    }

    getPlaybackStatus() {
        if (this.stopped) { return "Stopped" }
        return this._mediaServerPlayer.PlaybackStatus
    }

    getCurrentSong() {
        if (this.stopped) { return "" }
        return (this._getMetadata()["xesam:title"].unpack())
    }
}