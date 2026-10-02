/* Pure rules for the grade. No Clutter, no settings, no files except the
 * project-root walk. The shell and the tests both load this file.
 *
 * Working space: the framebuffer is already encoded (sRGB-like). Exposure,
 * contrast, saturation, and grain run in that encoding. This is not a
 * linear-light grade.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var GradeLogic = {
    WORKING_SPACE: "encoded-framebuffer",

    PRESET_KEYS: [
        "exposure", "contrast", "highlights", "shadows", "blacks",
        "saturation", "temperature", "shadow_teal", "highlight_warmth",
        "gamma", "sharpen", "vignette", "skin_protect", "grain"
    ],

    SCHEMA_PRESETS: ["subtle", "cinematic", "iron_within", "extreme"],

    FALLBACK_PRESET: {
        exposure: -0.15,
        contrast: 1.25,
        highlights: -0.15,
        shadows: -0.20,
        blacks: -0.15,
        saturation: 0.85,
        temperature: -0.05,
        shadow_teal: 0.08,
        highlight_warmth: 0.05,
        gamma: 1.06,
        sharpen: 0.15,
        vignette: 0.08,
        skin_protect: 0.80,
        grain: 0.0
    },

    /* Actors that cover the desktop. The same list for the applet and the
     * extension, so the two entry points cannot grade different sets. */
    TARGETS: ["uiGroup", "bottom_window_group", "top_window_group"],

    clampIntensity: function(value) {
        let number = Number(value);
        if (!isFinite(number))
            return 1;
        if (number < 0)
            return 0;
        if (number > 1)
            return 1;
        return number;
    },

    normalizePreset: function(source) {
        let preset = {};
        for (let i = 0; i < this.PRESET_KEYS.length; i++) {
            let key = this.PRESET_KEYS[i];
            let value = Number(source && source[key]);
            preset[key] = isFinite(value) ? value : this.FALLBACK_PRESET[key];
        }
        return preset;
    },

    sharpenWanted: function(preset, intensity) {
        return preset.sharpen * this.clampIntensity(intensity) > 0.001;
    },

    /* A bad file keeps the previous presets. A missing key is not filled
     * from the fallback, because that would change the look without notice. */
    validatePresetMap: function(parsed) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return { ok: false, error: "presets.json is not an object" };
        for (let i = 0; i < this.SCHEMA_PRESETS.length; i++) {
            let name = this.SCHEMA_PRESETS[i];
            let preset = parsed[name];
            if (!preset || typeof preset !== "object" || Array.isArray(preset))
                return { ok: false, error: "presets.json missing preset " + name };
            for (let k = 0; k < this.PRESET_KEYS.length; k++) {
                let key = this.PRESET_KEYS[k];
                if (!isFinite(Number(preset[key])))
                    return { ok: false, error: "presets.json " + name + "." + key + " is not a number" };
            }
        }
        return { ok: true, error: null };
    },

    acceptPresetText: function(text, previous) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return {
                ok: false,
                presets: previous || null,
                error: "presets.json: " + e
            };
        }
        let check = this.validatePresetMap(parsed);
        if (!check.ok)
            return { ok: false, presets: previous || null, error: check.error };
        return { ok: true, presets: parsed, error: null };
    },

    /* file is null, or { value: boolean } with the original muffin setting.
     * setMuffin null means leave the key alone. writeFile is persisted
     * before the key changes, so a crash can still restore it. */
    unredirectTransition: function(file, muffin, wantComposite, active) {
        let hold = !!active && !!wantComposite;
        if (hold) {
            if (file)
                return { writeFile: null, deleteFile: false, setMuffin: false };
            return {
                writeFile: { value: !!muffin },
                deleteFile: false,
                setMuffin: muffin ? false : null
            };
        }
        if (file)
            return { writeFile: null, deleteFile: true, setMuffin: !!file.value };
        return { writeFile: null, deleteFile: false, setMuffin: null };
    },

    unredirectPayload: function(value) {
        return JSON.stringify({ value: !!value });
    },

    readUnredirectPayload: function(text) {
        let parsed = JSON.parse(text);
        if (!parsed || typeof parsed.value !== "boolean")
            return null;
        return { value: parsed.value };
    },

    resolveProjectRoot: function(startPath) {
        let file = Gio.File.new_for_path(startPath);
        for (let hop = 0; hop < 8; hop++) {
            let info = null;
            try {
                info = file.query_info(
                    "standard::is-symlink,standard::symlink-target",
                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                    null
                );
            } catch (e) {
                break;
            }
            if (!info.get_is_symlink())
                break;
            let target = info.get_symlink_target();
            if (!GLib.path_is_absolute(target)) {
                let parent = file.get_parent();
                target = GLib.build_filenamev([parent.get_path(), target]);
            }
            file = Gio.File.new_for_path(target);
        }
        if (this._dirHasShaders(file))
            return file.get_path();
        let parent = file.get_parent();
        if (parent && this._dirHasShaders(parent))
            return parent.get_path();
        return parent ? parent.get_path() : file.get_path();
    },

    _dirHasShaders: function(file) {
        return file.get_child("shaders").get_child("grade.glsl").query_exists(null);
    }
};
