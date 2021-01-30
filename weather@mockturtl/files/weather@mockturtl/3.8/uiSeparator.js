"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UISeparator = void 0;
const { PopupSeparatorMenuItem } = imports.ui.popupMenu;
class UISeparator {
    constructor() {
        this.actor = new PopupSeparatorMenuItem();
        this.actor.actor.remove_style_class_name("popup-menu-item");
    }
    get Actor() {
        return this.actor.actor;
    }
    Show() {
        this.actor.actor.show();
    }
    Hide() {
        this.actor.actor.hide();
    }
}
exports.UISeparator = UISeparator;
