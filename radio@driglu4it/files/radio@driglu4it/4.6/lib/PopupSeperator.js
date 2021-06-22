"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSeparatorMenuItem = void 0;
const { BoxLayout, DrawingArea } = imports.gi.St;
const { LinearGradient } = imports.gi.cairo;
function createSeparatorMenuItem() {
    const container = new BoxLayout({
        style_class: 'popup-menu-item'
    });
    const drawingArea = new DrawingArea({
        style_class: 'popup-separator-menu-item',
        x_expand: true
    });
    container.add_child(drawingArea);
    drawingArea.connect('repaint', () => {
        const cr = drawingArea.get_context();
        const themeNode = drawingArea.get_theme_node();
        const [width, height] = drawingArea.get_surface_size();
        const margin = themeNode.get_length('-margin-horizontal');
        const gradientHeight = themeNode.get_length('-gradient-height');
        const startColor = themeNode.get_color('-gradient-start');
        const endColor = themeNode.get_color('-gradient-end');
        const gradientWidth = (width - margin * 2);
        const gradientOffset = (height - gradientHeight) / 2;
        const pattern = new LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
        cr.$dispose;
    });
    return container;
}
exports.createSeparatorMenuItem = createSeparatorMenuItem;
