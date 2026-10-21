// Click popup: per-subsystem details and 5-minute history graphs.
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;

Gettext.bindtextdomain(__meta.uuid, GLib.build_filenamev([GLib.get_user_data_dir(), 'locale']));
const _ = s => Gettext.dgettext(__meta.uuid, s);

const M = require('./metrics');

const UP_RGB = [0x4F / 255, 0xC3 / 255, 0xF7 / 255];
const DASH = '—';

const esc = s => GLib.markup_escape_text(String(s), -1);
const num = (v, dec = 0) => typeof v === 'number' && !isNaN(v) ? v.toFixed(dec) : DASH;
// Literal _() calls so xgettext extracts every unit msgid.
const unitLabel = u => ({
    'bit/s': _('bit/s'), 'kbit/s': _('kbit/s'), 'Mbit/s': _('Mbit/s'), 'Gbit/s': _('Gbit/s'),
    'KiB': _('KiB'), 'MiB': _('MiB'), 'GiB': _('GiB'),
})[u];
const unitPair = ([n, u]) => u ? `${n} ${unitLabel(u)}` : n;

class Sparkline {
    constructor() {
        this.actor = new St.DrawingArea({ style_class: 'heatmon-graph' });
        this._series = [];
        this._capacity = 2;
        this._min = 0;
        this._max = 1;
        this.actor.connect('repaint', area => this._draw(area));
    }

    set(series, capacity, min, max) {
        this._series = series;
        this._capacity = Math.max(2, capacity);
        this._min = min;
        this._max = max > min ? max : min + 1;
        this.actor.queue_repaint();
    }

    _draw(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        cr.setSourceRGBA(1, 1, 1, 0.06);
        cr.rectangle(0, 0, w, h);
        cr.fill();

        const step = w / (this._capacity - 1);
        const y = v => h - Math.min(1, Math.max(0, (v - this._min) / (this._max - this._min))) * h;
        cr.setLineWidth(1.5);
        for (const { values, rgb, fill } of this._series) {
            const n = values.length;
            const runs = [];
            let run = null;
            values.forEach((v, i) => {
                if (typeof v !== 'number' || isNaN(v)) {
                    run = null;
                    return;
                }
                if (!run) {
                    run = [];
                    runs.push(run);
                }
                run.push([w - (n - 1 - i) * step, y(v)]);
            });
            for (const pts of runs) {
                if (pts.length < 2)
                    continue;
                if (fill) {
                    cr.moveTo(pts[0][0], h);
                    for (const [px, py] of pts)
                        cr.lineTo(px, py);
                    cr.lineTo(pts[pts.length - 1][0], h);
                    cr.closePath();
                    cr.setSourceRGBA(rgb[0], rgb[1], rgb[2], 0.2);
                    cr.fill();
                }
                cr.moveTo(pts[0][0], pts[0][1]);
                for (const [px, py] of pts.slice(1))
                    cr.lineTo(px, py);
                cr.setSourceRGBA(rgb[0], rgb[1], rgb[2], 1);
                cr.stroke();
            }
        }
        cr.$dispose();
    }
}

class Section {
    constructor(menu, separatorBefore) {
        if (separatorBefore) {
            this.separator = new PopupMenu.PopupSeparatorMenuItem();
            menu.addMenuItem(this.separator);
        }
        this.item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.box = new St.BoxLayout({ vertical: true, style_class: 'heatmon-section' });
        this.item.addActor(this.box, { span: -1, expand: true });
        menu.addMenuItem(this.item);
    }

    label(styleClass) {
        const l = new St.Label({ style_class: styleClass || '' });
        this.box.add_actor(l);
        return l;
    }

    graph(caption) {
        const cap = this.label('heatmon-caption');
        cap.text = caption;
        const g = new Sparkline();
        this.box.add_actor(g.actor);
        return { caption: cap, graph: g };
    }

    setVisible(v) {
        this.item.actor.visible = v;
        if (this.separator)
            this.separator.actor.visible = v;
    }
}

const setMarkup = (label, markup) => {
    if (label._markup !== markup) {
        label._markup = markup;
        label.clutter_text.set_markup(markup);
    }
};

class DetailsPopup {
    constructor(menu, { gpuAvailable, hasSystemMonitor, openSystemMonitor }) {
        this._gpuAvailable = gpuAvailable;
        this._ipv4 = null;

        const cpu = new Section(menu, false);
        this._cpu = {
            title: cpu.label('heatmon-title'),
            main: cpu.label(),
            freq: cpu.label(),
            cores: cpu.label('heatmon-mono'),
            load: cpu.graph(_('Load')),
            temp: cpu.graph(_('Temperature')),
        };

        const gpu = new Section(menu, true);
        if (gpuAvailable) {
            this._gpu = {
                title: gpu.label('heatmon-title'),
                main: gpu.label(),
                vram: gpu.label(),
                power: gpu.label(),
                clocks: gpu.label(),
                load: gpu.graph(_('Load')),
                temp: gpu.graph(_('Temperature')),
                vramGraph: gpu.graph('VRAM'),
            };
        } else {
            gpu.label('heatmon-title').text = 'GPU';
            gpu.label().text = _('nvidia-smi not found');
        }

        const mem = new Section(menu, true);
        mem.label('heatmon-title').text = _('Memory');
        this._mem = { ram: mem.label(), swap: mem.label(), graph: mem.graph('RAM') };

        this._storage = new Section(menu, true);
        this._storage.label('heatmon-title').text = _('Storage');
        this._storageRows = this._storage.label();

        const net = new Section(menu, true);
        net.label('heatmon-title').text = _('Network');
        this._net = {
            iface: net.label(),
            ip: net.label(),
            rate: net.label(),
            totals: net.label(),
            graph: net.graph(''),
        };

        if (hasSystemMonitor) {
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const item = new PopupMenu.PopupIconMenuItem(_('Open System Monitor'),
                'utilities-system-monitor', St.IconType.FULLCOLOR);
            item.connect('activate', openSystemMonitor);
            menu.addMenuItem(item);
        }
    }

    setIPv4(ip) {
        this._ipv4 = ip;
        setMarkup(this._net.ip, `IPv4  ${esc(ip || DASH)}`);
    }

    update(s, hist, capacity, palette, c, details) {
        const hex = palette.hex;
        const C = (lvl, text) => `<span foreground="${hex[lvl]}">${esc(text)}</span>`;
        const K = text => esc(text);
        const fillOf = (values, lvl) => [{ values, rgb: palette.rgb[lvl], fill: true }];

        // CPU
        const cpuTempLvl = M.level(s.cpuTemp, c.cpuTempWarn, c.cpuTempCrit);
        const cpuLoadLvl = M.level(s.cpuLoad, c.cpuLoadWarn, c.cpuLoadCrit);
        const cpu = this._cpu;
        cpu.title.text = details.cpuModel ? `CPU · ${details.cpuModel}` : 'CPU';
        setMarkup(cpu.main, K(_('Temperature %s     Load %s')).format(
            C(cpuTempLvl, `${num(s.cpuTemp)} °C`), C(cpuLoadLvl, `${num(s.cpuLoad)} %`)));
        const f = details.freqs;
        cpu.freq.text = f
            ? _('Frequency %s GHz avg · %s GHz max').format(f.avgGHz.toFixed(2), f.maxGHz.toFixed(2))
            : _('Frequency %s').format(DASH);
        const lines = [];
        for (let i = 0; i < details.coreTemps.length; i += 4) {
            lines.push(details.coreTemps.slice(i, i + 4).map(({ label, temp }) =>
                K(label.padEnd(4)) + C(M.level(temp, c.cpuTempWarn, c.cpuTempCrit), M.fmtTemp(temp)))
                .join('    '));
        }
        setMarkup(cpu.cores, lines.join('\n'));
        cpu.cores.visible = lines.length > 0;
        cpu.load.graph.set(fillOf(hist.cpuLoad, cpuLoadLvl), capacity, 0, 100);
        cpu.temp.graph.set(fillOf(hist.cpuTemp, cpuTempLvl), capacity, 20, 100);

        // GPU
        if (this._gpuAvailable) {
            const g = s.gpu || {};
            const gpu = this._gpu;
            const tLvl = M.level(g.temp, c.gpuTempWarn, c.gpuTempCrit);
            const lLvl = M.level(g.load, c.gpuLoadWarn, c.gpuLoadCrit);
            const vLvl = M.level(s.vramPct, c.vramWarn, c.vramCrit);
            gpu.title.text = g.name ? `GPU · ${g.name}` : 'GPU';
            setMarkup(gpu.main, K(_('Temperature %s     Load %s')).format(
                C(tLvl, `${num(g.temp)} °C`), C(lLvl, `${num(g.load)} %`)));
            const mib = v => typeof v === 'number' ? v * 2 ** 20 : null;
            setMarkup(gpu.vram, `VRAM  ${C(vLvl, `${unitPair(M.fmtBytesLong(mib(g.memUsedMiB)))} / ` +
                `${unitPair(M.fmtBytesLong(mib(g.memTotalMiB)))} (${num(s.vramPct)} %)`)}`);
            gpu.power.text = _('Power %s / %s W     Fan %s').format(
                num(g.powerW), num(g.powerLimitW), `${num(g.fanPct)} %`);
            gpu.clocks.text = _('Clocks: core %s MHz · memory %s MHz').format(
                num(g.clockGrMHz), num(g.clockMemMHz));
            gpu.load.graph.set(fillOf(hist.gpuLoad, lLvl), capacity, 0, 100);
            gpu.temp.graph.set(fillOf(hist.gpuTemp, tLvl), capacity, 20, 100);
            gpu.vramGraph.graph.set(fillOf(hist.vram, vLvl), capacity, 0, 100);
        }

        // Memory
        const rLvl = M.level(s.ramPct, c.ramWarn, c.ramCrit);
        setMarkup(this._mem.ram, `RAM  ${C(rLvl, `${unitPair(M.fmtBytesLong(s.ramUsed))} / ` +
            `${unitPair(M.fmtBytesLong(s.ramTotal))} (${num(s.ramPct)} %)`)}`);
        const swapPct = s.swapTotal ? 100 * s.swapUsed / s.swapTotal : null;
        this._mem.swap.text = _('Swap %s / %s (%s)').format(
            unitPair(M.fmtBytesLong(s.swapUsed)), unitPair(M.fmtBytesLong(s.swapTotal)), `${num(swapPct)} %`);
        this._mem.graph.graph.set(fillOf(hist.ram, rLvl), capacity, 0, 100);

        // Storage
        this._storage.setVisible(s.nvme.length > 0);
        setMarkup(this._storageRows, s.nvme.map(d =>
            `${K(d.model)}  ${C(M.level(d.temp, c.nvmeTempWarn, c.nvmeTempCrit), `${num(d.temp)} °C`)}`).join('\n'));

        // Network
        const net = this._net;
        if (!s.iface)
            net.iface.text = _('No active connection');
        else if (s.mode === 'pinned')
            net.iface.text = _('Interface %s (pinned)').format(s.iface);
        else
            net.iface.text = _('Interface %s (automatic)').format(s.iface);
        this.setIPv4(this._ipv4);
        const lv = v => M.level(v === null ? null : v / 1e6, c.netWarn, c.netCrit);
        setMarkup(net.rate, `↓ ${C(lv(s.down), unitPair(M.fmtRateLong(s.down)))}     ` +
            `↑ ${C(lv(s.up), unitPair(M.fmtRateLong(s.up)))}`);
        net.totals.text = _('Received %s · Sent %s').format(
            unitPair(M.fmtBytesLong(s.rxTotal)), unitPair(M.fmtBytesLong(s.txTotal)));
        const nums = hist.netDown.concat(hist.netUp).filter(v => typeof v === 'number');
        const peak = nums.length ? Math.max(...nums) : 0;
        net.graph.caption.text = _('↓ / ↑ · peak %s').format(unitPair(M.fmtRateLong(peak)));
        net.graph.graph.set([
            { values: hist.netDown, rgb: palette.rgb[0], fill: true },
            { values: hist.netUp, rgb: UP_RGB, fill: false },
        ], capacity, 0, Math.max(peak, 1e6));
    }
}

module.exports = { DetailsPopup };
