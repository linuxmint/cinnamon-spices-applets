"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlayPauseButton = void 0;
const ControlBtn_1 = require("ui/ControlBtn");
function createPlayPauseButton(args) {
    const { onClick } = args;
    const playPauseBtn = ControlBtn_1.createControlBtn({
        iconName: getPlayPauseIconName("Playing"),
        tooltipTxt: getPlayPauseTooltipTxt("Playing"),
        onClick
    });
    function getPlayPauseTooltipTxt(playPause) {
        return (playPause === "Paused") ? "Play" : "Pause";
    }
    function getPlayPauseIconName(playPause) {
        return `media-playback-${playPause === "Playing" ? "pause" : "start"}`;
    }
    function setPlayPause(playPause) {
        playPauseBtn.tooltipTxt = getPlayPauseTooltipTxt(playPause);
        playPauseBtn.iconName = getPlayPauseIconName(playPause);
    }
    Object.defineProperties(playPauseBtn, {
        playPause: {
            set(playPause) {
                setPlayPause(playPause);
            }
        }
    });
    return playPauseBtn;
}
exports.createPlayPauseButton = createPlayPauseButton;
