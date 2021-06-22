"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIconMenuItem = void 0;
const ActivWidget_1 = require("lib/ActivWidget");
const limitString_1 = require("functions/limitString");
const { Icon, IconType, Label, BoxLayout } = imports.gi.St;
function createIconMenuItem(args) {
    const { text, maxCharNumber, iconName, onActivated } = args;
    let icon;
    let label;
    const container = new BoxLayout({
        style_class: 'popup-menu-item'
    });
    setIconName(iconName);
    setText(text);
    function setIconName(name) {
        if (icon && !name) {
            container.remove_child(icon);
            icon = null;
            return;
        }
        if (!name)
            return;
        initIcon();
        icon.icon_name = name;
        if (container.get_child_at_index(0) !== icon)
            container.insert_child_at_index(icon, 0);
    }
    function initIcon() {
        if (!icon) {
            icon = new Icon({
                icon_type: IconType.SYMBOLIC,
                style_class: 'popup-menu-icon'
            });
        }
    }
    function setText(text) {
        const labelText = text || ' ';
        if (!label) {
            label = new Label();
            container.add_child(label);
        }
        label.set_text(limitString_1.limitString(labelText, maxCharNumber));
    }
    onActivated && ActivWidget_1.createActivWidget({ widget: container, onActivated });
    return {
        actor: container,
        setIconName,
        setText
    };
}
exports.createIconMenuItem = createIconMenuItem;
