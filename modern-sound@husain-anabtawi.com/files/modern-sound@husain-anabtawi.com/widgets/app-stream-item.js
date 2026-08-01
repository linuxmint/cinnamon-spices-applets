const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Slider = imports.ui.slider;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const { appStreamLabel, applyAppStreamIcon } = require("./widgets/app-display");

const APP_SLIDER_WIDTH = 96;
const APP_SLIDER_HEIGHT = 18;

function ellipsizeLabel(label, maxWidthPx) {
    if (!label)
        return;

    if (label.clutter_text)
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

    if (maxWidthPx > 0)
        label.set_style(`max-width: ${maxWidthPx}px;`);
}

class AppStreamItem extends PopupMenu.PopupBaseMenuItem {
    constructor(applet, stream) {
        super({ activate: false, hover: false });
        this._applet = applet;
        this.actor.add_style_class_name("modern-sound-app-item");

        this._icon = new St.Icon({
            icon_type: St.IconType.FULLCOLOR,
            icon_name: "application-x-executable",
            icon_size: 16,
            style_class: "modern-sound-app-icon",
            reactive: true,
            track_hover: true
        });
        applyAppStreamIcon(this._icon, stream);

        this._icon.connect("button-press-event", (_actor, event) => {
            if (this._stream && event.get_button() === 1) {
                this._stream.change_is_muted(!this._stream.is_muted);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._nameLabel = new St.Label({
            text: appStreamLabel(stream),
            style_class: "modern-sound-app-name",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeLabel(this._nameLabel, 88);

        this._slider = new Slider.Slider(0);
        this._slider.actor.add_style_class_name("modern-sound-app-slider");
        this._slider.actor.width = APP_SLIDER_WIDTH;
        this._slider.actor.height = APP_SLIDER_HEIGHT;

        this._percentLabel = new St.Label({
            text: "0%",
            style_class: "modern-sound-app-percent",
            y_align: Clutter.ActorAlign.CENTER
        });

        this.addActor(this._icon, { span: 0 });
        this.addActor(this._nameLabel, { span: 0 });
        this.addActor(this._slider.actor, { span: 1, expand: true });
        this.addActor(this._percentLabel, { span: 0 });

        this._updating = false;
        this._slider.connect("value-changed", (_slider, value) => {
            if (!this._updating)
                this._onChanged(value);
        });

        this.connectStream(stream);
    }

    connectStream(stream) {
        if (this._stream) {
            this._stream.disconnect(this._volumeId);
            this._stream.disconnect(this._mutedId);
        }

        this._stream = stream;
        if (!stream)
            return;

        this._volumeId = stream.connect("notify::volume", () => this._sync());
        this._mutedId = stream.connect("notify::is-muted", () => this._sync());
        this._sync();
    }

    _setSliderValue(value) {
        this._updating = true;
        this._slider.setValue(value);
        this._updating = false;
    }

    _sync() {
        if (!this._stream)
            return;

        const norm = this._applet._volumeNorm || 1;
        const max = this._stream.volume_max || norm;
        const volume = this._stream.is_muted ? 0 : this._stream.volume;
        const value = volume / max;
        const percent = Math.round((volume / norm) * 100) || 0;

        this._setSliderValue(Math.min(1, value));
        this._percentLabel.text = `${percent}%`;
    }

    _onChanged(value) {
        if (!this._stream)
            return;

        const max = this._stream.volume_max || this._applet._volumeNorm || 1;
        const norm = this._applet._volumeNorm || 1;
        const volume = value * max;
        const muted = value < 0.005;
        const percent = Math.round((volume / norm) * 100) || 0;

        this._stream.volume = volume;
        this._stream.push_volume();
        if (this._stream.is_muted !== muted)
            this._stream.change_is_muted(muted);

        this._percentLabel.text = `${percent}%`;

        if (Main.soundManager)
            Main.soundManager.play("volume");
    }
}

module.exports = { AppStreamItem, APP_SLIDER_WIDTH };
