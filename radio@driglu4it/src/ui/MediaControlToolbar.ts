
const { PopupMenuSection } = imports.ui.popupMenu
const { Bin, Align, BoxLayout } = imports.gi.St

import { ControlBtn } from "ui/ControlBtn"

interface Arguments {
    /**
     * the btns on the toolbar. The first is shown on the most left
     */
    controlBtns: ControlBtn[]
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

    // not sure why needed but didn't find a better way
    // TODO: possible to set child directly in constructor?
    const container = new Bin({
        x_align: Align.MIDDLE,
    })
    container.set_child(controls)
    // @ts-ignore
    const menuSection = new PopupMenuSection()
    menuSection.addActor(container)

    return menuSection
}

