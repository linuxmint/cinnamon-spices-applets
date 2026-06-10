const Applet     = imports.ui.applet;
const Main       = imports.ui.main;
const Mainloop   = imports.mainloop;
const Settings   = imports.ui.settings;
const St         = imports.gi.St;
const Clutter    = imports.gi.Clutter;
const GLib       = imports.gi.GLib;
const Util       = imports.misc.util;
const Pango      = imports.gi.Pango;
const GdkPixbuf  = imports.gi.GdkPixbuf;
const Cogl       = imports.gi.Cogl;

const UUID       = 'yasm@sniemetz';

// Graph colors — edit here to retheme all canvas graphs at once.
// Values are [red, green, blue, alpha] in 0-1 range for Cairo.
const C = {
  ok:     [0.35, 0.90, 0.35, 0.85],  // green  — default / below warn
  warn:   [1.00, 0.75, 0.10, 0.90],  // amber  — warn threshold
  alert:  [1.00, 0.20, 0.20, 0.90],  // red    — alert threshold
  blue:   [0.40, 0.70, 1.00, 0.85],  // TX / disk I/O
  purple: [0.70, 0.50, 1.00, 0.85],  // RX
  draw:   [1.00, 0.40, 0.40, 0.85],  // battery draw / discharge
};
const AppletPath = imports.ui.appletManager.appletMeta[UUID].path;
imports.searchPath.unshift(AppletPath);

const { MetricsManager } = imports.lib.metricsManager;
const { parseList } = imports.lib.util;
const fileutil      = imports.lib.fileutil;
const Discover      = imports.lib.discover;
const UptimeMetric  = imports.lib.metrics.uptime;
const BatteryMetric = imports.lib.metrics.battery;
const CpuMetric     = imports.lib.metrics.cpu;
const MemoryMetric  = imports.lib.metrics.memory;
const DiskMetric    = imports.lib.metrics.disk;
const NetworkMetric = imports.lib.metrics.network;
const FanMetric     = imports.lib.metrics.fan;
const ProcessMetric = imports.lib.metrics.processes;
const GpuMetric     = imports.lib.metrics.gpu;

var LaptopTooltip = class LaptopTooltip {
  constructor(owner, orientation) {
    this._owner       = owner;
    this._orientation = orientation;
    this._rowWidgets  = [];

    this._box = new St.BoxLayout({ vertical: true, reactive: false });
    this._box.add_style_class_name('yasm-tooltip');
    global.stage.add_actor(this._box);
    this._box.hide();

    this._eSig = owner.connect('enter-event', () => this._show());
    this._lSig = owner.connect('leave-event', () => this._box.hide());
    this._rSig = owner.connect('button-press-event', (_a, ev) => {
      if (ev.get_button() === 3 && this._box.visible) { this._box.hide(); }
      return Clutter.EVENT_PROPAGATE;
    });
  }

  // items: [{type:'text', html} | {type:'graph', left, right, series, height, mode}]
  // series: [{vals, color, dir, maxV}]  dir: 'up'(default)|'down'
  // mode: 'up'(default) | 'bidir' (center-split, series[0]=up series[1]=down) | 'stacked'
  setContent(items) {
    const cur = this._rowWidgets;
    if (cur.length === items.length && cur.every((rw, i) => rw.type === items[i].type)) {
      items.forEach((item, i) => this._updateRow(cur[i], item));
      return;
    }
    for (const rw of cur) {
      try { this._box.remove_actor(rw.actor); rw.actor.destroy(); } catch(e) {}
    }
    this._rowWidgets = [];
    for (const item of items) {
      const rw = this._createRow(item);
      this._box.add_actor(rw.actor);
      this._rowWidgets.push(rw);
    }
  }

  set_text(text) { this.setContent([{ type: 'text', html: text || '' }]); }

  _createRow(item) {
    if (item.type === 'text') {
      const lbl = new St.Label();
      lbl.add_style_class_name('yasm-tooltip-text');
      lbl.clutter_text.use_markup     = true;
      lbl.clutter_text.line_wrap      = true;
      lbl.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
      try { lbl.clutter_text.set_markup(item.html || ''); } catch(e) { lbl.set_text(item.html || ''); }
      return { type: 'text', actor: lbl, lbl };
    }
    // type === 'graph' — horizontal row: [leftLbl] [canvas] [rightLbl]
    const hbox = new St.BoxLayout({ vertical: false });
    hbox.add_style_class_name('yasm-graph-row');
    let _styles = "";
      if (item.marginTop) _styles += `margin-top: ${item.marginTop}px;`;
      if (item.marginBottom) _styles += `margin-bottom: ${item.marginBottom}px;`;
    if (_styles) hbox.set_style(_styles);
    const leftLbl = new St.Label({ text: item.left || '' });
    leftLbl.add_style_class_name('yasm-graph-label');
    leftLbl.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    leftLbl.set_x_align(Clutter.ActorAlign.END);
    if (!item.left) leftLbl.hide();
    hbox.add_actor(leftLbl);

    const sh = { series: item.series || [], mode: item.mode || 'up', splitFrac: item.splitFrac };
    const canvas = new St.DrawingArea({ width: item.canvasWidth || 180, height: item.height || 20 });
    canvas.add_style_class_name('yasm-graph-canvas');
    if (item.dir) canvas.add_style_class_name(item.dir);
    canvas.connect('repaint', area => {
      const ctx = area.get_context();
      try { this._paintSeries(ctx, area.get_width(), area.get_height(), sh.series, sh.mode, sh.splitFrac); }
      finally { ctx.$dispose(); }
    });
    hbox.add_actor(canvas);

    const rightLbl = new St.Label({ text: item.right || '' });
    rightLbl.add_style_class_name('yasm-graph-label');
    rightLbl.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    if (!item.right) rightLbl.hide();
    hbox.add_actor(rightLbl);

    return { type: 'graph', actor: hbox, leftLbl, canvas, rightLbl, sh };
  }

  _updateRow(rw, item) {
    if (item.type === 'text') {
      try { rw.lbl.clutter_text.set_markup(item.html || ''); }
      catch(e) { rw.lbl.set_text(item.html || ''); }
    } else {
      rw.leftLbl.set_text(item.left || '');
      if (item.left) { rw.leftLbl.show(); } else { rw.leftLbl.hide(); }
      rw.rightLbl.set_text(item.right || '');
      if (item.right) { rw.rightLbl.show(); } else { rw.rightLbl.hide(); }
      rw.sh.series    = item.series || [];
      rw.sh.mode      = item.mode || 'up';
      rw.sh.splitFrac = item.splitFrac;
      rw.canvas.queue_repaint();
    }
  }

  _paintSeries(ctx, w, h, series, mode, splitFrac) {
    if (!series || series.length === 0) return;
    const barW = 1;
    const n    = Math.floor(w / barW);
    const p95  = arr => {
      const s = arr.filter(v => v != null && v > 0).sort((a, b) => a - b);
      return s.length ? (s[Math.floor(s.length * 0.95)] || s[s.length - 1]) : 0;
    };

    if (mode === 'bidir') {
      const mid = splitFrac !== undefined ? Math.round(splitFrac * h) : Math.round(h / 2);
      const [cr, cg, cb] = (series[0] && series[0].color) || [1, 1, 1];
      ctx.setSourceRGBA(cr, cg, cb, 0.2);
      ctx.rectangle(0, mid - 0.5, w, 1);
      ctx.fill();

      for (const s of series) {
        const [r, g, b, a] = s.color || [1, 1, 1, 0.85];
        ctx.setSourceRGBA(r, g, b, a);
        const vals = (s.vals || []).slice(-n);
        const maxV  = Math.max(p95(vals.filter(v => v != null)), 0.1);
        const avail = s.dir === 'down' ? (h - mid - 1) : (mid - 1);
        const sc    = v => Math.min(avail, Math.max(1, v / maxV * avail));
        const startX = w - vals.length * barW;
        vals.forEach((v, i) => {
          if (!v) return;
          const bh = sc(v);
          const x  = startX + i * barW;
          if (s.dir === 'down') { ctx.rectangle(x, mid,      barW, bh); }
          else                  { ctx.rectangle(x, mid - bh, barW, bh); }
          ctx.fill();
        });
      }

    } else if (mode === 'stacked') {
      const s0 = series[0] || {}, s1 = series[1] || {};
      const v0 = (s0.vals || []).slice(-n);
      const v1 = (s1.vals || []).slice(-n);
      const len = Math.max(v0.length, v1.length);
      const startX = w - len * barW;
      for (let i = 0; i < len; i++) {
        const a = v0[i] != null ? v0[i] : 0;
        const b = v1[i] != null ? v1[i] : 0;
        const total = (a + b) || 1;
        const h0 = Math.round((a / total) * h);
        const h1 = h - h0;
        const x  = startX + i * barW;
        if (h0 > 0) {
          const [r, g, bv, al] = s0.color || C.draw;
          ctx.setSourceRGBA(r, g, bv, al);
          ctx.rectangle(x, h - h0, barW, h0);
          ctx.fill();
        }
        if (h1 > 0) {
          const [r, g, bv, al] = s1.color || C.ok;
          ctx.setSourceRGBA(r, g, bv, al);
          ctx.rectangle(x, h - h0 - h1, barW, h1);
          ctx.fill();
        }
      }

    } else { // 'up' / 'down' — single series
      const s0 = series[0] || {};
      const vals = (s0.vals || []).slice(-n);
      const nonNull = vals.filter(v => v != null && v > 0);
      const maxV = s0.maxV !== undefined ? s0.maxV : Math.max(p95(nonNull), 0.1);
      const sc = v => Math.min(h - 1, Math.max(1, v / maxV * (h - 1)));
      const startX = w - vals.length * barW;
      const down = s0.dir === 'down';
      const defColor = s0.color || [1, 1, 1, 0.85];
      const thr = s0.thresholds;
      vals.forEach((v, i) => {
        if (v == null || v === 0) return;
        const bh = sc(v);
        let col;
        if (thr) {
          const lvl = thr.inverted
            ? (v <= thr.alert ? 'alert' : v <= thr.warn ? 'warn' : 'ok')
            : (v >= thr.alert ? 'alert' : v >= thr.warn ? 'warn' : 'ok');
          col = lvl === 'alert' ? C.alert
              : lvl === 'warn'  ? C.warn
              : defColor;
        } else {
          col = defColor;
        }
        ctx.setSourceRGBA(...col);
        ctx.rectangle(startX + i * barW, down ? 0 : h - bh, barW, bh);
        ctx.fill();
      });
    }
  }

  _show() {
    this._box.show();
    const [ox, oy] = this._owner.get_transformed_position();
    const [, oh]   = this._owner.get_transformed_size();
    const [bw, bh] = this._box.get_size();
    const monitor  = Main.layoutManager.primaryMonitor;
    const x = Math.max(monitor.x, Math.min(ox, monitor.x + monitor.width - bw));
    const y = this._orientation === St.Side.TOP ? oy + oh : oy - bh;
    this._box.set_position(Math.round(x), Math.round(y));
  }

  destroy() {
    try { this._owner.disconnect(this._eSig); } catch(e) {}
    try { this._owner.disconnect(this._lSig); } catch(e) {}
    try { this._owner.disconnect(this._rSig); } catch(e) {}
    this._rowWidgets = [];
    global.stage.remove_actor(this._box);
    try { this._box.destroy(); } catch(e) {}
  }
};

// Maps section key → default icon filename
const ICON_FILES = {
  uptime: 'up_default.png', battery: 'bat_default.png', cpu: 'cpu_default.png',
  memory: 'mem_default.png', disk: 'disk_default.png', network: 'net_default.png',
  fan: 'fan_default.png', gpu: 'gpu_default.png',
};

var SECTIONS = [
  { key: 'uptime'  },
  { key: 'cpu'     },
  { key: 'battery' },
  { key: 'memory'  },
  { key: 'disk'    },
  { key: 'network' },
  { key: 'fan'     },
  { key: 'gpu'     },
];

// Load a PNG/SVG file into a Clutter.Actor using GdkPixbuf + Clutter.Image.
// Avoids St.Icon (goes through GTK icon theme) and CSS url() (unreliable in Clutter).
function makeIconActor(path, size) {
  try {
    const pb    = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, size, size, true);
    const img   = new Clutter.Image();
    img.set_bytes(
      pb.get_pixels(),
      pb.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
      pb.get_width(), pb.get_height(), pb.get_rowstride()
    );
    const actor = new St.Widget({ width: size, height: size });
    actor.set_content(img);
    actor.set_y_align(Clutter.ActorAlign.CENTER);
    actor.add_style_class_name('yasm-tile-icon');
    return actor;
  } catch(e) {
    log(`[yasm] makeIconActor failed for ${path}: ${e}`);
    return null;
  }
}

class YasmApplet extends Applet.Applet {
  constructor(metadata, orientation, panelHeight, instanceId) {
    super(orientation, panelHeight, instanceId);
    this._orientation = orientation;

    this._instanceId = instanceId;
    this._tempAlertNotified = false;
    this._settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._bindSettings();
    this._autoScanIfEmpty();
    this._buildSections();

    this._manager = new MetricsManager(this, (data, history) => {
      this._updateSections(data, history);
    });

    this._startPolling();
  }

  _getColoredIconSize() {
    return Math.max(16, Math.round((this._panelHeight || 40) * 0.6));
  }


  _autoScanIfEmpty() {
    const empty = l => parseList(l).length === 0;
    if (empty(this._batteryList) || empty(this._netList) ||
        empty(this._fanHwmonList) || empty(this._diskList))
      this.refreshSources();
  }

  _bindSettings() {
    const bind = (key, prop, cb) => this._settings.bind(key, prop, cb || null);
    bind('refresh-interval', '_refreshInterval', () => this._restartPolling());
    bind('panel-separator',   '_separator');
    bind('uptime-load-label', '_uptimeLoadLabel');
    bind('battery-list',      '_batteryList',    () => this._restartManager());
    bind('net-list',         '_netList');
    bind('disk-list',        '_diskList');
    bind('fan-hwmon-list',   '_fanHwmonList', () => this._restartManager());

    bind('load-warn',      '_loadWarn');
    bind('load-alert',     '_loadAlert');
    bind('cpu-temp-warn',  '_cpuTempWarn');
    bind('cpu-temp-alert', '_cpuTempAlert');
    bind('cpu-use-warn',   '_cpuUseWarn');
    bind('cpu-use-alert',  '_cpuUseAlert');
    bind('bat-warn',       '_batWarn');
    bind('bat-alert',      '_batAlert');

    for (const { key } of SECTIONS) {
      bind(`${key}-enabled`, `_${key}Enabled`);
      bind(`${key}-display`, `_${key}Display`, () => this._rebuildSections());
      bind(`${key}-label`,   `_${key}SectionLabel`, () => this._rebuildSections());
    }
    // Load avg display is a sub-control of the uptime tile, not a separate section
    bind('load-display', '_loadDisplay', () => this._rebuildSections());
  }

  // Called by the Refresh Sources button in settings
  refreshSources() {
    const bats   = Discover.discoverBatteries(fileutil);
    const ifaces = Discover.discoverNetInterfaces(fileutil);

    const newBats = bats.map(d => ({ enabled: true, device: d, label: '' }));
    this._settings.setValue('battery-list',
      Discover.mergeLists(newBats, parseList(this._batteryList), 'device'));

    const newIfaces = ifaces.map(i => ({ enabled: true, iface: i, label: '' }));
    this._settings.setValue('net-list',
      Discover.mergeLists(newIfaces, parseList(this._netList), 'iface'));

    const fanChips = FanMetric.findFanChips(fileutil);
    const newFans  = fanChips.map(c => ({ enabled: true, hwmon: String(c.hwmon), name: c.name }));
    this._settings.setValue('fan-hwmon-list',
      Discover.mergeHwmonLists(newFans, parseList(this._fanHwmonList)));

    const diskDevs = Discover.discoverDiskDevices(fileutil);
    const newDisks = diskDevs.map(d => ({ enabled: true, device: d }));
    this._settings.setValue('disk-list',
      Discover.mergeLists(newDisks, parseList(this._diskList), 'device'));
  }

  enableRapl() {
    const script = `${AppletPath}/setup-rapl.sh`;
    fileutil.spawnAsync(['pkexec', 'bash', script], result => {
      // result is null on error, stdout string on success
      Mainloop.timeout_add_seconds(1, () => { this._restartManager(); return GLib.SOURCE_REMOVE; });
    });
  }

  _isVertical() {
    return this._orientation === St.Side.LEFT || this._orientation === St.Side.RIGHT;
  }

  on_orientation_changed(orientation) {
    this._orientation = orientation;
    this._rebuildSections();
  }

  on_panel_height_changed() {
    this._rebuildSections();
  }

  _rebuildSections() {
    if (this._sections) {
      for (const { tooltip } of Object.values(this._sections))
        try { tooltip.destroy(); } catch(e) {}
    }
    this.actor.get_children().forEach(c => this.actor.remove_actor(c));
    this._buildSections();
    if (this._manager) this._manager.collect();
  }

  _buildSections() {
    // Always clean up first — constructor callbacks may have already built sections
    if (this._sections) {
      for (const { tooltip } of Object.values(this._sections))
        try { tooltip.destroy(); } catch(e) {}
    }
    this.actor.get_children().forEach(c => this.actor.remove_actor(c));

    this._sections = {};
    const vertical = this._isVertical();
    this.actor.vertical = vertical;
    this.actor.add_style_class_name('yasm-box');

    for (const { key } of SECTIONS) {
      const sep = new St.Label({ text: this._separator || '  |  ' });
      sep.hide();
      sep.add_style_class_name('yasm-sep');
      sep.set_y_align(Clutter.ActorAlign.CENTER);
      sep.set_y_expand(true);
      this.actor.add_actor(sep);

      // Tile: BoxLayout containing [icon?] + label — the whole tile is one reactive actor
      const tile = new St.BoxLayout({ reactive: true, track_hover: true });
      tile.hide();
      tile.add_style_class_name('yasm-label');
      tile.add_style_class_name('threshold-ok');
      if (vertical) tile.add_style_class_name('yasm-label-vertical');
      tile.set_y_align(Clutter.ActorAlign.CENTER);

      const iconSize = this._getColoredIconSize();
      const pad = Math.max(1, Math.round(iconSize * 0.12));
      const brd = Math.max(1, Math.round(iconSize * 0.06));
      const spc = Math.max(2, Math.round(iconSize * 0.12));
      tile.set_style(`padding: ${pad}px ${pad + 2}px; border-width: ${brd}px;`);
      tile.spacing = spc;

      // Show icon or placeholder spacer based on display switch
      const showIcon  = !!this[`_${key}Display`];
      const iconPath  = showIcon ? `${AppletPath}/icons/${ICON_FILES[key]}` : null;
      const iconActor = iconPath ? makeIconActor(iconPath, iconSize) : null;
      if (iconActor) {
        tile.add_actor(iconActor);
      } else {
        tile.add_actor(new St.Widget({ width: 0, height: iconSize }));
      }

      // Battery: pre-load both bat/ac images for dynamic charging-state swap
      let acIconImage  = null;
      let batIconImage = null;
      if (key === 'battery' && showIcon) {
        batIconImage = iconActor ? iconActor.get_content() : null;
        try {
          const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(
            `${AppletPath}/icons/ac_default.png`, iconSize, iconSize, true);
          acIconImage = new Clutter.Image();
          acIconImage.set_bytes(pb.get_pixels(),
            pb.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
            pb.get_width(), pb.get_height(), pb.get_rowstride());
        } catch(e) {}
      }

      // Uptime text label (time portion only, e.g. "1h 5m")
      const label = new St.Label({ text: '' });
      label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
      label.add_style_class_name('yasm-tile-text');
      label.set_y_align(Clutter.ActorAlign.CENTER);
      tile.add_actor(label);

      // Uptime tile: separator + load icon/spacer + load label after the time value
      let loadLabel = null;
      if (key === 'uptime') {
        const sepActor = new St.Label({ text: ' | ' });
        sepActor.set_y_align(Clutter.ActorAlign.CENTER);
        tile.add_actor(sepActor);

        const showLoadIcon = !!this._loadDisplay;
        const loadActor = showLoadIcon
          ? makeIconActor(`${AppletPath}/icons/load_default.png`, iconSize)
          : null;
        if (loadActor) {
          tile.add_actor(loadActor);
        } else {
          tile.add_actor(new St.Widget({ width: 0, height: iconSize }));
        }

        loadLabel = new St.Label({ text: '' });
        loadLabel.set_y_align(Clutter.ActorAlign.CENTER);
        tile.add_actor(loadLabel);
      }

      const tooltip = new LaptopTooltip(tile, this._orientation);
      tooltip.set_text('…loading…');

      if (key === 'uptime') {
        tile.connect('button-press-event', (actor, event) => {
          if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
          if (global.settings.get_boolean('panel-edit-mode')) return Clutter.EVENT_PROPAGATE;
          Util.spawn(['x-terminal-emulator', '-e', 'top']);
          return Clutter.EVENT_STOP;
        });
      }

      this.actor.add_actor(tile);
      this._sections[key] = { sep, tile, label, tooltip, loadLabel, iconActor, acIconImage, batIconImage };
    }

  }

  _startPolling() {
    this._safeCollect();
    // Second collect after 1.5s catches the async df result so disk tile
    // appears immediately rather than waiting for the first full interval.
    this._earlyTimeout = Mainloop.timeout_add(1500, () => {
      this._earlyTimeout = null;
      this._safeCollect();
      return GLib.SOURCE_REMOVE;
    });
    this._timeout = Mainloop.timeout_add_seconds(
      this._refreshInterval || 3,
      () => { this._safeCollect(); return GLib.SOURCE_CONTINUE; }
    );
  }

  _safeCollect() {
    try { this._manager.collect(); }
    catch(e) { log(`[yasm] collect error: ${e}\n${e.stack || ''}`); }
  }

  _restartPolling() {
    if (this._timeout) Mainloop.source_remove(this._timeout);
    this._startPolling();
  }

  _restartManager() {
    this._manager = new MetricsManager(this, (data, history) => {
      this._updateSections(data, history);
    });
  }

  _applyThreshold(label, level) {
    label.remove_style_class_name('threshold-ok');
    label.remove_style_class_name('threshold-warn');
    label.remove_style_class_name('threshold-alert');
    label.add_style_class_name(`threshold-${level}`);
  }

  _buildText(key, dataText) {
    if (this[`_${key}Display`]) return dataText; // icon mode — no label prefix
    const lbl = (this[`_${key}SectionLabel`] || '').trim().slice(0, 20);
    return lbl ? `${lbl}: ${dataText}` : dataText;
  }

  _setSection(key, panelText, tooltipText) {
    const s = this._sections[key];
    s.label.set_text(this._buildText(key, panelText));
    s.tooltip.set_text(tooltipText);
  }

  _updateSections(data, history) {
    const sepStr  = this._separator || '';
    let prevVisible = false;
    const graphColor = lvl => lvl === 'alert' ? C.alert : lvl === 'warn' ? C.warn : null;

    for (const { key } of SECTIONS) {
      const enabled = !!this[`_${key}Enabled`];
      const s = this._sections[key];
      s.sep.set_text(sepStr);

      let hasData = false;

      if (enabled) {
        switch (key) {
          case 'uptime':
            if (data.uptime) {
              const numCores = this._manager.getNumCores();
              const normLoad = data.uptime.load.avg1 / numCores;
              const loadLevel = normLoad >= (this._loadAlert || 0.9) ? 'alert'
                              : normLoad >= (this._loadWarn  || 0.7) ? 'warn' : 'ok';
              this._applyThreshold(s.tile, loadLevel);
              s.label.set_text(this._buildText('uptime', UptimeMetric.formatUptimeOnly(data.uptime.uptime)));
              if (s.loadLabel)
                s.loadLabel.set_text(UptimeMetric.formatLoadOnly(
                  data.uptime.load, this._loadDisplay ? '' : this._uptimeLoadLabel));
              // Build uptime+load text manually so numCores sits right under Load:
              const up = data.uptime.uptime;
              const upParts = [];
              if (up.days > 0) upParts.push(`${up.days}d`);
              upParts.push(`${String(up.hours).padStart(2,'0')}h`);
              upParts.push(`${String(up.minutes).padStart(2,'0')}m`);
              const ld = data.uptime.load;
              const uptimeTxt = [
                `<b>Uptime</b>  ${upParts.join(' ')}`,
                `<b>Load:</b>   ${ld.avg1.toFixed(2)} / ${ld.avg5.toFixed(2)} / ${ld.avg15.toFixed(2)}`,
                `        ${numCores} cores`,
              ].join('\n');
              const procTxt = (typeof ProcessMetric !== 'undefined'
                ? ProcessMetric.formatTooltip(data.processes) : '') + '\n\n<i>Click to open top</i>';
              // Structure: [uptime text] [load graph, no labels] [processes]
              s.tooltip.setContent([
                { type: 'text', html: uptimeTxt },
                { type: 'graph', left: '1min\navg', right: `${ld.avg1.toFixed(2)}`, 
                  height: 20, marginTop: 8, marginBottom: 12,
                  series: [{ vals: history.loadAvg.values(),
                    color: C.ok,
                    thresholds: { warn: (this._loadWarn || 0.7) * numCores,
                                  alert: (this._loadAlert || 0.9) * numCores } }] },
                { type: 'text', html: procTxt },
              ]);
              hasData = true;
            }
            break;

          case 'battery':
            if (data.battery) {
              const bat        = data.battery;
              const pct        = bat.capacityPct;
              const isCharging = bat.isCharging;

              // Dynamic icon swap: AC icon when charging, battery icon when on battery
              if (s.iconActor) {
                const targetImg = isCharging ? s.acIconImage : s.batIconImage;
                if (targetImg) s.iconActor.set_content(targetImg);
              }

              // Tile text: pct% + context-specific watt value
              const batLevel = pct <= (this._batAlert || 15) ? 'alert'
                             : pct <= (this._batWarn  || 30) ? 'warn' : 'ok';
              this._applyThreshold(s.tile, batLevel);
              let tileWatt;
              if (isCharging) {
                tileWatt = bat.usageW != null ? `≈${Math.round(bat.usageW)}W` : `+${bat.powerW.toFixed(1)}W`;
              } else {
                tileWatt = `-${bat.powerW.toFixed(1)}W`;
              }
              s.label.set_text(this._buildText('battery', `${pct}% | ${tileWatt}`));

              const { pctVals, currentDrawW, currentChargeW, avgDrawW,
                      drawVals, chargeVals } = this._manager.getBatSparklines();
              const pctToLbl = ` ${String(pct).padStart(3)}% `;

              // Watt graph right label
              let wattRight = isCharging ? `+${bat.powerW.toFixed(1)}W`
                                         : `-${bat.powerW.toFixed(1)}W`;
              if (!isCharging && avgDrawW) {
                wattRight += `\nø ${avgDrawW.toFixed(1)}W`;
                const remH = bat.energyWh / avgDrawW;
                if (remH > 0) wattRight += `\n~${BatteryMetric.formatTimeHours(remH)}`;
              }

              // Usage breakdown for AC tooltip
              const usageLines = [];
              if (isCharging && bat.usageDetail) {
                const d = bat.usageDetail;
                usageLines.push('');
                usageLines.push('<b>≈ Usage</b>');
                if (d.pkgWatt != null) usageLines.push(`CPU pkg:  ${d.pkgWatt.toFixed(1)}W`);
                if (d.gpuWatt)         usageLines.push(`GPU:      ${d.gpuWatt.toFixed(1)}W`);
                usageLines.push(`DRAM:     ~${d.dram}W`);
                if (d.display)         usageLines.push(`Display:  ~${d.display}W`);
                usageLines.push(`Total:    ≈${Math.round(bat.usageW)}W`);
              } else if (isCharging && bat.raplAvail === false) {
                usageLines.push('');
                usageLines.push('<i>CPU power unavailable — click\n"Enable CPU power monitoring"\nin Power settings</i>');
              }

              const tooltipItems = [
                { type: 'text', html: isCharging ? '<b>Power — AC</b>' : '<b>Power — Battery</b>' },
                { type: 'graph', left: `${String(pctVals.find(v => v != null) ?? '').padStart(3)}%\n(6hrs)`, right: pctToLbl,
                  height: 20, marginBottom: 8, marginTop: 8,
                  series: [{ vals: pctVals, color: C.ok, maxV: 100,
                    thresholds: { warn: this._batWarn || 30, alert: this._batAlert || 15,
                                  inverted: true } }] },
                { type: 'graph', left: isCharging ? 'AC↑\n(3hrs)\nDraw↓' : '(3hrs)\nDraw↓', right: wattRight,
                  height: 30, splitFrac: isCharging ? 1/3 : 0.05, marginBottom: 12, mode: 'bidir',
                  series: [
                    { vals: chargeVals, color: C.ok,   dir: 'up'   },
                    { vals: drawVals,   color: C.draw,  dir: 'down' },
                  ] },
                { type: 'text',
                  html: BatteryMetric.formatTooltip(bat, bat.tempC) + usageLines.join('\n') },
              ];
              s.tooltip.setContent(tooltipItems);
              hasData = true;
            }
            break;

          case 'cpu':
            if (data.cpu) {
              const tempLevel = data.cpu.packageC >= (this._cpuTempAlert || 85) ? 'alert'
                              : data.cpu.packageC >= (this._cpuTempWarn  || 70) ? 'warn' : 'ok';
              this._applyThreshold(s.tile, tempLevel);
              if (tempLevel === 'alert' && !this._tempAlertNotified) {
                this._tempAlertNotified = true;
                GLib.spawn_command_line_async(
                  `notify-send -u critical -i dialog-warning "CPU Temperature" "Your CPU temp reached ${Math.round(data.cpu.packageC)}°C"`
                );
              } else if (tempLevel !== 'alert') {
                this._tempAlertNotified = false;
              }
              s.label.set_text(this._buildText('cpu', CpuMetric.formatPanel(data.cpu.cpuPct, data.cpu.packageC)));
              // Build core table inline so graphs can be placed above it
              const coreHdr  = `${'Core'.padEnd(6)} ${'%usr'.padStart(5)} ${'%sys'.padStart(5)} ${'%iowt'.padStart(6)} ${'temp'.padStart(6)}`;
              const nTemps   = (data.cpu.coresC || []).length;
              const coreRows = (data.cpu.coreBreakdowns || []).map((b, i) => {
                const pt   = nTemps > 0 ? data.cpu.coresC[i % nTemps] : undefined;
                const temp = pt != null ? `${Math.round(pt)}°C`.padStart(6) : '     —';
                return `${('C' + i).padEnd(6)} ${(b.usr + '%').padStart(5)} ${(b.sys + '%').padStart(5)} ${(b.iowt + '%').padStart(6)} ${temp}`;
              });
              // Structure: [Package heading] [temp graph] [usage% graph] [core table]
              s.tooltip.setContent([
                { type: 'text', html: '<b>Package</b>' },
                { type: 'graph', marginTop: 8, 
                  left: `Temp:`, right: `${String(Math.round(data.cpu.packageC)).padStart(3)}°C`, height: 20,
                  series: [{ vals: history.cpuPackageC.values(),
                    color: C.ok, maxV: 100,
                    thresholds: { warn: this._cpuTempWarn || 70, alert: this._cpuTempAlert || 85 } }] },
                { type: 'graph', marginTop: 8,marginBottom: 12,
                  left: `CPU: `, right: `${String(Math.round(data.cpu.cpuPct)).padStart(3)}%`, height: 20,
                  series: [{ vals: history.cpuPct.values(),
                    color: C.ok,
                    thresholds: { warn: this._cpuUseWarn || 50, alert: this._cpuUseAlert || 80 } }] },
                { type: 'text', html: [coreHdr, ...coreRows].join('\n') },
              ]);
              hasData = true;
            }
            break;

          case 'memory':
            if (data.memory) {
              s.label.set_text(this._buildText('memory', MemoryMetric.formatPanel(data.memory)));
              const usedVals = history.memPct.values();
              const freeVals = usedVals.map(v => 100 - v);
              // Structure: [stacked graph] [memory text]
              s.tooltip.setContent([
                { type: 'text',html: '<b>Memory</b>'},
                { type: 'graph',
                  left:  `${Math.round(data.memory.usedPct)}%\nused`,
                  right: `${data.memory.availableG.toFixed(1)}G\nfree`,
                  height: 20, mode: 'stacked', marginBottom: 12, marginTop: 9,
                  series: [
                    { vals: usedVals, color: [1,    0.4, 0.4,  0.85] },
                    { vals: freeVals, color: C.ok },
                  ] },
                { type: 'text', html: MemoryMetric.formatTooltip(data.memory, null) },
              ]);
              hasData = true;
            }
            break;

          case 'disk':
            if (data.disk) {
              const enabledDevs = parseList(this._diskList)
                .filter(d => d.enabled).map(d => d.device);
              const dfDisks = enabledDevs.length > 0
                ? data.disk.dfDisks.filter(d => enabledDevs.includes(DiskMetric.parentDevice(d.name)))
                : data.disk.dfDisks;
              if (dfDisks.length > 0) {
                const diskRates   = data.diskRates || [];
                const nvmeTemps   = DiskMetric.readNvmeTemps(fileutil);
                const parentRates = diskRates.filter(r => DiskMetric.parentDevice(r.name) === r.name);
                const totalBps    = parentRates.reduce((sum, r) => sum + r.readBytesPerSec + r.writeBytesPerSec, 0);
                s.label.set_text(this._buildText('disk', DiskMetric.formatPanel(dfDisks, diskRates)));
                // Structure: [I/O graph] [disk text]
                s.tooltip.setContent([
                  { type: 'text', html: '<b>Disks</b>'},
                  { type: 'graph', marginBottom: 12, marginTop: 8,
                    left: 'I/O', right: DiskMetric.humanBps(totalBps), height: 20,
                    series: [{ vals: history.diskIo.values(), color: C.blue }] },
                  { type: 'text', html: DiskMetric.formatTooltip(dfDisks, diskRates, null, nvmeTemps) },
                ]);
                hasData = true;
              }
            }
            break;

          case 'fan':
            if (data.fan) {
              s.label.set_text(this._buildText('fan', FanMetric.formatPanel(data.fan)));
              s.tooltip.setContent([
                { type: 'text', html: FanMetric.formatTooltip(data.fan) },
              ]);
              hasData = true;
            }
            break;

          case 'gpu':
            if (data.gpu && data.gpu.length > 0) {
              const primary = data.gpu.find(g => g.type !== 'intel') || data.gpu[0];
              s.label.set_text(this._buildText('gpu', GpuMetric.formatPanel(primary)));
              const hasDiscrete = data.gpu.some(g => g.type !== 'intel');
              const gpuItems = [];
              if (hasDiscrete) {
                const busyPct = primary.busyPct != null ? primary.busyPct : 0;
                gpuItems.push({
                  type: 'graph', left: 'Busy', right: `${busyPct}%`,
                  height: 20, marginTop: 8, marginBottom: 8,
                  series: [{ vals: history.gpuPct.values(), color: C.ok,
                    thresholds: { warn: 50, alert: 80 } }]
                });
              }
              gpuItems.push({ type: 'text', html: GpuMetric.formatTooltip(data.gpu) });
              s.tooltip.setContent(gpuItems);
              hasData = true;
            }
            break;

          case 'network': {
            if (data.netRates) {
              const enabledIfaces = parseList(this._netList)
                .filter(n => n.enabled).map(n => n.iface);
              const rates = enabledIfaces.length > 0
                ? data.netRates.filter(r => enabledIfaces.includes(r.name))
                : data.netRates;
              if (rates.length > 0) {
                const totalTx = rates.reduce((sum, r) => sum + r.txBytesPerSec, 0);
                const totalRx = rates.reduce((sum, r) => sum + r.rxBytesPerSec, 0);
                s.label.set_text(this._buildText('network', NetworkMetric.formatPanel(rates)));
                // Structure: [TX↑/RX↓ bidir graph] [per-interface text]
                s.tooltip.setContent([
                  { type: 'text', html: '<b>Network</b>'},
                  { type: 'graph', left: 'TX↑', right: NetworkMetric.humanRate(totalTx),
                    height: 20,marginTop: 8,
                    series: [{ vals: history.netTx.values(), color: C.blue }] },
                  { type: 'graph', left: 'RX↓', right: NetworkMetric.humanRate(totalRx),
                    height: 20, dir: "down", marginBottom: 12,
                    series: [{ vals: history.netRx.values(), color: C.purple, dir: 'down' }] },
                  { type: 'text', html: NetworkMetric.formatTooltip(rates, null, null) },
                ]);
                hasData = true;
              }
            }
            break;
          }
        }
      }

      const show = enabled && hasData;
      if (show) { s.tile.show(); } else { s.tile.hide(); }

      // Separators: between sections horizontally; above sections vertically; hidden when empty
      if (show && prevVisible && sepStr) { s.sep.show(); } else { s.sep.hide(); }
      if (show) prevVisible = true;
    }
  }

  on_applet_removed_from_panel() {
    if (this._earlyTimeout) { Mainloop.source_remove(this._earlyTimeout); this._earlyTimeout = null; }
    if (this._timeout) Mainloop.source_remove(this._timeout);
    if (this._sections) {
      for (const { tooltip } of Object.values(this._sections))
        try { tooltip.destroy(); } catch(e) {}
    }
    this._settings.finalize();
  }
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new YasmApplet(metadata, orientation, panelHeight, instanceId);
}
