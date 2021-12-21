import { createActivWidget } from "./ActivWidget";
import { limitString } from "../functions/limitString"

const { Icon, IconType, Label, BoxLayout } = imports.gi.St

interface Arguments {
    text?: string,
    iconName?: string,
    onActivated?: () => void
    maxCharNumber: number,
}

export function createIconMenuItem(args: Arguments) {

    const {
        text,
        maxCharNumber,
        iconName,
        onActivated
    } = args


    let icon: imports.gi.St.Icon | null
    let label: imports.gi.St.Label

    const container = new BoxLayout({
        style_class: 'popup-menu-item'
    })

    iconName && setIconName(iconName)
    text && setText(text)

    function setIconName(name: string | null | undefined) {

        if (icon && !name) {
            container.remove_child(icon)
            icon = null
            return
        }

        if (!name) return

        initIcon()

        if (icon)
            icon.icon_name = name

        if (icon && container.get_child_at_index(0) !== icon)
            container.insert_child_at_index(icon, 0)
    }

    function initIcon() {
        if (!icon) {
            icon = new Icon({
                icon_type: IconType.SYMBOLIC,
                style_class: 'popup-menu-icon'
            })
        }
    }

    function setText(text: string) {
        const labelText = text || ' '

        if (!label) {
            label = new Label();
            container.add_child(label)
        }
        label.set_text(limitString(labelText, maxCharNumber))
    }

    onActivated && createActivWidget({ widget: container, onActivated });

    return {
        actor: container,
        setIconName,
        setText
    }


}