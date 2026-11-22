/*
 * Desktop Icons Toggle - a Cinnamon panel applet
 *
 * Left click  : hide / show the desktop icons (toggle switch).
 * Right click : switch in the menu, plus solid colour background options.
 *
 * Written for Cinnamon 6.x (Linux Mint 22.x). Desktop icons are drawn by
 * nemo-desktop, so this flips the same setting that
 * System Settings > Desktop uses (org.nemo.desktop desktop-layout).
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;

const UUID = 'desktop-icons-toggle@Toomanyhurdles';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const NEMO_DESKTOP_SCHEMA = 'org.nemo.desktop';
const BACKGROUND_SCHEMA = 'org.cinnamon.desktop.background';
const SLIDESHOW_SCHEMA = 'org.cinnamon.desktop.background.slideshow';

const LAYOUT_KEY = 'desktop-layout';
const LAYOUT_NONE = 'false::false';
const LAYOUT_DEFAULT = 'true::false';
const SHOW_ICONS_KEY = 'show-desktop-icons';

const PRESETS = [
    [_('Black'), '#000000'],
    [_('Charcoal'), '#2b2b2b'],
    [_('Slate'), '#2e3440'],
    [_('Navy'), '#1b2a41'],
    [_('Teal'), '#1f6f6b'],
    [_('Mint green'), '#35a854'],
    [_('Plum'), '#4a2545'],
    [_('Grey'), '#808080'],
    [_('White'), '#ffffff']
];

function schemaExists(id) {
    return Gio.SettingsSchemaSource.get_default().lookup(id, true) !== null;
}

function hasKey(gsettings, key) {
    return gsettings.settings_schema.has_key(key);
}

/* Accepts "#rgb", "#rrggbb", "#rrrrggggbbbb", "rgb(r,g,b)" or "rgba(r,g,b,a)"
 * and returns "#rrggbb", or null if it can't be understood. */
function toHex(value) {
    if (!value)
        return null;
    let s = String(value).trim();

    let m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
        let parts = [m[1], m[2], m[3]].map(n => {
            let v = Math.max(0, Math.min(255, parseInt(n, 10)));
            return ('0' + v.toString(16)).slice(-2);
        });
        return '#' + parts.join('');
    }

    m = s.match(/^#([0-9a-f]+)$/i);
    if (m) {
        let h = m[1].toLowerCase();
        if (h.length === 3)
            return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length === 6)
            return '#' + h;
        if (h.length === 12)
            return '#' + h.slice(0, 2) + h.slice(4, 6) + h.slice(8, 10);
    }
    return null;
}

function swatchStyle(hex) {
    return 'background-color: ' + hex + ';' +
           'border: 1px solid rgba(128,128,128,0.7);' +
           'border-radius: 3px;' +
           'width: 16px; height: 16px;';
}

class DesktopIconsToggleApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._signals = [];

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind('custom-color', 'customColor', () => this._updateCustomSwatch());

        this.nemo = schemaExists(NEMO_DESKTOP_SCHEMA)
            ? new Gio.Settings({ schema_id: NEMO_DESKTOP_SCHEMA }) : null;
        this.background = new Gio.Settings({ schema_id: BACKGROUND_SCHEMA });
        this.slideshow = schemaExists(SLIDESHOW_SCHEMA)
            ? new Gio.Settings({ schema_id: SLIDESHOW_SCHEMA }) : null;

        this._buildMenu();

        if (this.nemo) {
            this._signals.push(this.nemo.connect('changed', () => this._sync()));
        }
        this._sync();
    }

    /* ---------- desktop icons ---------- */

    _iconsVisible() {
        if (!this.nemo)
            return true;
        if (hasKey(this.nemo, SHOW_ICONS_KEY) && !this.nemo.get_boolean(SHOW_ICONS_KEY))
            return false;
        if (hasKey(this.nemo, LAYOUT_KEY))
            return this.nemo.get_string(LAYOUT_KEY) !== LAYOUT_NONE;
        return true;
    }

    _setIconsVisible(visible) {
        if (!this.nemo)
            return;

        if (hasKey(this.nemo, LAYOUT_KEY)) {
            if (visible) {
                if (hasKey(this.nemo, SHOW_ICONS_KEY) && !this.nemo.get_boolean(SHOW_ICONS_KEY))
                    this.nemo.set_boolean(SHOW_ICONS_KEY, true);
                let layout = this.settings.getValue('saved-layout');
                if (!layout || layout === LAYOUT_NONE)
                    layout = LAYOUT_DEFAULT;
                this.nemo.set_string(LAYOUT_KEY, layout);
            } else {
                // Remember which monitors had icons so we can put them back.
                let current = this.nemo.get_string(LAYOUT_KEY);
                if (current !== LAYOUT_NONE)
                    this.settings.setValue('saved-layout', current);
                this.nemo.set_string(LAYOUT_KEY, LAYOUT_NONE);
            }
        } else if (hasKey(this.nemo, SHOW_ICONS_KEY)) {
            // Older Nemo: only the simple on/off key exists.
            this.nemo.set_boolean(SHOW_ICONS_KEY, visible);
        }
        this._sync();
    }

    _sync() {
        let visible = this._iconsVisible();
        let icon = visible ? 'toggle-on-symbolic.svg' : 'toggle-off-symbolic.svg';
        this.set_applet_icon_symbolic_path(this.metadata.path + '/icons/' + icon);
        this.actor.opacity = visible ? 255 : 170;

        if (!this.nemo)
            this.set_applet_tooltip(_('Desktop icons: Nemo desktop settings not found'));
        else
            this.set_applet_tooltip(visible
                ? _('Desktop icons: shown (click to hide)')
                : _('Desktop icons: hidden (click to show)'));

        if (this._switchItem && this._switchItem.state !== visible)
            this._switchItem.setToggleState(visible);
    }

    on_applet_clicked() {
        this._setIconsVisible(!this._iconsVisible());
    }

    /* ---------- solid colour background ---------- */

    _applySolidColour(value) {
        let hex = toHex(value);
        if (!hex)
            return;

        // Remember how the wallpaper was displayed so it can be restored.
        let options = this.background.get_string('picture-options');
        if (options !== 'none')
            this.settings.setValue('saved-picture-options', options);

        if (this.slideshow && this.slideshow.get_boolean('slideshow-enabled')) {
            this.settings.setValue('saved-slideshow', true);
            this.slideshow.set_boolean('slideshow-enabled', false);
        }

        this.background.set_string('primary-color', hex);
        this.background.set_string('secondary-color', hex);
        this.background.set_string('color-shading-type', 'solid');
        this.background.set_string('picture-options', 'none');
    }

    restoreWallpaper() {
        let options = this.settings.getValue('saved-picture-options');
        if (!options || options === 'none')
            options = 'zoom';
        this.background.set_string('picture-options', options);

        if (this.slideshow && this.settings.getValue('saved-slideshow')) {
            this.slideshow.set_boolean('slideshow-enabled', true);
            this.settings.setValue('saved-slideshow', false);
        }
    }

    applyCustomColor() {
        this._applySolidColour(this.customColor);
    }

    _chooseColour() {
        let start = toHex(this.customColor) || '#2e3440';
        let cmd = 'zenity --color-selection' +
                  ' --title=' + GLib.shell_quote(_('Desktop background colour')) +
                  ' --color=' + GLib.shell_quote(start);
        try {
            Util.spawnCommandLineAsyncIO(cmd, (stdout, stderr, exitCode) => {
                if (exitCode !== 0)
                    return; // cancelled
                let hex = toHex(stdout);
                if (!hex)
                    return;
                this.settings.setValue('custom-color', hex);
                this.customColor = hex;
                this._updateCustomSwatch();
                this._applySolidColour(hex);
            });
        } catch (e) {
            // No zenity: fall back to the colour button in the applet's settings.
            global.logError('desktop-icons-toggle: could not run zenity: ' + e);
            this.configureApplet();
        }
    }

    /* ---------- right-click menu ---------- */

    _colourItem(label, hex) {
        let item = new PopupMenu.PopupMenuItem(label);
        let swatch = new St.Bin({ style: swatchStyle(hex) });
        item.addActor(swatch, { span: -1, align: St.Align.END });
        item._swatch = swatch;
        return item;
    }

    _updateCustomSwatch() {
        if (this._customItem && this._customItem._swatch) {
            let hex = toHex(this.customColor) || '#2e3440';
            this._customItem._swatch.set_style(swatchStyle(hex));
        }
    }

    _buildMenu() {
        let menu = this._applet_context_menu;

        this._switchItem = new PopupMenu.PopupSwitchMenuItem(_('Show desktop icons'),this._iconsVisible());
        this._switchItem.connect('toggled', (item, state) => this._setIconsVisible(state));
        menu.addMenuItem(this._switchItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let sub = new PopupMenu.PopupSubMenuMenuItem(_('Solid colour background'));

        this._customItem = this._colourItem(_('My colour'),toHex(this.customColor) || '#2e3440');
        this._customItem.connect('activate', () => this.applyCustomColor());
        sub.menu.addMenuItem(this._customItem);

        let choose = new PopupMenu.PopupMenuItem(_('Choose a colour…'));
        choose.connect('activate', () => this._chooseColour());
        sub.menu.addMenuItem(choose);

        sub.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        PRESETS.forEach(([name, hex]) => {
            let item = this._colourItem(name, hex);
            item.connect('activate', () => this._applySolidColour(hex));
            sub.menu.addMenuItem(item);
        });

        menu.addMenuItem(sub);

        let restore = new PopupMenu.PopupMenuItem(_('Restore wallpaper'));
        restore.connect('activate', () => this.restoreWallpaper());
        menu.addMenuItem(restore);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    on_applet_removed_from_panel() {
        if (this.nemo)
            this._signals.forEach(id => this.nemo.disconnect(id));
        this._signals = [];
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new DesktopIconsToggleApplet(metadata, orientation, panelHeight, instanceId);
}
