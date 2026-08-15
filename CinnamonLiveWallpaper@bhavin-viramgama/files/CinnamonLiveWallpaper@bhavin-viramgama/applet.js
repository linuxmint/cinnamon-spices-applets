const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

class LiveWallpaperApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.uuid = metadata.uuid;
        this.set_applet_icon_path(metadata.path + "/icon.png");
        this.set_applet_tooltip("Live Wallpaper Controls");

        this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
        this.settings.bind("wallpaper-mode", "wallpaper_mode", this.on_settings_changed);
        this.settings.bind("custom-playlist", "custom_playlist", this.on_settings_changed);
        this.settings.bind("video-file", "video_file", this.on_settings_changed);
        this.settings.bind("video-folder", "video_folder", this.on_settings_changed);
        this.settings.bind("custom-path", "custom_path", this.on_settings_changed);
        this.settings.bind("mute-all", "mute_all", this.on_mute_all_changed);
        this.settings.bind("hide-icon", "hide_icon", this.on_hide_icon_changed);
        this.settings.bind("smart-pause", "smart_pause", this.on_smart_pause_changed);
        this.settings.bind("shuffle-playlist", "shuffle_playlist", this.on_shuffle_changed);
        this.settings.bind("start-muted", "start_muted");
        this.settings.bind("autostart", "autostart");
        this.settings.bind("target-display", "target_display", this.on_settings_changed);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._initContextMenu();
        this.isPlaying = false;
        this.isMuted = true;
        this.isSmartPaused = false;
        this.smartPauseLoopId = 0;

        this._checkDependencies();
    }

    on_applet_added_to_panel() {
        // Aggressively kill any leftover processes from previous Cinnamon sessions
        Util.spawnCommandLine("pkill -f 'mpv.*mpv-wallpaper-socket'");
        Util.spawnCommandLine("pkill -f 'xwinwrap.*mpv-wallpaper-socket'");

        if (this.hide_icon) {
            this.actor.hide();
        }
        if (this.autostart) {
            this.startWallpaper();
        }
    }

    on_applet_removed_from_panel() {
        if (this.isPlaying) {
            this.stopWallpaper();
        }
    }

    _checkDependencies() {
        let missing = [];
        if (!GLib.find_program_in_path("mpv")) missing.push("mpv");
        if (!GLib.find_program_in_path("xwinwrap")) missing.push("xwinwrap");
        if (!GLib.find_program_in_path("socat")) missing.push("socat");
        if (!GLib.find_program_in_path("xdotool")) missing.push("xdotool");

        if (missing.length > 0) {
            let msg = `Missing dependencies: ${missing.join(', ')}. Please run the install-deps.sh script inside ~/.local/share/cinnamon/applets/${this.uuid}`;
            Main.notify("Live Wallpaper Applet", msg);
            this.set_applet_tooltip(msg);
        }
    }

    _initContextMenu() {
        this.togglePlayItem = new PopupMenu.PopupMenuItem("Start Wallpaper");
        this.togglePlayItem.connect('activate', () => this.togglePlayback());
        this.menu.addMenuItem(this.togglePlayItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.prevTrackItem = new PopupMenu.PopupIconMenuItem("Previous", "media-skip-backward-symbolic", St.IconType.SYMBOLIC);
        this.prevTrackItem.connect('activate', () => this.sendCommand(["playlist-prev"]));
        this.menu.addMenuItem(this.prevTrackItem);

        this.nextTrackItem = new PopupMenu.PopupIconMenuItem("Next", "media-skip-forward-symbolic", St.IconType.SYMBOLIC);
        this.nextTrackItem.connect('activate', () => this.sendCommand(["playlist-next"]));
        this.menu.addMenuItem(this.nextTrackItem);

        this.shuffleSwitch = new PopupMenu.PopupSwitchMenuItem("Shuffle Playlist", this.shuffle_playlist);
        this.shuffleSwitch.connect('toggled', (item, state) => {
            this.settings.setValue("shuffle-playlist", state);
        });
        this.menu.addMenuItem(this.shuffleSwitch);


        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.volumeSlider = new PopupMenu.PopupSliderMenuItem(0.0);

        this.volumeIconBtn = new St.Button({ track_hover: true });
        this.volumeIcon = new St.Icon({ icon_name: "audio-volume-muted-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        this.volumeIconBtn.set_child(this.volumeIcon);
        this.volumeIconBtn.connect('clicked', () => this.toggleMute());

        this.volumeSlider.removeActor(this.volumeSlider._slider);
        this.volumeSlider.addActor(this.volumeIconBtn, { span: 0 });
        this.volumeSlider.addActor(this.volumeSlider._slider, { span: -1, expand: true });

        this.volumeSlider.connect('value-changed', (slider, value) => {
            let volume = Math.round(value * 100);
            this.sendCommand(["set_property", "volume", volume]);
            if (this.isMuted && volume > 0) {
                this.toggleMute();
            }
        });
        this.menu.addMenuItem(this.volumeSlider);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        let iconName = this.isMuted ? "audio-volume-muted-symbolic" : "audio-volume-high-symbolic";

        this.volumeIcon.set_icon_name(iconName);

        let property = this.isMuted ? "yes" : "no";
        this.sendCommand(["set_property", "mute", property]);

        if (!this.isMuted) {
            let volume = Math.round(this.volumeSlider.value * 100);
            this.sendCommand(["set_property", "volume", volume]);
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _decodePath(path) {
        if (!path) return null;
        path = path.trim();
        if (path.startsWith("file://")) {
            path = path.substring(7);
        }
        try {
            return decodeURIComponent(path);
        } catch (e) {
            return path;
        }
    }

    getWallpaperPath() {
        if (this.wallpaper_mode === "playlist") {
            if (this.custom_playlist && this.custom_playlist.length > 0) {
                let m3uPath = GLib.get_user_config_dir() + "/live-wallpaper-playlist.m3u";
                let m3uContent = "";
                for (let item of this.custom_playlist) {
                    if (item.file) {
                        m3uContent += this._decodePath(item.file) + "\n";
                    }
                }
                if (m3uContent !== "") {
                    let file = Gio.File.new_for_path(m3uPath);
                    file.replace_contents(m3uContent, null, false, Gio.FileCreateFlags.NONE, null);
                    return m3uPath;
                }
            }
            return null;
        }

        if (this.wallpaper_mode === "custom") {
            return this._decodePath(this.custom_path);
        }

        if (this.wallpaper_mode === "folder") {
            return this._decodePath(this.video_folder);
        }

        if (this.wallpaper_mode === "single") {
            return this._decodePath(this.video_file);
        }

        return null;
    }

    getLaunchCommand() {
        let path = this.getWallpaperPath();
        if (!path) return null;

        let displayArg = "-fs";

        // Multi-monitor support: fetch geometry if specific display is chosen
        if (this.target_display !== -1) {
            let monitors = Main.layoutManager.monitors;
            if (this.target_display < monitors.length) {
                let m = monitors[this.target_display];
                displayArg = `-g ${m.width}x${m.height}+${m.x}+${m.y}`;
            }
        }

        let vol = Math.round(this.volumeSlider.value * 100);
        if (vol === 0 && !this.start_muted) vol = 50;
        let muteArg = (this.mute_all || this.start_muted) ? "--mute=yes" : "--mute=no";
        let shuffleArg = this.shuffle_playlist ? "--shuffle" : "";
        return `xwinwrap ${displayArg} -fdt -ni -b -nf -un -- mpv -wid WID --loop-playlist=inf --no-osc --no-osd-bar --panscan=1.0 ${muteArg} ${shuffleArg} --volume=${vol} --input-ipc-server=/tmp/mpv-wallpaper-socket "${path}"`;
    }

    on_settings_changed() {
        if (this.isPlaying) {
            this.stopWallpaper();
            Mainloop.timeout_add(250, () => {
                this.startWallpaper();
                return false;
            });
        } else {
            this.startWallpaper();
        }
    }

    on_refresh_clicked() {
        if (this.isPlaying) {
            this.stopWallpaper();
            Mainloop.timeout_add(250, () => {
                this.startWallpaper();
                return false;
            });
        }
    }

    on_hide_icon_changed() {
        if (this.hide_icon) {
            this.actor.hide();
        } else {
            this.actor.show();
        }
    }

    on_shuffle_changed() {
        if (this.shuffleSwitch) {
            this.shuffleSwitch.setToggleState(this.shuffle_playlist);
        }
        if (this.isPlaying) {
            if (this.shuffle_playlist) {
                this.sendCommand(["playlist-shuffle"]);
            } else {
                this.sendCommand(["playlist-unshuffle"]);
            }
        }
    }

    on_mute_all_changed() {
        if (this.mute_all) {
            this.volumeSlider.actor.hide();
            if (this.isPlaying) {
                this.sendCommand(["set_property", "mute", "yes"]);
            }
        } else {
            this.volumeSlider.actor.show();
            if (this.isPlaying) {
                let property = this.isMuted ? "yes" : "no";
                this.sendCommand(["set_property", "mute", property]);
            }
        }
    }

    on_smart_pause_changed() {
        if (this.isPlaying) {
            if (this.smart_pause && this.smartPauseLoopId === 0) {
                this.smartPauseLoopId = Mainloop.timeout_add_seconds(1, () => this._onSmartPauseTick());
            } else if (!this.smart_pause && this.smartPauseLoopId > 0) {
                Mainloop.source_remove(this.smartPauseLoopId);
                this.smartPauseLoopId = 0;
                if (this.isSmartPaused) {
                    this.isSmartPaused = false;
                    this.sendCommand(["set_property", "pause", false]);
                }
            }
        }
    }

    startWallpaper() {
        let cmd = this.getLaunchCommand();
        if (!cmd) {
            Main.notify("Live Wallpaper", "Please configure a video file, folder, or custom playlist in the applet settings.");
            return;
        }

        let execCmd = `bash -c "
            while ! xdotool search --class nemo-desktop >/dev/null 2>&1; do sleep 0.1; done;
            while ! pactl info >/dev/null 2>&1; do sleep 0.1; done;
            rm -f /tmp/mpv-wallpaper-socket;
            ${cmd.replace(/"/g, '\\"')} &
            while ! xdotool search --class xwinwrap >/dev/null 2>&1; do sleep 0.1; done;
            xdotool search --class xwinwrap windowlower >/dev/null 2>&1;
            wait
        "`;

        Util.spawnCommandLine(execCmd);
        this.isPlaying = true;
        this.togglePlayItem.label.set_text("Stop Wallpaper");

        let isSingle = (this.wallpaper_mode === "single" || this.wallpaper_mode === "custom");
        this.nextTrackItem.setSensitive(!isSingle);
        this.prevTrackItem.setSensitive(!isSingle);
        this.shuffleSwitch.setSensitive(!isSingle);

        this.isMuted = this.start_muted;
        let iconName = this.isMuted ? "audio-volume-muted-symbolic" : "audio-volume-high-symbolic";
        this.volumeIcon.set_icon_name(iconName);

        if (!this.isMuted && this.volumeSlider.value === 0) {
            this.volumeSlider.setValue(0.5);
        } else if (this.isMuted) {
            this.volumeSlider.setValue(0.0);
        }

        if (this.mute_all) {
            this.volumeSlider.actor.hide();
        } else {
            this.volumeSlider.actor.show();
        }

        // Start smart pause loop if enabled
        if (this.smart_pause && this.smartPauseLoopId === 0) {
            this.smartPauseLoopId = Mainloop.timeout_add_seconds(1, () => this._onSmartPauseTick());
        }
    }

    stopWallpaper() {
        // Stop smart pause loop
        if (this.smartPauseLoopId > 0) {
            Mainloop.source_remove(this.smartPauseLoopId);
            this.smartPauseLoopId = 0;
        }

        Util.spawnCommandLine("pkill -f 'mpv.*mpv-wallpaper-socket'");
        Util.spawnCommandLine("pkill -f 'xwinwrap.*mpv-wallpaper-socket'");
        this.isPlaying = false;
        this.isSmartPaused = false;
        this.togglePlayItem.label.set_text("Start Wallpaper");
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stopWallpaper();
        } else {
            this.startWallpaper();
        }
    }

    sendCommand(cmdArray) {
        if (!this.isPlaying) return;

        // Properly convert the command array to JSON and escape it for the shell
        // e.g. {"command":["playlist-next"]} becomes {\\"command\\":[\\"playlist-next\\"]}
        let jsonStr = JSON.stringify({ command: cmdArray });
        let escapedJsonStr = jsonStr.replace(/"/g, '\\"');

        Util.spawnCommandLine(`sh -c "echo '${escapedJsonStr}' | socat - /tmp/mpv-wallpaper-socket"`);
    }

    _onSmartPauseTick() {
        if (!this.isPlaying) {
            this.smartPauseLoopId = 0;
            return false;
        }

        let shouldPause = false;
        let actors = global.get_window_actors();

        for (let actor of actors) {
            let win = actor.get_meta_window();
            if (!win) continue;

            // Check if window is on the target monitor
            let monitorIndex = win.get_monitor();
            let isTargetMonitor = (this.target_display === -1) || (monitorIndex === this.target_display);

            if (isTargetMonitor) {
                // Check if window is maximized or fullscreen, and not hidden/minimized
                if ((win.get_maximized() !== 0 || win.is_fullscreen()) && !win.is_hidden() && !win.minimized) {
                    shouldPause = true;
                    break;
                }
            }
        }

        if (shouldPause !== this.isSmartPaused) {
            this.isSmartPaused = shouldPause;
            this.sendCommand(["set_property", "pause", shouldPause]);
        }

        return true; // Keep the loop running
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new LiveWallpaperApplet(metadata, orientation, panel_height, instance_id);
}
