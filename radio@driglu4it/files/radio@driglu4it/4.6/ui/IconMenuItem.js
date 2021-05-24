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
exports.createIconMenuItem = void 0;
const limitString_1 = require("functions/limitString");
const { Label, Icon, IconType } = imports.gi.St;
const { PopupBaseMenuItem } = imports.ui.popupMenu;
function createIconMenuItem(args) {
    const { text, maxCharNumber, iconName: initialIconName, params } = args;
    const baseMenuItem = new PopupBaseMenuItem(params);
    let icon;
    let label;
    function setIconName(name) {
        if (icon && !name) {
            baseMenuItem.removeActor(icon);
            icon = null;
            return;
        }
        if (!name)
            return;
        if (icon && name) {
            icon.icon_name = name;
            return;
        }
        icon = new Icon({
            icon_type: IconType.SYMBOLIC,
            icon_name: name,
            style_class: 'popup-menu-icon'
        });
        _addActor(icon, { span: 0 }, 0);
    }
    function setText(text) {
        if (!text)
            text = ' ';
        const limitedTextString = limitString_1.limitString(text, maxCharNumber);
        if (!label) {
            label = new Label({ text: limitedTextString });
            _addActor(label);
            return;
        }
        label.text = limitedTextString;
    }
    function _addActor(actor, params, position) {
        const children = baseMenuItem["_children"];
        if (position == null)
            position = children.length + 1;
        if (position >= children.length) {
            baseMenuItem.addActor(actor, params);
            return;
        }
        children.forEach((child, index) => {
            const { actor: childActor } = child, childParams = __rest(child, ["actor"]);
            baseMenuItem.removeActor(childActor);
            if (index === position)
                baseMenuItem.addActor(actor, params);
            baseMenuItem.addActor(childActor, childParams);
        });
    }
    setIconName(initialIconName);
    setText(text);
    return {
        actor: baseMenuItem,
        setIconName,
        setText
    };
}
exports.createIconMenuItem = createIconMenuItem;
