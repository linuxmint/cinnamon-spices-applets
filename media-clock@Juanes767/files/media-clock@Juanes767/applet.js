const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gdk = imports.gi.Gdk;

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH   = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const PROPS_IFACE  = 'org.freedesktop.DBus.Properties';
const DBUS_IFACE   = 'org.freedesktop.DBus';

const VOLUME_MAX   = 1.5;   // 150% máximo

class MediaClockApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.actor.reactive = true;
        this.actor.track_hover = true;

        this._label = new St.Label({
            text: '',
            reactive: false,
            style_class: 'applet-label'
        });
        this.actor.add_actor(this._label);

        this._players = {};
        this._activePlayer = null;
        this._duration = 0;
        this._lastArtUrl = null;
        this._posPollId = null;
        this._clockId = null;
        this._lastUserSeek = 0;
        this._lastUserVol = 0;
        this._volume = 0.5;
        this._muted = false;
        this._preMuteVolume = 0.5;

        this._modalGrab = null;
        this._outsideClickId = null;
        this._keyPressId = null;
        this._autoCloseId = null;

        this._lastCloseTime = 0;
        this._lastReposition = 0;
        this._lastLabelText = '';
        this._lastTitleText = '';
        this._lastArtistText = '';

        this._cacheDir = GLib.get_user_cache_dir() + '/media-clock';
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._buildPopup();
        this._setupDBus();

        this._updateClock();
        this._clockId = Mainloop.timeout_add_seconds(1, () => {
            this._updateClock();
            return true;
        });
    }

    _updateClock() {
        let n = new Date();
        let h = n.getHours();
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        let m  = ('0' + n.getMinutes()).slice(-2);
        let d  = ('0' + n.getDate()).slice(-2);
        let mo = ('0' + (n.getMonth() + 1)).slice(-2);
        let text = h + ':' + m + ' ' + ampm + '   ' + d + '/' + mo;
        if (text !== this._lastLabelText) {
            this._lastLabelText = text;
            this._label.set_text(text);
        }
    }

    _buildPopup() {
        this._popup = new St.BoxLayout({
            vertical: false,
            style_class: 'di-pill',
            reactive: true,
            track_hover: true
        });
        this._popup.hide();
        Main.uiGroup.add_actor(this._popup);

        this._artBin = new St.Bin({ style_class: 'di-art', y_align: St.Align.MIDDLE });
        this._artBin.set_size(64, 64);
        this._popup.add(this._artBin, { y_align: St.Align.MIDDLE, y_fill: false });

        let center = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'di-center'
        });

        this._titleLabel = new St.Label({ text: 'Sin reproduccion', style_class: 'di-title' });
        center.add(this._titleLabel, { x_fill: true });

        this._artistLabel = new St.Label({ text: '', style_class: 'di-artist' });
        center.add(this._artistLabel, { x_fill: true });

        let progRow = new St.BoxLayout({ vertical: false, style_class: 'di-progress-row' });
        this._posLabel = new St.Label({ text: '0:00', style_class: 'di-time' });
        this._durLabel = new St.Label({ text: '0:00', style_class: 'di-time' });
        this._progressSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._progressSlider.actor.add_style_class_name('di-progress-slider');
        this._progressSlider.connect('drag-end', () => {
            this._lastUserSeek = Date.now();
            this._seekToFraction(this._progressSlider.value);
        });
        progRow.add(this._posLabel);
        progRow.add(this._progressSlider.actor, { x_expand: true, x_fill: true });
        progRow.add(this._durLabel);
        center.add(progRow, { x_fill: true });

        // ---- Fila de volumen ----
        let volRow = new St.BoxLayout({ vertical: false, style_class: 'di-volume-row' });
        this._volIcon = new St.Icon({
            icon_name: 'audio-volume-high-symbolic',
            icon_size: 14,
            style_class: 'di-vol-icon'
        });
        this._volIconBtn = new St.Button({ style_class: 'di-vol-btn' });
        this._volIconBtn.set_child(this._volIcon);
        this._volIconBtn.connect('clicked', () => this._toggleSystemMute());

        this._volumeSlider = new PopupMenu.PopupSliderMenuItem(0.5);
        this._volumeSlider.actor.add_style_class_name('di-volume-slider');
        this._volumeSlider.connect('drag-end', () => {
            this._lastUserVol = Date.now();
            this._setSystemVolume(this._volumeSlider.value);
        });

        this._volLabel = new St.Label({ text: '75%', style_class: 'di-vol-label' });

        volRow.add(this._volIconBtn);
        volRow.add(this._volumeSlider.actor, { x_expand: true, x_fill: true });
        volRow.add(this._volLabel);
        center.add(volRow, { x_fill: true });

        this._popup.add(center, { x_expand: true, x_fill: true, y_align: St.Align.MIDDLE });

        let ctrl = new St.BoxLayout({
            vertical: false,
            style_class: 'di-controls',
            y_align: St.Align.MIDDLE
        });

        this._prevBtn = new St.Button({ style_class: 'di-btn' });
        this._prevBtn.set_child(new St.Icon({ icon_name: 'media-skip-backward-symbolic', icon_size: 16 }));
        this._prevBtn.connect('clicked', () => this._sendCommand('Previous'));

        this._playIcon = new St.Icon({ icon_name: 'media-playback-start-symbolic', icon_size: 20 });
        this._playBtn = new St.Button({ style_class: 'di-btn-main' });
        this._playBtn.set_child(this._playIcon);
        this._playBtn.connect('clicked', () => this._onPlayClicked());

        this._nextBtn = new St.Button({ style_class: 'di-btn' });
        this._nextBtn.set_child(new St.Icon({ icon_name: 'media-skip-forward-symbolic', icon_size: 16 }));
        this._nextBtn.connect('clicked', () => this._sendCommand('Next'));

        ctrl.add(this._prevBtn);
        ctrl.add(this._playBtn);
        ctrl.add(this._nextBtn);

        this._popup.add(ctrl, { y_align: St.Align.MIDDLE, y_fill: false });

        // Leer volumen del sistema al inicio
        this._refreshSystemVolume();
    }

    _showPopup(skipAnim) {
        // === LIMPIEZA TOTAL antes de abrir ===
        // Esto evita que quede un modal colgado de la vez anterior
        if (this._autoCloseId) {
            Mainloop.source_remove(this._autoCloseId);
            this._autoCloseId = null;
        }
        if (this._outsideClickId) {
            try { global.stage.disconnect(this._outsideClickId); } catch (e) {}
            this._outsideClickId = null;
        }
        if (this._keyPressId) {
            try { global.stage.disconnect(this._keyPressId); } catch (e) {}
            this._keyPressId = null;
        }
        if (this._modalGrab) {
            try { Main.popModal(this._modalGrab); } catch (e) {}
            this._modalGrab = null;
        }

        // Estado inicial (queda invisible hasta que arranque la animación)
        this._popup.set_opacity(0);
        this._popup.set_scale(0.95, 0.95);
        this._popup.set_translation(0, 0, 0);
        this._popup.show();

        // Push modal
        try {
            this._modalGrab = Main.pushModal(this._popup);
        } catch (e) {
            this._modalGrab = null;
        }

        // Listener clic fuera
        this._outsideClickId = global.stage.connect('button-press-event', (actor, event) => {
            if (!this._popup.visible) return false;
            let [x, y] = event.get_coords();

            let [px, py] = this._popup.get_transformed_position();
            let pw = this._popup.width;
            let ph = this._popup.height;
            let insidePopup = x >= px && x <= px + pw && y >= py && y <= py + ph;
            if (insidePopup) {
                this._resetAutoClose();
                return false;
            }

            let [ax, ay] = this.actor.get_transformed_position();
            let aw = this.actor.width;
            let ah = this.actor.height;
            let insideApplet = x >= ax && x <= ax + aw && y >= ay && y <= ay + ah;

            this._hidePopup();
            return insideApplet;
        });

        // Listener Esc
        this._keyPressId = global.stage.connect('key-press-event', (actor, event) => {
            if (!this._popup.visible) return false;
            this._resetAutoClose();
            let sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Escape) {
                this._hidePopup();
                return true;
            }
            return false;
        });

        // Auto-cerrar
        this._resetAutoClose();

        // Posicionar
        let [, natW] = this._popup.get_preferred_width(-1);
        let [, natH] = this._popup.get_preferred_height(natW);

        let [appX, appY] = this.actor.get_transformed_position();
        let appW = this.actor.width;
        let appH = this.actor.height;

        let monitor = Main.layoutManager.primaryMonitor;
        let x = Math.round(appX + (appW - natW) / 2);

        let panelY = Main.panel.actor.get_transformed_position()[1];
        let panelAtTop = panelY < monitor.height / 2;

        let y;
        if (panelAtTop) {
            y = Math.round(appY + appH + 8);
        } else {
            y = Math.round(appY - natH - 8);
        }

        if (x < monitor.x + 8) x = monitor.x + 8;
        if (x + natW > monitor.x + monitor.width - 8) x = monitor.x + monitor.width - natW - 8;
        if (y < monitor.y + 8) y = monitor.y + 8;
        if (y + natH > monitor.y + monitor.height - 8) y = monitor.y + monitor.height - natH - 8;

        this._popup.set_position(x, y);

        // Animar solo la primera vez (no en reposicionamientos)
        if (!skipAnim) {
            this._animateIn(panelAtTop);
        } else {
            // Si es reposicionamiento, mostrar sin animar
            this._popup.set_opacity(255);
            this._popup.set_scale(1.0, 1.0);
        }

        this._startPosPolling();
    }

    _resetAutoClose() {
        if (this._autoCloseId) {
            Mainloop.source_remove(this._autoCloseId);
        }
        this._autoCloseId = Mainloop.timeout_add(8000, () => {
            this._autoCloseId = null;
            if (this._popup.visible) {
                this._hidePopup();
            }
            return false;
        });
    }

    _animateIn(panelAtTop) {
        // Pivote horizontal centrado
        this._popup.set_pivot_point(0.5, 0.5);

        // Dirección del slide según dónde esté el panel:
        // - Panel arriba  → isla nace del borde superior, se desliza HACIA ABAJO (offset -Y → 0)
        // - Panel abajo   → isla nace del borde inferior, se desliza HACIA ARRIBA (offset +Y → 0)
        let offset = panelAtTop ? -20 : 20;

        // Estado inicial: desplazada hacia el reloj, transparente, un pelín más chica
        this._popup.set_translation(0, offset, 0);
        this._popup.set_scale(0.95, 0.95);
        this._popup.set_opacity(0);

        // Animación: slide hasta posición final + fade + scale
        this._popup.ease({
            translation_y: 0,
            translation_x: 0,
            translation_z: 0,
            scale_x: 1.0,
            scale_y: 1.0,
            opacity: 255,
            duration: 220,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC
        });
    }

    _animateOut(callback) {
        // Averiguar dirección del panel
        let monitor = Main.layoutManager.primaryMonitor;
        let panelY = Main.panel.actor.get_transformed_position()[1];
        let panelAtTop = panelY < monitor.height / 2;
        let offset = panelAtTop ? -20 : 20;

        // Animación: deslizarse hacia el reloj + fade + scale
        this._popup.ease({
            translation_y: offset,
            scale_x: 0.95,
            scale_y: 0.95,
            opacity: 0,
            duration: 160,
            mode: Clutter.AnimationMode.EASE_IN_CUBIC,
            onComplete: () => {
                // Resetear transformaciones para la próxima apertura
                this._popup.set_translation(0, 0, 0);
                this._popup.set_scale(1.0, 1.0);
                this._popup.set_opacity(255);
                if (callback) callback();
            }
        });
    }

    _hidePopup() {
        if (!this._popup.visible) return;
        this._lastCloseTime = Date.now();

        // Parar polling y desconectar listeners YA
        this._stopPosPolling();
        if (this._autoCloseId) {
            Mainloop.source_remove(this._autoCloseId);
            this._autoCloseId = null;
        }
        if (this._outsideClickId) {
            try { global.stage.disconnect(this._outsideClickId); } catch (e) {}
            this._outsideClickId = null;
        }
        if (this._keyPressId) {
            try { global.stage.disconnect(this._keyPressId); } catch (e) {}
            this._keyPressId = null;
        }
        if (this._modalGrab) {
            try { Main.popModal(this._modalGrab); } catch (e) {}
            this._modalGrab = null;
        }

        // Animación de cierre y luego hide real
        this._animateOut(() => {
            this._popup.hide();
            this._popup.set_scale(1.0, 1.0);
            this._popup.set_opacity(255);
        });
    }

    _onPlayClicked() {
        try {
            let p = this._activePlayer ? this._players[this._activePlayer] : null;
            if (p) {
                let wasPlaying = p.status === 'Playing';
                this._playIcon.set_icon_name(wasPlaying
                    ? 'media-playback-start-symbolic'
                    : 'media-playback-pause-symbolic');
            }
        } catch (e) {
            global.logError('MEDIA-CLOCK _onPlayClicked: ' + e);
        }
        this._sendCommand('PlayPause');
    }

    // ============================================================
    // VOLUMEN DEL SISTEMA (wpctl) - permite hasta 150%
    // ============================================================

    _getSystemVolume(callback) {
        try {
            let proc = Gio.Subprocess.new(
                ['wpctl', 'get-volume', '@DEFAULT_AUDIO_SINK@'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    let [, stdout] = p.communicate_utf8_finish(res);
                    let match = stdout.match(/Volume:\s+([\d.]+)/);
                    if (match) {
                        let vol = parseFloat(match[1]);
                        let muted = stdout.indexOf('[MUTED]') >= 0;
                        callback(vol, muted);
                    } else {
                        callback(null, null);
                    }
                } catch (e) {
                    callback(null, null);
                }
            });
        } catch (e) {
            callback(null, null);
        }
    }

    _setSystemVolume(sliderValue) {
        // sliderValue: 0-1 → volumen real 0-VOLUME_MAX (0-150%)
        let target = sliderValue * VOLUME_MAX;
        if (target < 0) target = 0;
        if (target > VOLUME_MAX) target = VOLUME_MAX;
        try {
            Gio.Subprocess.new(
                ['wpctl', 'set-volume', '@DEFAULT_AUDIO_SINK@', target.toFixed(3)],
                Gio.SubprocessFlags.NONE
            );
        } catch (e) {
            global.logError('MediaClock setVolume: ' + e);
        }
        this._volume = target;
        this._updateVolLabel(target);
        this._updateVolIcon();
    }

    _toggleSystemMute() {
        try {
            Gio.Subprocess.new(
                ['wpctl', 'set-mute', '@DEFAULT_AUDIO_SINK@', 'toggle'],
                Gio.SubprocessFlags.NONE
            );
        } catch (e) {
            global.logError('MediaClock mute: ' + e);
        }
        Mainloop.timeout_add(150, () => {
            this._refreshSystemVolume(true);
            return false;
        });
    }

    _refreshSystemVolume(force) {
        if (this._volumeSlider && this._volumeSlider._dragging) return;
        if (!force && Date.now() - this._lastUserVol < 800) return;

        this._getSystemVolume((vol, muted) => {
            if (vol === null) return;
            this._volume = vol;
            this._muted = muted;

            // Convertir volumen real (0-1.5) a valor de slider (0-1)
            let sliderVal = Math.min(1, vol / VOLUME_MAX);
            if (this._volumeSlider) this._volumeSlider.setValue(sliderVal);

            this._updateVolLabel(vol);
            this._updateVolIcon();
        });
    }

    _updateVolLabel(vol) {
        let pct = Math.round(vol * 100);
        if (this._volLabel) {
            this._volLabel.set_text(pct + '%');
            if (vol > 1.005) {
                this._volLabel.add_style_class_name('di-vol-label-boost');
            } else {
                this._volLabel.remove_style_class_name('di-vol-label-boost');
            }
        }
    }

    _updateVolIcon() {
        let name;
        if (this._muted || this._volume <= 0.01) name = 'audio-volume-muted-symbolic';
        else if (this._volume < 0.33) name = 'audio-volume-low-symbolic';
        else if (this._volume < 0.66) name = 'audio-volume-medium-symbolic';
        else name = 'audio-volume-high-symbolic';
        this._volIcon.set_icon_name(name);
    }

    // ============================================================
    // MPRIS
    // ============================================================

    _setupDBus() {
        this._dbus = Gio.DBus.session;

        this._dbus.signal_subscribe(
            DBUS_IFACE, DBUS_IFACE, 'NameOwnerChanged',
            '/org/freedesktop/DBus', null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => {
                let [name, oldOwner, newOwner] = params.deep_unpack();
                if (!name.startsWith(MPRIS_PREFIX)) return;
                if (newOwner && !oldOwner)      this._addPlayer(name);
                else if (!newOwner && oldOwner) this._removePlayer(name);
            }
        );

        this._dbus.call(
            DBUS_IFACE, '/org/freedesktop/DBus', DBUS_IFACE, 'ListNames',
            null, null, Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    let reply = conn.call_finish(res);
                    let [names] = reply.deep_unpack();
                    names.forEach(n => { if (n.startsWith(MPRIS_PREFIX)) this._addPlayer(n); });
                } catch (e) { global.logError('MediaClock ListNames: ' + e); }
            }
        );
    }

    _addPlayer(busName) {
        if (this._players[busName]) return;
        this._players[busName] = {
            status: 'Stopped', metadata: {}, position: 0,
            lastActive: 0, _fetchedAt: 0
        };

        this._dbus.signal_subscribe(
            busName, PROPS_IFACE, 'PropertiesChanged', MPRIS_PATH, null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => {
                let [ifaceName, changed] = params.deep_unpack();
                if (ifaceName === PLAYER_IFACE) this._onPropsChanged(busName, changed);
            }
        );

        this._getPlayerProps(busName, () => {
            this._selectActivePlayer();
            this._refreshUI();
        });
    }

    _removePlayer(busName) {
        delete this._players[busName];
        if (this._activePlayer === busName) {
            this._activePlayer = null;
            this._selectActivePlayer();
            this._refreshUI();
        }
    }

    _getPlayerProps(busName, cb) {
        this._dbus.call(
            busName, MPRIS_PATH, PROPS_IFACE, 'GetAll',
            new GLib.Variant('(s)', [PLAYER_IFACE]),
            null, Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    let reply = conn.call_finish(res);
                    let [props] = reply.deep_unpack();
                    let p = this._players[busName];
                    if (!p) return;
                    if (props['PlaybackStatus']) p.status = props['PlaybackStatus'].deep_unpack();
                    if (props['Metadata'])       p.metadata = props['Metadata'].deep_unpack();
                    if (props['Position'])       p.position = props['Position'].deep_unpack() / 1e6;
                    if (p.status === 'Playing')  p.lastActive = Date.now();
                    if (cb) cb();
                } catch (e) { global.logError('MediaClock GetAll: ' + e); }
            }
        );
    }

    _onPropsChanged(busName, changed) {
        let p = this._players[busName];
        if (!p) return;
        if (changed['PlaybackStatus']) p.status = changed['PlaybackStatus'].deep_unpack();
        if (changed['Metadata'])       p.metadata = changed['Metadata'].deep_unpack();
        if (p.status === 'Playing') p.lastActive = Date.now();

        this._selectActivePlayer();
        this._refreshUI();
    }

    _selectActivePlayer() {
        let best = null, bestScore = -1;
        for (let name in this._players) {
            let p = this._players[name];
            let score = 0;
            if (p.status === 'Playing')     score = 1e15 + (p.lastActive || 0);
            else if (p.status === 'Paused') score = (p.lastActive || 0);
            if (score > bestScore) { bestScore = score; best = name; }
        }
        this._activePlayer = best;
    }

    _refreshUI() {
        let p = this._activePlayer ? this._players[this._activePlayer] : null;
        let md = p && p.metadata;

        if (!p || !md || !md['xesam:title']) {
            if (this._lastTitleText !== 'Sin reproduccion') {
                this._lastTitleText = 'Sin reproduccion';
                this._titleLabel.set_text('Sin reproduccion');
            }
            if (this._lastArtistText !== '') {
                this._lastArtistText = '';
                this._artistLabel.set_text('');
            }
            this._artBin.set_child(null);
            this._lastArtUrl = null;
            this._playIcon.set_icon_name('media-playback-start-symbolic');
            this._posLabel.set_text('0:00');
            this._durLabel.set_text('0:00');
            this._duration = 0;
            this._progressSlider.setValue(0);
            return;
        }

        let title  = md['xesam:title'] ? md['xesam:title'].deep_unpack() : '';
        let artist = '';
        if (md['xesam:artist']) {
            let a = md['xesam:artist'].deep_unpack();
            artist = Array.isArray(a) ? a.join(', ') : String(a);
        }
        let length = md['mpris:length'] ? md['mpris:length'].deep_unpack() / 1e6 : 0;
        let artUrl = md['mpris:artUrl'] ? md['mpris:artUrl'].deep_unpack() : null;

        if (title !== this._lastTitleText) {
            this._lastTitleText = title;
            this._titleLabel.set_text(title);
        }
        if (artist !== this._lastArtistText) {
            this._lastArtistText = artist;
            this._artistLabel.set_text(artist);
        }
        this._duration = length;
        this._durLabel.set_text(this._fmtTime(length));

        let iconName = (p.status === 'Playing')
            ? 'media-playback-pause-symbolic'
            : 'media-playback-start-symbolic';
        this._playIcon.set_icon_name(iconName);

        if (artUrl !== this._lastArtUrl) {
            this._lastArtUrl = artUrl;
            this._loadArt(artUrl);
        }

        this._updatePosition();

        if (this._popup.visible && Date.now() - this._lastReposition > 300) {
            this._lastReposition = Date.now();
            Mainloop.idle_add(() => {
                if (this._popup.visible) this._showPopup(true);
                return false;
            });
        }
    }

    _loadArt(artUrl) {
        if (!artUrl) {
            this._artBin.set_child(null);
            return;
        }
        try {
            let srcFile = Gio.File.new_for_uri(artUrl);
            let tmpPath = this._cacheDir + '/current-art.jpg';

            srcFile.load_contents_async(null, (f, res) => {
                try {
                    let [ok, contents] = f.load_contents_finish(res);
                    if (!ok || !contents || contents.length === 0) return;
                    GLib.file_set_contents(tmpPath, contents);

                    let pixbuf;
                    try {
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(tmpPath, 64, 64, true);
                    } catch (e) {
                        global.logError('MediaClock pixbuf: ' + e);
                        return;
                    }

                    let area = new St.DrawingArea({ width: 64, height: 64 });
                    area.connect('repaint', (a) => {
                        let cr = a.get_context();
                        let [w, h] = a.get_surface_size();
                        let radius = 10;

                        cr.moveTo(radius, 0);
                        cr.lineTo(w - radius, 0);
                        cr.arc(w - radius, radius, radius, -Math.PI/2, 0);
                        cr.lineTo(w, h - radius);
                        cr.arc(w - radius, h - radius, radius, 0, Math.PI/2);
                        cr.lineTo(radius, h);
                        cr.arc(radius, h - radius, radius, Math.PI/2, Math.PI);
                        cr.lineTo(0, radius);
                        cr.arc(radius, radius, radius, Math.PI, 3*Math.PI/2);
                        cr.closePath();
                        cr.clip();

                        Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
                        cr.paint();
                    });
                    area.queue_repaint();
                    this._artBin.set_child(area);
                } catch (e) {
                    global.logError('MediaClock art: ' + e);
                }
            });
        } catch (e) {
            global.logError('MediaClock loadArt: ' + e);
        }
    }

    _updatePosition() {
        if (this._progressSlider && this._progressSlider._dragging) return;
        if (Date.now() - this._lastUserSeek < 1200) return;
        let p = this._activePlayer ? this._players[this._activePlayer] : null;
        if (!p) return;

        let pos = p.position;
        if (p.status === 'Playing' && p._fetchedAt) {
            pos += (Date.now() - p._fetchedAt) / 1000;
            if (this._duration && pos > this._duration) pos = this._duration;
        }
        this._posLabel.set_text(this._fmtTime(pos));
        if (this._duration > 0) this._progressSlider.setValue(Math.min(1, pos / this._duration));
    }

    _startPosPolling() {
        if (this._posPollId) return;
        if (this._activePlayer) this._fetchPosition(this._activePlayer);
        this._refreshSystemVolume();
        this._posPollId = Mainloop.timeout_add(1000, () => {
            if (this._activePlayer) this._fetchPosition(this._activePlayer);
            this._refreshSystemVolume();
            return true;
        });
    }

    _stopPosPolling() {
        if (this._posPollId) {
            Mainloop.source_remove(this._posPollId);
            this._posPollId = null;
        }
    }

    _fetchPosition(busName) {
        this._dbus.call(
            busName, MPRIS_PATH, PROPS_IFACE, 'Get',
            new GLib.Variant('(ss)', [PLAYER_IFACE, 'Position']),
            null, Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    let reply = conn.call_finish(res);
                    let [v] = reply.deep_unpack();
                    let p = this._players[busName];
                    if (p) {
                        p.position = v.deep_unpack() / 1e6;
                        p._fetchedAt = Date.now();
                        this._updatePosition();
                    }
                } catch (e) { }
            }
        );
    }

    _sendCommand(cmd) {
        if (!this._activePlayer) return;
        this._dbus.call(
            this._activePlayer, MPRIS_PATH, PLAYER_IFACE, cmd,
            null, null, Gio.DBusCallFlags.NONE, -1, null, null
        );
    }

    _seekToFraction(frac) {
        if (!this._activePlayer || !this._duration) return;
        let targetUs = Math.floor(frac * this._duration * 1e6);
        this._dbus.call(
            this._activePlayer, MPRIS_PATH, PLAYER_IFACE, 'SetPosition',
            new GLib.Variant('(ox)', ['/org/mpris/MediaPlayer2/TrackList/NoTrack', targetUs]),
            null, Gio.DBusCallFlags.NONE, -1, null, null
        );
        let p = this._players[this._activePlayer];
        if (p) {
            p.position = targetUs / 1e6;
            p._fetchedAt = Date.now();
        }
    }

    _fmtTime(s) {
        if (!s || s < 0 || isNaN(s)) return '0:00';
        s = Math.floor(s);
        let m = Math.floor(s / 60), h = Math.floor(m / 60);
        if (h > 0) return h + ':' + ('0' + (m % 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
        return m + ':' + ('0' + (s % 60)).slice(-2);
    }

    on_applet_clicked(event) {
        if (Date.now() - this._lastCloseTime < 100) return true;
        if (this._popup.visible) this._hidePopup();
        else this._showPopup();
        return true;
    }

    on_applet_removed_from_panel() {
        if (this._clockId) Mainloop.source_remove(this._clockId);
        if (this._autoCloseId) {
            Mainloop.source_remove(this._autoCloseId);
            this._autoCloseId = null;
        }
        if (this._outsideClickId) {
            try { global.stage.disconnect(this._outsideClickId); } catch (e) {}
            this._outsideClickId = null;
        }
        if (this._keyPressId) {
            try { global.stage.disconnect(this._keyPressId); } catch (e) {}
            this._keyPressId = null;
        }
        if (this._modalGrab) {
            try { Main.popModal(this._modalGrab); } catch (e) {}
            this._modalGrab = null;
        }
        this._stopPosPolling();
        if (this._popup) {
            Main.uiGroup.remove_actor(this._popup);
            this._popup.destroy();
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MediaClockApplet(metadata, orientation, panelHeight, instanceId);
}
