// ============================================================
//  sound@brahim — Premium Sound Applet
//  Now Playing card + Volume slider with amplification
//  Author: Brahim Salem — Linux Mint 22.x / Cinnamon 5.x-6.x
// ============================================================

const GLib      = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio       = imports.gi.Gio;
const St        = imports.gi.St;
const Clutter   = imports.gi.Clutter;
const Cairo     = imports.cairo;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;

const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupMenuSection }             = imports.ui.popupMenu;
const { SignalManager }                                  = imports.misc.signalManager;
const { AppletSettings }                                 = imports.ui.settings;

// ── helpers ──────────────────────────────────────────────────
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

// ── Cairo slider — macOS pill style ──────────────────────────
function mkCairoSlider(maxVal, ampAt, onValueChanged) {
    const H = 28;
    const R = H / 2;

    const wrap = new St.DrawingArea({ reactive: true, style: 'height:' + H + 'px;' });
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
        const KR    = R - 2;
        const KX    = Math.max(KR + 2, Math.min(W - KR - 2, xFill));

        cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        function pill(x, y, w, h) {
            if (w <= 0) return;
            const pr = Math.min(h / 2, w / 2);
            cr.newPath();
            cr.arc(x + pr,     y + pr,     pr, Math.PI,     3*Math.PI/2);
            cr.arc(x + w - pr, y + pr,     pr, 3*Math.PI/2, 0);
            cr.arc(x + w - pr, y + h - pr, pr, 0,           Math.PI/2);
            cr.arc(x + pr,     y + h - pr, pr, Math.PI/2,   Math.PI);
            cr.closePath();
        }

        // Track
        pill(0, 0, W, H);
        cr.setSourceRGBA(1, 1, 1, 0.18); cr.fill();

        // Red zone bg
        if (amp && x100 < W) {
            pill(0, 0, W, H); cr.clip();
            cr.rectangle(x100, 0, W - x100, H);
            cr.setSourceRGBA(1.0, 0.18, 0.18, 0.20); cr.fill();
            cr.resetClip();
        }

        // Blue fill
        if (xFill > 0) {
            const xBlue = Math.min(xFill, x100);
            if (xBlue > 0) {
                pill(0, 0, W, H); cr.clip();
                cr.rectangle(0, 0, xBlue, H);
                cr.setSourceRGBA(0.10, 0.53, 1.0, 0.92); cr.fill();
                cr.resetClip();
            }
            if (amp && xFill > x100) {
                pill(0, 0, W, H); cr.clip();
                cr.rectangle(x100, 0, xFill - x100, H);
                cr.setSourceRGBA(1.0, 0.22, 0.22, 0.90); cr.fill();
                cr.resetClip();
            }
        }

        // 100% tick
        if (amp && x100 > 0 && x100 < W) {
            cr.newPath();
            cr.moveTo(x100, 3); cr.lineTo(x100, H - 3);
            cr.setSourceRGBA(1, 1, 1, 0.50); cr.setLineWidth(1.5); cr.stroke();
        }

        // Knob
        cr.newPath();
        cr.arc(KX, H / 2, KR, 0, 2 * Math.PI);
        cr.setSourceRGBA(1, 1, 1, 0.97); cr.fill();
        cr.newPath();
        cr.arc(KX, H / 2, KR, 0, 2 * Math.PI);
        cr.setSourceRGBA(0, 0, 0, 0.14); cr.setLineWidth(0.8); cr.stroke();

        cr.$dispose();
    });

    wrap.setValue = function(v) {
        const c = Math.max(0, Math.min(wrap._maxVal, v));
        if (c === wrap._value) return;
        wrap._value = c;
        wrap.queue_repaint();
    };

    function posToVal(area, eventX) {
        const alloc = area.get_allocation_box();
        const W = alloc.x2 - alloc.x1;
        const [ax] = area.get_transformed_position();
        return Math.max(0, Math.min(1, (eventX - ax) / W)) * wrap._maxVal;
    }

    let dragging = false;
    wrap.connect('button-press-event', (a, ev) => {
        dragging = true;
        let [bx] = ev.get_coords();
        let v = posToVal(a, bx);
        wrap.setValue(v); if (wrap._cb) wrap._cb(v);
        return Clutter.EVENT_STOP;
    });
    wrap.connect('motion-event', (a, ev) => {
        if (!dragging) return Clutter.EVENT_PROPAGATE;
        let [bx] = ev.get_coords();
        let v = posToVal(a, bx);
        wrap.setValue(v); if (wrap._cb) wrap._cb(v);
        return Clutter.EVENT_STOP;
    });
    wrap.connect('button-release-event', () => { dragging = false; return Clutter.EVENT_STOP; });

    let scrollTimer = null;
    wrap.connect('scroll-event', (a, ev) => {
        const step = wrap._maxVal * 0.04;
        const dir  = ev.get_scroll_direction();
        let nv = wrap._value;
        if (dir === Clutter.ScrollDirection.UP   || dir === Clutter.ScrollDirection.RIGHT)
            nv = Math.min(wrap._maxVal, nv + step);
        else if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.LEFT)
            nv = Math.max(0, nv - step);
        else return Clutter.EVENT_STOP;
        wrap.setValue(nv);
        if (scrollTimer) { Mainloop.source_remove(scrollTimer); scrollTimer = null; }
        const cap = nv;
        scrollTimer = Mainloop.timeout_add(80, () => { if (wrap._cb) wrap._cb(cap); scrollTimer = null; return false; });
        return Clutter.EVENT_STOP;
    });

    return wrap;
}

// ── volume ───────────────────────────────────────────────────
let _lastVolume = -1;
let _lastMuted  = false;
let _volumeCache = { volume: 50, muted: false, timestamp: 0 };
const CACHE_TTL = 200; // 200ms cache TTL

function getVolume() {
    let now = Date.now();
    if (_volumeCache.timestamp > 0 && (now - _volumeCache.timestamp) < CACHE_TTL) {
        return _volumeCache.volume;
    }
    
    let out = sh('pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null');
    if (out) {
        let m = out.match(/(\d+)%/);
        if (m) { 
            _lastVolume = Math.min(parseInt(m[1], 10), 150);
            _volumeCache.volume = _lastVolume;
            _volumeCache.timestamp = now;
            return _lastVolume;
        }
    }
    let am = sh('amixer get Master 2>/dev/null');
    if (am) {
        let m = am.match(/\[(\d+)%\]/);
        if (m) { 
            _lastVolume = Math.min(parseInt(m[1], 10), 150);
            _volumeCache.volume = _lastVolume;
            _volumeCache.timestamp = now;
            return _lastVolume;
        }
    }
    if (_lastVolume === -1) _lastVolume = 50;
    _volumeCache.volume = _lastVolume;
    _volumeCache.timestamp = now;
    return _lastVolume;
}

function getMuted() {
    let now = Date.now();
    if (_volumeCache.timestamp > 0 && (now - _volumeCache.timestamp) < CACHE_TTL) {
        return _volumeCache.muted;
    }
    
    let out = sh('pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null');
    if (out.indexOf('Mute: yes') !== -1) { 
        _lastMuted = true;
        _volumeCache.muted = true;
        _volumeCache.timestamp = now;
        return true;
    }
    if (out.indexOf('Mute: no')  !== -1) { 
        _lastMuted = false;
        _volumeCache.muted = false;
        _volumeCache.timestamp = now;
        return false;
    }
    _volumeCache.muted = _lastMuted;
    _volumeCache.timestamp = now;
    return _lastMuted;
}

function setVolume(pct) {
    pct = Math.round(Math.min(Math.max(pct, 0), 150));
    if (pct === 0) {
        run('pactl set-sink-mute @DEFAULT_SINK@ 1');
        _lastMuted = true;
        _volumeCache.muted = true;
        _volumeCache.volume = 0;
        _volumeCache.timestamp = Date.now();
    } else {
        if (_lastMuted) { 
            run('pactl set-sink-mute @DEFAULT_SINK@ 0'); 
            _lastMuted = false;
            _volumeCache.muted = false;
        }
        _lastVolume = pct;
        _volumeCache.volume = pct;
        _volumeCache.timestamp = Date.now();
        run('pactl set-sink-volume @DEFAULT_SINK@ ' + pct + '%');
    }
}

function toggleMute() {
    _lastMuted = !_lastMuted;
    _volumeCache.muted = _lastMuted;
    _volumeCache.timestamp = Date.now();
    run('pactl set-sink-mute @DEFAULT_SINK@ ' + (_lastMuted ? '1' : '0'));
    return _lastMuted;
}

function volIconName(vol, muted) {
    if (muted || vol === 0) return 'audio-volume-muted-symbolic';
    if (vol <= 33)  return 'audio-volume-low-symbolic';
    if (vol <= 66)  return 'audio-volume-medium-symbolic';
    return 'audio-volume-high-symbolic';
}

// ── MPRIS ────────────────────────────────────────────────────
function findMprisPlayers(cb) {
    try {
        Gio.DBus.session.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'ListNames',
            null, new GLib.VariantType('(as)'),
            Gio.DBusCallFlags.NONE, 2000, null, (conn, res) => {
                try {
                    const raw = conn.call_finish(res).deepUnpack();
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
                    const raw = unpackV(conn.call_finish(res));
                    let props = raw;
                    while (Array.isArray(props) && props.length === 1) props = props[0];
                    const meta   = props['Metadata'] || {};
                    const status = String(props['PlaybackStatus'] || 'Stopped');
                    let title   = String(unpackV(meta['xesam:title']) || '');
                    let artists = unpackV(meta['xesam:artist']) || [];
                    if (!Array.isArray(artists)) artists = artists ? [String(artists)] : [];
                    let artist  = artists.map(String).join(', ');
                    if (!title && meta['xesam:url'])
                        title = String(meta['xesam:url']).replace(/^https?:\/\//, '').split('/')[0];
                    let appName = busName.replace('org.mpris.MediaPlayer2.', '').split('.')[0];
                    appName = appName.charAt(0).toUpperCase() + appName.slice(1);
                    let artUrl = String(unpackV(meta['mpris:artUrl']) || '');
                    let position = 0, length = 0;
                    try {
                        let rp = unpackV(props['Position']); if (rp != null) position = Number(rp);
                        let rl = unpackV(meta['mpris:length']); if (rl != null) length = Number(rl);
                    } catch(e2) {}
                    cb({ title, artist, status, appName, busName, artUrl, position, length });
                } catch(e) { cb(null); }
            });
    } catch(e) { cb(null); }
}

function loadArtwork(artUrl, cb) {
    if (!artUrl) { cb(null); return; }
    try {
        if (artUrl.startsWith('file://')) {
            let path = artUrl.replace('file://', '');
            try { path = decodeURIComponent(path); } catch(e) {}
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                try { cb(GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 480, 480, true)); return; } catch(e) {}
            }
        } else if (artUrl.startsWith('http')) {
            let hash = artUrl.replace(/[^a-z0-9]/gi, '').substring(0, 32);
            let tmp = '/tmp/sound-brahim-art-' + hash + '.jpg';
            if (GLib.file_test(tmp, GLib.FileTest.EXISTS)) {
                try { cb(GdkPixbuf.Pixbuf.new_from_file_at_scale(tmp, 480, 480, true)); return; } catch(e) {}
            }
            GLib.spawn_command_line_async('wget -q -O "' + tmp + '" "' + artUrl + '"');
            Mainloop.timeout_add(800, () => {
                try { cb(GdkPixbuf.Pixbuf.new_from_file_at_scale(tmp, 480, 480, true)); }
                catch(e) { cb(null); }
                return false;
            });
            return;
        }
    } catch(e) {}
    cb(null);
}

function dominantColor(pix) {
    if (!pix) return [0.2, 0.5, 1.0];
    try {
        let w = pix.get_width(), h = pix.get_height();
        let pixels = pix.get_pixels();
        let nc = pix.get_n_channels(), rs = pix.get_rowstride();
        let rS = 0, gS = 0, bS = 0, n = 0;
        for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
            let i = y * rs + x * nc;
            let r = pixels[i]/255, g = pixels[i+1]/255, b = pixels[i+2]/255;
            if (Math.max(r,g,b) - Math.min(r,g,b) > 0.2 && Math.max(r,g,b) > 0.3)
                { rS += r; gS += g; bS += b; n++; }
        }
        return n ? [rS/n, gS/n, bS/n] : [0.2, 0.5, 1.0];
    } catch(e) { return [0.2, 0.5, 1.0]; }
}

function sendMprisCmd(busName, method) {
    try {
        Gio.DBus.session.call(busName, '/org/mpris/MediaPlayer2',
            'org.mpris.MediaPlayer2.Player', method,
            null, null, Gio.DBusCallFlags.NONE, 1000, null, null);
    } catch(e) {}
}

// ════════════════════════════════════════════════════════════
//  APPLET
// ════════════════════════════════════════════════════════════
const SoundApplet = class SoundApplet extends TextIconApplet {

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

        // Settings
        this._settings = new AppletSettings(this, metadata.uuid, instanceId);
        this._settings.bind('color-theme',      'colorTheme',    this._applyTheme.bind(this));
        this._settings.bind('use-custom-icon',  'useCustomIcon', this._updatePanelIcon.bind(this));
        this._settings.bind('custom-icon',      'customIcon',   this._updatePanelIcon.bind(this));
        this._settings.bind('panel-label',      'panelLabel',   this._updatePanelIcon.bind(this));

        this.colorTheme = this.colorTheme || 'win11-dark';

        this._updatePanelIcon();
        this.set_applet_tooltip('Sound');

        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('gs-menu');

        this.signals      = new SignalManager(null);
        this.activePlayer = null;
        this.mediaTimer   = null;
        this._posTimer    = null;
        this._tooltipTimer = null;

        this._npPixbuf     = null;
        this._npAccent     = [0.2, 0.5, 1.0];
        this._npArtUrl     = '';
        this._npPos        = 0;
        this._npLen        = 0;
        this._npAppName    = '';
        this._npTitleText  = 'No Media';
        this._npArtistText = '';

        this._buildUI();
        this._connectSignals();

        // Connect scroll event to the applet actor
        this.actor.connect('scroll-event', (actor, event) => {
            this.on_applet_scroll_event(event);
            return Clutter.EVENT_STOP;
        });
        
        // Initial volume refresh
        this._refreshVolume();
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
                this.set_applet_icon_symbolic_name('audio-speakers-symbolic');
            }
        } catch(e) { this.set_applet_icon_symbolic_name('audio-speakers-symbolic'); }
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

    _buildUI() {
        let section = new PopupMenuSection();

        // Shell — narrow, just media + volume
        this.shell = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-shell',
            style: 'width:320px; padding:12px; spacing:10px;'
        });
        this._applyTheme();

        // ── Now Playing card — full width ─────────────────────
        this._npCard = new St.BoxLayout({
            vertical: true,
            style_class: 'gs-np-card',
            style: 'padding:0; spacing:0; border-radius:12px;'
        });

        // Art canvas — fills card
        this._npArtCanvas = new St.DrawingArea({ reactive: false });
        this._npArtCanvas.set_style('min-height:200px;');

        this._npArtCanvas.connect('repaint', (area) => {
            const cr    = area.get_context();
            const alloc = area.get_allocation_box();
            const W = alloc.x2 - alloc.x1, H = alloc.y2 - alloc.y1;
            if (W < 2 || H < 2) { cr.$dispose(); return; }
            const R = 12;

            // Clip rounded rect
            cr.newPath();
            cr.moveTo(R, 0);
            cr.lineTo(W-R, 0); cr.arc(W-R, R,   R, -Math.PI/2, 0);
            cr.lineTo(W, H-R); cr.arc(W-R, H-R, R, 0,          Math.PI/2);
            cr.lineTo(R, H);   cr.arc(R,   H-R, R, Math.PI/2,  Math.PI);
            cr.lineTo(0, R);   cr.arc(R,   R,   R, Math.PI,    3*Math.PI/2);
            cr.closePath(); cr.clip();

            if (this._npPixbuf) {
                let pw = this._npPixbuf.get_width(), ph = this._npPixbuf.get_height();
                let scale = Math.max(W/pw, H/ph);
                cr.save();
                cr.translate((W - pw*scale)/2, (H - ph*scale)/2);
                cr.scale(scale, scale);
                imports.gi.Gdk.cairo_set_source_pixbuf(cr, this._npPixbuf, 0, 0);
                cr.paint(); cr.restore();
            } else {
                let [ar, ag, ab] = this._npAccent;
                let g = new Cairo.LinearGradient(0, 0, 0, H);
                g.addColorStopRGBA(0, Math.min(1,ar*0.7+0.1), Math.min(1,ag*0.6+0.05), Math.min(1,ab*0.8+0.08), 1);
                g.addColorStopRGBA(1, 0.08, 0.08, 0.15, 1);
                cr.setSource(g); cr.rectangle(0,0,W,H); cr.fill();
                cr.setFontSize(72); cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
                cr.setSourceRGBA(1,1,1,0.12); cr.moveTo(W/2-26, H*0.56); cr.showText('♫');
            }

            // Scrim
            let scrim = new Cairo.LinearGradient(0, H*0.25, 0, H);
            scrim.addColorStopRGBA(0, 0,0,0, 0);
            scrim.addColorStopRGBA(0.55, 0,0,0, 0.55);
            scrim.addColorStopRGBA(1, 0,0,0, 0.90);
            cr.setSource(scrim); cr.rectangle(0,0,W,H); cr.fill();

            // App name
            cr.setFontSize(9); cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(1,1,1,0.52); cr.moveTo(14, H-60);
            cr.showText((this._npAppName || 'NOT PLAYING').toUpperCase());

            // Title
            let title = (this._npTitleText || 'No Media');
            if (title.length > 22) title = title.substring(0,20) + '…';
            cr.setFontSize(15); cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setSourceRGBA(1,1,1,0.97); cr.moveTo(14, H-38); cr.showText(title);

            // Artist
            let artist = this._npArtistText || '';
            if (artist.length > 26) artist = artist.substring(0,24) + '…';
            cr.setFontSize(10); cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(1,1,1,0.62); cr.moveTo(14, H-20); cr.showText(artist);

            cr.$dispose();
        });

        this._npCard.add(this._npArtCanvas, { expand: true });

        // Progress bar
        this._npProgress  = new St.DrawingArea({ style: 'height:20px;', reactive: true });
        this._npTimeLeft  = new St.Label({ text: '0:00', style_class: 'gs-np-time' });
        this._npTimeRight = new St.Label({ text: '0:00', style_class: 'gs-np-time' });

        this._npProgress.connect('repaint', (area) => {
            const cr = area.get_context();
            const alloc = area.get_allocation_box();
            const W = alloc.x2 - alloc.x1, H = alloc.y2 - alloc.y1;
            if (W < 2 || H < 2) { cr.$dispose(); return; }
            const TH = 3, ty = (H-TH)/2;
            const frac = this._npLen > 0 ? Math.min(1, this._npPos/this._npLen) : 0;
            let [ar,ag,ab] = this._npAccent;
            cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.rectangle(0,ty,W,TH); cr.setSourceRGBA(0.2,0.2,0.2,0.22); cr.fill();
            if (frac > 0) { cr.rectangle(0,ty,W*frac,TH); cr.setSourceRGBA(ar,ag,ab,0.92); cr.fill(); }
            let kx = Math.max(5, Math.min(W-5, W*frac));
            cr.arc(kx, H/2, 5, 0, 2*Math.PI); cr.setSourceRGBA(1,1,1,0.95); cr.fill();
            cr.$dispose();
        });

        this._npProgress.connect('button-press-event', (a, ev) => {
            if (!this.activePlayer || this._npLen <= 0) return Clutter.EVENT_STOP;
            let [bx] = ev.get_coords(), [ax] = a.get_transformed_position();
            let frac = Math.max(0, Math.min(1, (bx-ax)/a.get_width()));
            this._npPos = Math.round(frac * this._npLen);
            this._npProgress.queue_repaint(); this._updateTimeLabels();
            try {
                Gio.DBus.session.call(this.activePlayer, '/org/mpris/MediaPlayer2',
                    'org.freedesktop.DBus.Properties', 'Set',
                    new GLib.Variant('(ssv)', ['org.mpris.MediaPlayer2.Player','Position',
                        new GLib.Variant('x', this._npPos)]),
                    null, Gio.DBusCallFlags.NONE, 1000, null, null);
            } catch(e) {}
            return Clutter.EVENT_STOP;
        });

        let progressRow = new St.BoxLayout({ style: 'padding:4px 10px 2px 10px; spacing:6px;' });
        progressRow.add(this._npTimeLeft,  { expand: false });
        progressRow.add(this._npProgress,  { expand: true  });
        progressRow.add(this._npTimeRight, { expand: false });
        this._npCard.add(progressRow);

        // Controls - Updated with cleaner hover effects and semi-transparent play button
        let npCtrl = new St.BoxLayout({ style: 'padding:4px 10px 12px 10px; spacing:0;' });

        // Previous button - clean with hover effect
        this.prevBtn = new St.Button({
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;'
        });
        this.prevBtn.set_child(sym('media-skip-backward-symbolic', 16));
        this.prevBtn.connect('enter-event', () => {
            this.prevBtn.set_style('background: rgba(255,255,255,0.15); border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        this.prevBtn.connect('leave-event', () => {
            this.prevBtn.set_style('background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });

        // Play button - semi-transparent white background with hover effect
        this.playBtn = new St.Button({
            reactive: true,
            style: 'background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;'
        });
        let pIc = sym('media-playback-start-symbolic', 28);
        pIc.set_style('color: white;');
        this.playBtn.set_child(pIc);
        this.playBtn.connect('enter-event', () => {
            this.playBtn.set_style('background-color: rgba(255,255,255,0.35); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
        });
        this.playBtn.connect('leave-event', () => {
            this._resetPlayStyle();
        });

        // Next button - clean with hover effect
        this.nextBtn = new St.Button({
            reactive: true,
            style: 'background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;'
        });
        this.nextBtn.set_child(sym('media-skip-forward-symbolic', 16));
        this.nextBtn.connect('enter-event', () => {
            this.nextBtn.set_style('background: rgba(255,255,255,0.15); border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });
        this.nextBtn.connect('leave-event', () => {
            this.nextBtn.set_style('background: transparent; border: none; border-radius: 24px; padding: 8px; margin: 0; min-width: 40px; min-height: 40px;');
        });

        npCtrl.add(this.prevBtn, { expand: true  });
        npCtrl.add(this.playBtn, { expand: false });
        npCtrl.add(this.nextBtn, { expand: true  });
        this._npCard.add(npCtrl);

        this.shell.add(this._npCard);

        // ── Volume slider ────────────────────────────────────────
        let volCard = new St.BoxLayout({
            vertical: true, style_class: 'gs-slider-card',
            style: 'spacing:6px; padding:10px 14px;'
        });

        // Volume header: icon (clickable mute) + label
        let volHeader = new St.BoxLayout({ style: 'spacing:8px;' });
        this._volIcon = new St.Button({ reactive: true,
            style: 'background:transparent; border:none; border-radius:50%; padding:2px;' });
        this._volIconImg = sym('audio-volume-high-symbolic', 18);
        this._volIcon.set_child(this._volIconImg);
        this._volIcon.connect('clicked', () => {
            _lastMuted = toggleMute();
            this._updateVolIcon();
        });
        volHeader.add(this._volIcon, { expand: false });
        volHeader.add(new St.Label({ text: 'Volume', style_class: 'gs-slider-label', style:'padding-top:2px;' }), { expand: true });
        volCard.add(volHeader);

        this._volSlider = mkCairoSlider(150, 100, v => {
            setVolume(v);
            this._updateVolIcon();
        });
        volCard.add(this._volSlider);
        this.shell.add(volCard);

        section.actor.add(this.shell);
        this.menu.addMenuItem(section);
    }

    _resetPlayStyle() {
        let [r,g,b] = this._npAccent;
        let hasMedia = (this._npTitleText && this._npTitleText !== 'No Media');
        if (hasMedia) {
            // Use accent color from album art with high opacity for the play button
            this.playBtn.set_style(
                'background-color: rgba('+Math.round(r*255)+','+Math.round(g*255)+','+Math.round(b*255)+',0.85);' +
                'border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
        } else {
            // Default semi-transparent white
            this.playBtn.set_style(
                'background-color: rgba(255,255,255,0.2); border: none; border-radius: 28px; padding: 0; margin: 0 12px; min-width: 56px; min-height: 56px;');
        }
    }

    _refreshVolume() {
        let vol = getVolume();
        this._volSlider.setValue(vol);
        let muted = getMuted();
        this._updateVolIcon(vol, muted);
    }

    _updateVolIcon(vol, muted) {
        // If parameters not provided, get them
        if (vol === undefined) vol = getVolume();
        if (muted === undefined) muted = getMuted();
        
        let name = volIconName(vol, muted);
        
        // If volume is over 100% and not muted, use red color
        if (vol > 100 && !muted) {
            // Create a red-colored icon using CSS
            this._volIconImg.icon_name = name;
            this._volIconImg.set_style('color: #ff2222;');
        } else {
            this._volIconImg.icon_name = name;
            // Reset color - let CSS handle it
            this._volIconImg.set_style('');
        }
        
        // Update panel icon too
        this.set_applet_icon_symbolic_name(name);
        
        // Also color the panel icon red if over 100%
        if (vol > 100 && !muted) {
            // Apply red color to panel icon via CSS
            this._applet_icon_box.set_style('color: #ff2222;');
        } else {
            this._applet_icon_box.set_style('');
        }
    }

    _connectSignals() {
        this.prevBtn.connect('clicked', () => this._mediaCommand('Previous'));
        this.playBtn.connect('clicked', () => this._mediaCommand('PlayPause'));
        this.nextBtn.connect('clicked', () => this._mediaCommand('Next'));

        this.signals.connect(this.menu, 'open-state-changed', (_m, open) => {
            if (open) { this._refreshAll(); this._startPolling(); }
            else      { this._stopPolling(); }
        });
    }

    _refreshAll() {
        // Volume - use cached values, don't refresh if menu just opened
        this._refreshVolume();
        // Media
        this._updateMediaInfo();
    }

    _updateMediaInfo() {
        findMprisPlayers(players => {
            if (!players.length) {
                this.activePlayer  = null;
                this._npAppName    = 'NOT PLAYING';
                this._npTitleText  = 'No Media';
                this._npArtistText = '';
                this._npArtUrl     = '';
                this._npPixbuf     = null;
                this._npAccent     = [0.2, 0.5, 1.0];
                this._npPos = 0; this._npLen = 0;
                let pIc = sym('media-playback-start-symbolic', 28);
                pIc.set_style('color:white;');
                this.playBtn.set_child(pIc);
                this._resetPlayStyle();
                // Reset card background
                this._npCard.set_style(
                    'padding:0; spacing:0; border-radius:12px; background-color: transparent;');
                if (this._npArtCanvas) this._npArtCanvas.queue_repaint();
                if (this._npProgress)  this._npProgress.queue_repaint();
                this._updateTimeLabels();
                return;
            }
            let idx = 0;
            const tryNext = () => {
                if (idx >= players.length) {
                    this.activePlayer = players[0];
                    getMprisInfo(players[0], i => { if (i) this._applyInfo(i, false); });
                    return;
                }
                let p = players[idx++];
                getMprisInfo(p, info => {
                    if (info && info.status === 'Playing') { this.activePlayer = p; this._applyInfo(info, true); }
                    else tryNext();
                });
            };
            tryNext();
        });
    }

    _applyInfo(info, playing) {
        // Play icon - keep white color
        let pIc = sym(playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic', 28);
        pIc.set_style('color:white;');
        this.playBtn.set_child(pIc);

        this._npAppName    = info.appName || 'MEDIA';
        this._npTitleText  = info.title   || 'No Title';
        this._npArtistText = info.artist  || '';
        this._npPos        = info.position || 0;
        this._npLen        = info.length   || 0;
        this._npProgress.queue_repaint();
        this._updateTimeLabels();

        let artUrl = info.artUrl || '';
        if (artUrl && artUrl !== this._npArtUrl) {
            this._npArtUrl = artUrl;
            loadArtwork(artUrl, (pix) => {
                this._npPixbuf = pix;
                this._npAccent = pix ? dominantColor(pix) : [0.2, 0.5, 1.0];
                this._npArtCanvas.queue_repaint();
                this._npProgress.queue_repaint();
                this._applyAccent();
            });
        } else if (!artUrl) {
            this._npArtUrl = ''; this._npPixbuf = null; this._npAccent = [0.2, 0.5, 1.0];
            this._npArtCanvas.queue_repaint();
            this._npProgress.queue_repaint();
            this._applyAccent();
        } else {
            this._applyAccent();
        }
    }

    _applyAccent() {
        let [r,g,b] = this._npAccent;
        let pr = Math.round(r*255), pg = Math.round(g*255), pb = Math.round(b*255);
        // Card background matches accent color with opacity for chameleonic effect
        this._npCard.set_style(
            'padding:0; spacing:0; border-radius:12px; ' +
            'background-color: rgba('+pr+','+pg+','+pb+',0.9) !important; ' +
            'border: 1px solid rgba('+pr+','+pg+','+pb+',0.1);');
        // Play button bg = accent color
        this._resetPlayStyle();
    }

    _updateTimeLabels() {
        const fmt = us => {
            let s = Math.floor(us/1e6), m = Math.floor(s/60); s %= 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        };
        if (this._npTimeLeft)  this._npTimeLeft.set_text(fmt(this._npPos));
        if (this._npTimeRight) this._npTimeRight.set_text(fmt(this._npLen));
    }

    _mediaCommand(cmd) {
        if (!this.activePlayer) {
            findMprisPlayers(players => {
                if (players.length) {
                    this.activePlayer = players[0];
                    sendMprisCmd(this.activePlayer, cmd);
                    Mainloop.timeout_add(400, () => { if (this.menu.isOpen) this._updateMediaInfo(); return false; });
                }
            });
            return;
        }
        sendMprisCmd(this.activePlayer, cmd);
        Mainloop.timeout_add(400, () => { if (this.menu.isOpen) this._updateMediaInfo(); return false; });
    }

    _startPolling() {
        if (this.mediaTimer) return;
        this.mediaTimer = Mainloop.timeout_add_seconds(2, () => {
            if (this.menu.isOpen) { this._updateMediaInfo(); return true; }
            return false;
        });
        if (!this._posTimer) {
            this._posTimer = Mainloop.timeout_add_seconds(1, () => {
                if (!this.menu.isOpen) return true;
                if (this._npLen > 0) {
                    this._npPos = Math.min(this._npLen, this._npPos + 1000000);
                    this._npProgress.queue_repaint();
                    this._updateTimeLabels();
                }
                return true;
            });
        }
    }

    _stopPolling() {
        if (this.mediaTimer) { Mainloop.source_remove(this.mediaTimer); this.mediaTimer = null; }
        if (this._posTimer)  { Mainloop.source_remove(this._posTimer);  this._posTimer  = null; }
    }

    // ── Panel click → open/close ────────────────────────────
    on_applet_clicked() {
        if (this.menu.isOpen) this.menu.close(); else this.menu.open();
    }

    // ── Panel scroll → volume ───────────────────────────────
    on_applet_scroll_event(event) {
        let dir = event.get_scroll_direction();
        let cur = _lastVolume; // Use cached value
        
        // If we don't have a cached value, get it
        if (cur === -1) {
            cur = getVolume();
        }
        
        let step = 5; // 5% per tick
        if (dir === Clutter.ScrollDirection.UP)
            cur = Math.min(150, cur + step);
        else if (dir === Clutter.ScrollDirection.DOWN)
            cur = Math.max(0, cur - step);
        else return;
        
        // Set volume (this updates the cache)
        setVolume(cur);
        
        // Update UI immediately with cached values without calling getVolume()
        this._volSlider.setValue(cur);
        let muted = _lastMuted;
        this._updateVolIcon(cur, muted);
        
        // Show OSD-style tooltip briefly
        let volText = Math.round(cur) + '%';
        if (cur > 100) volText += ' ⚠';
        this.set_applet_tooltip('Volume: ' + volText);
        // Reset tooltip after 2 seconds
        if (this._tooltipTimer) {
            Mainloop.source_remove(this._tooltipTimer);
        }
        this._tooltipTimer = Mainloop.timeout_add(2000, () => {
            this.set_applet_tooltip('Sound');
            this._tooltipTimer = null;
            return false;
        });
    }

    on_applet_removed_from_panel() {
        this._stopPolling();
        if (this._tooltipTimer) {
            Mainloop.source_remove(this._tooltipTimer);
            this._tooltipTimer = null;
        }
        if (this.signals)   this.signals.disconnectAllSignals();
        if (this._settings) this._settings.finalize();
        if (this.menu)      this.menu.destroy();
        try { if (this._css) St.ThemeContext.get_for_stage(global.stage).get_theme().unload_stylesheet(this._css); } catch(e) {}
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new SoundApplet(metadata, orientation, panelHeight, instanceId);
}
