const { Label } = imports.gi.St
const { EllipsizeMode } = imports.gi.Pango
const { ActorAlign } = imports.gi.Clutter

export function createAppletLabel() {

    const label = new Label({
        reactive: true,
        track_hover: true,
        style_class: 'applet-label',
        y_align: ActorAlign.CENTER,
        y_expand: false,
        visible: false
    })

    // No idea why needed but without the label is not shown 
    // @ts-ignore
    label.clutter_text.ellipsize = EllipsizeMode.NONE

    let visible: boolean
    let text: string


    /**
     * 
     * @param newValue text to show on the label. The text however is only visible in the GUI when visible is true. It is also shown no text when passing null for text but in that case the text is shown again when calling this function again with a string (i.e this function is intended to be used with null when the text shall only temporarily be hidden)    
     * 
     */
    function setText(newValue: string | null) {

        text = newValue

        if (!visible) return

        label.show()
        newValue ? label.text = ` ${newValue}` : label.hide()
    }

    function setVisibility(newValue: boolean) {

        visible = newValue

        if (text) label.visible = newValue
        if (visible && text) setText(text)
    }


    return {
        actor: label,
        setVisibility,
        setText,
    }
}