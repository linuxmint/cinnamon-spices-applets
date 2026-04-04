const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "window-closer@stefan-schmidbauer";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const CARD_WIDTH = 220;
const CARD_HEIGHT = 200;
const CARD_SPACING = 16;
const CARDS_PER_ROW = 5;

function WindowCloserApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

WindowCloserApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        let iconPath = metadata.path + "/icon.svg";
        this.set_applet_icon_path(iconPath);
        this.set_applet_tooltip(_("Window Closer"));

        this._backdrop = null;
        this._dialog = null;
        this._readyForInput = false;
        this._idleId = 0;
        this._timeoutId = 0;
    },

    on_applet_clicked: function() {
        if (this._backdrop) {
            this._closeOverlay();
            return;
        }
        this._openOverlay();
    },

    _getWindows: function() {
        let workspaceManager = global.workspace_manager;
        let windows = [];
        let nWorkspaces = workspaceManager.get_n_workspaces();
        for (let w = 0; w < nWorkspaces; w++) {
            let ws = workspaceManager.get_workspace_by_index(w);
            let wsWindows = ws.list_windows();
            for (let i = 0; i < wsWindows.length; i++) {
                let win = wsWindows[i];
                let wtype = win.get_window_type();
                if (wtype === Meta.WindowType.NORMAL || wtype === Meta.WindowType.DIALOG) {
                    if (win.get_title()) {
                        windows.push(win);
                    }
                }
            }
        }
        let tracker = Cinnamon.WindowTracker.get_default();
        windows.sort(function(a, b) {
            let appA = "", appB = "";
            try { let app = tracker.get_window_app(a); if (app) appA = app.get_name() || ""; } catch(e) {}
            try { let app = tracker.get_window_app(b); if (app) appB = app.get_name() || ""; } catch(e) {}
            let cmp = appA.toLowerCase().localeCompare(appB.toLowerCase());
            if (cmp !== 0) return cmp;
            return (a.get_title() || "").toLowerCase().localeCompare((b.get_title() || "").toLowerCase());
        });

        return windows;
    },

    _openOverlay: function() {
        let monitor = Main.layoutManager.primaryMonitor;
        let self = this;
        let windows = this._getWindows();

        this._readyForInput = false;

        // --- Fullscreen dark backdrop ---
        this._backdrop = new St.Bin({
            reactive: true,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            style: "background-color: rgba(0,0,0,0.7);"
        });

        this._backdrop.connect("button-release-event", function(actor, event) {
            if (!self._readyForInput) return Clutter.EVENT_STOP;
            self._closeOverlay();
            return Clutter.EVENT_STOP;
        });

        Main.layoutManager.addChrome(this._backdrop);

        // --- Centered dialog (auto-sized) ---
        this._dialog = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: "background-color: rgba(30,30,30,0.95); " +
                   "border-radius: 16px; " +
                   "border: 1px solid rgba(255,255,255,0.15); " +
                   "padding: 40px;"
        });
        this._monitor = monitor;

        // Header
        let header = new St.Label({
            text: _("Window Closer"),
            style: "font-size: 18px; font-weight: bold; color: rgba(255,255,255,0.9); " +
                   "padding-bottom: 6px;"
        });
        header.set_x_align(Clutter.ActorAlign.CENTER);
        this._dialog.add_child(header);

        let subtitle = new St.Label({
            text: _("Click a window to close it") + " \u00b7 " + _("Esc to exit"),
            style: "font-size: 12px; color: rgba(255,255,255,0.45); padding-bottom: 20px;"
        });
        subtitle.set_x_align(Clutter.ActorAlign.CENTER);
        this._dialog.add_child(subtitle);

        // Card container
        this._cardContainer = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });

        this._buildCards(windows);

        this._dialog.add_child(this._cardContainer);

        Main.layoutManager.addChrome(this._dialog);

        // Push modal to grab keyboard + pointer
        this._isModal = Main.pushModal(this._dialog);

        // ESC key on dialog (works because we have modal grab)
        this._dialog.connect("key-press-event", function(actor, event) {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                self._closeOverlay();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Center after layout is computed
        this._idleId = Mainloop.idle_add(function() {
            self._idleId = 0;
            if (!self._dialog) return GLib.SOURCE_REMOVE;
            let dW = self._dialog.get_width();
            let dH = self._dialog.get_height();
            let m = self._monitor;
            // Clamp if too large
            if (dW > m.width - 80) self._dialog.set_width(m.width - 80);
            if (dH > m.height - 80) self._dialog.set_height(m.height - 80);
            dW = self._dialog.get_width();
            dH = self._dialog.get_height();
            self._dialog.set_position(
                m.x + Math.floor((m.width - dW) / 2),
                m.y + Math.floor((m.height - dH) / 2)
            );
            return GLib.SOURCE_REMOVE;
        });

        this._timeoutId = Mainloop.timeout_add(300, function() {
            self._timeoutId = 0;
            self._readyForInput = true;
            return GLib.SOURCE_REMOVE;
        });
    },

    _buildCards: function(windows) {
        let self = this;
        let tracker = Cinnamon.WindowTracker.get_default();

        this._cardContainer.destroy_all_children();

        if (windows.length === 0) {
            let emptyLabel = new St.Label({
                text: _("No windows open"),
                style: "font-size: 16px; color: rgba(255,255,255,0.4); padding: 40px;"
            });
            emptyLabel.set_x_align(Clutter.ActorAlign.CENTER);
            this._cardContainer.add_child(emptyLabel);
            return;
        }

        let currentRow = null;
        let cardCount = 0;

        for (let i = 0; i < windows.length; i++) {
            if (cardCount % CARDS_PER_ROW === 0) {
                currentRow = new St.BoxLayout({
                    vertical: false,
                    x_align: Clutter.ActorAlign.CENTER,
                    x_expand: true,
                    style: "spacing: " + CARD_SPACING + "px; padding-bottom: " + CARD_SPACING + "px;"
                });
                this._cardContainer.add_child(currentRow);
            }

            let card = this._makeCard(windows[i], tracker);
            if (card) {
                currentRow.add_child(card);
                cardCount++;
            }
        }
    },

    _makeCard: function(win, tracker) {
        let self = this;
        let title = win.get_title();
        let appName = "";
        let app = null;

        try {
            app = tracker.get_window_app(win);
            if (app) appName = app.get_name() || "";
        } catch(e) {}

        let normalStyle = "width: " + CARD_WIDTH + "px; height: " + CARD_HEIGHT + "px; " +
                         "background-color: rgba(255,255,255,0.07); " +
                         "border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); " +
                         "padding: 10px;";

        let hoverStyle = "width: " + CARD_WIDTH + "px; height: " + CARD_HEIGHT + "px; " +
                        "background-color: rgba(231,76,60,0.35); " +
                        "border-radius: 10px; border: 1px solid rgba(231,76,60,0.8); " +
                        "padding: 10px;";

        let card = new St.Button({
            style: normalStyle,
            reactive: true,
            track_hover: true
        });

        card.connect("notify::hover", function() {
            card.style = card.hover ? hoverStyle : normalStyle;
        });

        let cardBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });

        // Thumbnail
        let thumbAdded = false;
        try {
            let actor = win.get_compositor_private();
            if (actor) {
                let winW = actor.get_width();
                let winH = actor.get_height();
                if (winW > 0 && winH > 0) {
                    let thumbW = CARD_WIDTH - 20;
                    let thumbH = 120;
                    let scale = Math.min(thumbW / winW, thumbH / winH);
                    let clone = new Clutter.Clone({ source: actor });
                    clone.set_size(Math.round(winW * scale), Math.round(winH * scale));

                    let thumbBin = new St.Bin({
                        style: "background-color: rgba(0,0,0,0.3); border-radius: 6px;",
                        x_align: Clutter.ActorAlign.CENTER,
                        y_expand: true
                    });
                    thumbBin.set_child(clone);
                    cardBox.add_child(thumbBin);
                    thumbAdded = true;
                }
            }
        } catch(e) {}

        if (!thumbAdded) {
            let iconBin = new St.Bin({
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                style: "padding: 20px;"
            });
            if (app) {
                try { iconBin.set_child(app.create_icon_texture(64)); } catch(e) {
                    iconBin.set_child(new St.Icon({ icon_name: "application-x-executable", icon_size: 64 }));
                }
            } else {
                iconBin.set_child(new St.Icon({ icon_name: "application-x-executable", icon_size: 64 }));
            }
            cardBox.add_child(iconBin);
        }

        // Info row: small icon + text
        let infoBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: "padding-top: 8px; spacing: 8px;"
        });

        if (app) {
            try {
                let smallIcon = app.create_icon_texture(20);
                let iconBin = new St.Bin({ y_align: Clutter.ActorAlign.CENTER });
                iconBin.set_child(smallIcon);
                infoBox.add_child(iconBin);
            } catch(e) {}
        }

        let labelBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        if (appName) {
            let nameLabel = new St.Label({
                text: appName,
                style: "font-size: 12px; font-weight: bold; color: rgba(255,255,255,0.9);"
            });
            if (nameLabel.clutter_text) nameLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            labelBox.add_child(nameLabel);
        }

        let titleLabel = new St.Label({
            text: title,
            style: "font-size: 10px; color: rgba(255,255,255,0.5);"
        });
        if (titleLabel.clutter_text) titleLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        labelBox.add_child(titleLabel);

        infoBox.add_child(labelBox);
        cardBox.add_child(infoBox);

        card.set_child(cardBox);

        // Click closes window
        card.connect("clicked", function() {
            if (!self._readyForInput) return;
            win.delete(global.get_current_time());
            let parent = card.get_parent();
            if (parent) {
                parent.remove_child(card);
                card.destroy();
                if (parent.get_n_children() === 0 && parent.get_parent()) {
                    let container = parent.get_parent();
                    container.remove_child(parent);
                    parent.destroy();
                }
            }
            if (self._cardContainer.get_n_children() === 0) {
                let doneLabel = new St.Label({
                    text: _("All windows closed!"),
                    style: "font-size: 16px; color: rgba(255,255,255,0.4); padding: 40px;"
                });
                doneLabel.set_x_align(Clutter.ActorAlign.CENTER);
                self._cardContainer.add_child(doneLabel);
            }
        });

        return card;
    },

    _closeOverlay: function() {
        if (this._idleId > 0) {
            Mainloop.source_remove(this._idleId);
            this._idleId = 0;
        }
        if (this._timeoutId > 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._isModal) {
            Main.popModal(this._dialog);
            this._isModal = false;
        }
        if (this._dialog) {
            Main.layoutManager.removeChrome(this._dialog);
            this._dialog.destroy();
            this._dialog = null;
        }
        if (this._backdrop) {
            Main.layoutManager.removeChrome(this._backdrop);
            this._backdrop.destroy();
            this._backdrop = null;
        }
        this._readyForInput = false;
    },

    on_applet_removed_from_panel: function() {
        this._closeOverlay();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new WindowCloserApplet(metadata, orientation, panelHeight, instanceId);
}
