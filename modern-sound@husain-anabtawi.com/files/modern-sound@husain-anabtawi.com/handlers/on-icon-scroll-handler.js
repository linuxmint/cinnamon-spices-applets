const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;

const { adjustStreamVolume } = require("./utils/volume-math");

function adjustMasterVolume(applet, deltaSteps) {
    if (!adjustStreamVolume(applet._output, applet._volumeNorm, deltaSteps, applet._masterVolumeMax))
        return false;

    if (Main.soundManager)
        Main.soundManager.play("volume");
    if (applet._updatePanelIcon)
        applet._updatePanelIcon();
    return true;
}

function onIconScrollEvent(applet, _actor, event) {
    const direction = event.get_scroll_direction();

    if (direction === Clutter.ScrollDirection.SMOOTH)
        return Clutter.EVENT_PROPAGATE;

    if (direction === Clutter.ScrollDirection.UP)
        adjustMasterVolume(applet, 1);
    else if (direction === Clutter.ScrollDirection.DOWN)
        adjustMasterVolume(applet, -1);

    return Clutter.EVENT_STOP;
}

function connectIconScrollHandler(applet) {
    applet.actor.connect("scroll-event", (...args) => onIconScrollEvent(applet, ...args));
}

module.exports = {
    adjustMasterVolume,
    onIconScrollEvent,
    connectIconScrollHandler
};
