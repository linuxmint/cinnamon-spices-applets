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

/** Debounce-Zeit nach monitors-changed (ms), damit xrandr nach Hotplug stabil ist */
const HOTPLUG_DEBOUNCE_MS = 300;

/** Alle konfigurierbaren Tastenkürzel: [id, settingsKey, callback] */
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

        // Display-Backend (X11 oder Wayland)
        this._backend = DisplayBackend.createDisplayBackend();

        // Applet-Einstellungen binden
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

        // Popup-Menü einrichten
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

        // Hotplug: Meta.MonitorManager (X11 + Wayland)
        this._monitorManager = Meta.MonitorManager.get();
        this._monitorsChangedId = this._monitorManager.connect(
            'monitors-changed', () => this._scheduleHotplugRefresh());

        // Initialer Display-Status
        this._refreshDisplays();
        this._externalWasConnected = this._hasConnectedExternal();

        this._setKeybindings();
        this._updatePanelIcon(this._currentMode);
        this._applyIconVisibility();
    }

    /** Panel-Icon je nach Einstellung ein- oder ausblenden */
    _applyIconVisibility() {
        if (!this.actor)
            return;
        if (this.hidePanelIcon)
            this.actor.hide();
        else
            this.actor.show();
    }

    /** Optionen aus den Einstellungen für Backend-Aufrufe */
    _getBackendOptions() {
        return {
            extendPosition: this.extendPosition || 'right-of',
            preferredExternal: this.preferredExternal || ''
        };
    }

    /** Alle Tastenkürzel entfernen und neu registrieren */
    _setKeybindings() {
        for (const [id, settingsKey, handlerName] of KEY_BINDINGS) {
            Main.keybindingManager.removeXletHotKey(this, id);
            const binding = this[settingsKey];
            if (binding) {
                const registered = Main.keybindingManager.addXletHotKey(
                    this, id, binding, () => this[handlerName]());
                // If registration failed, the binding is likely taken by the system
                // (e.g. switch-monitor). Warn once so the user can free it manually via
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

    /** Direkt Modus per Tastenkürzel anwenden */
    _applyModeFromHotkey(mode) {
        if (!this._backend.canApplyModes())
            return;
        if (!DisplayInfo.isModeAvailable(mode, this._snapshot)) {
            Main.notify(
                _('Display Switcher'),
                _('Modus „%s“ ist gerade nicht verfügbar').format(DisplayInfo.MODE_LABELS[mode]));
            return;
        }
        this._applyMode(mode, true);
    }

    /** Panel-Icon und Tooltip je nach aktivem Modus */
    _updatePanelIcon(mode) {
        const icon = DisplayInfo.MODE_ICONS[mode] || 'display';
        const label = DisplayInfo.MODE_LABELS[mode] || 'Unbekannt';
        this.set_applet_icon_symbolic_name(icon);
        this.set_applet_tooltip(_('Display Switcher — %s').format(label));
    }

    /** Display-Status vom Backend einlesen und Modus erkennen */
    _refreshDisplays() {
        this._snapshot = this._backend.getSnapshot(this._getBackendOptions());
        this._currentMode = DisplayInfo.detectMode(this._snapshot);
        this._updatePanelIcon(this._currentMode);
    }

    /** Ist ein externes Display physisch verbunden (auch wenn aus)? */
    _hasConnectedExternal() {
        return this._snapshot &&
            this._snapshot.external &&
            this._snapshot.external.connected;
    }

    /** Debounced Refresh nach Hotplug */
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

    /** Reagiert auf An-/Abstecken eines externen Displays */
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
     * Wendet einen Anzeigemodus an und speichert ihn.
     * @param {string} mode
     * @param {boolean} notify — Benachrichtigung anzeigen
     */
    _applyMode(mode, notify = true) {
        const result = this._backend.applyMode(mode, this._getBackendOptions());

        if (!result.success) {
            if (result.fallback === 'settings-opened') {
                Main.notify(
                    _('Display Switcher'),
                    _('Wayland: Bitte Anzeige-Einstellungen verwenden'));
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
                _('%s aktiviert').format(DisplayInfo.MODE_LABELS[mode]));
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
     * Zentriertes Band-Overlay im Win+P-Stil öffnen.
     * Vier Modus-Kacheln + Einstellungen im Band, Pfeiltasten ← →.
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
            text: _('Projizieren'),
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

    /** Startindex für Tastaturfokus: aktiver Modus oder erste Kachel */
    _findChooserStartIndex() {
        const currentIdx = this._chooserTiles.findIndex(
            t => t.mode === this._currentMode && t.enabled);
        if (currentIdx >= 0)
            return currentIdx;
        const firstEnabled = this._chooserTiles.findIndex(t => t.enabled);
        return firstEnabled >= 0 ? firstEnabled : 0;
    }

    /** Pfeiltasten-Navigation und Enter/Esc im Band-Overlay */
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

    /** Fokus visuell und per Tastatur auf Kachel setzen */
    _focusChooserTile(index) {
        if (!this._chooserTiles.length)
            return;

        // Alten Fokus-Stil entfernen
        for (const tile of this._chooserTiles)
            tile.button.remove_style_class_name('display-switcher-tile-focused');

        // Index begrenzen
        index = ((index % this._chooserTiles.length) + this._chooserTiles.length) % this._chooserTiles.length;
        this._chooserFocusIndex = index;

        const tile = this._chooserTiles[index];
        tile.button.add_style_class_name('display-switcher-tile-focused');
        tile.button.grab_key_focus();
    }

    /** Pfeiltaste: zum nächsten/vorherigen Modus springen (deaktivierte überspringen) */
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
        // Keine aktive Kachel — trotzdem Fokus setzen
        this._focusChooserTile(idx);
    }

    /** Enter: fokussierte Kachel aktivieren */
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

    /** Band-Overlay schließen */
    _closeModeChooser() {
        if (!this._chooser)
            return;
        const dialog = this._chooser;
        this._chooser = null;
        dialog.close(global.get_current_time());
    }

    /**
     * Erstellt eine Modus-Kachel (großes Symbol + Beschriftung) für das Band.
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

    /** Einstellungs-Kachel im Band (Zahnrad + Beschriftung) */
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
            text: _('Einstellungen'),
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

    /** Einstellungsseite im Popup-Menü anzeigen */
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

    /** Formatiert ein Tastenkürzel für die Anzeige im Menü */
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

    /** Hauptseite: Display-Modi */
    _buildMainPage() {
        const infoText = DisplayInfo.formatInfoLine(this._snapshot);
        const infoItem = new PopupMenu.PopupMenuItem(infoText, {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        infoItem.label.clutter_text.set_line_wrap(true);
        this.menu.addMenuItem(infoItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Prominenter Einstellungen-Button oben
        const settingsBtn = new PopupMenu.PopupIconMenuItem(
            _('Einstellungen'),
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

        this.menu.addAction(_('Anzeige konfigurieren…'), () => {
            Util.spawnCommandLineAsync('cinnamon-settings display');
        });
    }

    /** Einstellungsseite: alles direkt im Menü, ohne externen Dialog */
    _buildSettingsPage() {
        const backItem = new PopupMenu.PopupIconMenuItem(
            _('Zurück zu Display-Modi'),
            'go-previous',
            St.IconType.SYMBOLIC);
        backItem.connect('activate', () => {
            this._menuPage = 'main';
            this._buildMenu();
        });
        this.menu.addMenuItem(backItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const titleItem = new PopupMenu.PopupMenuItem(_('Einstellungen'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(titleItem);

        // Verhalten
        const autoApplyItem = new PopupMenu.PopupSwitchMenuItem(
            _('Auto-Apply beim Anstecken'), this.autoApplyOnConnect);
        autoApplyItem.connect('toggled', (item, checked) => {
            this.settings.setValue('autoApplyOnConnect', checked);
        });
        this.menu.addMenuItem(autoApplyItem);

        const revertItem = new PopupMenu.PopupSwitchMenuItem(
            _('Beim Trennen: Nur Laptop'), this.revertOnDisconnect);
        revertItem.connect('toggled', (item, checked) => {
            this.settings.setValue('revertOnDisconnect', checked);
        });
        this.menu.addMenuItem(revertItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Position beim Erweitern
        const extendLabel = new PopupMenu.PopupMenuItem(_('Position beim Erweitern'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(extendLabel);

        const positions = [
            ['right-of', _('Extern rechts vom Laptop')],
            ['left-of', _('Extern links vom Laptop')],
            ['above', _('Extern über dem Laptop')],
            ['below', _('Extern unter dem Laptop')]
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

        // Tastenkürzel anzeigen
        const keysLabel = new PopupMenu.PopupMenuItem(_('Tastenkürzel'), {
            reactive: false,
            style_class: 'display-switcher-info'
        });
        this.menu.addMenuItem(keysLabel);

        const keyRows = [
            ['keyOpen', _('Menü öffnen')],
            ['keyLaptop', DisplayInfo.MODE_LABELS.laptop],
            ['keyExternal', DisplayInfo.MODE_LABELS.external],
            ['keyMirror', DisplayInfo.MODE_LABELS.mirror],
            ['keyExtend', DisplayInfo.MODE_LABELS.extend]
        ];

        for (const [key, label] of keyRows) {
            const hint = this._formatKeyHint(key) || _('nicht gesetzt');
            const item = new PopupMenu.PopupMenuItem(label + ': ' + hint, { reactive: false });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Button: externen Dialog für Tastenkürzel (Fallback)
        const keyDialogBtn = new PopupMenu.PopupIconMenuItem(
            _('Tastenkürzel ändern…'),
            'input-keyboard',
            St.IconType.SYMBOLIC);
        keyDialogBtn.connect('activate', () => this._openExternalSettingsDialog());
        this.menu.addMenuItem(keyDialogBtn);

        // Bevorzugter externer Anschluss (Anzeige)
        if (this.preferredExternal) {
            const extItem = new PopupMenu.PopupMenuItem(
                _('Externer Anschluss: %s').format(this.preferredExternal),
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
