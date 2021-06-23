"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubMenu = void 0;
const ActivWidget_1 = require("lib/ActivWidget");
const { BoxLayout, Label, Icon, ScrollView } = imports.gi.St;
const { ActorAlign, Point } = imports.gi.Clutter;
const { PolicyType } = imports.gi.Gtk;
function createSubMenu(args) {
    const { text } = args;
    const container = new BoxLayout({
        vertical: true
    });
    const label = new Label({
        text
    });
    const triangle = new Icon({
        style_class: 'popup-menu-arrow',
        icon_name: 'pan-end',
        rotation_angle_z: 90,
        x_expand: true,
        x_align: ActorAlign.END,
        pivot_point: new Point({ x: 0.5, y: 0.5 }),
        important: true
    });
    const toggle = new BoxLayout({
        style_class: 'popup-menu-item popup-submenu-menu-item'
    });
    ActivWidget_1.createActivWidget({
        widget: toggle,
        onActivated: toggleScrollbox
    });
    [label, triangle].forEach(widget => toggle.add_child(widget));
    container.add_child(toggle);
    const scrollbox = new ScrollView({
        style_class: 'popup-sub-menu',
        vscrollbar_policy: PolicyType.AUTOMATIC,
        hscrollbar_policy: PolicyType.NEVER
    });
    const box = new BoxLayout({
        vertical: true
    });
    function toggleScrollbox() {
        scrollbox.visible ? closeMenu() : openMenu();
    }
    function openMenu() {
        scrollbox.show();
        triangle.rotation_angle_z = 90;
    }
    function closeMenu() {
        scrollbox.hide();
        triangle.rotation_angle_z = 0;
    }
    scrollbox.add_actor(box);
    [toggle, scrollbox].forEach(widget => container.add_child(widget));
    return {
        actor: container,
        box,
    };
}
exports.createSubMenu = createSubMenu;
