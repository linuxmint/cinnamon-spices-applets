const Util = imports.misc.util;
const Cairo = imports.gi.cairo;
const DataPersistence = imports.data_persistence.DataPersistence;
const Utils = imports.utils.Utils;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Animations = imports.animations.Animations;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var _applet;

function init(applet) {
    _applet = applet;
}

function fetchChart(idx, area) {
    if (!_applet.apiValid) return;
    let now = Date.now();
    let m = _applet.metrics[idx];
    let tf = _applet.selectedTimeframe; 

    // --- CACHE CHECK (5-MINUTE RULE) ---
    if (m.cache_charts[tf] && m.cache_charts[tf].length > 0 && 
        m.cache_timestamps_charts[tf] && (now - m.cache_timestamps_charts[tf] < _applet.fiveMinutes)) {
        
        m.history_data = m.cache_charts[tf];
        
        // Execute UI update logic even on cache hit
        let firstOpen = m.history_data[0][1];
        let lastClose = m.history_data[m.history_data.length - 1][4];
        let diffPct = ((lastClose - firstOpen) / firstOpen) * 100;
        m.last_chart_diff_pct = diffPct;
        
        let trendColor = (diffPct < 0) ? (_applet.settings.getValue(m.key_down) || "#d9534f") : (_applet.settings.getValue(m.key_up) || "#449d44");

        if (m.current_menu_pct_label) {
            let showRocket = true; 
            let prefix = showRocket ? "🚀 " : "";
            
            let intervalMap = { "0.041": "5m", "0.166": "15m", "0.5": "30m", "1": "1h", "3": "4h", "7": "6h", "30": "1d" };
            let intervalStr = intervalMap[tf] || "";
            let globalCandle = _applet.settings.getValue("prefer-candle-charts");
            let showCandle = (m.chartViewMode === 'candle') || (m.chartViewMode === null && globalCandle);
            let intervalMarkup = (showCandle && intervalStr) ? "<span size='small' alpha='60%'>[ " + intervalStr + " ]</span> " : "";
            
            m.current_menu_pct_label.get_clutter_text().set_markup(intervalMarkup + prefix + (diffPct >= 0 ? "+" : "") + diffPct.toFixed(2) + "%");
            m.current_menu_pct_label.set_style("color: " + trendColor + "; text-align: right; font-size: 16px; font-weight: bold;");
        }

        if (area) area.queue_repaint();
        return; 
    }

    let apiKey = _applet.settings.getValue("api-key");
    let id = _applet._getId(idx);
    let cur = (_applet.settings.getValue(m.key_cur) || "usd").toLowerCase();
    
    let fetchTf = tf;
    if (tf === "3") fetchTf = "7";
    if (tf === "0.5" || tf === "0.166" || tf === "0.041") fetchTf = "1"; 

    let url = "https://api.coingecko.com/api/v3/coins/" + id + "/market_chart?vs_currency=" + cur + "&days=" + fetchTf;
    
    _applet.keyCalls++;
    _applet.chartCalls = (_applet.chartCalls || 0) + 1;
    _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
    DataPersistence.saveCallStats();
    
    Util.spawn_async(['curl', '--silent', '--max-time', '10', '-H', 'x-cg-demo-api-key: ' + apiKey, url], (stdout) => {
        try {
            let j = JSON.parse(stdout);
            if (j && j.prices && j.prices.length > 0) {
                let rawPrices = j.prices; 
                let filtered = [];
                
                if (tf === "0.041") { 
                    filtered = rawPrices.slice(-13); 
                } else if (tf === "0.166") {
                    filtered = rawPrices.slice(-25);
                } else if (tf === "0.5") {
                    let last12h = rawPrices.slice(-144);
                    filtered = last12h; 
                } else {
                    let days = parseFloat(tf);
                    let cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
                    filtered = rawPrices.filter(p => p[0] >= cutoff);
                }
                
                if (filtered.length < 2) filtered = rawPrices.slice(-24); 

                let ohlcData = [];
                let useDirectChaining = (tf === "0.041" || tf === "0.166");
                let targetCandles = (tf === "1") ? 24 : (tf === "3" ? 18 : (tf === "7" ? 28 : 30));
                let step = useDirectChaining ? 1 : Math.ceil(filtered.length / targetCandles);
                
                let prevClose = null;

                for (let k=0; k<filtered.length; k+=step) {
                    let chunk = useDirectChaining ? filtered.slice(k, k+2) : filtered.slice(k, k+step);
                    
                    if (useDirectChaining && chunk.length < 2) continue;

                    if (chunk.length > 0) {
                        let pricesChunk = chunk.map(x => x[1]);
                        let open = pricesChunk[0];
                        let close = pricesChunk[pricesChunk.length-1];
                        let high = Math.max(...pricesChunk);
                        let low = Math.min(...pricesChunk);
                        
                        if (prevClose !== null && !useDirectChaining) open = prevClose;
                        
                        if (open > high) high = open;
                        if (open < low) low = open;

                        ohlcData.push([chunk[0][0], open, high, low, close]);
                        prevClose = close;
                    }
                }

                m.cache_charts[tf] = ohlcData;
                m.cache_timestamps_charts[tf] = Date.now();
                
                if (_applet.selectedTimeframe === tf) {
                    m.history_data = ohlcData;
                    
                    let firstOpen = ohlcData[0][1];
                    let lastClose = ohlcData[ohlcData.length - 1][4];
                    let diffPct = ((lastClose - firstOpen) / firstOpen) * 100;
                    m.last_chart_diff_pct = diffPct;
                    let trendColor = (diffPct < 0) ? (_applet.settings.getValue(m.key_down) || "#d9534f") : (_applet.settings.getValue(m.key_up) || "#449d44");

                    if (m.current_menu_pct_label) {
                        m.current_menu_pct_label.set_text((diffPct >= 0 ? "+" : "") + diffPct.toFixed(2) + "%");
                        m.current_menu_pct_label.set_style("color: " + trendColor + "; text-align: right; font-size: 16px; font-weight: bold;");
                    }

                    _applet.updateVisuals();
                    if (area) area.queue_repaint();
                }
            }
        } catch (e) {
            global.logError("Chart Fetch Error: " + e);
        }
    });
}

function fetchCoinDetails(idx) {
    if (!_applet.apiValid) return;
    let now = Date.now();
    let m = _applet.metrics[idx];
    let oneHour = 3600000;

    if (m.details_data && m.last_details_fetch && (now - m.last_details_fetch < oneHour)) {
        return;
    }

    let apiKey = _applet.settings.getValue("api-key");
    let id = _applet._getId(idx);
    let url = "https://api.coingecko.com/api/v3/coins/" + id + "?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false";
    
    _applet.keyCalls++;
    _applet.detailCalls = (_applet.detailCalls || 0) + 1;
    _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
    DataPersistence.saveCallStats();
    let d = new Date();
    _applet.lastFetchTime = d.getHours() + ":" + d.getMinutes().toString().padStart(2, '0');

    Util.spawn_async(['curl', '--silent', '--max-time', '10', '-H', 'x-cg-demo-api-key: ' + apiKey, url], (stdout) => {
        try {
            let j = JSON.parse(stdout);
            if (j && j.market_data) {
                let cur = (_applet.settings.getValue(m.key_cur) || "usd").toLowerCase();
                m.details_data = {
                    rank: j.market_cap_rank || _("?"),
                    ath: j.market_data.ath[cur] || 0,
                    ath_change: j.market_data.ath_change_percentage[cur] || 0,
                    high_24h: j.market_data.high_24h[cur] || 0,
                    low_24h: j.market_data.low_24h[cur] || 0,
                    mcap: j.market_data.market_cap[cur] || 0,
                    volume: j.market_data.total_volume[cur] || 0
                };
                
                if (m.current_price_val > 0 && m.details_data.ath > 0 && m.current_price_val >= m.details_data.ath) {
                    m.ath_trigger_time = Date.now();
                }

                m.last_details_fetch = Date.now();
                
                // FIX: Direct update instead of rebuild to avoid stuttering
                if (_applet.expandedIndex === idx && _applet.activeDetailsActor) {
                    populateDetailsBox(_applet.activeDetailsActor, idx);
                } else if (_applet.searchingMetricIndex === null) {
                    _applet.menu.close = () => {};
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { 
                        if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; 
                        return false; 
                    });
                }
            }
        } catch (e) { global.logError("Details Fetch Error: " + e); }
    });
}

function populateDetailsBox(box, idx) {
    if (!box || !_applet.metrics[idx] || !_applet.metrics[idx].details_data) return;
    
    box.destroy_all_children();
    let m = _applet.metrics[idx];
    let d = m.details_data;
    
    let row = (l1, v1, l2, v2, c2) => {
        let bx = new St.BoxLayout({ style: "padding: 1px 0;" });
        bx.add(new St.Label({ text: l1, style: "color: " + _applet.colors.text_more_dim + "; font-size: 11px; min-width: 65px;" }));
        bx.add(new St.Label({ text: v1, style: "color: " + _applet.colors.text + "; font-size: 11px; font-weight: bold; min-width: 65px;" }));
        bx.add(new St.Label({ text: l2, style: "color: " + _applet.colors.text_more_dim + "; font-size: 11px; min-width: 65px;" }));
        bx.add(new St.Label({ text: v2, style: (c2 ? "color: " + c2 + "; " : "color: " + _applet.colors.text + "; ") + "font-size: 11px; font-weight: bold;" }));
        return bx;
    };
    
    box.add(row(_("Rank:"), "#" + d.rank, _("M.Cap:"), Utils.formatPrice(d.mcap, idx, true)));
    box.add(row(_("24h High:"), Utils.formatPrice(d.high_24h, idx, true), _("24h Vol:"), Utils.formatPrice(d.volume, idx, true)));
    box.add(row(_("24h Low:"), Utils.formatPrice(d.low_24h, idx, true), _("ATH:"), Utils.formatPrice(d.ath, idx, true) + " (" + d.ath_change.toFixed(1) + "%)", "#e67e22"));
}

function drawChart(idx, cr, w, h) {
    let m = _applet.metrics[idx];
    if (w > 0 && m.history_data && m.history_data.length >= 2) {
        
        // --- DRAW HOVER BACKGROUND ---
        let statesToDraw = [];
        if (_applet.expandedIndex === idx) statesToDraw.push('expand');
        if (m.chartHoverState && !statesToDraw.includes(m.chartHoverState)) statesToDraw.push(m.chartHoverState);

        // Parse colors
        let hoverCol = Utils.parseColorString(_applet.hoverColorHeader);
        let activeCol = { r: 68/255, g: 157/255, b: 68/255, a: 0.25 }; // Greenish (like Header Active)

        statesToDraw.forEach(state => {
            let bgX = 0, bgY = h - 22, bgW = 28, bgH = 22; 
            if (state === 'expand') bgX = 4;
            else bgX = w - 32;
            
            // Select color: Active (Expand) has priority over Hover
            if (state === 'expand' && _applet.expandedIndex === idx) {
                cr.setSourceRGBA(activeCol.r, activeCol.g, activeCol.b, activeCol.a);
            } else {
                cr.setSourceRGBA(hoverCol.r, hoverCol.g, hoverCol.b, hoverCol.a); // Hover with correct transparency
            }

            let r = 4; // Radius 4px like Header
            cr.newSubPath();
            cr.arc(bgX + r, bgY + r, r, Math.PI, 3 * Math.PI / 2);
            cr.arc(bgX + bgW - r, bgY + r, r, 3 * Math.PI / 2, 0);
            cr.arc(bgX + bgW - r, bgY + bgH - r, r, 0, Math.PI / 2);
            cr.arc(bgX + r, bgY + bgH - r, r, Math.PI / 2, Math.PI);
            cr.closePath();
            cr.fill();
        });
        
        let globalCandle = _applet.settings.getValue("prefer-candle-charts");
        let showCandle = (m.chartViewMode === 'candle') || (m.chartViewMode === null && globalCandle);
        let drawData = m.history_data; 
        let lineData = drawData.map(d => d[4]);
        let min, max, range;
        
        if (showCandle) {
            let allLows = drawData.map(d => d[3]);
            let allHighs = drawData.map(d => d[2]);
            min = Math.min(...allLows);
            max = Math.max(...allHighs);
        } else {
            min = Math.min(...lineData);
            max = Math.max(...lineData);
        }
        range = max - min || 1;

        cr.setSourceRGBA(0.5, 0.5, 0.5, 0.07); cr.selectFontFace("Sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD); cr.setFontSize(85); 
        let wm = (_applet.settings.getValue(m.key_sym) || "??").toUpperCase(); let ext = cr.textExtents(wm); cr.moveTo((w/2)-(ext.width/2), (h/2)+(ext.height/2)-15); cr.showText(wm);
        cr.setSourceRGBA(0.5, 0.5, 0.5, 0.7); cr.setFontSize(10);
        let hlText = "L: " + Utils.formatPrice(min, idx, true) + " | H: " + Utils.formatPrice(max, idx, true);
        let hlex = cr.textExtents(hlText); cr.moveTo((w/2)-(hlex.width/2), h - 2); cr.showText(hlText);
        
        if (showCandle) {
            let count = drawData.length;
            let candleWidth = (w / count) * 0.7; 
            let gap = (w / count) * 0.3;
            for (let j=0; j<count; j++) {
                let d = drawData[j]; 
                let open = d[1], high = d[2], low = d[3], close = d[4];
                let x = (j / count) * w + (gap/2);
                let yHigh = (h - 35) - ((high - min) / range) * (h - 50);
                let yLow = (h - 35) - ((low - min) / range) * (h - 50);
                let yOpen = (h - 35) - ((open - min) / range) * (h - 50);
                let yClose = (h - 35) - ((close - min) / range) * (h - 50);
                let isUp = close >= open;
                let color = isUp ? (_applet.settings.getValue("chart-color-candle-up") || "#449d44") : (_applet.settings.getValue("chart-color-candle-down") || "#d9534f");
                let [r,g,b] = Utils.hexToCanvasRgb(color);
                cr.setSourceRGBA(r, g, b, 1.0);
                cr.setLineWidth(1); cr.moveTo(x + candleWidth/2, yHigh); cr.lineTo(x + candleWidth/2, yLow); cr.stroke();
                let bodyTop = Math.min(yOpen, yClose); let bodyHeight = Math.abs(yClose - yOpen); if (bodyHeight < 1) bodyHeight = 1; 
                cr.rectangle(x, bodyTop, candleWidth, bodyHeight); cr.fill();
            }
        } else {
            let diff = lineData[lineData.length-1] - lineData[0];
            let [r, g, b] = Utils.hexToCanvasRgb((diff < 0) ? (_applet.settings.getValue(m.key_down) || "#d9534f") : (_applet.settings.getValue(m.key_up) || "#449d44"));
            for (let j = 0; j < lineData.length; j++) {
                let x = (j / (lineData.length - 1)) * w;
                let y = (h - 35) - ((lineData[j] - min) / range) * (h - 50);
                if (j === 0) cr.moveTo(x, y); else cr.lineTo(x, y);
            }
            cr.setSourceRGBA(r, g, b, 1.0); cr.setLineWidth(2.4); cr.stroke();
        }

        // Icon Styles (Opacity Logic)
        let getIconAlpha = (stateName) => {
            if (_applet.expandedIndex === idx && stateName === 'expand') return 1.0; // Active
            if (m.chartHoverState === stateName) return 1.0; // Hover
            return 0.55; // Normal
        };

        let textColor = Utils.parseColorString(_applet.colors.text_more_dim);

        // Toggle Icon (Right)
        let iconX = w - 18; let iconY = h - 11; 
        let toggleAlpha = getIconAlpha('toggle');
        cr.setLineWidth(1.2); cr.setSourceRGBA(textColor.r, textColor.g, textColor.b, toggleAlpha); 
        if (showCandle) { cr.moveTo(iconX - 7, iconY + 4); cr.lineTo(iconX - 3, iconY - 3); cr.lineTo(iconX + 3, iconY + 3); cr.lineTo(iconX + 7, iconY - 5); cr.stroke(); } 
        else { cr.rectangle(iconX - 3, iconY - 4, 6, 8); cr.stroke(); cr.moveTo(iconX, iconY - 9); cr.lineTo(iconX, iconY - 4); cr.moveTo(iconX, iconY + 4); cr.lineTo(iconX, iconY + 9); cr.stroke(); }

        // Expand Icon (Left)
        let expX = 18; let expY = h - 11; 
        let expandAlpha = getIconAlpha('expand');
        // If active (green background), color icon green like in header
        if (_applet.expandedIndex === idx) cr.setSourceRGBA(0.27, 0.62, 0.27, 1.0); // #449d44
        else cr.setSourceRGBA(textColor.r, textColor.g, textColor.b, expandAlpha);

        if (_applet.expandedIndex === idx) { cr.moveTo(expX - 5, expY - 3); cr.lineTo(expX, expY + 3); cr.lineTo(expX + 5, expY - 3); } 
        else { cr.moveTo(expX - 5, expY + 3); cr.lineTo(expX, expY - 3); cr.lineTo(expX + 5, expY + 3); }
        cr.stroke();

        if (_applet.settings.getValue("dev-show-frames")) {
            cr.setSourceRGBA(1, 0, 1, 0.5); // Magenta
            cr.setLineWidth(1);
            cr.rectangle(0, h - 30, 35, 30); // Hitbox Expand (Chevron)
            cr.stroke();

            cr.rectangle(w - 35, h - 30, 35, 30); // Hitbox Toggle (Chart Icon)
            cr.stroke();

            // Text Area (High/Low)
            let hlex = cr.textExtents(hlText);
            cr.setSourceRGBA(0, 1, 1, 0.5); // Cyan
            cr.rectangle((w/2)-(hlex.width/2) - 2, h - 15, hlex.width + 4, 14);
            cr.stroke();
        }
    }
}

function createChartArea(idx) {
    let m = _applet.metrics[idx];
    let area = new St.DrawingArea({ style: "background-color: transparent; margin-top: 5px; margin-left: 15px; margin-right: 15px;", height: 138, reactive: true });

    // Helper for precise hit test (Exactly matched to hover background)
    let getHoverTarget = (x, y, w, h) => {
        // Left (Expand): Area 35x30 bottom left (logical pixels)
        if (x >= 0 && x <= 35 && y >= h - 30) return 'expand';
        // Right (Toggle): Area 35x30 bottom right (logical pixels)
        if (x >= w - 35 && x <= w && y >= h - 30) return 'toggle';
        return null;
    };

    // Hover tracking for icons
    area.connect('motion-event', (actor, event) => {
        let [stageX, stageY] = event.get_coords();
        let [ax, ay] = actor.get_transformed_position();
        let relX = stageX - ax;
        let relY = stageY - ay;
        let w = actor.width; // Use logical width
        let h = actor.height; // Use logical height

        let newState = getHoverTarget(relX, relY, w, h);

        if (m.chartHoverState !== newState) {
            m.chartHoverState = newState;
            area.queue_repaint();
        }
        return true; // Isolates hover from parent element
    });

    area.connect('leave-event', () => {
        if (m.chartHoverState !== null) {
            m.chartHoverState = null;
            area.queue_repaint();
        }
    });

    // Click isolation: Always consume press
    area.connect('button-press-event', () => {
        return true;
    });

    // Only trigger release if in target area
    area.connect('button-release-event', (actor, event) => {
        let [stageX, stageY] = event.get_coords();
        let [ax, ay] = actor.get_transformed_position();
        let relX = stageX - ax;
        let relY = stageY - ay;
        let w = actor.width;
        let h = actor.height;
        
        let target = getHoverTarget(relX, relY, w, h);

        if (target === 'toggle') {
            let globalCandle = _applet.settings.getValue("prefer-candle-charts");
            let currentMode = m.chartViewMode;
            if (currentMode === null) currentMode = globalCandle ? 'candle' : 'line';
            m.chartViewMode = (currentMode === 'candle') ? 'line' : 'candle';
            
            // Rebuild menu to update text line above
            _applet.menu.close = () => {};
            Mainloop.timeout_add(0, () => { 
                _applet._buildMenu(); 
                Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
            });
        } else if (target === 'expand') {
            _applet.menu.close = () => {}; 
            
            // 1. If THIS detail is already open -> Close
            if (_applet.expandedIndex === idx) {
                _applet._closeAnyDropdown(() => {
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                });
                return true;
            }

            // 2. If something else is open -> Close, Pause, Open
            if (_applet._closeAnyDropdown(() => {
                Mainloop.timeout_add(120, () => {
                    _applet.expandedIndex = idx;
                    m.chartHoverState = null;
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                    return false;
                });
            })) {
                return true;
            }

            // 3. Nothing open -> Open directly
            _applet.searchingMetricIndex = null;
            _applet.alarmOpenIndex = null;
            _applet.currencySelectorIndex = null;
            _applet.isHeaderMenuOpen = false;
            if (_applet.resetViewStates) _applet.resetViewStates();
            
            _applet.expandedIndex = idx;
            m.chartHoverState = null; // Reset hover status so it doesn't "stick"
            _applet._buildMenu(); 
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        }
        
        // Always return true so clicks in chart don't close the menu
        return true;
    });

    Utils.safeRepaint(area, (a, cr, w, h) => {
        drawChart(idx, cr, w, h);
    });

    fetchChart(idx, area); // Fetch data for this area

    return area;
}

var Charts = {
    init: init,
    fetchChart: fetchChart,
    fetchCoinDetails: fetchCoinDetails,
    drawChart: drawChart,
    createChartArea: createChartArea,
    populateDetailsBox: populateDetailsBox
};