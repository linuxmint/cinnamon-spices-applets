const Lang      = imports.lang;
const St        = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Pango     = imports.gi.Pango;
const Clutter   = imports.gi.Clutter;

// ------------------------------------------------------------------------------------------------------

function GPasteHistoryItem(text, index) {
    this._init(text, index);
}

GPasteHistoryItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(applet) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._applet = applet;

        //
        // Label

        this.label = new St.Label({ text: '' });
        this.label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        this.addActor(this.label);

        this.setTextLength();
        this._settingsChangedID = this._applet.clientSettings.connect('changed::element-size', Lang.bind(this, this.setTextLength));

        //
        // Delete button

        const iconDelete = new St.Icon({
            icon_name:   'edit-delete',
            icon_type:   St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon'
        });
        this.deleteButton = new St.Button({ child: iconDelete });
        this.deleteButton.connect('clicked', Lang.bind(this, this.remove));
        this.addActor(this.deleteButton, { expand: false, span: -1, align: St.Align.END });

        //
        //

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },

    /*
     * Override key press event
     */
    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.activate(event);
            return true;
        } else if (symbol == Clutter.KEY_Delete || symbol == Clutter.KEY_BackSpace) {
            this.remove();
            return true;
        }

        return false;
    },

    /*
     * Set max text length using GPaste's setting
     */
    setTextLength: function() {
        this.label.clutter_text.set_max_length(this._applet.clientSettings.get_element_size());
    },

    /*
     * Set specified index and get respective history item's content
     */
    setIndex: function(index) {
        this._index = index;

        if (index != -1) {
            this._applet.client.get_element_at_index(index, Lang.bind(this, function (client, result) {
                let item = client.get_element_at_index_finish(result);
                this._uuid = item.get_uuid();
                this.label.set_text(item.get_value().replace(/[\t\n\r]/g, ''));
            }));

            this.actor.show();
        }
        else {
            this.actor.hide();
        }
    },

    /*
     * Refresh history item's content
     */
    refresh: function() {
            this._applet.client.get_element_at_index(this._index, Lang.bind(this, function(client, result) {
                let item = client.get_element_at_index_finish(result);
                this._uuid = item.get_uuid();
                this.label.set_text(item.get_value().replace(/[\t\n\r]/g, ''));
            }));
        },
    
    /*
     * Remove history item
     */
    remove: function() {
        this._applet.client.delete(this._uuid, null);
    },

    //
    // Events
    // ---------------------------------------------------------------------------------

    /*
     * History item has been removed, disconnect bindings
     */
    _onDestroy: function() {
        this._applet.clientSettings.disconnect(this._settingsChangedID);
    },

    //
    // Overrides
    // ---------------------------------------------------------------------------------

    /*
     * Select history item
     */
    activate: function(event) {
        this._applet.client.select(this._uuid, null);
        this._applet.menu.toggle();
    }
};
