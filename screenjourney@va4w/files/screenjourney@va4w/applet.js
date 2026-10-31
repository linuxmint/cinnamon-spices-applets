const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const RUNTIME = GLib.build_filenamev([GLib.get_user_runtime_dir(), "screenjourney"]);
const RECORDING = GLib.build_filenamev([RUNTIME, "recording.json"]);
const LAST = GLib.build_filenamev([RUNTIME, "last.json"]);
const IDLE_ICON = "camera-photo-symbolic";
const RECORDING_ICON = "media-record-symbolic";

function readJson(path) {
    try {
        let [ok, bytes] = GLib.file_get_contents(path);
        return ok ? JSON.parse(new TextDecoder().decode(bytes)) : null;
    } catch (e) {
        return null;
    }
}

function pidAlive(pid) {
    return Number.isInteger(pid) && GLib.file_test(`/proc/${pid}`, GLib.FileTest.EXISTS);
}

function elapsed(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    let h = Math.floor(seconds / 3600);
    let m = Math.floor(seconds / 60) % 60;
    let s = String(seconds % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function resolveDir(value, special, sub) {
    if (value) {
        if (value.startsWith("file://"))
            return Gio.File.new_for_uri(value).get_path();
        return value.replace(/^~(?=\/|$)/, GLib.get_home_dir());
    }
    let base = GLib.get_user_special_dir(special) || GLib.get_home_dir();
    return GLib.build_filenamev([base, sub]);
}

function openPath(path) {
    try {
        Gio.AppInfo.launch_default_for_uri(Gio.File.new_for_path(path).get_uri(), null);
    } catch (e) {
        global.logError(`screenjourney: cannot open ${path}: ${e}`);
    }
}

class ScreenJourneyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.helper = GLib.build_filenamev([metadata.path, "screenjourney.py"]);
        this.hotkeyId = `${metadata.uuid}-${instanceId}`;
        this.recording = null;
        this.timer = 0;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        for (let key of ["image_dir", "video_dir", "clipboard", "video_format", "fps", "audio", "pointer",
                         "delay", "notify", "border", "remember_region"])
            this.settings.bind(key, key);
        this.settings.bind("keybinding", "keybinding", () => this._bindHotkey());
        this._bindHotkey();

        this.set_applet_icon_symbolic_name(IDLE_ICON);
        this._buildMenu();

        GLib.mkdir_with_parents(RUNTIME, 0o700);
        this.monitor = Gio.File.new_for_path(RUNTIME).monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this.monitor.connect("changed", () => this._refresh());
        this._refresh();
    }

    _buildMenu() {
        let menu = this._applet_context_menu;
        let items = [];
        let add = (label, icon, callback) => {
            let item = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.SYMBOLIC);
            item.connect("activate", callback);
            items.push(item);
            return item;
        };
        this.itemOverlay = add("Capture area…", "edit-select-all-symbolic", () => this.openOverlay());
        this.itemShot = add("Screenshot of entire screen", "camera-photo-symbolic", () => this._capture("image"));
        this.itemRecord = add("Record entire screen", "camera-video-symbolic", () => this._capture("video"));
        this.itemStop = add("Stop recording", "media-playback-stop-symbolic", () => this.stopRecording());
        items.push(new PopupMenu.PopupSeparatorMenuItem());
        this.itemLast = add("Open last capture", "document-open-symbolic", () => {
            let last = readJson(LAST);
            if (last && last.file)
                openPath(last.file);
        });
        add("Open screenshots folder", "folder-pictures-symbolic", () => this._openFolder("image"));
        add("Open recordings folder", "folder-videos-symbolic", () => this._openFolder("video"));
        items.push(new PopupMenu.PopupSeparatorMenuItem());
        items.forEach((item, i) => menu.addMenuItem(item, i));
    }

    _args() {
        return [
            "--image-dir", this.image_dir || "",
            "--video-dir", this.video_dir || "",
            "--format", this.video_format,
            "--fps", String(this.fps),
            "--audio", this.audio,
            "--delay", String(this.delay),
            this.pointer ? "--pointer" : "--no-pointer",
            this.clipboard ? "--clipboard" : "--no-clipboard",
            this.notify ? "--notify" : "--no-notify",
            this.border ? "--border" : "--no-border",
            this.remember_region ? "--remember" : "--no-remember",
        ];
    }

    _run(args) {
        Util.spawn(["python3", this.helper, ...args]);
    }

    openOverlay() {
        if (this.recording)
            return;
        this._run(["overlay", ...this._args()]);
    }

    stopRecording() {
        this._run(["stop"]);
    }

    _capture(mode) {
        if (this.recording)
            return;
        // Let the menu close before the screen is grabbed.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._run(["capture", "--mode", mode, ...this._args()]);
            return GLib.SOURCE_REMOVE;
        });
    }

    _openFolder(kind) {
        let path = kind === "image"
            ? resolveDir(this.image_dir, GLib.UserDirectory.DIRECTORY_PICTURES, "Screenshots")
            : resolveDir(this.video_dir, GLib.UserDirectory.DIRECTORY_VIDEOS, "Screencasts");
        GLib.mkdir_with_parents(path, 0o755);
        openPath(path);
    }

    _bindHotkey() {
        Main.keybindingManager.removeHotKey(this.hotkeyId);
        if (this.keybinding)
            Main.keybindingManager.addHotKey(this.hotkeyId, this.keybinding, () => this._activate());
    }

    _activate() {
        if (this.recording)
            this.stopRecording();
        else
            this.openOverlay();
    }

    _refresh() {
        let rec = readJson(RECORDING);
        this.recording = rec && pidAlive(rec.pid) ? rec : null;

        this.itemStop.actor.visible = !!this.recording;
        for (let item of [this.itemOverlay, this.itemShot, this.itemRecord])
            item.setSensitive(!this.recording);
        let last = readJson(LAST);
        this.itemLast.setSensitive(!!(last && last.file && GLib.file_test(last.file, GLib.FileTest.EXISTS)));

        if (this.recording) {
            this.set_applet_icon_symbolic_name(RECORDING_ICON);
            this._applet_icon.set_style("color: #e01b24;");
            if (!this.timer)
                this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => this._tick());
            this._tick();
        } else {
            if (this.timer) {
                GLib.source_remove(this.timer);
                this.timer = 0;
            }
            this.set_applet_icon_symbolic_name(IDLE_ICON);
            this._applet_icon.set_style(null);
            this.set_applet_label("");
            this.set_applet_tooltip("Click to capture an area or the screen");
        }
    }

    _tick() {
        if (!this.recording || !pidAlive(this.recording.pid)) {
            this.timer = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        }
        let time = elapsed(Date.now() / 1000 - this.recording.started);
        this.set_applet_label(time);
        this.set_applet_tooltip(`Recording ${time} — click to stop`);
        return GLib.SOURCE_CONTINUE;
    }

    on_applet_clicked() {
        this._activate();
    }

    on_applet_middle_clicked() {
        if (!this.recording)
            this._capture("image");
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey(this.hotkeyId);
        if (this.timer)
            GLib.source_remove(this.timer);
        this.monitor.cancel();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ScreenJourneyApplet(metadata, orientation, panelHeight, instanceId);
}
