"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOADING_ICON_NAME = exports.DOWNLOAD_ICON_NAME = exports.COPY_ICON_NAME = exports.SONG_INFO_ICON_NAME = exports.STOP_ICON_NAME = exports.PAUSE_ICON_NAME = exports.PLAY_ICON_NAME = exports.RADIO_SYMBOLIC_ICON_NAME = exports.getVolumeIcon = exports.POPUP_MENU_ITEM_CLASS = exports.POPUP_ICON_CLASS = exports.VOLUME_DELTA = exports.MAX_VOLUME = exports.MAX_STRING_LENGTH = exports.MPV_CVC_NAME = exports.MPV_MPRIS_BUS_NAME = exports.MEDIA_PLAYER_2_PATH = exports.MEDIA_PLAYER_2_PLAYER_NAME = exports.MEDIA_PLAYER_2_NAME = exports.MPRIS_PLUGIN_URL = exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR = exports.DEFAULT_TOOLTIP_TXT = exports.APPLET_SITE = void 0;
const { get_home_dir } = imports.gi.GLib;
exports.APPLET_SITE = 'https://cinnamon-spices.linuxmint.com/applets/view/297';
exports.DEFAULT_TOOLTIP_TXT = 'Radio++';
exports.CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR + '/.mpris.so';
exports.MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so";
exports.MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
exports.MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
exports.MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
exports.MPV_MPRIS_BUS_NAME = `${exports.MEDIA_PLAYER_2_NAME}.mpv`;
exports.MPV_CVC_NAME = 'mpv Media Player';
exports.MAX_STRING_LENGTH = 40;
exports.MAX_VOLUME = 100;
exports.VOLUME_DELTA = 5;
exports.POPUP_ICON_CLASS = 'popup-menu-icon';
exports.POPUP_MENU_ITEM_CLASS = 'popup-menu-item';
function getVolumeIcon(args) {
    const { volume } = args;
    const VOLUME_ICON_PREFIX = 'audio-volume';
    const VOLUME_ICONS = [
        { max: 0, name: `${VOLUME_ICON_PREFIX}-muted` },
        { max: 33, name: `${VOLUME_ICON_PREFIX}-low` },
        { max: 66, name: `${VOLUME_ICON_PREFIX}-medium` },
        { max: 100, name: `${VOLUME_ICON_PREFIX}-high` },
    ];
    if (volume < 0 || volume > 100)
        throw new RangeError('volume should be between 0 and 100');
    const index = VOLUME_ICONS.findIndex((_a) => {
        var { max } = _a, rest = __rest(_a, ["max"]);
        return volume <= max;
    });
    return VOLUME_ICONS[index].name;
}
exports.getVolumeIcon = getVolumeIcon;
exports.RADIO_SYMBOLIC_ICON_NAME = 'radioapplet';
const PLAYBACK_ICON_PREFIX = 'media-playback';
exports.PLAY_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-start`;
exports.PAUSE_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-pause`;
exports.STOP_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-stop`;
exports.SONG_INFO_ICON_NAME = 'audio-x-generic';
exports.COPY_ICON_NAME = 'edit-copy';
exports.DOWNLOAD_ICON_NAME = 'south-arrow-weather-symbolic';
exports.LOADING_ICON_NAME = 'view-refresh-symbolic';
