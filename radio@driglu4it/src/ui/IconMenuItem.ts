import { limitString } from "functions/limitString"

const { Label, Icon, IconType } = imports.gi.St
const { PopupBaseMenuItem } = imports.ui.popupMenu

interface Arguments {
    text: string,
    maxCharNumber: number,
    iconName?: string,
    params?: imports.ui.popupMenu.PopupBaseMenuItemParams,
}

export function createIconMenuItem(args: Arguments) {

    const {
        text,
        maxCharNumber,
        iconName: initialIconName,
        params // not changeable at the moment
    } = args

    const baseMenuItem = new PopupBaseMenuItem(params)

    let icon: imports.gi.St.Icon
    let label: imports.gi.St.Label

    /**
     * @param newName: the iconName. If null no Icon is shown
     */
    function setIconName(name: string | null) {

        if (icon && !name) {
            baseMenuItem.removeActor(icon)
            icon = null
            return
        }

        if (!name) return

        if (icon && name) {
            icon.icon_name = name
            return
        }

        icon = new Icon({
            icon_type: IconType.SYMBOLIC,
            icon_name: name,
            style_class: 'popup-menu-icon' // this ensure the icon has a good height
        })

        _addActor(icon, { span: 0 }, 0)
    }

    function setText(text: string) {
        // this happens for example when passing text:''. In that case the text is undefined leading to the applet not starting. For some reason typescript doesn't complain in that case
        if (!text) text = ' '

        const limitedTextString = limitString(text, maxCharNumber)

        if (!label) {
            label = new Label({ text: limitedTextString })
            _addActor(label)
            return
        }
        label.text = limitedTextString
    }

    /**
     * 
     * allows to specify an actor add a position. If no position given, the actor is added to the end (and if position is greater than the children of the popupMenuItem, is also added to the end)
     * 
     * @param actor 
     * @param params 
     * @param position 
     */
    function _addActor(
        actor: imports.gi.Clutter.Actor,
        params?: Partial<imports.ui.popupMenu.AddActorParams>,
        position?: number
    ) {
        const children = baseMenuItem["_children"]

        if (position == null) position = children.length + 1

        if (position >= children.length) {
            baseMenuItem.addActor(actor, params)
            return
        }

        children.forEach((child, index) => {
            const { actor: childActor, ...childParams } = child
            baseMenuItem.removeActor(childActor)
            if (index === position) baseMenuItem.addActor(actor, params)
            baseMenuItem.addActor(childActor, childParams)
        })
    }

    setIconName(initialIconName)
    setText(text)

    return {
        actor: baseMenuItem,
        setIconName,
        setText
    }
}