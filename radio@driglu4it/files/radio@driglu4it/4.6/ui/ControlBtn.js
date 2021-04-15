"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createControlBtn = void 0;
const { Button, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
function createControlBtn(args) {
    const { iconName, tooltipTxt, onClick } = args;
    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: iconName,
        style_class: 'popup-menu-icon'
    });
    const controlBtn = new Button({
        reactive: true,
        can_focus: true,
        style_class: "popup-menu-item",
        style: "width:20px; padding:10px!important",
        child: icon
    });
    controlBtn.connect("enter-event", () => {
        controlBtn.add_style_pseudo_class('active');
    });
    controlBtn.connect("leave-event", () => {
        controlBtn.remove_style_pseudo_class('active');
    });
    controlBtn.connect("clicked", onClick);
    const tooltip = new Tooltip(controlBtn, tooltipTxt);
    Object.defineProperties(controlBtn, {
        iconName: {
            get: () => { return icon.icon_name; },
            set: (newName) => { icon.icon_name = newName; }
        },
        tooltipTxt: {
            get: () => { return tooltip['_tooltip'].text; },
            set: (newTooltipTxt) => tooltip.set_text(newTooltipTxt)
        },
        onClick: {
            value: onClick,
            writable: true
        },
        showTooltip: {
            value: () => tooltip.show()
        },
        hideTooltip: {
            value: () => tooltip.hide()
        }
    });
    return controlBtn;
}
exports.createControlBtn = createControlBtn;
