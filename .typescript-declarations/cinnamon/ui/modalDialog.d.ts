declare namespace imports.ui.modalDialog {

    enum State {
        OPENED = 0,
        CLOSED = 1,
        OPENING = 2,
        CLOSING = 3,
        FADED_OUT = 4
    }

    interface ModalDialogOptions {
        /** Whether the modal dialog should block Cinnamon Input */
        cinnamonReactive: boolean
        styleClass: string
    }

    interface DialogButton {
        label: string
        action: () => void
        /** a keyboard key - easisest to use a respective Clutter Constant, such as Clutter.KEY_Escape */
        key?: number
    }

    /**
     * #ModalDialog:
     * @short_description: A generic object that displays a modal dialog
     * @state (ModalDialog.State): The state of the modal dialog, which may be
     * `ModalDialog.State.OPENED`, `CLOSED`, `OPENING`, `CLOSING` or `FADED_OUT`.
     * @contentLayout (St.BoxLayout): The box containing the contents of the modal
     * dialog (excluding the buttons)
     *
     * The #ModalDialog object is a generic popup dialog in Cinnamon. It can either
     * be created directly and then manipulated afterwards, or used as a base class
     * for more sophisticated modal dialog.
     *
     * For simple usage such as displaying a message, or asking for confirmation,
     * the #ConfirmDialog and #NotifyDialog classes may be used instead.
     */
    class ModalDialog {

        public state: State
        protected _hasModal: boolean
        protected _cinnamonReactive: boolean
        protected _group: imports.gi.St.Widget
        protected _activeKeys: any
        protected _backgrounddBin: imports.gi.St.Bin
        protected _dialogLayout: imports.gi.St.BoxLayout
        protected _lightbox: lightbox.Lightbox
        public stack: any
        protected _eventBlocker: any
        public contentLayout: imports.gi.St.BoxLayout
        protected _buttonLayout: imports.gi.St.BoxLayout
        protected _initialKeyFocus: imports.gi.St.BoxLayout
        protected _savedKeyFocus: null

        constructor(params: ModalDialogOptions)

        /**
         * destroy:
         *
         * Destroys the modal dialog
         */
        destroy: () => void

        /**
         * setButtons:
         * @buttons (array): the buttons to display in the modal dialog
         *
         * This sets the buttons in the modal dialog. The buttons is an array of
         * JSON objects, each of which corresponds to one button.
         *
         * Each JSON object *must* contain @label and @action, which are the text
         * displayed on the button and the callback function to use when the button
         * is clicked respectively.
         *
         * Optional arguments include @focused, which determines whether the button
         * is initially focused, and @key, which is a keybinding associated with
         * the button press such that pressing the keybinding will have the same
         * effect as clicking the button.
         *
         * An example usage is
         * ```
         * dialog.setButtons([
         *     {
         *         label: _("Cancel"),
         *         action: Lang.bind(this, this.callback),
         *         key: Clutter.KEY_Escape
         *     },
         *     {
         *         label: _("OK"),
         *         action: Lang.bind(this, this.destroy),
         *         key: Clutter.KEY_Return
         *     }
         * ]);
         * ```
         */
        setButtons: (buttons: DialogButton[]) => void

        protected _onKeyPressEvent(actor: imports.gi.St.Widget, event: any): void
        protected _onGroupDestroy(): void
        protected _fadeOpen(): void
        public setInitialKeyFocus(actor: imports.gi.Clutter.Actor): void

        /**
         * open:
         * @timestamp (int): (optional) timestamp optionally used to associate the
         * call with a specific user initiated event
         *
         * Opens and displays the modal dialog.
         */
        public open(timestamp?: number): boolean

        /**
         * close:
         * @timestamp (int): (optional) timestamp optionally used to associate the
         * call with a specific user initiated event
         *
         * Closes the modal dialog.
         */
        public close(timestamp?: number): void

        /**
         * popModal:
         * @timestamp (int): (optional) timestamp optionally used to associate the
         * call with a specific user initiated event
         *
         * Drop modal status without closing the dialog; this makes the
         * dialog insensitive as well, so it needs to be followed shortly
         * by either a %close() or a %pushModal()
         */
        public popModal(timestamp?: number): void

        /**
         * pushModal:
         * @timestamp (int): (optional) timestamp optionally used to associate the
         * call with a specific user initiated event
         *
         * Pushes the modal to the modal stack so that it grabs the required
         * inputs.
         */
        public pushModal(timestamp?: number): boolean

        /**
         * _fadeOutDialog:
         * @timestamp (int): (optional) timestamp optionally used to associate the
         * call with a specific user initiated event
         *
         * This method is like %close(), but fades the dialog out much slower,
         * and leaves the lightbox in place. Once in the faded out state,
         * the dialog can be brought back by an open call, or the lightbox
         * can be dismissed by a close call.
         *
         * The main point of this method is to give some indication to the user
         * that the dialog response has been acknowledged but will take a few
         * moments before being processed.
         *
         * e.g., if a user clicked "Log Out" then the dialog should go away
         * immediately, but the lightbox should remain until the logout is
         * complete.
         */
        protected _fadeOutDialog(timestamp?: number): void

    }

    /**
     * #ConfirmDialog
     * @short_description: A simple dialog with a "Yes" and "No" button.
     * @callback (function): Callback when "Yes" is clicked
     *
     * A confirmation dialog that calls @callback and then destroys itself if user
     * clicks "Yes". If the user clicks "No", the dialog simply destroys itself.
     *
     * Inherits: ModalDialog.ModalDialog
     */
    class ConfirmDialog extends ModalDialog {

        /**
         * 
         * @param label label to display on the confirm dialog
         * @param callback function to call when user clicks "yes"
         */
        constructor(label: string, callback: () => void)
    }

    /**
     * #NotifyDialog
     * @short_description: A simple dialog that presents a message with an "OK"
     * button.
     *
     * A notification dialog that displays a message to user. Destroys itself after
     * user clicks "OK"
     *
     * Inherits: ModalDialog.ModalDialog
     */
    class NotifyDialog extends ModalDialog {
        /**
         * 
         * @param label label to display on the notify dialog
         */
        constructor(label: string)
    }

    /**
     * #InfoOSD
     * @short_description: An OSD that displays information to users
     * @actor (St.BoxLayout): actor of the OSD
     *
     * Creates an OSD to show information to user at the center of the screen. Can
     * display texts or a general #St.Widget. This is useful as "hints" to the
     * user, eg. the popup shown when the user clicks the "Add panel" button to
     * guide them how to add a panel.
     *
     * This does not destroy itself, and the caller of this is responsible for
     * destroying it after usage (via the %destroy function), or hiding it with
     * %hide for later reuse.
     */
    class InfoOSD {

        actor: imports.gi.St.BoxLayout

        /**
         * 
         * @param text Text to display on the OSD
         * 
         * Creates an OSD and adds it to the chrome. Adds a
         * label with text @text if specified.
         */
        constructor(text?: string)

        /**
         * 
         * Shows the OSD at the center of monitor @monitorIndex. Shows at the
         * primary monitor if not specified.
         * 
         * @param monitorIndex Monitor to display OSD on. Default is primary monitor
         */
        show(monitorIndex?: number): void

        hide(): void
        destroy(): void

        /**
         * 
         * @param text text to display
         * @param params parameters to be used when adding text
         * 
         * Adds a text label displaying @text to the OSD
         * 
         */
        addText(text: string, params: Parameters<imports.gi.St.BoxLayout['add']>[1]): void
        addActor(actor: imports.gi.St.Widget, params: Parameters<imports.gi.St.BoxLayout['add']>[1]): void

    }
}