const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "spotify-controller@OmerOrcunOzturk";

// Known Spotify desktop entries, in order of preference.
const INSTALL_TYPES = [
    { kind: "native",  desktopId: "spotify.desktop" },
    { kind: "flatpak", desktopId: "com.spotify.Client.desktop" },
    { kind: "snap",    desktopId: "spotify_spotify.desktop" },
];
// WM_CLASS of the Spotify window (same for all install types).
const WM_CLASS = "spotify";

// MPRIS D-Bus endpoint (same for all install types).
const MPRIS_NAME = "org.mpris.MediaPlayer2.spotify";
const MPRIS_PATH = "/org/mpris/MediaPlayer2";
const MPRIS_ROOT_IFACE = "org.mpris.MediaPlayer2";
const MPRIS_PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
const PROPERTIES_IFACE = "org.freedesktop.DBus.Properties";

// Translations: Spices compiles po/*.po into ~/.local/share/locale.
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function log(msg) {
    global.log(`[${UUID}] ${msg}`);
}

function logError(msg) {
    global.logError(`[${UUID}] ${msg}`);
}

// Returns { kind, appInfo } for a desktop entry, { kind: "path" } for a bare
// binary in PATH, or null if Spotify is not installed.
function detectInstall() {
    for (let type of INSTALL_TYPES) {
        let appInfo = Gio.DesktopAppInfo.new(type.desktopId);
        if (appInfo)
            return { kind: type.kind, appInfo };
    }
    if (GLib.find_program_in_path("spotify"))
        return { kind: "path", appInfo: null };
    return null;
}

class SpotifyApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._setIcon(metadata.path);

        this._install = detectInstall();
        if (this._install)
            log(`Spotify detected (${this._install.kind})`);
        else
            log("Spotify is not installed");

        this._spotifyRunning = false;
        this._ownerName = null;
        this._title = "";
        this._artist = "";
        this._buildMenu();
        this._updateTooltip();

        // Track whether Spotify is on the bus (works for every install type).
        this._nameWatchId = Gio.DBus.session.watch_name(
            MPRIS_NAME, Gio.BusNameWatcherFlags.NONE,
            (conn, name, owner) => this._onSpotifyAppeared(owner),
            () => this._onSpotifyVanished());

        // Track changes (listen to all senders, filter by owner in the
        // handler, since signals are sent from Spotify's unique name).
        this._propsSignalId = Gio.DBus.session.signal_subscribe(
            null, PROPERTIES_IFACE, "PropertiesChanged", MPRIS_PATH,
            MPRIS_PLAYER_IFACE, Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) =>
                this._onPropertiesChanged(sender, params));
    }

    // --- Icon, menu, tooltip ---------------------------------------------

    _setIcon(appletPath) {
        // Shipped with the applet, so no existence check is needed.
        this.set_applet_icon_symbolic_path(`${appletPath}/icons/spotify-symbolic.svg`);
    }

    _buildMenu() {
        let menu = this._applet_context_menu;

        let mediaItems = [
            new Applet.MenuItem(_("Play / Pause"), "xsi-media-playback-start-symbolic",
                                () => this._callMpris(MPRIS_PLAYER_IFACE, "PlayPause")),
            new Applet.MenuItem(_("Previous"), "xsi-media-skip-backward-symbolic",
                                () => this._callMpris(MPRIS_PLAYER_IFACE, "Previous")),
            new Applet.MenuItem(_("Next"), "xsi-media-skip-forward-symbolic",
                                () => this._callMpris(MPRIS_PLAYER_IFACE, "Next")),
        ];
        let openItem = new Applet.MenuItem(_("Open / Show Spotify"), "xsi-window-new-symbolic",
                                           () => this._activateOrLaunch());
        let quitItem = new Applet.MenuItem(_("Quit Spotify"), "xsi-window-close-symbolic",
                                           () => this._callMpris(MPRIS_ROOT_IFACE, "Quit"));

        for (let item of mediaItems)
            menu.addMenuItem(item);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addMenuItem(openItem);
        menu.addMenuItem(quitItem);

        // Items that only make sense while Spotify is running.
        this._runningItems = [...mediaItems, quitItem];
        // Cinnamon appends its own items (About, Remove...) after these,
        // separated by a separator, in finalizeContextMenu().

        this._setRunning(false);
    }

    _setRunning(running) {
        this._spotifyRunning = running;
        for (let item of this._runningItems)
            item.setSensitive(running);
    }

    _updateTooltip() {
        if (!this._spotifyRunning) {
            this.set_applet_tooltip(this._install ? _("Spotify — Closed") : _("Spotify — Not installed"));
            return;
        }
        let lines = ["Spotify"];
        if (this._title)
            lines.push(this._title);
        if (this._artist)
            lines.push(this._artist);
        this.set_applet_tooltip(lines.join("\n"));
    }

    // --- MPRIS -----------------------------------------------------------

    _onSpotifyAppeared(owner) {
        this._ownerName = owner;
        this._setRunning(true);
        this._fetchMetadata();
    }

    _onSpotifyVanished() {
        this._ownerName = null;
        this._setRunning(false);
        this._setMetadata(null);
    }

    _callMpris(iface, method) {
        if (!this._spotifyRunning) {
            log(`Spotify is not running, ignoring ${method}`);
            return;
        }
        Gio.DBus.session.call(
            MPRIS_NAME, MPRIS_PATH, iface, method,
            null, null, Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    conn.call_finish(res);
                } catch (e) {
                    logError(`MPRIS ${method} failed: ${e.message}`);
                }
            });
    }

    _fetchMetadata() {
        Gio.DBus.session.call(
            MPRIS_NAME, MPRIS_PATH, PROPERTIES_IFACE, "Get",
            new GLib.Variant("(ss)", [MPRIS_PLAYER_IFACE, "Metadata"]),
            null, Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    let [value] = conn.call_finish(res).deep_unpack();
                    this._setMetadata(value.deep_unpack());
                } catch (e) {
                    // Spotify may take a moment to expose metadata after start.
                    log(`Could not read metadata: ${e.message}`);
                    this._setMetadata(null);
                }
            });
    }

    _onPropertiesChanged(sender, params) {
        if (sender !== this._ownerName)
            return;
        try {
            let [, changed] = params.deep_unpack();
            if (changed["Metadata"])
                this._setMetadata(changed["Metadata"].deep_unpack());
        } catch (e) {
            logError(`Failed to handle PropertiesChanged: ${e.message}`);
        }
    }

    // metadata: a{sv} unpacked one level (values are GLib.Variant), or null.
    _setMetadata(metadata) {
        let title = "";
        let artist = "";
        try {
            if (metadata) {
                title = metadata["xesam:title"]?.deep_unpack() ?? "";
                let artists = metadata["xesam:artist"]?.deep_unpack() ?? [];
                artist = Array.isArray(artists) ? artists.join(", ") : String(artists);
            }
        } catch (e) {
            logError(`Failed to parse metadata: ${e.message}`);
        }
        this._title = title;
        this._artist = artist;
        this._updateTooltip();
    }

    // --- Window / launch -------------------------------------------------

    _findSpotifyWindow() {
        let windows = global.get_window_actors()
            .map(actor => actor.meta_window)
            .filter(win => win && (win.get_wm_class() || "").toLowerCase() === WM_CLASS);

        // Prefer the most recently used window.
        windows.sort((a, b) => b.get_user_time() - a.get_user_time());
        return windows.length > 0 ? windows[0] : null;
    }

    _launchSpotify() {
        // Re-detect if nothing was found at startup (Spotify may have been
        // installed since).
        if (!this._install) {
            this._install = detectInstall();
            this._updateTooltip();
        }
        if (!this._install) {
            logError("Spotify is not installed (no desktop entry, no 'spotify' in PATH)");
            return;
        }

        try {
            if (this._install.appInfo)
                this._install.appInfo.launch([], global.create_app_launch_context());
            else
                Util.trySpawn(["spotify"]);
        } catch (e) {
            logError(`Failed to launch Spotify (${this._install.kind}): ${e.message}`);
        }
    }

    _activateOrLaunch() {
        try {
            let win = this._findSpotifyWindow();
            if (win) {
                let workspace = win.get_workspace();
                Main.activateWindow(win, global.get_current_time(),
                                    workspace ? workspace.index() : undefined);
                return;
            }
        } catch (e) {
            logError(`Failed to activate Spotify window: ${e.message}`);
        }

        // Running but without a window: ask Spotify to show itself, so no
        // second process is started.
        if (this._spotifyRunning)
            this._callMpris(MPRIS_ROOT_IFACE, "Raise");
        else
            this._launchSpotify();
    }

    // --- Applet callbacks ------------------------------------------------

    on_applet_clicked(event) {
        this._activateOrLaunch();
    }

    on_applet_removed_from_panel() {
        if (this._nameWatchId) {
            Gio.DBus.session.unwatch_name(this._nameWatchId);
            this._nameWatchId = 0;
        }
        if (this._propsSignalId) {
            Gio.DBus.session.signal_unsubscribe(this._propsSignalId);
            this._propsSignalId = 0;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new SpotifyApplet(metadata, orientation, panelHeight, instanceId);
}
