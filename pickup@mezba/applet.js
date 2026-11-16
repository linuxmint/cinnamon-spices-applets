// Pickup panel applet -- the thin half of the hybrid design.
//
// Deliberately tiny: one centred panel icon and one click handler. No timers,
// no polling, no file watching, no GTK here.
//
// --- applet <-> popup communication -----------------------------------------
// The popup owns org.pickup.Popup on the *session* bus (see popup/popup.py).
//
//   click -> org.pickup.Popup.Toggle()       close the popup if it is running
//                                            (open or collapsed to its edge tab),
//                                            otherwise spawn it
//   <- org.pickup.Popup.StateChanged         pushed whenever the shelf changes
//
// The signal is subscribed to by bus name (no proxy), so it keeps working
// across popup restarts: the bus tracks whoever currently owns the name.
// The item count is shown in the tooltip, and the icon is tinted (see
// stylesheet.css) while the shelf is not empty. There is no overlay badge, so
// the icon stays centred and keeps the normal panel-icon size.

const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const BUS_NAME = "org.pickup.Popup";
const OBJECT_PATH = "/org/pickup/Popup";
const INTERFACE = "org.pickup.Popup";

const CALL_TIMEOUT_MS = 1200;

// get_user_config_dir() already honours XDG_CONFIG_HOME.
const STATE_PATH = GLib.build_filenamev([GLib.get_user_config_dir(), "pickup", "state.json"]);

// One-shot, non-blocking read used only to seed the count after a Cinnamon
// restart. callback(count) always runs (with 0 on any problem).
function readItemCount(callback) {
    try {
        let file = Gio.File.new_for_path(STATE_PATH);
        file.load_contents_async(null, (source, res) => {
            let count = 0;
            try {
                let [ok, contents] = source.load_contents_finish(res);
                if (ok && contents) {
                    let data = JSON.parse(imports.byteArray.toString(contents));
                    if (data && Array.isArray(data.items)) {
                        let cutoff = (Date.now() / 1000) - 48 * 3600;
                        for (let item of data.items) {
                            if (item && (item.pinned || Number(item.added || 0) >= cutoff)) count++;
                        }
                    }
                }
            } catch (e) {
                count = 0;   // no state file yet, or unreadable
            }
            callback(count);
        });
    } catch (e) {
        callback(0);
    }
}

class PickupApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this._count = -1;
        this._subId = 0;
        this._gotSignal = false;   // a live StateChanged beats the startup read
        this._removed = false;

        // Own symbolic icon (recoloured by the panel theme), with the stock icon
        // as a fallback if the file is ever missing.
        try {
            this.set_applet_icon_symbolic_path(this.metadata.path + "/icons/pickup-symbolic.svg");
        } catch (e) {
            this.set_applet_icon_symbolic_name("edit-copy-symbolic");
        }
        this._setCount(0);
        readItemCount((count) => {
            if (!this._removed && !this._gotSignal) this._setCount(count);
        });
        this._subscribe();
    }

    _setCount(count) {
        count = Math.max(0, Math.floor(Number(count) || 0));
        if (count === this._count) return;
        this._count = count;
        if (count > 0) {
            this.set_applet_tooltip(_("Pickup: %d item%s").format(count, count === 1 ? "" : "s"));
        } else {
            this.set_applet_tooltip(_("Pickup: a shelf for files and text"));
        }
        // Tint the icon while the shelf holds something; back to normal when empty.
        try {
            if (count > 0) this._applet_icon.add_style_class_name("pickup-has-items");
            else this._applet_icon.remove_style_class_name("pickup-has-items");
        } catch (e) {
            // Icon actor not ready; the tooltip still carries the count.
        }
    }

    _subscribe() {
        try {
            this._subId = Gio.DBus.session.signal_subscribe(
                BUS_NAME, INTERFACE, "StateChanged", OBJECT_PATH, null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, path, iface, signal, params) => {
                    this._gotSignal = true;
                    this._setCount(params.deep_unpack()[0]);
                }
            );
        } catch (e) {
            global.logWarning("[pickup] could not subscribe to D-Bus: " + e);
        }
    }

    _toggle() {
        // NO_AUTO_START: if nobody owns the name, fail fast and spawn instead.
        Gio.DBus.session.call(
            BUS_NAME, OBJECT_PATH, INTERFACE, "Toggle", null, null,
            Gio.DBusCallFlags.NO_AUTO_START, CALL_TIMEOUT_MS, null,
            (conn, res) => {
                try {
                    conn.call_finish(res);
                } catch (e) {
                    this._spawnPopup();
                }
            }
        );
    }

    _spawnPopup() {
        try {
            GLib.spawn_async(
                this.metadata.path + "/popup",
                ["python3", this.metadata.path + "/popup/popup.py"],
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
        } catch (e) {
            global.logError("[pickup] could not start popup: " + e);
        }
    }

    on_applet_clicked(event) {
        this._toggle();
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        if (this._subId) {
            try {
                Gio.DBus.session.signal_unsubscribe(this._subId);
            } catch (e) {
                // ignore
            }
            this._subId = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new PickupApplet(metadata, orientation, panel_height, instance_id);
}
