"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeSlider = void 0;
const { PopupSliderMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
class VolumeSlider extends PopupSliderMenuItem {
    constructor(volume, onValueChanged) {
        super(volume / 100);
        this.volumeIcons = [
            { max: 0, iconSuffix: "muted" },
            { max: 33, iconSuffix: "low" },
            { max: 66, iconSuffix: "medium" },
            { max: 100, iconSuffix: "high" },
        ];
        this.onValueChanged = onValueChanged;
        this.tooltip = new Tooltip(this.actor, `Volume: ${this.value} %`);
        this.volumeIcon = new St.Icon({ icon_name: this.volumeIconName, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        this.removeActor(this._slider);
        this.addActor(this.volumeIcon, { span: 0 });
        this.addActor(this._slider, { span: -1, expand: true });
        this.connect('value-changed', () => this.handleValueChanged());
    }
    handleValueChanged() {
        this.onValueChanged(this.value);
        this.refreshSlider();
        this.tooltip.show();
    }
    get value() {
        return Math.round(super.value * 100);
    }
    setValue(newVolume) {
        super.setValue(newVolume / 100);
        this.refreshSlider();
    }
    refreshSlider() {
        this.volumeIcon.icon_name = this.volumeIconName;
        this.tooltip.set_text(`Volume: ${this.value} %`);
    }
    get volumeIconName() {
        const index = this.volumeIcons.findIndex((_a, index) => {
            var { max } = _a, rest = __rest(_a, ["max"]);
            return this.value <= max;
        });
        return `audio-volume-${this.volumeIcons[index].iconSuffix}`;
    }
    destroy() {
        super.destroy();
        this.tooltip.hide();
    }
}
exports.VolumeSlider = VolumeSlider;
