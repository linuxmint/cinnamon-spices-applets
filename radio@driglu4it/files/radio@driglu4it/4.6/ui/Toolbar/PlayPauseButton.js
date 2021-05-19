"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlayPauseButton = void 0;
const consts_1 = require("consts");
const ControlBtn_1 = require("ui/Toolbar/ControlBtn");
function createPlayPauseButton(args) {
    const { onClick } = args;
    const controlBtn = ControlBtn_1.createControlBtn({
        iconName: consts_1.PLAY_ICON_NAME,
        tooltipTxt: 'Play',
        onClick
    });
    function setPlaybackStatus(playPause) {
        let tooltipTxt;
        let iconName;
        if (playPause === 'Playing') {
            tooltipTxt = 'Pause';
            iconName = consts_1.PAUSE_ICON_NAME;
        }
        if (playPause === 'Paused') {
            tooltipTxt = 'Play';
            iconName = consts_1.PLAY_ICON_NAME;
        }
        controlBtn.tooltip.set_text(tooltipTxt);
        controlBtn.icon.icon_name = iconName;
    }
    return {
        actor: controlBtn.actor,
        setPlaybackStatus
    };
}
exports.createPlayPauseButton = createPlayPauseButton;
