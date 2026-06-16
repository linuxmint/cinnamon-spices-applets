// ============================================================
//  global-settings@brahim — Control Center
//  Author: Brahim Salem — Linux Mint 22.x / Cinnamon 5.x-6.x
// ============================================================

const GLib     = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio      = imports.gi.Gio;
const St       = imports.gi.St;
const Clutter  = imports.gi.Clutter;
const Cairo    = imports.cairo;
const Main     = imports.ui.main;
const Mainloop = imports.mainloop;

const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupMenuSection }             = imports.ui.popupMenu;
const { SignalManager }                                  = imports.misc.signalManager;
const { AppletSettings }                                 = imports.ui.settings;

// ── spawn sync ───────────────────────────────────────────────
function sh(cmd) {
    try {
        let [ok, out] = GLib.spawn_command_line_sync(cmd);
        if (ok && out) return imports.byteArray.toString(out).trim();
    } catch(e) {}
    return '';
}
function run(cmd) {
    try { GLib.spawn_command_line_async(cmd); } catch(e) {}
}
function sym(name, size) {
    return new St.Icon({ icon_name: name, icon_type: St.IconType.SYMBOLIC, icon_size: size || 16 });
}

// ── tooltip ──────────────────────────────────────────────────
let _showTooltips = true;
function tip(actor, text) {
    let tt = null;
    actor.connect('enter-event', () => {
        if (tt || !_showTooltips) return;
        tt = new St.Label({ text, style_class: 'tooltip-label' });
        Main.uiGroup.add_actor(tt);
        let [ax, ay] = actor.get_transformed_position();
        tt.set_position(Math.round(ax + actor.get_width()/2 - tt.width/2), Math.round(ay - 26));
        tt.raise_top();
    });
    actor.connect('leave-event', () => { if (tt) { tt.destroy(); tt = null; } });
}

// ── GLib.Variant recursive unwrap ────────────────────────────
function unpackV(v) {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v.unpack === 'function') return unpackV(v.unpack());
    if (typeof v.deepUnpack === 'function') {
        const u = v.deepUnpack();
        if (u !== v) return unpackV(u);
    }
    if (Array.isArray(v)) return v.map(x => unpackV(x));
    if (typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) out[k] = unpackV(v[k]);
        return out;
    }
    return v;
}

// ── tile ─────────────────────────────────────────────────────
function mkTile(icon, label, sub, tooltip) {
    let btn  = new St.Button({ style_class: 'gs-tile', reactive: true });
    let box  = new St.BoxLayout({ vertical: true, style: 'spacing:2px;' });
    let ic   = sym(icon, 16); ic.add_style_class_name('gs-tile-icon');
    let lbl  = new St.Label({ text: label, style_class: 'gs-tile-label' });
    let sub_ = new St.Label({ text: sub || '', style_class: 'gs-tile-sub' });
    box.add(ic, {expand:false}); box.add(lbl, {expand:false}); box.add(sub_, {expand:false});
    btn.set_child(box);
    btn._sub = sub_; btn._on = false;
    if (tooltip) tip(btn, tooltip);
    return btn;
}
function setTile(btn, on, sub) {
    btn._on = on;
    if (on) btn.add_style_class_name('gs-tile-on');
    else    btn.remove_style_class_name('gs-tile-on');
    if (sub !== undefined) btn._sub.set_text(sub);
}

// ── Cairo slider — macOS pill style ──────────────────────────
// The track IS the pill. The knob is a white circle that rides
// inside the pill, same height as the track. Looks exactly like
// macOS Control Center sliders.
function mkCairoSlider(maxVal, ampAt, onValueChanged) {
    const H   = 28;   // total widget height = pill height
    const R   = H / 2; // pill corner radius = half height → perfect pill

    const wrap = new St.DrawingArea({
        reactive: true,
        style: 'height:' + H + 'px;'
    });
    wrap._value  = 0;
    wrap._maxVal = maxVal;
    wrap._ampAt  = ampAt || null;
    wrap._cb     = onValueChanged;

    wrap.connect('repaint', (area) => {
        const cr    = area.get_context();
        const alloc = area.get_allocation_box();
        const W     = alloc.x2 - alloc.x1;
        if (W < 2) { cr.$dispose(); return; }

        const val   = wrap._value;
        const max   = wrap._maxVal;
        const amp   = wrap._ampAt;
        const x100  = amp ? W * (amp / max) : W;
        const xFill = Math.min(W, (val / max) * W);
        // Knob: circle that fits inside the pill, with small padding
        const KR    = R - 2;          // knob radius
        const KX    = Math.max(KR + 2, Math.min(W - KR - 2, xFill));

        cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        // ── pill helper ────────────────────────────────────────
        function pill(x, y, w, h) {
            if (w <= 0) return;
            const pr = Math.min(h / 2, w / 2);
            cr.newPath();
            cr.arc(x + pr,     y + pr,     pr, Math.PI,      3*Math.PI/2);
            cr.arc(x + w - pr, y + pr,     pr, 3*Math.PI/2,  0);
            cr.arc(x + w - pr, y + h - pr, pr, 0,            Math.PI/2);
            cr.arc(x + pr,     y + h - pr, pr, Math.PI/2,    Math.PI);
            cr.closePath();
        }

        // ── 1. Track background pill ───────────────────────────
        pill(0, 0, W, H);
        cr.setSourceRGBA(1, 1, 1, 0.18);
        cr.fill();

        // ── 2. Red zone background (amplification >100%) ───────
        if (amp && x100 < W) {
            // right portion of pill — use rectangle clipped to pill
            pill(0, 0, W, H);
            cr.clip();
            cr.rectangle(x100, 0, W - x100, H);
            cr.setSourceRGBA(1.0, 0.18, 0.18, 0.20);
            cr.fill();
            cr.resetClip();
        }

        // ── 3. Blue fill (normal zone) ─────────────────────────
        if (xFill > 0) {
            const xBlue = Math.min(xFill, x100);
            if (xBlue > 0) {
                pill(0, 0, W, H);
                cr.clip();
                cr.rectangle(0, 0, xBlue, H);
                cr.setSourceRGBA(0.10, 0.53, 1.0, 0.92);
                cr.fill();
                cr.resetClip();
            }
            // Red fill (amplification zone)
            if (amp && xFill > x100) {
                pill(0, 0, W, H);
                cr.clip();
                cr.rectangle(x100, 0, xFill - x100, H);
                cr.setSourceRGBA(1.0, 0.22, 0.22, 0.90);
                cr.fill();
                cr.resetClip();
            }
        }

        // ── 4. 100% separator tick ─────────────────────────────
        if (amp && x100 > 0 && x100 < W) {
            cr.newPath();
            cr.moveTo(x100, 3);
            cr.lineTo(x100, H - 3);
            cr.setSourceRGBA(1, 1, 1, 0.50);
            cr.setLineWidth(1.5);
            cr.stroke();
        }

        // ── 5. White knob circle ───────────────────────────────
        cr.newPath();
        cr.arc(KX, H / 2, KR, 0, 2 * Math.PI);
        cr.setSourceRGBA(1, 1, 1, 0.97);
        cr.fill();
        // subtle shadow ring
        cr.newPath();
        cr.arc(KX, H / 2, KR, 0, 2 * Math.PI);
        cr.setSourceRGBA(0, 0, 0, 0.14);
        cr.setLineWidth(0.8);
        cr.stroke();

        cr.$dispose();
    });

    wrap.setValue = function(v) {
        const clamped = Math.max(0, Math.min(wrap._maxVal, v));
        if (clamped === wrap._value) return;
        wrap._value = clamped;
        wrap.queue_repaint();
    };

    function posToVal(area, eventX) {
        const alloc = area.get_allocation_box();
        const W     = alloc.x2 - alloc.x1;
        const [ax]  = area.get_transformed_position();
        const frac  = Math.max(0, Math.min(1, (eventX - ax) / W));
        return frac * wrap._maxVal;
    }

    let dragging = false;
    wrap.connect('button-press-event', (a, ev) => {
        dragging = true;
        let [bx] = ev.get_coords();
        let v = posToVal(a, bx);
        wrap.setValue(v);
        if (wrap._cb) wrap._cb(v);
        return Clutter.EVENT_STOP;
    });
    wrap.connect('motion-event', (a, ev) => {
        if (!dragging) return Clutter.EVENT_PROPAGATE;
        let [bx] = ev.get_coords();
        let v = posToVal(a, bx);
        wrap.setValue(v);
        if (wrap._cb) wrap._cb(v);
        return Clutter.EVENT_STOP;
    });
    wrap.connect('button-release-event', () => { dragging = false; return Clutter.EVENT_STOP; });

    let scrollTimer = null;
    wrap.connect('scroll-event', (a, ev) => {
        const step = wrap._maxVal * 0.04;
        const dir  = ev.get_scroll_direction();
        let newVal = wrap._value;
        if (dir === Clutter.ScrollDirection.UP   || dir === Clutter.ScrollDirection.RIGHT)
            newVal = Math.min(wrap._maxVal, wrap._value + step);
        else if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.LEFT)
            newVal = Math.max(0, wrap._value - step);
        else
            return Clutter.EVENT_STOP;

        wrap.setValue(newVal);

        if (scrollTimer) { Mainloop.source_remove(scrollTimer); scrollTimer = null; }
        const captured = newVal;
        scrollTimer = Mainloop.timeout_add(80, () => {
            if (wrap._cb) wrap._cb(captured);
            scrollTimer = null;
            return false;
        });
        return Clutter.EVENT_STOP;
    });

    return wrap;
}

// ── brightness ───────────────────────────────────────────────
let _lastBrightness = 0.8;
let _lastVolume     = -1;
let _lastMuted      = false;

function getBrightness() {
    let dev = sh('ls /sys/class/backlight/ 2>/dev/null | head -1');
    if (dev) {
        let cur = parseInt(sh('cat /sys/class/backlight/' + dev + '/actual_brightness 2>/dev/null'));
        let max = parseInt(sh('cat /sys/class/backlight/' + dev + '/max_brightness 2>/dev/null'));
        if (!isNaN(cur) && !isNaN(max) && max > 0) {
            _lastBrightness = Math.min(Math.max(cur / max, 0.02), 1);
            return _lastBrightness;
        }
    }
    let out = sh('brightnessctl -m 2>/dev/null | cut -d, -f4 | tr -d %');
    let pct = parseInt(out);
    if (!isNaN(pct)) {
        _lastBrightness = Math.min(Math.max(pct / 100, 0.02), 1);
        return _lastBrightness;
    }
    return _lastBrightness;
}

function setBrightness(v) {
    _lastBrightness = Math.min(Math.max(v, 0.02), 1);
    let pct = Math.round(_lastBrightness * 100);
    if (sh('which brightnessctl 2>/dev/null')) {
        run('brightnessctl set ' + pct + '%');
        return;
    }
    let disp = sh("xrandr 2>/dev/null | awk '/ connected/{print $1; exit}'");
    if (disp) {
        run('xrandr --output ' + disp + ' --brightness ' + _lastBrightness.toFixed(2));
        return;
    }
    if (sh('which xbacklight 2>/dev/null')) run('xbacklight -set ' + pct);
}

// ── volume (FIXED with mute detection) ──────────────────────
function getVolume() {
    // Try pactl first (most reliable for PulseAudio/PipeWire)
    let pactlOut = sh("pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null");
    if (pactlOut) {
        // Look for percentage pattern like "25%" or "150%"
        let match = pactlOut.match(/(\d+)%/);
        if (match && match[1]) {
            let v = parseInt(match[1], 10);
            if (!isNaN(v) && v >= 0) {
                _lastVolume = Math.min(v, 150);
            }
        }
    }
    
    // Fallback to amixer for ALSA
    if (_lastVolume === -1) {
        let amixerOut = sh("amixer get Master 2>/dev/null");
        if (amixerOut) {
            // Try to get percentage from amixer output (format: [xx%])
            let match = amixerOut.match(/\[(\d+)%\]/);
            if (match && match[1]) {
                let v = parseInt(match[1], 10);
                if (!isNaN(v) && v >= 0) {
                    _lastVolume = Math.min(v, 150);
                }
            }
        }
    }
    
    // Return last known volume or default 50
    if (_lastVolume === -1) _lastVolume = 50;
    return _lastVolume;
}

function getMuted() {
    // Check mute status from pactl
    let pactlOut = sh("pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null");
    if (pactlOut) {
        if (pactlOut.indexOf('Mute: yes') !== -1) {
            _lastMuted = true;
            return true;
        } else if (pactlOut.indexOf('Mute: no') !== -1) {
            _lastMuted = false;
            return false;
        }
    }
    
    // Fallback to amixer
    let amixerOut = sh("amixer get Master 2>/dev/null");
    if (amixerOut) {
        if (amixerOut.indexOf('[off]') !== -1 || amixerOut.indexOf('muted') !== -1) {
            _lastMuted = true;
            return true;
        } else {
            _lastMuted = false;
            return false;
        }
    }
    
    return _lastMuted;
}

function setVolume(pct) {
    // If volume is being set to 0, mute instead
    if (pct === 0) {
        run('pactl set-sink-mute @DEFAULT_SINK@ 1');
        _lastMuted = true;
    } else {
        // Unmute if it was muted
        if (_lastMuted) {
            run('pactl set-sink-mute @DEFAULT_SINK@ 0');
            _lastMuted = false;
        }
        _lastVolume = Math.min(Math.max(Math.round(pct), 1), 150);
        run('pactl set-sink-volume @DEFAULT_SINK@ ' + _lastVolume + '%');
    }
}

function updateVolumeIcon(iconActor) {
    if (!iconActor) return;
    let muted = getMuted();
    let iconName = 'audio-volume-muted-symbolic';
    
    if (!muted) {
        let vol = getVolume();
        if (vol === 0) {
            iconName = 'audio-volume-muted-symbolic';
        } else if (vol <= 33) {
            iconName = 'audio-volume-low-symbolic';
        } else if (vol <= 66) {
            iconName = 'audio-volume-medium-symbolic';
        } else {
            iconName = 'audio-volume-high-symbolic';
        }
    }
    
    iconActor.icon_name = iconName;
}

// ── wifi ─────────────────────────────────────────────────────
function getWifiState() {
    let r = sh('nmcli -t radio wifi 2>/dev/null').split(/\s+/)[0].toLowerCase();
    if (r === 'enabled')  return true;
    if (r === 'disabled') return false;
    let r2 = sh('nmcli radio wifi 2>/dev/null').split(/\s+/)[0].toLowerCase();
    if (r2 === 'enabled')  return true;
    if (r2 === 'disabled') return false;
    let ip = sh("ip link show 2>/dev/null | grep -E 'wl[a-z0-9]+' | grep -c 'state UP'");
    if (ip === '1' || parseInt(ip) > 0) return true;
    let rk = sh('rfkill list wifi 2>/dev/null');
    if (rk && rk.indexOf('Soft blocked: no') !== -1) return true;
    if (rk && rk.indexOf('Soft blocked: yes') !== -1) return false;
    return false;
}

// ── bluetooth ────────────────────────────────────────────────
function getBtState() {
    let out = sh('rfkill list bluetooth 2>/dev/null');
    if (!out) {
        let bc = sh('bluetoothctl show 2>/dev/null | grep -i "powered"');
        return bc.indexOf('yes') !== -1;
    }
    return out.indexOf('Soft blocked: yes') === -1 && out.indexOf('Hard blocked: yes') === -1;
}

// ── night light ──────────────────────────────────────────────
const NL_SCHEMAS = [
    'org.cinnamon.settings-daemon.plugins.color',
    'org.gnome.settings-daemon.plugins.color'
];

function _nlRead() {
    for (let s of NL_SCHEMAS) {
        let raw = sh('gsettings get ' + s + ' night-light-enabled 2>&1');
        if (!raw) continue;
        if (raw.indexOf('No such schema') !== -1) continue;
        if (raw.indexOf('No such key')    !== -1) continue;
        if (raw.indexOf('WARNING')        !== -1 && raw.indexOf('true') === -1 && raw.indexOf('false') === -1) continue;
        let v = raw.replace(/[^a-z]/g, '');
        if (v === 'true')  return { schema: s, enabled: true  };
        if (v === 'false') return { schema: s, enabled: false };
    }
    return null;
}

function getNightLightState() {
    let r = _nlRead();
    return r !== null && r.enabled === true;
}

function nightLightToggle(currentState) {
    let newState = !currentState;
    for (let s of NL_SCHEMAS) {
        let test = sh('gsettings get ' + s + ' night-light-enabled 2>&1');
        if (test.indexOf('No such') === -1 && test.indexOf('WARNING') === -1) {
            run('gsettings set ' + s + ' night-light-enabled ' + String(newState));
        }
    }
    let disp = sh("xrandr 2>/dev/null | awk '/ connected/{print $1; exit}'");
    if (disp) {
        let gamma = newState ? '1:0.85:0.65' : '1:1:1';
        run('xrandr --output ' + disp + ' --gamma ' + gamma);
    }
    return newState;
}

function openClocks() {
    for (let a of ['gnome-clocks', 'mate-clocks'])
        if (sh('which ' + a + ' 2>/dev/null')) { run(a); return; }
    run('cinnamon-settings calendar');
}
function openCalendar() {
    run('cinnamon-settings calendar');
}
function openScreenshot() {
    if (sh('which gnome-screenshot 2>/dev/null'))    { run('gnome-screenshot -i'); return; }
    if (sh('which xfce4-screenshooter 2>/dev/null')) { run('xfce4-screenshooter'); return; }
    if (sh('which scrot 2>/dev/null'))               { run('scrot -s ~/Pictures/screenshot-%Y%m%d-%H%M%S.png'); }
}

// ── MPRIS async ──────────────────────────────────────────────
function findMprisPlayers(cb) {
    try {
        Gio.DBus.session.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'ListNames',
            null, new GLib.VariantType('(as)'),
            Gio.DBusCallFlags.NONE, 2000, null, (conn, res) => {
                try {
                    const raw   = conn.call_finish(res).deepUnpack();
                    const names = Array.isArray(raw[0]) ? raw[0] : raw;
                    cb(names.filter(n => String(n).startsWith('org.mpris.MediaPlayer2.')).map(String));
                } catch(e) { cb([]); }
            });
    } catch(e) { cb([]); }
}

function getMprisInfo(busName, cb) {
    try {
        Gio.DBus.session.call(
            busName, '/org/mpris/MediaPlayer2',
            'org.freedesktop.DBus.Properties', 'GetAll',
            new GLib.Variant('(s)', ['org.mpris.MediaPlayer2.Player']),
            null, Gio.DBusCallFlags.NONE, 3000, null, (conn, res) => {
                try {
                    const raw   = unpackV(conn.call_finish(res));
                    let props   = raw;
                    while (Array.isArray(props) && props.length === 1) props = props[0];

                    const meta   = props['Metadata'] || {};
                    const status = String(props['PlaybackStatus'] || 'Stopped');

                    let title   = String(unpackV(meta['xesam:title']) || '');
                    let artists = unpackV(meta['xesam:artist']) || [];
                    if (!Array.isArray(artists)) artists = artists ? [String(artists)] : [];
                    let artist  = artists.map(String).join(', ');

                    if (!title && meta['xesam:url']) {
                        title = String(meta['xesam:url']).replace(/^https?:\/\//, '').split('/')[0];
                    }

                    let appName = busName.replace('org.mpris.MediaPlayer2.', '').split('.')[0];
                    appName = appName.charAt(0).toUpperCase() + appName.slice(1);

                    let artUrl = String(unpackV(meta['mpris:artUrl']) || '');

                    let position = 0, length = 0;
                    try {
                        let rawPos = unpackV(props['Position']);
                        if (rawPos !== null && rawPos !== undefined) position = Number(rawPos);
                        let rawLen = unpackV(meta['mpris:length']);
                        if (rawLen !== null && rawLen !== undefined) length = Number(rawLen);
                    } catch(e2) {}

                    cb({ title, artist, status, appName, busName, artUrl, position, length });
                } catch(e) { cb(null); }
            });
    } catch(e) { cb(null); }
}

// ── load artwork ─────────────────────────────────────────────
function loadArtwork(artUrl, cb) {
    if (!artUrl) { cb(null); return; }
    try {
        if (artUrl.startsWith('file://')) {
            let path = artUrl.replace('file://', '');
            try { path = decodeURIComponent(path); } catch(e) {}
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                try {
                    let pix = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 480, 480, true);
                    cb(pix);
                    return;
                } catch(e) {}
            }
        } else if (artUrl.startsWith('http')) {
            let hash = artUrl.replace(/[^a-z0-9]/gi, '').substring(0, 32);
            let tmpPath = '/tmp/gs-art-' + hash + '.jpg';
            if (GLib.file_test(tmpPath, GLib.FileTest.EXISTS)) {
                try {
                    let pix = GdkPixbuf.Pixbuf.new_from_file_at_scale(tmpPath, 120, 120, true);
                    cb(pix);
                    return;
                } catch(e) {}
            }
            GLib.spawn_command_line_async('wget -q -O ' + tmpPath + ' "' + artUrl + '"');
            Mainloop.timeout_add(800, () => {
                try {
                    let pix = GdkPixbuf.Pixbuf.new_from_file_at_scale(tmpPath, 480, 480, true);
                    cb(pix);
                } catch(e) { cb(null); }
                return false;
            });
            return;
        }
    } catch(e) {}
    cb(null);
}

// ── extract dominant color ───────────────────────────────────
function dominantColor(pix) {
    if (!pix) return [0.2, 0.5, 1.0];
    try {
        let w = pix.get_width(), h = pix.get_height();
        let pixels = pix.get_pixels();
        let nc = pix.get_n_channels(), rs = pix.get_rowstride();
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        let step = 8;
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                let i = y * rs + x * nc;
                let r = pixels[i] / 255, g = pixels[i+1] / 255, b = pixels[i+2] / 255;
                let max = Math.max(r,g,b), min = Math.min(r,g,b);
                if (max - min > 0.2 && max > 0.3) {
                    rSum += r; gSum += g; bSum += b; count++;
                }
            }
        }
        if (count === 0) return [0.2, 0.5, 1.0];
        return [rSum/count, gSum/count, bSum/count];
    } catch(e) { return [0.2, 0.5, 1.0]; }
}

function sendMprisCmd(busName, method) {
    try {
        Gio.DBus.session.call(
            busName, '/org/mpris/MediaPlayer2',
            'org.mpris.MediaPlayer2.Player', method,
            null, null, Gio.DBusCallFlags.NONE, 1000, null, null);
    } catch(e) {}
}

// ════════════════════════════════════════════════════════════
//  APPLET
// ════════════════════════════════════════════════════════════
const GlobalSettingsApplet = class GlobalSettingsApplet extends TextIconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(AllowedLayout.BOTH);

        try {
            let css = metadata.path + '/stylesheet.css';
            if (GLib.file_test(css, GLib.FileTest.EXISTS)) {
                St.ThemeContext.get_for_stage(global.stage).get_theme().load_stylesheet(css);
                this._css = css;
            }
        } catch(e) {}

        this._settings = new AppletSettings(this, metadata.uuid, instanceId);
        this._settings.bind('color-theme',      'colorTheme',    this._applyTheme.bind(this));
        this._settings.bind('custom-dark-gtk',  'darkGtk',       null);
        this._settings.bind('custom-light-gtk', 'lightGtk',      null);
        this._settings.bind('use-custom-icon',  'useCustomIcon',  this._updatePanelIcon.bind(this));
        this._settings.bind('custom-icon',      'customIcon',     this._updatePanelIcon.bind(this));
        this._settings.bind('panel-label',      'panelLabel',     this._updatePanelIcon.bind(this));
        this._settings.bind('show-tooltips',    'showTooltips',   () => { _showTooltips = this.showTooltips !== false; });
        _showTooltips = this.showTooltips !== false;

        this.colorTheme = this.colorTheme || 'desktop';
        this.darkGtk    = this.darkGtk    || 'Mint-Y-Dark-Aqua';
        this.lightGtk   = this.lightGtk   || 'Mint-Y-Aqua';

        this._updatePanelIcon();
        this.set_applet_tooltip('Control Center');

        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('gs-menu');

        this.wifiOn       = false;
        this.btOn         = false;
        this.focusOn      = false;
        this.darkMode     = false;
        this.nightLightOn = false;
        this.mediaTimer   = null;
        this.activePlayer = null;
        this.signals      = new SignalManager(null);

        this._buildUI();
        this._connectSignals();
    }

    _updatePanelIcon() {
        try {
            if (this.useCustomIcon && this.customIcon) {
                if (GLib.path_is_absolute(this.customIcon) &&
                        GLib.file_test(this.customIcon, GLib.FileTest.EXISTS))
                    this.set_applet_icon_path(this.customIcon);
                else
                    this.set_applet_icon_symbolic_name(this.customIcon);
            } else {
                this.set_applet_icon_symbolic_name('preferences-system-symbolic');
            }
        } catch(e) { this.set_applet_icon_symbolic_name('preferences-system-symbolic'); }
        let lbl = (this.panelLabel || '').substring(0, 30);
        this.set_applet_label(lbl);
        this.hide_applet_label(!lbl);
    }

    _applyTheme() {
        if (!this.shell) return;
        for (let c of ['gs-theme-win11-light', 'gs-theme-win11-dark', 'gs-theme-desktop'])
            this.shell.remove_style_class_name(c);
        if      (this.colorTheme === 'win11-light') this.shell.add_style_class_name('gs-theme-win11-light');
        else if (this.colorTheme === 'win11-dark')  this.shell.add_style_class_name('gs-theme-win11-dark');
        else                                        this.shell.add_style_class_name('gs-theme-desktop');
    }

    _blankScreen() {
        this.menu.close();
        if (sh('which xset 2>/dev/null'))
            run('xset dpms force off');
        else if (sh('which xdg-screensaver 2>/dev/null'))
            run('xdg-screensaver activate');
        else
            run('cinnamon-screensaver-command --activate');
    }

    _buildUI() {
        let section = new PopupMenuSection();

        this.shell = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-shell',
            style: 'width:460px; padding:12px; spacing:8px; background-color:transparent;'
        });
        this._applyTheme();

        let topRow = new St.BoxLayout({ style: 'spacing:8px;' });

        let leftCol = new St.BoxLayout({
            vertical: true,
            style: 'spacing:6px;'
        });

        this.wifiTile = mkTile('network-wireless-symbolic', 'Wi-Fi', 'Off', 'Toggle Wi-Fi');
        leftCol.add(this.wifiTile, { x_fill: true });

        this.btTile = mkTile('bluetooth-symbolic', 'Bluetooth', 'Off', 'Toggle Bluetooth');
        leftCol.add(this.btTile, { x_fill: true });

        this.hotspotTile = mkTile('network-workgroup-symbolic',      'Hotspot',    'Off',   'Network Settings');
        this.focusTile   = mkTile('notifications-disabled-symbolic', 'Focus',      'Off',   'Do Not Disturb');
        this.mirrorTile  = mkTile('video-display-symbolic',          'Display',    '',      'Display Settings');
        this.darkTile    = mkTile('weather-clear-night-symbolic',    'Dark Mode',  'Light', 'Toggle Dark/Light');
        this.nightTile   = mkTile('night-light-symbolic',            'Night Light','Off',   'Toggle Night Light');
        this.blankTile   = mkTile('display-brightness-symbolic',     'Blank',      '',      'Blank Screen');

        for (let t of [this.hotspotTile, this.focusTile, this.mirrorTile,
                       this.darkTile, this.nightTile, this.blankTile])
            t.add_style_class_name('gs-tile-sm');

        let sg1 = new St.BoxLayout({ style: 'spacing:6px;' });
        sg1.add(this.hotspotTile, { expand: true });
        sg1.add(this.focusTile,   { expand: true });
        leftCol.add(sg1, { x_fill: true });

        let sg2 = new St.BoxLayout({ style: 'spacing:6px;' });
        sg2.add(this.mirrorTile,  { expand: true });
        sg2.add(this.darkTile,    { expand: true });
        leftCol.add(sg2, { x_fill: true });

        let sg3 = new St.BoxLayout({ style: 'spacing:6px;' });
        sg3.add(this.nightTile,   { expand: true });
        sg3.add(this.blankTile,   { expand: true });
        leftCol.add(sg3, { x_fill: true });

        this._npCard = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-np-card',
            style: 'padding:0; spacing:0; border-radius:12px;'
        });

        this._npPixbuf     = null;
        this._npAccent     = [0.2, 0.5, 1.0];
        this._npArtUrl     = '';
        this._npPos        = 0;
        this._npLen        = 0;
        this._npAppName    = '';
        this._npTitleText  = 'No Media';
        this._npArtistText = '';

        this._npArtCanvas = new St.DrawingArea({ reactive: false });
        this._npArtCanvas.set_style('min-height:200px; border-radius:12px;');

        this._npArtCanvas.connect('repaint', (area) => {
            const cr    = area.get_context();
            const alloc = area.get_allocation_box();
            const W     = alloc.x2 - alloc.x1;
            const H     = alloc.y2 - alloc.y1;
            if (W < 2 || H < 2) { cr.$dispose(); return; }
            const R = 12;

            cr.newPath();
            cr.moveTo(R, 0);
            cr.lineTo(W-R, 0); cr.arc(W-R, R,   R,  -Math.PI/2, 0);
            cr.lineTo(W, H-R); cr.arc(W-R, H-R, R,   0,          Math.PI/2);
            cr.lineTo(R, H);   cr.arc(R,   H-R, R,   Math.PI/2,  Math.PI);
            cr.lineTo(0, R);   cr.arc(R,   R,   R,   Math.PI,    3*Math.PI/2);
            cr.closePath(); cr.clip();

            if (this._npPixbuf) {
                let pw = this._npPixbuf.get_width();
                let ph = this._npPixbuf.get_height();
                let scale = Math.max(W / pw, H / ph);
                let ox = (W - pw * scale) / 2;
                let oy = (H - ph * scale) / 2;
                cr.save();
                cr.translate(ox, oy);
                cr.scale(scale, scale);
                imports.gi.Gdk.cairo_set_source_pixbuf(cr, this._npPixbuf, 0, 0);
                cr.paint();
                cr.restore();
            } else {
                let [ar, ag, ab] = this._npAccent;
                let g = new Cairo.LinearGradient(0, 0, 0, H);
                g.addColorStopRGBA(0, Math.min(1, ar*0.7+0.1),
                                      Math.min(1, ag*0.6+0.05),
                                      Math.min(1, ab*0.8+0.08), 1.0);
                g.addColorStopRGBA(1, 0.08, 0.08, 0.15, 1.0);
                cr.setSource(g); cr.rectangle(0, 0, W, H); cr.fill();
                cr.setFontSize(72);
                cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
                cr.setSourceRGBA(1, 1, 1, 0.12);
                cr.moveTo(W / 2 - 26, H * 0.56);
                cr.showText('♫');
            }

            let scrim = new Cairo.LinearGradient(0, H * 0.25, 0, H);
            scrim.addColorStopRGBA(0, 0, 0, 0, 0);
            scrim.addColorStopRGBA(0.55, 0, 0, 0, 0.55);
            scrim.addColorStopRGBA(1,    0, 0, 0, 0.90);
            cr.setSource(scrim); cr.rectangle(0, 0, W, H); cr.fill();

            cr.setFontSize(9);
            cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(1, 1, 1, 0.52);
            cr.moveTo(14, H - 60);
            cr.showText((this._npAppName || 'NOT PLAYING').toUpperCase());

            let title = this._npTitleText || 'No Media';
            if (title.length > 24) title = title.substring(0, 22) + '…';
            cr.setFontSize(15);
            cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setSourceRGBA(1, 1, 1, 0.97);
            cr.moveTo(14, H - 38);
            cr.showText(title);

            let artist = this._npArtistText || '';
            if (artist.length > 28) artist = artist.substring(0, 26) + '…';
            cr.setFontSize(10);
            cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(1, 1, 1, 0.62);
            cr.moveTo(14, H - 20);
            cr.showText(artist);

            cr.$dispose();
        });

        this._npCard.add(this._npArtCanvas, { expand: true });

        this._npProgress  = new St.DrawingArea({ style: 'height:20px;', reactive: true });
        this._npTimeLeft  = new St.Label({ text: '0:00', style_class: 'gs-np-time' });
        this._npTimeRight = new St.Label({ text: '0:00', style_class: 'gs-np-time' });

        this._npProgress.connect('repaint', (area) => {
            const cr    = area.get_context();
            const alloc = area.get_allocation_box();
            const W     = alloc.x2 - alloc.x1;
            const H     = alloc.y2 - alloc.y1;
            if (W < 2 || H < 2) { cr.$dispose(); return; }
            const TH   = 3;
            const ty   = (H - TH) / 2;
            const frac = this._npLen > 0 ? Math.min(1, this._npPos / this._npLen) : 0;
            let [ar, ag, ab] = this._npAccent;
            cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.rectangle(0, ty, W, TH);
            cr.setSourceRGBA(0.2, 0.2, 0.2, 0.22); cr.fill();
            if (frac > 0) {
                cr.rectangle(0, ty, W * frac, TH);
                cr.setSourceRGBA(ar, ag, ab, 0.92); cr.fill();
            }
            let kx = Math.max(5, Math.min(W - 5, W * frac));
            cr.arc(kx, H / 2, 5, 0, 2 * Math.PI);
            cr.setSourceRGBA(1, 1, 1, 0.95); cr.fill();
            cr.$dispose();
        });

        this._npProgress.connect('button-press-event', (a, ev) => {
            if (!this.activePlayer || this._npLen <= 0) return Clutter.EVENT_STOP;
            let [bx] = ev.get_coords();
            let [ax] = a.get_transformed_position();
            let frac = Math.max(0, Math.min(1, (bx - ax) / a.get_width()));
            this._npPos = Math.round(frac * this._npLen);
            this._npProgress.queue_repaint();
            this._updateTimeLabels();
            try {
                Gio.DBus.session.call(
                    this.activePlayer, '/org/mpris/MediaPlayer2',
                    'org.freedesktop.DBus.Properties', 'Set',
                    new GLib.Variant('(ssv)', ['org.mpris.MediaPlayer2.Player', 'Position',
                        new GLib.Variant('x', this._npPos)]),
                    null, Gio.DBusCallFlags.NONE, 1000, null, null);
            } catch(e) {}
            return Clutter.EVENT_STOP;
        });

        let progressRow = new St.BoxLayout({ style: 'padding:4px 10px 2px 10px; spacing:6px;' });
        progressRow.add(this._npTimeLeft,  { expand: false });
        progressRow.add(this._npProgress,  { expand: true });
        progressRow.add(this._npTimeRight, { expand: false });
        this._npCard.add(progressRow);

        // Media control buttons with hover effects and semi-transparent play button
        let npCtrl = new St.BoxLayout({ style: 'padding:4px 10px 12px 10px; spacing:0;' });
        
        // Previous button - clean with hover effect
        this.prevBtn = new St.Button({ 
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px; transition: all 0.2s ease;'
        });
        this.prevBtn.set_child(sym('media-skip-backward-symbolic', 16));
        this.prevBtn.connect('enter-event', () => {
            this.prevBtn.set_style('background: rgba(255,255,255,0.15); border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        this.prevBtn.connect('leave-event', () => {
            this.prevBtn.set_style('background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        
        // Play button - semi-transparent white background (0.8 opacity = 80% transparent / 20% opaque)
        this.playBtn = new St.Button({ 
            reactive: true,
            style: 'background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px; transition: all 0.2s ease;'
        });
        let playIcon = sym('media-playback-start-symbolic', 28);
        playIcon.set_style('color: white;');
        this.playBtn.set_child(playIcon);
        this.playBtn.connect('enter-event', () => {
            this.playBtn.set_style('background-color: rgba(255,255,255,0.35); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
        });
        this.playBtn.connect('leave-event', () => {
            this.playBtn.set_style('background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
        });
        
        // Next button - clean with hover effect
        this.nextBtn = new St.Button({ 
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px; transition: all 0.2s ease;'
        });
        this.nextBtn.set_child(sym('media-skip-forward-symbolic', 16));
        this.nextBtn.connect('enter-event', () => {
            this.nextBtn.set_style('background: rgba(255,255,255,0.15); border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        this.nextBtn.connect('leave-event', () => {
            this.nextBtn.set_style('background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        
        tip(this.prevBtn, 'Previous');
        tip(this.playBtn, 'Play / Pause');
        tip(this.nextBtn, 'Next');
        
        npCtrl.add(this.prevBtn, { expand: true });
        npCtrl.add(this.playBtn, { expand: false });
        npCtrl.add(this.nextBtn, { expand: true });
        this._npCard.add(npCtrl);

        topRow.add(leftCol,      { expand: false });
        topRow.add(this._npCard, { expand: true });
        this.shell.add(topRow);

        this.shell.add(new St.Widget({ style_class: 'gs-sep' }));

        // ─── Brightness slider ──────────────────────────────────
        let brightCard = new St.BoxLayout({
            vertical: true, style_class: 'gs-slider-card',
            style: 'spacing:4px; padding:10px 14px;'
        });
        brightCard.add(new St.Label({ text: 'Brightness', style_class: 'gs-slider-label' }));
        let brightRow = new St.BoxLayout({ style: 'spacing:8px;' });
        // Themeable icon - removed hardcoded color, CSS will handle it
        let biL = sym('display-brightness-symbolic', 16);
        biL.add_style_class_name('gs-slider-icon');
        this._brightSlider = mkCairoSlider(1.0, null, v => setBrightness(v));
        brightRow.add(biL);
        brightRow.add(this._brightSlider, { expand: true });
        brightCard.add(brightRow);
        this.shell.add(brightCard);

        // ─── Volume slider ──────────────────────────────────────
        let volCard = new St.BoxLayout({
            vertical: true, style_class: 'gs-slider-card',
            style: 'spacing:4px; padding:10px 14px;'
        });
        volCard.add(new St.Label({ text: 'Volume', style_class: 'gs-slider-label' }));
        let volRow = new St.BoxLayout({ style: 'spacing:8px;' });
        // Themeable icon - removed hardcoded color, CSS will handle it
        this.volIconL = sym('audio-volume-muted-symbolic', 16);
        this.volIconL.add_style_class_name('gs-slider-icon');
        this._volSlider = mkCairoSlider(150, 100, v => setVolume(v));
        volRow.add(this.volIconL);
        volRow.add(this._volSlider, { expand: true });
        volCard.add(volRow);
        this.shell.add(volCard);

        this.shell.add(new St.Widget({ style_class: 'gs-sep' }));

        // System buttons row - Terminal, Clocks, Screenshot, Calendar
        let sysRow = new St.BoxLayout({ style: 'spacing:8px;' });
        for (let [ic, label, cb] of [
            ['utilities-terminal-symbolic',     'Terminal',   () => { run('gnome-terminal'); this.menu.close(); }],
            ['alarm-clock-symbolic',            'Clocks',     () => { openClocks(); this.menu.close(); }],
            ['camera-photo-symbolic',           'Screenshot', () => { openScreenshot(); this.menu.close(); }],
            ['office-calendar-symbolic',        'Calendar',   () => { openCalendar(); this.menu.close(); }],
        ]) {
            let b = new St.Button({ style_class: 'gs-sys-btn', reactive: true });
            b.set_child(sym(ic, 18)); b.connect('clicked', cb); tip(b, label);
            sysRow.add(b, { expand: true });
        }
        this.shell.add(sysRow);

        let settingsRow = new St.BoxLayout({ style: 'padding-top:2px;' });
        let settingsBtn = new St.Button({
            label: '⚙  System Settings',
            style_class: 'gs-edit-btn',
            reactive: true
        });
        settingsBtn.connect('clicked', () => { run('cinnamon-settings'); this.menu.close(); });
        tip(settingsBtn, 'Open System Settings');
        settingsRow.add(settingsBtn, { expand: false });
        this.shell.add(settingsRow);

        section.actor.add(this.shell);
        this.menu.addMenuItem(section);
    }

    _connectSignals() {
        this.wifiTile.connect('clicked',     () => this._toggleWifi());
        this.btTile.connect('clicked',       () => this._toggleBluetooth());
        this.hotspotTile.connect('clicked',  () => { run('nm-connection-editor'); this.menu.close(); });
        this.focusTile.connect('clicked',    () => this._toggleFocus());
        this.mirrorTile.connect('clicked',   () => { run('cinnamon-settings display'); this.menu.close(); });
        this.darkTile.connect('clicked',     () => this._toggleDarkMode());
        this.nightTile.connect('clicked',    () => this._toggleNightLight());
        this.blankTile.connect('clicked',    () => this._blankScreen());

        this.prevBtn.connect('clicked', () => this._mediaCommand('Previous'));
        this.playBtn.connect('clicked', () => this._mediaCommand('PlayPause'));
        this.nextBtn.connect('clicked', () => this._mediaCommand('Next'));

        this.signals.connect(this.menu, 'open-state-changed', (_m, open) => {
            if (open) { this._refreshAll(); this._startMediaPolling(); }
            else      { this._stopMediaPolling(); }
        });
    }

    _refreshAll() {
        this.wifiOn = getWifiState();
        setTile(this.wifiTile, this.wifiOn, this.wifiOn ? 'On' : 'Off');
        if (this.wifiOn) {
            let ssid = sh("nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2 | head -1");
            if (ssid) this.wifiTile._sub.set_text(ssid.substring(0, 16));
        }

        this.btOn = getBtState();
        setTile(this.btTile, this.btOn, this.btOn ? 'On' : 'Off');

        let gtk = sh("gsettings get org.cinnamon.desktop.interface gtk-theme 2>/dev/null").replace(/'/g, '').toLowerCase();
        this.darkMode = gtk.indexOf('dark') !== -1;
        setTile(this.darkTile, this.darkMode, this.darkMode ? 'Dark' : 'Light');

        this.focusOn = sh('gsettings get org.cinnamon.desktop.notifications show-banners 2>/dev/null').trim() === 'false';
        setTile(this.focusTile, this.focusOn, this.focusOn ? 'On' : 'Off');

        if (!this._nightLightInitialized) {
            this.nightLightOn = getNightLightState();
            this._nightLightInitialized = true;
        }
        setTile(this.nightTile, this.nightLightOn, this.nightLightOn ? 'On' : 'Off');

        Mainloop.timeout_add(50, () => {
            if (!this._slidersInitialized) {
                _lastBrightness = getBrightness();
                this._slidersInitialized = true;
            }
            this._brightSlider.setValue(_lastBrightness);
            let realVol = getVolume();
            _lastVolume = realVol;
            this._volSlider.setValue(_lastVolume);
            
            // Update volume icon based on mute status - themeable via CSS
            if (this.volIconL) {
                let muted = getMuted();
                if (muted) {
                    this.volIconL.icon_name = 'audio-volume-muted-symbolic';
                } else {
                    if (realVol === 0) {
                        this.volIconL.icon_name = 'audio-volume-muted-symbolic';
                    } else if (realVol <= 33) {
                        this.volIconL.icon_name = 'audio-volume-low-symbolic';
                    } else if (realVol <= 66) {
                        this.volIconL.icon_name = 'audio-volume-medium-symbolic';
                    } else {
                        this.volIconL.icon_name = 'audio-volume-high-symbolic';
                    }
                }
                // Icon color is controlled by CSS via gs-slider-icon class
            }
            return false;
        });

        this._updateMediaInfo();
    }

    _updateMediaInfo() {
        findMprisPlayers(players => {
            if (!players.length) {
                this.activePlayer = null;
                this._npAppName    = 'NOT PLAYING';
                this._npTitleText  = 'No Media';
                this._npArtistText = '';
                // Reset play button to default semi-transparent white with white icon
                let playIcon = sym('media-playback-start-symbolic', 28);
                playIcon.set_style('color: white;');
                this.playBtn.set_child(playIcon);
                this.playBtn.set_style('background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
                this._npArtUrl   = '';
                this._npPixbuf   = null;
                this._npAccent   = [0.2, 0.5, 1.0];
                this._npPos = 0; this._npLen = 0;
                if (this._npArtCanvas) this._npArtCanvas.queue_repaint();
                if (this._npProgress)  this._npProgress.queue_repaint();
                this._updateTimeLabels();
                return;
            }
            let idx = 0;
            const tryNext = () => {
                if (idx >= players.length) {
                    this.activePlayer = players[0];
                    getMprisInfo(players[0], i => { if (i) this._applyMediaInfo(i, false); });
                    return;
                }
                let p = players[idx++];
                getMprisInfo(p, info => {
                    if (info && info.status === 'Playing') {
                        this.activePlayer = p;
                        this._applyMediaInfo(info, true);
                    } else {
                        tryNext();
                    }
                });
            };
            tryNext();
        });
    }

    _applyMediaInfo(info, playing) {
        // Update play button icon and keep white color
        let playIcon = sym(playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic', 28);
        playIcon.set_style('color: white;');
        this.playBtn.set_child(playIcon);
        
        this._npAppName    = info.appName || 'MEDIA';
        this._npTitleText  = info.title   || 'No Title';
        this._npArtistText = info.artist  || '';

        this._npPos = info.position || 0;
        this._npLen = info.length   || 0;
        this._npProgress.queue_repaint();
        this._updateTimeLabels();

        let artUrl = info.artUrl || '';
        if (artUrl && artUrl !== this._npArtUrl) {
            this._npArtUrl = artUrl;
            loadArtwork(artUrl, (pix) => {
                this._npPixbuf = pix;
                if (pix) {
                    this._npAccent = dominantColor(pix);
                }
                this._npArtCanvas.queue_repaint();
                this._npProgress.queue_repaint();
            });
        } else if (!artUrl) {
            this._npArtUrl   = '';
            this._npPixbuf   = null;
            this._npAccent   = [0.2, 0.5, 1.0];
            this._npArtCanvas.queue_repaint();
            this._npProgress.queue_repaint();
        }

        let [r,g,b] = this._npAccent;
        let pr = Math.round(r*255), pg = Math.round(g*255), pb = Math.round(b*255);
        
        // Keep play button semi-transparent white, only adjust accent colors for the card
        this._npCard.set_style(
            'border-radius: 12px; ' +
            'background-color: rgba(' + Math.round(r*255) + ',' + Math.round(g*255) + ',' + Math.round(b*255) + ', 0.9) !important; ' +
            'border: 1px solid rgba(' + Math.round(r*255) + ',' + Math.round(g*255) + ',' + Math.round(b*255) + ', 0.1);');
    }

    _updateTimeLabels() {
        const fmt = (us) => {
            let s = Math.floor(us / 1000000);
            let m = Math.floor(s / 60); s = s % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        };
        if (this._npTimeLeft)  this._npTimeLeft.set_text(fmt(this._npPos));
        if (this._npTimeRight) this._npTimeRight.set_text(fmt(this._npLen));
    }

    _mediaCommand(command) {
        if (!this.activePlayer) {
            findMprisPlayers(players => {
                if (players.length) {
                    this.activePlayer = players[0];
                    sendMprisCmd(this.activePlayer, command);
                    Mainloop.timeout_add(400, () => { if (this.menu.isOpen) this._updateMediaInfo(); return false; });
                }
            });
            return;
        }
        sendMprisCmd(this.activePlayer, command);
        Mainloop.timeout_add(400, () => { if (this.menu.isOpen) this._updateMediaInfo(); return false; });
    }

    _startMediaPolling() {
        if (this.mediaTimer) return;
        this.mediaTimer = Mainloop.timeout_add_seconds(2, () => {
            if (this.menu.isOpen) { this._updateMediaInfo(); return true; }
            return false;
        });
        if (!this._posTimer) {
            this._posTimer = Mainloop.timeout_add_seconds(1, () => {
                if (!this.menu.isOpen) return true;
                if (this._npLen > 0) {
                    this._npPos += 1000000;
                    if (this._npPos > this._npLen) this._npPos = this._npLen;
                    this._npProgress.queue_repaint();
                    this._updateTimeLabels();
                }
                return true;
            });
        }
    }
    
    _stopMediaPolling() {
        if (this.mediaTimer) { Mainloop.source_remove(this.mediaTimer); this.mediaTimer = null; }
        if (this._posTimer)  { Mainloop.source_remove(this._posTimer);  this._posTimer  = null; }
    }

    _toggleWifi() {
        this.wifiOn = !this.wifiOn;
        run('nmcli radio wifi ' + (this.wifiOn ? 'on' : 'off'));
        setTile(this.wifiTile, this.wifiOn, this.wifiOn ? 'On' : 'Off');
        if (this.wifiOn) {
            Mainloop.timeout_add(1500, () => {
                if (!this.menu.isOpen) return false;
                let ssid = sh("nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2 | head -1");
                if (ssid) this.wifiTile._sub.set_text(ssid.substring(0, 16));
                return false;
            });
        }
    }
    
    _toggleBluetooth() {
        this.btOn = !this.btOn;
        run(this.btOn ? 'rfkill unblock bluetooth' : 'rfkill block bluetooth');
        setTile(this.btTile, this.btOn, this.btOn ? 'On' : 'Off');
    }
    
    _toggleFocus() {
        this.focusOn = !this.focusOn;
        run('gsettings set org.cinnamon.desktop.notifications show-banners ' + (this.focusOn ? 'false' : 'true'));
        setTile(this.focusTile, this.focusOn, this.focusOn ? 'On' : 'Off');
    }
    
    _toggleDarkMode() {
        this.darkMode = !this.darkMode;
        let theme = this.darkMode ? (this.darkGtk || 'Mint-Y-Dark-Aqua') : (this.lightGtk || 'Mint-Y-Aqua');
        run("gsettings set org.cinnamon.desktop.interface gtk-theme '" + theme + "'");
        run("gsettings set org.cinnamon.theme name '" + theme + "'");
        setTile(this.darkTile, this.darkMode, this.darkMode ? 'Dark' : 'Light');
    }
    
    _toggleNightLight() {
        this.nightLightOn = nightLightToggle(this.nightLightOn);
        setTile(this.nightTile, this.nightLightOn, this.nightLightOn ? 'On' : 'Off');
    }

    on_applet_clicked() {
        if (this.menu.isOpen) this.menu.close(); else this.menu.open();
    }
    
    on_applet_removed_from_panel() {
        this._stopMediaPolling();
        if (this.signals)   this.signals.disconnectAllSignals();
        if (this._settings) this._settings.finalize();
        if (this.menu)      this.menu.destroy();
        try { if (this._css) St.ThemeContext.get_for_stage(global.stage).get_theme().unload_stylesheet(this._css); } catch(e) {}
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new GlobalSettingsApplet(metadata, orientation, panelHeight, instanceId);
}
