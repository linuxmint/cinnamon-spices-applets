const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Main = imports.ui.main;

var Tooltip = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_Tooltip',
}, class Tooltip extends GObject.Object {
    _init(parentWidget) {
        super._init();

        this._parentWidget = parentWidget;
        this._attachMap = new Map();
        this._tooltipActor = new St.Widget({reactive: false, visible: true});
        this._tooltipLabel = new St.Label({
            visible: false,
            reactive: false,
        });
        this._tooltipLabel.set_name('Tooltip');
        this._tooltipLabel.add_style_class_name('bbm-tooltip');
        this._tooltipActor.add_child(this._tooltipLabel);

        this._widget = null;
        this._timeoutShowId = null;
        this._addedToUiGroup = false;

        this._parentWidget.connectObject(
            'notify::mapped', () => {
                if (!this._parentWidget.mapped) {
                    this._hide(true);
                    if (this._addedToUiGroup) {
                        Main.uiGroup.remove_child(this._tooltipActor);
                        this._addedToUiGroup = false;
                    }
                }
            },
            this
        );
    }

    attach(widget, text) {
        if (!widget || !text)
            return;

        if (this._attachMap.has(widget)) {
            const handlerId = this._attachMap.get(widget);
            widget.disconnect(handlerId);
            this._attachMap.delete(widget);
        }

        const handlerId = widget.connect('notify::hover', () => {
            if (widget.hover)
                this._scheduleShow(widget, text);
            else
                this._hide();
        });

        this._attachMap.set(widget, handlerId);
    }

    detach(widget) {
        if (!widget)
            return;

        const handlerId = this._attachMap.get(widget);
        if (handlerId) {
            widget.disconnect(handlerId);
            this._attachMap.delete(widget);
        }
    }

    _scheduleShow(widget, text) {
        if (this._timeoutShowId)
            GLib.source_remove(this._timeoutShowId);

        this._timeoutShowId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
            if (!this._addedToUiGroup && this._parentWidget.visible) {
                Main.uiGroup.add_child(this._tooltipActor);
                this._addedToUiGroup = true;
            }
            this._show(widget, text);
            this._timeoutShowId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _show(widget, text) {
        if (!this._parentWidget.visible)
            return;

        this._tooltipLabel.set_text(text);
        this._widget = widget;

        if (!this._widget)
            return;

        const [x, y] = this._widget.get_transformed_position();
        const [w, h] = this._widget.get_transformed_size();
        const tw = this._tooltipLabel.width;
        const th = this._tooltipLabel.height;

        if (x === null || y === null || w === null || h === null)
            return;

        this._tooltipActor.set_position(
            Math.round(x + w / 2 - tw / 2),
            Math.round(y - th + 55)
        );

        this._tooltipLabel.opacity = 0;
        this._tooltipLabel.show();
        this._tooltipLabel.remove_all_transitions();
        this._tooltipLabel.ease({
            opacity: 200,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        if (this._timeoutHideId)
            GLib.source_remove(this._timeoutHideId);

        this._timeoutHideId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._hide();

            this._timeoutHideId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _hide(immediate = false) {
        if (this._timeoutShowId)
            GLib.source_remove(this._timeoutShowId);
        this._timeoutShowId = null;


        if (this._timeoutHideId)
            GLib.source_remove(this._timeoutHideId);
        this._timeoutHideId = null;


        if (!this._tooltipLabel.visible)
            return;

        this._tooltipLabel.remove_all_transitions();

        if (immediate) {
            this._tooltipLabel.hide();
            this._tooltipLabel.opacity = 0;
            return;
        }

        this._tooltipLabel.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._tooltipLabel.hide(),
        });

        this._widget = null;
    }

    destroy() {
        if (this._timeoutShowId)
            GLib.source_remove(this._timeoutShowId);
        this._timeoutShowId = null;

        if (this._timeoutHideId)
            GLib.source_remove(this._timeoutHideId);
        this._timeoutHideId = null;

        if (this._addedToUiGroup) {
            Main.uiGroup.remove_child(this._tooltipActor);
            this._addedToUiGroup = false;
        }

        for (const [widget, handlerId] of this._attachMap)
            widget.disconnect(handlerId);

        this._attachMap.clear();

        this._tooltipActor?.destroy();
        this._tooltipActor = null;
        this._tooltipLabel = null;
    }
});

