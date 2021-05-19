import { mapValues, isObject, merge } from 'lodash'
import { PlaybackStatus } from 'types';

// optimally these values would be used from constant but trying to import stuff from Constants throws an error which says that imports is undefined. Currently no idea how to fix that 
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";

export function clearInterfaces() {
    mediaPropsDbus = null
    mediaServerPlayerDbus = null
    propsChangedCallback = null
}

let mediaServerPlayerDbus: MediaServerPlayerDbus;
let mediaPropsDbus: MediaPropsDbus

let mediaProps: any

let propsChangedCallback: (arg1: any, arg2: any, arg3: any) => void;

export function emitPropsChanges(propChanges) {

    mediaProps = merge(mediaProps, propChanges)

    if (!propsChangedCallback) return

    propsChangedCallback('', '', ['', mapValues(propChanges, packProp)])
}

export function getDBusAsync() { }

export function getDBusProxyWithOwnerAsync(name: string, path: string, cb: (p: any, e: Error) => void) {

    if (name !== MEDIA_PLAYER_2_PLAYER_NAME || path !== MPV_MPRIS_BUS_NAME) {
        throw new Error(`getDBusProxyWithOwnerAsync called with wrong arguments`);
    }

    mediaServerPlayerDbus = new MediaServerPlayerDbus();

    setTimeout(() => {
        cb(mediaServerPlayerDbus, null)
    }, 100);

}

export function getDBusPropertiesAsync(name: string, path: string, cb: (p: any, e: Error) => void) {

    if (name !== MPV_MPRIS_BUS_NAME || path !== MEDIA_PLAYER_2_PATH) {
        throw new Error('getDBusPropertiesAsync called with wrong arguments')
    }

    mediaPropsDbus = new MediaPropsDbus();

    setTimeout(() => {
        cb(mediaPropsDbus, null)
    }, 100)

}

class MediaPropsDbus {

    constructor() { }

    connectSignal(signal: string, cb: any) {
        if (signal === 'PropertiesChanged') {
            propsChangedCallback = cb
        }

    }
}

class MediaServerPlayerDbus {


    constructor() { }

    get Volume() {
        return mediaProps?.Volume
    }

    get PlaybackStatus() {
        return mediaProps?.PlaybackStatus
    }

    set Volume(volume: number) {

        if (volume === mediaProps?.Volume) {
            throw new Error("attempt to set the volume to already set value");
        }
        this.checkPropsState()


        emitPropsChanges({ Volume: volume })
    }

    PauseRemote() {
        this.validatePlaybackChange('Paused')
        emitPropsChanges({ PlaybackStatus: 'Paused' })
    }

    PlayRemote() {
        this.validatePlaybackChange('Playing')
        emitPropsChanges({ PlaybackStatus: 'Playing' })
    }

    OpenUriRemote(url: string) {
        this.checkPropsState()

        const propsChange = {
            Metadata: {
                "mpris:trackid": "/-0",
                "xesam:title": "heavy-metal.m3u",
                "xesam:url": url
            }
        }
        emitPropsChanges(propsChange)
    }

    private validatePlaybackChange(newValue: PlaybackStatus) {
        if (mediaProps?.PlaybackStatus === newValue) {
            throw new Error(`radio already ${newValue}`
            );
        }
        this.checkPropsState()
    }

    private checkPropsState() {
        if (!mediaProps) throw new Error("Attempt to change a property before initialization");

    }

}

function packProp(prop) {

    const packedValue = isObject(prop) ? mapValues(prop, packProp) : prop

    // TODO: there is actually a difference between deep_unpack and unpack...
    // See: https://www.andyholmes.ca/articles/dbus-in-gjs.html
    return {
        deep_unpack: () => { return packedValue },
        unpack: () => { return packedValue },
        recursiveUnpack: () => { return prop }
    }
}