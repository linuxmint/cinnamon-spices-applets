"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconMenuItem = void 0;
const { Label, Icon, IconType } = imports.gi.St;
const { PopupBaseMenuItem } = imports.ui.popupMenu;
class IconMenuItem extends PopupBaseMenuItem {
    constructor(text, iconName, params) {
        super(params);
        this.iconName = iconName;
        this.text = text;
    }
    set iconName(newName) {
        if (this.icon && !newName) {
            this.removeActor(this.icon);
            this.icon.destroy();
            this.icon = null;
        }
        if (this.icon && newName)
            this.icon.icon_name = newName;
        if (!this.icon && newName) {
            this.icon = new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_name: newName,
                style_class: 'popup-menu-icon'
            });
            this.addActor(this.icon, { span: 0 }, 0);
        }
    }
    ;
    set text(newText) {
        if (!newText)
            return;
        if (!this.label) {
            this.label = new Label({ text: newText });
            this.addActor(this.label);
            return;
        }
        this.label.text = newText;
    }
    addActor(actor, params, position) {
        const children = this._children;
        if (position > children.length || children.length === 0 || position == null) {
            super.addActor(actor, params);
            return;
        }
        children.forEach((child, index) => {
            const { actor: childActor } = child, childParams = __rest(child, ["actor"]);
            this.removeActor(childActor);
            if (index === position)
                super.addActor(actor, params);
            super.addActor(childActor, childParams);
        });
    }
}
exports.IconMenuItem = IconMenuItem;
