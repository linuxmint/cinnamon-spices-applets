"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppletLabel = void 0;
const { Label } = imports.gi.St;
const { EllipsizeMode } = imports.gi.Pango;
const { ActorAlign } = imports.gi.Clutter;
function createAppletLabel() {
    const label = new Label({
        reactive: true,
        track_hover: true,
        style_class: 'applet-label',
        y_align: ActorAlign.CENTER,
        y_expand: false,
        visible: false
    });
    label.clutter_text.ellipsize = EllipsizeMode.NONE;
    let visible;
    let text;
    function setText(newValue) {
        text = newValue;
        if (!visible)
            return;
        label.show();
        newValue ? label.text = ` ${newValue}` : label.hide();
    }
    function setVisibility(newValue) {
        visible = newValue;
        if (text)
            label.visible = newValue;
        if (visible && text)
            setText(text);
    }
    return {
        actor: label,
        setVisibility,
        setText,
    };
}
exports.createAppletLabel = createAppletLabel;
