"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApplet = void 0;
const { Applet, AllowedLayout } = imports.ui.applet;
const { Bin } = imports.gi.St;
const { EventType } = imports.gi.Clutter;
function createApplet(args) {
    const { orientation, panelHeight, instanceId, icon, label, onClick, onScroll, onMiddleClick, onAppletMoved, onAppletRemoved, onRightClick } = args;
    const applet = new Applet(orientation, panelHeight, instanceId);
    let appletReloaded = false;
    [icon, label].forEach(widget => {
        applet.actor.add_child(widget);
    });
    applet.on_applet_clicked = onClick;
    applet.on_applet_middle_clicked = onMiddleClick;
    applet.setAllowedLayout(AllowedLayout.BOTH);
    applet.on_applet_reloaded = function () {
        appletReloaded = true;
    };
    applet.on_applet_removed_from_panel = function () {
        appletReloaded ? onAppletMoved() : onAppletRemoved();
        appletReloaded = false;
    };
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
