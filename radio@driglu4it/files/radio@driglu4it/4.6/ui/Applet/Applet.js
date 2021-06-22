"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApplet = void 0;
const { Applet, AllowedLayout } = imports.ui.applet;
const { Bin } = imports.gi.St;
const { EventType } = imports.gi.Clutter;
function createApplet(args) {
    const { orientation, panelHeight, instanceId, icon, label, onClick, onScroll, onMiddleClick, onAppletRemovedFromPanel, onRightClick } = args;
    const applet = new Applet(orientation, panelHeight, instanceId);
    [icon, label].forEach(widget => {
        applet.actor.add_child(widget);
    });
    applet.on_applet_clicked = onClick;
    applet.on_applet_middle_clicked = onMiddleClick;
    applet.on_applet_removed_from_panel = onAppletRemovedFromPanel;
    applet.setAllowedLayout(AllowedLayout.BOTH);
    applet.actor.connect('event', (actor, event) => {
        if (event.type() !== EventType.BUTTON_PRESS)
            return;
        if (event.get_button() === 3) {
            onRightClick();
        }
    });
    applet.actor.connect('scroll-event', (actor, event) => {
        onScroll(event.get_scroll_direction());
    });
    return applet;
}
exports.createApplet = createApplet;
