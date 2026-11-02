// Protection against a second tray applet.
//
// Only one applet may host the legacy X11 tray icons: when two of them hand
// the same icon around, Cinnamon crashes on cleanup (St.Bin assertion in
// st_bin_destroy). Two XApp hosts don't crash, but show every icon twice.
// So when another tray applet is (or becomes) enabled, PocketTray gives the
// icons back, shows a notification and removes itself from the panel. Its
// settings file stays, re-adding PocketTray later restores everything.

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const Extension = imports.ui.extension;
// Sibling modules are loaded through Cinnamon's per-applet importer, which
// works on Cinnamon 6.6 and later; exported are top-level `var` and `function`.
const Me = imports.ui.appletManager.applets["PocketTray@spex"];
const { _ } = Me.lib.i18n;

// Tray applets matched by UUID, as they don't declare "role": "tray". The
// names are used in the notification when the applet isn't loaded yet.
const KNOWN_TRAY_APPLETS = {
    "systray@cinnamon.org":              "System Tray",
    "xapp-status@cinnamon.org":          "XApp Status Applet",
    "collapsible-systray@feuerfuchs.eu": "Collapsible Systray"
};

// Entries of the "enabled-applets" setting look like
// "panel1:right:0:<uuid>:<instance id>".
function _parseEnabledApplet(entry) {
    const parts = entry.split(":");
    return { uuid: parts[3], instanceId: parts[4] };
}

// Other enabled tray applets as [{ uuid, name }], or null if there are none.
// Known applets are matched by UUID; any other applet counts once Cinnamon
// has loaded it and it declares "role": "tray". No file I/O.
function findRivalTrays(ownUuid) {
    const rivals = [];
    for (const entry of global.settings.get_strv("enabled-applets")) {
        const { uuid } = _parseEnabledApplet(entry);
        if (!uuid || uuid === ownUuid || rivals.some((r) => r.uuid === uuid)) continue;

        const ext = Extension.getExtension(uuid);
        const meta = ext ? ext.meta : null;
        const roles = (meta && meta.role) ? meta.role.replace(/ /g, "").split(",") : [];
        if (uuid in KNOWN_TRAY_APPLETS || roles.includes("tray")) {
            const name = (meta && meta.name) || KNOWN_TRAY_APPLETS[uuid] || uuid;
            rivals.push({ uuid: uuid, name: name });
        }
    }
    return rivals.length ? rivals : null;
}

// Notifies the user and removes the given PocketTray instance from the
// panel. The caller must have stopped hosting icons before.
function retire(ownUuid, ownInstanceId, rivals) {
    const rivalNames = rivals.map((r) => "\"" + r.name + "\"").join(", ");
    global.logWarning("PocketTray: other tray applets are active (" + rivalNames + "), removing PocketTray");

    Main.warningNotify(
        _("PocketTray has been removed from the panel"),
        _("PocketTray replaces these applets, which already show tray icons: %s. Running them side by side shows icons twice and can crash Cinnamon. Remove them from the panel first, then add PocketTray again.")
            .format(rivalNames),
        new St.Icon({ icon_name: "dialog-warning-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: 24 })
    );

    // Deferred: never change enabled-applets while the applet manager is
    // still adding applets or reacting to a change. Not tracked on purpose:
    // it removes this very instance, so it has to outlive it.
    Mainloop.idle_add(() => {
        const id = String(ownInstanceId);
        const list = global.settings.get_strv("enabled-applets").filter((entry) => {
            const { uuid, instanceId } = _parseEnabledApplet(entry);
            return !(uuid === ownUuid && instanceId === id);
        });
        global.settings.set_strv("enabled-applets", list);
        return GLib.SOURCE_REMOVE;
    });
}

// The rival applets are usually loaded *after* the change that made us
// retire, so wait until all of them run (at most 5 s), then make the X11
// tray re-emit its icons for them. XApp icons need nothing: the rival's own
// monitor picks them up. Not tracked on purpose, like in retire().
function handOverIcons(rivals) {
    let tries = 0;
    Mainloop.timeout_add(250, () => {
        tries++;
        let running = false;
        try {
            running = rivals.every((r) => AppletManager.getRunningInstancesForUuid(r.uuid).length > 0);
        } catch (e) {
            global.logWarning("PocketTray: cannot query running applets: " + e);
        }
        if (running || tries >= 20) {
            Main.statusIconDispatcher.redisplay();
            return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
    });
}
