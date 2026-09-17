const Gio = imports.gi.Gio;
const Main = imports.ui.main;

function volumeOsdIconName(volume, max, muted) {
    if (muted || volume < 1)
        return "audio-volume-muted-symbolic";
    const ratio = volume / max;
    if (ratio < 0.33)
        return "audio-volume-low-symbolic";
    if (ratio < 0.66)
        return "audio-volume-medium-symbolic";
    return "audio-volume-high-symbolic";
}

function volumeOsdLevel(volume, max, muted) {
    if (muted || volume < 1)
        return 0;
    return Math.round((volume / max) * 100);
}

function micOsdIconName(volume, max, muted) {
    if (muted || volume < 1)
        return "microphone-sensitivity-muted-symbolic";
    const ratio = volume / max;
    if (ratio < 0.33)
        return "microphone-sensitivity-low-symbolic";
    if (ratio < 0.66)
        return "microphone-sensitivity-medium-symbolic";
    return "microphone-sensitivity-high-symbolic";
}

function showVolumeOsd(applet) {
    if (!Main.osdWindowManager || !applet._output)
        return;

    const norm = applet._volumeNorm || 1;
    const max = applet._masterVolumeMax || norm;
    const output = applet._output;
    const volume = output.is_muted ? 0 : output.volume;
    const level = volumeOsdLevel(volume, max, output.is_muted);
    const icon = new Gio.ThemedIcon({
        name: volumeOsdIconName(volume, max, output.is_muted)
    });

    Main.osdWindowManager.show(-1, icon, null, level, false);
}

function showMicOsd(applet) {
    if (!Main.osdWindowManager || !applet._input)
        return;

    const norm = applet._volumeNorm || 1;
    const max = applet._input.volume_max || norm;
    const input = applet._input;
    const volume = input.is_muted ? 0 : input.volume;
    const level = volumeOsdLevel(volume, max, input.is_muted);
    const icon = new Gio.ThemedIcon({
        name: micOsdIconName(volume, max, input.is_muted)
    });

    Main.osdWindowManager.show(-1, icon, null, level, false);
}

module.exports = {
    volumeOsdIconName,
    volumeOsdLevel,
    micOsdIconName,
    showVolumeOsd,
    showMicOsd
};
