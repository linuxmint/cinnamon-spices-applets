/**
 * WMM Applet - Cinnamon Edition
 * ----------------------------
 * DESCRIPCIÓN:
 * Gestión de fondos multi-monitor con soporte para temporizadores y favoritos.
 * * FLUJO DE CONTROL:
 * 1. UI (JS) -> Escribe comandos.json -> Envía SIGUSR1 al motor.
 * 2. Motor (Python) -> Lee comandos.json -> Ejecuta -> Actualiza settings.json.
 * 3. UI (JS) -> Lee settings.json al abrir el menú para sincronizar estados.
 */

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;

// Configuración de traducciones (herencia automática de Cinnamon)
const Gettext = imports.gettext;
// Nota: No forzamos bindtextdomain/textdomain, confiamos en la herencia automática de Cinnamon.
// Si fuera necesario forzarlo, las rutas correctas serían las comentadas abajo.
Gettext.bindtextdomain('wmm-applet@maki', GLib.get_user_data_dir() + '/locale');
// Gettext.bindtextdomain('cinnamon', '/usr/share/locale');
// Gettext.textdomain('wmm-applet@maki');

function _(text) {
    let translated = Gettext.dgettext('cinnamon', text);
    if (translated !== text) {
        return translated;
    }
    return Gettext.dgettext('wmm-applet@maki', text);
}

class WMMApplet extends Applet.IconApplet {

    /**
     * BLOQUE 1: CONSTRUCTOR
     * Configuración de rutas y arranque del motor.
     */
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_name("video-display");
            this.set_applet_tooltip(
                "WMM: " + _("Wallpaper Multi-Monitor Manager") + "\n" +
                _("Click action") + ": " + _("Next Background") + "\n" +
                _("Secondary Click") + ": " + _("Context Menu")
            );
            this.appletPath = metadata.path;
            this.enginePath = this.appletPath + "/python/main.py";
            this.commandsPath = this.appletPath + "/data/commands.json";
            this.settingsPath = this.appletPath + "/data/settings.json";
            this.bookmarksPath = this.appletPath + "/data/bookmarks.json";

            this._currentMaxInterval = 60;
            this.favItems = []; // Array para trackear y destruir items de favoritos (Gestión de RAM)

            this._populateMenu();

            // LECTURA ÚNICA: Solo accedemos al disco al abrir el menú principal
            this._applet_context_menu.connect('open-state-changed', (menu, open) => {
                if (open) this._refreshSettingsFromDisk();
            });

            Util.spawnCommandLine("python3 " + this.enginePath);

        } catch (e) {
            global.logError("WMM Constructor Error: " + e.message);
        }
    }

    /**
     * BLOQUE 2: CONSTRUCCIÓN DE LA INTERFAZ
     * Diseño del esqueleto del menú contextual.
     */
    _populateMenu() {
        try {
            this._applet_context_menu.removeAll();
            this._applet_context_menu.actor.width_request = 200;

            // --- 2.1 AJUSTES GENERALES ---
            this.settingsMenuItem = new PopupMenu.PopupMenuItem("WMM " + _("Settings"));
            this.settingsMenuItem.connect('activate', () => {
                this._openSettingsPanel();
            });
            this._applet_context_menu.addMenuItem(this.settingsMenuItem);

            // --- Separador ---
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // --- 2.2 SUBMENÚ FAVORITOS ---
            this.menuBookmarks = new PopupMenu.PopupSubMenuMenuItem(_("Favorites"));
            this._applet_context_menu.addMenuItem(this.menuBookmarks);

            // Switch: Solo rotar favoritos (Slideshow Bookmark)
            this.favRotationSwitch = new PopupMenu.PopupSwitchMenuItem(_("Favorites Only"), false);
            this.favRotationSwitch.connect('toggled', (item, state) => {
                // LÓGICA REACTIVA: Si activamos rotación de favoritos, el motor debe estar ON
                if (state && !this.masterItem.state) {
                    this._syncTimerUI(true); // Sincronización en caliente (Vista)
                }
                this._updateTimerSettings(); // Notificación al Motor (Realidad)
            });
            this.menuBookmarks.menu.addMenuItem(this.favRotationSwitch);
            this.menuBookmarks.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Botón añadir favorito
            let itemAddBookmark = new PopupMenu.PopupMenuItem(_("Add Preset Favorite"));
            itemAddBookmark.connect('activate', () => {
                Util.spawnCommandLine("python3 " + this.appletPath + "/python/add_bookmark.py");
            });

            this.menuBookmarks.menu.addMenuItem(itemAddBookmark);
            this.menuBookmarks.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // --- 2.3 SUBMENÚ TEMPORIZADOR ---
            this.menuTimer = new PopupMenu.PopupSubMenuMenuItem(_("Slideshow"));
            //this.menuTimer.menu.actor.width_request = 210;
            this._applet_context_menu.addMenuItem(this.menuTimer);

            // Interruptor Maestro (Dentro del Submenú)
            this.masterItem = new PopupMenu.PopupSwitchMenuItem(_("Disabled"), false);
            this.menuTimer.menu.addMenuItem(this.masterItem);

            // Información de tiempo (Dentro del Submenú)
            let infoItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            let infoBox = new St.BoxLayout({ style: "margin-left: 110px;" });
            this.labelMin = new St.Label();
            infoBox.add(this.labelMin);
            infoItem.addActor(infoBox);
            this.menuTimer.menu.addMenuItem(infoItem);

            // Slider (Dentro del Submenú)
            this.slider = new PopupMenu.PopupSliderMenuItem(0.25);
            this.menuTimer.menu.addMenuItem(this.slider);

            // --- 2.4 MODO SYNC/ASYNC (Ahora en la Raíz) ---
            // Lo añadimos justo debajo del Submenú Temporizador
            this.modeSwitch = new PopupMenu.PopupSwitchMenuItem(_("Displays") + ": " + _("ASYNC (One)"), false);
            this._applet_context_menu.addMenuItem(this.modeSwitch);

            // --- 2.4b MODO DISTRIBUIDO (SPANNED) ---
            this.spannedSwitch = new PopupMenu.PopupSwitchMenuItem(_("Spanned Mode"), false);
            this._applet_context_menu.addMenuItem(this.spannedSwitch);

            this.spannedSwitch.connect('toggled', (item, state) => {
                this._updateTimerSettings(); // Envía spanned_enabled al motor
            });

            // --- 2.5 EVENTOS Y LÓGICA ---

            // Slider: Solo responde si el temporizador está ON
            this.slider.connect('value-changed', () => {
                if (!this.masterItem || !this.masterItem.state) {
                    // Si está OFF, refrescamos para evitar que el slider se mueva visualmente
                    if (this.masterItem) this._refreshSettingsFromDisk();
                    return;
                }
                let mins = Math.max(1, Math.round(this.slider.value * this._currentMaxInterval));
                this.labelMin.set_text(mins + " " + _("minutes"));
            });

            this.slider.connect('drag-end', () => {
                // Solo guardamos si el temporizador está activo
                if (this.masterItem && this.masterItem.state) this._updateTimerSettings();
            });

            this.masterItem.connect('toggled', (item, state) => {
                // El texto del interruptor maestro
                item.label.set_text(state ? _("Enabled") : _("Disabled"));

                // IMPORTANTE: _syncTimerUI debe bloquear el slider pero NO el modeSwitch
                this._syncTimerUI(state);
                this._updateTimerSettings();
            });

            this.modeSwitch.connect('toggled', (item, state) => {
                item.label.set_text(state ? _("Displays") + ": " + _("SYNC (All)") : _("Displays") + ": " + _("ASYNC (One)"));
                // Ahora se guarda SIEMPRE, independientemente de si el timer está ON o OFF
                this._updateTimerSettings();
            });

            // --- 2.6 PIE DE MENÚ ---
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let itemSync = new PopupMenu.PopupMenuItem(_("Sync Library"));
            itemSync.connect('activate', () => {
                this._sendActionToEngine({ "action": "sync_library" });
            });
            this._applet_context_menu.addMenuItem(itemSync);

            // --- 2.6 AYUDA ---
            let itemHelp = new PopupMenu.PopupMenuItem(_("Help"));
            itemHelp.connect('activate', () => {
                Util.spawnCommandLine("python3 " + this.appletPath + "/python/help_viewer.py");
            });
            this._applet_context_menu.addMenuItem(itemHelp);

        } catch (e) {
            global.logError("WMM PopulateMenu Error: " + e.message);
        }
    }

    /**
     * BLOQUE 3: SINCRONIZACIÓN EN CALIENTE (HOT-SYNC)
     * Modifica la UI visualmente sin realizar lecturas de disco.
     */
    _syncTimerUI(enabled) {
        if (!this.masterItem) return;
        this.masterItem.setToggleState(enabled);
        this.masterItem.label.set_text(enabled ? _("Enabled") : _("Disabled"));
        this.slider.setSensitive(enabled);
        this.slider.actor.reactive = enabled;
        //this.labelMin.set_opacity(enabled ? 255 : 255);
    }

    /**
     * BLOQUE 4: REFRESH DISCO -> UI
     * Sincroniza el Applet con el estado real almacenado en JSON.
     */
    _refreshSettingsFromDisk() {
        // Declarar variables reutilizables una sola vez
        let s, content;

        try {
            if (!this.masterItem || !this.slider) return;

            // 1. Cargar Settings Globales
            try {
                [s, content] = GLib.file_get_contents(this.settingsPath);
                if (s) {
                    let config = JSON.parse(content.toString()).global;
                    this._currentMaxInterval = config.slideshow_max_interval || 60;

                    let isEnabled = config.slideshow_enabled;
                    let isSync = (config.slideshow_mode === "sync");
                    let isFavSlideshow = config.slideshow_bookmark || false;

                    this._syncTimerUI(isEnabled);
                    this.modeSwitch.setToggleState(isSync);
                    this.modeSwitch.label.set_text(isSync ? _("Displays") + ": " + _("SYNC (All)") : _("Displays") + ": " + _("ASYNC (One)"));
                    this.favRotationSwitch.setToggleState(isFavSlideshow);

                    let ratio = config.slideshow_interval / this._currentMaxInterval;
                    this.slider.setValue(ratio);
                    this.labelMin.set_text(config.slideshow_interval + " " + _("minutes"));

                    let isSpanned = config.spanned_enabled || false;
                    this.spannedSwitch.setToggleState(isSpanned);
                    // Modo Debug
                    this._debug_mode = config.debug_mode || false;
                    if (this.settingsMenuItem) {
                        this.settingsMenuItem.label.set_text(
                            "WMM " + _("Settings") + (this._debug_mode ? " (Debug)" : "")
                        );
                    }
                }
            } catch (e) {
                // settings.json no existe o no se puede leer
            }
            // 2. Cargar Favoritos Dinámicos
            this._refreshBookmarks();

        } catch (e) {
            global.logError("WMM Refresh Error: " + e.message);
        }
    }

    _refreshBookmarks() {
        // Limpieza de memoria: destruir widgets previos
        this.favItems.forEach(item => item.destroy());
        this.favItems = [];

        let s, content;
        try {
            [s, content] = GLib.file_get_contents(this.bookmarksPath);
        } catch (e) {
            return;
        }

        if (s) {
            let bookmarks;
            try {
                bookmarks = JSON.parse(content.toString());
            } catch (e) {
                global.logError("WMM Bookmarks Error: " + e.message);
                let info = new PopupMenu.PopupMenuItem(_("Error loading favorites"), { reactive: false });
                this.menuBookmarks.menu.addMenuItem(info);
                this.favItems.push(info);
                return;
            }
            let keys = Object.keys(bookmarks);

            if (keys.length === 0) {
                let info = new PopupMenu.PopupMenuItem(_("No saved favorites"), { reactive: false });
                this.menuBookmarks.menu.addMenuItem(info);
                this.favItems.push(info);
                return;
            }

            // Contenedor del scroll
            let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, activate: false });
            scrollItem.actor.style = 'padding: 0; margin: 0; background-color: transparent;';
            scrollItem.actor.remove_all_children();

            // Caja vertical con margen izquierdo y sin expandir (para controlar el ancho)
            let favBox = new St.BoxLayout({
                vertical: true,
                style: 'margin-left: 10px; padding: 0;'
            });

            keys.forEach(name => {
                let row = new St.BoxLayout({ style: 'padding: 3px 0px; spacing: 0px;' });

                // Botón con el nombre del preset
                let nameBtn = new St.Button({
                    reactive: true,
                    can_focus: true,
                    track_hover: true,
                    x_align: St.Align.START
                });
                let nameLabel = new St.Label({ text: name });
                nameLabel.style = 'overflow: hidden; white-space: nowrap; text-overflow: ellipsis;';
                nameBtn.set_child(nameLabel);

                nameBtn.connect('clicked', () => {
                    this._syncTimerUI(false);
                    this._sendActionToEngine({ action: "load_bookmark", name: name, timer_force_off: true });
                    this._applet_context_menu.close();
                });

                // Papelera
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
                    this._applet_context_menu.close();
                });

                row.add(nameBtn, { expand: true, x_fill: true, x_align: St.Align.START });
                row.add(deleteBtn);
                favBox.add(row, { expand: true, x_fill: true });
            });

            // ScrollView con tamaño fijo y sin expandir
            let scrollView = new St.ScrollView({
                hscrollbar_policy: St.PolicyType.AUTOMATIC,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
                style: 'border: none; background-color: transparent; padding: 0; margin: 0;'
            });
            scrollView.set_size(200, Math.min(keys.length * 38, 125));
            scrollView.add_actor(favBox);

            scrollItem.addActor(scrollView, { expand: false });
            this.menuBookmarks.menu.addMenuItem(scrollItem);
            this.favItems.push(scrollItem);
        }
    }

    _confirmDeleteBookmark(name) {
        let args = [
            '--question',
            '--title=' + _("Delete favorite"),
            '--text=' + _("Delete") + " \"" + name + "\"?",
            '--width=200'
        ];

        try {
            let proc = new Gio.Subprocess({
                argv: ['zenity'].concat(args),
                flags: Gio.SubprocessFlags.NONE
            });

            proc.init(null);
            proc.wait_async(null, (proc, result) => {
                try {
                    proc.wait_finish(result);
                    let status = proc.get_exit_status();
                    if (status === 0) {
                        this._sendActionToEngine({ action: "delete_bookmark", name: name });
                    }
                } catch (e) {
                    global.logError("WMM: Error en wait_finish del diálogo: " + e.message);
                }
            });
        } catch (e) {
            global.logError("WMM: Error al lanzar zenity: " + e.message);
        }
    }

    /**
     * BLOQUE 5: COMUNICACIÓN (JS -> MOTOR)
     */
    _updateTimerSettings() {
        this._sendActionToEngine({
            "action": "update_timer_settings",
            "enabled": this.masterItem.state,
            "interval": Math.max(1, Math.round(this.slider.value * this._currentMaxInterval)),
            "mode": this.modeSwitch.state ? "sync" : "async",
            "slideshow_bookmark": this.favRotationSwitch.state,
            "spanned_enabled": this.spannedSwitch.state
        });
    }

    _sendActionToEngine(command) {
        try {
            let file = Gio.File.new_for_path(this.commandsPath);
            let rawContent = JSON.stringify(command, null, 4);
            file.replace_contents(rawContent, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            Util.spawnCommandLine("pkill -USR1 -f main.py");
        } catch (e) {
            global.logError("WMM Send Error: " + e.message);
        }
    }

    _openSettingsPanel() {
        this._sendActionToEngine({ "action": "open_panel" });
    }

    /**
     * BLOQUE 6: EVENTOS SISTEMA
     */
    on_applet_clicked(event) {
        let now = Date.now();
        let cooldown = 1000; // milisegundos

        // Si está en cooldown, mostrar feedback y salir
        if (this._last_click_time && (now - this._last_click_time) < cooldown) {
            this.set_applet_icon_symbolic_name("video-display-symbolic");

            // Cancelar la restauración anterior si existe
            if (this._icon_restore_timeout) {
                clearTimeout(this._icon_restore_timeout);
            }
            // Programar restauración del icono
            this._icon_restore_timeout = setTimeout(() => {
                this.set_applet_icon_name("video-display");
            }, cooldown);
            return;
        }

        // Primer clic o fuera de cooldown: ejecutar rotación
        this._last_click_time = now;
        this._sendActionToEngine({ "action": "force_rotation" });
    }

    on_applet_removed_from_panel() {
        /**
         * ESCENARIO DE LIMPIEZA CRÍTICA:
         * Si el usuario quita el applet, no queremos dejar el motor Python vivo.
         * Utilizamos el PID almacenado para una ejecución precisa.
         */
        try {
            let pidPath = GLib.get_user_cache_dir() + "/wmm/pid_main.pid";
            let file = Gio.File.new_for_path(pidPath);

            try {
                let [success, content] = file.load_contents(null);
                if (success) {
                    let pid = content.toString().trim();
                    // kill -9 garantiza la muerte inmediata del proceso
                    Util.spawnCommandLine("kill -9 " + pid);
                    Util.spawnCommandLine("rm " + pidPath);
                    global.logError(" [WMM] Applet eliminado. Proceso " + pid + " finalizado y rastro borrado.");
                }
            } catch (e) {
                // El archivo PID no existe o no se puede leer
            }
        } catch (e) {
            global.logError("WMM Removal Error: " + e.message);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new WMMApplet(metadata, orientation, panel_height, instance_id);
}
