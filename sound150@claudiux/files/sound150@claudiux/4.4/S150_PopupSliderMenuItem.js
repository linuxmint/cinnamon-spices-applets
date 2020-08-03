const PopupMenu = imports.ui.popupMenu;

function MyPopupSliderMenuItem() {
    this._init.apply(this, arguments);
}

MyPopupSliderMenuItem.prototype = {
    __proto__: PopupMenu.PopupSliderMenuItem.prototype,

    _init: function(applet, value) {
        this.applet = applet;
        PopupMenu.PopupSliderMenuItem.prototype._init.call(this, value);
    },

    _sliderRepaint: function(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();

        let handleRadius = themeNode.get_length('-slider-handle-radius');

        let sliderWidth = width - 2 * handleRadius;
        let sliderHeight = themeNode.get_length('-slider-height');

        let sliderBorderWidth = themeNode.get_length('-slider-border-width');
        let sliderBorderRadius = Math.min(width, sliderHeight) / 2;

        let sliderBorderColor = themeNode.get_color('-slider-border-color');
        let sliderColor = themeNode.get_color('-slider-background-color');

        let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
        let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

        const TAU = Math.PI * 2;

        let handleX = handleRadius + (width - 2 * handleRadius) * this._value;

        cr.arc(sliderBorderRadius + sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 1/4, TAU * 3/4);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(sliderBorderRadius + sliderBorderWidth, (height + sliderHeight) / 2);
        Clutter.cairo_set_source_color(cr, sliderActiveColor);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();

        cr.arc(width - sliderBorderRadius - sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 3/4, TAU * 1/4);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(width - sliderBorderRadius - sliderBorderWidth, (height - sliderHeight) / 2);
        Clutter.cairo_set_source_color(cr, sliderColor);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, sliderBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();

        let handleY = height / 2;

        let color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
        cr.fill();

        if (this.applet.percentMaxVolume > 100) {
            // Mark of 100%
            let xMark = handleRadius + sliderWidth * 100 / this.applet.percentMaxVolume;
            let yMark = handleY - sliderHeight;
            cr.rectangle(xMark-handleRadius/4, yMark-handleRadius/2, handleRadius/2, handleRadius);
            cr.fill();
            cr.arc(xMark, yMark-handleRadius/2, handleRadius/4 , Math.PI, 2*Math.PI);
            cr.fill();
            cr.arc(xMark, yMark+handleRadius/2, handleRadius/4 , 0, Math.PI);
            cr.fill();
        }

        cr.$dispose();
    }
}
