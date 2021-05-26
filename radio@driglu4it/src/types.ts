export type PlayPause = "Playing" | "Paused"
export type PlaybackStatus = PlayPause | "Stopped"
export type AdvancedPlaybackStatus = PlaybackStatus | 'Loading'

export interface Channel {
    name: string,
    url: string,
    inc: boolean
}

export type IconType = 'SYMBOLIC' | 'FULLCOLOR' | 'BICOLOR'

interface MetaValue {
    unpack: { (): string }
}

// these are the values which playerctl returns (not mandatory complete)
export interface Metadata {
    ["xesam:title"]: string,
    ["mpris:trackid"]: string,
    ["xesam:url"]: string,
    ["mpris:length"]: number
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
    deep_unpack: { (): T },
    recursiveUnpack: { (): Metadata }
}

export type MediaPropChanges = MediaProps<
    MediaPropChange<number>,
    MediaPropChange<Metadata>,
    MediaPropChange<PlaybackStatus>
>

export interface MprisMediaPlayer extends MediaProps {
    PlayRemote: { (): void }
    PauseRemote: { (): void }
    OpenUriRemote: { (uri: string): void }
    StopRemote: { (): void }
    PlayPauseRemote: { (): void }
    NextRemote: { (): void }
    PreviousRemote: { (): void }
    SetPositionRemote: Function
}

