/**
 * WMM Extension - GNOME Shell Edition
 * Panel indicator for Wallpaper Multi-Monitor Manager.
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// ── Translations ──────────────────────────────────────────
const Gettext = imports.gettext;
Gettext.bindtextdomain('wmm@maki', GLib.get_user_data_dir() + '/locale');
Gettext.bindtextdomain('gnome-shell', '/usr/share/locale');

function _(text) {
    let translated = Gettext.dgettext('wmm@maki', text);
    if (translated !== text) return translated;
    return Gettext.dgettext('gnome-shell', text);
}

export default class WMMExtension {
    constructor(metadata) {
        this.metadata = metadata;
        this.appletPath = metadata.path;
        this.enginePath = this.appletPath + '/python/main.py';
        this.commandsPath = this.appletPath + '/data/commands.json';
        this.settingsPath = this.appletPath + '/data/settings.json';
        this.bookmarksPath = this.appletPath + '/data/bookmarks.json';

        this._currentMaxInterval = 60;
        this.favItems = [];
        this._button = null;
        this._menu = null;

        // Start the engine
        GLib.spawn_command_line_async('python3 ' + this.enginePath);
    }

    enable() {
        // Panel button (importación correcta de PanelMenu)
        this._button = new PanelMenu.Button(0.0, 'WMM', false);
        let icon = new St.Icon({
            icon_name: 'video-display',
            style_class: 'system-status-icon'
        });
        this._button.add_child(icon);

        // Tooltip en el botón (volvemos a lo que originalmente funcionó sin error)
        this._button.container.tooltip_text = 'WMM: ' + _('Wallpaper Multi-Monitor Manager') + '\n' +
            _('Click action') + ': ' + _('Next Background') + '\n' +
            _('Secondary Click') + ': ' + _('Context Menu');

        // Construir el menú (usando el menú del botón)
        this._menu = this._button.menu;
        this._populateMenu();

        Main.panel.addToStatusArea('wmm-indicator', this._button);
    }

    disable() {
        // Kill engine
        try {
            let pidPath = GLib.get_user_cache_dir() + '/wmm/pid_main.pid';
            let file = Gio.File.new_for_path(pidPath);
            let [success, content] = file.load_contents(null);
            if (success) {
                let pid = parseInt(content.toString().trim());
                if (pid > 0) GLib.spawn_command_line_async('kill -9 ' + pid);
            }
        } catch (e) { log('WMM cleanup: ' + e.message); }

        // Clean up the UI
        this._destroyUI();

        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }

    // ── Menu construction (same as Cinnamon) ──────────────
    _populateMenu() {
        // this._menu ya está creado en enable()

        // Next Wallpaper — primera opción del menú
        let rotateItem = new PopupMenu.PopupMenuItem(_('Next Background'));
        rotateItem.connect('activate', () => this._sendActionToEngine({ action: 'force_rotation' }));
        this._menu.addMenuItem(rotateItem);
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // Settings
        let settingsItem = new PopupMenu.PopupMenuItem('WMM ' + _('Settings'));
        settingsItem.connect('activate', () => this._openSettingsPanel());
        this._menu.addMenuItem(settingsItem);
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Bookmarks
        this.menuBookmarks = new PopupMenu.PopupSubMenuMenuItem(_('Favorites'));
        this._menu.addMenuItem(this.menuBookmarks);

        this.favRotationSwitch = new PopupMenu.PopupSwitchMenuItem(_('Favorites Only'), false);
        this.favRotationSwitch.connect('toggled', (item, state) => {
            if (state && !this.masterItem.state) this._syncTimerUI(true);
            this._updateTimerSettings();
        });
        this.menuBookmarks.menu.addMenuItem(this.favRotationSwitch);

        this.menuBookmarks.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let addBookmarkItem = new PopupMenu.PopupMenuItem(_('Add Preset Favorite'));
        addBookmarkItem.connect('activate', () => {
            GLib.spawn_command_line_async('python3 ' + this.appletPath + '/python/add_bookmark.py');
        });
        this.menuBookmarks.menu.addMenuItem(addBookmarkItem);
        this.menuBookmarks.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Timer
        this.menuTimer = new PopupMenu.PopupSubMenuMenuItem(_('Slideshow'));
        this._menu.addMenuItem(this.menuTimer);

        // Switch maestro
        this.masterItem = new PopupMenu.PopupSwitchMenuItem(_('Disabled'), false);
        this.masterItem.connect('toggled', (item, state) => {
            item.label.set_text(state ? _('Enabled') : _('Disabled'));
            this._syncTimerUI(state);
            this._updateTimerSettings();
        });
        this.menuTimer.menu.addMenuItem(this.masterItem);

        let infoItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let infoBox = new St.BoxLayout({ style: 'margin-left: 110px;' });
        this.labelMin = new St.Label({ text: '' });
        infoBox.add_child(this.labelMin);
        infoItem.add_child(infoBox);
        this.menuTimer.menu.addMenuItem(infoItem);

        // --- Selector de intervalo con SpinButton (mismo control que panel.py) ---
        let intervalItem = new PopupMenu.PopupBaseMenuItem({ activate: false });
        let intervalBox = new St.BoxLayout({ style: 'spacing: 8px;' });
        let minusBtn = new St.Button({ label: '−', style_class: 'button' });
        this.intervalLabel = new St.Label({ text: '15 ' + _('minutes') });
        let plusBtn = new St.Button({ label: '+', style_class: 'button' });

        this._currentInterval = 15; // valor por defecto

        minusBtn.connect('clicked', () => {
            if (this._currentInterval > 1) {
                this._currentInterval--;
                this.intervalLabel.set_text(this._currentInterval + ' ' + _('minutes'));
                if (this.masterItem && this.masterItem.state) this._updateTimerSettings();
            }
        });
        plusBtn.connect('clicked', () => {
            if (this._currentInterval < 60) {
                this._currentInterval++;
                this.intervalLabel.set_text(this._currentInterval + ' ' + _('minutes'));
                if (this.masterItem && this.masterItem.state) this._updateTimerSettings();
            }
        });

        intervalBox.add_child(minusBtn);
        intervalBox.add_child(this.intervalLabel);
        intervalBox.add_child(plusBtn);
        intervalItem.add_child(intervalBox);
        this.menuTimer.menu.addMenuItem(intervalItem);

        // Switch modo sync/async
        this.modeSwitch = new PopupMenu.PopupSwitchMenuItem(_('Displays') + ': ' + _('ASYNC (One)'), false);
        this.modeSwitch.connect('toggled', (item, state) => {
            item.label.set_text(state ? _('Displays') + ': ' + _('SYNC (All)') : _('Displays') + ': ' + _('ASYNC (One)'));
            this._updateTimerSettings();
        });
        this._menu.addMenuItem(this.modeSwitch);

        // Switch spanned
        this.spannedSwitch = new PopupMenu.PopupSwitchMenuItem(_('Spanned Mode'), false);
        this.spannedSwitch.connect('toggled', () => this._updateTimerSettings());
        this._menu.addMenuItem(this.spannedSwitch);

        // Footer
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let syncItem = new PopupMenu.PopupMenuItem(_('Sync Library'));
        syncItem.connect('activate', () => this._sendActionToEngine({ action: 'sync_library' }));
        this._menu.addMenuItem(syncItem);

        let helpItem = new PopupMenu.PopupMenuItem(_('Help'));
        helpItem.connect('activate', () => {
            GLib.spawn_command_line_async('python3 ' + this.appletPath + '/python/help_viewer.py');
        });
        this._menu.addMenuItem(helpItem);

        this._menuOpenSignalId = this._menu.connect('open-state-changed', (menu, open) => {
            if (open) this._refreshSettingsFromDisk();
        });
    }

    _syncTimerUI(enabled) {
        if (!this.masterItem) return;
        this.masterItem.setToggleState(enabled);
        this.masterItem.label.set_text(enabled ? _('Enabled') : _('Disabled'));
    }

    _refreshSettingsFromDisk() {
        try {
            let [s, content] = GLib.file_get_contents(this.settingsPath);
            if (!s) return;
            let config = JSON.parse(content.toString()).global;
            this._currentMaxInterval = config.slideshow_max_interval || 60;
            let isEnabled = config.slideshow_enabled;
            let isSync = (config.slideshow_mode === 'sync');
            let isFavSlideshow = config.slideshow_bookmark || false;
            this._syncTimerUI(isEnabled);
            this.modeSwitch.setToggleState(isSync);
            this.modeSwitch.label.set_text(isSync ? _('Displays') + ': ' + _('SYNC (All)') : _('Displays') + ': ' + _('ASYNC (One)'));
            this.favRotationSwitch.setToggleState(isFavSlideshow);
            this._currentInterval = config.slideshow_interval || 15;
            this.intervalLabel.set_text(this._currentInterval + ' ' + _('minutes'));
            let isSpanned = config.spanned_enabled || false;
            this.spannedSwitch.setToggleState(isSpanned);
            this._refreshBookmarks();
        } catch (e) {
            log('WMM refresh: ' + e.message);
        }
    }

    _refreshBookmarks() {
        this.favItems.forEach(item => item.destroy());
        this.favItems = [];
        try {
            let [s, content] = GLib.file_get_contents(this.bookmarksPath);
            if (!s) return;
            let bookmarks = JSON.parse(content.toString());
            let keys = Object.keys(bookmarks);
            log('WMM bookmarks: ' + keys.length + ' presets found');
            if (keys.length === 0) {
                let info = new PopupMenu.PopupMenuItem(_('No saved favorites'), { reactive: false });
                this.menuBookmarks.menu.addMenuItem(info);
                this.favItems.push(info);
                return;
            }
            // Contenedor sin usar actor
            let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, activate: false });
            let favBox = new St.BoxLayout({
                vertical: true,
                style: 'margin-left: 10px; padding: 0;'
            });
            keys.forEach(name => {
                let row = new St.BoxLayout({ style: 'padding: 3px 0px; spacing: 0px;' });
                let nameBtn = new St.Button({
                    reactive: true,
                    can_focus: true,
                    track_hover: true,
                });
                let nameLabel = new St.Label({
                    text: name,
                    style: 'overflow: hidden; white-space: nowrap; text-overflow: ellipsis;'
                });
                nameBtn.set_child(nameLabel);
                nameBtn.connect('clicked', () => {
                    this._syncTimerUI(false);
                    this._sendActionToEngine({ action: 'load_bookmark', name: name, timer_force_off: true });
                    this._button.menu.close();
                });
                let deleteBtn = new St.Button({ reactive: true, can_focus: true, track_hover: true });
                deleteBtn.set_width(28);
                let deleteIcon = new St.Icon({
                    icon_name: 'user-trash-symbolic',
                    style_class: 'popup-menu-icon',
                    icon_size: 16,
                    reactive: false
                });
                deleteBtn.set_child(deleteIcon);
                deleteBtn.connect('clicked', () => {
                    this._confirmDeleteBookmark(name);
                    this._button.menu.close();
                });
                row.add_child(nameBtn, { expand: true, x_fill: true });
                row.add_child(deleteBtn);
                favBox.add_child(row, { expand: true, x_fill: true });
            });
            let scrollView = new St.ScrollView({
                hscrollbar_policy: St.PolicyType.AUTOMATIC,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
                style: 'border: none; background-color: transparent; padding: 0; margin: 0;'
            });
            scrollView.set_size(200, Math.min(keys.length * 38, 125));
            scrollView.add_child(favBox);
            scrollItem.add_child(scrollView, { expand: false });
            log('WMM bookmarks: adding scrollItem to menu');
            this.menuBookmarks.menu.addMenuItem(scrollItem);
            this.favItems.push(scrollItem);
        } catch (e) {
            log('WMM bookmarks: ' + e.message);
        }
    }

    _confirmDeleteBookmark(name) {
        let args = ['--question', '--title=' + _('Delete favorite'), '--text=' + _('Delete') + ' "' + name + '"?', '--width=200'];
        try {
            let proc = new Gio.Subprocess({ argv: ['zenity'].concat(args), flags: Gio.SubprocessFlags.NONE });
            proc.init(null);
            proc.wait_async(null, (proc, result) => {
                try {
                    proc.wait_finish(result);
                    if (proc.get_exit_status() === 0)
                        this._sendActionToEngine({ action: 'delete_bookmark', name: name });
                } catch (e) { log('WMM zenity: ' + e.message); }
            });
        } catch (e) {
            log('WMM zenity launch: ' + e.message);
        }
    }

    _updateTimerSettings() {
        this._sendActionToEngine({
            action: 'update_timer_settings',
            enabled: this.masterItem.state,
            interval: this._currentInterval, // ← ya no usa slider.value
            mode: this.modeSwitch.state ? 'sync' : 'async',
            slideshow_bookmark: this.favRotationSwitch.state,
            spanned_enabled: this.spannedSwitch.state
        });
    }

    _sendActionToEngine(command) {
        try {
            let file = Gio.File.new_for_path(this.commandsPath);
            let raw = JSON.stringify(command, null, 4);
            file.replace_contents_async(
                new GLib.Bytes(raw),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
                (obj, result) => {
                    try {
                        obj.replace_contents_finish(result);
                    } catch (e) {
                        log('WMM write: ' + e.message);
                    }
                }
            );
        } catch (e) {
            log('WMM send: ' + e.message);
        }
    }

    _openSettingsPanel() {
        GLib.spawn_command_line_async('python3 ' + this.appletPath + '/python/panel.py');
    }

    _destroyUI() {

        // Desconectar señal del menú
        if (this._menu && this._menuOpenSignalId) {
            this._menu.disconnect(this._menuOpenSignalId);
            this._menuOpenSignalId = null;
        }

        // Destruir los switches y liberar referencias
        if (this.masterItem) {
            this.masterItem.destroy();
            this.masterItem = null;
        }
        if (this.favRotationSwitch) {
            this.favRotationSwitch.destroy();
            this.favRotationSwitch = null;
        }
        if (this.modeSwitch) {
            this.modeSwitch.destroy();
            this.modeSwitch = null;
        }
        if (this.spannedSwitch) {
            this.spannedSwitch.destroy();
            this.spannedSwitch = null;
        }

        // Destruir submenús
        if (this.menuBookmarks) {
            this.menuBookmarks.destroy();
            this.menuBookmarks = null;
        }
        if (this.menuTimer) {
            this.menuTimer.destroy();
            this.menuTimer = null;
        }

        // Destruir etiquetas y otros widgets
        if (this.intervalLabel) {
            this.intervalLabel.destroy();
            this.intervalLabel = null;
        }
        if (this.labelMin) {
            this.labelMin.destroy();
            this.labelMin = null;
        }
        if (this._masterLabel) {
            this._masterLabel.destroy();
            this._masterLabel = null;
        }
        if (this._modeLabel) {
            this._modeLabel.destroy();
            this._modeLabel = null;
        }

        // Destruir elementos de favoritos
        this.favItems.forEach(item => item.destroy());
        this.favItems = [];

        // Destruir menú si no se hizo ya
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }
    }
}
