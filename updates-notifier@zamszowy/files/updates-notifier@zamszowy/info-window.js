#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Gettext = imports.gettext;

if (!String.prototype.format) {
    String.prototype.format = function (...args) {
        return this.replace(/\{(\d+)\}/g, (m, i) =>
            (i in args ? args[i] : m));
    };
}

// ARGV[0] - dir which updates.js
imports.searchPath.push(
    Gio.File.new_for_path(ARGV[0]).get_path()
);

const Updates = imports.updates.Updates;

const UUID = "updates-notifier@zamszowy";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(str) { return Gettext.dgettext(UUID, str); }

function checkKeysForExit(event, win, callback) {
    const [, key] = event.get_keyval();
    const [, modifier] = event.get_state();

    if ((key === Gdk.KEY_Escape) || (key === Gdk.KEY_w && modifier === Gdk.ModifierType.CONTROL_MASK)) {
        if (win) {
            win.destroy();
        }
        callback();
        return true;
    }
    return false;

}

function capitalize(str) {
    if (!str) return str;
    str = str.trimStart();
    return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

function getPkgDetails(pkgid, callback) {
    let pkg_cmd = [];
    if (GLib.find_program_in_path("pkgcli")) {
        pkg_cmd = ["pkgcli", "show-update", pkgid];
    } else if (GLib.find_program_in_path("pkgctl")) {
        pkg_cmd = ["pkgctl", "show-update", pkgid];
    } else {
        pkg_cmd = ["pkcon", "get-update-detail", pkgid];
    }

    let launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });
    launcher.setenv("LANG", "en_US.UTF-8", true);
    try {
        let subprocess = launcher.spawnv(pkg_cmd);
        subprocess.communicate_utf8_async(null, null, (proc, res) => {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok) {
                // Split into lines
                let lines = stdout.split("\n");
                // Find "Results:" line
                let idx = lines.findIndex(l => l.trim() === "Results:");
                let details = idx >= 0 ? lines.slice(idx + 1) : lines;
                const details_str = details.join("\n");

                callback(details_str.length > 0 ? details_str : _("No details available."));
            } else {
                callback(_("Error:\n{0}").format(stderr));
            }
        });
    } catch (e) {
        callback(_("Failed to run command:\n{0}").format(e.message));
    }
}

function getFirmwareDetails(deviceid, callback) {
    let launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });
    try {
        let subprocess = launcher.spawnv(["fwupdmgr", "get-updates", deviceid]);
        subprocess.communicate_utf8_async(null, null, (proc, res) => {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok) {
                callback(stdout.length > 0 ? stdout : _("No details available."));
            } else {
                callback(_("Error:\n{0}").format(stderr));
            }
        });
    } catch (e) {
        callback(_("Failed to run command:\n{0}").format(e.message));
    }
}

function showDetails(item) {
    let win = new Gtk.Window({ title: item.name });
    win.set_default_size(700, 520);

    let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
    vbox.set_margin_top(8);
    vbox.set_margin_bottom(8);
    vbox.set_margin_start(8);
    vbox.set_margin_end(8);

    // Spinner + label
    let spinner = new Gtk.Spinner();
    spinner.start();
    let loadingLabel = new Gtk.Label({ label: _("Loading update details…") });
    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    hbox.pack_start(spinner, false, false, 0);
    hbox.pack_start(loadingLabel, false, false, 0);
    vbox.pack_start(hbox, false, false, 0);

    win.add(vbox);

    win.connect("key-press-event", (_actor, event) => {
        return checkKeysForExit(event, win, () => win = null);
    });

    win.connect("delete-event", () => {
        if (win) {
            win.destroy();
            win = null;
        }
    });
    win.show_all();

    const isFirmware = item.values.isFirmware === "1";
    print("fetching details for", isFirmware ? item.values.deviceid : item.values.pkgid);

    const setText = (str) => {
        if (!win) return;

        // Stop and hide spinner row
        spinner.stop();
        hbox.hide();

        let scroll = new Gtk.ScrolledWindow();
        let textview = new Gtk.TextView();
        textview.set_editable(false);
        textview.set_cursor_visible(false);
        scroll.add(textview);
        vbox.pack_start(scroll, true, true, 0);
        textview.buffer.text = str;

        scroll.show_all();
    };

    if (!isFirmware) {
        getPkgDetails(item.values.pkgid, setText);
    } else {
        getFirmwareDetails(item.values.deviceid, setText)
    }
}

Gtk.init(null);

const css = `
.update-name { font-weight: bold; }
.update-spec { opacity: 0.7; }
.update-info { opacity: 0.7; }
.update-desc { font-style: italic; opacity: 0.3; }
`
let prov = new Gtk.CssProvider();
prov.load_from_data(css);
Gtk.StyleContext.add_provider_for_screen(
    Gdk.Screen.get_default(),
    prov,
    Gtk.STYLE_PROVIDER_PRIORITY_USER
);

// main window
let win = new Gtk.Window({ title: _("Updates") });
win.set_default_size(720, 720);

// VBox for search + list
let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });

// Overlay container for fake placeholder
let overlay = new Gtk.Overlay();
vbox.pack_start(overlay, false, false, 0);

let searchEntry = new Gtk.Entry();
searchEntry.set_no_show_all(true);
overlay.add(searchEntry);

// Fake placeholder label
let placeholder = new Gtk.Label({ label: _("Search updates…"), xalign: 0, yalign: 0.5 });
// Margin so the cursor would be at the start of label
placeholder.set_margin_start(10);
overlay.add_overlay(placeholder);

// Hide label when typing
function updatePlaceholderVisibility() {
    placeholder.set_visible(searchEntry.text.length === 0);
}

searchEntry.connect("changed", updatePlaceholderVisibility);

// Initialize visibility
updatePlaceholderVisibility();
// Initially hide overlay
overlay.hide();

let scroll = new Gtk.ScrolledWindow();
let listbox = new Gtk.ListBox();
scroll.add(listbox);
vbox.pack_start(scroll, true, true, 0);

win.add(vbox);

// Keep all rows so we can filter later
let allRows = [];

// parse updates from ARGV[1]
let [success, buffer] = GLib.file_get_contents(ARGV[1]);
if (success) {
    let text = typeof TextDecoder !== "undefined" ? new TextDecoder().decode(buffer) : String(buffer); // workaround for older cjs versions
    const updates = new Map(
        [...Updates.fromStr(text).map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    );
    win.title = _("{0} updates").format(updates.size);

    let makeLabel = (str, cls) => {
        let label = new Gtk.Label({ label: str, xalign: 0 });
        label.get_style_context().add_class(cls);
        return label;
    }

    for (const [name, u] of updates) {
        let row = new Gtk.ListBoxRow();
        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });

        box.pack_start(makeLabel(capitalize(u.type), "update-info"), false, false, 0);
        box.pack_start(makeLabel(name, "update-name"), false, false, 0);
        if (u.localVersion && u.localVersion !== u.version) {
            box.pack_start(makeLabel(`${u.localVersion} → ${u.version}`, "update-spec"), false, false, 0);
        } else {
            box.pack_start(makeLabel(`${u.version}`, "update-spec"), false, false, 0);
        }
        box.pack_start(makeLabel(u.description, "update-desc"), false, false, 0);

        row.add(box);
        row._item = { name: name, values: u };

        listbox.add(row);
        allRows.push(row);
    }
} else {
    let label = new Gtk.Label({ label: _("Failed to read updates file:\n{0}").format(buffer), xalign: 0, yalign: 0 });
    vbox.remove(scroll);
    vbox.pack_start(label, true, true, 0);
    label.show();
}

listbox.connect("row-activated", (_box, row) => {
    if (row._item)
        showDetails(row._item);
});

function applyFilter() {
    const query = searchEntry.text.toLowerCase();
    for (const row of allRows) {
        const text = "{0} {1} {2}".format(row._item.values.type, row._item.name, row._item.values.description);
        row.set_visible(text.toLowerCase().includes(query));
    }
}

searchEntry.connect("changed", applyFilter);

win.connect("key-press-event", (_actor, event) => {
    const [, key] = event.get_keyval();
    const [, modifier] = event.get_state();

    if (key === Gdk.KEY_f && (modifier & Gdk.ModifierType.CONTROL_MASK)) {
        if (searchEntry.get_visible()) {
            searchEntry.hide();
            searchEntry.text = "";
            applyFilter();
        } else {
            searchEntry.show();
            searchEntry.grab_focus();
        }
        return true;
    }

    if (key === Gdk.KEY_Escape) {
        if (searchEntry.get_visible()) {
            searchEntry.hide();
            searchEntry.text = "";
            applyFilter();
        } else {
            if (win) {
                win.destroy();
                win = null;
            }
            Gtk.main_quit();
        }
        return true;
    }

    return false;
});

win.connect("delete-event", () => {
    if (win) {
        win.destroy();
        win = null;
    }
    Gtk.main_quit();
});

win.connect("key-press-event", (_actor, event) => {
    return checkKeysForExit(event, win,
        () => {
            win = null;
            Gtk.main_quit();
        });
});

win.show_all();
Gtk.main();
