const { get_home_dir } = imports.gi.GLib;
export const APPLET_SITE = 'https://cinnamon-spices.linuxmint.com/applets/view/297'

export const DEFAULT_TOOLTIP_TXT = 'Radio++'
export const CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
export const MPRIS_PLUGIN_PATH = CONFIG_DIR + '/.mpris.so'
export const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so"

export const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
export const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
export const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
export const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`

export const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value


// ICONS
// export const VOLUME_ICONS = [
//     { max: 0, iconSuffix: "muted" },
//     { max: 33, iconSuffix: "low" },
//     { max: 66, iconSuffix: "medium" },
//     { max: 100, iconSuffix: "high" },
// ]

export const RADIO_SYMBOLIC_ICON_NAME = 'radioapplet'

const PLAYBACK_ICON_PREFIX = 'media-playback'

export const PLAY_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-start`
export const PAUSE_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-pause`
export const STOP_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-stop`
export const SONG_INFO_ICON_NAME = 'audio-x-generic'
export const COPY_ICON_NAME = 'edit-copy'
export const DOWNLOAD_ICON_NAME = 'south-arrow-weather-symbolic'
export const LOADING_ICON_NAME = 'view-refresh-symbolic'

export const MAX_STRING_LENGTH = 40