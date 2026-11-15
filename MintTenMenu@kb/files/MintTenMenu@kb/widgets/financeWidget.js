// widgets/financeWidget.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const WidgetBase = require('./widgets/widgetBase');

const YF_CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FRANKFURTER_API = 'https://api.frankfurter.dev/v1';

function isoDate(d) {
    return d.toISOString().slice(0, 10);
}

function shortDate(ts, isoStr, period) {
    let d = ts ? new Date(ts * 1000) : new Date(isoStr + 'T00:00:00');
    if (period === '1Y') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatCurrency(val, currency, truncate) {
    if (val === undefined || val === null || isNaN(val)) return '—';
    if (truncate) return val.toFixed(2);

    let prefix = '';
    if (currency === 'USD') prefix = '$';
    else if (currency === 'EUR') prefix = '€';
    else if (currency === 'GBP') prefix = '£';
    else if (currency === 'INR') prefix = '₹';

    let decimals = (currency === 'JPY' || currency === 'KRW' || currency === 'IDR') ? 2 : (val < 10 ? 4 : 2);
    let str = val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return prefix ? prefix + str : str + ' ' + currency;
}

function fmtPct(v) {
    if (v === undefined || v === null || isNaN(v)) return '0.00%';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function normalizeSymbol(sym) {
    let s = (sym || 'AAPL').trim().toUpperCase();
    if (s.includes('/')) {
        let parts = s.split('/');
        let left = parts[0];   // e.g. GC=F, SI=F, EUR, AAPL
        let right = parts[1];  // e.g. INR, USD
        // Forex pair: both sides are exactly 3 alpha chars (EUR/USD, USD/INR, etc.)
        let isForexPair = /^[A-Z]{3}$/.test(left) && /^[A-Z]{3}$/.test(right);
        if (isForexPair) {
            return { raw: s, yfSymbol: left + right + '=X', isForex: true, base: left, quote: right };
        }
        // Otherwise: a symbol with a target display currency (e.g. GC=F/INR, AAPL/INR)
        return { raw: s, yfSymbol: left, isForex: false, targetCurrency: right };
    }
    return { raw: s, yfSymbol: s, isForex: false };
}

class FinanceWidget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);
        this._data = null;
        this._lastFetchTime = 0;
        this._lastSuccessfulFetchTime = 0; // tracks when data was last actually fetched from network
        this._lastFetchedPeriod = null;    // tracks which period the cached data belongs to
        this._fetchSeq = 0;                // guards against out-of-order async responses
        this._fxCache = null;              // last good FX rate, used when a rate fetch fails
    }

    buildUI() {
        this._showLoading();
    }

    refresh(forceRefresh = false) {
        const config = this.tileData.config || {};
        const refreshIntervalSec = config.refreshIntervalSec || 180;
        const cacheTTL = Math.max(60000, refreshIntervalSec * 1000);
        const period = config.chartPeriod || '1M';

        // Bust cache if the user changed the chart period
        const periodChanged = this._lastFetchedPeriod !== null && this._lastFetchedPeriod !== period;

        if (!forceRefresh && !periodChanged && this._data && (Date.now() - this._lastFetchTime < cacheTTL)) {
            this._renderUI();
            this._scheduleRefresh(refreshIntervalSec, () => this.refresh());
            return;
        }

        const rawSymbol = config.symbol || config.currencyPairs || 'AAPL';
        const truncate = !!config.truncateDecimals;

        const symInfo = normalizeSymbol(rawSymbol);

        // Invalidate any in-flight response from a previous refresh so overlapping
        // fetches cannot overwrite newer data (a failed FX call used to win the race
        // and leave the tile showing USD instead of the converted currency).
        const seq = ++this._fetchSeq;

        const rangeMap = { '5D': '5d', '1M': '1mo', '3M': '3mo', '1Y': '1y' };
        const yfRange = rangeMap[period] || '1mo';
        const intervalMap = { '5D': '15m', '1M': '1d', '3M': '1d', '1Y': '1wk' };
        const yfInterval = intervalMap[period] || '1d';

        const yfUrl = YF_CHART_API + encodeURIComponent(symInfo.yfSymbol) + '?interval=' + yfInterval + '&range=' + yfRange;

        // User-Agent required for Yahoo Finance chart API
        const curlArgs = ['curl', '-sL', '-A', 'Mozilla/5.0 (X11; Linux x86_64)', '--max-time', '12', yfUrl];

        this._spawnAsync(curlArgs, (out, err) => {
            if (seq !== this._fetchSeq) return;
            if (!err && out) {
                try {
                    let j = JSON.parse(out.trim());
                    if (j.chart && j.chart.result && j.chart.result.length > 0) {
                        let res = j.chart.result[0];
                        let meta = res.meta || {};
                        let timestamps = res.timestamp || [];
                        let quotes = (res.indicators && res.indicators.quote && res.indicators.quote[0]) ? res.indicators.quote[0].close || [] : [];

                        // Filter out null / undefined price points
                        let history = [];
                        let validTimestamps = [];
                        for (let i = 0; i < quotes.length; i++) {
                            if (quotes[i] !== null && quotes[i] !== undefined && !isNaN(quotes[i])) {
                                history.push(quotes[i]);
                                validTimestamps.push(timestamps[i] || 0);
                            }
                        }

                        // If single point returned, duplicate it so line graph has at least 2 points to draw
                        if (history.length === 1) {
                            history.unshift(meta.chartPreviousClose || history[0]);
                            validTimestamps.unshift((validTimestamps[0] || Math.floor(Date.now() / 1000)) - 86400);
                        }

                        if (history.length > 0) {
                            let curPrice = meta.regularMarketPrice || history[history.length - 1];
                            let prevClose = meta.chartPreviousClose || (history.length > 1 ? history[0] : curPrice);
                            let change = curPrice - prevClose;
                            let changePct = prevClose ? (change / prevClose) * 100 : 0;

                            let displayName = meta.shortName || meta.symbol || symInfo.yfSymbol;
                            let currency = meta.currency || (symInfo.isForex ? symInfo.quote : 'USD');

                            const dataObj = {
                                symbol: symInfo.raw,
                                yfSymbol: meta.symbol || symInfo.yfSymbol,
                                name: displayName,
                                price: curPrice,
                                prevClose: prevClose,
                                change: change,
                                changePct: changePct,
                                currency: currency,
                                history: history,
                                timestamps: validTimestamps,
                                dates: null
                            };

                            const finalize = (fxFailed) => {
                                if (seq !== this._fetchSeq) return;
                                this._data = dataObj;
                                if (!fxFailed) {
                                    this._lastFetchTime = Date.now();
                                    this._lastSuccessfulFetchTime = Date.now();
                                }
                                this._lastFetchedPeriod = period;
                                this._renderUI(fxFailed
                                    ? { fxFailed: true, targetCurrency: symInfo.targetCurrency }
                                    : undefined);
                                // Force the retry past the cache check, otherwise the
                                // unconverted fallback would be served from cache again.
                                this._scheduleRefresh(fxFailed ? 30 : refreshIntervalSec,
                                    () => this.refresh(fxFailed));
                            };

                            // If symbol has a /TARGET suffix (e.g. GC=F/INR), convert currency
                            if (symInfo.targetCurrency && symInfo.targetCurrency !== currency) {
                                this._applyConversion(dataObj, currency, symInfo.targetCurrency, finalize, seq);
                            } else {
                                finalize(false);
                            }
                            return;
                        }
                    }
                } catch(e) {}
            }

            // Network / parse failure — show stale data with offline warning, or fallback APIs
            if (symInfo.isForex) {
                this._fetchFrankfurterFallback(symInfo.base, symInfo.quote, period, truncate, seq);
            } else if (this._data) {
                // Render stale data with an offline badge
                this._renderUI({ offline: true });
                this._scheduleRefresh(30, () => this.refresh());
            } else {
                this._showError('Failed to fetch ' + symInfo.raw);
                this._scheduleRefresh(30, () => this.refresh());
            }
        });
    }

    // Fetch live exchange rate and convert all price fields in-place.
    // fromCurrency / toCurrency: e.g. 'USD', 'INR'
    _applyConversion(dataObj, fromCurrency, toCurrency, onDone, seq) {
        const pairKey = fromCurrency + '>' + toCurrency;
        const fxSymbol = fromCurrency + toCurrency + '=X';

        const applyRate = (rate) => {
            this._fxCache = { key: pairKey, rate, ts: Date.now() };
            dataObj.price     *= rate;
            dataObj.prevClose *= rate;
            dataObj.change    *= rate;
            dataObj.history    = dataObj.history.map(v => v * rate);
            dataObj.currency   = toCurrency;
            // changePct stays the same — it's currency-neutral
            onDone(false);
        };

        const finish = (rate) => {
            if (seq !== this._fetchSeq) return;
            if (rate && rate > 0) {
                applyRate(rate);
            } else if (this._fxCache && this._fxCache.key === pairKey
                       && (Date.now() - this._fxCache.ts) < 1 * 3600 * 1000) {
                // Rate sources are unavailable right now — reuse the last known rate
                // instead of silently leaving the tile in the source currency.
                applyRate(this._fxCache.rate);
            } else {
                onDone(true);
            }
        };

        const tryFrankfurter = () => {
            if (seq !== this._fetchSeq) return;
            const url = FRANKFURTER_API + '/latest?base=' + fromCurrency + '&symbols=' + toCurrency;
            this._spawnAsync(['curl', '-sL', '--max-time', '10', url], (out, err) => {
                if (seq !== this._fetchSeq) return;
                let rate = null;
                if (!err && out) {
                    try {
                        const j = JSON.parse(out.trim());
                        rate = j && j.rates ? j.rates[toCurrency] : null;
                    } catch(e) {}
                }
                finish(rate);
            });
        };

        const tryYahoo = (hostIndex) => {
            if (seq !== this._fetchSeq) return;
            const host = hostIndex === 0 ? 'query1' : 'query2';
            const url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/'
                + fxSymbol + '?interval=1d&range=1d';
            this._spawnAsync(['curl', '-sL', '-A', 'Mozilla/5.0 (X11; Linux x86_64)',
                '--max-time', '10', url], (out, err) => {
                if (seq !== this._fetchSeq) return;
                let rate = null;
                if (!err && out) {
                    try {
                        const j = JSON.parse(out.trim());
                        if (j.chart && j.chart.result && j.chart.result.length > 0) {
                            rate = j.chart.result[0].meta.regularMarketPrice || null;
                        }
                    } catch(e) {}
                }
                if (rate && rate > 0) finish(rate);
                else if (hostIndex < 1) tryYahoo(hostIndex + 1);
                else tryFrankfurter();
            });
        };

        tryYahoo(0);
    }

    _fetchFrankfurterFallback(base, quote, period, truncate, seq) {
        let d = new Date();
        if (period === '5D') d.setDate(d.getDate() - 9);
        else if (period === '3M') d.setMonth(d.getMonth() - 3);
        else if (period === '1Y') d.setFullYear(d.getFullYear() - 1);
        else d.setMonth(d.getMonth() - 1);

        const sd = isoDate(d);
        const ed = isoDate(new Date());
        const url = FRANKFURTER_API + '/' + sd + '..' + ed + '?from=' + base + '&to=' + quote;

        this._spawnAsync(['curl', '-sL', '--max-time', '15', url], (out, err) => {
            if (seq !== undefined && seq !== this._fetchSeq) return;
            if (err || !out) {
                this._showError('Fetch failed');
                return;
            }
            try {
                let j = JSON.parse(out.trim());
                let dates = Object.keys(j.rates).sort();
                let hist = dates.map(d => j.rates[d][quote]);
                if (hist.length > 0) {
                    let cur = hist[hist.length - 1];
                    let prev = hist.length > 1 ? hist[0] : cur;
                    let chg = cur - prev;
                    let pct = prev ? (chg / prev) * 100 : 0;

                    this._data = {
                        symbol: base + '/' + quote,
                        name: base + '/' + quote,
                        price: cur,
                        prevClose: prev,
                        change: chg,
                        changePct: pct,
                        currency: quote,
                        history: hist,
                        timestamps: null,
                        dates: dates
                    };
                    this._lastSuccessfulFetchTime = Date.now();
                    this._lastFetchedPeriod = period;
                    this._renderUI();
                } else if (this._data) {
                    this._renderUI({ offline: true });
                } else {
                    this._showError('No data');
                }
            } catch(e) {
                this._showError('Parse error');
            }
        });
    }

    _offlineBadgeText() {
        if (!this._lastSuccessfulFetchTime) return '⚠ No internet';
        const elapsedMs = Date.now() - this._lastSuccessfulFetchTime;
        const elapsedMin = Math.round(elapsedMs / 60000);
        if (elapsedMs > 86400000) return '⚠ No internet · Cannot fetch';
        if (elapsedMin < 2) return '⚠ No internet · just now';
        return '⚠ No internet · ' + elapsedMin + ' min ago';
    }

    _renderUI(opts) {
        this.contentActor.remove_all_children();
        if (!this._data) return;

        const d = this._data;
        const config = this.tileData.config || {};
        const period = config.chartPeriod || '1M';
        const truncate = !!config.truncateDecimals;
        const isLight = (config.themeMode === 'light');
        const size = this._getSize();

        // Theme style tokens
        const cardStyle = isLight
            ? 'background-color: #ffffff; padding: 10px 12px;'
            : 'background-color: #121212; padding: 10px 12px;';

        const titleStyle = isLight
            ? 'color: rgba(30, 41, 59, 0.85); font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'
            : 'color: rgba(255, 255, 255, 0.75); font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;';

        const subtitleStyle = isLight
            ? 'color: rgba(100, 116, 139, 0.75); font-size: 9px; font-family: "Inter", sans-serif;'
            : 'color: rgba(255, 255, 255, 0.45); font-size: 9px; font-family: "Inter", sans-serif;';

        const priceStyle = isLight
            ? 'color: #0f172a; font-size: 22px; font-weight: bold; font-family: "Inter", sans-serif;'
            : 'color: #ffffff; font-size: 22px; font-weight: bold; font-family: "Inter", sans-serif;';

        const tooltipStyle = isLight
            ? 'background-color: #ffffff; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 4px; padding: 2px 6px;'
            : 'background-color: rgba(20, 20, 20, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 4px; padding: 2px 6px;';

        const tooltipTextStyle = isLight
            ? 'color: #0f172a; font-size: 9px; font-family: "Inter", sans-serif;'
            : 'color: #ffffff; font-size: 9px; font-family: "Inter", sans-serif;';

        const container = new St.BoxLayout({
            vertical: true,
            style: cardStyle,
            x_expand: true,
            y_expand: true
        });
        this.contentActor.add_child(container);

        const inner = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        container.add_child(inner);

        // Header Row (Symbol + Name + Period & Time)
        const header = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 2px;' });
        inner.add_child(header);

        let titleText = d.symbol;
        if (d.name && d.name !== d.symbol) {
            titleText += ' • ' + d.name;
        }

        header.add_child(new St.Label({
            text: titleText,
            x_expand: true,
            style: titleStyle
        }));

        const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const isOffline = opts && opts.offline;
        header.add_child(new St.Label({
            text: period + ' • ' + ts,
            style: subtitleStyle
        }));

        // Offline warning banner shown below the header when there's no internet
        if (isOffline) {
            const offlineStyle = isLight
                ? 'color: #b45309; font-size: 9px; font-family: "Inter", sans-serif; margin-bottom: 2px;'
                : 'color: #fcd34d; font-size: 9px; font-family: "Inter", sans-serif; margin-bottom: 2px;';
            inner.add_child(new St.Label({
                text: this._offlineBadgeText(),
                style: offlineStyle
            }));
        } else if (opts && opts.fxFailed) {
            const fxStyle = isLight
                ? 'color: #b45309; font-size: 9px; font-family: "Inter", sans-serif; margin-bottom: 2px;'
                : 'color: #fcd34d; font-size: 9px; font-family: "Inter", sans-serif; margin-bottom: 2px;';
            inner.add_child(new St.Label({
                text: '⚠ ' + (opts.targetCurrency || 'FX') + ' rate unavailable · showing ' + d.currency,
                style: fxStyle
            }));
        }

        // Middle Row (Price + Change Badge)
        const midRow = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER, style: 'margin-bottom: 2px;' });
        inner.add_child(midRow);

        midRow.add_child(new St.Label({
            text: formatCurrency(d.price, d.currency, truncate),
            x_expand: true,
            style: priceStyle
        }));

        const up = d.changePct >= 0;
        const arrow = up ? '▲' : '▼';
        const chgColor = isLight
            ? (up ? '#15803d' : '#b91c1c')
            : (up ? '#a8d5a2' : '#ffb3b0');

        const changeBox = new St.BoxLayout({ vertical: true, y_align: Clutter.ActorAlign.CENTER });
        midRow.add_child(changeBox);

        changeBox.add_child(new St.Label({
            text: arrow + ' ' + fmtPct(d.changePct),
            style: 'color: ' + chgColor + '; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif; text-align: right;'
        }));

        // Chart Area (Bottom)
        const chartH = Math.max(36, Math.round(size.h * 0.34));

        const chartContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            height: chartH,
            style: 'margin-top: 2px;'
        });
        inner.add_child(chartContainer);

        const area = new St.DrawingArea({ x_expand: true, height: chartH });
        area.set_position(0, 0);
        chartContainer.add_child(area);

        // Tooltip
        const tooltip = new St.BoxLayout({
            style: tooltipStyle,
            visible: false
        });
        const tooltipText = new St.Label({
            text: '',
            style: tooltipTextStyle
        });
        tooltip.add_child(tooltipText);
        chartContainer.add_child(tooltip);

        // Interaction
        area.reactive = true;
        const history = d.history.slice();
        let mn = history[0], mx = history[0];
        for (let i = 1; i < history.length; i++) {
            if (history[i] < mn) mn = history[i];
            if (history[i] > mx) mx = history[i];
        }

        area.connect('motion-event', (actor, event) => {
            let [x, y] = event.get_coords();
            let [success, rx, ry] = actor.transform_stage_point(x, y);
            if (success) {
                let [cw, ch] = actor.get_surface_size();
                let chartW = cw || (size.w - 28);
                let padX = 6;
                let padY = 5;
                let usableW = Math.max(1, chartW - padX * 2);
                let relX = Math.max(0, Math.min(usableW, rx - padX));
                let denom = Math.max(1, history.length - 1);
                let idx = Math.round(relX / usableW * denom);
                idx = Math.max(0, Math.min(history.length - 1, idx));

                let range = mx - mn || 0.0001;
                let px = padX + (idx / denom) * usableW;
                let py = padY + (1 - (history[idx] - mn) / range) * (chartH - padY * 2);

                let dateStr = d.timestamps ? shortDate(d.timestamps[idx], null, period) : shortDate(null, d.dates[idx], period);
                tooltipText.text = formatCurrency(history[idx], d.currency, truncate) + ' (' + dateStr + ')';
                tooltip.visible = true;

                let [, tw] = tooltip.get_preferred_width(-1);
                let [, th] = tooltip.get_preferred_height(-1);

                let tx = Math.max(2, Math.min(chartW - tw - 2, px - tw / 2));
                let ty = Math.max(2, Math.min(chartH - th - 2, py - th - 4));
                tooltip.set_position(tx, ty);

                actor.hoverIdx = idx;
                actor.queue_repaint();
            }
            return Clutter.EVENT_PROPAGATE;
        });

        area.connect('leave-event', (actor, event) => {
            tooltip.visible = false;
            actor.hoverIdx = null;
            actor.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });

        // Repaint Cairo Canvas
        area.connect('repaint', (a) => {
            let cr = a.get_coords ? a.get_context() : a.get_context();
            if (!cr) return;

            let [cw, ch] = a.get_surface_size();
            let range = mx - mn || 0.0001;
            let padX = 6;
            let padY = 5;

            let pts = [];
            let denom = Math.max(1, history.length - 1);
            for (let i = 0; i < history.length; i++) {
                pts.push({
                    x: padX + (i / denom) * (cw - padX * 2),
                    y: padY + (1 - (history[i] - mn) / range) * (ch - padY * 2)
                });
            }

            // Extract RGB colors for drawing
            let lineR, lineG, lineB;
            if (isLight) {
                lineR = up ? 0.08 : 0.73;
                lineG = up ? 0.60 : 0.11;
                lineB = up ? 0.24 : 0.11;
            } else {
                lineR = up ? 0.66 : 1.0;
                lineG = up ? 0.84 : 0.70;
                lineB = up ? 0.63 : 0.69;
            }

            try {
                let Cairo = imports.gi.cairo;
                let grad = new Cairo.LinearGradient(0, 0, 0, ch);
                grad.addColorStopRGBA(0, lineR, lineG, lineB, isLight ? 0.22 : 0.35);
                grad.addColorStopRGBA(0.8, lineR, lineG, lineB, 0.05);
                grad.addColorStopRGBA(1, lineR, lineG, lineB, 0.0);
                cr.setSource(grad);
            } catch(_) {
                cr.setSourceRGBA(lineR, lineG, lineB, 0.12);
            }

            cr.moveTo(pts[0].x, ch);
            for (let i = 0; i < pts.length; i++) cr.lineTo(pts[i].x, pts[i].y);
            cr.lineTo(pts[pts.length - 1].x, ch);
            cr.closePath();
            cr.fill();

            cr.setSourceRGBA(lineR, lineG, lineB, 0.9);
            cr.setLineWidth(1.5);
            cr.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) cr.lineTo(pts[i].x, pts[i].y);
            cr.stroke();

            if (a.hoverIdx !== undefined && a.hoverIdx !== null) {
                let hidx = a.hoverIdx;
                let hpt = pts[hidx];

                cr.setSourceRGBA(lineR, lineG, lineB, 0.3);
                cr.setLineWidth(1.0);
                cr.setDash([2, 2], 0);
                cr.moveTo(hpt.x, 0);
                cr.lineTo(hpt.x, ch);
                cr.stroke();
                cr.setDash([], 0);

                cr.setSourceRGBA(lineR, lineG, lineB, 0.25);
                cr.arc(hpt.x, hpt.y, 5, 0, 2 * Math.PI);
                cr.fill();

                cr.setSourceRGBA(lineR, lineG, lineB, 1.0);
                cr.arc(hpt.x, hpt.y, 2.5, 0, 2 * Math.PI);
                cr.fill();
            } else {
                let last = pts[pts.length - 1];
                cr.setSourceRGBA(lineR, lineG, lineB, 0.3);
                cr.arc(last.x, last.y, 5.0, 0, 2 * Math.PI);
                cr.fill();

                cr.setSourceRGBA(lineR, lineG, lineB, 1.0);
                cr.arc(last.x, last.y, 2.5, 0, 2 * Math.PI);
                cr.fill();
            }

            cr.$dispose();
        });
    }
}

module.exports = FinanceWidget;
