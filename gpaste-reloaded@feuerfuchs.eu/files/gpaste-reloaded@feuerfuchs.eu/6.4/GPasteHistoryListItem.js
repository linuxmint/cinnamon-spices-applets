const PopupMenu = imports.ui.popupMenu;

// ------------------------------------------------------------------------------------------------------

function GPasteHistoryListItem(text, index) {
    this._init(text, index);
}

GPasteHistoryListItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    _init: function(applet, name, params) {
        PopupMenu.PopupMenuItem.prototype._init.call(this, name, params);

        this._applet   = applet;
        this._histName = name;
    },

    //
    // Overrides
    // ---------------------------------------------------------------------------------

    /*
     * Select history item
     */
    activate: function(event) {
        this._applet.selectHistory(this._histName);
        this._applet.contextMenu.close(true);
    },
};
