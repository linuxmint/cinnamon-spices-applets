let MprisControllerClass = null;

function _loadControllerClass() {
    if (MprisControllerClass)
        return MprisControllerClass;

    try {
        MprisControllerClass = imports.ui.gestures.mprisController.MprisController;
    } catch (e) {
        global.logError(`[modern-sound] MPRIS unavailable: ${e}`);
    }

    return MprisControllerClass;
}

function createMprisController() {
    const Controller = _loadControllerClass();
    if (!Controller)
        return null;
    return new Controller();
}

function toggleActivePlayer(controller) {
    if (!controller)
        return false;

    const player = controller.get_player();
    if (!player)
        return false;

    player.toggle_play();
    return true;
}

function shutdownMprisController(controller) {
    if (controller && controller.shutdown)
        controller.shutdown();
}

module.exports = {
    createMprisController,
    toggleActivePlayer,
    shutdownMprisController
};
