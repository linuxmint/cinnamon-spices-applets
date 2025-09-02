#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;

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

function parsePkgSpec(spec) {
    // e.g. "gir1.2-gtk-3.0-3.24.50-2.amd64"
    const lastDot = spec.lastIndexOf(".");
    if (lastDot < 0) return null;

    const arch = spec.slice(lastDot + 1);
    const nv = spec.slice(0, lastDot);

    const lastDash = nv.lastIndexOf("-");
    if (lastDash < 0) return null;

    const rev = nv.slice(lastDash + 1); // last dash part
    const nameAndUpstream = nv.slice(0, lastDash);

    // Split name and upstream_version from the right: first dash followed by digit or epoch
    const match = nameAndUpstream.match(/^(.*)-(\d[:\d.+~]*.*)$/);
    if (!match) {
        // fallback: no dash-digit found, treat all as name, version = rev
        return { name: nameAndUpstream, version: rev, arch };
    }

    const name = match[1];
    const upstreamVersion = match[2];
    const version = upstreamVersion + "-" + rev;

    return { name, version, arch };
}

function parseUpdates(text) {
    const results = [];
    const lines = text.split("\n");

    for (let line of lines) {
        if (!(line = line.trim())) continue;

        // Drop the first column (Normal/Security/etc.) + space
        let rest = line.replace(/^\S+\s+/, "");

        // First token after that is "name-version.arch"
        let tokens = rest.split(/\s+/);
        if (tokens.length === 0) continue;

        let spec = tokens[0]; // e.g. qemu-system-data-1:10.1.0+ds-2.all
        let parsed = parsePkgSpec(spec);
        if (!parsed) continue;

        // Optional "(repo)" token
        let repo = null;
        if (tokens.length >= 2 && tokens[1].startsWith("(") && tokens[1].endsWith(")")) {
            repo = tokens[1].slice(1, -1); // strip parentheses
        }

        let { name, version, arch } = parsed;
        let pkgid = repo ? `${name};${version};${arch};${repo}` : null;

        results.push({ line, name, version, arch, repo, pkgid, spec });
    }

    return results;
}

function buildPkgIdWithRepoFallback(item) {
    // If repo was present in file, use it.
    if (item.pkgid) return item.pkgid;

    // Last resort (may fail if PackageKit insists on a full ID)
    return `${item.name};${item.version};${item.arch};installed`;
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
    let loadingLabel = new Gtk.Label({ label: "Loading update details…" });
    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    hbox.pack_start(spinner, false, false, 0);
    hbox.pack_start(loadingLabel, false, false, 0);
    vbox.pack_start(hbox, false, false, 0);

    win.add(vbox);

    win.connect("key-press-event", (actor, event) => {
        return checkKeysForExit(event, win, () => win = null);
    });

    win.connect("delete-event", () => {
        if (win) {
            win.destroy();
            win = null;
        }
    });
    win.show_all();

    let pkgid = buildPkgIdWithRepoFallback(item);
    print("fetching details for:", pkgid);

    let subprocess = new Gio.Subprocess({
        argv: ["pkcon", "get-update-detail", pkgid],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });
    subprocess.init(null);

    subprocess.communicate_utf8_async(null, null, (proc, res) => {
        try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
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

            if (ok) {
                // Split into lines
                let lines = stdout.split("\n");
                // Find "Results:" line
                let idx = lines.findIndex(l => l.trim() === "Results:");
                let details = idx >= 0 ? lines.slice(idx + 1) : lines;
                const details_str = details.join("\n");
                textview.buffer.text = details_str.length > 0 ? details_str : "No details available.";
            } else {
                textview.buffer.text = "Error:\n" + stderr;
            }

            scroll.show_all();
        } catch (e) {
            if (!win) return;

            spinner.stop();
            hbox.hide();
            let errorLabel = new Gtk.Label({ label: "Failed to run command:\n" + e.message });
            vbox.pack_start(errorLabel, true, true, 0);
            errorLabel.show();
        }
    });
}

Gtk.init(null);

// main window
let win = new Gtk.Window({ title: ARGV[0] });
win.set_default_size(640, 640);

let scroll = new Gtk.ScrolledWindow();
let listbox = new Gtk.ListBox();

// parse updates from ARGV[1]
let text = new TextDecoder().decode(GLib.file_get_contents(ARGV[1])[1]);
let updates = parseUpdates(text);

for (let u of updates) {
    let row = new Gtk.ListBoxRow();
    let label = new Gtk.Label({ label: u.line, xalign: 0 });
    row.add(label);
    row._item = u;
    listbox.add(row);
}

listbox.connect("row-activated", (box, row) => {
    if (row._item)
        showDetails(row._item);
});

scroll.add(listbox);
win.add(scroll);

win.connect("delete-event", () => {
    if (win) {
        win.destroy();
        win = null;
    }
    Gtk.main_quit();
});

win.connect("key-press-event", (actor, event) => {
    return checkKeysForExit(event, win,
        () => {
            win = null;
            Gtk.main_quit();
        });
});

win.show_all();
Gtk.main();
