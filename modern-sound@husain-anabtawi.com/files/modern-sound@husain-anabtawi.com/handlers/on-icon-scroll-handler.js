const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;

const { adjustStreamVolume } = require("./utils/volume-math");
const { showVolumeOsd, showMicOsd } = require("./utils/volume-osd");
const { isShiftPressed } = require("./handlers/on-icon-middle-click-handler");
const { scrollStepPercent, invertScrollDelta } = require("./utils/volume-math");

function _scrollDelta(applet, direction) {
    let delta = 0;
    if (direction === Clutter.ScrollDirection.UP)
        delta = 1;
    else if (direction === Clutter.ScrollDirection.DOWN)
        delta = -1;
    return invertScrollDelta(delta, applet.invertScrollDirection === true);
}

function adjustMasterVolume(applet, deltaSteps) {
    const stepPercent = scrollStepPercent(applet.scrollStep);
    if (!adjustStreamVolume(
        applet._output,
        applet._volumeNorm,
        deltaSteps,
        applet._masterVolumeMax,
        stepPercent
    ))
        return false;

    if (applet.showVolumeOsdOnScroll !== false)
        showVolumeOsd(applet);
    if (applet.playVolumeChangeSound !== false && Main.soundManager)
        Main.soundManager.play("volume");
    if (applet._updatePanelIcon)
        applet._updatePanelIcon();
    return true;
}

function adjustMicVolume(applet, deltaSteps) {
    const norm = applet._volumeNorm;
    const max = applet._input ? (applet._input.volume_max || norm) : norm;
    const stepPercent = scrollStepPercent(applet.scrollStep);
    if (!adjustStreamVolume(applet._input, norm, deltaSteps, max, stepPercent))
        return false;

    if (applet.showVolumeOsdOnScroll !== false)
        showMicOsd(applet);
    if (applet._micVolume)
        applet._micVolume._sync();
    if (applet._syncMuteStates)
        applet._syncMuteStates();
    return true;
}

function onIconScrollEvent(applet, _actor, event) {
    const direction = event.get_scroll_direction();

    if (direction === Clutter.ScrollDirection.SMOOTH)
        return Clutter.EVENT_PROPAGATE;

    const adjustVolume = isShiftPressed(event) ? adjustMicVolume : adjustMasterVolume;
    const delta = _scrollDelta(applet, direction);
    if (delta)
        adjustVolume(applet, delta);

    return Clutter.EVENT_STOP;
}

function connectIconScrollHandler(applet) {
    applet.actor.connect("scroll-event", (...args) => onIconScrollEvent(applet, ...args));
}

module.exports = {
    adjustMasterVolume,
    adjustMicVolume,
    onIconScrollEvent,
    connectIconScrollHandler,
    _scrollDelta
};
