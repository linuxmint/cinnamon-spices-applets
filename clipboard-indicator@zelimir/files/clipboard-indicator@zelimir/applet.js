// Clipboard Indicator for Cinnamon.
// A port of the GNOME Shell "Clipboard Indicator" extension
// (https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator).

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Pango = imports.gi.Pango;

// imports.ui.dialog only exists since Cinnamon 6.4.
let Dialog = null;
try {
    Dialog = imports.ui.dialog;
} catch (e) { /* older Cinnamon: plain labels are used instead */ }

const UUID = 'clipboard-indicator@zelimir';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(text) {
    return Gettext.dgettext(UUID, text);
}
const INDICATOR_ICON = 'edit-paste-symbolic';
const ST_CLIPBOARD = St.ClipboardType.CLIPBOARD;
const META_CLIPBOARD = Meta.SelectionType.SELECTION_CLIPBOARD;

const TEXT_MIMETYPES = ['text/plain;charset=utf-8', 'UTF8_STRING', 'text/plain', 'STRING', 'TEXT'];
const IMAGE_MIMETYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
const HTML_MIMETYPE = 'text/html';
// Password managers (KeePassXC, Bitwarden, ...) tag secrets with this mimetype.
const SECRET_HINT_MIMETYPE = 'x-kde-passwordManagerHint';

const IMAGE_EXTENSIONS = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
};

const CAPTURE_DELAY = 200;        // ms between an owner change and reading the clipboard
const CYCLE_SELECT_DELAY = 750;   // ms, same as upstream DELAYED_SELECTION_TIMEOUT
const PASTE_KEYS_DELAY = 150;     // ms after the menu closes, so focus is back in the app
const PASTE_RESTORE_DELAY = 600;  // ms before the previous clipboard is restored
const MENU_FOCUS_DELAY = 50;

// Settings and what has to happen when each one changes.
const SETTINGS = {
    'history-size': 'trim',
    'preview-size': 'list',
    'cache-size': 'save',
    'cache-only-favorites': 'save',
    'cache-images': null,
    'strip-text': null,
    'move-item-first': null,
    'paste-on-select': null,
    'pinned-on-bottom': 'menu',
    'case-sensitive-search': 'filter',
    'regex-search': 'filter',
    'confirm-clear': null,
    'confirm-pinned-delete': null,
    'keep-selected-on-clear': null,
    'clear-on-boot': null,
    'clear-history-on-interval': 'interval',
    'clear-history-interval': 'interval-reset',
    'display-mode': 'panel',
    'topbar-preview-size': 'panel',
    'blink-icon-on-copy': null,
    'open-at-cursor': null,
    'show-search-bar': 'menu',
    'show-private-mode': 'menu',
    'show-clear-history-button': 'menu',
    'show-settings-button': 'menu',
    'paste-button': 'list',
    'show-pin-button': 'list',
    'show-tag-button': 'list',
    'show-edit-button': 'list',
    'show-preview-button': 'list',
    'show-delete-button': 'list',
    'notify-on-copy': null,
    'notify-on-cycle': null,
    'notify-on-clear': null,
    'enable-keybindings': 'keys',
    'toggle-menu': 'keys',
    'clear-history': 'keys',
    'prev-entry': 'keys',
    'next-entry': 'keys',
    'private-mode-binding': 'keys',
    'excluded-apps': null,
    'terminal-apps': null,
};

const KEYBINDINGS = ['toggle-menu', 'clear-history', 'prev-entry', 'next-entry', 'private-mode-binding'];

function camelCase(key) {
    return key.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
}

function truncate(text, length) {
    const chars = [...text.replace(/\s+/g, ' ').trim()];
    if (chars.length > length)
        return chars.slice(0, Math.max(1, length - 1)).join('') + '…';
    return chars.join('');
}

function symbolicIcon(name, styleClass = 'popup-menu-icon') {
    return new St.Icon({ icon_name: name, icon_type: St.IconType.SYMBOLIC, style_class: styleClass });
}

function decodeText(bytes, encoding = 'utf-8') {
    try {
        return new TextDecoder(encoding).decode(bytes);
    } catch (e) {
        return new TextDecoder().decode(bytes);
    }
}

// Resolves to the file contents (Uint8Array), or null when it can't be read.
function loadFile(path) {
    return new Promise(resolve => {
        Gio.File.new_for_path(path).load_contents_async(null, (file, res) => {
            try {
                const [, contents] = file.load_contents_finish(res);
                resolve(contents);
            } catch (e) {
                resolve(null);
            }
        });
    });
}

// Creates a private (0700) directory and any missing parents.
function makePrivateDirectory(path) {
    const dir = Gio.File.new_for_path(path);
    return new Promise((resolve, reject) => {
        dir.make_directory_async(GLib.PRIORITY_DEFAULT, null, (file, res) => {
            try {
                file.make_directory_finish(res);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                    resolve();
                } else if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    makePrivateDirectory(file.get_parent().get_path())
                        .then(() => makePrivateDirectory(path)).then(resolve, reject);
                } else {
                    reject(e);
                }
                return;
            }
            const info = new Gio.FileInfo();
            info.set_attribute_uint32('unix::mode', 0o700);
            file.set_attributes_async(info, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (f, r) => {
                try { f.set_attributes_finish(r); } catch (e) { /* keep the default mode */ }
                resolve();
            });
        });
    });
}

// Resolves to the names of the files in a directory.
function listDirectory(path) {
    return new Promise(resolve => {
        Gio.File.new_for_path(path).enumerate_children_async('standard::name', Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT, null, (dir, res) => {
                let enumerator;
                try {
                    enumerator = dir.enumerate_children_finish(res);
                } catch (e) {
                    resolve([]);
                    return;
                }
                const names = [];
                const next = () => enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, null, (en, r) => {
                    let infos = [];
                    try { infos = en.next_files_finish(r); } catch (e) { /* stop listing */ }
                    if (infos.length === 0) {
                        en.close_async(GLib.PRIORITY_DEFAULT, null, null);
                        resolve(names);
                        return;
                    }
                    for (const info of infos)
                        names.push(info.get_name());
                    next();
                });
                next();
            });
    });
}

// Modal dialogs differ between Cinnamon versions: destroyOnClose exists since
// 6.6, MessageDialogContent and setInitialKeyFocus since 6.4.
function createDialog(title, description) {
    let dialog;
    try {
        dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
    } catch (e) {
        dialog = new ModalDialog.ModalDialog();
        dialog._ciDestroyOnClose = true;
    }
    if (Dialog && Dialog.MessageDialogContent) {
        dialog.contentLayout.add_child(new Dialog.MessageDialogContent({ title, description }));
    } else {
        dialog.contentLayout.add_child(new St.Label({ text: title, style_class: 'ci-dialog-title' }));
        const label = new St.Label({ text: description, style_class: 'ci-dialog-description' });
        label.clutter_text.line_wrap = true;
        dialog.contentLayout.add_child(label);
    }
    return dialog;
}

function closeDialog(dialog) {
    dialog.close();
    if (dialog._ciDestroyOnClose)
        dialog.destroy();
}

function openDialog(dialog, focusActor) {
    if (focusActor && dialog.setInitialKeyFocus)
        dialog.setInitialKeyFocus(focusActor);
    dialog.open();
    if (focusActor && !dialog.setInitialKeyFocus)
        focusActor.grab_key_focus();
}


// Persistent storage: registry.json plus one file per image, in
// ~/.local/state/clipboard-indicator@zelimir (private to the user).
class Registry {
    constructor() {
        this.dir = GLib.build_filenamev([GLib.get_user_state_dir(), UUID]);
        this.imageDir = GLib.build_filenamev([this.dir, 'images']);
        this.path = GLib.build_filenamev([this.dir, 'registry.json']);
        this._writing = false;
        this._pending = null;
    }

    init() {
        return makePrivateDirectory(this.imageDir);
    }

    async read() {
        const contents = await loadFile(this.path);
        if (!contents)
            return [];
        try {
            const data = JSON.parse(decodeText(contents));
            return Array.isArray(data) ? data : [];
        } catch (e) {
            global.logError(`${UUID}: corrupt registry, starting empty: ${e}`);
            Gio.File.new_for_path(this.path).move_async(Gio.File.new_for_path(this.path + '.corrupt'),
                Gio.FileCopyFlags.OVERWRITE, GLib.PRIORITY_DEFAULT, null, null, (f, res) => {
                    try { f.move_finish(res); } catch (err) { /* nothing to keep */ }
                });
            return [];
        }
    }

    // Resolves to the set of image files that exist on disk.
    async listImages() {
        const names = await listDirectory(this.imageDir);
        return new Set(names.map(name => GLib.build_filenamev([this.imageDir, name])));
    }

    write(json) {
        // Coalesce writes: only the newest content matters.
        this._pending = json;
        if (!this._writing)
            this._flush();
    }

    _flush() {
        const json = this._pending;
        this._pending = null;
        if (json === null)
            return;
        this._writing = true;
        const file = Gio.File.new_for_path(this.path);
        const bytes = new GLib.Bytes(new TextEncoder().encode(json));
        file.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null,
            (f, res) => {
                try {
                    f.replace_contents_finish(res);
                } catch (e) {
                    global.logError(`${UUID}: could not write registry: ${e}`);
                }
                this._writing = false;
                this._flush();
            });
    }

    imagePath(hash, mimetype) {
        return GLib.build_filenamev([this.imageDir, `${hash}.${IMAGE_EXTENSIONS[mimetype] || 'img'}`]);
    }

    writeImage(path, bytes) {
        const file = Gio.File.new_for_path(path);
        return new Promise(resolve => {
            file.replace_contents_bytes_async(bytes, null, false, Gio.FileCreateFlags.PRIVATE, null, (f, res) => {
                try {
                    f.replace_contents_finish(res);
                    resolve(true);
                } catch (e) {
                    global.logError(`${UUID}: could not write image: ${e}`);
                    resolve(false);
                }
            });
        });
    }

    deleteFile(path) {
        if (path)
            Gio.File.new_for_path(path).delete_async(GLib.PRIORITY_DEFAULT, null, (f, res) => {
                try { f.delete_finish(res); } catch (e) { /* already gone */ }
            });
    }
}


function ClipNotificationSource() {
    this._init();
}

ClipNotificationSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init() {
        MessageTray.Source.prototype._init.call(this, _('Clipboard Indicator'));
        this._setSummaryIcon(this.createNotificationIcon());
    },

    createNotificationIcon() {
        return new St.Icon({ icon_name: INDICATOR_ICON, icon_type: St.IconType.SYMBOLIC, icon_size: this.ICON_SIZE });
    },
};


// One history entry in the menu.
class ClipMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(applet, entry) {
        // No focus-on-hover: moving the mouse over the list must not steal
        // focus from the search field (single-letter keys act on items).
        super._init({ focusOnHover: false, style_class: 'ci-item' });
        this._applet = applet;
        this.entry = entry;
        const cfg = applet.cfg;

        const box = new St.BoxLayout({ style_class: 'ci-item-box', x_expand: true });
        this.addActor(box, { expand: true, span: -1 });

        this._check = symbolicIcon('object-select-symbolic', 'popup-menu-icon ci-check');
        box.add_child(this._check);

        if (entry.type === 'image') {
            const thumb = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(entry.file) }),
                icon_type: St.IconType.FULLCOLOR,
                icon_size: 32,
                style_class: 'ci-thumb',
                y_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(thumb);
        }

        this.label = new St.Label({
            text: applet.entryLabel(entry),
            style_class: entry.type === 'image' ? 'ci-label ci-image-label' : 'ci-label',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        box.add_child(this.label);
        this.actor.label_actor = this.label;

        if (entry.tag) {
            box.add_child(new St.Label({
                text: entry.tag,
                style_class: 'ci-tag',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        const buttons = new St.BoxLayout({ style_class: 'ci-buttons', y_align: Clutter.ActorAlign.CENTER });
        box.add_child(buttons);
        const add = (icon, name, visible, cb, extraClass = '') => {
            const btn = new St.Button({
                style_class: `ci-action-btn ${extraClass}`,
                can_focus: true,
                accessible_name: name,
                child: symbolicIcon(icon, 'popup-menu-icon'),
                visible,
            });
            btn.connect('clicked', () => cb());
            buttons.add_child(btn);
            return btn;
        };

        if (entry.type === 'image')
            add('image-x-generic-symbolic', _('Preview'), cfg.showPreviewButton, () => applet.showImagePreview(entry));
        if (entry.type === 'text')
            add('document-edit-symbolic', _('Edit'), cfg.showEditButton, () => applet.showEditDialog(entry));
        add('view-pin-symbolic', entry.favorite ? _('Unpin') : _('Pin'), cfg.showPinButton,
            () => applet.toggleFavorite(entry), entry.favorite ? 'ci-pinned' : 'ci-unpinned');
        add('edit-paste-symbolic', _('Paste'), cfg.pasteButton, () => applet.pasteEntry(entry, true));
        add('user-bookmarks-symbolic', _('Tag'), cfg.showTagButton, () => applet.showTagDialog(entry));
        add('edit-delete-symbolic', _('Delete'), cfg.showDeleteButton, () => applet.requestDeleteEntry(entry));

        this.setCurrent(false);
        this.connect('activate', () => applet.onItemActivated(this));
        this.actor.connect('key-focus-in', () => applet.ensureItemVisible(this));
    }

    setCurrent(current) {
        this._check.opacity = current ? 255 : 0;
        this.actor.change_style_pseudo_class('checked', current);
    }

    _onKeyPressEvent(actor, event) {
        if (this._applet.onItemKeyPress(this, event))
            return Clutter.EVENT_STOP;
        return super._onKeyPressEvent(actor, event);
    }
}


class ClipboardIndicatorApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this._orientation = orientation;
        this._entries = [];          // newest first; pinned and history mixed
        this._current = null;        // entry that is in the clipboard right now
        this._privateMode = false;
        this._timeouts = {};
        this._readSerial = 0;
        this._items = new Map();     // entry -> ClipMenuItem
        this._listDirty = true;
        this._boundKeys = [];
        this._pasteGuard = null;
        this._cycleTarget = null;
        this._destroyed = false;

        this.cfg = {};
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        for (const [key, kind] of Object.entries(SETTINGS))
            this.settings.bindWithObject(this.cfg, key, camelCase(key), () => this._onSettingChanged(kind));

        this._clipboard = St.Clipboard.get_default();
        this._selection = global.display.get_selection();
        this._registry = new Registry();

        this.set_applet_icon_symbolic_name(INDICATOR_ICON);
        this._imageBin = new St.Bin({ style_class: 'ci-panel-image', y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_child(this._imageBin);

        this._cursorActor = new Clutter.Actor({ opacity: 0, width: 1, height: 1 });
        Main.uiGroup.add_child(this._cursorActor);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect('open-state-changed', (menu, open) => this._onMenuOpenStateChanged(open));
        this._buildMenu();
        this._buildContextMenu();
        this._bindShortcuts();
        this._updatePanel();

        this._start().catch(e => global.logError(`${UUID}: failed to start: ${e}\n${e.stack}`));
    }

    async _start() {
        await this._loadHistory();
        if (this._destroyed)
            return;
        await this._handleClearOnBoot();
        if (this._destroyed)
            return;
        this._setupIntervalClearing();

        // Clipboard managers like GPaste grab the clipboard right after every
        // copy and briefly serve stale data, so let the owner settle first.
        this._ownerChangedId = this._selection.connect('owner-changed', (sel, type) => {
            if (type === META_CLIPBOARD)
                this._setTimeout('capture', CAPTURE_DELAY, () => this._onClipboardChanged(false));
        });
        // Mark whatever is in the clipboard right now.
        this._onClipboardChanged(true);
        this._listChanged();
        this._updatePanel();
    }

    // ---------------------------------------------------------------- history

    async _loadHistory() {
        await this._registry.init();
        const [raws, existing] = await Promise.all([this._registry.read(), this._registry.listImages()]);
        if (this._destroyed)
            return;
        for (const raw of raws) {
            const entry = {
                type: raw.type === 'image' ? 'image' : 'text',
                mimetype: raw.mimetype || 'text/plain;charset=utf-8',
                favorite: !!raw.favorite,
                tag: raw.tag || null,
            };
            if (entry.type === 'image') {
                entry.hash = raw.hash;
                entry.file = this._registry.imagePath(raw.hash, entry.mimetype);
                entry.width = raw.width || 0;
                entry.height = raw.height || 0;
                if (!raw.hash || !existing.has(entry.file))
                    continue;
            } else {
                if (typeof raw.text !== 'string')
                    continue;
                entry.text = raw.text;
            }
            this._entries.push(entry);
        }
        this._trimHistory(false);

        // Remove image files that no entry refers to any more.
        const keep = new Set(this._entries.map(e => e.file).filter(f => f));
        for (const path of existing)
            if (!keep.has(path))
                this._registry.deleteFile(path);
    }

    _save() {
        const cfg = this.cfg;
        let entries = this._entries;
        if (cfg.cacheOnlyFavorites)
            entries = entries.filter(e => e.favorite);
        let data = entries.map(e => {
            const item = { type: e.type, mimetype: e.mimetype, favorite: e.favorite };
            if (e.tag)
                item.tag = e.tag;
            if (e.type === 'image')
                Object.assign(item, { hash: e.hash, width: e.width, height: e.height });
            else
                item.text = e.text;
            return item;
        });

        // Respect the size limit by dropping the oldest unpinned entries.
        const limit = cfg.cacheSize * 1024 * 1024;
        let json = JSON.stringify(data);
        while (json.length > limit) {
            const idx = data.map(d => d.favorite).lastIndexOf(false);
            if (idx < 0)
                break;
            data.splice(idx, 1);
            json = JSON.stringify(data);
        }
        this._registry.write(json);
    }

    _sameContent(entry, captured) {
        if (entry.type !== captured.type)
            return false;
        if (entry.type === 'image')
            return entry.hash === captured.hash;
        return entry.text === captured.text && entry.mimetype === captured.mimetype;
    }

    _trimHistory(save = true) {
        let unpinned = this._entries.filter(e => !e.favorite);
        let removed = false;
        while (unpinned.length > this.cfg.historySize) {
            const oldest = unpinned.pop();
            this._removeEntry(oldest, false);
            removed = true;
        }
        if (removed && save)
            this._save();
        return removed;
    }

    _removeEntry(entry, clearIfCurrent) {
        const idx = this._entries.indexOf(entry);
        if (idx < 0)
            return;
        this._entries.splice(idx, 1);
        if (entry.file)
            this._registry.deleteFile(entry.file);
        if (entry === this._current) {
            this._current = null;
            if (clearIfCurrent)
                this._clipboard.set_text(ST_CLIPBOARD, '');
        }
        this._listChanged();
    }

    _moveToFront(entry) {
        const idx = this._entries.indexOf(entry);
        if (idx > 0) {
            this._entries.splice(idx, 1);
            this._entries.unshift(entry);
        }
    }

    // Order in which entries are shown (and cycled through).
    _displayOrder() {
        const pinned = this._entries.filter(e => e.favorite);
        const history = this._entries.filter(e => !e.favorite);
        return this.cfg.pinnedOnBottom ? history.concat(pinned) : pinned.concat(history);
    }

    entryLabel(entry) {
        if (entry.type === 'image') {
            if (entry.width && entry.height)
                return _('Image · %d×%d').format(entry.width, entry.height);
            return _('Image');
        }
        return truncate(entry.text, this.cfg.previewSize);
    }

    // -------------------------------------------------------------- clipboard

    async _onClipboardChanged(silent) {
        const serial = ++this._readSerial;
        if (this._privateMode || this._destroyed)
            return;
        if (this._isExcludedAppFocused())
            return;

        const mimetypes = this._selection.get_mimetypes(META_CLIPBOARD) || [];
        if (mimetypes.includes(SECRET_HINT_MIMETYPE))
            return;

        let captured = null;
        try {
            captured = await this._readClipboard(mimetypes);
        } catch (e) {
            global.logError(`${UUID}: failed to read clipboard: ${e}`);
            return;
        }
        // A newer change arrived while we were reading; it wins.
        if (serial !== this._readSerial || this._destroyed || this._privateMode)
            return;

        if (!captured)
            return;
        if (captured.type === 'empty') {
            this._current = null;
            this._refreshCurrentMarks();
            this._updatePanel();
            return;
        }
        this._onCaptured(captured, silent);
    }

    _transfer(mimetype) {
        return new Promise(resolve => {
            const stream = Gio.MemoryOutputStream.new_resizable();
            this._selection.transfer_async(META_CLIPBOARD, mimetype, -1, stream, null, (sel, res) => {
                try {
                    sel.transfer_finish(res);
                    stream.close(null);
                    resolve(stream.steal_as_bytes());
                } catch (e) {
                    resolve(null);
                }
            });
        });
    }

    // Returns the clipboard contents, {type: 'empty'} for a cleared clipboard,
    // or null when there is nothing worth recording.
    async _readClipboard(mimetypes) {
        if (mimetypes.length === 0)
            return { type: 'empty' };

        let emptyText = false;
        const textType = TEXT_MIMETYPES.find(m => mimetypes.includes(m));
        if (textType) {
            const bytes = await this._transfer(textType);
            if (bytes && bytes.get_size() > 0) {
                let text = decodeText(bytes.toArray(), textType === 'STRING' ? 'latin1' : 'utf-8');
                if (this.cfg.stripText)
                    text = text.trim();
                if (text.trim().length > 0)
                    return { type: 'text', mimetype: 'text/plain;charset=utf-8', text };
            }
            emptyText = true;
        }

        if (this.cfg.cacheImages) {
            const imageType = IMAGE_MIMETYPES.find(m => mimetypes.includes(m));
            if (imageType) {
                const bytes = await this._transfer(imageType);
                if (bytes && bytes.get_size() > 0) {
                    return Object.assign({
                        type: 'image',
                        mimetype: imageType === 'image/jpg' ? 'image/jpeg' : imageType,
                        bytes,
                    }, this._imageIdentity(bytes));
                }
            }
        }

        if (mimetypes.includes(HTML_MIMETYPE)) {
            const bytes = await this._transfer(HTML_MIMETYPE);
            if (bytes && bytes.get_size() > 0) {
                const text = decodeText(bytes.toArray());
                if (text.trim().length > 0)
                    return { type: 'text', mimetype: HTML_MIMETYPE, text };
            }
        }
        return emptyText ? { type: 'empty' } : null;
    }

    // Images are identified by their pixels, not their bytes: other clipboard
    // managers (GPaste, ...) re-take the clipboard with a re-encoded copy of
    // the same picture, which would otherwise show up twice.
    _imageIdentity(bytes) {
        try {
            const loader = new GdkPixbuf.PixbufLoader();
            loader.write_bytes(bytes);
            loader.close();
            const pixbuf = loader.get_pixbuf();
            const width = pixbuf.get_width();
            const height = pixbuf.get_height();
            const pixels = GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, pixbuf.read_pixel_bytes());
            const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256,
                `${width}x${height}:${pixbuf.get_has_alpha()}:${pixels}`, -1);
            return { hash, width, height };
        } catch (e) {
            return { hash: GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes), width: 0, height: 0 };
        }
    }

    async _onCaptured(captured, silent) {
        const existing = this._entries.find(e => this._sameContent(e, captured));

        // Our own temporary clipboard swap while pasting: leave everything as is.
        if (this._pasteGuard && existing &&
            (existing === this._pasteGuard.entry || existing === this._pasteGuard.previous))
            return;

        if (existing) {
            this._current = existing;
            if (this.cfg.moveItemFirst && !existing.favorite) {
                this._moveToFront(existing);
                this._save();
            }
            this._listChanged();
            this._updatePanel();
            return;
        }

        const entry = { type: captured.type, mimetype: captured.mimetype, favorite: false, tag: null };
        if (captured.type === 'image') {
            entry.hash = captured.hash;
            entry.width = captured.width;
            entry.height = captured.height;
            entry.file = this._registry.imagePath(captured.hash, captured.mimetype);
            if (!await this._registry.writeImage(entry.file, captured.bytes) || this._destroyed)
                return;
            // Another capture may have added the same picture while we were writing.
            if (this._entries.some(e => this._sameContent(e, captured)))
                return;
        } else {
            entry.text = captured.text;
        }

        this._entries.unshift(entry);
        this._current = entry;
        this._trimHistory(false);
        this._save();
        this._listChanged();
        this._updatePanel();

        if (!silent) {
            if (this.cfg.notifyOnCopy)
                this._notify(_('Copied to clipboard'), { cancel: true });
            this._blinkIcon();
        }
    }

    _setClipboard(entry) {
        if (!entry) {
            this._clipboard.set_text(ST_CLIPBOARD, '');
            this._current = null;
        } else if (entry.type === 'image') {
            this._current = entry;
            loadFile(entry.file).then(contents => {
                // Skip if destroyed, or another entry was selected meanwhile.
                if (this._destroyed || this._current !== entry)
                    return;
                if (contents)
                    this._clipboard.set_content(ST_CLIPBOARD, entry.mimetype, new GLib.Bytes(contents));
                else
                    this._notify(_('The image is no longer in the cache'));
            });
        } else if (entry.mimetype === HTML_MIMETYPE) {
            this._clipboard.set_content(ST_CLIPBOARD, HTML_MIMETYPE, new GLib.Bytes(new TextEncoder().encode(entry.text)));
            this._current = entry;
        } else {
            this._clipboard.set_text(ST_CLIPBOARD, entry.text);
            this._current = entry;
        }
        this._refreshCurrentMarks();
        this._updatePanel();
    }

    _focusedWmClasses() {
        const win = global.display.focus_window;
        if (!win)
            return [];
        return [win.get_wm_class(), win.get_wm_class_instance(), win.get_gtk_application_id && win.get_gtk_application_id()]
            .filter(c => !!c).map(c => c.toLowerCase());
    }

    _isExcludedAppFocused() {
        const excluded = (this.cfg.excludedApps || []).map(a => (a.wmclass || '').trim().toLowerCase()).filter(a => a);
        if (excluded.length === 0)
            return false;
        return this._focusedWmClasses().some(c => excluded.includes(c));
    }

    _isTerminalFocused() {
        try {
            if (Main.inputMethod && Main.inputMethod.content_purpose === Clutter.InputContentPurpose.TERMINAL)
                return true;
        } catch (e) { /* not available */ }
        const terminals = (this.cfg.terminalApps || '').split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        return this._focusedWmClasses().some(c => terminals.includes(c));
    }

    // ------------------------------------------------------------------ paste

    // Puts the entry into the clipboard and types the paste shortcut into the
    // focused window. With restorePrevious the old clipboard comes back after.
    pasteEntry(entry, restorePrevious) {
        const previous = this._current;
        this.menu.close();
        const restore = restorePrevious && previous && previous !== entry;
        if (restore)
            this._pasteGuard = { entry, previous };
        this._setClipboard(entry);

        this._setTimeout('paste-keys', PASTE_KEYS_DELAY, () => {
            this._sendPasteKeys();
            if (!restore)
                return;
            this._setTimeout('paste-restore', PASTE_RESTORE_DELAY, () => {
                if (this._entries.includes(previous))
                    this._setClipboard(previous);
                this._setTimeout('paste-guard', 300, () => { this._pasteGuard = null; });
            });
        });
    }

    _sendPasteKeys() {
        if (!this._virtualKeyboard) {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }
        const keys = this._isTerminalFocused()
            ? [Clutter.KEY_Control_L, Clutter.KEY_Shift_L, Clutter.KEY_V]
            : [Clutter.KEY_Shift_L, Clutter.KEY_Insert];
        const time = GLib.get_monotonic_time();
        for (const key of keys)
            this._virtualKeyboard.notify_keyval(time, key, Clutter.KeyState.PRESSED);
        for (const key of keys.slice().reverse())
            this._virtualKeyboard.notify_keyval(time, key, Clutter.KeyState.RELEASED);
    }

    // ------------------------------------------------------------------- menu

    _buildMenu() {
        const cfg = this.cfg;
        this.menu.removeAll();
        this._items.clear();
        this.menu.actor.add_style_class_name('ci-menu');

        // Search
        this._searchItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'ci-search-item' });
        this.searchEntry = new St.Entry({
            style_class: 'ci-search-entry',
            can_focus: true,
            hint_text: _('Search…'),
            track_hover: true,
            x_expand: true,
        });
        this.searchEntry.set_primary_icon(symbolicIcon('edit-find-symbolic', 'ci-search-icon'));
        this.searchEntry.clutter_text.connect('text-changed', () => this._applyFilter());
        this.searchEntry.clutter_text.connect('key-press-event', (actor, event) => this._onSearchKeyPress(event));
        this._searchItem.addActor(this.searchEntry, { expand: true, span: -1 });
        this.menu.addMenuItem(this._searchItem);

        // Pinned and history sections, each in its own scroll view.
        const makeSection = styleClass => {
            const section = new PopupMenu.PopupMenuSection();
            const scroll = new St.ScrollView({
                style_class: `ci-scroll ${styleClass}`,
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
                overlay_scrollbars: true,
            });
            scroll.add_actor(section.actor);
            return { section, scroll };
        };
        this._pinned = makeSection('ci-pinned-scroll');
        this._history = makeSection('ci-history-scroll');
        // Separators go straight into the box: addMenuItem() would let the
        // menu toggle their visibility on its own.
        this._middleSeparator = new PopupMenu.PopupSeparatorMenuItem();
        const order = cfg.pinnedOnBottom ? [this._history, this._pinned] : [this._pinned, this._history];
        this.menu.box.add_child(order[0].scroll);
        this.menu.box.add_child(this._middleSeparator.actor);
        this.menu.box.add_child(order[1].scroll);

        // Empty state
        this._emptyItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'ci-empty' });
        const emptyBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'ci-empty-box' });
        emptyBox.add_child(new St.Icon({
            icon_name: INDICATOR_ICON, icon_type: St.IconType.SYMBOLIC,
            style_class: 'ci-empty-icon', x_align: Clutter.ActorAlign.CENTER,
        }));
        this._emptyLabel = new St.Label({ text: _('Clipboard is empty'), x_align: Clutter.ActorAlign.CENTER });
        emptyBox.add_child(this._emptyLabel);
        this._emptyItem.addActor(emptyBox, { expand: true, span: -1, align: St.Align.MIDDLE });
        this.menu.addMenuItem(this._emptyItem);

        this._bottomSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.box.add_child(this._bottomSeparator.actor);

        // Private mode
        this._privateItem = new PopupMenu.PopupSwitchIconMenuItem(_('Private mode'), this._privateMode,
            'security-medium-symbolic', St.IconType.SYMBOLIC);
        this._privateItem.connect('toggled', (item, state) => this._setPrivateMode(state));
        this.menu.addMenuItem(this._privateItem);

        // Clear history, with the countdown of the automatic clearing
        this._clearItem = new PopupMenu.PopupIconMenuItem(_('Clear history'), 'user-trash-symbolic', St.IconType.SYMBOLIC);
        const clearBox = new St.BoxLayout({ style_class: 'ci-clear-box' });
        this._timerLabel = new St.Label({ style_class: 'ci-timer', y_align: Clutter.ActorAlign.CENTER });
        clearBox.add_child(this._timerLabel);
        this._timerResetButton = new St.Button({
            style_class: 'ci-action-btn',
            can_focus: true,
            accessible_name: _('Restart timer'),
            child: symbolicIcon('view-refresh-symbolic'),
        });
        this._timerResetButton.connect('clicked', () => this._scheduleNextClear());
        clearBox.add_child(this._timerResetButton);
        this._clearItem.addActor(new St.Bin({ x_align: St.Align.END, child: clearBox }),
            { expand: true, span: -1, align: St.Align.END });
        this._clearItem.connect('activate', () => {
            this.menu.close();
            this.requestClearHistory();
        });
        this.menu.addMenuItem(this._clearItem);

        // Settings
        this._settingsItem = new PopupMenu.PopupIconMenuItem(_('Settings'), 'preferences-system-symbolic', St.IconType.SYMBOLIC);
        this._settingsItem.connect('activate', () => {
            this.menu.close();
            this.configureApplet();
        });
        this.menu.addMenuItem(this._settingsItem);

        this._listDirty = true;
        if (this.menu.isOpen)
            this._renderList();
        this._updateMenuVisibility();
    }

    _listChanged() {
        this._listDirty = true;
        if (this.menu.isOpen)
            this._renderList();
        else
            this._updateMenuVisibility();
    }

    _renderList(focusIndex = -1) {
        this._listDirty = false;
        for (const item of this._items.values())
            item.destroy();
        this._items.clear();

        for (const entry of this._entries) {
            const item = new ClipMenuItem(this, entry);
            item.setCurrent(entry === this._current);
            (entry.favorite ? this._pinned : this._history).section.addMenuItem(item);
            this._items.set(entry, item);
        }
        this._applyFilter();

        if (focusIndex >= 0) {
            const visible = this._visibleItems();
            if (visible.length > 0)
                visible[Math.min(focusIndex, visible.length - 1)].actor.grab_key_focus();
            else
                this._focusDefault();
        }
    }

    _refreshCurrentMarks() {
        for (const [entry, item] of this._items)
            item.setCurrent(entry === this._current);
    }

    _visibleItems() {
        return this._displayOrder().map(e => this._items.get(e)).filter(i => i && i.actor.visible);
    }

    _applyFilter() {
        const cfg = this.cfg;
        let query = this.searchEntry.get_text();
        let matcher = null;
        if (query) {
            if (cfg.regexSearch) {
                try {
                    const re = new RegExp(query, cfg.caseSensitiveSearch ? 'm' : 'mi');
                    matcher = text => re.test(text);
                } catch (e) {
                    matcher = null;    // incomplete expression: fall back to plain search
                }
            }
            if (!matcher) {
                if (!cfg.caseSensitiveSearch)
                    query = query.toLowerCase();
                matcher = text => (cfg.caseSensitiveSearch ? text : text.toLowerCase()).includes(query);
            }
        }
        for (const [entry, item] of this._items) {
            const haystacks = [entry.type === 'image' ? this.entryLabel(entry) : entry.text, entry.tag || ''];
            item.actor.visible = !matcher || haystacks.some(h => matcher(h));
        }
        this._updateMenuVisibility();
    }

    _updateMenuVisibility() {
        const cfg = this.cfg;
        const hasEntries = this._entries.length > 0;
        const priv = this._privateMode;
        const visiblePinned = [...this._items.values()].some(i => i.entry.favorite && i.actor.visible);
        const visibleHistory = [...this._items.values()].some(i => !i.entry.favorite && i.actor.visible);
        const pinnedCount = this._entries.filter(e => e.favorite).length;
        const historyCount = this._entries.length - pinnedCount;

        this._searchItem.actor.visible = cfg.showSearchBar && hasEntries && !priv;
        this._pinned.scroll.visible = !priv && pinnedCount > 0;
        this._history.scroll.visible = !priv && historyCount > 0;
        this._middleSeparator.actor.visible = !priv && visiblePinned && visibleHistory;

        const searching = this.searchEntry.get_text() !== '';
        const noMatches = hasEntries && searching && !visiblePinned && !visibleHistory;
        this._emptyItem.actor.visible = !priv && (!hasEntries || noMatches);
        this._emptyLabel.text = noMatches ? _('No results') : _('Clipboard is empty');

        this._privateItem.actor.visible = cfg.showPrivateMode;
        this._clearItem.actor.visible = cfg.showClearHistoryButton && hasEntries && !priv;
        this._settingsItem.actor.visible = cfg.showSettingsButton;
        this._bottomSeparator.actor.visible = !priv && hasEntries && !this._emptyItem.actor.visible &&
            (this._privateItem.actor.visible || this._clearItem.actor.visible || this._settingsItem.actor.visible);
        this._updateTimerLabel();
    }

    _onMenuOpenStateChanged(open) {
        if (open) {
            this.searchEntry.set_text('');
            if (this._listDirty)
                this._renderList();
            else
                this._applyFilter();
            this._updateTimerLabel();
            this._setInterval('timer-label', 1000, () => this._updateTimerLabel());
            this._setTimeout('menu-focus', MENU_FOCUS_DELAY, () => this._focusDefault());
        } else {
            this._clearTimeout('timer-label');
            this._clearTimeout('menu-focus');
            if (this.menu.sourceActor === this._cursorActor) {
                this.menu.sourceActor = this.actor;
                this.menu.setOrientation(this._orientation);
            }
        }
    }

    _focusDefault() {
        if (!this.menu.isOpen)
            return;
        if (this._focusEntryOnOpen && this._items.has(this._focusEntryOnOpen)) {
            this._items.get(this._focusEntryOnOpen).actor.grab_key_focus();
        } else if (this._searchItem.actor.visible) {
            this.searchEntry.grab_key_focus();
        } else {
            const current = this._current && this._items.get(this._current);
            const first = current || this._visibleItems()[0];
            if (first)
                first.actor.grab_key_focus();
            else if (this._privateItem.actor.visible)
                this._privateItem.actor.grab_key_focus();
        }
        this._focusEntryOnOpen = null;
    }

    ensureItemVisible(item) {
        const scroll = item.entry.favorite ? this._pinned.scroll : this._history.scroll;
        const adjustment = scroll.get_vscroll_bar().get_adjustment();
        const box = item.actor.get_allocation_box();
        const [value, , , , , pageSize] = adjustment.get_values();
        if (box.y1 < value)
            adjustment.set_value(box.y1);
        else if (box.y2 > value + pageSize)
            adjustment.set_value(box.y2 - pageSize);
    }

    _toggleMenu(atCursor) {
        if (this.menu.isOpen) {
            this.menu.close();
            return;
        }
        if (atCursor || this.cfg.displayMode === 3) {
            const [x, y] = global.get_pointer();
            this._cursorActor.set_position(x, y);
            this.menu.sourceActor = this._cursorActor;
            this.menu.setOrientation(St.Side.TOP);
        }
        this.menu.open(true);
    }

    on_applet_clicked() {
        this._toggleMenu(false);
    }

    on_orientation_changed(orientation) {
        this._orientation = orientation;
        if (this.menu)
            this.menu.setOrientation(orientation);
        this._updatePanel();
    }

    // --------------------------------------------------------- keyboard nav

    _onSearchKeyPress(event) {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Tab) {
            const first = this._visibleItems()[0];
            if (first) {
                first.actor.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
        } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            const first = this._visibleItems()[0];
            if (first) {
                this.onItemActivated(first);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    onItemKeyPress(item, event) {
        const symbol = event.get_key_symbol();
        const state = event.get_state();
        const modified = state & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.SUPER_MASK);
        const entry = item.entry;
        const visible = this._visibleItems();
        const index = visible.indexOf(item);

        switch (symbol) {
        case Clutter.KEY_Up:
            if (index > 0)
                visible[index - 1].actor.grab_key_focus();
            else if (this._searchItem.actor.visible)
                this.searchEntry.grab_key_focus();
            return true;
        case Clutter.KEY_Down:
            if (index >= 0 && index < visible.length - 1)
                visible[index + 1].actor.grab_key_focus();
            else if (this._privateItem.actor.visible)
                this._privateItem.actor.grab_key_focus();
            return true;
        case Clutter.KEY_Delete:
        case Clutter.KEY_KP_Delete:
            this.requestDeleteEntry(entry, index);
            return true;
        }
        if (modified)
            return false;

        switch (symbol) {
        case Clutter.KEY_v:
            this.pasteEntry(entry, true);
            return true;
        case Clutter.KEY_p:
            this.toggleFavorite(entry, index);
            return true;
        case Clutter.KEY_t:
            this.showTagDialog(entry, true);
            return true;
        case Clutter.KEY_e:
            if (entry.type === 'text') {
                this.showEditDialog(entry, true);
                return true;
            }
            break;
        case Clutter.KEY_h:
            if (entry.type === 'image') {
                this.showImagePreview(entry, true);
                return true;
            }
            break;
        }

        // Any other printable key continues the search.
        const unicode = Clutter.keysym_to_unicode(symbol);
        if (unicode > 32 && this._searchItem.actor.visible) {
            this.searchEntry.grab_key_focus();
            this.searchEntry.clutter_text.insert_unichar(unicode);
            return true;
        }
        return false;
    }

    onItemActivated(item) {
        const entry = item.entry;
        if (this.cfg.pasteOnSelect) {
            this.pasteEntry(entry, false);
        } else {
            this._setClipboard(entry);
            this.menu.close();
        }
    }

    // ------------------------------------------------------------ actions

    toggleFavorite(entry, focusIndex = -1) {
        entry.favorite = !entry.favorite;
        this._moveToFront(entry);
        this._trimHistory(false);
        this._save();
        this._listDirty = true;
        if (this.menu.isOpen)
            this._renderList(focusIndex);
    }

    requestDeleteEntry(entry, focusIndex = -1) {
        const remove = () => {
            this._removeEntry(entry, true);
            this._save();
            if (this.menu.isOpen)
                this._renderList(focusIndex);
        };
        if (entry.favorite && this.cfg.confirmPinnedDelete) {
            const reopen = this.menu.isOpen;
            this._confirm(_('Delete pinned item?'),
                _('Are you sure you want to delete this pinned item? This cannot be undone.'),
                _('Delete'), remove, reopen ? entry : null);
        } else {
            remove();
        }
    }

    requestClearHistory() {
        if (this._privateMode)
            return;
        if (this.cfg.confirmClear)
            this._confirm(_('Clear all history?'),
                _('All unpinned items will be deleted. This cannot be undone.'),
                _('Clear'), () => this._clearHistory(false));
        else
            this._clearHistory(false);
    }

    _clearHistory(automatic, notify = true) {
        for (const entry of this._entries.slice()) {
            if (entry.favorite)
                continue;
            if (this.cfg.keepSelectedOnClear && entry === this._current)
                continue;
            this._removeEntry(entry, true);
        }
        this._save();
        this._updatePanel();
        if (notify && this.cfg.notifyOnClear)
            this._notify(automatic ? _('Clipboard history cleared automatically') : _('Clipboard history cleared'));
    }

    _cancelLastCopy() {
        const newest = this._entries.find(e => !e.favorite);
        if (!newest || newest !== this._current)
            return;
        this._removeEntry(newest, false);
        const previous = this._entries.find(e => !e.favorite);
        this._setClipboard(previous || null);
        this._save();
    }

    _cycle(direction) {
        if (this._privateMode)
            return;
        const list = this._displayOrder();
        if (list.length === 0)
            return;
        let index = list.indexOf(this._cycleTarget || this._current);
        index = index < 0 ? 0 : (index + direction + list.length) % list.length;
        const target = list[index];

        if (this.cfg.notifyOnCycle)
            this._notify(`${index + 1} / ${list.length}: ${this.entryLabel(target)}`);

        if (this.cfg.moveItemFirst) {
            // Delay the real selection, otherwise the list reorders under the user.
            this._cycleTarget = target;
            this._updatePanel(target);
            this._setTimeout('cycle', CYCLE_SELECT_DELAY, () => {
                this._cycleTarget = null;
                this._setClipboard(target);
            });
        } else {
            this._setClipboard(target);
        }
    }

    _setPrivateMode(enabled) {
        if (this._privateMode === enabled)
            return;
        this._privateMode = enabled;
        this._privateItem.setToggleState(enabled);
        if (!enabled) {
            // Put back what the history says is selected; the clipboard
            // contents from private mode must not leak into the history.
            if (this._current && this._entries.includes(this._current))
                this._setClipboard(this._current);
            else
                this._setClipboard(null);
        }
        this._updateMenuVisibility();
        this._updatePanel();
    }

    // ----------------------------------------------------------- dialogs

    _reopenMenuOn(entry) {
        this._focusEntryOnOpen = entry;
        this.menu.open(true);
    }

    _confirm(title, description, actionLabel, onConfirm, reopenEntry = null) {
        this.menu.close();
        const dialog = createDialog(title, description);
        const done = () => {
            if (reopenEntry)
                this._reopenMenuOn(reopenEntry);
        };
        dialog.setButtons([
            { label: _('Cancel'), key: Clutter.KEY_Escape, action: () => { closeDialog(dialog); done(); } },
            { label: actionLabel, destructive_action: true, default: true, focused: true,
              action: () => { closeDialog(dialog); onConfirm(); done(); } },
        ]);
        openDialog(dialog, null);
    }

    showTagDialog(entry, reopen = false) {
        this.menu.close();
        const dialog = createDialog(_('Tag'), this.entryLabel(entry));
        const tagEntry = new St.Entry({
            style_class: 'ci-dialog-entry',
            text: entry.tag || '',
            hint_text: _('Enter tag…'),
            can_focus: true,
            x_expand: true,
        });
        dialog.contentLayout.add_child(tagEntry);

        const close = () => {
            closeDialog(dialog);
            if (reopen)
                this._reopenMenuOn(entry);
        };
        const save = () => {
            entry.tag = tagEntry.get_text().trim() || null;
            this._save();
            this._listDirty = true;
            close();
        };
        tagEntry.clutter_text.connect('activate', save);
        dialog.setButtons([
            { label: _('Discard'), key: Clutter.KEY_Escape, action: close },
            { label: _('Save'), default: true, action: save },
        ]);
        openDialog(dialog, tagEntry.clutter_text);
    }

    showEditDialog(entry, reopen = false) {
        if (entry.type !== 'text')
            return;
        this.menu.close();
        const dialog = createDialog(_('Edit item'), _('Ctrl+Enter saves the changes.'));

        const textEntry = new St.Entry({ style_class: 'ci-dialog-entry ci-edit-entry', text: entry.text, can_focus: true, x_expand: true });
        const text = textEntry.clutter_text;
        text.set_single_line_mode(false);
        text.set_activatable(false);
        text.set_line_wrap(true);
        text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        const box = new St.BoxLayout({ vertical: true, x_expand: true });
        box.add_child(textEntry);
        const scroll = new St.ScrollView({
            style_class: 'ci-edit-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });
        scroll.add_actor(box);
        dialog.contentLayout.add_child(scroll);

        const close = () => {
            closeDialog(dialog);
            if (reopen)
                this._reopenMenuOn(entry);
        };
        const save = () => {
            const newText = text.get_text();
            if (newText.length > 0 && newText !== entry.text) {
                entry.text = newText;
                this._save();
                this._listDirty = true;
                if (entry === this._current)
                    this._setClipboard(entry);
                this._updatePanel();
            }
            close();
        };
        text.connect('key-press-event', (actor, event) => {
            const symbol = event.get_key_symbol();
            if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) &&
                (event.get_state() & Clutter.ModifierType.CONTROL_MASK)) {
                save();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        dialog.setButtons([
            { label: _('Discard'), key: Clutter.KEY_Escape, action: close },
            { label: _('Save'), action: save },
        ]);
        openDialog(dialog, text);
    }

    showImagePreview(entry, reopen = false) {
        if (entry.type !== 'image')
            return;
        this.menu.close();
        this._closeImagePreview();

        const monitor = Main.layoutManager.currentMonitor;
        const overlay = new St.Widget({
            style_class: 'ci-preview-overlay',
            reactive: true,
            can_focus: true,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            layout_manager: new Clutter.BinLayout(),
        });
        Main.uiGroup.add_child(overlay);
        this._previewOverlay = overlay;

        const content = new St.BoxLayout({
            vertical: true,
            style_class: 'ci-preview-box',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        overlay.add_child(content);

        let resourceScale = 1;
        try {
            resourceScale = global.display.get_monitor_scale(monitor.index);
        } catch (e) { /* older Muffin */ }
        // Natural size, only shrunk (keeping the aspect ratio) to fit 80% of the monitor.
        let width = entry.width || monitor.width * 0.5;
        let height = entry.height || monitor.height * 0.5;
        const fit = Math.min(1, monitor.width * 0.8 / width, monitor.height * 0.8 / height);
        width = Math.max(1, Math.round(width * fit));
        height = Math.max(1, Math.round(height * fit));
        const image = St.TextureCache.get_default().load_file_async(
            Gio.File.new_for_path(entry.file), width, height, global.ui_scale, resourceScale);
        image.set_size(width, height);
        image.x_align = Clutter.ActorAlign.CENTER;
        content.add_child(image);
        content.add_child(new St.Label({
            text: `${this.entryLabel(entry)}  ·  ${_('Esc or click to close')}`,
            style_class: 'ci-preview-caption',
            x_align: Clutter.ActorAlign.CENTER,
        }));

        const close = () => {
            this._closeImagePreview();
            if (reopen)
                this._reopenMenuOn(entry);
            return Clutter.EVENT_STOP;
        };
        overlay.connect('button-press-event', close);
        overlay.connect('key-press-event', close);
        if (Main.pushModal(overlay))
            overlay._ciModal = true;
        overlay.grab_key_focus();
    }

    _closeImagePreview() {
        const overlay = this._previewOverlay;
        if (!overlay)
            return;
        this._previewOverlay = null;
        if (overlay._ciModal)
            Main.popModal(overlay);
        overlay.destroy();
    }

    // ------------------------------------------------------------ panel

    _updatePanel(entry = this._cycleTarget || this._current) {
        const cfg = this.cfg;
        const mode = cfg.displayMode;
        this.actor.visible = mode !== 3;
        this._applet_icon_box.visible = mode !== 1;
        this._applet_icon_box.opacity = this._privateMode ? 110 : 255;
        this._imageBin.set_child(null);

        let label = '';
        if (mode === 1 || mode === 2) {
            if (this._privateMode || !entry) {
                label = '…';
            } else if (entry.type === 'image') {
                if (this._orientation === St.Side.TOP || this._orientation === St.Side.BOTTOM)
                    this._imageBin.set_child(new St.Icon({
                        gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(entry.file) }),
                        icon_type: St.IconType.FULLCOLOR,
                        icon_size: 16,
                        style_class: 'ci-panel-thumb',
                    }));
            } else {
                label = truncate(entry.text, cfg.topbarPreviewSize);
            }
        }
        this.set_applet_label(label);
        if (mode === 1 && !label && !this._imageBin.child)
            this.set_applet_label('…');

        let tooltip = this._privateMode ? _('Clipboard Indicator – private mode') : _('Clipboard Indicator');
        if (!this._privateMode && entry)
            tooltip += `\n${this.entryLabel(entry)}`;
        this.set_applet_tooltip(tooltip);
    }

    _blinkIcon() {
        if (!this.cfg.blinkIconOnCopy)
            return;
        this.actor.add_style_class_name('ci-blink');
        this._setTimeout('blink', 200, () => this.actor.remove_style_class_name('ci-blink'));
    }

    _buildContextMenu() {
        this._excludeItem = new PopupMenu.PopupIconMenuItem(_("Don't record from this app"), 'action-unavailable-symbolic', St.IconType.SYMBOLIC);
        this._excludeItem.connect('activate', () => {
            const wmClass = this._contextWmClass;
            if (!wmClass)
                return;
            const list = (this.cfg.excludedApps || []).slice();
            if (!list.some(a => (a.wmclass || '').toLowerCase() === wmClass.toLowerCase())) {
                list.push({ wmclass: wmClass });
                this.settings.setValue('excluded-apps', list);
            }
            this._notify(_('Copies from "%s" are no longer recorded').format(wmClass));
        });
        this._applet_context_menu.addMenuItem(this._excludeItem);

        this._contextPrivateItem = new PopupMenu.PopupSwitchMenuItem(_('Private mode'), false);
        this._contextPrivateItem.connect('toggled', (item, state) => this._setPrivateMode(state));
        this._applet_context_menu.addMenuItem(this._contextPrivateItem);

        this._applet_context_menu.connect('open-state-changed', (menu, open) => {
            if (!open)
                return;
            this._contextPrivateItem.setToggleState(this._privateMode);
            const win = global.display.focus_window;
            this._contextWmClass = win ? win.get_wm_class() : null;
            const excluded = this._contextWmClass && this._isExcludedAppFocused();
            this._excludeItem.actor.visible = !!this._contextWmClass && !excluded;
            this._excludeItem.label.text = _("Don't record from: %s").format(this._contextWmClass);
        });
    }

    // ------------------------------------------------------- notifications

    _notify(body, { cancel = false } = {}) {
        if (this._privateMode)
            return;
        if (!this._notificationSource) {
            this._notificationSource = new ClipNotificationSource();
            this._notificationSource.connect('destroy', () => { this._notificationSource = null; });
            Main.messageTray.add(this._notificationSource);
        }
        if (this._notification)
            this._notification.destroy();

        const notification = new MessageTray.Notification(this._notificationSource, 'Clipboard', body);
        notification.setTransient(true);
        if (cancel) {
            notification.addButton('cancel', 'Undo');
            notification.connect('action-invoked', (n, id) => {
                if (id === 'cancel')
                    this._cancelLastCopy();
            });
        }
        notification.connect('destroy', () => {
            if (this._notification === notification)
                this._notification = null;
        });
        this._notification = notification;
        this._notificationSource.notify(notification);
    }

    // ----------------------------------------------------- automatic clear

    async _handleClearOnBoot() {
        const contents = await loadFile('/proc/sys/kernel/random/boot_id');
        if (this._destroyed)
            return;
        const bootId = contents ? decodeText(contents).trim() : '';
        const last = this.settings.getValue('last-boot-id');
        if (!bootId || bootId === last)
            return;
        if (last && this.cfg.clearOnBoot)
            this._clearHistory(true, false);
        this.settings.setValue('last-boot-id', bootId);
    }

    _setupIntervalClearing() {
        this._clearTimeout('auto-clear');
        if (!this.cfg.clearHistoryOnInterval) {
            if (this.settings.getValue('next-history-clear') !== -1)
                this.settings.setValue('next-history-clear', -1);
            this._updateMenuVisibility();
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const next = this.settings.getValue('next-history-clear');
        if (next === -1) {
            this._scheduleNextClear();
        } else if (next <= now) {
            this._clearHistory(true);
            this._scheduleNextClear();
        } else {
            this._armAutoClear(next - now);
        }
    }

    _scheduleNextClear() {
        if (!this.cfg.clearHistoryOnInterval)
            return;
        const seconds = this.cfg.clearHistoryInterval * 60;
        this.settings.setValue('next-history-clear', Math.floor(Date.now() / 1000) + seconds);
        this._armAutoClear(seconds);
    }

    _armAutoClear(seconds) {
        this._clearTimeout('auto-clear');
        this._timeouts['auto-clear'] = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Math.max(1, seconds), () => {
            delete this._timeouts['auto-clear'];
            this._clearHistory(true);
            this._scheduleNextClear();
            return GLib.SOURCE_REMOVE;
        });
        this._updateTimerLabel();
    }

    _updateTimerLabel() {
        if (!this._timerLabel)
            return;
        const enabled = this.cfg.clearHistoryOnInterval;
        this._timerLabel.visible = enabled;
        this._timerResetButton.visible = enabled;
        if (!enabled)
            return;
        const left = this.settings.getValue('next-history-clear') - Math.floor(Date.now() / 1000);
        if (left <= 0) {
            this._timerLabel.text = '';
            return;
        }
        const h = Math.floor(left / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        this._timerLabel.text = (h ? `${h}h ` : '') + (h || m ? `${m}m ` : '') + `${s}s`;
    }

    // ------------------------------------------------------------ settings

    _onSettingChanged(kind) {
        switch (kind) {
        case 'trim':
            if (this._trimHistory())
                this._listChanged();
            break;
        case 'list':
            this._listChanged();
            break;
        case 'save':
            this._save();
            break;
        case 'filter':
            if (this.menu.isOpen)
                this._applyFilter();
            break;
        case 'menu':
            this._buildMenu();
            break;
        case 'panel':
            this._updatePanel();
            break;
        case 'keys':
            this._bindShortcuts();
            break;
        case 'interval':
            this._setupIntervalClearing();
            break;
        case 'interval-reset':
            this._scheduleNextClear();
            break;
        }
    }

    _bindShortcuts() {
        this._unbindShortcuts();
        if (!this.cfg.enableKeybindings)
            return;
        const actions = {
            'toggle-menu': () => this._toggleMenu(this.cfg.openAtCursor),
            'clear-history': () => this.requestClearHistory(),
            'prev-entry': () => this._cycle(-1),
            'next-entry': () => this._cycle(1),
            'private-mode-binding': () => this._setPrivateMode(!this._privateMode),
        };
        for (const key of KEYBINDINGS) {
            const binding = this.settings.getValue(key);
            if (!binding)
                continue;
            const name = `${UUID}-${key}`;
            Main.keybindingManager.addHotKey(name, binding, actions[key]);
            this._boundKeys.push(name);
        }
    }

    _unbindShortcuts() {
        for (const name of this._boundKeys)
            Main.keybindingManager.removeHotKey(name);
        this._boundKeys = [];
    }

    // ------------------------------------------------------------- timers

    _setTimeout(name, ms, callback) {
        this._clearTimeout(name);
        this._timeouts[name] = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            delete this._timeouts[name];
            callback();
            return GLib.SOURCE_REMOVE;
        });
    }

    _setInterval(name, ms, callback) {
        this._clearTimeout(name);
        this._timeouts[name] = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            callback();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _clearTimeout(name) {
        if (this._timeouts[name]) {
            GLib.source_remove(this._timeouts[name]);
            delete this._timeouts[name];
        }
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._ownerChangedId) {
            this._selection.disconnect(this._ownerChangedId);
            this._ownerChangedId = 0;
        }
        for (const name of Object.keys(this._timeouts))
            this._clearTimeout(name);
        this._unbindShortcuts();
        this._closeImagePreview();
        if (this._notificationSource)
            this._notificationSource.destroy();
        if (this._virtualKeyboard) {
            this._virtualKeyboard.run_dispose();
            this._virtualKeyboard = null;
        }
        this._cursorActor.destroy();
        this.menu.destroy();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ClipboardIndicatorApplet(metadata, orientation, panelHeight, instanceId);
}
