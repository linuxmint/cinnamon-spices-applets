const Cairo = imports.gi.cairo;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];
const {addVectorImage} = Me.lib.colorHelpers;
const {VectorImages} = Me.lib.circularBatteryVectorImages;

var CircleBatteryIcon = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_CircleBatteryIcon',
}, class CircleBatteryIcon extends St.Widget {
    _init(canvasSize, deviceIcon, widgetInfo) {
        super._init({
            layout_manager: new Clutter.BinLayout(),
            width: canvasSize,
            height: canvasSize,
        });

        this._canvasSize = canvasSize;
        this._deviceIcon = deviceIcon;
        this._widgetInfo = widgetInfo;

        this._percentage = 0;
        this._status = null;

        this._ring = new St.DrawingArea({
            width: canvasSize,
            height: canvasSize,
        });
        this._ring.connect('repaint', this._onRepaint.bind(this));

        this._icon = new St.Icon({
            icon_name: `bbm-${deviceIcon}-symbolic`,
            icon_size: 16,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._ring);
        this.add_child(this._icon);
    }

    updateValues(percentage, status) {
        this._percentage = percentage;
        this._status = status;

        if (this._ring)
            this._ring.queue_repaint();
    }

    _assignWidgetColor() {
        const themeColors = this.get_theme_node().get_icon_colors();
        const foregroundColor = themeColors.foreground;
        const successColor = themeColors.success;
        const warningColor = themeColors.warning;
        const errorColor = themeColors.error;

        const baseLevelColor = foregroundColor.copy();
        baseLevelColor.alpha *= 0.5;

        const chargingIconColor = foregroundColor;
        const disconnectedIconColor = errorColor;

        const fillLevelColor = this._percentage > 20 ? successColor : warningColor;

        return {
            foregroundColor,
            fillLevelColor,
            baseLevelColor,
            chargingIconColor,
            disconnectedIconColor,
        };
    }

    _setRadialStrokeSource(cr, cx, cy, radius, strokeWidth, scale, color) {
        let fade = 0.2 - 0.091 * Math.log(scale);
        fade = Math.max(0.10, Math.min(0.20, fade));

        const inner = radius - strokeWidth / 2;
        const outer = radius + strokeWidth / 2;

        const gradient = new Cairo.RadialGradient(cx, cy, inner, cx, cy, outer);

        const r = color.red / 255;
        const g = color.green / 255;
        const b = color.blue / 255;
        const a = color.alpha / 255;

        gradient.addColorStopRGBA(0.0, r, g, b, 0.0);
        gradient.addColorStopRGBA(fade, r, g, b, a);
        gradient.addColorStopRGBA(1.0 - fade, r, g, b, a);
        gradient.addColorStopRGBA(1.0, r, g, b, 0.0);

        cr.setSource(gradient);
    }

    _paintChargingStatus(cr) {
        if (this._status !== 'charging' && this._status !== 'disconnected')
            return;

        const size = this._canvasSize;
        const scale = size / 32;

        cr.save();
        cr.scale(scale, scale);

        const chargingPath = VectorImages['charging-bolt'];
        const disconnectedPath = VectorImages['disconnected'];

        const colors = this._colors;

        if (this._status === 'disconnected') {
            cr.fill();
            addVectorImage(cr, disconnectedPath, colors.disconnectedIconColor);
        } else if (this._status === 'charging') {
            addVectorImage(cr, chargingPath, colors.chargingIconColor);
        }

        cr.fill();
        cr.restore();
    }

    _onRepaint(area) {
        const cr = area.get_context();

        const size = this._canvasSize;
        const scale = size / 32;
        const strokeWidth = 4.8 * Math.pow(scale, 0.85);

        const p = Math.max(0, Math.min(1, this._percentage / 100));
        const radius = (size - strokeWidth) / 2;
        const cx = size / 2;
        const cy = size / 2;
        const angleOffset = -0.5 * Math.PI;
        const endAngle = angleOffset + p * 2 * Math.PI;

        this._colors = this._assignWidgetColor();

        cr.setLineWidth(strokeWidth);

        if (p > 0) {
            this._setRadialStrokeSource(
                cr, cx, cy, radius, strokeWidth,
                scale, this._colors.fillLevelColor
            );
            cr.arc(cx, cy, radius, angleOffset, endAngle);
            cr.stroke();
        }

        if (p < 1) {
            this._setRadialStrokeSource(
                cr, cx, cy, radius, strokeWidth,
                scale, this._colors.baseLevelColor
            );
            cr.arc(cx, cy, radius, endAngle, angleOffset + 2 * Math.PI);
            cr.stroke();
        }

        this._paintChargingStatus(cr);

        cr.$dispose();
    }
});
