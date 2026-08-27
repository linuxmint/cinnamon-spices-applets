/* global imports, global */
/**
 * renameDialog.js
 *
 * Modal text-entry dialog used to rename a workspace.
 *
 * A modal dialog is used rather than an inline St.Entry because desklets live
 * on the desktop layer, where grabbing and restoring keyboard focus by hand is
 * unreliable. ModalDialog.pushModal() takes a stage-wide grab and focuses the
 * entry for us (see /usr/share/cinnamon/js/ui/modalDialog.js pushModal()).
 *
 * Key handling mirrors expoThumbnail.js onTitleKeyPressEvent():
 *   Enter  -> commit
 *   Escape -> cancel
 *
 * This file is duplicated verbatim in both xlet directories: Cinnamon gives
 * xlets no way to import across xlet boundaries. Keep the copies in sync.
 */

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;

/* Gettext support. The parent xlet injects its own UUID-bound _() translator
 * via setTranslate(); the default is the identity function so this module is
 * safe to load on its own. */
let _translate = function (str) { return str; };

function setTranslate(fn) {
    if (typeof fn === "function")
        _translate = fn;
}

/* Call sites use _() so cinnamon-xlet-makepot's default keyword extracts
 * them; _() always routes through the injected translator. */
function _(str) {
    return _translate(str);
}

var RenameWorkspaceDialog = GObject.registerClass(
class RenameWorkspaceDialog extends ModalDialog.ModalDialog {

    /**
     * _init:
     * @currentName (string): name to pre-fill the entry with
     * @callback (function): called with the trimmed new name on commit. Not
     *                       called on cancel. An empty string is a valid
     *                       result and resets the workspace to its default
     *                       name.
     */
    _init(currentName, callback) {
        super._init();

        this._callback = callback;
        this._settled = false;

        let content = new Dialog.MessageDialogContent({
            title: _("Rename workspace"),
            description: _("Leave the name empty to restore the default name.")
        });
        this.contentLayout.add_child(content);

        this._entry = new St.Entry({
            style_class: "curb-workspace-rename-entry",
            can_focus: true,
            track_hover: true,
            x_expand: true
        });
        this._entry.set_text(typeof currentName === "string" ? currentName : "");
        this.contentLayout.add_child(this._entry);

        /* St.Entry's ClutterText consumes Enter, so the dialog's own default
         * button key routing never sees it. Handle it here as well; _settled
         * guards against both paths firing. */
        this._activateId = this._entry.clutter_text.connect("activate",
            () => this._commit());

        this.setButtons([
            {
                label: _("Cancel"),
                action: () => this._cancel(),
                key: Clutter.KEY_Escape
            },
            {
                label: _("Rename"),
                action: () => this._commit(),
                default: true
            }
        ]);

        /* Must come after setButtons(): addButton() focuses the first button
         * when nothing else has claimed focus. */
        this.setInitialKeyFocus(this._entry);

        this.connect("destroy", () => this._onDestroy());
    }

    _onDestroy() {
        try {
            if (this._activateId && this._entry)
                this._entry.clutter_text.disconnect(this._activateId);
        } catch (e) {
            /* entry already finalized - nothing to release */
        }
        this._activateId = 0;
        this._callback = null;
    }

    _cancel() {
        if (this._settled)
            return;
        this._settled = true;
        this.destroy();
    }

    _commit() {
        if (this._settled)
            return;
        this._settled = true;

        let text = "";
        try {
            text = this._entry.get_text().trim();
        } catch (e) {
            global.logError("[renameDialog] could not read entry text: " + e);
        }

        let callback = this._callback;
        this.destroy();

        if (callback) {
            try {
                callback(text);
            } catch (e) {
                global.logError("[renameDialog] rename callback failed: " + e);
            }
        }
    }
});

/**
 * promptRename:
 * @currentName (string): name to pre-fill the entry with
 * @callback (function): called with the trimmed new name on commit
 *
 * Convenience wrapper that never throws into a signal handler.
 *
 * Returns (boolean): whether the dialog opened.
 */
function promptRename(currentName, callback) {
    try {
        let dialog = new RenameWorkspaceDialog(currentName, callback);
        dialog.open(global.get_current_time());
        return true;
    } catch (e) {
        global.logError("[renameDialog] could not open rename dialog: " + e);
        return false;
    }
}
