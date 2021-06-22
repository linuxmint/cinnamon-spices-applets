"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSeeker = void 0;
const consts_1 = require("consts");
const ActivWidget_1 = require("lib/ActivWidget");
const Slider_1 = require("lib/Slider");
const { BoxLayout, Label } = imports.gi.St;
function createSeeker(args) {
    const { onPositionChanged } = args;
    const container = new BoxLayout({
        style_class: consts_1.POPUP_MENU_ITEM_CLASS
    });
    ActivWidget_1.createActivWidget({
        widget: container
    });
    let length = 100;
    let position;
    const positionLabel = new Label();
    const lengthLabel = new Label();
    const slider = Slider_1.createSlider({
        initialValue: 0.5,
        onValueChanged: handleValueChanged
    });
    [positionLabel, slider.actor, lengthLabel].forEach(widget => {
        container.add_child(widget);
    });
    function setLength(value) {
        length = value;
        lengthLabel.set_text(secondsToFormatedMin(value));
        refreshSliderValue();
    }
    function setPosition(value) {
        position = value;
        positionLabel.set_text(secondsToFormatedMin(position));
        refreshSliderValue();
    }
    function refreshSliderValue() {
        const sliderValue = length === 0 ? 0 : Math.min(position / length, 1);
        slider.setValue(sliderValue, true);
    }
    function handleValueChanged(value) {
        const newPosition = value * length;
        onPositionChanged(newPosition);
    }
    function secondsToFormatedMin(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds - minutes * 60;
        return [minutes, remainingSeconds].map(value => {
            const valueString = value.toString().padStart(2, '0');
            return valueString;
        }).join(":");
    }
    return {
        actor: container,
        setLength,
        setPosition
    };
}
exports.createSeeker = createSeeker;
