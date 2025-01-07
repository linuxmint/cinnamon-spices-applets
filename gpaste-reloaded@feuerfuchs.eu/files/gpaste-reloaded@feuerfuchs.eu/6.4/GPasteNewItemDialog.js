const ModalDialog = imports.ui.modalDialog;
const St          = imports.gi.St;
const Pango       = imports.gi.Pango;
const Gtk         = imports.gi.Gtk;
const GObject     = imports.gi.GObject;

const _           = require('./__init__')._;

// ------------------------------------------------------------------------------------------------------
var GPasteNewItemDialog = GObject.registerClass(
    class GPasteNewItemDialog extends ModalDialog.ModalDialog {
        _init(callback) {
            super._init({ styleClass: 'gpaste__new-item-dialog', destroyOnClose: false });
            
            this._callback = callback;
            this.entry = new St.Entry({
                name: 'GPasteNewItemEntry'
            });
            this.entry.clutter_text.set_activatable(false);
            this.entry.clutter_text.set_single_line_mode(false);
            this.entry.clutter_text.set_line_wrap(true);
            this.entry.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            this.entry.clutter_text.connect('text-changed', () => this._resizeEntry());
            this._prevEntryHeight = -1;

            this._contentBox = new St.BoxLayout({
                vertical:   true,
                styleClass: 'gpaste__new-item-dialog__scroll-box__inner'
            });
            this._contentBox.add_actor(this.entry);

            this.scrollBox = new St.ScrollView({
                x_fill:     true,
                y_fill:     false,
                y_align:    St.Align.START,
                styleClass: 'gpaste__new-item-dialog__scroll-box'
            });
            this.scrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
            this.scrollBox.add_actor(this._contentBox);

            this.contentLayout.add(new St.Label({ text: _("Please enter the text you want to add to the current history:") }));
            this.contentLayout.add(this.scrollBox);
            this.contentLayout.add_style_class_name('gpaste__new-item-dialog__content');

            this.setButtons([
                {
                    label: _("OK"),
                    action: () => this._onOK()
                },
                {
                    label: _("Cancel"),
                    action: () => {
                        this.close(global.get_current_time());
                    }
                }
            ]);
        }

        /*
        * Calculate the padding that is added to the text field
        */
        _calcEntryHeightDiff() {
            const textBackup = this.entry.get_text();
            this.entry.set_text("");

            let width       = this.entry.get_width();
            const themeNode = this.entry.get_theme_node();
            width = themeNode.adjust_for_width(width);

            const [minHeight,         natHeight]         = this.entry.clutter_text.get_preferred_height(width);
            const [minHeightAdjusted, natHeightAdjusted] = themeNode.adjust_preferred_height(minHeight, natHeight);

            this.entryHeightDiff = natHeightAdjusted - natHeight;

            this.entry.set_text(textBackup);
        }

        /*
        * Resize the text field
        */
        _resizeEntry() {
            let width       = this.entry.get_width();
            const themeNode = this.entry.get_theme_node();
            width = themeNode.adjust_for_width(width);

            const [minHeight, natHeight] = this.entry.clutter_text.get_preferred_height(width);
            const height                 = natHeight + this.entryHeightDiff;

            if (this._prevEntryHeight != height) {
                this._prevEntryHeight = height;

                this.entry.set_height(height);
            }
        }

        //
        // Events
        // ---------------------------------------------------------------------------------

        /*
        * The OK button was pressed
        */
        _onOK() {
            this.close(global.get_current_time());
            this._callback(this.entry.get_text());

            this.entry.set_text("");
        }

        //
        // Overrides
        // ---------------------------------------------------------------------------------

        /*
        * Overridden so the text field's padding will be calculated as soon as
        * the dialog is displayed (it doesn't work correctly if it is hidden)
        */
        open(timestamp) {
            ModalDialog.ModalDialog.prototype.open.call(this, timestamp);

            this._calcEntryHeightDiff();
            global.stage.set_key_focus(this.entry);
        }
    }
);
