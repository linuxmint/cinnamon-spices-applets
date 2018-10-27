const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const St          = imports.gi.St;
const Pango       = imports.gi.Pango;
const Gtk         = imports.gi.Gtk;

let _;
if (typeof require !== 'undefined') {
    _                        = require('./__init__')._;
} else {
    const AppletDir          = imports.ui.appletManager.applets['gpaste-reloaded@feuerfuchs.eu'];
    _                        = AppletDir.__init__._;
}

// ------------------------------------------------------------------------------------------------------

function GPasteNewItemDialog(callback) {
    this._init(callback);
}

GPasteNewItemDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(callback) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'gpaste__new-item-dialog' });

        this._callback = callback;
        this.entry = new St.Entry({
            name: 'GPasteNewItemEntry'
        });
        this.entry.clutter_text.set_activatable(false);
        this.entry.clutter_text.set_single_line_mode(false);
        this.entry.clutter_text.set_line_wrap(true);
        this.entry.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.entry.clutter_text.connect('text-changed', Lang.bind(this, this._resizeEntry));
        this._prevEntryHeight = -1;

        this.contentBox = new St.BoxLayout({
            vertical:   true,
            styleClass: 'gpaste__new-item-dialog__scroll-box__inner'
        });
        this.contentBox.add_actor(this.entry);

        this.scrollBox = new St.ScrollView({
            x_fill:     true,
            y_fill:     false,
            y_align:    St.Align.START,
            styleClass: 'gpaste__new-item-dialog__scroll-box'
        });
        this.scrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.scrollBox.add_actor(this.contentBox);

        this.contentLayout.add(new St.Label({ text: _("Please enter the text you want to add to the current history:") }));
        this.contentLayout.add(this.scrollBox);
        this.contentLayout.add_style_class_name('gpaste__new-item-dialog__content');

        this.setButtons([
            {
                label: _("OK"),
                action: Lang.bind(this, this._onOK)
            },
            {
                label: _("Cancel"),
                action: Lang.bind(this, function() {
                    this.close(global.get_current_time());
                })
            }
        ]);
    },

    /*
     * Calculate the padding that is added to the text field
     */
    _calcEntryHeightDiff: function() {
        const textBackup = this.entry.get_text();
        this.entry.set_text("");

        let width       = this.entry.get_width();
        const themeNode = this.entry.get_theme_node();
        width = themeNode.adjust_for_width(width);

        const [minHeight,         natHeight]         = this.entry.clutter_text.get_preferred_height(width);
        const [minHeightAdjusted, natHeightAdjusted] = themeNode.adjust_preferred_height(minHeight, natHeight);

        this.entryHeightDiff = natHeightAdjusted - natHeight;

        this.entry.set_text(textBackup);
    },

    /*
     * Resize the text field
     */
    _resizeEntry: function() {
        let width       = this.entry.get_width();
        const themeNode = this.entry.get_theme_node();
        width = themeNode.adjust_for_width(width);

        const [minHeight, natHeight] = this.entry.clutter_text.get_preferred_height(width);
        const height                 = natHeight + this.entryHeightDiff;

        if (this._prevEntryHeight != height) {
            this._prevEntryHeight = height;

            this.entry.set_height(height);
        }
    },

    //
    // Events
    // ---------------------------------------------------------------------------------

    /*
     * The OK button was pressed
     */
    _onOK: function() {
        this.close(global.get_current_time());
        this._callback(this.entry.get_text());

        this.entry.set_text("");
    },

    //
    // Overrides
    // ---------------------------------------------------------------------------------

    /*
     * Overridden so the text field's padding will be calculated as soon as
     * the dialog is displayed (it doesn't work correctly if it is hidden)
     */
    open: function(timestamp) {
        ModalDialog.ModalDialog.prototype.open.call(this, timestamp);

        this._calcEntryHeightDiff();
        global.stage.set_key_focus(this.entry);
    }
};
