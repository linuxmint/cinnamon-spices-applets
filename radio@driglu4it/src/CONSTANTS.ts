const { get_home_dir } = imports.gi.GLib;

export const CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
export const MPRIS_PLUGIN_PATH = CONFIG_DIR + '/.mpris.so'
export const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so"

// See: https://specifications.freedesktop.org/mpris-spec/2.2/Player_Interface.html
// Methods always need a "Remote" as suffix to work
export const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
export const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
export const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
export const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`

export const MAX_VOLUME = 100 // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value

export const VOLUME_ICONS = [
    { max: 0, iconSuffix: "muted" },
    { max: 33, iconSuffix: "low" },
    { max: 66, iconSuffix: "medium" },
    { max: 100, iconSuffix: "high" },
]