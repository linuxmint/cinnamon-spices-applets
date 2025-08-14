//!/usr/bin/cjs
/**
 *
 *   ______       _                              _
 *  |  ____|     | |                            | |
 *  | |__   _ __ | |__   __ _ _ __   ___ ___  __| |
 *  |  __| | '_ \| '_ \ / _` | '_ \ / __/ _ \/ _` |
 *  | |____| | | | | | | (_| | | | | (_|  __/ (_| |
 *  |______|_|_|_|_| |_|\__,_|_| |_|\___\___|\__,_|
 *         / ____|                     | |
 *        | (___   ___  _   _ _ __   __| |
 *         \___ \ / _ \| | | | '_ \ / _` |
 *         ____) | (_) | |_| | | | | (_| |
 *        |_____/ \___/ \__,_|_| |_|\__,_|
 *
 */
const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Cogl = imports.gi.Cogl;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
imports.gi.versions.GdkPixbuf = '2.0';
const GdkPixbuf = imports.gi.GdkPixbuf;
const { PixelFormat } = imports.gi.Cogl; //Cogl
const Cvc = imports.gi.Cvc;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Extension = imports.ui.extension;
const Pango = imports.gi.Pango;
const ModalDialog = imports.ui.modalDialog;


let HtmlEncodeDecode = require("./lib/htmlEncodeDecode");
const {
    xml2json
} = require("./lib/xml2json.min");
const {
    timeout_add_seconds,
    setTimeout,
    clearTimeout,
    source_remove,
    remove_all_sources
} = require("./lib/mainloopTools");
const { del_song_arts } = require("./lib/del_song_arts");

const { VolumeSlider } = require("./lib/volumeSlider");
const { ControlButton } = require("./lib/controlButton");
const { StreamMenuSection, Player, MediaPlayerLauncher, Seeker } = require("./lib/s150PopupMenu");


const UUID = "sound150@claudiux";
const EXTENSION_UUID = "OSD150@claudiux";
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const PATH2SCRIPTS = APPLET_DIR + "/scripts";

const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");
const TMP_ALBUMART_DIR = XDG_RUNTIME_DIR + "/AlbumArt";
const ALBUMART_ON = TMP_ALBUMART_DIR + "/ON";
const ALBUMART_PICS_DIR = TMP_ALBUMART_DIR + "/song-art";
const ALBUMART_TITLE_FILE = TMP_ALBUMART_DIR + "/title.txt";
const ICONDIR = XDG_RUNTIME_DIR + "/sound150/icons";

const MPV_RADIO_PID = XDG_RUNTIME_DIR + "/mpv_radio_PID";

const DESKLET_UUID = "AlbumArt3.0@claudiux";
const DESKLET_DIR = HOME_DIR + "/.local/share/cinnamon/desklets/" + DESKLET_UUID;
const ENABLED_DESKLETS_KEY = 'enabled-desklets';

var SHOW_MEDIA_OPTICAL = true;


const ENABLED_APPLETS_KEY = "enabled-applets";
const ENABLED_EXTENSIONS_KEY = "enabled-extensions";

// From Cinnamon 6.4, the /org/cinnamon/show-media-keys-osd key
// becomes a boolean, no longer a character string!
const SHOW_MEDIA_KEYS_OSD_KEY = "show-media-keys-osd";

const RUNTIME_DIR = GLib.get_user_runtime_dir();
const R30MPVSOCKET = RUNTIME_DIR + "/mpvradiosocket";

// how long to show the output icon when volume is adjusted during media playback.
var OUTPUT_ICON_SHOW_TIME_SECONDS = 3;

const IS_OSD150_ENABLED = () => {
    var enabled = false;
    const enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
    for (let i = 0; i < enabledExtensions.length; i++) {
        if (enabledExtensions[i] == EXTENSION_UUID) {
            enabled = true;
            break;
        }
    }
    return enabled;
}

const IS_OSD150_INSTALLED = () => {
    const OSD150_DIR = HOME_DIR + "/.local/share/cinnamon/extensions/" + EXTENSION_UUID;
    return GLib.file_test(OSD150_DIR, GLib.FileTest.EXISTS);
}

function run_playerctld() {
    Util.spawnCommandLineAsync("/usr/bin/env bash -C '" + PATH2SCRIPTS + "/run_playerctld.sh'");
}

function kill_playerctld() {
    Util.spawnCommandLineAsync("/usr/bin/env bash -C '" + PATH2SCRIPTS + "/kill_playerctld.sh'");
}

const superRND = (2**31-1)**2;

function randomIntegerInInterval(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * DEBUG:
 * Returns whether or not the DEBUG file is present in this applet directory ($ touch DEBUG)
 * Used by the log function above.
 */

function DEBUG() {
    let _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
    return _debug.query_exists(null);
};

/**
 * _:
 * @str: string to try to translate.
 * Try firstly with UUID domain, secondly with "cinnamon" domain, then with general domain.
 */
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon", "/usr/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    customTrans = Gettext.dgettext("cinnamon", str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

const MSG_RELOAD = _("Reload this applet");

// Logging
function log(message, always = false) {
    if (DEBUG() || always)
        global.log("[" + UUID + "]: " + message);
}

function logDebug(message) {
    log(message, true);
}

function logError(error) {
    global.logError("[" + UUID + "]: " + error)
}



/* global values */
const original_players_without_seek_support = [
    "telegram desktop", "totem",
    "xplayer", "gnome-mplayer", "pithos"
]; // Removed: "smplayer"
const original_players_with_seek_support = [
    "clementine", "banshee", "rhythmbox",
    "rhythmbox3", "pragha", "quodlibet",
    "amarok", "xnoise", "gmusicbrowser",
    "vlc", "qmmp", "deadbeef",
    "audacious", "celluloid", "spotify", "mpv", "smplayer",
    "LibreWolf"
]; // Added: "smplayer", "LibreWolf"
var players_without_seek_support = original_players_without_seek_support;
var players_with_seek_support = original_players_with_seek_support;

/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const OVERAMPLIFICATION_KEY = "allow-amplified-volume";
const VOLUME_SOUND_ENABLED_KEY = "volume-sound-enabled";
const VOLUME_SOUND_FILE_KEY = "volume-sound-file";

class Sound150Applet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        Util.spawnCommandLineAsync("/usr/bin/env bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));
        Util.spawnCommandLineAsync("/usr/bin/env bash -c '[[ -d %s ]] || mkdir -p %s'".format(ALBUMART_PICS_DIR, ALBUMART_PICS_DIR));
        Util.spawnCommandLineAsync("/usr/bin/env bash -c '[[ -d %s ]] || mkdir -p %s'".format(ICONDIR, ICONDIR));
        Util.spawnCommandLineAsync("/usr/bin/env bash -C '" + PATH2SCRIPTS + "/rm_tmp_files.sh'");

        this.orientation = orientation;
        this.isHorizontal = !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;

        this.players_without_seek_support = original_players_without_seek_support;
        this.players_with_seek_support = original_players_with_seek_support;
        this.PERCENT_CHAR = _("%");

        this.oldPlayerIcon0 = null;
        this._ownerChangedId = null;

        this.allowChangeArt = true;

        this.title_text = "";

        this.startingUp = true;

        // The launch player list
        this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player"));
        // The list to use when switching between active players
        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("showMediaOptical", "showMediaOptical", () => {
            SHOW_MEDIA_OPTICAL = this.showMediaOptical;
            this._on_reload_this_applet_pressed();
        });
        SHOW_MEDIA_OPTICAL = this.showMediaOptical;

        this.settings.bind("viewFullAlbumArt", "viewFullAlbumArt", () => {
            this._on_reload_this_applet_pressed();
        });

        this.settings.bind("keepAppListOpen", "keepAppListOpen");
        this.settings.bind("keepOutputListOpen", "keepOutputListOpen");
        this.settings.bind("keepInputListOpen", "keepInputListOpen");
        this.settings.bind("keepCommandListOpen", "keepCommandListOpen");

        this.settings.bind("muteSoundOnClosing", "muteSoundOnClosing");
        this.settings.bind("startupVolume", "startupVolume");
        this.settings.bind("showOSDonStartup", "showOSDonStartup");
        this.settings.bind("showPercent", "showPercent", () => {
            this.PERCENT_CHAR = (this.showPercent) ? _("%") : "";
        });
        this.PERCENT_CHAR = (this.showPercent) ? _("%") : "";

        this.settings.bind("showBarLevel", "showBarLevel");
        this.settings.bind("showVolumeValue", "showVolumeValue");

        this.settings.bind("OSDhorizontal", "OSDhorizontal",
            () => {
                this.on_OSDhorizontal_changed();
            }
        );
        this.on_OSDhorizontal_changed();

        this.seekerTooltipDelay = 500;
        this.settings.bind("soundATcinnamonDOTorg_is_loaded", "soundATcinnamonDOTorg_is_loaded");
        this.settings.bind("OsdWithNumberATJosephMcc_is_loaded", "OsdWithNumberATJosephMcc_is_loaded");
        this.settings.bind("showtrack", "showtrack", () => {
            this.on_settings_changed()
        });
        this.settings.bind("middleClickAction", "middleClickAction");
        this.settings.bind("middleShiftClickAction", "middleShiftClickAction");
        this.settings.bind("horizontalScroll", "horizontalScroll");
        this.settings.bind("showalbum", "showalbum", () => {
            this.on_settings_changed()
        });
        this.settings.bind("showalbumDelay", "showalbumDelay", () => {
            this.on_settings_changed()
        });
        this.settings.bind("truncatetext", "truncatetext", () => {
            this.on_settings_changed()
        });
        this.settings.bind("toolongchars", "toolongchars", () => {
            this.on_settings_changed()
        });
        this.keepAlbumAspectRatio = true; //forced.
        this.settings.bind("hideSystray", "hideSystray", () => {
            if (this.hideSystray) this.registerSystrayIcons();
            else this.unregisterSystrayIcons();
        });

        this.settings.bind("playerControl", "playerControl", () => {
            this.on_settings_changed()
        });
        this.settings.bind("extendedPlayerControl", "extendedPlayerControl", () => {
            for (let i in this._players)
                this._players[i].onSettingsChanged();
        });
        this.settings.bind("avoidTwice", "avoidTwice", this._updatePlayerMenuItems);


        this.settings.bind("_knownPlayers", "_knownPlayers");
        if (this.hideSystray) this.registerSystrayIcons();

        this.settings.bind("keyOpen", "keyOpen", () => {
            this._setKeybinding()
        });
        this.settings.bind("keySwitchPlayer", "keySwitchPlayer", () => {
            this._setKeybinding()
        });

        this.settings.bind("magneticOn", "magneticOn", () => this._on_sound_settings_change());
        this.settings.bind("magnetic25On", "magnetic25On", () => this._on_sound_settings_change());

        this.settings.bind("adaptColor", "adaptColor", () => this._on_sound_settings_change());
        this.settings.bind("color0_100", "color0_100", () => this._on_sound_settings_change());
        this.settings.bind("color101_115", "color101_115", () => this._on_sound_settings_change());
        this.settings.bind("color116_130", "color116_130", () => this._on_sound_settings_change());
        this.settings.bind("color131_150", "color131_150", () => this._on_sound_settings_change());
        this.settings.bind("reverseScrolling", "reverseScrolling");


        this.settings.bind("tooltipShowVolume", "tooltipShowVolume", () => {
            this.on_settings_changed()
        });
        this.settings.bind("tooltipShowPlayer", "tooltipShowPlayer", () => {
            this.on_settings_changed()
        });
        this.settings.bind("tooltipShowArtistTitle", "tooltipShowArtistTitle", () => {
            this.on_settings_changed()
        });

        this.settings.bind("alwaysCanChangeMic", "alwaysCanChangeMic", () => {
            this.on_settings_changed()
        });

        this._sounds_settings = new Gio.Settings({
            schema_id: CINNAMON_DESKTOP_SOUNDS
        });
        this.settings.setValue("volumeSoundFile", this._sounds_settings.get_string(VOLUME_SOUND_FILE_KEY));
        this.settings.bind("volumeSoundFile", "volumeSoundFile", this.on_volumeSoundFile_changed);
        this.settings.setValue("volumeSoundEnabled", this._sounds_settings.get_boolean(VOLUME_SOUND_ENABLED_KEY));
        this.settings.bind("volumeSoundEnabled", "volumeSoundEnabled", this.on_volumeSoundEnabled_changed);
        this.settings.bind("maxVolume", "maxVolume", (value) => this._on_maxVolume_changed(value));

        this.settings.bind("volume", "volume");

        this.old_volume = this.volume;
        this.settings.setValue("showMediaKeysOSD", global.settings.get_boolean(SHOW_MEDIA_KEYS_OSD_KEY));
        this.settings.bind("showMediaKeysOSD", "showMediaKeysOSD", () => {
            this.on_showMediaKeysOSD_changed()
        });

        this.settings.bind("mic-level", "mic_level");
        this.settings.bind("showVolumeLevelNearIcon", "showVolumeLevelNearIcon", () => {
            this.volume_near_icon()
        });
        this.settings.bind("showMicMutedOnIcon", "showMicMutedOnIcon", () => {
            this._on_sound_settings_change()
        });
        this.settings.bind("showMicUnmutedOnIcon", "showMicUnmutedOnIcon", () => {
            this._on_sound_settings_change()
        });
        this.settings.bind("redefine-volume-keybindings", "redefine_volume_keybindings", () => {
            this._setKeybinding()
        });
        this.settings.bind("audio-stop", "audio_stop", () => {
            this._setKeybinding()
        });
        this.settings.bind("pause-on-off", "pause_on_off", () => {
            this._setKeybinding()
        });
        this.settings.bind("volume-mute", "volume_mute", () => {
            this._setKeybinding()
        });
        this.settings.bind("volume-up", "volume_up", () => {
            this._setKeybinding()
        });
        this.settings.bind("volume-down", "volume_down", () => {
            this._setKeybinding()
        });
        this.settings.bind("audio-next", "audio_next", () => {
            this._setKeybinding()
        });
        this.settings.bind("audio-prev", "audio_prev", () => {
            this._setKeybinding()
        });

        this.settings.bind("VOLUME_ADJUSTMENT_STEP", "VOLUME_ADJUSTMENT_STEP");

        this.settings.bind("stepVolume", "stepVolume", () => {
            let sv = this.settings.getValue("stepVolume");
            let vu = this.settings.getValue("volume-up");
            let old_VAS = Math.round(this.VOLUME_ADJUSTMENT_STEP * 100);
            this.VOLUME_ADJUSTMENT_STEP = sv / 100;
            if (old_VAS == 5 && sv != 5 && vu.length <= 2) {
                this.settings.setValue("redefine-volume-keybindings", true);
                this._set_shortcuts_as_default();
                this._setKeybinding();
            }
        });
        this.VOLUME_ADJUSTMENT_STEP = this.settings.getValue("stepVolume") / 100;

        // Custom commands:
        this.settings.bind("custom-commands-list", "custom_commands");

        // Whether sound@cinnamon.org is loaded:
        let enabledApplets = global.settings.get_strv(ENABLED_APPLETS_KEY);
        var _soundATcinnamonDOTorg_is_loaded = false;
        for (let appData of enabledApplets) {
            if (appData.toString().split(":")[3] === "sound@cinnamon.org") {
                _soundATcinnamonDOTorg_is_loaded = true;
                break;
            }
        }
        this.settings.setValue("soundATcinnamonDOTorg_is_loaded", _soundATcinnamonDOTorg_is_loaded);

        // Whether OsdWithNumber@JosephMcc is loaded:
        this.OsdWithNumberATJosephMcc_is_loaded = this.OsdWithNumberATJosephMcc_is_loaded_internal;

        Main.themeManager.connect("theme-set", () => {
            this._theme_set()
        });

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.set_applet_icon_symbolic_name("audio-x-generic");

        this.mute_out_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-volume-muted-symbolic", St.IconType.SYMBOLIC);
        this.mute_in_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "microphone-sensitivity-muted-symbolic", St.IconType.SYMBOLIC);
        this._applet_context_menu.addMenuItem(this.mute_out_switch);
        this._applet_context_menu.addMenuItem(this.mute_in_switch);
        if (this.alwaysCanChangeMic)
            this.mute_in_switch.actor.show();
        else
            this.mute_in_switch.actor.hide();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._players = {};
        this._playerItems = [];
        this._activePlayer = null;

        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                // ?? what else should we do if we fail completely here?
                throw error;
            }

            this._dbus = proxy;

            // player DBus name pattern
            let name_regex = /^org\.mpris\.MediaPlayer2\./;
            // load players
            this._dbus.ListNamesRemote((names) => {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (name_regex.test(name))
                        this._dbus.GetNameOwnerRemote(name, (owner) => this._addPlayer(name, owner[0]));
                }
            });

            // watch players
            this._ownerChangedId = this._dbus.connectSignal("NameOwnerChanged",
                (proxy, sender, [name, old_owner, new_owner]) => {
                    if (name_regex.test(name)) {
                        if (new_owner && !old_owner)
                            this._addPlayer(name, new_owner);
                        else if (old_owner && !new_owner)
                            this._removePlayer(name, old_owner);
                        else
                            this._changePlayerOwner(name, old_owner, new_owner);
                    }
                }
            );
        });

        // Mixer control:
        this._control = new Cvc.MixerControl({
            name: "Sound150 Volume Control"
        });
        this._control.connect("state-changed", (...args) => this._onControlStateChanged(...args));

        this._control.connect("output-added", (...args) => this._onDeviceAdded(...args, "output"));
        this._control.connect("output-removed", (...args) => this._onDeviceRemoved(...args, "output"));
        this._control.connect("active-output-update", (...args) => this._onDeviceUpdate(...args, "output"));

        this._control.connect("input-added", (...args) => this._onDeviceAdded(...args, "input"));
        this._control.connect("input-removed", (...args) => this._onDeviceRemoved(...args, "input"));
        this._control.connect("active-input-update", (...args) => this._onDeviceUpdate(...args, "input"));

        this._control.connect("stream-added", (...args) => this._onStreamAdded(...args));
        this._control.connect("stream-removed", (...args) => this._onStreamRemoved(...args));

        this._sound_settings = new Gio.Settings({
            schema_id: CINNAMON_DESKTOP_SOUNDS
        });
        this._volumeNorm = this._control.get_vol_max_norm();
        this._volumeMax = this._volumeNorm;

        this._streams = [];
        this._devices = [];
        this._recordingAppsNum = 0;

        this._output = null;
        this._outputMutedId = null;
        this._outputIcon = "audio-volume-muted-symbolic";

        this._input = null;
        this._inputMutedId = null;

        this._icon_name = '';
        this._icon_path = null;
        this._iconTimeoutId = null;
        this._iconLooping = true;

        this.scrollEventId = this.actor.connect("scroll-event", (...args) => this._onScrollEvent(...args));
        this.keypressEventId = this.actor.connect("key-press-event", (...args) => this._onKeyPressEvent(...args));
        this.enterEventId = this.actor.connect("enter-event", (actor, event) => this.on_enter_event(actor, event));
        this.leaveEventId = this.actor.connect("leave-event", (actor, event) => this.on_leave_event(actor, event));
        this.notifyHoverId = this.actor.connect('notify::hover', () => {
            this._applet_tooltip.show();
        });

        this._outputApplicationsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Applications"));
        this._selectOutputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Output device"));
        this._applet_context_menu.addMenuItem(this._outputApplicationsMenu);
        this._applet_context_menu.addMenuItem(this._selectOutputDeviceItem);
        this._outputApplicationsMenu.actor.hide();
        this._selectOutputDeviceItem.actor.hide();

        this._inputSection = new PopupMenu.PopupMenuSection();
        this._inputVolumeSection = new VolumeSlider(this, null, _("Microphone"), null);
        this._inputVolumeSection.connect("values-changed", (...args) => this._inputValuesChanged(...args));
        this._selectInputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Input device"));
        //this._inputSection.addMenuItem(this._inputVolumeSection);
        this._inputSection.addMenuItem(this._selectInputDeviceItem);
        this._applet_context_menu.addMenuItem(this._inputSection);

        this._selectInputDeviceItem.actor.show(); //.hide();
        this._inputSection.actor.show(); //.hide();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let easy_effects = this.get_effects("Easy Effects");
        if (easy_effects) {
            this.context_menu_item_easyEffects = new PopupMenu.PopupIconMenuItem(_("Easy Effects"), "easyeffects", St.IconType.SYMBOLIC);
            this.context_menu_item_easyEffects.connect("activate", async () => {
                Util.spawnCommandLine("%s".format(easy_effects))
            });
            this._applet_context_menu.addMenuItem(this.context_menu_item_easyEffects);
        }

        let pulse_effects = this.get_effects("PulseEffects");
        if (pulse_effects) {
            this.context_menu_item_pulseEffects = new PopupMenu.PopupIconMenuItem(_("Pulse Effects"), "pulseeffects", St.IconType.SYMBOLIC);
            this.context_menu_item_pulseEffects.connect("activate", async () => {
                Util.spawnCommandLine("%s".format(pulse_effects))
            });
            this._applet_context_menu.addMenuItem(this.context_menu_item_pulseEffects);
        }

        // Custom commands:
        if (this.custom_commands.length > 0) {
            this.commands_menu_item = new PopupMenu.PopupSubMenuMenuItem(_("Commands"));
            for (let c of this.custom_commands) {
                this.commands_menu_item.menu.addAction(c["title"], () => {
                    Util.spawnCommandLineAsync(`${c["command"]}`)
                });
            }
            this._applet_context_menu.addMenuItem(this.commands_menu_item);
        }

        if (!this.context_menu_item_configDesklet) { // 'Album Art desklet settings'
            this.context_menu_item_configDesklet = new PopupMenu.PopupIconMenuItem(_("Album Art desklet settings"), "system-run", St.IconType.SYMBOLIC);
            this.context_menu_item_configDesklet.connect('activate', () => {
                this.on_desklet_open_settings_button_clicked()
            });
        }

        if (!this.context_menu_item_showDesklet) { // switch 'Show AlbumArt3.0 desklet'
            this.context_menu_item_showDesklet = new PopupMenu.PopupSwitchMenuItem(_("Show Album Art on desktop"),
                this.show_desklet,
                null);
            this.context_menu_item_showDesklet.connect("toggled", () => {
                this._on_context_menu_item_showDesklet_toggled();
            });
        }
        this._applet_context_menu.addMenuItem(this.context_menu_item_showDesklet);
        this._applet_context_menu.addMenuItem(this.context_menu_item_configDesklet);

        // button Reload this applet
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let _reload_button = new PopupMenu.PopupIconMenuItem(MSG_RELOAD, "restart", St.IconType.SYMBOLIC);
        _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed());
        this._applet_context_menu.addMenuItem(_reload_button);

        this._showFixedElements();

        this.mute_out_switch.connect("toggled", () => this._toggle_out_mute());
        this.mute_in_switch.connect("toggled", () => this._toggle_in_mute());

        this._control.open();

        this._volumeControlShown = false;

        this.set_show_label_in_vertical_panels(false);
        this.set_applet_label(this._applet_label.get_text());

        let appsys = Cinnamon.AppSystem.get_default();
        appsys.connect("installed-changed", () => this._updateLaunchPlayer());

        this._sound_settings.connect("changed::" + OVERAMPLIFICATION_KEY, () => this._on_sound_settings_change());
    }

    monitor_icon_dir() {
        this.unmonitor_icon_dir();
        const icon_dir = Gio.file_new_for_path(ICONDIR);
        this.iconsMonitor = icon_dir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, new Gio.Cancellable());
        this.iconsMonitor.set_rate_limit(5000);
        this.iconsMonitorId = this.iconsMonitor.connect("changed", () => { this.on_icon_dir_changed() });
    }

    unmonitor_icon_dir() {
        if (this.iconsMonitor == null || this.iconsMonitorId == null || this.iconsMonitor.is_cancelled()) return;

        this.iconsMonitor.disconnect(this.iconsMonitorId);
        this.iconsMonitor.cancel();
        this.iconsMonitor = null;
        this.iconsMonitorId = null;
    }

    on_icon_dir_changed() {
        if (!this.showalbum) return;
        const icon_dir = Gio.file_new_for_path(ICONDIR);
        let children = icon_dir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null);
        let icon = children.next_file(null);
        if (icon != null) {
            let name = icon.get_name();
            let _icon_path = ICONDIR + "/" + name;
            let _albumart_path = ALBUMART_PICS_DIR + "/" + name;
            if (this._players[this._activePlayer] && GLib.file_test(_albumart_path, GLib.FileTest.EXISTS))
                this._players[this._activePlayer]._showCover(_albumart_path);
            let idto = setTimeout( () => {
                    clearTimeout(idto);
                    this._playerIcon[0] = _icon_path;
                    this._icon_path = _icon_path;
                    this.setAppletIcon(true, true);
                },
                300
            );
        }
        children.close(null);
    }

    on_enter_event(actor, event) {
        this.on_icon_dir_changed();
        this.setAppletTooltip();
        this._applet_tooltip.show();
        if (this.context_menu_item_configDesklet)
            this.context_menu_item_configDesklet.actor.visible = this.show_desklet;
        if (this.context_menu_item_showDesklet)
            this.context_menu_item_showDesklet._switch.setToggleState(this.show_desklet);
        if (this._outputApplicationsMenu) {
            if (this.keepAppListOpen)
                this._outputApplicationsMenu.menu.open();
            else
                this._outputApplicationsMenu.menu.close();
        }
        if (this.commands_menu_item) {
            if (this.keepCommandListOpen)
                this.commands_menu_item.menu.open();
            else
                this.commands_menu_item.menu.close();
        }
        if (this._selectOutputDeviceItem) {
            if (this.keepOutputListOpen)
                this._selectOutputDeviceItem.menu.open();
            else
                this._selectOutputDeviceItem.menu.close();
        }
        if (this._selectInputDeviceItem) {
            if (this.keepInputListOpen)
                this._selectInputDeviceItem.menu.open();
            else
                this._selectInputDeviceItem.menu.close();
        }
    }

    on_leave_event(actor, event) {
        if (this.playerControl && this._activePlayer)
            this.setAppletTextIcon(this._players[this._activePlayer], true);
        else
            this.setAppletTextIcon();

        this.set_applet_tooltip("");
    }

    _on_context_menu_item_showDesklet_toggled() {
        this._is_desklet_activated();
        if (!this.show_desklet) {
            Util.spawn(["touch", ALBUMART_ON]);
            if (!this.desklet_is_activated) {
                let command, Button1, Button2, summary, body;
                if (!GLib.file_test(DESKLET_DIR + "/metadata.json", GLib.FileTest.EXISTS)) {
                    // The 'Album Art 3.0' desklet wasn't installed.
                    this._applet_context_menu.close();
                    summary = _("You need the 'Album Art 3.0' desklet");
                    body = _("You can install it by clicking on the first button and then searching for Album.");
                    Button1 = _("Desklets");
                    Button2 = _("Cancel");
                    command = `notify-send -u critical --icon="cs-desklets-symbolic" --action="opt1=${Button1}" --action="opt2=${Button2}" "${summary}" "${body}"`;
                    Util.spawnCommandLineAsyncIO(
                        command,
                        (stdout, stderr, exitCode) => {
                        if (exitCode === 0) {
                            if (stdout.startsWith("opt1")) {
                                Util.spawn(["cinnamon-settings", "desklets", "-t", "download"]);
                            }
                        }
                    }
                  );
                } else {
                    // The 'Album Art 3.0' desklet is installed but wasn't activated.
                    this._applet_context_menu.close();
                    summary = _("You need to activate the 'Album Art 3.0' desklet");
                    body = _("You can activate it by clicking on the first button, then searching for Album and adding it with button [+].");
                    Button1 = _("Desklets");
                    Button2 = _("Cancel");
                    command = `notify-send -u critical --icon="cs-desklets-symbolic" --action="opt1=${Button1}" --action="opt2=${Button2}" "${summary}" "${body}"`;
                    Util.spawnCommandLineAsyncIO(
                        command,
                        (stdout, stderr, exitCode) => {
                            if (exitCode === 0) {
                                if (stdout.startsWith("opt1")) {
                                    Util.spawn(["cinnamon-settings", "desklets"]);
                                }
                            }
                        }
                    );
                }
            }
        } else {
            Util.spawn(["rm", "-f", ALBUMART_ON]);
        }
        let _to = setTimeout( () => {
            clearTimeout(_to);
            if (this.context_menu_item_configDesklet)
                this.context_menu_item_configDesklet.actor.visible = this.show_desklet;
            this.context_menu_item_showDesklet._switch.setToggleState(this.show_desklet);
        }, 300);
    } // End of _on_context_menu_item_showDesklet_toggled

    on_OSDhorizontal_changed() {
        if (!this.OSDhorizontal) return;
        if (IS_OSD150_ENABLED()) {
            return;
        } else {
            const Button2 = _("Cancel");
            const summary = _("Enhanced Sound applet");
            var Button1, body;
            if (IS_OSD150_INSTALLED()) {
                Button1 = _("Enable the OSD150 extension");
                body = _("To obtain an horizontal OSD, you need to enable the OSD150 extension.");
                Util.spawnCommandLineAsyncIO(
                    `notify-send -u critical --icon="audio-volume-overamplified-symbolic" --action="opt1=${Button1}" --action="opt2=${Button2}" "${summary}" "${body}"`,
                    (stdout, stderr, exitCode) => {
                        if (exitCode === 0) {
                            if (stdout.startsWith("opt1")) {
                                this.install_OSD150();
                            } else {
                                this.OSDhorizontal = false;
                            }
                        } else {
                            this.OSDhorizontal = false;
                        }
                    }, {}
                );
            } else {
                Button1 = _("Download the OSD150 extension");
                body = _("To obtain an horizontal OSD, you need to download the OSD150 extension.\nClick on the Download button then search for OSD150 and select the ⬇ button.");
                Util.spawnCommandLineAsyncIO(
                    `notify-send -u critical --icon="audio-volume-overamplified-symbolic" --action="opt1=${Button1}" --action="opt2=${Button2}" "${summary}" "${body}"`,
                    (stdout, stderr, exitCode) => {
                        if (exitCode === 0) {
                            logDebug("stdout: " + stdout + " " + typeof stdout);
                            if (stdout.startsWith("opt1")) {
                                Util.spawnCommandLineAsync("cinnamon-settings extensions -t download");
                            } else {
                                this.OSDhorizontal = false;
                            }
                        } else {
                            this.OSDhorizontal = false;
                        }
                    }, {}
                );
            }
        }
    }

    on_volumeSoundFile_changed() {
        this._sounds_settings.set_string(VOLUME_SOUND_FILE_KEY, this.volumeSoundFile);
    }

    on_volumeSoundEnabled_changed() {
        this._sounds_settings.set_boolean(VOLUME_SOUND_ENABLED_KEY, this.volumeSoundEnabled);
    }

    on_showMediaKeysOSD_changed() {
        global.settings.set_boolean(SHOW_MEDIA_KEYS_OSD_KEY, this.showMediaKeysOSD);
    }

    _on_remove_OsdWithNumber_from_extensions() {
        const TO_REMOVE = "OsdWithNumber@JosephMcc";
        let dialog = new ModalDialog.ConfirmDialog(
            _("Are you sure you want to remove '%s'?").format(TO_REMOVE),
            () => {
                Extension.unloadExtension(TO_REMOVE, Extension.Type.EXTENSION, false, false);

                let oldList = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
                let newList = [];

                for (let i = 0; i < oldList.length; i++) {
                    let info = oldList[i];
                    if (info != TO_REMOVE) {
                        newList.push(oldList[i]);
                    }
                }
                global.settings.set_strv(ENABLED_EXTENSIONS_KEY, newList);
                this.settings.setValue("OsdWithNumberATJosephMcc_is_loaded", false);
            }
        );
        dialog.open();
    }

    _on_remove_soundATcinnamonDOTorg_from_panels() {
        const TO_REMOVE = "sound@cinnamon.org";
        let dialog = new ModalDialog.ConfirmDialog(
            _("Are you sure you want to remove '%s'?").format(TO_REMOVE),
            () => {
                Extension.unloadExtension(TO_REMOVE, Extension.Type.APPLET, false, false);

                let oldList = global.settings.get_strv(ENABLED_APPLETS_KEY);
                let newList = [];

                for (let i = 0; i < oldList.length; i++) {
                    let info = oldList[i].split(":");
                    if (info[3] != TO_REMOVE) {
                        newList.push(oldList[i]);
                    }
                }
                global.settings.set_strv(ENABLED_APPLETS_KEY, newList);
                this.settings.setValue("soundATcinnamonDOTorg_is_loaded", false);
                this._on_reload_this_applet_pressed();
            }
        );
        dialog.open();
    }

    get_effects(name) {
        var commandline = null;
        let appsys = Cinnamon.AppSystem.get_default();
        const dirs = [];
        const iter = appsys.get_tree().get_root_directory().iter();
        const CMenu = imports.gi.CMenu;

        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }

            dirs.forEach(dir => {
                if (!dir.get_is_nodisplay()) {
                    const dirId = dir.get_menu_id();
                    if (dirId === "Multimedia") {
                        const dirIter = dir.iter();
                        let nextTypeDir;
                        while ((nextTypeDir = dirIter.next()) !== CMenu.TreeItemType.INVALID) {
                            const entry = dirIter.get_entry();
                            if (entry == null) continue;
                            const appInfo = entry.get_app_info();
                            if (appInfo && !appInfo.get_nodisplay()) {
                                const id = entry.get_desktop_file_id();
                                const app = appsys.lookup_app(id);
                                if (app.get_name() == name) {
                                    commandline = appInfo.get_commandline();
                                    break;
                                }
                            }
                        }
                    }
                }
            });
        }
        return commandline;
    }

    _setKeybinding() {
        Main.keybindingManager.addHotKey("sound-open-" + this.instance_id, this.keyOpen, () => {
            this._openMenu()
        });
        Main.keybindingManager.addHotKey("switch-player-" + this.instance_id, this.keySwitchPlayer, () => {
            this._switchToNextPlayer()
        });

        Main.keybindingManager.addHotKey("raise-volume-" + this.instance_id, "AudioRaiseVolume", () => {
            this.set_applet_tooltip("");
            this._volumeChange(Clutter.ScrollDirection.UP);
        });
        Main.keybindingManager.addHotKey("lower-volume-" + this.instance_id, "AudioLowerVolume", () => {
            this.set_applet_tooltip("");
            this._volumeChange(Clutter.ScrollDirection.DOWN);
        });
        Main.keybindingManager.addHotKey("volume-mute-" + this.instance_id, "AudioMute", () => this._toggle_out_mute());
        Main.keybindingManager.addHotKey("pause-" + this.instance_id, "AudioPlay", () => this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote());

        Main.keybindingManager.addHotKey("audio-next-" + this.instance_id, "AudioNext", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.NextRemote()
            }
        });
        Main.keybindingManager.addHotKey("audio-prev-" + this.instance_id, "AudioPrev", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote()
            }
        });
        Main.keybindingManager.addHotKey("audio-stop-" + this.instance_id, "AudioStop", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.StopRemote()
            }
        });

        if (!this.redefine_volume_keybindings) return;

        try {
            Main.keybindingManager.removeHotKey("media-keys-4");
            Main.keybindingManager.removeHotKey("media-keys-2");
        } catch (e) {
            logError("Unable to removeHotKey media-keys: " + e)
        }

        Main.keybindingManager.removeHotKey("raise-volume");
        Main.keybindingManager.removeHotKey("lower-volume");
        Main.keybindingManager.removeHotKey("volume-mute");
        Main.keybindingManager.removeHotKey("volume-up");
        Main.keybindingManager.removeHotKey("volume-down");
        Main.keybindingManager.removeHotKey("pause");
        Main.keybindingManager.removeHotKey("audio-stop");

        Main.keybindingManager.removeHotKey("audio-next");
        Main.keybindingManager.removeHotKey("audio-prev");

        if (this.audio_stop.length > 2)
            Main.keybindingManager.addHotKey("audio-stop", this.audio_stop,
                () => {
                    if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                        GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                        GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
                    } else {
                        this._players[this._activePlayer]._mediaServerPlayer.StopRemote()
                    }
                });

        if (this.pause_on_off.length > 2)
            Main.keybindingManager.addHotKey("pause", this.pause_on_off,
                () => this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote());
        if (this.volume_mute.length > 2)
            Main.keybindingManager.addHotKey("volume-mute", this.volume_mute, () => this._toggle_out_mute()); //(...args) => this._mutedChanged(...args, "_output"));
        if (this.volume_up.length > 2)
            Main.keybindingManager.addHotKey("volume-up", this.volume_up, () => this._volumeChange(Clutter.ScrollDirection.UP));
        if (this.volume_down.length > 2)
            Main.keybindingManager.addHotKey("volume-down", this.volume_down, () => this._volumeChange(Clutter.ScrollDirection.DOWN));
        if (this.audio_next.length > 2)
            Main.keybindingManager.addHotKey("audio-next", this.audio_next, () => {
                if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                    GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
                } else {
                    this._players[this._activePlayer]._mediaServerPlayer.NextRemote()
                }
            });

        if (this.audio_prev.length > 2)
            Main.keybindingManager.addHotKey("audio-prev", this.audio_prev, () => {
                if (this._players[this._activePlayer]._name.toLowerCase() === "mpv" &&
                    GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
                } else {
                    this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote()
                }
            });
    } // End of _setKeybinding

    _on_maxVolume_changed(value) {
        if (value > 100) {
            this._sound_settings.set_boolean(OVERAMPLIFICATION_KEY, true);
        } else {
            this._sound_settings.set_boolean(OVERAMPLIFICATION_KEY, false);
        }
        this.maxVolume = value;
        this._on_sound_settings_change();
    }

    _on_sound_settings_change() {
        if (!this._sound_settings.get_boolean(OVERAMPLIFICATION_KEY) && this.maxVolume > 100) {
            this.maxVolume = 100;
        }

        this._volumeMax = this.maxVolume / 100 * this._volumeNorm;
        if (this.maxVolume > 100) {
            if (this._outputVolumeSection)
                this._outputVolumeSection.set_mark(100 / this.maxVolume);
        } else {
            if (this._outputVolumeSection)
                this._outputVolumeSection.set_mark(0);
            if (this.maxVolume === 100)
                this._volumeMax = this._volumeNorm;
        }
        if (parseInt(this.volume.slice(0, -1)) > this.maxVolume) {
            this.volume = "" + this.maxVolume + "%";
            this._volumeChange(Clutter.ScrollDirection.DOWN);
            this._volumeChange(Clutter.ScrollDirection.UP);
        }
        if (this._outputVolumeSection)
            this._outputVolumeSection._update();
    }

    on_orientation_changed() {
        this.orientation = orientation;
        this.isHorizontal = !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    }

    on_panel_height_changed() {
        this.on_settings_changed();
    }

    on_settings_changed() {
        OUTPUT_ICON_SHOW_TIME_SECONDS = 3;
        if (this.showalbum && this.showalbumDelay >= 3)
            OUTPUT_ICON_SHOW_TIME_SECONDS = this.showalbumDelay - 1;
        if (this.playerControl && this._activePlayer)
            this.setAppletTextIcon(this._players[this._activePlayer], true);
        else
            this.setAppletTextIcon();

        if (this.alwaysCanChangeMic)
            if (this.mute_in_switch)
                this.mute_in_switch.actor.show();
            else if (this._recordingAppsNum === 0)
            if (this.mute_in_switch)
                this.mute_in_switch.actor.hide();

        this._changeActivePlayer(this._activePlayer);
    }

    on_applet_added_to_panel() {
        this.title_text_old = "";
        this.startingUp = true;
        if (this._playerctl)
            kill_playerctld();
        this.players_without_seek_support = original_players_without_seek_support;
        this.players_with_seek_support = original_players_with_seek_support;

        if (this._playerctl) {
            for (let pl of this.players_without_seek_support) {
                this.players_with_seek_support.push(pl);
            }
            this.players_without_seek_support = [];
        }

        let color;
        try {
            if (!this.themeNode) {
                this.themeNode = this.actor.get_theme_node();
            }
            let defaultColor = this.themeNode.get_foreground_color();
            color = "rgba(" + defaultColor.red + "," + defaultColor.green + "," + defaultColor.blue + "," + defaultColor.alpha + ")";
        } catch(e) {
            color = this.color0_100;
        }
        this.color0_100 = color;

        this._iconLooping = true;

        if (this._output && this._output.is_muted) {
            this.old_volume = this.volume;
            this._toggle_out_mute();
            this.volume = this.old_volume;
        }

        this._on_sound_settings_change();

        this._loopArtId = null;
        this._artLooping = true;
        this._loopArtId = timeout_add_seconds(10, () => {
            this.loopArt();
        });

        this.iconsMonitor =null;
        this.iconsMonitorId == null;
        this.monitor_icon_dir();

        this.volume_near_icon();

        let to = setTimeout(() => {
                this._setKeybinding();
                clearTimeout(to);
            },
            2100
        );

        let _to = setTimeout(() => {
                this.startingUp = false;
                clearTimeout(_to);
            },
            (this.actor.get_stage() != null) ? 2100 : 20000
        );
    }

    on_applet_removed_from_panel(deleteConfig) {
        this.unmonitor_icon_dir();
        this._iconLooping = false;
        this._artLooping = false;
        this._loopArtId = null;
        this.startingUp = true;
        if (this.actor && (this.actor.get_stage() != null) && this._control && (this._control.get_state() != Cvc.MixerControlState.CLOSED)) {
            try {
                this._control.close();
            } catch (e) {
                logError("CAN'T CLOSE control!")
            };
        }

        let old_volume = this.volume;
        if (this.muteSoundOnClosing && this._output && !this._output.is_muted) {
            this.old_volume = this.volume;
            this._toggle_out_mute();
            this.volume = this.old_volume;
        }

        Main.keybindingManager.removeHotKey("sound-open-" + this.instance_id);
        Main.keybindingManager.removeHotKey("switch-player-" + this.instance_id);
        try {
            Main.keybindingManager.removeHotKey("raise-volume-" + this.instance_id);
            Main.keybindingManager.removeHotKey("lower-volume-" + this.instance_id);
            Main.keybindingManager.removeHotKey("volume-mute-" + this.instance_id);
            Main.keybindingManager.removeHotKey("pause-" + this.instance_id);
            Main.keybindingManager.removeHotKey("audio-next-" + this.instance_id);
            Main.keybindingManager.removeHotKey("audio-prev-" + this.instance_id);
        } catch (e) {}

        if (this.redefine_volume_keybindings) {
            try {
                Main.keybindingManager.removeHotKey("volume-mute");
                Main.keybindingManager.removeHotKey("volume-up");
                Main.keybindingManager.removeHotKey("volume-down");
                Main.keybindingManager.removeHotKey("pause");
                Main.keybindingManager.removeHotKey("audio-next");
                Main.keybindingManager.removeHotKey("audio-prev");
            } catch (e) {}
        }

        if (this.hideSystray) {
            this.unregisterSystrayIcons();
        }

        this._removeAllStreams();

        if (this._ownerChangedId && this._dbus) {
            this._dbus.disconnectSignal(this._ownerChangedId);
            this._ownerChangedId = null;
        }

        for (let i in this._players)
            if (this._players[i])
                this._players[i].destroy();

        if (this._control)
            this._control.close();

        kill_playerctld();

        if (this.scrollEventId)
            this.actor.disconnect(this.scrollEventId);
        if (this.keypressEventId)
            this.actor.disconnect(this.keypressEventId);
        if (this.enterEventId)
            this.actor.disconnect(this.enterEventId);
        if (this.leaveEventId)
            this.actor.disconnect(this.leaveEventId);
        if (this.notifyHoverId)
            this.actor.disconnect(this.notifyHoverId);
        this.scrollEventId = null;
        this.keypressEventId = null;
        this.enterEventId = null;
        this.leaveEventId = null;
        this.notifyHoverId = null;

        this.settings.setValue("volume", old_volume);
        remove_all_sources();
        this._loopArtId = null;

        if (!GLib.file_test(MPV_RADIO_PID, GLib.FileTest.EXISTS)) { // Radio3.0 is not running.
            del_song_arts();
        }
    }

    on_applet_clicked(event) {
        this._openMenu();
        if (!this.menu.isOpen) return;
        let kplo = this.settings.getValue("keepPlayerListOpen");
        if (this._chooseActivePlayerItem && !this._chooseActivePlayerItemActorIsHidden && this.settings.getValue("keepChoosePlayerOpen"))
            this._chooseActivePlayerItem.menu.open();
        if (this._launchPlayerItem && !this._launchPlayerItemActorIsHidden && kplo)
            this._launchPlayerItem.menu.open();
        if (this.OsdWithNumberATJosephMcc_is_loaded_internal)
            this._remove_OsdWithNumberATJosephMcc_button.actor.show();
        else
            this._remove_OsdWithNumberATJosephMcc_button.actor.hide();
    }

    _openMenu() {
        this.menu.toggle();
    }

    _toggle_out_mute() {
        if (!this._output || this.actor.get_stage() == null)
            return;
        let iconName = "audio-volume-";
        let icon, volume;
        let _bar_level, _volume_str;
        let _maxLevel = Math.round(this._volumeMax / this._volumeNorm * 100) / 100;
        if (this._output && this._output.is_muted) {
            this._output.change_is_muted(false);
            if (this.mute_out_switch)
                this.mute_out_switch.setToggleState(false);

            volume = Math.round(this._output.volume / this._volumeNorm * 100);
            if (volume < 1)
                iconName += "muted";
            else if (volume < 33)
                iconName += "low";
            else if (volume < 67)
                iconName += "medium";
            else if (volume <= 100)
                iconName += "high";
            else
                iconName += "overamplified";

            if (this.showMicMutedOnIcon && (!this.mute_in_switch || this.mute_in_switch.state)) iconName += "-with-mic-disabled";
            else if (this.showMicUnmutedOnIcon && (this.mute_in_switch && !this.mute_in_switch.state)) iconName += "-with-mic-enabled";

            iconName += "-symbolic";
            this._outputIcon = iconName;

            if (this.showMediaKeysOSD) {
                icon = Gio.Icon.new_for_string(this._outputIcon);
                _bar_level = null;
                _volume_str = "";
                if (this.showVolumeValue === true)
                    _volume_str = "" + volume + this.PERCENT_CHAR;
                if (this.showBarLevel === true)
                    _bar_level = volume;

                if (IS_OSD150_ENABLED())
                    Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level, _maxLevel, this.OSDhorizontal);
                else
                    Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level);
            }
        } else {
            if (this._output)
                this._output.change_is_muted(true);
            if (this.mute_out_switch)
                this.mute_out_switch.setToggleState(true);
            iconName = "audio-volume-muted";

            if (this.showMicMutedOnIcon && (!this.mute_in_switch || this.mute_in_switch.state)) iconName += "-with-mic-disabled";
            else if (this.showMicUnmutedOnIcon && (this.mute_in_switch && !this.mute_in_switch.state)) iconName += "-with-mic-enabled";

            iconName += "-symbolic";
            this._outputIcon = iconName;
            if (this.actor && this.actor.get_stage() != null)
                this.set_applet_icon_symbolic_name(this._outputIcon);
            if (this.showMediaKeysOSD) {
                icon = Gio.Icon.new_for_string(this._outputIcon);
                if (typeof(this.volume) == "string") {
                    if (this.volume.endsWith("%"))
                        volume = parseInt(this.volume.slice(0, -1));
                    else
                        volume = parseInt(this.volume);
                } else {
                    volume = this.volume;
                }
                _bar_level = null;
                _volume_str = "";
                if (this.showVolumeValue === true)
                    _volume_str = "" + volume + this.PERCENT_CHAR;
                if (this.showBarLevel === true)
                    _bar_level = volume;
                if (IS_OSD150_ENABLED())
                    Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level, _maxLevel, this.OSDhorizontal);
                else
                    Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level);
            }
        }
    }

    _toggle_in_mute() {
        if (!this._input) {
            this._volumeChange(null);
            return;
        }

        let newStatus = !this._input.is_muted;
        this._input.change_is_muted(newStatus);
        if (this.mute_in_switch) this.mute_in_switch.setToggleState(newStatus);
        this._volumeChange(null);
    }

    _onScrollEvent(actor, event) {
        this._applet_tooltip.show();
        let _event = event;
        let modifiers = Cinnamon.get_event_state(event);
        let shiftPressed = (modifiers & Clutter.ModifierType.SHIFT_MASK);
        let ctrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK);
        if (ctrlPressed || shiftPressed) {
            this._inputVolumeSection._onScrollEvent(this._inputVolumeSection.actor, _event);
            return
        }
        this._applet_tooltip.show();
        let direction = event.get_scroll_direction();
        if (this.reverseScrolling) {
            if (direction == Clutter.ScrollDirection.DOWN)
                direction = Clutter.ScrollDirection.UP;
            else if (direction == Clutter.ScrollDirection.UP)
                direction = Clutter.ScrollDirection.DOWN;
        }

        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }

        this._volumeChange(direction);
        this.volume_near_icon()
    }

    _volumeChange(direction) {
        if (this._sounds_settings) {
            this.volumeSoundEnabled = this._sounds_settings.get_boolean(VOLUME_SOUND_ENABLED_KEY);
            this.volumeSoundFile = this._sounds_settings.get_string(VOLUME_SOUND_FILE_KEY);
        }
        let currentVolume = this._output.volume;
        let volumeChange = (direction === null) ? true : false;
        let player = this._players[this._activePlayer];



        if (direction !== null) {
            if (direction == Clutter.ScrollDirection.DOWN) {
                let prev_muted = this._output.is_muted;
                this._output.volume = Math.max(0, currentVolume - this._volumeNorm * this.VOLUME_ADJUSTMENT_STEP);
                if (this._output.volume < 1) {
                    this._output.volume = 0;
                    if (!prev_muted)
                        this._output.change_is_muted(true);
                    this._outputIcon = "audio-volume-muted-symbolic";
                    this.set_applet_icon_symbolic_name(this._outputIcon);
                } else {
                    // 100% is magnetic:
                    if (this.magneticOn === true && this._output.volume != this._volumeNorm && this._output.volume > this._volumeNorm * (1 - this.VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (1 + this.VOLUME_ADJUSTMENT_STEP / 2))
                        this._output.volume = this._volumeNorm;

                    if (this.magneticOn === true && this.magnetic25On === true) {
                        for (let i = 0.25; i < 1.5; i += 0.25) {
                            if (i == 1) continue;
                            if (this._output.volume != i * this._volumeNorm && this._output.volume > this._volumeNorm * (i - this.VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (i + this.VOLUME_ADJUSTMENT_STEP / 2))
                                this._output.volume = i * this._volumeNorm;
                        }
                    }
                }

                volumeChange = true;
            } else if (direction == Clutter.ScrollDirection.UP) {
                this._output.volume = Math.min(this._volumeMax, currentVolume + this._volumeNorm * this.VOLUME_ADJUSTMENT_STEP);
                // 100% is magnetic:
                if (this.magneticOn === true && this._output.volume != this._volumeNorm && this._output.volume > this._volumeNorm * (1 - this.VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (1 + this.VOLUME_ADJUSTMENT_STEP / 2))
                    this._output.volume = this._volumeNorm;

                if (this.magneticOn === true && this.magnetic25On === true) {
                    for (let i = 0.25; i < 1.5; i += 0.25) {
                        if (i == 1) continue;
                        if (this._output.volume != i * this._volumeNorm && this._output.volume > this._volumeNorm * (i - this.VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (i + this.VOLUME_ADJUSTMENT_STEP / 2))
                            this._output.volume = i * this._volumeNorm;
                    }
                }

                this._output.change_is_muted(false);
                volumeChange = true;
            } else if (this.horizontalScroll && player !== null && player._playerStatus !== "Stopped") {
                if (direction == Clutter.ScrollDirection.LEFT) {
                    this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
                } else if (direction == Clutter.ScrollDirection.RIGHT) {
                    this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
                }
            }
        }

        if (volumeChange) {
            this._output.push_volume();
            this._notifyVolumeChange(this._output);
            this.setAppletTooltip();
            let volume = parseInt(this.volume.slice(0, -1));
            let icon_name = "audio-volume";
            if (volume > 100) icon_name += "-overamplified";
            else if (volume < 1) {
                icon_name += "-muted";
                volume = 0;
                this.volume = "0%";
            } else if (volume < 33) icon_name += "-low";
            else if (volume < 67) icon_name += "-medium";
            else icon_name += "-high";
            if (this.showMicMutedOnIcon &&
                (!this.mute_in_switch || this.mute_in_switch.state)
            )
                icon_name += "-with-mic-disabled";
            else if (this.showMicUnmutedOnIcon &&
                (this.mute_in_switch && !this.mute_in_switch.state)
            )
                icon_name += "-with-mic-enabled";
            icon_name += "-symbolic";
            this._outputIcon = icon_name;
            let icon = Gio.Icon.new_for_string(icon_name);
            this.set_applet_icon_symbolic_name(icon_name);
            let _bar_level = null;
            let _volume_str = "";
            if (this.showVolumeValue === true)
                _volume_str = "" + volume + this.PERCENT_CHAR;
            if (this.showBarLevel === true)
                _bar_level = volume;
            let _maxLevel = Math.round(this._volumeMax / this._volumeNorm * 100) / 100;
            if (this.showOSD && (this.showOSDonStartup || volume != parseInt(this.old_volume.slice(0, -1)))) {
                try {
                    if (IS_OSD150_ENABLED())
                        Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level, _maxLevel, this.OSDhorizontal);
                    else
                        Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level);
                } catch (e) {}
            }
            this.old_volume = "" + volume + "%";
            var intervalId = null;

            this.allowChangeArt = false;

            intervalId = setTimeout(() => {
                clearTimeout(intervalId);
                this.allowChangeArt = true;
                if (this._applet_tooltip)
                    this._applet_tooltip.hide();
                if (this.playerControl && this._activePlayer)  {
                    let dir = Gio.file_new_for_path(ALBUMART_PICS_DIR);
                    let dir_children = dir.enumerate_children("standard::name,standard::type,standard::icon,time::modified", Gio.FileQueryInfoFlags.NONE, null);
                    let file = dir_children.next_file(null);
                    if (file != null) {
                        this.setAppletTextIcon(this._players[this._activePlayer], ALBUMART_PICS_DIR + "/" + file.get_name());
                    } else {
                        this.setAppletTextIcon(this._players[this._activePlayer], true);
                    }
                    dir_children.close(null);
                } else {
                    this.setAppletTextIcon();
                }
            }, 1000 * this.showalbumDelay);
        } else {
            if (this._applet_tooltip)
                this._applet_tooltip.hide();
        }

        this.volume_near_icon();
    }

    _onButtonPressEvent(actor, event) {
        let buttonId = event.get_button();
        let modifiers = Cinnamon.get_event_state(event);
        let shiftPressed = (modifiers & Clutter.ModifierType.SHIFT_MASK);
        let ctrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK);

        // mute or play / pause players on middle click
        if (buttonId === 2) {
            if (shiftPressed || ctrlPressed) {
                if (this.middleShiftClickAction === "mute") {
                    if (this._input && this._output && this._output.is_muted === this._input.is_muted)
                        this._toggle_in_mute();
                    this._toggle_out_mute();
                } else if (this.middleShiftClickAction === "out_mute")
                    this._toggle_out_mute();
                else if (this.middleShiftClickAction === "in_mute")
                    this._toggle_in_mute();
                else if (this.middleShiftClickAction === "player")
                    this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote();
            } else {
                if (this.middleClickAction === "mute") {
                    if (this._input && this._output && this._output.is_muted === this._input.is_muted)
                        this._toggle_in_mute();
                    this._toggle_out_mute();
                } else if (this.middleClickAction === "out_mute")
                    this._toggle_out_mute();
                else if (this.middleClickAction === "in_mute")
                    this._toggle_in_mute();
                else if (this.middleClickAction === "player")
                    this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote();
            }
        } else if (buttonId === 8) { // previous and next track on mouse buttons 4 and 5 (8 and 9 by X11 numbering)
            this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
        } else if (buttonId === 9) {
            this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
        } else {
            return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
        }
        return Clutter.EVENT_STOP;
    }

    _onKeyPressEvent(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right ||
            key == Clutter.KEY_Left ||
            key == Clutter.KEY_AudioRaiseVolume ||
            key == Clutter.KEY_AudioLowerVolume) {
            return this._outputVolumeSection._onKeyPressEvent(this._outputVolumeSection.actor, event);
        }
        return false;
    }

    setIcon(icon, source, force=false) {
        // save the icon
        if (source) {
            if (source === "output")
                this._outputIcon = icon;
            else
                this._playerIcon = [icon, source === "player-path"];
        }

        if (this.playerControl && this._activePlayer && this._playerIcon[0]) {
            if (source === "output") {
                // if we have an active player, but are changing the volume, show the output icon and after three seconds change back to the player icon
                this.set_applet_icon_symbolic_name(this._outputIcon);
                if (this.stream && !this.stream.is_muted) {
                    if (this._iconTimeoutId != null) source_remove(this._iconTimeoutId);
                    this._iconTimeoutId = timeout_add_seconds(OUTPUT_ICON_SHOW_TIME_SECONDS, () => {
                        this.setIcon();
                        return this._iconLooping;
                    });
                }
            } else {
                // if we have an active player and want to change the icon, change it immediately
                if (this._playerIcon[1]) {
                    //CHANGE the icon!
                    if (this._playerIcon[0] != this.oldPlayerIcon0 || !this._iconTimeoutId || force) {
                        //CHANGE the icon!
                        this.set_applet_icon_path(this._playerIcon[0]);
                        this.oldPlayerIcon0 = this._playerIcon[0];
                    }
                } else {
                    //DON'T change the icon:
                    if (this._playerIcon[0] != this.oldPlayerIcon0 || !this._iconTimeoutId) {
                        this.set_applet_icon_symbolic_name(this._playerIcon[0]);
                        this.oldPlayerIcon0 = this._playerIcon[0];
                    }
                }
            }
        } else {
            // if we have no active player show the output icon
            this.set_applet_icon_symbolic_name(this._outputIcon);
        }
        this.volume_near_icon()
    }

    set_applet_icon_path(icon_path) {
        this._ensureIcon();
        try {
            let icon_path2 = icon_path.replace("AlbumArt/song-art", "sound150/icons");
            let file;
            if (GLib.file_test(icon_path2, GLib.FileTest.EXISTS))
                file = Gio.file_new_for_path(icon_path2);
            else
                file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({
                file: file
            }));
            this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
            this._setStyle();
        } catch (e) {
            // global.log(e);
        }
    }

    is_empty(path) {
        let dir = Gio.file_new_for_path(path);
        let children = dir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null);
        let file = children.next_file(null);
        children.close(null);
        return (file == null);
    }

    loopArt() {
        source_remove(this._loopArtId);
        this._loopArtId = null;
        if (!this._artLooping) return;

        if (this._playerctl && this._imagemagick && this.is_empty(ALBUMART_PICS_DIR))
            Util.spawnCommandLineAsync("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS));

        if (!this._playerctl || this.title_text_old == this.title_text) {
            this._loopArtId = timeout_add_seconds(10, () => {
                this.loopArt();
            });
            return
        }

        let subProcess = Util.spawnCommandLineAsyncIO("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS), (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                this._trackCoverFile = "file://" + stdout;
                let cover_path = decodeURIComponent(this._trackCoverFile);
                cover_path = cover_path.replace("file://", "");
                const file = Gio.File.new_for_path(cover_path);
                try {
                    const fileInfo = file.query_info("standard::*,unix::uid",
                        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                    const size = fileInfo.get_size();
                    if (size > 0) {
                        this._icon_path = cover_path;
                        this.setAppletIcon(true, true);
                    } else {
                        this._icon_path = null;
                        this._trackCoverFile = null;
                    }
                } catch (e) {
                    this._icon_path = null;
                    this._trackCoverFile = null;
                }
            }
            subProcess.send_signal(9);
        });
        this._loopArtId = timeout_add_seconds(10, () => {
            this.loopArt();
        });
    }

    setAppletIcon(player, path) {
        if (this.volume === "0%") {
            this.setIcon("audio-volume-muted-symbolic", "player-name");
            return
        }
        if (path != null) {
            if (path === true) {
                // Restore the icon path from the saved path.
                path = this._icon_path;
            } else {
                this._icon_path = path;
            }
        } else {
            // This track has no art, erase the saved path.
            this._icon_path = null;
            path = null;
        }

        if (!this.allowChangeArt) return;

        if (this.showalbum) {
            if (path && player && (player === true || player._playerStatus == "Playing")) {
                this.setIcon(path, "player-path");
            } else {
                if (this.showMicMutedOnIcon && (!this.mute_in_switch || this.mute_in_switch.state))
                    this.setIcon("media-optical-cd-audio-with-mic-disabled", "player-name");
                else if (this.showMicUnmutedOnIcon && (this.mute_in_switch && !this.mute_in_switch.state))
                    this.setIcon("media-optical-cd-audio-with-mic-enabled", "player-name");
                else
                    this.setIcon("media-optical-cd-audio", "player-name");
            }
        } else {
            if (this.showMicMutedOnIcon && (!this.mute_in_switch || this.mute_in_switch.state))
                this.setIcon("audio-x-generic-with-mic-disabled", "player-name");
            else if (this.showMicUnmutedOnIcon && (this.mute_in_switch && !this.mute_in_switch.state))
                this.setIcon("audio-x-generic-with-mic-enabled", "player-name");
            else
                this.setIcon("audio-x-generic", "player-name");
        }
    }

    setAppletText(player) {
        this.title_text = "";
        if (this.isHorizontal && this.showtrack && player && player._playerStatus != "Stopped") {
            if (player._artist == _("Unknown Artist")) {
                this.title_text = this._truncate(player._title);
            } else {
                if (this._panelHeight >= 40)
                    this.title_text = this._truncate(player._artist) + "\n" + this._truncate(player._title);
                else
                    this.title_text = this._truncate(player._title + ' - ' + player._artist);
            }
        }
        if (this.title_text_old != this.title_text) {
            del_song_arts();
        }
        this.title_text_old = this.title_text;
    }

    _truncate(text) {
        const glyphs = Util.splitByGlyph(text);
        if (glyphs.length > this.truncatetext) {
            return glyphs.slice(0, this.truncatetext - this.toolongchars.length).join("") + this.toolongchars;
        }
        return text;
    }

    setAppletTextIcon(player=null, icon=null) {
        this.player = player;
        if (player && player._owner != this._activePlayer)
            return;
        this.setAppletIcon(player, icon);
        this.setAppletTooltip();
    }

    setAppletTooltip() {
        var tooltips = [];
        if (this.tooltipShowVolume) {
            tooltips.push(_("Volume") + ": " + this.volume);
        }
        if (this.player && this.player._owner == this._activePlayer) {
            if (this.tooltipShowPlayer) {
                if (tooltips.length != 0) tooltips.push("");
                tooltips.push(this.player._name + " - " + _(this.player._playerStatus));
            }
            if (this.tooltipShowArtistTitle) {
                if (tooltips.length != 0) tooltips.push("");
                if (this.player._artist != _("Unknown Artist")) {
                    tooltips.push("<b>" + this.player._artist.replace(/\&/g, "&amp;").replace(/\"/g, "") + "</b>");
                }
                if (this._title != _("Unknown Title")) {
                    tooltips.push(this.player._title.replace(/\&/g, "&amp;").replace(/\"/g, ""));
                }
            }
            this.setAppletText(this.player);
        }
        if (!this._playerctl) {
            if (tooltips.length != 0) tooltips.push("");
            tooltips.push(_("The 'playerctl' package is required!"));
            tooltips.push(_("Please select 'Install playerctl' in this menu"));
        }
        if (!this._imagemagick) {
            if (tooltips.length != 0) tooltips.push("");
            tooltips.push(_("The 'imagemagick' package is required!"));
            tooltips.push(_("Please select 'Install imagemagick' in this menu"));
        }

        this.set_applet_tooltip(this._clean_str(tooltips.join("\n")), true);
        this._applet_tooltip.preventShow = false;
        this.volume_near_icon();
    }

    _clean_str(str) {
        //log("_clean_str");
        let ret = str.replace(/\\'/gi, "'");
        ret = ret.replace(/\\"/gi, '"');

        // Support &amp;, &quot;, &apos;, &lt; and &gt;, escape all other
        // occurrences of '&'.
        ret = ret.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');

        // Support <b>, <i>, and <u>, escape anything else
        // so it displays as raw markup.
        ret = ret.replace(/<(?!\/?[biu]>)/g, '&lt;');

        try {
            Pango.parse_markup(ret, -1, "");
            return ret;
        } catch (e) {
            logError(e);
            return GLib.markup_escape_text(ret, -1);
        }
    }

    _isInstance(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split(".").length > 4 ||
            /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    }

    _addPlayer(busName, owner) {
        if (this._players[owner]) {
            let prevName = this._players[owner]._busName;
            // HAVE: ADDING: ACTION:
            // master master reject, cannot happen
            // master instance upgrade to instance
            // instance master reject, duplicate
            // instance instance reject, cannot happen
            if (this._isInstance(busName) && !this._isInstance(prevName))
                this._players[owner]._busName = busName;
            else
                return;
        } else if (owner) {
            let player = new Player(this, busName, owner);

            // Add the player to the list of active players in GUI.
            // We don't have the org.mpris.MediaPlayer2 interface set up at this point,
            // add the player's busName as a placeholder until we can get its Identity.
            let item = new PopupMenu.PopupMenuItem(busName);
            item.activate = () => this._switchPlayer(player._owner);
            if (this._chooseActivePlayerItem)
                this._chooseActivePlayerItem.menu.addMenuItem(item);

            this._players[owner] = player;
            this._playerItems.push({
                player: player,
                item: item
            });

            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        }
    }

    _switchPlayer(owner) {
        if (this._players[owner]) {
            // The player exists, switch to it
            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        } else {
            // The player doesn't seem to exist. Remove it from the players list
            this._removePlayerItem(owner);
            this._updatePlayerMenuItems();
        }
    }

    _switchToNextPlayer() {
        if (this._playerItems.length <= 1 || !this._activePlayer) return;

        for (let i = 0, l = this._playerItems.length; i < l; ++i) {
            let playerItem = this._playerItems[i];
            if (playerItem.player._owner === this._activePlayer) {
                let selected = (i + 1) % l;
                this._switchPlayer(this._playerItems[selected].player._owner);
                return
            }
        }
    }

    _removePlayerItem(owner) {
        // Remove the player from the player switching list
        for (let i = 0, l = this._playerItems.length; i < l; ++i) {
            let playerItem = this._playerItems[i];
            if (playerItem.player._owner === owner) {
                playerItem.item.destroy();
                this._playerItems.splice(i, 1);
                break;
            }
        }
    }

    _removePlayer(busName, owner) {
        if (this._players[owner] && this._players[owner]._busName == busName) {
            this._removePlayerItem(owner);

            try {
                this._players[owner].destroy();
            } catch (e) {
                logError("Error trying destroy player");
            }
            try {
                delete this._players[owner];
            } catch (e) {
                logError("Error trying delete player");
            }

            if (this._activePlayer == owner) {
                // set _activePlayer to null if we have none now, or to the first value in the players list
                this._activePlayer = null;
                for (let i in this._players) {
                    this._changeActivePlayer(i);
                    break;
                }
            }
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        }
    }

    _changePlayerOwner(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner]._busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner]._owner = newOwner;
            delete this._players[oldOwner];
            if (this._activePlayer == oldOwner)
                this._activePlayer = newOwner;
        }
    }

    // will be called by an instance of #Player
    passDesktopEntry(entry) {
        if (entry == null) return;
        // do we know already this player?
        for (let i = 0, l = this._knownPlayers.length; i < l; ++i) {
            if (this._knownPlayers[i] === entry)
                return;
        }
        // No, save it to _knownPlayers and update player list
        this._knownPlayers.push(entry);
        this._knownPlayers.save();
        this._updateLaunchPlayer();
    }

    _showFixedElements() {
        // The launch player list
        this.menu.addMenuItem(this._launchPlayerItem);
        this._updateLaunchPlayer();

        // The list to use when switching between active players
        this.menu.addMenuItem(this._chooseActivePlayerItem);
        this._chooseActivePlayerItem.actor.hide();
        this._chooseActivePlayerItemActorIsHidden = true;

        // between these two separators will be the player MenuSection (position 3)
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._outputVolumeSection = new VolumeSlider(this, null, _("Volume"), null);
        this._outputVolumeSection.connect("values-changed", (...args) => this._outputValuesChanged(...args));

        this.menu.addMenuItem(this._outputVolumeSection);
        this.menu.addMenuItem(this._inputVolumeSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Sound Settings"), "sound");

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // button "remove_soundATcinnamonDOTorg"
        if (this.soundATcinnamonDOTorg_is_loaded) {
            let _remove_soundATcinnamonDOTorg_button = new PopupMenu.PopupIconMenuItem(_("Remove sound applet"), "edit-delete", St.IconType.SYMBOLIC);
            _remove_soundATcinnamonDOTorg_button.connect("activate", (event) => {
                this._on_remove_soundATcinnamonDOTorg_from_panels()
            });
            this.menu.addMenuItem(_remove_soundATcinnamonDOTorg_button);
        }

        // button "remove_OsdWithNumber"
        this._remove_OsdWithNumberATJosephMcc_button = new PopupMenu.PopupIconMenuItem(_("Remove the OsdWithNumber extension"), "edit-delete", St.IconType.SYMBOLIC);
        this._remove_OsdWithNumberATJosephMcc_button.connect("activate", (event) => {
            this._on_remove_OsdWithNumber_from_extensions()
        });
        this.menu.addMenuItem(this._remove_OsdWithNumberATJosephMcc_button);
        if (this.OsdWithNumberATJosephMcc_is_loaded_internal)
            this._remove_OsdWithNumberATJosephMcc_button.actor.show();
        else
            this._remove_OsdWithNumberATJosephMcc_button.actor.hide();

        //button Install playerctl (when it isn't installed)
        if (this._playerctl === null) {
            let _install_playerctl_button = this.menu.addAction(_("Install playerctl"), () => {
                Util.spawnCommandLineAsync("/usr/bin/env bash -C '%s/install_playerctl.sh'".format(PATH2SCRIPTS));
            });
        }
        if (!this._imagemagick) {
            let _install_imagemagick_button = this.menu.addAction(_("Install imagemagick"), () => {
                Util.spawnCommandLineAsync("/usr/bin/env bash -C '%s/install_imagemagick.sh'".format(PATH2SCRIPTS));
            });
        }
    }

    _updateLaunchPlayer() {
        let availablePlayers = [];

        let appsys = Cinnamon.AppSystem.get_default();
        //_knownPlayers is an array containing the paths of desktop files
        for (let i = 0, l = this._knownPlayers.length; i < l; ++i) {
            let app = appsys.lookup_app(this._knownPlayers[i] + ".desktop");
            if (app)
                availablePlayers.push(app);
        }

        this._launchPlayerItem.menu.removeAll();

        if (availablePlayers.length > 0) {
            for (var p = 0; p < availablePlayers.length; p++) {
                let playerApp = availablePlayers[p];
                let menuItem = new MediaPlayerLauncher(playerApp, this._launchPlayerItem.menu);
                this._launchPlayerItem.menu.addMenuItem(menuItem);
            }
        }

        if (!this.playerControl || !availablePlayers.length) {
            this._launchPlayerItem.actor.hide();
            this._launchPlayerItemActorIsHidden = true;
        }
    }

    _updatePlayerMenuItems() {
        let names = [];

        if (this.playerControl && this._activePlayer) {
            this._launchPlayerItem.actor.show();
            this._launchPlayerItemActorIsHidden = false;
            this._chooseActivePlayerItem.actor.show();
            this._chooseActivePlayerItemActorIsHidden = false;

            // Show a dot on the active player in the switching menu
            for (let i = 0, l = this._playerItems.length; i < l; ++i) {
                let playerItem = this._playerItems[i];

                if (!this.avoidTwice || (this.avoidTwice && names.indexOf(playerItem.player._name) < 0)) {
                    playerItem.item.setLabel(playerItem.player._name);
                    playerItem.item.setShowDot(playerItem.player._owner === this._activePlayer);
                    names.push(playerItem.player._name);
                } else {
                    this._removePlayerItem(playerItem.player._owner);
                }
            }

            // Hide the switching menu if we only have at most one active player
            if (this._chooseActivePlayerItem.menu.numMenuItems <= 1) {
                this._chooseActivePlayerItem.actor.hide();
                this._chooseActivePlayerItemActorIsHidden = true;
            }
        } else {
            if (this.playerControl && this._launchPlayerItem.menu.numMenuItems) {
                this._launchPlayerItem.actor.show();
                this._launchPlayerItemActorIsHidden = false;
            } else {
                this._launchPlayerItem.actor.hide();
                this._launchPlayerItemActorIsHidden = true;
                this._chooseActivePlayerItem.actor.hide();
                this._chooseActivePlayerItemActorIsHidden = true;
            }
        }
    }

    _changeActivePlayer(player) {
        if (this._activePlayer)
            this.menu.box.remove_actor(this._players[this._activePlayer].actor);

        this._activePlayer = player;
        if (this.playerControl && this._activePlayer != null) {
            let menuItem = this._players[player];
            this.menu.addMenuItem(menuItem, 2);
        }

        this._updatePlayerMenuItems();
    }

    _notifyVolumeChange(stream) {
        if (this.volumeSoundEnabled) {
            let volume;
            if (typeof(this.volume) == "string") {
                if (this.volume.endsWith("%"))
                    volume = parseInt(this.volume.slice(0, -1));
                else
                    volume = parseInt(this.volume);
            } else {
                volume = this.volume;
            }
            if (volume > 0 && volume < this.maxVolume)
                Main.soundManager.play("volume");
        }
    }

    _mutedChanged(object, param_spec, property) {
        if (property == "_output") {
            if (this.mute_out_switch)
                this.mute_out_switch.setToggleState(this._output.is_muted);
        } else if (property == "_input") {
            if (this.mute_in_switch)
                this.mute_in_switch.setToggleState(this._input.is_muted);
            this._volumeChange(null);
        }
    }

    _theme_set() {
        logDebug("_theme_set()");
        let color = this.color0_100;
        try {
            if (!this.themeNode) {
                logDebug("this.themeNode was not defined.");
                this.themeNode = this.actor.get_theme_node();
            }
            let defaultColor = this.themeNode.get_foreground_color();
            logDebug("defaultColor: "+defaultColor.to_string());
            color = defaultColor.to_string();
        } catch(e) {
            color = this.color0_100;
        }
        this.color0_100 = color;
        let _style = `color: ${color};`;
        logDebug("_style: "+_style);
        this.actor.style = _style;
        this._setStyle();
    }

    _outputValuesChanged(actor, iconName, percentage) {
        this.setIcon(iconName, "output", true);
        if (this.mute_out_switch)
            this.mute_out_switch.setIconSymbolicName(iconName);
        this.volume = percentage;
        this.setAppletTooltip();

        let color;
        let changeColor = false;

        try {
            if (!this.themeNode) {
                this.themeNode = this.actor.get_theme_node();
            }
            let defaultColor = this.themeNode.get_foreground_color();
            color = "rgba(" + defaultColor.red + "," + defaultColor.green + "," + defaultColor.blue + "," + defaultColor.alpha + ")";
        } catch(e) {
            color = this.color0_100;
            changeColor = true;
        }
        color = this.color0_100;
        changeColor = true;

        if (this.adaptColor) {
            let pc = Math.round(percentage.split("%")[0]);
            if (pc > 130) {
                color = this.color131_150; //Default is "red";
                changeColor = true;
            } else if (pc > 115) {
                color = this.color116_130; //Default is "orange";
                changeColor = true;
            } else if (pc > 100) {
                color = this.color101_115; //Default is "yellow";
                changeColor = true;
            } else {
                color = this.color0_100; //Default is "#e4e4e4";
                changeColor = true;
            }
        }
        let _style = `color: ${color};`;

        try {
            this.actor.style = _style;

            if (changeColor) {
                if (this._outputVolumeSection && this._outputVolumeSection.icon)
                    this._outputVolumeSection.icon.style = _style;
            } else {
                if (this._inputVolumeSection && this._inputVolumeSection.icon)
                    this._outputVolumeSection.icon.style = this._inputVolumeSection.icon.style
            }
        } catch (e) {
            logError("Problem changing color!!!: " + e)
        }
    }

    _inputValuesChanged(actor, iconName, percentage) {
        if (this.mute_in_switch) this.mute_in_switch.setIconSymbolicName(iconName);
        this.mic_level = percentage;
    }

    _onControlStateChanged() {
        if (this._control.get_state() == Cvc.MixerControlState.READY) {
            this._readOutput();
            this._readInput();
            this.actor.show();
        } else {
            this.actor.hide();
        }
    }

    _readOutput() {
        if (this._outputMutedId) {
            this._output.disconnect(this._outputMutedId);
            this._outputMutedId = null;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputVolumeSection.connectWithStream(this._output);
            this._outputMutedId = this._output.connect("notify::is-muted", (...args) => this._mutedChanged(...args, "_output"));
            this._mutedChanged(null, null, "_output");

            if (this.startupVolume > -1) {
                this.volume = "" + Math.round(this.startupVolume).toString() + "%";
                this.old_volume = this.volume;

                this._output.volume = Math.round(this.startupVolume) / 100 * this._volumeNorm;
                this._output.push_volume();
                this._volumeChange(Clutter.ScrollDirection.UP);
                this._volumeChange(Clutter.ScrollDirection.DOWN);
            }
        } else {
            this.setIcon("audio-volume-muted-symbolic", "output");
        }
    }

    _readInput() {
        if (this._inputMutedId) {
            this._input.disconnect(this._inputMutedId);
            this._inputMutedId = null;
        }
        this._input = this._control.get_default_source();
        if (this._input) {
            this._inputVolumeSection.connectWithStream(this._input);
            this._inputMutedId = this._input.connect("notify::is-muted", (...args) => this._mutedChanged(...args, "_input"));
            this._mutedChanged(null, null, "_input");
            this._inputSection.actor.show(); // Added
        } else {
            this._inputSection.actor.hide();
        }
    }

    _onDeviceAdded(control, id, type) {
        let device = this._control["lookup_" + type + "_id"](id);

        let item = new PopupMenu.PopupMenuItem(device.description);
        item.activate = () => this._control["change_" + type](device);

        let bin = new St.Bin({
            x_align: St.Align.END,
            style_class: "popup-inactive-menu-item"
        });
        let label = new St.Label({
            text: device.origin
        });
        bin.add_actor(label);
        try {
            item.addActor(bin, {
                expand: true,
                span: -1,
                align: St.Align.END
            });
        } catch (e) {
            logError("Unable to add actor bin to item!: " + e)
        }

        let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
        selectItem.menu.addMenuItem(item);
        // show the menu if we have more than two devices
        if (selectItem.menu.numMenuItems > 1)
            selectItem.actor.show();

        this._devices.push({
            id: id,
            type: type,
            item: item
        });
    }

    _onDeviceRemoved(control, id, type) {
        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type && this._devices[i].id === id) {
                let device = this._devices[i];
                if (device.item) {
                    device.item.destroy();
                }

                // hide submenu if showing them is unnecessary
                let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
                if (selectItem.menu.numMenuItems <= 1)
                    selectItem.actor.hide();

                this._devices.splice(i, 1);
                break;
            }
        }
    }

    _onDeviceUpdate(control, id, type) {
        this["_read" + type[0].toUpperCase() + type.slice(1)]();

        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type)
                this._devices[i].item.setShowDot(id === this._devices[i].id);
        }
    }

    _onStreamAdded(control, id) {
        let stream = this._control.lookup_stream_id(id);
        let appId = stream.application_id;

        if (stream.is_virtual || appId === "org.freedesktop.libcanberra") {
            // sort out unwanted streams
            return;
        }

        if (stream instanceof Cvc.MixerSinkInput) {
            // for sink inputs, add a menuitem to the application submenu
            let item = new StreamMenuSection(this, stream);
            this._outputApplicationsMenu.menu.addMenuItem(item);
            this._outputApplicationsMenu.actor.show();
            this._streams.push({
                id: id,
                type: "SinkInput",
                item: item
            });
        } else if (stream instanceof Cvc.MixerSourceOutput) {
            // for source outputs, only show the input section
            this._streams.push({
                id: id,
                type: "SourceOutput"
            });
            if (this._recordingAppsNum++ === 0) {
                this._inputSection.actor.show();
                if (this.mute_in_switch) this.mute_in_switch.actor.show();
                run_playerctld();
            }
        }
    }

    _onStreamRemoved(control, id) {
        for (let i = 0, l = this._streams.length; i < l; ++i) {
            if (this._streams[i].id === id) {
                let stream = this._streams[i];
                if (stream.item) {
                    stream.item.destroy();
                }

                // hide submenus or sections if showing them is unnecessary
                if (stream.type === "SinkInput") {
                    if (this._outputApplicationsMenu.menu.numMenuItems === 0)
                        this._outputApplicationsMenu.actor.hide();
                } else if (stream.type === "SourceOutput") {
                    if (--this._recordingAppsNum === 0) {
                        this._inputSection.actor.hide();
                        this.mute_in_switch.actor.hide();
                    }

                    if (this.alwaysCanChangeMic) {
                        this._inputSection.actor.show();
                        if (this.mute_in_switch) this.mute_in_switch.actor.show();
                    }
                    kill_playerctld();
                }
                if (this._seeker) {
                    this._seeker.destroy();
                }
                this._seeker = null;
                kill_playerctld();
                this._streams.splice(i, 1);
                break;
            }
        }
    }

    _removeAllStreams() {
        for (let i = 0, l = this._streams.length; i < l; ++i) {
            let stream = this._streams[i];
            if (stream.item) {
                stream.item.destroy();
            }

            // hide submenus or sections if showing them is unnecessary
            if (stream.type === "SinkInput") {
                if (this._outputApplicationsMenu.menu.numMenuItems === 0)
                    this._outputApplicationsMenu.actor.hide();
            } else if (stream.type === "SourceOutput") {
                if (--this._recordingAppsNum === 0) {
                    this._inputSection.actor.hide();
                    this.mute_in_switch.actor.hide();
                }

                if (this.alwaysCanChangeMic) {
                    this._inputSection.actor.show();
                    if (this.mute_in_switch) this.mute_in_switch.actor.show();
                }
            }
            this._streams.splice(i, 1);
        }
        if (this._seeker) {
            this._seeker.destroy();
        }
        this._seeker = null;
        kill_playerctld();
        if (!GLib.file_test(MPV_RADIO_PID, GLib.FileTest.EXISTS)) { // Radio3.0 is not running.
            del_song_arts();
        }
    }

    registerSystrayIcons() {
        for (let i = 0; i < this.players_with_seek_support.length; i++) {
            Main.systrayManager.registerTrayIconReplacement(this.players_with_seek_support[i], UUID);
        }
        for (let i = 0; i < this.players_without_seek_support.length; i++) {
            Main.systrayManager.registerTrayIconReplacement(this.players_without_seek_support[i], UUID);
        }
    }

    unregisterSystrayIcons() {
        Main.systrayManager.unregisterTrayIconReplacement(UUID);
    }

    _on_reload_this_applet_pressed() {
        kill_playerctld();
        // Reload this applet
        let to = setTimeout(() => {
                clearTimeout(to);
                Extension.reloadExtension(UUID, Extension.Type.APPLET);
            },
            1000);
    }

    _onSystemSoundSettingsPressed() {
        let command = "cinnamon-settings sound";
        Util.spawnCommandLineAsync(command);
    }

    volume_near_icon() {
        if (!this.actor.get_stage()) return;
        let label = "";
        if (this.showVolumeLevelNearIcon) {
            label = "" + this.volume;
            if (this._seeker && this._seeker.status == "Paused") label = "⏸ " + this.volume;
            if (this.title_text.length > 0) {
                if (this._panelHeight >= 60)
                    label += "\n" + this.title_text;
                else
                    label += " - " + this.title_text;
            }
        } else {
            if (this.title_text.length > 0)
                label = "" + this.title_text;
            if (this._seeker && this._seeker.status == "Paused") label = "⏸ " + label;
        }
        try {
            this.set_applet_label(label);
        } catch (e) {
            logError("Can't set applet label: " + e);
        }
        try {
            this.hide_applet_label(label.length === 0);
        } catch (e) {
            logError("Can't hide applet label: " + e);
        }
    }

    _reset_colors() {
        this.color0_100 = "#e4e4e4";
        this.color101_115 = "yellow";
        this.color116_130 = "orange";
        this.color131_150 = "red";
        this._on_sound_settings_change()
    }

    _set_shortcuts_as_default() {
        const schema = "org.cinnamon.desktop.keybindings.media-keys";
        const s = new Gio.Settings({
            schema_id: schema
        });

        const pause_on_off = s.get_strv("pause");
        this.pause_on_off = pause_on_off.join("::");

        const audio_stop = s.get_strv("stop");
        this.audio_stop = audio_stop.join("::");

        const volume_mute = s.get_strv("volume-mute");
        this.volume_mute = volume_mute.join("::");

        const volume_up = s.get_strv("volume-up");
        this.volume_up = volume_up.join("::");

        const volume_down = s.get_strv("volume-down");
        this.volume_down = volume_down.join("::");

        const audio_next = s.get_strv("next");
        this.audio_next = audio_next.join("::");

        const audio_prev = s.get_strv("previous");
        this.audio_prev = audio_prev.join("::");
    }

    install_OSD150() {
        // Installs the OSD150 extension.

        // First, install the '.json' config file:
        // There is no config file to install!

        // enabledExtensions will contain all desklets:
        var enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
        var extensionEEKline = "";
        for (let i = 0; i < enabledExtensions.length; i++) {
            let name = enabledExtensions[i];
            if (name == EXTENSION_UUID) {
                extensionEEKline = "" + enabledExtensions[i];
                break;
            }
        }

        if (extensionEEKline.length === 0) {
            // OSD150 must be installed.
            enabledExtensions.push(EXTENSION_UUID);
            global.settings.set_strv(ENABLED_EXTENSIONS_KEY, enabledExtensions);
        }
    }

    on_desklet_open_settings_button_clicked() {
        Util.spawnCommandLineAsync("cinnamon-settings desklets " + DESKLET_UUID);
    }

    _is_desklet_activated() {
        let enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
        var ret = false;
        for (let i = 0; i < enabledDesklets.length; i++) {
            let name = enabledDesklets[i].split(":")[0];
            if (name == DESKLET_UUID) {
                ret = true;
                break;
            }
        }
        this.desklet_is_activated = ret;
        if (this.context_menu_item_showDesklet) {
            this.context_menu_item_showDesklet._switch.setToggleState(this.show_desklet);
        }
        return ret;
    }

    get _playerctl() {
        return GLib.find_program_in_path("playerctl");
    }

    get _imagemagick() {
        return GLib.find_program_in_path("identify") && GLib.find_program_in_path("convert");
    }

    get showOSD() {
        if (!this.showMediaKeysOSD) {
            return false;
        } else {
            if (this.startingUp) {
                return this.showOSDonStartup;
            } else {
                return true;
            }
        }
    }

    get OsdWithNumberATJosephMcc_is_loaded_internal() {
        let enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
        var _OsdWithNumberATJosephMcc_is_loaded = false;
        for (let extData of enabledExtensions) {
            if (extData === "OsdWithNumber@JosephMcc") {
                _OsdWithNumberATJosephMcc_is_loaded = true;
                break;
            }
        }
        this.settings.setValue("OsdWithNumberATJosephMcc_is_loaded", _OsdWithNumberATJosephMcc_is_loaded);
        return _OsdWithNumberATJosephMcc_is_loaded;
    }

    get show_desklet() {
        return GLib.file_test(ALBUMART_ON, GLib.FileTest.EXISTS);
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new Sound150Applet(metadata, orientation, panel_height, instanceId);
}
