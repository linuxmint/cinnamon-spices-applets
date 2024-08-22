import { FishAppletError } from "FishApplet/ErrorManager"
import { _ } from "utils/translation"
import { ErrorIcon } from "utils/icons"
import { showNotification } from "utils/notification"

const { AppletPopupMenu } = imports.ui.applet
const { St, Pango } = imports.gi

export type ErrorPopupMenuProps = {
  launcher: imports.ui.applet.Applet
  orientation: imports.gi.St.Side
  name?: string
  errors: FishAppletError[]
  onOpenPreferences: () => void
}
export class ErrorPopupMenu extends AppletPopupMenu {
  private name: string | undefined
  private errors: FishAppletError[] = []

  constructor(props: ErrorPopupMenuProps) {
    const { launcher, orientation, name, errors, onOpenPreferences } = props
    super(launcher, orientation)

    this.errors = errors

    if (name) {
      this.name = name
    }

    // Layout:
    //   popup-container (St.BoxLayout, vertical)
    //     main-container (St.BoxLayout, horizontal)
    //       [..] see below
    //     button-container (St.BoxLayout)
    //       [..] see below

    const popupContainer = new St.BoxLayout({
      vertical: true,
      style_class: "fish-popup-container fish-error-popup",
    })

    // ------------------------------------------
    // Main Container
    // ------------------------------------------

    // Layout:
    //   main-container (St.BoxLayout, horizontal)
    //      errorIcon (St.Icon), align left
    //      message-container (St.BoxLayout, vertical), align right
    //         [..] see below

    const mainContainer = new St.BoxLayout({
      style_class: "main-container",
    })

    const errorIcon = ErrorIcon(48)
    errorIcon.set_y_align(imports.gi.Clutter.ActorAlign.START)
    mainContainer.add(errorIcon)

    const messageContainer = new St.BoxLayout({
      vertical: true,
      style_class: "message-container",
    })
    mainContainer.add(messageContainer)
    popupContainer.add(mainContainer)

    // ------------------------------------------
    // Message Container
    // ------------------------------------------

    // Layout:
    //   message-container (St.BoxLayout, vertical)
    //      message-title (St.Label)
    //      error-messages-scroll-container (St.ScrollView)
    //        error-message-box (St.BoxLayout)
    //          error-message-label (St.Label)

    const titleLabel = new St.Label({
      style_class: "header-label",
      text: _("There's something fishy going on here:"),
    })
    messageContainer.add(titleLabel)

    // TODO: there is always space reserved for the scrollbars, even when they are hidden
    const errorMessagesScrollContainer = new St.ScrollView({
      style_class: "error-messages-scroll-container",
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
    messageContainer.add(errorMessagesScrollContainer)

    const errorMessagesBox = new St.BoxLayout({
      style_class: "error-messages-box",
    })
    // add_child is recommended but doesn't work: https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/3172
    errorMessagesScrollContainer.add_actor(errorMessagesBox)

    // TODO: use St.Entry instead to allow text selection (see TODO in FishMessagePopupMenu)
    const errorMessagesLabel = new St.Label({
      style_class: "error-messages-label",
      text: this.getAllErrorMessages(),
    })
    // adjust some style of the text
    const messageClutterText = errorMessagesLabel.get_clutter_text()
    messageClutterText.set_ellipsize(Pango.EllipsizeMode.NONE)
    messageClutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
    errorMessagesBox.add(errorMessagesLabel)

    // ------------------------------------------
    // Button container
    // ------------------------------------------

    // Layout:
    //  button-container (St.BoxLayout)
    //    button-container-left (St.BoxLayout) (align start)
    //      copy-error-button (St.Button)
    //    button-container-right (St.BoxLayout) (align end)
    //      open-preferences-button (St.Button)

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
    let copyButtonText
    if (this.errors.length > 1) {
      copyButtonText = _("Copy Error Messages")
    } else {
      copyButtonText = _("Copy Error Message")
    }
    const copyButton = new St.Button({
      label: copyButtonText,
      style_class: "applet-box",
    })
    copyButton.connect("clicked", this.onCopy.bind(this))
    buttonContainerLeft.add(copyButton)
    buttonContainer.add(buttonContainerLeft)

    const buttonContainerRight = new St.BoxLayout({
      x_align: imports.gi.Clutter.ActorAlign.END,
      y_align: imports.gi.Clutter.ActorAlign.CENTER,
      x_expand: true,
      y_expand: true,
    })
    // TODO: replace with a nice "Icon button" in the future.
    const openPreferencesButton = new St.Button({
      label: _("Open Preferences"),
      style_class: "applet-box",
    })
    openPreferencesButton.connect("clicked", onOpenPreferences)
    buttonContainerRight.add(openPreferencesButton)
    buttonContainer.add(buttonContainerRight)
    popupContainer.add(buttonContainer)

    // ------------------------------------------

    this.box.add(popupContainer)
  }

  private onCopy(): void {
    let notificationText
    if (this.errors.length > 1) {
      notificationText = _("Errors copied to the clipboard")
    } else {
      notificationText = _("Error copied to the clipboard")
    }

    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.getAllErrorMessages())
    showNotification({ message: notificationText })
  }

  private getAllErrorMessages(): string {
    return this.errors.map((error) => error.message).join("\n\n")
  }
}
