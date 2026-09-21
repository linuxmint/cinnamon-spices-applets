// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 TitasDas
// See COPYING.md and LICENSE for terms and warranty disclaimer.

const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gettext = imports.gettext;

const UUID = 'desktop-drawer@linux-automations';
const MAX_DEPTH = 2;
const MAX_ITEMS = 30;
const QUERY = 'standard::name,standard::display-name,standard::type,standard::is-hidden';
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(text) { return Gettext.dgettext(UUID, text); }

class DesktopDrawerApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._removed = false;
        this._hoverTimer = 0;
        this._generation = 0;
        this._cancellable = new Gio.Cancellable();
        this.set_applet_icon_path(GLib.build_filenamev([metadata.path, 'icons', 'desktop-vault.svg']));
        this.set_applet_tooltip(_('Desktop Drawer: browse your files'));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect('open-state-changed', (menu, open) => {
            if (!open) this._resetReads();
        });
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind('folder', 'folder', () => this._settingsChanged());
        this.settings.bind('open-on-hover', 'openOnHover', () => this._settingsChanged());
        this.settings.bind('hover-delay', 'hoverDelay', () => this._settingsChanged());
        this._enterSignal = this.actor.connect('enter-event', () => {
            this._cancelHover();
            if (!this.openOnHover || this.menu.isOpen || global.settings.get_boolean('panel-edit-mode'))
                return false;
            this._hoverTimer = Mainloop.timeout_add(this.hoverDelay, () => {
                this._hoverTimer = 0;
                if (!this._removed && this.actor.hover && !this.menu.isOpen)
                    this._openDrawer();
                return GLib.SOURCE_REMOVE;
            });
            return false;
        });
        this._leaveSignal = this.actor.connect('leave-event', () => {
            this._cancelHover();
            return false;
        });
    }

    _cancelHover() {
        if (this._hoverTimer) {
            Mainloop.source_remove(this._hoverTimer);
            this._hoverTimer = 0;
        }
    }

    _resetReads() {
        this._cancellable.cancel();
        this._cancellable = new Gio.Cancellable();
        this._generation++;
    }

    _settingsChanged() {
        this._cancelHover();
        this._resetReads();
        this.menu.close();
    }

    async _rootPath(cancellable) {
        let selected = this.folder || '';
        if (selected.startsWith('file://'))
            selected = Gio.File.new_for_uri(selected).get_path();
        if (selected === '~') selected = GLib.get_home_dir();
        else if (selected.startsWith('~/'))
            selected = GLib.build_filenamev([GLib.get_home_dir(), selected.slice(2)]);
        if (selected) {
            if (!GLib.path_is_absolute(selected))
                throw new Error('Choose an absolute local folder path');
            return selected;
        }
        const desktop = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) || GLib.get_home_dir();
        const organized = GLib.build_filenamev([desktop, 'Organized Desktop']);
        const exists = await new Promise(resolve => {
            const file = Gio.File.new_for_path(organized);
            file.query_info_async('standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                    try { resolve(source.query_info_finish(result).get_file_type() === Gio.FileType.DIRECTORY); }
                    catch (error) { resolve(false); }
                });
        });
        return exists ? organized : desktop;
    }

    on_applet_clicked() {
        this._cancelHover();
        if (this.menu.isOpen) this.menu.close(true);
        else this._openDrawer();
    }

    async _openDrawer() {
        this._resetReads();
        const generation = this._generation;
        const cancellable = this._cancellable;
        this.menu.removeAll();
        this._message(this.menu, _('Loading files...'));
        this.menu.open(true);
        try {
            const path = await this._rootPath(cancellable);
            if (this._removed || generation !== this._generation) return;
            this.menu.removeAll();
            const heading = this._message(this.menu, this._shortLabel(Gio.File.new_for_path(path).get_basename() || path));
            heading.actor.add_style_class_name('drawer-heading');
            this._openFolderItem(this.menu, path, _('Open folder'));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            // Choosing a Private directory explicitly must not expose its contents either.
            if (Gio.File.new_for_path(path).get_basename().toLowerCase() === 'private') {
                this._message(this.menu, _('Private folder contents are hidden.'));
                this._addSettingsAction();
                return;
            }
            await this._populate(this.menu, path, 0, generation, cancellable);
            if (!this._removed && generation === this._generation) this._addSettingsAction();
        } catch (error) {
            if (!this._removed && generation === this._generation) {
                this.menu.removeAll();
                this._message(this.menu, _('Cannot read this folder.'));
                this._addSettingsAction();
            }
        }
    }

    _addSettingsAction() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const item = new PopupMenu.PopupIconMenuItem(_('Choose folder'), 'preferences-system-symbolic', St.IconType.SYMBOLIC);
        item.connect('activate', () => {
            this.menu.close();
            this.configureApplet();
        });
        this.menu.addMenuItem(item);
    }

    _message(menu, text) {
        const item = new PopupMenu.PopupMenuItem(text, { reactive: false });
        menu.addMenuItem(item);
        return item;
    }

    async _readDirectory(path, cancellable) {
        const directory = Gio.File.new_for_path(path);
        const enumerator = await new Promise((resolve, reject) => {
            directory.enumerate_children_async(QUERY, Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                    try { resolve(source.enumerate_children_finish(result)); }
                    catch (error) { reject(error); }
                });
        });
        const entries = [];
        let truncated = false;
        // Bound total work too: a directory full of hidden files must not cause an unbounded scan.
        let scanned = 0;
        try {
            while (entries.length <= MAX_ITEMS && scanned < 300) {
                const batch = await new Promise((resolve, reject) => {
                    enumerator.next_files_async(30, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                        try { resolve(source.next_files_finish(result)); }
                        catch (error) { reject(error); }
                    });
                });
                if (!batch.length) break;
                scanned += batch.length;
                for (const info of batch) {
                    if (info.get_is_hidden()) continue;
                    const name = info.get_name();
                    entries.push({ name, label: info.get_display_name() || name,
                        path: GLib.build_filenamev([path, name]),
                        isDirectory: info.get_file_type() === Gio.FileType.DIRECTORY });
                    if (entries.length > MAX_ITEMS) break;
                }
            }
            truncated = entries.length > MAX_ITEMS || scanned >= 300;
        } finally {
            // Close even when the read was cancelled; do not reuse its cancelled token.
            enumerator.close_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
                try { source.close_finish(result); } catch (error) { /* best-effort cleanup */ }
            });
        }
        entries.sort((a, b) => a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.label.localeCompare(b.label));
        return { entries: entries.slice(0, MAX_ITEMS), truncated };
    }

    async _populate(menu, path, depth, generation, cancellable) {
        const loading = this._message(menu, _('Loading files...'));
        try {
            const result = await this._readDirectory(path, cancellable);
            if (this._removed || generation !== this._generation) return;
            loading.destroy();
            if (!result.entries.length) this._message(menu, _('No files to show.'));
            for (const entry of result.entries) {
                if (entry.name.toLowerCase() === 'private')
                    this._openFolderItem(menu, entry.path, _('Open Private folder'));
                else if (entry.isDirectory)
                    this._addDirectoryMenu(menu, entry, depth, generation, cancellable);
                else this._addFileItem(menu, entry);
            }
            if (result.truncated)
                this._message(menu, _('More files may be available in the file manager.'));
        } catch (error) {
            if (this._removed || generation !== this._generation) return;
            loading.destroy();
            this._message(menu, _('Cannot read this folder.'));
        }
    }

    _addDirectoryMenu(parent, entry, depth, generation, cancellable) {
        const submenu = new PopupMenu.PopupSubMenuMenuItem(this._shortLabel(entry.label));
        parent.addMenuItem(submenu);
        this._openFolderItem(submenu.menu, entry.path, _('Open this folder'));
        let loaded = false;
        submenu.menu.connect('open-state-changed', (menu, open) => {
            if (!open || loaded || depth >= MAX_DEPTH) return;
            loaded = true;
            this._populate(submenu.menu, entry.path, depth + 1, generation, cancellable);
        });
        submenu.actor.connect('enter-event', () => {
            if (this.openOnHover && !submenu.menu.isOpen) submenu.menu.open(true);
            return false;
        });
    }

    _openFolderItem(menu, path, label) {
        const item = new PopupMenu.PopupIconMenuItem(label, 'folder-open-symbolic', St.IconType.SYMBOLIC);
        item.connect('activate', () => this._openPath(path));
        menu.addMenuItem(item);
    }

    _addFileItem(menu, entry) {
        const item = new PopupMenu.PopupIconMenuItem(this._shortLabel(entry.label), 'text-x-generic-symbolic', St.IconType.SYMBOLIC);
        item.connect('activate', () => this._openPath(entry.path));
        menu.addMenuItem(item);
    }

    _shortLabel(text) {
        return text.length <= 44 ? text : Array.from(text).slice(0, 20).join('') + '...' + Array.from(text).slice(-20).join('');
    }

    _openPath(path) {
        this.menu.close();
        const uri = Gio.File.new_for_path(path).get_uri();
        Gio.AppInfo.launch_default_for_uri_async(uri, global.create_app_launch_context(), null, (source, result) => {
            try { Gio.AppInfo.launch_default_for_uri_finish(result); }
            catch (error) {
                // Do not record personal filenames in the Cinnamon log.
                if (!this._removed) Main.notifyError(_('Could not open this item'),
                    _('Check its default application in your file manager.'));
            }
        });
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        this._cancelHover();
        this._cancellable.cancel();
        this._generation++;
        this.settings.finalize();
        if (this._enterSignal) this.actor.disconnect(this._enterSignal);
        if (this._leaveSignal) this.actor.disconnect(this._leaveSignal);
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new DesktopDrawerApplet(metadata, orientation, panelHeight, instanceId);
}
