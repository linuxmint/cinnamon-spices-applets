"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaControlToolbar = void 0;
const { BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const createMediaControlToolbar = (args) => {
    const { controlBtns } = args;
    const toolbar = new BoxLayout({
        style_class: "radio-applet-media-control-toolbar",
        x_align: ActorAlign.CENTER
    });
    controlBtns.forEach(btn => toolbar.add_child(btn));
    return toolbar;
};
exports.createMediaControlToolbar = createMediaControlToolbar;
