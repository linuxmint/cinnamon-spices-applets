const { spawnCommandLine } = imports.misc.util;
const { getDBusProxyWithOwner, getDBusProperties, getDBus, ListNamesRemote } = imports.misc.interfaces;

const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value

// See: https://specifications.freedesktop.org/mpris-spec/2.2/Player_Interface.html
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`


class MpvPlayerHandler {

    constructor({ mprisPluginPath, handleRadioStopped, initialVolume }) {
        Object.assign(this, arguments[0])

        this._mediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME)
        this._metadata = () => { return this._mediaServerPlayer.Metadata }
        this._dbus = getDBus()
        this._listenToRadioStopped()

        // This allows us to listen to play/pause or volume changes. 
        // Will Be used in future!
        // this._mediaProps = getDBusProperties(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH)
        // this._listenToMediaPropsChanges()
    }

    // theoretically it should also be possible to listen to props.PlaybackStatus but this doesn't work. 
    // Probably because the mpv process is immediately killed when stopped as it is started headless  
    _listenToRadioStopped() {
        this._dbus.connectSignal('NameOwnerChanged',
            (proxy, sender, [name, old_owner, new_owner]) => {
                if (name === MPV_MPRIS_BUS_NAME && !new_owner) {
                    this.handleRadioStopped()
                }
            }
        );
    }

    async _checkMpvRunning() {
        const mpvRunning = (await this._getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)
        return mpvRunning
    }

    // Will Be used in future!
    // _listenToMediaPropsChanges() {
    //     // this._mediaProps.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {

    //     //     if (props.Volume) {
    //     //         const volume = props.Volume.unpack()
    //     //         // TODO ... 
    //     //     }


    //     //     if (props.PlaybackStatus) {
    //     //         // when paused
    //     //         const playPause = props.PlaybackStatus.unpack()

    //     //     }
    //     // })
    // }


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

    async startChangeRadioChannel(channelUrl) {

        this._stopAllOtherMediaPlayer()

        if (!await this._checkMpvRunning()) {
            spawnCommandLine(`mpv --script=${this.mprisPluginPath} ${channelUrl} --volume=${this.initialVolume}`)
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

    // returns true when volume changed and false if not. This is the case when the increased volume would be higher than the max volume
    increaseDecreaseVolume(amount) {
        let volumeChanged = false
        const newVolume = this._mediaServerPlayer.Volume * 100 + amount

        if (newVolume <= MAX_VOLUME) {
            volumeChanged = true
            this._mediaServerPlayer.Volume = newVolume / 100
        }

        return volumeChanged
    }

    stopRadio() {
        this._mediaServerPlayer.StopRemote()

    }

    getRunningRadioUrl() {
        const radioUrl = this._metadata() ? this._metadata()["xesam:url"].unpack() : false
        return radioUrl
    }

    getCurrentSong() {
        return (this._metadata()["xesam:title"].unpack())
    }
}
