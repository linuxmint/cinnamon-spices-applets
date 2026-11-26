const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

// Below this level (0..1) a frame counts as silence and nothing is drawn.
const SILENCE_LEVEL = 0.02;
// If CAVA sends no frame for this long (it sleeps when idle), clear the bars.
const STALE_MS = 400;
const CHECK_INTERVAL_MS = 200;

class CavaPanelApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._appletPath = metadata.path;

        this._bars = new Array(16).fill(0);
        this._proc = null;
        this._reader = null;
        this._removed = false;
        this._lastFrame = GLib.get_monotonic_time();
        this._silent = true;
        this._watchdog = 0;

        this.actor.set_style('padding: 0px; margin: 0px;');
        this.actor.set_width(88);
        this.actor.set_height(panelHeight);

        this._area = new St.DrawingArea();
        this._area.set_width(88);
        this._area.set_height(panelHeight);
        this._area.connect('repaint', this._draw.bind(this));
        this.actor.add_child(this._area);

        this._tooltipBusy = false;
        this.set_applet_tooltip('Live audio spectrum (CAVA)');
        // Refresh the info each time the pointer enters the applet.
        this.actor.connect('enter-event', () => {
            this._updateTooltip();
            return false;
        });
        this._updateTooltip();

        this._startWatchdog();
        this._startCava();
    }

    _configPath() {
        return GLib.build_filenamev([
            this._appletPath, 'cinnamon-panel.conf'
        ]);
    }

    // CAVA stops emitting frames when idle, so the last frame would stay
    // on screen. This timer clears the bars when frames stop arriving.
    _startWatchdog() {
        this._watchdog = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CHECK_INTERVAL_MS, () => {
            if (this._removed)
                return GLib.SOURCE_REMOVE;

            const ageMs = (GLib.get_monotonic_time() - this._lastFrame) / 1000;
            if (ageMs > STALE_MS && !this._silent)
                this._setSilent();

            return GLib.SOURCE_CONTINUE;
        });
    }

    _setSilent() {
        const changed = !this._silent;
        this._silent = true;
        this._bars.fill(0);
        this._area.queue_repaint();
        if (changed)
            this._updateTooltip();
    }

    // Runs a command without blocking the shell; callback gets trimmed
    // stdout, or '' if the command is missing or fails.
    _run(argv, callback) {
        try {
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            proc.communicate_utf8_async(null, null, (p, res) => {
                let out = '';
                try {
                    const pair = p.communicate_utf8_finish(res);
                    if (p.get_successful() && pair[1])
                        out = pair[1].trim();
                } catch (e) {}
                if (!this._removed)
                    callback(out);
            });
        } catch (e) {
            callback('');
        }
    }

    // Builds the tooltip from: output device, volume/mute (pactl) and the
    // current track (playerctl, optional).
    _updateTooltip() {
        if (this._tooltipBusy || this._removed)
            return;
        this._tooltipBusy = true;

        const info = { sinks: '', defaultSink: '', volume: '', mute: '', track: '', player: '' };
        let pending = 5;
        const done = () => {
            if (--pending > 0)
                return;
            this._tooltipBusy = false;
            this._applyTooltip(info);
        };

        this._run(['pactl', 'get-default-sink'], out => { info.defaultSink = out; done(); });
        this._run(['pactl', 'list', 'sinks'], out => { info.sinks = out; done(); });
        this._run(['pactl', 'get-sink-volume', '@DEFAULT_SINK@'], out => {
            const m = out.match(/(\d+)%/);
            info.volume = m ? m[1] + '%' : '';
            done();
        });
        this._run(['pactl', 'get-sink-mute', '@DEFAULT_SINK@'], out => {
            info.mute = /yes/i.test(out) ? 'muted' : '';
            done();
        });
        this._run(['playerctl', 'metadata', '--format',
                   '{{status}}|{{artist}} - {{title}}'], out => {
            const idx = out.indexOf('|');
            if (idx > 0) {
                info.player = out.slice(0, idx);
                info.track = out.slice(idx + 1).replace(/^ - /, '').trim();
            }
            done();
        });
    }

    _applyTooltip(info) {
        // Friendly device name: the Description line of the default sink.
        let device = info.defaultSink;
        if (info.sinks && info.defaultSink) {
            const blocks = info.sinks.split(/\n(?=Sink #)/);
            for (const block of blocks) {
                if (block.indexOf('Name: ' + info.defaultSink) !== -1) {
                    const d = block.match(/Description: (.+)/);
                    if (d)
                        device = d[1].trim();
                    break;
                }
            }
        }

        const lines = [];
        lines.push(this._silent ? 'No audio playing' : 'Audio playing');
        if (info.track)
            lines.push((info.player ? info.player + ': ' : '') + info.track);
        if (device)
            lines.push('Output: ' + device);
        if (info.volume)
            lines.push('Volume: ' + info.volume + (info.mute ? ' (muted)' : ''));

        this.set_applet_tooltip(lines.join('\n'));
    }

    _startCava() {
        const config = this._configPath();

        if (!GLib.file_test(config, GLib.FileTest.EXISTS)) {
            global.logError('CAVA Panel: configuration not found: ' + config);
            return;
        }

        try {
            this._proc = Gio.Subprocess.new(
                ['/usr/bin/cava', '-p', config],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            this._reader = new Gio.DataInputStream({
                base_stream: this._proc.get_stdout_pipe()
            });
            this._readNextLine();
        } catch (e) {
            global.logError('CAVA Panel: could not start CAVA: ' + e);
        }
    }

    _readNextLine() {
        if (this._removed || !this._reader)
            return;

        this._reader.read_line_async(
            GLib.PRIORITY_DEFAULT,
            null,
            (stream, result) => {
                if (this._removed)
                    return;

                try {
                    const resultPair = stream.read_line_finish(result);
                    const bytes = resultPair[0];

                    if (bytes === null) {
                        global.log('CAVA Panel: CAVA output ended.');
                        this._setSilent();
                        return;
                    }

                    const line = ByteArray.toString(bytes).trim();
                    const values = line.split(';')
                        .filter(v => v.length > 0)
                        .map(v => Number(v));

                    if (values.length >= 16 && values.slice(0, 16).every(Number.isFinite)) {
                        this._bars = values.slice(0, 16).map(v =>
                            Math.max(0, Math.min(1, v / 1000))
                        );
                        this._lastFrame = GLib.get_monotonic_time();
                        const nowSilent = Math.max(...this._bars) < SILENCE_LEVEL;
                        const changed = nowSilent !== this._silent;
                        this._silent = nowSilent;
                        this._area.queue_repaint();
                        if (changed)
                            this._updateTooltip();
                    }
                    this._readNextLine();
                } catch (e) {
                    if (!this._removed)
                        global.logError('CAVA Panel: error reading CAVA output: ' + e);
                }
            }
        );
    }

    _draw(area) {
        const cr = area.get_context();

        // No audio: draw nothing at all.
        if (this._silent) {
            cr.$dispose();
            return;
        }

        const width = area.get_width();
        const height = area.get_height();

        // Transparent background; bars are centered vertically.
        const count = this._bars.length;
        const gap = 2;
        const barWidth = Math.max(2, (width - (count - 1) * gap) / count);
        const maxHeight = Math.max(8, height - 6);

        cr.setSourceRGBA(0.43, 0.91, 0.72, 0.95); // soft mint
        for (let i = 0; i < count; i++) {
            const level = this._bars[i];
            const barHeight = Math.max(2, level * maxHeight);
            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;
            cr.rectangle(x, y, barWidth, barHeight);
            cr.fill();
        }
        cr.$dispose();
    }

    on_applet_removed_from_panel() {
        this._removed = true;

        if (this._watchdog) {
            GLib.source_remove(this._watchdog);
            this._watchdog = 0;
        }

        if (this._reader) {
            try { this._reader.close(null); } catch (e) {}
            this._reader = null;
        }

        if (this._proc) {
            try { this._proc.force_exit(); } catch (e) {}
            this._proc = null;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CavaPanelApplet(metadata, orientation, panelHeight, instanceId);
}
