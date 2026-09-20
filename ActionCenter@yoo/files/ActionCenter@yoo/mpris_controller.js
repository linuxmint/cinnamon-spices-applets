const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const ByteArray = imports.byteArray;
const C = require('./constants');
const { UUID, _, MPRIS_CONTENT_WIDTH, CHOOSER_CONTENT_WIDTH, PLAYER_CONTENT_WIDTH } = C;
const { MPRIS_STATE_FILE: STATE_FILE, MPRIS_CMD_FILE: CMD_FILE, CACHE_DIR } = C;
// 与 scripts/_config.py DAEMON_VERSION 对齐，改 daemon 逻辑时两边一起 +1
const EXPECTED_DAEMON_VERSION = 2;

function MprisController(applet) {
    this._applet = applet;
    // 状态来源：daemon 写的 players.json，本模块只读不写 D-Bus；
    // 控制走 CMD_FILE 下发，daemon 侧执行。
    this._players = [];
    this._activeIdx = 0;
    this._pollId = 0;
    this._daemonStarted = false;
    this._lastListSig = '';
    this._scriptPath = applet._appletMetadata.path + "/scripts/mpris_monitor.py";

    this._chooserBox = null;
    this._chooserBtns = [];
    this._playerWrapper = null;
    this._playerContainer = null;
    this._titleLabel = null;
    this._artistLabel = null;
    this._playBtn = null;
    this._playBtnIcon = null;
    this._seeker = null;
    this._curTimeLabel = null;
    this._totalTimeLabel = null;
    this._coverIcon = null;
    this._lastCoverPath = '';
    this._coverVersion = 0;
}

MprisController.prototype = {
    _isDaemonRunning: function() {
        try {
            // 注意：pidof -x 匹配不上 python 脚本进程，必须用 pgrep -f 匹配完整命令行
            // spawn_command_line_sync 返回 [ok, stdout, stderr, exitStatus]
            // GLib 直接 exec（无 shell 包装），pgrep 不会自匹配
            let r = GLib.spawn_command_line_sync("pgrep -f mpris_monitor.py");
            let out = (r[1] || "").toString().trim();
            return out.length > 0;
        } catch(e) {
            return false;
        }
    },

    // 驻留 daemon 的版本号（0=未知/旧版）；与 scripts/_config.py DAEMON_VERSION 对齐
    _daemonVersion: function() {
        try {
            let file = Gio.File.new_for_path(CACHE_DIR + "/daemon.version");
            if (!file.query_exists(null)) return 0;
            let [ok, content] = file.load_contents(null);
            if (!ok || !content) return 0;
            return parseInt(ByteArray.toString(content).trim()) || 0;
        } catch(e) {
            return 0;
        }
    },

    _ensureDaemon: function() {
        try {
            let running = this._isDaemonRunning();
            // 版本过时也重拉：Cinnamon 重启不杀旧 daemon，否则旧代码永久驻留
            if (running && this._daemonVersion() !== EXPECTED_DAEMON_VERSION) {
                global.log("QS daemon: outdated, restarting");
                try { GLib.spawn_command_line_sync("pkill -f mpris_monitor.py"); } catch(e) {}
                running = false;
            }
            if (!running) {
                Util.spawnCommandLineAsync("python3 " + this._scriptPath);
                global.log("QS daemon: spawned");
            }
            this._daemonStarted = true;
        } catch(e) {
            global.logError("QS daemon start: " + e);
        }
    },

    init: function() {
        this._ensureDaemon();

        this._pollId = Mainloop.timeout_add(1000, () => {
            this._poll();
            return true;
        });
        this._poll();
    },

    _poll: function() {
        try {
            let file = Gio.File.new_for_path(STATE_FILE);
            if (!file.query_exists(null)) {
                this._ensureDaemon();
                return;
            }
            // 状态文件过期（daemon 已死）→ 清空播放器（隐藏模块）并尝试拉起 daemon
            // 避免一直显示冻结的缓存信息
            try {
                let info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
                let mtime = info.get_modification_date_time().to_unix();
                let now = GLib.get_real_time() / 1000000;
                if (now - mtime > 6) {
                    this._ensureDaemon();
                    if (this._players.length !== 0) {
                        this._players = [];
                        this._lastListSig = '';
                        this._applet._updateMprisUI();
                    }
                    return;
                }
            } catch(e) {}
            let [ok, content] = file.load_contents(null);
            if (!ok || !content) return;
            let text = ByteArray.toString(content);
            let players = JSON.parse(text);

            let listSig = players.map(function(p) { return p.owner + '|' + p.identity; }).join('\n');
            if (listSig !== this._lastListSig) {
                // 防抖：切歌瞬间播放器可能短暂掉线/重注册，立即重建会导致 UI 来回跳
                // 等 1.5s 后重读文件，信号稳定了才真正重建
                this._pendingSig = listSig;
                this._pendingRearms = this._pendingRearms || 0;
                if (!this._listChangeTimer) {
                    this._pendingRearms = 0;
                    let self = this;
                    this._listChangeTimer = Mainloop.timeout_add(1500, function() {
                        self._listChangeTimer = 0;
                        self._commitPendingList();
                        return false;
                    });
                }
                // 防抖期间仍用旧列表做原地更新，避免画面冻结
                this._updateInPlace();
                return;
            }
            // 列表稳定：清掉未触发的防抖状态
            this._pendingSig = null;
            this._pendingRearms = 0;

            this._players = players;
            this._updateInPlace();
        } catch(e) {
            global.logError("QS _poll: " + e);
        }
    },

    _commitPendingList: function() {
        try {
            let file = Gio.File.new_for_path(STATE_FILE);
            if (!file.query_exists(null)) return;
            let [ok, content] = file.load_contents(null);
            if (!ok || !content) return;
            let players = JSON.parse(ByteArray.toString(content));
            let listSig = players.map(function(p) { return p.owner + '|' + p.identity; }).join('\n');
            if (listSig !== this._pendingSig && this._pendingRearms < 4) {
                // 仍在抖动：用最新信号重新防抖（最多延长 4 次，避免无限拖延）
                this._pendingRearms++;
                this._pendingSig = listSig;
                let self = this;
                this._listChangeTimer = Mainloop.timeout_add(1500, function() {
                    self._listChangeTimer = 0;
                    self._commitPendingList();
                    return false;
                });
                return;
            }
            this._pendingSig = null;
            this._pendingRearms = 0;
            if (listSig === this._lastListSig) return; // 抖完又回来了，无需重建
            this._lastListSig = listSig;
            this._players = players;
            if (this._activeIdx >= this._players.length) {
                this._activeIdx = Math.max(0, this._players.length - 1);
            }
            this._applet._updateMprisUI();
        } catch(e) {
            global.logError("QS _commitPendingList: " + e);
        }
    },

    _updateInPlace: function() {
        // 自动跟随：开启时，若当前播放器没在播、而有别的在播，切过去
        if (this._autoSwitchToPlaying()) return;

        let p = this._players[this._activeIdx];
        if (!p) return;

        if (this._titleLabel) this._titleLabel.set_text(p.title || _("No media"));
        if (this._artistLabel) this._artistLabel.set_text(p.artist || "");

        if (this._playBtnIcon) {
            let icon = p.status === 'Playing' ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
            this._playBtnIcon.set_icon_name(icon);
        }

        if (this._seeker && p.length > 0 && !this._seeker._userDrag) {
            try { this._seeker.setValue(p.position / p.length); } catch(e) {}
        }

        if (this._curTimeLabel) this._curTimeLabel.set_text(this._formatTime(p.position));
        if (this._totalTimeLabel) this._totalTimeLabel.set_text(this._formatTime(p.length));

        if (this._coverBin && p.coverPath && p.coverPath !== this._lastCoverPath) {
            this._lastCoverPath = p.coverPath;
            this._refreshCover(p.coverPath);
        }

        this._updateChooserActive();
    },

    // player-auto-switch：返回 true 表示发生了切换（调用方直接 return，下一轮 poll 更新新播放器）
    _autoSwitchToPlaying: function() {
        try {
            let s = this._applet._settings;
            if (!s || !s.getValue('player-auto-switch')) return false;
            if (this._players.length < 2) return false;
            let cur = this._players[this._activeIdx];
            if (cur && cur.status === 'Playing') return false;
            for (let i = 0; i < this._players.length; i++) {
                if (this._players[i].status === 'Playing') {
                    this._activeIdx = i;
                    this._rebuildPlayerOnly();
                    this._updateChooserActive();
                    return true;
                }
            }
        } catch(e) {}
        return false;
    },

    _refreshCover: function(path) {
        if (!this._coverBin) return;
        if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) {
            try {
                let cache = St.TextureCache.get_default();
                this._coverVersion = (this._coverVersion || 0) + 1;
                let myVersion = this._coverVersion;
                let self = this;
                cache.load_image_from_file_async(path, 70, 70, function(c, handle, actor) {
                    if (myVersion !== self._coverVersion) return;
                    if (!self._coverBin) return;
                    let children = self._coverBin.get_children();
                    for (let i = 0; i < children.length; i++) {
                        self._coverBin.remove_actor(children[i]);
                    }
                    if (actor) {
                        actor.set_size(70, 70);
                        self._coverBin.add_actor(actor);
                    }
                });
            } catch(e) {}
        } else {
            let children = this._coverBin.get_children();
            for (let i = 0; i < children.length; i++) {
                this._coverBin.remove_actor(children[i]);
            }
            this._coverBin.add_actor(this._coverIcon);
        }
    },

    _buildChooserBox: function() {
        let w = CHOOSER_CONTENT_WIDTH;
        this._chooserBox = new St.BoxLayout({
            vertical: true,
            style: 'margin: 2px 6px; width: ' + w + 'px; max-width: ' + w + 'px;'
        });
        this._optionsBox = null;
        this._expanded = false;
        this._chooserBtns = [];
        return this._chooserBox;
    },

    _collapseChooser: function() {
        if (this._expanded && this._optionsBox) {
            this._expanded = false;
            this._optionsBox.hide();
            if (this._arrowIcon) this._arrowIcon.set_icon_name('pan-down-symbolic');
        }
    },

    _refreshChooser: function() {
        if (!this._chooserBox) return;
        this._chooserBox.destroy_all_children();
        this._chooserBtns = [];
        this._optionsBox = null;

        if (this._players.length <= 1) {
            this._chooserBox.hide();
            return;
        }
        this._chooserBox.show();

        let activePlayer = this._players[this._activeIdx];
        let cw = CHOOSER_CONTENT_WIDTH;

        this._headerRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 6px; padding: 8px 12px; border-radius: 10px; background-color: rgba(255,255,255,0.08); width: ' + cw + 'px; max-width: ' + cw + 'px;'
        });

        this._headerLabel = new St.Label({
            text: activePlayer ? activePlayer.name : '',
            style: 'font-size: 13px; color: #ffffff; font-weight: bold;',
            x_align: Clutter.ActorAlign.START,
            x_expand: true
        });
        this._headerRow.add_child(this._headerLabel);

        this._arrowIcon = new St.Icon({
            icon_name: 'pan-down-symbolic',
            icon_size: 14,
            style: 'color: rgba(255,255,255,0.6);'
        });
        this._headerRow.add_child(this._arrowIcon);

        let headerBtn = new St.Button({ reactive: true, x_expand: true });
        headerBtn.set_child(this._headerRow);
        let self = this;
        headerBtn.connect('clicked', function() {
            self._expanded = !self._expanded;
            if (self._expanded) {
                self._applet._startIgnoreClose();
                if (self._applet._powerMenuVisible && self._applet._powerSection) {
                    self._applet._powerMenuVisible = false;
                    self._applet._powerSection.actor.hide();
                }
                if (self._applet._brightnessVisible && self._applet._brightnessSection) {
                    self._applet._brightnessVisible = false;
                    self._applet._brightnessSection.actor.hide();
                }
                self._applet._animateSubmenu(self._optionsBox, true);
                self._arrowIcon.set_icon_name('pan-up-symbolic');
            } else {
                self._applet._animateSubmenu(self._optionsBox, false);
                self._arrowIcon.set_icon_name('pan-down-symbolic');
            }
        });
        this._chooserBox.add_child(headerBtn);

        this._optionsBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 2px; margin-top: 4px; padding: 4px; border-radius: 10px; background-color: rgba(255,255,255,0.07);'
        });

        for (let i = 0; i < this._players.length; i++) {
            let p = this._players[i];
            let active = (i === this._activeIdx);

            let row = new St.BoxLayout({
                vertical: false,
                style: 'spacing: 6px; padding: 6px 12px; border-radius: 8px; width: ' + cw + 'px; max-width: ' + cw + 'px; ' +
                       (active ? 'background-color: rgba(255,255,255,0.12);' : '')
            });

            let dot = new St.Icon({
                icon_name: active ? 'radio-button-checked-symbolic' : 'radio-button-unchecked-symbolic',
                icon_size: 14,
                style: 'color: ' + (active ? '#4a9eff' : 'rgba(255,255,255,0.5)') + ';'
            });
            row.add_child(dot);

            let statusIcon = p.status === 'Playing' ? ' \u25b6' : '';
            let lbl = new St.Label({
                text: p.name + statusIcon,
                style: 'font-size: 13px; color: ' + (active ? '#ffffff' : 'rgba(255,255,255,0.7)') + ';',
                x_align: Clutter.ActorAlign.START
            });
            row.add_child(lbl);

            let btn = new St.Button({ reactive: true, x_expand: true,
                style: 'padding: 0; border-width: 0; width: ' + cw + 'px; max-width: ' + cw + 'px;' });
            btn.set_child(row);
            let idx = i;
            btn.connect('clicked', function() {
                self._activeIdx = idx;
                self._rebuildPlayerOnly();
                self._updateChooserActive();
            });

            this._optionsBox.add_child(btn);
            this._chooserBtns.push({ btn: btn, dot: dot, label: lbl });
        }

        this._chooserBox.add_child(this._optionsBox);
        this._optionsBox.hide();
        this._expanded = false;
        this._arrowIcon.set_icon_name('pan-down-symbolic');
    },

    _updateChooserActive: function() {
        if (this._headerLabel && this._players[this._activeIdx]) {
            this._headerLabel.set_text(this._players[this._activeIdx].name);
        }
        let cw = CHOOSER_CONTENT_WIDTH;
        for (let i = 0; i < this._chooserBtns.length; i++) {
            let b = this._chooserBtns[i];
            let active = (i === this._activeIdx);
            b.dot.set_icon_name(active ? 'radio-button-checked-symbolic' : 'radio-button-unchecked-symbolic');
            b.dot.set_style('color: ' + (active ? '#4a9eff' : 'rgba(255,255,255,0.5)') + ';');
            let p = this._players[i];
            let statusIcon = p && p.status === 'Playing' ? ' \u25b6' : '';
            b.label.set_text((p ? p.name : '') + statusIcon);
            b.label.set_style('font-size: 13px; color: ' + (active ? '#ffffff' : 'rgba(255,255,255,0.7)') + ';');
            b.btn.get_child().set_style(
                'spacing: 6px; padding: 6px 12px; border-radius: 8px; width: ' + cw + 'px; max-width: ' + cw + 'px; ' +
                (active ? 'background-color: rgba(255,255,255,0.12);' : '')
            );
        }
    },

    _buildPlayerActor: function() {
        let player = this._players[this._activeIdx];
        if (!player) return null;

        this._playerContainer = new St.BoxLayout({
            vertical: true,
            style: 'padding: 8px; margin: 2px 6px; border-radius: 12px; background-color: rgba(255,255,255,0.06); width: ' + PLAYER_CONTENT_WIDTH + 'px; max-width: ' + PLAYER_CONTENT_WIDTH + 'px;'
        });

        let topRow = new St.BoxLayout({ vertical: false, style: 'spacing: 10px;' });

        this._coverBin = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'width: 70px; height: 70px; background-color: rgba(255,255,255,0.08);'
        });
        this._coverIcon = new St.Icon({ icon_name: 'audio-x-generic-symbolic', icon_size: 40, style: 'color: rgba(255,255,255,0.6);' });
        this._coverBin.add_actor(this._coverIcon);
        this._lastCoverPath = player.coverPath || '';
        if (player.coverPath && player.coverPath.length > 0) {
            try {
                if (GLib.file_test(player.coverPath, GLib.FileTest.EXISTS)) {
                    let cache = St.TextureCache.get_default();
                    this._coverVersion = (this._coverVersion || 0) + 1;
                    let myVersion = this._coverVersion;
                    let self = this;
                    cache.load_image_from_file_async(player.coverPath, 70, 70, function(c, handle, actor) {
                        if (myVersion !== self._coverVersion) return;
                        if (actor) {
                            self._coverBin.remove_actor(self._coverIcon);
                            actor.set_size(70, 70);
                            self._coverBin.add_actor(actor);
                        }
                    });
                }
            } catch(e) {}
        }
        topRow.add_child(this._coverBin);

        // 信息区：填满封面右侧所有剩余宽度，歌名能多长显示多长
        let infoBox = new St.BoxLayout({ vertical: true, style: 'spacing: 4px;', x_expand: true });

        this._titleLabel = new St.Label({
            text: player.title || _("No media"),
            style: 'font-size: 14px; font-weight: bold; color: #ffffff;',
            x_align: Clutter.ActorAlign.START,
            x_expand: true
        });
        this._titleLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        this._titleLabel.clutter_text.set_line_wrap(false);
        infoBox.add_child(this._titleLabel);

        this._artistLabel = new St.Label({
            text: player.artist || "",
            style: 'font-size: 12px; color: rgba(255,255,255,0.7);',
            x_align: Clutter.ActorAlign.START,
            x_expand: true
        });
        this._artistLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        infoBox.add_child(this._artistLabel);

        let ctrlRow = new St.BoxLayout({ vertical: false, style: 'spacing: 6px; margin-top: 6px;' });
        let btnStyle = 'padding: 4px 6px; border-radius: 6px; background-color: rgba(255,255,255,0.12);';
        let btnHoverStyle = 'padding: 4px 6px; border-radius: 6px; background-color: rgba(255,255,255,0.28);';
        let iconStyle = 'color: #ffffff;';
        // 悬浮高亮（inline style 无 :hover，用 enter/leave 切换）
        let addHover = function(btn) {
            btn.connect('enter-event', function() { btn.set_style(btnHoverStyle); });
            btn.connect('leave-event', function() { btn.set_style(btnStyle); });
        };

        let btnPrev = new St.Button({ reactive: true, style: btnStyle });
        btnPrev.set_child(new St.Icon({ icon_name: 'media-skip-backward-symbolic', icon_size: 16, style: iconStyle }));
        let self = this;
        btnPrev.connect('clicked', function() { self._sendCommand('prev', player.owner); });
        addHover(btnPrev);
        ctrlRow.add_child(btnPrev);

        let iconName = player.status === 'Playing' ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        this._playBtn = new St.Button({ reactive: true, style: btnStyle });
        this._playBtnIcon = new St.Icon({ icon_name: iconName, icon_size: 16, style: iconStyle });
        this._playBtn.set_child(this._playBtnIcon);
        this._playBtn.connect('clicked', function() { self._sendCommand('play-pause', player.owner); });
        addHover(this._playBtn);
        ctrlRow.add_child(this._playBtn);

        let btnNext = new St.Button({ reactive: true, style: btnStyle });
        btnNext.set_child(new St.Icon({ icon_name: 'media-skip-forward-symbolic', icon_size: 16, style: iconStyle }));
        btnNext.connect('clicked', function() { self._sendCommand('next', player.owner); });
        addHover(btnNext);
        ctrlRow.add_child(btnNext);

        infoBox.add_child(ctrlRow);
        topRow.add_child(infoBox);
        this._playerContainer.add_child(topRow);

        if (player.length > 0) {
            this._seeker = new Slider.Slider(0);
            this._seeker.actor.style = 'min-width: ' + PLAYER_CONTENT_WIDTH + 'px; max-width: ' + PLAYER_CONTENT_WIDTH + 'px; height: 4px; margin-top: 8px;';
            this._seeker.setValue(player.position / player.length);
            this._seeker._userDrag = false;
            this._seeker._userDragTimer = 0;
            this._seeker.connect('value-changed', function(s, value) {
                s._userDrag = true;
                if (s._userDragTimer) Mainloop.source_remove(s._userDragTimer);
                let offset = Math.floor(value * player.length);
                self._sendCommand('set-position', player.owner, offset);
                if (self._curTimeLabel) self._curTimeLabel.set_text(self._formatTime(offset));
                s._userDragTimer = Mainloop.timeout_add(800, function() {
                    s._userDragTimer = 0;
                    s._userDrag = false;
                    return false;
                });
            });

            let timeStyle = 'font-size: 11px; color: rgba(255,255,255,0.6);';
            let timeBox = new St.BoxLayout({ vertical: false, style: 'spacing: 4px; margin-top: 2px;' });
            this._curTimeLabel = new St.Label({ text: this._formatTime(player.position), style: timeStyle });
            this._totalTimeLabel = new St.Label({ text: this._formatTime(player.length), style: timeStyle });
            timeBox.add_child(this._curTimeLabel);
            timeBox.add_child(new St.Widget({ x_expand: true }));
            timeBox.add_child(this._totalTimeLabel);
            this._playerContainer.add_child(this._seeker.actor);
            this._playerContainer.add_child(timeBox);
        }

        return this._playerContainer;
    },

    _rebuildPlayerOnly: function() {
        if (this._playerWrapper) {
            try {
                if (this._playerWrapper.actor.get_parent())
                    this._playerWrapper.actor.get_parent().remove_child(this._playerWrapper.actor);
                this._playerWrapper.destroy();
            } catch(e) {}
        }

        let actor = this._buildPlayerActor();
        if (actor) {
            this._playerWrapper = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this._playerWrapper.addActor(actor, { span: -1 });
            actor.show();
            // 定点回插：切歌/自动跟随只重建播放器本体，关机二级之后、音量之前，位置不动
            if (this._applet._insertOrdered) this._applet._insertOrdered('player', this._playerWrapper);
            else this._applet.menu.addMenuItem(this._playerWrapper);
        }
    },

    _sendCommand: function(action, owner, offset) {
        try {
            let cmd = { action: action, owner: owner };
            if (offset !== undefined) cmd.offset = offset;
            let file = Gio.File.new_for_path(CMD_FILE);
            file.replace_contents(JSON.stringify(cmd), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch(e) {}
    },

    _formatTime: function(us) {
        let sec = Math.floor((us || 0) / 1000000);
        let m = Math.floor(sec / 60);
        let s = sec % 60;
        return "%d:%02d".format(m, s);
    },

    destroy: function() {
        if (this._pollId) Mainloop.source_remove(this._pollId);
        if (this._listChangeTimer) Mainloop.source_remove(this._listChangeTimer);
        this._pollId = 0;
        this._listChangeTimer = 0;
        try {
            GLib.spawn_command_line_async(
                'pkill', ['-f', '-u', GLib.get_user_name(), 'mpris_monitor.py']);
        } catch(e) {}
    }
};
module.exports = MprisController;
