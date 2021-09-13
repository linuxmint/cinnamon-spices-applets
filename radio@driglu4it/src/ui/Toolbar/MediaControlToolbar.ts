const { BoxLayout } = imports.gi.St
const { ActorAlign } = imports.gi.Clutter

interface Arguments {
    /**
     * the btns on the toolbar. The first is shown on the most left
     */
    controlBtns: imports.gi.St.Button[]
}

export const createMediaControlToolbar = (args: Arguments) => {

    const {
        controlBtns
    } = args

    const toolbar = new BoxLayout({
        style_class: "radio-applet-media-control-toolbar",
        x_align: ActorAlign.CENTER
    });

    controlBtns.forEach(btn =>
        toolbar.add_child(btn)
    )

    return toolbar
}
