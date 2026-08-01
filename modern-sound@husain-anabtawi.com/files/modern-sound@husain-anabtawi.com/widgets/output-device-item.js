const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const { applyDeviceIcon, DEVICE_FALLBACK_ICON } = require("./widgets/device-display");

// Max width for the collapsed device header labels only (not the expanded list).
const HEADER_LABEL_MAX = 210;

function ellipsizeHeaderLabel(label) {
    if (!label)
        return;

    if (label.clutter_text)
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

    label.set_style(`max-width: ${HEADER_LABEL_MAX}px;`);
}

class OutputDeviceItem extends PopupMenu.PopupBaseMenuItem {
    constructor(applet) {
        super({ activate: false, hover: false });
        this._applet = applet;
        this._expanded = false;
        this._devices = [];
        this.actor.add_style_class_name("modern-sound-output-item");

        this._deviceIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: DEVICE_FALLBACK_ICON,
            icon_size: 18,
            style_class: "modern-sound-output-header-icon"
        });

        this._nameLabel = new St.Label({
            text: _("No output device"),
            style_class: "modern-sound-output-name",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeHeaderLabel(this._nameLabel);

        this._subtitleLabel = new St.Label({
            text: "",
            style_class: "modern-sound-output-subtitle",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeHeaderLabel(this._subtitleLabel);

        this._labels = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-output-labels",
            x_expand: true
        });
        this._labels.add_actor(this._nameLabel);
        this._labels.add_actor(this._subtitleLabel);

        this._chevron = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "pan-down-symbolic",
            icon_size: 14,
            style_class: "modern-sound-output-chevron",
            y_align: Clutter.ActorAlign.CENTER
        });

        this._header = new St.BoxLayout({
            style_class: "modern-sound-output-header",
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._header.add_actor(this._deviceIcon);
        this._header.add(this._labels, { expand: true, x_fill: true, y_fill: false });
        this._header.add_actor(this._chevron);

        this._header.connect("button-release-event", (_actor, event) => {
            if (event.get_button() !== 1 || this._devices.length <= 1)
                return Clutter.EVENT_PROPAGATE;
            this._toggleExpanded();
            return Clutter.EVENT_STOP;
        });

        this._listBox = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-output-list",
            visible: false
        });

        this._outer = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-output-wrap",
            x_expand: true
        });
        this._outer.add_actor(this._header);
        this._outer.add_actor(this._listBox);

        this.addActor(this._outer, { span: -1, expand: true });
    }

    bindControl(control) {
        if (this._control) {
            this._control.disconnect(this._outputAddedId);
            this._control.disconnect(this._outputRemovedId);
            this._control.disconnect(this._activeOutputId);
        }

        this._control = control;
        if (!control)
            return;

        this._outputAddedId = control.connect("output-added", (_c, id) => {
            this._addDevice(id);
        });
        this._outputRemovedId = control.connect("output-removed", (_c, id) => {
            this._removeDevice(id);
        });
        this._activeOutputId = control.connect("active-output-update", () => {
            this._syncActiveDevice();
        });
    }

    _toggleExpanded() {
        this._expanded = !this._expanded;
        this._listBox.visible = this._expanded;
        this._chevron.icon_name = this._expanded ?
            "pan-up-symbolic" :
            "pan-down-symbolic";
        this.actor.change_style_pseudo_class("open", this._expanded);
    }

    _addDevice(id) {
        if (!this._control || this._devices.some((entry) => entry.id === id))
            return;

        const device = this._control.lookup_output_id(id);
        if (!device)
            return;

        const row = this._createDeviceRow(device);
        this._devices.push({ id, device, row });
        this._listBox.add_actor(row);

        this._updateExpandableState();
        this._syncActiveDevice();
    }

    _removeDevice(id) {
        const index = this._devices.findIndex((entry) => entry.id === id);
        if (index === -1)
            return;

        const [entry] = this._devices.splice(index, 1);
        this._listBox.remove_actor(entry.row);
        entry.row.destroy();

        this._updateExpandableState();
        this._syncActiveDevice();
    }

    _createDeviceRow(device) {
        const radio = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "radio-off-symbolic",
            icon_size: 14,
            style_class: "modern-sound-output-radio"
        });

        const icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: DEVICE_FALLBACK_ICON,
            icon_size: 16,
            style_class: "modern-sound-output-row-icon"
        });
        applyDeviceIcon(icon, device);

        const name = new St.Label({
            text: device.description || _("Unknown device"),
            style_class: "modern-sound-output-row-name"
        });

        const subtitle = new St.Label({
            text: device.origin || "",
            style_class: "modern-sound-output-row-subtitle"
        });

        const labels = new St.BoxLayout({ vertical: true, x_expand: true });
        labels.add_actor(name);
        if (device.origin)
            labels.add_actor(subtitle);

        const check = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "emblem-ok-symbolic",
            icon_size: 14,
            style_class: "modern-sound-output-check",
            opacity: 0
        });

        const row = new St.BoxLayout({
            style_class: "modern-sound-output-row",
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        row.add_actor(radio);
        row.add_actor(icon);
        row.add(labels, { expand: true, x_fill: true, y_fill: false });
        row.add_actor(check);

        row._device = device;
        row._radio = radio;
        row._check = check;

        row.connect("button-press-event", (_actor, event) => {
            if (event.get_button() !== 1 || !this._control)
                return Clutter.EVENT_PROPAGATE;
            this._control.change_output(device);
            return Clutter.EVENT_STOP;
        });

        return row;
    }

    _updateExpandableState() {
        const hasMultiple = this._devices.length > 1;
        this._chevron.visible = hasMultiple;
        this._header.reactive = hasMultiple;
        this._header.track_hover = hasMultiple;

        if (!hasMultiple && this._expanded) {
            this._expanded = false;
            this._listBox.visible = false;
            this._chevron.icon_name = "pan-down-symbolic";
            this.actor.change_style_pseudo_class("open", false);
        }
    }

    _syncActiveDevice() {
        const active = this._applet._output;
        const activeId = active ? active.index : null;

        if (active) {
            this._nameLabel.text = active.description || _("Unknown device");
            this._subtitleLabel.text = _("Output device");
            this._subtitleLabel.visible = true;
            applyDeviceIcon(this._deviceIcon, active);
        } else {
            this._nameLabel.text = _("No output device");
            this._subtitleLabel.text = "";
            this._subtitleLabel.visible = false;
            applyDeviceIcon(this._deviceIcon, null);
        }

        for (const entry of this._devices) {
            const isActive = activeId !== null && entry.id === activeId;
            entry.row._radio.icon_name = isActive ?
                "radio-checked-symbolic" :
                "radio-off-symbolic";
            entry.row._check.opacity = isActive ? 255 : 0;
            entry.row.change_style_pseudo_class("active", isActive);
        }
    }
}

module.exports = { OutputDeviceItem };
