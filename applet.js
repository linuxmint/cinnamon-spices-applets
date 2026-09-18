// applet.js : Startpage Search applet for Cinnamon panel
const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Tooltips = imports.ui.tooltips;
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
        this._focusDone = true;
        this._known = {};
        this._titles = {};

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // layout vertical : champ en haut, boutons en dessous
        let vbox = new St.BoxLayout({ vertical: true, style: "padding: 10px;" });

        this.entry = new St.Entry({
            name: "search-entry",
            hint_text: _("Search terms..."),
            track_hover: true,
            can_focus: true,
            style: "width: 320px;"
        });
        this.entry.clutter_text.connect("activate", () => this._search());
        vbox.add(this.entry, { expand: true, x_fill: true });

        // rangée de boutons : loupe, paste, paste & search
        let hbox = new St.BoxLayout({ vertical: false, style: "padding-top: 8px;" });

        this.searchBtn = new St.Button({
            reactive: true, track_hover: true, can_focus: true
        });
        this.searchBtn.set_child(new St.Icon({
            icon_name: "system-search-symbolic", icon_size: 20
        }));
        this.searchBtn.connect("clicked", () => this._search());
        hbox.add(this.searchBtn, { expand: true, x_fill: true });

        this.pasteBtn = new St.Button({
            reactive: true, track_hover: true, can_focus: true
        });
        this.pasteBtn.set_child(new St.Icon({
            icon_name: "edit-paste-symbolic", icon_size: 20
        }));
        this.pasteBtn.connect("clicked", () => this._paste());
        hbox.add(this.pasteBtn, { expand: true, x_fill: true });

        this.pasteSearchBtn = new St.Button({
            label: _("Paste & Search"),
            reactive: true, track_hover: true, can_focus: true
        });
        this.pasteSearchBtn.connect("clicked", () => this._paste_search());
        hbox.add(this.pasteSearchBtn, { expand: true, x_fill: true });

        vbox.add(hbox, { expand: false, x_fill: true });

        this.menu.addActor(vbox);

        // bulles d'aide au survol
        new Tooltips.Tooltip(this.searchBtn, _("Search"));
        new Tooltips.Tooltip(this.pasteBtn, _("Paste clipboard"));
        new Tooltips.Tooltip(this.pasteSearchBtn, _("Paste clipboard and search"));
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

    _paste: function () {
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (clip, txt) => {
            if (txt && txt.length) {
                this.entry.get_clutter_text().set_text(txt.trim());
                global.stage.set_key_focus(this.entry);
            }
        });
    },

    _paste_search: function () {
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (clip, txt) => {
            let q = (txt || "").trim();
            if (q) this._launch(q);
        });
    },

    _search: function () {
        let q = this.entry.get_text().trim();
        if (q) this._launch(q);
        this.entry.set_text("");
        this.menu.close();
    },

    _launch: function (q) {
        // baseline : identités et titres des fenêtres AVANT l'ouverture
        this._known = {};
        this._titles = {};
        let actors = global.get_window_actors();
        for (let i = 0; i < actors.length; i++) {
            let w = actors[i].meta_window;
            this._known[w.get_stable_sequence()] = true;
            let t = (w.get_title() || "").trim();
            if (t) this._titles[t] = true;
        }
        Util.spawn(["xdg-open", SEARCH_URL + encodeURIComponent(q)]);
        this._focusDone = false;
        // scrutations ponctuelles (callback return false : jamais répétées)
        let delays = [500, 1000, 1500, 2200, 3000];
        for (let i = 0; i < delays.length; i++) {
            Mainloop.timeout_add(delays[i], () => {
                this._focus_browser();
                return false;
            });
        }
    },

    _focus_browser: function () {
        if (this._focusDone) return;
        let actors = global.get_window_actors();
        // priorité 1 : fenêtre apparue depuis le lancement (navigateur à froid)
        for (let i = 0; i < actors.length; i++) {
            let w = actors[i].meta_window;
            if (!(w.get_stable_sequence() in this._known)) {
                Main.activateWindow(w, global.get_current_time());
                this._focusDone = true;
                return;
            }
        }
        // priorité 2 : fenêtre dont le titre a changé (onglet ajouté)
        for (let i = 0; i < actors.length; i++) {
            let w = actors[i].meta_window;
            let t = (w.get_title() || "").trim();
            if (t && !(t in this._titles)) {
                Main.activateWindow(w, global.get_current_time());
                this._focusDone = true;
                return;
            }
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new SearchApplet(metadata, orientation, panel_height, instance_id);
}
