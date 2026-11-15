// widgets/widgetSettingsPopover.js
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib    = imports.gi.GLib;

// ─── Helpers ────────────────────────────────────────────────────────────────

function label(text) {
    return new St.Label({
        text,
        style: 'color: rgba(255,255,255,0.65); font-size: 11px; font-family: "Inter", sans-serif; margin-bottom: 4px;'
    });
}

function entry(text, hint) {
    const e = new St.Entry({
        text: text || '',
        hint_text: hint || '',
        can_focus: true,
        x_expand: true,
        style: 'background-color: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); ' +
               'border-radius: 6px; padding: 7px 10px; color: white; font-size: 12px; ' +
               'font-family: "Inter", sans-serif;'
    });
    return e;
}

function sectionLabel(text) {
    return new St.Label({
        text: text.toUpperCase(),
        style: 'color: rgba(255,255,255,0.35); font-size: 9px; font-weight: bold; ' +
               'letter-spacing: 0.5px; font-family: "Inter", sans-serif; margin-top: 8px; margin-bottom: 6px;'
    });
}

function divider() {
    return new St.Widget({
        style: 'background-color: rgba(255,255,255,0.08); height: 1px; min-height: 1px; margin: 10px 0;'
    });
}

// ─── Main Class ──────────────────────────────────────────────────────────────

class WidgetSettingsPopover {
    constructor(applet, tileData, widget) {
        this.applet   = applet;
        this.tileData = tileData;
        this.widget   = widget;
        this._actor   = null;
        this._config  = { ...(tileData.config || {}) };
    }

    show() {
        // Close any existing popover
        if (this.applet._settingsPopover) {
            try { this.applet._settingsPopover.close(); } catch(e) {}
        }
        this.applet._settingsPopover = this;

        // ── Root panel ───────────────────────────────────────────────────────
        this._actor = new St.BoxLayout({
            vertical:  true,
            reactive:  true,
            style: 'background-color: #1c1c1c; ' +
                   'border: 1px solid rgba(255,255,255,0.12); ' +
                   'border-radius: 10px; ' +
                   'padding: 20px 20px 16px 20px; ' +
                   'min-width: 310px; max-width: 380px;'
        });

        // Swallow all clicks so they don't fall through to the tile grid
        this._actor.connect('button-press-event',   () => Clutter.EVENT_STOP);
        this._actor.connect('button-release-event', () => Clutter.EVENT_STOP);

        // ── Header ───────────────────────────────────────────────────────────
        const kind = this.tileData.widgetKind || '';
        let kindName = kind.charAt(0).toUpperCase() + kind.slice(1);
        if (kind === 'tasks' || kind === 'todo') kindName = 'ToDo';

        const headerRow = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 14px;' });
        this._actor.add_child(headerRow);

        headerRow.add_child(new St.Label({
            text: kindName + ' Widget Settings',
            x_expand: true,
            style: 'color: white; font-size: 14px; font-weight: bold; font-family: "Inter", sans-serif;'
        }));

        const closeBtn = new St.Button({
            label: '✕',
            reactive: true,
            style: 'color: rgba(255,255,255,0.5); font-size: 14px; background-color: transparent; padding: 0 2px;'
        });
        closeBtn.connect('enter-event', () => { closeBtn.style = 'color: white; font-size: 14px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('leave-event', () => { closeBtn.style = 'color: rgba(255,255,255,0.5); font-size: 14px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('clicked', () => this.close());
        headerRow.add_child(closeBtn);

        // ── Form area ────────────────────────────────────────────────────────
        const formBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._actor.add_child(formBox);

        this._buildFields(formBox, kind);

        // ── Divider + Buttons ─────────────────────────────────────────────────
        this._actor.add_child(divider());

        const btnRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px;',
            x_align: Clutter.ActorAlign.END
        });
        this._actor.add_child(btnRow);

        const cancelBtn = new St.Button({
            label: 'Cancel',
            reactive: true,
            style: 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); ' +
                   'padding: 7px 18px; border-radius: 6px; font-size: 12px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'
        });
        cancelBtn.connect('enter-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.14); color: white; padding: 7px 18px; border-radius: 6px; font-size: 12px; border: 1px solid rgba(255,255,255,0.2); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('leave-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); padding: 7px 18px; border-radius: 6px; font-size: 12px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('clicked', () => this.close());
        btnRow.add_child(cancelBtn);

        const saveBtn = new St.Button({
            label: 'Save',
            reactive: true,
            style: 'background-color: #0078D4; color: white; padding: 7px 18px; border-radius: 6px; ' +
                   'font-size: 12px; font-weight: bold; font-family: "Inter", sans-serif;'
        });
        saveBtn.connect('enter-event', () => { saveBtn.style = 'background-color: #1084e4; color: white; padding: 7px 18px; border-radius: 6px; font-size: 12px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        saveBtn.connect('leave-event', () => { saveBtn.style = 'background-color: #0078D4; color: white; padding: 7px 18px; border-radius: 6px; font-size: 12px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        saveBtn.connect('clicked', () => this._save());
        btnRow.add_child(saveBtn);

        // ── Attach + position (deferred to after layout) ──────────────────────
        if (this.applet._menuContainer) {
            this._actor.hide();
            this.applet._menuContainer.add_actor(this._actor);
            this.applet._settingsPopoverActor = this._actor;

            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (!this._actor || !this._actor.get_parent()) return GLib.SOURCE_REMOVE;
                const W = (this.applet.settings.customMenuWidth  || 940) * global.ui_scale;
                const H = (this.applet.settings.customMenuHeight || 640) * global.ui_scale;
                const [,, mw, mh] = this._actor.get_preferred_size();
                const pw = mw || 330;
                const ph = mh || 300;
                this._actor.set_position(Math.round((W - pw) / 2), Math.round((H - ph) / 2));
                this._actor.show();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    close() {
        if (this._actor) {
            try {
                const p = this._actor.get_parent();
                if (p) p.remove_child(this._actor);
            } catch(e) {}
            try { this._actor.destroy(); } catch(e) {}
            this._actor = null;
        }
        if (this.applet._settingsPopover === this) this.applet._settingsPopover = null;
        if (this.applet._settingsPopoverActor && !this.applet._settingsPopoverActor.get_parent()) {
            this.applet._settingsPopoverActor = null;
        }
    }

    // ── Per-widget form builders ──────────────────────────────────────────────

    _buildFields(box, kind) {
        if (kind === 'finance' || kind === 'forex') this._buildFinance(box);
        else if (kind === 'weather' || kind === 'weather2')  this._buildWeather(box);
        else if (kind === 'calendar')   this._buildCalendar(box);
        else if (kind === 'tasks' || kind === 'todo')  this._buildTodo(box);
        else if (kind === 'screentime') this._buildScreentime(box);
        else if (kind === 'quote')      this._buildQuote(box);
    }

    // ── FINANCE / STOCKS / FOREX ──────────────────────────────────────────────
    _buildFinance(box) {
        box.add_child(sectionLabel('Stock / Asset Symbol'));
        box.add_child(label('Enter symbol (e.g. AAPL, EUR/USD, BTC-USD, GC=F for Gold, SI=F for Silver)'));
        box.add_child(label('Tip: append /INR to convert prices — e.g. GC=F/INR, SI=F/INR, AAPL/INR'));

        const initSymbol = this._config.symbol || this._config.currencyPairs || 'AAPL';
        this._symbolEntry = entry(initSymbol, 'e.g. AAPL, GC=F/INR, EUR/USD');
        box.add_child(this._symbolEntry);

        // Quick Preset Chips for Popular Stocks & Assets
        box.add_child(sectionLabel('Popular Symbols'));
        const presetGrid = new St.BoxLayout({ vertical: true, style: 'spacing: 4px; margin-bottom: 8px;' });
        box.add_child(presetGrid);

        const row1 = new St.BoxLayout({ vertical: false, style: 'spacing: 6px;' });
        const row2 = new St.BoxLayout({ vertical: false, style: 'spacing: 6px;' });
        presetGrid.add_child(row1);
        presetGrid.add_child(row2);

        const popular = [
            { name: 'AAPL', sym: 'AAPL' },
            { name: 'NVDA', sym: 'NVDA' },
            { name: 'MSFT', sym: 'MSFT' },
            { name: 'TSLA', sym: 'TSLA' },
            { name: 'AMZN', sym: 'AMZN' },
            { name: 'GOOGL', sym: 'GOOGL' },
            { name: 'SPY', sym: 'SPY' },
            { name: 'EUR/USD', sym: 'EUR/USD' },
            { name: 'BTC', sym: 'BTC-USD' },
        ];

        const commodities = [
            { name: '🥇 Gold / INR', sym: 'GC=F/INR' },
            { name: '🥈 Silver / INR', sym: 'SI=F/INR' },
        ];

        popular.forEach((item, idx) => {
            const btn = new St.Button({
                label: item.name,
                reactive: true,
                style: 'background-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); ' +
                       'padding: 3px 8px; border-radius: 4px; font-size: 10px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'
            });
            btn.connect('clicked', () => {
                this._symbolEntry.set_text(item.sym);
            });
            if (idx < 5) row1.add_child(btn);
            else row2.add_child(btn);
        });

        // Commodities row (₹ INR)
        box.add_child(sectionLabel('Commodities (₹ INR)'));
        const row3 = new St.BoxLayout({ vertical: false, style: 'spacing: 6px;' });
        box.add_child(row3);
        commodities.forEach((item) => {
            const btn = new St.Button({
                label: item.name,
                reactive: true,
                style: 'background-color: rgba(212,175,55,0.15); color: rgba(255,220,100,0.95); ' +
                       'padding: 3px 10px; border-radius: 4px; font-size: 10px; border: 1px solid rgba(212,175,55,0.35); font-family: "Inter", sans-serif;'
            });
            btn.connect('clicked', () => {
                this._symbolEntry.set_text(item.sym);
            });
            row3.add_child(btn);
        });

        box.add_child(divider());
        box.add_child(sectionLabel('Chart Period'));

        const periodRow = new St.BoxLayout({ vertical: false, style: 'spacing: 8px;' });
        box.add_child(periodRow);

        const periods = [
            { label: '5 Days',   value: '5D' },
            { label: '1 Month',  value: '1M' },
            { label: '3 Months', value: '3M' },
            { label: '1 Year',   value: '1Y' }
        ];

        this._activePeriod = this._config.chartPeriod || '1M';
        this._periodChips = [];

        periods.forEach((p) => {
            const isSel = (p.value === this._activePeriod);
            const chip = this._modeChip(p.label, isSel);
            chip.connect('clicked', () => {
                this._activePeriod = p.value;
                this._periodChips.forEach(item => {
                    item.chip.style = this._chipStyle(item.value === this._activePeriod);
                });
            });
            this._periodChips.push({ chip, value: p.value });
            periodRow.add_child(chip);
        });

        box.add_child(divider());
        box.add_child(sectionLabel('Theme Mode'));

        const themeRow = new St.BoxLayout({ vertical: false, style: 'spacing: 8px;' });
        box.add_child(themeRow);

        this._activeThemeMode = this._config.themeMode || 'dark';

        this._darkThemeBtn  = this._modeChip('🌙 Dark Mode',  this._activeThemeMode === 'dark');
        this._lightThemeBtn = this._modeChip('☀️ Light Mode', this._activeThemeMode === 'light');

        this._darkThemeBtn.connect('clicked', () => {
            this._activeThemeMode = 'dark';
            this._darkThemeBtn.style  = this._chipStyle(true);
            this._lightThemeBtn.style = this._chipStyle(false);
        });

        this._lightThemeBtn.connect('clicked', () => {
            this._activeThemeMode = 'light';
            this._darkThemeBtn.style  = this._chipStyle(false);
            this._lightThemeBtn.style = this._chipStyle(true);
        });

        themeRow.add_child(this._darkThemeBtn);
        themeRow.add_child(this._lightThemeBtn);
    }

    // ── WEATHER ───────────────────────────────────────────────────────────────
    _buildWeather(box) {
        box.add_child(sectionLabel('Location'));

        // Auto / Custom toggle
        const isAuto = !this._config.locations || this._config.locations.length === 0 ||
                       (this._config.locations.length === 1 && this._config.locations[0] === '');
        this._weatherAuto = isAuto;

        const modeRow = new St.BoxLayout({ vertical: false, style: 'spacing: 8px; margin-bottom: 8px;' });
        box.add_child(modeRow);

        this._autoBtn   = this._modeChip('Automatic', isAuto);
        this._customBtn = this._modeChip('Custom', !isAuto);

        this._autoBtn.connect('clicked', () => {
            this._weatherAuto = true;
            this._autoBtn.style   = this._chipStyle(true);
            this._customBtn.style = this._chipStyle(false);
            this._locRow.visible = false;
        });
        this._customBtn.connect('clicked', () => {
            this._weatherAuto = false;
            this._autoBtn.style   = this._chipStyle(false);
            this._customBtn.style = this._chipStyle(true);
            this._locRow.visible = true;
        });

        modeRow.add_child(this._autoBtn);
        modeRow.add_child(this._customBtn);

        // Custom location row
        this._locRow = new St.BoxLayout({ vertical: true, visible: !isAuto });
        box.add_child(this._locRow);
        this._locRow.add_child(label('Locations (comma-separated, e.g. London, New York)'));
        const locsText = (this._config.locations || []).filter(l => l !== '').join(', ');
        this._locEntry = entry(locsText, 'London, Mumbai, New York');
        this._locRow.add_child(this._locEntry);

        // Icon style
        box.add_child(divider());
        box.add_child(sectionLabel('Icon Style'));
        const styleRow = new St.BoxLayout({ vertical: false, style: 'spacing: 8px;' });
        box.add_child(styleRow);
        const isStatic = this._config.iconStyle === 'static';
        this._animChip   = this._modeChip('Animated', !isStatic);
        this._staticChip = this._modeChip('Static',   isStatic);
        this._animChip.connect('clicked', () => {
            this._config.iconStyle = 'animated';
            this._animChip.style   = this._chipStyle(true);
            this._staticChip.style = this._chipStyle(false);
        });
        this._staticChip.connect('clicked', () => {
            this._config.iconStyle = 'static';
            this._animChip.style   = this._chipStyle(false);
            this._staticChip.style = this._chipStyle(true);
        });
        styleRow.add_child(this._animChip);
        styleRow.add_child(this._staticChip);
    }

    _modeChip(text, active) {
        const btn = new St.Button({ label: text, reactive: true, style: this._chipStyle(active) });
        return btn;
    }

    _chipStyle(active) {
        return active
            ? 'background-color: #0078D4; color: white; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-family: "Inter", sans-serif;'
            : 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); padding: 5px 14px; border-radius: 20px; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); font-family: "Inter", sans-serif;';
    }

    // ── CALENDAR ──────────────────────────────────────────────────────────────
    _buildCalendar(box) {
        box.add_child(sectionLabel('First Day of Week'));

        const firstDay = (this._config.firstDayOfWeek === 1) ? 1 : 0;
        this._firstDayOfWeek = firstDay;

        const weekRow = new St.BoxLayout({ vertical: false, style: 'spacing: 8px; margin-bottom: 8px;' });
        box.add_child(weekRow);

        this._sunBtn = this._modeChip('Sunday', firstDay === 0);
        this._monBtn = this._modeChip('Monday', firstDay === 1);

        this._sunBtn.connect('clicked', () => {
            this._firstDayOfWeek = 0;
            this._sunBtn.style = this._chipStyle(true);
            this._monBtn.style = this._chipStyle(false);
        });

        this._monBtn.connect('clicked', () => {
            this._firstDayOfWeek = 1;
            this._sunBtn.style = this._chipStyle(false);
            this._monBtn.style = this._chipStyle(true);
        });

        weekRow.add_child(this._sunBtn);
        weekRow.add_child(this._monBtn);
    }

    // ── TODO ──────────────────────────────────────────────────────────────────
    _buildTodo(box) {
        box.add_child(sectionLabel('Local File'));
        box.add_child(label('Local File Path'));
        this._filePathEntry = entry(this._config.filePath || '', '~/.config/wintenmenu/todo.json');
        box.add_child(this._filePathEntry);
    }

    // ── SCREEN TIME ────────────────────────────────────────────────────────────
    _buildScreentime(box) {
        box.add_child(sectionLabel('Display & Data'));
        box.add_child(label('CSV Log Path'));
        this._csvPathEntry = entry(this._config.csvPath || '', '~/.config/screentime-desklet/uptime_log.csv');
        box.add_child(this._csvPathEntry);

        box.add_child(label('Logical Midnight (HH:MM)'));
        this._midnightEntry = entry(this._config.logicalMidnight || '06:00', '06:00');
        box.add_child(this._midnightEntry);

        box.add_child(divider());
        box.add_child(sectionLabel('Hours Limits'));
        
        box.add_child(label('Warn Threshold (Hours)'));
        this._warnEntry = entry(String(this._config.limitWarn || 8), '8');
        box.add_child(this._warnEntry);

        box.add_child(label('Critical Threshold (Hours)'));
        this._critEntry = entry(String(this._config.limitCrit || 12), '12');
        box.add_child(this._critEntry);

        box.add_child(label('Max Chart Limit (Hours)'));
        this._maxEntry = entry(String(this._config.limitMax || 16), '16');
        box.add_child(this._maxEntry);
    }

    // ── QUOTE OF THE DAY ───────────────────────────────────────────────────────
    _buildQuote(box) {
        box.add_child(sectionLabel('Fortune Source'));
        box.add_child(label('Fortune File Path (optional — leave blank for default)'));
        this._quoteFileEntry = entry(this._config.file || '', '/usr/share/games/fortunes/literature');
        box.add_child(this._quoteFileEntry);

        box.add_child(label('Fortune Command Parameters (e.g. -s)'));
        this._fortuneParamsEntry = entry(this._config.fortuneParams || '', '-s');
        box.add_child(this._fortuneParamsEntry);

        box.add_child(divider());
        box.add_child(sectionLabel('Refresh Interval'));
        box.add_child(label('Update delay in minutes'));
        this._quoteDelayEntry = entry(String(this._config.refreshIntervalMin || 1440), '1440');
        box.add_child(this._quoteDelayEntry);
    }

    // ── Save & apply ──────────────────────────────────────────────────────────
    _save() {
        const kind = this.tileData.widgetKind || '';

        if (kind === 'finance' || kind === 'forex') {
            const sym = (this._symbolEntry ? this._symbolEntry.get_text() : 'AAPL').trim().toUpperCase();
            this._config.symbol        = sym;
            this._config.currencyPairs = sym;
            this._config.chartPeriod   = this._activePeriod || '1M';
            this._config.themeMode     = this._activeThemeMode || 'dark';



        } else if (kind === 'weather' || kind === 'weather2') {
            if (this._weatherAuto) {
                this._config.locations = [''];
            } else {
                const raw = this._locEntry.get_text() || '';
                this._config.locations = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                if (this._config.locations.length === 0) this._config.locations = [''];
            }

        } else if (kind === 'calendar') {
            this._config.firstDayOfWeek = (this._firstDayOfWeek === 1) ? 1 : 0;

        } else if (kind === 'tasks' || kind === 'todo') {
            if (this._filePathEntry) {
                this._config.filePath = this._filePathEntry.get_text().trim();
            }
            // Drop keys from the removed Google Tasks backend
            delete this._config.mode;
            delete this._config.tokenPath;
            delete this._config.credentialsPath;
            delete this._config.maxTasks;

        } else if (kind === 'screentime') {
            this._config.csvPath         = this._csvPathEntry.get_text().trim();
            this._config.logicalMidnight = this._midnightEntry.get_text().trim() || '06:00';
            this._config.limitWarn       = Math.max(1, parseInt(this._warnEntry.get_text()) || 8);
            this._config.limitCrit       = Math.max(1, parseInt(this._critEntry.get_text()) || 12);
            this._config.limitMax        = Math.max(1, parseInt(this._maxEntry.get_text()) || 16);

        } else if (kind === 'quote') {
            this._config.file               = this._quoteFileEntry.get_text().trim();
            this._config.fortuneParams      = this._fortuneParamsEntry.get_text().trim();
            this._config.refreshIntervalMin = Math.max(1, parseInt(this._quoteDelayEntry.get_text()) || 1440);
        }

        // Write config back
        this.tileData.config = this._config;

        // Save layout
        if (this.applet._tileArea && this.applet._tileArea.layoutEngine) {
            this.applet._tileArea.layoutEngine.save();
        }

        // Re-render tile + widget
        if (this.applet._tileArea && this.applet._tileArea._groups) {
            for (const g of this.applet._tileArea._groups) {
                for (const t of g._tiles) {
                    if (t.data.id === this.tileData.id) {
                        try { t.refreshStyle(); } catch(e) {}
                        break;
                    }
                }
            }
        }

        if (this.widget) {
            try { this.widget.refresh(); } catch(e) {}
        }

        this.close();
    }
}

module.exports = WidgetSettingsPopover;
