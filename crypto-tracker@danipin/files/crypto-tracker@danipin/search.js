
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Alarm = imports.alarm.Alarm;
const DataPersistence = imports.data_persistence.DataPersistence;
const Animations = imports.animations.Animations;
const Utils = imports.utils.Utils;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var _applet;
var _searchTimeout = null;
var _searchResultItems = [];
var _lastSearchRequestTime = 0;

function init(applet) {
    _applet = applet;
}

function createSearchUI() {
    _applet.searchEntry = new St.Entry({
        style_class: 'crypto-search-entry',
        hint_text: _("Search..."),
        can_focus: true,
        x_expand: true
    });
    _applet.searchEntry.get_clutter_text().connect('text-changed', () => onSearchTextChanged());
    _applet.searchEntry.get_clutter_text().connect('activate', () => onSearchActivated());
    
    _applet.searchEntry.get_clutter_text().connect('key-press-event', (actor, event) => {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            stopSearch();
            return true;
        }
        return false;
    });
    
    _applet.searchEntry.get_clutter_text().connect('key-focus-in', () => _applet.searchEntry.set_style("border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;"));
    _applet.searchEntry.get_clutter_text().connect('key-focus-out', () => { _applet.searchEntry.set_style("border: 1px solid transparent;"); });

    _applet.searchResultSection = new PopupMenu.PopupMenuSection();
}

function setupSearchEntry(entry) {
    entry.get_clutter_text().connect('text-changed', () => onSearchTextChanged());
    entry.get_clutter_text().connect('activate', () => onSearchActivated());
    
    entry.get_clutter_text().connect('key-press-event', (actor, event) => {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            stopSearch();
            return true;
        }
        return false;
    });
    
    // Style exactly like in alarm area (no focus effect, no border, font size 13px)
    let baseStyle = "width: 100%; font-size: 13px; background-color: " + _applet.colors.bg_input + "; color: " + _applet.colors.text + "; border-radius: 4px; padding: 2px 5px;";
    entry.set_style(baseStyle);
}

function onSearchTextChanged() {
    if (_searchTimeout) {
        Mainloop.source_remove(_searchTimeout);
    }
    // 1. Debounce reduced to 600ms for faster results
    _searchTimeout = Mainloop.timeout_add(600, () => {
        _searchTimeout = null;
        try {
            if (!_applet.searchEntry) return false;
            let textObj = _applet.searchEntry.get_clutter_text();
            if (!textObj || !textObj.mapped) return false;
        } catch(e) {
            return false;
        }

        let query = _applet.searchEntry.get_text();
        // 2. Minimum length increased to 3 chars (saves unnecessary requests like "bi")
        if (query.length < 3) {
            clearSearchResults();
            return false;
        }

        // 3. Rate Limit: At least 1.5 seconds pause between search requests
        let now = Date.now();
        if (now - _lastSearchRequestTime < 1500) {
            _searchTimeout = Mainloop.timeout_add(1500 - (now - _lastSearchRequestTime), () => {
                if (!_applet.searchEntry) return false;
                let q = _applet.searchEntry.get_text();
                // FIX: Pass current index to prevent race conditions
                if (q.length >= 3) fetchSearchResults(q, _applet.searchingMetricIndex);
                return false;
            });
            return false;
        }

        fetchSearchResults(query, _applet.searchingMetricIndex);
        return false;
    });
}

function clearSearchResults() {
    if (_searchResultItems) {
        _searchResultItems.forEach(item => {
            try {
                if (item) item.destroy();
            } catch(e) {}
        });
    }
    _searchResultItems = [];
}

function fetchSearchResults(query, metricIndex) {
    _lastSearchRequestTime = Date.now();
    let url = "https://api.coingecko.com/api/v3/search?query=" + query;
    let apiKey = _applet.settings.getValue("api-key");
    let params = ['curl', '--silent', '--max-time', '5', url];
    if (apiKey && apiKey.length > 5) {
        params = ['curl', '--silent', '--max-time', '5', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
        if (_applet) {
            _applet.keyCalls++;
            _applet.searchCalls = (_applet.searchCalls || 0) + 1;
            _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
            DataPersistence.saveCallStats();
        }
    }
    Util.spawn_async(params, Utils.safeCallback((stdout) => {
        try {
            let j = JSON.parse(stdout);
            
            // If search was cancelled in the meantime, do nothing
            if (_applet.searchingMetricIndex === null) return;
            
            // FIX: If user switched to another ticker in the meantime, discard result
            if (metricIndex !== undefined && _applet.searchingMetricIndex !== metricIndex) return;

            let coins = j.coins;
            clearSearchResults();
            
            // We access the container set in _buildMenu (applet.js)
            // FIX: Check if box still exists and is on stage (prevents segfaults)
            if (!_applet.currentSearchResultsBox || !_applet.currentSearchResultsBox.get_stage()) return;

            if (coins && coins.length > 0) {
                coins.forEach(coin => {
                    // FIX: Custom items instead of PopupMenuItem for full control over colors
                    let item = new St.BoxLayout({ reactive: true, style: "padding: 6px; border-radius: 4px;" });
                    let label = new St.Label({ text: coin.name + " (" + coin.symbol + ")", style: "color: " + _applet.colors.text + ";" });
                    
                    // Limit width so long names don't break the menu
                    label.set_style("max-width: 370px; color: " + _applet.colors.text + ";");
                    label.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END);
                    item.add_actor(label);

                    item.connect('enter-event', () => item.set_style("padding: 6px; border-radius: 4px; background-color: " + _applet.hoverColor + ";"));
                    item.connect('leave-event', () => item.set_style("padding: 6px; border-radius: 4px; background-color: transparent;"));
                    item.connect('button-release-event', () => { addCoin(coin.id, coin.symbol); return true; });
                    
                    _applet.currentSearchResultsBox.add_actor(item);
                    _searchResultItems.push(item);
                });
            } else {
                let item = new St.Label({ text: _("No results..."), style: "padding: 6px; color: " + _applet.colors.text_more_dim + ";" });
                _applet.currentSearchResultsBox.add_actor(item);
                _searchResultItems.push(item);
            }
        } catch(e) { global.logError("Search Error: " + e); }
    }, "fetchSearchResults"));
}

function onSearchActivated() {
    let text = _applet.searchEntry.get_text();
    if (text.length > 1) {
        addCoin(text, text.toUpperCase());
    }
}

function addCoin(id, symbol) {
    let targetIndex = _applet.searchingMetricIndex;
    if (targetIndex === null) return;

    // Normalize and map ID (important for manual input "BTC" -> "bitcoin")
    id = id.toLowerCase().trim();
    let map = { "ada": "cardano", "btc": "bitcoin", "eth": "ethereum" };
    if (map[id]) id = map[id];

    // FIX: Block menu closing so it stays open after Enter
    _applet.menu.close = () => {};

    // CACHE RESET: Immediate data clearing to avoid race condition with updateTicker
    let m = _applet.metrics[targetIndex];
    m.currentId = id; // IMPORTANT: Set ID immediately so updatePrices accepts the fetch
    m.fromSearch = true; // Set flag so updateTicker skips symbol fetch
    m.history_data = [];
    m.cache_charts = {};
    m.cache_timestamps_charts = {};
    m.details_data = null;
    m.last_details_fetch = 0;
    m.current_price_val = 0;
    m.change_pct = 0;
    m.last_chart_diff_pct = 0;
    m.price_cache = {};
    m.change_cache = {};
    m.cache_timestamps = {};
    m.ticker = "";

    // ALARM RESET: Ensure no old alarms are adopted
    // FIX: Restore alarms from archive instead of deleting
    Alarm.restoreSettingsFor(targetIndex, id);

    _applet.settings.setValue("metric" + targetIndex + "-enabled", true);
    _applet.settings.setValue("metric" + targetIndex + "-id", "custom");
    _applet.settings.setValue("metric" + targetIndex + "-custom-id", id);
    // Set symbol directly so ticker is correct immediately (e.g. "BTC" instead of waiting for API)
    if (symbol) {
        _applet.settings.setValue("metric" + targetIndex + "-symbol", symbol.toUpperCase());
    }
    
    // Immediate visual feedback (removes old icon & shows "Loading...")
    _applet.updateVisuals();
    
    stopSearch(true); 
    
    // FALLBACK: If updateTicker in applet.js doesn't trigger (e.g. same coin selected -> no settings change),
    // we force the update here after a short time.
    Mainloop.timeout_add(600, () => { 
        if (m.fromSearch) { // Only if applet.js hasn't consumed the flag yet
            _applet.updatePrices(); 
            m.fromSearch = false;
        }
        return false; 
    });
}

function startSearch(idx) {
    if (_applet.searchingMetricIndex === idx) return;
    
    // Block menu closing briefly
    _applet.menu.close = () => {};
    
    // 1. Check if anything is open (Search, Currency, Alarm, Header) -> Close
    if (_applet._closeAnyDropdown(() => {
            Mainloop.timeout_add(120, () => {
            startSearch(idx); // Restart after closing
                return false;
            });
    })) {
        return;
    }
    
    // 2. Re-open
    _applet.activeSearchActor = null; 
    _applet.searchEntry = null; 
    
    // Safety: Ensure everything else is closed (logically)
    _applet.alarmOpenIndex = null;
    _applet.expandedIndex = null;
    _applet.currencySelectorIndex = null;
    _applet.isHeaderMenuOpen = false;
    if (_applet.resetViewStates) _applet.resetViewStates();
    
    _applet.searchingMetricIndex = idx;
    
    Mainloop.timeout_add(10, () => {
        try {
            _applet._buildMenu(); 
            
            // Focus is now safely set in applet.js _buildMenu
            
            // Restore menu closing
            Mainloop.timeout_add(600, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        } catch (e) {
            global.logError("Search Start Error: " + e);
        }
    });
}

function stopSearch(rebuild = false) {
    if (_applet.searchingMetricIndex === null) return;

    // Collapse Animation
    if (_applet.activeSearchActor) {
        Animations.animateCollapse(_applet.activeSearchActor, () => {
            _applet.searchingMetricIndex = null;
            _applet.activeSearchActor = null;
            _applet.menu.close = () => {};
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        }, 8);
        return;
    }

    _applet.searchingMetricIndex = null;
    _applet.menu.close = () => {};
    _applet._buildMenu();
    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
}

function destroy() {
    if (_searchTimeout) {
        Mainloop.source_remove(_searchTimeout);
        _searchTimeout = null;
    }
}

var Search = {
    init: init,
    onSearchTextChanged: onSearchTextChanged,
    onSearchActivated: onSearchActivated,
    startSearch: startSearch,
    stopSearch: stopSearch,
    createSearchUI: createSearchUI,
    setupSearchEntry: setupSearchEntry,
    destroy: destroy
};
