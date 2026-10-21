const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gettext = imports.gettext;

const UUID = __meta.uuid;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
const _ = s => Gettext.dgettext(UUID, s);

const M = require('./metrics');
const Src = require('./sources');
const { DetailsPopup } = require('./popup');

const SETTING_KEYS = [
    'update-interval', 'show-cpu', 'show-gpu', 'show-ram', 'show-net',
    'show-gpu-power', 'show-gpu-fan', 'show-swap', 'show-nvme', 'net-interface',
    'cpu-temp-warn', 'cpu-temp-crit', 'cpu-load-warn', 'cpu-load-crit',
    'gpu-temp-warn', 'gpu-temp-crit', 'gpu-load-warn', 'gpu-load-crit',
    'vram-warn', 'vram-crit', 'ram-warn', 'ram-crit',
    'nvme-temp-warn', 'nvme-temp-crit', 'net-warn', 'net-crit',
    'color-normal', 'color-warn', 'color-crit',
];
const camel = k => k.replace(/-(\w)/g, (_m, c) => c.toUpperCase());

const DEFAULT_COLORS = ['#FFFFFF', '#FFA726', '#FF5252'];
const HISTORY_KEYS = ['cpuLoad', 'cpuTemp', 'gpuLoad', 'gpuTemp', 'vram', 'ram', 'netDown', 'netUp'];
const HISTORY_SECONDS = 300;
// Reserved width per panel field kind = typical widest value in the panel font
// (tabular digits). Rarer wider values (100%, 1.2M) widen the field temporarily.
const FIELD_SAMPLES = { temp: '00°', pct: '00%', gib: '00.0G', rate: '000k', power: '000W' };

// Returns [r, g, b] in 0..255 or null.
function parseColor(str) {
    try {
        if (Clutter.Color && Clutter.Color.from_string) {
            const [ok, c] = Clutter.Color.from_string(str);
            if (ok)
                return [c.red, c.green, c.blue];
        }
    } catch (e) {
        // fall through to the regex parser
    }
    let m = /^#([0-9a-f]{6})$/i.exec(str || '');
    if (m)
        return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(str || '');
    return m ? [1, 2, 3].map(i => Math.min(255, Number(m[i]))) : null;
}

const logError = e => global.logError(`${UUID}: ${e}\n${e.stack || ''}`);

class HeatMonApplet extends Applet.TextApplet {
    _init(metadata, orientation, panelHeight, instanceId) {
        super._init(orientation, panelHeight, instanceId);
        this.set_applet_tooltip(_('Heat & Load Monitor'));
        this._applet_label.hide();
        this._panelBox = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_child(this._panelBox);
        this._panelWidgets = [];
        this._panelSig = null;
        this._fieldWidths = null;
        this._panelBox.connect('style-changed', () => this._measureFieldWidths());

        this.cfg = {};
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        for (const key of SETTING_KEYS)
            this.settings.bindWithObject(this.cfg, key, camel(key), () => this._onSettingChanged(key));
        this._rebuildPalette();

        this._ready = false;
        this._destroyed = false;
        this._ticking = false;
        this._popupBusy = false;
        this._cpuSensors = null;
        this._nvme = [];
        this._cpuModel = null;
        this._cpuPrev = null;
        this._timerId = 0;
        this._panelText = '';
        this._snap = null;
        this._netPrev = null;
        this._history = {};
        for (const k of HISTORY_KEYS)
            this._history[k] = [];

        this._hasSystemMonitor = GLib.find_program_in_path('gnome-system-monitor') !== null;
        const gpuAvailable = Src.NvidiaSmi.available();
        this._gpu = gpuAvailable ? new Src.NvidiaSmi() : null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._popup = new DetailsPopup(this.menu, {
            gpuAvailable,
            hasSystemMonitor: this._hasSystemMonitor,
            openSystemMonitor: () => this._openSystemMonitor(),
        });
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (!open)
                return;
            this._refreshInterfaceOptions().catch(logError);
            this._popup.setIPv4(null);
            Src.lookupIPv4(this._snap ? this._snap.iface : null, ip => {
                if (!this._destroyed)
                    this._popup.setIPv4(ip);
            });
            this._renderPopup();
        });

        this._setup().catch(logError);
    }

    // Sensor discovery runs once; hwmon paths are re-discovered if they vanish.
    async _setup() {
        const [cpuSensors, nvme, cpuModel, stat] = await Promise.all([
            Src.findCpuSensors(), Src.findNvmeSensors(), Src.readCpuModel(), Src.readText('/proc/stat'),
        ]);
        if (this._destroyed)
            return;
        this._cpuSensors = cpuSensors;
        this._nvme = nvme;
        this._cpuModel = cpuModel;
        this._cpuPrev = M.parseCpuStat(stat);
        this._ready = true;
        await this._refreshInterfaceOptions();
        this._restartSampling();
    }

    _onSettingChanged(key) {
        if (key === 'update-interval' && this._ready)
            this._restartSampling();
        else if (key.startsWith('color-'))
            this._rebuildPalette();
        this._render();
    }

    _rebuildPalette() {
        const keys = ['colorNormal', 'colorWarn', 'colorCrit'];
        const rgb255 = keys.map((k, i) => parseColor(this.cfg[k]) || parseColor(DEFAULT_COLORS[i]));
        this._palette = {
            hex: rgb255.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')),
            rgb: rgb255.map(c => c.map(v => v / 255)),
        };
    }

    _restartSampling() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        const interval = Math.max(1, Math.round(this.cfg.updateInterval || 2));
        this._capacity = Math.ceil(HISTORY_SECONDS / interval);
        for (const k of HISTORY_KEYS) {
            const h = this._history[k];
            if (h.length > this._capacity)
                h.splice(0, h.length - this._capacity);
        }
        if (this._gpu) {
            this._gpu.stop();
            this._gpu.start(interval * 1000);
        }
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._tick().catch(logError);
            return GLib.SOURCE_CONTINUE;
        });
        this._tick().catch(logError);
    }

    async _readCpuTemp() {
        if (!this._cpuSensors)
            return null;
        let t = await Src.readMilliC(this._cpuSensors.packagePath);
        if (t === null) {
            // hwmon indices can change (e.g. module reload) → rediscover once
            this._cpuSensors = await Src.findCpuSensors();
            t = this._cpuSensors ? await Src.readMilliC(this._cpuSensors.packagePath) : null;
        }
        return t;
    }

    _sampleNet(now, routeText, devText) {
        const iface = this.cfg.netInterface || M.parseDefaultRoute(routeText);
        const counters = iface ? M.parseNetDev(devText).get(iface) : undefined;
        const out = { iface, mode: this.cfg.netInterface ? 'pinned' : 'auto', down: null, up: null, rxTotal: null, txTotal: null };
        if (!counters) {
            this._netPrev = null;
            return out;
        }
        out.rxTotal = counters.rx;
        out.txTotal = counters.tx;
        const prev = this._netPrev;
        this._netPrev = { iface, rx: counters.rx, tx: counters.tx, time: now };
        if (prev && prev.iface === iface && now > prev.time) {
            const sec = (now - prev.time) / 1e6;
            out.down = Math.max(0, counters.rx - prev.rx) * 8 / sec;
            out.up = Math.max(0, counters.tx - prev.tx) * 8 / sec;
        }
        return out;
    }

    async _tick() {
        if (this._ticking || this._destroyed)
            return;
        this._ticking = true;
        try {
            await this._sample();
        } finally {
            this._ticking = false;
        }
    }

    async _sample() {
        const [statText, memText, routeText, devText, cpuTemp, nvmeTemps] = await Promise.all([
            Src.readText('/proc/stat'), Src.readText('/proc/meminfo'),
            Src.readText('/proc/net/route'), Src.readText('/proc/net/dev'),
            this._readCpuTemp(), Promise.all(this._nvme.map(d => Src.readMilliC(d.path))),
        ]);
        if (this._destroyed)
            return;
        const now = GLib.get_monotonic_time();
        const interval = Math.max(1, Math.round(this.cfg.updateInterval || 2));
        const s = {};

        const stat = M.parseCpuStat(statText);
        s.cpuLoad = M.cpuLoadPercent(this._cpuPrev, stat);
        if (stat)
            this._cpuPrev = stat;
        s.cpuTemp = cpuTemp;

        const g = this._gpu && this._gpu.latest;
        s.gpu = g && now - g.time <= (3 * interval + 1) * 1e6 ? g : null;
        s.vramPct = s.gpu && s.gpu.memUsedMiB !== null && s.gpu.memTotalMiB
            ? 100 * s.gpu.memUsedMiB / s.gpu.memTotalMiB : null;

        const mem = M.parseMemInfo(memText);
        if (mem && mem.total !== null && mem.available !== null) {
            s.ramTotal = mem.total;
            s.ramUsed = mem.total - mem.available;
            s.ramPct = 100 * s.ramUsed / mem.total;
            s.swapTotal = mem.swapTotal;
            s.swapUsed = mem.swapTotal !== null && mem.swapFree !== null ? mem.swapTotal - mem.swapFree : null;
        } else {
            s.ramTotal = s.ramUsed = s.ramPct = s.swapTotal = s.swapUsed = null;
        }

        s.nvme = this._nvme.map((d, i) => ({ model: d.model, temp: nvmeTemps[i] }));
        const temps = nvmeTemps.filter(t => t !== null);
        s.nvmeMax = temps.length ? Math.max(...temps) : null;

        Object.assign(s, this._sampleNet(now, routeText, devText));
        this._snap = s;

        const sample = {
            cpuLoad: s.cpuLoad, cpuTemp: s.cpuTemp,
            gpuLoad: s.gpu ? s.gpu.load : null, gpuTemp: s.gpu ? s.gpu.temp : null,
            vram: s.vramPct, ram: s.ramPct, netDown: s.down, netUp: s.up,
        };
        for (const k of HISTORY_KEYS) {
            const h = this._history[k];
            h.push(sample[k]);
            if (h.length > this._capacity)
                h.splice(0, h.length - this._capacity);
        }
        this._render();
    }

    _render() {
        if (!this._snap)
            return;
        this._renderPanel();
        if (this.menu.isOpen)
            this._renderPopup();
    }

    // Panel = row of St.Labels. Value fields sit in boxes whose min-width is the
    // measured width of the widest sample in the panel font, right-aligned, so
    // fields keep a fixed width without monospace gaps.
    _renderPanel() {
        const s = this._snap, c = this.cfg, hex = this._palette.hex;
        const tokens = [];
        const T = text => tokens.push({ text });
        const V = (kind, lvl, text) => tokens.push({ kind, lvl, text: text.trim() });
        const segment = () => {
            if (tokens.length)
                tokens.push({ sep: true });
        };

        if (c.showCpu) {
            T('CPU ');
            V('temp', M.level(s.cpuTemp, c.cpuTempWarn, c.cpuTempCrit), M.fmtTemp(s.cpuTemp));
            T(' ');
            V('pct', M.level(s.cpuLoad, c.cpuLoadWarn, c.cpuLoadCrit), M.fmtPercent(s.cpuLoad));
        }
        if (c.showGpu && this._gpu) {
            const g = s.gpu || {};
            const vramBytes = typeof g.memUsedMiB === 'number' ? g.memUsedMiB * 2 ** 20 : null;
            segment();
            T('GPU ');
            V('temp', M.level(g.temp, c.gpuTempWarn, c.gpuTempCrit), M.fmtTemp(g.temp));
            T(' ');
            V('pct', M.level(g.load, c.gpuLoadWarn, c.gpuLoadCrit), M.fmtPercent(g.load));
            T(' ');
            V('gib', M.level(s.vramPct, c.vramWarn, c.vramCrit), M.fmtGiBShort(vramBytes));
            if (c.showGpuPower) {
                T(' ');
                V('power', 0, M.fmtPowerShort(g.powerW));
            }
            if (c.showGpuFan) {
                T(' FAN ');
                V('pct', 0, M.fmtPercent(g.fanPct));
            }
        }
        if (c.showRam) {
            segment();
            T('RAM ');
            V('gib', M.level(s.ramPct, c.ramWarn, c.ramCrit), M.fmtGiBShort(s.ramUsed));
            if (c.showSwap) {
                T(' SWP ');
                V('gib', 0, M.fmtGiBShort(s.swapUsed));
            }
        }
        if (c.showNvme && this._nvme.length) {
            segment();
            T('SSD ');
            V('temp', M.level(s.nvmeMax, c.nvmeTempWarn, c.nvmeTempCrit), M.fmtTemp(s.nvmeMax));
        }
        if (c.showNet) {
            const lv = v => M.level(v === null ? null : v / 1e6, c.netWarn, c.netCrit);
            segment();
            T('↓');
            V('rate', lv(s.down), M.fmtRateShort(s.down));
            T(' ↑');
            V('rate', lv(s.up), M.fmtRateShort(s.up));
        }
        if (!tokens.length)
            T('SysMon');

        const sig = tokens.map(t => t.sep ? '|' : t.kind ? `#${t.kind}` : t.text).join('\u0001');
        if (sig !== this._panelSig) {
            this._panelSig = sig;
            this._buildPanel(tokens);
        }
        const boxStyle = `color: ${hex[0]};`;
        if (this._panelBox.style !== boxStyle)
            this._panelBox.style = boxStyle;
        tokens.forEach((t, i) => {
            if (!t.kind)
                return;
            const label = this._panelWidgets[i].label;
            if (label.text !== t.text)
                label.text = t.text;
            const style = `color: ${hex[t.lvl]};`;
            if (label.style !== style)
                label.style = style;
        });
        this._panelText = tokens.map(t => t.sep ? ' │ ' : t.text).join('');
    }

    _buildPanel(tokens) {
        this._panelBox.destroy_all_children();
        this._panelWidgets = tokens.map(t => {
            if (t.sep) {
                const sep = new St.Label({ text: ' │ ', style: 'color: #9E9E9E;', y_align: Clutter.ActorAlign.CENTER });
                this._panelBox.add_child(sep);
                return sep;
            }
            if (!t.kind) {
                const l = new St.Label({ text: t.text, y_align: Clutter.ActorAlign.CENTER });
                this._panelBox.add_child(l);
                return l;
            }
            const box = new St.Widget({ layout_manager: new Clutter.BinLayout(), y_align: Clutter.ActorAlign.CENTER });
            box.label = new St.Label({ x_align: Clutter.ActorAlign.END, x_expand: true });
            box.kind = t.kind;
            box.add_child(box.label);
            this._panelBox.add_child(box);
            return box;
        });
        this._applyFieldWidths();
    }

    // Measures the widest sample of each field kind in the current panel font.
    _measureFieldWidths() {
        if (!this._panelBox.get_stage())
            return;
        // A fresh label per sample: re-setting text on one label returns a stale width.
        this._fieldWidths = {};
        for (const [kind, sample] of Object.entries(FIELD_SAMPLES)) {
            const probe = new St.Label({ text: sample });
            this._panelBox.add_child(probe);
            this._fieldWidths[kind] = Math.ceil(probe.get_preferred_width(-1)[1]);
            probe.destroy();
        }
        this._applyFieldWidths();
    }

    _applyFieldWidths() {
        if (!this._fieldWidths)
            return;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        for (const w of this._panelWidgets) {
            // CSS min-width (not Clutter min_width) also raises the natural width,
            // so the box layout does not squeeze neighbouring labels.
            if (w.kind)
                w.style = `min-width: ${this._fieldWidths[w.kind] / scale}px;`;
        }
    }

    _renderPopup() {
        if (!this._snap || this._popupBusy)
            return;
        this._popupBusy = true;
        this._renderPopupAsync().catch(logError).finally(() => {
            this._popupBusy = false;
        });
    }

    // Per-core temperatures and frequencies are read only while the popup is open.
    async _renderPopupAsync() {
        const cores = this._cpuSensors ? this._cpuSensors.cores : [];
        const [temps, freqs] = await Promise.all([
            Promise.all(cores.map(core => Src.readMilliC(core.path))),
            Src.readCpuFreqs(),
        ]);
        if (this._destroyed || !this.menu.isOpen)
            return;
        this._popup.update(this._snap, this._history, this._capacity, this._palette, this.cfg, {
            cpuModel: this._cpuModel,
            coreTemps: cores.map((core, i) => ({ label: core.label, temp: temps[i] })),
            freqs,
        });
    }

    async _refreshInterfaceOptions() {
        const names = await Src.listInterfaces();
        if (this._destroyed)
            return;
        const opts = {};
        // English msgid: xlet-settings translates option labels itself
        opts['Automatic (default route)'] = '';
        for (const n of names)
            opts[n] = n;
        const pinned = this.cfg.netInterface;
        if (pinned && !names.includes(pinned))
            opts[_('%s (not found)').format(pinned)] = pinned;
        if (JSON.stringify(this.settings.getOptions('net-interface')) !== JSON.stringify(opts))
            this.settings.setOptions('net-interface', opts);
    }

    _openSystemMonitor() {
        if (this._hasSystemMonitor)
            Util.spawn(['gnome-system-monitor']);
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_middle_clicked() {
        this._openSystemMonitor();
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        if (this._gpu)
            this._gpu.stop();
        this.settings.finalize();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new HeatMonApplet(metadata, orientation, panelHeight, instanceId);
}
