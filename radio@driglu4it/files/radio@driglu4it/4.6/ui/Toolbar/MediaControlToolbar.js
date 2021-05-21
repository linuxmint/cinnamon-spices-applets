"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaControlToolbar = void 0;
const { PopupMenuSection } = imports.ui.popupMenu;
const { Bin, Align, BoxLayout } = imports.gi.St;
const createMediaControlToolbar = (args) => {
    const { controlBtns } = args;
    const controls = new BoxLayout({
        style_class: "radio-applet-media-control-toolbar"
    });
    controlBtns.forEach(btn => controls.add_actor(btn));
    const container = new Bin({
        x_align: Align.MIDDLE,
    });
    container.set_child(controls);
    const menuSection = new PopupMenuSection();
    menuSection.addActor(container);
    return menuSection;
};
exports.createMediaControlToolbar = createMediaControlToolbar;
