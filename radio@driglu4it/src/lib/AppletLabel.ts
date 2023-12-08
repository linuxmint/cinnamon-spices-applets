const { Label } = imports.gi.St
const { ActorAlign } = imports.gi.Clutter
const { EllipsizeMode } = imports.gi.Pango

type LabelProps = ConstructorParameters<typeof Label>[0]

export function createAppletLabel(props?: LabelProps) {
    const label = new Label({
        reactive: true,
        track_hover: true,
        style_class: 'applet-label',
        y_align: ActorAlign.CENTER,
        y_expand: false,
        ...props
    })

    // No idea why needed but without the label is not shown 
    label.clutter_text.ellipsize = EllipsizeMode.NONE

    return label
}