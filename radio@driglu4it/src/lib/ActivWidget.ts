const { KEY_space, KEY_KP_Enter, KEY_Return } = imports.gi.Clutter


export interface Arguments {
    onActivated?: () => void
    widget: imports.gi.St.Widget
}

/**  */
export function createActivWidget(args: Arguments) {

    const {
        widget,
        onActivated
    } = args

    // TODO: understand can_focus

    widget.can_focus = true
    widget.reactive = true
    widget.track_hover = true

    widget.connect('button-release-event', (_, event) => {

        const button = event.get_button()

        // only if it is not a right click
        if (button !== 3) {
            onActivated?.()
        }

        return false
    })


    // TODO: This is needed because some themes (at least Adapta-Nokto but maybe also others) don't provide style for the hover pseudo class. But it would be much easier to once (and on theme changes) programmatically set the hover pseudo class equal to the active pseudo class when the hover class isn't provided by the theme. 
    widget.connect('notify::hover', () => {
        widget.change_style_pseudo_class('active', widget.hover)

        if (widget.hover) widget.grab_key_focus()
    })

    widget.connect('key-press-event', (actor, event) => {
        const symbol = event.get_key_symbol();
        const relevantKeys = [KEY_space, KEY_KP_Enter, KEY_Return]

        if (relevantKeys.includes(symbol) && widget.hover)
            onActivated?.()

        return false
    })
}