const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const { appStreamLabel, applyAppStreamIcon } = require("./widgets/app-display");
const { StreamVolumeItem } = require("./widgets/stream-volume-item");

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

class AppStreamItem extends StreamVolumeItem {
    constructor(applet, stream) {
        super(applet, { buildContext: stream, stream });
    }

    _actorStyleClasses() {
        return ["modern-sound-app-item"];
    }

    _createIcon() {
        const icon = new St.Icon({
            icon_type: St.IconType.FULLCOLOR,
            icon_name: "application-x-executable",
            icon_size: 16,
            style_class: "modern-sound-app-icon",
            reactive: true,
            track_hover: true
        });
        if (this._buildContext)
            applyAppStreamIcon(icon, this._buildContext);
        return icon;
    }

    _sliderStyleClass() {
        return "modern-sound-app-slider";
    }

    _sliderSize() {
        return [APP_SLIDER_WIDTH, APP_SLIDER_HEIGHT];
    }

    _percentStyleClass() {
        return "modern-sound-app-percent";
    }

    _addVolumeActors() {
        this._nameLabel = new St.Label({
            text: appStreamLabel(this._buildContext),
            style_class: "modern-sound-app-name",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeLabel(this._nameLabel, 88);

        this.removeActor(this._slider);
        this.addActor(this._icon, { span: 0 });
        this.addActor(this._nameLabel, { span: 0 });
        this.addActor(this._slider, { span: 1, expand: true });
        this.addActor(this._percentLabel, { span: 0 });
    }
}

module.exports = { AppStreamItem, APP_SLIDER_WIDTH };
