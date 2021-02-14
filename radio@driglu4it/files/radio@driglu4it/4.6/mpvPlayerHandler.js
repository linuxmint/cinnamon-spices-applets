const { spawnCommandLine } = imports.misc.util;
const { getDBusProxyWithOwner, getDBusProperties, getDBus, ListNamesRemote } = imports.misc.interfaces;
const Cvc = imports.gi.Cvc;

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
        this._volume = this._getInitialVolume()
    }

    async init() {
        this._initDbus() // used to to check if mpv is running

        if (this._checkMpvRunning()) {
            this._initMpris()
            await this._initCvcSteam()

            // updating the volume has several benefits: cvcStream and mpris is synched, handleVolumeChanged function is executed and it is ensured that the volume is not above the maxVolume
            this._updateVolume({
                updateTarget: "Both",
                newVolume: Math.min(this._mediaServerPlayer.Volume * 100, MAX_VOLUME)
            })
        } else {
            this._dbus = null
        }
    }

    _initAllInterfaces() {
        this._initMpris()
        this._initDbus()
        this._initCvcSteam()
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

    async _initCvcSteam() {

        this._control = new Cvc.MixerControl({ name: 'Radio' });
        this._control.open();

        this._stream = await this._getCvcStream()
        this._stream.connect("notify::volume", () => {
            this._handleCvcVolumeChanged()
        })

    }


    _getCvcStream() {
        return new Promise((resolve, reject) => {
            this._control.connect('stream-added', (control, id) => {
                const stream = this._control.lookup_stream_id(id);
                if (!stream) return
                if (stream.name === "mpv Media Player") resolve(stream)
            })
        })
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
    // Probably because of this: https://github.com/hoyon/mpv-mpris/issues/22 (not sure though)
    _listenToRadioStopped() {
        this._dbus.connectSignal('NameOwnerChanged',
            (proxy, sender, [name, old_owner, new_owner]) => {
                if (name === MPV_MPRIS_BUS_NAME && !new_owner) {
                    this._mediaServerPlayer = this._mediaProps = this._dbus = null
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

        let previousUrl

        this._mediaProps.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {

            if (props.Volume) this._handleMprisVolumeChanged(props)

            if (props.Metadata) {
                const metadata = props.Metadata.deep_unpack()
                const newUrl = metadata["xesam:url"].unpack()
                if (newUrl !== previousUrl) this._handleRadioChannelChangedPaused(newUrl)
            }

            if (props.PlaybackStatus) {
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
        if (updateTarget === "cvcStream") this._updateCvcStreamVolume(newVolume)
        if (updateTarget === "mpris") this._mediaServerPlayer.Volume = newVolume / 100
        if (updateTarget === "Both") {
            this._updateCvcStreamVolume(newVolume)
            this._mediaServerPlayer.Volume = newVolume / 100
        }

        this._handleVolumeChanged(false, newVolume)
        this._volume = newVolume
    }

    _updateCvcStreamVolume(newVolume) {
        this._stream.volume = this._normalizedVolumeToStreamVolume(newVolume)
        this._stream.push_volume();
    }

    async startChangeRadioChannel(channelUrl) {

        if (this._mediaServerPlayer === null) { this._initAllInterfaces() }

        this._stopAllOtherMediaPlayer()

        if (!await this._checkMpvRunning()) {
            this._volume = this._getInitialVolume()
            // without --volume it would be used 100
            spawnCommandLine(`mpv --script=${this.mprisPluginPath} ${channelUrl} --volume=${this._volume}`)
        } else {
            this._mediaServerPlayer.PlayRemote(); // ensures that the method is working when radio is paused. Has no effect if playing/stopped 
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
    increaseDecreaseVolume(amount) {

        if (!this._mediaServerPlayer) return

        let volumeChanged = false
        const newVolume = Math.min(MAX_VOLUME, Math.max(0, this._volume + amount))

        if (newVolume !== this._volume) {
            volumeChanged = true
            this._updateVolume({ updateTarget: "Both", newVolume: newVolume })
        }

        return volumeChanged
    }

    stopRadio() {
        if (!this._mediaServerPlayer) { return "" }

        this._mediaServerPlayer.StopRemote()
    }

    getRunningRadioUrl() {

        if (!this._mediaServerPlayer) { return "" }

        const radioUrl = this._getMetadata() ? this._getMetadata()["xesam:url"].unpack() : false
        return radioUrl
    }

    // TODO: with proper JS getter setter
    getPlayPauseStatus() {
        if (!this._mediaServerPlayer) { return "Stopped" }
        return this._mediaServerPlayer.PlaybackStatus
    }

    getCurrentSong() {
        if (!this._mediaServerPlayer) { return "" }

        return (this._getMetadata()["xesam:title"].unpack())
    }
}