const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const Main = imports.ui.main;

const BASE_UUID = "clipboard@chmodmasx";
let AppletUUID = BASE_UUID;

const Gettext = imports.gettext;
const MENU_MIN_WIDTH = 220;
const MENU_MAX_WIDTH = 720;
const MENU_DEFAULT_WIDTH = 320;
const MENU_DEFAULT_HEIGHT = 300;
const MENU_MIN_HISTORY_HEIGHT = 24;
const ITEM_HORIZONTAL_PADDING = 36;
function _(str) {
    Gettext.bindtextdomain(AppletUUID, GLib.get_user_data_dir() + "/locale");
    let translated = Gettext.dgettext(AppletUUID, str);
    if (translated !== str) {
        return translated;
    }
    return str;
}

/**
 * ClipboardApplet - Clipboard history manager for Cinnamon desktop environment
 * Tracks both clipboard and primary selection with configurable history size
 * Provides quick access to recent clipboard items via popup menu
 */
class ClipboardApplet extends Applet.IconApplet {
    /**
     * Constructor - Initialize the clipboard applet
     * @param {Object} metadata - Applet metadata (uuid, name, version, etc.)
     * @param {number} orientation - Panel orientation (0=horizontal, 1=vertical)
     * @param {number} panel_height - Height of the panel in pixels
     * @param {number} instance_id - Unique instance identifier for multiple applet instances
     */
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._metadata = metadata || {};
        this._appletUuid = metadata && metadata.uuid ? metadata.uuid : BASE_UUID;
        this._instanceId = instance_id;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_icon_symbolic_name("edit-paste");
        this.set_applet_tooltip(_("Clipboard history"));

        this._history = [];
        this._historySet = new Set();
        this._filterText = "";
        this._lastSetClipboardText = null;
        this._lastSetPrimaryText = null;
        this._lastObservedClipboardText = null;
        this._lastObservedPrimaryText = null;
        this._isInitializing = true;
        this._pollId = 0;

        this._initStorage();
        this._settings = new Settings.AppletSettings(this, this._appletUuid, instance_id);
        this._bindSettings();
        this._loadHistory();

        this._buildMenu(orientation);
        this._initClipboardMonitors();
        this._isInitializing = false;
        this._onSettingsChanged();
        this._rebuildHistoryList();
    }

    /**
     * Bind configuration settings to class properties
     * Automatically updates class properties when settings change
     * Triggers _onSettingsChanged callback for UI updates
     */
    _bindSettings() {
        this._settings.bind("history-size", "historySize", () => this._onSettingsChanged());
        this._settings.bind("ignore-duplicates", "ignoreDuplicates", () => this._onSettingsChanged());
        this._settings.bind("ignore-whitespace", "ignoreWhitespace", () => this._onSettingsChanged());
        this._settings.bind("persist-history", "persistHistory", () => this._onSettingsChanged());
        this._settings.bind("tracking-enabled", "trackingEnabled", () => this._onSettingsChanged());
        this._settings.bind("track-primary", "trackPrimary", () => this._onSettingsChanged());
        this._settings.bind("sync-primary", "syncPrimary", () => this._onSettingsChanged());
        this._settings.bind("show-search", "showSearch", () => this._onSettingsChanged());
        this._settings.bind("popup-width", "popupWidth", () => this._onSettingsChanged());
        this._settings.bind("poll-interval", "pollInterval", () => this._onSettingsChanged());
    }

    /**
     * Handle settings changes - Update UI and behavior based on new configuration
     * Rebuilds menu, updates tracking, adjusts polling interval
     * Skipped during initialization to avoid unnecessary updates
     */
    _onSettingsChanged() {
        if (this._isInitializing) {
            return;
        }
        this._updateMenuVisibility();
        this._applyMenuSize();
        this._updateTrackingSwitch();
        this._updatePrimaryTracking();
        this._updatePollingTimer();
        this._trimHistory();
        this._saveHistory();
        this._rebuildHistoryList();
    }

    /**
     * Initialize storage directory for applet data
     * Creates $XDG_DATA_HOME/cinnamon/clipboard@chmodmasx directory if needed
     * Stores history data in history.json
     */
    _initStorage() {
        let dataDir = GLib.build_filenamev([GLib.get_user_data_dir(), "cinnamon", this._appletUuid]);
        // Use Gio to avoid synchronous file_test stat call.
        let dataDirFile = Gio.File.new_for_path(dataDir);
        try {
            dataDirFile.make_directory_with_parents(null);
        } catch (e) {
            // EXISTS means the directory is already there — that is fine.
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                global.logError(e);
            }
        }
        this._historyPath = GLib.build_filenamev([dataDir, "history.json"]);
    }

    /**
     * Load clipboard history from persistent storage (JSON file)
     * Only loads if persist-history setting is enabled
     * Uses async Gio I/O to avoid blocking the main loop
     * Enforces current historySize limit immediately after loading
     */
    _loadHistory() {
        if (!this.persistHistory) {
            return;
        }
        let file = Gio.File.new_for_path(this._historyPath);
        file.load_contents_async(null, (_file, res) => {
            try {
                let [ok, contents] = _file.load_contents_finish(res);
                if (!ok) {
                    return;
                }
                let data = ByteArray.toString(contents);
                let parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this._history = parsed.filter(item => typeof item === "string");
                }
            } catch (e) {
                // NOT_FOUND is expected on first run — skip logging for it.
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    global.logError(e);
                }
                return;
            }
            // Enforce current size limit immediately, in case the user reduced
            // historySize since the last session.
            this._trimHistory();
            this._historySet = new Set(this._history);
            this._rebuildHistoryList();
        });
    }

    /**
     * Save clipboard history to persistent storage (JSON file)
     * Only saves if persist-history setting is enabled
     * Uses async Gio I/O to avoid blocking the main loop
     */
    _saveHistory() {
        if (!this.persistHistory) {
            return;
        }
        let data = JSON.stringify(this._history);
        // Encode to bytes for the async API.
        let bytes = new GLib.Bytes(new TextEncoder().encode(data));
        let file = Gio.File.new_for_path(this._historyPath);
        file.replace_contents_bytes_async(
            bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (_file, res) => {
                try {
                    _file.replace_contents_finish(res);
                } catch (e) {
                    global.logError(e);
                }
            }
        );
    }

    /**
     * Build the popup menu UI structure
     * Creates search box, history section, and action buttons
     * Sets up signal handlers for filtering and keyboard navigation
     * @param {number} orientation - Panel orientation (0=horizontal, 1=vertical)
     */
    _buildMenu(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._contentBox = new St.BoxLayout({ vertical: true, style_class: "clipboard-menu" });
        this.menu.addActor(this._contentBox);

        this._searchBox = new St.BoxLayout({
            style_class: "appmenu-search-box clipboard-search-box",
            vertical: false,
        });
        this._searchEntry = new St.Entry({
            name: "appmenu-search-entry",
            hint_text: _("Filter..."),
            track_hover: true,
            can_focus: true,
        });
        this._searchEntryText = this._searchEntry.clutter_text;
        this._searchEntryText.connect("text-changed", () => this._onSearchChanged());
        this._searchEntryText.connect("key-press-event", (actor, event) => this._onSearchKeyPress(event));

        this._searchInactiveIcon = new St.Icon({
            style_class: "appmenu-search-entry-icon",
            icon_name: "xsi-edit-find",
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchActiveIcon = new St.Icon({
            style_class: "appmenu-search-entry-icon",
            icon_name: "xsi-edit-clear",
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchIconClickedId = 0;
        this._searchEntry.set_secondary_icon(this._searchInactiveIcon);

        this._searchBox.add(this._searchEntry, {
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE,
            expand: true,
        });
        this._contentBox.add_actor(this._searchBox);

        this._itemsSection = new PopupMenu.PopupMenuSection();
        this._scrollView = new St.ScrollView({
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START,
            style_class: "vfade"
        });
        this._scrollView.add_actor(this._itemsSection.actor);
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._scrollView.set_clip_to_allocation(true);
        this._contentBox.add_actor(this._scrollView);
        this._itemsSection.actor.set_x_expand(true);
        this._itemsSection.actor.set_x_align(Clutter.ActorAlign.FILL);
        this._itemsSection.actor.set_clip_to_allocation(false);

        let vscroll = this._scrollView.get_vscroll_bar();
        vscroll.connect("scroll-start", () => {
            this.menu.passEvents = true;
        });
        vscroll.connect("scroll-stop", () => {
            this.menu.passEvents = false;
        });

        this._separatorItem = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._separatorItem);

        this._bottomSection = new PopupMenu.PopupMenuSection();

        this._clearHistoryItem = new PopupMenu.PopupMenuItem(_("Clear history"));
        this._clearHistoryItem.connect("activate", () => this._clearHistory());
        this._bottomSection.addMenuItem(this._clearHistoryItem);

        this._clearClipboardItem = new PopupMenu.PopupMenuItem(_("Clear clipboard"));
        this._clearClipboardItem.connect("activate", () => this._clearClipboard());
        this._bottomSection.addMenuItem(this._clearClipboardItem);

        this._trackingSwitch = new PopupMenu.PopupSwitchMenuItem(_("Tracking enabled"), true);
        this._trackingSwitch.connect("toggled", (item, state) => {
            this.trackingEnabled = state;
        });
        this._bottomSection.addMenuItem(this._trackingSwitch);

        this._settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this._settingsItem.connect("activate", () => this._openSettings());
        this._bottomSection.addMenuItem(this._settingsItem);

        this.menu.addMenuItem(this._bottomSection);

        this.menu.connect("open-state-changed", (menu, isOpen) => {
            if (isOpen && this.showSearch) {
                this._searchEntry.grab_key_focus();
                this._applyMenuSize();
            } else if (!isOpen) {
                this._clearFilter();
            }
        });

        this._updateMenuVisibility();
        this._applyMenuSize();
    }

    _updateMenuVisibility() {
        if (!this._searchBox) {
            return;
        }
        this._searchBox.visible = !!this.showSearch;
    }

    _applyMenuSize() {
        if (!this._contentBox || !this._scrollView || !this.menu) {
            return;
        }
        let width = this._getPopupWidth() * global.ui_scale;
        let height = this._getPopupHeight() * global.ui_scale;
        let minHeight = this._getMinMenuHeight();

        // Get the preferred height of the content and calculate what the total height should be
        let chromeHeight = this._getChromeHeight();
        let preferredContentHeight = this._getHistoryPreferredHeight();
        let preferredTotalHeight = chromeHeight + Math.max(preferredContentHeight, MENU_MIN_HISTORY_HEIGHT);

        // Use the preferred height if it's less than the configured height
        // This allows auto-growth while respecting the max configured size
        height = Math.max(minHeight, preferredTotalHeight);

        // Limit height to available screen space (respecting panels)
        let maxAvailableHeight = this._getMaxAvailableHeight();
        height = Math.min(height, maxAvailableHeight);

        this._setMenuSize(width, height);
    }

    _getMaxAvailableHeight() {
        // Get the monitor where the applet is located
        let monitorIndex = Main.layoutManager.primaryIndex;
        if (!Main.layoutManager.monitors || monitorIndex >= Main.layoutManager.monitors.length) {
            // Fallback to screen height if monitor info not available
            return global.screen_height;
        }

        let monitor = Main.layoutManager.monitors[monitorIndex];
        if (!monitor) {
            return global.screen_height;
        }

        // Calculate padding for panels
        let padding = { top: 0, bottom: 0 };
        try {
            let panels = Main.panelManager.getPanelsInMonitor(monitorIndex);
            for (let panel of panels) {
                if (!panel || panel._hidden || !panel.actor) {
                    continue;
                }

                let actor = panel.actor;
                let actorHeight = actor.height || actor.get_height();
                if (!actorHeight) {
                    continue;
                }

                // Check panel position and add to appropriate padding
                if (panel.panelPosition === 0) { // TOP
                    let topEdge = actor.y + actorHeight;
                    let inset = Math.max(0, topEdge - monitor.y);
                    padding.top = Math.max(padding.top, inset);
                } else if (panel.panelPosition === 1) { // BOTTOM
                    let inset = Math.max(0, monitor.y + monitor.height - actor.y);
                    padding.bottom = Math.max(padding.bottom, inset);
                }
            }
        } catch (e) {
            // If panel manager not available, just use monitor height
        }

        // Calculate available height
        let availableHeight = monitor.height - padding.top - padding.bottom;
        return Math.max(0, availableHeight);
    }

    _setMenuSize(width, height) {
        let chromeHeight = this._getChromeHeight();
        this._menuWidth = Math.round(width);
        this.menu.actor.set_width(this._menuWidth);
        let contentWidth = this._getContentWidth();
        let maxHistoryHeight = Math.max(0, height - chromeHeight);
        let itemsHeight = this._getHistoryPreferredHeight();
        let historyHeight = Math.min(maxHistoryHeight, Math.max(itemsHeight, MENU_MIN_HISTORY_HEIGHT));
        let menuHeight = Math.min(height, chromeHeight + historyHeight);
        this.menu.actor.set_height(Math.round(menuHeight));
        this.menu.actor.set_clip_to_allocation(true);
        if (this.menu._boxWrapper) {
            this.menu._boxWrapper.set_clip_to_allocation(true);
        }
        if (this.menu.box) {
            this.menu.box.set_clip_to_allocation(true);
        }
        this._contentBox.set_style(`min-width: ${contentWidth}px; max-width: ${contentWidth}px;`);
        if (this._searchBox) {
            this._searchBox.set_width(contentWidth);
        }
        if (this._searchEntry) {
            this._searchEntry.set_x_expand(false);
            this._searchEntry.set_x_align(Clutter.ActorAlign.START);
            let searchWidth = Math.max(0, contentWidth - this._getSearchEntryExtraWidth());
            this._searchEntry.set_width(searchWidth);
        }

        this._scrollView.set_style(`max-height: ${Math.round(historyHeight)}px;`);
        this._scrollView.set_height(Math.round(historyHeight));
        this._updateHistoryItemWidths();
    }

    _getPopupWidth() {
        let width = Number(this.popupWidth);
        if (!Number.isFinite(width) || width <= 0) {
            width = MENU_DEFAULT_WIDTH;
        }
        return Math.max(MENU_MIN_WIDTH, Math.min(MENU_MAX_WIDTH, width));
    }

    _getPopupHeight() {
        // Return the default height - vertical resizing is not allowed
        return MENU_DEFAULT_HEIGHT;
    }

    _getActorInsets(actor) {
        if (!actor || !actor.get_theme_node) {
            return { horizontal: 0, vertical: 0 };
        }
        let node = actor.get_theme_node();
        if (!node) {
            return { horizontal: 0, vertical: 0 };
        }
        let horizontal = 0;
        let vertical = 0;
        if (node.get_horizontal_padding) {
            horizontal += node.get_horizontal_padding();
        }
        if (node.get_vertical_padding) {
            vertical += node.get_vertical_padding();
        }
        if (node.get_border_width) {
            horizontal += node.get_border_width(St.Side.LEFT) + node.get_border_width(St.Side.RIGHT);
            vertical += node.get_border_width(St.Side.TOP) + node.get_border_width(St.Side.BOTTOM);
        }
        return { horizontal, vertical };
    }

    _getContentWidth() {
        if (!this._menuWidth) {
            return 0;
        }
        let insets = this.menu && this.menu.actor ? this._getActorInsets(this.menu.actor) : { horizontal: 0 };
        if (this.menu && this.menu.box) {
            let boxInsets = this._getActorInsets(this.menu.box);
            insets.horizontal += boxInsets.horizontal;
        }
        return Math.max(0, this._menuWidth - insets.horizontal);
    }

    _getSearchEntryExtraWidth() {
        let extra = 0;
        if (this._searchBox) {
            extra += this._getActorInsets(this._searchBox).horizontal;
        }
        if (this._searchEntry && this._searchEntry.get_theme_node) {
            let node = this._searchEntry.get_theme_node();
            if (node && node.get_margin) {
                extra += node.get_margin(St.Side.LEFT) + node.get_margin(St.Side.RIGHT);
            }
        }
        return extra;
    }

    _getChromeHeight() {
        let height = 0;
        if (this._searchBox) {
            height += this._searchBox.get_preferred_height(-1)[1];
        }
        if (this._separatorItem) {
            height += this._separatorItem.actor.get_preferred_height(-1)[1];
        }
        if (this._bottomSection) {
            height += this._bottomSection.actor.get_preferred_height(-1)[1];
        }
        if (this.menu) {
            if (this.menu.actor) {
                height += this._getActorInsets(this.menu.actor).vertical;
            }
            if (this.menu.box) {
                height += this._getActorInsets(this.menu.box).vertical;
            }
        }
        return height;
    }

    _getHistoryPreferredHeight() {
        if (!this._itemsSection) {
            return 0;
        }
        let width = this._menuWidth ? this._getContentWidth() : this._getPopupWidth() * global.ui_scale;
        let [, naturalHeight] = this._itemsSection.actor.get_preferred_height(width);
        return naturalHeight;
    }

    _getMinMenuHeight() {
        return this._getChromeHeight() + MENU_MIN_HISTORY_HEIGHT;
    }

    _updateHistoryItemWidths() {
        if (!this._itemsSection || !this._menuWidth) {
            return;
        }
        let contentWidth = this._getContentWidth();
        for (let child of this._itemsSection.actor.get_children()) {
            let item = child._delegate;
            if (item && item.label && item.label instanceof St.Label) {
                if (item.actor) {
                    item.actor.set_width(contentWidth);
                    item.actor.set_clip_to_allocation(true);
                }
                let padding = this._getActorInsets(item.actor).horizontal || ITEM_HORIZONTAL_PADDING;
                item.label.set_width(Math.max(0, contentWidth - padding));
                item.label.set_clip_to_allocation(true);
            }
        }
    }

    _updateTrackingSwitch() {
        if (this._trackingSwitch) {
            this._trackingSwitch.setToggleState(!!this.trackingEnabled);
        }
    }

    _initClipboardMonitors() {
        // Use St.Clipboard (the Cinnamon/Shell Toolkit clipboard) instead of the
        // older legacy clipboard and display APIs.
        this._clipboard = St.Clipboard.get_default();
        if (!this._clipboard) {
            global.logWarning("[clipboard@chmodmasx] St.Clipboard not available.");
            return;
        }
        // Without the legacy owner-change signal, clipboard monitoring is
        // handled entirely through the polling timer.
        this._updatePollingTimer();
    }

    // St.Clipboard does not expose an owner-change signal, so primary-selection
    // tracking is controlled solely by the polling timer (see _startPolling).
    _updatePrimaryTracking() {
        // No-op: primary tracking on/off is handled by the polling loop.
    }

    _onClipboardText(source, text) {
        if (!this.trackingEnabled) {
            return;
        }
        if (source === "primary") {
            if (text === this._lastObservedPrimaryText) {
                return;
            }
            this._lastObservedPrimaryText = text;
        } else {
            if (text === this._lastObservedClipboardText) {
                return;
            }
            this._lastObservedClipboardText = text;
        }
        this._maybeStoreText(text, source);
    }

    _maybeStoreText(text, source) {
        if (text === null || text === undefined) {
            return;
        }
        if (this.ignoreWhitespace && text.trim().length === 0) {
            return;
        }
        if (this._shouldIgnoreSetText(text, source)) {
            return;
        }
        if (this.ignoreDuplicates) {
            // O(1) duplicate check using Set instead of Array.indexOf (O(n)).
            // Move existing item to the front by removing it first.
            if (this._historySet.has(text)) {
                let existingIndex = this._history.indexOf(text);
                if (existingIndex !== -1) {
                    this._history.splice(existingIndex, 1);
                }
                this._historySet.delete(text);
            }
        }
        this._history.unshift(text);
        this._historySet.add(text);
        this._trimHistory();
        this._saveHistory();
        this._rebuildHistoryList();
    }

    _shouldIgnoreSetText(text, source) {
        if (source === "primary" && this._lastSetPrimaryText === text) {
            this._lastSetPrimaryText = null;
            return true;
        }
        if (source === "clipboard" && this._lastSetClipboardText === text) {
            this._lastSetClipboardText = null;
            return true;
        }
        return false;
    }

    /**
     * Update polling timer based on tracking settings
     * Adjusts poll frequency or stops polling if tracking disabled
     * Avoids restarting if interval hasn't changed
     */
    _updatePollingTimer() {
        if (!this.trackingEnabled) {
            this._stopPolling();
            return;
        }
        let interval = Math.max(1, Number(this.pollInterval) || 1);
        if (this._pollIntervalSeconds === interval && this._pollId) {
            return;
        }
        this._pollIntervalSeconds = interval;
        this._startPolling();
    }

    /**
     * Start clipboard polling with configured interval
     * Polls both clipboard and primary selection if track-primary enabled
     * Sets Mainloop timer and performs immediate poll
     */
    _startPolling() {
        this._stopPolling();
        this._pollId = Mainloop.timeout_add_seconds(this._pollIntervalSeconds, () => {
            this._pollClipboard("clipboard");
            if (this.trackPrimary) {
                this._pollClipboard("primary");
            }
            return true;
        });
        this._pollClipboard("clipboard");
        if (this.trackPrimary) {
            this._pollClipboard("primary");
        }
    }

    /**
     * Stop the polling timer
     * Removes Mainloop timeout to prevent memory leaks
     * Safe to call even if polling isn't active
     */
    _stopPolling() {
        if (this._pollId) {
            Mainloop.source_remove(this._pollId);
            this._pollId = 0;
        }
    }

    /**
     * Poll clipboard or primary selection for new content
     * Adds new unique items to history, respects ignore settings
     * Updates menu UI if content changed
     * @param {string} source - 'clipboard' or 'primary' selection
     */
    _pollClipboard(source) {
        if (!this.trackingEnabled || !this._clipboard) {
            return;
        }
        let type = source === "primary"
            ? St.ClipboardType.PRIMARY
            : St.ClipboardType.CLIPBOARD;
        this._clipboard.get_text(type, (_clip, text) => {
            this._onClipboardText(source, text);
        });
    }

    _trimHistory() {
        let max = Math.max(1, Number(this.historySize) || 50);
        if (this._history.length > max) {
            // Remove trimmed items from the Set to keep both in sync.
            let removed = this._history.splice(max);
            for (let item of removed) {
                this._historySet.delete(item);
            }
        }
    }

    /**
     * Clear all clipboard history
     * Empties the history array and clears persistent storage file (saves empty history)
     * Immediately updates menu UI to show empty state
     */
    _clearHistory() {
        this._history = [];
        this._historySet = new Set();
        this._saveHistory();
        this._rebuildHistoryList();
    }

    _clearClipboard() {
        this._setClipboardText("");
    }

    _openSettings() {
        this.menu.close();
        let uuid = this._appletUuid || this._uuid || BASE_UUID;
        // Ensure the settings config file exists, then spawn the settings window.
        // shell_string_spawn: use argv array instead of a shell command string.
        this._ensureSettingsFile(uuid, () => {
            try {
                Util.spawn(["xlet-settings", "applet", uuid, "-i", String(this._instanceId)]);
            } catch (e) {
                global.logError(e);
            }
        });
    }

    /**
     * Ensure the Cinnamon settings JSON file exists for this applet instance.
     * Fully async: uses Gio file I/O to avoid blocking the main loop.
     * @param {string} uuid  - Applet UUID
     * @param {Function} onDone - Callback invoked when the file is ready (or already existed)
     */
    _ensureSettingsFile(uuid, onDone) {
        let configDir = GLib.build_filenamev([GLib.get_user_config_dir(), "cinnamon", "spices", uuid]);
        let configPath = GLib.build_filenamev([configDir, `${uuid}.json`]);
        let configFile = Gio.File.new_for_path(configPath);

        // Check whether the config file already exists (async stat).
        configFile.query_info_async(
            "standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (_f, res) => {
                try {
                    _f.query_info_finish(res);
                    // File exists — nothing to do, just invoke the callback.
                    if (onDone) onDone();
                    return;
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                        global.logError(e);
                        if (onDone) onDone();
                        return;
                    }
                    // NOT_FOUND is expected — we need to create the file.
                }

                // Ensure parent config directory exists.
                let configDirFile = Gio.File.new_for_path(configDir);
                try {
                    configDirFile.make_directory_with_parents(null);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                        global.logError(e);
                        if (onDone) onDone();
                        return;
                    }
                }

                // Locate the settings-schema.json (user install first, then system).
                // hardcoded_data_dir: use GLib.get_user_data_dir() instead of get_home_dir().
                let userSchemaPath = GLib.build_filenamev([GLib.get_user_data_dir(), "cinnamon/applets", uuid, "settings-schema.json"]);
                let userSchemaFile = Gio.File.new_for_path(userSchemaPath);

                userSchemaFile.query_info_async(
                    "standard::type",
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (_f1, res1) => {
                        let schemaFileToUse = null;
                        try {
                            _f1.query_info_finish(res1);
                            schemaFileToUse = userSchemaFile;
                        } catch (e1) {
                            if (!e1.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                                global.logError(e1);
                            }
                        }

                        if (schemaFileToUse) {
                            this._loadSchemaAndWriteSettings(schemaFileToUse, configFile, uuid, onDone);
                        } else {
                            // Try system path
                            let sysSchemaPath = GLib.build_filenamev(["/usr/share/cinnamon/applets", uuid, "settings-schema.json"]);
                            let sysSchemaFile = Gio.File.new_for_path(sysSchemaPath);

                            sysSchemaFile.query_info_async(
                                "standard::type",
                                Gio.FileQueryInfoFlags.NONE,
                                GLib.PRIORITY_DEFAULT,
                                null,
                                (_f2, res2) => {
                                    try {
                                        _f2.query_info_finish(res2);
                                        schemaFileToUse = sysSchemaFile;
                                    } catch (e2) {
                                        if (!e2.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                                            global.logError(e2);
                                        }
                                    }

                                    if (schemaFileToUse) {
                                        this._loadSchemaAndWriteSettings(schemaFileToUse, configFile, uuid, onDone);
                                    } else {
                                        global.logWarning(`[${uuid}] settings-schema.json not found; cannot create settings file.`);
                                        if (onDone) onDone();
                                    }
                                }
                            );
                        }
                    }
                );
            }
        );
    }

    _loadSchemaAndWriteSettings(schemaFile, configFile, uuid, onDone) {
        // Read the schema file asynchronously.
        schemaFile.load_contents_async(null, (_sf, schemaRes) => {
            try {
                let [ok, contents] = _sf.load_contents_finish(schemaRes);
                if (!ok) {
                    if (onDone) onDone();
                    return;
                }
                let schemaText = ByteArray.toString(contents);
                let schemaData = JSON.parse(schemaText);
                let settingsData = JSON.parse(JSON.stringify(schemaData));
                for (let key in settingsData) {
                    let entry = settingsData[key];
                    if (entry && typeof entry === "object" && entry.default !== undefined) {
                        entry.value = entry.default;
                    }
                }
                if (global.get_md5_for_string) {
                    settingsData.__md5__ = global.get_md5_for_string(schemaText);
                }
                let output = JSON.stringify(settingsData, null, 4);
                let bytes = new GLib.Bytes(new TextEncoder().encode(output));

                // Write the settings file asynchronously.
                configFile.replace_contents_bytes_async(
                    bytes, null, false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null,
                    (_cf, writeRes) => {
                        try {
                            _cf.replace_contents_finish(writeRes);
                        } catch (writeErr) {
                            global.logError(writeErr);
                        }
                        if (onDone) onDone();
                    }
                );
            } catch (parseErr) {
                global.logError(parseErr);
                if (onDone) onDone();
            }
        });
    }

    _setClipboardText(text) {
        if (!this._clipboard) {
            return;
        }
        this._lastSetClipboardText = text;
        this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        if (this.syncPrimary) {
            this._lastSetPrimaryText = text;
            this._clipboard.set_text(St.ClipboardType.PRIMARY, text);
        }
    }

    _onSearchChanged() {
        this._filterText = this._searchEntry.get_text();
        this._updateSearchIcon();
        this._rebuildHistoryList();
    }

    _onSearchKeyPress(event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape) {
            this._clearFilter();
            this.menu.close();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _clearFilter() {
        this._filterText = "";
        if (this._searchEntry) {
            this._searchEntry.set_text("");
        }
        this._updateSearchIcon();
    }

    _updateSearchIcon() {
        if (!this._searchEntry || !this._searchInactiveIcon || !this._searchActiveIcon) {
            return;
        }
        let hasText = this._searchEntry.get_text().length > 0;
        let icon = hasText ? this._searchActiveIcon : this._searchInactiveIcon;
        this._searchEntry.set_secondary_icon(icon);

        if (hasText && !this._searchIconClickedId) {
            this._searchIconClickedId = this._searchEntry.connect("secondary-icon-clicked", () => {
                this._clearFilter();
                this._searchEntry.grab_key_focus();
            });
        } else if (!hasText && this._searchIconClickedId) {
            this._searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
        }
    }

    _formatLabel(text) {
        let normalized = text.replace(/\s+/g, " ").trim();
        return normalized.length > 0 ? normalized : _("(empty)");
    }

    _rebuildHistoryList() {
        if (!this._itemsSection) {
            return;
        }
        this._itemsSection.removeAll();

        let filter = (this._filterText || "").toLowerCase();
        let hadItems = false;

        for (let i = 0; i < this._history.length; i++) {
            let text = this._history[i];
            if (filter && !text.toLowerCase().includes(filter)) {
                continue;
            }
            hadItems = true;
            let labelText = this._formatLabel(text);
            let item = new PopupMenu.PopupBaseMenuItem();
            let label = new St.Label({ text: labelText, style_class: "clipboard-history-item" });
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            label.clutter_text.line_wrap = false;
            label.set_clip_to_allocation(true);
            label.set_x_expand(true);
            label.set_x_align(Clutter.ActorAlign.START);
            item.addActor(label, { expand: true, span: -1, align: St.Align.START });
            item.label = label;
            item.actor.set_x_expand(true);
            item.actor.set_x_align(Clutter.ActorAlign.FILL);
            item.actor.set_clip_to_allocation(true);
            item.connect("activate", () => {
                this._activateHistoryItem(i);
            });
            item.actor.connect("button-press-event", (actor, event) => {
                if (event.get_button && event.get_button() === 2) {
                    this._removeHistoryAt(i);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            this._itemsSection.addMenuItem(item);
        }

        if (!hadItems) {
            let emptyItem = new PopupMenu.PopupMenuItem(_("No items"), { reactive: false });
            emptyItem.actor.add_style_class_name("clipboard-history-empty");
            emptyItem.actor.set_x_expand(true);
            emptyItem.actor.set_x_align(Clutter.ActorAlign.FILL);
            emptyItem.actor.set_clip_to_allocation(true);
            if (emptyItem.label) {
                emptyItem.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
                emptyItem.label.set_clip_to_allocation(true);
            }
            this._itemsSection.addMenuItem(emptyItem);
        }
        this._applyMenuSize();
    }

    /**
     * Handle history item activation (left-click)
     * Sets selected item to clipboard and moves to top of history
     * Closes menu after selection
     * @param {number} index - Index in history array
     */
    _activateHistoryItem(index) {
        let text = this._history[index];
        if (text === undefined) {
            return;
        }
        this._setClipboardText(text);
        // Move activated item to the top of the history (most-recent first).
        // The Set doesn't need to change since the item remains in history.
        if (this.ignoreDuplicates && index > 0) {
            this._history.splice(index, 1);
            this._history.unshift(text);
            this._saveHistory();
            this._rebuildHistoryList();
        }
        this.menu.close();
    }

    /**
     * Remove history item at specified index (middle-click)
     * Saves updated history and rebuilds menu UI
     * Silently ignores invalid indices
     * @param {number} index - Index in history array to remove
     */
    _removeHistoryAt(index) {
        if (index < 0 || index >= this._history.length) {
            return;
        }
        let [removed] = this._history.splice(index, 1);
        this._historySet.delete(removed);
        this._saveHistory();
        this._rebuildHistoryList();
    }

    /**
     * Handle panel icon click - Toggle popup menu visibility
     * Cinnamon calls this when user clicks applet icon
     */
    on_applet_clicked() {
        this.menu.toggle();
    }

    /**
     * Cleanup when applet is removed from panel
     * Disconnects all signal handlers, stops polling timer
     * Saves history and finalizes settings
     * CRITICAL: Prevents memory leaks and orphaned file handles
     */
    on_applet_removed_from_panel() {
        // St.Clipboard is a singleton managed by the shell — no disconnection needed.
        this._stopPolling();
        this._saveHistory();
        this._settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    if (metadata && metadata.uuid) {
        AppletUUID = metadata.uuid;
    }
    return new ClipboardApplet(metadata, orientation, panel_height, instance_id);
}
