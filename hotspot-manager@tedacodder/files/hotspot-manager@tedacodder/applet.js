const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const POLL_SECONDS = 5;
const ACTION_TIMEOUT_SECONDS = 90;   // starting a hotspot can take a while
const REVEAL_SECONDS = 8;
const NOTE_SECONDS = 6;
const MAX_CLIENTS_SHOWN = 8;
const AUTO_OFF_CHOICES = [0, 30, 60, 120];

// Runs a command and gives its stdout (as text) to callback. Util.spawnCommandLineAsync
// does not pass stdout on this Cinnamon, so the applet could read nothing and looked offline.
function runCapture(argv, callback) {
    let proc;
    try {
        proc = new Gio.Subprocess({
            argv: argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        });
        proc.init(null);
    } catch (e) {
        global.log('[hotspot-manager] could not start ' + argv[0] + ': ' + e);
        callback('');
        return;
    }
    proc.communicate_utf8_async(null, null, (p, res) => {
        let stdout = '';
        try {
            let result = p.communicate_utf8_finish(res);
            stdout = result[1] || '';
        } catch (e) {
            global.log('[hotspot-manager] command failed: ' + e);
        }
        callback(stdout);
    });
}

function HotspotApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

HotspotApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this._script = GLib.build_filenamev([metadata.path, 'hotspot-manager.sh']);
        this._iconPath = GLib.build_filenamev([metadata.path, 'icon-symbolic.svg']);

        this._status = null;
        this._error = '';
        this._note = null;
        this._noteId = 0;
        this._pending = false;
        this._target = false;
        this._guardId = 0;
        this._refreshing = false;
        this._silent = false;
        this._password = null;
        this._revealId = 0;
        this._pollId = 0;
        this._lastUpdate = '';
        this._seenMacs = null;      // devices seen on the last refresh (null until the first one)
        this._autoOffId = 0;
        this._autoOffAt = 0;

        this.set_applet_icon_symbolic_path(this._iconPath);
        this.set_applet_tooltip('Hotspot Manager');

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        try {
            if (this.menu.box) this.menu.box.add_style_class_name('hm-menu');
        } catch (e) {
            // styling only: the menu works without it
        }

        this._buildMenu();
        this._render();
        this._refresh();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        if (this._pollId) GLib.source_remove(this._pollId);
        this._clearGuard();
        this._clearAutoOff();
        if (this._noteId) GLib.source_remove(this._noteId);
        if (this._revealId) GLib.source_remove(this._revealId);
    },

    // ------------------------------------------------------------ menu

    _buildMenu: function () {
        let menu = this.menu;

        // Header: the switch and the status pill
        this._switch = new PopupMenu.PopupSwitchMenuItem('Hotspot', false);
        this._switch.connect('toggled', (item, state) => {
            if (!this._silent) this._setTarget(state);
        });
        menu.addMenuItem(this._switch);

        let pillRow = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this._pill = new St.Label({ text: 'OFFLINE', style_class: 'hm-pill hm-pill-off' });
        pillRow.addActor(this._pill, { expand: true });
        menu.addMenuItem(pillRow);

        // Live readout
        this._ssidRow = this._addMono(menu, 'SSID   --', 'hm-line');
        this._passRow = this._addMono(menu, 'PASS   ************', 'hm-line');
        this._netRow = this._addMono(menu, 'NET    --', 'hm-line');
        this._hostRow = this._addMono(menu, 'HOST   --', 'hm-line');
        this._countRow = this._addMono(menu, 'CLIENTS  0', 'hm-stat');

        this._addButtons(menu, [
            { text: 'Reveal password', onClick: () => this._reveal() },
            { text: 'Copy password', onClick: () => this._copyPassword() },
            { text: 'Copy SSID', onClick: () => this._copySsid() }
        ]);
        this._addButtons(menu, [
            { text: 'Show QR to join', onClick: () => this._showQr() }
        ]);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Connected devices: one visible row per device
        this._devicesHeader = this._addMono(menu, 'DEVICES', 'hm-section');
        this._slots = [];
        for (let i = 0; i < MAX_CLIENTS_SHOWN; i++) {
            let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            let label = new St.Label({ text: '', style_class: 'hm-line' });
            item.addActor(label, { expand: true });
            menu.addMenuItem(item);
            this._slots.push({ item: item, label: label });
        }
        this._deviceNote = this._addMono(menu, 'nobody connected yet', 'hm-line');

        // Auto-off timer
        this._autoSub = new PopupMenu.PopupSubMenuMenuItem('Auto-off: off');
        menu.addMenuItem(this._autoSub);
        AUTO_OFF_CHOICES.forEach((minutes) => {
            let label = minutes ? ('Turn off after ' + minutes + ' min') : 'Never (keep it on)';
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', () => this._setAutoOff(minutes));
            this._autoSub.menu.addMenuItem(item);
        });

        // Settings
        this._settingsSub = new PopupMenu.PopupSubMenuMenuItem('Settings');
        menu.addMenuItem(this._settingsSub);
        let s = this._settingsSub.menu;
        this._ssidEntry = this._addField(s, 'SSID', false);
        this._passEntry = this._addField(s, 'Password', true);
        this._addButtons(s, [
            { text: 'Generate password', onClick: () => this._generate() },
            { text: 'Save & apply', style: 'hm-btn-primary', onClick: () => this._save() }
        ]);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._footer = this._addMono(menu, 'waiting for hotspot-manager...', 'hm-footer');
    },

    _addMono: function (container, text, styleClass) {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let label = new St.Label({ text: text, style_class: styleClass });
        item.addActor(label, { expand: true });
        container.addMenuItem(item);
        return label;
    },

    _addButtons: function (container, specs) {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let box = new St.BoxLayout({ style_class: 'hm-btn-row', x_expand: true });
        specs.forEach((spec) => {
            let btn = new St.Button({
                label: spec.text,
                style_class: 'hm-btn ' + (spec.style || ''),
                reactive: true,
                can_focus: true,
                x_expand: true
            });
            btn.connect('clicked', () => spec.onClick());
            box.add_child(btn);
        });
        item.addActor(box, { expand: true });
        container.addMenuItem(item);
    },

    _addField: function (container, labelText, secret) {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let label = new St.Label({ text: labelText, style_class: 'hm-field-label' });
        let entry = new St.Entry({ style_class: 'hm-entry', x_expand: true });
        if (secret) {
            try {
                entry.clutter_text.set_password_char('\u25CF');
            } catch (e) {
                // some builds do not expose it; the text stays visible
            }
        }
        item.addActor(label, { expand: true });
        item.addActor(entry);
        container.addMenuItem(item);
        return entry;
    },

    _setClass: function (actor, cls) {
        if (actor.set_style_class_name) actor.set_style_class_name(cls);
        else actor.style_class = cls;
    },

    // ------------------------------------------------------- rendering

    _render: function () {
        try {
            this._renderInner();
        } catch (e) {
            this._log('render error: ' + e);
        }
    },

    _renderInner: function () {
        let st = this._status;
        let on = this._pending ? this._target : !!(st && st.active);

        this._quietly(() => this._switch.setToggleState(on));

        if (this._pending) {
            this._pill.text = 'WORKING...';
            this._setClass(this._pill, 'hm-pill hm-pill-busy');
        } else {
            this._pill.text = on ? 'ON AIR' : 'OFFLINE';
            this._setClass(this._pill, 'hm-pill ' + (on ? 'hm-pill-on' : 'hm-pill-off'));
        }

        this._ssidRow.text = 'SSID   ' + (st && st.ssid ? st.ssid : '--');
        this._passRow.text = 'PASS   ' + (this._password ? this._password : '************');
        this._hostRow.text = 'HOST   ' + (st && st.host ? st.host : '--');

        if (on && st) {
            this._netRow.text = 'NET    ' + (st.ip || '--') + '  \u00b7  ' + (st.iface || '--') +
                '  \u00b7  up ' + this._uptime(st.startedAt);
        } else {
            this._netRow.text = 'NET    hotspot is off';
        }

        let clients = on && st ? (st.clients || []) : [];
        this._countRow.text = 'CLIENTS  ' + clients.length;
        this._renderClients(clients);

        this._autoSub.label.text = this._autoOffAt && on
            ? 'Auto-off: ' + this._autoOffLeft() : 'Auto-off: off';

        if (this._note) this._footer.text = this._note.text;
        else if (this._error) this._footer.text = this._error;
        else if (this._lastUpdate) this._footer.text = 'updated ' + this._lastUpdate + '  \u00b7  WPA2';
    },

    _renderClients: function (clients) {
        let shown = clients.slice(0, MAX_CLIENTS_SHOWN);
        this._devicesHeader.text = 'DEVICES  (' + clients.length + ')';
        this._slots.forEach((slot, i) => {
            if (i < shown.length) {
                slot.label.text = '\u25CF  ' + this._deviceLabel(shown[i]) + '   ' + shown[i].ip + '   ' + shown[i].state;
                slot.item.actor.visible = true;
            } else {
                slot.item.actor.visible = false;
            }
        });
        if (!clients.length) this._deviceNote.text = 'nobody connected yet';
        else if (clients.length > shown.length) this._deviceNote.text = '+' + (clients.length - shown.length) + ' more';
        else this._deviceNote.text = '';
    },

    _deviceLabel: function (c) {
        return c.name ? c.name : 'unknown device';
    },

    _uptime: function (startedAt) {
        if (!startedAt) return '--';
        let secs = Math.max(0, Math.floor(GLib.get_real_time() / 1000000) - startedAt);
        return this._clock(secs);
    },

    _clock: function (secs) {
        let h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
        let pad = (x) => (x < 10 ? '0' + x : '' + x);
        return pad(h) + ':' + pad(m) + ':' + pad(s);
    },

    _autoOffLeft: function () {
        let left = Math.max(0, Math.round(this._autoOffAt - GLib.get_real_time() / 1000000));
        return this._clock(left);
    },

    // Runs fn while ignoring the switch's own "toggled" signal.
    _quietly: function (fn) {
        this._silent = true;
        try {
            fn();
        } finally {
            this._silent = false;
        }
    },

    // ----------------------------------------------------------- actions

    _setTarget: function (next) {
        if (this._pending) {
            this._render();
            return;
        }
        this._clearAutoOff();
        this._note = null;
        this._error = '';
        this._pending = true;
        this._target = next;
        this._armGuard();
        this._render();

        this._log('switch ' + (next ? 'on' : 'off') + ' requested');
        this._run([next ? 'start' : 'stop'], (st) => {
            this._pending = false;
            this._clearGuard();
            if (!st || st.error) {
                this._error = (st && st.error) || (next ? 'could not start the hotspot' : 'could not stop the hotspot');
                this._notify('Hotspot', this._error);
            } else {
                this._applyStatus(st);
                this._notify('Hotspot', st.active ? 'hotspot is on: ' + st.ssid : 'hotspot is off');
            }
            this._render();
        });
    },

    _setAutoOff: function (minutes) {
        this._clearAutoOff();
        if (!minutes) {
            this._showNote('auto-off is off', 'warn');
            return;
        }
        this._autoOffAt = GLib.get_real_time() / 1000000 + minutes * 60;
        this._autoOffId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, minutes * 60, () => {
            this._autoOffId = 0;
            this._autoOffAt = 0;
            this._setTarget(false);
            return GLib.SOURCE_REMOVE;
        });
        this._showNote('hotspot turns off in ' + minutes + ' min', 'on');
    },

    _clearAutoOff: function () {
        if (this._autoOffId) {
            GLib.source_remove(this._autoOffId);
            this._autoOffId = 0;
        }
        this._autoOffAt = 0;
    },

    _armGuard: function () {
        this._clearGuard();
        this._guardId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, ACTION_TIMEOUT_SECONDS, () => {
            this._guardId = 0;
            this._pending = false;
            this._error = 'hotspot did not answer in time';
            this._render();
            return GLib.SOURCE_REMOVE;
        });
    },

    _clearGuard: function () {
        if (this._guardId) {
            GLib.source_remove(this._guardId);
            this._guardId = 0;
        }
    },

    // Runs settings commands in order. Stops at the first error.
    _runQueue: function (commands, done) {
        let queue = commands.slice();
        this._pending = true;
        this._armGuard();
        this._render();
        let step = () => {
            if (!queue.length) {
                this._pending = false;
                this._clearGuard();
                this._refresh();
                if (done) done(true);
                return;
            }
            this._run(queue.shift(), (st) => {
                if (!st || st.error) {
                    this._pending = false;
                    this._clearGuard();
                    this._error = (st && st.error) || 'settings could not be saved';
                    this._render();
                    if (done) done(false);
                    return;
                }
                this._applyStatus(st);
                step();
            });
        };
        step();
    },

    _save: function () {
        let ssid = this._ssidEntry.clutter_text.text.trim();
        let pass = this._passEntry.clutter_text.text.trim();
        let commands = [];
        if (ssid) commands.push(['set-ssid', ssid]);
        if (pass) commands.push(['set-password', pass]);
        if (!commands.length) {
            this._showNote('nothing to save', 'warn');
            return;
        }
        this._runQueue(commands, (ok) => {
            if (ok) {
                this._ssidEntry.clutter_text.text = '';
                this._passEntry.clutter_text.text = '';
                this._password = null;
                this._showNote('settings saved', 'on');
            }
        });
    },

    _generate: function () {
        this._runQueue([['generate-password']], (ok) => {
            if (ok) {
                this._password = null;
                this._showNote('new password saved, press Reveal to see it', 'on');
            }
        });
    },

    _showQr: function () {
        this._run(['qr'], (st) => {
            if (!st || st.error || !st.path) {
                this._showNote((st && st.error) || 'could not make the QR code', 'error');
                return;
            }
            runCapture(['xdg-open', st.path], () => {});
            this._showNote('QR opened: scan it with your phone camera', 'on');
        });
    },

    _reveal: function () {
        if (this._password) {
            this._hidePassword();
            return;
        }
        this._run(['show-password'], (st) => {
            if (!st || st.error || !st.password) {
                this._showNote('could not read the password', 'error');
                return;
            }
            this._password = st.password;
            this._render();
            if (this._revealId) GLib.source_remove(this._revealId);
            this._revealId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REVEAL_SECONDS, () => {
                this._revealId = 0;
                this._hidePassword();
                return GLib.SOURCE_REMOVE;
            });
        });
    },

    _hidePassword: function () {
        this._password = null;
        this._render();
    },

    _copyPassword: function () {
        this._run(['show-password'], (st) => {
            if (!st || st.error || !st.password) {
                this._showNote('could not read the password', 'error');
                return;
            }
            this._copyText(st.password, 'password');
        });
    },

    _copySsid: function () {
        if (!this._status || !this._status.ssid) {
            this._showNote('no SSID yet', 'warn');
            return;
        }
        this._copyText(this._status.ssid, 'SSID');
    },

    _copyText: function (text, label) {
        try {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
            this._showNote(label + ' copied', 'on');
        } catch (e) {
            this._showNote('copy failed', 'error');
        }
    },

    _showNote: function (text, state) {
        if (this._noteId) GLib.source_remove(this._noteId);
        this._note = { text: text, state: state };
        this._noteId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, NOTE_SECONDS, () => {
            this._noteId = 0;
            this._note = null;
            this._render();
            return GLib.SOURCE_REMOVE;
        });
        this._render();
    },

    _applyStatus: function (st) {
        this._status = st;
        this._error = '';
        this._lastUpdate = GLib.DateTime.new_now_local().format('%H:%M:%S');
    },

    _refresh: function () {
        if (this._refreshing) return;
        this._refreshing = true;
        this._run(['status'], (st) => {
            this._refreshing = false;
            if (!st || st.error) {
                this._error = (st && st.error) || 'cannot read hotspot status';
                this._render();
                return;
            }
            this._applyStatus(st);
            this._checkDevices(st);
            this._render();
        });
    },

    // Tells you when a device joins or leaves. The first refresh only records the list.
    _checkDevices: function (st) {
        let now = {};
        if (st.active) {
            (st.clients || []).forEach((c) => { now[c.mac] = c; });
        }
        if (this._seenMacs !== null && st.active) {
            Object.keys(now).forEach((mac) => {
                if (!this._seenMacs[mac]) this._notify('Device joined', this._deviceLabel(now[mac]) + '  ' + now[mac].ip);
            });
            Object.keys(this._seenMacs).forEach((mac) => {
                if (!now[mac]) this._notify('Device left', this._deviceLabel(this._seenMacs[mac]));
            });
        }
        this._seenMacs = now;
    },

    // ----------------------------------------------------------- helpers

    _notify: function (title, body) {
        runCapture(['notify-send', '-a', 'Hotspot Manager', title, body], () => {});
    },

    _log: function (msg) {
        global.log('[hotspot-manager] ' + msg);
    },

    _parse: function (out) {
        try {
            return JSON.parse((out || '').trim());
        } catch (e) {
            return null;
        }
    },

    // Runs hotspot-manager.sh and gives the parsed JSON to callback (null if unreadable).
    _run: function (args, callback) {
        if (args[0] !== 'status') this._log('run ' + args.join(' '));
        let argv = ['/bin/bash', this._script].concat(args);
        runCapture(argv, (stdout) => {
            if (args[0] !== 'status') this._log('answer ' + args[0] + ': ' + stdout.trim().slice(0, 160));
            callback(this._parse(stdout));
        });
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new HotspotApplet(metadata, orientation, panelHeight, instanceId);
}
