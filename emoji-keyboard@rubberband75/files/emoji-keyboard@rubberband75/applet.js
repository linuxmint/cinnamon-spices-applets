/*
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Emoji Keyboard - a Cinnamon panel applet.
 */

const Applet = imports.ui.applet;
const ByteArray = imports.byteArray;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;

const UUID = "emoji-keyboard@rubberband75";
const COLUMN_COUNT = 8;
const INITIAL_BATCH_SIZE = 160;
const NEXT_BATCH_SIZE = 80;
const MAX_RECENT_EMOJI = 80;
const PASTE_DELAY_MS = 100;
const CLIPBOARD_RESTORE_DELAY_MS = 150;
const DEFAULT_EMOJI_SIZE = 24;
const CELL_PADDING = 4;
const EMOJI_FONT_EXTENT_RATIO = 1.25;
const EMOJI_GAP = 2;
const MIN_POPUP_WIDTH = 280;
const GRID_LEFT_PADDING = 4;
const POPUP_HORIZONTAL_PADDING = 5;
const SCROLLBAR_ALLOWANCE = 20;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function n_(singular, plural, number) {
    return Gettext.dngettext(UUID, singular, plural, number);
}

const CATEGORIES = [
    { key: "recent", label: _("Recent") },
    { key: "smileys", label: _("Smileys & Emotions") },
    { key: "people", label: _("People") },
    { key: "nature", label: _("Animals & Nature") },
    { key: "food", label: _("Food & Drink") },
    { key: "travel", label: _("Travel & Places") },
    { key: "activities", label: _("Activities & Events") },
    { key: "objects", label: _("Objects") },
    { key: "symbols", label: _("Symbols") },
    { key: "flags", label: _("Flags") },
];

// CLDR emoji names encode skin tone as one or two trailing ", <tone>"
// segments, e.g. "waving hand: light skin tone" or "handshake: light skin
// tone, dark skin tone". Stripping recognized tone segments off the end
// leaves a base name shared by every tone variant of the same emoji.
const SKIN_TONES = [
    "light skin tone",
    "medium light skin tone",
    "medium skin tone",
    "medium dark skin tone",
    "dark skin tone",
];
const SKIN_TONE_SET = new Set(SKIN_TONES);

function parseSkinToneVariant(name) {
    let colonIndex = name.indexOf(": ");
    if (colonIndex === -1)
        return { base: name, tones: [] };

    let base = name.slice(0, colonIndex);
    let tokens = name.slice(colonIndex + 2).split(", ");
    let tones = [];
    let index = 0;
    while (index < tokens.length && SKIN_TONE_SET.has(tokens[index])) {
        tones.push(tokens[index]);
        index++;
    }
    if (index < tokens.length)
        base += ": " + tokens.slice(index).join(", ");

    return { base, tones };
}

class EmojiKeyboardApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._destroyed = false;
        this._emoji = [];
        this._emojiByCharacter = new Map();
        this._emojiByCategory = new Map();
        this._skinToneVariantByCharacter = new Map();
        this._skinToneVariantBases = new Set();
        this._filteredEmoji = [];
        this._renderedCount = 0;
        this._renderIdleId = 0;
        this._pasteTimeoutId = 0;
        this._clipboardRestoreTimeoutId = 0;
        this._popupIconSizeSignalId = 0;
        this._gridRows = [];
        this._categoryButtons = new Map();
        this._categoryIcons = [];
        this._currentCategory = "smileys";

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("recent-emoji", "recentEmoji");
        this.settings.bind("copy-to-clipboard", "copyToClipboard");
        this.settings.bind(
            "emoji-size", "emojiSizePref", () => this._syncPopupIconSizes()
        );
        this.settings.bind(
            "category-icon-size", "categoryIconSizePref",
            () => this._syncPopupIconSizes()
        );
        this.settings.bind(
            "default-skin-tone", "defaultSkinTone",
            () => this._refreshFilteredView()
        );

        this._emojiGlyphSize = this._resolveConfiguredSize(this.emojiSizePref);
        this._emojiCellSize = this._getEmojiCellSize();
        this._categoryIconSize = this._resolveConfiguredSize(
            this.categoryIconSizePref
        );
        this._categoryCellSize = this._getCategoryCellSize();

        let seat = Clutter.get_default_backend().get_default_seat();
        this._virtualKeyboard = seat.create_virtual_device(
            Clutter.InputDeviceType.KEYBOARD_DEVICE
        );

        this.set_applet_icon_symbolic_path(
            metadata.path + "/icons/icon-symbolic.svg"
        );
        this.set_applet_tooltip(_("Emoji Keyboard"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.actor.add_style_class_name("emoji-keyboard-popup");
        this.menuManager.addMenu(this.menu);

        this._buildMenu();
        this._loadEmoji();
    }

    _buildMenu() {
        this._container = new St.BoxLayout({
            vertical: true,
            style_class: "emoji-keyboard",
        });
        this.menu.addActor(this._container);

        this._searchIcon = new St.Icon({
            icon_name: "xsi-edit-find",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "appmenu-search-entry-icon",
        });
        this._searchEntry = new St.Entry({
            can_focus: true,
            hint_text: _("Search emoji"),
            name: "appmenu-search-entry",
            style_class: "emoji-search-entry",
            track_hover: true,
        });
        this._searchEntry.set_primary_icon(this._searchIcon);
        this._searchEntry.clutter_text.connect(
            "text-changed",
            () => this._onSearchChanged()
        );
        this._container.add_child(this._searchEntry);

        this._categoryBox = new St.BoxLayout({
            style_class: "emoji-category-box",
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._container.add_child(this._categoryBox);

        for (let category of CATEGORIES) {
            let button = new St.Button({
                can_focus: true,
                height: this._categoryCellSize,
                reactive: true,
                track_hover: true,
                style_class: "emoji-category-button",
                width: this._categoryCellSize,
                accessible_name: category.label,
            });
            let icon = this._createCategoryIcon(category.key);
            button.set_child(icon);
            this._styleCategoryButton(button);
            button.connect("clicked", () => this._selectCategory(category.key));
            this._categoryBox.add_child(button);
            this._categoryButtons.set(category.key, button);
            this._categoryIcons.push(icon);
            new Tooltips.Tooltip(button, category.label);
        }

        this._heading = new St.Label({
            text: _("Loading emoji…"),
            style_class: "emoji-category-heading",
        });
        this._container.add_child(this._heading);

        this._scrollView = new St.ScrollView({
            height: 352,
            style_class: "emoji-scroll-view",
            x_fill: true,
            y_fill: true,
        });
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._scrollView.set_auto_scrolling(true);
        this._container.add_child(this._scrollView);

        // St.ScrollView accepts St.Scrollable children such as St.BoxLayout.
        // A plain St.Widget with Clutter.GridLayout is silently rejected and
        // leaves the viewport empty, so the eight-column grid uses box rows.
        this._grid = new St.BoxLayout({
            vertical: true,
            style_class: "emoji-grid",
            x_expand: true,
        });
        this._scrollView.add_actor(this._grid);

        this._scrollAdjustment = this._scrollView
            .get_vscroll_bar()
            .get_adjustment();
        this._scrollSignalId = this._scrollAdjustment.connect(
            "notify::value",
            () => this._onScrolled()
        );

        this.menu.connect("open-state-changed", (menu, isOpen) => {
            if (isOpen) {
                this._syncPopupIconSizes();
                if (this._searchEntry.get_text() === "")
                    this._selectCategory(this._currentCategory);
                else
                    this._searchEntry.set_text("");
                this._searchEntry.grab_key_focus();
            }
        });

        this._updatePopupDimensions();
    }

    _resolveConfiguredSize(sizePref) {
        switch (sizePref) {
        case "match-colored":
            return this._getPanelIconSize(St.IconType.FULLCOLOR);
        case "match-symbolic":
            return this._getPanelIconSize(St.IconType.SYMBOLIC);
        default:
            return parseInt(sizePref, 10) || DEFAULT_EMOJI_SIZE;
        }
    }

    _getPanelIconSize(iconType) {
        if (!this.panel)
            return DEFAULT_EMOJI_SIZE;

        return this.panel.getPanelZoneIconSize(
            this.locationLabel,
            iconType
        ) || DEFAULT_EMOJI_SIZE;
    }

    _createCategoryIcon(key) {
        let file = Gio.File.new_for_path(
            this._metadata.path + "/icons/" + key + "-symbolic.svg"
        );
        return new St.Icon({
            gicon: new Gio.FileIcon({ file }),
            icon_size: this._categoryIconSize,
            icon_type: St.IconType.SYMBOLIC,
            style_class: "emoji-category-icon",
        });
    }

    _createEmojiGlyph(character) {
        let label = new St.Label({
            text: character,
            style_class: "emoji-glyph",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        label.set_style("font-size: " + this._emojiGlyphSize + "px;");
        return label;
    }

    _getEmojiCellSize() {
        // Noto Color Emoji's natural actor extent is approximately 1.25
        // times its CSS font size. Account for that before adding the margin
        // so St.Label does not replace a clipped emoji with an ellipsis.
        return Math.ceil(this._emojiGlyphSize * EMOJI_FONT_EXTENT_RATIO) +
            2 * CELL_PADDING;
    }

    _getCategoryCellSize() {
        return this._categoryIconSize + 2 * CELL_PADDING;
    }

    _styleCategoryButton(button) {
        button.set_style(
            "border-radius: " + Math.ceil(this._categoryCellSize / 2) + "px;"
        );
    }

    _syncPopupIconSizes() {
        let emojiSize = this._resolveConfiguredSize(this.emojiSizePref);
        let categoryIconSize = this._resolveConfiguredSize(
            this.categoryIconSizePref
        );
        let emojiChanged = emojiSize !== this._emojiGlyphSize;
        let categoryChanged = categoryIconSize !== this._categoryIconSize;
        if (!emojiChanged && !categoryChanged)
            return;

        if (emojiChanged) {
            this._emojiGlyphSize = emojiSize;
            this._emojiCellSize = this._getEmojiCellSize();
        }

        if (categoryChanged) {
            this._categoryIconSize = categoryIconSize;
            this._categoryCellSize = this._getCategoryCellSize();
            for (let button of this._categoryButtons.values()) {
                button.set_size(
                    this._categoryCellSize,
                    this._categoryCellSize
                );
                this._styleCategoryButton(button);
            }
            for (let icon of this._categoryIcons)
                icon.set_icon_size(categoryIconSize);
        }

        this._updatePopupDimensions();
        if (emojiChanged && this._emoji.length > 0)
            this._resetGrid();
    }

    _updatePopupDimensions() {
        if (!this._container || !this._scrollView)
            return;

        let categoryWidth =
            CATEGORIES.length * this._categoryCellSize +
            (CATEGORIES.length - 1) * EMOJI_GAP;
        let gridWidth =
            COLUMN_COUNT * this._emojiCellSize +
            (COLUMN_COUNT - 1) * EMOJI_GAP +
            GRID_LEFT_PADDING +
            SCROLLBAR_ALLOWANCE;
        let popupWidth = Math.max(
            MIN_POPUP_WIDTH,
            categoryWidth + POPUP_HORIZONTAL_PADDING,
            gridWidth + POPUP_HORIZONTAL_PADDING
        );

        this._container.set_width(popupWidth);
        this._scrollView.set_width(
            popupWidth - POPUP_HORIZONTAL_PADDING
        );
    }

    _loadEmoji() {
        this._loadCancellable = new Gio.Cancellable();
        let file = Gio.File.new_for_path(this._metadata.path + "/emoji.json");

        file.load_contents_async(this._loadCancellable, (source, result) => {
            if (this._destroyed)
                return;

            try {
                let [success, contents] = source.load_contents_finish(result);
                if (!success)
                    throw new Error("The emoji catalog could not be read");

                let data = JSON.parse(ByteArray.toString(contents));
                this._emoji = data.emoji;

                for (let category of CATEGORIES) {
                    if (category.key !== "recent")
                        this._emojiByCategory.set(category.key, []);
                }

                let toneVariantCounts = new Map();
                for (let item of this._emoji) {
                    this._emojiByCharacter.set(item[0], item);
                    if (this._emojiByCategory.has(item[2]))
                        this._emojiByCategory.get(item[2]).push(item);

                    let variant = parseSkinToneVariant(item[1]);
                    this._skinToneVariantByCharacter.set(item[0], variant);
                    if (variant.tones.length > 0) {
                        toneVariantCounts.set(
                            variant.base,
                            (toneVariantCounts.get(variant.base) || 0) + 1
                        );
                    }
                }
                this._skinToneVariantBases = new Set(toneVariantCounts.keys());

                this._selectCategory(this._currentCategory);
            } catch (error) {
                if (!this._loadCancellable.is_cancelled()) {
                    global.logError(error, UUID);
                    this._heading.set_text(_("Unable to load the emoji catalog"));
                }
            }
        });
    }

    _selectCategory(key) {
        if (this._emoji.length === 0)
            return;

        this._currentCategory = key;
        if (this._searchEntry.get_text() !== "") {
            this._searchEntry.set_text("");
            return;
        }

        for (let [buttonKey, button] of this._categoryButtons) {
            button.change_style_pseudo_class("active", buttonKey === key);
        }

        let category = CATEGORIES.find(item => item.key === key);
        this._heading.set_text(category.label);
        this._filteredEmoji = key === "recent"
            ? this._getRecentEmoji()
            : this._emojiByCategory.get(key)
                .filter(item => this._matchesSkinTonePref(item));
        this._resetGrid();
    }

    _matchesSkinTonePref(item) {
        let variant = this._skinToneVariantByCharacter.get(item[0]);
        if (!this._skinToneVariantBases.has(variant.base))
            return true;

        // Two-person gestures can mix different tones per hand (e.g.
        // "handshake: light skin tone, dark skin tone"). A single default
        // tone can't address those, so they're left out of browse/search.
        if (variant.tones.length > 1)
            return false;

        if (this.defaultSkinTone === "")
            return variant.tones.length === 0;

        return variant.tones.length === 1 &&
            variant.tones[0] === this.defaultSkinTone;
    }

    _refreshFilteredView() {
        if (this._emoji.length === 0)
            return;

        if (this._searchEntry.get_text() !== "")
            this._onSearchChanged();
        else
            this._selectCategory(this._currentCategory);
    }

    _onSearchChanged() {
        if (this._emoji.length === 0)
            return;

        let query = this._searchEntry.get_text().trim().toLowerCase();
        if (query === "") {
            this._selectCategory(this._currentCategory);
            return;
        }

        for (let button of this._categoryButtons.values())
            button.remove_style_pseudo_class("active");

        let terms = query.split(/\s+/);
        this._filteredEmoji = this._emoji.filter(item =>
            this._matchesSkinTonePref(item) &&
            terms.every(term => item[3].includes(term))
        );
        let resultCount = this._filteredEmoji.length;
        this._heading.set_text(
            n_("%d search result", "%d search results", resultCount)
                .format(resultCount)
        );
        this._resetGrid();
    }

    _getRecentEmoji() {
        let result = [];
        for (let character of this.recentEmoji || []) {
            let item = this._emojiByCharacter.get(character);
            if (item)
                result.push(item);
        }
        return result;
    }

    _resetGrid() {
        this._cancelRender();
        this._grid.remove_all_children();
        this._gridRows = [];
        this._renderedCount = 0;
        this._scrollAdjustment.set_value(0);

        if (this._filteredEmoji.length === 0) {
            let emptyLabel = new St.Label({
                text: this._currentCategory === "recent" &&
                    this._searchEntry.get_text() === ""
                    ? _("Your recently used emoji will appear here")
                    : _("No emoji found"),
                style_class: "emoji-empty-label",
            });
            this._grid.add_child(emptyLabel);
            return;
        }

        this._appendBatch(INITIAL_BATCH_SIZE);
    }

    _onScrolled() {
        if (this._renderedCount >= this._filteredEmoji.length)
            return;

        let value = this._scrollAdjustment.value;
        let upper = this._scrollAdjustment.upper;
        let pageSize = this._scrollAdjustment.page_size;
        if (value + pageSize >= upper - pageSize)
            this._scheduleNextBatch();
    }

    _scheduleNextBatch() {
        if (this._renderIdleId !== 0)
            return;

        this._renderIdleId = Mainloop.idle_add(() => {
            this._renderIdleId = 0;
            if (!this._destroyed)
                this._appendBatch(NEXT_BATCH_SIZE);
            return GLib.SOURCE_REMOVE;
        });
    }

    _appendBatch(batchSize) {
        let end = Math.min(
            this._renderedCount + batchSize,
            this._filteredEmoji.length
        );

        for (let index = this._renderedCount; index < end; index++) {
            let item = this._filteredEmoji[index];
            let rowIndex = Math.floor(index / COLUMN_COUNT);
            let row = this._gridRows[rowIndex];
            if (!row) {
                row = new St.BoxLayout({
                    style_class: "emoji-row",
                    x_align: Clutter.ActorAlign.START,
                });
                this._grid.add_child(row);
                this._gridRows[rowIndex] = row;
            }

            let button = new St.Button({
                can_focus: true,
                height: this._emojiCellSize,
                reactive: true,
                track_hover: true,
                style_class: "emoji-button",
                width: this._emojiCellSize,
                accessible_name: item[1],
            });
            button.set_child(this._createEmojiGlyph(item[0]));
            button.connect("clicked", () => this._chooseEmoji(item[0]));
            row.add_child(button);
        }

        this._renderedCount = end;
    }

    _chooseEmoji(character) {
        let recent = (this.recentEmoji || []).filter(item => item !== character);
        recent.unshift(character);
        this.settings.setValue("recent-emoji", recent.slice(0, MAX_RECENT_EMOJI));

        this._cancelPaste();
        this._cancelClipboardRestore();
        this.menu.close(false);

        let clipboard = St.Clipboard.get_default();
        if (this.copyToClipboard) {
            clipboard.set_text(St.ClipboardType.CLIPBOARD, character);
            clipboard.set_text(St.ClipboardType.PRIMARY, character);
            this._schedulePaste();
            return;
        }

        // Insertion works by copying to the clipboard and simulating
        // Shift+Insert, so the previous clipboard contents are saved here
        // and put back once the paste has gone through.
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (actor, previousClipboard) => {
            clipboard.get_text(St.ClipboardType.PRIMARY, (actor2, previousPrimary) => {
                clipboard.set_text(St.ClipboardType.CLIPBOARD, character);
                clipboard.set_text(St.ClipboardType.PRIMARY, character);
                this._schedulePaste(previousClipboard, previousPrimary);
            });
        });
    }

    _schedulePaste(previousClipboard, previousPrimary) {
        let restoreClipboard = previousClipboard !== undefined;
        this._pasteTimeoutId = Mainloop.timeout_add(PASTE_DELAY_MS, () => {
            this._pasteTimeoutId = 0;
            if (!this._destroyed)
                this._pasteClipboard();
            if (restoreClipboard)
                this._scheduleClipboardRestore(previousClipboard, previousPrimary);
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleClipboardRestore(previousClipboard, previousPrimary) {
        this._clipboardRestoreTimeoutId = Mainloop.timeout_add(
            CLIPBOARD_RESTORE_DELAY_MS,
            () => {
                this._clipboardRestoreTimeoutId = 0;
                if (!this._destroyed) {
                    let clipboard = St.Clipboard.get_default();
                    clipboard.set_text(
                        St.ClipboardType.CLIPBOARD, previousClipboard || ""
                    );
                    clipboard.set_text(
                        St.ClipboardType.PRIMARY, previousPrimary || ""
                    );
                }
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _pasteClipboard() {
        let insertPressed = false;
        let shiftPressed = false;
        let timestamp = global.get_current_time();

        try {
            this._virtualKeyboard.notify_keyval(
                timestamp,
                Clutter.KEY_Shift_L,
                Clutter.KeyState.PRESSED
            );
            shiftPressed = true;
            this._virtualKeyboard.notify_keyval(
                timestamp,
                Clutter.KEY_Insert,
                Clutter.KeyState.PRESSED
            );
            insertPressed = true;
            this._virtualKeyboard.notify_keyval(
                timestamp,
                Clutter.KEY_Insert,
                Clutter.KeyState.RELEASED
            );
            insertPressed = false;
        } catch (error) {
            global.logError(error, UUID);
        } finally {
            if (insertPressed) {
                try {
                    this._virtualKeyboard.notify_keyval(
                        timestamp,
                        Clutter.KEY_Insert,
                        Clutter.KeyState.RELEASED
                    );
                } catch (error) {
                    global.logError(error, UUID);
                }
            }
            if (shiftPressed) {
                try {
                    this._virtualKeyboard.notify_keyval(
                        timestamp,
                        Clutter.KEY_Shift_L,
                        Clutter.KeyState.RELEASED
                    );
                } catch (error) {
                    global.logError(error, UUID);
                }
            }
        }
    }

    _cancelPaste() {
        if (this._pasteTimeoutId !== 0) {
            Mainloop.source_remove(this._pasteTimeoutId);
            this._pasteTimeoutId = 0;
        }
    }

    _cancelClipboardRestore() {
        if (this._clipboardRestoreTimeoutId !== 0) {
            Mainloop.source_remove(this._clipboardRestoreTimeoutId);
            this._clipboardRestoreTimeoutId = 0;
        }
    }

    _cancelRender() {
        if (this._renderIdleId !== 0) {
            Mainloop.source_remove(this._renderIdleId);
            this._renderIdleId = 0;
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_added_to_panel() {
        this._syncPopupIconSizes();
        if (this._popupIconSizeSignalId === 0) {
            this._popupIconSizeSignalId = this.panel.connect(
                "icon-size-changed",
                () => this._syncPopupIconSizes()
            );
        }
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        this._cancelRender();
        this._cancelPaste();
        this._cancelClipboardRestore();

        if (this._loadCancellable)
            this._loadCancellable.cancel();
        if (this._scrollSignalId)
            this._scrollAdjustment.disconnect(this._scrollSignalId);
        if (this._popupIconSizeSignalId !== 0) {
            this.panel.disconnect(this._popupIconSizeSignalId);
            this._popupIconSizeSignalId = 0;
        }

        this.settings.finalize();
        this.menu.destroy();
        this._virtualKeyboard.run_dispose();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new EmojiKeyboardApplet(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
