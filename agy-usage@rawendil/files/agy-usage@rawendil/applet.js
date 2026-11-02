// Antigravity Usage Monitor - a Cinnamon applet showing Google Antigravity usage.
// Copyright (C) 2026 Sebastian Soczka <rawendil>
//
// Based on claude-usage@mtwebster by Michael Webster, licensed GPL-3.0.
// The applet skeleton (panel layout, settings wiring, colour classes) follows
// that applet; the data source, parsing, caching and error handling are new.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

const Applet = imports.ui.applet;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Settings = imports.ui.settings;

const UUID = 'agy-usage@rawendil';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(text) {
    return Gettext.dgettext(UUID, text);
}

// lib.js jest ładowany dwoma drogami: przez GJS w panelu i przez node w testach.
let Lib;
if (typeof require !== 'undefined') {
    Lib = require('./lib');
} else {
    Lib = imports.ui.appletManager.applets[UUID].lib;
}

// lib.js nie może sięgnąć po Gettext sam — pod node go nie ma.
Lib.setTranslator(_);

const ALL_COLORS = [Lib.COLOR_GREEN, Lib.COLOR_YELLOW, Lib.COLOR_RED];

const FETCH_TIMEOUT_SECONDS = 30;

function AgyUsageApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

AgyUsageApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this.settings.bind('update-interval', 'updateInterval', this._onIntervalChanged.bind(this));
            this.settings.bind('model-group', 'modelGroup', this._onGroupChanged.bind(this));
            this.settings.bind('agy-path', 'agyPath', this._onAgyPathChanged.bind(this));
            this.settings.bind('last-data', 'lastData');
            this.settings.bind('last-fetch-time', 'lastFetchTime');

            this._parsed = null;
            this._lastUpdateIso = null;
            this._timerId = 0;
            this._cancellable = null;
            this._fetchTimeoutId = 0;
            this._timedOut = false;
            this._destroyed = false;

            this._applet_icon = new St.Icon({
                icon_name: 'agy-usage-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 16,
                style_class: 'applet-icon'
            });

            this.label5h = new St.Label({
                text: '--%',
                style_class: 'agy-usage-label',
                reactive: true,
                track_hover: true
            });
            this.labelWeekly = new St.Label({
                text: '--%',
                style_class: 'agy-usage-label',
                reactive: true,
                track_hover: true
            });

            this.actor.add(this.label5h, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this._applet_icon, { y_align: St.Align.MIDDLE, y_fill: false });
            this.actor.add(this.labelWeekly, { y_align: St.Align.MIDDLE, y_fill: false });

            this._renderPlaceholder('--%', '--%', Lib.COLOR_YELLOW);
            this.set_applet_tooltip(_('Waiting for data from `agy`…'));
            this._restoreCache();
            this._start();
        } catch (e) {
            global.logError(UUID + ': initialization failed: ' + e);
        }
    },

    _applyColor: function(label, colorClass) {
        for (let i = 0; i < ALL_COLORS.length; i++) {
            label.remove_style_class_name(ALL_COLORS[i]);
        }
        if (colorClass) {
            label.add_style_class_name(colorClass);
        }
    },

    _renderPlaceholder: function(text5h, textWeekly, colorClass) {
        this.label5h.set_text(text5h);
        this.labelWeekly.set_text(textWeekly);
        this._applyColor(this.label5h, colorClass);
        this._applyColor(this.labelWeekly, colorClass);
    },

    _resolveAgyPath: function() {
        // Kolejność ze specyfikacji: ustawienie → PATH → ~/.local/bin/agy.
        // Ostatni krok jest istotny: agy leży w ~/.local/bin, a sesja Cinnamona
        // nie zawsze ma ten katalog w PATH.
        if (this.agyPath && this.agyPath.length > 0) {
            let configured = this.agyPath;
            if (configured.startsWith('file://')) {
                configured = Gio.File.new_for_uri(configured).get_path();
            }
            return configured;
        }

        const fromPath = GLib.find_program_in_path('agy');
        if (fromPath) {
            return fromPath;
        }

        // Bez sprawdzania, czy plik istnieje: file_test() to synchroniczny stat,
        // a nieudany start i tak wpada w catch niżej i daje ten sam komunikat.
        return GLib.get_home_dir() + '/.local/bin/agy';
    },

    _renderData: function(note, forceYellow) {
        const nowIso = new Date().toISOString();
        const group = this._parsed[this.modelGroup] ? this.modelGroup : 'gemini';
        const buckets = this._parsed[group];

        const texts = Lib.buildPanelText(buckets.fiveHour, buckets.weekly, nowIso);
        this.label5h.set_text(texts.text5h);
        this.labelWeekly.set_text(texts.textWeekly);

        this._applyColor(this.label5h,
            forceYellow ? Lib.COLOR_YELLOW : Lib.colorClassFor(buckets.fiveHour.usedPercent));
        this._applyColor(this.labelWeekly,
            forceYellow ? Lib.COLOR_YELLOW : Lib.colorClassFor(buckets.weekly.usedPercent));

        this.set_applet_tooltip(Lib.buildTooltip(this._parsed, {
            group: group,
            nowIso: nowIso,
            lastUpdateIso: this._lastUpdateIso,
            note: note || null
        }));
    },

    _restoreCache: function() {
        // Bez tego panel pokazywałby --% przez ~3 s po każdym przeładowaniu Cinnamona.
        if (!this.lastData) {
            return;
        }
        try {
            this._parsed = Lib.parseUsageResponse(this.lastData);
        } catch (e) {
            global.logError(UUID + ': could not read cache: ' + e);
            return;
        }

        this._lastUpdateIso = this.lastFetchTime
            ? new Date(this.lastFetchTime * 1000).toISOString()
            : null;

        const ageSeconds = this.lastFetchTime
            ? Math.floor(Date.now() / 1000) - this.lastFetchTime
            : Infinity;
        const stale = ageSeconds > this.updateInterval * 60;
        const note = stale
            ? Lib.formatDataAge(this._lastUpdateIso, new Date().toISOString())
            : null;

        this._renderData(note, false);
    },

    _stopTimer: function() {
        if (this._timerId > 0) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    },

    _scheduleIn: function(seconds) {
        this._stopTimer();
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            Math.max(1, Math.ceil(seconds)),
            () => {
                this._timerId = 0;
                try {
                    this._fetch();
                } catch (e) {
                    global.logError(UUID + ': fetch failed: ' + e);
                }
                this._scheduleIn(this.updateInterval * 60);
                return GLib.SOURCE_REMOVE;
            }
        );
    },

    _start: function() {
        // Po przeładowaniu Cinnamona nie odpytujemy od razu, jeśli świeże dane
        // są w cache — inaczej każde `r` kosztowałoby trzysekundowe wywołanie agy.
        const intervalSeconds = this.updateInterval * 60;
        const elapsed = this.lastFetchTime
            ? Math.floor(Date.now() / 1000) - this.lastFetchTime
            : Infinity;
        const delay = intervalSeconds - elapsed;

        if (!(delay > 0)) {
            try {
                this._fetch();
            } catch (e) {
                global.logError(UUID + ': fetch failed: ' + e);
            }
            this._scheduleIn(intervalSeconds);
        } else {
            this._scheduleIn(delay);
        }
    },

    _clearFetchTimeout: function() {
        if (this._fetchTimeoutId > 0) {
            GLib.source_remove(this._fetchTimeoutId);
            this._fetchTimeoutId = 0;
        }
    },

    _fetch: function() {
        if (this._cancellable) {
            return; // poprzednie wywołanie jeszcze trwa
        }

        const agyPath = this._resolveAgyPath();
        if (!agyPath) {
            this._renderFailure('noBinary', Lib.errorMessage('noBinary'));
            return;
        }

        let proc;
        try {
            proc = Gio.Subprocess.new(
                [agyPath, '-p', '/usage', '--output-format', 'json'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            global.logError(UUID + ': could not start agy: ' + e);
            this._renderFailure('noBinary', Lib.errorMessage('noBinary'));
            return;
        }

        this._timedOut = false;
        this._cancellable = new Gio.Cancellable();
        this._fetchTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            FETCH_TIMEOUT_SECONDS,
            () => {
                this._fetchTimeoutId = 0;
                this._timedOut = true;
                if (this._cancellable) {
                    this._cancellable.cancel();
                }
                try {
                    proc.force_exit();
                } catch (e) {
                    global.logError(UUID + ': could not kill agy: ' + e);
                }
                return GLib.SOURCE_REMOVE;
            }
        );

        proc.communicate_utf8_async(null, this._cancellable, (subprocess, result) => {
            if (this._destroyed) {
                return;
            }
            this._clearFetchTimeout();
            this._cancellable = null;
            const timedOut = this._timedOut;
            this._timedOut = false;

            if (timedOut) {
                this._renderFailure('timeout', Lib.errorMessage('timeout'));
                return;
            }

            let stdout = '';
            let stderr = '';
            try {
                const [, out, err] = subprocess.communicate_utf8_finish(result);
                stdout = out || '';
                stderr = err || '';
            } catch (e) {
                global.logError(UUID + ': reading agy output failed: ' + e);
                this._renderFailure('parse', Lib.errorMessage('parse'));
                return;
            }

            let exitStatus = -1;
            try {
                exitStatus = subprocess.get_exit_status();
            } catch (e) {
                global.logError(UUID + ': no exit status from agy: ' + e);
            }

            this._handleResult(exitStatus, stdout, stderr);
        });
    },

    _handleResult: function(exitStatus, stdout, stderr) {
        if (exitStatus !== 0) {
            const failure = Lib.classifyFailure(exitStatus, stdout, stderr);
            this._renderFailure(failure.kind, failure.message);
            return;
        }

        let parsed;
        try {
            parsed = Lib.parseUsageResponse(stdout);
        } catch (e) {
            // agy potrafi zakończyć się zerem, wypisując prośbę o zalogowanie,
            // więc zanim uznamy to za zepsuty JSON, sprawdzamy treść wyjścia.
            const failure = Lib.classifyFailure(exitStatus, stdout, stderr);
            if (failure.kind !== 'exit') {
                this._renderFailure(failure.kind, failure.message);
            } else {
                global.logError(UUID + ': ' + e);
                this._renderFailure('parse', Lib.errorMessage('parse'));
            }
            return;
        }

        this._parsed = parsed;
        this._lastUpdateIso = new Date().toISOString();
        this.lastData = stdout;
        this.lastFetchTime = Math.floor(Date.now() / 1000);
        this._renderData(null, false);
    },

    _renderFailure: function(kind, message) {
        if (kind === 'auth') {
            this._renderPlaceholder(_('auth'), '', Lib.COLOR_RED);
            this.set_applet_tooltip(message);
            return;
        }
        if (kind === 'noBinary') {
            this._renderPlaceholder(_('n/a'), '', Lib.COLOR_YELLOW);
            this.set_applet_tooltip(message);
            return;
        }

        // Stara liczba z adnotacją jest użyteczniejsza niż --%.
        if (this._parsed) {
            const age = Lib.formatDataAge(this._lastUpdateIso, new Date().toISOString());
            this._renderData(age ? message + '\n' + age : message, true);
            return;
        }

        this._renderPlaceholder('--%', '--%', Lib.COLOR_YELLOW);
        this.set_applet_tooltip(message);
    },

    _onIntervalChanged: function() {
        this._scheduleIn(this.updateInterval * 60);
    },

    _onGroupChanged: function() {
        if (this._parsed) {
            this._renderData(null, false);
        }
    },

    _onAgyPathChanged: function() {
        this._fetch();
        this._scheduleIn(this.updateInterval * 60);
    },

    on_applet_clicked: function() {
        this._fetch();
        this._scheduleIn(this.updateInterval * 60);
    },

    on_applet_removed_from_panel: function() {
        this._destroyed = true;
        this._stopTimer();
        this._clearFetchTimeout();
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new AgyUsageApplet(orientation, panel_height, instance_id);
}
