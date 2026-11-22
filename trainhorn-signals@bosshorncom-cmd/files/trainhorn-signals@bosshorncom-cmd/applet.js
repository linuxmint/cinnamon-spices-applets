const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const St = imports.gi.St;

const UUID = "trainhorn-signals@bosshorncom-cmd";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}

// GCOR Rule 5.8.2 catalog. Signal 1 is a succession of shorts; five
// shorts are a sample, not a fixed official count.
const SIGNALS = [
    {number: 1, notation: "o o o o o …", name: "Emergency warning", notes: "succession of short sounds", blasts: ["short", "short", "short", "short", "short"]},
    {number: 2, notation: "-", name: "Brakes applied", notes: "", blasts: ["long"]},
    {number: 3, notation: "- -", name: "Proceed", notes: "release brakes", blasts: ["long", "long"]},
    {number: 4, notation: "o o", name: "Acknowledgment", notes: "", blasts: ["short", "short"]},
    {number: 5, notation: "o o o", name: "Backing", notes: "", blasts: ["short", "short", "short"]},
    {number: 6, notation: "o o o o", name: "Request signal", notes: "", blasts: ["short", "short", "short", "short"]},
    {number: 7, notation: "- - o -", name: "Grade crossing", notes: "", blasts: ["long", "long", "short", "long"]},
    {number: 8, notation: "- o", name: "Approaching men or equipment", notes: "", blasts: ["long", "short"]}
];

const SHORT_MS = 1000;
const LONG_MS = 3000;
const PAUSE_MS = 1000;

function durationMs(blasts) {
    if (!blasts.length) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < blasts.length; i++) {
        total += (blasts[i] === "short") ? SHORT_MS : LONG_MS;
        if (i < blasts.length - 1) {
            total += PAUSE_MS;
        }
    }
    return total;
}

class TrainHornApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this._metadata = metadata;
        this._orientation = orientation;
        this._timeouts = [];
        this._playing = false;
        this._player = this._findPlayer();

        try {
            this.set_applet_icon_path(metadata.path + "/icon.png");
        } catch (e) {
            this.set_applet_icon_symbolic_name("audio-speakers-symbolic");
        }
        this.set_applet_tooltip(_("Train horn signals (GCOR 5.8.2)"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildMenu();
    }

    _findPlayer() {
        const names = ["paplay", "aplay", "play"];
        for (let i = 0; i < names.length; i++) {
            let found = GLib.find_program_in_path(names[i]);
            if (found) {
                return found;
            }
        }
        return null;
    }

    _buildMenu() {
        this.menu.removeAll();
        let title = new PopupMenu.PopupMenuItem(_("GCOR 5.8.2 train horn signals"), {reactive: false});
        title.label.add_style_class_name("popup-subtitle-menu-item");
        this.menu.addMenuItem(title);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (let i = 0; i < SIGNALS.length; i++) {
            let sig = SIGNALS[i];
            let label = sig.number + "  " + sig.notation + "  —  " + _(sig.name);
            if (sig.notes) {
                label += " (" + _(sig.notes) + ")";
            }
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect("activate", () => {
                this._playSignal(sig);
            });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let hint = this._player
            ? _("Planning lengths: 1 s short, 3 s long, 1 s pause. Tones are timing references, not a recorded train horn.")
            : _("No audio player found (install paplay, aplay, or sox). Patterns still list in the menu.");
        let footer = new PopupMenu.PopupMenuItem(hint, {reactive: false});
        this.menu.addMenuItem(footer);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _clearTimeouts() {
        for (let i = 0; i < this._timeouts.length; i++) {
            Mainloop.source_remove(this._timeouts[i]);
        }
        this._timeouts = [];
        this._playing = false;
    }

    _playFile(kind) {
        if (!this._player) {
            return;
        }
        let file = this._metadata.path + "/sounds/" + kind + ".wav";
        // quote the paths; both are known and contain no spaces
        let cmd = this._player + " '" + file.replace(/'/g, "") + "'";
        try {
            GLib.spawn_command_line_async(cmd);
        } catch (e) {
            global.logError(UUID + ": could not play " + file + ": " + e);
        }
    }

    _playSignal(sig) {
        this._clearTimeouts();
        this._playing = true;
        let elapsed = 0;
        let blasts = sig.blasts;
        this.set_applet_tooltip(_("Playing: ") + sig.notation + "  " + _(sig.name));

        for (let i = 0; i < blasts.length; i++) {
            let kind = blasts[i];
            let start = elapsed;
            this._timeouts.push(Mainloop.timeout_add(start, () => {
                this._playFile(kind);
                return false;
            }));
            elapsed += (kind === "short") ? SHORT_MS : LONG_MS;
            if (i < blasts.length - 1) {
                elapsed += PAUSE_MS;
            }
        }
        this._timeouts.push(Mainloop.timeout_add(elapsed, () => {
            this._playing = false;
            this.set_applet_tooltip(_("Train horn signals (GCOR 5.8.2)"));
            return false;
        }));
    }

    on_applet_removed_from_panel() {
        this._clearTimeouts();
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new TrainHornApplet(metadata, orientation, panelHeight, instance_id);
}
