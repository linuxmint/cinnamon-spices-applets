const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const Params = imports.misc.params;

const Helpers = require('./helpers');

let XApp;
try {
    XApp = imports.gi.XApp;
} catch (e) {
    XApp = null;
}

Gettext.bindtextdomain(Helpers.UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    let locText = Gettext.dgettext(Helpers.UUID, text);
    if (locText == text) {
        locText = window._(text);
    }
    return locText;
}

class FolderMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(file, handler, options = {}) {
        super();
        this._file = file;
        this._handler = handler;
        this._params = Params.parse(options, { showPinned: false, showFavorite: false, clipLimit: null }, true);
        this.actor.add_style_class_name('popup-menu-item');

        let box = new St.BoxLayout({
            style_class: 'popup-menu-item-box',
            style: 'spacing: 6px;'
        });

        this.addActor(box, { expand: true, span: 1, align: St.Align.START });

        this._icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: this._params.showFavorite ? 'xsi-starred' : (this._params.showPinned ? 'xsi-view-pin' : 'xsi-folder'),
            icon_type: St.IconType.SYMBOLIC
        });
        box.add(this._icon);

        let fullName = file.get_basename();
        let clipped = this._params.clipLimit ? this._handler._clipName(fullName, this._params.clipLimit) : fullName;
        this.label = new St.Label({ text: clipped });
        box.add(this.label, { expand: true, y_align: St.Align.CENTER });

        if (this._params.clipLimit && clipped !== fullName) {
            new Tooltips.Tooltip(this.label, fullName);
        }

        this._arrow = new St.Icon({
            style_class: 'popup-menu-arrow',
            icon_name: 'xsi-go-next-symbolic',
            icon_type: St.IconType.SYMBOLIC
        });
        box.add(this._arrow);

        this._keyPressId = this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
    }

    destroy() {
        if (this._keyPressId) {
            this.actor.disconnect(this._keyPressId);
            this._keyPressId = 0;
        }
        super.destroy();
    }

    setLoading(loading) {
        if (loading) {
            this._arrow.set_icon_name('process-working-symbolic');
        } else {
            this._arrow.set_icon_name('xsi-go-next-symbolic');
        }
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Up) {
            if (this._handler.isFirstItem(this) && this._handler.applet.show_header) {
                this._handler.focusHeader();
                return true;
            }
        }

        if (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down) {
            Mainloop.idle_add(() => {
                let focus = global.stage.get_key_focus();
                if (focus) this._handler._scrollItemIntoView(focus);
                return false;
            });
            return false;
        }
        if (symbol === Clutter.KEY_Right) {
            this.activate(event);
            return true;
        } else if (symbol === Clutter.KEY_Left) {
            if (this._handler.canGoUp()) {
                this._handler.goUp();
                return true;
            }
        }
        return false;
    }

    activate(event) {
        if (this._handler && this._handler.menu.isOpen) {
            this._handler.openChildFolder(this._file, this);
        }
    }
}

class FileMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(file, info, handler, options = {}) {
        super();
        this._file = file;
        this._handler = handler;
        this._params = Params.parse(options, { showPinned: false, showFavorite: false, clipLimit: null }, true);

        this.actor.add_style_class_name('popup-menu-item');

        let box = new St.BoxLayout({
            style_class: 'popup-menu-item-box',
            style: 'spacing: 6px;'
        });
        this.addActor(box, { expand: true, span: 1, align: St.Align.START });

        let gicon = info.get_icon();
        let icon = new St.Icon({
            gicon: gicon,
            icon_name: this._params.showFavorite ? 'xsi-starred' : (this._params.showPinned ? 'xsi-view-pin' : null),
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC
        });
        box.add(icon);

        let fullName = file.get_basename();
        let clipped = this._params.clipLimit ? this._handler._clipName(fullName, this._params.clipLimit) : fullName;
        this.label = new St.Label({ text: clipped });
        box.add(this.label, { expand: true, y_align: St.Align.CENTER });

        if (this._params.clipLimit && clipped !== fullName) {
            new Tooltips.Tooltip(this.label, fullName);
        }

        this._keyPressId = this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
    }

    destroy() {
        if (this._keyPressId) {
            this.actor.disconnect(this._keyPressId);
            this._keyPressId = 0;
        }
        super.destroy();
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Up) {
            if (this._handler.isFirstItem(this) && this._handler.applet.show_header) {
                this._handler.focusHeader();
                return true;
            }
        }

        if (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down) {
            Mainloop.idle_add(() => {
                let focus = global.stage.get_key_focus();
                if (focus) this._handler._scrollItemIntoView(focus);
                return false;
            });
            return false;
        }
        if (symbol === Clutter.KEY_Left) {
            if (this._handler.canGoUp()) {
                this._handler.goUp();
                return true;
            }
        }
        return false;
    }

    activate(event) {
        Gio.app_info_launch_default_for_uri(this._file.get_uri(), null);
        this._handler.menu.close();
    }
}

var NativeCassettoneHandler = class NativeCassettoneHandler {
    constructor(applet) {
        this.applet = applet;
        this.currentDir = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
        this.menu = new Applet.AppletPopupMenu(this.applet, this.applet._orientation);
        this.menuManager.addMenu(this.menu);

        this._menuItems = [];

        this._menuKeyPressId = this.menu.actor.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Left && this.canGoUp()) {
                this.goUp();
                return true;
            }
            return false;
        });

        this._favorites = XApp ? XApp.Favorites.get_default() : null;
        this._favoritesChangedId = 0;
        if (this._favorites) {
            this._favoritesChangedId = this._favorites.connect("changed", () => {
                if (this.menu && this.menu.isOpen) {
                    this.populateCurrentDir();
                }
            });
        }

        // Reset to starting directory when menu closes
        this._menuOpenStateId = this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (!isOpen) {
                Mainloop.timeout_add(200, () => {
                    if (!this.menu.isOpen) {
                        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);
                        this.enterFolder(Gio.File.new_for_uri(starting_uri));
                    }
                    return false;
                });
            }
        });

        // Build the menu UI
        this._buildHeader();
        this._updateHeaderActionsVisibility();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.scroll = new St.ScrollView({
            style_class: 'vfade',
            style: 'min-width: 300px; max-height: 420px; min-height: 120px;',
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true
        });

        this.scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scroll.set_clip_to_allocation(true);
        this.scroll.set_y_expand(true);

        this.menuBox = new St.BoxLayout({
            vertical: true,
            y_expand: true
        });
        this.scroll.add_actor(this.menuBox);
        this.menu.addActor(this.scroll);

        // Initial Load
        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);
        this.enterFolder(Gio.File.new_for_uri(starting_uri));
    }

    _buildHeader() {
        this.headerBox = new St.BoxLayout({
            style_class: 'header-box',
            style: 'padding: 6px 10px; spacing: 10px;',
            reactive: true
        });

        // Back Button
        this.backButton = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px;', can_focus: true });
        let backIcon = new St.Icon({ icon_name: 'xsi-go-previous-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.backButton.set_child(backIcon);
        this.backButton.connect('clicked', () => this.goUp());
        this.headerBox.add(this.backButton);

        // Folder Name
        this.headerLabel = new St.Label({ text: "...", style: 'font-weight: bold; padding-top: 4px;' });
        this.headerBox.add(this.headerLabel, { expand: true, y_align: Clutter.ActorAlign.CENTER });

        // Open Folder
        this.openBtn = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px 2px;', can_focus: true });
        let openTooltip = new Tooltips.Tooltip(this.openBtn, _("Open Folder"));
        let openIcon = new St.Icon({ icon_name: 'xsi-folder-open-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.openBtn.set_child(openIcon);
        this.openBtn.connect('clicked', () => {
            Gio.app_info_launch_default_for_uri(this.currentDir.get_uri(), null);
            this.menu.close();
        });
        this.openBtn.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_Down) {
                if (this.termBtn.visible) {
                    this.termBtn.grab_key_focus();
                    return true;
                }
            }
            return false;
        });
        this.headerBox.add(this.openBtn);

        // Open Terminal
        this.termBtn = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px 2px;', can_focus: true });
        let termTooltip = new Tooltips.Tooltip(this.termBtn, _("Open in Terminal"));
        let termIcon = new St.Icon({ icon_name: 'xsi-utilities-terminal-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.termBtn.set_child(termIcon);
        this.termBtn.connect('clicked', () => this._openTerminal());
        this.termBtn.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Down) {
                this.focusFirstItem();
                return true;
            }
            if (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Up) {
                if (this.openBtn.visible) {
                    this.openBtn.grab_key_focus();
                    return true;
                }
            }
            return false;
        });
        this.headerBox.add(this.termBtn);

        this.menu.addActor(this.headerBox);
    }

    _updateHeaderActionsVisibility() {
        if (!this.openBtn || !this.termBtn) return;
        if (this.applet.show_header) {
            this.openBtn.show();
            this.termBtn.show();
        } else {
            this.openBtn.hide();
            this.termBtn.hide();
        }
    }

    _openTerminal() {
        if (!this.currentDir) return;
        let path = this.currentDir.get_path();

        try {
            let termSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.default-applications.terminal" });
            let exec = termSettings.get_string("exec");

            if (exec) {
                let [success, argv] = GLib.shell_parse_argv(exec);
                if (success) {
                    if (argv[0] === "gnome-terminal") {
                        let newArgv = ['gnome-terminal', '--working-directory=' + path];
                        GLib.spawn_async(null, newArgv, null, GLib.SpawnFlags.SEARCH_PATH, null);
                    } else {
                        GLib.spawn_async(path, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
                    }
                    this.menu.close();
                    return;
                }
            }
        } catch (e) {
            global.logWarning(Helpers.UUID + ": Error opening default terminal: " + e);
        }

        // Fallback if the default terminal fails
        try {
            let newArgv = ['gnome-terminal', '--working-directory=' + path];
            GLib.spawn_async(null, newArgv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        } catch (e) {
            global.logError(Helpers.UUID + ": Error opening fallback terminal: " + e);
        }
        this.menu.close();
    }

    _updateHeader() {
        if (!this.currentDir) return;

        let name = this.currentDir.get_basename();
        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);
        let startFile = Gio.File.new_for_uri(starting_uri);
        let isRoot = this.currentDir.equal(startFile);

        if (isRoot) {
            this.backButton.hide();
        } else {
            this.backButton.show();
        }

        this.headerLabel.set_text(name);
    }

    _clipName(name, limit) {
        if (!limit || limit <= 0) return name;
        if (name.length <= limit) return name;
        if (limit <= 3) return name.slice(0, limit);

        let keep = limit - 3;
        let left = Math.ceil(keep / 2);
        let right = Math.floor(keep / 2);
        return name.slice(0, left) + "..." + name.slice(name.length - right);
    }

    _scrollItemIntoView(actor) {
        if (!actor || !this.scroll) return;

        let adj = this.scroll.get_vscroll_bar().get_adjustment();
        if (!adj) return;

        let [scrollX, scrollY] = this.scroll.get_transformed_position();
        let [actorX, actorY] = actor.get_transformed_position();

        let actorHeight = actor.height || actor.get_allocation_box().get_height();
        let viewHeight = this.scroll.height || this.scroll.get_allocation_box().get_height();

        let actorTop = actorY - scrollY + adj.value;
        let actorBottom = actorTop + actorHeight;

        let viewTop = adj.value;
        let viewBottom = viewTop + viewHeight;

        if (actorTop < viewTop) {
            adj.value = Math.max(adj.lower, actorTop);
        } else if (actorBottom > viewBottom) {
            adj.value = Math.min(adj.upper - adj.page_size, actorBottom - viewHeight);
        }
    }

    _scrollToTop() {
        if (!this.scroll) return;
        let adj = this.scroll.get_vscroll_bar().get_adjustment();
        if (adj) adj.value = adj.lower;
    }

    onSettingsChanged() {
        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);
        this.enterFolder(Gio.File.new_for_uri(starting_uri));
        this._updateHeaderActionsVisibility();
    }

    canGoUp() {
        if (!this.currentDir) return false;
        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);
        let startFile = Gio.File.new_for_uri(starting_uri);
        return !this.currentDir.equal(startFile);
    }

    goUp() {
        if (!this.currentDir || !this.canGoUp()) return;
        let parent = this.currentDir.get_parent();
        if (parent) {
            Mainloop.idle_add(() => {
                this.enterFolder(parent);
                return false;
            });
        }
    }

    _getAttributes() {
        let attributes = "standard::name,standard::type,standard::is-hidden,standard::icon,standard::display-name,metadata::pinned-to-top";
        if (this.applet.order_by == 1) attributes += ",time::modified";
        return attributes;
    }

    openChildFolder(file, menuItem) {
        if (menuItem) menuItem.setLoading(true);

        file.enumerate_children_async(
            this._getAttributes(),
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (obj, res) => {
                try {
                    if (!this.menu.isOpen) return;
                    let enumerator = obj.enumerate_children_finish(res);
                    this.enterFolder(file, enumerator);
                } catch (e) {
                    global.logError("Error enumerating: " + e);
                    if (menuItem) menuItem.setLoading(false);
                }
            }
        );
    }

    enterFolder(file, enumerator = null) {
        this.currentDir = file;
        this._scrollToTop();
        this._updateHeader();

        if (this.menu.actor.mapped) {
            this.menu.actor.grab_key_focus();
        }

        if (enumerator) {
            this._addFilesToMenu(enumerator);
        } else {
            this.populateCurrentDir();
        }
    }

    _clearMenu() {
        if (this._menuItems) {
            this._menuItems.forEach(item => {
                if (item && typeof item.destroy === 'function') {
                    item.destroy();
                }
            });
        }
        this._menuItems = [];
        this.menuBox.destroy_all_children();
    }

    populateCurrentDir() {
        this._clearMenu();

        let spinnerBox = new St.BoxLayout({ style: 'padding: 10px;', x_align: Clutter.ActorAlign.CENTER });
        let spinner = new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'process-working-symbolic', icon_type: St.IconType.SYMBOLIC });
        spinnerBox.add(spinner);
        this.menuBox.add_actor(spinnerBox);

        this.currentDir.enumerate_children_async(
            this._getAttributes(),
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (file, res) => {
                try {
                    let enumerator = file.enumerate_children_finish(res);
                    this._addFilesToMenu(enumerator);
                } catch (e) {
                    global.logError("Error enumerating: " + e);
                    this.menuBox.destroy_all_children();
                    let label = new St.Label({ text: _("Empty or Access Denied"), style_class: 'popup-menu-item' });
                    this.menuBox.add_actor(label);
                }
            }
        );
    }

    _addFilesToMenu(enumerator) {
        this._clearMenu();

        let info;
        let files = [];
        while ((info = enumerator.next_file(null)) != null) {
            if (this.applet.show_hidden || !info.get_is_hidden()) {
                files.push(info);
            }
        }

        let favoriteUris = (this.applet.favorites_first || this.applet.pinned_first) ? this._getFavoriteUriSet() : new Set();
        let pinnedUris = this.applet.pinned_first ? this._getPinnedUriSet() : new Set();

        let items = files.map(fileInfo => {
            let childFile = this.currentDir.get_child(fileInfo.get_name());
            let uri = childFile.get_uri();
            let isPinned = false;
            try {
                isPinned = fileInfo.get_attribute_as_string("metadata::pinned-to-top") === "true";
            } catch (e) {
                isPinned = false;
            }
            if (!isPinned && this.applet.pinned_first) {
                isPinned = pinnedUris.has(uri);
            }
            return {
                info: fileInfo,
                file: childFile,
                isDir: fileInfo.get_file_type() == Gio.FileType.DIRECTORY,
                isFavorite: favoriteUris.has(uri),
                isPinned: isPinned
            };
        });

        items.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;

            if (this.applet.favorites_first && a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
            if (this.applet.pinned_first && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

            if (this.applet.order_by == 1) { // Date modified
                let dateA = a.info.get_attribute_uint64("time::modified");
                let dateB = b.info.get_attribute_uint64("time::modified");
                return dateB - dateA;
            }

            let nameA = a.info.get_name().toLowerCase();
            let nameB = b.info.get_name().toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        if (files.length === 0) {
            let label = new St.Label({ text: _("Empty"), style: 'padding: 10px;', style_class: 'popup-inactive-menu-item' });
            this.menuBox.add_actor(label);
            return;
        }

        const showFavoriteIcons = this.applet.favorites_first;
        const showPinnedIcons = this.applet.pinned_first;
        const clipLimit = this.applet.limit_characters ? this.applet.character_limit : 0;

        items.forEach(entry => {
            let item;
            if (entry.isDir) {
                item = new FolderMenuItem(entry.file, this, {
                    showPinned: showPinnedIcons && entry.isPinned,
                    showFavorite: showFavoriteIcons && entry.isFavorite,
                    clipLimit: clipLimit
                });
            } else {
                item = new FileMenuItem(entry.file, entry.info, this, {
                    showPinned: showPinnedIcons && entry.isPinned,
                    showFavorite: showFavoriteIcons && entry.isFavorite,
                    clipLimit: clipLimit
                });
            }
            this._menuItems.push(item);
            this.menuBox.add_actor(item.actor);
        });
    }

    _getFavoriteInfos() {
        if (!this._favorites) return [];
        try {
            return this._favorites.get_favorites(null) || [];
        } catch (e) {
            return [];
        }
    }

    _getFavoriteUriSet() {
        let favorites = new Set();
        let infos = this._getFavoriteInfos();
        infos.forEach(info => {
            if (info && info.uri) favorites.add(info.uri);
        });
        return favorites;
    }

    _getPinnedUriSet() {
        let pinned = new Set();
        if (!this._favorites) return pinned;

        let pinnedInfos = [];
        if (typeof this._favorites.get_pinned === "function") {
            try {
                pinnedInfos = this._favorites.get_pinned(null) || [];
            } catch (e) {
                try {
                    pinnedInfos = this._favorites.get_pinned() || [];
                } catch (e2) {
                    pinnedInfos = [];
                }
            }
        }

        if (pinnedInfos.length === 0) {
            this._getFavoriteInfos().forEach(info => {
                if (!info) return;
                let isPinned = false;
                try {
                    isPinned = info.is_pinned || info.pinned ||
                        (typeof info.get_pinned === "function" && info.get_pinned());
                } catch (e) {
                    isPinned = false;
                }
                if (isPinned && info.uri) pinned.add(info.uri);
            });
            return pinned;
        }

        pinnedInfos.forEach(info => {
            if (info && info.uri) pinned.add(info.uri);
        });
        return pinned;
    }

    open() {
        this._scrollToTop();
        this.menu.toggle();
    }

    isFirstItem(item) {
        if (!this._menuItems || this._menuItems.length === 0) return false;
        return this._menuItems[0] === item;
    }

    focusHeader() {
        if (this.termBtn && this.termBtn.visible) {
            this.termBtn.grab_key_focus();
        } else if (this.openBtn && this.openBtn.visible) {
            this.openBtn.grab_key_focus();
        }
    }

    focusFirstItem() {
        if (this._menuItems && this._menuItems.length > 0) {
            let first = this._menuItems[0];
            if (first && first.actor && first.actor.visible) {
                first.actor.grab_key_focus();
                this._scrollItemIntoView(first.actor);
            }
        }
    }

    destroy() {
        if (this._menuOpenStateId) {
            this.menu.disconnect(this._menuOpenStateId);
            this._menuOpenStateId = 0;
        }

        if (this._menuKeyPressId) {
            this.menu.actor.disconnect(this._menuKeyPressId);
            this._menuKeyPressId = 0;
        }

        this._clearMenu();

        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }

        if (this._favorites && this._favoritesChangedId) {
            this._favorites.disconnect(this._favoritesChangedId);
            this._favoritesChangedId = 0;
        }
    }
}
