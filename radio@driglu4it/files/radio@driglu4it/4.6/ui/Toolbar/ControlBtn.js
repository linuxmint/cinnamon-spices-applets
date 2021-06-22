"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createControlBtn = void 0;
const ActivWidget_1 = require("lib/ActivWidget");
const { Button, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
function createControlBtn(args) {
    const { iconName, tooltipTxt, onClick } = args;
    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: iconName,
        style_class: 'popup-menu-icon'
    });
    const btn = new Button({
        reactive: true,
        can_focus: true,
        style_class: "popup-menu-item",
        style: "width:20px; padding:10px!important",
        child: icon
    });
    ActivWidget_1.createActivWidget({
        widget: btn,
        onActivated: onClick
    });
    const tooltip = new Tooltip(btn, tooltipTxt);
    return {
        actor: btn,
        icon,
        tooltip
    };
}
exports.createControlBtn = createControlBtn;
