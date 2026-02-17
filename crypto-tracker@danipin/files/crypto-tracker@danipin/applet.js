const AppletManager = imports.ui.appletManager;
const UUID = "crypto-tracker@danipin";
const AppletDir = AppletManager.appletMeta[UUID].path;
imports.searchPath.push(AppletDir);

const ApiConfig = imports.api.ApiConfig;
const DataPersistence = imports.data_persistence.DataPersistence;
const Themes = imports.themes.Themes;
const Search = imports.search.Search;
const Animations = imports.animations.Animations;
const Utils = imports.utils.Utils;
const Charts = imports.charts.Charts;
const Seasonal = imports.seasonal.Seasonal;
const Panel = imports.panel.Panel;
const Alarm = imports.alarm.Alarm;
const Header = imports.header.Header;
const Footer = imports.footer.Footer;
const Portfolio = imports.portfolio.Portfolio;
const Donate = imports.donate.Donate;

const St = imports.gi.St;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util; 
const PopupMenu = imports.ui.popupMenu; 
const Cairo = imports.gi.cairo; 
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, 0); 

        try {
            this.metadata = metadata;
            this.metrics = [];
            this.apiValid = false; 
            this._refreshId = null;
            this.selectedTimeframe = "1"; 
            this.expandedIndex = null; 
            this.alarmOpenIndex = null;
            this.basicCalls = 0;
            this.keyCalls = 0;
            this.chartCalls = 0;
            this.detailCalls = 0;
            this.searchCalls = 0;
            this.portfolioCalls = 0;
            this.alarmCalls = 0;
            this.lastResetDate = null;
            this.avgPerDay = 0;
            this.avgBasicPerDay = 0;

            try {
                this.settings = new Settings.AppletSettings(this, metadata.uuid, 0);
            } catch (e) {
                global.logError("[" + metadata.uuid + "] Settings folder not ready: " + e);
                this.settings = { 
                    getValue: (k) => { return null; }, 
                    setValue: (k, v) => { },
                    bind: (k, p, c) => { } 
                };
            }

            DataPersistence.init(this);
            Themes.init(this);
            Search.init(this);
            Animations.init(this);
            Utils.init(this);
            Charts.init(this);
            Seasonal.init(this);
            Panel.init(this);
            Alarm.init(this);
            Header.init(this);
            Footer.init(this);
            Donate.init(this);
            this._loadCoinList(); // Load persisted coin options
            DataPersistence.loadCallStats();
            this.lastFetchTime = "Never";
            this.fiveMinutes = 300000;
            this._updateInProgress = false; 
            this._lastGlobalFetch = 0; 
            this._isSwitchingCoin = false; // Flag for alarm logic
            this._isViewSwitching = false; // Flag for view animation
            this.currentView = "dashboard"; // 'dashboard', 'alarms', 'portfolio'
            this.isHeaderMenuOpen = false;
            this.dashboardScrollView = null;

            // Central definition for hover effects (color & radius) - all areas exactly the same
            this.hoverColor = "rgba(128,128,128,0.11)";
            this.hoverColorHeader = "rgba(128,128,128,0.20)";
            this.hoverRadius = "4px";
            this.searchingMetricIndex = null; // Stores which row is currently searching
            this.currencySelectorIndex = null; // Stores which row is selecting currency
            this.currentTheme = null;
            this.fadeInChart = false;
            this.activeGhostActor = null;
            this.activeGiftActor = null;
            this.ghostOverlayHeight = 0;
            this.giftOverlayActive = false;
            this.starLocked = false;
            this.pizzaOverlayActive = false;
            this.metricsSectionActor = null;
            this._quotaWarnings = { w80: false, w90: false, w100: false };
            this.quotaResetDetected = false;
            
            // Initialize default colors (dark) so they are available immediately
            this.colors = {
                text: "rgba(255, 255, 255, 1)",
                text_dim: "rgba(255, 255, 255, 0.8)",
                text_more_dim: "rgba(255, 255, 255, 0.5)",
                bg_popup: "rgba(0, 0, 0, 0.25)",
                bg_input: "rgba(0, 0, 0, 0.5)",
                divider: "rgba(255, 255, 255, 0.1)"
            };

            Portfolio.init(this);

            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menuManager.addMenu(this.menu);
            this.menu.actor.style = "min-width: 450px; max-width: 450px;";
            Search.createSearchUI();

            this._originalMenuClose = this.menu.close.bind(this.menu);

            this.center_bin = new St.Bin({ y_align: St.Align.MIDDLE, y_fill: false, height: panel_height });
            this.metric_container = new St.BoxLayout({ vertical: false });
            this.center_bin.set_child(this.metric_container);
            this.actor.add_actor(this.center_bin);

            let bindSafe = (key, callback) => {
                try {
                    this.settings.bind(key, key, callback.bind(this));
                } catch(e) {
                    global.log("[" + metadata.uuid + "] Binding failed for: " + key);
                }
            };

            // Initialize metrics BEFORE binding settings to avoid race conditions
            for (let i = 1; i <= 3; i++) {
                let keyPrefix = "metric" + i + "-";
                let paddingValue = (i === 3) ? "0px" : "10px";

                this.metrics[i] = {
                    index: i,
                    key_id: keyPrefix + "id", 
                    key_custom: keyPrefix + "custom-id",
                    key_cur: keyPrefix + "currency", 
                    key_sym: keyPrefix + "symbol",
                    key_en: keyPrefix + "enabled", 
                    key_up: keyPrefix + "color-up",
                    key_down: keyPrefix + "color-down", 
                    key_show_sym: keyPrefix + "show-symbol",
                    key_show_cents: keyPrefix + "show-cents", 
                    key_decimals: keyPrefix + "decimals",
                    key_show_icon: keyPrefix + "show-icon",
                    key_color_arrow_only: keyPrefix + "color-arrow-only",
                    
                    icon_bin: new St.Bin({ y_align: St.Align.MIDDLE }),
                    arrow_label: new St.Label({ text: "", y_align: St.Align.MIDDLE }), 
                    ticker_label: new St.Label({ text: "", style: "margin-top: 2px;" }),
                    text_label: new St.Label({ text: " ", style: "margin-top: 2px;" }), 
                    container_box: new St.BoxLayout({ y_align: St.Align.MIDDLE, style: "padding-right: " + paddingValue + ";" }),
                    
                    current_price_val: 0, 
                    change_pct: 0, 
                    last_alert_price: 0,
                    last_alert_percent: 0,
                    ticker: "",
                    price_cache: {},      
                    change_cache: {},     
                    cache_timestamps: {}, 
                    history_data: [],
                    details_data: null,
                    cache_charts: {},        
                    cache_timestamps_charts: {},
                    ath_trigger_time: 0,
                    ath_notification_sent: false,
                    chartViewMode: null,
                    last_chart_diff_pct: 0,
                    chartHoverState: null,
                    menu_price_label: null,
                    menu_pct_label: null,
                    tickerTimer: null,
                    fromSearch: false,
                    menu_cur_label: null,
                    menu_val_label: null,
                    cur_hover: false,
                    activeCurrency: (this.settings.getValue(keyPrefix + "currency") || "usd").toLowerCase()
                };
                
                // Initialize currentId for alarm context switching
                this.metrics[i].currentId = this._getId(i);

                this.metrics[i].container_box.add(this.metrics[i].arrow_label);
                this.metrics[i].container_box.add(this.metrics[i].icon_bin);
                this.metrics[i].container_box.add(this.metrics[i].ticker_label);
                this.metrics[i].container_box.add(this.metrics[i].text_label);

                // --- Wiggle effect for panel icon ---
                this.metrics[i].container_box.set_reactive(true);
                this.metrics[i].icon_bin.set_pivot_point(0.5, 0.5);
                
                Animations.setupMetricAnimations(this.metrics[i]);
            }

            bindSafe("enable-holiday-theme", () => Seasonal.updateTheme(true));
            bindSafe("dev-force-theme", () => {
                Mainloop.timeout_add(50, () => { Seasonal.updateTheme(true); return false; });
            });
            bindSafe("dev-show-frames", () => this._buildMenu());
            bindSafe("dev-always-show-rocket", () => this._buildMenu());
            Seasonal.updateTheme();

            let visualKeys = [
                "compact-mode", "global-show-cents", "global-show-arrows", 
                "global-icon-opacity", "metric1-enabled", "metric2-enabled", "metric3-enabled",
                "metric1-show-icon", "metric2-show-icon", "metric3-show-icon", 
                "metric1-show-cents", "metric2-show-cents", "metric3-show-cents", 
                "metric1-decimals", "metric2-decimals", "metric3-decimals",
                "metric1-color-arrow-only", "metric2-color-arrow-only", "metric3-color-arrow-only", 
                "metric1-show-symbol", "metric2-show-symbol", "metric3-show-symbol", 
                "metric1-color-up", "metric1-color-down", "metric2-color-up", "metric2-color-down", 
                "metric3-color-up", "metric3-color-down", "metric1-symbol", "metric2-symbol", "metric3-symbol",
                "show-active-alarms", "show-monthly-stats", "show-avg-stats", "prefer-candle-charts",
                "chart-color-candle-up", "chart-color-candle-down"
            ];
            visualKeys.forEach(k => bindSafe(k, this.updateVisuals));

            Alarm.setupAlarmChecks();

            // Crypto changes (ID) should automatically adjust the ticker
            const idToSymbolMap = {
                // This map is now mainly for quick reverse lookups
                "bitcoin": "BTC",
                "ethereum": "ETH",
                "binancecoin": "BNB",
                "solana": "SOL",
                "ripple": "XRP",
                "dogecoin": "DOGE",
                "the-open-network": "TON",
                "cardano": "ADA",
                "shiba-inu": "SHIB",
                "avalanche-2": "AVAX",
                "tron": "TRX",
                "polkadot": "DOT",
                "bitcoin-cash": "BCH",
                "chainlink": "LINK",
                "near": "NEAR",
                "matic-network": "MATIC",
                "litecoin": "LTC",
                "pepe": "PEPE",
                "internet-computer": "ICP",
                "kaspa": "KAS"
            };

            for (let i = 1; i <= 3; i++) {
                const metricIndex = i;
                const idKey = "metric" + metricIndex + "-id";
                const customIdKey = "metric" + metricIndex + "-custom-id";
                const symbolKey = "metric" + metricIndex + "-symbol";
                const currencyKey = "metric" + metricIndex + "-currency";

                // Logic for ticker update (API fetch)
                let updateTicker = () => {
                    if (this.metrics[metricIndex].suppressTickerUpdate) {
                        return;
                    }

                    let dropdownId = this.settings.getValue(idKey);
                    let customId = this.settings.getValue(customIdKey);
                    let coinId = (customId && customId.trim() !== "") ? customId.trim().toLowerCase() : dropdownId;

                    // Check for Coin Change -> Reset EVERYTHING (Central Point of Truth)
                    if (coinId && this.metrics[metricIndex].currentId !== coinId) {
                        this._isSwitchingCoin = true; // Block alarm listener
                        
                        // 1. Save old coin to archive
                        Alarm.syncCurrentToArchive(metricIndex);

                        let m = this.metrics[metricIndex];
                        m.currentId = coinId;
                        
                        // 1. Reset Price & Cache
                        m.current_price_val = 0;
                        m.change_pct = 0;
                        m.price_cache = {};
                        m.change_cache = {};
                        m.cache_timestamps = {};
                        m.ticker = "";

                        // 2. Restore Alarms from Archive (or reset to 0)
                        Alarm.restoreSettingsFor(metricIndex, coinId);

                        // 3. Reset Charts & Details
                        m.history_data = [];
                        m.cache_charts = {};
                        m.cache_timestamps_charts = {};
                        m.details_data = null;
                        m.last_details_fetch = 0;
                        m.ath_trigger_time = 0;
                        m.ath_notification_sent = false;
                        m.chartViewMode = null;
                        m.last_chart_diff_pct = 0;
                        
                        this.updateVisuals();
                        this._isSwitchingCoin = false;
                    }

                    if (!coinId || coinId === "custom") return;

                    // 1. Check Map
                    if (idToSymbolMap[coinId]) {
                        if (this.settings.getValue(symbolKey) !== idToSymbolMap[coinId]) {
                            this.settings.setValue(symbolKey, idToSymbolMap[coinId]);
                        }
                        this._lastGlobalFetch = 0;
                        this.updatePrices();
                        return;
                    }

                    // 2. Fetch API
                    let apiKey = this.settings.getValue("api-key");
                    let url = "https://api.coingecko.com/api/v3/coins/" + coinId + "?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false";
                    let params = ['curl', '--silent', '--max-time', '5', url];
                    if (apiKey && apiKey.length > 5) {
                        params = ['curl', '--silent', '--max-time', '5', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
                    }

                    Util.spawn_async(params, (stdout) => {
                        try {
                            let j = JSON.parse(stdout);
                            if (j && j.symbol) {
                                this.settings.setValue(symbolKey, j.symbol.toUpperCase());
                            }
                        } catch (e) { }
                        this._lastGlobalFetch = 0;
                        this.updatePrices();
                    });
                };

                // Handler for dropdown changes
                let onDropdownChanged = () => {
                    let v = this.settings.getValue(idKey);
                    // If a concrete currency was selected, clear custom field
                    if (v !== "custom") {
                        this.settings.setValue(customIdKey, "");
                    }
                    updateTicker();
                };

                // Handler for custom field changes
                let onCustomChanged = () => {
                    let c = this.settings.getValue(customIdKey);
                    let d = this.settings.getValue(idKey);
                    
                    if (c && c.trim() !== "") {
                        let lower = c.trim().toLowerCase();
                        // Auto-match with top coins
                        if (idToSymbolMap[lower]) {
                            if (d !== lower) {
                                this.settings.setValue(idKey, lower);
                                this.settings.setValue(customIdKey, "");
                                return; // Stop, as onDropdownChanged does the rest
                            }
                        } else {
                            // Unknown ID -> Force dropdown to custom
                            if (d !== "custom") {
                                this.settings.setValue(idKey, "custom");
                            }
                        }
                    }
                    updateTicker();
                };

                bindSafe(idKey, onDropdownChanged);
                bindSafe(customIdKey, onCustomChanged);

                // Currency change: Immediate feedback & alarm reset
                bindSafe(currencyKey, () => {
                    // FIX: If the switch was triggered manually (click), skip the logic here,
                    // as it was already executed there. Only fire UpdatePrices.
                    if (this._isSwitchingCoin) {
                        this._lastGlobalFetch = 0;
                        this.updatePrices();
                        return;
                    }

                    // 1. Save old alarm status (with the OLD currency m.cur) before switching
                    if (this.metrics[metricIndex]) {
                        Alarm.syncCurrentToArchive(metricIndex, this.metrics[metricIndex].activeCurrency);
                    }
                    this.metrics[metricIndex].activeCurrency = this.settings.getValue(currencyKey).toLowerCase();

                    // IMPORTANT: Set flag so the alarm in the archive is NOT deleted
                    this._isSwitchingCoin = true;

                    // 2. Reset settings (so nothing is "adopted")
                    this.settings.setValue("metric" + metricIndex + "-alert-price", "0");
                    this.settings.setValue("metric" + metricIndex + "-alert-percent", "0");
                    
                    // Reset internal values immediately so the bell reacts immediately
                    if (this.metrics[metricIndex]) {
                        this.metrics[metricIndex].last_alert_price = 0;
                        this.metrics[metricIndex].last_alert_percent = 0;
                        if (this.metrics[metricIndex].bellIcon) {
                            this.metrics[metricIndex].bellIcon.set_style("color: " + this.colors.text_more_dim + ";");
                        }
                    }

                    // 3. Try to restore alarms for the NEW currency
                    // (If none exist or the currency doesn't match, restoreSettingsFor automatically sets values to 0)
                    if (this.metrics[metricIndex] && this.metrics[metricIndex].currentId) {
                        let newCur = this.settings.getValue(currencyKey);
                        Alarm.restoreSettingsFor(metricIndex, this.metrics[metricIndex].currentId, newCur);
                    }
                    
                    if (this.metrics[metricIndex]) {
                        // Visual feedback: Show "Loading..."
                        this.metrics[metricIndex].current_price_val = 0;
                        this.metrics[metricIndex].text_label.set_text(" " + _("Loading..."));
                        
                        if (this.metrics[metricIndex].menu_val_label) {
                            this.metrics[metricIndex].menu_val_label.set_text(" " + _("Loading..."));
                        }
                    }

                    // 2. Force update
                    this._lastGlobalFetch = 0;
                    this.updatePrices();

                    // FIX: Rebuild menu to update displayed alarm values in dropdown
                    if (this.menu.isOpen) this._buildMenu();

                    // Reset flag (after alarm timeouts of 1.5s are safely done)
                    Mainloop.timeout_add(2000, () => {
                        this._isSwitchingCoin = false;
                        return false;
                    });
                });

                // FIX: Live update for the alarm bell so it turns orange immediately
                let updateBell = () => {
                    if (this.metrics[i].bellIcon) {
                        let p = parseFloat(this.settings.getValue("metric" + i + "-alert-price")) || 0;
                        let pct = parseFloat(this.settings.getValue("metric" + i + "-alert-percent")) || 0;
                        let active = (p > 0 || pct > 0);
                        this.metrics[i].bellIcon.set_style(active ? "color: #e67e22;" : "color: " + this.colors.text_more_dim + ";");
                    }
                };
                bindSafe("metric" + i + "-alert-price", updateBell);
                bindSafe("metric" + i + "-alert-percent", updateBell);
            }

            bindSafe("update-interval-seconds", this._setUpdateTimer);
            bindSafe("api-key", () => { ApiConfig.validateKeySilently(); });
            
            
            ApiConfig.init(this);
            ApiConfig.validateKeySilently();
            this._setUpdateTimer();
            this._updateThemeColors(true); // Set initial colors
            this._cleanupIcons();
        } catch (e) { 
            global.logError("FATAL INIT ERROR: " + e); 
        }
    },

    _updateThemeColors: function(rebuild = true) {
        let isDark = true;
        
        // Auto: Try to detect brightness
        try {
            let themeNode = this.menu.actor.get_theme_node();
            let fg = themeNode.get_foreground_color();
            let brightness = (fg.red + fg.green + fg.blue) / 3;
            isDark = (brightness >= 128); // Light font = Dark theme
        } catch(e) { isDark = true; }
        
        this.isDarkMode = isDark;

        if (isDark) {
            this.colors = {
                text: "rgba(255, 255, 255, 1)",
                text_dim: "rgba(255, 255, 255, 0.8)",
                text_more_dim: "rgba(255, 255, 255, 0.5)",
                bg_popup: "rgba(0, 0, 0, 0.25)",
                bg_input: "rgba(0, 0, 0, 0.5)",
                divider: "rgba(255, 255, 255, 0.1)"
            };
            // FIX: Do not force styles, use system theme!
            if (this.menu) this.menu.actor.set_style(""); 
        } else {
            this.colors = {
                text: "rgba(0, 0, 0, 1)",
                text_dim: "rgba(0, 0, 0, 0.8)",
                text_more_dim: "rgba(0, 0, 0, 0.6)",
                bg_popup: "rgba(255, 255, 255, 0.4)",
                bg_input: "rgba(255, 255, 255, 0.6)",
                divider: "rgba(0, 0, 0, 0.4)"
            };
            // FIX: Do not force styles, use system theme!
            if (this.menu) this.menu.actor.set_style("");
        }
        if (rebuild) this._buildMenu(); // Rebuild UI with new colors
    },

    _setUpdateTimer: function() {
        if (this._refreshId) Mainloop.source_remove(this._refreshId);
        let interval = parseInt(this.settings.getValue("update-interval-seconds")) || 120;
        this._refreshId = Mainloop.timeout_add_seconds(interval, () => { this.updatePrices(); return true; });
        // FIX: Trigger immediate update so the change takes effect immediately
        this.updatePrices();
    },

    _cleanupIcons: function() {
        let activeIds = [];
        for (let i = 1; i <= 3; i++) {
            let id = this._getId(i);
            if (id) activeIds.push(id);
        }

        if (Alarm && Alarm.getArchivedIds) {
            let alarmIds = Alarm.getArchivedIds();
            alarmIds.forEach(id => { if (!activeIds.includes(id)) activeIds.push(id); });
        }

        if (Portfolio && Portfolio.addPortfolioIds) {
            Portfolio.addPortfolioIds(activeIds, false);
        }

        Utils.cleanupUnusedIcons(activeIds);
    },

    _getId: function(idx) {
        let dropdown = this.settings.getValue(this.metrics[idx].key_id);
        let custom = this.settings.getValue(this.metrics[idx].key_custom);
        // Custom ID always overrides dropdown selection if filled.
        let val = (custom && custom.trim() !== "") ? custom : dropdown;
        if (!val) return (idx === 1) ? "bitcoin" : ""; 
        let id = val.toLowerCase().trim();
        let map = { "ada": "cardano", "btc": "bitcoin", "eth": "ethereum" };
        return map[id] || id;
    },

    updatePrices: function(forceKey = false) {
        // FIX: Check for monthly reset (reset warnings only)
        if (this.quotaResetDetected) {
            this.quotaResetDetected = false;
            this._quotaWarnings = { w80: false, w90: false, w100: false };
            // User requested NO auto-reset of interval.
        }

        let now = Date.now();
        let metricsToFetch = [];
        let idsToFetch = [];
        let refreshSeconds = this.settings.getValue("update-interval-seconds") || 120;
        let cacheToleranceMs = (refreshSeconds * 1000) - 2000;

        for (let i = 1; i <= 3; i++) {
            let m = this.metrics[i];
            if (this.settings.getValue(m.key_en) ?? (i === 1)) {
                let id = this._getId(i);
                let cur = (this.settings.getValue(m.key_cur) || "usd").toLowerCase();
                
                if (m.price_cache[cur] && m.cache_timestamps[cur] && (now - m.cache_timestamps[cur] < cacheToleranceMs)) {
                    m.current_price_val = m.price_cache[cur];
                    m.change_pct = m.change_cache[cur];
                    continue; 
                }
                
                if (id) {
                    idsToFetch.push(id);
                    metricsToFetch.push({idx: i, id: id, cur: cur});
                }
            }
        }

        // Add IDs from alarm archive (for background checks)
        if (Alarm && Alarm.addArchivedIds) Alarm.addArchivedIds(idsToFetch);
        // FIX: Only fetch portfolio if menu is open AND portfolio view is active
        if (this.menu.isOpen && this.currentView === 'portfolio' && Portfolio && Portfolio.addPortfolioIds) Portfolio.addPortfolioIds(idsToFetch);
        
        if (idsToFetch.length === 0) {
            this.updateVisuals();
            return;
        }

        this._lastGlobalFetch = now;
        let d = new Date();
        this.lastFetchTime = d.getHours() + ":" + d.getMinutes().toString().padStart(2, '0');

        let globalCur = (this.settings.getValue("metric1-currency") || "usd").toLowerCase();
        
        let fetchCurs = [globalCur];
        if (Portfolio && Portfolio.getCurrency) {
            let pCur = Portfolio.getCurrency();
            if (pCur && !fetchCurs.includes(pCur)) fetchCurs.push(pCur);
        }

        // FIX: Collect all currencies of active metrics so EUR/GBP are also loaded
        metricsToFetch.forEach(m => {
            if (!fetchCurs.includes(m.cur)) fetchCurs.push(m.cur);
        });

        // FIX: Also load currencies from background alarms (e.g. USD alarm during EUR display)
        if (Alarm && Alarm.getArchivedCurrencies) {
            let alarmCurs = Alarm.getArchivedCurrencies();
            alarmCurs.forEach(c => {
                if (!fetchCurs.includes(c)) fetchCurs.push(c);
            });
        }

        let url = "https://api.coingecko.com/api/v3/simple/price?ids=" + idsToFetch.join(",") + "&vs_currencies=" + fetchCurs.join(",") + "&include_24hr_change=true";
        
        let apiKey = this.settings.getValue("api-key");
        let params = ['curl', '--silent', '--max-time', '10', url];
        
        // ROUTING LOGIC: Price updates always via Free API (user request), Key only for charts/details.
        // FIX: Allow fallback to Key via forceKey
        let useKey = forceKey && (apiKey && apiKey.length > 5);

        if (useKey) {
            params = ['curl', '--silent', '--max-time', '10', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
            this.keyCalls++;
            this._checkQuota();
        } else {
            this.basicCalls++;
        }
        DataPersistence.saveCallStats();

        Util.spawn_async(params, Utils.safeCallback((stdout) => {
            try {
                if (!stdout || stdout.trim() === "") return;
                let j = JSON.parse(stdout);
                if (!j) return;

                // Error handling: Check if API reports an error (e.g. Rate Limit)
                if (j.status && j.status.error_code) {
                    global.logWarning("Crypto-Tracker API Message: " + (j.status.error_message || "Error " + j.status.error_code));
                    
                    // FIX: Auto-fallback to API Key on Rate Limit (429)
                    if (j.status.error_code === 429 && !useKey && apiKey && apiKey.length > 5) {
                        global.log("Crypto-Tracker: Rate Limit (Free Tier). Trying update with API Key...");
                        this.updatePrices(true);
                    }
                    return;
                }

                // Check background alarms
                if (Alarm && Alarm.checkArchivedAlarms) Alarm.checkArchivedAlarms(j, globalCur);
                
                // FIX: Only perform portfolio calculation if visible (saves CPU)
                if (this.menu.isOpen && this.currentView === 'portfolio' && Portfolio && Portfolio.updatePortfolioPrices) 
                    Portfolio.updatePortfolioPrices(j, globalCur);

                metricsToFetch.forEach(item => {
                    let m = this.metrics[item.idx];
                    
                    // IMPORTANT: Check if coin was changed in the meantime (Race Condition Protection)
                    if (m.currentId !== item.id) return;

                    // FIX: Check if currency is still correct (Race Condition Protection on currency change)
                    let currentMetricCur = (this.settings.getValue(m.key_cur) || "usd").toLowerCase();
                    if (item.cur !== currentMetricCur) return;

                    if (j[item.id]) {
                        // Determine currency (item.cur is set for background items)
                        let currency = item.cur;
                        let price = parseFloat(j[item.id][currency] || j[item.id][globalCur]);
                        let change = parseFloat(j[item.id][currency + "_24h_change"] || j[item.id][globalCur + "_24h_change"] || 0);
                        if (isNaN(price)) price = 0; // Safety Check
                        
                        // Get alarm values (Either from settings or from alarm object)
                        let targetPrice = parseFloat(this.settings.getValue("metric" + item.idx + "-alert-price")) || 0;
                        let targetPercent = parseFloat(this.settings.getValue("metric" + item.idx + "-alert-percent")) || 0;
                        
                        // SAFETY NET: If reset in ticker didn't work, force here
                        if (targetPrice === 0 && m.last_alert_price !== 0) m.last_alert_price = 0;
                        if (targetPercent === 0 && m.last_alert_percent !== 0) m.last_alert_percent = 0;

                        let lastAlertPrice = m.last_alert_price;
                        let lastAlertPercent = m.last_alert_percent;

                        let sym = (this.settings.getValue(m.key_sym) || "Coin").toUpperCase();

                        // Alarm check (only if we have a valid price)
                        if (price > 0) {
                            // Icon logic: Now uses Gtk search path for system colors
                            let iconName = (this.settings.getValue(m.key_sym) || "").toLowerCase().trim();
                            let finalIconName = iconName + "-symbolic"; 
                            
                            // Check if file exists
                            let customIconPath = this.metadata.path + "/icons/" + finalIconName + ".svg";
                            let finalNotifyIcon = Gio.file_new_for_path(customIconPath).query_exists(null) 
                                ? finalIconName 
                                : "dialog-information-symbolic";

                            // 1. Price Alarm
                            if (targetPrice > 0 && Alarm && !Alarm.isTriggered(item.id)) {
                                let shouldTrigger = false;
                                if (m.current_price_val > 0) {
                                    let crossedUp = (m.current_price_val < targetPrice && price >= targetPrice);
                                    let crossedDown = (m.current_price_val > targetPrice && price <= targetPrice);
                                    shouldTrigger = crossedUp || crossedDown;
                                }

                                if (shouldTrigger) {
                                    Utils.sendNotification(_("Price Alarm: %s").format(sym), _("Target %s reached! Price: %s").format(targetPrice, price), "no-problem.oga", finalNotifyIcon, "complete");
                                    Alarm.markAsTriggered(item.id, 'price');
                                    
                                    if (this.menu.isOpen) {
                                        this._buildMenu();
                                    }
                                }
                            }

                            // 2. Percent Alarm (Volatility)
                            if (targetPercent > 0 && lastAlertPercent !== targetPercent) {
                                if (Math.abs(change) >= targetPercent) {
                                    let dir = change >= 0 ? _("risen") : _("fallen");
                                    Utils.sendNotification(_("Volatility Alarm: %s").format(sym), _("%s has %s by %s%%").format(sym, dir, change.toFixed(2)), "just-saying.oga", finalNotifyIcon, "dialog-warning");
                                    if (Alarm) Alarm.markAsTriggered(item.id, 'vol');
                                    m.last_alert_percent = targetPercent;
                                }
                            }

                            // 3. ATH Check (Rocket)
                            if (m.details_data && m.details_data.ath > 0) {
                                if (price >= m.details_data.ath) {
                                    m.ath_trigger_time = Date.now();
                                }
                            }
                        }

                        m.current_price_val = price;
                        m.change_pct = change;
                        m.price_cache[item.cur] = price;
                        m.change_cache[item.cur] = change;
                        m.cache_timestamps[item.cur] = Date.now();
                    } else {
                        // Fallback: If API ID exists but returns no data (e.g. wrong currency)
                        global.log("Crypto-Tracker: No data for " + item.id);
                    }
                });
                
                this.updateVisuals();
            } catch (e) {
                global.logError("UpdatePrices Error: " + e);
                Utils.logToErrorFile("UpdatePrices", e);
                this.apiErrors = (this.apiErrors || 0) + 1;
                DataPersistence.saveCallStats();
            }
        }, "updatePrices API Callback"));
    },

    updateVisuals: function() {
        try {
            let opacitySetting = parseInt(this.settings.getValue("global-icon-opacity")) || 10;
            let alphaMultiplier = opacitySetting * 0.1;
            this.metric_container.get_children().forEach(child => this.metric_container.remove_actor(child));
            for (let i = 1; i <= 3; i++) {
                try {
                    let m = this.metrics[i];
                    if (this.settings.getValue(m.key_en) ?? (i === 1)) {
                        this.metric_container.add_actor(m.container_box);
                        if (m.current_price_val !== 0) Panel.updateMetricDisplay(i, alphaMultiplier);
                        else m.text_label.set_text(" " + _("Loading..."));

                        // FIX: Live update for menu labels
                        // Only update if menu is open AND archive is NOT open
                        if (this.menu.isOpen && (!Alarm || !Alarm.isArchiveOpen())) {
                            let cur = (this.settings.getValue(m.key_cur) || "USD").toUpperCase();
                            
                            // Robust check: Try-Catch around label updates in case actor is destroyed
                            try {
                                if (m.menu_cur_label) {
                                    m.menu_cur_label.get_clutter_text().set_markup("<span alpha='40%'>" + cur + "</span>");
                                }
                                if (m.menu_val_label) {
                                    m.menu_val_label.set_text(" " + Utils.formatPrice(m.current_price_val, i, true));
                                }
                                
                                if (m.menu_pct_label) {
                                    let displayPct = m.change_pct;
                                    let tf = this.selectedTimeframe;
                                    if (this.apiValid && m.cache_charts[tf] && m.cache_charts[tf].length >= 2) {
                                        let data = m.cache_charts[tf];
                                        if (Array.isArray(data[0])) {
                                            let firstOpen = data[0][1];
                                            let lastClose = data[data.length - 1][4];
                                            displayPct = ((lastClose - firstOpen) / firstOpen) * 100;
                                        }
                                    }
                                    let trendColor = (displayPct < 0) ? (this.settings.getValue(m.key_down) || "#d9534f") : (this.settings.getValue(m.key_up) || "#449d44");
                                    
                                    m.menu_pct_label.set_text((displayPct >= 0 ? "+" : "") + displayPct.toFixed(2) + "%");
                                    m.menu_pct_label.set_style("color: " + trendColor + "; text-align: right; font-size: 16px; font-weight: bold;");
                                }
                            } catch (lblErr) { /* Label no longer exists or is invalid, ignore */ }
                        }
                    }
                } catch (metricErr) {
                    global.logError("Crypto-Tracker: Error updating metric " + i + ": " + metricErr);
                }
            }
        } catch (e) { 
            global.logError("UpdateVisuals Error: " + e);
            Utils.logToErrorFile("UpdateVisuals", e);
        }
    },

    _onSettingsChanged: function() {
        // DEBOUNCE: Prevents multiple menu rebuilds and unnecessary chart requests
        // when multiple settings changes occur (e.g. via Search).
        if (this._settingsChangedTimer) {
            Mainloop.source_remove(this._settingsChangedTimer);
        }
        this._settingsChangedTimer = Mainloop.timeout_add(250, () => {
            this._settingsChangedTimer = null;
            this.updateVisuals();
            this._buildMenu();
            return false;
        });
    },

    _resetColors: function() {
        this.settings.setValue("chart-color-candle-up", "#449d44");
        this.settings.setValue("chart-color-candle-down", "#d9534f");
        for (let i = 1; i <= 3; i++) {
            this.settings.setValue("metric" + i + "-color-up", "#00FF00");
            this.settings.setValue("metric" + i + "-color-down", "#FF0000");
        }
        this.updateVisuals();
        this._buildMenu();
        Utils.sendNotification("Crypto-Tracker", _("Colors reset to default values."), "just-saying.oga", "dialog-information");
    },

    _loadCoinList: function() {
        try {
            let path = Utils.getUserDir() + "/coin_list.json";
            let file = Gio.file_new_for_path(path);
            if (file.query_exists(null)) {
                let [success, content] = file.load_contents(null);
                if (success) {
                    let options = JSON.parse(content);
                    this.settings.setOptions("metric1-id", options);
                    this.settings.setOptions("metric2-id", options);
                    this.settings.setOptions("metric3-id", options);
                }
            }
        } catch(e) { global.logError("Error loading coin list: " + e); }
    },

    _updateCoinList: function(silent = false) {
        // Load 60 coins to have enough buffer after filtering stablecoins
        let url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=60&page=1&sparkline=false";
        let apiKey = this.settings.getValue("api-key");
        let params = ['curl', '--silent', '--max-time', '10', url];
        if (apiKey && apiKey.length > 5) {
            params = ['curl', '--silent', '--max-time', '10', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
        }

        Util.spawn_async(params, (stdout) => {
            try {
                let coins = JSON.parse(stdout);
                if (Array.isArray(coins) && coins.length > 0) {
                    // Filter: No stablecoins and no wrapped tokens
                    let ignored = ["tether", "usd-coin", "dai", "first-digital-usd", "ethena-usde", "usds", "usdt0", "paypal-usd", "staked-ether", "wrapped-bitcoin", "wrapped-steth", "wrapped-eeth", "weth"];
                    let filtered = coins.filter(c => !ignored.includes(c.id) && !c.symbol.includes("usd"));
                    
                    let top20 = filtered.slice(0, 20);

                    let newOptions = {
                        "Custom ID": "custom"
                    };
                    top20.forEach(c => {
                        newOptions[c.name + " (" + c.symbol.toUpperCase() + ")"] = c.id;
                    });

                    // Use API to update options at runtime
                    this.settings.setOptions("metric1-id", newOptions);
                    this.settings.setOptions("metric2-id", newOptions);
                    this.settings.setOptions("metric3-id", newOptions);

                    // Persist to user config dir
                    try {
                        let path = Utils.getUserDir() + "/coin_list.json";
                        let file = Gio.file_new_for_path(path);
                        let out = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                        let stream = new Gio.DataOutputStream({ base_stream: out });
                        stream.put_string(JSON.stringify(newOptions), null);
                        stream.close(null);

                        if (!silent) {
                            Utils.sendNotification("Crypto-Tracker", _("List updated! Please reopen settings."), "cheerful.oga", "emblem-refresh");
                        }
                    } catch(e) { global.logError("Error saving coin list: " + e); }
                }
            } catch (e) { 
                global.logError("Update Coin List Error: " + e); 
            }
        });
    },

    _getMaxContentHeight: function() {
        let monitorIndex = 0;
        try {
            if (this.panel) monitorIndex = this.panel.monitor;
        } catch(e) {}
        
        let monitor = Main.layoutManager.monitors[monitorIndex] || Main.layoutManager.primaryMonitor || { height: 1080 };
        let screenH = monitor.height;
        
        // Safety deduction: Panel + Header + Footer + Buffer = ~220px
        let deduction = 220;
        
        // If the 3-dot menu is open, it takes up a lot of space at the top.
        if (this.isHeaderMenuOpen) {
            deduction += 320; 
        }
        
        let maxH = screenH - deduction; 
        if (maxH < 150) maxH = 150;
        return maxH;
    },

    _buildMenu: function() {
        try {
            Seasonal.updateTheme(false); // Update theme status (without rebuild loop)
            
            // FIX: Save search text and reset reference BEFORE clearing menu
            let savedSearchText = "";
            if (this.searchEntry) {
                try { savedSearchText = this.searchEntry.get_text(); } catch(e) {}
            }
            this.searchEntry = null; // Prevents access to destroyed object in timeouts
            
            let savedScroll = 0;
            if (this.currentView === "dashboard" && this.dashboardScrollView) {
                try {
                    savedScroll = this.dashboardScrollView.get_vscroll_bar().get_adjustment().get_value();
                } catch(e) {}
            }

            this.menu.removeAll();
            // FIX: Recreate section as the old one was destroyed by removeAll()
            this.searchResultSection = new PopupMenu.PopupMenuSection();

            let now = Date.now();

            // Define debug styles (Colorful frames)
            let showDebug = this.settings.getValue("dev-show-frames");
            let debugHeader = showDebug ? "border: 1px solid rgba(255, 50, 50, 0.6);" : ""; // Red
            let debugMetric = showDebug ? "border: 1px solid rgba(50, 255, 50, 0.5);" : ""; // Green
            let debugFooter = showDebug ? "border: 1px solid rgba(50, 100, 255, 0.6);" : ""; // Blue

            let headerSection = new PopupMenu.PopupMenuSection();
            let headContainer = new St.BoxLayout({ vertical: true, reactive: true, style: "min-width: 450px; padding: 5px 0;" + debugHeader });
            
            // --- HEADERS ---
            Header.drawHeader(headContainer, this);
            
            // FIX: Show timeframes fixed in header (above the line) again
            if (this.currentView === "dashboard" && this.apiValid) {
                headContainer.add(Header.createTimeframeSection());
            }
            
            headerSection.actor.add_actor(headContainer); 
            this.menu.addMenuItem(headerSection);
            this.menu.addMenuItem(this._createSeparator());

            let viewActor = null;

            // --- VIEW SWITCHING ---
            let maxContentHeight = this._getMaxContentHeight();

            if (this.currentView === "alarms") {
                if (Alarm && Alarm.createArchiveSection) {
                    let section = Alarm.createArchiveSection(true, maxContentHeight);
                    this.menu.addMenuItem(section);
                    viewActor = section.actor;
                }
            } else if (this.currentView === "portfolio") {
                if (Portfolio && Portfolio.createPortfolioSection) {
                    let section = Portfolio.createPortfolioSection(maxContentHeight);
                    this.menu.addMenuItem(section);
                    viewActor = section.actor;
                }
            } else if (this.currentView === "api_stats") {
                if (ApiConfig && ApiConfig.createStatsSection) {
                    let section = ApiConfig.createStatsSection(maxContentHeight);
                    this.menu.addMenuItem(section);
                    viewActor = section.actor;
                }
            } else if (this.currentView === "donate") {
                if (Donate && Donate.createDonateSection) {
                    let section = Donate.createDonateSection(maxContentHeight);
                    this.menu.addMenuItem(section);
                    viewActor = section.actor;
                }
            } else {
                // --- DASHBOARD VIEW ---
                let metricsSection = new PopupMenu.PopupMenuSection();
                this.metricsSectionActor = metricsSection.actor;
                this.menu.addMenuItem(metricsSection);
                viewActor = metricsSection.actor;

                let dashboardContainer = new St.BoxLayout({ vertical: true });

                // FIX: Use ScrollView only when header menu is open (prevents stuttering with dropdowns)
                if (this.isHeaderMenuOpen) {
                    let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
                    scrollItem.actor.style = "padding: 0px; margin: 0px; max-height: " + maxContentHeight + "px;";
                    
                    let scrollView = new St.ScrollView({
                        hscrollbar_policy: Gtk.PolicyType.NEVER,
                        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                        style_class: 'vfade',
                        style: "max-height: " + maxContentHeight + "px;",
                        reactive: true
                    });
                    this.dashboardScrollView = scrollView;
                    
                    scrollView.add_actor(dashboardContainer);
                    
                    let scrollBox = Utils.addScrollArrows(scrollView);
                    scrollItem.addActor(scrollBox, { expand: true, span: -1 });
                    metricsSection.addMenuItem(scrollItem);
                } else {
                    this.dashboardScrollView = null;
                    let item = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
                    item.actor.style = "padding: 0px; margin: 0px;";
                    item.addActor(dashboardContainer, { expand: true, span: -1 });
                    metricsSection.addMenuItem(item);
                }

                let visibleMetricIndices = [];
                for (let k = 1; k <= 3; k++) {
                    if (this.settings.getValue(this.metrics[k].key_en) || (k === 1)) {
                        visibleMetricIndices.push(k);
                    }
                }

                // --- METRICS LOOP ---
                visibleMetricIndices.forEach((i, arrayIndex) => {
                    let m = this.metrics[i];
                    try {
                        if (this.settings.getValue(m.key_en) || (i === 1)) { // Keep logic
                            // FIX: Disable reactivity during search or alarm input so mouse hover doesn't steal focus
                            let anySearching = (this.searchingMetricIndex !== null);
                            let anyAlarm = (this.alarmOpenIndex !== null);
                            let anyCurrency = (this.currencySelectorIndex !== null);
                            
                            // Wrapper Box for the metric (replaces PopupBaseMenuItem)
                            let metricWrapper = new St.BoxLayout({ vertical: true, reactive: !anySearching && !anyAlarm && !anyCurrency });
                            
                            // Mock item for Seasonal.js (expects addActor/connect)
                            let mockItem = {
                                actor: metricWrapper,
                                addActor: (child) => { metricWrapper.add(child); },
                                connect: (sig, cb) => {
                                    if (sig === 'activate') {
                                        metricWrapper.connect('button-release-event', () => { cb(); return true; });
                                    } else {
                                        metricWrapper.connect(sig, cb);
                                    }
                                }
                            };

                            // Check if a seasonal overlay should replace the metric
                            let overlayResult = Seasonal.handleMetricOverlay(mockItem, i);
                            if (overlayResult) {
                                if (overlayResult !== 'hide') {
                                    dashboardContainer.add(metricWrapper);
                                }
                                return; // Next metric, as this one was replaced by an overlay
                            }

                        // FIX: Remove initial padding so width is correct
                        metricWrapper.set_style("padding: 0px; margin: 0px;");

                        // Uniform, subtle hover effect (gray) for list items
                        if (this.apiValid) {
                            metricWrapper.connect('enter-event', () => { metricWrapper.set_style("padding: 0px; margin: 0px; background-color: " + this.hoverColor + "; border-radius: " + this.hoverRadius + ";"); });
                            metricWrapper.connect('leave-event', () => { metricWrapper.set_style("padding: 0px; margin: 0px; background-color: transparent;"); });
                        } else {
                            // Explicitly set transparent in basic mode to override theme hover
                            metricWrapper.connect('enter-event', () => { metricWrapper.set_style("padding: 0px; margin: 0px; background-color: transparent;"); });
                            metricWrapper.connect('leave-event', () => { metricWrapper.set_style("padding: 0px; margin: 0px; background-color: transparent;"); });
                        }

                        // FIX: Remove width so padding (15+15) + content (420) = 450px (limited by parent) fits
                        let mainBox = new St.BoxLayout({ vertical: true, style: "padding: 10px 25px;" + debugMetric });
                        m.mainBox = mainBox; // Save reference for height calculation
                        
                        if (i === 1 && this.fadeInChart) {
                            mainBox.set_opacity(0);
                            let fStep = 0;
                            let fSteps = 20;
                            Mainloop.timeout_add(25, () => {
                                fStep++;
                                if (!mainBox) return false;
                                try { mainBox.set_opacity(255 * (fStep/fSteps)); } catch(e) {}
                                return fStep < fSteps;
                            });
                        }
                        
                        let marginTop = this.apiValid ? "3px" : "9px";
                        let debugLabel = showDebug ? "border: 1px solid rgba(255, 0, 255, 0.5);" : ""; // Magenta
                        let labelBox = new St.BoxLayout({ vertical: false, height: 30, y_align: St.Align.MIDDLE, style: "margin-top: " + marginTop + "; margin-left: 15px; margin-right: 15px;" + debugLabel }); 
                        
                        let leftMinWidth = "195px";
                        let rightMinWidth = "90px";

                        // 1. LEFT: Ticker, Currency, Price
                        let debugLeft = showDebug ? "border: 1px solid rgba(0, 255, 255, 0.5);" : ""; // Cyan
                        let leftBox = new St.BoxLayout({ y_align: St.Align.MIDDLE, style: "width: " + leftMinWidth + "; min-width: " + leftMinWidth + ";" + debugLeft });
                        let sym = (this.settings.getValue(m.key_sym) || "??").toUpperCase();
                        let cur = (this.settings.getValue(m.key_cur) || "USD").toUpperCase();
                        m.leftBox = leftBox; // IMPORTANT: Save reference for search field swap

                        // --- TICKER / SEARCH LOGIC ---
                        if (true) {
                            // Normal Ticker (Clickable)
                            let isSearchOpen = (this.searchingMetricIndex === i);
                            let tPad = "padding: 0px 6px 0px 7px;";
                            let tStyleNormal = tPad + "border-radius: 4px; opacity: 0.55;";
                            let tStyleHover = tPad + "border-radius: 4px; opacity: 1.0; background-color: " + this.hoverColorHeader + ";";
                            let tStyleActive = tPad + "border-radius: 4px; opacity: 1.0; background-color: rgba(68,157,68,0.25); color: #449d44;";

                            let tickerBin = new St.BoxLayout({ reactive: true, style: isSearchOpen ? tStyleActive : tStyleNormal });
                            let tickerLbl = new St.Label({ y_align: St.Align.MIDDLE, style: "font-size: 16px; color: " + this.colors.text + ";" });
                            tickerLbl.get_clutter_text().set_markup("<b>" + sym + "</b>");
                            tickerBin.add_actor(tickerLbl);

                            tickerBin.connect('enter-event', () => { if (this.searchingMetricIndex !== i) tickerBin.set_style(tStyleHover); });
                            tickerBin.connect('leave-event', () => { 
                                tickerBin.set_style((this.searchingMetricIndex === i) ? tStyleActive : tStyleNormal); 
                            });
                            
                            tickerBin.connect('button-press-event', () => { return true; });
                            tickerBin.connect('button-release-event', () => {
                                try {
                                    if (this.searchingMetricIndex === i) {
                                        this.menu.close = () => {};
                                        Search.stopSearch();
                                    } else {
                                        // Animation is now controlled by Search.startSearch via _closeAnyDropdown
                                        Search.startSearch(i);
                                    }
                                } catch (e) {
                                    global.logError("Ticker Click Error: " + e);
                                }
                                return true;
                            });

                            leftBox.add(tickerBin);
                            
                            // Price Container (Currency + Value)
                            let priceBox = new St.BoxLayout({ y_align: St.Align.MIDDLE });
                            
                            let isSelOpen = (this.currencySelectorIndex === i);
                            let curBin = new St.BoxLayout({ reactive: true, style: isSelOpen ? tStyleActive : tStyleNormal });
                            let curLbl = new St.Label({ y_align: St.Align.MIDDLE, style: "font-size: 16px;" });
                            
                            // Markup without alpha, as opacity is now controlled via container
                            curLbl.get_clutter_text().set_markup("<span>" + cur + "</span>");
                            curBin.add_actor(curLbl);
                            
                            curBin.connect('enter-event', () => { 
                                m.cur_hover = true; 
                                if (this.currencySelectorIndex !== i) curBin.set_style(tStyleHover);
                            });
                            curBin.connect('leave-event', () => { 
                                m.cur_hover = false; 
                                curBin.set_style((this.currencySelectorIndex === i) ? tStyleActive : tStyleNormal);
                            });
                            curBin.connect('button-press-event', () => true);
                            curBin.connect('button-release-event', () => {
                                this._toggleCurrencySelector(i);
                                return true;
                            });

                            let valLbl = new St.Label({ y_align: St.Align.MIDDLE, style: "font-size: 16px;" });
                            valLbl.set_text(" " + Utils.formatPrice(m.current_price_val, i, true));
                            
                            priceBox.add(curBin);
                            priceBox.add(valLbl);
                            leftBox.add(priceBox);
                            
                            m.menu_cur_label = curLbl;
                            m.menu_val_label = valLbl;
                            m.menu_price_label = null; // Delete old reference
                        }

                        labelBox.add(leftBox);

                        let alertPrice = parseFloat(this.settings.getValue("metric" + i + "-alert-price")) || 0;
                        let alertPercent = parseFloat(this.settings.getValue("metric" + i + "-alert-percent")) || 0;
                        let isAlertActive = (alertPrice > 0 || alertPercent > 0);

                        // 2. CENTER: Bell & Interval (Define variable here for scope)
                        let debugCenter = showDebug ? "border: 1px solid rgba(255, 255, 0, 0.5);" : ""; // Yellow
                        let centerBox = new St.BoxLayout({ y_align: St.Align.MIDDLE, style: debugCenter });

                        if (this.apiValid) {
                            centerBox.set_translation(-55, 0, 0); // Centering corrected for 450px
                        }

                        try {
                            let bellPath = global.userdatadir + "/applets/" + UUID + "/icons/bell-symbolic.svg";
                            
                            let iconStyle = isAlertActive ? "color: #e67e22;" : "color: " + this.colors.text_more_dim + ";";

                            let bellIcon = new St.Icon({
                                gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(bellPath) }),
                                icon_size: 18,
                                y_align: St.Align.MIDDLE,
                                style: iconStyle
                            });
                            m.bellIcon = bellIcon; // Save reference for live update

                            let isAlarmOpen = (this.alarmOpenIndex === i);
                            let bPad = "padding: 0px 4px;";
                            let bStyleNormal = bPad + "border-radius: 4px; opacity: 0.55;";
                            let bStyleHover = bPad + "border-radius: 4px; opacity: 1.0; background-color: " + this.hoverColorHeader + ";";
                            let bStyleActive = bPad + "border-radius: 4px; opacity: 1.0; background-color: rgba(68,157,68,0.25);";

                            // Container for background & hover (Dark, rounded, slightly wider)
                            let bellBin = new St.BoxLayout({
                                reactive: true,
                                y_align: St.Align.MIDDLE,
                                style: isAlarmOpen ? bStyleActive : bStyleNormal
                            });
                            bellBin.add_actor(bellIcon);

                            // Interaction for the bell: Tooltip & Click action
                            let tText = "Configure Alarm";

                            // Safe import for tooltip to avoid crashes if module is missing
                            try {
                                let Tooltip = imports.ui.tooltip;
                                if (Tooltip) new Tooltip.Tooltip(bellBin, tText);
                            } catch (e) { /* Tooltip not available */ }

                            bellBin.connect('button-press-event', () => { return true; });

                            bellBin.connect('button-release-event', () => {
                                // --- Keep menu open ---
                                this.menu.close = () => {};

                                // 1. If THIS alarm is already open -> Close
                                if (this.alarmOpenIndex === i) {
                                    if (this.activeAlarmActor) {
                                        Animations.animateCollapse(this.activeAlarmActor, () => {
                                            this.alarmOpenIndex = null;
                                            this.activeAlarmActor = null;
                                            this._buildMenu();
                                            Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                        }, 8);
                                    } else {
                                        this.alarmOpenIndex = null;
                                        this._buildMenu();
                                        Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                    }
                                    return true;
                                }

                                // 2. If anything else is open -> Close, Pause, Open
                                if (this._closeAnyDropdown(() => {
                                    Mainloop.timeout_add(120, () => {
                                        this.alarmOpenIndex = i;
                                        this._buildMenu();
                                        Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                        return false;
                                    });
                                })) {
                                    return true;
                                }

                                // 3. No alarm open -> Open directly
                                this.alarmOpenIndex = i;
                                this._buildMenu();

                                Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                // --- Keep menu open END ---
                                return true; 
                            });

                            // Wiggle animation: Only on hover over bell OR if alarm triggered
                            bellIcon.set_pivot_point(0.5, 0.5);
                            let wiggleId = null;
                            let bellT = 0;

                            // Check if an alarm (price or percent) was triggered
                            let alarmTriggered = (Alarm && Alarm.isTriggered(m.currentId));
                            
                            let startWiggle = () => {
                                if (wiggleId) return;
                                bellT = 0;
                                wiggleId = Mainloop.timeout_add(50, () => {
                                    bellT += 0.6;
                                    
                                    // FIX: Check live status so it stops wiggling when deleted
                                    let isLiveTriggered = (Alarm && Alarm.isTriggered(m.currentId));

                                    // If alarm is active: Endless sine wave
                                    if (isLiveTriggered) {
                                        let angle = 15 * Math.sin(bellT);
                                        bellIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
                                        return true;
                                    }

                                    // Else (Hover): Damped wave like the stars
                                    let maxT = 4 * Math.PI; 
                                    if (bellT >= maxT) {
                                        bellIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                                        wiggleId = null;
                                        return false;
                                    }
                                    
                                    let angle = 15 * (1 - (bellT / maxT)) * Math.sin(bellT);
                                    bellIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
                                    return true;
                                });
                            };

                            let stopWiggle = () => {
                                // If alarm is active, wiggling must not stop
                                if (alarmTriggered) return;

                                if (wiggleId) {
                                    Mainloop.source_remove(wiggleId);
                                    wiggleId = null;
                                }
                                bellIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                                bellT = 0;
                            };

                            // Bind events directly to the bell
                            bellBin.connect('enter-event', () => {
                                if (this.alarmOpenIndex !== i) bellBin.set_style(bStyleHover);
                                startWiggle();
                            });
                            bellBin.connect('leave-event', () => {
                                bellBin.set_style((this.alarmOpenIndex === i) ? bStyleActive : bStyleNormal);
                                stopWiggle();
                            });
                            bellBin.connect('destroy', () => {
                                if (wiggleId) Mainloop.source_remove(wiggleId);
                            });

                            // If alarm was triggered, start animation immediately
                            if (alarmTriggered) startWiggle();

                            centerBox.add(bellBin);
                        } catch (e) { 
                            centerBox.add(new St.Label({ text: "!", style: "color: red;" })); 
                        }

                        let displayPct = m.change_pct;
                        let tf = this.selectedTimeframe;
                        if (this.apiValid && m.cache_charts[tf] && m.cache_charts[tf].length >= 2) {
                            let data = m.cache_charts[tf];
                            // Fix: Correct calculation for OHLC data in cache
                            if (Array.isArray(data[0])) {
                                let firstOpen = data[0][1];
                                let lastClose = data[data.length - 1][4];
                                displayPct = ((lastClose - firstOpen) / firstOpen) * 100;
                            }
                        }
                        let trendColor = (displayPct < 0) ? (this.settings.getValue(m.key_down) || "#d9534f") : (this.settings.getValue(m.key_up) || "#449d44");
                        
                        // --- INTERVAL DISPLAY (RIGHT BEFORE %) ---
                        let intervalMap = { "0.041": "5m", "0.166": "15m", "0.5": "30m", "1": "1h", "3": "4h", "7": "6h", "30": "1d" };
                        let intervalStr = intervalMap[this.selectedTimeframe] || "";
                        let globalCandle = this.settings.getValue("prefer-candle-charts");
                        let showCandle = (m.chartViewMode === 'candle') || (m.chartViewMode === null && globalCandle);

                        if (this.apiValid && showCandle && intervalStr) {
                            // Container with background (Badge style)
                            let debugInt = showDebug ? "border: 1px solid rgba(255, 255, 255, 0.5);" : "";
                            let intBox = new St.BoxLayout({ 
                                y_align: St.Align.MIDDLE, 
                                style: "background-color: " + this.hoverColor + "; border-radius: " + this.hoverRadius + "; padding: 1px 8px 1px 6px;" + debugInt
                            });
                            
                            // Icon (Smaller & adapted to text color)
                            let iconArea = new St.DrawingArea({ width: 14, height: 20, style: "margin-right: 2px;" });
                            iconArea.connect('repaint', (a) => {
                                let cr = a.get_context();
                                cr.setLineWidth(1.2); 
                                let tc = Utils.parseColorString(this.colors.text);
                                cr.setSourceRGBA(tc.r, tc.g, tc.b, 0.4); // Adapted to text color
                                let cx = 7, cy = 10;
                                cr.rectangle(cx - 2, cy - 3, 4, 6); // Body smaller (4x6)
                                cr.stroke();
                                cr.moveTo(cx, cy - 7); cr.lineTo(cx, cy - 3); // Wick top
                                cr.moveTo(cx, cy + 3); cr.lineTo(cx, cy + 7); // Wick bottom
                                cr.stroke();
                                cr.$dispose();
                            });
                            intBox.add(iconArea);

                            // Text (Without brackets)
                            intBox.add(new St.Label({ text: intervalStr, style: "font-size: 13px; color: " + this.colors.text_more_dim + "; padding-top: 1px;" }));
                            
                            // FIX: Ghost container (width 0) so the bell doesn't jump
                            let ghostBin = new St.Widget({ layout_manager: new Clutter.FixedLayout() });
                            ghostBin.set_width(0); 
                            ghostBin.set_clip_to_allocation(false); // IMPORTANT: Disable clipping so content remains visible
                            ghostBin.add_child(intBox);
                            intBox.set_translation(20, -2, 0); // Shift: Right (20px) & Up (-3px)
                            
                            centerBox.add(ghostBin);
                        }

                        // Spacer left and right of center to center it
                        labelBox.add(new St.Label({ text: "" }), { expand: true });
                        labelBox.add(centerBox);
                        labelBox.add(new St.Label({ text: "" }), { expand: true });

                        // 3. RIGHT: Rocket & Percent
                        let debugRight = showDebug ? "border: 1px solid rgba(255, 165, 0, 0.5);" : ""; // Orange
                        let rightBox = new St.BoxLayout({ y_align: St.Align.MIDDLE, style: "width: " + rightMinWidth + "; min-width: " + rightMinWidth + ";" + debugRight });
                        // Spacer inside right box to push content hard right
                        rightBox.add(new St.Label({ text: "" }), { expand: true });

                        // ATH Rocket (visible 24h after trigger)
                        let showRocket = (this.settings.getValue("dev-always-show-rocket")) || (m.ath_trigger_time && (Date.now() - m.ath_trigger_time < 86400000));
                        
                        if (showRocket) {
                            let rocketBin = new St.Bin({ reactive: true, y_align: St.Align.MIDDLE, style: "margin-right: 6px;" });
                            // FIX: Force full opacity and white color so it doesn't look dark
                            let rocketLabel = new St.Label({ text: "🚀", style: "font-size: 16px; color: #ffffff;" });
                            rocketLabel.set_opacity(255);
                            rocketBin.set_child(rocketLabel);
                            rocketBin.set_pivot_point(0.5, 0.5);
                            
                            Animations.animateRocket(rocketBin);
                            
                            rocketBin.connect('button-press-event', () => { return true; });
                            rocketBin.connect('button-release-event', () => {
                                // Send notification only once per menu opening
                                if (!m.ath_notification_sent) {
                                    Utils.sendNotification("Crypto-Tracker", _("NEW ALL TIME HIGH 🚀"), "complete.oga", "weather-clear-symbolic");
                                    m.ath_notification_sent = true;
                                }
                                return true;
                            });
                            
                            rightBox.add(rocketBin);
                        }

                        let pctLabel = new St.Label({ 
                            text: (displayPct >= 0 ? "+" : "") + displayPct.toFixed(2) + "%",
                            style: "color: " + trendColor + "; text-align: right; font-size: 16px; font-weight: bold;",
                            y_align: St.Align.MIDDLE
                        });
                        rightBox.add(pctLabel);
                        m.menu_pct_label = pctLabel;
                        labelBox.add(rightBox);
                        mainBox.add(labelBox);

                        // --- CURRENCY SELECTOR ---
                        if (this.currencySelectorIndex === i) {
                            let showDebug = this.settings.getValue("dev-show-frames");

                            let dOuter = showDebug ? "border: 1px solid rgba(255, 0, 0, 0.8);" : "";
                            let dHeader = showDebug ? "border: 1px solid rgba(0, 255, 0, 0.8);" : "";
                            let dBtnBox = showDebug ? "border: 1px solid rgba(0, 0, 255, 0.8);" : "";
                            let dBtn = showDebug ? "border: 1px solid rgba(255, 255, 0, 0.8);" : "";
                            let dLabel = showDebug ? "background-color: rgba(255, 0, 255, 0.3);" : "";

                            // FIX: Use wrapper instead of margin to prevent widening
                            let wrapperBox = new St.BoxLayout({ vertical: true, style: "padding: 0 15px;" });
                            
                            // FIX: Set fixed width (300px) so it's exactly like the chart and doesn't expand
                            let curSelBox = new St.BoxLayout({ vertical: true, reactive: true, style: "width: 300px; background-color: " + this.colors.bg_popup + "; border-radius: 5px; margin: 5px 0; padding: 10px 0 10px 5px;" + dOuter });
                            curSelBox.connect('button-press-event', () => true);
                            curSelBox.connect('button-release-event', () => true);

                            let csHeader = new St.BoxLayout({ style: "margin-bottom: 5px;" + dHeader });
                            csHeader.add(new St.Label({ text: "Select Currency", style: "font-size: 11px; font-weight: bold; color: " + this.colors.text_dim + ";" + dLabel }), { y_align: St.Align.MIDDLE });
                            csHeader.add(new St.Widget(), { expand: true }); // Spacer
                            
                            let closeBtn = new St.Bin({ reactive: true, style: "padding: 1px 4px; border-radius: 4px;" });
                            let closeIcon = new St.Icon({ icon_name: "window-close-symbolic", icon_size: 15, style: "color: " + this.colors.text_more_dim + ";" });
                            closeBtn.set_child(closeIcon);
                            
                            closeBtn.connect('enter-event', () => { closeIcon.set_style("color: #d9534f;"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });
                            closeBtn.connect('leave-event', () => { closeIcon.set_style("color: " + this.colors.text_more_dim + ";"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });

                            closeBtn.connect('button-press-event', () => true);
                            closeBtn.connect('button-release-event', () => {
                                this._toggleCurrencySelector(i);
                                return true;
                            });
                            csHeader.add(closeBtn);
                            curSelBox.add(csHeader);

                            let curs = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"];
                            let btnBox = new St.BoxLayout({ x_align: St.Align.MIDDLE, style: dBtnBox });
                            
                            curs.forEach((c, idx) => {
                                let isSelected = (c === cur);
                                let baseStyle = "width: 38px; padding: 4px; margin-right: 5px; border-radius: 4px; text-align: left; ";
                                let styleNormal = baseStyle + (isSelected ? "background-color: #e67e22; color: #fff; font-weight: bold;" : "background-color: " + this.colors.bg_input + "; color: " + this.colors.text_dim + ";");
                                let styleHover = baseStyle + (isSelected ? "background-color: #d35400; color: #fff; font-weight: bold;" : "background-color: " + this.colors.divider + "; color: " + this.colors.text + ";");

                                let btn = new St.Button({ 
                                    label: c, 
                                    style: styleNormal + dBtn
                                });
                                
                                btn.connect('enter-event', () => { btn.set_style(styleHover + dBtn); });
                                btn.connect('leave-event', () => { btn.set_style(styleNormal + dBtn); });
                                
                                btn.connect('clicked', () => {
                                    // Immediate feedback
                                    m.current_price_val = 0;
                                    if (m.menu_val_label) m.menu_val_label.set_text(" Loading...");
                                    if (m.text_label) m.text_label.set_text(" Loading...");
                                    
                                    // FIX: Manual currency switch with clean alarm reset
                                    
                                    // 1. Save old alarm
                                    Alarm.syncCurrentToArchive(i, m.activeCurrency);
                                    
                                    // 2. Update active currency
                                    m.activeCurrency = c.toLowerCase();
                                    
                                    // 3. Set flag (blocks binding logic)
                                    this._isSwitchingCoin = true;
                                    
                                    // 4. Switch currency
                                    this.settings.setValue(m.key_cur, c);
                                    
                                    // 5. Check if alarm exists for NEW currency and load (or set to 0)
                                    Alarm.restoreSettingsFor(i, m.currentId, c.toLowerCase());
                                    
                                    this._toggleCurrencySelector(i);
                                    
                                    // Reset flag
                                    Mainloop.timeout_add(2000, () => {
                                        this._isSwitchingCoin = false;
                                        return false;
                                    });
                                });
                                
                                btnBox.add(btn);
                            });
                            
                            curSelBox.add(btnBox);
                            
                            wrapperBox.add(curSelBox);
                            mainBox.add(wrapperBox);
                            this.activeCurrencySelectorActor = wrapperBox; // Reference for collapse
                            Animations.animateExpand(wrapperBox, null, 8);
                        }

                        // --- SEARCH DROPDOWN ---
                        if (this.searchingMetricIndex === i) {
                            try {
                                let searchBox = new St.BoxLayout({ vertical: true, reactive: true, style: "background-color: " + this.colors.bg_popup + "; border-radius: 5px; margin: 5px 15px; padding: 10px;" });
                                
                                // FIX: Intercept clicks so menu doesn't close
                                searchBox.connect('button-press-event', () => { return true; });
                                searchBox.connect('button-release-event', () => { return true; });
                                
                                let sHeader = new St.BoxLayout({ style: "margin-bottom: 5px;" });
                                sHeader.add(new St.Label({ text: "Search Coin", style: "font-size: 11px; font-weight: bold; color: " + this.colors.text_dim + ";" }), { expand: true, y_align: St.Align.MIDDLE });
                                
                                let closeBtn = new St.Bin({ reactive: true, style: "padding: 1px 4px; border-radius: 4px;" });
                                let closeIcon = new St.Icon({ icon_name: "window-close-symbolic", icon_size: 15, style: "color: " + this.colors.text_more_dim + ";" });
                                closeBtn.set_child(closeIcon);

                                closeBtn.connect('enter-event', () => { closeIcon.set_style("color: #d9534f;"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: " + this.hoverColor + ";"); });
                                closeBtn.connect('leave-event', () => { closeIcon.set_style("color: " + this.colors.text_more_dim + ";"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });

                                closeBtn.connect('button-press-event', () => { return true; });
                                closeBtn.connect('button-release-event', () => {
                                    this.menu.close = () => {};
                                    Search.stopSearch();
                                    Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                    return true;
                                });
                                sHeader.add(closeBtn);
                                searchBox.add(sHeader);

                                let entryBox = new St.BoxLayout({ style: "width: 100%;" });
                                
                                let entry = new St.Entry({ can_focus: true, style: "width: 100%; background-color: " + this.colors.bg_input + "; color: " + this.colors.text + "; border-radius: 4px; padding: 2px 5px;" });
                                entry.set_text(savedSearchText); 
                                this.searchEntry = entry;
                                entryBox.add(entry, { expand: true });

                                searchBox.add(entryBox);

                                let scrollView = new St.ScrollView({
                                    hscrollbar_policy: Gtk.PolicyType.NEVER,
                                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                    style_class: 'vfade',
                                    style: "max-height: 250px; margin-top: 5px;",
                                    reactive: true
                                });

                                let resultsBox = new St.BoxLayout({ vertical: true });
                                scrollView.add_actor(resultsBox);
                                let scrollBox = Utils.addScrollArrows(scrollView);
                                searchBox.add(scrollBox);
                                this.currentSearchResultsBox = resultsBox;

                                Search.setupSearchEntry(entry);
                                
                                mainBox.add(searchBox);
                                this.activeSearchActor = searchBox; // Reference for collapse
                                Animations.animateExpand(searchBox, null, 8);
                                
                                // FIX: Set focus automatically
                                Mainloop.timeout_add(20, () => {
                                    if (this.searchEntry && this.searchEntry.mapped) {
                                        this.searchEntry.grab_key_focus();
                                    }
                                    return false;
                                });
                            } catch (e) { global.logError("Search Box Error: " + e); }
                        }

                        // --- ALARM DROPDOWN (Input fields) ---
                        if (this.alarmOpenIndex === i) {
                            let aBox = Alarm.createAlarmMenu(i, cur);
                            mainBox.add(aBox);
                            this.activeAlarmActor = aBox; // Reference for collapse
                            Animations.animateExpand(aBox, null, 8);
                        }

                        if (this.apiValid) {
                            let chartArea = Charts.createChartArea(i);
                            mainBox.add(chartArea); 

                            if (this.expandedIndex === i) {
                                let detailsBox = new St.BoxLayout({ vertical: true, style: "margin-top: 10px; margin-left: 15px; margin-right: 15px; padding: 12px 5px 5px 5px; border-top: 1px solid " + this.colors.divider + ";" });
                                if (!m.details_data || (now - m.last_details_fetch > 3600000)) {
                                    detailsBox.add(new St.Label({ text: "Loading market data...", style: "color: " + this.colors.text_more_dim + "; font-size: 11px;" }));
                                    Charts.fetchCoinDetails(i);
                                } else {
                                    Charts.populateDetailsBox(detailsBox, i);
                                }
                                mainBox.add(detailsBox);
                                this.activeDetailsActor = detailsBox; // Reference for collapse
                                Animations.animateExpand(detailsBox, null, 8);
                            }
                            metricWrapper.connect('button-release-event', () => {
                                this.menu.close = () => {}; 
                                // Only open details via arrow in chart, no longer via whole item
                                Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                return true;
                            });
                        } else {
                            metricWrapper.connect('button-release-event', () => {
                                this.menu.close = () => {};
                                Mainloop.timeout_add(100, () => { this.menu.close = this._originalMenuClose; return false; });
                                return true;
                            });
                        }
                        
                        metricWrapper.add(mainBox);
                        dashboardContainer.add(metricWrapper);

                    }
                    } catch (e) { global.logError("Metric Build Error (" + i + "): " + e); }

                    // Add separator if it's not the last visible element
                    if (arrayIndex < visibleMetricIndices.length - 1) {
                        // Manual separator for BoxLayout
                        let sepContainer = new St.BoxLayout({ style: "padding: 0 40px;", vertical: true });
                        let line = new St.Bin({ style: "height: 1px; background-color: " + this.colors.divider + "; margin: 4px 0;" });
                        sepContainer.add(line);
                        dashboardContainer.add(sepContainer);
                    } 
                });

                if (savedScroll > 0) {
                    Mainloop.idle_add(() => {
                        try {
                            if (this.dashboardScrollView) {
                                this.dashboardScrollView.get_vscroll_bar().get_adjustment().set_value(savedScroll);
                            }
                        } catch(e) {}
                        return false;
                    });
                }
            }

            if (this._isViewSwitching && viewActor) {
                Animations.animateFadeIn(viewActor);
            }

            // --- FOOTER SECTION (SYMMETRICAL DESIGN) ---
            let searchActive = (this.searchingMetricIndex !== null) || 
                               (Portfolio && Portfolio.isSearchOpen && Portfolio.isSearchOpen());
            let footerItem = Footer.createFooter(searchActive);
            if (showDebug) {
                footerItem.actor.set_style((footerItem.actor.get_style() || "") + debugFooter);
            }
            this.menu.addMenuItem(footerItem);

        } catch (e) { 
            global.logError("BUILD MENU ERROR: " + e);
            Utils.logToErrorFile("BuildMenu", e);
        }
    },

    _createSeparator: function() {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        
        // Container with padding (15px left/right like the rest)
        let container = new St.BoxLayout({ style: "padding: 0 15px;", vertical: true });
        
        // The line itself (Made visible by background color, 1px high)
        let line = new St.Bin({ style: "height: 1px; background-color: " + this.colors.divider + "; margin: 4px 0;" });
        
        container.add(line, { expand: true, x_fill: true, y_fill: false });
        item.addActor(container, { expand: true, span: -1 });
        return item;
    },

    _closeAnyDropdown: function(onClosedCallback) {
        let closeIt = (actor, resetFunc) => {
            Animations.animateCollapse(actor, () => {
                resetFunc();
                if (onClosedCallback) onClosedCallback();
            }, 8);
            return true;
        };

        // 1. Header Menu
        if (this.isHeaderMenuOpen && this.activeHeaderMenuActor) {
            return closeIt(this.activeHeaderMenuActor, () => {
                this.isHeaderMenuOpen = false;
                this.activeHeaderMenuActor = null;
                this._buildMenu();
            });
        }

        // 2. Search
        if (this.searchingMetricIndex !== null && this.activeSearchActor) {
            return closeIt(this.activeSearchActor, () => {
                this.searchingMetricIndex = null;
                this.activeSearchActor = null;
                this._buildMenu();
            });
        }

        // 3. Alarm
        if (this.alarmOpenIndex !== null && this.activeAlarmActor) {
            return closeIt(this.activeAlarmActor, () => {
                this.alarmOpenIndex = null;
                this.activeAlarmActor = null;
                this._buildMenu();
            });
        }

        // 4. Currency Selector
        if (this.currencySelectorIndex !== null && this.activeCurrencySelectorActor) {
            return closeIt(this.activeCurrencySelectorActor, () => {
                this.currencySelectorIndex = null;
                this.activeCurrencySelectorActor = null;
                this._buildMenu();
            });
        }

        // 5. Chart Details (Expanded)
        if (this.expandedIndex !== null && this.activeDetailsActor) {
            return closeIt(this.activeDetailsActor, () => {
                this.expandedIndex = null;
                this.activeDetailsActor = null;
                this._buildMenu();
            });
        }

        // 6. Donate Dropdown
        if (this.currentView === 'donate' && Donate && Donate.closeDropdown) {
            if (Donate.closeDropdown(onClosedCallback)) return true;
        }

        return false;
    },

    _toggleCurrencySelector: function(idx) {
        this.menu.close = () => {};
        
        // 1. Close (Click on same button)
        if (this.currencySelectorIndex === idx && this.activeCurrencySelectorActor) {
            Animations.animateCollapse(this.activeCurrencySelectorActor, () => {
                this.currencySelectorIndex = null;
                this.activeCurrencySelectorActor = null;
                this._buildMenu();
                Mainloop.timeout_add(100, () => { if (this.menu) this.menu.close = this._originalMenuClose; return false; });
            }, 8); // Slower
            return;
        }

        // 2. Switch (Click on other button)
        if (this.currencySelectorIndex !== null && this.activeCurrencySelectorActor) {
             Animations.animateCollapse(this.activeCurrencySelectorActor, () => {
                this.currencySelectorIndex = idx;
                this.activeCurrencySelectorActor = null;
                
                this.searchingMetricIndex = null;
                this.alarmOpenIndex = null;
                this.expandedIndex = null;
                this.isHeaderMenuOpen = false;
                this.resetViewStates();
                if (Search.stopSearch) Search.stopSearch();

                Mainloop.timeout_add(120, () => {
                    this._buildMenu();
                    Mainloop.timeout_add(100, () => { if (this.menu) this.menu.close = this._originalMenuClose; return false; });
                    return false;
                });
            }, 8); // Slower
            return;
        }

        // 3. If ANOTHER dropdown is open (Search, Alarm, Header, etc.) -> Close, Pause, Open
        if (this._closeAnyDropdown(() => {
            Mainloop.timeout_add(120, () => {
                this.currencySelectorIndex = idx;
                this._buildMenu();
                Mainloop.timeout_add(100, () => { if (this.menu) this.menu.close = this._originalMenuClose; return false; });
                return false;
            });
        })) {
            return;
        }

        // 4. Re-open
        this.currencySelectorIndex = idx;
        
            this.searchingMetricIndex = null;
            this.alarmOpenIndex = null;
            this.expandedIndex = null;
            this.isHeaderMenuOpen = false;
            this.resetViewStates();
            if (Search.stopSearch) Search.stopSearch();
        
        this._buildMenu();
        Mainloop.timeout_add(100, () => { if (this.menu) this.menu.close = this._originalMenuClose; return false; });
    },

    resetViewStates: function() {
        if (Alarm && Alarm.setArchiveOpen) Alarm.setArchiveOpen(false);
        if (Alarm && Alarm.collapseAllAlarms) Alarm.collapseAllAlarms();
        if (Alarm && Alarm.resetSearch) Alarm.resetSearch();
        if (Portfolio && Portfolio.collapseAll) Portfolio.collapseAll();
        if (Portfolio && Portfolio.resetFilter) Portfolio.resetFilter();
        if (Portfolio && Portfolio.closeSearch) Portfolio.closeSearch();
        if (Portfolio && Portfolio.closeCurrencySelector) Portfolio.closeCurrencySelector();
        if (Donate && Donate.resetState) Donate.resetState();
    },

    on_applet_clicked: function() { 
        if (!this.menu.isOpen) { 
            this._updateThemeColors(false); // Theme check before build
            this.searchingMetricIndex = null; 
            this.expandedIndex = null; 
            this.alarmOpenIndex = null; 
            this.currencySelectorIndex = null;
            this.isHeaderMenuOpen = false;

            this.resetViewStates();
            
            // Reset ATH notification sent flag for all metrics
            for (let i = 1; i <= 3; i++) {
                if (this.metrics[i]) {
                    this.metrics[i].ath_notification_sent = false;
                }
            }

            // Reset New Year Animation State
            this.newYearOverlayActive = false;
            this.newYearMetricActive = false;
            this.newYearStartTime = 0;
            if (this._nyMetricTimeout) {
                Mainloop.source_remove(this._nyMetricTimeout);
                this._nyMetricTimeout = null;
            }
            
            this._buildMenu(); 
        }
        this.menu.toggle(); 

        // FIX: Immediate update on open to load portfolio data (which was paused in background)
        if (this.menu.isOpen) {
            let now = Date.now();
            let interval = (this.settings.getValue("update-interval-seconds") || 120) * 1000;
            
            // Only update if interval has expired (with small tolerance)
            // NOTE: This only affects PRICES. Charts have their own 5-minute cache (see charts.js).
            if (now - this._lastGlobalFetch >= interval - 1000) {
                this.updatePrices();
            } else {
                this.updateVisuals();
            }
        }
    },

    _testCrash: function() {
        // Provokes an error to test the logging system (via settings)
        let testFunc = Utils.safeCallback(() => {
            throw new Error("This is a manual test error from settings!");
        }, "Settings Test-Button");
        testFunc();
    },

    on_applet_removed_from_panel: function() {
        if (this._refreshId) {
            Mainloop.source_remove(this._refreshId);
            this._refreshId = null;
        }
        if (this._settingsChangedTimer) {
            Mainloop.source_remove(this._settingsChangedTimer);
            this._settingsChangedTimer = null;
        }
        if (this._nyMetricTimeout) {
            Mainloop.source_remove(this._nyMetricTimeout);
            this._nyMetricTimeout = null;
        }
        if (this._ghostTimer) {
            Mainloop.source_remove(this._ghostTimer);
            this._ghostTimer = null;
        }
        
        if (ApiConfig && ApiConfig.destroy) ApiConfig.destroy();
        if (Search && Search.destroy) Search.destroy();
        if (Alarm && Alarm.destroy) Alarm.destroy();
        if (Portfolio && Portfolio.destroy) Portfolio.destroy();

        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    },

    _checkQuota: function() {
        let limit = 10000; // Demo API Limit
        let usage = this.keyCalls;
        
        // Reset flags on new month (if usage is low)
        if (usage < 500) this._quotaWarnings = { w80: false, w90: false, w100: false };

        if (usage >= limit && !this._quotaWarnings.w100) {
            Utils.sendNotification(_("API Limit Reached"), _("You have used 100% of your monthly limit (10k)."), "dialog-error", "network-error-symbolic");
            this._quotaWarnings.w100 = true;
            
            // FIX: Activate auto power saving mode (set interval to 5 min)
            let currentInterval = parseInt(this.settings.getValue("update-interval-seconds")) || 120;
            if (currentInterval < 300) {
                this.settings.setValue("update-interval-seconds", 300);
                Utils.sendNotification(_("Power Saving Enabled"), _("Interval set to 5 min to avoid API ban."), "dialog-information", "battery-low-symbolic");
            }
        } else if (usage >= limit * 0.9 && !this._quotaWarnings.w90) {
            Utils.sendNotification(_("API Limit Warning"), _("You have reached 90% of your limit."), "dialog-warning", "network-idle-symbolic");
            this._quotaWarnings.w90 = true;
        } else if (usage >= limit * 0.8 && !this._quotaWarnings.w80) {
            Utils.sendNotification(_("API Limit Info"), _("You have reached 80% of your limit."), "dialog-information", "network-receive-symbolic");
            this._quotaWarnings.w80 = true;
        }
    }
};

function PopupBaseMenuItemExtended() { 
    this._init.apply(this, arguments); 
}
PopupBaseMenuItemExtended.prototype = {
     __proto__: PopupMenu.PopupBaseMenuItem.prototype, 
     _init: function(params) { 
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params); 
    } 
};
function main(metadata, orientation, panel_height) { 
    return new MyApplet(metadata, orientation, panel_height); 
}