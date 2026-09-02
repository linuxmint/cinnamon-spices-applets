// applet.js : Startpage Search applet for Cinnamon panel
const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext.domain("StartpageSearch@pzim-devdata");
const _ = Gettext.gettext;

const SEARCH_URL = "https://www.startpage.com/sp/search?query=";

function SearchApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

SearchApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.set_applet_icon_path(metadata.path + "/icon2.svg");
        this.set_applet_tooltip(_("Startpage Search"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.entry = new St.Entry({
            name: "search-entry",
            hint_text: _("Search terms..."),
            track_hover: true,
            can_focus: true
        });
        let bin = new St.Bin({ x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        bin.set_child(this.entry);
        this.menu.addActor(bin);
        this.entry.clutter_text.connect("activate",
            () => this._search());
    },

    on_applet_clicked: function () {
        this.menu.toggle();
        if (this.menu.isOpen) {
            Mainloop.timeout_add(50, () => {
                global.stage.set_key_focus(this.entry);
                return false;
            });
        }
    },

    _search: function () {
        let q = this.entry.get_text().trim();
        if (!q) return;
        let url = SEARCH_URL + encodeURIComponent(q);
        Util.spawn(["xdg-open", url]);
        this.entry.set_text("");
        this.menu.close();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new SearchApplet(metadata, orientation, panel_height, instance_id);
}
