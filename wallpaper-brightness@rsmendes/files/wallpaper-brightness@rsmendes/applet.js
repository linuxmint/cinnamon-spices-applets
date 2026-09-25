// Wallpaper Brightness Applet for Cinnamon
// Linux Mint 22.3 / Cinnamon 6.x

const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

class WallpaperBrightnessApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.instance_id = instance_id;

        // Default icon and tooltip on panel
        this.set_applet_icon_symbolic_name("display-brightness-symbolic");
        this.set_applet_tooltip(_("Wallpaper Brightness"));

        this.scriptPath = GLib.build_filenamev([this.metadata.path, "dimmer.py"]);
        this.cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), "wallpaper-brightness"]);
        this.cacheUri = GLib.filename_to_uri(this.cacheDir, null);
        this.brightness = 100;
        this._applyTimeoutId = 0;
        this._isApplying = false;

        // Popup Menu Manager
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();
        this._loadCurrentBrightness();

        // Mouse scroll over icon changes brightness
        this.actor.connect("scroll-event", (actor, event) => this._onScrollEvent(event));

        // Monitor background changes (e.g. user changes wallpaper in settings or slideshow changes it)
        try {
            this._bgSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });
            this._bgSignalId = this._bgSettings.connect("changed::picture-uri", () => {
                this._onPictureUriChanged();
            });
        } catch (e) {
            global.logError("WallpaperBrightnessApplet: Error connecting to GSettings: " + e);
        }
    }

    _buildMenu() {
        // Title / percentage status
        this.headerItem = new PopupMenu.PopupMenuItem("Wallpaper Brightness: 100%", { reactive: false });
        this.menu.addMenuItem(this.headerItem);

        // Brightness slider (10% to 100%)
        this.sliderItem = new PopupMenu.PopupSliderMenuItem(1.0);
        this.sliderItem.connect("value-changed", (item, value) => {
            let pct = Math.max(10, Math.min(100, Math.round(value * 100)));
            this.headerItem.label.set_text(`Wallpaper Brightness: ${pct}%`);
            this.set_applet_tooltip(`Wallpaper Brightness (${pct}%)`);
            this._scheduleApply(pct);
        });

        this.sliderItem.connect("drag-end", () => {
            let pct = Math.max(10, Math.min(100, Math.round(this.sliderItem.value * 100)));
            this._applyBrightness(pct);
        });

        this.menu.addMenuItem(this.sliderItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Quick Presets Section
        let presetsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(presetsSection);

        let presets = [
            { label: "☀️  100% (Original)", val: 100 },
            { label: "🌤️   75% (Comfortable)", val: 75 },
            { label: "⛅   50% (Medium / Soft)", val: 50 },
            { label: "🌙   30% (Dark / Night)", val: 30 }
        ];

        presets.forEach(p => {
            let item = new PopupMenu.PopupMenuItem(p.label);
            item.connect("activate", () => {
                this._setPreset(p.val);
            });
            presetsSection.addMenuItem(item);
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Quick Actions: Open Background Settings
        let settingsItem = new PopupMenu.PopupIconMenuItem("Background Settings...", "cs-backgrounds", St.IconType.SYMBOLIC);
        settingsItem.connect("activate", () => {
            Util.spawn(["cinnamon-settings", "backgrounds"]);
        });
        this.menu.addMenuItem(settingsItem);
    }

    _onScrollEvent(event) {
        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }

        let step = 5;
        let newBrightness = this.brightness;

        if (direction === Clutter.ScrollDirection.UP) {
            newBrightness = Math.min(100, this.brightness + step);
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            newBrightness = Math.max(10, this.brightness - step);
        }

        if (newBrightness !== this.brightness) {
            this._setPreset(newBrightness);
        }

        return Clutter.EVENT_STOP;
    }

    _loadCurrentBrightness() {
        Util.spawn_async([this.scriptPath, "--get"], (output) => {
            if (output) {
                let val = parseInt(output.trim(), 10);
                if (!isNaN(val)) {
                    this._updateUI(val);
                }
            }
        });
    }

    _updateUI(pct) {
        this.brightness = pct;
        this.sliderItem.setValue(pct / 100.0);
        this.headerItem.label.set_text(`Wallpaper Brightness: ${pct}%`);
        this.set_applet_tooltip(`Wallpaper Brightness (${pct}%)`);
    }

    _setPreset(val) {
        this._updateUI(val);
        this._applyBrightness(val);
    }

    _scheduleApply(val) {
        if (this._applyTimeoutId) {
            Mainloop.source_remove(this._applyTimeoutId);
            this._applyTimeoutId = 0;
        }

        // Wait 120ms to avoid spawning excessive processes during continuous drag
        this._applyTimeoutId = Mainloop.timeout_add(120, () => {
            this._applyTimeoutId = 0;
            this._applyBrightness(val);
            return false;
        });
    }

    _applyBrightness(val) {
        this.brightness = val;
        Util.spawn_async([this.scriptPath, "--set", val.toString()], () => {});
    }

    _onPictureUriChanged() {
        let uri = this._bgSettings.get_string("picture-uri");
        // If URI does not point to cache folder, it's a new external wallpaper
        if (uri && !uri.startsWith(this.cacheUri) && !uri.includes(this.cacheDir)) {
            Util.spawn_async([this.scriptPath, "--sync"], () => {
                this._loadCurrentBrightness();
            });
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._applyTimeoutId) {
            Mainloop.source_remove(this._applyTimeoutId);
        }
        if (this._bgSettings && this._bgSignalId) {
            this._bgSettings.disconnect(this._bgSignalId);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new WallpaperBrightnessApplet(metadata, orientation, panel_height, instance_id);
}
