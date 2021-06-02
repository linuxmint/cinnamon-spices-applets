"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCvcHandler = void 0;
const { MixerControl } = imports.gi.Cvc;
function createCvcHandler(args) {
    const { onVolumeChanged } = args;
    const control = new MixerControl({ name: __meta.name });
    let stream;
    control.open();
    control.connect('stream-added', (...args) => {
        const id = args[1];
        const addedStream = control.lookup_stream_id(id);
        if ((addedStream === null || addedStream === void 0 ? void 0 : addedStream.name) !== "mpv Media Player") {
            return;
        }
        stream = addedStream;
        stream.connect('notify::volume', () => {
            handleVolumeChanged();
        });
    });
    function handleVolumeChanged() {
        const normalizedVolume = normalizeCvcStreamVolume(stream.volume);
        onVolumeChanged(normalizedVolume);
    }
    function normalizeCvcStreamVolume(streamVolume) {
        return Math.round(streamVolume / control.get_vol_max_norm() * 100);
    }
    function normalizedVolumeToCvcStreamVolume(normalizedVolume) {
        return normalizedVolume / 100 * control.get_vol_max_norm();
    }
    function setVolume(newVolume) {
        const newStreamVolume = normalizedVolumeToCvcStreamVolume(newVolume);
        if (!stream)
            return;
        if (stream.volume === newStreamVolume)
            return;
        stream.is_muted && stream.change_is_muted(false);
        stream.volume = newStreamVolume;
        stream.push_volume();
    }
    return {
        setVolume
    };
}
exports.createCvcHandler = createCvcHandler;
