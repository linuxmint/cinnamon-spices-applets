const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Layout settings. Change these values to resize the display.
const BANDS = 10;             // number of bars
const STEPS = 8;              // height steps per bar
const BLOCK_H = 4;            // pixel height of one step (no gap between steps)
const BAR_W = 12;             // pixel width of one bar
const BAR_GAP = 2;            // pixel gap between bars
const RETRY_SECONDS = 3;      // wait time before cava is started again after a failure
const HIDE_DELAY_SECONDS = 2; // wait time after the last player stops, before hiding
const CAVA_MAX = 1000;        // must equal ascii_max_range in the cava config below

// Colour limits as a fraction of full height (cliamp style).
const GREEN_LIMIT = 0.5;
const YELLOW_LIMIT = 0.75;

const GREEN = [0.54, 0.88, 0.25];
const YELLOW = [1.0, 0.91, 0.30];
const RED = [0.94, 0.20, 0.20];

const WIDTH = BANDS * BAR_W + (BANDS - 1) * BAR_GAP;
const HEIGHT = STEPS * BLOCK_H;

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const PROPS_IFACE = 'org.freedesktop.DBus.Properties';

// The applet writes this file to ~/.config/sound-visualiser/cava.conf at each cava start.
// Input "pulse" with source "auto" reads the monitor of the default output device.
// It works on PulseAudio and on PipeWire (through its pulse layer).
const CAVA_CONFIG = `[general]
bars = ${BANDS}
framerate = 15
autosens = 1

[input]
method = pulse
source = auto

[output]
method = raw
channels = mono
mono_option = average
raw_target = /dev/stdout
data_format = ascii
ascii_max_range = ${CAVA_MAX}
bar_delimiter = 59
frame_delimiter = 10

[smoothing]
noise_reduction = 77
`;

class MediaBars extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._bands = new Array(BANDS).fill(0);
        this._players = new Map();   // unique bus name -> { status, title, artist }
        this._subIds = [];
        this._proc = null;
        this._stream = null;
        this._cancellable = null;
        this._retryId = 0;
        this._hideId = 0;
        this._playing = false;
        this._hasFrame = false;
        this._warned = false;
        this._destroyed = false;

        this._area = new St.DrawingArea({ reactive: false });
        this._area.set_size(WIDTH, HEIGHT);
        this._area.connect('repaint', (area) => this._onRepaint(area));
        this.actor.add(this._area, { y_align: St.Align.MIDDLE, y_fill: false });

        // Stay hidden until a player reports Playing and cava sends a frame.
        this.actor.hide();

        this._subscribeMpris();
        this._scanPlayers();
    }

    // ---------- MPRIS (player state and track info) ----------

    _subscribeMpris() {
        let bus = Gio.DBus.session;
        this._subIds.push(bus.signal_subscribe(
            null, PROPS_IFACE, 'PropertiesChanged', MPRIS_PATH, PLAYER_IFACE,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => this._onPropsChanged(sender, params)));
        this._subIds.push(bus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => this._onNameOwnerChanged(params)));
    }

    _newPlayer() {
        return { status: 'Stopped', title: '', artist: '' };
    }

    _applyData(player, data) {
        if (typeof data.PlaybackStatus === 'string')
            player.status = data.PlaybackStatus;
        let md = data.Metadata;
        if (md && typeof md === 'object') {
            player.title = typeof md['xesam:title'] === 'string' ? md['xesam:title'] : '';
            let artist = md['xesam:artist'];
            if (Array.isArray(artist))
                player.artist = artist.join(', ');
            else
                player.artist = typeof artist === 'string' ? artist : '';
        }
    }

    _onPropsChanged(sender, params) {
        if (this._destroyed)
            return;
        let data;
        try {
            data = params.get_child_value(1).recursiveUnpack();
        } catch (e) {
            return;
        }
        let player = this._players.get(sender) || this._newPlayer();
        this._applyData(player, data);
        this._players.set(sender, player);
        this._refresh();
    }

    _onNameOwnerChanged(params) {
        if (this._destroyed)
            return;
        let [name, oldOwner, newOwner] = params.deepUnpack();
        if (newOwner === '' && oldOwner && this._players.has(oldOwner)) {
            this._players.delete(oldOwner);
            this._refresh();
        }
    }

    _scanPlayers() {
        Gio.DBus.session.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'ListNames', null, new GLib.VariantType('(as)'),
            Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                let names;
                try {
                    names = conn.call_finish(res).get_child_value(0).deepUnpack();
                } catch (e) {
                    return;
                }
                names.filter((n) => n.startsWith(MPRIS_PREFIX))
                     .forEach((n) => this._queryPlayer(n));
            });
    }

    _queryPlayer(name) {
        let bus = Gio.DBus.session;
        bus.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'GetNameOwner', new GLib.Variant('(s)', [name]), new GLib.VariantType('(s)'),
            Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                let owner;
                try {
                    owner = conn.call_finish(res).deepUnpack()[0];
                } catch (e) {
                    return;
                }
                bus.call(
                    name, MPRIS_PATH, PROPS_IFACE,
                    'GetAll', new GLib.Variant('(s)', [PLAYER_IFACE]),
                    new GLib.VariantType('(a{sv})'),
                    Gio.DBusCallFlags.NONE, -1, null,
                    (conn2, res2) => {
                        let data;
                        try {
                            data = conn2.call_finish(res2).get_child_value(0).recursiveUnpack();
                        } catch (e) {
                            return;
                        }
                        if (this._destroyed)
                            return;
                        let player = this._players.get(owner) || this._newPlayer();
                        this._applyData(player, data);
                        this._players.set(owner, player);
                        this._refresh();
                    });
            });
    }

    // Decide from the player list whether the bars run, and update the tooltip.
    _refresh() {
        let active = null;
        for (let player of this._players.values()) {
            if (player.status === 'Playing') {
                active = player;
                break;
            }
        }

        if (active) {
            this._setTooltip(active);
            if (this._hideId) {
                GLib.source_remove(this._hideId);
                this._hideId = 0;
            }
            if (!this._playing) {
                this._playing = true;
                this._startCava();
            }
        } else if (this._playing && !this._hideId) {
            // Wait before hiding, so the gap between two tracks does not flicker.
            this._hideId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, HIDE_DELAY_SECONDS, () => {
                this._hideId = 0;
                this._playing = false;
                this._stopCava();
                this._hideBars();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _setTooltip(player) {
        let text;
        if (player.artist && player.title)
            text = player.artist + ' - ' + player.title;
        else
            text = player.title || player.artist || 'Playing';
        this.set_applet_tooltip(text);
    }

    // ---------- cava (bar data) ----------

    _startCava() {
        if (this._destroyed || !this._playing || this._proc)
            return;

        try {
            let dir = GLib.get_user_config_dir() + '/sound-visualiser';
            let conf = dir + '/cava.conf';
            GLib.mkdir_with_parents(dir, 0o755);
            GLib.file_set_contents(conf, CAVA_CONFIG);
            this._proc = new Gio.Subprocess({
                argv: ['cava', '-p', conf],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            this._proc.init(null);
        } catch (e) {
            if (!this._warned) {
                this._warned = true;
                global.logError('sound-visualiser: cava start failed (if cava is missing, run: sudo apt install cava): ' + e);
            }
            this._proc = null;
            this._scheduleRetry();
            return;
        }

        this._cancellable = new Gio.Cancellable();
        this._stream = new Gio.DataInputStream({
            base_stream: this._proc.get_stdout_pipe(),
            close_base_stream: true
        });
        this._readLine();
    }

    _readLine() {
        let stream = this._stream;
        if (!stream)
            return;
        stream.read_line_async(GLib.PRIORITY_DEFAULT, this._cancellable, (s, res) => {
            // Ignore callbacks from a stream that was already replaced or closed.
            if (this._destroyed || s !== this._stream)
                return;
            let line = null;
            try {
                [line] = s.read_line_finish_utf8(res);
            } catch (e) {
                line = null;
            }
            if (line === null) {
                this._onStreamEnd();
                return;
            }
            this._onLine(line);
            this._readLine();
        });
    }

    _onLine(line) {
        // One frame looks like "12;340;999;...;" with a trailing delimiter.
        let values = line.split(';').filter((t) => t !== '').map(Number);
        if (values.length < BANDS || values.some((v) => !isFinite(v)))
            return;
        for (let i = 0; i < BANDS; i++)
            this._bands[i] = Math.min(1, Math.max(0, values[i] / CAVA_MAX));
        if (!this._hasFrame) {
            this._hasFrame = true;
            this.actor.show();
        }
        this._area.queue_repaint();
    }

    _onStreamEnd() {
        this._stopCava();
        this._hideBars();
        if (this._playing)
            this._scheduleRetry();
    }

    _scheduleRetry() {
        if (this._destroyed || this._retryId || !this._playing)
            return;
        this._retryId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, RETRY_SECONDS, () => {
            this._retryId = 0;
            this._startCava();
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopCava() {
        let stream = this._stream;
        let proc = this._proc;
        let cancellable = this._cancellable;
        this._stream = null;
        this._proc = null;
        this._cancellable = null;
        if (cancellable)
            cancellable.cancel();
        if (proc) {
            try { proc.force_exit(); } catch (e) {}
        }
        if (stream) {
            try { stream.close(null); } catch (e) {}
        }
    }

    _hideBars() {
        this._hasFrame = false;
        this._bands.fill(0);
        this.actor.hide();
    }

    // ---------- drawing ----------

    _onRepaint(area) {
        let cr = area.get_context();
        for (let i = 0; i < BANDS; i++) {
            let lit = Math.round(this._bands[i] * STEPS);
            let x = i * (BAR_W + BAR_GAP);
            for (let k = 1; k <= lit; k++) {
                let fraction = k / STEPS;
                let colour = RED;
                if (fraction <= GREEN_LIMIT)
                    colour = GREEN;
                else if (fraction <= YELLOW_LIMIT)
                    colour = YELLOW;
                cr.setSourceRGB(colour[0], colour[1], colour[2]);
                cr.rectangle(x, HEIGHT - k * BLOCK_H, BAR_W, BLOCK_H);
                cr.fill();
            }
        }
        cr.$dispose();
    }

    // ---------- cleanup ----------

    on_applet_removed_from_panel() {
        this._destroyed = true;
        for (let id of this._subIds)
            Gio.DBus.session.signal_unsubscribe(id);
        this._subIds = [];
        if (this._retryId) {
            GLib.source_remove(this._retryId);
            this._retryId = 0;
        }
        if (this._hideId) {
            GLib.source_remove(this._hideId);
            this._hideId = 0;
        }
        this._stopCava();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MediaBars(metadata, orientation, panelHeight, instanceId);
}
