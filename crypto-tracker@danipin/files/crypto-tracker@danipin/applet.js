const St = imports.gi.St;
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util; 
const PopupMenu = imports.ui.popupMenu; 
const GLib = imports.gi.GLib; // Kept as a dependency import

// --- FIX: Korrekte Gettext-Bindung basierend auf combined-monitor Referenz ---
const Gettext = imports.gettext; 
const UUID = "crypto-tracker@danipin";

// Die Bindung registriert die UUID und den lokalen Installationspfad für .mo-Dateien.
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// Die globale Übersetzungsfunktion, die das Gettext-Verzeichnis (Domain) nutzt.
function _(str) {
    return Gettext.dgettext(UUID, str);
}
// Die vorherige fehlerhafte Bindung und der Alias _t wurden entfernt.
// -------------------------------------------------------------------


function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

// Helper function to convert the currency code into its symbol
function getCurrencySymbol(code) {
    switch (code.toUpperCase()) {
        case 'USD':
            return '$';
        case 'EUR':
            return '€';
        case 'GBP':
            return '£';
        case 'JPY':
            return '¥';
        case 'CHF':
            return 'Fr';
        case 'CAD':
            return 'C$';
        case 'AUD':
            return 'A$';
        default:
            return code.toUpperCase(); // If unknown, return the code
    }
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, 0); 
        
        // FIX: Die fehlerhafte Zuweisung (this._ = _t;) wurde entfernt.
        
        try {
            this.settings = new Settings.AppletSettings(this, UUID, 0);
            this.metrics = [];
            
            this._has_data = false; 
            
            // Initialize the pop-up menu
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menuManager.addMenu(this.menu);
            
            // FIX: Make pop-up menu persistent
            this.menu._is_persistent = true;
            
            // Section for crypto data
            this.metric_menu_section = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this.metric_menu_section);
            
            this.metric_container = new St.BoxLayout();
            this.metric_container.set_name("crypto-tracker-container"); 
            this.actor.add_actor(this.metric_container);

            for (let i = 1; i <= 3; i++) {
                let keyPrefix = "metric" + i + "-";

                let arrow_label = new St.Label();
                let text_label = new St.Label();
                
                // Initialize default values based on the metric number
                let defaultSymbol = (i === 1 ? "BTC" : i === 2 ? "ETH" : "ADA");
                let defaultID = (i === 1 ? "bitcoin" : i === 2 ? "ethereum" : "cardano");
                
                let metric_config = {
                    key_id_dropdown: keyPrefix + "id", // Old ID setting
                    key_custom_id: keyPrefix + "custom-id", // NEW Custom ID setting
                    key_currency: keyPrefix + "currency",
                    key_symbol: keyPrefix + "symbol",
                    key_enabled: keyPrefix + "enabled",
                    key_show_symbol: keyPrefix + "show-symbol",
                    key_color_arrow_only: keyPrefix + "color-arrow-only", 
                    key_color_up: keyPrefix + "color-up",
                    key_color_down: keyPrefix + "color-down",
                    
                    id_dropdown: defaultID,
                    custom_id: "", // NEW: Default empty
                    currency: "USD",
                    symbol: defaultSymbol,
                    enabled: false,
                    show_symbol: true,
                    color_arrow_only: true, 
                    color_up: "#00FF00", 
                    color_down: "#FF0000",
                    
                    arrow_label: arrow_label, 
                    text_label: text_label,
                    change: 0 
                };
                
                this.metrics[i] = metric_config;
                
                let metric_box = new St.BoxLayout();
                metric_box.add(arrow_label);
                metric_box.add(text_label);
                
                this.metric_container.add(metric_box, { x_fill: true, y_fill: false });
                
                arrow_label.set_style("padding-right: 0px; padding-top: 0px; font-size: 95%;"); 
                text_label.set_style("padding-right: 0px; padding-top: 3px; font-size: 95%;"); 
                
                arrow_label.set_text("");
                text_label.set_text(_("Loading...")); // Uses standard alias _
            }
            
            this._updateMenu(); 

            this._settings_changed_id = this.settings.connect('changed', this.updatePrices.bind(this));
            
            this.updatePrices();
            this._setRefreshTimer();

        } catch (e) {
            global.logError("FATAL error during initialization of the crypto applet: " + e);
        }
    },
    
    // This function handles the left click on the applet
    on_applet_clicked: function() {
        global.log("Crypto-Tracker: Applet click received. Attempting to open/close menu.");
        this.menu.toggle();
        
        // IMPORTANT: Update the menu only upon opening to ensure stability
        if (this.menu.isOpen) {
             this._updateMenu();
        }
    },

    _updateMenu: function() {
        // Clear all old entries in the metric section
        this.metric_menu_section.removeAll();
        
        // --- HEADER LOGIC (CENTERED) ---
        
        // FIX: Jetzt die korrekte globale Übersetzungsfunktion _() verwenden
        let header = new PopupMenu.PopupMenuItem(_("24H Price Change (%)"), { reactive: false }); 
        header.actor.add_style_class_name('popup-menu-item-header'); 
        
        // Ensure styling for visibility and centering
        header.actor.set_style("font-weight: bold; font-size: 120%; color: #FFFFFF; text-align: center;");
        
        this.metric_menu_section.addMenuItem(header);
        this.metric_menu_section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // Add separator after the item
        
        let hasActiveMetrics = false;

        for (let i = 1; i <= 3; i++) {
            let metric = this.metrics[i];

            if (metric.enabled) {
                hasActiveMetrics = true;
                
                let change = metric.change;
                let formatted_change_abs = Math.abs(change || 0).toFixed(2); // Only the absolute value
                let color = (change < 0) ? metric.color_down : metric.color_up;
                
                // Logic for spacing after the sign:
                let change_sign = "";
                if (change > 0) {
                    change_sign = "+ "; // Sign with space
                } else if (change < 0) {
                    change_sign = "- "; // Sign with space
                } else {
                    change_sign = " "; // If 0.00, only a space
                }

                // Resulting text: e.g., "+ 2.45%"
                let data_text = change_sign + formatted_change_abs + "%";
                
                // Set text to "Waiting..." in the popup if no data is available
                if (!this._has_data) {
                    data_text = _("Waiting..."); // Uses standard alias _
                    color = "#AAAAAA";
                }
                
                // --- Left Part: Ticker (Bold) and Currency (Regular) with spacing ---
                
                // 1. Label for the Ticker (e.g., BTC) -> BOLD
                let symbol_label = new St.Label({ 
                    text: metric.symbol,
                    x_align: St.Align.START 
                });
                // 10px spacing after Ticker
                symbol_label.set_style("color: #DDDDDD; font-weight: bold; padding-right: 10px;"); 

                // 2. Label for the Currency (e.g., (USD)) -> REGULAR
                let currency_text = "(" + metric.currency.toUpperCase() + ")"; // Parentheses are now part of the text
                let currency_label = new St.Label({ 
                    text: currency_text,
                    x_align: St.Align.START 
                });
                // Fixed spacing (approx. 0.5 cm) after the currency
                currency_label.set_style("color: #DDDDDD; padding-right: 15px;"); 

                // 3. Box containing both labels (left)
                let name_box = new St.BoxLayout({
                    y_align: St.Align.MIDDLE,
                    x_align: St.Align.START
                });
                name_box.add_child(symbol_label);
                name_box.add_child(currency_label);
                
                // --- Right Part (follows immediately after spacing): Percentage Value ---

                // 4. Label for the Percentage Value 
                let value_label = new St.Label({ 
                    text: data_text, // Now contains "+ 2.4%" or "- 1.2%"
                });
                // Remove padding, as the spacing is defined in the text
                value_label.set_style(`color: ${color}; font-weight: bold;`); 
                
                // Add internal CSS class
                value_label.add_style_class_name('crypto-percentage-value'); 
                
                // --- Overall Structure (everything left-aligned) ---
                
                let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true }); 
                menuItem.actor.add_style_class_name('popup-menu-item'); 
                
                // HBox definition.
                let hbox = new St.BoxLayout({ 
                    x_expand: true, 
                    y_align: St.Align.MIDDLE,
                    x_align: St.Align.START,
                    // FIX: padding-left set to 8px for slight, corrected indentation
                    style: "padding-left: 8px;" 
                }); 
                
                // 1. Left: Ticker/Currency with spacing
                hbox.add_child(name_box);
                
                // 2. Immediately after: Percentage Value
                hbox.add_child(value_label);
                
                // Fill the rest of the menu item with an expander
                let expander = new St.BoxLayout({ x_expand: true });
                hbox.add_child(expander);

                menuItem.addActor(hbox); 

                this.metric_menu_section.addMenuItem(menuItem);
            }
        }
        
        if (!hasActiveMetrics) {
             let item = new PopupMenu.PopupMenuItem(_("No metrics enabled. Please enable them in settings."), { reactive: false }); // Uses standard alias _
             this.metric_menu_section.addMenuItem(item);
        }
    },
    
    // Clears the existing Mainloop timer
    _clearRefreshTimer: function () { 
        if (this._refreshTimer) {
            Mainloop.source_remove(this._refreshTimer);
            this._refreshTimer = null;
        }
    },
    
    // Sets up the recurring Mainloop timer based on settings
    _setRefreshTimer: function() { 
        this._clearRefreshTimer();
        
        let interval_string = this.settings.getValue('update-interval-seconds'); 
        let interval = parseInt(interval_string);
        
        const REFRESH_INTERVAL_SECONDS = Math.max(15, interval || 15); 
        global.log("Crypto-Tracker: Refresh interval started. Value: " + REFRESH_INTERVAL_SECONDS + " seconds."); 
        
        this._refreshTimer = Mainloop.timeout_add_seconds(REFRESH_INTERVAL_SECONDS, this.updatePrices.bind(this));
    },
    
    // Loads all settings values from the settings object into the applet's metrics array
    _loadAllSettings: function() { 
        for (let i = 1; i <= 3; i++) {
            let metric = this.metrics[i];
            let keyPrefix = "metric" + i + "-"; 

            // Load the default dropdown ID
            metric.id_dropdown = this.settings.getValue(metric.key_id_dropdown) || metric.id_dropdown;
            // Load the NEW custom ID
            metric.custom_id = this.settings.getValue(metric.key_custom_id) || ""; 
            
            metric.currency = this.settings.getValue(metric.key_currency) || metric.currency;
            metric.symbol = this.settings.getValue(metric.key_symbol) || metric.symbol;
            
            metric.enabled = this.settings.getValue(metric.key_enabled); 
            if (metric.enabled === null || metric.enabled === undefined) {
                metric.enabled = false;
            }
            
            metric.show_symbol = this.settings.getValue(metric.key_show_symbol); 
            if (metric.show_symbol === null || metric.show_symbol === undefined) {
                 metric.show_symbol = true;
            }

            metric.color_arrow_only = this.settings.getValue(metric.key_color_arrow_only);
            if (metric.color_arrow_only === null || metric.color_arrow_only === undefined) {
                metric.color_arrow_only = true; 
            }

            // Ensure colors are loaded from the correct keys
            metric.color_up = this.settings.getValue(keyPrefix + "color-up") || metric.color_up;
            metric.color_down = this.settings.getValue(keyPrefix + "color-down") || metric.color_down;
        }
    },

    // Main function to fetch data from the CoinGecko API
    updatePrices: function() { 
        
        global.log("Crypto-Tracker: Starting data update at " + new Date().toLocaleTimeString()); 
        
        this._loadAllSettings(); 
        this._setRefreshTimer(); 
        
        let ids = [];
        let uniqueCurrencies = [];
        
        for (let i = 1; i <= 3; i++) {
            let metric = this.metrics[i];
            
            // --- DETERMINE THE ID TO USE (Custom > Dropdown) ---
            let final_id = "";
            if (metric.custom_id && metric.custom_id.trim() !== "") {
                final_id = metric.custom_id.trim().toLowerCase();
            }
            // If custom ID is empty or not set, use the dropdown ID
            else {
                final_id = metric.id_dropdown;
            }
            // Store the final_id in the metric for later use
            metric.final_id = final_id; 
            
            if (metric.enabled && metric.final_id && metric.currency) { 
                metric.arrow_label.get_parent().show();
                
                // Set Loading text in the panel only if we NEVER had data before
                if (!this._has_data) {
                    metric.arrow_label.set_text("");
                    metric.text_label.set_text(_("Loading...")); // Uses standard alias _
                    metric.text_label.set_style("padding-right: 8px; padding-top: 3px; font-size: 95%; color: white;");
                }
                
                ids.push(metric.final_id);
                let currencyLower = metric.currency.toLowerCase();
                if (!uniqueCurrencies.includes(currencyLower)) {
                    uniqueCurrencies.push(currencyLower);
                }
            } else {
                metric.arrow_label.get_parent().hide();
            }
        }

        if (ids.length === 0) {
            global.log("Crypto-Tracker: No metrics enabled. API call skipped."); 
            return true; 
        }

        // Construct the API URL
        let url = "https://api.coingecko.com/api/v3/simple/price?"
            + "ids=" + ids.join(',')
            + "&vs_currencies=" + uniqueCurrencies.join(',')
            + "&include_24hr_change=true";
            
        // Debugging: Log the URL
        global.log("Crypto-Tracker: API URL: " + url); 
            
        let command = ['curl', '--silent', '--max-time', '10', url];

        Util.spawn_async(command, (json_data_raw) => {
            
            // --- ERROR HANDLING: NO RAW DATA OR NETWORK ERROR ---
            if (!json_data_raw || json_data_raw.trim().length === 0) {
                global.logError("Crypto-Tracker: Network error or empty response (cURL crash or timeout). Keeping old value."); 
                return true; 
            }

            try {
                let json_data = JSON.parse(json_data_raw);
                
                // --- ERROR HANDLING: API RETURNED EMPTY DATA ---
                if (Object.keys(json_data).length === 0) {
                    global.logError("Crypto-Tracker: API returned empty data (possibly wrong ID). Keeping old value."); 
                    return true;
                }
                
                this._has_data = true; // Set state to successful

                for (let i = 1; i <= 3; i++) {
                    let metric = this.metrics[i];
                    
                    if (!metric.enabled || !metric.final_id) { // Check for final_id
                        continue;
                    }

                    // Use the stored final_id
                    let data = json_data[metric.final_id]; 
                    let price_key = metric.currency.toLowerCase();
                    let change_key = price_key + "_24h_change";
                    
                    if (data && data[price_key] !== undefined) {
                        
                        // --- SUCCESSFUL UPDATE ---
                        let price = data[price_key];
                        // Logic for decimals
                        let decimals = (price < 10) ? 4 : (price < 1000) ? 2 : 0; 
                        let formatted_price = price.toFixed(decimals);
                        let change = data[change_key] || 0; 
                        
                        metric.change = change; // Store for the pop-up menu
                        
                        let arrow = "";
                        let color = metric.color_up; 
                        
                        if (change < 0) {
                            arrow = "▼"; 
                            color = metric.color_down; 
                        } else if (change > 0) {
                             arrow = "▲";
                        }

                        let currencyDisplay = "";
                        let currencySymbol = getCurrencySymbol(metric.currency);
                        
                        if (metric.show_symbol) {
                            formatted_price = currencySymbol + " " + formatted_price; 
                        } else {
                            currencyDisplay = metric.currency.toUpperCase();
                        }
                        
                        let display_text = metric.symbol + " " + formatted_price + " " + currencyDisplay;
                        
                        // Display logic in the panel
                        if (metric.color_arrow_only) {
                            // Option 1: Arrow colored, text white
                            metric.arrow_label.set_text(arrow + " "); 
                            metric.arrow_label.set_style(`padding-right: 0px; padding-top: 2px; font-size: 95%; color: ${color};`);
                            
                            metric.text_label.set_text(display_text);
                            metric.text_label.set_style(`padding-right: 8px; padding-top: 3px; font-size: 95%; color: #FFFFFF;`);
                        } else {
                            // Option 2: Everything in one color
                            metric.arrow_label.set_text(arrow + " "); 
                            metric.arrow_label.set_style(`padding-right: 0px; padding-top: 2px; font-size: 95%; color: ${color};`);

                            metric.text_label.set_text(display_text);
                            metric.text_label.set_style(`padding-right: 8px; padding-top: 3px; font-size: 95%; color: ${color};`);
                        }
                        
                        metric.arrow_label.get_parent().show();

                    } else { 
                        // --- ERROR HANDLING: Missing data in JSON ---
                        global.logWarning(`Crypto-Tracker: Data for ${metric.final_id} not found. Keeping old value.`); 
                    } 
                }
                
                global.log("Crypto-Tracker: API call completed successfully."); 

            } catch (e) {
                // --- ERROR HANDLING: FATAL JSON PARSING ERROR ---
                global.logError("Crypto-Tracker: JSON parsing or cURL error: " + e + ". Keeping old value."); 
            }
            return true;
        });
        
        return true; 
    },

    // Clean up when the applet is removed
    on_applet_removed_from_panel: function() { 
        this._clearRefreshTimer();
        if (this._settings_changed_id) {
            this.settings.disconnect(this._settings_changed_id);
        }
    }
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(metadata, orientation, panel_height);
    return myApplet;
}
