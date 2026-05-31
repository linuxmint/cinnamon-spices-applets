// applet.js — Display Switcher: UI, Settings, Hotplug (backend-neutral)

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const DisplayBackend = require('./displayBackend');
const DisplayInfo = require('./displayInfo');

/** Debounce time after monitors-changed (ms) to let xrandr settle after hotplug */
const HOTPLUG_DEBOUNCE_MS = 300;

/** All configurable keybindings: [id, settingsKey, callback] */
const KEY_BINDINGS = [
    ['display-switcher-open', 'keyOpen', '_onKeyOpen'],
    ['display-switcher-laptop', 'keyLaptop', '_onKeyLaptop'],
    ['display-switcher-external', 'keyExternal', '_onKeyExternal'],
    ['display-switcher-mirror', 'keyMirror', '_onKeyMirror'],
    ['display-switcher-extend', 'keyExtend', '_onKeyExtend']
];

class MintDisplaySwitcherApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._metadata = metadata;
        this._instance_id = instance_id;

        // Display backend (X11 or Wayland)
        this._backend = DisplayBackend.createDisplayBackend();

        // Bind applet settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind('autoApplyOnConnect', 'autoApplyOnConnect');
        this.settings.bind('revertOnDisconnect', 'revertOnDisconnect');
        this.settings.bind('hidePanelIcon', 'hidePanelIcon', () => this._applyIconVisibility());
        this.settings.bind('lastMode', 'lastMode');
        this.settings.bind('extendPosition', 'extendPosition');
        this.settings.bind('preferredExternal', 'preferredExternal');
        this.settings.bind('keyOpen', 'keyOpen', () => this._setKeybindings());
        this.settings.bind('keyLaptop', 'keyLaptop', () => this._setKeybindings());
        this.settings.bind('keyExternal', 'keyExternal', () => this._setKeybindings());
        this.settings.bind('keyMirror', 'keyMirror', () => this._setKeybindings());
        this.settings.bind('keyExtend', 'keyExtend', () => this._setKeybindings());

        // Set up popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Zustand
        this._snapshot = null;
        this._currentMode = DisplayInfo.MODES.LAPTOP;
        this._externalWasConnected = false;
        this._hotplugTimeoutId = 0;
        this._menuPage = 'main'; // 'main' | 'settings'
        this._chooser = null;    // Zentriertes Band-Overlay (Win+P-Stil)
        this._chooserTiles = [];
        this._chooserFocusIndex = 0;
        this._chooserKeyHandlerId = 0;
        this._chooserBandKeyHandlerId = 0;

        // Hotplug: Meta.MonitorManager (X11 + Wayland detection)
        this._monitorManager = Meta.MonitorManager.get();
        this._monitorsChangedId = this._monitorManager.connect(
            'monitors-changed', () => this._scheduleHotplugRefresh());

        // Initial display state
        this._refreshDisplays();
        this._externalWasConnected = this._hasConnectedExternal();

        this._setKeybindings();
        this._updatePanelIcon(this._currentMode);
        this._applyIconVisibility();
    }

    /** Show or hide the panel icon based on the setting */
    _applyIconVisibility() {
        if (!this.actor)
            return;
        if (this.hidePanelIcon)
            this.actor.hide();
        else
            this.actor.show();
    }

    /** Build options object from settings for backend calls */
    _getBackendOptions() {
        return {
            extendPosition: this.extendPosition || 'right-of',
            preferredExternal: this.preferredExternal || ''
        };
    }

    /** Remove and re-register all keybindings */
    _setKeybindings() {
        for (const [id, settingsKey, handlerName] of KEY_BINDINGS) {
            Main.keybindingManager.removeXletHotKey(this, id);
            const binding = this[settingsKey];
            if (binding) {
                const registered = Main.keybindingManager.addXletHotKey(
                    this, id, binding, () => this[handlerName]());
                // If registration failed the binding is likely taken by a system shortcut
                // (e.g. switch-monitor). Warn the user once so they can free it via
                // System Settings → Keyboard → Shortcuts → Hardware → Toggle displays.
                if (!registered)
                    this._warnKeybindingConflict(binding);
            }
        }
    }

    /**
     * Shows a one-time notification when a keybinding could not be registered
     * because it conflicts with an existing system shortcut.
     * The user should free it via System Settings → Keyboard → Shortcuts.
     * @param {string} binding — e.g. "<Super>p"
     */
    _warnKeybindingConflict(binding) {
        const key = 'warnedBinding_' + binding.replace(/[^a-zA-Z0-9]/g, '_');
        if (this[key])
            return;
        this[key] = true;

        const label = binding.replace('<Super>', 'Super+').replace('<Shift>', 'Shift+')
            .replace('<Control>', 'Ctrl+').replace('<Alt>', 'Alt+');
        Main.notify(
            _('Display Switcher'),
            _('The shortcut %s is already used by the system. To use it here, go to System Settings → Keyboard → Shortcuts → Hardware → "Toggle displays" and remove %s there.').format(label, label)
        );
    }

    _onKeyOpen() { this._openModeChooser(); }
    _onKeyLaptop() { this._applyModeFromHotkey(DisplayInfo.MODES.LAPTOP); }
    _onKeyExternal() { this._applyModeFromHotkey(DisplayInfo.MODES.EXTERNAL); }
    _onKeyMirror() { this._applyModeFromHotkey(DisplayInfo.MODES.MIRROR); }
    _onKeyExtend() { this._applyModeFromHotkey(DisplayInfo.MODES.EXTEND); }

    /** Apply a mode directly via hotkey */
    _applyModeFromHotkey(mode) {
        if (!this._backend.canApplyModes())
            return;
        if (!DisplayInfo.isModeAvailable(mode, this._snapshot)) {
            Main.notify(
                _('Display Switcher'),
                _('Mode "%s" is not available right now').format(DisplayInfo.MODE_LABELS[mode]));
            return;
        }
        this._applyMode(mode, true);
    }

    /** Update panel icon and tooltip to reflect the active mode */
    _updatePanelIcon(mode) {
        const icon = DisplayInfo.MODE_ICONS[mode] || 'display';
        const label = DisplayInfo.MODE_LABELS[mode] || 'Unknown';
        this.set_applet_icon_symbolic_name(icon);
        this.set_applet_tooltip(_('Display Switcher — %s').format(_(label)));
    }

    /** Read display state from backend and detect current mode */
    _refreshDisplays() {
        this._snapshot = this._backend.getSnapshot(this._getBackendOptions());
        this._currentMode = DisplayInfo.detectMode(this._snapshot);
        this._updatePanelIcon(this._currentMode);
    }

    /** Is an external display physically connected (even if off)? */
    _hasConnectedExternal() {
        return this._snapshot &&
            this._snapshot.external &&
            this._snapshot.external.connected;
    }

    /** Debounced refresh after hotplug */
    _scheduleHotplugRefresh() {
        if (this._hotplugTimeoutId)
            Mainloop.source_remove(this._hotplugTimeoutId);

        this._hotplugTimeoutId = Mainloop.timeout_add(
            HOTPLUG_DEBOUNCE_MS, () => {
                this._hotplugTimeoutId = 0;
                this._onMonitorsChanged();
                return GLib.SOURCE_REMOVE;
            });
    }

    /** React to an external display being connected or disconnected */
    _onMonitorsChanged() {
        const wasConnected = this._externalWasConnected;

        this._refreshDisplays();
        const isConnected = this._hasConnectedExternal();

        if (!wasConnected && isConnected) {
            if (this.autoApplyOnConnect &&
                DisplayInfo.isModeAvailable(this.lastMode, this._snapshot) &&
                this._backend.canApplyModes()) {
                this._applyMode(this.lastMode, true);
            }
        }

        if (wasConnected && !isConnected) {
            if (this.revertOnDisconnect && this._backend.canApplyModes())
                this._applyMode(DisplayInfo.MODES.LAPTOP, true);
        }

        this._externalWasConnected = isConnected;
    }

    /**
     * Apply a display mode and persist it.
     * @param {string} mode
     * @param {boolean} notify — show desktop notification
     */
    _applyMode(mode, notify = true) {
        const result = this._backend.applyMode(mode, this._getBackendOptions());

        if (!result.success) {
            if (result.fallback === 'settings-opened') {
                Main.notify(
                    _('Display Switcher'),
                    _('Wayland: please use Display Settings to switch modes'));
            } else {
                Main.notifyError(_('Display Switcher'), result.error);
            }
            return;
        }

        this.settings.setValue('lastMode', mode);
        this._refreshDisplays();

        if (notify) {
            Main.notify(
                _('Display Switcher'),
                _('%s activated').format(_(DisplayInfo.MODE_LABELS[mode])));
        }

        this.menu.close();
    }

    /** Menü öffnen (Klick oder Tastenkürzel) */
    _openMenu() {
        this._menuPage = 'main';
        this._refreshDisplays();
        this._buildMenu();
        this.menu.toggle();
    }

    /**
     * Open the centred Win+P-style band overlay.
     * Four mode tiles + settings tile in the band, navigable with ← → arrow keys.
     */
    _openModeChooser() {
        if (this._chooser) {
            this._closeModeChooser();
            return;
        }

        this._refreshDisplays();

        const dialog = new ModalDialog.ModalDialog({
            styleClass: 'display-switcher-modal',
            destroyOnClose: true
        });
        this._chooser = dialog;
        this._chooserTiles = [];
        this._chooserFocusIndex = 0;

        // Titelzeile
        const title = new St.Label({
            text: _('Project'),
            style_class: 'display-switcher-band-title',
            x_align: Clutter.ActorAlign.CENTER
        });
        dialog.contentLayout.add_child(title);

        // Horizontales Band: vier Modi + Einstellungen
        const band = new St.BoxLayout({
            vertical: false,
            style_class: 'display-switcher-band'
        });
        dialog.contentLayout.add_child(band);

        const canApply = this._backend.canApplyModes();
        const modes = [
            DisplayInfo.MODES.LAPTOP,
            DisplayInfo.MODES.EXTERNAL,
            DisplayInfo.MODES.MIRROR,
            DisplayInfo.MODES.EXTEND
        ];

        for (const mode of modes) {
            const enabled = canApply && DisplayInfo.isModeAvailable(mode, this._snapshot);
            const button = this._createModeTile(mode, enabled);
            band.add_child(button);
            this._chooserTiles.push({ button, mode, enabled });
        }

        // Einstellungs-Kachel im Band (wie zuvor)
        const settingsButton = this._createSettingsTile();
        band.add_child(settingsButton);
        this._chooserTiles.push({ button: settingsButton, mode: 'settings', enabled: true });

        this._setupChooserKeyNav(dialog, band);

        dialog.connect('closed', () => {
            this._chooser = null;
            this._chooserTiles = [];
        });

        dialog.open(global.get_current_time());

        const startIndex = this._findChooserStartIndex();
        this._focusChooserTile(startIndex);
    }

    /** Start index for keyboard focus: active mode or first tile */
    _findChooserStartIndex() {
        const currentIdx = this._chooserTiles.findIndex(
            t => t.mode === this._currentMode && t.enabled);
        if (currentIdx >= 0)
            return currentIdx;
        const firstEnabled = this._chooserTiles.findIndex(t => t.enabled);
        return firstEnabled >= 0 ? firstEnabled : 0;
    }

    /** Arrow-key navigation and Enter/Esc handling for the band overlay */
    _setupChooserKeyNav(dialog, band) {
        const handler = (actor, event) => {
            const symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                this._closeModeChooser();
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_Left) {
                this._moveChooserFocus(-1);
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_Right) {
                this._moveChooserFocus(1);
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                this._activateFocusedTile();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        };

        dialog.connect('opened', () => {
            this._chooserKeyHandlerId = dialog.actor.connect('key-press-event', handler);
            this._chooserBandKeyHandlerId = band.connect('key-press-event', handler);
        });

        dialog.connect('closed', () => {
            if (this._chooserKeyHandlerId) {
                dialog.actor.disconnect(this._chooserKeyHandlerId);
                this._chooserKeyHandlerId = 0;
            }
            if (this._chooserBandKeyHandlerId) {
                band.disconnect(this._chooserBandKeyHandlerId);
                this._chooserBandKeyHandlerId = 0;
            }
        });
    }

    /** Set visual and keyboard focus on a tile */
    _focusChooserTile(index) {
        if (!this._chooserTiles.length)
            return;

        // Remove focus style from all tiles
        for (const tile of this._chooserTiles)
            tile.button.remove_style_class_name('display-switcher-tile-focused');

        // Clamp index
        index = ((index % this._chooserTiles.length) + this._chooserTiles.length) % this._chooserTiles.length;
        this._chooserFocusIndex = index;

        const tile = this._chooserTiles[index];
        tile.button.add_style_class_name('display-switcher-tile-focused');
        tile.button.grab_key_focus();
    }

    /** Arrow key: jump to next/previous tile, skipping disabled ones */
    _moveChooserFocus(delta) {
        const count = this._chooserTiles.length;
        if (!count)
            return;

        let idx = this._chooserFocusIndex;
        for (let i = 0; i < count; i++) {
            idx = (idx + delta + count) % count;
            if (this._chooserTiles[idx].enabled) {
                this._focusChooserTile(idx);
                return;
            }
        }
        // No enabled tile found — focus anyway
        this._focusChooserTile(idx);
    }

    /** Enter: activate the focused tile */
    _activateFocusedTile() {
        const tile = this._chooserTiles[this._chooserFocusIndex];
        if (!tile || !tile.enabled)
            return;

        if (tile.mode === 'settings') {
            this._closeModeChooser();
            Mainloop.idle_add(() => {
                this._openSettingsPage();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._closeModeChooser();
        this._applyMode(tile.mode, true);
    }

    /** Close the band overlay */
    _closeModeChooser() {
        if (!this._chooser)
            return;
        const dialog = this._chooser;
        this._chooser = null;
        dialog.close(global.get_current_time());
    }

    /**
     * Create a mode tile (large icon + label) for the band.
     * @param {string} mode
     * @param {boolean} enabled
     * @returns {St.Button}
     */
    _createModeTile(mode, enabled) {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'display-switcher-tile-box'
        });

        const icon = new St.Icon({
            icon_name: DisplayInfo.MODE_ICONS[mode],
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 40,
            style_class: 'display-switcher-tile-icon'
        });
        box.add_child(icon);

        const label = new St.Label({
            text: _(DisplayInfo.MODE_LABELS[mode]),
            style_class: 'display-switcher-tile-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        box.add_child(label);

        let styleClass = 'display-switcher-tile';
        if (this._currentMode === mode)
            styleClass += ' display-switcher-tile-selected';
        if (!enabled)
            styleClass += ' display-switcher-tile-disabled';

        const button = new St.Button({
            style_class: styleClass,
            can_focus: true,
            reactive: enabled,
            track_hover: enabled,
            child: box
        });

        if (enabled) {
            button.connect('clicked', () => {
                this._closeModeChooser();
                this._applyMode(mode, true);
            });
        }

        return button;
    }

    /** Settings tile in the band (gear icon + label) */
    _createSettingsTile() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'display-switcher-tile-box'
        });

        const icon = new St.Icon({
            icon_name: 'xsi-preferences-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 40,
            style_class: 'display-switcher-tile-icon'
        });
        box.add_child(icon);

        const label = new St.Label({
            text: _('Settings'),
            style_class: 'display-switcher-tile-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        box.add_child(label);

        const button = new St.Button({
            style_class: 'display-switcher-tile',
            can_focus: true,
            reactive: true,
            track_hover: true,
            child: box
        });

        button.connect('clicked', () => {
            this._closeModeChooser();
            Mainloop.idle_add(() => {
                this._openSettingsPage();
                return GLib.SOURCE_REMOVE;
            });
        });

        return button;
    }

    /** Show the settings page in the popup menu */
    _openSettingsPage() {
        this._menuPage = 'settings';
        this._buildMenu();
        if (!this.menu.isOpen)
            this.menu.open(true);
    }

    /** Externen xlet-settings-Dialog öffnen (Fallback) */
    _openExternalSettingsDialog() {
        this.menu.close();
        Mainloop.idle_add(() => {
            const uuid = this._uuid || this._metadata.uuid;
            const cmd = 'xlet-settings applet ' + uuid + ' -i ' + this.instance_id + ' -t 0';
            try {
                GLib.spawn_command_line_async(cmd);
            } catch (e) {
                global.logError('[MintDisplaySwitcher] xlet-settings fehlgeschlagen: ' + e.message);
                Util.spawnCommandLineAsync('cinnamon-settings applets');
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    /** Format a keybinding for display in the menu */
    _formatKeyHint(settingsKey) {
        const binding = this[settingsKey];
        if (!binding)
            return '';
        return binding
            .replace(/<Super>/g, 'Super+')
            .replace(/<Shift>/g, 'Shift+')
            .replace(/<Primary>/g, 'Strg+')
            .replace(/<Alt>/g, 'Alt+')
            .replace(/[<>]/g, '');
    }

    /** Popup-Menü aufbauen (Haupt- oder Einstellungsseite) */
    _buildMenu() {
        this.menu.removeAll();

        if (this._menuPage === 'settings') {
            this._buildSettingsPage();
            return;
        }

        this._buildMainPage();
    }

    /** Main page: display modes */
    _buildMainPage() {
        const infoText = DisplayInfo.formatInfoLine(this._snapshot);
        const infoItem = new PopupMenu.PopupMenuItem(infoText, {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        infoItem.label.clutter_text.set_line_wrap(true);
        this.menu.addMenuItem(infoItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button at the top
        const settingsBtn = new PopupMenu.PopupIconMenuItem(
            _('Settings'),
            'xsi-preferences',
            St.IconType.SYMBOLIC);
        settingsBtn.connect('activate', () => this._openSettingsPage());
        this.menu.addMenuItem(settingsBtn);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const canApply = this._backend.canApplyModes();
        const modeKeys = {
            [DisplayInfo.MODES.LAPTOP]: 'keyLaptop',
            [DisplayInfo.MODES.EXTERNAL]: 'keyExternal',
            [DisplayInfo.MODES.MIRROR]: 'keyMirror',
            [DisplayInfo.MODES.EXTEND]: 'keyExtend'
        };
        const modes = [
            DisplayInfo.MODES.LAPTOP,
            DisplayInfo.MODES.EXTERNAL,
            DisplayInfo.MODES.MIRROR,
            DisplayInfo.MODES.EXTEND
        ];

        for (const mode of modes) {
            const available = DisplayInfo.isModeAvailable(mode, this._snapshot);
            let label = _(DisplayInfo.MODE_LABELS[mode]);
            const keyHint = this._formatKeyHint(modeKeys[mode]);
            if (keyHint)
                label += '  (' + keyHint + ')';

            const item = new PopupMenu.PopupIconMenuItem(
                label,
                DisplayInfo.MODE_ICONS[mode],
                St.IconType.SYMBOLIC);

            if (this._currentMode === mode)
                item.setShowDot(true);

            if (!canApply || !available) {
                item.setSensitive(false);
            } else {
                item.connect('activate', () => this._applyMode(mode, true));
            }

            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addAction(_('Configure display…'), () => {
            Util.spawnCommandLineAsync('cinnamon-settings display');
        });
    }

    /** Settings page: everything inline in the menu, no external dialog */
    _buildSettingsPage() {
        const backItem = new PopupMenu.PopupIconMenuItem(
            _('Back to display modes'),
            'go-previous',
            St.IconType.SYMBOLIC);
        backItem.connect('activate', () => {
            this._menuPage = 'main';
            this._buildMenu();
        });
        this.menu.addMenuItem(backItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const titleItem = new PopupMenu.PopupMenuItem(_('Settings'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(titleItem);

        // 
        const autoApplyItem = new PopupMenu.PopupSwitchMenuItem(
            _('Auto-apply on connect'), this.autoApplyOnConnect);
        autoApplyItem.connect('toggled', (item, checked) => {
            this.settings.setValue('autoApplyOnConnect', checked);
        });
        this.menu.addMenuItem(autoApplyItem);

        const revertItem = new PopupMenu.PopupSwitchMenuItem(
            _('Revert to laptop-only on disconnect'), this.revertOnDisconnect);
        revertItem.connect('toggled', (item, checked) => {
            this.settings.setValue('revertOnDisconnect', checked);
        });
        this.menu.addMenuItem(revertItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Extend position
        const extendLabel = new PopupMenu.PopupMenuItem(_('Extend position'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(extendLabel);

        const positions = [
            ['right-of', _('External right of laptop')],
            ['left-of', _('External left of laptop')],
            ['above', _('External above laptop')],
            ['below', _('External below laptop')]
        ];

        for (const [value, label] of positions) {
            const item = new PopupMenu.PopupMenuItem(label);
            if ((this.extendPosition || 'right-of') === value)
                item.setShowDot(true);
            item.connect('activate', () => {
                this.settings.setValue('extendPosition', value);
                this._openSettingsPage();
            });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Show keybindings
        const keysLabel = new PopupMenu.PopupMenuItem(_('Shortcuts'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(keysLabel);

        const keyRows = [
            ['keyOpen', _('Open menu')],
            ['keyLaptop', DisplayInfo.MODE_LABELS.laptop],
            ['keyExternal', DisplayInfo.MODE_LABELS.external],
            ['keyMirror', DisplayInfo.MODE_LABELS.mirror],
            ['keyExtend', DisplayInfo.MODE_LABELS.extend]
        ];

        for (const [key, label] of keyRows) {
            const hint = this._formatKeyHint(key) || _('not set');
            const item = new PopupMenu.PopupMenuItem(label + ': ' + hint, { reactive: false });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Button: open external settings dialog for keybindings (fallback)
        const keyDialogBtn = new PopupMenu.PopupIconMenuItem(
            _('Change shortcuts…'),
            'input-keyboard',
            St.IconType.SYMBOLIC);
        keyDialogBtn.connect('activate', () => this._openExternalSettingsDialog());
        this.menu.addMenuItem(keyDialogBtn);

        // Preferred external output (display)
        if (this.preferredExternal) {
            const extItem = new PopupMenu.PopupMenuItem(
                _('External output: %s').format(this.preferredExternal),
                { reactive: false });
            this.menu.addMenuItem(extItem);
        }

        const extHint = new PopupMenu.PopupMenuItem(
            _('Externen Anschluss (z. B. HDMI-1) im Dialog „Tastenkürzel ändern" setzen'),
            { reactive: false, style_class: 'display-switcher-info' });
        extHint.label.clutter_text.set_line_wrap(true);
        this.menu.addMenuItem(extHint);
    }

    on_applet_clicked(event) {
        this._openModeChooser();
    }

    on_applet_removed_from_panel() {
        for (const [id] of KEY_BINDINGS)
            Main.keybindingManager.removeXletHotKey(this, id);

        if (this._monitorsChangedId) {
            this._monitorManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }

        if (this._hotplugTimeoutId) {
            Mainloop.source_remove(this._hotplugTimeoutId);
            this._hotplugTimeoutId = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MintDisplaySwitcherApplet(metadata, orientation, panel_height, instance_id);
}
