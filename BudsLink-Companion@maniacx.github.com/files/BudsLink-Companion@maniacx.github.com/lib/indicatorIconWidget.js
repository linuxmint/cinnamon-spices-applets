const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

var IndicatorIconWidget = GObject.registerClass(
class IndicatorIconWidget extends St.BoxLayout {
    _init(path, deviceIcon, percentage, size) {
        super._init({
            vertical: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            //  reactive: false,
        });

        this._path = path;
        this._deviceIcon = deviceIcon;
        this._baseIconSize = size;
        this._percentage = percentage;

        this._icon = new St.Icon({
            icon_size: this._baseIconSize,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._updateIconPath();
        this.add_child(this._icon);

        this._spacer = new St.Bin({
            width: this._baseIconSize * 0.25,
            height: this._baseIconSize,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._spacer);

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const scaleFactor = themeContext.scale_factor;

        this._battery = new St.DrawingArea({
            width: this._baseIconSize * scaleFactor * 0.25,
            height: this._baseIconSize * scaleFactor,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._battery.connect('repaint', this._drawBatteryBarLevel.bind(this));

        this.add_child(this._battery);
    }

    updateSize(size) {
        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const scaleFactor = themeContext.scale_factor;
        this._baseIconSize = size;
        this._icon.icon_size = size;
        this._spacer.width = size * 0.25;
        this._spacer.height = size;
        this._battery.width = size * 0.25 * scaleFactor;
        this._battery.height = size * scaleFactor;
        this._battery.queue_redraw();
    }

    updateValues(percentage) {
        this._percentage = Math.max(0, Math.min(100, percentage));
        this._battery.queue_repaint();
    }

    updateProperties(deviceIcon) {
        if (this._deviceIcon === deviceIcon)
            return;

        this._deviceIcon = deviceIcon;
        this._updateIconPath();
    }

    _updateIconPath() {
        const iconFolder = `${this._path}/icons/hicolor/scalable/actions`;
        const filePath = `${iconFolder}/bbm-${this._deviceIcon}-symbolic.svg`;

        this._filePath = filePath;

        const gicon = Gio.icon_new_for_string(filePath);

        this._icon.gicon = gicon;
        this._icon.icon_type = St.IconType.GICON;
    }

    _getColors() {
        const themeColors = this.get_theme_node().get_icon_colors();

        const foregroundColor = themeColors.foreground;
        const successColor = themeColors.success;
        const warningColor = themeColors.warning;

        const baseLevelColor = foregroundColor.copy();
        baseLevelColor.alpha *= 0.5;

        let fillLevelColor;

        if (this._percentage > 20)
            fillLevelColor = successColor;
        else
            fillLevelColor = warningColor;

        return {baseLevelColor, fillLevelColor};
    }

    _drawBatteryBarLevel(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();

        if (w === 0 || h === 0) {
            cr.$dispose();
            return;
        }

        const scale = h / 16;
        const widgetW = h * 0.25;
        const widgetH = h;
        const colors = this._getColors();

        const radius = 0.5 * scale;
        const notchH = 2 * scale;
        const notchW = widgetW * 0.6;
        const barW = widgetW;
        const barH = widgetH - notchH;
        const barX = 0;
        const barY = 0 + notchH;
        const notchX = (widgetW - notchW) / 2;
        const notchY = 0;

        const fillH = barH * (this._percentage / 100);
        const fillY = barY + (barH - fillH);

        const drawRoundedRect = (x, y, width, height) => {
            cr.newPath();

            cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
            cr.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
            cr.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
            cr.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);

            cr.closePath();
            cr.fill();
        };

        Clutter.cairo_set_source_color(cr, colors.baseLevelColor);
        drawRoundedRect(barX, barY, barW, barH);

        Clutter.cairo_set_source_color(cr, this._percentage === 100 ? colors.fillLevelColor : colors.baseLevelColor);
        drawRoundedRect(notchX, notchY, notchW, notchH);

        Clutter.cairo_set_source_color(cr, colors.fillLevelColor);
        drawRoundedRect(barX, fillY, barW, fillH);

        cr.$dispose();
    }
});
