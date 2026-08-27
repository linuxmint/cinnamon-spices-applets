/* global imports, global */
/**
 * dialogs.js
 *
 * Modal dialogs for the Panel Profiles applet: save (new or replace) and
 * confirmations. Rename/duplicate/delete live in the applet's settings
 * window (profilesManagerWidget.py), not here.
 *
 * All dialogs follow the renameDialog.js pattern: MessageDialogContent,
 * setButtons with KEY_Escape, setInitialKeyFocus after setButtons, a
 * _settled guard so no path can settle twice, and Enter committing through
 * the entry's clutter_text "activate" signal.
 *
 * This file talks to St/Clutter only. It never imports the applet's lib/
 * modules and never require()s anything: every profile list and the
 * translator arrive through constructor arguments, callbacks, or
 * setDependencies()/setTranslate().
 */

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const CheckBox = imports.ui.checkBox;

/* Spec limit for profile names (spec section 11). */
const MAX_NAME_LENGTH = 80;

/* Gettext support. The applet injects its own UUID-bound _() translator
 * via setTranslate(); the default is the identity function so this module
 * is safe to load on its own. */
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

/* Optional logger injected by the applet. Falls back to global.logError so
 * headless loading of this module never throws on a missing logger. */
let _logger = null;

function setDependencies(deps) {
    if (deps && deps.logger)
        _logger = deps.logger;
}

function _warn(msg) {
    try {
        if (_logger && typeof _logger.warn === "function") {
            _logger.warn(msg);
            return;
        }
    } catch (ignored) {
        /* fall through to global */
    }
    try {
        if (typeof global !== "undefined" && global.logError)
            global.logError("[PanelProfiles] " + msg);
    } catch (ignored) {
        /* nothing left to try; swallow rather than throw */
    }
}

function _error(msg, e) {
    try {
        if (_logger && typeof _logger.error === "function") {
            _logger.error(msg, e);
            return;
        }
    } catch (ignored) {
        /* fall through to global */
    }
    try {
        if (typeof global !== "undefined" && global.logError)
            global.logError("[PanelProfiles] " + msg + ": " + e);
    } catch (ignored) {
        /* nothing left to try; swallow rather than throw */
    }
}

/* Trim and enforce the 80-character cap. Applied on commit and before any
 * name comparison; the entry's clutter_text also caps typing via
 * max_length so paste is the only path that can exceed it. */
function _cleanName(raw) {
    let text = typeof raw === "string" ? raw : "";
    text = text.trim();
    if (text.length > MAX_NAME_LENGTH)
        text = text.slice(0, MAX_NAME_LENGTH);
    return text;
}

/* Defensive copy of a caller-supplied profile list. Dialogs never trust
 * field types: anything missing degrades to a safe value. */
function _normalizeProfiles(list) {
    let out = [];
    if (!Array.isArray(list))
        return out;
    for (let i = 0; i < list.length; i++) {
        let p = list[i];
        if (!p || typeof p !== "object")
            continue;
        out.push({
            id: String(p.id !== undefined && p.id !== null ? p.id : ""),
            name: typeof p.name === "string" ? p.name : "",
            includeDesklets: p.includeDesklets === true
        });
    }
    return out;
}

/* Open helper shared by every launcher so a failure to open never escapes
 * into a signal handler. */
function _openDialog(dialog) {
    try {
        dialog.open(global.get_current_time());
        return true;
    } catch (e) {
        _error("could not open dialog", e);
        try {
            dialog.destroy();
        } catch (ignored) {
            /* already gone */
        }
        return false;
    }
}

/* A small toggle that packs like ui.radioButton (theme class
 * "radiobutton"): an St.Button wrapping an StBoxLayout of [glyph St.Bin,
 * St.Label]. The theme draws the glyph on the St.Bin and swaps it through
 * the button's :checked pseudo-class, so the look is fully native with no
 * CSS of ours involved. St itself offers no radio widget in Cinnamon 6.6. */
function _makeToggleButton(label, themeClass) {
    let box = new St.BoxLayout();
    box.add_child(new St.Bin());
    box.add_child(new St.Label({ text: label }));
    return new St.Button({
        style_class: themeClass,
        important: true,
        button_mask: St.ButtonMask.ONE,
        toggle_mode: true,
        can_focus: true,
        x_fill: true,
        y_fill: true,
        y_align: St.Align.MIDDLE,
        child: box
    });
}

/* Empty a container without ever leaving a destroyed child in its child
 * list. destroy_all_children() frees children in place; a style recompute
 * already in flight (any pseudo-class or theme change) can then walk a
 * freed widget and take Cinnamon down with it (st_scroll_view_style_changed
 * -> notify_children_of_style_change on freed memory). Unparenting every
 * child first means the cascade can only ever see live actors. */
function _clearContainer(box) {
    if (!box)
        return;
    let children = [];
    try {
        children = box.get_children();
    } catch (e) {
        return;
    }
    for (let i = 0; i < children.length; i++) {
        try {
            box.remove_child(children[i]);
        } catch (e) {
            /* already detached */
        }
    }
    for (let i = 0; i < children.length; i++) {
        try {
            children[i].destroy();
        } catch (e) {
            /* already destroyed */
        }
    }
}

/* GType names are process-global and never unregistered, but this module
 * CAN be re-evaluated: Cinnamon's requireModule cache drops it when the
 * file size changes or when the last applet instance is removed and the
 * xlet is freshly imported again. A second registerClass with the same
 * auto-generated name then throws "Type name ... is already registered"
 * and the applet loads dead. A per-evaluation suffix keeps every
 * registration unique (the pomodoro spice uses the same trick). */
let _typeSeq = 0;
function _typeName(base) {
    _typeSeq += 1;
    return "PP_" + base + "_" + Date.now().toString(36) + "_" + _typeSeq;
}

var PanelProfilesConfirmDialog = GObject.registerClass(
    { GTypeName: _typeName("ConfirmDialog") },
class PanelProfilesConfirmDialog extends ModalDialog.ModalDialog {

    /**
     * _init:
     * @title (string): dialog title, already translated by the caller
     * @description (string): body text, already translated by the caller
     * @confirmLabel (string): label of the confirming button
     * @onConfirm (function): called with no arguments after confirmation.
     *                        Not called on cancel.
     * @destructive (boolean): style the confirm button as destructive
     *
     * modalDialog.ConfirmDialog has fixed "Yes"/"No" labels; the spec wants
     * Cancel/Replace and Cancel/Delete, so this is a local variant with the
     * same shape rather than an import of an external helper.
     */
    _init(title, description, confirmLabel, onConfirm, destructive) {
        super._init();

        this._onConfirm = onConfirm;
        this._settled = false;

        let content = new Dialog.MessageDialogContent({
            title: title,
            description: description
        });
        this.contentLayout.add_child(content);

        let confirmDescriptor = {
            label: confirmLabel,
            action: () => this._confirm(),
            default: true
        };
        if (destructive)
            confirmDescriptor.destructive_action = true;

        this.setButtons([
            {
                label: _("Cancel"),
                action: () => this._cancel(),
                key: Clutter.KEY_Escape
            },
            confirmDescriptor
        ]);
    }

    _cancel() {
        if (this._settled)
            return;
        this._settled = true;
        this.destroy();
    }

    _confirm() {
        if (this._settled)
            return;
        this._settled = true;

        let onConfirm = this._onConfirm;
        this._onConfirm = null;
        this.destroy();

        if (onConfirm) {
            try {
                onConfirm();
            } catch (e) {
                _error("confirm callback failed", e);
            }
        }
    }
});

var SaveProfileDialog = GObject.registerClass(
    { GTypeName: _typeName("SaveDialog") },
class SaveProfileDialog extends ModalDialog.ModalDialog {

    /**
     * _init:
     * @opts (object): {
     *   existingProfiles: [{ id, name, includeDesklets }],
     *   includeDesklets: boolean,
     *   activeProfileName: string or null
     * }
     * @callback (function): called with null (cancel) or
     *                       { mode, name, targetId, includeDesklets }
     */
    _init(opts, callback) {
        super._init();

        opts = opts && typeof opts === "object" ? opts : {};
        this._callback = callback;
        this._settled = false;
        this._destroyed = false;
        this._handlerIds = [];
        this._mode = "new";
        this._replaceId = null;
        this._existing = _normalizeProfiles(opts.existingProfiles);

        let content = new Dialog.MessageDialogContent({
            title: _("Save Panel Profile")
        });
        this.contentLayout.add_child(content);

        this.contentLayout.add_child(new St.Label({
            text: _("Name"),
            style_class: "panel-profiles-field-label"
        }));

        this._entry = new St.Entry({
            style_class: "run-dialog-entry panel-profiles-entry",
            can_focus: true,
            track_hover: true,
            reactive: true,
            x_expand: true,
            hint_text: _("Profile name")
        });
        let text = this._entry.clutter_text;
        text.editable = true;
        text.activatable = true;
        text.single_line_mode = true;
        text.max_length = MAX_NAME_LENGTH;
        if (typeof opts.activeProfileName === "string" && opts.activeProfileName)
            this._entry.set_text(opts.activeProfileName);
        this.contentLayout.add_child(this._entry);

        /* Inline duplicate-name warning. Kept under the entry because it is
         * a property of the typed name, not of the chosen target. */
        this._warningLabel = new St.Label({
            text: _("A profile with this name already exists"),
            style_class: "panel-profiles-name-warning"
        });
        this._warningLabel.hide();
        this.contentLayout.add_child(this._warningLabel);

        this._includeDesklets = new CheckBox.CheckBox(
            _("Include desklets"), {}, opts.includeDesklets === true);
        this._includeDesklets.actor.set_accessible_name(
            _("Include desklets in this profile"));
        this.contentLayout.add_child(this._includeDesklets.actor);

        this.contentLayout.add_child(new St.Label({
            text: _("Save as:"),
            style_class: "panel-profiles-field-label"
        }));

        /* Radio pair. St.Button already maintains the :checked pseudo-class
         * in toggle mode; exclusivity is re-asserted in the click handler
         * so a second click on the active radio cannot un-check it. */
        this._newRadio = _makeToggleButton(_("New profile"), "radiobutton panel-profiles-radio");
        this._newRadio.checked = true;
        this._handlerIds.push([this._newRadio,
            this._newRadio.connect("clicked", () => this._onRadioClicked("new"))]);

        this._replaceRadio = _makeToggleButton(_("Replace existing profile"), "radiobutton panel-profiles-radio");
        this._replaceRadio.checked = false;
        this._handlerIds.push([this._replaceRadio,
            this._replaceRadio.connect("clicked", () => this._onRadioClicked("replace"))]);
        if (!this._existing.length) {
            this._replaceRadio.reactive = false;
            this._replaceRadio.change_style_pseudo_class("insensitive", true);
        }

        let radioBox = new St.BoxLayout({
            vertical: true,
            style_class: "panel-profiles-radio-box"
        });
        radioBox.add_child(this._newRadio);
        radioBox.add_child(this._replaceRadio);
        this.contentLayout.add_child(radioBox);

        /* Replace target list, revealed only in replace mode. */
        this._replaceBox = new St.BoxLayout({ vertical: true });
        this._replaceBox.add_child(new St.Label({
            text: _("Existing profile:"),
            style_class: "panel-profiles-field-label"
        }));

        this._replaceList = new St.BoxLayout({ vertical: true });
        this._replaceScroll = new St.ScrollView({
            style_class: "panel-profiles-replace-scroll",
            x_expand: true,
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC
        });
        this._replaceScroll.add_actor(this._replaceList);
        this._replaceBox.add_child(this._replaceScroll);
        this._replaceBox.hide();
        this.contentLayout.add_child(this._replaceBox);

        this._rebuildReplaceList();

        /* St.Entry's ClutterText consumes Enter, so the dialog's default
         * button key routing never sees it. Handle it here as well;
         * _settled guards against both paths firing. */
        this._activateId = text.connect("activate", () => this._commit());
        this._handlerIds.push([text,
            text.connect("text-changed", () => this._onNameChanged())]);

        this._primaryDescriptor = {
            label: _("Save"),
            action: () => this._commit(),
            default: true
        };
        this.setButtons([
            {
                label: _("Cancel"),
                action: () => this._cancel(),
                key: Clutter.KEY_Escape
            },
            this._primaryDescriptor
        ]);

        /* Must come after setButtons(): addButton() focuses a button when
         * nothing else has claimed focus. Focus the ClutterText, not the
         * St.Entry wrapper, since that is what receives typed characters. */
        this.setInitialKeyFocus(text);

        this.connect("opened", () => this._onOpened());
        this.connect("destroy", () => this._onDestroy());

        this._onNameChanged();
    }

    _onOpened() {
        if (this._destroyed)
            return;
        /* Select the pre-filled name so typing replaces it in one go. */
        try {
            let value = this._entry.get_text() || "";
            if (value)
                this._entry.clutter_text.set_selection(0, value.length);
        } catch (e) {
            _warn("could not select prefilled name");
        }
    }

    _onDestroy() {
        this._destroyed = true;
        try {
            if (this._activateId && this._entry)
                this._entry.clutter_text.disconnect(this._activateId);
        } catch (e) {
            /* entry already finalized - nothing to release */
        }
        this._activateId = 0;
        if (this._handlerIds) {
            this._handlerIds.forEach((pair) => {
                try {
                    pair[0].disconnect(pair[1]);
                } catch (e) {
                    /* source already gone */
                }
            });
            this._handlerIds = [];
        }
        this._callback = null;
    }

    _onRadioClicked(mode) {
        if (this._destroyed)
            return;
        /* Re-assert both states: a radio pair must never end up with both
         * or neither button checked. */
        this._newRadio.checked = mode === "new";
        this._replaceRadio.checked = mode === "replace";
        if (this._mode === mode)
            return;
        this._mode = mode;

        if (mode === "replace")
            this._replaceBox.show();
        else
            this._replaceBox.hide();
        this._onNameChanged();
    }

    _rebuildReplaceList() {
        if (this._destroyed)
            return;
        _clearContainer(this._replaceList);

        if (this._replaceId && !this._findById(this._replaceId))
            this._replaceId = null;

        for (let i = 0; i < this._existing.length; i++) {
            let profile = this._existing[i];
            let row = new St.Button({
                style_class: "panel-profiles-profile-row",
                label: profile.name,
                x_align: St.Align.START,
                x_expand: true,
                reactive: true,
                /* Keyboard-reachable so the target can be picked without
                 * the mouse. */
                can_focus: true
            });
            row.profileId = profile.id;
            row.connect("clicked", () => this._selectReplace(profile.id));
            this._replaceList.add_child(row);
        }
        this._highlightReplaceSelection();
    }

    _findById(id) {
        for (let i = 0; i < this._existing.length; i++) {
            if (this._existing[i].id === id)
                return this._existing[i];
        }
        return null;
    }

    _selectReplace(id) {
        if (this._destroyed)
            return;
        this._replaceId = id;
        let selected = this._findById(id);
        if (selected)
            this._includeDesklets.setToggleState(selected.includeDesklets);
        this._highlightReplaceSelection();

        /* Only suggest the target's name while the field is untouched.
         * Never overwrite a name the user is typing or has already set
         * (same rule as the world clock's dialog). */
        try {
            if (!this._entry.get_text().trim()) {
                let profile = this._findById(id);
                if (profile)
                    this._entry.set_text(profile.name);
            }
            global.stage.set_key_focus(this._entry.clutter_text);
        } catch (e) {
            /* entry gone */
        }
        this._onNameChanged();
    }

    _highlightReplaceSelection() {
        let children = this._replaceList.get_children();
        for (let i = 0; i < children.length; i++) {
            let row = children[i];
            if (row.profileId === this._replaceId)
                row.add_style_pseudo_class("outlined");
            else
                row.remove_style_pseudo_class("outlined");
        }
    }

    _currentName() {
        try {
            return _cleanName(this._entry.get_text());
        } catch (e) {
            _error("could not read profile name", e);
            return "";
        }
    }

    /* True when the typed name collides with a profile that is not the
     * selected replace target. */
    _nameConflicts(name) {
        if (!name)
            return false;
        for (let i = 0; i < this._existing.length; i++) {
            let profile = this._existing[i];
            if (profile.name !== name)
                continue;
            if (this._mode === "replace" && profile.id === this._replaceId)
                continue;
            return true;
        }
        return false;
    }

    _canCommit() {
        let name = this._currentName();
        if (!name)
            return false;
        if (this._mode === "replace" && !this._replaceId)
            return false;
        return true;
    }

    _onNameChanged() {
        if (this._destroyed)
            return;
        let name = this._currentName();
        if (this._nameConflicts(name))
            this._warningLabel.show();
        else
            this._warningLabel.hide();

        let button = this._primaryDescriptor.button;
        if (!button)
            return;
        button.set_label(this._mode === "replace" ? _("Overwrite") : _("Save"));
        let enabled = this._canCommit();
        button.reactive = enabled;
        button.change_style_pseudo_class("insensitive", !enabled);
    }

    _cancel() {
        if (this._settled)
            return;
        this._settled = true;

        let callback = this._callback;
        this._callback = null;
        this.destroy();

        if (callback) {
            try {
                callback(null);
            } catch (e) {
                _error("save cancel callback failed", e);
            }
        }
    }

    _commit() {
        if (this._settled)
            return;
        if (!this._canCommit())
            return;

        let name = this._currentName();

        if (this._mode === "replace") {
            /* Replacing always asks once more (spec section 11). The save
             * dialog stays open underneath; the confirm settles it. */
            let targetId = this._replaceId;
            let target = this._findById(targetId);
            let title = _("Replace \"%s\"?").format(target ? target.name : name);
            let description = _("The saved version of this profile will be replaced by your current panel configuration.");
            let confirm = new PanelProfilesConfirmDialog(
                title,
                description,
                _("Replace"),
                () => this._finish({
                    mode: "replace",
                    name: name,
                    targetId: targetId,
                    includeDesklets: this._includeDesklets.actor.checked
                })
            );
            _openDialog(confirm);
            return;
        }

        this._finish({
            mode: "new",
            name: name,
            targetId: null,
            includeDesklets: this._includeDesklets.actor.checked
        });
    }

    _finish(result) {
        if (this._settled)
            return;
        this._settled = true;

        let callback = this._callback;
        this._callback = null;
        /* A settled promise survives even a dialog whose actor was torn down
         * underneath it (an external destroy of the modal stack); the
         * callback is plain JS and must still fire. */
        if (!this._destroyed) {
            try {
                this.destroy();
            } catch (e) {
                _warn("save dialog destroy failed: " + e);
            }
        }

        if (callback) {
            try {
                callback(result);
            } catch (e) {
                _error("save callback failed", e);
            }
        }
    }
});

/**
 * promptSaveProfile:
 * @opts (object): see SaveProfileDialog
 * @callback (function): see SaveProfileDialog
 *
 * Convenience wrapper that never throws into a signal handler.
 *
 * Returns (boolean): whether the dialog opened.
 */
function promptSaveProfile(opts, callback) {
    try {
        let dialog = new SaveProfileDialog(opts, callback);
        return _openDialog(dialog);
    } catch (e) {
        _error("could not create save dialog", e);
        return false;
    }
}
