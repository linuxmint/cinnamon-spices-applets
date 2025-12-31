import { createActivWidget } from "../../../lib/ActivWidget";

const { Button, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

interface Arguments {
    iconName?: string,
    tooltipTxt?: string,
    onClick: { (): void },
}

export function createControlBtn(args: Arguments) {

    const {
        iconName,
        tooltipTxt,
        onClick
    } = args

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: iconName || '',
        style: "icon-size:16px;",
        style_class: 'popup-menu-icon' // this specifies the icon-size
    })

    const btn = new Button({
        reactive: true,
        can_focus: true,
        // It is challenging to get a reasonable style on all themes. I have tried using the 'sound-player-overlay' class but didn't get it working. However might be possible anyway.  
        style_class: "popup-menu-item",
        style: "width:20px; padding:10px!important",
        child: icon
    })

    createActivWidget({
        widget: btn,
        onActivated: onClick
    })

    const tooltip = new Tooltip(btn, tooltipTxt || '')

    return {
        actor: btn,
        icon,
        tooltip
    }
}