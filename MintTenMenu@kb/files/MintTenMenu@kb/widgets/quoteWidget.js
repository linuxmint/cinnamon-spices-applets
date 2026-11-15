// widgets/quoteWidget.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const WidgetBase = require('./widgets/widgetBase');

const CACHE_FILE = GLib.get_home_dir() + '/.config/wintenmenu/daily_quote.json';

let QUOTES = [];
try {
    QUOTES = require('./widgets/quotes');
} catch (e) {
    global.logError('[QuoteWidget] Error loading quotes dataset: ' + e);
}

function expandPath(p) {
    const HOME = GLib.get_home_dir();
    return (p || '').replace(/^~/, HOME);
}

class QuoteWidget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);
        this._currentQuote = null;
        this._headerBox = null;
        this._authorBox = null;
        this._manualOffset = 0;
        this._lastDate = null;

        this.contentActor.reactive = true;
        this.contentActor.track_hover = true;
        this.contentActor.connect('notify::hover', () => this._onHoverChanged());
        this.contentActor.connect('enter-event', () => this._onHoverChanged());
        this.contentActor.connect('leave-event', () => this._onHoverChanged());

        this._layoutBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this.contentActor.add_child(this._layoutBox);
    }

    _getDateStr() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // djb2 hash algorithm for deterministic quote per date string
    _dateHash(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) {
            h = (((h << 5) >>> 0) + h + str.charCodeAt(i)) >>> 0;
        }
        return h;
    }

    _loadState(todayStr) {
        try {
            if (GLib.file_test(CACHE_FILE, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(CACHE_FILE);
                if (ok) {
                    let text = typeof contents === 'string'
                        ? contents
                        : new TextDecoder('utf-8').decode(contents);
                    let data = JSON.parse(text);
                    if (data) {
                        this._lastDate = todayStr;
                        if (data.date === todayStr) {
                            this._manualOffset = parseInt(data.offset) || 0;
                            if (data.quote) return data.quote;
                        } else {
                            this._manualOffset = 0;
                        }
                    }
                }
            }
        } catch(e) {}
        return null;
    }

    _saveState(todayStr, quote) {
        try {
            const file = Gio.File.new_for_path(CACHE_FILE);
            const parent = file.get_parent();
            if (parent && !parent.query_exists(null)) {
                try { parent.make_directory_with_parents(null); } catch(_) {}
            }
            const content = JSON.stringify({
                date: todayStr,
                offset: this._manualOffset,
                quote: quote
            }, null, 2);
            GLib.file_set_contents(CACHE_FILE, content);
        } catch(e) {}
    }

    buildUI() {
        this._showLoading();
    }

    refresh(forceRefresh = false) {
        const todayStr = this._getDateStr();

        if (forceRefresh) {
            if (todayStr !== this._lastDate) {
                this._manualOffset = 0;
                this._lastDate = todayStr;
            } else {
                this._manualOffset++;
            }
        } else {
            const cached = this._loadState(todayStr);
            if (cached) {
                this._currentQuote = cached;
                this._renderUI(cached);
                this._scheduleDailyTimer();
                return;
            }
        }

        this._getQuoteData((quoteData) => {
            this._currentQuote = quoteData;
            this._saveState(todayStr, quoteData);
            this._renderUI(quoteData);
            this._scheduleDailyTimer();
        });
    }

    _scheduleDailyTimer() {
        const config = this.tileData.config || {};
        const intervalMin = config.refreshIntervalMin || 1440;
        const intervalSec = Math.max(60, intervalMin * 60);

        // Also wake shortly after local midnight so the quote changes on the
        // new day even if the menu stays open (timer only runs while open).
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
        const untilMidnight = Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000));

        this._scheduleRefresh(Math.min(intervalSec, untilMidnight), () => this.refresh(false));
    }

    _onHoverChanged() {
        const isHovered = !!this.contentActor.hover;
        const targetOpacity = isHovered ? 255 : 0;
        const duration = 300;

        if (this._headerBox) {
            this._fadeActor(this._headerBox, targetOpacity, duration);
        }
        if (this._authorBox) {
            this._fadeActor(this._authorBox, targetOpacity, duration);
        }
    }

    _fadeActor(actor, targetOpacity, durationMs) {
        if (!actor) return;
        actor.save_easing_state();
        actor.set_easing_duration(durationMs);
        actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
        actor.opacity = targetOpacity;
        actor.restore_easing_state();
    }

    _getQuoteData(callback) {
        const config = this.tileData.config || {};

        // If user configured a specific file path or custom fortune params, attempt fortune/file read first
        if (config.file || config.fortuneParams) {
            const rawFile = (config.file || '').trim();
            const filePath = expandPath(rawFile);
            const fortuneParamsStr = (config.fortuneParams || '').trim();
            const fortuneParams = fortuneParamsStr.length > 0 ? fortuneParamsStr.split(/\s+/) : [];

            let argv = ['fortune'];
            if (fortuneParams.length > 0) argv.push(...fortuneParams);
            if (filePath.length > 0) argv.push(filePath);

            this._spawnAsync(argv, (out, err) => {
                if (!err && out && out.trim().length > 0) {
                    callback(this._parseQuoteText(out.trim()));
                    return;
                }

                if (filePath.length > 0 && GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                    try {
                        let [ok, contents] = GLib.file_get_contents(filePath);
                        if (ok) {
                            let text = typeof contents === 'string'
                                ? contents
                                : new TextDecoder('utf-8').decode(contents);
                            let entries = text.split(/\r?\n%\r?\n|\r?\n%/).map(s => s.trim()).filter(s => s.length > 0);
                            if (entries.length > 0) {
                                let idx = Math.floor(Math.random() * entries.length);
                                callback(this._parseQuoteText(entries[idx]));
                                return;
                            }
                        }
                    } catch(e) {}
                }

                // Fallback to local desklet quote dataset if custom source unavailable
                callback(this._getDeskletQuote());
            });
            return;
        }

        // Default: Use local quotes dataset matching desklet logic
        callback(this._getDeskletQuote());
    }

    _getDeskletQuote() {
        const quotes = (Array.isArray(QUOTES) && QUOTES.length > 0) ? QUOTES : [];
        if (quotes.length === 0) {
            return { body: '', author: '', source: '' };
        }

        const dateStr = this._getDateStr();
        if (dateStr !== this._lastDate) {
            this._manualOffset = 0;
            this._lastDate = dateStr;
        }

        const base = this._dateHash(dateStr) % quotes.length;
        const idx = (base + this._manualOffset) % quotes.length;
        const q = quotes[idx];

        return {
            body: q.text || q.body || '',
            author: q.author || '',
            source: q.source || ''
        };
    }

    _parseQuoteText(rawText) {
        let raw = (rawText || '').trim();
        let body = raw;
        let author = '';

        let match = raw.match(/([\s\S]+?)\r?\n(?:\t|\s)*--\s*([\s\S]+)/);
        if (match) {
            body = match[1].trim();
            author = match[2].trim();
        }

        return { body, author, source: '' };
    }

    _calculateQuoteLayout(quoteText) {
        const topBarH = 20;
        const bottomBarH = 20;

        // Pick font size based on text length
        let fontSize = 12;
        if (quoteText.length > 180) {
            fontSize = 10.5;
        } else if (quoteText.length > 120) {
            fontSize = 11;
        } else if (quoteText.length < 60) {
            fontSize = 13;
        }

        return { fontSize, topBarH, bottomBarH };
    }

    _renderUI(quoteData) {
        this._layoutBox.remove_all_children();

        const isHovered = !!this.contentActor.hover;
        const initOpacity = isHovered ? 255 : 0;

        let quoteText = quoteData.body || '';
        if (quoteText && !quoteText.startsWith('“') && !quoteText.startsWith('"')) {
            quoteText = '“' + quoteText + '”';
        }

        const layout = this._calculateQuoteLayout(quoteText);

        const bodyLabel = new St.Label({
            text: quoteText,
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            style: `color: #ffffff; font-size: ${layout.fontSize}px; font-style: italic; font-weight: 500; font-family: "Inter", sans-serif; text-align: center; width: 100%;`
        });
        bodyLabel.set_x_align(Clutter.ActorAlign.FILL);
        bodyLabel.set_y_align(Clutter.ActorAlign.CENTER);
        bodyLabel.clutter_text.set_line_wrap(true);
        bodyLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        bodyLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        bodyLabel.clutter_text.set_line_alignment(Pango.Alignment.CENTER);

        // Root vertical box filling tile container
        const root = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            style: 'background-color: transparent; padding: 4px 10px;'
        });
        this._layoutBox.add_child(root);

        // 1. TOP BAR: Refresh button right-aligned
        const topRow = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: false,
            style: `min-height: ${layout.topBarH}px; height: ${layout.topBarH}px;`
        });
        root.add_child(topRow);

        topRow.add_child(new St.Widget({ x_expand: true }));

        this._headerBox = new St.BoxLayout({
            vertical: false,
            opacity: initOpacity
        });
        topRow.add_child(this._headerBox);

        const refBtn = new St.Button({
            label: '↻',
            reactive: true,
            style: 'color: rgba(255,255,255,0.6); font-size: 13px; font-weight: bold; background-color: transparent; padding: 0px 4px;'
        });
        refBtn.connect('enter-event', () => { refBtn.style = 'color: #ffffff; font-size: 13px; font-weight: bold; background-color: rgba(255,255,255,0.15); border-radius: 4px; padding: 0px 4px;'; });
        refBtn.connect('leave-event', () => { refBtn.style = 'color: rgba(255,255,255,0.6); font-size: 13px; font-weight: bold; background-color: transparent; padding: 0px 4px;'; });
        refBtn.connect('clicked', () => this.refresh(true));
        this._headerBox.add_child(refBtn);

        // 2. MAIN QUOTE STRING: fills the space between the bars and stays
        //    vertically centred via symmetric expanding spacers.
        const quoteBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL
        });
        root.add_child(quoteBox);
        quoteBox.add_child(new St.Widget({ y_expand: true }));
        quoteBox.add_child(bodyLabel);
        quoteBox.add_child(new St.Widget({ y_expand: true }));

        // 3. BOTTOM BAR: Author name right-aligned
        const bottomRow = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: false,
            style: `min-height: ${layout.bottomBarH}px; height: ${layout.bottomBarH}px;`
        });
        root.add_child(bottomRow);

        bottomRow.add_child(new St.Widget({ x_expand: true }));

        this._authorBox = new St.BoxLayout({
            vertical: false,
            opacity: 255
        });
        bottomRow.add_child(this._authorBox);

        if (quoteData.author && quoteData.author.length > 0) {
            let authorStr = '— ' + quoteData.author;
            if (quoteData.source && quoteData.source.length > 0) {
                authorStr += ' (' + quoteData.source + ')';
            }
            const authorLabel = new St.Label({
                text: authorStr,
                style: 'color: rgba(255, 255, 255, 0.7); font-size: 10px; font-weight: 700; font-family: "Inter", sans-serif; text-align: right;'
            });
            authorLabel.clutter_text.set_line_wrap(false);
            authorLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            this._authorBox.add_child(authorLabel);
        }
    }
}

module.exports = QuoteWidget;
