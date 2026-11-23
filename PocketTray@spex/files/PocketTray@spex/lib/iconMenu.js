// "Show in panel" section of the applet's context menu.
//
// Lists every tray icon PocketTray currently hosts, each with its
// application icon and a switch: on = panel, off = pocket. Switching writes
// to the hidden list right away; the menu stays open, so several icons can
// be switched in one go.
//
// The rows come from "icon sources" (XEmbedHost, XAppHost). Each source has
// menuEntries() returning [{ id, label, makeIcon(size) }].

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const PopupMenu = imports.ui.popupMenu;
const { _ } = require('./lib/i18n');

const MENU_ICON_SIZE = 16;

// --------------------------------------------------------------------------
// Icon helpers, also used by the hosts for their menuEntries()
// --------------------------------------------------------------------------

// Launcher (.desktop) icon of the first application matching one of the
// candidate names (WM_CLASS or id), or a generic placeholder.
function makeAppIcon(candidates, size = MENU_ICON_SIZE) {
    const appSys = Cinnamon.AppSystem.get_default();
    for (const name of candidates) {
        if (!name) continue;
        const app = appSys.lookup_desktop_wmclass(name) || appSys.lookup_app(name.toLowerCase() + ".desktop");
        if (app) return app.create_icon_texture(size);
    }
    return new St.Icon({
        icon_name: "application-x-executable-symbolic",
        icon_type: St.IconType.SYMBOLIC,
        icon_size: size
    });
}

// Icon from what an application reports: a theme icon name or an image
// path. Falls back to makeAppIcon(fallbackCandidates).
function makeIconFromName(iconName, fallbackCandidates, size = MENU_ICON_SIZE) {
    if (iconName && iconName.trim()) {
        if (iconName.includes("/")) {
            return new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconName) }),
                icon_size: size
            });
        }
        return new St.Icon({
            icon_name: iconName,
            icon_type: iconName.includes("symbolic") ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR,
            icon_size: size
        });
    }
    return makeAppIcon(fallbackCandidates, size);
}

// --------------------------------------------------------------------------
// Menu
// --------------------------------------------------------------------------

// Row: [application icon] [name] ............ [switch]
// Behaves like PopupSwitchMenuItem (toggling keeps the menu open); its
// constructor is rebuilt here only to put an icon in front of the label.
class IconSwitchMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(text, active, iconActor, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: "", style_class: "popup-inactive-menu-item" });
        this.actor.label_actor = this.label;
        this._switch = new PopupMenu.Switch(active);

        if (iconActor) {
            this.addActor(iconActor, { span: 0 });
        }
        this.addActor(this.label);
        this.addActor(this._statusLabel);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;
    }
}

class IconMenuSection {
    // contextMenu: the applet's context menu (_applet_context_menu)
    // sources:     objects with menuEntries()
    // hiddenList:  HiddenList
    constructor(contextMenu, sources, hiddenList) {
        this._sources = sources;
        this._hiddenList = hiddenList;

        // Position 0: above the items Cinnamon adds (About, Configure, ...)
        this._section = new PopupMenu.PopupMenuSection();
        contextMenu.addMenuItem(this._section, 0);
        // Rebuilt on every opening, so the list is always current.
        contextMenu.connect("open-state-changed", (menu, open) => {
            if (open) this._rebuild();
        });
    }

    _rebuild() {
        this._section.removeAll();

        const entries = this._collectEntries();
        this._section.addMenuItem(new PopupMenu.PopupMenuItem(
            entries.length ? _("Show in panel:") : _("No tray icons"), { reactive: false }));

        for (const { id, label, makeIcon } of entries) {
            const item = new IconSwitchMenuItem(label, !this._hiddenList.has(id), makeIcon(MENU_ICON_SIZE));
            item.connect("toggled", (it, inPanel) => this._hiddenList.setHidden(id, !inPanel));
            this._section.addMenuItem(item);
        }
        this._section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    // One entry per id (an application can have several icons), sorted by label.
    _collectEntries() {
        const byId = new Map();
        for (const source of this._sources) {
            for (const entry of source.menuEntries()) {
                if (entry.id && !byId.has(entry.id)) {
                    byId.set(entry.id, entry);
                }
            }
        }
        return [...byId.values()].sort(
            (a, b) => GLib.utf8_collate(a.label.toLowerCase(), b.label.toLowerCase()));
    }
}

module.exports = { IconMenuSection, makeAppIcon, makeIconFromName };
