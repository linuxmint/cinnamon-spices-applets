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

// ── Dark mode via Gio.Settings (in-process, no subprocess spawn) ──
function gioSettingsOrNull(schema) {
    try {
        let source = Gio.SettingsSchemaSource.get_default();
        if (!source || !source.lookup(schema, true)) return null;
        return new Gio.Settings({ schema_id: schema });
    } catch (e) { return null; }
}
function getColorSchemeDark() {
    for (let schema of ['org.gnome.desktop.interface', 'org.x.apps.portal']) {
        let s = gioSettingsOrNull(schema);
        if (!s) continue;
        try {
            let v = s.get_string('color-scheme');
            if (v) return v.toLowerCase().indexOf('dark') !== -1;
        } catch (e) {}
    }
    return null;
}
function setColorSchemeDark(dark) {
    for (let schema of ['org.x.apps.portal', 'org.gnome.desktop.interface']) {
        let s = gioSettingsOrNull(schema);
        if (!s) continue;
        let valid = s.settings_schema.get_key('color-scheme').get_range();
        let members = [];
        try { members = valid.deep_unpack()[1].deep_unpack(); } catch (e) {}
        let value;
        if (dark) {
            value = members.indexOf('prefer-dark') !== -1 ? 'prefer-dark' : members[0];
        } else if (members.indexOf('default') !== -1) {
            value = 'default';
        } else if (members.indexOf('prefer-light') !== -1) {
            value = 'prefer-light';
        } else {
            value = members[0];
        }
        try { s.set_string('color-scheme', value); } catch (e) {}
    }
}


let _showTooltips = true;
let _accentRGB = [51, 128, 255];
let _chameleonic = false;

// macOS Tahoe system accent palette (rgb01)
const TAHOE_ACCENTS = [
    [0.00, 0.48, 1.00],
    [0.35, 0.34, 0.84],
    [0.69, 0.32, 0.87],
    [0.96, 0.26, 0.51],
    [0.96, 0.23, 0.19],
    [1.00, 0.58, 0.00],
    [1.00, 0.80, 0.00],
    [0.30, 0.85, 0.39],
    [0.20, 0.78, 0.74],
];

function lerpColor(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

function tileOnStyle(rgb) {
    let [r, g, b] = rgb;
    return 'background-color: rgba(' + r + ',' + g + ',' + b + ',0.90) !important; ' +
           'border-color: rgba(' + r + ',' + g + ',' + b + ',0.95) !important;';
}
function tileOnHoverStyle(rgb) {
    let [r, g, b] = rgb;
    let lr = Math.min(255, Math.round(r + (255 - r) * 0.18));
    let lg = Math.min(255, Math.round(g + (255 - g) * 0.18));
    let lb = Math.min(255, Math.round(b + (255 - b) * 0.18));
    return 'background-color: rgba(' + lr + ',' + lg + ',' + lb + ',0.90) !important; ' +
           'border-color: rgba(' + lr + ',' + lg + ',' + lb + ',0.95) !important;';
}
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
function mkTile(icon, label, sub, tooltip, circle) {
    let baseClass = circle ? 'gs-circle-tile' : 'gs-tile';
    let btn  = new St.Button({ style_class: baseClass, reactive: true });
    let box  = new St.BoxLayout({ vertical: true, style: 'spacing:2px;' });
    let ic   = sym(icon, 16); ic.add_style_class_name('gs-tile-icon');
    let lbl  = new St.Label({ text: label, style_class: 'gs-tile-label' });
    let sub_ = new St.Label({ text: sub || '', style_class: 'gs-tile-sub' });
    box.add(ic,   {expand:false, x_fill:false, x_align: St.Align.MIDDLE});
    box.add(lbl,  {expand:false, x_fill:false, x_align: St.Align.MIDDLE});
    box.add(sub_, {expand:false, x_fill:false, x_align: St.Align.MIDDLE});
    btn.set_child(box);
    btn._sub = sub_; btn._icon = ic; btn._label = lbl;
    btn._on = false; btn._hovered = false; btn._onClass = circle ? 'gs-circle-tile-on' : 'gs-tile-on';
    btn.connect('enter-event', () => {
        btn._hovered = true;
        if (btn._on) btn.set_style(tileOnHoverStyle(_accentRGB));
    });
    btn.connect('leave-event', () => {
        btn._hovered = false;
        if (btn._on) btn.set_style(tileOnStyle(_accentRGB));
    });
    if (tooltip) tip(btn, tooltip);
    return btn;
}
function setTile(btn, on, sub) {
    btn._on = on;
    let onClass = btn._onClass || 'gs-tile-on';
    if (on) {
        btn.add_style_class_name(onClass);
        btn.set_style(btn._hovered ? tileOnHoverStyle(_accentRGB) : tileOnStyle(_accentRGB));
        if (_chameleonic) {
            if (btn._icon)  btn._icon.set_style('color: white;');
            if (btn._label) btn._label.set_style('color: white;');
            btn._sub.set_style('color: rgba(255,255,255,0.85);');
        } else {
            if (btn._icon)  btn._icon.set_style(null);
            if (btn._label) btn._label.set_style(null);
            btn._sub.set_style(null);
        }
    } else {
        btn.remove_style_class_name(onClass);
        btn.set_style(null);
        if (btn._icon)  btn._icon.set_style(null);
        if (btn._label) btn._label.set_style(null);
        btn._sub.set_style(null);
    }
    if (sub !== undefined) btn._sub.set_text(sub);
}

// ── Cairo slider ──────────────────────────────────────────────
function mkCairoSlider(maxVal, ampAt, onValueChanged) {
    const H   = 28;
    const R   = H / 2;
    const wrap = new St.DrawingArea({
        reactive: true,
        style: 'height:' + H + 'px;'
    });
    wrap._value  = 0;
    wrap._maxVal = maxVal;
    wrap._ampAt  = ampAt || null;
    wrap._accent = [0.10, 0.53, 1.0];
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
        const KR    = R - 2;
        const KX    = Math.max(KR + 2, Math.min(W - KR - 2, xFill));

        cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

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

        pill(0, 0, W, H);
        cr.setSourceRGBA(1, 1, 1, 0.18);
        cr.fill();

        if (amp && x100 < W) {
            pill(0, 0, W, H);
            cr.clip();
            cr.rectangle(x100, 0, W - x100, H);
            cr.setSourceRGBA(1.0, 0.18, 0.18, 0.20);
            cr.fill();
            cr.resetClip();
        }

        if (xFill > 0) {
            const xBlue = Math.min(xFill, x100);
            if (xBlue > 0) {
                pill(0, 0, W, H);
                cr.clip();
                cr.rectangle(0, 0, xBlue, H);
                cr.setSourceRGBA(wrap._accent[0], wrap._accent[1], wrap._accent[2], 0.92);
                cr.fill();
                cr.resetClip();
            }
            if (amp && xFill > x100) {
                pill(0, 0, W, H);
                cr.clip();
                cr.rectangle(x100, 0, xFill - x100, H);
                cr.setSourceRGBA(1.0, 0.22, 0.22, 0.90);
                cr.fill();
                cr.resetClip();
            }
        }

        if (amp && x100 > 0 && x100 < W) {
            cr.newPath();
            cr.moveTo(x100, 3);
            cr.lineTo(x100, H - 3);
            cr.setSourceRGBA(1, 1, 1, 0.50);
            cr.setLineWidth(1.5);
            cr.stroke();
        }

        cr.newPath();
        cr.arc(KX, H / 2, KR, 0, 2 * Math.PI);
        cr.setSourceRGBA(1, 1, 1, 0.97);
        cr.fill();
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

    wrap.setAccent = function(rgb01) {
        wrap._accent = rgb01;
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

// ── volume ───────────────────────────────────────────────────
function getVolume() {
    let pactlOut = sh("pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null");
    if (pactlOut) {
        let match = pactlOut.match(/(\d+)%/);
        if (match && match[1]) {
            let v = parseInt(match[1], 10);
            if (!isNaN(v) && v >= 0) {
                _lastVolume = Math.min(v, 150);
            }
        }
    }
    if (_lastVolume === -1) {
        let amixerOut = sh("amixer get Master 2>/dev/null");
        if (amixerOut) {
            let match = amixerOut.match(/\[(\d+)%\]/);
            if (match && match[1]) {
                let v = parseInt(match[1], 10);
                if (!isNaN(v) && v >= 0) {
                    _lastVolume = Math.min(v, 150);
                }
            }
        }
    }
    if (_lastVolume === -1) _lastVolume = 50;
    return _lastVolume;
}

function getMuted() {
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
    if (pct === 0) {
        run('pactl set-sink-mute @DEFAULT_SINK@ 1');
        _lastMuted = true;
    } else {
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

// ── hotspot ──────────────────────────────────────────────────
function quoteArg(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}
function nmcli(args) {
    let safeArgs = args.replace(/'/g, "'\\''");
    return sh("sh -c 'LC_ALL=C nmcli " + safeArgs + "'");
}
function nmcliAsync(args) {
    let safeArgs = args.replace(/'/g, "'\\''");
    run("sh -c 'LC_ALL=C nmcli " + safeArgs + "'");
}

function getHotspotDeviceName() {
    let lines = nmcli("-t -f DEVICE,TYPE,STATE device 2>/dev/null").split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        let parts = line.split(':');
        if (parts.length < 3) continue;
        let dev = parts[0], type = parts[1], state = parts[2];
        if (type !== 'wifi') continue;
        if (state.indexOf('connected') === -1) continue;
        let mode = nmcli("-g GENERAL.MODE device show " + quoteArg(dev) + " 2>/dev/null").trim();
        if (mode === 'Hotspot' || mode === 'AP') return dev;
    }
    return null;
}
function getHotspotConnectionName() {
    let dev = getHotspotDeviceName();
    if (dev) {
        let active = nmcli("-t -f NAME,DEVICE connection show --active 2>/dev/null").split('\n');
        for (let line of active) {
            line = line.trim();
            if (!line) continue;
            let idx = line.lastIndexOf(':');
            if (idx === -1) continue;
            let name = line.substring(0, idx);
            let device = line.substring(idx + 1);
            if (device === dev) return name;
        }
    }
    let lines = nmcli("-t -f NAME,TYPE,DEVICE connection show --active 2>/dev/null").split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        let parts = line.split(':');
        if (parts.length < 3) continue;
        let name = parts[0];
        let type = parts[1];
        if (type !== '802-11-wireless' && type !== 'wifi') continue;
        let mode = nmcli("-g 802-11-wireless.mode connection show " + quoteArg(name) + " 2>/dev/null").trim().toLowerCase();
        if (mode === 'ap') return name;
    }
    return null;
}
function getHotspotState() {
    return !!getHotspotDeviceName() || !!getHotspotConnectionName();
}
function getSavedHotspotConnectionName() {
    let lines = nmcli("-t -f NAME,TYPE connection show 2>/dev/null").split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        let idx = line.lastIndexOf(':');
        if (idx === -1) continue;
        let name = line.substring(0, idx);
        let type = line.substring(idx + 1);
        if (type !== '802-11-wireless' && type !== 'wifi') continue;
        let mode = nmcli("-g 802-11-wireless.mode connection show " + quoteArg(name) + " 2>/dev/null").trim().toLowerCase();
        if (mode === 'ap') return name;
    }
    return null;
}

// ── notifications ────────────────────────────────────────────
function getNotificationsDisplayState() {
    try {
        let settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.notifications' });
        return settings.get_boolean('display-notifications');
    } catch(e) {
        return true;
    }
}
function setNotificationsDisplayState(show) {
    try {
        let settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.notifications' });
        settings.set_boolean('display-notifications', show);
        return true;
    } catch(e) {
        return false;
    }
}

// ── night light ──────────────────────────────────────────────
function getNightLightState() {
    try {
        let settings = new Gio.Settings({ schema: 'org.cinnamon.settings-daemon.plugins.color' });
        return settings.get_boolean('night-light-enabled');
    } catch(e) {
        try {
            let settings = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.color' });
            return settings.get_boolean('night-light-enabled');
        } catch(e2) {
            return false;
        }
    }
}
function nightLightToggle(currentState) {
    let newState = !currentState;
    try {
        let settings = new Gio.Settings({ schema: 'org.cinnamon.settings-daemon.plugins.color' });
        settings.set_boolean('night-light-enabled', newState);
    } catch(e) {
        try {
            let settings = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.color' });
            settings.set_boolean('night-light-enabled', newState);
        } catch(e2) {}
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

        if      (this.colorTheme === 'macos-light') this.colorTheme = 'macos-light';
        else if (this.colorTheme === 'macos-dark')  this.colorTheme = 'macos-dark';
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
        this.hotspotOn    = false;
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

    _applyTheme(overrideTheme) {
        if (!this.shell) return;
        let theme = overrideTheme || this.colorTheme;
        let wantClass = theme === 'macos-light' ? 'gs-theme-macos-light'
                       : theme === 'macos-dark'  ? 'gs-theme-macos-dark'
                       :                           'gs-theme-desktop';
        if (this.shell.has_style_class_name(wantClass)) {
            _chameleonic = (wantClass === 'gs-theme-desktop');
            // Still need to update cards in case theme changed via other means
            this._applyThemeToCards(theme);
            return;
        }
        for (let c of ['gs-theme-macos-light', 'gs-theme-macos-dark', 'gs-theme-desktop'])
            this.shell.remove_style_class_name(c);
        this.shell.add_style_class_name(wantClass);
        _chameleonic = (wantClass === 'gs-theme-desktop');
        for (let t of [this.wifiTile, this.btTile, this.hotspotTile, this.focusTile, this.darkTile, this.nightTile]) {
            if (t && t._on) setTile(t, true);
        }
        // Update slider cards to match the new theme
        this._applyThemeToCards(theme);
    }

    // ★ NEW: Apply inline styles to slider cards based on current theme ★
    // IMPORTANT: takes the already-resolved theme as a parameter instead of
    // re-reading this.colorTheme. _syncColorThemeWithDarkMode() calls
    // _applyTheme(wanted) and only writes this.colorTheme = wanted
    // AFTERWARDS, so re-reading this.colorTheme in here was always seeing
    // the *previous* theme — one step stale — which is exactly why
    // switching to dark showed the old light card colors and vice versa.
    _applyThemeToCards(theme) {
        theme = theme || this.colorTheme;
        const layout = 'spacing:3px; padding:7px 14px; '; // must survive set_style()
        let lightStyle = layout +
                         'background-color: rgba(255, 255, 255, 0.55) !important; ' +
                         'border: 1px solid rgba(255, 255, 255, 0.4) !important; ' +
                         'border-radius: 18px !important; ' +
                         'box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(255, 255, 255, 0.3) inset !important;';
        let darkStyle = layout +
                        'background-color: rgba(0, 0, 0, 0.55) !important; ' +
                        'border: 1px solid rgba(255, 255, 255, 0.14) !important; ' +
                        'border-radius: 18px !important; ' +
                        'box-shadow: none !important;';
        let desktopStyle = layout +
                           'background-color: transparent !important; ' +
                           'border: 1px solid rgba(255, 255, 255, 0.14) !important; ' +
                           'border-radius: 18px !important; ' +
                           'box-shadow: none !important;';

        let style = '';
        if (theme === 'macos-light') style = lightStyle;
        else if (theme === 'macos-dark') style = darkStyle;
        else style = desktopStyle;

        if (this._brightCard) this._brightCard.set_style(style);
        if (this._volCard) this._volCard.set_style(style);

        // ★ Also set label and icon colors for slider cards ★
        let labelColor = (theme === 'macos-light') ? 'black' : 'white';
        if (this._brightLabel) this._brightLabel.set_style('color: ' + labelColor + ';');
        if (this._volLabel) this._volLabel.set_style('color: ' + labelColor + ';');
        if (this._brightIcon) this._brightIcon.set_style('color: ' + labelColor + ';');
        if (this._volIcon) this._volIcon.set_style('color: ' + labelColor + ';');
    }

    // Toggling dark/light from this applet should load its own built-in
    // macOS light/dark skin to match.
    _syncColorThemeWithDarkMode() {
        let wanted = this.darkMode ? 'macos-dark' : 'macos-light';
        this._applyTheme(wanted);
        try { this.colorTheme = wanted; } catch (e) {}
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
            style: 'width:460px; padding:10px; spacing:5px;'
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

        this.hotspotTile = mkTile('network-workgroup-symbolic',      'Hotspot',    'Off',   'Network Settings', true);
        this.focusTile   = mkTile('notifications-disabled-symbolic', 'Focus',      'Off',   'Do Not Disturb',    true);
        this.mirrorTile  = mkTile('video-display-symbolic',          'Display',    '',      'Display Settings',  true);
        this.darkTile    = mkTile('weather-clear-night-symbolic',    'Dark Mode',  'Light', 'Toggle Dark/Light',  true);
        this.nightTile   = mkTile('night-light-symbolic',            'Night Light','Off',   'Toggle Night Light', true);
        this.blankTile   = mkTile('display-brightness-symbolic',     'Blank',      '',      'Blank Screen',       true);

        let sg1 = new St.BoxLayout({ style: 'spacing:10px;', x_align: St.Align.MIDDLE });
        sg1.add(this.hotspotTile, { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        sg1.add(this.focusTile,   { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        leftCol.add(sg1, { x_fill: true });

        let sg2 = new St.BoxLayout({ style: 'spacing:10px;', x_align: St.Align.MIDDLE });
        sg2.add(this.mirrorTile,  { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        sg2.add(this.darkTile,    { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        leftCol.add(sg2, { x_fill: true });

        let sg3 = new St.BoxLayout({ style: 'spacing:10px;', x_align: St.Align.MIDDLE });
        sg3.add(this.nightTile,   { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        sg3.add(this.blankTile,   { expand: true, x_fill: false, x_align: St.Align.MIDDLE });
        leftCol.add(sg3, { x_fill: true });

        this._npCard = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-np-card',
            style: 'padding:0; spacing:0; border-radius:18px;'
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
        this._npArtCanvas.set_style('min-height:200px; border-radius:18px;');

        this._npArtCanvas.connect('repaint', (area) => {
            const cr    = area.get_context();
            const alloc = area.get_allocation_box();
            const W     = alloc.x2 - alloc.x1;
            const H     = alloc.y2 - alloc.y1;
            if (W < 2 || H < 2) { cr.$dispose(); return; }
            const R = 18;

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

        // Media control buttons
        let npCtrl = new St.BoxLayout({ style: 'padding:4px 10px 12px 10px; spacing:0;' });

        this.prevBtn = new St.Button({
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px; transition: all 0.2s ease;'
        });
        let prevIcon = sym('media-skip-backward-symbolic', 16);
        prevIcon.set_style('color: white;');
        this.prevBtn.set_child(prevIcon);
        this.prevBtn.connect('enter-event', () => {
            this.prevBtn.set_style('background: rgba(255,255,255,0.15); border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        this.prevBtn.connect('leave-event', () => {
            this.prevBtn.set_style('background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });

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

        this.nextBtn = new St.Button({
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px; transition: all 0.2s ease;'
        });
        let nextIcon = sym('media-skip-forward-symbolic', 16);
        nextIcon.set_style('color: white;');
        this.nextBtn.set_child(nextIcon);
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
            vertical: true,
            style_class: 'gs-slider-card',
            style: 'spacing:3px; padding:7px 14px;'
        });

        // ★ Store label reference ★
        let brightLabel = new St.Label({ text: 'Brightness', style_class: 'gs-slider-label' });
        this._brightLabel = brightLabel;
        brightCard.add(brightLabel);

        let brightRow = new St.BoxLayout({ style: 'spacing:8px;' });
        let biL = sym('display-brightness-symbolic', 16);
        biL.add_style_class_name('gs-slider-icon');
        this._brightIcon = biL; // ★ store icon reference
        this._brightSlider = mkCairoSlider(1.0, null, v => setBrightness(v));
        brightRow.add(biL);
        brightRow.add(this._brightSlider, { expand: true });
        brightCard.add(brightRow);
        this.shell.add(brightCard);
        this._brightCard = brightCard; // store reference

        // ─── Volume slider ──────────────────────────────────────
        let volCard = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-slider-card',
            style: 'spacing:3px; padding:7px 14px;'
        });

        // ★ Store label reference ★
        let volLabel = new St.Label({ text: 'Volume', style_class: 'gs-slider-label' });
        this._volLabel = volLabel;
        volCard.add(volLabel);

        let volRow = new St.BoxLayout({ style: 'spacing:8px;' });
        this.volIconL = sym('audio-volume-muted-symbolic', 16);
        this.volIconL.add_style_class_name('gs-slider-icon');
        this._volIcon = this.volIconL; // ★ store icon reference (same as this.volIconL)
        this._volSlider = mkCairoSlider(150, 100, v => setVolume(v));
        volRow.add(this.volIconL);
        volRow.add(this._volSlider, { expand: true });
        volCard.add(volRow);
        this.shell.add(volCard);
        this._volCard = volCard; // store reference

        // ★ Apply the theme styling to the cards now that they exist ★
        this._applyThemeToCards();

        this.shell.add(new St.Widget({ style_class: 'gs-sep' }));

        // Bottom row: 5 equal circular icon buttons.
        let bottomRow = new St.BoxLayout({ style: 'spacing:42.5px;' });

        let settingsBtn = new St.Button({ style_class: 'gs-sys-btn', reactive: true });
        let settingsIcon = sym('preferences-system-symbolic', 22);
        settingsBtn.set_child(settingsIcon);
        settingsBtn.connect('clicked', () => { run('cinnamon-settings'); this.menu.close(); });
        tip(settingsBtn, 'Open System Settings');
        bottomRow.add(settingsBtn);

        for (let [ic, label, cb] of [
            ['utilities-terminal-symbolic',     'Terminal',   () => { run('gnome-terminal'); this.menu.close(); }],
            ['alarm-clock-symbolic',            'Clocks',     () => { openClocks(); this.menu.close(); }],
            ['camera-photo-symbolic',           'Screenshot', () => { openScreenshot(); this.menu.close(); }],
            ['office-calendar-symbolic',        'Calendar',   () => { openCalendar(); this.menu.close(); }],
        ]) {
            let b = new St.Button({ style_class: 'gs-sys-btn', reactive: true });
            b.set_child(sym(ic, 22)); b.connect('clicked', cb); tip(b, label);
            bottomRow.add(b);
        }
        this.shell.add(bottomRow);

        section.actor.add(this.shell);
        this.menu.addMenuItem(section);
    }

    _connectSignals() {
        this.wifiTile.connect('clicked',     () => this._toggleWifi());
        this.btTile.connect('clicked',       () => this._toggleBluetooth());
        this.hotspotTile.connect('clicked',  () => {
            let active = getHotspotConnectionName();
            if (active) {
                nmcliAsync("connection down " + quoteArg(active));
                setTile(this.hotspotTile, false, 'Off');
            } else {
                let saved = getSavedHotspotConnectionName();
                if (saved) {
                    nmcli("connection up " + quoteArg(saved) + " 2>/dev/null");
                    let nowOn = getHotspotState();
                    setTile(this.hotspotTile, nowOn, nowOn ? 'On' : 'Off');
                    if (!nowOn) { run('cinnamon-settings network'); this.menu.close(); }
                } else {
                    run('cinnamon-settings network');
                    this.menu.close();
                }
            }
        });
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

        this.hotspotOn = getHotspotState();
        setTile(this.hotspotTile, this.hotspotOn, this.hotspotOn ? 'On' : 'Off');

        let dark = getColorSchemeDark();
        if (dark !== null) {
            this.darkMode = dark;
        } else {
            let gtk = sh("gsettings get org.cinnamon.desktop.interface gtk-theme 2>/dev/null").replace(/'/g, '').toLowerCase();
            this.darkMode = gtk.indexOf('dark') !== -1;
        }
        setTile(this.darkTile, this.darkMode, this.darkMode ? 'Dark' : 'Light');
        this.focusOn = !getNotificationsDisplayState();
        setTile(this.focusTile, this.focusOn, this.focusOn ? 'On' : 'Off');

        this.nightLightOn = getNightLightState();
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
            }
            return false;
        });

        this._updateMediaInfo();
    }

    _updateMediaInfo() {
        findMprisPlayers(players => {
            if (!players.length) {
                this.activePlayer = null;
                this._stopAccentCycle();
                this._npAppName    = 'NOT PLAYING';
                this._npTitleText  = 'No Media';
                this._npArtistText = '';
                let playIcon = sym('media-playback-start-symbolic', 28);
                playIcon.set_style('color: white;');
                this.playBtn.set_child(playIcon);
                this.playBtn.set_style('background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
                this._npArtUrl   = '';
                this._npPixbuf   = null;
                this._npAccent   = [0.2, 0.5, 1.0];
                this._applyAccent(this._npAccent);
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

    _applyAccent(rgb01) {
        let r = Math.round(rgb01[0] * 255), g = Math.round(rgb01[1] * 255), b = Math.round(rgb01[2] * 255);
        _accentRGB = [r, g, b];
        for (let t of [this.wifiTile, this.btTile, this.hotspotTile, this.focusTile, this.darkTile, this.nightTile]) {
            if (t && t._on) setTile(t, true);
        }
        if (this._brightSlider) this._brightSlider.setAccent(rgb01);
        if (this._volSlider)    this._volSlider.setAccent(rgb01);
    }

    _paintCardFromAccent() {
        let [r, g, b] = this._npAccent;
        let pr = Math.round(r * 255), pg = Math.round(g * 255), pb = Math.round(b * 255);
        this._npCard.set_style(
            'border-radius: 18px; ' +
            'background-color: rgba(' + pr + ',' + pg + ',' + pb + ', 0.9) !important; ' +
            'border: 1px solid rgba(' + pr + ',' + pg + ',' + pb + ', 0.1);');
    }

    _startAccentCycle() {
        if (this._accentCycleTimer) return;
        this._accentCycleIdx = 0;
        this._npAccent = TAHOE_ACCENTS[0];
        this._applyAccent(this._npAccent);
        this._paintCardFromAccent();
        if (this._npArtCanvas) this._npArtCanvas.queue_repaint();
        this._accentCycleTimer = Mainloop.timeout_add_seconds(3, () => {
            if (!this.menu.isOpen) { this._accentCycleTimer = null; return false; }
            let fromColor = this._npAccent;
            this._accentCycleIdx = (this._accentCycleIdx + 1) % TAHOE_ACCENTS.length;
            let toColor = TAHOE_ACCENTS[this._accentCycleIdx];
            this._crossfadeAccent(fromColor, toColor);
            return true;
        });
    }

    _crossfadeAccent(fromColor, toColor) {
        if (this._accentFadeTimer) {
            Mainloop.source_remove(this._accentFadeTimer);
            this._accentFadeTimer = null;
        }
        const FADE_MS = 900;
        const STEP_MS = 33;
        let steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
        let step = 0;
        this._accentFadeTimer = Mainloop.timeout_add(STEP_MS, () => {
            if (!this.menu.isOpen) { this._accentFadeTimer = null; return false; }
            step++;
            let t = Math.min(1, step / steps);
            let eased = t * t * (3 - 2 * t);
            this._npAccent = lerpColor(fromColor, toColor, eased);
            this._applyAccent(this._npAccent);
            this._paintCardFromAccent();
            if (this._npArtCanvas) this._npArtCanvas.queue_repaint();
            if (t >= 1) { this._accentFadeTimer = null; return false; }
            return true;
        });
    }

    _stopAccentCycle() {
        if (this._accentCycleTimer) {
            Mainloop.source_remove(this._accentCycleTimer);
            this._accentCycleTimer = null;
        }
        if (this._accentFadeTimer) {
            Mainloop.source_remove(this._accentFadeTimer);
            this._accentFadeTimer = null;
        }
    }

    _applyMediaInfo(info, playing) {
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
        if (artUrl) {
            this._stopAccentCycle();
            if (artUrl !== this._npArtUrl) {
                this._npArtUrl = artUrl;
                loadArtwork(artUrl, (pix) => {
                    this._npPixbuf = pix;
                    if (pix) {
                        this._npAccent = dominantColor(pix);
                    }
                    this._npArtCanvas.queue_repaint();
                    this._npProgress.queue_repaint();
                    this._applyAccent(this._npAccent);
                    this._paintCardFromAccent();
                });
            }
        } else if (playing) {
            this._npArtUrl = '';
            this._npPixbuf = null;
            this._startAccentCycle();
            this._npArtCanvas.queue_repaint();
            this._npProgress.queue_repaint();
        } else {
            this._stopAccentCycle();
            this._npArtUrl   = '';
            this._npPixbuf   = null;
            this._npAccent   = [0.2, 0.5, 1.0];
            this._npArtCanvas.queue_repaint();
            this._npProgress.queue_repaint();
        }

        this._applyAccent(this._npAccent);
        this._paintCardFromAccent();
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
        let newFocusOn = !this.focusOn;
        let ok = setNotificationsDisplayState(!newFocusOn);
        if (ok) this.focusOn = newFocusOn;
        setTile(this.focusTile, this.focusOn, this.focusOn ? 'On' : 'Off');
    }

    _toggleDarkMode() {
        this.darkMode = !this.darkMode;
        let theme = this.darkMode ? (this.darkGtk || 'Mint-Y-Dark-Aqua') : (this.lightGtk || 'Mint-Y-Aqua');
        run("gsettings set org.cinnamon.desktop.interface gtk-theme '" + theme + "'");
        run("gsettings set org.cinnamon.theme name '" + theme + "'");
        setColorSchemeDark(this.darkMode);
        setTile(this.darkTile, this.darkMode, this.darkMode ? 'Dark' : 'Light');
        this._syncColorThemeWithDarkMode();
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
