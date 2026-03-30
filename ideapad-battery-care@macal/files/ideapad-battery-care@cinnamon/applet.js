/**
 * IdeaPad Battery Care - Cinnamon Applet
 * 
 * Battery conservation mode control for Lenovo IdeaPad laptops.
 * Limits charging to 80% to extend battery life.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const ByteArray = imports.byteArray;

// Constants
const UUID = "ideapad-battery-care@cinnamon";
const APPLET_PATH = imports.ui.appletManager.appletMeta[UUID].path;

// System paths
const DEFAULT_CONSERVATION_PATH = "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode";
const IDEAPAD_ACPI_DIR = "/sys/bus/platform/drivers/ideapad_acpi";
const BATTERY_PATHS = [
    "/sys/class/power_supply/BAT0/capacity",
    "/sys/class/power_supply/BAT1/capacity"
];

// Configuration
const CONFIG_DIR = GLib.get_home_dir() + "/.config/ideapad-battery-care";
const CONFIG_FILE = CONFIG_DIR + "/config.json";
const CACHE_FILE = CONFIG_DIR + "/.path_cache";

// Update interval (30 seconds)
const UPDATE_INTERVAL = 30;

// Icons - "ac-adapter" for active (plugged/limited), "battery-good" for inactive (full charge)
const ICON_ACTIVE = "ac-adapter-symbolic";
const ICON_INACTIVE = "battery-good-symbolic";
const ICON_ERROR = "dialog-warning-symbolic";


class IdeaPadBatteryCareApplet extends Applet.IconApplet {
    
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        this._orientation = orientation;
        this._instance_id = instance_id;
        
        // Internal state
        this._conservationPath = null;
        this._isConservationActive = false;
        this._batteryPercent = null;
        this._hardwareError = false;
        this._pollTimeoutId = null;
        
        // Detect hardware
        this._detectHardware();
        
        // Setup context menu (after super())
        this._setupContextMenu();
        
        // Cargar configuración y aplicar si existe
        this._loadAndApplyConfig();
        
        // Actualizar estado inicial
        this._updateState();
        
        // Iniciar polling
        this._startPolling();
    }
    
    /**
     * Detecta el archivo conservation_mode en el sistema
     */
    _detectHardware() {
        // Primero intentar leer de cache
        let cachedPath = this._readCachedPath();
        if (cachedPath && this._fileExists(cachedPath)) {
            this._conservationPath = cachedPath;
            return;
        }
        
        // Verificar ruta por defecto
        if (this._fileExists(DEFAULT_CONSERVATION_PATH)) {
            this._conservationPath = DEFAULT_CONSERVATION_PATH;
            this._cachePath(DEFAULT_CONSERVATION_PATH);
            return;
        }
        
        // Buscar en rutas alternativas
        let foundPath = this._findConservationMode();
        if (foundPath) {
            this._conservationPath = foundPath;
            this._cachePath(foundPath);
            return;
        }
        
        // Hardware no compatible
        this._hardwareError = true;
        global.logError("IdeaPad Battery Care: Hardware no compatible - conservation_mode no encontrado");
    }
    
    /**
     * Busca el archivo conservation_mode recursivamente
     */
    _findConservationMode() {
        if (!this._fileExists(IDEAPAD_ACPI_DIR)) {
            return null;
        }
        
        try {
            let [success, stdout, stderr, exit_status] = GLib.spawn_command_line_sync(
                `find ${IDEAPAD_ACPI_DIR} -name conservation_mode 2>/dev/null`
            );
            
            if (success && stdout) {
                let output = ByteArray.toString(stdout).trim();
                if (output) {
                    return output.split('\n')[0];
                }
            }
        } catch (e) {
            global.logError("IdeaPad Battery Care: Error buscando conservation_mode: " + e.message);
        }
        
        return null;
    }
    
    /**
     * Lee la ruta cacheada
     */
    _readCachedPath() {
        try {
            if (this._fileExists(CACHE_FILE)) {
                let [success, contents] = GLib.file_get_contents(CACHE_FILE);
                if (success) {
                    return ByteArray.toString(contents).trim();
                }
            }
        } catch (e) {
            // Ignorar errores de cache
        }
        return null;
    }
    
    /**
     * Guarda la ruta en cache
     */
    _cachePath(path) {
        try {
            this._ensureConfigDir();
            GLib.file_set_contents(CACHE_FILE, path);
        } catch (e) {
            // Ignorar errores de cache
        }
    }
    
    /**
     * Verifica si un archivo existe
     */
    _fileExists(path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    }
    
    /**
     * Asegura que el directorio de configuración existe
     */
    _ensureConfigDir() {
        if (!this._fileExists(CONFIG_DIR)) {
            GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
        }
    }
    
    /**
     * Configura el menú contextual
     */
    _setupContextMenu() {
        // Separador
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Item para activar
        this._activateItem = new PopupMenu.PopupMenuItem("Activar modo conservación");
        this._activateItem.connect('activate', Lang.bind(this, function() {
            this._setConservationMode(true);
        }));
        this._applet_context_menu.addMenuItem(this._activateItem);
        
        // Item para desactivar
        this._deactivateItem = new PopupMenu.PopupMenuItem("Desactivar modo conservación");
        this._deactivateItem.connect('activate', Lang.bind(this, function() {
            this._setConservationMode(false);
        }));
        this._applet_context_menu.addMenuItem(this._deactivateItem);
    }
    
    /**
     * Lee el estado actual del modo conservación
     */
    _readConservationMode() {
        if (this._hardwareError || !this._conservationPath) {
            return null;
        }
        
        try {
            let [success, contents] = GLib.file_get_contents(this._conservationPath);
            if (success) {
                let value = ByteArray.toString(contents).trim();
                return value === "1";
            }
        } catch (e) {
            global.logError("IdeaPad Battery Care: Error leyendo conservation_mode: " + e.message);
        }
        
        return null;
    }
    
    /**
     * Escribe el nuevo estado del modo conservación
     */
    _writeConservationMode(active) {
        if (this._hardwareError || !this._conservationPath) {
            return false;
        }
        
        let value = active ? "1" : "0";
        
        try {
            // Usar el helper con pkexec (PolicyKit)
            let [success, stdout, stderr, exit_status] = GLib.spawn_command_line_sync(
                `pkexec /usr/local/bin/ideapad-battery-care-helper ${value} ${this._conservationPath}`
            );
            
            if (exit_status === 0) {
                this._saveConfig(active);
                return true;
            } else {
                global.logError("IdeaPad Battery Care: Error escribiendo conservation_mode: " + 
                    (stderr ? ByteArray.toString(stderr) : "exit code " + exit_status));
            }
        } catch (e) {
            global.logError("IdeaPad Battery Care: Error ejecutando helper: " + e.message);
        }
        
        return false;
    }
    
    /**
     * Lee el porcentaje de batería
     */
    _readBatteryPercent() {
        for (let i = 0; i < BATTERY_PATHS.length; i++) {
            let path = BATTERY_PATHS[i];
            if (this._fileExists(path)) {
                try {
                    let [success, contents] = GLib.file_get_contents(path);
                    if (success) {
                        return parseInt(ByteArray.toString(contents).trim());
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        return null;
    }
    
    /**
     * Guarda la configuración del usuario
     */
    _saveConfig(active) {
        try {
            this._ensureConfigDir();
            let config = JSON.stringify({ conservation_mode: active });
            GLib.file_set_contents(CONFIG_FILE, config);
        } catch (e) {
            global.logError("IdeaPad Battery Care: Error guardando configuración: " + e.message);
        }
    }
    
    /**
     * Carga la configuración del usuario
     */
    _loadConfig() {
        try {
            if (this._fileExists(CONFIG_FILE)) {
                let [success, contents] = GLib.file_get_contents(CONFIG_FILE);
                if (success) {
                    let config = JSON.parse(ByteArray.toString(contents));
                    return config.conservation_mode;
                }
            }
        } catch (e) {
            // Ignorar errores de configuración
        }
        return null;
    }
    
    /**
     * Carga y aplica la configuración guardada
     */
    _loadAndApplyConfig() {
        let savedMode = this._loadConfig();
        if (savedMode !== null && !this._hardwareError) {
            let currentMode = this._readConservationMode();
            if (currentMode !== null && currentMode !== savedMode) {
                this._writeConservationMode(savedMode);
            }
        }
    }
    
    /**
     * Actualiza el estado del applet
     */
    _updateState() {
        // Leer estado actual
        let mode = this._readConservationMode();
        if (mode !== null) {
            this._isConservationActive = mode;
        }
        
        // Leer batería
        this._batteryPercent = this._readBatteryPercent();
        
        // Actualizar UI
        this._updateIcon();
        this._updateTooltip();
        this._updateMenuItems();
    }
    
    /**
     * Actualiza el icono del applet
     */
    _updateIcon() {
        if (this._hardwareError) {
            this.set_applet_icon_symbolic_name(ICON_ERROR);
        } else if (this._isConservationActive) {
            this.set_applet_icon_symbolic_name(ICON_ACTIVE);
        } else {
            this.set_applet_icon_symbolic_name(ICON_INACTIVE);
        }
    }
    
    /**
     * Actualiza el tooltip del applet
     */
    _updateTooltip() {
        let tooltip = "";
        
        if (this._hardwareError) {
            tooltip = "Hardware no compatible";
        } else {
            let modeText = this._isConservationActive 
                ? "Modo conservación: Activo (80%)" 
                : "Modo conservación: Inactivo (100%)";
            
            let batteryText = this._batteryPercent !== null 
                ? "Batería: " + this._batteryPercent + "%" 
                : "";
            
            tooltip = modeText;
            if (batteryText) {
                tooltip += "\n" + batteryText;
            }
        }
        
        this.set_applet_tooltip(tooltip);
    }
    
    /**
     * Actualiza los items del menú contextual
     */
    _updateMenuItems() {
        if (this._hardwareError) {
            this._activateItem.setSensitive(false);
            this._deactivateItem.setSensitive(false);
        } else {
            this._activateItem.setSensitive(!this._isConservationActive);
            this._deactivateItem.setSensitive(this._isConservationActive);
        }
    }
    
    /**
     * Cambia el modo de conservación
     */
    _setConservationMode(active) {
        if (this._writeConservationMode(active)) {
            this._isConservationActive = active;
            this._updateIcon();
            this._updateTooltip();
            this._updateMenuItems();
        }
    }
    
    /**
     * Inicia el polling para actualizar el estado
     */
    _startPolling() {
        if (this._pollTimeoutId) {
            Mainloop.source_remove(this._pollTimeoutId);
        }
        
        this._pollTimeoutId = Mainloop.timeout_add_seconds(UPDATE_INTERVAL, Lang.bind(this, function() {
            this._updateState();
            return true; // Continuar el polling
        }));
    }
    
    /**
     * Detiene el polling
     */
    _stopPolling() {
        if (this._pollTimeoutId) {
            Mainloop.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
    }
    
    /**
     * Manejador del clic en el applet
     */
    on_applet_clicked(event) {
        if (!this._hardwareError) {
            this._setConservationMode(!this._isConservationActive);
        }
    }
    
    /**
     * Manejador de eliminación del applet
     */
    on_applet_removed_from_panel() {
        this._stopPolling();
    }
}

/**
 * Función principal - punto de entrada del applet
 */
function main(metadata, orientation, panel_height, instance_id) {
    return new IdeaPadBatteryCareApplet(orientation, panel_height, instance_id);
}
