const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const PopupMenu = imports.ui.popupMenu;
const Utils = imports.utils.Utils;
const Util = imports.misc.util;
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
var _alarms = []; // Cache for alarms
var _alarmChecks = {};
const MAX_ALARMS = 100;
var _isArchiveOpen = false; // Archive window status
var _archiveSortMode = 'date'; // 'date' | 'name'
var _alarmSearchQuery = "";
var _isSearchVisible = false;
var _activeSearchActor = null;

function init(applet) {
    _applet = applet;
    loadAlarms();
    checkMissingIcons();
}

function getFilePath() {
    return _applet.metadata.path + "/alarms.json";
}

function loadAlarms() {
    try {
        let file = Gio.file_new_for_path(getFilePath());
        if (file.query_exists(null)) {
            let [success, contents] = file.load_contents(null);
            if (success) {
                _alarms.forEach(a => {
                    if (a.triggered_at === undefined) a.triggered_at = 0;
                    if (a.trigger_reason === undefined) a.trigger_reason = null;
                });
                _alarms = JSON.parse(contents.toString());

                // FIX: Clean up duplicates on load
                let unique = {};
                let clean = [];
                _alarms.forEach(a => {
                    let key = a.id + "_" + (a.currency || "usd");
                    if (!unique[key]) {
                        unique[key] = true;
                        clean.push(a);
                    }
                });
                if (clean.length !== _alarms.length) {
                    _alarms = clean;
                    saveAlarms();
                }
            }
        }
    } catch (e) {
        global.logError("Crypto-Tracker: Error loading alarms: " + e);
        _alarms = [];
    }
}

function saveAlarms() {
    try {
        let file = Gio.file_new_for_path(getFilePath());
        let raw = JSON.stringify(_alarms, null, 4);
        file.replace_contents(raw, null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        global.logError("Crypto-Tracker: Error saving alarms: " + e);
    }
}

function getAlarms() {
    return _alarms;
}

function getArchivedIds() {
    return _alarms.map(a => a.id);
}

function getArchivedCurrencies() {
    let curs = [];
    _alarms.forEach(a => {
        let c = (a.currency || "usd").toLowerCase();
        if (!curs.includes(c)) curs.push(c);
    });
    return curs;
}

// Adds archived IDs to fetch list (avoids duplicates)
function addArchivedIds(targetList) {
    _alarms.forEach(a => {
        if (!targetList.includes(a.id)) targetList.push(a.id);
    });
}

function isArchiveOpen() {
    return _isArchiveOpen;
}

function setArchiveOpen(isOpen) {
    _isArchiveOpen = isOpen;
}

function markAsTriggered(id, reason = 'price') {
    let alarm = _alarms.find(a => a.id === id);
    if (alarm) {
        alarm.triggered_at = Date.now();
        alarm.trigger_reason = reason;
        saveAlarms();
    }
}

function isTriggered(id) {
    let alarm = _alarms.find(a => a.id === id);
    // Return true only if it was triggered (not 0/null/undefined)
    return !!(alarm && alarm.triggered_at);
}

function toggleArchiveOpen() {
    _isArchiveOpen = !_isArchiveOpen;
    return _isArchiveOpen;
}

function collapseAllAlarms() {
    _alarms.forEach(a => { a.expanded = false; });
}

function resetSearch() {
    _alarmSearchQuery = "";
    _isSearchVisible = false;
}

function getBackgroundAlarmCount() {
    // Counts only alarms that are NOT currently active in a visible metric
    return _alarms.filter(a => {
        for (let i = 1; i <= 3; i++) {
            if (_applet.metrics[i] && _applet.metrics[i].currentId === a.id &&
                (_applet.settings.getValue("metric" + i + "-enabled") || i === 1)) {
                return false;
            }
        }
        return true;
    }).length;
}

// Saves current metric settings to archive (called before coin switch)
function syncCurrentToArchive(idx, overrideCurrency) {
    let m = _applet.metrics[idx];
    if (!m || !m.currentId || m.currentId === "custom") return;

    let price = parseFloat(_applet.settings.getValue("metric" + idx + "-alert-price")) || 0;
    let vol = parseFloat(_applet.settings.getValue("metric" + idx + "-alert-percent")) || 0;
    let sym = _applet.settings.getValue("metric" + idx + "-symbol") || m.currentId;
    let currentPrice = m.current_price_val || 0;
    let cur = (overrideCurrency || _applet.settings.getValue("metric" + idx + "-currency") || "usd").toLowerCase();

    // Only save if alarms are active, otherwise delete entry
    if (price > 0 || vol > 0) {
        upsertAlarm(m.currentId, sym, price, vol, currentPrice, cur);
    } else {
        deleteAlarm(m.currentId, cur);
    }
}

// Loads values from archive to settings (called after coin switch)
function restoreSettingsFor(idx, coinId, overrideCurrency) {
    let pKey = "metric" + idx + "-alert-price";
    let vKey = "metric" + idx + "-alert-percent";
    
    let currentMetricCur = (overrideCurrency || _applet.settings.getValue("metric" + idx + "-currency") || "usd").toLowerCase();
    let entry = _alarms.find(a => a.id === coinId && (a.currency || "usd") === currentMetricCur);

    // Only restore if currency matches (or entry is old -> fallback USD)
    if (entry && (entry.currency || "usd") === currentMetricCur) {
        _applet.settings.setValue(pKey, entry.price.toString());
        _applet.settings.setValue(vKey, entry.vol.toString());

        // FIX: Set internal values to 0 so the bell does NOT wiggle.
        // Wiggling only happens if last_alert_price == entry.price.
        if (_applet.metrics[idx]) {
            _applet.metrics[idx].last_alert_price = 0;
            _applet.metrics[idx].last_alert_percent = 0;
        }
    } else {
        // No saved alarms -> Reset to 0
        _applet.settings.setValue(pKey, "0");
        _applet.settings.setValue(vKey, "0");
        if (_applet.metrics[idx]) {
            _applet.metrics[idx].last_alert_price = 0;
            _applet.metrics[idx].last_alert_percent = 0;
        }
    }
}

function upsertAlarm(id, symbol, price, vol, currentPrice, currency) {
    // FIX: Prevent/clean up duplicates
    let duplicates = _alarms.filter(a => a.id === id && (a.currency || "usd") === currency);
    if (duplicates.length > 1) {
        _alarms = _alarms.filter(a => !(a.id === id && (a.currency || "usd") === currency));
        // Keep oldest entry (due to creation date)
        duplicates.sort((a, b) => a.created - b.created);
        _alarms.push(duplicates[0]);
    }

    let idx = _alarms.findIndex(a => a.id === id && (a.currency || "usd") === currency);

    // Determine direction (for one-shot logic)
    let condition = null;
    if (price > 0 && currentPrice > 0) {
        condition = (price > currentPrice) ? 'above' : 'below';
    }

    if (idx >= 0) {
        // Update existing alarm
        if (_alarms[idx].price !== price) {
            _alarms[idx].triggered_at = 0;
            _alarms[idx].condition = null;
            _alarms[idx].trigger_reason = null;
        }
        _alarms[idx].price = price;
        _alarms[idx].vol = vol;
        _alarms[idx].symbol = symbol;
        _alarms[idx].currency = currency;
        if (condition) _alarms[idx].condition = condition;
    } else {
        // New alarm - check limit
        if (_alarms.length >= MAX_ALARMS) {
            _alarms.sort((a, b) => a.created - b.created); // Oldest first
            let removed = _alarms.shift();
            Utils.sendNotification(_("Alarm Archive Full"), _("Oldest alarm for ") + removed.symbol + _(" was deleted."), "dialog-warning");
        }
        _alarms.push({
            id: id,
            symbol: symbol,
            price: price,
            vol: vol,
            currency: currency,
            condition: condition,
            triggered_at: 0,
            trigger_reason: null,
            created: Date.now(),
            lastVolTime: 0
        });
    }
    saveAlarms();
}

function deleteAlarm(id, currency) {
    let initLen = _alarms.length;
    _alarms = _alarms.filter(a => !(a.id === id && (a.currency || "usd") === currency));
    if (_alarms.length !== initLen) saveAlarms();

    // FIX: Also delete from active metrics so it's gone immediately and doesn't return
    for (let i = 1; i <= 3; i++) {
        if (_applet.metrics[i] && _applet.metrics[i].currentId === id && (_applet.settings.getValue("metric" + i + "-currency") || "usd").toLowerCase() === currency) {
            _applet.settings.setValue("metric" + i + "-alert-price", "0");
            _applet.settings.setValue("metric" + i + "-alert-percent", "0");
            _applet.metrics[i].last_alert_price = 0;
            _applet.metrics[i].last_alert_percent = 0;

            // Visual update for bell (Gray)
            if (_applet.metrics[i].bellIcon) {
                _applet.metrics[i].bellIcon.set_style("color: " + _applet.colors.text_more_dim + ";");
            }
        }
    }
}

// Background check for all archived alarms
function checkArchivedAlarms(apiData, globalCurrency) {
    let changed = false;

    _alarms.forEach(a => {
        // Skip if coin is currently active in a visible metric (checked there)
        // BUT: Only skip if currency also matches!
        let isVisibleAndCovered = false;
        for (let i = 1; i <= 3; i++) {
            if (_applet.metrics[i] && _applet.metrics[i].currentId === a.id &&
                (_applet.settings.getValue("metric" + i + "-enabled") || i === 1)) {
                
                let activeCur = (_applet.settings.getValue("metric" + i + "-currency") || "usd").toLowerCase();
                let alarmCur = (a.currency || "usd").toLowerCase();
                
                if (activeCur === alarmCur) {
                    isVisibleAndCovered = true;
                    break;
                }
            }
        }
        if (isVisibleAndCovered) return;

        // Use alarm currency (fallback to globalCurrency for old entries)
        let checkCur = a.currency || globalCurrency;

        if (!apiData[a.id]) return;
        let currentPrice = apiData[a.id][checkCur];
        let change24h = apiData[a.id][checkCur + "_24h_change"];

        if (!currentPrice) return;

        // Cache price for menu display
        a.currentPrice = currentPrice;

        // 1. Price Alarm (One-Shot Logic)
        if (a.price > 0 && !a.triggered_at) {
            let triggered = false;
            if (a.condition === 'above' && currentPrice >= a.price) triggered = true;
            else if (a.condition === 'below' && currentPrice <= a.price) triggered = true;
            else if (!a.condition && currentPrice === a.price) triggered = true; // Fallback

            if (triggered) {
                Utils.sendNotification(_("Background Alarm: ") + a.symbol, _("Target price ") + a.price + _(" reached! Current: ") + currentPrice, "complete.oga", "emblem-money-symbolic");
                a.triggered_at = Date.now();
                a.trigger_reason = 'price';
                changed = true;
            }
        }

        // 2. Volatility Alarm (Recurring, max 1x per hour)
        if (a.vol > 0) {
            if (Math.abs(change24h) >= a.vol) {
                let now = Date.now();
                if (!a.lastVolTime || (now - a.lastVolTime > 3600000)) {
                    let dir = change24h >= 0 ? _("risen") : _("fallen");
                    Utils.sendNotification(_("Volatility Alarm: ") + a.symbol, a.symbol + _(" has ") + dir + _(" by ") + change24h.toFixed(2) + "%", "just-saying.oga", "dialog-warning");
                    a.lastVolTime = now;
                    a.triggered_at = now;
                    a.trigger_reason = 'vol';
                    changed = true;
                }
            }
        }
    });

    // Cleanup: Delete alarms that have neither price nor volatility
    let alarmsToKeep = _alarms.filter(a => a.price > 0 || a.vol > 0);
    if (alarmsToKeep.length !== _alarms.length) {
        _alarms = alarmsToKeep;
        changed = true;
    }

    if (changed) saveAlarms();
}

function checkMetricsForAlarms() {
    // Checks all metrics and syncs active alarms to archive
    // This ensures alarms set before archive feature,
    // or created via settings imports, appear in archive.
    for (let i = 1; i <= 3; i++) {
        if (_applet.metrics[i]) {
            syncCurrentToArchive(i);
        }
    }
}

function setupAlarmChecks() {
    // Monitors changes to alarm values and resets them on invalid input
    for (let i = 1; i <= 3; i++) {
        const mIdx = i;
        const priceKey = "metric" + mIdx + "-alert-price";
        const percentKey = "metric" + mIdx + "-alert-percent";

        let setupCheck = (key) => {
            _applet.settings.bind(key, key, () => {
                if (_alarmChecks[key]) Mainloop.source_remove(_alarmChecks[key]);

                _alarmChecks[key] = Mainloop.timeout_add(1500, () => {
                    // Automatic save to archive
                    if (_applet._isSwitchingCoin) return false;

                    // FIX: Prevent crash - No rebuild if search is active
                    if (_applet.searchingMetricIndex !== null) return false;

                    let val = _applet.settings.getValue(key);

                    // Validation
                    if (val === "" || val === null || isNaN(parseFloat(val))) {
                        _applet.settings.setValue(key, "0");
                    }

                    // Save (Upsert or Delete)
                    syncCurrentToArchive(mIdx);

                    // Rebuild menu to update "Active Alarms" list
                    if (_applet.menu.isOpen) _applet._buildMenu();

                    _alarmChecks[key] = null;
                    return false;
                });
            });
        };
        setupCheck(priceKey);
        setupCheck(percentKey);
    }

    // FIX: Initial sync at start to fetch forgotten alarms to archive
    checkMetricsForAlarms();
}

function checkMissingIcons() {
    let missing = _alarms.filter(a => {
        let iconPath = _applet.metadata.path + "/icons/" + a.id + ".png";
        return !Gio.file_new_for_path(iconPath).query_exists(null);
    });

    if (missing.length > 0) {
        let fetchNext = (index) => {
            if (index >= missing.length) return;
            let alarm = missing[index];

            let url = "https://api.coingecko.com/api/v3/coins/" + alarm.id + "?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false";
            let apiKey = _applet.settings.getValue("api-key");
            let params = ['curl', '-s', url];
            if (apiKey && apiKey.length > 5) {
                params = ['curl', '-s', '-H', 'x-cg-demo-api-key: ' + apiKey, url];
                _applet.keyCalls++;
                _applet.alarmCalls = (_applet.alarmCalls || 0) + 1;
                _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
                DataPersistence.saveCallStats();
            }
            Util.spawn_async(params, (stdout) => {
                try {
                    let data = JSON.parse(stdout);
                    if (data.image && (data.image.large || data.image.thumb)) {
                        Utils.downloadIcon(alarm.id, data.image.large || data.image.thumb);
                    }
                } catch (e) { }
                Mainloop.timeout_add(2000, () => { fetchNext(index + 1); return false; });
            });
        };
        fetchNext(0);
    }
}

function updateActiveSettings(coinId, currency) {
    for (let i = 1; i <= 3; i++) {
        if (_applet.metrics[i] && _applet.metrics[i].currentId === coinId) {
            restoreSettingsFor(i, coinId);
        }
    }
}

function createAlarmMenu(i, cur) {
    let showDebug = _applet.settings.getValue("dev-show-frames");
    let dOuter = showDebug ? "border: 1px solid rgba(255, 50, 50, 0.6);" : ""; // Red
    let dHeader = showDebug ? "border: 1px solid rgba(50, 255, 50, 0.6);" : ""; // Green
    let dRow = showDebug ? "border: 1px solid rgba(50, 100, 255, 0.6);" : ""; // Blue
    let dFooter = showDebug ? "border: 1px solid rgba(255, 255, 0, 0.6);" : ""; // Yellow

    let alarmBox = new St.BoxLayout({ vertical: true, reactive: true, style: "background-color: " + _applet.colors.bg_popup + "; border-radius: 5px; margin: 5px 15px; padding: 10px;" + dOuter });

    // Prevents clicks in alarm area from opening details dropdown
    alarmBox.connect('button-press-event', () => { return true; });
    alarmBox.connect('button-release-event', () => { return true; });

    let headerBox = new St.BoxLayout({ style: "margin-bottom: 5px;" + dHeader });
    headerBox.add(new St.Label({ text: _("Alarm Settings"), style: "font-size: 11px; font-weight: bold; color: " + _applet.colors.text_dim + "; margin-left: 4px;" }), { expand: true, y_align: St.Align.MIDDLE });

    let closeBtn = new St.Bin({ reactive: true, style: "padding: 1px 4px; border-radius: 4px;" });
    let closeIcon = new St.Icon({ icon_name: "window-close-symbolic", icon_size: 15, style: "color: " + _applet.colors.text_more_dim + ";" });
    closeBtn.set_child(closeIcon);

    closeBtn.connect('enter-event', () => { closeIcon.set_style("color: #d9534f;"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });
    closeBtn.connect('leave-event', () => { closeIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); closeBtn.set_style("padding: 1px 4px; border-radius: 4px; background-color: transparent;"); });

    closeBtn.connect('button-press-event', () => { return true; });
    closeBtn.connect('button-release-event', () => {
        // Collapse Animation
        _applet.menu.close = () => { };
        if (_applet.activeAlarmActor) {
            Animations.animateCollapse(_applet.activeAlarmActor, () => {
                _applet.alarmOpenIndex = null;
                _applet.activeAlarmActor = null;
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
            }, 8);
        } else {
            _applet.alarmOpenIndex = null;
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        }
        return true;
    });

    headerBox.add(closeBtn);
    alarmBox.add(headerBox);

    let createInput = (label, settingKey) => {
        let row = new St.BoxLayout({ style: "padding: 4px 0;" + dRow, y_align: St.Align.MIDDLE });
        let lbl = new St.Label({ text: label, style: "min-width: 110px; font-size: 13px; color: " + _applet.colors.text_dim + "; margin-left: 4px;", y_align: St.Align.MIDDLE });
        let entry = new St.Entry({ style: "width: 140px; font-size: 13px; background-color: " + _applet.colors.bg_input + "; color: " + _applet.colors.text + "; border-radius: 4px; padding: 2px 5px;", can_focus: true });

        let currentVal = _applet.settings.getValue(settingKey);
        entry.set_text(currentVal.toString());

        entry.clutter_text.connect('key-focus-in', () => {
            if (entry.get_text() === "0") entry.set_text("");
        });

        // FIX: Save while typing (with delay) so it lands in archive immediately
        let debounceId = null;
        entry.clutter_text.connect('text-changed', () => {
            if (debounceId) {
                Mainloop.source_remove(debounceId);
                debounceId = null;
            }
            debounceId = Mainloop.timeout_add(800, () => {
                let val = entry.get_text();
                // Only save if valid
                if (val.match(/^[0-9.]+$/) || val === "0" || val === "") {
                    let saveVal = (val === "") ? "0" : val;
                    _applet.settings.setValue(settingKey, saveVal);
                    syncCurrentToArchive(i);

                    // Update bell live
                    if (_applet.metrics[i] && _applet.metrics[i].bellIcon) {
                        let p = parseFloat(_applet.settings.getValue("metric" + i + "-alert-price")) || 0;
                        let pct = parseFloat(_applet.settings.getValue("metric" + i + "-alert-percent")) || 0;
                        let active = (p > 0 || pct > 0);
                        _applet.metrics[i].bellIcon.set_style(active ? "color: #e67e22;" : "color: " + _applet.colors.text_more_dim + ";");
                    }
                }
                debounceId = null;
                return false;
            });
        });

        entry.connect('destroy', () => {
            if (debounceId) {
                Mainloop.source_remove(debounceId);
                debounceId = null;
            }
        });

        entry.clutter_text.connect('activate', () => {
            let val = entry.get_text();
            if (val === "") val = "0";
            if (val.match(/^[0-9.]+$/) || val === "0") {
                _applet.settings.setValue(settingKey, val);
                // Force immediate save
                syncCurrentToArchive(i);

                // FIX: Update bell immediately (Orange if active)
                if (_applet.metrics[i] && _applet.metrics[i].bellIcon) {
                    let p = parseFloat(_applet.settings.getValue("metric" + i + "-alert-price")) || 0;
                    let pct = parseFloat(_applet.settings.getValue("metric" + i + "-alert-percent")) || 0;
                    let active = (p > 0 || pct > 0);
                    _applet.metrics[i].bellIcon.set_style(active ? "color: #e67e22;" : "color: " + _applet.colors.text_more_dim + ";");
                }

                _applet.updateVisuals();
                let icon = new St.Icon({ icon_name: "emblem-ok-symbolic", icon_size: 12, style: "color: #449d44;" });
                entry.set_secondary_icon(icon);
            }
        });

        row.add(lbl); row.add(entry);
        return row;
    };

    alarmBox.add(createInput(_("Target Price (") + cur + "):", "metric" + i + "-alert-price"));
    alarmBox.add(createInput(_("Change (%):"), "metric" + i + "-alert-percent"));

    let footerBox = new St.BoxLayout({ style: "margin-top: 6px;" + dFooter, y_align: St.Align.MIDDLE });
    footerBox.add(new St.Label({ text: _("Press ENTER to save."), style: "font-size: 10px; color: " + _applet.colors.text_more_dim + "; margin-left: 4px;", y_align: St.Align.MIDDLE }));
    footerBox.add(new St.Label({ text: "" }), { expand: true });

    let clearBin = new St.BoxLayout({ reactive: true, style: "padding: 1px 4px; border-radius: 4px; margin-left: 8px;", y_align: St.Align.MIDDLE });
    let clearIcon = new St.Icon({ icon_name: "notifications-disabled-symbolic", icon_size: 15, style: "color: " + _applet.colors.text_more_dim + ";" });
    clearBin.add_actor(clearIcon);

    clearBin.connect('enter-event', () => { clearIcon.set_style("color: #d9534f;"); clearBin.set_style("padding: 1px 4px; border-radius: 4px; margin-left: 8px; background-color: transparent;"); });
    clearBin.connect('leave-event', () => { clearIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); clearBin.set_style("padding: 1px 4px; border-radius: 4px; margin-left: 8px; background-color: transparent;"); });
    clearBin.connect('button-press-event', () => { return true; });
    clearBin.connect('button-release-event', () => {
        _applet.menu.close = () => { };
        _applet.settings.setValue("metric" + i + "-alert-price", "0");
        _applet.settings.setValue("metric" + i + "-alert-percent", "0");
        _applet.metrics[i].last_alert_price = 0;
        _applet.metrics[i].last_alert_percent = 0;

        // Update archive (Delete)
        syncCurrentToArchive(i);
        
        // FIX: Set bell to inactive (theme color) immediately
        if (_applet.metrics[i] && _applet.metrics[i].bellIcon) {
            _applet.metrics[i].bellIcon.set_style("color: " + _applet.colors.text_more_dim + ";");
        }
        
        _applet.updateVisuals();
        _applet._buildMenu();
        Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        return true;
    });
    footerBox.add(clearBin);
    alarmBox.add(footerBox);
    return alarmBox;
}

// Creates section for main menu
function createArchiveSection(isViewSwitching, maxHeight) {
    let showDebug = _applet.settings.getValue("dev-show-frames");
    let dStats = showDebug ? "border: 1px solid rgba(255, 50, 50, 0.6);" : ""; // Red
    let dToolbar = showDebug ? "border: 1px solid rgba(50, 255, 50, 0.6);" : ""; // Green
    let dSearch = showDebug ? "border: 1px solid rgba(50, 100, 255, 0.6);" : ""; // Blue
    let dList = showDebug ? "border: 1px solid rgba(255, 255, 0, 0.6);" : ""; // Yellow
    let dItem = showDebug ? "border: 1px solid rgba(255, 0, 255, 0.6);" : ""; // Magenta
    let dEdit = showDebug ? "border: 1px solid rgba(0, 255, 255, 0.6);" : ""; // Cyan

    let section = new PopupMenu.PopupMenuSection();

    // Add toolbar (Sort & Delete)
    let toolbarItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    toolbarItem.actor.style = "padding: 0px; margin: 0px;";
    toolbarItem.activate = () => { };
    let toolbarActor = createArchiveToolbar();
    if (showDebug) toolbarActor.set_style((toolbarActor.get_style() || "") + dToolbar);
    toolbarItem.addActor(toolbarActor, { expand: true, span: -1 });
    section.addMenuItem(toolbarItem);

    // Separator instead of statistics
    section.addMenuItem(_applet._createSeparator());

    // Add search field
    if (_isSearchVisible) {
        let searchItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
        searchItem.actor.style = "padding: 0px; margin: 0px;";
        searchItem.activate = () => { };
        let searchBox = new St.BoxLayout({ style: "padding: 0 37px 5px 37px;" + dSearch });
        let searchEntry = new St.Entry({
            hint_text: _("Search alarms..."),
        style: "width: 100%; padding: 4px 8px; background-color: " + _applet.colors.bg_input + "; border-radius: 4px; color: " + _applet.colors.text + ";",
            can_focus: true
        });

        searchEntry.clutter_text.connect('key-focus-in', () => {
            searchEntry.set_hint_text("");
        });
        searchEntry.clutter_text.connect('key-focus-out', () => {
            if (searchEntry.get_text() === "") searchEntry.set_hint_text(_("Search alarms..."));
        });

        if (_alarmSearchQuery) searchEntry.set_text(_alarmSearchQuery);

        searchBox.add(searchEntry, { expand: true });
        searchItem.addActor(searchBox, { expand: true, span: -1 });
        section.addMenuItem(searchItem);
        _activeSearchActor = searchBox;
        Animations.animateExpand(searchBox);

        searchEntry.clutter_text.connect('text-changed', () => {
            let newQuery = searchEntry.get_text();
            
            // Freeze height when starting search
            if (_alarmSearchQuery === "" && newQuery !== "") {
                // Fix ScrollView height if needed, but handled here by max-height
            }
            
            // Release height when clearing
            if (newQuery === "") {
                // Reset styles if needed
            }

            _alarmSearchQuery = searchEntry.get_text();
            renderList();
        });

        // Auto-focus if search active (after rebuild)
        if (_alarmSearchQuery) {
            Mainloop.timeout_add(50, () => { if (searchEntry && searchEntry.mapped) searchEntry.grab_key_focus(); return false; });
        }
    }

    // Container for list
    let listContainerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    listContainerItem.actor.set_style("padding: 0px; margin: 0px;");
    
    // DEDUCTION: Toolbar (~50px) + Buffer = ~60px
    // If search is open, deduct more
    let listMaxHeight = maxHeight - 60;
    if (_isSearchVisible) listMaxHeight -= 40;

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
    listContainerItem.addActor(scrollBox, { expand: true, span: -1 });
    section.addMenuItem(listContainerItem);

    let renderList = () => {
        listContainer.destroy_all_children();

        let allAlarms = [..._alarms];

        // Filter
        if (_alarmSearchQuery) {
            let q = _alarmSearchQuery.toLowerCase();
            allAlarms = allAlarms.filter(a => a.symbol.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
        }

        // Sort (Triggered first)
        allAlarms.sort((a, b) => {
            let isA = a.triggered_at > 0;
            let isB = b.triggered_at > 0;

            if (isA && !isB) return -1;
            if (!isA && isB) return 1;

            if (_archiveSortMode === 'name') {
                return a.symbol.localeCompare(b.symbol);
            } else {
                return b.created - a.created;
            }
        });

        if (allAlarms.length === 0) {
            let emptyBox = new St.BoxLayout({ style: "padding: 10px 15px;" + dList, y_align: St.Align.MIDDLE });
            let icon = new St.Icon({ icon_name: "dialog-information-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + "; margin-right: 5px;" });
            emptyBox.add(icon);
            let emptyLbl = new St.Label({ text: _alarmSearchQuery ? _("No matches.") : _("No alarms here yet."), style: "color: " + _applet.colors.text_more_dim + "; font-size: 11px;" });
            emptyBox.add(emptyLbl);
            listContainer.add(emptyBox);
        } else {
            allAlarms.forEach(a => {
                // No PopupBaseMenuItem needed anymore as we are in ScrollView

                // Check if alarm is currently active (visible)
                let activeMetrics = [];
                let activePrice = 0;
                for (let i = 1; i <= 3; i++) {
                    if (_applet.metrics[i] && _applet.metrics[i].currentId === a.id &&
                        (_applet.settings.getValue("metric" + i + "-enabled") || i === 1)) {
                        
                        let currentMetricCur = (_applet.settings.getValue("metric" + i + "-currency") || "usd").toLowerCase();
                        let alarmCur = (a.currency || "usd").toLowerCase();
                        if (currentMetricCur === alarmCur) {
                            activeMetrics.push(i);
                            if (_applet.metrics[i].current_price_val) activePrice = _applet.metrics[i].current_price_val;
                        }
                    }
                }
                let isActive = activeMetrics.length > 0;
                let isTriggered = a.triggered_at > 0;

                // Row styling
                let wrapper = new St.BoxLayout({ vertical: true, style: dList });
                // FIX: Always make rowBox reactive for click-expand
            let baseStyle = "padding: 10px 37px; width: 100%;";
                let rowBox = new St.BoxLayout({ vertical: false, style: baseStyle + dItem, y_align: St.Align.MIDDLE, reactive: true });

                rowBox.connect('enter-event', () => {
                    rowBox.set_style(baseStyle + "background-color: " + _applet.hoverColor + "; border-radius: " + _applet.hoverRadius + ";" + dItem);
                });
                rowBox.connect('leave-event', () => {
                    rowBox.set_style(baseStyle + "background-color: transparent;" + dItem);
                });

                rowBox.connect('button-release-event', () => {
                    // Keep menu open
                    _applet.menu.close = () => { };

                    if (a.triggered_at > 0) {
                        a.triggered_at = 0;
                        saveAlarms();
                    }

                    // 1. If THIS item is already open -> Close
                    if (a.expanded && a.activeEditActor) {
                        Animations.animateCollapse(a.activeEditActor, () => {
                            a.expanded = false;
                            a.activeEditActor = null;
                            _applet._buildMenu();
                        }, 8); // Slightly slower (~96ms)
                        return true;
                    }

                    // 2. If ANOTHER item is open -> Close first, then open this
                    let currentlyExpanded = _alarms.find(item => item.expanded && item !== a);
                    if (currentlyExpanded && currentlyExpanded.activeEditActor) {
                        Animations.animateCollapse(currentlyExpanded.activeEditActor, () => {
                            currentlyExpanded.expanded = false;
                            currentlyExpanded.activeEditActor = null;
                            Mainloop.timeout_add(120, () => {
                                openItem();
                                return false;
                            });
                        }, 8); // Slightly slower (~96ms)
                        return true;
                    }

                    // 3. Open directly
                    openItem();

                    function openItem() {
                        _alarms.forEach(item => item.expanded = false);
                        a.expanded = true;
                        _applet.isHeaderMenuOpen = false;
                        _applet._buildMenu();
                        Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                    }
                    return true;
                });

                // Logo with Frame
                let iconName = a.symbol.toLowerCase();
                let iconPath = _applet.metadata.path + "/icons/" + iconName + "-symbolic.svg";
                let cachedPath = _applet.metadata.path + "/icons/" + a.id + ".png";
                let cachedFile = Gio.file_new_for_path(cachedPath);
                let iconFile = Gio.file_new_for_path(iconPath);

                let iconBin = new St.Bin({
                    y_align: St.Align.MIDDLE,
                    style: "width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 20px; border: 1px solid " + _applet.colors.divider + "; margin-right: 12px;"
                });

                let iconActor = cachedFile.query_exists(null)
                    ? new St.Icon({ gicon: new Gio.FileIcon({ file: cachedFile }), icon_size: 24 })
                    : (iconFile.query_exists(null) ? new St.Icon({ gicon: new Gio.FileIcon({ file: iconFile }), icon_size: 24 }) : new St.Icon({ icon_name: "emblem-money-symbolic", icon_size: 24, style: "opacity: 0.5;" }));

                iconActor.set_x_align(Clutter.ActorAlign.CENTER);
                iconActor.set_y_align(Clutter.ActorAlign.CENTER);
                iconBin.set_child(iconActor);
                rowBox.add(iconBin);

                // Info
                let infoBox = new St.BoxLayout({ vertical: true });
                let symStyle = "font-size: 13px; color: " + _applet.colors.text + ";";
                if (isTriggered) symStyle = "font-size: 13px; color: #e67e22;";
                let curStr = (a.currency || "usd").toUpperCase();
                let symLbl = new St.Label({ style: symStyle });
                symLbl.clutter_text.set_markup("<b>" + a.symbol + "</b> " + curStr);

                let detailsText = "";
                let pStyle = (isTriggered && a.trigger_reason === 'price') ? "color='#e67e22' weight='bold'" : "color='#aaa'";
                let vStyle = (isTriggered && a.trigger_reason === 'vol') ? "color='#e67e22' weight='bold'" : "color='#aaa'";

                if (a.price > 0) detailsText += `<span ${pStyle}>` + _("Target:") + ` ${a.price}</span>`;
                if (a.vol > 0) detailsText += (detailsText ? " | " : "") + `<span ${vStyle}>` + _("Vol:") + ` ${a.vol}%</span>`;

                let displayPrice = isActive ? activePrice : a.currentPrice;
                if (displayPrice) detailsText += "\n" + _("Current: ") + displayPrice;

                // Add date
                let d = new Date(a.created);
                let dateStr = d.getDate().toString().padStart(2, '0') + "." + (d.getMonth() + 1).toString().padStart(2, '0') + "." + d.getFullYear();
                detailsText += "\n" + _("Created: ") + dateStr;

                let detailsLbl = new St.Label({ style: "font-size: 11px; color: " + _applet.colors.text_dim + ";" });
                detailsLbl.clutter_text.set_use_markup(true);
                detailsLbl.clutter_text.set_markup(detailsText);

                infoBox.add(symLbl);
                infoBox.add(detailsLbl);
                rowBox.add(infoBox, { expand: true });

                // Buttons Container
                let btnBox = new St.BoxLayout({ y_align: St.Align.MIDDLE });

                if (activeMetrics.length > 0) {
                    // FIX: Show positions (1, 2, 3) instead of eye
                    activeMetrics.forEach(num => {
                        let numBin = new St.Bin({ reactive: true, style: "margin: 0 2px;" });
                        let baseStyle = "min-width: 20px; font-size: 11px; font-weight: bold; border-radius: 3px; padding: 2px 0px; text-align: center; ";
                        let normalStyle = baseStyle + "color: " + _applet.colors.text_more_dim + "; border: 1px solid " + _applet.colors.text_more_dim + ";";
                        let hoverStyle = baseStyle + "color: #e67e22; border: 1px solid #e67e22;";

                        let numLbl = new St.Label({
                            text: num.toString(),
                            style: normalStyle,
                            y_align: St.Align.MIDDLE
                        });
                        numBin.set_child(numLbl);
                        
                        numBin.connect('enter-event', () => { numLbl.set_style(hoverStyle); });
                        numBin.connect('leave-event', () => { numLbl.set_style(normalStyle); });
                        
                        // Intercept clicks (display only)
                        numBin.connect('button-press-event', () => true);
                        numBin.connect('button-release-event', () => true);

                        btnBox.add(numBin);
                    });
                } else {
                    // Button: Load into chart (Arrow/Jump) - Only if NOT active
                    let loadContainer = new St.BoxLayout({ style: "margin-right: 5px;" });

                    let createLoadBtn = () => {
                        let btn = new St.Bin({ reactive: true, style: "padding: 4px;" });
                        let icon = new St.Icon({ icon_name: "go-jump-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + ";" });
                        btn.set_child(icon);

                        btn.connect('enter-event', () => { icon.set_style("color: #fff;"); btn.set_style("padding: 4px; background-color: transparent; border-radius: 4px;"); });
                        btn.connect('leave-event', () => { icon.set_style("color: " + _applet.colors.text_more_dim + ";"); btn.set_style("padding: 4px; background-color: transparent;"); });

                        btn.connect('button-press-event', () => true);
                        btn.connect('button-release-event', () => {
                            // Show selection (1, 2, 3)
                            loadContainer.destroy_all_children();
                            [1, 2, 3].forEach(num => {
                                let numBtn = new St.Bin({ reactive: true, style: "margin: 0 2px;" });
                                let baseStyle = "min-width: 20px; font-size: 11px; font-weight: bold; border-radius: 3px; padding: 2px 0px; text-align: center; ";
                                let normalStyle = baseStyle + "color: " + _applet.colors.text_more_dim + "; border: 1px solid " + _applet.colors.text_more_dim + ";";
                                let hoverStyle = baseStyle + "color: #e67e22; border: 1px solid #e67e22;";

                                let lbl = new St.Label({ text: num.toString(), style: normalStyle });
                                numBtn.set_child(lbl);

                                numBtn.connect('enter-event', () => { lbl.set_style(hoverStyle); });
                                numBtn.connect('leave-event', () => { lbl.set_style(normalStyle); });

                                numBtn.connect('button-press-event', () => true);
                                numBtn.connect('button-release-event', () => {
                                    // 1. Save old coin
                                    syncCurrentToArchive(num);

                                    // Set flag to block bindings
                                    _applet._isSwitchingCoin = true;

                                    // 2. Switch internal ID immediately
                                    if (_applet.metrics[num]) {
                                        _applet.metrics[num].currentId = a.id;
                                        _applet.metrics[num].activeCurrency = (a.currency || "usd").toLowerCase();
                                        _applet.metrics[num].current_price_val = 0;
                                        _applet.metrics[num].change_pct = 0;
                                    }

                                    // 3. Update settings
                                    _applet.settings.setValue("metric" + num + "-id", "custom");
                                    _applet.settings.setValue("metric" + num + "-custom-id", a.id);
                                    _applet.settings.setValue("metric" + num + "-symbol", a.symbol);
                                    _applet.settings.setValue("metric" + num + "-currency", a.currency || "usd");
                                    _applet.settings.setValue("metric" + num + "-enabled", true);

                                    // 4. Load alarms (with explicit currency)
                                    restoreSettingsFor(num, a.id, a.currency || "usd");

                                    // Flag reset
                                    Mainloop.timeout_add(2000, () => {
                                        _applet._isSwitchingCoin = false;
                                        return false;
                                    });

                                    setArchiveOpen(false);
                                    _applet._buildMenu();
                                    Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                                    return true;
                                });
                                loadContainer.add(numBtn);
                            });
                            return true;
                        });
                        return btn;
                    };
                    loadContainer.add(createLoadBtn());
                    btnBox.add(loadContainer);
                }

                // Delete Button
                let delBtn = new St.Bin({ reactive: true, style: "padding: 4px;" });
                let delIcon = new St.Icon({ icon_name: "user-trash-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + ";" });
                delBtn.set_child(delIcon);

                delBtn.connect('enter-event', () => { delIcon.set_style("color: #d9534f;"); delBtn.set_style("padding: 4px; background-color: transparent; border-radius: 4px;"); });
                delBtn.connect('leave-event', () => { delIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); delBtn.set_style("padding: 4px; background-color: transparent;"); });

                delBtn.connect('button-press-event', () => true);
                delBtn.connect('button-release-event', () => {
                    deleteAlarm(a.id, a.currency || "usd");
                    _applet._buildMenu(); // Rebuild to refresh list
                    return true;
                });

                btnBox.add(delBtn);
                rowBox.add(btnBox);
                wrapper.add(rowBox);

                // Edit Area
                if (a.expanded) {
                    let editBox = new St.BoxLayout({ vertical: true, style: "background-color: " + _applet.colors.bg_popup + "; padding: 10px 15px 10px 90px;" + dEdit });

                    let createEditRow = (label, val, callback) => {
                        let row = new St.BoxLayout({ style: "padding: 2px 0;" + (showDebug ? "border: 1px dashed rgba(255,255,255,0.2);" : ""), y_align: St.Align.MIDDLE });
                        let lbl = new St.Label({ text: label, style: "width: 60px; font-size: 11px; color: " + _applet.colors.text_dim + ";" });
                        let entry = new St.Entry({ style: "width: 100px; font-size: 11px; padding: 2px 5px; background-color: " + _applet.colors.bg_input + "; color: " + _applet.colors.text + "; border-radius: 4px;", can_focus: true });
                        entry.set_text(val.toString());

                        entry.clutter_text.connect('key-focus-in', () => {
                            if (entry.get_text() === "0") entry.set_text("");
                        });

                        entry.clutter_text.connect('activate', () => {
                            let txt = entry.get_text();
                            if (txt === "") txt = "0";
                            callback(txt);
                            return true;
                        });

                        row.add(lbl);
                        row.add(entry);
                        return row;
                    };

                    // Price Input
                    editBox.add(createEditRow(_("Target:"), a.price, (txt) => {
                        let val = parseFloat(txt);
                        if (!isNaN(val)) {
                            // Reset trigger and redetermine direction
                            a.triggered_at = 0;
                            a.condition = null;
                            let displayPrice = isActive ? activePrice : a.currentPrice;
                            if (val > 0 && displayPrice > 0) {
                                a.condition = (val > displayPrice) ? 'above' : 'below';
                            }

                            a.price = val;
                            saveAlarms();
                            updateActiveSettings(a.id, a.currency || "usd");
                            _applet.menu.close = () => { };
                            _applet._buildMenu(); // Rebuild to show new value
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                        }
                    }));

                    // Vol Input
                    editBox.add(createEditRow(_("Vol %:"), a.vol, (txt) => {
                        let val = parseFloat(txt);
                        if (!isNaN(val)) {
                            // Reset volatility trigger
                            a.lastVolTime = 0;
                            a.vol = val;
                            saveAlarms();
                            updateActiveSettings(a.id, a.currency || "usd");
                            _applet.menu.close = () => { };
                            _applet._buildMenu(); // Rebuild to show new value
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                        }
                    }));

                    editBox.add(new St.Label({ text: _("ENTER to save"), style: "font-size: 9px; color: " + _applet.colors.text_more_dim + "; margin-top: 4px;" }));
                    wrapper.add(editBox);
                    a.activeEditActor = editBox;
                    Animations.animateExpand(editBox, null, 8); // Slightly slower (~96ms)
                }

                listContainer.add(wrapper);
            });
        }
    };

    renderList();

    return section;
}

function createArchiveToolbar() {
    let showDebug = _applet.settings.getValue("dev-show-frames");
    let dInner = showDebug ? "border: 1px dashed rgba(255, 255, 255, 0.3);" : "";

    let wrapper = new St.BoxLayout({ style: "padding-top: 12px; padding-bottom: 12px; padding-left: 37px; padding-right: 37px;" });
    
    let leftBox = new St.BoxLayout({ x_align: St.Align.START, y_align: St.Align.MIDDLE, style: dInner });
    let rightBox = new St.BoxLayout({ x_align: St.Align.END, y_align: St.Align.MIDDLE, style: dInner });

    let createBtn = (label, mode) => {
        let isActive = (_archiveSortMode === mode);
        // Style similar to timeframe labels
        let baseStyle = "padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 0 2px; ";
        let activeStyle = baseStyle + "background-color: " + _applet.colors.bg_input + "; font-weight: bold; color: " + _applet.colors.text + ";";
        let normalStyle = baseStyle + "color: " + _applet.colors.text_dim + ";";

        let btn = new St.Button({ label: label, style: isActive ? activeStyle : normalStyle, reactive: true, y_align: St.Align.MIDDLE });

        btn.connect('clicked', () => {
            _archiveSortMode = mode;
            _applet.menu.close = () => { };
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        });
        return btn;
    };

    // Sort options
    leftBox.add_actor(createBtn(_("Date"), "date"));
    leftBox.add_actor(createBtn(_("Name"), "name"));

    // Search Toggle
    let searchBtn = new St.Bin({ reactive: true, style: "padding: 2px 6px; border-radius: 4px; margin: 0 2px;", y_align: St.Align.MIDDLE });
    let searchIcon = new St.Icon({ icon_name: "system-search-symbolic", icon_size: 12, style: _isSearchVisible ? "color: " + _applet.colors.text + ";" : "color: " + _applet.colors.text_more_dim + ";" });
    searchBtn.set_child(searchIcon);

    searchBtn.connect('enter-event', () => { searchIcon.set_style("color: " + _applet.colors.text + ";"); searchBtn.set_style("padding: 2px 6px; border-radius: 4px; margin: 0 2px; background-color: transparent;"); });
    searchBtn.connect('leave-event', () => { searchIcon.set_style(_isSearchVisible ? "color: " + _applet.colors.text + ";" : "color: " + _applet.colors.text_more_dim + ";"); searchBtn.set_style("padding: 2px 6px; border-radius: 4px; margin: 0 2px; background-color: transparent;"); });

    searchBtn.connect('button-press-event', () => true);
    searchBtn.connect('button-release-event', () => {
        // 1. Close (Collapse Animation)
        if (_isSearchVisible && _activeSearchActor) {
            Animations.animateCollapse(_activeSearchActor, () => {
                resetSearch();
                _activeSearchActor = null;
                _applet.menu.close = () => {};
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
            }, 8);
            return true;
        }

        // 2. Open
        let openSearch = () => {
            _isSearchVisible = true;
            _applet.menu.close = () => { };
            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
        };

        // A. Check if header menu or other global dropdown is open
        if (_applet._closeAnyDropdown(() => {
            Mainloop.timeout_add(120, () => {
                collapseAllAlarms(); // Ensure local alarms are closed too
                openSearch();
                return false;
            });
        })) {
            return true;
        }

        // B. Check if a local alarm is expanded
        let expandedAlarm = _alarms.find(a => a.expanded);
        if (expandedAlarm && expandedAlarm.activeEditActor) {
             Animations.animateCollapse(expandedAlarm.activeEditActor, () => {
                expandedAlarm.expanded = false;
                expandedAlarm.activeEditActor = null;
                openSearch();
             }, 8);
             return true;
        }

        // C. Nothing open -> Open directly
        collapseAllAlarms();
        openSearch();
        return true;
    });
    leftBox.add_actor(searchBtn);

    // Delete Button
    let delBtn = new St.Button({
        label: _("Delete all"),
        style: "padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #d9534f; background-color: " + _applet.colors.bg_input + ";",
        reactive: true,
        y_align: St.Align.MIDDLE
    });
    let resetDelTimer = null;

    delBtn.connect('enter-event', () => {
        if (delBtn.get_label() === _("Sure?")) {
            delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; background-color: #d9534f; font-weight: bold;");
        } else {
            delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; background-color: #d9534f;");
        }
    });

    delBtn.connect('leave-event', () => {
        if (delBtn.get_label() === _("Sure?")) {
            delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; background-color: #d9534f; font-weight: bold;");
        } else {
            delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #d9534f; background-color: " + _applet.colors.bg_input + ";");
        }
    });

    delBtn.connect('clicked', () => {
        if (delBtn.get_label() === _("Sure?")) {
            if (resetDelTimer) {
                Mainloop.source_remove(resetDelTimer);
                resetDelTimer = null;
            }
            _alarms = [];
            saveAlarms();

            // Reset all active alarms in metrics
            for (let i = 1; i <= 3; i++) {
                _applet.settings.setValue("metric" + i + "-alert-price", "0");
                _applet.settings.setValue("metric" + i + "-alert-percent", "0");
                if (_applet.metrics[i]) {
                    _applet.metrics[i].last_alert_price = 0;
                    _applet.metrics[i].last_alert_percent = 0;
                    if (_applet.metrics[i].bellIcon) {
                        _applet.metrics[i].bellIcon.set_style("color: rgba(180,180,180,0.6);");
                    }
                }
            }
            _applet.updateVisuals();
            _applet._buildMenu();
        } else {
            delBtn.set_label(_("Sure?"));
            delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; background-color: #d9534f; font-weight: bold;");

            resetDelTimer = Mainloop.timeout_add(3000, () => {
                if (delBtn) {
                    delBtn.set_label(_("Delete all"));
                    delBtn.set_style("padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #d9534f; background-color: " + _applet.colors.bg_input + ";");
                }
                resetDelTimer = null;
                return false;
            });
        }
    });

    delBtn.connect('destroy', () => { if (resetDelTimer) Mainloop.source_remove(resetDelTimer); });

    let trackerLabel = new St.Label({ 
        text: _("Alarms ") + _alarms.length + _(" of ") + MAX_ALARMS, 
        style: "font-size: 12px; color: " + _applet.colors.text_more_dim + "; margin-right: 10px; padding-top: 2px;", 
        y_align: St.Align.MIDDLE 
    });
    rightBox.add_actor(trackerLabel);

    rightBox.add_actor(delBtn);

    wrapper.add(leftBox);
    wrapper.add(new St.Widget(), { expand: true });
    wrapper.add(rightBox);
    return wrapper;
}

var Alarm = {
    init: init,
    setupAlarmChecks: setupAlarmChecks,
    createAlarmMenu: createAlarmMenu,
    createArchiveSection: createArchiveSection,
    syncCurrentToArchive: syncCurrentToArchive,
    restoreSettingsFor: restoreSettingsFor,
    getArchivedIds: getArchivedIds,
    getArchivedCurrencies: getArchivedCurrencies,
    checkArchivedAlarms: checkArchivedAlarms,
    getAlarms: getAlarms,
    getBackgroundAlarmCount: getBackgroundAlarmCount,
    isArchiveOpen: isArchiveOpen,
    setArchiveOpen: setArchiveOpen,
    markAsTriggered: markAsTriggered,
    isTriggered: isTriggered,
    toggleArchiveOpen: toggleArchiveOpen,
    collapseAllAlarms: collapseAllAlarms,
    resetSearch: resetSearch,
    addArchivedIds: addArchivedIds,
    createArchiveToolbar: createArchiveToolbar,
    checkMetricsForAlarms: checkMetricsForAlarms
};