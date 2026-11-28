/*
 * RunCat for Cinnamon - a panel applet showing a cat whose running speed
 * follows the CPU load.
 *
 * Based on gnome-runcat (https://github.com/win0err/gnome-runcat)
 *   Copyright (C) Sergei Kolesnikov
 * Cinnamon port:
 *   Copyright (C) 2026 Aldhiansyah
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details. You should have received a copy of the GNU General Public
 * License along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;

const UUID = 'runcat@aldhiansyah';
const LOG = '[runcat-cinnamon]';

// Constants taken from the original src/math.ts
const ANIMATION_SMOOTHING_TAU_MS = 500;
const MAX_FRAME_DELTA_MS = 250;

const SPEED_FACTOR = {
    slow: 1.8,
    normal: 1.0,
    fast: 0.6,
};

// f(x) = 250 + 850 * (1 - x)^2 ms, duration of one animation cycle
function getAnimationCycleDurationMs(cpuUtilization) {
    return Math.ceil(250 + 850 * (1 - cpuUtilization) ** 2);
}

// Direct port of createAnimationTicker from src/math.ts
class AnimationTicker {
    constructor(tauMs = ANIMATION_SMOOTHING_TAU_MS) {
        this._tauMs = tauMs;
        this._targetDurationMs = 0;
        this._smoothedDurationMs = 0;
        this._phase = 0;
        this._lastTickMs = NaN;
    }

    setTargetDuration(durationMs, immediate = false) {
        if (!Number.isFinite(durationMs) || durationMs <= 0)
            return;

        this._targetDurationMs = durationMs;

        if (immediate || this._smoothedDurationMs <= 0)
            this._smoothedDurationMs = durationMs;
    }

    advanceTo(nowMs, framesCount) {
        const dt = nowMs - this._lastTickMs;
        this._lastTickMs = nowMs;

        const stallThresholdMs = Math.max(MAX_FRAME_DELTA_MS, this._smoothedDurationMs / framesCount);

        if (Number.isFinite(dt) && dt > 0 && dt <= stallThresholdMs && this._smoothedDurationMs > 0) {
            const alpha = 1 - Math.exp(-dt / this._tauMs);
            this._smoothedDurationMs += alpha * (this._targetDurationMs - this._smoothedDurationMs);
            this._phase = (this._phase + dt / this._smoothedDurationMs) % 1;
        }

        const index = framesCount > 0
            ? Math.max(0, Math.floor(this._phase * framesCount) % framesCount)
            : 0;

        const nextFramePhase = (Math.floor(this._phase * framesCount) + 1) / framesCount;
        const nextDelayMs = this._smoothedDurationMs > 0
            ? Math.max(1, Math.ceil((nextFramePhase - this._phase) * this._smoothedDurationMs))
            : MAX_FRAME_DELTA_MS;

        return { index, nextDelayMs };
    }
}

// Replacement for src/dataProviders/cpu.ts: read /proc/stat and diff two samples
class CpuUsageProvider {
    constructor() {
        this._previous = null;
        this._reading = false;
    }

    read(callback) {
        if (this._reading) {
            callback(null);
            return;
        }

        this._reading = true;
        const file = Gio.File.new_for_path('/proc/stat');

        file.load_contents_async(null, (obj, res) => {
            this._reading = false;

            let contents;
            try {
                const [ok, data] = file.load_contents_finish(res);
                if (!ok) {
                    callback(null);
                    return;
                }
                contents = data;
            } catch (e) {
                log(`${LOG}: failed to read /proc/stat: ${e.message}`);
                callback(null);
                return;
            }

            callback(this._parse(contents));
        });
    }

    _parse(contents) {
        const line = imports.byteArray.toString(contents).split('\n')[0];
        const values = line.trim().split(/\s+/).slice(1).map(Number);
        if (values.length < 4 || values.some(isNaN))
            return null;

        const idle = values[3] + (values[4] || 0);
        const total = values.reduce((sum, value) => sum + value, 0);

        const previous = this._previous;
        this._previous = { idle, total };

        if (!previous)
            return null;

        const deltaTotal = total - previous.total;
        const deltaIdle = idle - previous.idle;
        if (deltaTotal <= 0)
            return null;

        return Math.min(1, Math.max(0, (deltaTotal - deltaIdle) / deltaTotal));
    }
}

class RunCatApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._orient = orientation;
        this._cpu = new CpuUsageProvider();
        this._ticker = new AnimationTicker();
        this._timeoutId = 0;
        this._animationId = 0;
        this._cpuUtilization = 0;
        this._sprites = { active: [], idle: [] };

        this._loadSprites();
        this._buildUi();
        this._buildMenu();

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bindProperty(
            Settings.BindingDirection.BIDIRECTIONAL,
            'show-percentage',
            'showPercentage',
            this._onShowPercentageChanged
        );
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'icon-size', 'iconSize', this._onIconSizeChanged);
        this.settings.bind('refresh-interval', 'refreshInterval', this._restartTimer);
        this.settings.bind('animation-speed', 'animationSpeed', this._onSpeedChanged);
        this.settings.bind('idle-threshold', 'idleThreshold');

        this._applyIconSize();
        this._onShowPercentageChanged();
        this._startTimer();
    }

    _getAppletDir() {
        const info = this._metadata ?? (imports.ui.appletManager.appletMeta[UUID]);
        return info ? info.path : null;
    }

    _loadSprites() {
        const rootDir = this._getAppletDir();
        if (!rootDir) {
            log(`${LOG}: applet directory not found`);
            return;
        }

        const states = ['active', 'idle'];
        let pending = states.length;
        const sprites = { active: [], idle: [] };

        const finished = () => {
            if (--pending > 0)
                return;
            this._sprites = sprites;
            log(`${LOG}: ${sprites.active.length} active sprites, ${sprites.idle.length} idle sprites`);
        };

        for (const state of states) {
            const dir = Gio.File.new_for_path(`${rootDir}/icons/runcat/${state}`);

            dir.enumerate_children_async(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                null,
                (obj, res) => {
                    const frames = [];
                    let enumerator = null;

                    try {
                        enumerator = dir.enumerate_children_finish(res);
                        let info;
                        while ((info = enumerator.next_file(null)) !== null) {
                            const match = /^sprite-(\d+)-symbolic\.svg$/.exec(info.get_name());
                            if (match)
                                frames.push({ index: parseInt(match[1], 10), path: `${dir.get_path()}/${info.get_name()}` });
                        }
                    } catch (e) {
                        log(`${LOG}: failed to list sprites for state "${state}": ${e.message}`);
                    } finally {
                        if (enumerator)
                            enumerator.close(null);
                    }

                    frames.sort((a, b) => a.index - b.index);
                    sprites[state] = frames.map(frame => Gio.icon_new_for_string(frame.path));

                    if (sprites[state].length === 0)
                        log(`${LOG}: no sprites found for state "${state}"`);

                    finished();
                }
            );
        }
    }

    _buildUi() {
        this._box = new St.BoxLayout({
            style_class: 'runcat-container',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'system-status-icon',
            icon_size: 20,
        });

        this._label = new St.Label({
            text: '0%',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'runcat-label',
        });

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.actor.add(this._box, { y_align: Clutter.ActorAlign.CENTER });

        this.set_applet_tooltip('RunCat - CPU load');
    }

    _buildMenu() {
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new Applet.AppletPopupMenu(this, this._orient);
        this._menuManager.addMenu(this._menu);

        const header = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'runcat-header' });
        const headerBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._menuPercent = new St.Label({ text: '0%', style_class: 'runcat-menu-percent' });
        this._menuDetail = new St.Label({ text: 'reading CPU...', style_class: 'runcat-menu-detail' });
        headerBox.add_child(this._menuPercent);
        headerBox.add_child(this._menuDetail);
        header.addActor(headerBox);
        this._menu.addMenuItem(header);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const monitor = new PopupMenu.PopupMenuItem('Open System Monitor');
        monitor.connect('activate', () => this._launchSystemMonitor());
        this._menu.addMenuItem(monitor);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._percentageSwitch = new PopupMenu.PopupSwitchMenuItem('Show percentage', false);
        this._percentageSwitch.connect('toggled', (item, state) => {
            this.showPercentage = state;
            this._onShowPercentageChanged();
        });
        this._menu.addMenuItem(this._percentageSwitch);

        this._menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen)
                this._updateMenuDetail();
        });

    }

    _launchSystemMonitor() {
        const candidates = [
            'org.gnome.SystemMonitor.desktop',
            'gnome-system-monitor.desktop',
            'mate-system-monitor.desktop',
        ];

        for (const id of candidates) {
            const info = Gio.DesktopAppInfo.new(id);
            if (!info)
                continue;
            try {
                info.launch([], null);
                return;
            } catch (e) {
                log(`${LOG}: failed to launch ${id}: ${e.message}`);
            }
        }

        try {
            Util.spawn(['gnome-system-monitor']);
        } catch (e) {
            log(`${LOG}: system monitor cannot be started: ${e.message}`);
            this._menuDetail.set_text('System monitor not found');
        }
    }

    _readLoadAverage(callback) {
        const file = Gio.File.new_for_path('/proc/loadavg');

        file.load_contents_async(null, (obj, res) => {
            try {
                const [ok, data] = file.load_contents_finish(res);
                if (!ok) {
                    callback(null);
                    return;
                }
                const fields = imports.byteArray.toString(data).trim().split(/\s+/);
                callback({ one: parseFloat(fields[0]), five: parseFloat(fields[1]) });
            } catch (e) {
                callback(null);
            }
        });
    }

    _updateMenuDetail() {
        if (!this._menuDetail)
            return;

        const cpus = GLib.get_num_processors();
        const speed = this.animationSpeed || 'normal';

        this._readLoadAverage((loadAvg) => {
            if (!this._menuDetail)
                return;
            if (loadAvg)
                this._menuDetail.set_text(`load ${loadAvg.one.toFixed(2)} - ${cpus} threads - ${speed}`);
            else
                this._menuDetail.set_text(`${cpus} threads`);
        });
    }

    _applyIconSize() {
        const size = Math.max(12, Math.min(64, this.iconSize || 20));
        this._icon.set_icon_size(size);
    }

    _onIconSizeChanged() {
        this._applyIconSize();
    }

    _onShowPercentageChanged() {
        this._label.visible = !!this.showPercentage;
        if (this._percentageSwitch)
            this._percentageSwitch.setToggleState(!!this.showPercentage);
        this._box.style_class = this.showPercentage ? 'runcat-container with-label' : 'runcat-container';
    }

    _onSpeedChanged() {
        const factor = SPEED_FACTOR[this.animationSpeed] ?? 1.0;
        this._speedFactor = factor;
    }

    _startTimer() {
        this._stopTimer();
        const interval = Math.max(500, Math.min(10000, this.refreshInterval || 2000));
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
        this._scheduleAnimationFrame(50);
    }

    _stopTimer() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._animationId) {
            GLib.source_remove(this._animationId);
            this._animationId = 0;
        }
    }

    _scheduleAnimationFrame(delayMs) {
        this._animationId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            Math.max(16, Math.round(delayMs)),
            () => {
                this._animationId = 0;
                const nextDelay = this._animationTick();
                this._scheduleAnimationFrame(nextDelay);
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _animationTick() {
        const frames = this._sprites.active;
        const threshold = (this.idleThreshold ?? 3) / 100;

        if (this._cpuUtilization <= threshold || frames.length === 0) {
            if (this._sprites.idle.length > 0)
                this._icon.set_gicon(this._sprites.idle[0]);
            this._ticker._phase = 0;
            this._ticker._lastTickMs = NaN;
            return 250;
        }

        const factor = this._speedFactor ?? SPEED_FACTOR[this.animationSpeed] ?? 1.0;
        this._ticker.setTargetDuration(getAnimationCycleDurationMs(this._cpuUtilization) * factor);

        const { index, nextDelayMs } = this._ticker.advanceTo(
            GLib.get_monotonic_time() / 1000,
            frames.length
        );
        this._icon.set_gicon(frames[index]);
        return nextDelayMs;
    }

    _restartTimer() {
        this._startTimer();
    }

    _tick() {
        this._cpu.read((load) => {
            if (load === null)
                return;

            this._cpuUtilization = load;

            const percent = Math.round(load * 100);
            this._label.set_text(`${percent}%`);
            this.set_applet_tooltip(`RunCat - CPU load ${percent}%`);

            if (this._menuPercent)
                this._menuPercent.set_text(`${percent}%`);

            if (this._menu && this._menu.isOpen)
                this._updateMenuDetail();

            const threshold = (this.idleThreshold ?? 3) / 100;
            if (load <= threshold && this._sprites.idle.length > 0)
                this._icon.set_gicon(this._sprites.idle[0]);
        });
    }

    on_orientation_changed(orientation) {
        this._orient = orientation;
        if (this._menu) {
            this._menu._orientation = orientation;
            this._menu.setArrowSide(orientation);
        }
    }

    on_applet_clicked() {
        this._menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._stopTimer();
        if (this.settings)
            this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new RunCatApplet(metadata, orientation, panelHeight, instanceId);
}
