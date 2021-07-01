import { MEDIA_PLAYER_2_PLAYER_NAME, MEDIA_PLAYER_2_PATH, MPV_MPRIS_BUS_NAME, MPV_CVC_NAME } from 'consts'
import { reject } from 'lodash';
import { MprisMetadataRecursiveUnpacked, MprisPropertiesDeepUnpacked, MprisPropertiesPacked, PlaybackStatus, MprisPropsDbus, MprisMediaPlayerDbus } from 'MprisTypes';
const fs = require('fs')

const EXAMPLE_TITLE_1 = 'dummy Title'
const EXAMPLE_TITLE_2 = 'dummy Title2'


const { Variant } = imports.gi.GLib

interface MpvStartArguments {
    url: string,
    /** in percent */
    volume: number,
    simulateLoading?: boolean,
    cvcVolMax?: number
}

type MprisPropertiesDeepUnpackedWriteable = {
    -readonly [P in keyof MprisPropertiesDeepUnpacked]: MprisPropertiesDeepUnpacked[P]
}

interface Arguments {
    loadingTime: number,
}

type NameOwnerChangedCallback = Parameters<imports.misc.interfaces.DBus["connectSignal"]>[1]

type PropertiesChangedCallback = Parameters<MprisPropsDbus["connectSignal"]>[1]

type SeekedCallback = Parameters<MprisMediaPlayerDbus["connectSignal"]>[1]

type StreamAddedCallback = Parameters<imports.gi.Cvc.MixerControl["connect"]>[1]

type CvcVolumeCallback = Parameters<imports.gi.Cvc.MixerStream["connect"]>[1]

export function initMprisMocks(args: Arguments) {

    const {
        loadingTime
    } = args

    // not 100 % correct as it is in reality possible to connect multiple times to a Dbus interface
    let propertiesChangedCallback: PropertiesChangedCallback
    let nameOwnerChangedCallback: NameOwnerChangedCallback
    let seekedCallback: SeekedCallback
    let streamAddedCallback: StreamAddedCallback
    let CvcVolumeCallback: CvcVolumeCallback

    let mediaPropsDbus: MediaPropsDbus
    let mpvProps: Partial<MprisPropertiesDeepUnpackedWriteable>
    let dbus: DBus

    let positionTimerId: ReturnType<typeof setInterval>

    let cvcVolMaxNorm: number
    let busNames = []


    // seems to be always the same ...
    const trackId = '/0'
    const cvcMpvId = Math.floor(Math.random() * 100)
    let cvcControl: MixerControl
    let cvcStream: MixerStream


    function startPositionTimer() {
        positionTimerId = setInterval(() => {
            mpvProps.Position = mpvProps.Position + 1000
        }, 1);
    }


    function getDBusProxyWithOwner(name: string, path: string) {
        if (name !== MEDIA_PLAYER_2_PLAYER_NAME || path !== MPV_MPRIS_BUS_NAME) {
            throw new Error(`getDBusProxyWithOwnerAsync called with wrong arguments`);
        }

        return new MediaServerPlayerDbus()
    }

    function getDBusProperties(name: string, path: string) {
        if (name !== MPV_MPRIS_BUS_NAME || path !== MEDIA_PLAYER_2_PATH) {
            throw new Error('getDBusPropertiesAsync called with wrong arguments')
        }

        mediaPropsDbus = new MediaPropsDbus()
        return mediaPropsDbus
    }

    function getDbus() {
        return new DBus()
    }

    function spawnCommandLine(command: string) {
        const commandArr = command.split(' ')

        if (commandArr[0] !== 'mpv') throw new Error("First word must be mpv");

        const volumeStr = commandArr.find(str => str.startsWith("--volume="));
        const scriptStr = commandArr.find(str => str.startsWith("--script="));
        const url = commandArr.find(str => str.startsWith("http"))

        const optionValueMap = new Map();

        [volumeStr, scriptStr].forEach(str => {
            const optionValue = str.split('=');
            optionValueMap.set(optionValue[0], optionValue[1])
        })

        const volume = parseInt(optionValueMap.get('--volume'))

        checkVolume(volume)

        function checkVolume(volume: number) {
            if (!volume) throw new Error("volume not given");
            if (volume < 0) throw new Error('volume below 0')
            if (volume < 1) console.log(`volume very low. Did you use fraction instead of percent?`)
            if (volume > 100) throw new Error("volume above recommended maximum");
        }


        if (!fs.existsSync(optionValueMap.get('--script'))) throw new Error("Script path doesn't exist");

        simulateMpvStart({ url, volume })
    }

    function emitPropertiesChanged(changedProperties: Partial<MprisPropertiesPacked>): void {

        mpvProps.Metadata = { ...mpvProps.Metadata, ...changedProperties.Metadata?.deepUnpack() }

        const newPlaybackStatus = changedProperties.PlaybackStatus?.unpack()
        const newVolume = changedProperties.Volume?.unpack()
        const position = changedProperties.Position?.unpack()

        if (newPlaybackStatus)
            mpvProps.PlaybackStatus = newPlaybackStatus

        if (newVolume)
            mpvProps.Volume = newVolume

        if (position)
            mpvProps.Position = position

        // @ts-ignore (error because the mocked mediaPropsDbus doesn't have all methods included in the tpye but apart from that, it is right)
        propertiesChangedCallback?.(mediaPropsDbus, '1.2646', ['org.mpris.MediaPlayer2.Player', changedProperties, []])

    }

    async function simulateMpvStart(args: MpvStartArguments): Promise<void> {
        const {
            url,
            volume,
            simulateLoading = true,
            cvcVolMax = 65536
        } = args

        cvcVolMaxNorm = cvcVolMax

        busNames.push(MPV_MPRIS_BUS_NAME)

        // @ts-ignore
        nameOwnerChangedCallback?.(dbus, 'org.freedesktop.DBus', [MPV_MPRIS_BUS_NAME, "", ":1.1491"])
        // @ts-ignore

        streamAddedCallback?.(cvcControl, cvcMpvId)

        cvcStream = new MixerStream()

        const initialPropertyChange: Partial<MprisPropertiesPacked> = {
            Volume: Variant.new_double(volume / 100),
            Metadata: new Variant('a{sv}', {
                "mpris:trackid": Variant.new_string(trackId),
                "xesam:title": Variant.new_string(EXAMPLE_TITLE_1),
                "xesam:url": Variant.new_string(url),
            }),
            PlaybackStatus: Variant.new_string("Playing")
        }

        mpvProps.Position = 0
        emitPropertiesChanged(initialPropertyChange)

        return new Promise((resolve, reject) => {
            if (!simulateLoading) {
                resolve()
                return
            }

            setTimeout(() => {
                const proteryChangesAfterLoading: Partial<MprisPropertiesPacked> = {
                    Metadata: new Variant('a{sv}', {
                        "xesam:url": Variant.new_string('dummy'),
                        "mpris:length": Variant.new_double(731428),
                        "xesam:title": Variant.new_string(EXAMPLE_TITLE_2)
                    })
                }
                startPositionTimer()

                emitPropertiesChanged(proteryChangesAfterLoading)
                resolve()
            }, loadingTime);

        })
    }

    function simulateTitleChanged() {
        const propertyChange: Partial<MprisPropertiesPacked> = {
            Metadata: new Variant('a{sv}', {
                'xesam:title': Variant.new_string(EXAMPLE_TITLE_1)
            })
        }

        emitPropertiesChanged(propertyChange)
    }

    function resetInterfaces() {
        propertiesChangedCallback = null
        nameOwnerChangedCallback = null
        seekedCallback = null
        streamAddedCallback = null
        CvcVolumeCallback = null
        mediaPropsDbus = null
        mpvProps = {
            PlaybackStatus: 'Stopped',
            Metadata: {},
            Volume: null
        }
        dbus = null
        cvcVolMaxNorm = null
        busNames = []
        cvcControl = null
        cvcStream = null

        if (positionTimerId) {
            clearInterval(positionTimerId)
            positionTimerId = null
        }

    }

    class MediaServerPlayerDbus {

        #signalId: number

        public StopSync() {
            busNames = []
            //@ts-ignore
            nameOwnerChangedCallback?.(dbus, 'org.freedesktop.DBus', [MPV_MPRIS_BUS_NAME, ":1.1401", ""])
        }

        get PlaybackStatus() {
            return mpvProps.PlaybackStatus
        }

        get Volume() {
            return mpvProps.Volume
        }

        set Volume(volume) {

            if (volume === mpvProps.Volume) {
                global.log('Attempts to set volume to same value is ignored from Dbus')
                return
            }

            const propertyChange: Partial<MprisPropertiesPacked> = {
                Volume: Variant.new_double(volume)
            }

            emitPropertiesChanged(propertyChange)
        }

        get Metadata() {
            return mpvProps?.Metadata
        }

        public PauseSync() {
            const propertyChange: Partial<MprisPropertiesPacked> = {
                PlaybackStatus: Variant.new_string('Paused')
            }
            emitPropertiesChanged(propertyChange)
        }

        public async OpenUriRemote(url: string): Promise<void> {
            const initialPropertyChange: Partial<MprisPropertiesPacked> = {
                Metadata: new Variant('a{sv}', {
                    "xesam:url": Variant.new_string(url),
                    "mpris:trackid": Variant.new_string(trackId),
                    "xesam:title": Variant.new_string(EXAMPLE_TITLE_1)
                })
            }

            emitPropertiesChanged(initialPropertyChange)

            return new Promise((resolve) => {
                setTimeout(() => {
                    const proteryChangesAfterLoading: Partial<MprisPropertiesPacked> = {
                        Metadata: new Variant('a{sv}', {
                            "xesam:url": Variant.new_string('dummy'),
                            "mpris:trackid": Variant.new_string(trackId),
                            "xesam:title": Variant.new_string(EXAMPLE_TITLE_2),
                            "mpris:length": Variant.new_double(744000)
                        })
                    }
                    emitPropertiesChanged(proteryChangesAfterLoading)
                    resolve()
                }, loadingTime);
            })
        }

        constructor() {

        }

        connectSignal(signal: string, cb: SeekedCallback) {
            if (signal !== 'Seeked')
                throw new RangeError('signal must be Seeked')

            seekedCallback = cb
            this.#signalId = Math.floor(Math.random() * 100)

            return this.#signalId
        }

        disconnectSignal(signalId: number) {

        }
    }

    class MediaPropsDbus {

        #signalId: number

        connectSignal(signal: string, cb: PropertiesChangedCallback) {

            if (signal !== 'PropertiesChanged')
                throw new RangeError('signal must be PropertiesChanged')

            propertiesChangedCallback = cb

            this.#signalId = Math.floor(Math.random() * 100)

            return this.#signalId
        }

        disconnectSignal(signalId: number) {

        }

        GetSync(interfaceName, propertyName) {
            if (interfaceName !== MEDIA_PLAYER_2_PLAYER_NAME)
                throw new RangeError(`interface name must be ${MEDIA_PLAYER_2_PLAYER_NAME}`)

            if (propertyName === 'Position') {

                if (mpvProps.Position == null)
                    throw new Error('position not given')
                return [Variant.new_double(mpvProps.Position)]
            } else {
                throw new Error('not yet mocked')
            }

        }

    }

    class DBus {

        connectSignal(signal: string, cb: NameOwnerChangedCallback) {
            if (signal !== 'NameOwnerChanged')
                throw new RangeError('signal must be PropertiesChanged')

            nameOwnerChangedCallback = cb
        }

        ListNamesSync() {
            return [busNames]
        }
    }

    class MixerControl {

        #isOpen = false

        lookup_stream_id(id: number) {
            if (id === cvcMpvId)
                return cvcStream
        }

        get_vol_max_norm() {
            return cvcVolMaxNorm
        }

        open() {
            this.#isOpen = true
        }

        connect(signal: string, cb: StreamAddedCallback) {

            if (!this.#isOpen)
                throw new Error('run MixerControl.open() before connecting to signal!')

            streamAddedCallback = cb

            if (mpvProps.PlaybackStatus !== 'Stopped')
                // @ts-ignore 
                streamAddedCallback(this, cvcMpvId)
        }

    }

    class MixerStream {
        name = MPV_CVC_NAME
        #unpushedVolume
        #pushedVolume


        get volume() {
            return this.#pushedVolume
        }

        set volume(newVolume: number) {
            this.#unpushedVolume = newVolume
        }

        push_volume() {
            this.#pushedVolume = this.#unpushedVolume
        }

        connect(signal: string, cb: CvcVolumeCallback) {
            CvcVolumeCallback = cb
        }


    }


    imports.misc.interfaces.getDBusProxyWithOwner = getDBusProxyWithOwner
    imports.misc.interfaces.getDBusProperties = getDBusProperties
    // @ts-ignore
    imports.misc.interfaces.getDBus = getDbus
    // @ts-ignore
    imports.misc.util.spawnCommandLine = spawnCommandLine
    // @ts-ignore
    imports.gi.Cvc.MixerControl = MixerControl

    resetInterfaces()

    return {
        simulateMpvStart,
        simulateTitleChanged,
        resetInterfaces
    }
}




