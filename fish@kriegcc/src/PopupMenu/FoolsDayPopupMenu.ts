import { _ } from "utils/translation"
import { InfoIcon } from "utils/icons"

const { AppletPopupMenu } = imports.ui.applet
const { St } = imports.gi

export type FoolsDayPopupMenuProps = {
  launcher: imports.ui.applet.Applet
  orientation: imports.gi.St.Side
}
export class FoolsDayPopupMenu extends AppletPopupMenu {
  constructor(props: FoolsDayPopupMenuProps) {
    const { launcher, orientation } = props
    super(launcher, orientation)

    // Layout:
    //   popup-container (St.BoxLayout, vertical)
    //     main-container (St.BoxLayout, horizontal)
    //        [..] see below

    const popupContainer = new St.BoxLayout({
      vertical: true,
      style_class: "fish-popup-container fish-fools-day-popup",
    })

    // ------------------------------------------
    // Main Container
    // ------------------------------------------

    // Layout:
    //   main-container (St.BoxLayout, horizontal)
    //      icon (St.Icon), align left
    //      message-container (St.BoxLayout, vertical), align right
    //        message-title (St.Label)
    //        message (St.Label)

    const mainContainer = new St.BoxLayout({
      style_class: "main-container",
    })

    // TODO: replace with a funny looking icon in future (maybe a confused looking Wanda)
    const icon = InfoIcon(48)
    mainContainer.add(icon)

    const messageContainer = new St.BoxLayout({
      vertical: true,
      style_class: "message-container",
    })

    const messageLabel = new St.Label({
      style_class: "message-label",
      text: _("The water needs changing"),
    })
    messageContainer.add(messageLabel)

    const secondaryMessageLabel = new St.Label({
      style_class: "secondary-message-label",
      text: _("Look at today's date!"),
    })
    messageContainer.add(secondaryMessageLabel)

    mainContainer.add(messageContainer)
    popupContainer.add(mainContainer)
    // ------------------------------------------

    // TODO: How about adding a "change water" button to the popup in order to allow to stop fools day immediately?

    this.box.add(popupContainer)
  }
}
