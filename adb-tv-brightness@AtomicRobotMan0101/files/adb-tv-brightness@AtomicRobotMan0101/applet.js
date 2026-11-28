const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;

// Editable interface defaults. Device/controller variables use Cinnamon settings.
const UUID = 'adb-tv-brightness@AtomicRobotMan0101';
const REFRESH_SECONDS = 10;
const SLIDER_DELAY_MS = 180;
const COMMAND_TIMEOUT_SECONDS = 30;
const MAX_QUEUED_STEPS = 100;
const ICON = 'display-brightness-symbolic';
const PYTHON = 'python3';
const CONFIG_KEYS = ['device', 'kind', 'namespace', 'key', 'minimum', 'maximum', 'step'];

const LOCALE_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), 'locale']);
const LEGACY_LOCALE_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'locale']);

function _(text) {
    Gettext.bindtextdomain(UUID, LOCALE_DIR);
    const translated = Gettext.dgettext(UUID, text);
    if (translated !== text || LOCALE_DIR === LEGACY_LOCALE_DIR) return translated;
    Gettext.bindtextdomain(UUID, LEGACY_LOCALE_DIR);
    return Gettext.dgettext(UUID, text);
}

class TVBrightness extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._path = metadata.path;
        this._removed = false;
        this._busy = false;
        this._steps = 0;
        this._desired = null;
        this._debounce = 0;
        this._timer = 0;
        this._watchdog = 0;
        this._process = null;
        this._revision = 0;
        this._ready = false;
        this._available = false;
        this.set_applet_icon_symbolic_name(ICON);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._label = new PopupMenu.PopupMenuItem(_('Reading TV brightness…'), {reactive: false});
        this.menu.addMenuItem(this._label);
        this._slider = new PopupMenu.PopupSliderMenuItem(0);
        this.menu.addMenuItem(this._slider);
        this._slider.connect('value-changed', (_slider, value) => {
            if (!this._available) return;
            this._desired = Math.round(value * 100);
            if (this._debounce) Mainloop.source_remove(this._debounce);
            this._debounce = Mainloop.timeout_add(SLIDER_DELAY_MS, () => {
                this._debounce = 0;
                this._pump();
                return GLib.SOURCE_REMOVE;
            });
        });
        this.actor.connect('scroll-event', (_actor, event) => {
            if (!this._available) return Clutter.EVENT_PROPAGATE;
            const direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP) this._steps++;
            else if (direction === Clutter.ScrollDirection.DOWN) this._steps--;
            else return Clutter.EVENT_PROPAGATE;
            this._steps = Math.max(-MAX_QUEUED_STEPS, Math.min(MAX_QUEUED_STEPS, this._steps));
            this._pump();
            return Clutter.EVENT_STOP;
        });
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        for (const key of CONFIG_KEYS)
            this.settings.bind(key, key, () => this._configurationChanged());
        this._ready = true;
        this._timer = Mainloop.timeout_add_seconds(REFRESH_SECONDS, () => {
            this._pump();
            return GLib.SOURCE_CONTINUE;
        });
        this._pump();
    }

    _configurationChanged() {
        if (!this._ready || this._removed) return;
        this._revision++;
        this._steps = 0;
        this._desired = null;
        this._available = false;
        if (this._debounce) {
            Mainloop.source_remove(this._debounce);
            this._debounce = 0;
        }
        this._pump();
    }

    _failure(message) {
        this._available = false;
        this._steps = 0;
        this._desired = null;
        this._slider.actor.reactive = false;
        if (this._debounce) {
            Mainloop.source_remove(this._debounce);
            this._debounce = 0;
        }
        this._label.label.text = _('TV brightness unavailable');
        this.set_applet_tooltip(_('TV brightness: %s').format(message));
    }

    _pump() {
        if (this._busy || this._removed || this._debounce) return;
        if (!this.device.trim()) {
            this._failure(_('Set an ADB device in Configure.'));
            return;
        }
        const config = {};
        for (const key of CONFIG_KEYS) config[key] = this[key];
        let args = ['get', '0'];
        if (this._desired !== null) {
            args = ['set', String(this._desired)];
            this._desired = null;
        } else if (this._steps) {
            args = ['step', String(this._steps)];
            this._steps = 0;
        }
        this._busy = true;
        const revision = this._revision;
        let process;
        let timedOut = false;
        try {
            process = Gio.Subprocess.new(
                [PYTHON, this._path + '/brightness.py', ...args, JSON.stringify(config)],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            this._process = process;
            this._watchdog = Mainloop.timeout_add_seconds(COMMAND_TIMEOUT_SECONDS, () => {
                this._watchdog = 0;
                timedOut = true;
                process.force_exit();
                return GLib.SOURCE_REMOVE;
            });
            process.communicate_utf8_async(null, null, (source, result) => {
                this._busy = false;
                this._process = null;
                if (this._watchdog) {
                    Mainloop.source_remove(this._watchdog);
                    this._watchdog = 0;
                }
                try {
                    const [, output, stderr] = source.communicate_utf8_finish(result);
                    if (this._removed) return;
                    if (revision !== this._revision) {
                        this._pump();
                        return;
                    }
                    if (timedOut) throw new Error(_('ADB command timed out.'));
                    if (!source.get_successful()) throw new Error(stderr.trim() || _('Unable to run the brightness helper.'));
                    const response = JSON.parse(output);
                    if (response.error) throw new Error(response.error);
                    if (!Number.isInteger(response.brightness) || response.brightness < 0 || response.brightness > 100)
                        throw new Error(_('The TV returned an invalid brightness value.'));
                    this._available = true;
                    this._slider.actor.reactive = true;
                    this._label.label.text = _('TV brightness: %d%%').format(response.brightness);
                    this.set_applet_tooltip(_('TV brightness: %d%% - scroll to adjust').format(response.brightness));
                    if (this._desired === null && !this._debounce)
                        this._slider.setValue(response.brightness / 100);
                } catch (error) {
                    if (!this._removed) this._failure(error.message);
                }
                if (!this._removed && (this._steps || this._desired !== null)) this._pump();
            });
        } catch (error) {
            this._busy = false;
            if (this._watchdog) {
                Mainloop.source_remove(this._watchdog);
                this._watchdog = 0;
            }
            if (process) process.force_exit();
            this._process = null;
            this._failure(error.message);
        }
    }

    on_applet_clicked() {
        this.menu.toggle();
        if (this.menu.isOpen) this._pump();
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        for (const key of ['_timer', '_debounce', '_watchdog']) {
            if (this[key]) Mainloop.source_remove(this[key]);
            this[key] = 0;
        }
        this._steps = 0;
        this._desired = null;
        if (this._process) this._process.force_exit();
        this.settings.finalize();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TVBrightness(metadata, orientation, panelHeight, instanceId);
}
