
const { Button, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

interface Arguments {
    iconName: string,
    tooltipTxt: string,
    onClick: { (): void },
}

export interface ControlBtn extends imports.gi.St.Button, Arguments {
    showTooltip: { (): void },
    hideTooltip: { (): void }
}

export function createControlBtn(args: Arguments) {

    const {
        iconName,
        tooltipTxt,
        onClick
    } = args

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: iconName,
        style_class: 'popup-menu-icon' // this specifies the icon-size
    })

    const controlBtn = new Button({
        reactive: true,
        can_focus: true,
        // It is challenging to get a reasonable style on all themes. I have tried using the 'sound-player-overlay' class but didn't get it working. However might be possible anyway.  
        style_class: "popup-menu-item",
        style: "width:20px; padding:10px!important",
        child: icon
    }) as ControlBtn

    // in cinnamon themes are no hover pseudo classes (at least at the moment). 
    // Therefore it is toggled the active pseudo class when cursor enters/leaves the btn
    controlBtn.connect("enter-event", () => {
        controlBtn.add_style_pseudo_class('active')
    })

    controlBtn.connect("leave-event", () => {
        controlBtn.remove_style_pseudo_class('active')
    })

    controlBtn.connect("clicked", onClick)

    const tooltip = new Tooltip(controlBtn, tooltipTxt)

    Object.defineProperties(controlBtn, {
        iconName: {
            get: () => { return icon.icon_name },
            set: (newName: string) => { icon.icon_name = newName }
        },
        tooltipTxt: {
            get: () => { return tooltip['_tooltip'].text },
            set: (newTooltipTxt: string) => tooltip.set_text(newTooltipTxt)
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

    return controlBtn
}