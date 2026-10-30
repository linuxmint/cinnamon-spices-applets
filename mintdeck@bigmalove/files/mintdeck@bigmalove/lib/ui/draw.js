// lib/ui/draw.js —— cairo 绘制小工具（纯 JS，可 node 测）
//
// St.DrawingArea 的 repaint 回调里拿到的是 Cairo.Context，接口和
// Cairo.Context 的 JS 绑定一致。这里只做形状与颜色，不碰 St。
'use strict';

// "#RRGGBB" / "#AARRGGBB" / "rgba(r,g,b,a)" → {r,g,b,a}（0–1 浮点，与 cairo 一致）
// 上游主题里的颜色一律是 #AARRGGBB 或 #RRGGBB（Templates/theme-template.json 注释）。
function parseColor(value, fallback) {
    const fb = fallback || { r: 0, g: 0, b: 0, a: 1 };
    if (typeof value !== 'string') return fb;
    let s = value.trim();
    // cssColor() 产生的是 rgba(r,g,b,a)，setColor 也得能吃回去（主题色经过一遍 cssColor 就是这种串）
    const m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
        const parts = m[1].split(',').map(x => parseFloat(x));
        if (parts.length >= 3) {
            return {
                r: (parts[0] || 0) / 255,
                g: (parts[1] || 0) / 255,
                b: (parts[2] || 0) / 255,
                a: parts.length > 3 ? parts[3] : 1
            };
        }
        return fb;
    }
    if (s.charAt(0) === '#') s = s.slice(1);
    if (s.length !== 6 && s.length !== 8) return fb;
    if (!/^[0-9a-fA-F]+$/.test(s)) return fb;
    const hasAlpha = s.length === 8;
    const a = hasAlpha ? parseInt(s.slice(0, 2), 16) / 255 : 1;
    const r = parseInt(s.slice(hasAlpha ? 2 : 0, hasAlpha ? 4 : 2), 16) / 255;
    const g = parseInt(s.slice(hasAlpha ? 4 : 2, hasAlpha ? 6 : 4), 16) / 255;
    const b = parseInt(s.slice(hasAlpha ? 6 : 4, hasAlpha ? 8 : 6), 16) / 255;
    return { r: r, g: g, b: b, a: a };
}

// 主题里的颜色是 #AARRGGBB（WPF 习惯），CSS/St 只认 #RRGGBB 或 rgba()，必须转一次
function cssColor(value, fallback) {
    const c = typeof value === 'string' ? parseColor(value, parseColor(fallback || '#FFFFFFFF')) : (value || parseColor(fallback || '#FFFFFFFF'));
    const a = Math.round((c.a === undefined ? 1 : c.a) * 1000) / 1000;
    return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + a + ')';
}

function setColor(cr, color, alphaScale) {
    const c = typeof color === 'string' ? parseColor(color) : color;
    const a = (alphaScale === undefined ? 1 : alphaScale) * (c.a === undefined ? 1 : c.a);
    cr.setSourceRGBA(c.r, c.g, c.b, a);
}

// 圆角矩形路径。radii 可以是一个数（四角相同）或 {tl,tr,br,bl}。
function roundedRectPath(cr, x, y, w, h, radii) {
    const r = typeof radii === 'number'
        ? { tl: radii, tr: radii, br: radii, bl: radii }
        : { tl: radii.tl || 0, tr: radii.tr || 0, br: radii.br || 0, bl: radii.bl || 0 };
    const max = Math.min(w, h) / 2;
    const tl = Math.min(r.tl, max), tr = Math.min(r.tr, max);
    const br = Math.min(r.br, max), bl = Math.min(r.bl, max);

    cr.moveTo(x + tl, y);
    cr.lineTo(x + w - tr, y);
    if (tr > 0) cr.arc(x + w - tr, y + tr, tr, -Math.PI / 2, 0);
    cr.lineTo(x + w, y + h - br);
    if (br > 0) cr.arc(x + w - br, y + h - br, br, 0, Math.PI / 2);
    cr.lineTo(x + bl, y + h);
    if (bl > 0) cr.arc(x + bl, y + h - bl, bl, Math.PI / 2, Math.PI);
    cr.lineTo(x, y + tl);
    if (tl > 0) cr.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5);
    cr.closePath();
}

// 刘海两侧的「肩」：从形状的侧边向外张开的弧，用来和屏幕顶边衔接。
// 上游 IslandBorder 用 ShoulderRadius(16) 画同一件事（见 CollapsedGeometry.cs:30）。
// side: -1 左侧 / +1 右侧；方向约定见 tests/geometry.test.js 的 shoulder 断言。
function shoulderPath(cr, x, y, radius, side, height) {
    const r = Math.max(0, radius);
    if (r === 0) return;
    const cx = x;
    const cy = y + r;
    if (side < 0) {
        cr.moveTo(cx, y);
        cr.curveTo(cx, cy - r * 0.45, cx - r * 0.55, cy, cx - r, cy);
    } else {
        cr.moveTo(cx, y);
        cr.curveTo(cx, cy - r * 0.45, cx + r * 0.55, cy, cx + r, cy);
    }
}

// 环形进度：从 12 点方向顺时针。
function ringPath(cr, cx, cy, radius, lineWidth, percent) {
    const p = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
    const start = -Math.PI / 2;
    cr.setLineWidth(lineWidth);
    cr.setLineCap(1 /* CAIRO_LINE_CAP_ROUND */);
    // track
    cr.newSubPath();
    cr.arc(cx, cy, radius, 0, Math.PI * 2);
    // fill（percent 为 0 时不画，避免端点圆帽画出一个小点）
    if (p > 0) {
        cr.newSubPath();
        cr.arc(cx, cy, radius, start, start + Math.PI * 2 * p);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { parseColor, cssColor, setColor, roundedRectPath, shoulderPath, ringPath };
}
