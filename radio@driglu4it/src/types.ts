export type PlayPause = "Playing" | "Paused"
export type PlaybackStatus = PlayPause | "Stopped"
export type AdvancedPlaybackStatus = PlaybackStatus | 'Loading'

export type ChangeHandler<T> = (newValue: T) => void

export interface Channel {
    name: string,
    url: string,
    inc: boolean
}

export type AppletIcon = 'SYMBOLIC' | 'FULLCOLOR' | 'BICOLOR'
export type YouTubeClis = 'youtube-dl' | 'yt-dlp'


// MPRIS
type LoopStatus = 'None' | 'Track' | 'Playlist'
type InterfaceName = 'org.mpris.MediaPlayer2.Player'

export interface MprisPropsDbus extends imports.gi.Gio.DBusProxy {
    GetSync<T extends PropertyNames>(interfaceName: InterfaceName, propertyName: T): GetPropertyType<T>
    GetRemote<T extends PropertyNames>(interfaceName: InterfaceName, propertyName: T, callback: (value: GetPropertyType<T>) => void): void
    GetAllSync(interfaceName: InterfaceName): [MprisPropertiesPacked]
    GetAllRemote(interfaceName: InterfaceName, callback: (propertiesArr: [MprisPropertiesPacked]) => void): void
    // Is it currently possible to change readonly values with SetSync or SetRemote? And if so, is this right?
    SetSync<T extends PropertyNames>(interfaceName: InterfaceName, propertyName: T, value: GetPropertyType<T>): void
    SetRemote<T extends PropertyNames>(interfaceName: InterfaceName, propertyName: T, value: GetPropertyType<T>, callback: () => void): void
    connectSignal(signal: 'PropertiesChanged', callback: (proxy: MprisPropsDbus, nameOwner: string, args: [interfaceName: InterfaceName, changedProps: Partial<MprisPropertiesPacked>, invalidProps: string[]]) => void): number
}

export interface MprisMediaPlayerDbus extends imports.gi.Gio.DBusProxy, MprisPropertiesDeepUnpacked {
    /**
     * Skips to the next track in the tracklist.
     * 
     * If there is no next track (and endless playback and track repeat are both off), stop playback.
     * 
     * If playback is paused or stopped, it remains that way.
     * 
     * If {@link MprisMediaPlayerDbus.CanGoNext} is false, attempting to call this method should have no effect.
     */
    NextSync(): void
    /** See {@link MprisMediaPlayerDbus.NextSync } */
    NextRemote(callback?: () => void): void
    /**
     * Skips to the previous track in the tracklist.
     * 
     * If there is no previous track (and endless playback and track repeat are both off), stop playback.
     * 
     * If playback is paused or stopped, it remains that way.
     * 
     * If {@link MprisMediaPlayerDbus.CanGoPrevious} is false, attempting to call this method should have no effect.
     */
    PreviousSync(): void
    /** See {@link MprisMediaPlayerDbus.PreviousSync} */
    PresiousRemote(callback?: () => void): void
    /**
     * Pauses playback.
     * 
     * If playback is already paused, this has no effect.
     * 
     * Calling Play after this should cause playback to start again from the same position.
     * 
     * If {@link MprisMediaPlayerDbus.CanPause} is false, attempting to call this method should have no effect.
     */
    PauseSync(): void
    /** See {@link MprisMediaPlayerDbus.PauseSync} */
    PauseRemote(callback?: () => void): void
    /**
     * Pauses playback.
     * 
     * If playback is already paused, resumes playback.
     * 
     * If playback is stopped, starts playback.
     * 
     * If {@link MprisMediaPlayerDbus.CanPause} is false, attempting to call this method should have no effect and raise an error.
     */
    PlayPauseSync(): void
    /** See {@link MprisMediaPlayerDbus.PlayPauseSync} */
    PlayPauseRemote(callback?: () => void): void
    /**
     * Stops playback.
     * 
     * If playback is already stopped, this has no effect.
     * 
     * Calling Play after this should cause playback to start again from the beginning of the track.
     * 
     * If {@link MprisMediaPlayerDbus.CanControl} is false, attempting to call this method should have no effect and raise an error.
     * 
     */
    StopSync(): void
    /** See {@link MprisMediaPlayerDbus.StopSync} */
    StopRemote(callback?: () => void): void
    /**
     * Starts or resumes playback.
     * 
     * If already playing, this has no effect.
     * 
     * If paused, playback resumes from the current position.
     * 
     * If there is no track to play, this has no effect.
     * 
     * If {@link MprisMediaPlayerDbus.CanPlay} is false, attempting to call this method should have no effect.
     * 
     */
    PlaySync(): void
    /** See {@link MprisMediaPlayerDbus.PlaySync} */
    PlayRemote(): void
    /**
     * Seeks forward in the current track by the specified number of microseconds.
     * 
     * A negative value seeks back. If this would mean seeking back further than the start of the track, the position is set to 0.
     * 
     * If the value passed in would mean seeking beyond the end of the track, acts like a call to {@link MprisMediaPlayerDbus.Next}.
     * 
     * If the {@link MprisMediaPlayerDbus.CanSeek} property is false, this has no effect
     * 
     * @param x The number of microseconds to seek forward.
     */
    SeekSync(x: number): void
    /** See {@link MprisMediaPlayerDbus.SeekSync} */
    SeekRemote(x: number, callback?: () => void): void
    /**
     * Sets the current track position in microseconds.
     * 
     * If the Position argument is less than 0, do nothing.
     * 
     * If the Position argument is greater than the track length, do nothing.
     * 
     * If the {@link MprisMediaPlayerDbus.CanSeek} property is false, this has no effect.
     * 
     * **Rationale**: The reason for having this method, rather than making {@link MprisMediaPlayerDbus.Position} writable, is to include the TrackId argument to avoid race conditions where a client tries to seek to a position when the track has already change
     * 
     * @param trackId The currently playing track's identifier.
     *  If this does not match the id of the currently-playing track, the call is ignored as "stale".
     *  /org/mpris/MediaPlayer2/TrackList/NoTrack is not a valid value for this argument.  
     *
     * @param position Track position in microseconds.
     *  This must be between 0 and <track_length>. 
     */
    SetPositionSync(trackId: string, position: number): void
    /** See {@link MprisMediaPlayerDbus.SetPositionSync} */
    SetPositionRemote(trackId: string, position: number, callback?: () => void): void
    /**
     * Opens the Uri given as an argument
     * 
     * If the playback is stopped, starts playing
     * 
     * If the uri scheme or the mime-type of the uri to open is not supported, this method does nothing and may raise an error. In particular, if the list of available uri schemes is empty, this method may not be implemented.
     * 
     * Clients should not assume that the Uri has been opened as soon as this method returns. They should wait until the mpris:trackid field in the {@link MprisMediaPlayerDbus.Metadata} property changes.
     * 
     * If the media player implements the TrackList interface, then the opened track should be made part of the tracklist, the org.mpris.MediaPlayer2.TrackList.TrackAdded or org.mpris.MediaPlayer2.TrackList.TrackListReplaced signal should be fired, as well as the org.freedesktop.DBus.Properties.PropertiesChanged signal on the tracklist interface.
     * 
     * @param uri Uri of the track to load. Its uri scheme should be an element of the org.mpris.MediaPlayer2.SupportedUriSchemes property and the mime-type should match one of the elements of the org.mpris.MediaPlayer2.SupportedMimeTypes.
     */
    OpenUriSync(uri: string): void
    /** See {@link MprisMediaPlayerDbus.OpenUriSync} */
    OpenUriRemote(uri: string, callback?: () => void): void
    /**
     * Indicates that the track position has changed in a way that is inconsistant with the current playing state.
     * 
     * When this signal is not received, clients should assume that:
     * - When playing, the position progresses according to the rate property.
     * - When paused, it remains constant.
     * 
     * This signal does not need to be emitted when playback starts or when the track changes, unless the track is starting at an unexpected position. An expected position would be the last known one when going from Paused to Playing, and 0 when going from Stopped to Playing.
     * 
     * @param value: The new position in micrsoseconds 
     */
    connectSignal(signal: 'Seeked', callback: (proxy: this, sender: string, value: number) => void): number
}

export interface MprisPropertiesPacked {
    /**
     * The current playback status.
     * 
     * May be "Playing", "Paused" or "Stopped".
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly PlaybackStatus: imports.gi.GLib.Variant<PlaybackStatus>
    /**
     * The current loop / repeat status
     * 
     * May be:
     * - "None" if the playback will stop when there are no more tracks to play
     * - "Track" if the current track will start again from the begining once it has finished playing
     * - "Playlist" if the playback loops through a list of tracks
     * 
     * If {@link AllProperties.CanControl} is false, attempting to set this property should have no effect and raise an error. 
     * 
     * This property is optional. Clients should handle its absence gracefully.
     */
    LoopStatus: imports.gi.GLib.Variant<LoopStatus>
    /**
     * The current playback rate.
     * 
     * The value must fall in the range described by MinimumRate and MaximumRate, and must not be 0.0. If playback is paused, the PlaybackStatus property should be used to indicate this. A value of 0.0 should not be set by the client. If it is, the media player should act as though Pause was called.
     * 
     * If the media player has no ability to play at speeds other than the normal playback rate, this must still be implemented, and must return 1.0. The {@link MprisPropertiesPacked.MinimumRate} and {@link MprisPropertiesPacked.MaximumRate} properties must also be set to 1.0.
     * 
     * Not all values may be accepted by the media player. It is left to media player implementations to decide how to deal with values they cannot use; they may either ignore them or pick a "best fit" value. Clients are recommended to only use sensible fractions or multiples of 1 (eg: 0.5, 0.25, 1.5, 2.0, etc).
     * 
     * **Rationale**: This allows clients to display (reasonably) accurate progress bars without having to regularly query the media player for the current position.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    Rate: imports.gi.GLib.Variant<number>
    /**
     * A value of false indicates that playback is progressing linearly through a playlist, while true means playback is progressing through a playlist in some other order.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, attempting to set this property should have no effect and raise an error.
     * 
     * This property is optional. Clients should handle its absence gracefully.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    Shuffle: imports.gi.GLib.Variant<boolean>
    /**
     * The metadata of the current element.
     * 
     * If there is a current track, this must have a "mpris:trackid" entry (of D-Bus type "o") at the very least, which contains a D-Bus path that uniquely identifies this track.
     * 
     * See the type documentation for more details.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly Metadata: imports.gi.GLib.Variant<MprisMetadataUnpacked, MprisMetadataDeepUnpacked, MprisMetadataRecursiveUnpacked>
    /**
     * The volume level.
     * 
     * When setting, if a negative value is passed, the volume should be set to 0.0.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, attempting to set this property should have no effect and raise an error.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    Volume: imports.gi.GLib.Variant<number>
    /**
     * The current track position in microseconds, between 0 and the 'mpris:length' metadata entry (see Metadata).
     * 
     * Note: If the media player allows it, the current playback position can be changed either the **SetPosition** method or the **Seek** method on this interface. If this is not the case, the {@link MprisPropertiesPacked.CanSeek} property is false, and setting this property has no effect and can raise an error.
     * 
     * If the playback progresses in a way that is inconstistant with the {@link MprisPropertiesPacked.Rate} property, the Seeked signal is emited.
     * 
     * The org.freedesktop.DBus.Properties.PropertiesChanged signal is **not** emitted when this property changes.
     */
    readonly Position: imports.gi.GLib.Variant<number>
    /**
     * The minimum value which the {@link MprisPropertiesPacked.Rate} property can take. Clients should not attempt to set the {@link MprisPropertiesPacked.Rate} property below this value.
     * 
     * Note that even if this value is 0.0 or negative, clients should not attempt to set the {@link MprisPropertiesPacked.Rate} property to 0.0.
     * 
     * This value should always be 1.0 or less.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly MinimumRate: imports.gi.GLib.Variant<number>
    /**
     * The maximum value which the Rate property can take. Clients should not attempt to set the  {@link MprisPropertiesPacked.Rate} property above this value.
     * 
     * This value should always be 1.0 or greater.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly MaximumRate: imports.gi.GLib.Variant<number>
    /**
     * Whether the client can call the **Next** method on this interface and expect the current track to change.
     * 
     * If it is unknown whether a call to** Next** will be successful (for example, when streaming tracks), this property should be set to true.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, this property should also be false.
     * 
     * **Rationale**: Even when playback can generally be controlled, there may not always be a next track to move to.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly CanGoNext: imports.gi.GLib.Variant<boolean>
    /**
     * Whether the client can call the **Previous** method on this interface and expect the current track to change.
     * 
     * If it is unknown whether a call to **Previous** will be successful (for example, when streaming tracks), this property should be set to true.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, this property should also be false.
     * 
     * **Rationale**: Even when playback can generally be controlled, there may not always be a next previous to move to.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly CanGoPrevious: imports.gi.GLib.Variant<boolean>
    /**
     * Whether playback can be started using **Play** or **PlayPause**.
     * 
     * Note that this is an intrinsic property of the current track: its value should not depend on whether the track is currently paused or playing. In fact, if playback is currently paused (and {@link MprisPropertiesPacked.CanControl} is true), this should be true.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, this property should also be false.
     * 
     * **Rationale**: Even when playback can generally be controlled, it may not be possible to enter a "playing" state, for example if there is no "current track".
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     * 
     */
    readonly CanPlay: imports.gi.GLib.Variant<boolean>
    /**
     * Whether playback can be paused using **Pause** or **PlayPause**.
     * 
     * Note that this is an intrinsic property of the current track: its value should not depend on whether the track is currently paused or playing. In fact, if playback is currently paused (and {@link MprisPropertiesPacked.CanControl} is true), this should be true.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, this property should also be false.
     * 
     * **Rationale**: Not all media is pausable: it may not be possible to pause some streamed media, for example.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly CanPause: imports.gi.GLib.Variant<boolean>
    /**
     * Whether the client can control the playback position using **Seek** and **SetPosition**. This may be different for different tracks.
     * 
     * If {@link MprisPropertiesPacked.CanControl} is false, this property should also be false.
     * 
     * **Rationale**: Not all media is seekable: it may not be possible to seek when playing some streamed media, for example.
     * 
     * When this property changes, the org.freedesktop.DBus.Properties.PropertiesChanged signal is emitted with the new value.
     */
    readonly CanSeek: imports.gi.GLib.Variant<boolean>
    /**
     * Whether the media player may be controlled over this interface.
     * 
     * This property is not expected to change, as it describes an intrinsic capability of the implementation.
     * 
     * If this is false, clients should assume that all properties on this interface are read-only (and will raise errors if writing to them is attempted), no methods are implemented and all other properties starting with "Can" are also false.
     * 
     * **Rationale**: This allows clients to determine whether to present and enable controls to the user in advance of attempting to call methods and write to properties.
     * 
     * The org.freedesktop.DBus.Properties.PropertiesChanged signal is **not** emitted when this property changes.
     */
    readonly CanControl: imports.gi.GLib.Variant<boolean>
}

export type MprisPropertiesDeepUnpacked = {
    [P in keyof MprisPropertiesPacked]: ReturnType<MprisPropertiesPacked[P]["deep_unpack"]>
}

// Workaround for making return type based on input param
// https://stackoverflow.com/a/54166010/11603006
type PropertyNamesNumber = 'Rate' | 'Volume' | 'Position' | 'MinimumRate' | 'MaximumRate'
type PropertyNamesBoolean = 'Shuffle' | 'CanGoNext' | 'CanGoPrevious' | 'CanPlay' | 'CanPause' | 'CanSeek' | 'CanControl'
type PropertyNames = PropertyNamesNumber | PropertyNamesBoolean | 'Metadata' | 'LoopStatus' | 'PlaybackStatus'
type GetPropertyType<T> =
    T extends 'PlaybackStatus' ? [MprisPropertiesPacked['PlaybackStatus']] :
    T extends 'LoopStatus' ? [MprisPropertiesPacked['LoopStatus']] :
    T extends 'Metadata' ? [MprisPropertiesPacked['Metadata']] :
    T extends PropertyNamesNumber ? [imports.gi.GLib.Variant<number>] :
    T extends PropertyNamesBoolean ? [imports.gi.GLib.Variant<boolean>] :
    never


// TODO add jsdoc
interface MprisMetadataUnpacked {
    ["xesam:title"]?: imports.gi.GLib.Variant<imports.gi.GLib.Variant<string>>,
    ["mpris:trackid"]?: imports.gi.GLib.Variant<imports.gi.GLib.Variant<string>>,
    ["xesam:url"]?: imports.gi.GLib.Variant<imports.gi.GLib.Variant<string>>,
    ["mpris:length"]?: imports.gi.GLib.Variant<imports.gi.GLib.Variant<number>>
}

type MprisMetadataDeepUnpacked = {
    // @ts-ignore
    [P in keyof MprisMetadataUnpacked]: ReturnType<MprisMetadataUnpacked[P]['unpack']>
}

export type MprisMetadataRecursiveUnpacked = {
    // @ts-ignore
    [P in keyof MprisMetadataDeepUnpacked]: ReturnType<MprisMetadataDeepUnpacked[P]['unpack']>
}
