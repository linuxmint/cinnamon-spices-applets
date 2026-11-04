// ActionCenter@yoo 共享常量（唯一真相源）
// 各模块：const C = require('./constants'); + 按需解构，避免 7 份重复定义
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "ActionCenter@yoo";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");
function _(str) { return Gettext.dgettext(UUID, str); }

// ---------- 布局 ----------
const TOGGLE_WIDTH = 175;
const TOGGLE_HEIGHT = 46;
const ARROW_WIDTH = 28;
const MENU_CONTENT_WIDTH = TOGGLE_WIDTH * 2 + 6;   // 356
const MPRIS_CONTENT_WIDTH = MENU_CONTENT_WIDTH;
const CHOOSER_CONTENT_WIDTH = MPRIS_CONTENT_WIDTH - 12 - 16 - 8;
const PLAYER_CONTENT_WIDTH = MPRIS_CONTENT_WIDTH - 12 - 16;

// ---------- 轮询 ----------
const POLL_INTERVAL_SEC = 12;

// ---------- 缓存文件 ----------
const CACHE_DIR = GLib.get_user_cache_dir() + "/ActionCenter@yoo";
const MPRIS_STATE_FILE = CACHE_DIR + "/players.json";
const MPRIS_CMD_FILE = CACHE_DIR + "/commands";
const WIFI_CACHE_FILE = CACHE_DIR + "/wifi_cache.json";
const THEMES_CACHE_FILE = CACHE_DIR + "/available_themes.json";

module.exports = {
    UUID: UUID,
    _: _,
    TOGGLE_WIDTH: TOGGLE_WIDTH,
    TOGGLE_HEIGHT: TOGGLE_HEIGHT,
    ARROW_WIDTH: ARROW_WIDTH,
    MENU_CONTENT_WIDTH: MENU_CONTENT_WIDTH,
    MPRIS_CONTENT_WIDTH: MPRIS_CONTENT_WIDTH,
    CHOOSER_CONTENT_WIDTH: CHOOSER_CONTENT_WIDTH,
    PLAYER_CONTENT_WIDTH: PLAYER_CONTENT_WIDTH,
    POLL_INTERVAL_SEC: POLL_INTERVAL_SEC,
    CACHE_DIR: CACHE_DIR,
    MPRIS_STATE_FILE: MPRIS_STATE_FILE,
    MPRIS_CMD_FILE: MPRIS_CMD_FILE,
    WIFI_CACHE_FILE: WIFI_CACHE_FILE,
    THEMES_CACHE_FILE: THEMES_CACHE_FILE
};
