//!/usr/bin/cjs

const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Cvc = imports.gi.Cvc;
const Clutter = imports.gi.Clutter;

const { ControlButton } = require("./lib/controlButton");

const ENABLED_EXTENSIONS_KEY = "enabled-extensions";
const EXTENSION_UUID = "OSD150@claudiux";
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


class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, stream, tooltip, app_icon) {
        //~ logDebug("VolumeSlider constructor tooltip: "+tooltip);
        const startLevel = (tooltip == _("Microphone")) ? 1 * applet.mic_level.slice(0, -1) : 1 * applet.volume.slice(0, -1);
        super(startLevel);
        this.oldValue = startLevel;
        this.applet = applet;
        this.oldValue = startLevel;

        this.isMic = tooltip == _("Microphone"); //???

        Gtk.IconTheme.get_default().append_search_path("./icons");

        if (tooltip)
            this.tooltipText = tooltip + ": ";
        else
            this.tooltipText = "";

        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.connect("value-changed", () => this._onValueChanged());
        if (tooltip === _("Volume")) {
            this.connect("drag-end", () => this._onDragEnd());
        }

        this.app_icon = app_icon;
        if (this.app_icon == null) {
            this.iconName = this.isMic ? "microphone-sensitivity-muted" : "audio-volume-muted";
            this.icon = new St.Icon({
                icon_name: this.iconName,
                icon_type: St.IconType.SYMBOLIC,
                icon_size: Math.trunc(16 * global.ui_scale)
            });
        } else {
            this.icon = new St.Icon({
                icon_name: this.app_icon,
                icon_type: St.IconType.FULLCOLOR,
                icon_size: Math.trunc(16 * global.ui_scale)
            });
        }

        this.button = new ControlButton(
            (this.iconName) ? this.iconName : this.app_icon,
            _("Mute"),
            () => {
                let muted = false;
                if (this._value) this.oldValue = this._value;
                if (this.applet.actor.get_stage() != null) {
                    if (this.isMic) {
                        if (this.applet.mute_in_switch) {
                            this.applet.mute_in_switch.setToggleState(!this.applet.mute_in_switch.state);
                            if (this.applet.mute_in_switch.state) muted = true;
                        }
                    } else {
                        if (this.applet.mute_out_switch) {
                            this.applet.mute_out_switch.setToggleState(!this.applet.mute_out_switch.state);
                            if (this.applet.mute_out_switch.state) muted = true;
                        }
                    }
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

        if (this._slider)
            this.removeActor(this._slider);
        //this.addActor(this.icon, {span: 0});
        this.addActor(this.button.actor, {
            span: 0
        });
        this.addActor(this._slider, {
            span: -1,
            expand: true
        });

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

            let mutedId = this.stream.connect("notify::is-muted", () => this._update());
            let volumeId = this.stream.connect("notify::volume", () => this._update());
            this.connect("destroy", () => {
                //~ logDebug('VolumeSlider.connectWithStream.destroy');
                this.stream.disconnect(mutedId);
                this.stream.disconnect(volumeId);
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
            if (this.applet.magneticOn === true && volume != this.applet._volumeNorm && volume > this.applet._volumeNorm * (1 - this.applet.VOLUME_ADJUSTMENT_STEP / 2) && volume < this.applet._volumeNorm * (1 + this.applet.VOLUME_ADJUSTMENT_STEP / 2))
                volume = this.applet._volumeNorm;
            //Other 25% magnetized?
            if (this.applet.magneticOn === true && this.applet.magnetic25On === true) {
                for (let i = 0.25; i < 1.5; i += 0.25) {
                    if (i == 1) continue;
                    if (volume != i * this.applet._volumeNorm && volume > this.applet._volumeNorm * (i - this.applet.VOLUME_ADJUSTMENT_STEP / 2) && volume < this.applet._volumeNorm * (i + this.applet.VOLUME_ADJUSTMENT_STEP / 2))
                        volume = i * this.applet._volumeNorm;
                }
            }
        }
        this.stream.volume = volume;
        this.stream.push_volume();

        let icon = Gio.Icon.new_for_string(this._volumeToIcon(this._value));
        //~ let icon = new St.Icon({ icon_name: this._volumeToIcon(this._value), icon_type: St.IconType.SYMBOLIC, style_class: this.applet._applet_icon.style_class });
        //~ let icon = new St.Icon({ icon_name: this._volumeToIcon(this._value), icon_type: St.IconType.SYMBOLIC, style_class: 'media-keys-osd' });
        //~ icon.style = this.applet.actor.style;
        //~ let _bar_level = null;
        //~ let _volume_str = "";
        //~ if (this.applet.showBarLevel === true) {
        //~ _volume_str = ""+Math.round(volume/this.applet._volumeNorm * 100)+this.applet.PERCENT_CHAR;
        //~ _bar_level = Math.round(volume/this.applet._volumeNorm * 100);
        //~ }

        let _bar_level = null;
        let _volume_str = "";
        let rounded_volume = Math.round(volume / this.applet._volumeNorm * 100);
        if (this.applet.showVolumeValue === true)
            _volume_str = "" + rounded_volume + this.applet.PERCENT_CHAR;
        if (this.applet.showBarLevel === true)
            _bar_level = rounded_volume;
        let _maxLevel = (this.isMic) ? 1 : Math.round(this.applet._volumeMax / this.applet._volumeNorm * 100) / 100;

        if (this.applet.showOSD && (rounded_volume != Math.round(this.oldValue) || this.isMic)) {
            if (IS_OSD150_ENABLED())
                Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level, _maxLevel, this.OSDhorizontal);
            else
                Main.osdWindowManager.show(-1, icon, _volume_str, _bar_level);
        }

        if (this.stream.is_muted !== muted)
            this.stream.change_is_muted(muted);

        if (!this._dragging)
            this.applet._notifyVolumeChange(this.stream);
    }

    _onDragEnd() {
        if (this.stream) {
            this.applet._notifyVolumeChange(this.stream);
        }
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (this.applet.reverseScrolling) {
            if (direction == Clutter.ScrollDirection.DOWN)
                direction = Clutter.ScrollDirection.UP;
            else if (direction == Clutter.ScrollDirection.UP)
                direction = Clutter.ScrollDirection.DOWN;
        }

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - this.applet.VOLUME_ADJUSTMENT_STEP / this.applet._volumeMax * this.applet._volumeNorm);
        } else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + this.applet.VOLUME_ADJUSTMENT_STEP / this.applet._volumeMax * this.applet._volumeNorm);
        }

        if (this._slider)
            this._slider.queue_repaint();
        if (this.tooltip)
            this.tooltip.show();
        this.emit("value-changed", this._value);
    }

    _onKeyPressEvent(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right ||
            key == Clutter.KEY_Left ||
            key == Clutter.KEY_AudioRaiseVolume ||
            key == Clutter.KEY_AudioLowerVolume
        ) {
            let delta = (key == Clutter.KEY_Right || key == Clutter.KEY_AudioRaiseVolume) ? this.applet.VOLUME_ADJUSTMENT_STEP : -this.applet.VOLUME_ADJUSTMENT_STEP;

            if (delta < 0) {
                this._value = Math.max(0, this._value + delta / this.applet._volumeMax * this.applet._volumeNorm);
            } else {
                this._value = Math.min(1, this._value + delta / this.applet._volumeMax * this.applet._volumeNorm);
            }
            this._slider.queue_repaint();
            this.emit("value-changed", this._value);
            return true;
        }
        return false;
    }


    _update() {
        // value: percentage of volume_max (set as value in the widget)
        // visible_value: percentage of volume_norm (shown to the user)
        // these only differ for the output, and only when the user changes the maximum volume
        let volume = (!this.stream || this.stream.is_muted) ? 0 : this.stream.volume;
        let value, visible_value, delta = this.applet.VOLUME_ADJUSTMENT_STEP * this.applet._volumeMax / this.applet._volumeNorm;

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
                for (let i = 0.25; i < 1.5; i += 0.25) {
                    if (i == 1) continue;
                    if (visible_value != i * this.applet._volumeNorm &&
                        visible_value > this.applet._volumeNorm * (i - this.applet.VOLUME_ADJUSTMENT_STEP / 2) &&
                        visible_value < this.applet._volumeNorm * (i + this.applet.VOLUME_ADJUSTMENT_STEP / 2)
                    ) {
                        visible_value = i * this.applet._volumeNorm;
                        value = visible_value / this.applet._volumeMax;
                        this.applet._output.volume = i * this.applet._volumeNorm;
                        this.applet._output.push_volume();
                    }
                }

            }
        } else {
            visible_value = volume / this.applet._volumeNorm;
            value = visible_value
        }

        let percentage = Math.round(visible_value * 100) + "%";

        if (this.tooltip) {
            this.tooltip.set_text(this.tooltipText + percentage);
            if (this._dragging)
                this.tooltip.show();
        }
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
            value = 0;
        } else {
            let n2 = Math.floor(300 * value) / 100;
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
