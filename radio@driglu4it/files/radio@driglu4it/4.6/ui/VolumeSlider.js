"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVolumeSlider = void 0;
const ActivWidget_1 = require("lib/ActivWidget");
const Slider_1 = require("lib/Slider");
const consts_1 = require("consts");
const { BoxLayout, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
const { KEY_Right, KEY_Left, ScrollDirection } = imports.gi.Clutter;
function createVolumeSlider(args) {
    const { onVolumeChanged } = args;
    let tooltip;
    const container = new BoxLayout({
        style_class: consts_1.POPUP_MENU_ITEM_CLASS,
    });
    ActivWidget_1.createActivWidget({
        widget: container
    });
    let volume;
    const slider = Slider_1.createSlider({
        onValueChanged: handleSliderValueChanged
    });
    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        style_class: consts_1.POPUP_ICON_CLASS,
        reactive: true
    });
    [icon, slider.actor].forEach(widget => {
        container.add_child(widget);
    });
    container.connect('key-press-event', (actor, event) => {
        const key = event.get_key_symbol();
        if (key === KEY_Right || key === KEY_Left) {
            const direction = (key === KEY_Right) ? 'increase' : 'decrease';
            deltaChange(direction);
        }
    });
    container.connect('scroll-event', (actor, event) => {
        const scrollDirection = event.get_scroll_direction();
        const direction = (scrollDirection === ScrollDirection.UP) ? 'increase' : 'decrease';
        deltaChange(direction);
    });
    icon.connect('button-press-event', () => {
        slider.setValue(0);
    });
    function handleSliderValueChanged(newValue) {
        updateVolume(newValue * 100, true);
    }
    function deltaChange(direction) {
        const delta = (direction === 'increase') ? consts_1.VOLUME_DELTA : -consts_1.VOLUME_DELTA;
        const newValue = slider.getValue() + delta / 100;
        slider.setValue(newValue);
    }
    function updateVolume(newVolume, showTooltip) {
        const newVolumeRounded = Math.round(newVolume);
        if (newVolumeRounded === volume)
            return;
        volume = newVolumeRounded;
        slider.setValue(volume / 100);
        icon.set_icon_name(consts_1.getVolumeIcon({ volume }));
        setTooltip(volume);
        showTooltip && tooltip.show();
        onVolumeChanged === null || onVolumeChanged === void 0 ? void 0 : onVolumeChanged(volume);
    }
    function setTooltip(volume) {
        if (!tooltip)
            tooltip = new Tooltip(slider.actor, ' ');
        tooltip.set_text(`Volume: ${volume.toString()} %`);
    }
    function setVolume(newVolume) {
        updateVolume(newVolume, false);
    }
    return {
        actor: container,
        setVolume
    };
}
exports.createVolumeSlider = createVolumeSlider;
