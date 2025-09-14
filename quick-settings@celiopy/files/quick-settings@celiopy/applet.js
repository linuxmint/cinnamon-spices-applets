const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Settings = imports.ui.settings;
const UserWidget = imports.ui.userWidget;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const Slider = imports.ui.slider;

const UUID = 'quick-settings@celiopy';
const APPLET_DIR = imports.ui.appletManager.appletMeta[UUID].path;
const DIALOG_ICON_SIZE = 32;

const INHIBIT_IDLE_FLAG = 8;
const INHIBIT_SLEEP_FLAG = 4;

// l10n/translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

class CinnamonUserApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._signals = [];
        this.sessionCookie = null;

        this.set_applet_icon_symbolic_name('user-menu-symbolic');

        // Mapa de modos
        this._powerModes = {
            "power-saver": { next: "balanced", label: _("Power Saver"), icon: "power-profile-power-saver" },
            "balanced": { next: "performance", label: _("Balanced"),  icon: "power-profile-balanced" },
            "performance": { next: "power-saver", label: _("Performance"),  icon: "power-profile-performance" }
        };

        // Inicializa schemas, bindings, UI e toggles
        this._initSchemas();
        this._initUI(orientation);
        this._initPowerProfiles();

        // Métodos iniciais
        this._onUserChanged();
        this._setKeybinding();
    }

    // === Inicializa schemas e bindings ===
    _initSchemas() {
        // Schemas do applet
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("light-theme", "_lightTheme");
        this.settings.bind("dark-theme", "_darkTheme");
        this.settings.bind("keyOpen", "keyOpen", () => this._setKeybinding());
        this.settings.bind("display-name", "display_name", () => this._updateLabels());

        // Schemas do sistema
        this._schemas = {
            color: new Gio.Settings({ schema_id: "org.cinnamon.settings-daemon.plugins.color" }),
            interface: new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" }),
            gtk: new Gio.Settings({ schema_id: "org.gnome.desktop.interface" }),
            cinnamon: new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" }),
            portal: new Gio.Settings({ schema_id: "org.x.apps.portal" }),
            screensaver: new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" })
        };
    }

    _initPowerProfiles() {
        this._powerProxy = new Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            "net.hadess.PowerProfiles",
            "/net/hadess/PowerProfiles",
            "net.hadess.PowerProfiles",
            null
        );

        // Atualiza inicialmente
        this._updatePowerModeIcon();

        // Escuta mudanças
        this._signals.push({
            obj: this._powerProxy,
            id: this._powerProxy.connect("g-properties-changed", () => {
                this._updatePowerModeIcon();
            })
        });
    }

    // === Inicializa UI do menu e painel ===
    _initUI(orientation) {
        // Sessão
        this.sessionProxy = null;
        this._session = new GnomeSession.SessionManager(Lang.bind(this, function(proxy, error) {
            if (error) {
                global.logError("Error initializing session proxy: " + error.message);
                return;
            }
            this.sessionProxy = proxy;
            global.log("Session proxy initialized successfully");
        }));
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        // Menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Seções do menu
        this.prefsSection = new PopupMenu.PopupMenuSection();
        this.interfaceSection = new PopupMenu.PopupMenuSection();
        this.sessionSection = new PopupMenu.PopupMenuSection();

        this.menu.addMenuItem(this.prefsSection);
        this.menu.addMenuItem(this.interfaceSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.sessionSection);

        // Grid de toggles (3 colunas)
        this.prefsGrid = new St.Widget({
            layout_manager: new Clutter.GridLayout(),
            style_class: "prefs-grid-container",
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL
        });
        let gridLayout = this.prefsGrid.layout_manager;
        gridLayout.set_column_spacing(12);
        gridLayout.set_row_spacing(16);
        gridLayout.set_column_homogeneous(true);
        this.prefsSection.actor.add_child(this.prefsGrid);

        this.maxTogglesPerRow = 3;
        this.currentRow = 0;
        this.currentColumn = 0;

        // Sessão: container horizontal
        this.sessionContainer = new St.BoxLayout({
            style_class: "session-container",
            vertical: false,
            x_expand: true
        });
        this.sessionSection.actor.add_child(this.sessionContainer);

        // User info
        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this._signals.push({
            obj: this._user,
            id: this._user.connect('notify::is-loaded', this._onUserChanged.bind(this))
        });

        this._signals.push({
            obj: this._user,
            id: this._user.connect('changed', this._onUserChanged.bind(this))
        });

        let userBox = new St.BoxLayout({ style_class: 'user-box', vertical: false, y_expand: false });
        // Avatar dentro de botão
        this._userButton = new St.Button({
            style_class: "user-avatar-button",
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        // Coloca o avatar dentro do botão
        this._userIcon = new UserWidget.Avatar(this._user, { iconSize: DIALOG_ICON_SIZE });
        this._userButton.set_child(this._userIcon);

        // Adiciona o botão no userBox
        userBox.add(this._userButton);

        // Clique no avatar abre "Detalhes da conta"
        this._userButton.connect('clicked', () => {
            GLib.spawn_command_line_async("cinnamon-settings user");
        });

        this._labelBox = new St.BoxLayout({ style_class: 'label-box', vertical: true, y_align: Clutter.ActorAlign.CENTER });
        this.userLabel = new St.Label({ style_class: 'user-label' });
        this.hostLabel = new St.Label({ style_class: 'host-label' });
        this._labelBox.add(this.userLabel);
        this._labelBox.add(this.hostLabel);
        userBox.add(this._labelBox);

        // Adiciona user info e spacer
        this.sessionContainer.add_child(userBox);
        this.sessionContainer.add_child(new St.BoxLayout({ x_expand: true })); // Spacer

        // Session buttons
        this.sessionButtonsBox = new St.BoxLayout({ style_class: 'session-buttons-box', vertical: false, x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER });
        this.sessionContainer.add_child(this.sessionButtonsBox);

        this._initSessionButtons();
        this._initToggles();
        this._initTextScaling();
    }

    // === Inicializa session buttons ===
    _initSessionButtons() {
        const addBtn = (iconName, tooltip, callback) => {
            let btn = new St.Button({ style_class: "system-button", reactive: true, can_focus: true, track_hover: true });
            let icon = new St.Icon({ icon_name: iconName, icon_type: St.IconType.SYMBOLIC, style_class: "system-status-icon" });
            btn.set_child(icon);
            new Tooltips.Tooltip(btn, tooltip);
            btn.connect("clicked", () => {
                callback();
                this.menu.toggle();
            });
            this.sessionButtonsBox.add_child(btn);
        };

        // System Settings
        addBtn("applications-system", _("Settings"), () => {
            GLib.spawn_command_line_async("cinnamon-settings");
        });

        // Lock
        addBtn("system-lock-screen", _("Lock Screen"), () => {
            let screensaver_file = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
            if (screensaver_file.query_exists(null)) {
                let ask = this._schemas.screensaver.get_boolean("ask-for-away-message");
                GLib.spawn_command_line_async(ask ? "cinnamon-screensaver-lock-dialog" : "cinnamon-screensaver-command --lock");
            } else {
                this._screenSaverProxy.LockRemote();
            }
        });

        // Logout
        addBtn("system-log-out", _("Log Out"), () => this._session.LogoutRemote(0));

        // Shutdown
        addBtn("system-shutdown", _("Shut Down"), () => this._session.ShutdownRemote());
    }

    // === Inicializa toggles do applet ===
    _initToggles() {
        // Dark Mode (applet setting)
        this.darkModeToggle = this._createToggle(
            "weather-clear-night-symbolic",
            _("Dark mode"),
            this.settings,
            "dark-mode",
            (newValue) => this._setDarkMode(newValue)
        );
        this._addToggleToGrid(this.darkModeToggle.actor);

        // Night Light (Gio.Settings)
        this.nightLightToggle = this._createToggle(
            "night-light-symbolic",
            _("Night Light"),
            this._schemas.color,
            "night-light-enabled",
            null,
            "nightlight"
        );
        this._addToggleToGrid(this.nightLightToggle.actor);

        // Prevent Sleep toggle
        this.preventSleepToggle = this._createToggle(
            "preferences-desktop-screensaver-symbolic",
            _("Prevent Sleep"),
            null,
            null,
            (active) => this._togglePreventSleep(active),
            "power"
        );
        this._addToggleToGrid(this.preventSleepToggle.actor);

        // Power Mode toggle (no settings key)
        this.powerModeToggle = this._createToggle(
            "power-profile-balanced", // ícone inicial
            _("Power Mode"),
            null,
            null,
            () => this._togglePowerMode(),
            "power"
        );
        this._addToggleToGrid(this.powerModeToggle.actor);

        // Inicializa estado ao iniciar
        this._updatePowerModeIcon();
    }

    // === Cria toggle com container extra para botão ===
    _createToggle(iconName, labelText, settingsObj = null, settingsKey = null, onChange = null, settingsUri = null) {
        let toggleBox = new St.BoxLayout({ vertical: true, style_class: "settings-toggle-box", x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, x_expand: false, y_expand: false });
        let buttonContainer = new St.BoxLayout({ style_class: "settings-toggle-icon-container", x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });

        let button = new St.Button({ style_class: "settings-toggle-button", reactive: true, can_focus: true, track_hover: true, toggle_mode: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, x_expand: false, y_expand: false });
        let icon = new St.Icon({ icon_name: iconName, icon_type: St.IconType.SYMBOLIC, style_class: "settings-toggle-icon" });

        button.set_child(icon);
        buttonContainer.add_child(button);
        toggleBox.add_child(buttonContainer);

        let label = new St.Label({ text: labelText, style_class: "settings-toggle-label", x_align: Clutter.ActorAlign.CENTER });
        toggleBox.add_child(label);

        if (settingsObj && settingsKey) {
            const updateState = () => {
                let value = (settingsObj instanceof Gio.Settings) 
                    ? settingsObj.get_boolean(settingsKey) 
                    : settingsObj.getValue(settingsKey);
                button.checked = value;

                if (onChange) onChange(value);
            };

            updateState();

            this._signals.push({
                obj: settingsObj,
                id: settingsObj.connect(`changed::${settingsKey}`, updateState)
            });
        }

        // MOVE THE CLICKED HANDLER OUTSIDE THE if BLOCK
        // So it works for both settings-based and custom toggles
        button.connect("clicked", () => {
            let newValue;
            if (settingsObj && settingsKey) {
                // Settings-based toggle
                let current = (settingsObj instanceof Gio.Settings) ? settingsObj.get_boolean(settingsKey) : settingsObj.getValue(settingsKey);
                newValue = !current;
                if (settingsObj instanceof Gio.Settings) settingsObj.set_boolean(settingsKey, newValue);
                else settingsObj.setValue(settingsKey, newValue);
            } else {
                // Custom toggle: manually flip
                newValue = !button._active;
                button._active = newValue; // store state manually
            }

            if (onChange) onChange(newValue);
        });

        if (settingsUri) {
            button.connect("button-press-event", (actor, event) => {
                if (event.get_button() === 2) { // Middle-click
                    GLib.spawn_command_line_async(`cinnamon-settings ${settingsUri}`);
                    this.menu.toggle();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        }

        return { actor: toggleBox, button, icon, label };
    }

    // === Adiciona toggle ao grid ===
    _addToggleToGrid(toggleActor) {
        let gridLayout = this.prefsGrid.layout_manager;
        gridLayout.attach(toggleActor, this.currentColumn, this.currentRow, 1, 1);
        this.currentColumn++;
        if (this.currentColumn >= this.maxTogglesPerRow) {
            this.currentColumn = 0;
            this.currentRow++;
        }
    }

    // === Inicializa slider de text scaling ===
    _initTextScaling() {
        const FACTORS = [0.9, 1.0, 1.1, 1.2, 1.3];
        const MAX_INDEX = FACTORS.length - 1;

        let currentFactor = this._schemas.interface.get_double("text-scaling-factor");
        let idx = FACTORS.indexOf(currentFactor);
        if (idx < 0) idx = 1;

        // Container do slider
        let fakeSlider = new St.BoxLayout({
            style_class: "fake-slider",
            vertical: false,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.FILL
        });

        // Track em grid
        let track = new St.Widget({
            style_class: "fake-slider-track",
            x_expand: true,
            y_expand: true,
            layout_manager: new Clutter.GridLayout()
        });
        let grid = track.layout_manager;
        grid.set_row_homogeneous(true);
        grid.set_column_homogeneous(true);

        // Fill do slider
        let fill = new St.BoxLayout({ style_class: "fake-slider-fill" });

        // Atualiza fill conforme índice
        const updateFakeSlider = (idx) => {
            track.remove_all_children();

            let weight = (idx + 1);

            // Fill ocupa "weight" colunas
            track.add_child(fill);
            grid.attach(fill, 0, 0, weight, 1);

            // Spacer ocupa o resto
            if (weight < FACTORS.length) {
                let spacer = new St.BoxLayout({ x_expand: true });
                track.add_child(spacer);
                grid.attach(spacer, weight, 0, FACTORS.length - weight, 1);
            }

            // === Marcador fixo no 1.0 ===
            let markerIndex = FACTORS.indexOf(1.0);
            if (markerIndex >= 0) {
                let marker = new St.BoxLayout({
                    style_class: "fake-slider-marker",
                    x_expand: false,
                    y_expand: false,
                    x_align: Clutter.ActorAlign.END
                });
                track.add_child(marker);
                grid.attach(marker, markerIndex, 0, 1, 1);
            }
        };
        
        fakeSlider.add_child(track);

        // Função para alterar escala
        const setScale = (newIdx) => {
            newIdx = Math.max(0, Math.min(MAX_INDEX, newIdx));
            idx = newIdx;
            let factor = FACTORS[idx];
            this._schemas.interface.set_double("text-scaling-factor", factor);
            updateFakeSlider(idx);
        };

        // Escuta mudanças externas do text-scaling-factor
        this._signals.push({
            obj: this._schemas.interface,
            id: this._schemas.interface.connect("changed::text-scaling-factor", () => {
                let f = this._schemas.interface.get_double("text-scaling-factor");
                let i = FACTORS.indexOf(f);
                if (i >= 0) {
                    idx = i;
                    updateFakeSlider(idx);
                }
            })
        });

        // Botões de menos/mais
        let minusBtn = new St.Button({ style_class: "system-button", reactive: true, can_focus: true, track_hover: true });
        minusBtn.set_child(new St.Icon({ icon_name: 'format-text-size-decrease-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: "system-status-icon" }));
        minusBtn.connect("clicked", () => setScale(idx - 1));

        let plusBtn = new St.Button({ style_class: "system-button icon-large", reactive: true, can_focus: true, track_hover: true });
        plusBtn.set_child(new St.Icon({ icon_name: 'format-text-size-increase-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: "system-status-icon" }));
        plusBtn.connect("clicked", () => setScale(idx + 1));

        // Container final
        let scalingContainer = new St.BoxLayout({ style_class: "scaling-container", vertical: false, x_expand: true });
        scalingContainer.add_child(minusBtn);
        scalingContainer.add_child(fakeSlider);
        scalingContainer.add_child(plusBtn);

        this.interfaceSection.actor.add_child(scalingContainer);

        updateFakeSlider(idx);
    }
    
    _populateThemeOptions() {
        let themes = {};
        
        const readThemesFromDir = (dir) => {
            try {
                let file = Gio.file_new_for_path(dir);
                let enumerator = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);

                let info;
                while ((info = enumerator.next_file(null))) {
                    let themeName = info.get_name();
                    if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                        themes[themeName] = themeName;  // Use theme name as both key and value
                    }
                }
            } catch (e) {
                log(`Error reading themes from ${dir}: ${e.message}`);
            }
        };

        // Read themes from both system and user directories
        readThemesFromDir('/usr/share/themes');
        readThemesFromDir(GLib.get_home_dir() + '/.themes');

        // Clear existing options in the ComboBox (assuming you have a ComboBox defined)
        this._clearComboBoxOptions();

        // Add new options to the ComboBox
        for (let theme in themes) {
            this._addComboBoxOption(theme, theme); // Add each theme to the ComboBox
        }

        // Log found themes
        if (Object.keys(themes).length === 0) {
            log("No themes found.");
        } else {
            log(`Found themes: ${JSON.stringify(themes)}`);
        }

        // Set the options for light and dark themes
        this.settings.setOptions("light-theme", themes);
        this.settings.setOptions("dark-theme", themes);
    }

    _clearComboBoxOptions() {
        // Clear the ComboBox options
        // Assuming you have a reference to your ComboBox, for example:
        if (this.lightThemeComboBox) {
            this.lightThemeComboBox.remove_all();
        }
        if (this.darkThemeComboBox) {
            this.darkThemeComboBox.remove_all();
        }
    }

    _addComboBoxOption(value, label) {
        // Add an option to the ComboBox
        if (this.lightThemeComboBox) {
            this.lightThemeComboBox.add_option(label, value);
        }
        if (this.darkThemeComboBox) {
            this.darkThemeComboBox.add_option(label, value);
        }
    }

    // === Dark mode ===
    _setDarkMode(dark) {
        let theme = dark ? this._darkTheme : this._lightTheme;
        let colorScheme = dark ? "prefer-dark" : "default";

        this._schemas.gtk.set_string("gtk-theme", theme);
        this._schemas.cinnamon.set_string("gtk-theme", theme);
        this._schemas.portal.set_string("color-scheme", colorScheme);

        this._darkMode = dark;
        global.log(dark);
        global.log(theme);

        this._populateThemeOptions();
    }

    // === Toggle Prevent Sleep ===
    _togglePreventSleep(active) {
        if (active) {
            // Activate prevent sleep
            this.sessionProxy.InhibitRemote(
                "inhibit@cinnamon.org",
                0,
                "prevent system sleep and suspension",
                INHIBIT_SLEEP_FLAG,
                Lang.bind(this, function(cookie) {
                    this.sessionCookie = cookie;
                    global.log("Prevent sleep activated, cookie: " + cookie);
                    // Ensure UI reflects the active state
                    this.preventSleepToggle.button.checked = true;
                })
            );
        } else if (this.sessionCookie) {
            // Deactivate prevent sleep
            this.sessionProxy.UninhibitRemote(
                this.sessionCookie, 
                Lang.bind(this, function() {
                    global.log("Prevent sleep deactivated");
                    this.sessionCookie = null;
                    // Ensure UI reflects the inactive state
                    this.preventSleepToggle.button.checked = false;
                })
            );
        } else {
            // No cookie to uninhibit, just update UI
            this.preventSleepToggle.button.checked = false;
        }
    }

    // === Keybinding ===
    _setKeybinding() {
        if (this.keybindingId) {
            Main.keybindingManager.removeHotKey("user-applet-open-" + this.instance_id);
        }
        Main.keybindingManager.addHotKey("user-applet-open-" + this.instance_id, this.keyOpen, () => this._openMenu());
    }

    _openMenu() { this.menu.toggle(); }

    // === Atualiza labels e avatar ===
    _updateLabels() {
        this.set_applet_label("");

        if (this.display_name) {
            // === UserBox ===
            this.userLabel.set_text(this._user.get_real_name());
            this.hostLabel.set_text(`${GLib.get_user_name()}@${GLib.get_host_name()}`);
            this._labelBox.show();
        } else {
            // === UserBox ===
            this.userLabel.set_text("");
            this.hostLabel.set_text("");
            this._labelBox.hide();
        }
    }

    _onUserChanged() {
        if (this._user && this._user.is_loaded) {
            this.set_applet_tooltip(this._user.get_real_name());

            if (this.display_name) {
                let hostname = GLib.get_host_name();
                this.hostLabel.set_text(`${GLib.get_user_name()}@${hostname}`);
                this.userLabel.set_text(this._user.get_real_name());
            }

            this._userIcon.update();
            this._updateLabels();
        }
    }

    // Alterna entre os modos
    // Toggle
    _togglePowerMode() {
        this._getCurrentPowerMode((current) => {
            let mode = this._powerModes[current] || this._powerModes["balanced"];

            // Muda o modo de energia
            GLib.spawn_command_line_async(`powerprofilesctl set ${mode.next}`);
            this._updatePowerModeIcon();
        });
    }

    // Atualiza ícone externo
    _updatePowerModeIcon() {
        this._getCurrentPowerMode((current) => {
            let mode = this._powerModes[current] || this._powerModes["balanced"];
            this.powerModeToggle.icon.icon_name = mode?.icon;
            this.powerModeToggle.label.set_text(mode?.label);
            let isPerformance = (current === "performance");
            this.powerModeToggle.button.checked = isPerformance;
        });
    }

    // Obtém modo atual do powerprofilesctl
    _getCurrentPowerMode(callback) {
        try {
            let proc = new Gio.Subprocess({
                argv: ["powerprofilesctl", "get"],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stdout && stdout.trim().length > 0) {
                        callback(stdout.trim());
                    } else {
                        callback("balanced"); // fallback
                    }
                } catch (e) {
                    global.logError("Erro ao processar power mode: " + e);
                    callback("balanced");
                }
            });
        } catch(e) {
            global.logError("Erro ao iniciar subprocesso: " + e);
            callback("balanced");
        }
    }

    on_applet_clicked() { this._openMenu(); }

    on_applet_removed_from_panel() {
        // Clean up inhibit cookie
        if (this.sessionCookie !== null && this.sessionProxy) {
            try {
                this.sessionProxy.UninhibitRemote(this.sessionCookie);
                global.log("Cleaned up prevent sleep cookie: " + this.sessionCookie);
            } catch(e) {
                global.logError("Erro ao limpar inhibit cookie: " + e);
            }
        }

        // Desconectar todos os sinais registrados
        this._signals.forEach(sig => {
            try { sig.obj.disconnect(sig.id); } catch(e) {}
        });
        this._signals = null;

        // Remover keybinding
        Main.keybindingManager.removeHotKey("user-applet-open-" + this.instance_id);

        // Finalizar settings
        this.settings.finalize();

        // Liberar proxies
        this._powerProxy = null;
        this.sessionProxy = null;
        this._screenSaverProxy = null;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonUserApplet(orientation, panel_height, instance_id);
}
