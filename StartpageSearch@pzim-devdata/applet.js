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
// si true : taper une URL dans le champ + Entrée ouvre aussi directement le lien
const DETECT_URLS_IN_ENTRY = true;

// détection d'URL : schéma explicite, www., ou domaine nu avec TLD valide
const URL_RE =
    /^(?:https?:\/\/\S+|www\.\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:[\/?#]\S*)?)$/i;

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

        // champ de saisie en haut du popup
        let entryBox = new St.BoxLayout({ style: "padding: 12px 12px 6px 12px;" });
        this.entry = new St.Entry({
            name: "search-entry",
            hint_text: _("Search terms..."),
            track_hover: true,
            can_focus: true,
            style: "width: 300px;"
        });
        this.entry.clutter_text.connect("activate", () => this._search());
        entryBox.add(this.entry, { expand: true, x_fill: true });
        this.menu.addActor(entryBox);

        // items de menu natifs (hover du thème) disposés en rangée horizontale
        let row = new St.BoxLayout({ vertical: false, style: "padding: 4px 8px;" });

        this.searchItem = new PopupMenu.PopupIconMenuItem(
            "", "system-search-symbolic", St.IconType.SYMBOLIC);
        this.searchItem.connect("activate", () => this._search());
        row.add(this.searchItem.actor, { expand: true, x_fill: true });

        this.pasteItem = new PopupMenu.PopupIconMenuItem(
            "", "edit-paste-symbolic", St.IconType.SYMBOLIC);
        this.pasteItem.connect("activate", () => this._paste());
        row.add(this.pasteItem.actor, { expand: true, x_fill: true });

        this.pasteSearchItem = new PopupMenu.PopupIconMenuItem(
            _("Paste & Search"), "edit-paste-symbolic", St.IconType.SYMBOLIC);
        this.pasteSearchItem.connect("activate", () => this._paste_search());
        row.add(this.pasteSearchItem.actor, { expand: true, x_fill: true });

        this.menu.addActor(row);

        // bulles d'aide au survol
        new Tooltips.Tooltip(this.searchItem.actor, _("Search"));
        new Tooltips.Tooltip(this.pasteItem.actor, _("Paste clipboard"));
        new Tooltips.Tooltip(this.pasteSearchItem.actor, _("Paste clipboard and search"));
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

    _is_url: function (t) {
        return (t || "").trim().length > 0 && URL_RE.test(t.trim());
    },

    _normalize: function (t) {
        t = t.trim();
        if (!/^https?:\/\//i.test(t)) t = "http://" + t;
        return t;
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
            if (!q) return;
            if (this._is_url(q)) {
                this._launch_open(this._normalize(q));
            } else {
                this._launch(q);
            }
        });
    },

    _search: function () {
        let q = this.entry.get_text().trim();
        if (q) {
            if (DETECT_URLS_IN_ENTRY && this._is_url(q)) {
                this._launch_open(this._normalize(q));
            } else {
                this._launch(q);
            }
        }
        this.entry.set_text("");
        this.menu.close();
    },

    _launch_open: function (url) {
        this._snapshot();
        Util.spawn(["xdg-open", url]);
        this._schedule_focus();
    },

    _launch: function (q) {
        this._snapshot();
        Util.spawn(["xdg-open", SEARCH_URL + encodeURIComponent(q)]);
        this._schedule_focus();
    },

    _snapshot: function () {
        this._known = {};
        this._titles = {};
        let actors = global.get_window_actors();
        for (let i = 0; i < actors.length; i++) {
            let w = actors[i].meta_window;
            this._known[w.get_stable_sequence()] = true;
            let t = (w.get_title() || "").trim();
            if (t) this._titles[t] = true;
        }
    },

    _schedule_focus: function () {
        this._focusDone = false;
        let delays = [500, 1000, 1500, 2200, 3000];
        for (let i = 0; i < delays.length; i++) {
            Mainloop.timeout_add(delays[i], () => {
                this._focus_browser();
                return false;   // exécution unique
            });
        }
    },

    _focus_browser: function () {
        if (this._focusDone) return;
        let actors = global.get_window_actors();
        for (let i = 0; i < actors.length; i++) {
            let w = actors[i].meta_window;
            if (!(w.get_stable_sequence() in this._known)) {
                Main.activateWindow(w, global.get_current_time());
                this._focusDone = true;
                return;
            }
        }
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
