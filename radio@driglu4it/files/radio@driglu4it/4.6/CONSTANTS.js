"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOLUME_ICONS = exports.MAX_VOLUME = exports.MPV_MPRIS_BUS_NAME = exports.MEDIA_PLAYER_2_PATH = exports.MEDIA_PLAYER_2_PLAYER_NAME = exports.MEDIA_PLAYER_2_NAME = exports.MPRIS_PLUGIN_URL = exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR = void 0;
const { get_home_dir } = imports.gi.GLib;
exports.CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR + '/.mpris.so';
exports.MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so";
exports.MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
exports.MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
exports.MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
exports.MPV_MPRIS_BUS_NAME = `${exports.MEDIA_PLAYER_2_NAME}.mpv`;
exports.MAX_VOLUME = 100;
exports.VOLUME_ICONS = [
    { max: 0, iconSuffix: "muted" },
    { max: 33, iconSuffix: "low" },
    { max: 66, iconSuffix: "medium" },
    { max: 100, iconSuffix: "high" },
];
