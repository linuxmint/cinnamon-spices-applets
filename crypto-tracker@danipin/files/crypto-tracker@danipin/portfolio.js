const St = imports.gi.St;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Utils = imports.utils.Utils;
const Gtk = imports.gi.Gtk;
const DataPersistence = imports.data_persistence.DataPersistence;
const Animations = imports.animations.Animations;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  let forced = _applet ? _applet.forcedLocale : null;
  if (forced && forced !== "system") {
      let old = GLib.getenv("LANGUAGE");
      GLib.setenv("LANGUAGE", forced, true);
      let res = Gettext.dgettext(UUID, str);
      if (old) GLib.setenv("LANGUAGE", old, true);
      else GLib.unsetenv("LANGUAGE");
      return res;
  }
  return Gettext.dgettext(UUID, str);
}

var _applet;
var _holdings = [];
var _priceCache = {};
var _totalValueLabel = null;
var _searchTimeout = null;
var _currentSearchResults = [];
var _privacyMode = false;
var _sortMode = 'value_desc'; // 'value_desc', 'value_asc', 'name_asc'
var _isSearchOpen = false;
var _portfolioCurrency = "usd";
var _isCurrencySelectorOpen = false;
var _portfolioFilterQuery = "";
var _isFilterVisible = false;
var _lastPortfolioFetch = 0;

var _activeCurrencyActor = null;
var _activeSearchActor = null;
var _activeFilterActor = null;

function init(applet) {
    _applet = applet;
    _portfolioCurrency = (_applet.settings.getValue("metric1-currency") || "usd").toLowerCase();
    loadHoldings();
    checkMissingMetadata(); // Icons für bestehende Coins laden
}

function getFilePath() {
    return _applet.metadata.path + "/portfolio.json";
}

function loadHoldings() {
    try {
        let file = Gio.file_new_for_path(getFilePath());
        if (file.query_exists(null)) {
            let [success, contents] = file.load_contents(null);
            if (success) {
                let json = JSON.parse(contents.toString());
                if (Array.isArray(json)) {
                    _holdings = json;
                } else {
                    _holdings = json.items || [];
                    if (json.currency) _portfolioCurrency = json.currency;
                }
                
                // Migration & Initialization
                _holdings.forEach(h => {
                    if (h.buyPrice === undefined) h.buyPrice = 0;
                    h.expanded = false;
                    // Migration: Initialize transactions if not present
                    if (!h.transactions || !Array.isArray(h.transactions)) {
                        h.transactions = [];
                        // If old data exists, create as first transaction
                        let amt = parseFloat(h.amount);
                        if (!isNaN(amt) && amt !== 0) {
                            h.transactions.push({
                                id: Date.now().toString() + Math.floor(Math.random()*1000),
                                amount: h.amount,
                                buyPrice: h.buyPrice
                            });
                        }
                    }
                    if (h.transactions) {
                        h.transactions.forEach(t => { 
                            t.editMode = false; 
                            if (!t.date) {
                                let d = new Date();
                                t.date = d.getDate().toString().padStart(2, '0') + "." + (d.getMonth() + 1).toString().padStart(2, '0') + "." + d.getFullYear();
                            }
                            // Migration: Set original values if missing (prevents drift on currency switch)
                            if (t.originalBuyPrice === undefined) {
                                t.originalBuyPrice = t.buyPrice;
                                t.originalCurrency = _portfolioCurrency;
                            }
                        });
                    }
                });
            }
        }
    } catch (e) {
        global.logError("Crypto-Tracker: Error loading portfolio: " + e);
        _holdings = [];
    }
}

function saveHoldings() {
    try {
        let file = Gio.file_new_for_path(getFilePath());
        
        // Create cleaned copy (without UI references like valueLabel)
        let cleanItems = _holdings.map(h => ({
            id: h.id,
            symbol: h.symbol,
            amount: h.amount,
            buyPrice: h.buyPrice,
            currentPrice: h.currentPrice,
            currentValue: h.currentValue,
            image: h.image,
            expanded: h.expanded,
            transactions: h.transactions ? h.transactions.map(t => ({
                id: t.id,
                amount: t.amount,
                buyPrice: t.buyPrice,
                date: t.date,
                originalBuyPrice: t.originalBuyPrice,
                originalCurrency: t.originalCurrency
            })) : []
        }));

        let data = {
            currency: _portfolioCurrency,
            items: cleanItems
        };
        let raw = JSON.stringify(data, null, 4);
        file.replace_contents(raw, null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        global.logError("Crypto-Tracker: Error saving portfolio: " + e);
    }
}

function addPortfolioIds(targetList, isUpdate = true) {
    if (isUpdate) {
        let now = Date.now();
        if (now - _lastPortfolioFetch < 300000) return; // 5 Minuten Cache (300.000 ms)
        _lastPortfolioFetch = now;
    }
    _holdings.forEach(h => {
        if (!targetList.includes(h.id)) targetList.push(h.id);
    });
}

function getCurrency() {
    return _portfolioCurrency;
}

function isSearchOpen() {
    return _isSearchOpen;
}

function closeSearch() {
    _isSearchOpen = false;
}

function resetFilter() {
    _portfolioFilterQuery = "";
    _isFilterVisible = false;
}

function updatePortfolioPrices(apiData, ignoredGlobalCurrency) {
    let globalCurrency = _portfolioCurrency;
    let total = 0;
    let total24hAgo = 0;
    let curSym = globalCurrency.toUpperCase();
    if (curSym === "USD") curSym = "$";
    if (curSym === "EUR") curSym = "€";

    // 1. Pass: Update Prices & Calculate Total
    _holdings.forEach(h => {
        let price = 0;
        let change = 0;

        if (apiData[h.id]) {
            price = apiData[h.id][globalCurrency];
            change = apiData[h.id][globalCurrency + "_24h_change"];
            
            if (price !== undefined) {
                _priceCache[h.id] = { price: price, change: change || 0 };
                h.currentPrice = price;
                h.currentChange = change || 0;
            }
        }

        // Fallback to cache
        if (!price && _priceCache[h.id]) {
            let cached = _priceCache[h.id];
            // Compatibility: If cache was old (number only)
            price = (typeof cached === 'object') ? cached.price : cached;
            change = (typeof cached === 'object') ? cached.change : 0;
        }

        let p = price || h.currentPrice || 0;
        let c = (change !== undefined) ? change : (h.currentChange || 0);
        
        recalculateCoin(h); // Ensures h.amount and h.buyPrice are current
        let val = p * (parseFloat(h.amount) || 0);
        h.currentValue = val; // Store for 2nd pass
        total += val;

        // Reconstruct value 24h ago: Current / (1 + pct/100)
        if (c > -100) {
            total24hAgo += val / (1 + c / 100);
        }
    });

    // 2. Pass: Update UI Labels
    _holdings.forEach(h => {
        if (h.valueLabel && typeof h.valueLabel.set_text === 'function') {
            let text = "";
            if (_privacyMode) {
                text = curSym + " ****";
            } else {
                text = curSym + " " + Utils.formatPrice(h.currentValue, 1, true);
            }
            h.valueLabel.set_text(text);
        }

        if (h.allocLabel && typeof h.allocLabel.set_text === 'function') {
            let alloc = (total > 0) ? (h.currentValue / total) * 100 : 0;
            h.allocLabel.set_text(alloc.toFixed(1) + "%");
        }

        if (h.pnlLabel && typeof h.pnlLabel.set_text === 'function') {
            let buyPrice = parseFloat(h.buyPrice) || 0;
            let amount = parseFloat(h.amount) || 0;
            let currentPrice = h.currentPrice || 0;
            
            if (buyPrice > 0 && amount > 0) {
                let invest = buyPrice * amount;
                let currentVal = currentPrice * amount;
                let pnlAbs = currentVal - invest;
                let pnlPct = (invest > 0) ? (pnlAbs / invest) * 100 : 0;
                
                let color = (pnlAbs >= 0) ? "#4caf50" : "#f44336";
                let sign = (pnlAbs >= 0) ? "+" : "";
                
                let txt = "";
                if (_privacyMode) {
                    txt = `${sign}${pnlPct.toFixed(2)}%`;
                } else {
                    txt = `${sign}${Utils.formatPrice(pnlAbs, 1, true)} (${sign}${pnlPct.toFixed(2)}%)`;
                }
                h.pnlLabel.set_text(txt);
                h.pnlLabel.set_style("text-align: right; font-size: 12px; font-weight: bold; color: " + color + ";");
            } else {
                h.pnlLabel.set_text("-");
                h.pnlLabel.set_style("text-align: right; font-size: 12px; color: #aaa;");
            }
        }

        if (h.amountLabel && typeof h.amountLabel.set_text === 'function') {
            h.amountLabel.set_text(h.amount.toString());
        }
    });

    if (_totalValueLabel) {
        let text = "";
        if (_privacyMode) {
            text = curSym + " ****";
        } else {
            text = curSym + " " + Utils.formatPrice(total, 1, true);
        }

        // Add 24h change
        if (total > 0 && total24hAgo > 0) {
            let totalChangePct = ((total - total24hAgo) / total24hAgo) * 100;
            let sign = totalChangePct >= 0 ? "+" : "";
            let color = totalChangePct >= 0 ? "#449d44" : "#d9534f"; // Standard Grün/Rot
            text += `  <span color='${color}' size='small'>(${sign}${totalChangePct.toFixed(2)}%)</span>`;
        }

        let clText = _totalValueLabel.get_clutter_text();
        if (clText) {
            clText.set_markup(text);
        }
    }
}

function _convertPortfolio(newCurrency) {
    // 1. Collect all required currencies (original currencies of transactions)
    let currencies = new Set();
    currencies.add(newCurrency);
    _holdings.forEach(h => {
        if (h.transactions) {
            h.transactions.forEach(t => {
                if (t.originalCurrency) currencies.add(t.originalCurrency);
                else currencies.add(_portfolioCurrency); // Fallback
            });
        }
    });

    let curList = Array.from(currencies).join(",");
    
    // 2. Get exchange rates (Use Bitcoin as proxy: Rate = BTC_in_NEW / BTC_in_OLD)
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=" + curList;
    let apiKey = _applet.settings.getValue("api-key");
    let params = ['curl', '--silent', '--max-time', '10', url];
    if (apiKey && apiKey.length > 5) {
        params.push('-H');
        params.push('x-cg-demo-api-key: ' + apiKey);
        if (_applet) {
            _applet.keyCalls++;
            _applet.portfolioCalls = (_applet.portfolioCalls || 0) + 1;
            DataPersistence.saveCallStats();
        }
    }

    if (_totalValueLabel) _totalValueLabel.set_text(_("Converting..."));

    Util.spawn_async(params, (stdout) => {
        try {
            let data = JSON.parse(stdout);
            if (data && data.bitcoin) {
                let btcPrices = data.bitcoin;
                let newCurPrice = btcPrices[newCurrency];

                if (newCurPrice) {
                    // 3. Transaktionen aktualisieren
                    _holdings.forEach(h => {
                        if (h.transactions) {
                            h.transactions.forEach(t => {
                                let origCur = t.originalCurrency || _portfolioCurrency;
                                
                                // FIX: Wenn Ziel-Währung == Original-Währung, exakten Wert wiederherstellen (kein Drift)
                                if (origCur === newCurrency && t.originalBuyPrice !== undefined) {
                                    t.buyPrice = t.originalBuyPrice;
                                } else {
                                    // Sonst umrechnen via Bitcoin-Proxy
                                    let origPrice = btcPrices[origCur];
                                    if (origPrice && t.originalBuyPrice !== undefined) {
                                        let rate = newCurPrice / origPrice;
                                        t.buyPrice = t.originalBuyPrice * rate;
                                    }
                                }
                            });
                        }
                        recalculateCoin(h);
                    });

                    // 4. Abschluss
                    _portfolioCurrency = newCurrency;
                    _isCurrencySelectorOpen = false;
                    saveHoldings();
                    
                    _lastPortfolioFetch = 0;
                    _applet._lastGlobalFetch = 0;
                    _applet.updatePrices();
                    
                    // Menü neu bauen
                    _applet.menu.close = () => {};
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                }
            }
        } catch (e) {
            global.logError("Portfolio Conversion Error: " + e);
            Utils.sendNotification(_("Error"), _("Currency conversion failed."), "dialog-error");
            _applet._buildMenu();
        }
    });
}

function addCoin(id, symbol, image_url) {
    // Prüfen ob schon existiert
    let exists = _holdings.find(h => h.id === id);
    if (!exists) {
        let newCoin = {
            id: id,
            symbol: symbol,
            amount: 0,
            buyPrice: 0,
            currentPrice: 0,
            currentValue: 0,
            image: image_url || null,
            transactions: [],
            expanded: false
        };
        _holdings.push(newCoin);
        saveHoldings();
        _lastPortfolioFetch = 0; // Cache zurücksetzen für sofortiges Update
        // Trigger update
        _applet._lastGlobalFetch = 0; // Force fetch
        _applet.updatePrices();
    }
    
    _isSearchOpen = false;
    
    // Menu Rebuild mit Schutz vor Schließen
    _applet.menu.close = () => {};
    _applet._buildMenu();
    Mainloop.timeout_add(100, () => { 
        if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; 
        return false; 
    });

    if (image_url) {
        Utils.downloadIcon(id, image_url);
    }
}

function checkMissingMetadata() {
    // Prüft bei Start, ob Icons fehlen und lädt sie nach
    let missing = _holdings.filter(h => {
        let iconPath = _applet.metadata.path + "/icons/" + h.id + ".png";
        return !Gio.file_new_for_path(iconPath).query_exists(null);
    });

    if (missing.length > 0) {
        let fetchNext = (index) => {
            if (index >= missing.length) return;
            let coin = missing[index];
            
            if (coin.image) {
                Utils.downloadIcon(coin.id, coin.image);
                Mainloop.timeout_add(1000, () => { fetchNext(index + 1); return false; });
            } else {
                let url = "https://api.coingecko.com/api/v3/coins/" + coin.id + "?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false";
                let apiKey = _applet.settings.getValue("api-key");
                let params = ['curl', '-s', url];
                if (apiKey && apiKey.length > 5) {
                    params = ['curl', '-s', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
                    _applet.keyCalls++;
                    _applet.portfolioCalls = (_applet.portfolioCalls || 0) + 1;
                    _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
                    DataPersistence.saveCallStats();
                }
                Util.spawn_async(params, (stdout) => {
                    try {
                        let data = JSON.parse(stdout);
                        if (data.image && data.image.large) {
                            coin.image = data.image.large;
                            saveHoldings();
                            Utils.downloadIcon(coin.id, coin.image);
                        }
                    } catch (e) {}
                    Mainloop.timeout_add(2000, () => { fetchNext(index + 1); return false; });
                });
            }
        };
        fetchNext(0);
    }
}

function removeCoin(id) {
    _holdings = _holdings.filter(h => h.id !== id);
    saveHoldings();
    _applet.menu.close = () => {};
    _applet._buildMenu();
    Mainloop.timeout_add(100, () => { 
        if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; 
        return false; 
    });
}

function recalculateCoin(coin) {
    let totalAmount = 0;
    let totalInvest = 0;
    if (coin.transactions) {
        coin.transactions.forEach(t => {
            let amt = parseFloat(t.amount) || 0;
            let price = parseFloat(t.buyPrice) || 0;
            totalAmount += amt;
            totalInvest += amt * price;
        });
    }
    coin.amount = totalAmount;
    coin.buyPrice = totalAmount > 0 ? totalInvest / totalAmount : 0;
}

function addTransaction(coinId) {
    let h = _holdings.find(h => h.id === coinId);
    if (h) {
        if (!h.transactions) h.transactions = [];
        let d = new Date();
        let dateStr = d.getDate().toString().padStart(2, '0') + "." + (d.getMonth() + 1).toString().padStart(2, '0') + "." + d.getFullYear();
        h.transactions.push({
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            amount: 0,
            buyPrice: 0,
            date: dateStr,
            originalBuyPrice: 0,
            originalCurrency: _portfolioCurrency
        });
        recalculateCoin(h);
        saveHoldings();
        
        _applet.menu.close = () => {};
        _applet._buildMenu();
        Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
    }
}

function removeTransaction(coinId, txId) {
    let h = _holdings.find(h => h.id === coinId);
    if (h && h.transactions) {
        h.transactions = h.transactions.filter(t => t.id !== txId);
        recalculateCoin(h);
        saveHoldings();
        
        // Update Labels immediately
        updatePortfolioPrices({}, _portfolioCurrency);
        
        _applet.menu.close = () => {};
        _applet._buildMenu();
        Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
    }
}

function updateTransaction(coinId, txId, field, value) {
    let h = _holdings.find(h => h.id === coinId);
    if (h && h.transactions) {
        let tx = h.transactions.find(t => t.id === txId);
        if (tx) {
            if (field === 'date') {
                tx[field] = value;
            } else {
                // Replace comma with dot for correct float conversion
                let cleanVal = value.replace(',', '.');
                tx[field] = parseFloat(cleanVal) || 0;
                
                // If buy price is edited, this is the new "original" price in the current currency
                if (field === 'buyPrice') {
                    tx.originalBuyPrice = tx[field];
                    tx.originalCurrency = _portfolioCurrency;
                }
            }
            recalculateCoin(h);
            saveHoldings();
            updatePortfolioPrices({}, _portfolioCurrency);
        }
    }
}

function togglePrivacy() {
    _privacyMode = !_privacyMode;
    _isSearchOpen = false;
    _applet.menu.close = () => {};
    _applet._buildMenu();
    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
}

function cycleSortMode() {
    if (_sortMode === 'value_desc') _sortMode = 'value_asc';
    else if (_sortMode === 'value_asc') _sortMode = 'name_asc';
    else _sortMode = 'value_desc';
    
    _isSearchOpen = false;
    sortHoldings();
    _applet.menu.close = () => {};
    _applet._buildMenu();
    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
}

function sortHoldings() {
    _holdings.sort((a, b) => {
        let valA = (a.currentValue !== undefined) ? a.currentValue : ((a.currentPrice || 0) * (parseFloat(a.amount) || 0));
        let valB = (b.currentValue !== undefined) ? b.currentValue : ((b.currentPrice || 0) * (parseFloat(b.amount) || 0));
        
        if (_sortMode === 'value_desc') return (valB - valA) || a.symbol.localeCompare(b.symbol);
        if (_sortMode === 'value_asc') return (valA - valB) || a.symbol.localeCompare(b.symbol);
        if (_sortMode === 'name_asc') return a.symbol.localeCompare(b.symbol);
        return 0;
    });
}

function collapseAll() {
    _holdings.forEach(h => {
        h.expanded = false;
    });
}

function createPortfolioSection(maxHeight) {
    // Ensure sorting is applied
    sortHoldings();

    // If main menu is open, close local popups
    if (_applet.isHeaderMenuOpen) {
        _isSearchOpen = false;
        _isCurrencySelectorOpen = false;
        _isFilterVisible = false;
        _portfolioFilterQuery = "";
        collapseAll();
    }

    let section = new PopupMenu.PopupMenuSection();

    // 1. Header & Total Value
    let headerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    headerItem.actor.style = "padding: 0px; margin: 0px;";
    let headerBox = new St.BoxLayout({ vertical: true, style: "padding: 5px 0; width: 100%;", x_expand: true });
    
    // Row 1: Title + Buttons
    let row1 = new St.BoxLayout({ style: "width: 100%; padding: 0 38px;" });
    let leftCol = new St.BoxLayout({ x_align: St.Align.START });
    leftCol.add(new St.Label({ text: _("Total Balance"), style: "font-weight: bold; font-size: 14px; color: " + _applet.colors.text + ";" }));
    row1.add(leftCol, { expand: true });
    
    let rightCol = new St.BoxLayout({});
    
    let createHeaderBtn = (iconName, callback) => {
        let btn = new St.Bin({ reactive: true, style: "padding: 2px 5px; border-radius: 4px; margin-left: 5px;" });
        let icon = new St.Icon({ icon_name: iconName, icon_size: 14 });
        icon.set_style("color: " + _applet.colors.text_more_dim + ";"); btn.set_child(icon);
        
        btn.connect('enter-event', () => { icon.set_style("color: " + _applet.colors.text + ";"); btn.set_style("padding: 2px 5px; border-radius: 4px; margin-left: 5px; background-color: transparent;"); });
        btn.connect('leave-event', () => { icon.set_style("color: " + _applet.colors.text_more_dim + ";"); btn.set_style("padding: 2px 5px; border-radius: 4px; margin-left: 5px; background-color: transparent;"); });
        btn.connect('button-release-event', () => { callback(); return true; });
        return btn;
    };

    let sortIcon = "view-sort-descending-symbolic"; // value_desc
    if (_sortMode === 'value_asc') sortIcon = "view-sort-ascending-symbolic";
    if (_sortMode === 'name_asc') sortIcon = "view-list-symbolic";

    // Currency Button
    let curBtn = new St.Bin({ reactive: true, style: "padding: 2px 5px; border-radius: 4px; margin-left: 5px;" });
    let curLabel = new St.Label({ text: _portfolioCurrency.toUpperCase(), style: "font-size: 11px; font-weight: bold; color: " + _applet.colors.text + ";" });
    curBtn.set_child(curLabel);
    
    curBtn.connect('enter-event', () => { curLabel.set_style("font-size: 11px; font-weight: bold; color: " + _applet.colors.text + ";"); curBtn.set_style("padding: 2px 5px; border-radius: 4px; margin-left: 5px; background-color: " + _applet.hoverColor + ";"); });
    curBtn.connect('leave-event', () => { curLabel.set_style("font-size: 11px; font-weight: bold; color: " + _applet.colors.text + ";"); curBtn.set_style("padding: 2px 5px; border-radius: 4px; margin-left: 5px; background-color: transparent;"); });
    curBtn.connect('button-release-event', () => {
        // Collapse Animation
        if (_isCurrencySelectorOpen && _activeCurrencyActor) {
            Animations.animateCollapse(_activeCurrencyActor, () => {
                _isCurrencySelectorOpen = false;
                _activeCurrencyActor = null;
                _applet._buildMenu();
            });
            return true;
        }

        _isCurrencySelectorOpen = !_isCurrencySelectorOpen;
        if (_isCurrencySelectorOpen) {
            _isSearchOpen = false;
            _isFilterVisible = false;
            _portfolioFilterQuery = "";
            collapseAll();
            _applet.isHeaderMenuOpen = false;
        }
        _applet.menu.close = () => {};
        _applet._buildMenu();
        Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        return true;
    });
    rightCol.add(curBtn);

    rightCol.add(createHeaderBtn(sortIcon, cycleSortMode));
    rightCol.add(createHeaderBtn(_privacyMode ? "view-conceal-symbolic" : "view-reveal-symbolic", togglePrivacy));
    
    // Filter Button (Loupe)
    let filterIcon = "system-search-symbolic";
    let filterBtn = createHeaderBtn(filterIcon, () => {
        // Collapse Animation
        if (_isFilterVisible && _activeFilterActor) {
            Animations.animateCollapse(_activeFilterActor, () => {
                _isFilterVisible = false;
                _activeFilterActor = null;
                _applet.menu.close = () => {};
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
            }, 8);
            return;
        }

        _isFilterVisible = !_isFilterVisible;
        if (_isFilterVisible) {
            _isCurrencySelectorOpen = false;
            _isSearchOpen = false;
            collapseAll();
            _applet.isHeaderMenuOpen = false;
        } else {
            _portfolioFilterQuery = "";
        }
        _applet.menu.close = () => {};
        _applet._buildMenu();
        Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
    });
    // Highlight filter button if active
    if (_isFilterVisible) {
        filterBtn.set_style("padding: 2px 5px; border-radius: 4px; margin-left: 5px; background-color: transparent;");
        let icon = filterBtn.get_child();
        if (icon) icon.set_style("color: " + _applet.colors.text + ";");
    }
    rightCol.add(filterBtn);

    row1.add(rightCol);
    headerBox.add(row1);
    
    // Row 2: Total Value
    _totalValueLabel = new St.Label({ text: _("Loading..."), style: "font-size: 18px; font-weight: bold; color: " + _applet.colors.text_dim + "; margin-top: 2px;" });
    _totalValueLabel.connect('destroy', () => { _totalValueLabel = null; });
    let totalValueContainer = new St.BoxLayout({ style: "padding: 0 40px;" });
    totalValueContainer.add(_totalValueLabel);
    headerBox.add(totalValueContainer);

    // Currency Selector
    if (_isCurrencySelectorOpen) {
        let showDebug = _applet.settings.getValue("dev-show-frames");
        let dOuter = showDebug ? "border: 1px solid rgba(255, 0, 0, 0.8);" : "";
        let dHeader = showDebug ? "border: 1px solid rgba(0, 255, 0, 0.8);" : "";
        let dBtnBox = showDebug ? "border: 1px solid rgba(0, 0, 255, 0.8);" : "";
        let dBtn = showDebug ? "border: 1px solid rgba(255, 255, 0, 0.8);" : "";
        let dLabel = showDebug ? "background-color: rgba(255, 0, 255, 0.3);" : "";

        let curSelBox = new St.BoxLayout({ vertical: true, reactive: true, style: "background-color: " + _applet.colors.bg_popup + "; border-radius: 5px; margin: 5px 10px; padding: 10px 0px 10px 5px;" + dOuter });
        curSelBox.connect('button-press-event', () => true);
        curSelBox.connect('button-release-event', () => true);

        let csHeader = new St.BoxLayout({ style: "margin-bottom: 5px;" + dHeader });
        // FIX: expand: false for label, insert spacer instead
        csHeader.add(new St.Label({ text: _("Select Currency"), style: "font-size: 11px; font-weight: bold; color: " + _applet.colors.text_dim + ";" + dLabel }), { y_align: St.Align.MIDDLE });
        csHeader.add(new St.Widget(), { expand: true }); // Spacer fills the rest up to button width
        
        let closeBtn = new St.Bin({ reactive: true, style: "padding: 1px 4px; border-radius: 4px;" });
        let closeIcon = new St.Icon({ icon_name: "window-close-symbolic", icon_size: 15, style: "color: " + _applet.colors.text_more_dim + ";" });
        closeBtn.set_child(closeIcon);
        
        closeBtn.connect('enter-event', () => { closeIcon.set_style("color: #d9534f;"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });
        closeBtn.connect('leave-event', () => { closeIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });

        closeBtn.connect('button-press-event', () => true);
        closeBtn.connect('button-release-event', () => {
            // Collapse Animation
            if (_activeCurrencyActor) {
                Animations.animateCollapse(_activeCurrencyActor, () => {
                    _isCurrencySelectorOpen = false;
                    _activeCurrencyActor = null;
                    _applet._buildMenu();
                }, 8);
                return true;
            }

            _isCurrencySelectorOpen = false;
            _applet.menu.close = () => {};
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
            return true;
        });
        csHeader.add(closeBtn);
        curSelBox.add(csHeader);

        let curs = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
        let btnBox = new St.BoxLayout({ x_align: St.Align.MIDDLE, style: dBtnBox });
        
        curs.forEach((c, idx) => {
            let isActive = (c.toLowerCase() === _portfolioCurrency);
            let baseStyle = "width: 40px; padding: 4px; margin-right: 5px; border-radius: 4px; text-align: center; ";
            let styleNormal = baseStyle + (isActive ? "background-color: #e67e22; color: #fff; font-weight: bold;" : "background-color: " + _applet.colors.bg_input + "; color: " + _applet.colors.text_dim + ";");
            let styleHover = baseStyle + (isActive ? "background-color: #d35400; color: #fff; font-weight: bold;" : "background-color: " + _applet.colors.divider + "; color: " + _applet.colors.text + ";");

            let b = new St.Button({ label: c, style: styleNormal + dBtn });
            
            b.connect('enter-event', () => { b.set_style(styleHover + dBtn); });
            b.connect('leave-event', () => { b.set_style(styleNormal + dBtn); });

            b.connect('clicked', () => {
                if (c.toLowerCase() !== _portfolioCurrency) {
                    _convertPortfolio(c.toLowerCase());
                }
            });
            
            btnBox.add(b);
        });
        
        curSelBox.add(btnBox);
        // FIX: x_fill: false prevents box from stretching to 450px
        headerBox.add(curSelBox, { x_fill: false, x_align: St.Align.MIDDLE });
        _activeCurrencyActor = curSelBox;
        Animations.animateExpand(curSelBox, null, 8);
    }
    
    headerItem.addActor(headerBox, { expand: true, span: -1 });
    section.addMenuItem(headerItem);
    section.addMenuItem(_applet._createSeparator());
    
    // Filter Entry
    if (_isFilterVisible) {
        let filterItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
        let filterBox = new St.BoxLayout({ style: "padding: 0 15px 5px 15px;" });
        let filterEntry = new St.Entry({ 
            hint_text: _("Filter portfolio..."), 
            style: "width: 100%; padding: 4px 8px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";",
            can_focus: true 
        });
        
        if (_portfolioFilterQuery) filterEntry.set_text(_portfolioFilterQuery);
        
        filterEntry.clutter_text.connect('key-focus-in', () => { filterEntry.set_hint_text(""); });
        filterEntry.clutter_text.connect('key-focus-out', () => { if (filterEntry.get_text() === "") filterEntry.set_hint_text(_("Filter portfolio...")); });
        
        filterBox.add(filterEntry, { expand: true });
        filterItem.addActor(filterBox, { expand: true, span: -1 });
        section.addMenuItem(filterItem);
        _activeFilterActor = filterBox;
        Animations.animateExpand(filterBox, null, 8);
        
        // Auto-Focus
        if (_portfolioFilterQuery) {
            Mainloop.timeout_add(50, () => { if (filterEntry && filterEntry.mapped) filterEntry.grab_key_focus(); return false; });
        }
        
        // Connect later after renderList is defined
        filterEntry.clutter_text.connect('text-changed', () => {
            let newQuery = filterEntry.get_text();
            
            // When search starts (and was empty before), freeze height
            if (_portfolioFilterQuery === "" && newQuery !== "") {
                let h = listSection.actor.height;
                if (h > 0) listSection.actor.set_style("min-height: " + h + "px;");
            }
            
            // When search ends, release height
            if (newQuery === "") {
                listSection.actor.set_style("");
            }

            _portfolioFilterQuery = filterEntry.get_text();
            renderList();
        });
    }

    // 2. List of Coins
    let listSection = new PopupMenu.PopupMenuSection();
    
    // Scrollable Container
    // DEDUCTION: Header (~70px) + Add-Button (~50px) + Buffer = ~130px
    // If filter is open, deduct more
    let listMaxHeight = maxHeight - 130;
    if (_isFilterVisible) listMaxHeight -= 40;
    if (_isCurrencySelectorOpen) listMaxHeight -= 120; // FIX: Reserve space for dropdown
    if (listMaxHeight < 100) listMaxHeight = 100; // Force minimum height

    let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    scrollItem.actor.style = "padding: 0px; margin: 0px; max-height: " + listMaxHeight + "px;";
    
    let scrollView = new St.ScrollView({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        style_class: 'vfade',
        style: "max-height: " + listMaxHeight + "px;",
        reactive: true
    });
    
    let listContainer = new St.BoxLayout({ vertical: true });
    scrollView.add_actor(listContainer);
    let scrollBox = Utils.addScrollArrows(scrollView);
    scrollItem.addActor(scrollBox, { expand: true, span: -1 });
    listSection.addMenuItem(scrollItem);
    section.addMenuItem(listSection);

    let createRow = (h, index) => {
        // Barbed-wire debug style
        let showDebug = _applet.settings.getValue("dev-show-frames");
        let barbDebug = showDebug ? "border: 1px dashed rgba(255, 0, 255, 0.7);" : "";
        let txContainerDebug = showDebug ? "border: 1px solid yellow;" : "";

        let row = new St.BoxLayout({ vertical: true, style: "width: 100%;" });
            
            // FIX: Make summaryBox reactive for hover & click
            let summaryBox = new St.BoxLayout({ vertical: true, style: "padding: 10px 0;", reactive: true });

            summaryBox.connect('enter-event', () => {
                summaryBox.set_style("padding: 10px 0; background-color: " + _applet.hoverColor + "; border-radius: " + _applet.hoverRadius + ";");
            });
            summaryBox.connect('leave-event', () => {
                summaryBox.set_style("padding: 10px 0; background-color: transparent;");
            });

            summaryBox.connect('button-press-event', () => true);
            summaryBox.connect('button-release-event', () => {
                // 1. If THIS item is already open -> Close (Collapse)
                if (h.expanded && h.activeTxActor) {
                    Animations.animateCollapse(h.activeTxActor, () => {
                        h.expanded = false;
                        h.activeTxActor = null;
                        _applet._buildMenu();
                    }, 8); // Slightly slower (~96ms)
                    return true;
                }

                // 2. If ANOTHER item is open -> Close first, then open this
                let currentlyExpanded = _holdings.find(item => item.expanded && item !== h);
                if (currentlyExpanded && currentlyExpanded.activeTxActor) {
                    Animations.animateCollapse(currentlyExpanded.activeTxActor, () => {
                        currentlyExpanded.expanded = false;
                        currentlyExpanded.activeTxActor = null;
                        
                        // Now open the new one
                        openItem();
                    }, 8); // Slightly slower (~96ms)
                    return true;
                }

                // 3. No other item open -> Open directly
                openItem();

                function openItem() {
                    _holdings.forEach(item => item.expanded = false);
                    h.expanded = true;
                    
                    _isSearchOpen = false;
                    _isCurrencySelectorOpen = false;
                    _isFilterVisible = false;
                    _portfolioFilterQuery = "";
                    _applet.isHeaderMenuOpen = false;
                    
                    saveHoldings();
                    _applet.menu.close = () => {};
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                }
                return true;
            });

            let contentBox = new St.BoxLayout({ vertical: true, style: "padding: 0 40px;" });

            // --- Row 1: Stats (Symbol, Alloc, Value, PnL, Expand) ---
            let topRow = new St.BoxLayout({ y_align: St.Align.MIDDLE, style: "width: 100%;" });
            
            // 1. Number
            topRow.add(new St.Label({ text: (index + 1) + ".", style: "font-size: 12px; color: " + _applet.colors.text_more_dim + "; margin-right: 6px; min-width: 15px;" }));

            // 2. Logo
            let iconName = h.symbol.toLowerCase();
            let iconPath = _applet.metadata.path + "/icons/" + iconName + "-symbolic.svg";
            
            // Check for downloaded icon first (id.png)
            let cachedPath = _applet.metadata.path + "/icons/" + h.id + ".png";
            let cachedFile = Gio.file_new_for_path(cachedPath);
            let iconFile = Gio.file_new_for_path(iconPath);
            
            // Container for the circle (Frame & Background)
            let iconBin = new St.Bin({ 
                y_align: St.Align.MIDDLE, 
                style: "width: 28px; height: 28px; min-width: 28px; min-height: 28px; border-radius: 14px; border: 1px solid " + _applet.colors.divider + "; margin-right: 8px;" 
            });

            let iconActor = cachedFile.query_exists(null)
                ? new St.Icon({ gicon: new Gio.FileIcon({ file: cachedFile }), icon_size: 16 })
                : (iconFile.query_exists(null) 
                ? new St.Icon({ gicon: new Gio.FileIcon({ file: iconFile }), icon_size: 16 })
                : new St.Icon({ icon_name: "emblem-money-symbolic", icon_size: 16, style: "opacity: 0.5;" }));
            
            iconActor.set_x_align(Clutter.ActorAlign.CENTER);
            iconActor.set_y_align(Clutter.ActorAlign.CENTER);
            iconBin.set_child(iconActor);
            topRow.add(iconBin);
            
            // 3. Symbol & Amount
            let symBox = new St.BoxLayout({ vertical: true });
            let symLbl = new St.Label({ text: h.symbol, style: "font-weight: bold; font-size: 12px; color: " + _applet.colors.text + ";" });
            symBox.add(symLbl);

            let amtLbl = new St.Label({ text: h.amount.toString(), style: "font-size: 12px; color: " + _applet.colors.text_dim + ";" });
            h.amountLabel = amtLbl;
            amtLbl.connect('destroy', () => { h.amountLabel = null; });
            symBox.add(amtLbl);
            topRow.add(symBox);

            // 4. Allocation
            let allocLbl = new St.Label({ text: "0%", style: "font-size: 12px; color: " + _applet.colors.text_more_dim + "; margin-left: 8px;" });
            h.allocLabel = allocLbl;
            allocLbl.connect('destroy', () => { h.allocLabel = null; });
            topRow.add(allocLbl);

            // Spacer
            topRow.add(new St.Label({ text: "" }), { expand: true });

            // Right Group: Value & PnL
            let statsBox = new St.BoxLayout({ vertical: true, x_align: St.Align.END });
            
            let valLbl = new St.Label({ text: "...", style: "text-align: right; font-weight: bold; font-size: 12px; color: " + _applet.colors.text + ";" });
            h.valueLabel = valLbl;
            valLbl.connect('destroy', () => { h.valueLabel = null; });
            statsBox.add(valLbl);

            let pnlLbl = new St.Label({ text: "...", style: "text-align: right; font-size: 12px;" });
            h.pnlLabel = pnlLbl;
            pnlLbl.connect('destroy', () => { h.pnlLabel = null; });
            statsBox.add(pnlLbl);
            
            topRow.add(statsBox);

            contentBox.add(topRow);
            summaryBox.add(contentBox);
            row.add(summaryBox);

            // --- Row 2: Transactions (Dropdown) ---
            if (h.expanded) {
                let txContainer = new St.BoxLayout({ vertical: true, style: "background-color: " + _applet.colors.bg_popup + "; margin: 0; padding: 10px 0;" + txContainerDebug });
                
                // Header Row
                let headerRow = new St.BoxLayout({ style: "padding: 0 40px 4px 40px;" });
                let hStyle1 = "font-size: 11px; color: " + _applet.colors.text_more_dim + "; min-width: 90px;";
                let hStyle2 = "font-size: 11px; color: " + _applet.colors.text_more_dim + "; min-width: 85px;";
                
                let h1 = new St.Label({ text: _("Amount"), style: hStyle1 });
                let h2 = new St.Label({ text: _("Buy Price"), style: hStyle1 });
                let h3 = new St.Label({ text: _("Date"), style: hStyle2 });

                headerRow.add(new St.Bin({ child: h1, style: barbDebug }));
                headerRow.add(new St.Widget({ width: 5 }));
                headerRow.add(new St.Bin({ child: h2, style: barbDebug }));
                headerRow.add(new St.Widget({ width: 5 }));
                headerRow.add(new St.Bin({ child: h3, style: barbDebug }));

                txContainer.add(headerRow);

                // Transactions List
                h.transactions.forEach((tx, i) => {
                    let rowBox = new St.BoxLayout({ reactive: true, style: "padding: 4px 40px; border-radius: 4px;" });
                    
                    // Hover Effect for the whole row
                    rowBox.connect('enter-event', () => { rowBox.set_style("padding: 4px 40px; border-radius: 4px; background-color: " + _applet.hoverColor + ";"); });
                    rowBox.connect('leave-event', () => { rowBox.set_style("padding: 4px 40px; border-radius: 4px; background-color: transparent;"); });
                    
                    if (tx.editMode) {
                        // Edit Mode: Input fields
                        // Entries must be declared before saveAllAndClose function
                        let amountEntry = new St.Entry({ style: "width: 80px; font-size: 11px; padding: 1px 5px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";", can_focus: true });
                        let priceEntry = new St.Entry({ style: "width: 80px; font-size: 11px; padding: 1px 5px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";", can_focus: true });
                        let dateEntry = new St.Entry({ style: "width: 75px; font-size: 11px; padding: 1px 5px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";", can_focus: true });

                        // Common save function
                        let saveAllAndClose = () => {
                            // Read values immediately
                            let aVal = amountEntry.get_text();
                            let pVal = priceEntry.get_text();
                            let dVal = dateEntry.get_text();

                            tx.editMode = false;
                            updateTransaction(h.id, tx.id, 'amount', aVal);
                            updateTransaction(h.id, tx.id, 'buyPrice', pVal);
                            updateTransaction(h.id, tx.id, 'date', dVal);
                            
                            _applet.menu.close = () => {};
                            _applet._buildMenu();
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                            return true;
                        };

                        amountEntry.set_text(tx.amount.toString());
                        if (_privacyMode) amountEntry.clutter_text.set_password_char('*');
                        
                        amountEntry.clutter_text.connect('key-focus-in', () => { if (amountEntry.get_text() === "0") amountEntry.set_text(""); });
                        amountEntry.clutter_text.connect('activate', saveAllAndClose);
                        
                        let box1 = new St.BoxLayout({ style: "min-width: 90px;" + barbDebug });
                        box1.add(amountEntry, { y_align: St.Align.MIDDLE });
                        rowBox.add(box1);
                        rowBox.add(new St.Widget({ width: 5 }));

                        // FIX: Formatting for edit field (Max 2 decimal places for Fiat values)
                        let editPriceStr = tx.buyPrice.toString();
                        if (Math.abs(tx.buyPrice) >= 1) {
                            // parseFloat removes unnecessary zeros (e.g. "55000.00" -> 55000)
                            // toFixed(2) rounds to 2 places
                            editPriceStr = parseFloat(tx.buyPrice.toFixed(2)).toString();
                        }
                        priceEntry.set_text(editPriceStr);

                        if (_privacyMode) priceEntry.clutter_text.set_password_char('*');

                        priceEntry.clutter_text.connect('key-focus-in', () => { if (priceEntry.get_text() === "0") priceEntry.set_text(""); });
                        priceEntry.clutter_text.connect('activate', saveAllAndClose);
                        
                        let box2 = new St.BoxLayout({ style: "min-width: 90px;" + barbDebug });
                        box2.add(priceEntry, { y_align: St.Align.MIDDLE });
                        rowBox.add(box2);
                        rowBox.add(new St.Widget({ width: 5 }));

                        dateEntry.set_text(tx.date || "");
                        
                        dateEntry.clutter_text.connect('activate', saveAllAndClose);
                        
                        let box3 = new St.BoxLayout({ style: "min-width: 85px;" + barbDebug });
                        box3.add(dateEntry, { y_align: St.Align.MIDDLE });
                        rowBox.add(box3);
                        
                        // Spacer to push buttons to the far right
                        rowBox.add(new St.Widget(), { expand: true });

                        let actionsBox = new St.BoxLayout({ style: "spacing: 5px;" });

                        // Done Button (Checkmark)
                        let doneBtn = new St.Bin({ reactive: true, style: "padding: 2px 4px; border-radius: 4px;" + barbDebug });
                        let doneIcon = new St.Icon({ icon_name: "emblem-ok-symbolic", icon_size: 14, style: "color: #888;" });
                        doneBtn.set_child(doneIcon);
                        
                        doneBtn.connect('enter-event', () => { doneIcon.set_style("color: #449d44;"); doneBtn.set_style("padding: 2px 4px; border-radius: 4px; background-color: transparent;" + barbDebug); });
                        doneBtn.connect('leave-event', () => { doneIcon.set_style("color: #888;"); doneBtn.set_style("padding: 2px 4px; border-radius: 4px; background-color: transparent;" + barbDebug); });
                        doneBtn.connect('button-release-event', (actor, event) => { saveAllAndClose(); return true; });
                        actionsBox.add(doneBtn);

                        rowBox.add(actionsBox);
                    } else {
                        // Read Mode: Text Labels (Clickable for Edit)
                        
                        rowBox.connect('button-release-event', () => {
                            // Close other edit modes
                            h.transactions.forEach(t => t.editMode = false);
                            tx.editMode = true;
                            _applet.menu.close = () => {};
                            _applet._buildMenu();
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                            return true;
                        });

                        // Helper: Shorten numbers to not break layout
                        let formatVal = (v) => {
                            let val = parseFloat(v);
                            if (isNaN(val)) return "0";
                            let s = val.toString();
                            // If longer than 9 characters, shorten to 6 significant digits
                            if (s.length > 9) return parseFloat(val.toPrecision(6)).toString();
                            return s;
                        };

                        let amountStr = _privacyMode ? "****" : formatVal(tx.amount);
                        let priceStr = _privacyMode ? "****" : formatVal(tx.buyPrice);
                        
                        let amountLbl = new St.Label({ text: amountStr, style: "font-size: 11px; color: " + _applet.colors.text_dim + "; width: 90px;" });
                        amountLbl.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END); // Ellipsis on overflow
                        let amountBin = new St.Bin({ style: barbDebug, child: amountLbl, y_align: St.Align.MIDDLE });
                        rowBox.add(amountBin);
                        rowBox.add(new St.Widget({ width: 5 }));

                        let priceLbl = new St.Label({ text: priceStr, style: "font-size: 11px; color: " + _applet.colors.text_dim + "; width: 90px;" });
                        priceLbl.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END); // Ellipsis on overflow
                        let priceBin = new St.Bin({ style: barbDebug, child: priceLbl, y_align: St.Align.MIDDLE });
                        rowBox.add(priceBin);
                        rowBox.add(new St.Widget({ width: 5 }));

                        let dateLbl = new St.Label({ text: tx.date || "-", style: "font-size: 11px; color: " + _applet.colors.text_more_dim + "; min-width: 85px;" });
                        let dateBin = new St.Bin({ style: barbDebug, child: dateLbl, y_align: St.Align.MIDDLE });
                        rowBox.add(dateBin);

                        // Spacer to push button to the far right
                        rowBox.add(new St.Widget(), { expand: true });

                        // Delete Button (Pencil removed)
                        let delTxBtn = new St.Bin({ reactive: true, style: "padding: 2px 4px; border-radius: 4px;" + barbDebug });
                        let delTxIcon = new St.Icon({ icon_name: "edit-delete-symbolic", icon_size: 14, style: "color: " + _applet.colors.text_more_dim + ";" });
                        delTxBtn.set_child(delTxIcon);
                        
                        let resetDelTimer = null;
                        delTxBtn._confirming = false;

                        delTxBtn.connect('enter-event', () => {
                            let iconColor = delTxBtn._confirming ? "#d9534f" : "#d9534f"; // Red on hover
                            delTxIcon.set_style("color: " + iconColor + ";");
                            delTxBtn.set_style("padding: 2px 4px; border-radius: 4px; background-color: transparent;" + barbDebug);
                        });

                        delTxBtn.connect('leave-event', () => {
                            let iconColor = delTxBtn._confirming ? "#d9534f" : "rgba(255, 255, 255, 0.5)"; // Stay red if Confirm active
                            delTxIcon.set_style("color: " + (delTxBtn._confirming ? "#d9534f" : _applet.colors.text_more_dim) + ";");
                            delTxBtn.set_style("padding: 2px 4px; border-radius: 4px; background-color: transparent;" + barbDebug);
                        });

                        delTxBtn.connect('button-release-event', (actor, event) => {
                            if (delTxBtn._confirming) {
                                if (resetDelTimer) {
                                    Mainloop.source_remove(resetDelTimer);
                                    resetDelTimer = null;
                                }
                                removeTransaction(h.id, tx.id);
                            } else {
                                delTxBtn._confirming = true;
                                delTxIcon.set_icon_name("dialog-warning-symbolic"); // Warn Icon (Exclamation/Triangle)
                                delTxIcon.set_style("color: #d9534f;"); // Red

                                resetDelTimer = Mainloop.timeout_add(3000, () => {
                                    if (delTxBtn) { delTxBtn._confirming = false; delTxIcon.set_icon_name("edit-delete-symbolic"); delTxIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); }
                                    resetDelTimer = null; return false;
                                });
                            }
                            return true;
                        });
                        delTxBtn.connect('destroy', () => { if (resetDelTimer) Mainloop.source_remove(resetDelTimer); });
                        rowBox.add(delTxBtn);
                    }
                    txContainer.add(rowBox);
                });
                
                // Actions Row
                let actionRow = new St.BoxLayout({ style: "margin-top: 5px; padding: 0 40px;" + barbDebug });
                
                // Add TX Button
                let addTxBtn = new St.Button({ label: _("+ Transaction"), style: "font-size: 11px; padding: 2px 6px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text_dim + ";" + barbDebug });
                addTxBtn.connect('clicked', () => {
                    addTransaction(h.id);
                });
                actionRow.add(addTxBtn);

                actionRow.add(new St.Label({ text: "" }), { expand: true });

                // Delete Coin Button
                let delCoinBtn = new St.Button({ label: _("Remove Position"), style: "font-size: 11px; padding: 2px 6px; background-color: rgba(217, 83, 79, 0.2); border-radius: 4px; color: #d9534f;" + barbDebug });
                let resetDelTimer = null;
                
                delCoinBtn.connect('clicked', () => {
                    if (delCoinBtn.get_label() === _("Sure?")) {
                        if (resetDelTimer) {
                            Mainloop.source_remove(resetDelTimer);
                            resetDelTimer = null;
                        }
                        removeCoin(h.id);
                    } else {
                        delCoinBtn.set_label(_("Sure?"));
                        delCoinBtn.set_style("font-size: 11px; padding: 2px 6px; background-color: #d9534f; border-radius: 4px; color: #fff; font-weight: bold;");
                        
                        resetDelTimer = Mainloop.timeout_add(3000, () => {
                            if (delCoinBtn) {
                                delCoinBtn.set_label(_("Remove Position"));
                                delCoinBtn.set_style("font-size: 11px; padding: 2px 6px; background-color: rgba(217, 83, 79, 0.2); border-radius: 4px; color: #d9534f;");
                            }
                            resetDelTimer = null;
                            return false;
                        });
                    }
                });
                delCoinBtn.connect('destroy', () => { if (resetDelTimer) Mainloop.source_remove(resetDelTimer); });
                actionRow.add(delCoinBtn);

                txContainer.add(actionRow);
                row.add(txContainer);
                h.activeTxActor = txContainer;
                Animations.animateExpand(txContainer, null, 8); // Slightly slower (~96ms)
            }

        return row;
    };

    let renderList = () => {
        listContainer.destroy_all_children();
        
        let displayHoldings = _holdings;
        if (_portfolioFilterQuery) {
            let q = _portfolioFilterQuery.toLowerCase();
            displayHoldings = _holdings.filter(h => 
                h.symbol.toLowerCase().includes(q) || 
                (h.id && h.id.toLowerCase().includes(q))
            );
        }

        if (displayHoldings.length > 0) {
            displayHoldings.forEach((h, index) => {
                let row = createRow(h, index);
                listContainer.add(row);
            });
        } else {
            let msg = (_holdings.length === 0) ? _("No positions here yet.") : _("No matches.");
            let emptyBox = new St.BoxLayout({ style: "padding: 10px 15px;", y_align: St.Align.MIDDLE });
            let icon = new St.Icon({ icon_name: "dialog-information-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + "; margin-right: 5px;" });
            emptyBox.add(icon);
            emptyBox.add(new St.Label({ text: msg, style: "color: " + _applet.colors.text_more_dim + "; font-size: 11px;" }));
            listContainer.add(emptyBox);
        }
    };

    // Initial render
    renderList();

    section.addMenuItem(_applet._createSeparator());

    // 3. Add Coin Section
    // FIX: Always allow reactivity (except when search is already open) so you can switch directly from filter
    let addItem = new PopupMenu.PopupBaseMenuItem({ reactive: !_isSearchOpen });
    let addBox = new St.BoxLayout({ vertical: true, style: "padding: 10px 15px;" });
    
    if (!_isSearchOpen) {
        addItem.actor.connect('enter-event', () => { addItem.actor.set_style("background-color: " + _applet.hoverColor + "; border-radius: " + _applet.hoverRadius + ";"); });
        addItem.actor.connect('leave-event', () => { addItem.actor.set_style("background-color: transparent;"); });

        let plusBox = new St.BoxLayout({ style: "color: " + _applet.colors.text_dim + ";" });
        let plusIcon = new St.Icon({ icon_name: "list-add-symbolic", icon_size: 16, style: "margin-right: 5px;" });
        plusBox.add(plusIcon);
        plusBox.add(new St.Label({ text: _("Add Coin"), style: "color: " + _applet.colors.text_dim + ";" }));
        addBox.add(plusBox);
        
        addItem.connect('activate', () => {
            _isSearchOpen = true;
            _isCurrencySelectorOpen = false;
            _isFilterVisible = false;
            _portfolioFilterQuery = "";
            collapseAll();
            _applet.isHeaderMenuOpen = false;
            _applet.menu.close = () => {};
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        });
    } else {
        let searchRow = new St.BoxLayout();
        let searchEntry = new St.Entry({
            hint_text: _("Search (e.g. Bitcoin)..."),
            style: "width: 100%; padding: 4px 8px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";",
            can_focus: true
        });
        
        searchEntry.clutter_text.connect('key-focus-in', () => { searchEntry.set_hint_text(""); });
        searchEntry.clutter_text.connect('key-focus-out', () => { if (searchEntry.get_text() === "") searchEntry.set_hint_text(_("Search (e.g. Bitcoin)...")); });

        searchRow.add(searchEntry, { expand: true });
        
        // Close button
        let closeBtn = new St.Bin({ reactive: true, style: "padding: 4px; margin-left: 5px;" });
        let closeIcon = new St.Icon({ icon_name: "window-close-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + ";" });
        closeBtn.set_child(closeIcon);
        
        closeBtn.connect('button-press-event', () => true);
        closeBtn.connect('button-release-event', () => {
            // Collapse Animation
            if (_activeSearchActor) {
                Animations.animateCollapse(_activeSearchActor, () => {
                    _isSearchOpen = false;
                    _activeSearchActor = null;
                    _applet.menu.close = () => {};
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                }, 8);
                return true;
            }

            _isSearchOpen = false;
            _applet.menu.close = () => {};
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
            return true;
        });
        searchRow.add(closeBtn);
        addBox.add(searchRow);

        let scrollView = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            style: "max-height: 250px; margin-top: 5px;",
            reactive: true
        });
        
        let resultsBox = new St.BoxLayout({ vertical: true });
        scrollView.add_actor(resultsBox);
        let scrollBox = Utils.addScrollArrows(scrollView);
        addBox.add(scrollBox);

        searchEntry.clutter_text.connect('text-changed', () => {
            let query = searchEntry.get_text();
            if (query.length < 2) {
                resultsBox.destroy_all_children();
                _currentSearchResults = [];
                return;
            }

            if (_searchTimeout) Mainloop.source_remove(_searchTimeout);
            _searchTimeout = Mainloop.timeout_add(600, () => {
                let url = "https://api.coingecko.com/api/v3/search?query=" + query;
                let apiKey = _applet.settings.getValue("api-key");
                let params = ['curl', '--silent', '--max-time', '5', url];
                if (apiKey && apiKey.length > 5) {
                    params = ['curl', '--silent', '--max-time', '5', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
                    _applet.keyCalls++;
                    _applet.searchCalls = (_applet.searchCalls || 0) + 1;
                    _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
                    DataPersistence.saveCallStats();
                }
                Util.spawn_async(params, (stdout) => {
                    try {
                        let j = JSON.parse(stdout);
                        resultsBox.destroy_all_children();
                        _currentSearchResults = [];
                        if (j.coins && j.coins.length > 0) {
                            let max = 5;
                            _currentSearchResults = j.coins.slice(0, max);
                            _currentSearchResults.forEach(c => {
                                let resBtn = new St.BoxLayout({ reactive: true, style: "padding: 4px; border-radius: 4px;" });
                                let resLbl = new St.Label({ text: c.name + " (" + c.symbol + ")", style: "color: " + _applet.colors.text + ";" });
                                resBtn.add(resLbl);

                                resBtn.connect('enter-event', () => resBtn.set_style("padding: 4px; border-radius: 4px; background-color: " + _applet.hoverColor + ";"));
                                resBtn.connect('leave-event', () => resBtn.set_style("padding: 4px; border-radius: 4px; background-color: transparent;"));
                                
                                resBtn.connect('button-release-event', () => {
                                    addCoin(c.id, c.symbol, c.large || c.thumb);
                                    return true;
                                });
                                resultsBox.add(resBtn);
                            });
                        } else {
                            resultsBox.add(new St.Label({ text: _("No results"), style: "color: " + _applet.colors.text_more_dim + "; font-size: 11px;" }));
                        }
                    } catch (e) {}
                });
                return false;
            });
        });

        searchEntry.clutter_text.connect('activate', () => {
            if (_currentSearchResults.length > 0) {
                let c = _currentSearchResults[0];
                addCoin(c.id, c.symbol, c.large || c.thumb);
            }
            return true;
        });
        _activeSearchActor = addBox;
        Animations.animateExpand(addBox, null, 8);

        // Auto focus
        Mainloop.timeout_add(50, () => {
            if (searchEntry && searchEntry.mapped) {
                searchEntry.grab_key_focus();
            }
            return false;
        });
    }

    addItem.addActor(addBox, { expand: true, span: -1 });
    section.addMenuItem(addItem);

    // Initial Update trigger
    // Short timeout so labels are rendered
    Mainloop.timeout_add(50, () => {
        updatePortfolioPrices({}, _portfolioCurrency);
        return false;
    });

    return section;
}

function closeCurrencySelector() {
    _isCurrencySelectorOpen = false;
}

var Portfolio = {
    init: init,
    createPortfolioSection: createPortfolioSection,
    addPortfolioIds: addPortfolioIds,
    updatePortfolioPrices: updatePortfolioPrices,
    collapseAll: collapseAll,
    getCurrency: getCurrency,
    isSearchOpen: isSearchOpen,
    closeSearch: closeSearch,
    resetFilter: resetFilter,
    closeCurrencySelector: closeCurrencySelector
};
