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

function GPasteNotInstalledDialog() {
    this._init();
}

GPasteNotInstalledDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'gpaste__not-found-dialog' });

        this.contentLayout.add(new St.Label({ text: _("GPaste is not installed. Please install the necessary packages and then restart Cinnamon for this applet to start working.") }));
        this.contentLayout.add_style_class_name('gpaste__not-found-dialog__content');

        this.setButtons([
            {
                label: _("OK"),
                action: Lang.bind(this, this._onOK)
            }
        ]);
    },

    //
    // Events
    // ---------------------------------------------------------------------------------

    /*
     * The OK button was pressed
     */
    _onOK: function() {
        this.close(global.get_current_time());
    }
};
