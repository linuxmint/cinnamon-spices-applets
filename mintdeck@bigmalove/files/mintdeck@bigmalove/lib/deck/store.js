// lib/deck/store.js —— 设置、主题与运行期状态的聚合层
//
// 拆成单独一层的原因：applet.js 只负责「生命周期 + 事件」，island/panel 只管画，
// 谁都不直接读 GSettings；这样换存储（schema → 自有 json）不用动 UI。
'use strict';

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

// 上游的几何常量兜底：geometry.js 由 tools/ 侧的移植提供，缺失时至少能启动。
const FALLBACK = {
    notchWidth: 238, notchHeight: 32,
    capsuleWidth: 196, capsuleHeight: 32, capsuleTop: 5,
    lineLength: 56, lineThickness: 4, lineTop: 4,
    notchInset: 30, capsuleInset: 16, notchCorner: 12, notchShoulder: 16
};

function readJson(path, parser) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok) return null;
        const text = new TextDecoder('utf-8').decode(bytes);
        // 主题文件允许 // 注释与尾逗号（Templates/theme-template.json 开头就写了），裸 JSON.parse 会全挂
        if (parser) return parser(text);
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

// 主题目录：<applet>/themes/*.json（与上游 %LOCALAPPDATA%\BrimDeck\themes 同格式）
var ThemeStore = class ThemeStore {
    constructor(basePath, Themes) {
        this._dir = GLib.build_filenamev([basePath, 'themes']);
        this._Themes = Themes;       // lib/core/theme.js，可能为 null（未移植完时）
        this._cache = {};
    }

    // 返回 {id, colors:{...}, apps:{...}, clock:{...}}；解析失败一律回落 dark
    get(id) {
        const key = id || 'dark';
        if (this._cache[key]) return this._cache[key];

        const parser = this._Themes && this._Themes.parseTheme;
        const raw = readJson(GLib.build_filenamev([this._dir, key + '.json']), parser);
        let theme = null;
        if (raw) {
            // base 继承：字符串给出的 base 指向另一个内置主题
            let base = raw.base ? this.get(raw.base) : null;
            theme = this._Themes && this._Themes.resolve
                ? this._Themes.resolve(base, raw)
                : this._merge(base, raw);
        }
        if (!theme) theme = this._merge(null, readJson(GLib.build_filenamev([this._dir, 'dark.json']), parser) || {});
        this._cache[key] = theme;
        return theme;
    }

    // theme.js 缺席时的最小合并：只做对象浅合并 + base 链
    _merge(base, raw) {
        const out = { id: (raw && raw.id) || 'dark', colors: {}, apps: {}, clock: {} };
        if (base) {
            out.colors = Object.assign({}, base.colors);
            out.apps = Object.assign({}, base.apps);
            out.clock = Object.assign({}, base.clock);
        }
        if (raw) {
            if (raw.colors) Object.assign(out.colors, raw.colors);
            if (raw.apps) Object.assign(out.apps, raw.apps);
            if (raw.clock) Object.assign(out.clock, raw.clock);
            if (raw.id) out.id = raw.id;
        }
        return out;
    }

    // 上游的默认值（Themes/dark.json），供主题缺键时兜底
    static fallbackColors() {
        return {
            surface: '#000000', textPrimary: '#F5F5F7', textSecondary: '#9EEBEBF5', textTertiary: '#61EBEBF5',
            accent: '#0A84FF', danger: '#F2777F', hairline: '#17FFFFFF', track: '#1FFFFFFF',
            ringTrack: '#29FFFFFF', shadow: '#000000', rim: '#12FFFFFF', indicator: '#8E8E93'
        };
    }
}

// 设置视图：把 AppletSettings 的 bind 结果集中起来，UI 只调 get()
var SettingsView = class SettingsView {
    constructor(defaults) {
        this._v = Object.assign({}, defaults);
    }
    bind(raw) { Object.assign(this._v, raw); }
    set(key, value) { this._v[key] = value; }
    get(key) { return this._v[key] === undefined ? FALLBACK[key] : this._v[key]; }
    all() { return this._v; }
}

if (typeof module !== 'undefined') {
    module.exports = { ThemeStore, SettingsView, readJson, FALLBACK };
}
