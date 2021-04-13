export type PlayPause = "Playing" | "Paused"
export type PlaybackStatus = PlayPause | "Stopped"

export interface Channel {
    name: string,
    url: string,
    inc: boolean
}

export type IconType = 'SYMBOLIC' | 'FULLCOLOR' | 'BICOLOR'

// not complety - only based on own experience 
type dbusEvents = "NameOwnerChanged"

export interface Dbus {
    connectSignal: {
        (
            event: dbusEvents,
            callback: { (proxy: any, sender: any, info: [string, string, string]): void }): void
    },
    ListNamesRemote: {
        (
            cb: { (name: string[][]): void }
        ): void
    }
}

interface MetaValue {
    unpack: { (): string }
}

// these are the values which playerctl returns (not mandatory complete)
export interface Metadata {
    ["xesam:title"]: MetaValue,
    ["mpris:trackid"]: MetaValue,
    ["xesam:url"]: MetaValue,
    ["mpris:length"]: MetaValue
}

export interface MediaProps<
    VolumeType = number,
    MetaType = Metadata,
    PlaybackType = PlaybackStatus
    > {
    Volume: VolumeType
    Metadata: MetaType
    PlaybackStatus: PlaybackType
    LoopStatus: any
    Shuffle: any
    Rate: any
}

interface MediaPropChange<T> {
    deep_unpack: { (): T }
}

export type MediaPropChanges = MediaProps<
    MediaPropChange<number>,
    MediaPropChange<Metadata>,
    MediaPropChange<PlaybackStatus>
>

export interface MprisMediaPlayer extends MediaProps {
    PlayRemote: { (): void }
    OpenUriRemote: { (uri: string): void }
    StopRemote: { (): void }
    PlayPauseRemote: { (): void }
    NextRemote: { (): void }
    PreviousRemote: { (): void }
    SetPositionRemote: Function
}

