import { _ } from "utils/translation"
import { showNotification } from "utils/notification"
import { BasePopupMenu } from "./BasePopupMenu"

const { St, Pango } = imports.gi

export type FishMessagePopupMenuProps = {
  launcher: imports.ui.applet.Applet
  orientation: imports.gi.St.Side
  name?: string
  message?: string
  onSpeakAgain: () => void
  onClose: () => void
}
export class FishMessagePopupMenu extends BasePopupMenu {
  private name = ""
  private message = ""

  private titleLabel: imports.gi.St.Label
  private messageLabel: imports.gi.St.Label

  constructor(props: FishMessagePopupMenuProps) {
    const { launcher, orientation, name, message, onSpeakAgain, onClose } = props
    super(launcher, orientation)

    if (name) {
      this.name = name
    }
    if (message) {
      this.message = message
    }

    // Layout:
    //   popup-container (St.BoxLayout)
    //     header-label (St.Label)
    //     message-scroll-container (St.ScrollView)
    //       [...] see below
    //     button-container (St.BoxLayout)
    //       [...] see below

    const popupContainer = new St.BoxLayout({
      vertical: true,
      style_class: "fish-popup-container fish-message-popup",
    })

    this.titleLabel = new St.Label({
      style_class: "header-label",
    })
    this.setTitle()
    popupContainer.add(this.titleLabel)

    // ------------------------------------------
    //  Message
    // ------------------------------------------

    // Layout:
    //   message-scroll-container (St.ScrollView)
    //     message-box (St.BoxLayout)
    //       message-label (St.Label)

    // TODO: there is always space reserved for the scrollbars, even when they are hidden
    const messageScrollContainer = new St.ScrollView({
      style_class: "message-scroll-container",
      hscrollbar_policy: St.PolicyType.AUTOMATIC,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      overlay_scrollbars: false,
      enable_mouse_scrolling: true,
      enable_auto_scrolling: false,
      x_fill: false,
      y_fill: false,
      x_expand: true,
      y_expand: true,
      y_align: St.Align.MIDDLE,
      x_align: St.Align.MIDDLE,
    })

    const messageBox = new St.BoxLayout({
      style_class: "message-box",
    })

    // TODO: use St.Entry instead to allow text selection
    // Somehow, the scrollbars are not shown when text is editable
    // this.messageLabel = new St.Entry({
    //   style_class: "message-label",
    // })
    // // adjust some style of the text
    // const messageClutterText = this.messageLabel.get_clutter_text()
    // messageClutterText.set_ellipsize(Pango.EllipsizeMode.NONE)
    // messageClutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
    // messageClutterText.set_single_line_mode(false)
    // messageClutterText.set_selectable(true)
    // // if set to false, there is an error logged:
    // // "clutter_input_focus_set_input_panel_state: assertion 'clutter_input_focus_is_focused (focus)' failed"
    // messageClutterText.set_editable(true)

    this.messageLabel = new St.Label({
      style_class: "message-label",
    })
    // adjust some style of the text
    const messageClutterText = this.messageLabel.get_clutter_text()
    messageClutterText.set_ellipsize(Pango.EllipsizeMode.NONE)
    messageClutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)

    this.setMessage()

    messageBox.add(this.messageLabel)

    // add_child is recommended but doesn't work: https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/3172
    messageScrollContainer.add_actor(messageBox)
    popupContainer.add(messageScrollContainer)

    // ------------------------------------------

    // ------------------------------------------
    // Button container under the message

    // Layout:
    //  button-container (St.BoxLayout)
    //    button-container-left (St.BoxLayout)
    //      copy-button (St.Button)
    //    button-container-right (St.BoxLayout)
    //      speak-again-button (St.Button)
    //      close-button (St.Button)

    const buttonContainer = new St.BoxLayout({
      style_class: "button-container",
    })

    const buttonContainerLeft = new St.BoxLayout({
      x_align: imports.gi.Clutter.ActorAlign.START,
      y_align: imports.gi.Clutter.ActorAlign.CENTER,
      x_expand: true,
      y_expand: true,
    })

    // TODO: replace with a nice "Icon button"
    const copyButton = new St.Button({
      label: _("Copy Message"),
      style_class: "applet-box",
    })
    copyButton.connect("clicked", this.onCopy.bind(this))
    buttonContainerLeft.add(copyButton)

    const buttonContainerRight = new St.BoxLayout({
      x_align: imports.gi.Clutter.ActorAlign.END,
      y_align: imports.gi.Clutter.ActorAlign.CENTER,
      x_expand: true,
      y_expand: true,
    })

    const speakAgainButton = new St.Button({
      label: _("Speak again"),
      style_class: "applet-box",
    })
    speakAgainButton.connect("clicked", onSpeakAgain)

    const closeButton = new St.Button({
      label: _("Close"),
      style_class: "applet-box",
    })
    closeButton.connect("clicked", onClose)

    buttonContainerRight.add(speakAgainButton)
    buttonContainerRight.add(closeButton)

    buttonContainer.add(buttonContainerLeft)
    buttonContainer.add(buttonContainerRight)

    popupContainer.add(buttonContainer)
    // ------------------------------------------

    this.box.add(popupContainer)
  }

  public updateName(fishName: string): void {
    this.name = fishName
    this.setTitle()
  }

  public updateMessage(message: string): void {
    this.message = message
    this.setMessage()
  }

  private setTitle(): void {
    const title = _("%s the Fish Says:").format(this.name)
    this.titleLabel.set_text(title)
  }

  private setMessage(): void {
    this.messageLabel.set_text(this.message)
  }

  private onCopy(): void {
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.message)
    showNotification({ message: _("Message copied to the clipboard") })
  }
}
