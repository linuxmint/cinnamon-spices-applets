const VOLUME_ADJUSTMENT_STEP = 0.05;
const MUTE_THRESHOLD = 0.005;

function adjustStreamVolume(stream, norm, deltaSteps) {
    if (!stream || !deltaSteps)
        return false;

    const targetNorm = norm || 1;
    const max = stream.volume_max || targetNorm;
    const step = targetNorm * VOLUME_ADJUSTMENT_STEP;
    const currentVolume = stream.volume;

    if (deltaSteps < 0) {
        const prevMuted = stream.is_muted;
        stream.volume = Math.max(0, currentVolume + deltaSteps * step);
        if (stream.volume < 1) {
            stream.volume = 0;
            if (!prevMuted)
                stream.change_is_muted(true);
        } else if (
            stream.volume !== targetNorm &&
            stream.volume > targetNorm * (1 - VOLUME_ADJUSTMENT_STEP / 2) &&
            stream.volume < targetNorm * (1 + VOLUME_ADJUSTMENT_STEP / 2)
        ) {
            stream.volume = targetNorm;
        }
    } else {
        stream.volume = Math.min(max, currentVolume + deltaSteps * step);
        if (
            stream.volume !== targetNorm &&
            stream.volume > targetNorm * (1 - VOLUME_ADJUSTMENT_STEP / 2) &&
            stream.volume < targetNorm * (1 + VOLUME_ADJUSTMENT_STEP / 2)
        ) {
            stream.volume = targetNorm;
        }
        stream.change_is_muted(false);
    }

    stream.push_volume();
    return true;
}

module.exports = {
    VOLUME_ADJUSTMENT_STEP,
    MUTE_THRESHOLD,
    adjustStreamVolume
};
