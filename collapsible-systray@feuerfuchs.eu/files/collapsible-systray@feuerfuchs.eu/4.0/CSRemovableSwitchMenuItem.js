const Lang      = imports.lang;
const St        = imports.gi.St;
const Mainloop  = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;

// ------------------------------------------------------------------------------------------------------

function CSRemovableSwitchMenuItem(text, active, params) {
    this._init(text, active, params);
}

CSRemovableSwitchMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(text, active, params) {
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, text, active, params);

        const iconDelete = new St.Icon({
            icon_name:   'edit-delete',
            icon_type:   St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon'
        });
        this.deleteButton = new St.Button({ child: iconDelete });
        this.deleteButton.connect('clicked', Lang.bind(this, this.remove));

        this._statusBin.remove_child(this._switch.actor);
        this.removeActor(this._statusBin);

        this._statusBin = new St.BoxLayout({
            vertical: false,
            style:    'spacing: 6px;',
            x_align:  St.Align.END
        });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.add(this._switch.actor);
        this._statusBin.add(this.deleteButton);
    },

    /*
     * User clicked the "remove" button
     */
    remove: function() {
        this.emit('remove');
        this.destroy();
    }
};
