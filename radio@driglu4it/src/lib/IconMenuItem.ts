import { createActivWidget } from "./ActivWidget";
import { limitString } from "../functions/limitString"

const { Icon, IconType, Label, BoxLayout } = imports.gi.St
const { Point } = imports.gi.Clutter

interface Arguments {
    initialText?: string | undefined,
    iconName?: string,
    onActivated?: () => void
    maxCharNumber: number,
}

export function createIconMenuItem(args: Arguments) {

    const {
        initialText,
        maxCharNumber,
        iconName,
        onActivated
    } = args

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        style_class: 'popup-menu-icon',
        pivot_point: new Point({ x: 0.5, y: 0.5 }), 
        icon_name: iconName || '', 
        visible: !!iconName
    })

    const label = new Label({
        text: limitString(initialText || '', maxCharNumber) 
    })

    const container = new BoxLayout({
        style_class: 'popup-menu-item'
    })

    container.add_child(icon)
    container.add_child(label)
    initialText && setText(initialText)

    function setIconName(name: string | null | undefined) {

        if (!name) {
            icon.visible = false
            return
        }

        icon.icon_name = name
        icon.visible = true
 
    }

    function setText(text: string) {
        label.set_text(limitString(text || ' ', maxCharNumber))
    }

    onActivated && createActivWidget({ widget: container, onActivated });

    return {
        actor: container,
        setIconName,
        setText,
        getIcon: () => icon
    }


}