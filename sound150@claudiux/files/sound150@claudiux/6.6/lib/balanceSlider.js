//!/usr/bin/cjs

const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Cvc = imports.gi.Cvc;
const Clutter = imports.gi.Clutter;

const { ControlButton } = require("./lib/controlButton");

class BalanceSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, stream, tooltip, app_icon) {
        
    }
    
}

module.exports = {
    BalanceSlider
}
