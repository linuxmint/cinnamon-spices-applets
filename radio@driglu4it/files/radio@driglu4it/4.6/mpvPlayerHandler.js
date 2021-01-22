const { spawnCommandLine } = imports.misc.util;
const { getDBusProxyWithOwner, getDBusProperties, getDBus, ListNamesRemote } = imports.misc.interfaces;
const Cvc = imports.gi.Cvc;

const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value

// See: https://specifications.freedesktop.org/mpris-spec/2.2/Player_Interface.html
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`


class MpvPlayerHandler {

    constructor({ mprisPluginPath, _handleRadioStopped, _getInitialVolume }) {

        Object.assign(this, arguments[0])

        this._initMpris()
        this._volume = this._checkMpvRunning() ? this._mediaServerPlayer.Volume * 100 : this._getInitialVolume()
        this._initCvcSteam() // We need this to sync the volume in the sound applet with the mpris volume. See: https://github.com/linuxmint/cinnamon/issues/9770
        this._initDbus()
    }

    _getMetadata() {
        return this._mediaServerPlayer.Metadata
    }

    _initMpris() {
        this._mediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME)
        this._mediaProps = getDBusProperties(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)
        this._listenToMediaPropsChanges()
    }

    _initDbus() {
        this._dbus = getDBus()
        this._listenToRadioStopped()
    }

    _initCvcSteam() {
        this._control = new Cvc.MixerControl({ name: 'Radio' });
        this._control.connect('stream-added', (control, id) => {
            // this is executed each time when starting or changing a radio stream
            const stream = this._control.lookup_stream_id(id);
            if (stream.name === "mpv Media Player") {
                // by default it is used the volume from the last time MPV was used. 
                this._stream = stream
                if (this._normalizeStreamVolume(this._stream.volume) != this._volume) {
                    this._updateVolume({ updateTarget: "cvcStream", newVolume: this._volume })
                }

                this._stream.connect("notify::volume", () => {
                    this._handleCvcVolumeChanged()
                })
            }
        })
        this._control.open();
    }

    _handleCvcVolumeChanged() {
        const newVolume = this._normalizeStreamVolume(this._stream.volume)
        if (this._volume != newVolume) {
            this._updateVolume({ updateTarget: "mpris", newVolume: newVolume })
        }
    }

    // converts the Stream Volume to a Number between 0 and 100 (as Integer)
    _normalizeStreamVolume(streamVolume) {
        // plus 1 as parseInt rounds to next lower number
        return parseInt(streamVolume / this._control.get_vol_max_norm() * 100 + 1)
    }

    // convert normalized Volume (0-100) to Stream volume
    _normalizedVolumeToStreamVolume(volume) {
        return volume / 100 * this._control.get_vol_max_norm()
    }

    // theoretically it should also be possible to listen to props.PlaybackStatus but this doesn't work. 
    // Probably because the mpv process is immediately killed when stopped as it is started headless  
    _listenToRadioStopped() {
        this._dbus.connectSignal('NameOwnerChanged',
            (proxy, sender, [name, old_owner, new_owner]) => {
                if (name === MPV_MPRIS_BUS_NAME && !new_owner) {
                    this._handleRadioStopped(this._volume)
                }
            }
        );
    }

    async _checkMpvRunning() {
        const mpvRunning = (await this._getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)
        return mpvRunning
    }

    _listenToMediaPropsChanges() {
        this._mediaProps.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {

            if (props.Volume) this._handleMprisVolumeChanged(props)

            // if (props.PlaybackStatus) {
            //     if (props.PlaybackStatus.unpack() === "Paused") {
            //         // when paused . TODO
            //     }
            // }
        })
    }

    _handleMprisVolumeChanged(props) {
        const newVolume = props.Volume.unpack() * 100
        if (newVolume != this._volume) {
            this._updateVolume({ updateTarget: "cvcStream", newVolume: newVolume })
        }
    }

    // Stops all running media outputs (which can be controlled via MPRIS) - not only potentially running radio streams
    async _stopAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await this._getAllMrisPlayerBusNames()

        allMprisPlayerBusNames.forEach(busName => {
            if (busName != MPV_MPRIS_BUS_NAME) {
                const mediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, busName)
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
        if (updateTarget === "cvcStream") {
            this._updateCvcStreamVolume(newVolume)
        } else if (updateTarget === "mpris") {
            this._mediaServerPlayer.Volume = newVolume / 100
        } else {
            this._updateCvcStreamVolume(newVolume)
            this._mediaServerPlayer.Volume = newVolume / 100
        }
        this._volume = newVolume

    }

    _updateCvcStreamVolume(newVolume) {
        this._stream.volume = this._normalizedVolumeToStreamVolume(newVolume)
        this._stream.push_volume();
    }

    async startChangeRadioChannel(channelUrl) {

        this._stopAllOtherMediaPlayer()

        if (!await this._checkMpvRunning()) {
            this._volume = this._getInitialVolume()
            // without --volume it would be used 100
            spawnCommandLine(`mpv --script=${this.mprisPluginPath} ${channelUrl} --volume=${this._volume}`)
        } else {
            // this actually should also work when no radio is playing but it doesn't (probably due to --script)
            this._mediaServerPlayer.OpenUriRemote(channelUrl)
        }

        // only in case of an error the mpv player doesn't play after 2 secs
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                (await this._checkMpvRunning()) ? resolve() : reject()
            }, 2000)
        })
    }

    // returns true when volume changed and false if not. This is the case when the increased volume would be higher than the max volume or lower than zero
    // TODO: shouldn'T be allowed when radio isn't running
    increaseDecreaseVolume(amount) {

        let volumeChanged = false
        const newVolume = Math.min(MAX_VOLUME, Math.max(0, this._volume + amount))

        if (newVolume !== this._volume) {
            volumeChanged = true
            this._updateVolume({ updateTarget: "Both", newVolume: newVolume })
        }

        return volumeChanged
    }

    stopRadio() {
        this._mediaServerPlayer.StopRemote()
    }

    getRunningRadioUrl() {
        const radioUrl = this._getMetadata() ? this._getMetadata()["xesam:url"].unpack() : false
        return radioUrl
    }

    getCurrentSong() {
        return (this._getMetadata()["xesam:title"].unpack())
    }
}