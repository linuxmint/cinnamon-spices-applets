const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Util = imports.misc.util;

const UUID = "qbittorrent@martzy";

function _(str) {
    return str;
}

class QbittorrentApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._busy = false;
        this._timeoutId = null;
        this._torrents = [];
        this._currentTorrent = null;
        this._cookieFile = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            `qbittorrent-applet-${instance_id}-cookies.txt`
        ]);

        this.set_applet_icon_path(GLib.build_filenamev([metadata.path, "icon.png"]));
        this._applet_icon.style = "padding-right: 4px;";
        this._applyIconSize();
        this.set_applet_label(_("qBittorrent"));
        this.set_applet_tooltip(_("qBittorrent Monitor"));

        this._pauseResumeIcon = this._createActionIcon(
            "media-playback-pause-symbolic",
            () => this._togglePauseResume(this._currentTorrent),
            "padding-left: 10px;"
        );
        this._deleteIcon = this._createActionIcon(
            "user-trash-symbolic",
            () => this._confirmDelete(this._currentTorrent),
            "padding-left: 8px;"
        );
        this._setActionButtonsVisible(false);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", (menu, open) => {
            if (open) this._populateMenu();
        });

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("url", "serverUrl", this._onConnectionSettingChanged.bind(this));
        this.settings.bind("username", "username", this._onConnectionSettingChanged.bind(this));
        this.settings.bind("password", "password", this._onConnectionSettingChanged.bind(this));
        this.settings.bind("poll-interval", "pollInterval", this._onPollIntervalChanged.bind(this));
        this.settings.bind("max-label-length", "maxLabelLength", null);
        this.settings.bind("dropdown-count", "dropdownCount", this._onConnectionSettingChanged.bind(this));

        this._applet_context_menu.addAction(_("Refresh now"), () => this._refresh());
        this._applet_context_menu.addAction(_("Open WebUI"), () => this._openWebUi());

        this._restartPolling();
    }

    _createActionIcon(iconName, onActivate, style) {
        const icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16,
            reactive: true,
            track_hover: true,
            style_class: "applet-icon qbt-action-icon",
            style
        });
        icon.connect("button-press-event", (actor, event) => {
            if (event.get_button() !== 1) return false;
            onActivate();
            return true;
        });
        this.actor.add(icon, { y_align: St.Align.MIDDLE });
        return icon;
    }

    _setActionButtonsVisible(visible) {
        if (visible) {
            this._pauseResumeIcon.show();
            this._deleteIcon.show();
        } else {
            this._pauseResumeIcon.hide();
            this._deleteIcon.hide();
            this._currentTorrent = null;
        }
    }

    _applyIconSize() {
        // Cinnamon resets full-color applet icons to the panel zone's default
        // size on layout/height changes; these hooks re-apply our fixed size.
        this._applet_icon.set_icon_size(16);
    }

    on_panel_icon_size_changed(size) {
        this._applyIconSize();
    }

    on_panel_height_changed() {
        this._applyIconSize();
    }

    _baseUrl() {
        return (this.serverUrl || "").replace(/\/+$/, "");
    }

    _openWebUi() {
        Util.spawnCommandLineAsync(`xdg-open ${GLib.shell_quote(this._baseUrl())}`);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _onConnectionSettingChanged() {
        this._restartPolling();
    }

    _onPollIntervalChanged() {
        this._restartPolling();
    }

    _restartPolling() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._refresh();
        const interval = Math.max(2, this.pollInterval || 5);
        this._timeoutId = Mainloop.timeout_add_seconds(interval, () => {
            this._refresh();
            return true;
        });
    }

    _spawn(argv) {
        return new Promise((resolve, reject) => {
            try {
                const proc = new Gio.Subprocess({
                    argv,
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                });
                proc.init(null);
                proc.communicate_utf8_async(null, null, (p, res) => {
                    try {
                        const [, stdout, stderr] = p.communicate_utf8_finish(res);
                        resolve({ status: p.get_exit_status(), stdout, stderr });
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    _splitHttpStatus(stdout) {
        const marker = "\n@@HTTP_STATUS@@";
        const idx = stdout.lastIndexOf(marker);
        if (idx === -1) return { body: stdout, httpStatus: 0 };
        return {
            body: stdout.substring(0, idx),
            httpStatus: parseInt(stdout.substring(idx + marker.length).trim(), 10) || 0
        };
    }

    async _login() {
        const base = this._baseUrl();
        const url = `${base}/api/v2/auth/login`;
        const args = [
            "curl", "-s", "-S", "--connect-timeout", "5",
            "-c", this._cookieFile,
            "-H", `Referer: ${base}`,
            "-H", `Origin: ${base}`,
            "--data-urlencode", `username=${this.username || ""}`,
            "--data-urlencode", `password=${this.password || ""}`,
            "-w", "\n@@HTTP_STATUS@@%{http_code}",
            url
        ];
        const { status, stdout, stderr } = await this._spawn(args);
        if (status !== 0) {
            throw new Error(`connection failed (${stderr.trim() || status})`);
        }
        const { body, httpStatus } = this._splitHttpStatus(stdout);
        if (httpStatus !== 200 || body.trim() !== "Ok.") {
            throw new Error(`login rejected (HTTP ${httpStatus}) - check username/password`);
        }
    }

    async _fetchTorrents() {
        const base = this._baseUrl();
        const limit = 1 + Math.max(1, this.dropdownCount || 4);
        const url = `${base}/api/v2/torrents/info?sort=added_on&reverse=true&limit=${limit}`;
        const args = [
            "curl", "-s", "-S", "--connect-timeout", "5",
            "-b", this._cookieFile,
            "-H", `Referer: ${base}`,
            "-w", "\n@@HTTP_STATUS@@%{http_code}",
            url
        ];
        const { status, stdout, stderr } = await this._spawn(args);
        if (status !== 0) {
            throw new Error(`connection failed (${stderr.trim() || status})`);
        }
        const { body, httpStatus } = this._splitHttpStatus(stdout);
        if (httpStatus === 401 || httpStatus === 403) {
            return null;
        }
        if (httpStatus !== 200) {
            throw new Error(`WebUI returned HTTP ${httpStatus}`);
        }
        const trimmed = body.trim();
        if (trimmed === "") {
            return null;
        }
        try {
            return JSON.parse(trimmed);
        } catch (e) {
            throw new Error(`unexpected response from WebUI: ${trimmed.substring(0, 80)}`);
        }
    }

    async _postAction(path, fields, allowRetry = true) {
        const base = this._baseUrl();
        const url = `${base}${path}`;
        const args = [
            "curl", "-s", "-S", "--connect-timeout", "5",
            "-b", this._cookieFile,
            "-H", `Referer: ${base}`,
            "-H", `Origin: ${base}`
        ];
        for (const key of Object.keys(fields)) {
            args.push("--data-urlencode", `${key}=${fields[key]}`);
        }
        args.push("-w", "\n@@HTTP_STATUS@@%{http_code}", url);

        const { status, stdout, stderr } = await this._spawn(args);
        if (status !== 0) {
            throw new Error(`connection failed (${stderr.trim() || status})`);
        }
        const { httpStatus } = this._splitHttpStatus(stdout);
        if ((httpStatus === 401 || httpStatus === 403) && allowRetry) {
            await this._login();
            return this._postAction(path, fields, false);
        }
        if (httpStatus !== 200) {
            throw new Error(`action failed (HTTP ${httpStatus})`);
        }
    }

    async _togglePauseResume(torrent) {
        if (!torrent || !torrent.hash) return;
        const isPaused = (torrent.state || "").startsWith("paused");
        try {
            await this._postAction(
                isPaused ? "/api/v2/torrents/resume" : "/api/v2/torrents/pause",
                { hashes: torrent.hash }
            );
            await this._refresh();
        } catch (e) {
            global.logWarning(`qbittorrent@martzy: ${e.message}`);
        }
    }

    _confirmDelete(torrent) {
        if (!torrent || !torrent.hash) return;
        const dialog = new ModalDialog.ConfirmDialog(
            _(`Delete "${torrent.name}" and its files? This cannot be undone.`),
            () => this._deleteTorrent(torrent)
        );
        dialog.open();
    }

    async _deleteTorrent(torrent) {
        try {
            await this._postAction("/api/v2/torrents/delete", {
                hashes: torrent.hash,
                deleteFiles: "true"
            });
            await this._refresh();
        } catch (e) {
            global.logWarning(`qbittorrent@martzy: ${e.message}`);
        }
    }

    async _refresh() {
        if (this._busy) return;
        if (!this._baseUrl()) {
            this.set_applet_label(_("Not configured"));
            this.set_applet_tooltip(_("Right-click > Configure to set the WebUI URL"));
            this._setActionButtonsVisible(false);
            return;
        }

        this._busy = true;
        try {
            let torrents = await this._fetchTorrents();

            if (torrents === null) {
                await this._login();
                torrents = await this._fetchTorrents();
                if (torrents === null) {
                    throw new Error("not authenticated");
                }
            }

            this._torrents = torrents;

            if (!torrents.length) {
                this.set_applet_label(_("No torrents"));
                this.set_applet_tooltip(_("qBittorrent: no torrents found"));
                this._setActionButtonsVisible(false);
                return;
            }

            this._renderTorrent(torrents[0]);

            if (this.menu.isOpen) {
                this._populateMenu();
            }
        } catch (e) {
            this.set_applet_label(_("Error"));
            this.set_applet_tooltip(`qBittorrent: ${e.message}`);
            this._setActionButtonsVisible(false);
            global.logWarning(`qbittorrent@martzy: ${e.message}`);
        } finally {
            this._busy = false;
        }
    }

    _truncate(name) {
        const maxLen = this.maxLabelLength || 24;
        if (!name) return "";
        if (name.length > maxLen) {
            return name.substring(0, Math.max(1, maxLen - 1)) + "…";
        }
        return name;
    }

    _renderTorrent(t) {
        this._currentTorrent = t;
        const pct = Math.round((t.progress || 0) * 100);
        this.set_applet_label(`${this._truncate(t.name || "")}  ${pct}%`);

        this._setActionButtonsVisible(true);
        this._pauseResumeIcon.set_icon_name(
            (t.state || "").startsWith("paused") ? "media-playback-start-symbolic" : "media-playback-pause-symbolic"
        );

        const dl = this._formatSpeed(t.dlspeed);
        const up = this._formatSpeed(t.upspeed);
        const eta = this._formatEta(t.eta);
        this.set_applet_tooltip(
            `${t.name}\n` +
            `State: ${t.state}  ·  ${pct}%\n` +
            `↓ ${dl}   ↑ ${up}\n` +
            `ETA: ${eta}`
        );
    }

    _populateMenu() {
        this.menu.removeAll();
        const rest = (this._torrents || []).slice(1, 1 + Math.max(1, this.dropdownCount || 4));
        if (!rest.length) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No other torrents"), { reactive: false }));
            return;
        }
        const items = rest.map(t => this._buildMenuRow(t));
        for (const item of items) {
            this.menu.addMenuItem(item);
        }
        this._alignMenuColumns(items);
    }

    _alignMenuColumns(items) {
        if (!items.length) return;
        const widthsList = items.map(item => item.getColumnWidths());
        const numCols = Math.max(...widthsList.map(w => w.length));
        const maxWidths = [];
        for (let c = 0; c < numCols; c++) {
            maxWidths[c] = Math.max(...widthsList.map(w => w[c] || 0));
        }
        for (const item of items) {
            item.setColumnWidths(maxWidths);
        }
    }

    _buildMenuRow(t) {
        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, hover: false, focusOnHover: false });

        const pct = Math.round((t.progress || 0) * 100);

        const nameLabel = new St.Label({ text: this._truncate(t.name || "") });
        item.addActor(nameLabel);

        const pctLabel = new St.Label({ text: `${pct}%`, style: "padding-left: 10px;" });
        item.addActor(pctLabel, { align: St.Align.END });

        const buttonBox = new St.BoxLayout({ style: "padding-left: 10px;" });

        const isPaused = (t.state || "").startsWith("paused");
        const prIcon = new St.Icon({
            icon_name: isPaused ? "media-playback-start-symbolic" : "media-playback-pause-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16,
            reactive: true,
            track_hover: true,
            style_class: "popup-menu-icon"
        });
        prIcon.connect("button-press-event", (actor, event) => {
            if (event.get_button() !== 1) return false;
            this._togglePauseResume(t);
            return true;
        });
        buttonBox.add(prIcon, { y_align: St.Align.MIDDLE });

        const delIcon = new St.Icon({
            icon_name: "user-trash-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16,
            reactive: true,
            track_hover: true,
            style_class: "popup-menu-icon",
            style: "padding-left: 6px;"
        });
        delIcon.connect("button-press-event", (actor, event) => {
            if (event.get_button() !== 1) return false;
            this.menu.close();
            this._confirmDelete(t);
            return true;
        });
        buttonBox.add(delIcon, { y_align: St.Align.MIDDLE });

        item.addActor(buttonBox, { expand: true, span: -1, align: St.Align.END });

        return item;
    }

    _formatSpeed(bytesPerSec) {
        const n = Number(bytesPerSec) || 0;
        if (n < 1024) return `${n} B/s`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB/s`;
        return `${(n / (1024 * 1024)).toFixed(1)} MiB/s`;
    }

    _formatEta(seconds) {
        const s = Number(seconds) || 0;
        if (s <= 0 || s >= 8640000) return "∞";
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    }

    on_applet_removed_from_panel() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this.menu.destroy();
        this.settings.finalize();
        try {
            Gio.File.new_for_path(this._cookieFile).delete(null);
        } catch (e) {
            // cookie file may not exist
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new QbittorrentApplet(metadata, orientation, panel_height, instance_id);
}
