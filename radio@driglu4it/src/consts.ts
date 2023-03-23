const { get_home_dir, get_user_config_dir, get_user_cache_dir } = imports.gi.GLib;
const { File } = imports.gi.Gio;

export const APPLET_SITE =
  "https://cinnamon-spices.linuxmint.com/applets/view/297";


export const APPLET_CACHE_DIR_PATH = `${get_user_cache_dir()}/${__meta.uuid}`
export const MPRIS_PLUGIN_PATH = (() => {

  const maybePath = [
    `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}/.mpris.so`, 
  ].find((path) => File.new_for_path(path).query_exists(null))

  return maybePath || `${APPLET_CACHE_DIR_PATH}/.mpris.so`;
})();

export const MPRIS_PLUGIN_URL =
  "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so";

export const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
export const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
export const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
export const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`;
export const MPV_CVC_NAME = "mpv Media Player";

export const MAX_STRING_LENGTH = 40;

/** in percent */
export const MAX_VOLUME = 100; // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value

/** in percent */
export const VOLUME_DELTA = 5;

// STYLE CLASSES
export const POPUP_ICON_CLASS = "popup-menu-icon";
export const POPUP_MENU_ITEM_CLASS = "popup-menu-item";

// ICONS
export function getVolumeIcon(args: { volume: number }) {
  const { volume } = args;

  const VOLUME_ICON_PREFIX = "audio-volume";

  const VOLUME_ICONS = [
    { max: 0, name: `${VOLUME_ICON_PREFIX}-muted` },
    { max: 33, name: `${VOLUME_ICON_PREFIX}-low` },
    { max: 66, name: `${VOLUME_ICON_PREFIX}-medium` },
    { max: 100, name: `${VOLUME_ICON_PREFIX}-high` },
  ];

  if (volume < 0 || volume > 100)
    throw new RangeError("volume should be between 0 and 100");

  const index = VOLUME_ICONS.findIndex(({ max }) => {
    return volume <= max;
  });

  return VOLUME_ICONS[index].name;
}

export const RADIO_SYMBOLIC_ICON_NAME = "radioapplet";

const PLAYBACK_ICON_PREFIX = "media-playback";

export const PLAY_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-start`;
export const PAUSE_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-pause`;
export const STOP_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-stop`;
export const PREVIOUS_ICON_NAME = "media-skip-backward";
export const SONG_INFO_ICON_NAME = "audio-x-generic";
export const COPY_ICON_NAME = "edit-copy";
export const DOWNLOAD_ICON_NAME = "south-arrow-weather-symbolic";
export const LOADING_ICON_NAME = "view-refresh-symbolic";
export const CANCEL_ICON_NAME = "dialog-cancel";
