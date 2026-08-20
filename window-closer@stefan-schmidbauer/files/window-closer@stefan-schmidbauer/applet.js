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

// Base metrics, designed for a 1920x1080 screen at ui_scale 1.
// Everything is multiplied by a factor derived from the actual monitor size,
// so cards and labels stay readable on high resolution screens.
const BASE_SCREEN_WIDTH = 1920;
const BASE_SCREEN_HEIGHT = 1080;

const BASE_CARD_WIDTH = 240;
const BASE_CARD_HEIGHT = 215;
const BASE_THUMB_HEIGHT = 130;
const BASE_CARD_PADDING = 10;
const BASE_CARD_SPACING = 16;
const BASE_DIALOG_PADDING = 40;
const BASE_HEADER_HEIGHT = 80;
const BASE_FALLBACK_ICON = 64;
const BASE_SMALL_ICON = 20;

const DIALOG_MARGIN = 40;
const MAX_CARDS_PER_ROW = 6;
const ABS_MAX_CARDS_PER_ROW = 10;

// Scale range: the grid starts at MIN_FACTOR..MAX_FACTOR and may shrink when a
// lot of windows have to fit on screen — but only down to SHRINK_RATIO of its
// ideal size. Below that the cards would be too small to recognise, so the
// grid keeps its size and scrolls instead.
const MIN_FACTOR = 0.9;
const MAX_FACTOR = 2.0;
const SHRINK_RATIO = 0.7;
const SHRINK_FLOOR = 0.6;
const SCROLLBAR_WIDTH = 16;

// Resolution alone is not enough: a 2560x1600 laptop panel packs the same
// pixels into half the area of a 4K desktop screen, which makes identically
// sized cards look tiny on it. Dense screens therefore get an extra boost,
// damped because small screens are also viewed from closer up.
const REFERENCE_DPI = 96;
const DPI_DAMPING = 0.6;
const MAX_DPI_BOOST = 1.6;

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
        this._scrollView = null;
        this._isModal = false;
        this._readyForInput = false;
        this._idleId = 0;
        this._timeoutId = 0;
        this._metrics = null;
        this._pendingThumbs = [];
    },

    // Scales a window clone into its thumbnail bin. The bin size is only known
    // after the first layout pass, so this is called again from the idle
    // handler once the dialog has been allocated.
    _fitCloneToBin: function(entry) {
        let boxW = entry.bin.get_width();
        let boxH = entry.bin.get_height();

        if (boxW <= 0 || boxH <= 0) {
            boxW = this._metrics.thumbWidth * this._metrics.uiScale;
            boxH = this._metrics.thumbHeight * this._metrics.uiScale;
        }

        let scale = Math.min(boxW / entry.winW, boxH / entry.winH);
        if (!(scale > 0)) return;

        entry.clone.set_size(Math.max(1, Math.round(entry.winW * scale)),
                             Math.max(1, Math.round(entry.winH * scale)));
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

    // The overlay belongs on the monitor whose panel holds this applet, not
    // necessarily on the primary one.
    _getAppletMonitor: function() {
        try {
            if (this.panel && this.panel.monitorIndex !== undefined) {
                let monitor = Main.layoutManager.monitors[this.panel.monitorIndex];
                if (monitor) return monitor;
            }
        } catch(e) {}

        try {
            let monitor = Main.layoutManager.findMonitorForActor(this.actor);
            if (monitor) return monitor;
        } catch(e) {}

        return Main.layoutManager.primaryMonitor;
    },

    // Bounding box over all monitors, so the backdrop dims every screen and a
    // click anywhere closes the overlay.
    _getBackdropRect: function() {
        let monitors = Main.layoutManager.monitors;
        if (!monitors || monitors.length === 0) {
            let m = this._getAppletMonitor();
            return { x: m.x, y: m.y, width: m.width, height: m.height };
        }

        let x1 = monitors[0].x;
        let y1 = monitors[0].y;
        let x2 = monitors[0].x + monitors[0].width;
        let y2 = monitors[0].y + monitors[0].height;

        for (let i = 1; i < monitors.length; i++) {
            let m = monitors[i];
            if (m.x < x1) x1 = m.x;
            if (m.y < y1) y1 = m.y;
            if (m.x + m.width > x2) x2 = m.x + m.width;
            if (m.y + m.height > y2) y2 = m.y + m.height;
        }

        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    },

    // Metrics for one concrete scale factor. Returns the grid layout plus a
    // "fits" flag telling the caller whether it still fits on the monitor.
    _metricsForFactor: function(factor, logW, logH, windowCount, reserveScrollbar) {
        let px = function(base, min) {
            return Math.max(min || 1, Math.round(base * factor));
        };

        let spacing = px(BASE_CARD_SPACING, 8);
        let dialogPadding = px(BASE_DIALOG_PADDING, 20);
        let cardWidth = px(BASE_CARD_WIDTH);
        let cardHeight = px(BASE_CARD_HEIGHT);
        let cardPadding = px(BASE_CARD_PADDING, 6);

        let availWidth = logW - 2 * DIALOG_MARGIN - 2 * dialogPadding;
        let availHeight = logH - 2 * DIALOG_MARGIN - 2 * dialogPadding - px(BASE_HEADER_HEIGHT);

        if (reserveScrollbar) availWidth -= SCROLLBAR_WIDTH;

        // Once the cards have to shrink, allow wider rows instead of pushing
        // the grid further down the screen.
        let maxPerRow = Math.min(ABS_MAX_CARDS_PER_ROW,
                                 Math.max(MAX_CARDS_PER_ROW,
                                          Math.round(MAX_CARDS_PER_ROW / factor)));

        let perRow = Math.floor((availWidth + spacing) / (cardWidth + spacing));
        perRow = Math.max(1, Math.min(maxPerRow, perRow));

        let rows = 1;
        if (windowCount > 0) {
            perRow = Math.min(perRow, windowCount);
            rows = Math.ceil(windowCount / perRow);
            // Balance the grid so the last row is not nearly empty.
            perRow = Math.ceil(windowCount / rows);
        }

        let gridWidth = perRow * cardWidth + (perRow - 1) * spacing;
        let gridHeight = rows * cardHeight + (rows - 1) * spacing;

        return {
            factor: factor,
            cardsPerRow: perRow,
            cardWidth: cardWidth,
            cardHeight: cardHeight,
            cardPadding: cardPadding,
            cardSpacing: spacing,
            dialogPadding: dialogPadding,
            thumbHeight: px(BASE_THUMB_HEIGHT),
            thumbWidth: cardWidth - 2 * cardPadding,
            fallbackIconSize: px(BASE_FALLBACK_ICON),
            smallIconSize: px(BASE_SMALL_ICON, 16),
            headerFont: px(18, 14),
            subtitleFont: px(12, 11),
            appNameFont: px(13, 11),
            titleFont: px(11, 9),
            emptyFont: px(16, 14),
            gridHeight: gridHeight,
            availHeight: availHeight,
            fits: gridWidth <= availWidth && gridHeight <= availHeight
        };
    },

    // Physical pixel density of a monitor, or 0 when it cannot be determined.
    // Gdk knows the millimeter size of a monitor, Muffin does not expose it.
    _getMonitorDpi: function(monitor) {
        try {
            let Gdk = imports.gi.Gdk;
            let display = Gdk.Display.get_default();
            if (!display || typeof display.get_n_monitors !== "function") return 0;

            let sizeMatch = null;

            for (let i = 0; i < display.get_n_monitors(); i++) {
                let gdkMonitor = display.get_monitor(i);
                let geo = gdkMonitor.get_geometry();

                let scale = 1;
                try { scale = gdkMonitor.get_scale_factor() || 1; } catch(e) {}

                let width = geo.width * scale;
                let height = geo.height * scale;
                if (width !== monitor.width || height !== monitor.height) continue;

                let mmWidth = gdkMonitor.get_width_mm();
                if (!mmWidth || mmWidth < 20) continue;

                let dpi = width / (mmWidth / 25.4);

                // Prefer the monitor that also sits at the same position; fall
                // back to the first one that merely matches in size.
                if (geo.x * scale === monitor.x && geo.y * scale === monitor.y) return dpi;
                if (sizeMatch === null) sizeMatch = dpi;
            }

            if (sizeMatch !== null) return sizeMatch;
        } catch(e) {}

        return 0;
    },

    // Derives the scale factor from the monitor geometry. On HiDPI setups St
    // already scales CSS pixels by global.ui_scale, so we work in logical
    // pixels and only scale up what the higher resolution actually gains.
    _computeMetrics: function(monitor, windowCount) {
        let uiScale = 1;
        try {
            if (global.ui_scale > 0) uiScale = global.ui_scale;
        } catch(e) {}

        let logW = monitor.width / uiScale;
        let logH = monitor.height / uiScale;

        // Logical dpi, because St already scales CSS pixels by ui_scale — on a
        // HiDPI setup the density is therefore effectively already handled.
        let dpi = this._getMonitorDpi(monitor) / uiScale;
        let dpiBoost = 1;
        if (dpi > 0) {
            dpiBoost = Math.pow(dpi / REFERENCE_DPI, DPI_DAMPING);
            dpiBoost = Math.max(1, Math.min(MAX_DPI_BOOST, dpiBoost));
        }

        let factor = Math.min(logW / BASE_SCREEN_WIDTH, logH / BASE_SCREEN_HEIGHT) * dpiBoost;
        factor = Math.max(MIN_FACTOR, Math.min(MAX_FACTOR, factor));

        // Cards shrink at most to SHRINK_RATIO of their ideal size...
        let shrinkFloor = Math.max(SHRINK_FLOOR, factor * SHRINK_RATIO);

        let metrics = this._metricsForFactor(factor, logW, logH, windowCount, false);
        while (!metrics.fits && factor > shrinkFloor) {
            factor = Math.max(shrinkFloor, factor * 0.95);
            metrics = this._metricsForFactor(factor, logW, logH, windowCount, false);
        }

        // ...anything beyond that scrolls, which costs a bit of width.
        metrics.needsScroll = !metrics.fits;
        if (metrics.needsScroll) {
            metrics = this._metricsForFactor(factor, logW, logH, windowCount, true);
            metrics.needsScroll = true;
        }

        metrics.uiScale = uiScale;
        metrics.dpi = dpi;
        metrics.dpiBoost = dpiBoost;
        return metrics;
    },

    _openOverlay: function() {
        let monitor = this._getAppletMonitor();
        let self = this;
        let windows = this._getWindows();

        this._readyForInput = false;
        this._metrics = this._computeMetrics(monitor, windows.length);

        // --- Fullscreen dark backdrop (all monitors) ---
        let backdropRect = this._getBackdropRect();
        this._backdrop = new St.Bin({
            reactive: true,
            x: backdropRect.x,
            y: backdropRect.y,
            width: backdropRect.width,
            height: backdropRect.height,
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
                   "padding: " + this._metrics.dialogPadding + "px;"
        });
        this._monitor = monitor;

        // Header
        let header = new St.Label({
            text: _("Window Closer"),
            style: "font-size: " + this._metrics.headerFont + "px; font-weight: bold; " +
                   "color: rgba(255,255,255,0.9); padding-bottom: 6px;"
        });
        header.set_x_align(Clutter.ActorAlign.CENTER);
        this._dialog.add_child(header);

        let subtitle = new St.Label({
            text: this._metrics.needsScroll
                ? _("Click a window to close it \u00b7 Scroll for more \u00b7 Esc to exit")
                : _("Click a window to close it \u00b7 Esc to exit"),
            style: "font-size: " + this._metrics.subtitleFont + "px; " +
                   "color: rgba(255,255,255,0.45); padding-bottom: 20px;"
        });
        subtitle.set_x_align(Clutter.ActorAlign.CENTER);
        this._dialog.add_child(subtitle);

        // Card container
        this._cardContainer = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });

        this._pendingThumbs = [];
        this._buildCards(windows);

        if (this._metrics.needsScroll) {
            // Too many windows to show at a readable size: keep the cards big
            // and scroll the grid instead.
            this._scrollView = new St.ScrollView({
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.ALWAYS,
                x_expand: true,
                style: "height: " + this._metrics.availHeight + "px;"
            });
            this._scrollView.add_actor(this._cardContainer);
            this._dialog.add_child(this._scrollView);
        } else {
            this._dialog.add_child(this._cardContainer);
        }

        this._dialog.set_opacity(0);
        Main.layoutManager.addChrome(this._dialog);

        // Push modal to grab keyboard + pointer
        this._isModal = Main.pushModal(this._dialog);

        // Keys on the dialog (work because we have modal grab)
        this._dialog.connect("key-press-event", function(actor, event) {
            let symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                self._closeOverlay();
                return Clutter.EVENT_STOP;
            }

            if (self._scrollByKey(symbol)) return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        });

        // Center after layout is computed
        this._idleId = Mainloop.idle_add(function() {
            self._idleId = 0;
            if (!self._dialog) return GLib.SOURCE_REMOVE;

            // Thumbnails now know their real allocation
            for (let i = 0; i < self._pendingThumbs.length; i++) {
                try { self._fitCloneToBin(self._pendingThumbs[i]); } catch(e) {}
            }

            let dW = self._dialog.get_width();
            let dH = self._dialog.get_height();
            let m = self._monitor;
            // Clamp if too large
            let maxW = m.width - 2 * DIALOG_MARGIN;
            let maxH = m.height - 2 * DIALOG_MARGIN;
            if (dW > maxW) self._dialog.set_width(maxW);
            if (dH > maxH) self._dialog.set_height(maxH);
            dW = self._dialog.get_width();
            dH = self._dialog.get_height();
            self._dialog.set_position(
                m.x + Math.floor((m.width - dW) / 2),
                m.y + Math.floor((m.height - dH) / 2)
            );
            self._dialog.set_opacity(255);
            return GLib.SOURCE_REMOVE;
        });

        this._timeoutId = Mainloop.timeout_add(300, function() {
            self._timeoutId = 0;
            self._readyForInput = true;
            return GLib.SOURCE_REMOVE;
        });
    },

    // Keyboard scrolling as a fallback — the modal grab makes mouse wheel
    // events unreliable. Steps are derived from the page size so no pixel
    // unit conversion is needed.
    _scrollByKey: function(symbol) {
        if (!this._scrollView) return false;

        let adjustment;
        try {
            adjustment = this._scrollView.get_vscroll_bar().get_adjustment();
        } catch(e) {
            return false;
        }
        if (!adjustment) return false;

        let page = adjustment.page_size;
        let delta = 0;

        if (symbol === Clutter.KEY_Down) delta = page * 0.4;
        else if (symbol === Clutter.KEY_Up) delta = -page * 0.4;
        else if (symbol === Clutter.KEY_Page_Down || symbol === Clutter.KEY_space) delta = page;
        else if (symbol === Clutter.KEY_Page_Up) delta = -page;
        else if (symbol === Clutter.KEY_Home) delta = -adjustment.upper;
        else if (symbol === Clutter.KEY_End) delta = adjustment.upper;
        else return false;

        let max = Math.max(adjustment.lower, adjustment.upper - page);
        let value = Math.max(adjustment.lower, Math.min(max, adjustment.value + delta));
        adjustment.set_value(value);

        return true;
    },

    _buildCards: function(windows) {
        let self = this;
        let tracker = Cinnamon.WindowTracker.get_default();
        let metrics = this._metrics;

        this._cardContainer.destroy_all_children();

        if (windows.length === 0) {
            let emptyLabel = new St.Label({
                text: _("No windows open"),
                style: "font-size: " + metrics.emptyFont + "px; " +
                       "color: rgba(255,255,255,0.4); padding: 40px;"
            });
            emptyLabel.set_x_align(Clutter.ActorAlign.CENTER);
            this._cardContainer.add_child(emptyLabel);
            return;
        }

        let currentRow = null;
        let cardCount = 0;

        for (let i = 0; i < windows.length; i++) {
            if (cardCount % metrics.cardsPerRow === 0) {
                currentRow = new St.BoxLayout({
                    vertical: false,
                    x_align: Clutter.ActorAlign.CENTER,
                    x_expand: true,
                    style: "spacing: " + metrics.cardSpacing + "px; " +
                           "padding-bottom: " + metrics.cardSpacing + "px;"
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
        let metrics = this._metrics;
        let title = win.get_title();
        let appName = "";
        let app = null;

        try {
            app = tracker.get_window_app(win);
            if (app) appName = app.get_name() || "";
        } catch(e) {}

        let cardBase = "width: " + metrics.cardWidth + "px; " +
                       "height: " + metrics.cardHeight + "px; " +
                       "border-radius: 10px; " +
                       "padding: " + metrics.cardPadding + "px;";

        let normalStyle = cardBase +
                         "background-color: rgba(255,255,255,0.07); " +
                         "border: 1px solid rgba(255,255,255,0.1);";

        let hoverStyle = cardBase +
                        "background-color: rgba(231,76,60,0.35); " +
                        "border: 1px solid rgba(231,76,60,0.8);";

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
                    let clone = new Clutter.Clone({ source: actor });

                    // The bin size is given in CSS pixels (scaled by St on HiDPI),
                    // the clone lives in stage pixels — so the final clone size is
                    // computed from the real allocation once the layout is done.
                    let thumbBin = new St.Bin({
                        style: "background-color: rgba(0,0,0,0.3); border-radius: 6px; " +
                               "width: " + metrics.thumbWidth + "px; " +
                               "height: " + metrics.thumbHeight + "px;",
                        x_align: Clutter.ActorAlign.CENTER,
                        y_expand: true
                    });
                    thumbBin.set_clip_to_allocation(true);
                    thumbBin.set_child(clone);

                    let entry = { clone: clone, bin: thumbBin, winW: winW, winH: winH };
                    this._fitCloneToBin(entry);
                    this._pendingThumbs.push(entry);

                    cardBox.add_child(thumbBin);
                    thumbAdded = true;
                }
            }
        } catch(e) {}

        if (!thumbAdded) {
            let iconSize = metrics.fallbackIconSize;
            let iconBin = new St.Bin({
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                style: "padding: " + Math.round(20 * metrics.factor) + "px;"
            });
            if (app) {
                try { iconBin.set_child(app.create_icon_texture(iconSize)); } catch(e) {
                    iconBin.set_child(new St.Icon({ icon_name: "application-x-executable", icon_size: iconSize }));
                }
            } else {
                iconBin.set_child(new St.Icon({ icon_name: "application-x-executable", icon_size: iconSize }));
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
                let smallIcon = app.create_icon_texture(metrics.smallIconSize);
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
                style: "font-size: " + metrics.appNameFont + "px; font-weight: bold; " +
                       "color: rgba(255,255,255,0.9);"
            });
            if (nameLabel.clutter_text) nameLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            labelBox.add_child(nameLabel);
        }

        let titleLabel = new St.Label({
            text: title,
            style: "font-size: " + metrics.titleFont + "px; color: rgba(255,255,255,0.5);"
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
                    style: "font-size: " + metrics.emptyFont + "px; " +
                           "color: rgba(255,255,255,0.4); padding: 40px;"
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
        this._scrollView = null;
        if (this._backdrop) {
            Main.layoutManager.removeChrome(this._backdrop);
            this._backdrop.destroy();
            this._backdrop = null;
        }
        this._pendingThumbs = [];
        this._readyForInput = false;
    },

    on_applet_removed_from_panel: function() {
        this._closeOverlay();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new WindowCloserApplet(metadata, orientation, panelHeight, instanceId);
}
