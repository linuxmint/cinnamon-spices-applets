"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppletTooltip = void 0;
const consts_1 = require("consts");
const { PanelItemTooltip } = imports.ui.tooltips;
function createAppletTooltip(args) {
    const { orientation, applet } = args;
    const tooltip = new PanelItemTooltip(applet, null, orientation);
    function setVolume(volume) {
        if (volume == null) {
            tooltip.set_text(consts_1.DEFAULT_TOOLTIP_TXT);
            return;
        }
        tooltip.set_text(`Volume: ${volume.toString()} %`);
    }
    return {
        setVolume
    };
}
exports.createAppletTooltip = createAppletTooltip;
