// lib/deck/island.js —— 收起态（刘海 / 胶囊 / 指示条）
//
// 全部用 cairo + Pango 自绘，和上游的做法一致（WPF 那边也是 IslandBorder 画路径 + 自绘文本，
// 没有用任何布局容器）。之前用 St 子控件拼，尺寸走 allocate 就散架，这条路更可控。
//
// 形状：与上游 IslandBorder.Outline() 同构 —— 顶边直通全场，两侧各两段 C2 连续的贝塞尔
// 内收到 right/left（肩深 = shoulder×7/16），底部两角 12px 圆角。
// 内容：[封面 20] [配额环 ×N] [文字/歌词] [律动条] [时钟]，整体水平居中。
'use strict';

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cairo = imports.cairo;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

const Draw = imports.lib.ui.draw;

let Geo = null;
try { Geo = imports.lib.core.geometry; } catch (e) { Geo = null; }

const DEFAULT_COLORS = {
    surface: '#000000', textPrimary: '#F5F5F7', textSecondary: '#9EEBEBF5',
    textTertiary: '#61EBEBF5', accent: '#0A84FF', ringTrack: '#29FFFFFF',
    shadow: '#000000', rim: '#12FFFFFF', equalizer: '#9EEBEBF5', coverPlaceholder: '#0FFFFFFF'
};

const K = 0.5522847498307936;
// 内容尺寸的「标准档」基准值（高 32 时）。实际绘制时全部乘 shape.scale：
// 以前这些是死值，把刘海拉到 40 高只会多出一圈黑边，字和图一点不变 —— 那就是「改了没意义」的根因。
const COVER = 20, RING = 18, RING_GAP = 3, EQ_W = 22, GAP = 6;
const COVER_RADIUS = 6, EQ_BAR = 2, EQ_STEP = 4, EQ_MIN_H = 3, EQ_RANGE_H = 9;
const FONT_UI_SIZE = 11.5, FONT_CLOCK_SIZE = 12;
const FONT_UI_FAMILY = 'Noto Sans';
// 与 CollapsedLimits.contentMinScale / 高上限 64 对应：内容缩放只在这个区间里
const CollapsedMinScale = 0.75, CollapsedMaxScale = 2;
// 只给底边留一层很淡的环境阴影。不要沿整个刘海轮廓投影，否则肩部会出现两条竖线。
const SHADOW_PAD = 16, SHADOW_BLUR = 5, SHADOW_OFFSET_Y = 2, SHADOW_OPACITY = 0.16;

var Island = class Island {
    constructor(params) {
        this._style = params.style || 'notch';
        this._theme = params.theme || { colors: {} };
        this._shape = null;
        this._phase = 0;
        this._playing = false;
        this._clock = '';
        this._title = '';
        this._lyric = '';
        this._quotas = [];
        this._coverPixbuf = null;
        this._coverUri = '';
        this._coverSurface = null;
        // 高分屏：scale_factor 决定「1 逻辑像素 = 多少物理像素」。St 的 cairo 坐标是逻辑像素，
        // 但线宽要落在物理像素网格上才不糊 —— 1px 的 rim 在 2x 下必须是 2 物理像素宽。
        this._dpr = (function () {
            try { return St.ThemeContext.get_for_stage(global.stage).scale_factor || 1; }
            catch (e) { return 1; }
        })();

        this.actor = new St.DrawingArea({ reactive: true, track_hover: true });
        this._repaintId = this.actor.connect('repaint', () => this._paint());

        this._eqTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (!this._playing) return true;
            this._phase += 0.45;
            this.actor.queue_repaint();
            return true;
        });
    }

    // ---------------------------------------------------------------- 形状

    applyShape(shape) {
        if (!shape) return;
        this._shape = shape;
        this._style = shape.style;
        const s = shape.surface;
        // 左右和下方给底部柔影留边；顶部不预留，刘海仍贴合屏幕顶边。
        this._pad = this._style === 'line' ? 0 : SHADOW_PAD;
        this.actor.set_position(Math.round(s.x) - this._pad, Math.round(s.y));
        this.actor.set_size(Math.max(1, Math.round(s.width) + this._pad * 2),
            Math.max(1, Math.round(s.height) + this._pad));
        this.actor.queue_repaint();
        return false;
    }

    static computeShape(settings, style, monitor, work, ppd, contentWanted) {
        // 第 6 个参数就是上游的 contentWanted（自动宽度），之前漏了转发，所以岛一直是固定 238
        if (Geo && Geo.resolve) return Geo.resolve(settings, style, monitor, work, ppd, contentWanted);
        const h = style === 'capsule' ? (settings.capsuleHeight || 32)
            : style === 'line' ? (settings.lineThickness || 4) : (settings.notchHeight || 32);
        const w = style === 'capsule' ? (settings.capsuleWidth || 196)
            : style === 'line' ? (settings.lineLength || 56) : (settings.notchWidth || 238);
        const top = style === 'capsule' ? (settings.capsuleTop || 5) : style === 'line' ? (settings.lineTop || 4) : 0;
        return {
            style: style,
            surface: { x: monitor.x + Math.round((monitor.width - w) / 2), y: monitor.y + top, width: w, height: h },
            scale: h / 32, inset: style === 'notch' ? 30 : style === 'capsule' ? 16 : 0,
            contentWidth: Math.max(0, w - 2 * (style === 'notch' ? 30 : style === 'capsule' ? 16 : 0)),
            bottomRadius: style === 'notch' ? 12 : h / 2, topRadius: style === 'notch' ? 0 : h / 2,
            shoulder: style === 'notch' ? 16 : 0
        };
    }

    // 把长度对齐到物理像素网格（1/dpr 的整数倍）
    _snap(v) { return Math.round(v * this._dpr) / this._dpr; }
    // 线宽至少 1 物理像素，并落在网格上
    _lw(v) { return Math.max(1 / this._dpr, Math.round(v * this._dpr) / this._dpr); }

    // 与上游 IslandBorder.Outline() 同构。
    // 刘海：顶边直通全场 → 右肩两段 C2 贝塞尔 → 右边 → 右下角 → 底边 → 左下角 → 左边 → 左肩。
    // 胶囊/指示条：标准圆角矩形（四角都要画，之前漏了左上角，上边变成斜线 —— 就是「贴图错误」）。
    _path(cr, w, h, inset) {
        inset = inset || 0;
        const x0 = inset, y0 = inset;
        const ww = w - 2 * inset;
        const hh = h - inset;
        if (ww <= 0 || hh <= 0) { cr.newPath(); return; }

        const notch = (this._style === 'notch' || !this._style);
        const R = notch ? Math.min(12, ww / 2, hh) : Math.min(hh / 2, ww / 2);
        const s = notch ? Math.min(16, ww / 4, hh / 2) : 0;
        const depth = s * (7 / 16);
        const left = x0 + s, right = x0 + ww - s;

        cr.newPath();
        if (notch) {
            cr.moveTo(x0, y0);
            cr.lineTo(x0 + ww, y0);
            cr.curveTo(x0 + ww - s * 0.28, y0, x0 + ww - s * 0.64, y0, x0 + ww - s * 0.82, y0 + depth * 0.18);
            cr.curveTo(right, y0 + depth * 0.36, right, y0 + depth * 0.72, right, y0 + depth);
            cr.lineTo(right, y0 + hh - R);
            cr.curveTo(right, y0 + hh - R * (1 - K), right - R * (1 - K), y0 + hh, right - R, y0 + hh);
            cr.lineTo(left + R, y0 + hh);
            cr.curveTo(left + R * (1 - K), y0 + hh, left, y0 + hh - R * (1 - K), left, y0 + hh - R);
            cr.lineTo(left, y0 + depth);
            cr.curveTo(left, y0 + depth * 0.72, left, y0 + depth * 0.36, x0 + s * 0.82, y0 + depth * 0.18);
            cr.curveTo(x0 + s * 0.64, y0, x0 + s * 0.28, y0, x0, y0);
        } else {
            cr.moveTo(x0 + R, y0);
            cr.lineTo(x0 + ww - R, y0);
            cr.curveTo(x0 + ww - R * (1 - K), y0, x0 + ww, y0 + R * (1 - K), x0 + ww, y0 + R);
            cr.lineTo(x0 + ww, y0 + hh - R);
            cr.curveTo(x0 + ww, y0 + hh - R * (1 - K), x0 + ww - R * (1 - K), y0 + hh, x0 + ww - R, y0 + hh);
            cr.lineTo(x0 + R, y0 + hh);
            cr.curveTo(x0 + R * (1 - K), y0 + hh, x0, y0 + hh - R * (1 - K), x0, y0 + hh - R);
            cr.lineTo(x0, y0 + R);
            cr.curveTo(x0, y0 + R * (1 - K), x0 + R * (1 - K), y0, x0 + R, y0);
        }
        cr.closePath();
    }

    // ---------------------------------------------------------------- 绘制

    _paint() {
        const cr = this.actor.get_context();
        const pad = this._pad || 0;
        const w = this.actor.width - pad * 2;
        const h = this.actor.height - pad;
        if (!(w > 0 && h > 0)) { if (cr.$dispose) cr.$dispose(); return; }
        cr.save();
        cr.translate(pad, 0);

        if (this._style !== 'line') {
            // 离屏柔影：形状本身保持清晰，只有独立的阴影层做高斯近似。
            const shadow = this._buildShadow(w, h);
            if (shadow) {
                cr.save();
                cr.setSourceSurface(shadow, -this._shadowPad,
                    -this._shadowPad + this._snap(SHADOW_OFFSET_Y));
                cr.paintWithAlpha(SHADOW_OPACITY);
                cr.restore();
            }
        }

        // 表面：指示条用主题的 indicator 色（上游 Indicator 是灰条），刘海/胶囊用 surface
        Draw.setColor(cr, this._style === 'line' ? this._color('indicator') : this._color('surface'));
        this._path(cr, w, h, 0);
        cr.fill();

        // 指示条的播放进度段（上游 indicatorProgress）—— 也是浅色主题下这根条唯一看得见的部分
        if (this._style === 'line' && this._progress > 0) {
            cr.save();
            Draw.roundedRectPath(cr, 0, 0, w, h, h / 2);
            cr.clip();
            Draw.setColor(cr, this._color('indicatorProgress'));
            cr.rectangle(0, 0, Math.max(2, w * this._progress), h);
            cr.fill();
            cr.restore();
        }

        if (this._style !== 'line') {
            // rim 必须裁在形状内部：肩部是曲线，0.5 的内缩路径在弯折处会露到轮廓外，
            // 在浅色背景上就是那两个白色小钩。
            cr.save();
            this._path(cr, w, h, 0);
            cr.clip();
            Draw.setColor(cr, this._color('rim'));
            cr.setLineWidth(this._lw(1));
            this._path(cr, w, h, this._snap(0.5));
            cr.stroke();
            cr.restore();
        }

        if (this._style !== 'line') {
            try { this._paintContent(cr, w, h); }
            catch (e) { global.logError(e); }
        }

        cr.restore();
        if (cr.$dispose) cr.$dispose();
    }

    // 内容尺寸随岛的高度缩放（上游 scale = 高度/32，CollapsedGeometry 里就是这么给的）。
    // 之前这些字段没定义，applet 一加载就 "this._metrics is not a function"，整个对象创建失败。
    _metrics(scale) {
        const clamp = (v) => Math.max(0.75, Math.min(2, v));   // 与 CollapsedLimits.ContentMinScale / 高上限 64 对应
        const raw = Number.isFinite(scale) ? scale : ((this._shape && this._shape.scale) || 1);
        const k = clamp(raw);
        const halfPx = (v) => Math.round(v * 2) / 2;           // 字号按半像素取整，其余保留精确值
        return {
            k: k,
            cover: 20 * k, coverRadius: 6 * k,
            ring: 18 * k, ringGap: 3 * k, ringStroke: 2 * k,
            gap: 6 * k,
            eqWidth: 22 * k, eqBar: 2 * k, eqMinH: 3 * k, eqRangeH: 9 * k, eqStep: 4 * k,
            textCap: 110 * k,
            fontUi: halfPx(11.5 * k),
            fontClock: halfPx(12 * k)
        };
    }

    _fontDesc(size) {
        return Pango.FontDescription.from_string('Noto Sans ' + Number(size || 11.5).toFixed(1));
    }

    // 缓存：形状/尺寸不变就复用（repaint 在播放音乐时 150ms 一次，不能每次都 blur）
    _buildShadow(w, h) {
        const key = w + 'x' + h + ':' + this._style + ':' + this._dpr;
        if (this._shadowKey === key && this._shadowSurface) return this._shadowSurface;

        const pad = SHADOW_PAD;
        const sw = Math.max(1, Math.ceil(w + pad * 2));
        const sh = Math.max(1, Math.ceil(h + pad * 2));
        let surf;
        try { surf = new Cairo.ImageSurface(Cairo.Format.ARGB32, sw, sh); }
        catch (e) { return null; }
        const cr = new Cairo.Context(surf);
        cr.translate(pad, pad);
        cr.setSourceRGBA(0, 0, 0, 1);
        // 只投底部一小段，而不是复制整个轮廓。主体遮住上缘后，外部只留下
        // 底角附近的柔和明暗，不会在刘海肩部形成灰色描边。
        const scale = (this._shape && this._shape.scale) || 1;
        const shoulder = this._style === 'notch' && this._shape
            ? (this._shape.shoulder || 0) * scale : 0;
        const radius = this._style === 'notch' && this._shape
            ? (this._shape.bottomRadius || 12) * scale : h / 2;
        const inset = shoulder + Math.min(6, radius * 0.4);
        const shadowH = Math.max(2, radius * 1.25);
        Draw.roundedRectPath(cr, inset, h - shadowH, Math.max(1, w - inset * 2), shadowH,
            Math.min(radius, shadowH / 2));
        cr.fill();

        // GJS 的 cairo 只给了 getStride/flush，没有像素读写接口（getData / markDirty 都不存在），
        // 所以 box blur 在这台机器上跑不了。以前这里每换一次尺寸就抛一次
        // "surf.get_data is not a function" 写进 LookingGlass，等于每次重绘刷一条错误。
        // 这里先探测能不能拿到像素：拿不到就跳过模糊，直接留一层 16% 的圆角矩形（视觉上是一圈很淡的边）。
        const pixels = readSurfacePixels(surf, sw * 4);
        if (pixels) {
            // 三次 box blur 需要横向、纵向各三遍；之前横/纵/横并不是对称柔化。
            // ImageSurface 的尺寸本身就是逻辑像素，这里不再乘 dpr，避免高分屏糊成灰雾。
            const r = Math.max(2, Math.round(SHADOW_BLUR));
            blurPass(pixels.buf, sw, sh, pixels.stride, r, true);
            blurPass(pixels.buf, sw, sh, pixels.stride, r, false);
            blurPass(pixels.buf, sw, sh, pixels.stride, r, true);
            blurPass(pixels.buf, sw, sh, pixels.stride, r, false);
            blurPass(pixels.buf, sw, sh, pixels.stride, r, true);
            blurPass(pixels.buf, sw, sh, pixels.stride, r, false);
            if (typeof surf.markDirty === 'function') surf.markDirty();
            else if (typeof surf.mark_dirty === 'function') surf.mark_dirty();
        }

        this._shadowSurface = surf;
        this._shadowPad = pad;
        this._shadowKey = key;
        return surf;
    }

    _paintContent(cr, w, h) {
        const m = this._metrics();
        const inset = Math.round((this._shape && this._shape.inset) || 0);
        const avail = w - inset * 2;

        // 量出各段宽度（字体大小来自档位，所以量出来的宽度也随档位变）
        const showCover = !!this._coverSurface;
        const rings = this._quotas.length;
        const showEq = this._playing || !!this._title;
        const textStr = this._lyric || this._title || '';
        const showText = !!textStr;
        const showClock = !!this._clock;

        const layout = PangoCairo.create_layout(cr);
        layout.set_font_description(this._fontDesc(m.fontUi));

        let textW = 0, textH = 0;
        if (showText) {
            layout.set_text(textStr, -1);
            const ext = layout.get_pixel_extents()[1];
            textW = ext.width;
            textH = ext.height;
        }

        let clockW = 0;
        if (showClock) {
            const cl = PangoCairo.create_layout(cr);
            cl.set_font_description(this._fontDesc(m.fontClock));
            cl.set_text(this._clock, -1);
            clockW = cl.get_pixel_extents()[1].width;
        }

        // 总宽 = 各段 + 间隙
        let total = 0;
        if (showCover) total += m.cover + m.gap;
        if (rings) total += rings * m.ring + (rings - 1) * m.ringGap + m.gap;
        if (showText) total += Math.min(textW, Math.max(20 * m.k, avail - total)) + m.gap;
        if (showEq) total += m.eqWidth + m.gap;
        if (showClock) total += clockW;

        let x = inset + Math.max(0, (avail - total) / 2);
        const cy = h / 2;

        // 封面
        if (showCover) {
            cr.save();
            Draw.roundedRectPath(cr, x, cy - m.cover / 2, m.cover, m.cover, m.coverRadius);
            cr.clip();
            cr.setSourceSurface(this._coverSurface, x, cy - m.cover / 2);
            cr.paint();
            cr.restore();
            x += m.cover + m.gap;
        }

        // 配额环
        for (let i = 0; i < rings; i++) {
            const q = this._quotas[i];
            const cx = x + m.ring / 2;
            const r = m.ring / 2 - m.ringStroke;
            // 轨道：环的底色（主题 ringTrack）
            Draw.setColor(cr, this._color('ringTrack'));
            cr.setLineWidth(this._lw(2 * m.ringStroke));
            cr.newSubPath();
            cr.arc(cx, cy, r, 0, Math.PI * 2);
            cr.stroke();
            // 填充：从 12 点方向顺时针；percent 为 0/未知时留空（和上游一致）
            const p = Math.max(0, Math.min(100, Number(q.percent) || 0));
            if (p > 0) {
                cr.save();
                cr.translate(cx, cy);
                cr.rotate(-Math.PI / 2);
                cr.newSubPath();
                cr.arc(0, 0, r, 0, Math.PI * 2 * (p / 100));
                Draw.setColor(cr, q.color || this._color('accent'));
                cr.setLineWidth(this._lw(2 * m.ringStroke));
                cr.stroke();
                cr.restore();
            }
            x += m.ring + m.ringGap;
        }
        if (rings) x += m.gap - m.ringGap;

        // 文字（歌词优先）
        if (showText) {
            const limit = Math.max(20 * m.k, avail - (x - inset)
                - (showEq ? m.eqWidth + m.gap : 0) - (showClock ? clockW + m.gap : 0) - m.gap);
            layout.set_width(Math.round(limit * Pango.SCALE));
            layout.set_ellipsize(Pango.EllipsizeMode.END);
            const [lw, lh] = layout.get_pixel_size();
            Draw.setColor(cr, this._color(this._lyric ? 'textSecondary' : 'textPrimary'));
            cr.moveTo(x, cy - lh / 2);
            PangoCairo.show_layout(cr, layout);
            x += lw + m.gap;
        }

        // 律动条
        if (showEq) {
            cr.setLineCap(1);
            cr.setLineWidth(this._lw(m.eqBar));
            for (let i = 0; i < 5; i++) {
                const s = this._playing ? (Math.sin(this._phase + i * 0.95) * 0.5 + 0.5) : 0.15;
                const barH = m.eqMinH + m.eqRangeH * s;
                const bx = x + i * m.eqStep + m.eqStep / 4;
                Draw.setColor(cr, this._color('equalizer'));
                cr.newSubPath();
                cr.moveTo(bx, cy - barH / 2);
                cr.lineTo(bx, cy + barH / 2);
                cr.stroke();
            }
            x += m.eqWidth + m.gap;
        }

        // 时钟
        if (showClock) {
            const cl = PangoCairo.create_layout(cr);
            cl.set_font_description(this._fontDesc(m.fontClock));
            cl.set_text(this._clock, -1);
            const [cw, ch] = cl.get_pixel_size();
            Draw.setColor(cr, this._color('textSecondary'));
            cr.moveTo(x, cy - ch / 2);
            PangoCairo.show_layout(cr, cl);
        }
    }

    // ---------------------------------------------------------------- 主题与内容

    setTheme(theme) {
        this._theme = theme || { colors: {} };
        this.actor.queue_repaint();
        return false;
    }

    _color(key) {
        const c = this._theme && this._theme.colors ? this._theme.colors[key] : null;
        return Draw.cssColor(c, DEFAULT_COLORS[key] || '#000000');
    }

    setClockText(text) {
        const before = this._contentKey();
        this._clock = text || '';
        this.actor.queue_repaint();
        if (this._contentKey() !== before && this.onContentChanged) this.onContentChanged();
        return false;
    }

    setClockStyle() { return false; }

    // 当前真的画出来的段数：封面、每个配额环、文字、律动条、时钟各算 1。
    // 自动档（collapsedSize: auto）按它决定岛的高度与内容缩放 —— 只有时钟时是一枚小刘海，
    // 内容齐了才长到大档的尺寸。宽度另有 contentWidthEstimate（按字的实际长度估）。
    contentUnits() {
        let n = 0;
        if (this._coverSurface) n += 1;
        n += this._quotas.length;
        if (this._lyric || this._title) n += 1;
        if (this._playing || this._title) n += 1;
        if (this._clock) n += 1;
        return n;
    }

    // 内容指纹：宽度估不出来但段数变了（比如环少了但字刚好补上）也要重排，
    // 否则高度还按上一份内容停在原来的档上。
    _contentKey() {
        return this.contentUnits() + '|' + this.contentWidthEstimate();
    }

    // 估算内容需要多宽（用于自动宽度）。Pango 排版要 cairo context，这里按字数估：
    // 中文 ≈ 11px/字，西文 ≈ 6.6px/字（11.5px 的 Noto Sans 实测均值），再乘档位缩放，
    // 保证「大」档的岛比「小」档宽，而不是表面变大、内容还挤在中间。
    contentWidthEstimate(scale) {
        const m = this._metrics(scale);
        let w = 0;
        if (this._coverSurface) w += m.cover + m.gap;
        const rings = this._quotas.length;
        if (rings) w += rings * (m.ring + m.ringGap) - m.ringGap + m.gap;
        const text = this._lyric || this._title;
        if (text) w += Math.min(m.textCap, estimateText(text, m.k)) + m.gap;
        if (this._playing || this._title) w += m.eqWidth + m.gap;
        if (this._clock) w += estimateText(this._clock, m.k) + m.gap;
        return Math.max(0, Math.round(w));
    }

    setQuotas(quotas, enabled) {
        const before = this._contentKey();
        this._quotas = (enabled === false) ? [] : (quotas || []);
        this.actor.queue_repaint();
        if (this._contentKey() !== before && this.onContentChanged) this.onContentChanged();
        return false;
    }

    setNowPlaying(info) {
        const before = this._contentKey();
        if (!info || !info.title) {
            this._playing = false; this._title = ''; this._lyric = '';
            this._coverUri = ''; this._coverSurface = null; this._coverPixbuf = null;
            this.actor.queue_repaint();
            // 音乐停了也要重排：以前这里直接 return，岛保持播放时的宽度，
            // 内容一撤就只剩下中间几个环，两边空着（auto 档尤其明显）。
            if (this._contentKey() !== before && this.onContentChanged) this.onContentChanged();
            return false;
        }
        this._title = info.title || '';
        this._lyric = info.lyric || '';
        // playing 是 live.js 给的布尔值；status 只做 MPRIS 原始值兜底（'Playing'）
        this._playing = !!info.playing || info.status === 'Playing';
        // live.js 给的字段是 positionUs / lengthUs（微秒）
        const len = info.lengthUs || 0;
        this._progress = len > 0 ? Math.min(1, Math.max(0, (info.positionUs || 0) / len)) : null;
        if (info.artUrl) this._loadCover(info.artUrl);
        if (this._contentKey() !== before && this.onContentChanged) this.onContentChanged();
        this.actor.queue_repaint();
        return false;
    }

    _loadCover(uri) {
        if (uri === this._coverUri) return;
        this._coverUri = uri;
        const path = uri.indexOf('file://') === 0 ? decodeURIComponent(uri.slice(7)) : null;
        if (!path) { this._coverSurface = null; return; }
        try {
            const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 40, 40, true);
            this._coverSurface = Gdk.cairo_surface_create_from_pixbuf(pb, 1, null);
        } catch (e) {
            this._coverSurface = null;
        }
    }

    setMonitor() { return false; }

    destroy() {
        if (this._eqTimer) { GLib.source_remove(this._eqTimer); this._eqTimer = 0; }
        this.actor.destroy();
    }
};

// scale 可选：传了档位缩放就按比例放大，默认 1
// GJS 的 cairo 版本不一定给像素接口：有 getData/get_data 才能做 box blur。
// 拿不到就返回 null，调用方跳过模糊（不要抛异常，重绘一次就刷一条错误）。
function readSurfacePixels(surf, fallbackStride) {
    try {
        const fn = typeof surf.getData === 'function' ? surf.getData
            : typeof surf.get_data === 'function' ? surf.get_data : null;
        if (!fn) return null;
        const data = fn.call(surf);
        const buf = (data && data.length !== undefined) ? data : (data && data[0]);
        if (!buf || !buf.length) return null;
        const stride = typeof surf.getStride === 'function' ? surf.getStride()
            : typeof surf.get_stride === 'function' ? surf.get_stride() : fallbackStride;
        return { buf: buf, stride: stride };
    } catch (e) {
        return null;
    }
}

// 单方向滑窗均值（ARGB32 预乘，四个字节一起处理没问题）
function blurPass(buf, w, h, stride, radius, horizontal) {
    const tmp = new Uint8Array(buf.length);
    const n = radius * 2 + 1;
    if (horizontal) {
        for (let y = 0; y < h; y++) {
            const row = y * stride;
            for (let c = 0; c < 4; c++) {
                let sum = 0;
                for (let i = -radius; i <= radius; i++) {
                    const xx = Math.min(w - 1, Math.max(0, i));
                    sum += buf[row + xx * 4 + c];
                }
                for (let x = 0; x < w; x++) {
                    tmp[row + x * 4 + c] = (sum / n) | 0;
                    const addX = Math.min(w - 1, x + radius + 1);
                    const subX = Math.max(0, x - radius);
                    sum += buf[row + addX * 4 + c] - buf[row + subX * 4 + c];
                }
            }
        }
    } else {
        for (let x = 0; x < w; x++) {
            for (let c = 0; c < 4; c++) {
                let sum = 0;
                for (let i = -radius; i <= radius; i++) {
                    const yy = Math.min(h - 1, Math.max(0, i));
                    sum += buf[yy * stride + x * 4 + c];
                }
                for (let y = 0; y < h; y++) {
                    tmp[y * stride + x * 4 + c] = (sum / n) | 0;
                    const addY = Math.min(h - 1, y + radius + 1);
                    const subY = Math.max(0, y - radius);
                    sum += buf[addY * stride + x * 4 + c] - buf[subY * stride + x * 4 + c];
                }
            }
        }
    }
    buf.set(tmp);
}

function estimateText(str, scale) {
    const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
    let w = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        w += (c > 0x2E80 && c < 0xA000) ? 11 * k : 6.6 * k;
    }
    return w;
}

if (typeof module !== 'undefined') module.exports = { Island, DEFAULT_COLORS, estimateText };
