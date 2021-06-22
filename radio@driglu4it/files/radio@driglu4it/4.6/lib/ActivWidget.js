"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivWidget = void 0;
const { KEY_space, KEY_KP_Enter, KEY_Return } = imports.gi.Clutter;
function createActivWidget(args) {
    const { widget, onActivated } = args;
    widget.can_focus = true;
    widget.reactive = true;
    widget.track_hover = true;
    widget.connect('button-release-event', () => onActivated === null || onActivated === void 0 ? void 0 : onActivated());
    widget.connect('notify::hover', () => {
        widget.change_style_pseudo_class('active', widget.hover);
        if (widget.hover)
            widget.grab_key_focus();
    });
    widget.connect('key-press-event', (actor, event) => {
        const symbol = event.get_key_symbol();
        const relevantKeys = [KEY_space, KEY_KP_Enter, KEY_Return];
        if (relevantKeys.includes(symbol) && widget.hover)
            onActivated === null || onActivated === void 0 ? void 0 : onActivated();
    });
}
exports.createActivWidget = createActivWidget;
