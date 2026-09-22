const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const UUID = "mousetrail@sysrpl";

class MouseTrailApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this._iconDirectory = GLib.build_filenamev([metadata.path, "icons"]);
        this._statusPath = GLib.build_filenamev([
            GLib.get_user_runtime_dir(), "mousetrail-" + instanceId + ".status"
        ]);
        this._configPath = GLib.build_filenamev([
            GLib.get_home_dir(), ".cinnamon", "configs", UUID,
            UUID + ".json"
        ]);
        this._state = null;
        this._process = null;
        this._running = false;
        this._removed = false;
        this._restartTimer = 0;
        this.set_applet_tooltip("Mouse trail visual indicator");

        // The overlay owns the visibility hotkey. Clicking this icon opens
        // Cinnamon's configuration window; it never toggles the overlay.
        this._startOverlay(metadata.path);
        this._refresh();
        this._timer = Mainloop.timeout_add(250, () => this._refresh());
    }

    _startOverlay(appletPath) {
        if (this._removed)
            return;
        GLib.unlink(this._statusPath);
        try {
            this._process = Gio.Subprocess.new([
                "python3",
                GLib.build_filenamev([appletPath, "mousetrail.py"]),
                "--config", this._configPath,
                "--status", this._statusPath,
                "--instance-id", String(this.instance_id)
            ], Gio.SubprocessFlags.NONE);
            this._running = true;
            this._process.wait_async(null, (process, result) => {
                try {
                    process.wait_finish(result);
                } catch (error) {
                    global.logError(error);
                }
                this._running = false;
                this._process = null;
                if (!this._removed) {
                    this._refresh();
                    this._scheduleRestart(appletPath);
                }
            });
        } catch (error) {
            global.logError(error);
            this._scheduleRestart(appletPath);
        }
    }

    _scheduleRestart(appletPath) {
        if (this._removed || this._restartTimer)
            return;
        this._restartTimer = Mainloop.timeout_add_seconds(2, () => {
            this._restartTimer = 0;
            this._startOverlay(appletPath);
            return false;
        });
    }

    _setStyle() {
        super._setStyle();
        // Keep the SVG symbolic for theme recoloring, but give it the same
        // panel size and spacing as the neighboring applet icons.
        if (this._applet_icon) {
            this._applet_icon.set_style_class_name("applet-icon");
            let size = this.getPanelIconSize(St.IconType.FULLCOLOR);
            if (size)
                this._applet_icon.set_icon_size(size);
        }
    }

    _refresh() {
        let state = "inactive";
        if (this._running) {
            try {
                let [ok, contents] = GLib.file_get_contents(this._statusPath);
                if (ok) {
                    let value = "";
                    for (let i = 0; i < contents.length; i++)
                        value += String.fromCharCode(contents[i]);
                    if (value.trim() === "active")
                        state = "active";
                }
            } catch (error) {
                // The helper may not have written its first status yet.
            }
        }

        if (state !== this._state) {
            this._state = state;
            this.set_applet_tooltip(state === "active"
                ? "Mouse Trail active" : "Mouse Trail hidden");
            this.set_applet_icon_symbolic_path(GLib.build_filenamev([
                this._iconDirectory, "mousetrail-" + state + "-symbolic.svg"
            ]));
        }
        return true;
    }

    on_applet_clicked() {
        this.configureApplet();
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        Mainloop.source_remove(this._timer);
        if (this._restartTimer)
            Mainloop.source_remove(this._restartTimer);
        if (this._running)
            this._process.force_exit();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MouseTrailApplet(metadata, orientation, panelHeight, instanceId);
}
