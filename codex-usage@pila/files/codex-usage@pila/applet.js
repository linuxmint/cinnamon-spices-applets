const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Format = imports.format;

const UUID = 'codex-usage@pila';

Gettext.bindtextdomain(UUID, GLib.build_filenamev([GLib.get_user_data_dir(), 'locale']));

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function compact(value) {
    if (!Number.isFinite(value)) return '—';
    for (const [size, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
        if (value >= size) return (value / size).toFixed(value >= size * 100 ? 0 : 2).replace(/\.00$/, '') + suffix;
    }
    return String(Math.round(value));
}
function resetTime(epoch) {
    const minutes = Math.max(0, Math.ceil((epoch - Date.now() / 1000) / 60));
    if (!minutes) return _('Reset time passed');
    const hours = Math.floor(minutes / 60);
    return hours >= 24 ? _('Reset in %dd %dh').format(Math.floor(hours / 24), hours % 24) : _('Reset in %dh %dm').format(hours, minutes % 60);
}
function localTime(epoch) {
    return Number.isFinite(epoch) ? new Date(epoch * 1000).toLocaleString() : _('Unavailable');
}

class CodexUsageApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._path = metadata.path;
        this._disposed = false;
        this._timer = 0;
        this._deadlineTimer = 0;
        this._process = null;
        this._data = null;
        this._failed = false;
        this.refreshSeconds = 45;
        this.staleSeconds = 300;
        this.displayMode = 'limits';
        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);
        this.set_applet_icon_path(GLib.build_filenamev([this._path, 'icon.png']));
        this._applet_icon_box.add_style_class_name('codex-panel-icon');
        this._applet_label.add_style_class_name('codex-panel-label');
        this._setCompactIconSize();
        this.set_applet_label('5h — · W —');
        this.set_applet_tooltip(_('Local Codex usage · limit percentages used'));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._section = new PopupMenu.PopupMenuSection();
        const scroll = new St.ScrollView({style_class: 'vfade', style: 'max-height: 480px;', x_fill: true, y_fill: false});
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        scroll.add_actor(this._section.actor);
        this.menu.addActor(scroll);
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind('refresh-seconds', 'refreshSeconds', () => this._restart());
        this.settings.bind('stale-seconds', 'staleSeconds', () => this._restart());
        this.settings.bind('display-mode', 'displayMode', () => this._render());
        this._render();
        this._restart();
    }

    _restart() {
        if (this._disposed) return;
        if (this._timer) Mainloop.source_remove(this._timer);
        this._timer = Mainloop.timeout_add_seconds(Math.max(30, Number(this.refreshSeconds) || 45), () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    _setCompactIconSize(panelSize = null) {
        if (!this._applet_icon) return;
        const size = panelSize || this.getPanelIconSize(St.IconType.FULLCOLOR);
        this._applet_icon.set_icon_size(Math.max(14, Math.round(size * 0.8)));
    }

    on_panel_icon_size_changed(size) {
        this._setCompactIconSize(size);
    }

    on_panel_height_changed() {
        this._setCompactIconSize();
    }

    _refresh() {
        if (this._disposed || this._process) return;
        try {
            const process = Gio.Subprocess.new(['python3', GLib.build_filenamev([this._path, 'lib', 'collector.py']), '--cache-dir', GLib.build_filenamev([GLib.get_user_cache_dir(), UUID]), '--stale-seconds', String(this.staleSeconds)], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            this._process = process;
            process.communicate_utf8_async(null, null, (source, result) => {
                if (this._disposed) return;
                this._process = null;
                try {
                    const [, stdout] = source.communicate_utf8_finish(result);
                    if (!source.get_successful()) throw new Error('Collector unavailable');
                    const data = JSON.parse(stdout);
                    if (data.schema_version !== 1 || data.error || !data.today || !data.week || !data.month) throw new Error('Invalid metrics');
                    this._data = data;
                    this._failed = false;
                } catch (_) {
                    this._failed = true;
                }
                this._render();
            });
        } catch (_) {
            this._process = null;
            this._failed = true;
            this._render();
        }
    }

    _fresh(item, limits) {
        const now = Date.now() / 1000;
        return !this._failed && item && !item.stale && Number.isFinite(item.used_percent) && now < item.resets_at && now - limits.observed_at <= this.staleSeconds;
    }

    _scheduleResetDeadline() {
        if (this._deadlineTimer) Mainloop.source_remove(this._deadlineTimer);
        this._deadlineTimer = 0;
        if (this._disposed || !this._data || !this._data.limits) return;
        const now = Date.now() / 1000;
        const resets = ['primary', 'secondary']
            .map(key => this._data.limits[key])
            .filter(item => item && Number.isFinite(item.used_percent) && Number.isFinite(item.resets_at) && item.resets_at > now)
            .map(item => item.resets_at);
        if (!resets.length) return;
        const delay = Math.max(1, Math.ceil((Math.min(...resets) - now) * 1000));
        this._deadlineTimer = Mainloop.timeout_add(delay, () => {
            this._deadlineTimer = 0;
            this._render();
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _row(label, value, style = '') {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        const box = new St.BoxLayout({style_class: 'codex-row'});
        box.add_actor(new St.Label({text: label, x_expand: true, style_class: `codex-popup-text ${style}`}));
        if (value !== undefined) box.add_actor(new St.Label({text: String(value), style_class: 'codex-popup-text'}));
        item.addActor(box);
        this._section.addMenuItem(item);
    }

    _limit(label, value, limits) {
        if (!value || !Number.isFinite(value.used_percent) || !Number.isFinite(value.resets_at) || Date.now() / 1000 >= value.resets_at) value = null;
        const fresh = this._fresh(value, limits);
        this._row(label, value ? (fresh ? _('%d%% used').format(Math.round(value.used_percent)) : _('%d%% used · stale').format(Math.round(value.used_percent))) : _('Unavailable'));
        if (!value) return;
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        const track = new St.Bin({style_class: 'codex-track', x_align: St.Align.START});
        track.set_child(new St.Bin({style_class: 'codex-fill', width: 270 * Math.max(0, Math.min(100, value.used_percent)) / 100}));
        item.addActor(track);
        this._section.addMenuItem(item);
        this._row(resetTime(value.resets_at), undefined, 'codex-note');
    }

    _render() {
        if (this._disposed) return;
        this._scheduleResetDeadline();
        this._section.removeAll();
        this._row(_('CODEX USAGE'), undefined, 'codex-section');
        const data = this._data;
        const limits = data && data.limits || {};
        if (this.displayMode === 'tokens') {
            const total = data ? data.today.total_tokens : null;
            this.set_applet_label(_('%s today').format(`${compact(total)}${this._failed && Number.isFinite(total) ? '*' : ''}`));
            this.set_applet_tooltip(_('Local Codex daily tokens · * = cached statistics; refresh failed · — = unavailable'));
        } else {
            const percentage = value => value && Number.isFinite(value.used_percent) && Number.isFinite(value.resets_at) && Date.now() / 1000 < value.resets_at
                ? `${Math.round(value.used_percent)}%${this._fresh(value, limits) ? '' : '*'}` : '—';
            this.set_applet_label(_('5h %s · W %s').format(percentage(limits.primary), percentage(limits.secondary)));
            this.set_applet_tooltip(_('Codex limit percentages used · * = last observed value, outdated or refresh failed · — = unavailable'));
        }
        if (!data) {
            this._row(this._failed ? _('Usage collector unavailable') : _('Loading…'));
            return;
        }
        if (this._failed) this._row(_('Refresh failed · showing cached statistics'), undefined, 'codex-note');
        if (!data.available) this._row(_('Local Codex data not found'), undefined, 'codex-note');
        this._limit(_('5-hour limit'), limits.primary, limits);
        this._limit(_('Weekly limit'), limits.secondary, limits);
        if (data.limits) this._row(_('Limits observed'), localTime(limits.observed_at), 'codex-note');
        this._row(_('TODAY'), undefined, 'codex-section');
        for (const [label, key] of [[_('Input'), 'input_tokens'], [_('Cached input'), 'cached_input_tokens'], [_('Output'), 'output_tokens'], [_('Reasoning output'), 'reasoning_output_tokens'], [_('Total'), 'total_tokens'], [_('Sessions'), 'sessions']]) this._row(label, compact(data.today[key]));
        this._row(_('Cache share of input'), data.today.cache_percent === null ? '—' : `${data.today.cache_percent.toFixed(1)}%`);
        this._row(_('THIS WEEK'), compact(data.week.total_tokens), 'codex-section');
        this._row(_('THIS MONTH'), compact(data.month.total_tokens), 'codex-section');
        const context = data.context || {};
        this._row(_('Last model'), context.model || _('Unavailable'));
        this._row(_('Last reasoning effort'), context.effort || _('Unavailable'));
        this._row(_('Updated'), localTime(data.updated_at), 'codex-note');
        if (data.warnings) this._row(_('Some records could not be read'), undefined, 'codex-note');
    }

    on_applet_clicked() {
        this._render();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._disposed = true;
        if (this._timer) Mainloop.source_remove(this._timer);
        if (this._deadlineTimer) Mainloop.source_remove(this._deadlineTimer);
        this._timer = 0;
        this._deadlineTimer = 0;
        if (this._process) this._process.force_exit();
        this._process = null;
        if (this.settings) this.settings.finalize();
        if (this.menu) this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CodexUsageApplet(metadata, orientation, panelHeight, instanceId);
}
