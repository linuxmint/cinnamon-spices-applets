const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;
const {Slider} = imports.ui.slider;

var SliderBin = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_SliderBin',
}, class SliderBin extends St.BoxLayout {
    _init(gIcon, dataHandler, id) {
        super._init({
            style_class: 'bbm-box',
            vertical: true,
            x_expand: true,
        });

        this._pendingValue = 0;
        this._lastSentValue = 0;
        this._hasSentDuringDrag = false;
        this._timeoutId = 0;
        this._isDragging = false;

        const config = dataHandler.getConfig();

        const sliderLabel = new St.Label({
            text: config[`box${id}SliderTitle`] || '',
            x_expand: true,
            style_class: 'bbm-subtitle-label',
            x_align: Clutter.ActorAlign.CENTER,
        });

        if (!sliderLabel.text)
            global.log(`BudsLink-Companion: Missing title for box${id}`);

        this.add_child(sliderLabel);

        const minusLabel = new St.Label({
            text: '-',
            style: 'padding: 4px',
            x_align: Clutter.ActorAlign.START,
        });

        const plusLabel = new St.Label({
            text: '+',
            style: 'padding: 4px',
            x_align: Clutter.ActorAlign.END,
        });

        const slider = new Slider(0);

        const sliderBin = new St.Bin({
            child: slider.actor,
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'slider-bin',
        });

        const hbox = new St.BoxLayout({style_class: 'quick-slider'});
        hbox.add_child(minusLabel);
        hbox.add_child(sliderBin);
        hbox.add_child(plusLabel);

        this.add_child(hbox);

        slider.setValue(
            (dataHandler.props[`box${id}SliderValue`] || 0) / 100
        );

        slider.connectObject(
            'value-changed', (s, value) => {
                if (!this._isDragging)
                    return;

                const v = Math.round(value * 100);
                this._pendingValue = v;

                if (!this._hasSentDuringDrag) {
                    dataHandler.emitUIAction(`box${id}SliderValue`, v);
                    this._lastSentValue = v;
                    this._hasSentDuringDrag = true;

                    this._startThrottle(dataHandler, id);
                }
            },
            'drag-begin', () => {
                this._isDragging = true;
                this._hasSentDuringDrag = false;
                dataHandler.emitUIAction(`box${id}SliderIsDragging`, 1);
            },
            'drag-end', () => {
                this._isDragging = false;
                dataHandler.emitUIAction(`box${id}SliderIsDragging`, 0);

                if (this._timeoutId) {
                    GLib.source_remove(this._timeoutId);
                    this._timeoutId = 0;
                }

                if (this._lastSentValue !== this._pendingValue) {
                    dataHandler.emitUIAction(`box${id}SliderValue`, this._pendingValue);

                    this._lastSentValue = this._pendingValue;
                }
            },
            this
        );

        dataHandler.connectObject('properties-changed', () => {
            slider.setValue((dataHandler.props[`box${id}SliderValue`] || 0) / 100);
        }, this);

        this.connect('destroy', () => {
            if (this._timeoutId) {
                GLib.source_remove(this._timeoutId);
                this._timeoutId = 0;
            }
        });
    }

    _startThrottle(dataHandler, id) {
        if (this._timeoutId)
            return;

        this._timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            () => {
                if (!this._isDragging) {
                    this._timeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }

                if (this._pendingValue !== this._lastSentValue) {
                    dataHandler.emitUIAction(
                        `box${id}SliderValue`,
                        this._pendingValue
                    );
                    this._lastSentValue = this._pendingValue;
                }

                return GLib.SOURCE_CONTINUE;
            }
        );
    }
});
