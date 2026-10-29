// lib/ui/ring.js —— 收起态的配额环
//
// 上游用 WPF 的 Path/Ellipse 画（QuotaBar.cs 的缓动与 MainWindow.CompactLayout 的排布），
// 这里用 St.DrawingArea + cairo，尺寸与上游的 24px 内容行对齐。
'use strict';

const St = imports.gi.St;
const Draw = imports.lib.ui.draw;

var QuotaRing = class QuotaRing {
    // size：环的边长（px）；thickness：环宽；percent：0–100
    constructor(size, thickness, color, trackColor) {
        this._size = size;
        this._thickness = thickness;
        this._color = color;
        this._track = trackColor;
        this._percent = 0;

        this.actor = new St.DrawingArea({ width: size, height: size, x_align: 2 /* CENTER */, y_align: 2 });
        this._repaintId = this.actor.connect('repaint', () => this._repaint());
    }

    setValue(percent, color) {
        this._percent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
        if (color) this._color = color;
        this.actor.queue_repaint();
    }

    setColors(color, trackColor) {
        if (color) this._color = color;
        if (trackColor) this._track = trackColor;
        this.actor.queue_repaint();
    }

    destroy() {
        if (this._repaintId) this.actor.disconnect(this._repaintId);
        this._repaintId = 0;
        this.actor.destroy();
    }

    _repaint() {
        const cr = this.actor.get_context();
        const w = this.actor.width || this._size;
        const h = this.actor.height || this._size;
        const lw = this._thickness;
        const radius = Math.min(w, h) / 2 - lw / 2;
        const cx = w / 2;
        const cy = h / 2;

        cr.save();
        // 底环
        Draw.setColor(cr, this._track);
        cr.setLineWidth(lw);
        cr.newSubPath();
        cr.arc(cx, cy, radius, 0, Math.PI * 2);
        cr.stroke();

        // 进度环：0 时不画，避免圆端帽留下一个点
        if (this._percent > 0) {
            const start = -Math.PI / 2;
            Draw.setColor(cr, this._color);
            cr.setLineWidth(lw);
            cr.setLineCap(1);
            cr.newSubPath();
            cr.arc(cx, cy, radius, start, start + Math.PI * 2 * (this._percent / 100));
            cr.stroke();
        }
        cr.restore();
        if (typeof cr.$dispose === 'function') cr.$dispose();
    }
}

if (typeof module !== 'undefined') module.exports = { QuotaRing };
