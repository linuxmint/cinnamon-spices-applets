const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Cvc = imports.gi.Cvc;
const Pango = imports.gi.Pango;

const { AppStreamItem } = require("./widgets/app-stream-item");

class ApplicationsItem extends PopupMenu.PopupMenuSection {
    constructor(applet) {
        super();
        this._applet = applet;
        this._streams = [];
        this.actor.add_style_class_name("modern-sound-applications-section");

        this._headerItem = new PopupMenu.PopupBaseMenuItem({
            activate: false,
            hover: false
        });
        this._headerItem.actor.add_style_class_name("modern-sound-applications-header");

        this._headerLabel = new St.Label({
            text: _("Applications"),
            style_class: "popup-inactive-menu-item modern-sound-applications-title"
        });
        if (this._headerLabel.clutter_text)
            this._headerLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._headerItem.addActor(this._headerLabel, { span: -1, expand: true });
        this.addMenuItem(this._headerItem);

        this.actor.visible = false;
    }

    bindControl(control) {
        if (this._control) {
            this._control.disconnect(this._streamAddedId);
            this._control.disconnect(this._streamRemovedId);
        }

        this._control = control;
        if (!control)
            return;

        this._streamAddedId = control.connect("stream-added", (_c, id) => {
            this._addStream(id);
        });
        this._streamRemovedId = control.connect("stream-removed", (_c, id) => {
            this._removeStream(id);
        });
    }

    _shouldIncludeStream(stream) {
        if (!stream || stream.is_virtual)
            return false;
        if (stream.application_id === "org.freedesktop.libcanberra")
            return false;
        if (stream.name === "Muffin")
            return false;
        return stream instanceof Cvc.MixerSinkInput;
    }

    _addStream(id) {
        if (!this._control || this._streams.some((entry) => entry.id === id))
            return;

        const stream = this._control.lookup_stream_id(id);
        if (!this._shouldIncludeStream(stream))
            return;

        const item = new AppStreamItem(this._applet, stream);
        this._streams.push({ id, item });
        this.addMenuItem(item);
        this._updateVisibility();
    }

    _removeStream(id) {
        const index = this._streams.findIndex((entry) => entry.id === id);
        if (index === -1)
            return;

        const [entry] = this._streams.splice(index, 1);
        entry.item.destroy();
        this._updateVisibility();
    }

    _updateVisibility() {
        const visible = this._streams.length > 0;
        this.actor.visible = visible;
    }
}

module.exports = { ApplicationsItem };
