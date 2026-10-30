// lib/deck/panel.js —— 展开面板（AI 用量 / 音乐 / 系统监控）
//
// 全 cairo 自绘，和上游一致（WPF 那边也是代码建树 + 自绘，没有 XAML 布局）。
// 交互自己算 hotspot：tab、进度条拖动、按钮都登记成矩形，点击时命中测试。
'use strict';

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Clutter = imports.gi.Clutter;

const Draw = imports.lib.ui.draw;
const I18n = imports.lib.core.i18n;

// 文案统一走 i18n：msgid 是中文原文，panel 在每次 repaint 时才取译文，
// 所以设置里换语言不用重建 panel（顶层常量会把中文冻结在加载那一刻）。
const _ = I18n.t;

const PAGES = ['usage', 'music', 'monitor'];

// 页签在画布上只有图标（与上游一致），页名只出现在设置项的「默认页」里，
// 那部分由 settings-schema.json 的 po 条目负责，所以这里不需要页名表。

const DEFAULT_COLORS = {
    surface: '#000000', popup: '#1A1A1D', popupBorder: '#24FFFFFF', textPrimary: '#F5F5F7',
    textSecondary: '#9EEBEBF5', textTertiary: '#61EBEBF5', accent: '#0A84FF', onAccent: '#FFFFFF',
    hairline: '#17FFFFFF', track: '#1FFFFFFF', hover: '#18FFFFFF', switchFill: '#0FFFFFFF',
    shadow: '#000000', rangeFill: '#382B87FF', danger: '#F2777F', liked: '#EC4141'
};

const F = {
    title: 'Noto Sans 15',          // L.name
    big: 'Noto Sans 20',            // L.number
    body: 'Noto Sans 12',           // L.label
    small: 'Noto Sans 10.5',        // L.plan / L.reset 之间
    foot: 'Noto Sans 12',           // L.foot
    clock: 'Noto Sans 12'
};

// 上游 UsagePanel.cs:44 的 Layout.For(Tier.Default)：Name 15 / Number 20 / Label 12 / Reset 11 / Foot 12 /
// Plan 10.5 / Head 24 / LabelRow 16 / QuotaGap 10 / RowGap 4 / Track 4 / ColumnPad 14 / Toolbar 36 /
// FootTop 8 / FootBottom 7 / Bottom 16；EdgeInset 6、ColumnTopInset 2（UsagePanel.cs:25）
const L = {
    name: 15, number: 20, label: 12, reset: 11, foot: 12, plan: 10.5,
    head: 24, labelRow: 16, quotaGap: 10, rowGap: 4, track: 4, columnPad: 14,
    toolbar: 36, footTop: 8, footBottom: 7, bottom: 16,
    edge: 6, columnTop: 2,
    numberRow: 24, footRow: 18,
    quotaHeight: 52                                  // LabelRow + RowGap + NumberRow + RowGap + Track
};
const PAD = L.columnPad, HEADER_H = L.toolbar;

var Panel = class Panel {
    constructor(params) {
        this._theme = { colors: {} };
        this._page = 'usage';
        this._width = 720;
        this._height = 200;
        this._columns = [];
        this._now = null;
        this._monitor = null;
        this._hots = [];
        this._coverSurface = null;
        this._coverUri = '';
        this._dragging = false;
        this._dpr = (function () {
            try { return St.ThemeContext.get_for_stage(global.stage).scale_factor || 1; }
            catch (e) { return 1; }
        })();
        this._trans = null;        // {from, to, t} 转场进度
        this._transTimer = 0;

        this.actor = new St.DrawingArea({ reactive: true, track_hover: true });
        this.actor.connect('repaint', () => this._paint());
        this.actor.connect('button-release-event', (a, ev) => this._onRelease(ev));
        this.actor.hide();
    }

    // ---------------------------------------------------------------- 对外

    setTheme(theme) { this._theme = theme || { colors: {} }; this.actor.queue_repaint(); return false; }

    setPage(id, animated) {
        if (PAGES.indexOf(id) < 0) id = 'usage';
        const changed = id !== this._page;
        const from = this._page;
        this._page = id;
        this._height = id === 'music' ? 268 : id === 'monitor' ? 262 : (this._usageHeight || 158);
        this.actor.set_size(this._width, this._height);

        if (animated && changed) {
            // 上游 PageHandover 有 Dissolve / Morph / Forward / Back 五种；这里实现前两种的合成：
            // 旧页向左淡出、新页从右淡入（页签顺序决定方向）
            const dir = PAGES.indexOf(id) > PAGES.indexOf(from) ? 1 : -1;
            this._trans = { from: from, to: id, t: 0, dir: dir };
            this._startTrans();
        }
        this.actor.queue_repaint();
        return false;
    }

    _startTrans() {
        if (this._transTimer) return;
        this._transTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            if (!this._trans) { this._transTimer = 0; return false; }
            this._trans.t += 16 / 200;          // 200ms，接近上游的默认动画时长
            if (this._trans.t >= 1) { this._trans = null; this._transTimer = 0; }
            this.actor.queue_repaint();
            return this._trans !== null;
        });
    }
    get page() { return this._page; }

    size() { return { width: this._width, height: this._height }; }
    setSize(w, h) { this._width = w; this._height = h; this.actor.set_size(w, h); }

    setUsage(columns) {
        this._columns = columns || [];
        // 高度按内容算：标题行 + 状态 + 每组配额 54 + 底部汇总，避免空面板留大片黑
        // 上游 Required(slots) = Head + slots*QuotaHeight + (slots-1)*QuotaGap + FooterHeight + Toolbar（UsagePanel.cs:58-60）
        let slots = 0, hasStatus = false, hasFooter = false;
        for (const c of this._columns) {
            slots = Math.max(slots, (c.quotas || []).length);
            if (c.statusText) hasStatus = true;
            if (c.footer) hasFooter = true;
        }
        const footerH = L.footTop + 1 + L.footBottom + 2 * L.footRow;
        let hh = L.toolbar + L.columnTop + L.head + slots * L.quotaHeight + Math.max(0, slots - 1) * L.quotaGap + footerH;
        hh += L.bottom + (hasStatus ? L.labelRow + 2 : 0) + (hasFooter ? L.labelRow : 0);
        this._height = Math.max(120, Math.round(hh) + 62);   // Pango 的中文行高比 WPF 的 LineHeight 略大，留 18 余量
        this._usageHeight = this._height; this.actor.set_size(this._width, this._height); this.actor.queue_repaint(); return false; }

    setNowPlaying(info) {
        this._now = info;
        if (info && info.artUrl) this._loadCover(info.artUrl);
        this.actor.queue_repaint();
        return false;
    }

    setMonitor(sample) { this._monitor = sample; this.actor.queue_repaint(); return false; }

    show(animated, duration) {
        if (this.actor.visible) return;
        this.actor.show();
        this.actor.opacity = animated === false ? 255 : 0;
        if (animated !== false && typeof this.actor.ease === 'function') {
            this.actor.ease({ opacity: 255, duration: duration || 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
        } else this.actor.opacity = 255;
    }

    hide(animated, duration) {
        if (!this.actor.visible) return;
        if (animated !== false && typeof this.actor.ease === 'function') {
            this.actor.ease({
                opacity: 0, duration: duration || 140, mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => this.actor.hide()
            });
        } else this.actor.hide();
    }

    place(shape, monitor) {
        const s = shape.surface;
        let x = Math.round(s.x + s.width / 2 - this._width / 2);
        const y = Math.round(s.y + s.height + 6);
        x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - this._width));
        this.actor.set_position(x, y);
    }

    destroy() {
        if (this._transTimer) { GLib.source_remove(this._transTimer); this._transTimer = 0; }
        this.actor.destroy();
    }

    // ---------------------------------------------------------------- 绘制

    // 高分屏：线宽落在物理像素网格上，1px 的描边在 2x 下才是清晰的 2 物理像素
    _snap(v) { return Math.round(v * this._dpr) / this._dpr; }
    _lw(v) { return Math.max(1 / this._dpr, Math.round(v * this._dpr) / this._dpr); }

    _color(key) {
        const c = this._theme && this._theme.colors ? this._theme.colors[key] : null;
        return Draw.cssColor(c, DEFAULT_COLORS[key] || '#000000');
    }

    _rawColor(key) {
        const c = this._theme && this._theme.colors ? this._theme.colors[key] : null;
        return c || DEFAULT_COLORS[key] || '#000000';
    }

    _paint() {
        const cr = this.actor.get_context();
        const w = this.actor.width, h = this.actor.height;
        if (!(w > 0 && h > 0)) { if (cr.$dispose) cr.$dispose(); return; }
        this._hots = [];

        cr.save();
        // 面板底板：圆角 14 + 描边
        Draw.setColor(cr, this._color('surface'));
        Draw.roundedRectPath(cr, 0, 0, w, h, 14);
        cr.fill();
        Draw.setColor(cr, this._color('popupBorder'));
        cr.setLineWidth(this._lw(1));
        Draw.roundedRectPath(cr, this._snap(0.5), this._snap(0.5), w - this._snap(1), h - this._snap(1), 14);
        cr.stroke();

        this._paintHeader(cr, w);

        if (this._trans) {
            const t = easeOutCubic(this._trans.t);
            this._hots = [];                     // 转场中不登记热点，避免点到半个页面
            this._paintLayer(cr, w, h, this._trans.from, 1 - t, -this._trans.dir * 26 * t);
            this._paintLayer(cr, w, h, this._trans.to, t, this._trans.dir * 26 * (1 - t));
        } else {
            this._paintLayer(cr, w, h, this._page, 1, 0);
        }

        cr.restore();
        if (cr.$dispose) cr.$dispose();
    }

    // 单独画一层页面（透明度 + 水平位移），用于转场
    _paintLayer(cr, w, h, page, alpha, dx) {
        if (alpha <= 0.01) return;
        cr.save();
        cr.pushGroup();
        cr.translate(dx, 0);
        if (page === 'usage') this._paintUsage(cr, w, h);
        else if (page === 'music') this._paintMusic(cr, w, h);
        else this._paintMonitor(cr, w, h);
        cr.popGroupToSource();
        cr.paintWithAlpha(Math.max(0, Math.min(1, alpha)));
        cr.restore();
    }

    _text(cr, str, x, y, font, color, opts) {
        const layout = PangoCairo.create_layout(cr);
        layout.set_font_description(Pango.FontDescription.from_string(font));
        layout.set_text(str, -1);
        if (opts && opts.width) {
            layout.set_width(Math.round(opts.width * Pango.SCALE));
            layout.set_ellipsize(Pango.EllipsizeMode.END);
        }
        const [tw, th] = layout.get_pixel_size();
        Draw.setColor(cr, color);
        cr.moveTo(x, y);
        PangoCairo.show_layout(cr, layout);
        return { w: tw, h: th };
    }

    _measure(cr, str, font) {
        const layout = PangoCairo.create_layout(cr);
        layout.set_font_description(Pango.FontDescription.from_string(font));
        layout.set_text(str, -1);
        const [w, h] = layout.get_pixel_size();
        return { w: w, h: h };
    }

    // 顶部工具栏：三个页签图标 · 中间时间 · 右侧刷新/设置
    _paintHeader(cr, w) {
        const cy = HEADER_H / 2 + 2;

        // 页签（图标式，和上游一致）
        let x = PAD;
        for (const id of PAGES) {
            const active = id === this._page;
            const bw = 30, bh = 22;
            if (active) {
                Draw.setColor(cr, this._color('switchFill'));
                Draw.roundedRectPath(cr, x, cy - bh / 2, bw, bh, 7);
                cr.fill();
            }
            Draw.setColor(cr, active ? this._color('textPrimary') : this._color('textTertiary'));
            this._icon(cr, id, x + bw / 2, cy, active);
            this._hots.push({ x: x, y: cy - bh / 2, w: bw, h: bh, action: 'page:' + id });
            x += bw + 2;
        }

        // 中间：音乐页显示播放器名，其余页显示时间（与上游一致）
        const middle = (this._page === 'music' && this._now && this._now.player)
            ? shortPlayer(this._now.player)
            : this._clockText();
        const m = this._measure(cr, middle, F.clock);
        this._text(cr, middle, Math.round(w / 2 - m.w / 2), Math.round(cy - m.h / 2), F.clock, this._color('textTertiary'));

        // 右侧：刷新 + 设置
        const gx = w - PAD - 14;
        this._gear(cr, gx, cy, this._color('textTertiary'));
        this._hots.push({ x: gx - 9, y: cy - 9, w: 18, h: 18, action: 'settings' });
        const rx = gx - 24;
        this._refreshIcon(cr, rx, cy, this._color('textTertiary'));
        this._hots.push({ x: rx - 9, y: cy - 9, w: 18, h: 18, action: 'refresh' });
    }

    // 图标：直接抄上游 MainWindow.xaml:76/81/84 的 Path Data（24×24 坐标，Viewbox 16×16，StrokeThickness 1.65）
    _icon(cr, id, cx, cy, active) {
        const k = 16 / 24;
        cr.save();
        cr.translate(cx - 8, cy - 8);
        cr.scale(k, k);
        cr.setLineWidth(1.65 / k);          // 线宽按缩放补偿，屏幕上仍是 1.65px
        cr.setLineCap(1);
        cr.setLineJoin(1);
        Draw.setColor(cr, active ? this._color('textPrimary') : this._color('textTertiary'));

        if (id === 'usage') {
            // 5 根柱 + 上升折线 + 箭头
            cr.newSubPath(); cr.moveTo(4, 21); cr.lineTo(4, 16); cr.stroke();
            cr.newSubPath(); cr.moveTo(9, 21); cr.lineTo(9, 13); cr.stroke();
            cr.newSubPath(); cr.moveTo(14, 21); cr.lineTo(14, 15); cr.stroke();
            cr.newSubPath(); cr.moveTo(19, 21); cr.lineTo(19, 10); cr.stroke();
            cr.newSubPath(); cr.moveTo(3, 12); cr.lineTo(9, 6); cr.lineTo(14, 10); cr.lineTo(21, 3); cr.stroke();
            cr.newSubPath(); cr.moveTo(16, 3); cr.lineTo(21, 3); cr.lineTo(21, 8); cr.stroke();
        } else if (id === 'music') {
            // 音符：双竖线 + 斜顶 + 两个符头
            cr.newSubPath();
            cr.moveTo(9, 18); cr.lineTo(9, 5.5); cr.lineTo(20, 3.3); cr.lineTo(20, 16);
            cr.stroke();
            cr.newSubPath(); cr.arc(6, 18, 3, 0, Math.PI * 2); cr.stroke();
            cr.newSubPath(); cr.arc(17, 16, 3, 0, Math.PI * 2); cr.stroke();
        } else {
            // 心电波形
            cr.newSubPath();
            cr.moveTo(2, 12.5); cr.lineTo(6.5, 12.5); cr.lineTo(9.5, 5);
            cr.lineTo(14.5, 19); cr.lineTo(17.5, 12.5); cr.lineTo(22, 12.5);
            cr.stroke();
        }
        cr.restore();
    }

    _gear(cr, cx, cy, color) {
        cr.save();
        Draw.setColor(cr, color);
        cr.setLineWidth(1.4);
        cr.newSubPath();
        cr.arc(cx, cy, 4, 0, Math.PI * 2);
        cr.stroke();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            cr.newSubPath();
            cr.moveTo(cx + Math.cos(a) * 5.6, cy + Math.sin(a) * 5.6);
            cr.lineTo(cx + Math.cos(a) * 7.4, cy + Math.sin(a) * 7.4);
            cr.stroke();
        }
        cr.restore();
    }

    _refreshIcon(cr, cx, cy, color) {
        cr.save();
        Draw.setColor(cr, color);
        cr.setLineWidth(1.5);
        cr.setLineCap(1);
        cr.newSubPath();
        cr.arc(cx, cy, 5.5, -Math.PI * 0.75, Math.PI * 0.55);
        cr.stroke();
        cr.newSubPath();
        cr.moveTo(cx + 4.2, cy - 6.2);
        cr.lineTo(cx + 6.4, cy - 4.6);
        cr.lineTo(cx + 3.6, cy - 3.1);
        cr.closePath();
        cr.fill();
        cr.restore();
    }

    _clockText() {
        const d = new Date();
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    // ---------------------------------------------------------------- AI 用量

    _paintUsage(cr, w, h) {
        const cols = this._columns;
        const top = L.toolbar + L.columnTop;
        if (!cols.length) {
            this._text(cr, _('没有可显示的来源'), L.edge + L.columnPad, top + 10, F.body, this._color('textTertiary'));
            return;
        }
        const n = Math.min(cols.length, 4);
        // 上游：columnWidth = (width - EdgeInset*2) / count（UsagePanel.cs:86）
        const colW = (w - L.edge * 2) / n;

        for (let i = 0; i < n; i++) {
            const colX = L.edge + i * colW;
            this._paintUsageColumn(cr, cols[i], colX, top, colW, h);
            if (i > 0) {
                Draw.setColor(cr, this._color('hairline'));
                cr.setLineWidth(this._lw(1));
                cr.newSubPath();
                cr.moveTo(this._snap(colX), top);
                cr.lineTo(colX, h - L.bottom);
                cr.stroke();
            }
        }
    }

    // 一列：Head(24) · 状态 · 每个配额槽(52) + QuotaGap(10) · 底部汇总(8+1+7+2×18)
    _paintUsageColumn(cr, col, colX, top, colW, panelH) {
        const color = col.color || this._color('accent');
        const x = colX + L.columnPad;
        const innerW = colW - L.columnPad * 2;
        let cy = top;

        // Head：名称（L.name=15）+ 套餐徽章（L.plan=10.5，圆角 4、内边距 4/5）
        const nm = this._text(cr, col.name, x, cy + 3, F.title, this._color('textPrimary'), { width: innerW });
        if (col.plan) {
            const pm = this._measure(cr, col.plan, F.small);
            const chipX = x + Math.min(nm.w, innerW) + 6;
            Draw.setColor(cr, this._color('outline'));
            cr.setLineWidth(1);
            Draw.roundedRectPath(cr, chipX + 0.5, cy + 4.5, pm.w + 9, 15, 4);
            cr.stroke();
            this._text(cr, col.plan, chipX + 5, cy + 5, F.small, this._color('textSecondary'));
        }
        cy += L.head;

        if (col.statusText) {
            this._text(cr, col.statusText, x, cy, F.small, this._color('textTertiary'), { width: innerW });
            cy += L.labelRow;
        }
        if (col.footer) {
            this._text(cr, col.footer, x, cy, F.small, this._color('textTertiary'), { width: innerW });
            cy += L.labelRow;
        }

        // 配额槽
        const quotas = col.quotas || [];
        for (let qi = 0; qi < quotas.length; qi++) {
            const q = quotas[qi];
            const pct = Number.isFinite(q.percent) ? Math.round(q.percent) : null;

            // LabelRow：标题左、重置时间右
            this._text(cr, q.title, x, cy, F.body, this._color('textSecondary'), { width: innerW * 0.6 });
            if (q.resetText) {
                const rm = this._measure(cr, q.resetText, F.small);
                this._text(cr, q.resetText, x + innerW - rm.w, cy + 1, F.small, this._color('textTertiary'));
            }
            cy += L.labelRow + L.rowGap;

            // NumberRow：大数字 + used
            const big = q.valueText !== undefined && q.valueText !== null ? String(q.valueText)
                : (pct === null ? '—' : pct + '%');
            const bm = this._text(cr, big, x, cy - 3, F.big, pct === null ? this._color('textTertiary') : this._color('textPrimary'));
            if (pct !== null && q.valueText === undefined) {
                this._text(cr, _('used'), x + bm.w + 5, cy + 8, F.small, this._color('textTertiary'));
            }
            cy += L.numberRow + L.rowGap;

            // Track：4px 圆角条
            Draw.setColor(cr, this._color('track'));
            Draw.roundedRectPath(cr, x, cy, innerW, L.track, L.track / 2);
            cr.fill();
            if (pct !== null && pct > 0) {
                Draw.setColor(cr, color);
                Draw.roundedRectPath(cr, x, cy, Math.max(L.track, innerW * Math.min(100, pct) / 100), L.track, L.track / 2);
                cr.fill();
            }
            cy += L.track;
            if (qi < quotas.length - 1) cy += L.quotaGap;
        }

        // 底部汇总：直接底对齐（上游也是贴底），不靠推算 ftH，避免 Pango 行高差累积
        // 标签列宽按当前语言的标签实测：上游 L.CaptionWidth 是按「两个汉字」定的（12×2.7≈32），
        // 英文的 "Today" / "7 days" 比它宽，硬编码会让数字和标签叠在一起。
        const rows = [
            [_('今日'), col.todayTokens || '0', col.todayUsd || ''],
            [_('七日'), col.weekTokens || '0', col.weekUsd || '']
        ];
        const captionW = Math.ceil(rows.reduce(
            (widest, row) => Math.max(widest, this._measure(cr, row[0], F.foot).w), 0)) + 8;
        let ry = panelH - L.bottom - 2 * L.footRow;
        const sepY = ry - L.footTop - 4;
        Draw.setColor(cr, this._color('hairline'));
        cr.setLineWidth(this._lw(1));
        cr.newSubPath();
        cr.moveTo(x, this._snap(sepY));
        cr.lineTo(x + innerW, sepY);
        cr.stroke();
        for (const [label, tokens, usd] of rows) {
            this._text(cr, label, x, ry, F.foot, this._color('textTertiary'));
            this._text(cr, tokens, x + captionW, ry, F.foot, this._color('textSecondary'));
            if (usd) {
                const um = this._measure(cr, usd, F.foot);
                this._text(cr, usd, x + innerW - um.w - 14, ry, F.foot, this._color('textPrimary'));
            }
            ry += L.footRow;
        }
    }

    // ---------------------------------------------------------------- 音乐

    _paintMusic(cr, w, h) {
        const info = this._now;
        if (!info || !info.title) {
            this._text(cr, _('未检测到播放器'), PAD, HEADER_H + 20, F.body, this._color('textTertiary'));
            return;
        }
        const top = HEADER_H + 10;
        const cover = 96;

        if (this._coverSurface) {
            cr.save();
            Draw.roundedRectPath(cr, PAD, top, cover, cover, 10);
            cr.clip();
            cr.setSourceSurface(this._coverSurface, PAD, top);
            cr.paint();
            cr.restore();
        } else {
            Draw.setColor(cr, this._color('track'));
            Draw.roundedRectPath(cr, PAD, top, cover, cover, 10);
            cr.fill();
        }

        const tx = PAD + cover + 16;
        const tw = w - tx - PAD - 40;
        this._text(cr, info.title, tx, top + 6, 'Noto Sans 17', this._color('textPrimary'), { width: tw });
        const sub = [info.artist, info.album].filter(Boolean).join(' · ');
        if (sub) this._text(cr, sub, tx, top + 32, F.body, this._color('textSecondary'), { width: tw });
        if (info.lyric) this._text(cr, info.lyric, tx, top + 54, F.body, this._color('textPrimary'), { width: tw });

        // 进度条
        const barY = top + cover + 14;
        const pct = info.lengthUs ? Math.min(1, (info.positionUs || 0) / info.lengthUs) : 0;
        Draw.setColor(cr, this._color('track'));
        Draw.roundedRectPath(cr, PAD, barY, w - PAD * 2, 4, 2);
        cr.fill();
        if (pct > 0) {
            Draw.setColor(cr, this._color('accent'));
            Draw.roundedRectPath(cr, PAD, barY, Math.max(4, (w - PAD * 2) * pct), 4, 2);
            cr.fill();
        }
        const cur = fmtTime(info.positionUs), tot = fmtTime(info.lengthUs);
        this._text(cr, cur, PAD, barY + 8, F.small, this._color('textTertiary'));
        const tm = this._measure(cr, tot, F.small);
        this._text(cr, tot, w - PAD - tm.w, barY + 8, F.small, this._color('textTertiary'));

        // 控制按钮：循环 / 上一首 / 播放暂停 / 下一首 / 喜欢
        const by = h - PAD - 22;
        const cx = w / 2;
        this._ctrl(cr, 'prev', cx - 78, by);
        this._ctrl(cr, info.playing ? 'pause' : 'play', cx - 26, by);
        this._ctrl(cr, 'next', cx + 26, by);
        this._ctrl(cr, 'loop', cx - 128, by);
        this._ctrl(cr, 'heart', cx + 78, by);
    }

    _ctrl(cr, kind, cx, cy) {
        const col = kind === 'heart' ? this._color('liked') : this._color('textSecondary');
        cr.save();
        cr.translate(cx, cy);
        Draw.setColor(cr, col);
        cr.setLineWidth(1.8);
        cr.setLineCap(1);
        if (kind === 'play') {
            cr.newSubPath(); cr.moveTo(-4, -7); cr.lineTo(7, 0); cr.lineTo(-4, 7); cr.closePath(); cr.fill();
        } else if (kind === 'pause') {
            cr.newSubPath(); cr.rectangle(-5, -7, 3.5, 14); cr.fill();
            cr.newSubPath(); cr.rectangle(2, -7, 3.5, 14); cr.fill();
        } else if (kind === 'prev') {
            cr.newSubPath(); cr.moveTo(6, -7); cr.lineTo(-5, 0); cr.lineTo(6, 7); cr.closePath(); cr.fill();
            cr.newSubPath(); cr.moveTo(-7, -7); cr.lineTo(-7, 7); cr.stroke();
        } else if (kind === 'next') {
            cr.newSubPath(); cr.moveTo(-6, -7); cr.lineTo(5, 0); cr.lineTo(-6, 7); cr.closePath(); cr.fill();
            cr.newSubPath(); cr.moveTo(7, -7); cr.lineTo(7, 7); cr.stroke();
        } else if (kind === 'loop') {
            cr.newSubPath(); cr.arc(0, 0, 6, -Math.PI * 0.4, Math.PI * 1.1); cr.stroke();
        } else if (kind === 'heart') {
            cr.newSubPath(); cr.moveTo(0, 6);
            cr.curveTo(-9, -2, -5, -8, 0, -3);
            cr.curveTo(5, -8, 9, -2, 0, 6);
            cr.fill();
        }
        cr.restore();

        const actions = { prev: 'prev', next: 'next', play: 'playpause', pause: 'playpause', loop: 'loop', heart: 'heart' };
        if (actions[kind]) this._hots.push({ x: cx - 12, y: cy - 12, w: 24, h: 24, action: 'music:' + actions[kind] });
    }

    // ---------------------------------------------------------------- 系统监控

    _paintMonitor(cr, w, h) {
        const s = this._monitor;
        if (!s) {
            this._text(cr, _('采样未接入'), PAD, HEADER_H + 20, F.body, this._color('textTertiary'));
            return;
        }
        const top = HEADER_H + 8;

        // CPU / GPU 大数字
        const cpu = Number.isFinite(s.cpu) ? Math.round(s.cpu) + '%' : '—';
        this._metricBadge(cr, 'C', PAD, top, this._color('accent'));
        this._text(cr, cpu, PAD + 26, top - 4, F.big, this._color('textPrimary'));

        // GPU 放在左区域内（右侧留给进程榜，避免压字）
        const gx = PAD + Math.round((w - PAD * 2) * 0.58) - 84;
        this._metricBadge(cr, 'G', gx, top, this._color('textSecondary'));
        this._text(cr, s.gpu || '—', gx + 26, top - 4, F.big, this._color('textPrimary'));

        // 每核心柱状（占左侧 58%，右侧留给进程榜）
        const leftW = Math.round((w - PAD * 2) * 0.58);
        const cores = s.perCore || [];
        const barsTop = top + 30;
        const barsH = 54;
        const bw = Math.max(6, Math.min(14, (leftW - 8) / Math.max(1, cores.length) - 2));
        for (let i = 0; i < cores.length; i++) {
            const x = PAD + i * (bw + 3);
            Draw.setColor(cr, this._color('track'));
            Draw.roundedRectPath(cr, x, barsTop, bw, barsH, 3);
            cr.fill();
            const v = Math.max(0, Math.min(100, cores[i])) / 100;
            const bh = Math.max(2, barsH * v);
            Draw.setColor(cr, this._color('accent'));
            Draw.roundedRectPath(cr, x, barsTop + barsH - bh, bw, bh, 3);
            cr.fill();
        }

        // 内存条
        const memY = barsTop + barsH + 12;
        this._metricBadge(cr, 'M', PAD, memY, this._color('textSecondary'));
        const memTxt = Number.isFinite(s.memPercent) ? Math.round(s.memPercent) + '%' : '—';
        this._text(cr, memTxt, PAD + 26, memY - 2, F.body, this._color('textPrimary'));
        const barX = PAD + 70, barW = leftW - 70;
        Draw.setColor(cr, this._color('track'));
        Draw.roundedRectPath(cr, barX, memY + 4, barW, 6, 3);
        cr.fill();
        if (Number.isFinite(s.memPercent)) {
            Draw.setColor(cr, this._color('accent'));
            Draw.roundedRectPath(cr, barX, memY + 4, Math.max(6, barW * s.memPercent / 100), 6, 3);
            cr.fill();
        }

        // 网速
        const netY = memY + 26;
        this._text(cr, '↓ ' + (s.rxKbps || '—'), PAD, netY, F.body, this._color('textSecondary'));
        this._text(cr, '↑ ' + (s.txKbps || '—'), PAD + 130, netY, F.body, this._color('textSecondary'));

        // 右侧：TOP 进程（名字 + 单核百分比归一化后占整机）
        const procs = s.processes || [];
        if (procs.length) {
            const px = PAD + leftW + 16;
            let ry = top + 2;
            const nproc = cores.length || 1;
            for (const p of procs.slice(0, 6)) {
                this._text(cr, p.name, px, ry, F.body, this._color('textPrimary'), { width: leftW * 0.62 });
                const pct = Math.max(0, (p.cpuPercent || 0) / nproc);
                const txt = pct >= 0.1 ? pct.toFixed(1) + '%' : pct.toFixed(2) + '%';
                const tm = this._measure(cr, txt, F.body);
                this._text(cr, txt, px + (w - PAD - px) - tm.w, ry, F.body, this._color('textSecondary'));
                ry += 20;
            }
        }
    }

    _metricBadge(cr, letter, x, y, color) {
        Draw.setColor(cr, color);
        cr.setLineWidth(1.4);
        cr.newSubPath();
        cr.arc(x + 8, y + 10, 8, 0, Math.PI * 2);
        cr.stroke();
        this._text(cr, letter, x + 5, y + 3, F.small, color);
    }

    // ---------------------------------------------------------------- 交互

    _loadCover(uri) {
        if (!uri || uri === this._coverUri) return;
        this._coverUri = uri;
        const path = uri.indexOf('file://') === 0 ? decodeURIComponent(uri.slice(7)) : null;
        if (!path) { this._coverSurface = null; return; }
        try {
            const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 160, 160, true);
            this._coverSurface = Gdk.cairo_surface_create_from_pixbuf(pb, 1, null);
        } catch (e) { this._coverSurface = null; }
    }

    _onRelease(ev) {
        const [x, y] = ev.get_coords();
        const ax = this.actor.x, ay = this.actor.y;
        const lx = x - ax, ly = y - ay;
        for (const hot of this._hots) {
            if (lx >= hot.x && lx <= hot.x + hot.w && ly >= hot.y && ly <= hot.y + hot.h) {
                if (hot.action.indexOf('page:') === 0) this.setPage(hot.action.slice(5), true);
                else this._emit(hot.action);
                return true;
            }
        }
        return false;
    }

    _emit(action) {
        if (this.onAction) this.onAction(action);
    }
};

// org.mpris.MediaPlayer2.chromium.instance5889 → Chromium
function shortPlayer(name) {
    const s = String(name || '');
    const m = s.match(/MediaPlayer2\.([A-Za-z0-9_]+)/);
    if (!m) return s;
    const n = m[1];
    return n.charAt(0).toUpperCase() + n.slice(1);
}

function easeOutCubic(t) {
    const x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
}

function fmtTime(us) {
    if (!us || !Number.isFinite(us)) return '0:00';
    const total = Math.floor(us / 1e6);
    const m = Math.floor(total / 60), s = total % 60;
    return m + ':' + ('0' + s).slice(-2);
}

if (typeof module !== 'undefined') module.exports = { Panel, PAGES, fmtTime };
