// The list of tray icons that live in the pocket (setting "hidden-apps").
//
// The settings widget is a one-column "list", so every entry is an object
// { name: "<id>" }. Ids are compared case-insensitively and without
// surrounding whitespace; normalizeId() is the single place that defines
// this, used for both the stored entries and the ids of tray icons.
//
// Who provides which id:
//   - legacy XEmbed icons: their role / WM_CLASS        (xembedHost.js)
//   - XApp status icons:   their name or process name   (xappStatusIcon.js)

function normalizeId(id) {
    return String(id || "").trim().toLowerCase();
}

class HiddenList {
    // settings:  the applet's AppletSettings
    // onChanged: called after every change of the list, whether it was made
    //            in the settings dialog or through setHidden()
    constructor(settings, onChanged) {
        this._onChanged = onChanged;
        this._entries = [];
        // Binds this._entries to the setting: reading gives the stored list,
        // assigning a new array saves it.
        settings.bindWithObject(this, "hidden-apps", "_entries", () => this._onChanged());
    }

    // Whether the icon with this id belongs into the pocket.
    has(id) {
        const wanted = normalizeId(id);
        return (this._entries || []).some((entry) => entry && normalizeId(entry.name) === wanted);
    }

    // Moves an icon into the pocket (hidden = true) or back to the panel.
    setHidden(id, hidden) {
        const wanted = normalizeId(id);
        const list = (this._entries || []).filter((entry) => entry && normalizeId(entry.name) !== wanted);
        if (hidden) {
            list.push({ name: wanted });
        }
        this._entries = list;   // saves the setting
        this._onChanged();
    }
}

module.exports = { HiddenList, normalizeId };
