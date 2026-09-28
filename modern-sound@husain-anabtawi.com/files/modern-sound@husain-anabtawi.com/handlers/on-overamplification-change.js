const Gio = imports.gi.Gio;

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const OVERAMPLIFICATION_KEY = "allow-amplified-volume";
const OVERAMPLIFICATION_FACTOR = 1.5;

function _syncMasterVolumeMax(applet) {
    const norm = applet._volumeNorm || 1;
    applet._masterVolumeMax = applet._allowOveramplification ? OVERAMPLIFICATION_FACTOR * norm : norm;
}

function onOveramplificationChange(applet) {
    applet._allowOveramplification = applet._soundSettings.get_boolean(OVERAMPLIFICATION_KEY);
    _syncMasterVolumeMax(applet);
    if (!applet._allowOveramplification && applet._output && applet._output.volume > applet._volumeNorm) {
        applet._output.volume = applet._volumeNorm;
        applet._output.push_volume();
    }

    if (applet._masterVolume)
        applet._masterVolume._sync();
    if (applet._output && applet._updatePanelIcon)
        applet._updatePanelIcon();
}

function connectOveramplificationHandler(applet) {
    applet._allowOveramplification = false;
    applet._soundSettings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
    applet._soundSettingsChangedId = applet._soundSettings.connect(
        "changed::" + OVERAMPLIFICATION_KEY,
        () => onOveramplificationChange(applet)
    );
    onOveramplificationChange(applet);
}

function disconnectOveramplificationHandler(applet) {
    if (!applet._soundSettings)
        return;

    if (applet._soundSettingsChangedId) {
        applet._soundSettings.disconnect(applet._soundSettingsChangedId);
        applet._soundSettingsChangedId = 0;
    }
    applet._soundSettings = null;
}

module.exports = {
    connectOveramplificationHandler,
    disconnectOveramplificationHandler,
    onOveramplificationChange
};
