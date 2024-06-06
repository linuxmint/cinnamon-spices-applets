//"use strict";
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Cogl = imports.gi.Cogl; //Cogl
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cvc = imports.gi.Cvc;
const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Slider = imports.ui.slider;
const Gettext = imports.gettext; // Needed for translations
const Extension = imports.ui.extension; // Needed to reload this applet
const Pango = imports.gi.Pango;
const ModalDialog = imports.ui.modalDialog;

let HtmlEncodeDecode = require("./lib/htmlEncodeDecode");
const { xml2json } = require("lib/xml2json.min");


const UUID = "sound150@claudiux";
const HOME_DIR = GLib.get_home_dir();
const PATH2SCRIPTS = HOME_DIR+"/.local/share/cinnamon/applets/"+UUID+"/scripts";

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

const ENABLED_APPLETS_KEY = "enabled-applets";
// /org/cinnamon/show-media-keys-osd
const SHOW_MEDIA_KEYS_OSD_KEY = "show-media-keys-osd";

const RUNTIME_DIR = GLib.get_user_runtime_dir();
const R30MPVSOCKET = RUNTIME_DIR + "/mpvradiosocket";

// how long to show the output icon when volume is adjusted during media playback.
const OUTPUT_ICON_SHOW_TIME_SECONDS = 3;

function run_playerctld() {
    Util.spawnCommandLineAsync("bash -C '"+ PATH2SCRIPTS +"/run_playerctld.sh'");
}

function kill_playerctld() {
    Util.spawnCommandLineAsync("bash -C '"+ PATH2SCRIPTS +"/kill_playerctld.sh'");
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
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    customTrans = Gettext.dgettext("cinnamon", str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

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

// To capitalize each word
function capitalize_each_word(s) {
    return s.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
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
/* global values */
let players_without_seek_support = [
    "telegram desktop", "totem",
    "xplayer", "gnome-mplayer", "pithos",
    "smplayer"];
let players_with_seek_support = [
    "clementine", "banshee", "rhythmbox",
    "rhythmbox3", "pragha", "quodlibet",
    "amarok", "xnoise", "gmusicbrowser",
    "vlc", "qmmp", "deadbeef",
    "audacious", "celluloid", "spotify", "mpv"];
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

let VOLUME_ADJUSTMENT_STEP = 0.02; /* Volume adjustment step in % */

const ICON_SIZE = Math.trunc(28*global.ui_scale);

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const VOLUME_SOUND_ENABLED_KEY = "volume-sound-enabled";
const VOLUME_SOUND_FILE_KEY = "volume-sound-file";

class ControlButton {
    constructor(icon, tooltip, callback, small = false) {
        this.destroyed = false;
        this.actor = new St.Bin();

        this.button = new St.Button();
        this.button.connect("clicked", callback);

        if (small) {
            this.button.add_style_pseudo_class("small");
        }

        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            style_class: (small) ? "popup-menu-icon" : ""
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

        this.tooltip = new Tooltips.Tooltip(this.button, tooltip);
    }

    getActor() {
        if (this.destroyed) return null;
        return this.actor;
    }

    setData(icon, tooltip) {
        if (this.destroyed) return;
        try {
            if (this.icon) this.icon.icon_name = icon;
            if (this.tooltip) this.tooltip.set_text(tooltip);
        } catch(e) {}
    }

    setIconName(icon) {
        if (this.destroyed) return;
        try {
            this.icon.icon_name = icon;
        } catch(e) {}
    }

    setActive(status) {
        if (this.destroyed) return;
        try {
            if (this.button) this.button.change_style_pseudo_class("active", status);
        } catch(e) {}
    }

    setEnabled(status) {
        if (this.destroyed) return;
        try {
            if (this.button) this.button.change_style_pseudo_class("insensitive", !status);
            if (this.button) this.button.can_focus = status;
            if (this.button) this.button.reactive = status;
        } catch(e) {}
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        try {
            this.tooltip.destroy();
            this.actor.remove_actor(this.button);
            this.button.remove_all_children();
            this.button.destroy();
            this.actor.destroy();
        } catch(e) {}
        finally {
            this.tooltip = null;
            this.button = null;
            this.actor = null;
        }
    }
}

class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, stream, tooltip, app_icon) {
        const startLevel = (tooltip == _("Microphone")) ? 1*applet.mic_level.slice(0, -1) : 1*applet.volume.slice(0, -1);
        applet.showOSD = applet.showOSDonStartup;
        super(startLevel);
        this.applet = applet;
        this.oldValue = startLevel;

        Gtk.IconTheme.get_default().append_search_path("./icons");

        if (tooltip)
            this.tooltipText = tooltip + ": ";
        else
            this.tooltipText = "";

        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.connect("value-changed", () => this._onValueChanged());

        this.app_icon = app_icon;
        if (this.app_icon == null) {
            this.iconName = this.isMic ? "microphone-sensitivity-muted" : "audio-volume-muted";
            this.icon = new St.Icon({
                icon_name: this.iconName,
                icon_type: St.IconType.SYMBOLIC,
                icon_size: Math.trunc(16*global.ui_scale)}
            );
        }
        else {
            this.icon = new St.Icon({
                icon_name: this.app_icon,
                icon_type: St.IconType.FULLCOLOR,
                icon_size: Math.trunc(16*global.ui_scale)
            });
        }

        this.button = new ControlButton(
            (this.iconName) ? this.iconName : this.app_icon,
            _("Mute"),
            () => {
                let muted = false;
                if (this._value) this.oldValue = this._value;
                if (this.isMic) {
                    this.applet.mute_in_switch.setToggleState(!this.applet.mute_in_switch.state);
                    if (this.applet.mute_in_switch.state) muted = true;
                } else {
                    this.applet.mute_out_switch.setToggleState(!this.applet.mute_out_switch.state);
                    if (this.applet.mute_out_switch.state) muted = true;
                }
                if (muted) {
                    this.oldValue = this._value;
                    this.setValue(0);
                } else {
                    this.setValue(this.oldValue);
                }
                this._onValueChanged();
            },
            true
        );

        this.removeActor(this._slider);
        //this.addActor(this.icon, {span: 0});
        this.addActor(this.button.actor, {span: 0});
        this.addActor(this._slider, {span: -1, expand: true});

        this.connectWithStream(stream);
    }

    connectWithStream(stream) {
        if (!stream) {
            this.actor.hide();
            this.stream = null;
        } else {
            this.actor.show();
            this.stream = stream;
            this.isMic = stream instanceof Cvc.MixerSource || stream instanceof Cvc.MixerSourceOutput;
            this.isOutputSink = stream instanceof Cvc.MixerSink;

            let mutedId = stream.connect("notify::is-muted", () => this._update());
            let volumeId = stream.connect("notify::volume", () => this._update());
            this.connect("destroy", () => {
                stream.disconnect(mutedId);
                stream.disconnect(volumeId);
            });
        }

        this._update();
    }

    _onValueChanged() {
        if (!this.stream) return;

        let muted;
        // Use the scaled volume max only for the main output
        let volume = this._value * (this.isOutputSink ? this.applet._volumeMax : this.applet._volumeNorm);

        if (this._value < 0.005) {
            volume = 0;
            muted = true;
        } else {
            muted = false;
            //100% is magnetic:
            if (this.applet.magneticOn === true && volume != this.applet._volumeNorm && volume > this.applet._volumeNorm * (1 - VOLUME_ADJUSTMENT_STEP / 2) && volume < this.applet._volumeNorm * (1 + VOLUME_ADJUSTMENT_STEP / 2))
                volume = this.applet._volumeNorm;
            //Other 25% magnetized?
            if (this.applet.magneticOn === true && this.applet.magnetic25On === true) {
                for (let i = 0.25; i < 1.5; i+=0.25) {
                    if (i==1) continue;
                    if (volume != i*this.applet._volumeNorm && volume > this.applet._volumeNorm * (i - VOLUME_ADJUSTMENT_STEP / 2) && volume < this.applet._volumeNorm * (i + VOLUME_ADJUSTMENT_STEP / 2))
                        volume = i*this.applet._volumeNorm;
                }
            }
        }
        this.stream.volume = volume;
        this.stream.push_volume();

        let icon = Gio.Icon.new_for_string(this._volumeToIcon(this._value));

        if (this.applet.showOSD) {
            Main.osdWindowManager.show(-1, icon, Math.round(volume/this.applet._volumeNorm * 100), null);
        }


        if (this.stream.is_muted !== muted)
            this.stream.change_is_muted(muted);

        if (!this._dragging)
            this.applet._notifyVolumeChange(this.stream);
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - VOLUME_ADJUSTMENT_STEP / this.applet._volumeMax * this.applet._volumeNorm);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + VOLUME_ADJUSTMENT_STEP / this.applet._volumeMax * this.applet._volumeNorm);
        }

        this._slider.queue_repaint();
        this.tooltip.show();
        this.emit("value-changed", this._value);
    }

    _onKeyPressEvent(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right ||
            key == Clutter.KEY_Left ||
            key == Clutter.KEY_AudioRaiseVolume ||
            key == Clutter.KEY_AudioLowerVolume) {
            let delta = (key == Clutter.KEY_Right || key == Clutter.KEY_AudioRaiseVolume) ? VOLUME_ADJUSTMENT_STEP : -VOLUME_ADJUSTMENT_STEP;

            if (delta < 0) {
                this._value = Math.max(0, this._value + delta / this.applet._volumeMax * this.applet._volumeNorm);
            } else {
                this._value = Math.min(1, this._value + delta / this.applet._volumeMax * this.applet._volumeNorm);
            }
            this._slider.queue_repaint();
            this.emit("value-changed", this._value);
            this.emit("drag-end");
            return true;
        }
        return false;
    }


    _update() {
        // value: percentage of volume_max (set as value in the widget)
        // visible_value: percentage of volume_norm (shown to the user)
        // these only differ for the output, and only when the user changes the maximum volume
        let volume = (!this.stream || this.stream.is_muted) ? 0 : this.stream.volume;
        let value, visible_value, delta = VOLUME_ADJUSTMENT_STEP * this.applet._volumeMax / this.applet._volumeNorm;

        if (this.isOutputSink) {
            value = volume / this.applet._volumeMax;
            visible_value = volume / this.applet._volumeNorm;
            if (this.applet.magneticOn === true && visible_value != 1 && visible_value > 1 - delta / 2 && visible_value < 1 + delta / 2) {
                visible_value = 1; // 100% is magnetic
                value = this.applet._volumeNorm / this.applet._volumeMax;
                this.applet._output.volume = this.applet._volumeNorm;
                this.applet._output.push_volume();
            }
            if (this.applet.magneticOn === true && this.applet.magnetic25On === true) {
                for (let i = 0.25; i < 1.5; i+=0.25) {
                    if (i==1) continue;
                    if (visible_value != i*this.applet._volumeNorm && visible_value > this.applet._volumeNorm * (i - VOLUME_ADJUSTMENT_STEP / 2) && visible_value < this.applet._volumeNorm * (i + VOLUME_ADJUSTMENT_STEP / 2)) {
                        visible_value = i*this.applet._volumeNorm;
                        value = visible_value / this.applet._volumeMax;
                        this.applet._output.volume = i*this.applet._volumeNorm;
                        this.applet._output.push_volume();
                    }
                }

            }
        } else {
            visible_value = volume / this.applet._volumeNorm;
            value = visible_value
        }

        let percentage = Math.round(visible_value * 100) + "%";

        this.tooltip.set_text(this.tooltipText + percentage);
        if (this._dragging)
            this.tooltip.show();
        const iconName = this._volumeToIcon(value);
        const iconNameWithoutMic = iconName.replace("-with-mic-disabled", "").replace("-with-mic-enabled", "");
        if (this.app_icon == null) {
            this.icon.icon_name = iconNameWithoutMic;
            this.button.setIconName(iconNameWithoutMic);
            if (this.isOutputSink)
                this.applet.set_applet_icon_symbolic_name(iconName);
        }
        this.setValue(value);
        if (this.isOutputSink) {
            this.button.icon.style_class = "popup-menu-icon";
            this.button.icon.style = (visible_value > 1) ? this.applet.actor.style : null;
        }

        // send data to applet
        this.emit("values-changed", iconName, percentage);
    }

    _volumeToIcon(value) {
        let nominal = this.applet._volumeNorm / this.applet._volumeMax;
        let icon;
        if (value < 0.005) {
            icon = "muted";
        } else {
            let n2 = Math.floor(300 * value)/100;
            if (this.isMic) {
                if (n2 < 1)
                    icon = "low";
                else if (n2 < 2)
                    icon = "medium";
                else
                    icon = "high";
            } else {
                if (n2 < 1 * nominal)
                    icon = "low";
                else if (n2 < 2 * nominal)
                    icon = "medium";
                else if (n2 < 3 * nominal)
                    icon = "high";
                else
                    icon = "overamplified";
            }
        }
        if (this.applet.showMicMutedOnIcon && !this.isMic && (!this.applet.mute_in_switch || this.applet.mute_in_switch.state)) icon += "-with-mic-disabled";
        else if (this.applet.showMicUnmutedOnIcon && !this.isMic && (this.applet.mute_in_switch && !this.applet.mute_in_switch.state)) icon += "-with-mic-enabled";

        return this.isMic ? "microphone-sensitivity-" + icon + "-symbolic" : "audio-volume-" + icon + "-symbolic";
    }
}

class Seeker extends Slider.Slider {
    constructor(mediaServerPlayer, props, playerName) {
        super(0, true);
        this.actor.set_direction(St.TextDirection.LTR); // Do not invert on RTL layout
        //~ this.actor.set_draw_value(true);
        this.tooltipText = "00:00";
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.destroyed = false;
        this.canSeek = true;
        this.status = "Stopped";
        this._wantedSeekValue = 0;

        this._currentTime = 0;
        this._length = 0;
        this._trackid = "";

        this._timeoutId = null;
        this._timeoutId2 = null;
        this._timerTicker = 0;

        this._mediaServerPlayer = mediaServerPlayer;
        this._prop = props;
        this._playerName = playerName;

        this.startingDate = Date.now();

        this.seekerBox = new St.BoxLayout();

        this.posLabel = new St.Label({text:" 00:00 "});
        //~ logDebug("this.posLabel: "+this.posLabel);
        //~ this.posLabel.clutterText.line_wrap = false;
        //~ this.posLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ this.posLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        this.durLabel = new St.Label({text:" 00:00 "});
        //~ logDebug("this.durLabel: "+this.durLabel);
        //~ this.durLabel.clutterText.line_wrap = false;
        //~ this.durLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        //~ this.durLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;

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
            let id = setTimeout( () => {
                this.tooltip.hide();
                clearTimeout(id);
            }, 100);
        });

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
            }
            else {
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
        const [sliderX, sliderY] = this.actor.get_transformed_position();
        const width = this.actor.width;
        let [x,y] = this.tooltip.mousePosition;
        this.tooltip.hide();
        this.tooltipText = ""+this.time_for_label((x-sliderX)/width*this._length);
        this.tooltip.set_text(this.tooltipText);
        this.tooltip.visible = false;
        this.tooltip.preventShow = false;
        this.tooltip.show();
        let id = setTimeout( () => {
            this.tooltip.hide();
            clearTimeout(id);
        }, this.seekerTooltipDelay);
    }

    getActor() {
        return this.seekerBox;
    }

    time_for_label(sec) {
        //~ log("time_for_label("+sec+")", true);
        let _sec = sec;
        let _str = "";
        let h = 0;
        let m = 0;
        let s = 0;
        if (_sec > 3600) {
            h = Math.floor(_sec / 3600);
            _str = _str + h;
            if (h < 10)
                _str = "0" + _str;
            _str += ":";
            _sec = _sec - 3600 * h;
        }
        if (_sec > 60) {
            m = Math.floor(_sec / 60);
            if (m < 10)
                _str = _str + "0" + m;
            else
                _str = _str + m;
            _str += ":";
            _sec = _sec - 60 * m
        } else {
            _str += "00:";
        }
        s = Math.round(_sec);
        if (s < 10)
            _str = _str + "0" + s;
        else
            _str = _str + s;

        return " "+_str+" ";
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
        if (this._timeoutId) {
            try {Mainloop.source_remove(this._timeoutId);} catch(e) {}
            this._timeoutId = null;
        }
        run_playerctld();
    }

    stop() {
        if (this.destroyed) return;
        this.status = "Stopped";
        if (this.canSeek)
            this._updateTimer();
        else
            this._updateValue();
        if (this._timeoutId) {
            try {Mainloop.source_remove(this._timeoutId);} catch(e) {}
            this._timeoutId = null;
        }
        kill_playerctld(); //???
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

    setTrack(trackid, length, force_zero=false) {
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
        if (this.destroyed) return GLib.SOURCE_REMOVE;
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
                    if (this._timeoutId2) {
                        try {Mainloop.source_remove(this._timeoutId2);} catch(e) {}
                        this._timeoutId2 = null;
                    }
                    //~ this._timeoutId = Mainloop.timeout_add_seconds(1, this._updateValue.bind(this));
                    // Two lines removed:
                    this._timeoutId2 = Mainloop.timeout_add_seconds(1, this._timerCallback.bind(this));
                    return (this.status === "Playing") ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
                    //Replaced by these two lines:
                    //~ if (this.status === "Playing")
                        //~ this._timeoutId = Mainloop.timeout_add_seconds(1, this._timerCallback.bind(this));
                }
            } else {
                this.setValue(0);
                if (this.status === "Playing" && this.posLabel) this.posLabel.set_text(" 00:00 ");
                this.hideAll();
            }
        }
        return GLib.SOURCE_REMOVE;
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
        }
        if (this._timeoutId) try {Mainloop.source_remove(this._timeoutId);} catch(e) {} // Added
        this._timeoutId = null;
        return GLib.SOURCE_REMOVE;
    }

    _updateTimer() {
        if (this._timeoutId) {
            try {Mainloop.source_remove(this._timeoutId);} catch(e) {}
            this._timeoutId = null;
        }

        if (this.destroyed) return GLib.SOURCE_REMOVE;

        if (this.status === "Playing") {
            if (this.canSeek) {
                this._getPosition();
                this._timerTicker = 0;
                //~ if (this._timeoutId) {
                    //~ Mainloop.source_remove(this._timeoutId);
                    //~ this._timeoutId = null;
                //~ }
                try {this._timeoutId = Mainloop.timeout_add_seconds(1, this._timerCallback.bind(this));} catch(e) {}
            } else if (this._length > 0) {
                this._getPosition();
                this._timerTicker = 0;
                //~ if (this._timeoutId) {
                    //~ Mainloop.source_remove(this._timeoutId);
                    //~ this._timeoutId = null;
                //~ }
                this._timeoutId = Mainloop.timeout_add_seconds(1, this._timerCallback.bind(this));
            }
        } else {
            if (this.status === "Stopped") {
                this._currentTime = 0;
                //~ if (this._timeoutId) {
                    //~ Mainloop.source_remove(this._timeoutId);
                    //~ this._timeoutId = null;
                //~ }
            }
            //this._updateValue();
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
        if (this.destroyed) return;
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
                } catch(e) {
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
        this.destroyed = true;
        if (this._timeoutId) {
            try {Mainloop.source_remove(this._timeoutId);} catch(e) {}
            this._timeoutId = null;
        }
        if (this._timeoutId2) {
            try {Mainloop.source_remove(this._timeoutId2);} catch(e) {}
            this._timeoutId2 = null;
        }
        if (this._seekChangedId) {
            this._mediaServerPlayer.disconnectSignal(this._seekChangedId);
            this._seekChangedId = null;
        }

        this.disconnectAll();

        this.posLabel = null;
        this.durLabel = null;
        this.seekerBox = null;
        this._mediaServerPlayer = null;
        this._prop = null;
    }
}

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
        //~ if (name.length > 20) {
            //~ name = name.substring(0, 16) + "... ";
        //~ }
        name = formatTextWrap(name, 20);
        //~ log("StreamMenuSection: name:"+name, true);

        // Special cases
        if (name === "Banshee") {
            iconName = "banshee";
        }
        else if (name === "Spotify") {
            iconName = "spotify";
        }
        else if (name === "VBox") {
            name = "Virtualbox";
            iconName = "virtualbox";
        }
        else if (name === "Firefox") {
            iconName = "firefox";
        }
        else if (name === "Mpv") {
            iconName = "mpv"
        }
        else if (iconName === "audio") {
            iconName = "audio-x-generic";
        }

        if (name != "Muffin") { // This test is it really necessary?
            this.slider = new VolumeSlider(applet, stream, name, iconName);
            this.slider._slider.style = "min-width: 6em;";
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

        // We'll update this later with a proper name
        this._name = this._busName;

        let asyncReadyCb = (proxy, error, property) => {
            if (error)
                log(error);
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
            this._name = capitalize_each_word(displayName);
        }

        let mainBox = new PopupMenu.PopupMenuSection();
        this.addMenuItem(mainBox);

        this.vertBox = new St.BoxLayout({
            style_class: "sound-player",
            important: true,
            vertical: true
        });
        mainBox.addActor(this.vertBox, { expand: false });

        // Player info
        this._playerBox = new St.BoxLayout();
        this.playerIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.playerLabel = new St.Label({
            y_expand: true, y_align: Clutter.ActorAlign.CENTER,
            x_expand: true, x_align: Clutter.ActorAlign.START
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
        this._trackCover = new St.Bin({x_align: St.Align.MIDDLE});
        this._trackCoverFile = this._trackCoverFileTmp = false;
        this._oldTrackCoverFile = false;
        this.coverBox = new Clutter.Box();
        let l = new Clutter.BinLayout({
            x_align: Clutter.BinAlignment.FILL,
            y_align: Clutter.BinAlignment.END
        });
        try {
            this.coverBox.set_layout_manager(l);
        } catch(e) {logError("Unable to set_layout_manager(l)!: "+e)}

        // Cover art
        this.cover = new St.Icon({
            icon_name: "media-optical",
            icon_size: Math.trunc(300*global.ui_scale),
            //icon_type: St.IconType.FULLCOLOR
            icon_type: St.IconType.SYMBOLIC
        });
        this.coverBox.add_actor(this.cover);

        this._cover_load_handle = 0;
        this._cover_path = null;

        this.display_cover_button = new ControlButton("x-shape-image",
            _("View cover"),
            () => {
                Util.spawnCommandLineAsync("xdg-open "+this._cover_path)
            }
        );
        //~ this.coverBox.add_actor(this.display_cover_button.getActor());
        //~ this.display_cover_button.hide();

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
        this.artistLabel = new St.Label({text:this._artist});
        this.artistLabel.clutterText.line_wrap = true;
        this.artistLabel.clutterText.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.artistLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        artistInfo.add_actor(artistIcon);
        artistInfo.add_actor(this.artistLabel);
        let titleInfo = new St.BoxLayout();
        let titleIcon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_name: "audio-x-generic", style_class: "popup-menu-icon" });
        this.titleLabel = new St.Label({text:this._title});
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

        this._trackCover.set_child(this.coverBox);
        try {
            this.vertBox.add_actor(this._trackCover);
        } catch(e) {logError("Unable to add actor this._trackCover to this.vertBox!: "+e)}

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
        let trackControls = new St.Bin({x_align: St.Align.MIDDLE});
        if (this._prevButton) this._prevButton.destroy();
        this._prevButton = new ControlButton("media-skip-backward",
            _("Previous"),
            () => {
                if (this._seeker) {
                    if (this._seeker.status === "Playing" && this._seeker.posLabel) this._seeker.posLabel.set_text(" 00:00 ");
                    this._seeker.startingDate = Date.now();
                    this._seeker._setPosition(0);
                }

                if (this._name.toLowerCase() === "mpv"
                    && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                        GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
                } else
                    this._mediaServerPlayer.PreviousRemote();
            });
        if (this._playButton) this._playButton.destroy();
        this._playButton = new ControlButton("media-playback-start",
            _("Play"),
            () => this._mediaServerPlayer.PlayPauseRemote());
        if (this._stopButton) this._stopButton.destroy();
        this._stopButton = new ControlButton("media-playback-stop",
            _("Stop"),
            () => {
                if (this._name.toLowerCase() === "mpv"
                    && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                        GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
                } else {
                    this._mediaServerPlayer.StopRemote()
                }
            });
        if (this._nextButton) this._nextButton.destroy();
        this._nextButton = new ControlButton("media-skip-forward",
            _("Next"),
            () => {
                if (this._name.toLowerCase() === "mpv"
                    && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                        GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
                } else
                    this._mediaServerPlayer.NextRemote();
            });

        try {
            this.trackInfo.add_actor(trackControls);
        } catch(e) {logError("Unable to add actor trackControls to this.trackInfo!")}

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
            if (this._seeker) this._seeker.destroy();
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
            } catch(e) {}
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
            }
            else {
                this._mediaServer.RaiseRemote();
            }
            this._applet.menu.close();
        }, true);
        this._playerBox.add_actor(btn.actor);
    }

    _showCanQuit() {
        let btn = new ControlButton("window-close", _("Quit Player"), () => {
            if (this._name.toLowerCase() === "mpv"
                && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
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
                }
                else {
                    canGoNext = false;
                    //~ this._nextButton.setEnabled(canGoNext);
                }
            });
        } catch(e) {
            canGoNext = false;
            //~ this._nextButton.setEnabled(canGoNext);
        }
        try {
            this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, "CanGoPrevious", (value, error) => {
                if (!error) {
                    canGoPrevious = value[0].unpack();
                    this._prevButton.setEnabled(canGoPrevious);
                }
                else {
                    canGoPrevious = false;
                    //~ this._prevButton.setEnabled(canGoPrevious);
                }
            });
        } catch(e) {
            canGoPrevious = false;
            //~ this._prevButton.setEnabled(canGoPrevious);
        }
        //~ logDebug("canGoNext: "+canGoNext);
        //~ logDebug("canGoPrevious: "+canGoPrevious);
        //~ this._nextButton.setEnabled(canGoNext);
        //~ this._prevButton.setEnabled(canGoPrevious);
    }

    async _setMetadata(metadata) {
        if (!metadata)
            return;

        //~ for (let info of Object.keys(metadata)) {
            //~ log(""+info+": "+metadata[info].unpack(), true);
        //~ }

        let trackid = "";  // D-Bus path: A unique identity for this track
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
        }
        else
            this._artist = _("Unknown Artist");

        this.artistLabel.set_text(this._artist);

        if (metadata["xesam:album"])
            this._album = metadata["xesam:album"].unpack();
        else
            this._album = _("Unknown Album");

        let old_title = ""+this._title;
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
                        let json_title = ""+json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Title"];
                        let json_artist = ""+json_data["ZettaLite"]["LogEventCollection"]["LogEvent"][0]["Asset"]["Artist1"];
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
                } catch(e) {
                    //~ logError("XML error: "+e);
                    this._title = _("Unknown Title");
                }
            }
            else if (this._title.includes(" - ") && this._artist == _("Unknown Artist")) {
                [this._artist, this._title] = this._title.split(" - ");
                this.artistLabel.set_text(this._artist);
            }
        } else {
            this._title = _("Unknown Title");
        }
        this.titleLabel.set_text(this._title);
        this._seeker.setTrack(trackid, trackLength, old_title != this._title);

        let change = false;
        if (metadata["mpris:artUrl"]) {
            let artUrl = metadata["mpris:artUrl"].unpack();
            if (this._trackCoverFile != artUrl) {
                this._trackCoverFile = artUrl;
                change = true;
            }
        } else if(metadata["xesam:url"]) {
            await Util.spawnCommandLineAsyncIO("bash -C %s/get_album_art.sh".format(PATH2SCRIPTS), Lang.bind(this, function(stdout, stderr, exitCode) {
                if (exitCode === 0) {
                    this._trackCoverFile = "file://"+stdout;
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
                        } catch(e) {
                            cover_path = null;
                            this._trackCoverFile = null;
                            change = true;
                        }
                    }
                } else {
                    this._trackCoverFile = null;
                    change = true;
                }
            }));
        } else {
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
                }
                else if (this._trackCoverFile.match(/data:image\/(png|jpeg);base64,/)) {
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
                }
                else {
                    cover_path = decodeURIComponent(this._trackCoverFile);
                    cover_path = cover_path.replace("file://", "");
                    this._showCover(cover_path);
                }
            }
            else {
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
        }
        else if (status == "Paused") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-pause");
            this._applet.setAppletTextIcon(this, false);
            this._seeker.pause();
        }
        else if (status == "Stopped") {
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
        if (! cover_path || ! GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
            this.cover = new St.Icon({
                style_class: "sound-player-generic-coverart",
                important: true,
                icon_name: "media-optical",
                icon_size: Math.trunc(300*global.ui_scale),
                //icon_type: St.IconType.FULLCOLOR
                icon_type: St.IconType.SYMBOLIC
            });
            cover_path = null;
        }
        else {
            this._cover_path = cover_path;
            this._applet._icon_path = cover_path; // Added
            this._applet.setAppletIcon(this._applet.player, cover_path); // Added
            this._cover_load_handle = St.TextureCache.get_default().load_image_from_file_async(
                cover_path,
                Math.trunc(300*global.ui_scale),
                Math.trunc(300*global.ui_scale),
                this._on_cover_loaded.bind(this)
            );
            this._applet.setIcon();


            //~ log("this._cover_path: "+this._cover_path, true);
            try {
                let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(
                    this._cover_path,
                    Math.trunc(300*global.ui_scale),
                    Math.trunc(300*global.ui_scale)
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
                        width: Math.trunc(300*global.ui_scale),
                        keep_aspect_ratio: true,
                        //filter_quality: 2,
                        filter_quality: Clutter.Texture.QUALITY_HIGH,
                        filename: cover_path
                    });
                }
                else {
                    //TODO: Replace Texture by Image.
                    this.cover = new Clutter.Texture({
                        width: Math.trunc(300*global.ui_scale),
                        height: Math.trunc(300*global.ui_scale),
                        keep_aspect_ratio: false,
                        filter_quality: Clutter.Texture.QUALITY_HIGH,
                        filename: cover_path
                    });
                }
                //~ this.display_cover_button.show();
            } catch(e) {}
        }
    }

    _on_cover_loaded(cache, handle, actor) {
        if (handle !== this._cover_load_handle) {
            // Maybe a cover image load stalled? Make sure our requests match the callback.
            return;
        }

        try {
            this.coverBox.remove_actor(this.cover);
        } catch(e) {}

        // Make sure any oddly-shaped album art doesn't affect the height of the applet popup
        // (and move the player controls as a result).
        //~ log("actor size (wxh): "+actor.width+"x"+actor.height, true);
        actor.set_margin_bottom(Math.max(0, Math.trunc(300*global.ui_scale - actor.height)));
        actor.set_margin_left(Math.max(0, Math.trunc(300*global.ui_scale - actor.width)));

        this.cover = actor;
        this.coverBox.add_actor(this.cover);
        //~ this.coverBox.set_reactive = true;
        //~ this.coverBox.connect("button-press-event", (event) => Util.spawnCommandLineAsync("xdg-open "+this._cover_path));

        try { this.coverBox.set_child_below_sibling(this.cover, this.trackInfo);} catch(e) {}
        this._applet.setAppletTextIcon(this, this._cover_path);
    }

    onSettingsChanged() {
        this._loopButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.LoopStatus;
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.Shuffle;
    }

    destroy() {
        //~ if (this._seeker)
            //~ this._seeker.destroy();
        if (this._prop && this._propChangedId)
            this._prop.disconnectSignal(this._propChangedId);

        if (this._seeker)
            this._seeker.destroy();

        try {
            PopupMenu.PopupMenuSection.prototype.destroy.call(this);
        } catch(e) {logError("Error destroying Player!!!: "+e)}
    }
}

class MediaPlayerLauncher extends PopupMenu.PopupBaseMenuItem {
    constructor(app, menu) {
        super({});

        this._app = app;
        this._menu = menu;
        this.label = new St.Label({ text: app.get_name() });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this._icon_bin = new St.Bin({ x_align: St.Align.END, child: this._icon });
        try {
            this.addActor(this._icon_bin, { expand: true, span: -1, align: St.Align.END });
        } catch(e) {logError("Unable to add actor this._icon_bin to this!: "+e)}

        this.connect("activate", (event) => this._onActivate(event));
    }

    _onActivate(event) {
        let _time = event.time;
        this._app.activate_full(-1, _time);
    }
}

class Sound150Applet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        Util.spawnCommandLineAsync("bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));
        Util.spawnCommandLineAsync("bash -C '"+ PATH2SCRIPTS +"/rm_tmp_files.sh'");

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;

        this.oldPlayerIcon0 = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("showOSDonStartup", "showOSDonStartup");
        this.showOSD = this.showOSDonStartup;
        this.settings.bind("seekerTooltipDelay", "seekerTooltipDelay");
        this.settings.bind("soundATcinnamonDOTorg_is_loaded", "soundATcinnamonDOTorg_is_loaded");
        this.settings.bind("showtrack", "showtrack", this.on_settings_changed);
        this.settings.bind("middleClickAction", "middleClickAction");
        this.settings.bind("middleShiftClickAction", "middleShiftClickAction");
        this.settings.bind("horizontalScroll", "horizontalScroll");
        this.settings.bind("showalbum", "showalbum", this.on_settings_changed);
        this.settings.bind("truncatetext", "truncatetext", this.on_settings_changed);
        this.settings.bind("keepAlbumAspectRatio", "keepAlbumAspectRatio", this.on_settings_changed);
        this.settings.bind("hideSystray", "hideSystray", function () {
            if (this.hideSystray) this.registerSystrayIcons();
            else this.unregisterSystrayIcons();
        });

        this.settings.bind("playerControl", "playerControl", this.on_settings_changed);
        this.settings.bind("extendedPlayerControl", "extendedPlayerControl", function() {
            for (let i in this._players)
                this._players[i].onSettingsChanged();
        });
        this.settings.bind("avoidTwice", "avoidTwice", this._updatePlayerMenuItems);


        this.settings.bind("_knownPlayers", "_knownPlayers");
        if (this.hideSystray) this.registerSystrayIcons();

        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
        this.settings.bind("keySwitchPlayer", "keySwitchPlayer", this._setKeybinding);

        this.settings.bind("stepVolume", "stepVolume", () => {
            VOLUME_ADJUSTMENT_STEP = this.settings.getValue("stepVolume") / 100;
            //~ log("VOLUME_ADJUSTMENT_STEP = " + VOLUME_ADJUSTMENT_STEP);
        });
        VOLUME_ADJUSTMENT_STEP = this.settings.getValue("stepVolume") / 100;
        //~ log("VOLUME_ADJUSTMENT_STEP = " + VOLUME_ADJUSTMENT_STEP);

        this.settings.bind("magneticOn", "magneticOn", () => this._on_sound_settings_change());
        this.settings.bind("magnetic25On", "magnetic25On", () => this._on_sound_settings_change());

        this.settings.bind("adaptColor", "adaptColor", () => this._on_sound_settings_change());
        this.settings.bind("color101_115", "color101_115", () => this._on_sound_settings_change());
        this.settings.bind("color116_130", "color116_130", () => this._on_sound_settings_change());
        this.settings.bind("color131_150", "color131_150", () => this._on_sound_settings_change());


        this.settings.bind("tooltipShowVolume", "tooltipShowVolume", this.on_settings_changed);
        this.settings.bind("tooltipShowPlayer", "tooltipShowPlayer", this.on_settings_changed);
        this.settings.bind("tooltipShowArtistTitle", "tooltipShowArtistTitle", this.on_settings_changed);

        this.settings.bind("alwaysCanChangeMic", "alwaysCanChangeMic", this.on_settings_changed);

        this._sounds_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
        this.settings.setValue("volumeSoundFile", this._sounds_settings.get_string(VOLUME_SOUND_FILE_KEY));
        this.settings.bind("volumeSoundFile", "volumeSoundFile", this.on_volumeSoundFile_changed);
        this.settings.setValue("volumeSoundEnabled", this._sounds_settings.get_boolean(VOLUME_SOUND_ENABLED_KEY));
        this.settings.bind("volumeSoundEnabled", "volumeSoundEnabled", this.on_volumeSoundEnabled_changed);

        this.settings.setValue("showMediaKeysOSD", global.settings.get_string(SHOW_MEDIA_KEYS_OSD_KEY));
        this.settings.bind("showMediaKeysOSD", "showMediaKeysOSD", this.on_showMediaKeysOSD_changed);
        this.showOSD = this.showOSDonStartup && (this.showMediaKeysOSD != "disabled");

        this.settings.bind("volume", "volume");
        this.settings.bind("mic-level", "mic_level");
        this.settings.bind("showVolumeLevelNearIcon", "showVolumeLevelNearIcon", this.volume_near_icon);
        this.settings.bind("showMicMutedOnIcon", "showMicMutedOnIcon", () => this._on_sound_settings_change());
        this.settings.bind("showMicUnmutedOnIcon", "showMicUnmutedOnIcon", () => this._on_sound_settings_change());
        this.settings.bind("redefine-volume-keybindings", "redefine_volume_keybindings", this._setKeybinding);
        this.settings.bind("audio-stop", "audio_stop", this._setKeybinding);
        this.settings.bind("pause-on-off", "pause_on_off", this._setKeybinding);
        this.settings.bind("volume-mute", "volume_mute", this._setKeybinding);
        this.settings.bind("volume-up", "volume_up", this._setKeybinding);
        this.settings.bind("volume-down", "volume_down", this._setKeybinding);
        this.settings.bind("audio-next", "audio_next", this._setKeybinding);
        this.settings.bind("audio-prev", "audio_prev", this._setKeybinding);

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

        Main.themeManager.connect("theme-set", Lang.bind(this, this._theme_set));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._setKeybinding();

        this.set_applet_icon_symbolic_name("audio-x-generic");

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

        this._control = new Cvc.MixerControl({ name: "Sound150 Volume Control" });
        this._control.connect("state-changed", (...args) => this._onControlStateChanged(...args));

        this._control.connect("output-added", (...args) => this._onDeviceAdded(...args, "output"));
        this._control.connect("output-removed", (...args) => this._onDeviceRemoved(...args, "output"));
        this._control.connect("active-output-update", (...args) => this._onDeviceUpdate(...args, "output"));

        this._control.connect("input-added", (...args) => this._onDeviceAdded(...args, "input"));
        this._control.connect("input-removed", (...args) => this._onDeviceRemoved(...args, "input"));
        this._control.connect("active-input-update", (...args) => this._onDeviceUpdate(...args, "input"));

        this._control.connect("stream-added", (...args) => this._onStreamAdded(...args));
        this._control.connect("stream-removed", (...args) => this._onStreamRemoved(...args));

        //~ this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
        this._volumeMax = this._sounds_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
        this._volumeNorm = this._control.get_vol_max_norm();

        this._streams = [];
        this._devices = [];
        this._recordingAppsNum = 0;

        this._output = null;
        this._outputMutedId = 0;
        this._outputIcon = "audio-volume-muted-symbolic";

        this._input = null;
        this._inputMutedId = 0;

        this._icon_name = '';
        this._icon_path = null;
        this._iconTimeoutId = null;

        this.actor.connect("scroll-event", (...args) => this._onScrollEvent(...args));
        this.actor.connect("key-press-event", (...args) => this._onKeyPressEvent(...args));

        this.mute_out_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-volume-muted-symbolic", St.IconType.SYMBOLIC);
        this.mute_in_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "microphone-sensitivity-muted-symbolic", St.IconType.SYMBOLIC);
        this._applet_context_menu.addMenuItem(this.mute_out_switch);
        this._applet_context_menu.addMenuItem(this.mute_in_switch);
        if (!this.alwaysCanChangeMic)
            this.mute_in_switch.actor.hide();
        else
            this.mute_in_switch.actor.show();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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

        let easy_effects = this.get_easy_effects();
        //~ log("easy_effects: "+easy_effects, true);
        if (easy_effects) {
            this.context_menu_item_easyEffects = new PopupMenu.PopupIconMenuItem(_("Easy Effects"), "easyeffects", St.IconType.SYMBOLIC);
            this.context_menu_item_easyEffects.connect("activate", async () => { Util.spawnCommandLine("%s".format(easy_effects)) });
            this._applet_context_menu.addMenuItem(this.context_menu_item_easyEffects);
        }

        this.mute_out_switch.connect("toggled", () => this._toggle_out_mute());
        this.mute_in_switch.connect("toggled", () => this._toggle_in_mute());

        this._control.open();

        this._volumeControlShown = false;

        this._showFixedElements();
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_label(this._applet_label.get_text());

        let appsys = Cinnamon.AppSystem.get_default();
        appsys.connect("installed-changed", () => this._updateLaunchPlayer());

        if (this._volumeMax > this._volumeNorm) {
            this._outputVolumeSection.set_mark(this._volumeNorm / this._volumeMax);
        }

        this._sounds_settings.connect("changed::" + MAXIMUM_VOLUME_KEY, () => this._on_sound_settings_change());

        this._loopArtId = null;
        this.loopArt();
    }

    on_volumeSoundFile_changed() {
        this._sounds_settings.set_string(VOLUME_SOUND_FILE_KEY, this.volumeSoundFile);
    }

    on_volumeSoundEnabled_changed() {
        this._sounds_settings.set_boolean(VOLUME_SOUND_ENABLED_KEY, this.volumeSoundEnabled);
    }

    on_showMediaKeysOSD_changed() {
        global.settings.set_string(SHOW_MEDIA_KEYS_OSD_KEY, this.showMediaKeysOSD);
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

    get_easy_effects() {
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
                    //~ log("dirId: "+dirId, true);
                    if (dirId === "Multimedia") {
                        const dirIter = dir.iter();
                        let nextTypeDir;
                        while ((nextTypeDir = dirIter.next()) !== CMenu.TreeItemType.INVALID) {
                            const entry = dirIter.get_entry();
                            const appInfo = entry.get_app_info();
                            if (appInfo && !appInfo.get_nodisplay()) {
                                const id = entry.get_desktop_file_id();
                                const app = appsys.lookup_app(id);
                                //~ log("APP NAME: "+app.get_name(), true);
                                if (app.get_name() == "Easy Effects") {
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
        Main.keybindingManager.addHotKey("sound-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
        Main.keybindingManager.addHotKey("switch-player-" + this.instance_id, this.keySwitchPlayer, Lang.bind(this, this._switchToNextPlayer));

        Main.keybindingManager.addHotKey("raise-volume-" + this.instance_id, "AudioRaiseVolume", () => this._volumeChange(Clutter.ScrollDirection.UP));
        Main.keybindingManager.addHotKey("lower-volume-" + this.instance_id, "AudioLowerVolume", () => this._volumeChange(Clutter.ScrollDirection.DOWN));
        Main.keybindingManager.addHotKey("volume-mute-" + this.instance_id, "AudioMute", () => this._toggle_out_mute());
        Main.keybindingManager.addHotKey("pause-" + this.instance_id, "AudioPlay", () => this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote());

        Main.keybindingManager.addHotKey("audio-next-" + this.instance_id, "AudioNext", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.NextRemote()
            }
        });
        Main.keybindingManager.addHotKey("audio-prev-" + this.instance_id, "AudioPrev", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote()
            }
        });
        Main.keybindingManager.addHotKey("audio-stop-" + this.instance_id, "AudioStop", () => {
            if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                    GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
            } else {
                this._players[this._activePlayer]._mediaServerPlayer.StopRemote()
            }
        });

        if (!this.redefine_volume_keybindings) return;

        try {
            Main.keybindingManager.removeHotKey("media-keys-4");
            Main.keybindingManager.removeHotKey("media-keys-2");
        } catch(e) {logError("Unable to removeHotKey media-keys: "+e)}

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
                    //~ logDebug("_name: "+this._players[this._activePlayer]._name);
                    if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                        && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                            GLib.file_set_contents(RUNTIME_DIR + "/R30Stop", "");
                    } else {
                        this._players[this._activePlayer]._mediaServerPlayer.StopRemote()
                    }
                });

        if (this.pause_on_off.length > 2)
            Main.keybindingManager.addHotKey("pause", this.pause_on_off,
                () => this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote());
        if (this.volume_mute.length > 2)
            Main.keybindingManager.addHotKey("volume-mute", this.volume_mute, () => this._toggle_out_mute());//(...args) => this._mutedChanged(...args, "_output"));
        if (this.volume_up.length > 2)
            Main.keybindingManager.addHotKey("volume-up", this.volume_up, () => this._volumeChange(Clutter.ScrollDirection.UP));
        if (this.volume_down.length > 2)
            Main.keybindingManager.addHotKey("volume-down", this.volume_down, () => this._volumeChange(Clutter.ScrollDirection.DOWN));
        if (this.audio_next.length > 2)
            Main.keybindingManager.addHotKey("audio-next", this.audio_next, () => {
                if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                        && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                            GLib.file_set_contents(RUNTIME_DIR + "/R30Next", "");
                } else {
                    this._players[this._activePlayer]._mediaServerPlayer.NextRemote()
                }
            });

        if (this.audio_prev.length > 2)
            Main.keybindingManager.addHotKey("audio-prev", this.audio_prev, () => {
                if (this._players[this._activePlayer]._name.toLowerCase() === "mpv"
                        && GLib.file_test(R30MPVSOCKET, GLib.FileTest.EXISTS)) {
                            GLib.file_set_contents(RUNTIME_DIR + "/R30Previous", "");
                } else {
                    this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote()
                }
            });
    } // End of _setKeybinding

    _on_sound_settings_change() {
        this._volumeMax = this._sounds_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
        if (this._volumeMax > this._volumeNorm) {
            this._outputVolumeSection.set_mark(this._volumeNorm / this._volumeMax);
        }
        else {
            this._outputVolumeSection.set_mark(0);
        }
        this._outputVolumeSection._update();
    }

    on_settings_changed() {
        if (this.playerControl && this._activePlayer)
            this.setAppletTextIcon(this._players[this._activePlayer], true);
        else
            this.setAppletTextIcon();

       if (this.alwaysCanChangeMic)
            this.mute_in_switch.actor.show();
        else if (this._recordingAppsNum === 0)
            this.mute_in_switch.actor.hide();

        this._changeActivePlayer(this._activePlayer);
    }

    on_applet_added_to_panel() {
        this.showOSD = this.showOSDonStartup && (this.showMediaKeysOSD != "disabled");
        this.volume_near_icon()
    }

    on_applet_reloaded() {
        this.showOSD = this.showOSDonStartup && (this.showMediaKeysOSD != "disabled");
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("sound-open-" + this.instance_id);
        Main.keybindingManager.removeHotKey("switch-player-" + this.instance_id);
        try {
            Main.keybindingManager.removeHotKey("raise-volume-" + this.instance_id);
            Main.keybindingManager.removeHotKey("lower-volume-" + this.instance_id);
            Main.keybindingManager.removeHotKey("volume-mute-" + this.instance_id);
            Main.keybindingManager.removeHotKey("pause-" + this.instance_id);
            Main.keybindingManager.removeHotKey("audio-next-" + this.instance_id);
            Main.keybindingManager.removeHotKey("audio-prev-" + this.instance_id);
        } catch(e) {}

        if (this.redefine_volume_keybindings) {
            try {
                Main.keybindingManager.removeHotKey("volume-mute");
                Main.keybindingManager.removeHotKey("volume-up");
                Main.keybindingManager.removeHotKey("volume-down");
                Main.keybindingManager.removeHotKey("pause");
                Main.keybindingManager.removeHotKey("audio-next");
                Main.keybindingManager.removeHotKey("audio-prev");
            } catch(e) {}
        }

        if (this.hideSystray)
            this.unregisterSystrayIcons();
        if (this._iconTimeoutId) {
            try {Mainloop.source_remove(this._iconTimeoutId);} catch(e) {}
            this._iconTimeoutId = null;
        }
        if (this._loopArtId) {
            try {Mainloop.source_remove(this._loopArtId);} catch(e) {}
            this._loopArtId = null;
        }
        if (this._seeker && this._seeker._timeoutId) {
            try {Mainloop.source_remove(this._seeker._timeoutId);} catch(e) {}
            this._seeker._timeoutId = 0;
        }

        if (this._ownerChangedId) {
            this._dbus.disconnectSignal(this._ownerChangedId);
            this._ownerChangedId = 0;
        }

        for (let i in this._players)
            if (this._players[i])
                this._players[i].destroy();
    }

    on_applet_clicked(event) {
        this._openMenu();
        if (!this.menu.isOpen) return;
        let kplo = this.settings.getValue("keepPlayerListOpen");
        if (!this._chooseActivePlayerItemActorIsHidden && this.settings.getValue("keepChoosePlayerOpen"))
            this._chooseActivePlayerItem.menu.open();
        if (!this._launchPlayerItemActorIsHidden && kplo)
            this._launchPlayerItem.menu.open();
    }

    _openMenu() {
        this.menu.toggle();
    }

    _toggle_out_mute() {
        if (!this._output)
            return;

        if (this._output.is_muted) {
            this._output.change_is_muted(false);
            this.mute_out_switch.setToggleState(false);
        } else {
            this._output.change_is_muted(true);
            this.mute_out_switch.setToggleState(true);
        }
    }

    _toggle_in_mute() {
        if (!this._input) {
            this.showOSD = (this.showMediaKeysOSD != "disabled");
            this._volumeChange(null);
            return;
        }

        let newStatus = !this._input.is_muted;
        this._input.change_is_muted(newStatus);
        this.mute_in_switch.setToggleState(newStatus);
        this.showOSD = (this.showMediaKeysOSD != "disabled");
        this._volumeChange(null);
    }

    _onScrollEvent(actor, event) {
        //~ logDebug("event: "+event.originalEvent.ctrlKey);
        let _event = event;
        this.showOSD = (this.showMediaKeysOSD != "disabled");
        let modifiers = Cinnamon.get_event_state(event);
        let shiftPressed = (modifiers & Clutter.ModifierType.SHIFT_MASK);
        let ctrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK);
        if (ctrlPressed || shiftPressed) {
            this._inputVolumeSection._onScrollEvent(this._inputVolumeSection.actor, _event);
            return
        }

        const direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.SMOOTH) {
            //~ let [dx, dy] = event.get_scroll_delta();
            //~ logDebug("Scroll delta - dx: "+dx+"   dy: "+dy);
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
                this._output.volume = Math.max(0, currentVolume - this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
                if (this._output.volume < 1) {
                    this._output.volume = 0;
                    if (!prev_muted)
                        this._output.change_is_muted(true);
                } else {
                    // 100% is magnetic:
                    if (this.magneticOn === true && this._output.volume != this._volumeNorm && this._output.volume > this._volumeNorm * (1 - VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (1 + VOLUME_ADJUSTMENT_STEP / 2))
                        this._output.volume = this._volumeNorm;

                    if (this.magneticOn === true && this.magnetic25On === true) {
                        for (let i = 0.25; i < 1.5; i+=0.25) {
                            if (i==1) continue;
                            if (this._output.volume != i*this._volumeNorm && this._output.volume > this._volumeNorm * (i - VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (i + VOLUME_ADJUSTMENT_STEP / 2))
                                this._output.volume = i*this._volumeNorm;
                        }
                    }
                }

                volumeChange = true;
            }
            else if (direction == Clutter.ScrollDirection.UP) {
                this._output.volume = Math.min(this._volumeMax, currentVolume + this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
                // 100% is magnetic:
                if (this.magneticOn === true && this._output.volume != this._volumeNorm && this._output.volume > this._volumeNorm * (1 - VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (1 + VOLUME_ADJUSTMENT_STEP / 2))
                    this._output.volume = this._volumeNorm;

                if (this.magneticOn === true && this.magnetic25On === true) {
                for (let i = 0.25; i < 1.5; i+=0.25) {
                    if (i==1) continue;
                    if (this._output.volume != i*this._volumeNorm && this._output.volume > this._volumeNorm * (i - VOLUME_ADJUSTMENT_STEP / 2) && this._output.volume < this._volumeNorm * (i + VOLUME_ADJUSTMENT_STEP / 2))
                        this._output.volume = i*this._volumeNorm;
                }
            }

                this._output.change_is_muted(false);
                volumeChange = true;
            }
            else if (this.horizontalScroll && player !== null && player._playerStatus !== "Stopped") {
                if (direction == Clutter.ScrollDirection.LEFT) {
                    this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
                }
                else if (direction == Clutter.ScrollDirection.RIGHT) {
                    this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
                }
            }
        }

        if (volumeChange) {
            this._output.push_volume();
            this._notifyVolumeChange(this._output);
            this.setAppletTooltip();
            this._applet_tooltip.show();
            let volume = this.volume.slice(0, -1);
            let icon_name = "audio-volume";
            if (volume > 100) icon_name += "-overamplified";
            else if (volume <1) icon_name += "-muted";
            else if (volume < 33) icon_name += "-low";
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
            let icon = Gio.Icon.new_for_string(icon_name);
            this.set_applet_icon_symbolic_name(icon_name);
            if (this.showOSD) {
                //~ Main.osdWindowManager.hideAll();
                Main.osdWindowManager.show(-1, icon, volume, null);
                //Main.osdWindowManager.show(0, icon, volume, true);
            }
            var intervalId = null;
            intervalId = Util.setInterval(() => {
                this._applet_tooltip.hide();
                Util.clearInterval(intervalId);
                return false
            }, 5000);
        } else {
            this._applet_tooltip.hide();
        }

        this.showOSD = (this.showMediaKeysOSD != "disabled");

        this.volume_near_icon()
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

    setIcon(icon, source) {
        //~ log("setIcon("+icon+", "+source+")", true);
        if (this._iconTimeoutId) {
            try {Mainloop.source_remove(this._iconTimeoutId)} catch(e) {}
            this._iconTimeoutId = null;
        }

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
                if (this._iconTimeoutId) {
                    try {Mainloop.source_remove(this._iconTimeoutId);} catch(e) {}
                    this._iconTimeoutId = null;
                }
                this._iconTimeoutId = Mainloop.timeout_add_seconds(OUTPUT_ICON_SHOW_TIME_SECONDS, () => {
                    try {Mainloop.source_remove(this._iconTimeoutId);} catch(e) {}
                    this._iconTimeoutId = null;
                    this.setIcon();
                });
            } else {
                // if we have an active player and want to change the icon, change it immediately
                if (this._playerIcon[1]) {
                    //~ logDebug("CHANGE the icon !!! "+this._playerIcon[0]);
                    if (this._playerIcon[0] != this.oldPlayerIcon0 || !this._iconTimeoutId) {
                        //~ logDebug("CHANGE the icon !!! "+this._playerIcon[0]);
                        this.set_applet_icon_path(this._playerIcon[0]);
                        this.oldPlayerIcon0 = this._playerIcon[0];
                    }
                } else {
                    //~ logDebug("DON'T change the icon !!!");
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

    set_applet_icon_path (icon_path) {
        this._ensureIcon();

        try {
            //~ if (this.cover) {
                //~ this._applet_icon.set_gicon(this.cover);
                //~ this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
                //~ this._setStyle();
                //~ return
            //~ }
            let file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({ file: file }));
            this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
            this._setStyle();
        } catch (e) {
            // global.log(e);
        }
    }

    loopArt() {
        if (!this._playerctl) {
            if (this._loopArtId) {
                try {Mainloop.source_remove(this._loopArtId);} catch(e) {}
                this._loopArtId = null;
            }
            this._loopArtId = Mainloop.timeout_add_seconds(5, this.loopArt.bind(this));
            return
        }
        let subProcess = Util.spawnCommandLineAsyncIO("bash -C %s/get_album_art.sh".format(PATH2SCRIPTS), Lang.bind(this, function(stdout, stderr, exitCode) {
            if (exitCode === 0) {
                this._trackCoverFile = "file://"+stdout;
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
                } catch(e) {
                    this._icon_path = null;
                    this._trackCoverFile = null;
                }
            } else {
                this._trackCoverFile = null;
            }
            subProcess.send_signal(9);
        }));
        if (this._loopArtId) {
            try {Mainloop.source_remove(this._loopArtId);} catch(e) {}
            this._loopArtId = null;
        }
        this._loopArtId = Mainloop.timeout_add_seconds(5, this.loopArt.bind(this))
    }

    setAppletIcon(player, path) {
        //~ log("setAppletIcon path:"+path, true);
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
        }
        else {
            if (this.showMicMutedOnIcon && (!this.mute_in_switch || this.mute_in_switch.state))
                this.setIcon("audio-x-generic-with-mic-disabled", "player-name");
            else if (this.showMicUnmutedOnIcon && (this.mute_in_switch && !this.mute_in_switch.state))
                this.setIcon("audio-x-generic-with-mic-enabled", "player-name");
            else
                this.setIcon("audio-x-generic", "player-name");
        }
    }

    setAppletText(player) {
        let title_text = "";
        if (this.showtrack && player && player._playerStatus == "Playing") {
            if (player._artist == _("Unknown Artist")) { // should it be translated?
                title_text = player._title;
            }
            else {
                title_text = player._title + ' - ' + player._artist;
            }
            const glyphs = Util.splitByGlyph(title_text);
            if (glyphs.length > this.truncatetext) {
                title_text = glyphs.slice(0, this.truncatetext - 3).join("") + "...";
            }
        }
        this.set_applet_label(title_text);
        //~ log("setAppletText: title_text:\n"+title_text, true)
    }

    setAppletTextIcon(player, icon) {
        this.player = player;
        if (player && player._owner != this._activePlayer)
            return;
        this.setAppletIcon(player, icon);
        this.setAppletText(player);
        this.setAppletTooltip();
    }

    setAppletTooltip() {
        let tooltips = [];
        if (this.tooltipShowVolume) {
            tooltips.push(_("Volume") + ": " + this.volume);
        }
        if (this.player && this.player._owner == this._activePlayer) {
            if (this.tooltipShowPlayer) {
                tooltips.push(this.player._name + " - " + _(this.player._playerStatus));
            }
            if (this.tooltipShowArtistTitle) {
                if (this.player._artist != _("Unknown Artist")) {
                    tooltips.push(this.player._artist);
                }
                if (this._title != _("Unknown Title")) {
                    tooltips.push(this.player._title);
                }
            }
        }
        if (!this._playerctl) {
            tooltips.push(_("The 'playerctl' package is required!"));
            tooltips.push(_("Please select 'Install playerctl' in this menu"));
        }

        this.set_applet_tooltip(tooltips.join("\n"));
        this.volume_near_icon();
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
            this._chooseActivePlayerItem.menu.addMenuItem(item);

            this._players[owner] = player;
            this._playerItems.push({ player: player, item: item });

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
                let selected = (i+1)%l;
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

            this._players[owner].destroy();
            delete this._players[owner];

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
        this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player"));
        this.menu.addMenuItem(this._launchPlayerItem);
        this._updateLaunchPlayer();

        // The list to use when switching between active players
        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));
        this._chooseActivePlayerItem.actor.hide();
        this._chooseActivePlayerItemActorIsHidden = true;
        this.menu.addMenuItem(this._chooseActivePlayerItem);

        // between these two separators will be the player MenuSection (position 3)
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._outputVolumeSection = new VolumeSlider(this, null, _("Volume"), null);
        this._outputVolumeSection.connect("values-changed", (...args) => this._outputValuesChanged(...args));

        this.menu.addMenuItem(this._outputVolumeSection);
        this.menu.addMenuItem(this._inputVolumeSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Sound Settings"), "sound");

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // button Reload this applet
        let _reload_button = new PopupMenu.PopupIconMenuItem(_("Reload this applet"), "restart", St.IconType.SYMBOLIC);
        _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed());
        this.menu.addMenuItem(_reload_button);

        // button "remove_soundATcinnamonDOTorg"
        if (this.soundATcinnamonDOTorg_is_loaded) {
            let _remove_soundATcinnamonDOTorg_button = new PopupMenu.PopupIconMenuItem(_("Remove sound applet"), "edit-delete", St.IconType.SYMBOLIC);
            _remove_soundATcinnamonDOTorg_button.connect("activate", (event) => {
                this._on_remove_soundATcinnamonDOTorg_from_panels()
            });
            this.menu.addMenuItem(_remove_soundATcinnamonDOTorg_button);
        }

        //button Install playerctl (when it isn't installed)
        if (this._playerctl === null) {
            let _install_playerctl_button = new PopupMenu.PopupIconMenuItem(_("Install playerctl"), "system-software-install", St.IconType.SYMBOLIC);
            _install_playerctl_button.connect("activate", (event) => {
                Util.spawnCommandLine("bash -C '%s/install_playerctl.sh'".format(PATH2SCRIPTS));
                this._on_reload_this_applet_pressed();
            });
            this.menu.addMenuItem(_install_playerctl_button);
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
                }
                else {
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
        if (this.volumeSoundEnabled)
            Main.soundManager.play("volume");
    }

    _mutedChanged(object, param_spec, property) {
        if (property == "_output") {
            this.mute_out_switch.setToggleState(this._output.is_muted);
        } else if (property == "_input") {
            this.mute_in_switch.setToggleState(this._input.is_muted);
            this._volumeChange(null);
        }
    }

    _theme_set() {
        this._on_reload_this_applet_pressed();
    }

    _outputValuesChanged(actor, iconName, percentage) {
        this.setIcon(iconName, "output");
        this.mute_out_switch.setIconSymbolicName(iconName);
        this.volume = percentage;
        this.setAppletTooltip();

        if (!this.themeNode) {
            this.themeNode = this.actor.get_theme_node();
        }
        let defaultColor = this.themeNode.get_foreground_color();
        let color = "rgba(" + defaultColor.red + "," + defaultColor.green + "," + defaultColor.blue + "," + defaultColor.alpha + ")";

        let changeColor = false;
        if (this.adaptColor) {
            let pc = Math.round(percentage.split("%")[0]);
            if (pc > 130) {
                color = this.color131_150; //Default is "red";
                changeColor = true;
            }
            else if (pc > 115) {
                color = this.color116_130; //Default is "orange";
                changeColor = true;
            }
            else if (pc > 100) {
                color = this.color101_115; //Default is "yellow";
                changeColor = true;
            }
        }
        let _style = "color: %s;".format(color);

        try {
            this.actor.style = _style;

            if (changeColor) {
                if (this._outputVolumeSection && this._outputVolumeSection.icon)
                    this._outputVolumeSection.icon.style = _style;
                    //~ this._outputVolumeSection.style = _style;
            } else {
                if (this._inputVolumeSection && this._inputVolumeSection.icon)
                    this._outputVolumeSection.icon.style = this._inputVolumeSection.icon.style
            }
        } catch(e) {logError("Problem changing color!!!: "+e)}
    }

    _inputValuesChanged(actor, iconName, percentage) {
        this.mute_in_switch.setIconSymbolicName(iconName);
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
            this._outputMutedId = 0;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputVolumeSection.connectWithStream(this._output);
            this._outputMutedId = this._output.connect("notify::is-muted", (...args) => this._mutedChanged(...args, "_output"));
            this._mutedChanged(null, null, "_output");
        } else {
            this.setIcon("audio-volume-muted-symbolic", "output");
        }
    }

    _readInput() {
        if (this._inputMutedId) {
            this._input.disconnect(this._inputMutedId);
            this._inputMutedId = 0;
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

        let bin = new St.Bin({ x_align: St.Align.END, style_class: "popup-inactive-menu-item" });
        let label = new St.Label({ text: device.origin });
        bin.add_actor(label);
        try {
            item.addActor(bin, { expand: true, span: -1, align: St.Align.END });
        } catch(e) {logError("Unable to add actor bin to item!: "+e)}

        let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
        selectItem.menu.addMenuItem(item);
        // show the menu if we have more than two devices
        if (selectItem.menu.numMenuItems > 1)
            selectItem.actor.show();

        this._devices.push({ id: id, type: type, item: item });
    }

    _onDeviceRemoved(control, id, type) {
        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type && this._devices[i].id === id) {
                let device = this._devices[i];
                if (device.item)
                    device.item.destroy();

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
        //~ logDebug("_onStreamAdded. control: "+control+" ; id: "+id);
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
            this._streams.push({ id: id, type: "SinkInput", item: item });
        } else if (stream instanceof Cvc.MixerSourceOutput) {
            // for source outputs, only show the input section
            this._streams.push({ id: id, type: "SourceOutput" });
            if (this._recordingAppsNum++ === 0) {
                this._inputSection.actor.show();
                this.mute_in_switch.actor.show();
                run_playerctld();
            }
        }
    }

    _onStreamRemoved(control, id) {
        //~ logDebug("_onStreamRemoved. control: "+control+" ; id: "+id);
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
                        this.mute_in_switch.actor.show();
                    }
                    //~ kill_playerctld();
                }
                if (this._seeker)
                    this._seeker.destroy();
                this._seeker = null;
                kill_playerctld();
                this._streams.splice(i, 1);
                break;
            }
        }
    }

    registerSystrayIcons() {
        for (let i = 0; i < players_with_seek_support.length; i++) {
            Main.systrayManager.registerTrayIconReplacement(players_with_seek_support[i], this.metadata.uuid);
        }
        for (let i = 0; i < players_without_seek_support.length; i++) {
            Main.systrayManager.registerTrayIconReplacement(players_without_seek_support[i], this.metadata.uuid);
        }
    }

    unregisterSystrayIcons() {
        Main.systrayManager.unregisterTrayIconReplacement(this.metadata.uuid);
    }

    _on_reload_this_applet_pressed() {
        kill_playerctld();
        // Reload this applet
        Extension.reloadExtension(UUID, Extension.Type.APPLET);
    }

    _onSetApmlificationPressed() {
        let command = "cinnamon-settings sound -t 4";
        Util.spawnCommandLine(command);
    }

    volume_near_icon() {
        if (this.showVolumeLevelNearIcon) {
            this._applet_label.set_text(""+this.volume);
            this.hide_applet_label(false);
        } else {
            this._applet_label.set_text("");
            this.hide_applet_label(true);
        }
    }

    _reset_colors() {
        this.color101_115 = "yellow";
        this.color116_130 = "orange";
        this.color131_150 = "red";
        this._on_sound_settings_change()
    }

    _set_shortcuts_as_default() {
        const schema = "org.cinnamon.desktop.keybindings.media-keys";
        const s = new Gio.Settings({ schema_id: schema });

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

    get _playerctl() {
        return GLib.find_program_in_path("playerctl");
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new Sound150Applet(metadata, orientation, panel_height, instanceId);
}
