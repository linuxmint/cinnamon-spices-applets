const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;

function isShiftPressed(event) {
    const modifiers = Cinnamon.get_event_state(event);
    return (modifiers & Clutter.ModifierType.SHIFT_MASK) !== 0;
}

function resolveMiddleClickAction(applet, shiftPressed) {
    if (shiftPressed)
        return applet.middleShiftClickAction || "in_mute";
    return applet.middleClickAction || "mute";
}

function executeMiddleClickAction(applet, action) {
    switch (action) {
    case "mute":
        if (applet._input && applet._output &&
            applet._output.is_muted === applet._input.is_muted)
            applet.toggleInputMute();
        applet.toggleSoundMute();
        break;
    case "out_mute":
        applet.toggleSoundMute();
        break;
    case "in_mute":
        applet.toggleInputMute();
        break;
    case "player":
        applet.toggleActivePlayer();
        break;
    default:
        break;
    }
}

function onAppletMiddleClicked(applet, event) {
    executeMiddleClickAction(applet, resolveMiddleClickAction(applet, isShiftPressed(event)));
}

module.exports = {
    isShiftPressed,
    resolveMiddleClickAction,
    executeMiddleClickAction,
    onAppletMiddleClicked
};
