const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gettext = imports.gettext;

const UUID = "combined-monitor@danipin";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const PROC_STAT = "/proc/stat";
const PROC_MEM = "/proc/meminfo";
const SYS_THERMAL = "/sys/class/thermal"; 
const SYS_HWMON = "/sys/class/hwmon";    

// NEW: Predefined list of all configurable keys FOR PROFILE STORAGE
// Added: *-order keys
const CONFIGURABLE_KEYS = [
    // CPU
    "show-cpu", "cpu-label-text", "cpu-symbol", "cpu-display-percentage",
    "cpu-low", "cpu-med", "cpu-high", "cpu-enable-colors",
    "cpu-color-low", "cpu-color-med", "cpu-color-high", "cpu-color-critical",
    // TEMP
    "show-temp", "show-celsius-symbol", "temp-label-text", "temp-symbol", 
    "temp-unit", "temp-low", "temp-med", "temp-high", 
    "temp-enable-colors", "temp-color-low", "temp-color-med", "temp-color-high", 
    "temp-color-critical",
    // RAM
    "show-ram", "ram-label-text", "ram-symbol", "ram-display-percentage", 
    "ram-display-mode", "ram-low", "ram-med", "ram-high", "ram-enable-colors",
    "ram-color-low", "ram-color-med", "ram-color-high", "ram-color-critical",
    // SWAP
    "show-swap", "swap-label-text", "swap-symbol", "swap-only-when-used", 
    "swap-display-percentage", "swap-display-mode", "swap-low", "swap-med", 
    "swap-high", "swap-enable-colors", "swap-color-low", "swap-color-med", 
    "swap-color-high", "swap-color-critical",
    // GENERAL - Order
    "cpu-order", "temp-order", "ram-order", "swap-order", // NEW: For flexible order
    // GENERAL - Other
    "enable-separator", "separator-text", "separator-color", 
    "display-percentage",
    // PROFILE - Profile keys that are used for saving/loading data
    "profile-1-name", "profile-1-data", "profile-2-name", "profile-2-data",
    "profile-3-name", "profile-3-data", "profile-message-duration"
];


class CombinedMonitorApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.applet_path = (metadata && metadata.path) ? metadata.path : "";

        try {
            this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instanceId);
            
            // NEW: Aggressively set all margins and paddings left and right to 0
            this.actor.style = "margin-left: 0px !important; padding-left: 0px !important; margin-right: 0px !important; padding-right: 0px !important;"; 
            
        } catch (e) {
            global.logError("CombinedMonitor: could not create AppletSettings: " + e);
            this.settings = null;
        }

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // --- Standard Settings (Defaults) ---
        this.updateInterval = 300000; 
        
        // CPU Load (Placeholder for all configuration variables)
        this.showCpu = true;
        this.cpuLabel = "CPU";
        this.cpuSymbol = "";
        this.cpuLow = 50;
        this.cpuMed = 75;
        this.cpuHigh = 85;
        this.cpuColorLow = "#ffffff";
        this.cpuColorMed = "#ffff00";
        this.cpuColorHigh = "#FFA500";
        this.cpuColorCritical = "#FF4500";
        this.cpuDisplayPercentage = true; 
        this.cpuColorsEnabled = true;

        // CPU Temp (Placeholder)
        this.showTemp = true; 
        this.tempLabel = "TEMP"; 
        this.tempSymbol = ""; 
        this.tempUnit = 0; // 0=Celsius, 1=Fahrenheit
        this.showCelsiusSymbol = true; // Use unit symbol (°C or °F)
        this.tempLow = 55; 
        this.tempMed = 70;
        this.tempHigh = 85;
        this.tempColorsEnabled = true;
        this.tempColorLow = "#2CFF2C";
        this.tempColorMed = "#FFA500";
        this.tempColorHigh = "#FF4500";
        this.tempColorCritical = "#FF0000";

        // RAM (Placeholder)
        this.showRam = true;
        this.ramLabel = "RAM";
        this.ramSymbol = "";
        this.ramLow = 50;
        this.ramMed = 75;
        this.ramHigh = 85;
        this.ramColorLow = "#ffffff";
        this.ramColorMed = "#ffff00";
        this.ramColorHigh = "#FFA500";
        this.ramColorCritical = "#FF4500";
        this.ramDisplayPercentage = true; 
        this.ramDisplayMode = 0; // 0=Percent, 1=Used, 2=Free
        this.ramColorsEnabled = true;

        // SWAP (Placeholder)
        this.showSwap = true;
        this.swapLabel = "SWAP";
        this.swapSymbol = "";
        this.swapLow = 30;
        this.swapMed = 60;
        this.swapHigh = 80;
        this.swapColorLow = "#ffffff";
        this.swapColorMed = "#ffff00";
        this.swapColorHigh = "#FFA500";
        this.swapColorCritical = "#FF4500";
        this.swapDisplayPercentage = true; 
        this.swapDisplayMode = 0; // 0=Percent, 1=Used, 2=Free
        this.swapColorsEnabled = true;
        this.swapOnlyWhenUsed = false;
        this._lastSwapPercent = 0; 
        this._hasRunOnce = false; 

        // General
        this.displayPercentage = true; 
        
        // NEW: Manual Position Settings
        this.cpuOrder = 1; 
        this.tempOrder = 2; 
        this.ramOrder = 3; 
        this.swapOrder = 4;
        
        this.enableSeparator = true;
        this.separatorText = "|";
        this.separatorColor = "#ffffff";
        
        // PROFILE MANAGEMENT (Defaults)
        this.profile1Name = _("Slot 1 (Standard)");
        this.profile1Data = "{}";
        this.profile2Name = _("Slot 2 (Empty)");
        this.profile2Data = "{}";
        this.profile3Name = _("Slot 3 (Empty)");
        this.profile3Data = "{}";
        this.profileMessageDuration = 5; // seconds
        
        // Internal State Variables
        this._activeProfileIndex = 1; 
        
        // Flags to control update behavior
        this._isMessageActive = false; 
        this._isSettingsLoading = false; 
        this._profileMessageTimeoutId = 0; 

        this._prevTotal = 0;
        this._prevIdle = 0;
        this._timeoutId = 0;

        // Actors
        this._cpuActor = null;
        this._ramActor = null;
        this._swapActor = null;
        this._tempActor = null; 

        this._buildUI(); 
        this._bindSettings();
        this._start();
    }
    
    // ============================================================
    // FUNCTIONS WITH SAFETY GUARDS FOR BINDINGS
    // ============================================================
    
    _guardedUpdate() {
        if (this._isSettingsLoading) return;
        this._clearProfileMessage(); 
        this._updateNow();
    }
    
    _guardedVisibilityChanged() {
        if (this._isSettingsLoading) return;
        this._clearProfileMessage(); 
        this._onVisibilityChanged();
    }
    
    // This is called by the separator bindings
    _applyOrderToBoxGuarded() {
        if (this._isSettingsLoading) return;
        this._clearProfileMessage(); 
        this._applyOrderToBox();
        this._updateNow(); // Ensures an update happens when separators/positions change
    }

    _guardedSymbolChanged(settings) {
        if (this._isSettingsLoading) return;
        this._clearProfileMessage(); 
        this._updateNow();
        this._buildPopupMenu(); // Rebuild menu to update dot
    }
    
    _guardedProfileMessageDurationChanged() {
        global.log("CombinedMonitor: Profile message duration changed, will be active on the next save/load.");
    }
    
    /**
     * NEW FUNCTION: Manages the change in order and triggers the swap.
     */
    _handleOrderChange(changingMetric) {
        if (this._isSettingsLoading) return;
        this._clearProfileMessage(); 
        
        const metricKeys = {
            'cpu': { prop: 'cpuOrder', setting: 'cpu-order' },
            'temp': { prop: 'tempOrder', setting: 'temp-order' },
            'ram': { prop: 'ramOrder', setting: 'ram-order' },
            'swap': { prop: 'swapOrder', setting: 'swap-order' }
        };
        
        // The new value the user just set (already stored in this.cpuOrder etc.)
        const newOrderValue = this[metricKeys[changingMetric].prop]; 
        
        // 1. Capture all metrics and their *new* positions (after update)
        let metricPositions = [];
        let positionsUsed = new Set();
        let counts = {};
        
        for (const metric in metricKeys) {
            const order = this[metricKeys[metric].prop];
            metricPositions.push({ metric, order, settingKey: metricKeys[metric].setting });
            
            positionsUsed.add(order);
            counts[order] = (counts[order] || 0) + 1;
        }

        // 2. Find the gap (the position 1-4 that is now missing)
        const maxPos = 4;
        let missingOrder = -1;
        for (let i = 1; i <= maxPos; i++) {
            if (!positionsUsed.has(i)) {
                missingOrder = i;
                break;
            }
        }
        
        // 3. Find the duplicate position (which just arose from the change)
        let duplicateOrder = -1;
        for (let order in counts) {
            if (counts[order] > 1) {
                duplicateOrder = parseInt(order);
                break;
            }
        }
        
        // 4. If duplicate and gap exist -> perform swap
        if (duplicateOrder !== -1 && missingOrder !== -1) {
            // The metric that needs to be moved (the overwritten metric) is the one 
            // that has the duplicate value AND IS NOT the metric just changed.
            const metricToMoveData = metricPositions.find(m => 
                m.metric !== changingMetric && m.order === duplicateOrder
            );
            
            if (metricToMoveData) {
                // Set the overwritten metric to the freed position (the gap).
                this.settings.setValue(metricToMoveData.settingKey, missingOrder);
                global.log(`CombinedMonitor: Order Swap: ${changingMetric} -> ${newOrderValue}. ${metricToMoveData.metric} automatically moved -> ${missingOrder}.`);
            }
        }
        
        // 5. Apply the layout regardless of the swap
        this._applyOrderToBox();
        this._updateNow();
    }
    // ============================================================
    // END OF SAFETY GUARDS
    // ============================================================
    
    // ============================================================
    // FUNCTION: Saves the symbol choice and updates the UI
    // ============================================================
    _setSymbolFromPopup(metric, iconPath) {
        const settingsKey = metric + '-symbol';
        
        try {
            // Saves the path in GSettings
            this.settings.setValue(settingsKey, iconPath);
            
            // Immediate synchronization of instance variables
            if (metric === 'cpu') this.cpuSymbol = iconPath;
            else if (metric === 'ram') this.ramSymbol = iconPath;
            else if (metric === 'swap') this.swapSymbol = iconPath;
            else if (metric === 'temp') this.tempSymbol = iconPath;
            
        } catch (e) {
            global.logError(`CombinedMonitor: Error saving symbol for ${metric}: ${e}`);
        }
        
        this._buildPopupMenu(); 
        this._updateNow(); 
    }

    // -------------------------
    // Popup Menu Logic 
    // -------------------------
    _buildPopupMenu() {
        try {
            this.menu.removeAll();

            // 1. Separator Presets
            const sepSection = new PopupMenu.PopupSubMenuMenuItem(_("Separator"));

            const _addSepItem = (label, value) => {
                const item = new PopupMenu.PopupMenuItem(label);
                item.connect('activate', () => {
                    this._setSeparatorFromPopup(value); 
                });
                sepSection.menu.addMenuItem(item);
            };
            
            this._setSeparatorFromPopup = (value) => {
                this.settings.setValue("separator-text", value);
                this.settings.setValue("enable-separator", true);
                this._applyOrderToBox();
                this._updateNow();
            };

            _addSepItem("| (Standard)", "|");
            _addSepItem("/ (Slash)", "/");
            _addSepItem("· (Dot)", "·");
            _addSepItem("• (Bullet)", "•");
            _addSepItem(_("Space"), " ");
            
            const noSepItem = new PopupMenu.PopupMenuItem(_("No Separator"));
            noSepItem.connect('activate', () => {
                this.settings.setValue("enable-separator", false);
                this._applyOrderToBox();
            });
            sepSection.menu.addMenuItem(noSepItem);

            this.menu.addMenuItem(sepSection);

            // 2. Symbol Presets with Icon Preview
            const symbolSection = new PopupMenu.PopupSubMenuMenuItem(_("Symbols"));

            const _addSymbolItemWithIcon = (metric, label, iconPath, showIcon) => {
                const baseItem = new PopupMenu.PopupBaseMenuItem({ 
                    reactive: true
                });
                
                const box = new St.BoxLayout({ 
                    x_align: Clutter.ActorAlign.START, 
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true 
                });

                let previewIcon = null;

                if (showIcon && iconPath) {
                    let iconLoadSuccess = false;
                    try {
                        const iconFile = Gio.File.new_for_path(iconPath);
                        
                        if (iconFile.query_exists(null)) {
                            const fileURI = iconFile.get_uri();
                            const gicon = Gio.icon_new_for_string(fileURI);
                            
                            previewIcon = new St.Icon({
                                gicon: gicon,
                                icon_size: 16,
                                style: 'padding-right: 8px;'
                            });
                            iconLoadSuccess = true;
                        } else if (iconPath.includes("symbolic")) {
                            previewIcon = new St.Icon({
                                icon_name: iconPath,
                                icon_size: 16,
                                style: 'padding-right: 8px;',
                                icon_type: St.IconType.SYMBOLIC
                            });
                            iconLoadSuccess = true;
                        }
                    } catch (e) {
                        global.logError("CombinedMonitor: Could not load icon preview for " + iconPath + ": " + e);
                    }
                    
                    if (iconLoadSuccess && previewIcon) {
                        box.add_child(previewIcon);
                    }
                }

                const textLabel = new St.Label({
                    text: label,
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(textLabel);

                baseItem.addActor(box);
                
                // Marks the currently selected menu item with a dot
                if (this.settings.getValue(metric + '-symbol') === iconPath) {
                    baseItem.setShowDot(true); 
                }

                // ACTIVATION: Calls the new method _setSymbolFromPopup to save
                baseItem.connect('activate', () => {
                    this._setSymbolFromPopup(metric, iconPath || "");
                });

                symbolSection.menu.addMenuItem(baseItem);
            };


            // CPU Symbols
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const cpuHeader = new PopupMenu.PopupMenuItem(_("CPU"), { reactive: false });
            cpuHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(cpuHeader);

            _addSymbolItemWithIcon('cpu', _("Icon-White"), this.applet_path + "/icons/cpu_white.svg", true);
            _addSymbolItemWithIcon('cpu', _("Icon-Dark"), this.applet_path + "/icons/cpu_dark.svg", true);
            _addSymbolItemWithIcon('cpu', _("No Symbol (Text Label)"), "", false);
            
            // TEMP Symbols
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const tempHeader = new PopupMenu.PopupMenuItem(_("TEMP"), { reactive: false });
            tempHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(tempHeader);

            _addSymbolItemWithIcon('temp', _("Icon-White"), this.applet_path + "/icons/temp_white.svg", true);
            _addSymbolItemWithIcon('temp', _("Icon-Dark"), this.applet_path + "/icons/temp_dark.svg", true);
            _addSymbolItemWithIcon('temp', _("No Symbol (Text Label)"), "", false);

            // RAM Symbols
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const ramHeader = new PopupMenu.PopupMenuItem(_("RAM"), { reactive: false });
            ramHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(ramHeader);

            _addSymbolItemWithIcon('ram', _("Icon-White"), this.applet_path + "/icons/ram_white.svg", true);
            _addSymbolItemWithIcon('ram', _("Icon-Dark"), this.applet_path + "/icons/ram_dark.svg", true);
            _addSymbolItemWithIcon('ram', _("No Symbol (Text Label)"), "", false);

            // SWAP Symbols
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const swapHeader = new PopupMenu.PopupMenuItem(_("SWAP"), { reactive: false });
            swapHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(swapHeader);

            _addSymbolItemWithIcon('swap', _("Icon-White"), this.applet_path + "/icons/swap_white.svg", true);
            _addSymbolItemWithIcon('swap', _("Icon-Dark"), this.applet_path + "/icons/swap_dark.svg", true);
            _addSymbolItemWithIcon('swap', _("No Symbol (Text Label)"), "", false);

            this.menu.addMenuItem(symbolSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // PROFILE MANAGEMENT SECTION
            const profileSection = new PopupMenu.PopupSubMenuMenuItem(_("Profile Management"));
            
            // Helper function to create the profile menu item
            const _addProfileItem = (index) => {
                const name = this.settings.getValue(`profile-${index}-name`);
                
                const subItem = new PopupMenu.PopupSubMenuMenuItem(name);
                
                // NEW: Set the dot if the profile is active
                if (index === this._activeProfileIndex) {
                    subItem.setShowDot(true); 
                }
                
                const loadItem = new PopupMenu.PopupMenuItem(_("Activate (Load)"));
                loadItem.connect('activate', () => {
                    this._loadProfile(index);
                });
                subItem.menu.addMenuItem(loadItem);
                
                const saveItem = new PopupMenu.PopupMenuItem(_("Save Current Settings"));
                saveItem.connect('activate', () => {
                    this._saveProfile(index);
                });
                subItem.menu.addMenuItem(saveItem);
                
                profileSection.menu.addMenuItem(subItem);
            };

            _addProfileItem(1);
            _addProfileItem(2);
            _addProfileItem(3);

            this.menu.addMenuItem(profileSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            // END: PROFILE MANAGEMENT SECTION

            // 3. System Monitor
            const monitorItem = new PopupMenu.PopupIconMenuItem(
                _("System Monitor"),
                "utilities-system-monitor",
                St.IconType.SYMBOLIC
            );
            monitorItem.connect('activate', () => {
                Util.spawnCommandLine("gnome-system-monitor");
            });
            this.menu.addMenuItem(monitorItem);

            // 4. Restart Cinnamon
            const restartItem = new PopupMenu.PopupIconMenuItem(
                _("Restart Cinnamon"),
                "view-refresh-symbolic",
                St.IconType.SYMBOLIC
            );
            restartItem.connect('activate', () => {
                global.reexec_self();
            });
            this.menu.addMenuItem(restartItem);

        } catch (e) {
            global.logError("CombinedMonitor: _buildPopupMenu failed: " + e);
        }
    }

    on_applet_added_to_panel() {
        try {
            this._buildPopupMenu();
        } catch (e) {
            global.logError("CombinedMonitor: failed to build popup on add: " + e);
        }
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._timeoutId) {
            try { 
                GLib.source_remove(this._timeoutId);
            } catch (e) {}
            this._timeoutId = 0;
        }
        this._clearProfileMessage(); // Also clear the profile timer
        
        try {
            if (this.menuManager && this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu = null;
            }
        } catch (e) {
            global.logError("CombinedMonitor: error removing menu: " + e);
        }
        try {
            // Destruction of all actors upon removal
            if (this._cpuActor) this._cpuActor.destroy();
            if (this._ramActor) this._ramActor.destroy();
            if (this._swapActor) this._swapActor.destroy();
            if (this._tempActor) this._tempActor.destroy(); 
            if (this._box) this._box.destroy(); 
        } catch (e) {
            global.logError("CombinedMonitor: error destroying actors: " + e);
        }
    }

    /**
     * NEW: The _onScrollEvent function was removed (as noted in the German code).
     */

    // ============================================================
    // UI & Logic
    // ============================================================
    /**
     * Creates the base UI elements (Box, Actors).
     */
    _buildUI() {
        this._box = new St.BoxLayout({ reactive: true });
        // Aggressive override for the inner box to eliminate left margin/padding.
        this._box.style = "margin-left: 0px !important; padding-left: 0px !important;";
        
        this.actor.add_child(this._box); // Add the box to the applet here

        // Create all metric actors
        this._cpuActor = this._makeMetricActor('cpu');
        this._ramActor = this._makeMetricActor('ram');
        this._swapActor = this._makeMetricActor('swap');
        this._tempActor = this._makeMetricActor('temp'); 
    }

    /**
     * Creates an Actor for a metric (CPU, RAM, SWAP, TEMP).
     */
    _makeMetricActor(metric) {
        const box = new St.BoxLayout({ reactive: false, style_class: `combined-monitor-metric-${metric}` });
        
        // **********************************************
        // HERE YOU CAN ADJUST THE SPACING INDIVIDUALLY (in pixels)
        
        const cpuPadR = 4;  // CPU: Right (to the value)
        const cpuPadL = 4;  // CPU: Left (to the separator)
        
        const ramPadR = 3;  // RAM: Right (to the value)
        const ramPadL = 4;  // RAM: Left (to the separator)
        
        const swapPadR = 3; // SWAP: Right (to the value)
        const swapPadL = 4; // SWAP: Left (to the separator)
        
        const tempPadR = 0; // TEMP: Right (to the value)
        const tempPadL = 4; // TEMP: Left (to the separator)
        // **********************************************
        
        let padR = 0;
        let padL = 0;

        // Determine padding values based on the metric
        if (metric === 'cpu') {
            padR = cpuPadR;
            padL = cpuPadL;
        } else if (metric === 'ram') {
            padR = ramPadR;
            padL = ramPadL;
        } else if (metric === 'swap') {
            padR = swapPadR;
            padL = swapPadL;
        } else if (metric === 'temp') {
            padR = tempPadR;
            padL = tempPadL;
        }

        let iconStyles = [];
        
        if (padR > 0) {
            iconStyles.push(`padding-right: ${padR}px;`);
        }
        if (padL > 0) {
            iconStyles.push(`padding-left: ${padL}px;`);
        }

        const iconStyle = iconStyles.join(' ');

        // The style is only applied if iconStyle is not empty
        const icon = new St.Icon({ visible: true, icon_size: 16, style: iconStyle });
        const valueLabel = new St.Label({ text: "", y_align: Clutter.ActorAlign.CENTER });
        
        box._cm_icon = icon;
        box._cm_valueLabel = valueLabel;
        
        box.add_child(icon);
        box.add_child(valueLabel);
        
        return box;
    }

    /**
     * Callback for changes in visibility or mode.
     */
    _onVisibilityChanged() {
        // 1. Apply layout order
        this._applyOrderToBox();
        // 2. Force immediate update of contents
        this._updateNow();
    }


    _bindSettings() {
        if (!this.settings) return;

        this.settings.bind("update-interval", "updateInterval", this._guardedUpdate.bind(this));
        
        this.settings.bind("display-percentage", "displayPercentage", this._guardedUpdate.bind(this));

        // NEW: BINDINGS FOR METRIC ORDER (with new handler for automatic swap)
        this.settings.bind("cpu-order", "cpuOrder", this._handleOrderChange.bind(this, 'cpu'));
        this.settings.bind("temp-order", "tempOrder", this._handleOrderChange.bind(this, 'temp'));
        this.settings.bind("ram-order", "ramOrder", this._handleOrderChange.bind(this, 'ram'));
        this.settings.bind("swap-order", "swapOrder", this._handleOrderChange.bind(this, 'swap'));


        // CPU BINDINGS
        this.settings.bind("show-cpu", "showCpu", this._guardedVisibilityChanged.bind(this)); 
        this.settings.bind("cpu-label-text", "cpuLabel", this._guardedUpdate.bind(this)); 
        this.settings.bind("cpu-symbol", "cpuSymbol", this._guardedSymbolChanged.bind(this));
        this.settings.bind("cpu-display-percentage", "cpuDisplayPercentage", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-enable-colors", "cpuColorsEnabled", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-low", "cpuLow", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-med", "cpuMed", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-high", "cpuHigh", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-color-low", "cpuColorLow", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-color-med", "cpuColorMed", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-color-high", "cpuColorHigh", this._guardedUpdate.bind(this));
        this.settings.bind("cpu-color-critical", "cpuColorCritical", this._guardedUpdate.bind(this));

        // CPU TEMPERATURE BINDINGS
        this.settings.bind("show-temp", "showTemp", this._guardedVisibilityChanged.bind(this)); 
        this.settings.bind("temp-label-text", "tempLabel", this._guardedUpdate.bind(this)); 
        this.settings.bind("temp-symbol", "tempSymbol", this._guardedSymbolChanged.bind(this));
        this.settings.bind("temp-unit", "tempUnit", this._guardedUpdate.bind(this)); 
        this.settings.bind("show-celsius-symbol", "showCelsiusSymbol", this._guardedUpdate.bind(this)); 
        this.settings.bind("temp-low", "tempLow", this._guardedUpdate.bind(this));
        this.settings.bind("temp-med", "tempMed", this._guardedUpdate.bind(this));
        this.settings.bind("temp-high", "tempHigh", this._guardedUpdate.bind(this));
        this.settings.bind("temp-enable-colors", "tempColorsEnabled", this._guardedUpdate.bind(this));
        this.settings.bind("temp-color-low", "tempColorLow", this._guardedUpdate.bind(this));
        this.settings.bind("temp-color-med", "tempColorMed", this._guardedUpdate.bind(this));
        this.settings.bind("temp-color-high", "tempColorHigh", this._guardedUpdate.bind(this));
        this.settings.bind("temp-color-critical", "tempColorCritical", this._guardedUpdate.bind(this));

        // RAM BINDINGS
        this.settings.bind("show-ram", "showRam", this._guardedVisibilityChanged.bind(this));
        this.settings.bind("ram-label-text", "ramLabel", this._guardedUpdate.bind(this));
        this.settings.bind("ram-symbol", "ramSymbol", this._guardedSymbolChanged.bind(this));
        this.settings.bind("ram-display-percentage", "ramDisplayPercentage", this._guardedUpdate.bind(this));
        this.settings.bind("ram-display-mode", "ramDisplayMode", this._guardedUpdate.bind(this));
        this.settings.bind("ram-enable-colors", "ramColorsEnabled", this._guardedUpdate.bind(this));
        this.settings.bind("ram-low", "ramLow", this._guardedUpdate.bind(this));
        this.settings.bind("ram-med", "ramMed", this._guardedUpdate.bind(this));
        this.settings.bind("ram-high", "ramHigh", this._guardedUpdate.bind(this));
        this.settings.bind("ram-color-low", "ramColorLow", this._guardedUpdate.bind(this));
        this.settings.bind("ram-color-med", "ramColorMed", this._guardedUpdate.bind(this));
        this.settings.bind("ram-color-high", "ramColorHigh", this._guardedUpdate.bind(this));
        this.settings.bind("ram-color-critical", "ramColorCritical", this._guardedUpdate.bind(this));

        // SWAP BINDINGS
        this.settings.bind("show-swap", "showSwap", this._guardedVisibilityChanged.bind(this));
        this.settings.bind("swap-label-text", "swapLabel", this._guardedUpdate.bind(this));
        this.settings.bind("swap-symbol", "swapSymbol", this._guardedSymbolChanged.bind(this));
        this.settings.bind("swap-only-when-used", "swapOnlyWhenUsed", this._guardedVisibilityChanged.bind(this));
        this.settings.bind("swap-display-percentage", "swapDisplayPercentage", this._guardedUpdate.bind(this));
        this.settings.bind("swap-display-mode", "swapDisplayMode", this._guardedUpdate.bind(this));
        this.settings.bind("swap-enable-colors", "swapColorsEnabled", this._guardedUpdate.bind(this));
        this.settings.bind("swap-low", "swapLow", this._guardedUpdate.bind(this));
        this.settings.bind("swap-med", "swapMed", this._guardedUpdate.bind(this));
        this.settings.bind("swap-high", "swapHigh", this._guardedUpdate.bind(this));
        this.settings.bind("swap-color-low", "swapColorLow", this._guardedUpdate.bind(this));
        this.settings.bind("swap-color-med", "swapColorMed", this._guardedUpdate.bind(this));
        this.settings.bind("swap-color-high", "swapColorHigh", this._guardedUpdate.bind(this));
        this.settings.bind("swap-color-critical", "swapColorCritical", this._guardedUpdate.bind(this));

        // PROFILE BINDINGS
        this.settings.bind("profile-message-duration", "profileMessageDuration", this._guardedProfileMessageDurationChanged.bind(this)); 
        this.settings.bind("profile-1-name", "profile1Name", this._buildPopupMenu.bind(this)); 
        this.settings.bind("profile-1-data", "profile1Data"); 
        this.settings.bind("profile-2-name", "profile2Name", this._buildPopupMenu.bind(this)); 
        this.settings.bind("profile-2-data", "profile2Data"); 
        this.settings.bind("profile-3-name", "profile3Name", this._buildPopupMenu.bind(this)); 
        this.settings.bind("profile-3-data", "profile3Data"); 
        
        // SEPARATOR BINDINGS (still use the guardedApplyOrder handler)
        this.settings.bind("enable-separator", "enableSeparator", this._applyOrderToBoxGuarded.bind(this));
        this.settings.bind("separator-text", "separatorText", this._applyOrderToBoxGuarded.bind(this));
        this.settings.bind("separator-color", "separatorColor", this._applyOrderToBoxGuarded.bind(this));
    }

    /**
     * Clears the active profile message and resets the timer.
     */
    _clearProfileMessage() {
        if (this._profileMessageTimeoutId) {
            try {
                Mainloop.source_remove(this._profileMessageTimeoutId);
            } catch (e) {
                global.logError("CombinedMonitor: Error removing profile timer: " + e);
            }
            this._profileMessageTimeoutId = 0;
        }
        this._isMessageActive = false;
        // Important: reset the label so that _updateNow() can set it again
        this.set_applet_label(""); 
    }

    /**
     * Saves all current GSettings to a profile (Slot).
     * @param {number} index - The profile index (1, 2, or 3).
     */
    _saveProfile(index) {
        if (!this.settings) return;

        // Ensure any running message timer is cleared before starting a new one
        this._clearProfileMessage(); 

        try {
            const settingsToSave = {};

            // IMPORTANT: Use the predefined list CONFIGURABLE_KEYS
            for (const key of CONFIGURABLE_KEYS) { 
                settingsToSave[key] = this.settings.getValue(key);
            }

            const dataKey = `profile-${index}-data`;
            const dataString = JSON.stringify(settingsToSave);
            this.settings.setValue(dataKey, dataString);

            // 5. Activate Message Mode: Blocks _updateNow()
            this._isMessageActive = true; 
            const profileName = this.settings.getValue(`profile-${index}-name`);
            this.set_applet_label(_(`Profile Saved: ${profileName}`)); 

            // 6. Timer to deactivate the message (Variable Duration)
            // Duration is in seconds for Mainloop.timeout_add_seconds
            this._profileMessageTimeoutId = Mainloop.timeout_add_seconds(this.profileMessageDuration, () => { 
                this._clearProfileMessage(); // Deactivates message mode and timer
                this._updateNow(); // Performs a normal update
                return GLib.SOURCE_REMOVE; // Important: return value for Mainloop
            });

            // 7. Rebuild the popup menu to remove/update the dot
            this._buildPopupMenu();
            
            global.log(`CombinedMonitor: Profile ${index} (${profileName}) saved.`);
            
        } catch (e) {
            global.logError(`CombinedMonitor: Error saving Profile ${index}: ` + e);
            this._clearProfileMessage(); // Reset immediately on error
        }
    }


    /**
     * Loads a profile (Slot) and applies the settings.
     * @param {number} index - The profile index (1, 2, or 3).
     */
    _loadProfile(index) {
        if (!this.settings) return;

        this._clearProfileMessage(); // Ensure old timer is gone

        // 1. Set loading flag to suppress binding triggers
        this._isSettingsLoading = true; 

        try {
            const dataKey = `profile-${index}-data`;
            const dataString = this.settings.getValue(dataKey);
            const loadedSettings = JSON.parse(dataString);
            
            if (Object.keys(loadedSettings).length === 0) {
                global.logWarning(`CombinedMonitor: Profile ${index} is empty. Load aborted.`);
                return;
            }

            // 2. Reset all saved values. 
            // ATTENTION: The global setting profile-message-duration is NOT overwritten
            for (const key of CONFIGURABLE_KEYS) {
                if (loadedSettings.hasOwnProperty(key)) {
                    this.settings.setValue(key, loadedSettings[key]);
                }
            }

            // 3. Fully update the UI (layout and values)
            // Must be called here, as bindings were ignored due to this._isSettingsLoading=true
            this._onVisibilityChanged(); 

            // NEW: Store the index of the actively loaded profile
            this._activeProfileIndex = index;

            // 4. Activate Message Mode: Blocks _updateNow() for the configured time
            this._isMessageActive = true; 
            const profileName = this.settings.getValue(`profile-${index}-name`);
            this.set_applet_label(_(`Active: ${profileName}`)); 

            // 5. Timer to deactivate the message (Variable Duration)
            this._profileMessageTimeoutId = Mainloop.timeout_add_seconds(this.profileMessageDuration, () => { 
                this._clearProfileMessage(); // Deactivates message mode and timer
                this._updateNow(); // Performs a normal update
                return GLib.SOURCE_REMOVE; // Important: return value for Mainloop
            });
            
            // 6. Rebuild the popup menu to reset the dot
            this._buildPopupMenu();

            global.log(`CombinedMonitor: Profile ${index} (${profileName}) loaded.`);
            
        } catch (e) {
            global.logError(`CombinedMonitor: Error loading Profile ${index}: ` + e);
        } finally {
            // 7. Always remove the loading flag, even on error
            this._isSettingsLoading = false; 
        }
    }


    /**
     * Determines the current CPU load.
     */
    _getCPUData() {
        let cpuData = {
            total: 0,
            idle: 0,
            loadPercent: -1 // -1 signals error
        };
        
        try {
            const content = GLib.file_get_contents(PROC_STAT)[1].toString();
            const lines = content.trim().split('\n');
            
            // The first line contains the overall statistics
            const cpuLine = lines[0];
            
            // "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
            const parts = cpuLine.trim().split(/\s+/).slice(1).map(x => parseInt(x));
            
            // parts[3] is idle, the rest is busy (total - idle)
            const idle = parts[3];
            const total = parts.reduce((a, b) => a + b, 0);
            
            // CORRECTION: On the first run (initial 0 state), immediately return 0%
            if (this._prevTotal === 0 && total > 0) {
                 this._prevTotal = total;
                 this._prevIdle = idle;
                 cpuData.loadPercent = 0; // Show 0% until the second measurement
                 return cpuData;
            }

            if (this._prevTotal > 0 && total > this._prevTotal) {
                const totalDiff = total - this._prevTotal;
                const idleDiff = idle - this._prevIdle;
                const load = (totalDiff - idleDiff) / totalDiff;
                cpuData.loadPercent = Math.round(load * 100);
            }
            
            this._prevTotal = total;
            this._prevIdle = idle;
            
            cpuData.total = total;
            cpuData.idle = idle;
            
        } catch (e) {
            global.logError("CombinedMonitor: Error reading /proc/stat: " + e);
        }

        return cpuData;
    }


    /**
     * Determines RAM and SWAP usage.
     */
    _getMemData() {
        let memTotal = 0;
        let memAvailable = 0; 
        let swapTotal = 0;
        let swapFree = 0;
        
        try {
            const content = GLib.file_get_contents(PROC_MEM)[1].toString();
            const lines = content.trim().split('\n');
            
            for (const line of lines) {
                if (line.startsWith("MemTotal:")) {
                    memTotal = parseInt(line.split(/\s+/)[1]) || 0;
                } else if (line.startsWith("MemAvailable:")) {
                    memAvailable = parseInt(line.split(/\s+/)[1]) || 0;
                } else if (line.startsWith("SwapTotal:")) {
                    swapTotal = parseInt(line.split(/\s+/)[1]) || 0;
                } else if (line.startsWith("SwapFree:")) {
                    swapFree = parseInt(line.split(/\s+/)[1]) || 0;
                }
            }
        } catch (e) {
            global.logError("CombinedMonitor: Error reading /proc/meminfo: " + e);
        }

        const memUsed = memTotal - memAvailable;
        const swapPercent = swapTotal ? Math.round(((swapTotal - swapFree) / swapTotal) * 100) : 0;
        const memPercent = memTotal ? Math.round((memUsed / memTotal) * 100) : 0;
        
        this._lastSwapPercent = swapPercent; 

        return { 
            memPercent, 
            swapPercent, 
            memUsedKB: memUsed, 
            memTotalKB: memTotal, 
            swapUsedKB: swapTotal - swapFree, 
            swapTotalKB: swapTotal 
        };
    }
    
    /**
     * Reads the CPU temperature from a sensor path.
     * @param {string} path - The path to the sensor file.
     * @returns {number} The temperature in millidegrees Celsius or -1 on error.
     */
    _readTempFromFile(path) {
        try {
            // Added check for file existence
            const file = Gio.File.new_for_path(path);
            if (!file.query_exists(null)) return -1;
            
            const content = GLib.file_get_contents(path)[1].toString().trim();
            // Ensures the value is positive and a number
            const value = parseInt(content);
            return (value > 0 && !isNaN(value)) ? value : -1;
        } catch (e) {
            return -1;
        }
    }
    
    /**
     * Finds the best available temperature sensor (prioritizes 'package' or 'cpu' sensors).
     * @returns {number} The temperature in degrees Celsius (rounded) or -1 on error.
     */
    _getTempData() {
        let tempMilliC = -1; // Temperature in millidegrees Celsius
        let bestTempMilliC = -1;
        
        // Prioritized keywords that identify a CPU/Package temperature
        const priorityKeywords = ['package', 'cpu', 'core', 'die', 'tdie'];

        // --- 1. /sys/class/thermal (Standard kernel interface) ---
        try {
            const thermalDir = Gio.File.new_for_path(SYS_THERMAL);
            const enumerator = thermalDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let fileInfo;
            
            while ((fileInfo = enumerator.next_file(null))) {
                const zoneName = fileInfo.get_name();
                const typePath = GLib.build_filenamev([SYS_THERMAL, zoneName, 'type']);
                const tempPath = GLib.build_filenamev([SYS_THERMAL, zoneName, 'temp']);
                
                let type = "";
                try {
                    // Added check for type file existence
                    const typeFile = Gio.File.new_for_path(typePath);
                    if (typeFile.query_exists(null)) {
                        type = GLib.file_get_contents(typePath)[1].toString().trim().toLowerCase();
                    }
                } catch (e) {}
                
                tempMilliC = this._readTempFromFile(tempPath);
                
                if (tempMilliC > 0) {
                    // If the type contains a keyword, we use it immediately as the best result
                    if (priorityKeywords.some(keyword => type.includes(keyword))) {
                        return Math.round(tempMilliC / 1000); // Degrees Celsius
                    }
                    // Otherwise, we save it as a fallback (will be overwritten by HWMON if better)
                    if (bestTempMilliC === -1) {
                         bestTempMilliC = tempMilliC;
                    }
                }
            }
        } catch (e) {
            // global.logError("CombinedMonitor: Error reading /sys/class/thermal: " + e);
        }
        
        // --- 2. /sys/class/hwmon (Hardware Monitor - Detailed Sensor Access) ---
        try {
             const hwmonDir = Gio.File.new_for_path(SYS_HWMON);
             const enumerator = hwmonDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
             let fileInfo;
            
             while ((fileInfo = enumerator.next_file(null))) {
                 const hwmonPath = GLib.build_filenamev([SYS_HWMON, fileInfo.get_name()]);
                 
                 for (let i = 1; i <= 10; i++) { // Check max 10 sensors per folder
                     const tempPath = GLib.build_filenamev([hwmonPath, `temp${i}_input`]);
                     tempMilliC = this._readTempFromFile(tempPath);
                     
                     if (tempMilliC > 0) {
                         const labelPath = GLib.build_filenamev([hwmonPath, `temp${i}_label`]);
                         let tempLabel = "";
                         try {
                            const labelFile = Gio.File.new_for_path(labelPath);
                            if (labelFile.query_exists(null)) {
                                tempLabel = GLib.file_get_contents(labelPath)[1].toString().trim().toLowerCase();
                            }
                         } catch (e) {}

                         // High Priority: Finds the correct CPU/Package Sensor
                         if (priorityKeywords.some(keyword => tempLabel.includes(keyword))) {
                             return Math.round(tempMilliC / 1000); // Degrees Celsius
                         }
                         
                         // Low Priority: Save as general fallback, if no better result has been found yet
                         if (bestTempMilliC === -1) {
                              bestTempMilliC = tempMilliC;
                         }
                     }
                 }
             }
        } catch (e) {
            // global.logError("CombinedMonitor: Error reading /sys/class/hwmon: " + e);
        }

        // 3. Last Fallback: The best result found (may be a less specific sensor)
        if (bestTempMilliC > 0) {
            return Math.round(bestTempMilliC / 1000); 
        }

        return -1;
    }


    /**
     * The main update function. Called regularly or upon settings changes.
     */
    _updateNow() {
        if (!this.settings) return true; // Stops the timer if settings are missing
        
        // Blocks the normal update if a profile message is currently active
        if (this._isMessageActive) {
            return true; // Continues the loop
        }

        // 1. Fetch data
        const cpuData = this._getCPUData();
        const memData = this._getMemData();
        const tempData = this._getTempData();
        
        // 2. Format and display values
        
        // CPU
        this._updateMetric(
            'cpu', 
            this.showCpu, 
            this._cpuActor, 
            cpuData.loadPercent, 
            this.cpuLabel, 
            this.cpuSymbol, 
            this.cpuLow, 
            this.cpuMed, 
            this.cpuHigh, 
            this.cpuColorLow, 
            this.cpuColorMed, 
            this.cpuColorHigh, 
            this.cpuColorCritical, 
            this.cpuDisplayPercentage
        );
        
        // RAM
        let ramValue = -1;
        let ramDisplayText = "";
        
        switch (this.ramDisplayMode) {
            case 0: // Percent
                ramValue = memData.memPercent;
                ramDisplayText = `${ramValue}${this.ramDisplayPercentage && this.displayPercentage ? '%' : ''}`;
                break;
            case 1: // Used
                ramValue = memData.memPercent;
                ramDisplayText = this._formatBytes(memData.memUsedKB * 1024);
                break;
            case 2: // Free
                ramValue = memData.memPercent; 
                ramDisplayText = this._formatBytes((memData.memTotalKB - memData.memUsedKB) * 1024);
                break;
            default: // Default: Percent
                ramValue = memData.memPercent;
                ramDisplayText = `${ramValue}${this.ramDisplayPercentage && this.displayPercentage ? '%' : ''}`;
        }
        
        this._updateMetric(
            'ram', 
            this.showRam, 
            this._ramActor, 
            ramValue, 
            this.ramLabel, 
            this.ramSymbol, 
            this.ramLow, 
            this.ramMed, 
            this.ramHigh, 
            this.ramColorLow, 
            this.ramColorMed, 
            this.ramColorHigh, 
            this.ramColorCritical, 
            this.ramDisplayPercentage,
            this.ramDisplayMode !== 0 ? ramDisplayText : null // If not percent, use the formatted text
        );


        // SWAP
        let swapValue = -1;
        let swapDisplayText = "";
        let showSwapFinal = this.showSwap && (!this.swapOnlyWhenUsed || memData.swapPercent > 0);
        
        switch (this.swapDisplayMode) {
            case 0: // Percent
                swapValue = memData.swapPercent;
                swapDisplayText = `${swapValue}${this.swapDisplayPercentage && this.displayPercentage ? '%' : ''}`;
                break;
            case 1: // Used
                swapValue = memData.swapPercent;
                swapDisplayText = this._formatBytes(memData.swapUsedKB * 1024);
                break;
            case 2: // Free
                swapValue = memData.swapPercent; 
                swapDisplayText = this._formatBytes((memData.swapTotalKB - memData.swapUsedKB) * 1024);
                break;
            default: // Default: Percent
                swapValue = memData.swapPercent;
                swapDisplayText = `${swapValue}${this.swapDisplayPercentage && this.displayPercentage ? '%' : ''}`;
        }

        this._updateMetric(
            'swap', 
            showSwapFinal, 
            this._swapActor, 
            swapValue, 
            this.swapLabel, 
            this.swapSymbol, 
            this.swapLow, 
            this.swapMed, 
            this.swapHigh, 
            this.swapColorLow, 
            this.swapColorMed, 
            this.swapColorHigh, 
            this.swapColorCritical, 
            this.swapDisplayPercentage,
            this.swapDisplayMode !== 0 ? swapDisplayText : null // If not percent, use the formatted text
        );


        // TEMPERATURE
        let tempValue = tempData; // Temperature in °C
        let tempDisplayValue = tempValue;
        let unitSymbol = "°C";

        if (this.tempUnit === 1 && tempValue !== -1) { // Conversion to Fahrenheit (assuming tempUnit 1 is F)
            tempDisplayValue = Math.round(tempValue * 9 / 5 + 32);
            unitSymbol = "°F";
        }
        
        let tempDisplayText = tempValue === -1 ? _("N/A") : tempDisplayValue + (this.showCelsiusSymbol ? unitSymbol : "");


        this._updateMetric(
            'temp', 
            this.showTemp, 
            this._tempActor, 
            tempValue, // Threshold values are always based on °C
            this.tempLabel, 
            this.tempSymbol, 
            this.tempLow, 
            this.tempMed, 
            this.tempHigh, 
            this.tempColorLow, 
            this.tempColorMed, 
            this.tempColorHigh, 
            this.tempColorCritical, 
            false, // Temperature never shows %
            tempDisplayText // Passes the Celsius/Fahrenheit text
        );
        
        // 3. Re-apply layout, as SWAP visibility might have changed
        if (this._hasRunOnce) {
            // Only execute if there was a change in SWAP visibility
            const currentSwapVisible = this._swapActor.visible;
            const expectedSwapVisible = this.showSwap && (!this.swapOnlyWhenUsed || this._lastSwapPercent > 0);
            
            // Check visibility change against the last known actor state (not strictly accurate as 'visible' is set later, but captures the intent)
            if (currentSwapVisible !== expectedSwapVisible) {
                this._applyOrderToBox();
            }
        } else {
            // Always apply layout on the first run
            this._applyOrderToBox();
            this._hasRunOnce = true;
        }

        return true;
    }
    
    /**
     * Helper function for formatting bytes to MB/GB.
     * @param {number} bytes - The byte count.
     * @returns {string} Formatted string (e.g., "1.2 GB").
     */
    _formatBytes(bytes) {
        if (bytes === 0) return "0 MB";
        const k = 1024;
        const units = ['MB', 'GB', 'TB'];
        
        // Start at MB (k^2), as Kilobytes (KB) are too small
        let i = 0;
        let value = bytes / (k * k); 
        
        if (value >= 1024) {
            i = 1;
            value = bytes / (k * k * k);
        }
        if (value >= 1024) {
             i = 2;
             value = bytes / (k * k * k * k);
        }
        
        // Only one decimal place
        const displayValue = value.toFixed(1);
        
        return `${displayValue} ${units[i]}`;
    }

    /**
     * Updates the text, icon, and color of a metric actor.
     */
    _updateMetric(
        metric, 
        showMetric, 
        actor, 
        value, 
        label, 
        symbolPath, 
        low, 
        med, 
        high, 
        cLow, 
        cMed, 
        cHigh, 
        cCrit, 
        showPercent,
        customText = null
    ) {
        if (!actor) return;
        
        const valueLabel = actor._cm_valueLabel;
        const icon = actor._cm_icon;
        
        // 1. Determine text
        let text = "";
        if (customText !== null) {
            text = customText;
        } else if (value === -1) {
            text = _("N/A"); 
        } else if (value >= 0) {
            text = `${value}${showPercent && this.displayPercentage ? '%' : ''}`;
        }
        
        // 2. Determine icon or label
        let iconName = "";
        if (symbolPath) {
            // Use icon if path is set
            icon.visible = true;
            try {
                if (symbolPath.includes("symbolic")) {
                    icon.set_icon_name(symbolPath);
                    icon.set_icon_type(St.IconType.SYMBOLIC);
                } else {
                    const iconFile = Gio.File.new_for_path(symbolPath);
                    const fileURI = iconFile.get_uri();
                    const gicon = Gio.icon_new_for_string(fileURI);
                    icon.set_gicon(gicon);
                }
            } catch (e) {
                 global.logError(`CombinedMonitor: Error setting icon for ${metric}: ${e}`);
                 icon.visible = false; // Hide icon on error
                 text = `${label} ${text}`; // Fallback to text label (no colon)
            }
            
            valueLabel.set_text(text);
            
        } else {
            // Use text label
            icon.visible = false;
            valueLabel.set_text(`${label} ${text}`); // NEW LINE WITHOUT COLON
        }
        
        // 3. Determine color
        const colorsEnabled = this[`${metric}ColorsEnabled`];
        const col = this._pickColor(value, low, med, high, cLow, cMed, cHigh, cCrit);
        
        let style = "";
        
        if (colorsEnabled) style += ` color: ${col};`;
        try { valueLabel.style = style; } catch (e) {}
        
        // 4. Visibility of the entire actor (finalized in _applyOrderToBox)
    }


    _pickColor(value, low, med, high, cLow, cMed, cHigh, cCrit) {
        if (value === -1) return cLow; // Error or N/A default color
        if (value <= low) return cLow;
        if (value <= med) return cMed;
        if (value <= high) return cHigh;
        return cCrit;
    }

    /**
     * Applies the user-defined order of metrics to the box.
     * Metrics are sorted according to the *-order settings.
     */
    _applyOrderToBox() {
        // Manually remove all children
        let children = this._box.get_children();
        for (let child of children) {
            this._box.remove_child(child);
        }
        
        // 1. Define all metrics with their position and visibility
        const swapIsVisible = this.showSwap && (!this.swapOnlyWhenUsed || this._lastSwapPercent > 0);
        
        const metricActors = [
            { 
                actor: this._cpuActor, 
                order: this.cpuOrder, 
                isVisible: this.showCpu 
            },
            { 
                actor: this._tempActor, 
                order: this.tempOrder, 
                isVisible: this.showTemp 
            },
            { 
                actor: this._ramActor, 
                order: this.ramOrder, 
                isVisible: this.showRam 
            },
            { 
                actor: this._swapActor, 
                order: this.swapOrder, 
                isVisible: swapIsVisible 
            }
        ];
        
        // Set all actors initially invisible so they are only added visibly later
        metricActors.forEach(m => { if (m.actor) m.actor.visible = false; });
        
        // 2. Filter visible actors and sort them by their 'order' property
        let finalOrderedActors = metricActors
            .filter(m => m.isVisible && m.actor)
            .sort((a, b) => a.order - b.order) // Sort by the desired order (1, 2, 3, 4)
            .map(m => m.actor);
        
        // 3. Add the sorted actors with separators to the box
        const separatorText = this.separatorText;
        const separatorColor = this.separatorColor;
        const enableSeparator = this.enableSeparator;

        for (let i = 0; i < finalOrderedActors.length; i++) {
            const actor = finalOrderedActors[i];
            
            // Set visibility of the actor
            actor.visible = true; 
            
            this._box.add_child(actor);

            // Add separator, except after the last element
            if (enableSeparator && i < finalOrderedActors.length - 1) {
                const sep = new St.Label({ 
                    text: separatorText,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `padding-left: 4px; padding-right: 4px; color: ${separatorColor};` 
                });
                this._box.add_child(sep);
            }
        }
        
        // IMPORTANT: Control visibility of the entire applet
        this.actor.visible = finalOrderedActors.length > 0;
    }

    // --- Core Loop Functions ---
    _onIntervalChanged() {
        this._restartLoop();
    }

    _start() {
        this._restartLoop();
    }

    _restartLoop() {
        if (this._timeoutId) {
            try { 
                GLib.source_remove(this._timeoutId);
            } catch (e) {}
            this._timeoutId = 0;
        }

        this._updateNow(); // Immediate Update

        if (this.updateInterval > 0) {
            this._timeoutId = Mainloop.timeout_add(this.updateInterval, this._updateNow.bind(this));
        }
    }
}

// Exports
var APPLET_UUID = UUID;

function main(metadata, orientation, panelHeight, instanceId) { 
    return new CombinedMonitorApplet(metadata, orientation, panelHeight, instanceId);
}
