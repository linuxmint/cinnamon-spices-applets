
const { PopupMenuSection } = imports.ui.popupMenu
const { Bin, Align, BoxLayout } = imports.gi.St

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

    const controls = new BoxLayout({
        style_class: "radio-applet-media-control-toolbar"
    });

    controlBtns.forEach(btn =>
        controls.add_actor(btn)
    )

    const container = new Bin({
        x_align: Align.MIDDLE,
        child: controls
    })

    const menuSection = new PopupMenuSection()
    menuSection.addActor(container)

    return menuSection
}

