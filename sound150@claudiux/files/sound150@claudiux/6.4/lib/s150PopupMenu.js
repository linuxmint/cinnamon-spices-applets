//!/usr/bin/cjs
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const UUID = "sound150@claudiux";
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const PATH2SCRIPTS = APPLET_DIR + "/scripts";

const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");
const TMP_ALBUMART_DIR = XDG_RUNTIME_DIR + "/AlbumArt";
const ALBUMART_ON = TMP_ALBUMART_DIR + "/ON";
const ALBUMART_PICS_DIR = TMP_ALBUMART_DIR + "/song-art";
const ALBUMART_TITLE_FILE = TMP_ALBUMART_DIR + "/title.txt";

const MPV_RADIO_PID = XDG_RUNTIME_DIR + "/mpv_radio_PID";

const PopupMenu = imports.ui.popupMenu;
const { del_song_arts } = require("./lib/del_song_arts");
const { ControlButton } = require("./lib/controlButton");
const { VolumeSlider } = require("./lib/volumeSlider");
const Interfaces = imports.misc.interfaces;
const Clutter = imports.gi.Clutter;
const Slider = imports.ui.slider;
const Gettext = imports.gettext;
const Pango = imports.gi.Pango;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const {
    timeout_add_seconds,
    setTimeout,
    clearTimeout,
    source_remove
} = require("./lib/mainloopTools");

const ICON_SIZE = Math.trunc(28 * global.ui_scale);
const superRND = (2**31-1)**2;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

const RUNTIME_DIR = GLib.get_user_runtime_dir();
const R30MPVSOCKET = RUNTIME_DIR + "/mpvradiosocket";

const COVERBOX_LAYOUT_MANAGER = new Clutter.BinLayout({
    x_align: Clutter.BinAlignment.FILL,
    y_align: Clutter.BinAlignment.END
});

// playerctld:
function run_playerctld() {
    Util.spawnCommandLineAsync("/usr/bin/env bash -C '" + PATH2SCRIPTS + "/run_playerctld.sh'");
}

function kill_playerctld() {
    Util.spawnCommandLineAsync("/usr/bin/env bash -C '" + PATH2SCRIPTS + "/kill_playerctld.sh'");
}


// Text wrapper
const formatTextWrap = (text, maxLineLength) => {
    const words = text.replace(/[\r\n]+/g, " ").split(" ");
    let lineLength = 0;

    // use functional reduce, instead of for loop
    return words.reduce((result, word) => {
        if (lineLength + word.length >= maxLineLength) {
            lineLength = word.length;
            return result + `\n${word}`; // don't add spaces upfront
        } else {
            lineLength += word.length + (result ? 1 : 0);
            return result ? result + ` ${word}` : `${word}`; // add space only when needed
        }
    }, "");
}

// To capitalize each word
function capitalize_each_word(s) {
    return s.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
}

function randomIntegerInInterval(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

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

var players_without_seek_support = [];

class StreamMenuSection extends PopupMenu.PopupMenuSection {
    constructor(applet, stream) {
        super();

        let iconName = stream.icon_name;
        let name = stream.name;

        // capitalize the stream name
        if (name.length > 2) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Trim stream name
        name = formatTextWrap(name, 20);
        //~ logDebug("StreamMenuSection: name:"+name);

        // Special cases
        if (name === "Banshee") {
            iconName = "banshee";
        } else if (name === "Spotify") {
            iconName = "spotify";
        } else if (name === "VBox") {
            name = "Virtualbox";
            iconName = "virtualbox";
        } else if (name === "Firefox") {
            iconName = "firefox";
        } else if (name === "Mpv") {
            iconName = "mpv"
        } else if (name === _("Videos")) {
            iconName = "totem";
            name = "totem";
        } else if (iconName === "audio") {
            iconName = "audio-x-generic";
        }

        if (name != "Muffin") { // This test is it really necessary?
            this.slider = new VolumeSlider(applet, stream, name, iconName);
            //FIXME: which line? is this useful? it seems DEPRECATED.
            //~ this.slider._slider.style = "min-width: 6em;";
            //~ this.slider._slider.style = "width: 6em;";
            this.addMenuItem(this.slider);
        } else {
            this.slider = null
        }
    }
}

class Player extends PopupMenu.PopupMenuSection {
    constructor(applet, busname, owner) {
        super();
        this._owner = owner;
        this._busName = busname;
        this._applet = applet;
        //~ logDebug("busname: "+busname);
        players_without_seek_support = this._applet.players_without_seek_support;

        // We'll update this later with a proper name
        this._name = this._busName;

        this._oldTitle = "";
        this._title = "";

        let asyncReadyCb = (proxy, error, property) => {
            if (error)
                logError(error);
            else {
                this[property] = proxy;
                this._dbus_acquired();
            }
        };

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME,
            this._busName,
            (p, e) => asyncReadyCb(p, e, "_mediaServer"));

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME,
            this._busName,
            (p, e) => asyncReadyCb(p, e, "_mediaServerPlayer"));

        Interfaces.getDBusPropertiesAsync(this._busName,
            MEDIA_PLAYER_2_PATH,
            (p, e) => asyncReadyCb(p, e, "_prop"));

    }

    _dbus_acquired() {
        if (!this._prop || !this._mediaServerPlayer || !this._mediaServer)
            return;

        if (this._mediaServer.Identity) {
            this._name = this._mediaServer.Identity;
        } else {
            let displayName = this._busName.replace("org.mpris.MediaPlayer2.", "");
            //~ this._name = capitalize_each_word(displayName);
            this._name = displayName.capitalize();
        }

        let mainBox = new PopupMenu.PopupMenuSection();
        //~ this.addMenuItem(mainBox);

        this.vertBox = new St.BoxLayout({
            style_class: "sound-player",
            important: true,
            vertical: true
        });
        mainBox.addActor(this.vertBox, {
            expand: false
        });
        this.addMenuItem(mainBox);

        // Player info
        this._playerBox = new St.BoxLayout();
        this.playerIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.playerLabel = new St.Label({
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            x_align: Clutter.ActorAlign.START
        });

        this._playerBox.add_actor(this.playerIcon);
        this._playerBox.add_actor(this.playerLabel);

        if (this._mediaServer.CanRaise) {
            this._showCanRaise();
        }
        if (this._mediaServer.CanQuit) {
            this._showCanQuit();
        }

        this.vertBox.add_actor(this._playerBox);

        // Cover Box (art + track info)
        this._trackCover = new St.Bin({
            x_align: St.Align.MIDDLE
        });
        this._trackCoverFile = (this._trackCoverFileTmp == null || this._trackCoverFileTmp == false);
        this._oldTrackCoverFile = false;
        this.coverBox = new Clutter.Box();

        // Cover art
        this.cover = new St.Icon({
            icon_name: "media-optical",
            icon_size: Math.trunc(300 * global.ui_scale),
            //icon_type: St.IconType.FULLCOLOR
            icon_type: St.IconType.SYMBOLIC
        });
        this.coverBox.add_actor(this.cover);

        if (this._applet.showMediaOptical)
            this.cover.show();
        else
            this.cover.hide();

        this._cover_load_handle = 0;
        this._cover_path = null;

        //~ this.display_cover_button = new ControlButton("image-x-generic",
        //~ _("View cover"),
        //~ () => {
        //~ Util.spawnCommandLineAsync("xdg-open "+this._cover_path)
        //~ },
        //~ true
        //~ );
        //~ this.coverBox.add_actor(this.display_cover_button.getActor());
        //~ this.display_cover_button.getActor().show();

        // Track info (artist + title)
        this._artist = _("Unknown Artist");
        this._album = _("Unknown Album");
        this._title = _("Unknown Title");
        //this.trackInfo = new St.BoxLayout({style_class: "sound-player-overlay", style: "height: auto;", important: true, vertical: true});
        // Removing "style: "height: auto;"" avoids warning messages "St-WARNING **: Ignoring length property that isn't a number at line 1, col 9"
        this.trackInfo = new St.BoxLayout({
            style_class: "sound-player-overlay",
            //~ style: "min-height: 6em;", // replaces "height: auto;" REMOVED: DEPRECATED!
            important: true,
            vertical: true
        });
        let artistInfo = new St.BoxLayout();
        let artistIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "system-users",
            style_class: "popup-menu-icon"
        });
        this.artistLabel = new St.Label({
            text: this._artist
        });
        this.artistLabel.clutterText.line_wrap = true;
        this.artistLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.artistLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        artistInfo.add_actor(artistIcon);
        artistInfo.add_actor(this.artistLabel);
        let titleInfo = new St.BoxLayout();
        let titleIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "audio-x-generic",
            style_class: "popup-menu-icon"
        });
        this.titleLabel = new St.Label({
            text: this._title
        });

        this.titleLabel.clutterText.line_wrap = true;
        this.titleLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.titleLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        titleInfo.add_actor(titleIcon);
        titleInfo.add_actor(this.titleLabel);
        //~ titleInfo.add_actor(this.display_cover_button.getActor());
        this.trackInfo.add_actor(artistInfo);
        this.trackInfo.add_actor(titleInfo);
        //~ this.trackInfo.add_actor(this.display_cover_button.getActor());
        this.coverBox.add_actor(this.trackInfo);

        // If the actor is on stage, we set the layout manager
        //~ // else we're waiting about 500 ms to retry.
        if (this.actor && this.coverBox && this.actor.get_stage() != null) {
            this.coverBox.set_layout_manager(COVERBOX_LAYOUT_MANAGER);
        } else {
            let to = setTimeout(() => {
                clearTimeout(to);
                if (this.actor && this.coverBox && this.actor.get_stage() != null)
                    this.coverBox.set_layout_manager(COVERBOX_LAYOUT_MANAGER);
            }, 500);
        }

        this._trackCover.set_child(this.coverBox);
        try {
            this.vertBox.add_actor(this._trackCover);
        } catch (e) {
            logError("Unable to add actor this._trackCover to this.vertBox!: " + e)
        }

        // Labels
        //~ durationLabel = new St.Label({text:" 00:00 "});
        //~ durationLabel.clutterText.line_wrap = false;
        //~ durationLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ durationLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        //~ positionLabel = new St.Label({text:" 00:00 "});
        //~ positionLabel.clutterText.line_wrap = false;
        //~ positionLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ positionLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;

        // Playback controls
        let trackControls = new St.Bin({
            x_align: St.Align.MIDDLE
        });
        //~ if (this._prevButton) this._prevButton.destroy();
        this._prevButton = new ControlButton("media-skip-backward",
            _("Previous"),
            () => {
                //~ Util.spawnCommandLine("/usr/bin/env bash -c '%s'".format(DEL_SONG_ARTS_SCRIPT));

                if (this._seeker) {
                    if (this._seeker.status === "Playing" && this._seeker.posLabel) this._seeker.posLabel.set_text(" 00:00 ");
                    this._seeker.startingDate = Date.now();
                    this._seeker._setPosition(0);
                }

                if (this._name.toLowerCase() === "mpv" &&
                    GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
                } else
                    this._mediaServerPlayer.PreviousRemote();
            });
        //~ if (this._playButton) this._playButton.destroy();
        this._playButton = new ControlButton("media-playback-start",
            _("Play"),
            () => this._mediaServerPlayer.PlayPauseRemote());
        //~ if (this._stopButton) this._stopButton.destroy();
        this._stopButton = new ControlButton("media-playback-stop",
            _("Stop"),
            () => {
                //~ Util.spawnCommandLine("/usr/bin/env bash -c '%s'".format(DEL_SONG_ARTS_SCRIPT));

                if (this._name.toLowerCase() === "mpv" &&
                    GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
                } else {
                    this._mediaServerPlayer.StopRemote()
                }
            });
        //~ if (this._nextButton) this._nextButton.destroy();
        this._nextButton = new ControlButton("media-skip-forward",
            _("Next"),
            () => {
                //~ Util.spawnCommandLine("/usr/bin/env bash -c '%s'".format(DEL_SONG_ARTS_SCRIPT));

                if (this._name.toLowerCase() === "mpv" &&
                    GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
                } else
                    this._mediaServerPlayer.NextRemote();
            });

        try {
            this.trackInfo.add_actor(trackControls);
        } catch (e) {
            logError("Unable to add actor trackControls to this.trackInfo!")
        }

        this.controls = new St.BoxLayout();
        if (St.Widget.get_default_direction() === St.TextDirection.RTL)
            this.controls.set_pack_start(true);

        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        trackControls.set_child(this.controls);

        this._loopButton = new ControlButton("media-playlist-consecutive", _("Consecutive Playing"), () => this._toggleLoopStatus());
        this.controls.add_actor(this._loopButton.getActor());

        this._shuffleButton = new ControlButton("media-playlist-shuffle", _("No Shuffle"), () => this._toggleShuffle());
        this.controls.add_actor(this._shuffleButton.getActor());


        // Position slider
        if (this._mediaServerPlayer) {
            //~ if (this._seeker) this._seeker.destroy();
            this._seeker = new Seeker(
                this._mediaServerPlayer,
                this._prop,
                this._name.toLowerCase()
            );
            this.vertBox.add_actor(this._seeker.getActor());
            //this.vertBox.add_actor(seekerBox);
        }


        this._applet._updatePlayerMenuItems();

        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
        this._setMetadata(this._mediaServerPlayer.Metadata);

        this._propChangedId = this._prop.connectSignal("PropertiesChanged", (proxy, sender, [iface, props]) => {
            try {
                if (props.PlaybackStatus)
                    this._setStatus(props.PlaybackStatus.unpack());
                if (props.Metadata)
                    this._setMetadata(props.Metadata.deep_unpack());
                if (props.CanGoNext || props.CanGoPrevious)
                    this._updateControls();
                //~ else {
                //~ if(!props.CanGoNext) this._nextButton.setEnabled(false);
                //~ if(!props.CanGoPrevious) this._prevButton.setEnabled(false);
                //~ }
                if (props.LoopStatus)
                    this._setLoopStatus(props.LoopStatus.unpack());
                if (props.Shuffle)
                    this._setShuffle(props.Shuffle.unpack());
                if (props.Identity) {
                    this._name = props.Identity.unpack();
                    this._applet._updatePlayerMenuItems();
                }
                if (props.CanRaise) {
                    this._showCanRaise();
                }
                if (props.CanQuit) {
                    this._showCanQuit();
                }
                if (props.DesktopEntry) {
                    this._applet.passDesktopEntry(props.DesktopEntry.unpack());
                }
            } catch (e) {}
        });

        this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
        this._setShuffle(this._mediaServerPlayer.Shuffle);

        if (this._mediaServer.DesktopEntry) {
            this._applet.passDesktopEntry(this._mediaServer.DesktopEntry);
        }
    }

    _showCanRaise() {
        let btn = new ControlButton("go-up", _("Open Player"), () => {
            if (this._name.toLowerCase() === "spotify") {
                // Spotify isn't able to raise via Dbus once its main UI is closed
                Util.spawn(["spotify"]);
            } else {
                this._mediaServer.RaiseRemote();
            }
            this._applet.menu.close();
        }, true);
        this._playerBox.add_actor(btn.actor);
    }

    _showCanQuit() {
        let btn = new ControlButton("window-close", _("Quit Player"), () => {
            if (this._name.toLowerCase() === "mpv" &&
                GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
            } else
                this._mediaServer.QuitRemote();
            this._applet.menu.close();
        }, true);
        this._playerBox.add_actor(btn.actor);

        // get the desktop entry and pass it to the applet
        this._prop.GetRemote(MEDIA_PLAYER_2_NAME, "DesktopEntry", (result, error) => {
            if (!error)
                this._applet.passDesktopEntry(result[0].unpack());
        });
    }

    _setName(status) {
        this.playerLabel.set_text(this._name + " - " + _(status));
    }

    _updateControls() {
        var canGoNext = false;
        var canGoPrevious = false;
        try {
            this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, "CanGoNext", (value, error) => {
                //~ logDebug("error: "+error);
                if (!error) {
                    //~ logDebug("value[0].unpack(): "+value[0].unpack());
                    canGoNext = value[0].unpack();
                    //~ logDebug("canGoNext from value: "+canGoNext);
                    this._nextButton.setEnabled(canGoNext);
                } else {
                    canGoNext = false;
                    //~ this._nextButton.setEnabled(canGoNext);
                }
            });
        } catch (e) {
            canGoNext = false;
            //~ this._nextButton.setEnabled(canGoNext);
        }
        try {
            this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, "CanGoPrevious", (value, error) => {
                if (!error) {
                    canGoPrevious = value[0].unpack();
                    this._prevButton.setEnabled(canGoPrevious);
                } else {
                    canGoPrevious = false;
                    //~ this._prevButton.setEnabled(canGoPrevious);
                }
            });
        } catch (e) {
            canGoPrevious = false;
            //~ this._prevButton.setEnabled(canGoPrevious);
        }
        //~ logDebug("canGoNext: "+canGoNext);
        //~ logDebug("canGoPrevious: "+canGoPrevious);
        //~ this._nextButton.setEnabled(canGoNext);
        //~ this._prevButton.setEnabled(canGoPrevious);
    }

    //~ async _setMetadata(metadata) {
    _setMetadata(metadata) {
        if (!metadata || (this._applet.actor.get_stage() == null))
            return;

        //~ for (let info of Object.keys(metadata)) {
        //~ log(""+info+": "+metadata[info].unpack(), true);
        //~ }

        let trackid = ""; // D-Bus path: A unique identity for this track
        if (metadata["mpris:trackid"]) {
            trackid = metadata["mpris:trackid"].unpack();
        }

        let trackLength = 0; // Track length in secs
        if (metadata["mpris:length"]) {
            trackLength = metadata["mpris:length"].unpack() / 1000000;
        }
        //this._seeker.setTrack(trackid, trackLength);

        if (metadata["xesam:artist"]) {
            switch (metadata["xesam:artist"].get_type_string()) {
                case "s":
                    // smplayer sends a string
                    this._artist = metadata["xesam:artist"].unpack();
                    break;
                case "as":
                    // others send an array of strings
                    this._artist = metadata["xesam:artist"].deep_unpack().join(", ");
                    break;
                default:
                    this._artist = _("Unknown Artist");
            }
            // make sure artist isn't empty
            if (!this._artist) this._artist = _("Unknown Artist");
        } else
            this._artist = _("Unknown Artist");

        this.artistLabel.set_text(this._artist);

        if (metadata["xesam:album"])
            this._album = metadata["xesam:album"].unpack();
        else
            this._album = _("Unknown Album");

        let old_title = "" + this._title;
        if (metadata["xesam:title"]) {
            this._title = metadata["xesam:title"].unpack();
            if (this._title.includes("xml")) {
                let xml_string = this._title.replace(/>\s*</g, "><"); // deletes all useless spaces.

                try {
                    xml_string = HtmlEncodeDecode.decode(xml_string);
                    let json_data = xml2json(xml_string);
                    //~ log("json_data: "+JSON.stringify(json_data, null, 4), true);
                    if (json_data["ZettaLite"]) {
                        //~ log("ZettaLite data!!!", true);
                        let json_title = "" + json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Title"];
                        let json_artist = "" + json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Artist1"];
                        //~ log("json_title: "+json_title, true);
                        //~ log("json_artist: "+json_artist, true);
                        if (json_title) {
                            this._title = capitalize_each_word(json_title);
                        } else {
                            this._title = _("Unknown Title");
                        }
                        if (json_artist) {
                            this._artist = capitalize_each_word(json_artist);
                            this.artistLabel.set_text(this._artist);
                        } else {
                            this._artist = _("Unknown Artist");
                        }
                    } else
                        this._title = _("Unknown Title");
                } catch (e) {
                    //~ logError("XML error: "+e);
                    this._title = _("Unknown Title");
                }
            } else if (this._title.includes(" - ") && this._artist == _("Unknown Artist")) {
                [this._artist, this._title] = this._title.split(" - ");
                this.artistLabel.set_text(this._artist);
            }
        } else {
            this._title = _("Unknown Title");
        }

        if (this._applet.show_desklet) {
            GLib.file_set_contents(ALBUMART_TITLE_FILE, `${this._artist}\n${this._title}`);
        }

        if (old_title != this._title) {
            del_song_arts();
            Util.spawnCommandLineAsync("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS));
        }

        this.titleLabel.set_text(this._title);
        this._seeker.setTrack(trackid, trackLength, old_title != this._title);

        let change = false;
        if (metadata["mpris:artUrl"]) {
            if (this._oldTitle != this._title) {
                let artUrl = metadata["mpris:artUrl"].unpack();
                if (this._trackCoverFile != artUrl) {
                    this._trackCoverFile = artUrl;
                    change = true;
                }
                Util.spawnCommandLineAsync("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS));
            }
        } else if (metadata["xesam:url"]) {
            if (this._oldTitle != this._title) {
                Util.spawnCommandLineAsyncIO("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS), (stdout, stderr, exitCode) => {
                    if (exitCode === 0) {
                        this._trackCoverFile = "file://" + stdout;
                        if (this._oldTrackCoverFile != this._trackCoverFile) {
                            this._oldTrackCoverFile = this._trackCoverFile;
                            let cover_path = decodeURIComponent(this._trackCoverFile);
                            cover_path = cover_path.replace("file://", "");
                            const file = Gio.File.new_for_path(cover_path);
                            try {
                                const fileInfo = file.query_info("standard::*,unix::uid",
                                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                                const size = fileInfo.get_size();
                                if (size > 0) {
                                    this._showCover(cover_path);
                                } else {
                                    cover_path = null;
                                }
                            } catch (e) {
                                cover_path = null;
                                this._trackCoverFile = null;
                                change = true;
                            }
                        }
                    } else {
                        this._trackCoverFile = null;
                        change = true;
                    }
                });
            }
        } else {
            Util.spawnCommandLineAsync("/usr/bin/env bash -c %s/get_album_art.sh".format(PATH2SCRIPTS));
            if (this._trackCoverFile != false) {
                this._trackCoverFile = false;
                change = true;
            }
        }

        if (change) {
            if (this._trackCoverFileTmp) {
                this._trackCoverFileTmp.delete(null);
                this._trackCoverFileTmp = null;
            }
            if (this._trackCoverFile) {
                let cover_path = "";
                if (this._trackCoverFile.match(/^http/)) {
                    if (!this._trackCoverFileTmp)
                        this._trackCoverFileTmp = Gio.file_new_tmp("XXXXXX.mediaplayer-cover")[0];
                    Util.spawn_async(["wget", this._trackCoverFile, "-O", this._trackCoverFileTmp.get_path()], () => this._onDownloadedCover());
                } else if (this._trackCoverFile.match(/data:image\/(png|jpeg);base64,/)) {
                    if (!this._trackCoverFileTmp)
                        this._trackCoverFileTmp = Gio.file_new_tmp("XXXXXX.mediaplayer-cover")[0];
                    const cover_base64 = this._trackCoverFile.split(",")[1];
                    const base64_decode = data => new Promise(resolve => resolve(GLib.base64_decode(data)));
                    if (!cover_base64) {
                        return;
                    }
                    base64_decode(cover_base64)
                        .then(decoded => {
                            this._trackCoverFileTmp.replace_contents(
                                decoded,
                                null,
                                false,
                                Gio.FileCreateFlags.REPLACE_DESTINATION,
                                null
                            );
                            return this._trackCoverFileTmp.get_path();
                        })
                        .then(path => this._showCover(path));
                } else {
                    cover_path = decodeURIComponent(this._trackCoverFile);
                    cover_path = cover_path.replace("file://", "");
                    this._showCover(cover_path);
                }
            } else {
                this._trackCoverFile = null;
                this._trackCoverFileTmp = null;
                this._showCover(null); //false
            }
        }
        this._applet.setAppletTextIcon(this, true);
    }

    _setStatus(status) {
        if (!status)
            return;
        this._playerStatus = status;
        if (status == "Playing") {
            this._playButton.setData("media-playback-pause", _("Pause"));
            this.playerIcon.set_icon_name("media-playback-start");
            this._applet.setAppletTextIcon(this, true);
            this._seeker.play();
        } else if (status == "Paused") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-pause");
            //~ this._applet.setAppletTextIcon(this, false);
            this._applet.setAppletTextIcon(this, true);
            this._seeker.pause();
            this._applet.volume_near_icon();
        } else if (status == "Stopped") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-stop");
            this._applet.setAppletTextIcon(this, false);
            this._seeker.stop();
        } else {
            this._applet.setAppletTextIcon(this, false);
        }

        this._setName(status);
    }

    _toggleLoopStatus() {
        let mapping = {
            "None": "Playlist",
            "Playlist": "Track",
            "Track": "None"
        };

        this._mediaServerPlayer.LoopStatus = mapping[this._mediaServerPlayer.LoopStatus];
        this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
    }

    _setLoopStatus(status) {
        this._loopButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.LoopStatus;

        if (status === "None")
            this._loopButton.setData("media-playlist-consecutive-symbolic", _("Consecutive Playing"));
        else if (status === "Track")
            this._loopButton.setData("media-playlist-repeat-song", _("Repeat Single"));
        else if (status === "Playlist")
            this._loopButton.setData("media-playlist-repeat", _("Repeat All"));

        this._loopButton.setActive(status !== "None");
    }

    _toggleShuffle() {
        this._mediaServerPlayer.Shuffle = !this._mediaServerPlayer.Shuffle;
    }

    _setShuffle(status) {
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.Shuffle;

        this._shuffleButton.setData("media-playlist-shuffle", status ? _("Shuffle") : _("No Shuffle"));
        this._shuffleButton.setActive(status);
    }

    _onDownloadedCover() {
        if (!this._trackCoverFileTmp) return;
        let cover_path = this._trackCoverFileTmp.get_path();
        this._showCover(cover_path);
    }

    _showCover(cover_path) {
        if (!cover_path || !GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
            this.cover = new St.Icon({
                style_class: "sound-player-generic-coverart",
                important: true,
                icon_name: "media-optical",
                icon_size: Math.trunc(300 * global.ui_scale),
                //icon_type: St.IconType.FULLCOLOR
                icon_type: St.IconType.SYMBOLIC
            });
            cover_path = null;
        } else {

            let dir = Gio.file_new_for_path(ALBUMART_PICS_DIR);
            let dir_children = dir.enumerate_children("standard::name,standard::type,standard::icon,time::modified", Gio.FileQueryInfoFlags.NONE, null);
            if ((dir_children.next_file(null)) == null) { // dir does not contain any file.
                Util.spawnCommandLineAsync("cp -a %s %s/R3SongArt%s".format(
                    cover_path,
                    ALBUMART_PICS_DIR,
                    randomIntegerInInterval(0, superRND).toString()
                ));
            } else if (!GLib.file_test(MPV_RADIO_PID, GLib.FileTest.EXISTS)) { // Radio3.0 is not running.
                del_song_arts();
                Util.spawnCommandLineAsync("cp -a %s %s/R3SongArt%s".format(
                    cover_path,
                    ALBUMART_PICS_DIR,
                    randomIntegerInInterval(0, superRND).toString()
                ));
            }
            dir_children.close(null);

            this._cover_path = cover_path;
            this._applet._icon_path = cover_path; // Added
            this._applet.setAppletIcon(this._applet.player, cover_path); // Added
            this._cover_load_handle = St.TextureCache.get_default().load_image_from_file_async(
                cover_path,
                Math.trunc(300 * global.ui_scale),
                Math.trunc(300 * global.ui_scale),
                (cache, handle, actor) => {
                    this._on_cover_loaded(cache, handle, actor)
                }
            );
            this._applet.setIcon();


            //~ log("this._cover_path: "+this._cover_path, true);
            try {
                let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(
                    this._cover_path,
                    Math.trunc(300 * global.ui_scale),
                    Math.trunc(300 * global.ui_scale)
                );
                if (pixbuf) {
                    let image = new Clutter.Image();
                    image.set_data(
                        pixbuf.get_pixels(),
                        pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
                        pixbuf.get_width(),
                        pixbuf.get_height(),
                        pixbuf.get_rowstride()
                    );
                    this.cover = image.get_texture();
                }
                if (this._applet.keepAlbumAspectRatio) {
                    //TODO: Replace Texture by Image.
                    this.cover = new Clutter.Texture({
                        width: Math.trunc(300 * global.ui_scale),
                        keep_aspect_ratio: true,
                        //filter_quality: 2,
                        filter_quality: Clutter.Texture.QUALITY_HIGH,
                        filename: cover_path
                    });
                } else {
                    //TODO: Replace Texture by Image.
                    this.cover = new Clutter.Texture({
                        width: Math.trunc(300 * global.ui_scale),
                        height: Math.trunc(300 * global.ui_scale),
                        keep_aspect_ratio: false,
                        filter_quality: Clutter.Texture.QUALITY_HIGH,
                        filename: cover_path
                    });
                }
                //~ this.display_cover_button.show();
            } catch (e) {}
        }
        this._oldTitle = this._title; // Here??? FIXME!!!
    }

    _on_cover_loaded(cache, handle, actor) {
        if (handle !== this._cover_load_handle) {
            // Maybe a cover image load stalled? Make sure our requests match the callback.
            return;
        }

        try {
            if (this.coverBox && this.cover)
                this.coverBox.remove_actor(this.cover);
        } catch (e) {}

        // Make sure any oddly-shaped album art doesn't affect the height of the applet popup
        // (and move the player controls as a result).
        //~ log("actor size (wxh): "+actor.width+"x"+actor.height);
        //~ actor.set_margin_bottom(Math.max(0, Math.trunc(300 * global.ui_scale - actor.height)));
        let mb = (this._applet.viewFullAlbumArt) ? 100 : 50;
        actor.set_margin_bottom(mb);

        actor.set_margin_left(Math.max(0, Math.trunc(300 * global.ui_scale - actor.width)));
        //~ actor.set_margin_left(""+Math.max(0, Math.trunc(300 * global.ui_scale - actor.width))+"px");

        this.cover = actor;
        if (this.coverBox)
            this.coverBox.add_actor(this.cover);
        //~ this.coverBox.set_reactive = true;
        //~ this.coverBox.connect("button-press-event", (event) => Util.spawnCommandLineAsync("xdg-open "+this._cover_path));

        try {
            if (this.coverBox && this.cover)
                this.coverBox.set_child_below_sibling(this.cover, this.trackInfo);
        } catch (e) {}

        this._applet.setAppletTextIcon(this, this._cover_path);
    }

    onSettingsChanged() {
        this._loopButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.LoopStatus;
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.Shuffle;
    }

    destroy() {
        //~ logDebug('Player.destroy()');
        //~ if (this._seeker)
        //~ this._seeker.destroy();
        if (this._prop && this._propChangedId)
            this._prop.disconnectSignal(this._propChangedId);

        if (this._seeker)
            this._seeker.destroy();

        //FIXME!!! Error when a media is playing:
        try {
            PopupMenu.PopupMenuSection.prototype.destroy.call(this);
        } catch (e) {
            logError("Error destroying Player!!!: " + e)
        }
    }
}

class Seeker extends Slider.Slider {
    constructor(mediaServerPlayer, props, playerName) {
        super(0, true);

        this.destroyed = false;

        this.actor.set_direction(St.TextDirection.LTR); // Do not invert on RTL layout
        //~ this.actor.expand = true;
        //~ this.actor.set_draw_value(true);
        this.tooltipText = "00:00";
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.canSeek = true;
        this.status = "Stopped";
        this._wantedSeekValue = 0;

        this._currentTime = 0;
        this._length = 0;
        this._trackid = "";

        this._timeoutId = null;
        this._timeoutId_timerCallback = null;
        this._timerTicker = 0;

        this._mediaServerPlayer = mediaServerPlayer;
        this._prop = props;
        this._playerName = playerName;

        this.startingDate = Date.now();

        this.seekerBox = new St.BoxLayout();
        this.seekerBox.expand = true;
        this.seekerBox.x_align = St.Align.END;



        this.posLabel = new St.Label({
            text: " 00:00 "
        });
        this.posLabel.x_align = St.Align.START;
        //~ logDebug("this.posLabel: "+this.posLabel);
        //~ this.posLabel.clutterText.line_wrap = false;
        //~ this.posLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ this.posLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        this.durLabel = new St.Label({
            text: " 00:00 "
        });
        this.durLabel.x_align = St.Align.END;
        //~ logDebug("this.durLabel: "+this.durLabel);
        //~ this.durLabel.clutterText.line_wrap = false;
        //~ this.durLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ this.durLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;

        this.actor.x_align = St.Align.MIDDLE;
        this.seekerBox.add_actor(this.posLabel);
        this.seekerBox.add_actor(this.actor);
        this.seekerBox.add_actor(this.durLabel);

        this.connect("drag-end", () => {
            if (this.destroyed) return;
            this._setPosition();
        });
        this.connect("value-changed", () => {
            if (this.destroyed) return;
            if (!this._dragging) // Update on scroll events
                this._setPosition();
        });

        this.actor.connect("enter-event", (event) => {
            this.show_target_time()
            //~ // let [x,y] = event.get_position();
            //~ let [x,y] = this.tooltip.mousePosition;
            //~ logDebug("enter-event - x: "+x);
            //~ this.tooltipText = ""+x;
            //~ this.tooltip.set_text(this.tooltipText);
            //~ this.tooltip.show();
        });

        this.actor.connect("motion-event", (event) => {
            this.show_target_time()
        });

        this.actor.connect("leave-event", (event) => {
            let id = setTimeout(() => {
                if (this.tooltip)
                    this.tooltip.hide();
                clearTimeout(id);
            }, 100);
        });

        //~ this._seekChangedId = this._mediaServerPlayer.connectSignal("Seeked", (id, sender, value) => {
        this._seekChangedId = mediaServerPlayer.connectSignal("Seeked", (id, sender, value) => {
            if (this.destroyed) return;
            // Seek value sent by the player
            if (value > 0) {
                this._setPosition(value);
            }
            // Seek initiated by the position slider
            else if (this._wantedSeekValue > 0) {
                // Some broken gstreamer players (Banshee) reports always 0
                // when the track is seeked so we set the position at the
                // value we set on the slider
                this._setPosition(this._wantedSeekValue);
            } else {
                // Some players send negative values (Rhythmbox).
                // Only positive values or zero are allowed.
                this._setPosition(0);
            }

            this._wantedSeekValue = 0;
        });

        this._getCanSeek();
        this._getPosition(); // Added
    }

    show_target_time() {
        if (this.actor.get_stage() == null || this.destroyed) return;
        const [sliderX, sliderY] = this.actor.get_transformed_position();
        const width = this.actor.width;
        let [x, y] = this.tooltip.mousePosition;
        if (this.tooltip) {
            this.tooltip.hide();
            this.tooltipText = "" + this.time_for_label((x - sliderX) / width * this._length);
            this.tooltip.set_text(this.tooltipText);
            this.tooltip.visible = false;
            this.tooltip.preventShow = false;
            this.tooltip.show();
        }
        let id = setTimeout(() => {
            if (this.tooltip)
                this.tooltip.hide();
            clearTimeout(id);
        }, this.seekerTooltipDelay);
    }

    getActor() {
        return this.seekerBox;
    }

    time_for_label(sec) {
        let milliseconds = 1000 * sec;
        var date = new Date(milliseconds);
        var timeString;
        if (milliseconds < 3600000)
            timeString = date.toISOString().substring(14, 19);
        else
            timeString = date.toISOString().substring(11, 19);
        return " " + timeString + " ";
    }

    play() {
        if (this.destroyed) return;
        run_playerctld();
        this.status = "Playing";
        this._getCanSeek();
    }

    pause() {
        if (this.destroyed) return;
        this.status = "Paused";
        if (this.canSeek)
            this._updateTimer();
        else
            this._updateValue();
        run_playerctld();
    }

    stop() {
        if (this.destroyed) return;
        this.status = "Stopped";
        if (this.canSeek)
            this._updateTimer();
        else
            this._updateValue();

        //~ kill_playerctld(); //???
    }

    hideAll() {
        if (this.destroyed) return;
        if (this.durLabel) this.durLabel.hide();
        if (this.actor) this.actor.hide();
        if (this.posLabel) this.posLabel.hide();
        if (this.seekerBox) this.seekerBox.hide();
        //~ this.parent.hide();
    }

    showAll() {
        if (this.destroyed) return;
        if (this.seekerBox) this.seekerBox.show();
        if (this.durLabel) this.durLabel.show();
        if (this.posLabel) this.posLabel.show();
        if (this.actor) this.actor.show();
        //~ this.parent.show();
    }

    setTrack(trackid, length, force_zero = false) {
        if (this.destroyed) return;
        if (length > 0) {
            this.showAll();
        } else {
            this.hideAll();
            return
        }
        if (trackid != this._trackid || force_zero) {
            this.startingDate = Date.now();
            this._currentTime = 0;
            this._trackid = trackid;
        }
        this._length = length;
        if (this.status !== "Stopped" && this.durLabel) this.durLabel.set_text(this.time_for_label(length));
        this._wantedSeekValue = 0;
        this._updateValue();
    }

    _updateValue() {
        if (this.destroyed) return;
        //~ this._currentTime = (Date.now() - this.startingDate) / 1000;

        if (this.canSeek) {
            this.showAll();
            if (this._length > 0 && this._wantedSeekValue > 0) {
                this._wantedSeekValue = this._wantedSeekValue / 1000000;
                this.startingDate = Date.now() - this._wantedSeekValue * 1000;
                this.setValue(this._wantedSeekValue / this._length);
                this._currentTime = this._wantedSeekValue;
                if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(this.time_for_label(this._currentTime));
                this._wantedSeekValue = 0;
            } else if (!this._dragging) {
                if (this._length > 0 && this._currentTime > 0) {
                    if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(this.time_for_label(this._currentTime));
                    this.setValue(this._currentTime / this._length);
                } else {
                    this.setValue(0);
                    if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(" 00:00 ");
                }
            }
        } else {
            this._currentTime = (Date.now() - this.startingDate) / 1000;
            if (this._length > 0) {
                this.showAll();
                if (this._wantedSeekValue > 0) {
                    this._wantedSeekValue = this._wantedSeekValue / 1000000;
                    this.startingDate = Date.now() - this._wantedSeekValue * 1000;
                    this.setValue(this._wantedSeekValue / this._length);
                    this._currentTime = this._wantedSeekValue;
                    if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(this.time_for_label(this._currentTime));
                    this._wantedSeekValue = 0;
                } else if (!this._dragging) {
                    if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(this.time_for_label(this._currentTime));
                    this.setValue(this._currentTime / this._length);
                    if (this._timeoutId != null) {
                        source_remove(this._timeoutId);
                    }
                    this._timeoutId = null;
                    if (this._timeoutId_timerCallback != null) {
                        source_remove(this._timeoutId_timerCallback);
                    }
                    this._timeoutId_timerCallback = null;

                    if (!this.destroyed) {
                        this._timeoutId = timeout_add_seconds(1, () => {
                            this._updateValue();
                            return !this.destroyed
                        });
                        this._timeoutId_timerCallback = timeout_add_seconds(1, () => {
                            return this._timerCallback()
                        });
                    }
                    //return (!this.destroyed && this.status === "Playing") ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE; //???
                }
            } else {
                this.setValue(0);
                if (!this.destroyed && this.status === "Playing" && this.posLabel) this.posLabel.set_text(" 00:00 ");
                this.hideAll();
            }
        }
        //return GLib.SOURCE_REMOVE; //???
    }

    _timerCallback() {
        if (this.destroyed) return GLib.SOURCE_REMOVE;
        if (this.status === "Playing") {
            if (this._timerTicker < 10) {
                this._currentTime += 1;
                this._timerTicker++;
                this._updateValue();
            } else { // Sync every 10 ticks
                this._timerTicker = 0;
                this._getPosition();
            }
            return GLib.SOURCE_CONTINUE;
        } else if (this.status === "Stopped") {
            this._setPosition(0);
            this._timerTicker = 0;
            this._currentTime = 0;
            return GLib.SOURCE_REMOVE;
        }
        return (this.status === "Playing") ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
    }

    _updateTimer() {
        //~ if (this.destroyed) return GLib.SOURCE_REMOVE;

        if (this._timeoutId_timerCallback != null) {
            source_remove(this._timeoutId_timerCallback);
        }
        this._timeoutId_timerCallback = null;

        if (this.status === "Playing") {
            if (this.canSeek) {
                this._getPosition();
                this._timerTicker = 0;
                this._timeoutId_timerCallback = timeout_add_seconds(1, () => {
                    return this._timerCallback()
                });
            } else if (this._length > 0) {
                this._getPosition();
                this._timerTicker = 0;
                this._timeoutId_timerCallback = timeout_add_seconds(1, () => {
                    return this._timerCallback()
                });
            }
        } else {
            if (this.status === "Stopped") {
                this._currentTime = 0;
            }
            //this._updateValue(); //???
        }
    }

    _getCanSeek() {
        // Some players say they "CanSeek" but don't actually give their position over dbus
        if (players_without_seek_support.indexOf(this._playerName) > -1) {
            this._setCanSeek(false);
            return;
        }

        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, "CanSeek", (position, error) => {
            //~ logDebug("Dbus CanSeek: "+position[0].get_boolean());
            //~ logDebug("Dbus !error: "+!error);
            if (!error && position[0])
                this._setCanSeek(position[0].get_boolean());
            else
                this._setCanSeek(false);
        });
    }

    _cantSeek() {
        this.canSeek = false;
        //~ if (this.destroyed) return;
        if (this._length > 0) {
            this.showAll();
            this._updateValue();
        } else {
            this.hideAll();
        }
    }

    _setCanSeek(seek) {
        if (this.destroyed) return;

        if (!this._mediaServerPlayer) {
            this._cantSeek();
            return
        }
        let playback_rate = this._mediaServerPlayer.Rate;
        // Hide seek for non-standard speeds except: 0 may mean paused, Audacious returns null
        if (seek && (playback_rate == 1.0 || !playback_rate)) {
            this.canSeek = true;
            this.showAll();
            this._getPosition();
            this._updateTimer();
        } else {
            this._cantSeek();
        }
        //~ logDebug("this.canSeek: "+this.canSeek);
    }

    _setPosition(value) {
        if (this.destroyed) return;

        if (value >= 0) {
            this._currentTime = value / 1000000;
            this._updateValue();
        } else {
            let time = this._value * this._length * 1000000;
            this._wantedSeekValue = time;
            if (this._mediaServerPlayer) this._mediaServerPlayer.SetPositionRemote(this._trackid, time);
        }
    }

    _getPosition() {
        if (this.destroyed) return;

        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, "Position", (position, error) => {
            //~ logDebug("_getPosition dbus !error: "+!error);
            if (!error && position[0]) {
                //~ logDebug("_getPosition position: "+position[0].get_int64());
                this._setPosition(position[0].get_int64());
            } else {
                let pos;
                try {
                    pos = position[0].get_int64();
                } catch (e) {
                    pos = "NaN";
                    //~ logError("pos error: "+e);
                }
                if (isNaN(pos)) {
                    //~ logDebug("pos is NaN!!!");
                    this._currentTime = (Date.now() - this.startingDate) / 1000;
                    //~ logDebug("this._currentTime: "+this._currentTime);
                    this._setPosition(this._currentTime * 1000000);
                } else {
                    //~ logDebug("pos is Valid!!! pos:" + pos);
                    this._setPosition(pos);
                }
            }
        });
    }

    destroy() {
        //~ logDebug("Seeker.destroy()");
        if (this.destroyed) return;
        this.status = "Stopped";
        this.destroyed = true;
        if (this._seekChangedId) {
            this._mediaServerPlayer.disconnectSignal(this._seekChangedId);
            this._seekChangedId = null;
        }

        //~ this.disconnectAll(); //??? Seems cause of bugs.

        this.posLabel = null;
        this.durLabel = null;
        this.seekerBox = null;
        this._mediaServerPlayer = null;
        this._prop = null;
    }
}




class MediaPlayerLauncher extends PopupMenu.PopupBaseMenuItem {
    constructor(app, menu) {
        super({});

        this._app = app;
        this._menu = menu;
        this.label = new St.Label({
            text: app.get_name()
        });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this._icon_bin = new St.Bin({
            x_align: St.Align.END,
            child: this._icon
        });
        try {
            this.addActor(this._icon_bin, {
                expand: true,
                span: -1,
                align: St.Align.END
            });
        } catch (e) {
            logError("Unable to add actor this._icon_bin to this!: " + e)
        }

        this.connect("activate", (event) => this._onActivate(event));
    }

    _onActivate(event) {
        let _time = event.time;
        this._app.activate_full(-1, _time);
    }
}
