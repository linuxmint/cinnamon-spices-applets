const VOLUME_ADJUSTMENT_STEP = 0.05;
const MUTE_THRESHOLD = 0.005;

function volumePercent(volume, norm, muted = false) {
    if (muted)
        return 0;
    const targetNorm = norm || 1;
    return Math.round((volume / targetNorm) * 100) || 0;
}

function snapVolumeToNorm(volume, norm, stepFraction) {
    const targetNorm = norm || 1;
    const step = stepFraction ?? VOLUME_ADJUSTMENT_STEP;
    if (
        volume !== targetNorm &&
        volume > targetNorm * (1 - step / 2) &&
        volume < targetNorm * (1 + step / 2)
    )
        return targetNorm;
    return volume;
}

function adjustStreamVolume(stream, norm, deltaSteps, maxVolume, stepPercent) {
    if (!stream || !deltaSteps)
        return false;

    const targetNorm = norm || 1;
    const max = maxVolume ?? stream.volume_max ?? targetNorm;
    const stepFraction = stepPercent != null ? stepPercent / 100 : VOLUME_ADJUSTMENT_STEP;
    const step = targetNorm * stepFraction;
    const currentVolume = stream.volume;

    if (deltaSteps < 0) {
        const prevMuted = stream.is_muted;
        stream.volume = Math.max(0, currentVolume + deltaSteps * step);
        if (stream.volume < 1) {
            stream.volume = 0;
            if (!prevMuted)
                stream.change_is_muted(true);
        } else {
            stream.volume = snapVolumeToNorm(stream.volume, targetNorm, stepFraction);
        }
    } else {
        stream.volume = Math.min(max, currentVolume + deltaSteps * step);
        stream.volume = snapVolumeToNorm(stream.volume, targetNorm, stepFraction);
        stream.change_is_muted(false);
    }

    stream.push_volume();
    return true;
}

function scrollStepPercent(scrollStep) {
    return scrollStep ?? 5;
}

function scrollStepFraction(scrollStep) {
    return scrollStepPercent(scrollStep) / 100;
}

function sliderScrollStepRatio(norm, max, scrollStep) {
    const targetNorm = norm || 1;
    const targetMax = max || targetNorm;
    return scrollStepFraction(scrollStep) * targetNorm / targetMax;
}

function invertScrollDelta(deltaSteps, invert) {
    return invert ? -deltaSteps : deltaSteps;
}

module.exports = {
    VOLUME_ADJUSTMENT_STEP,
    MUTE_THRESHOLD,
    volumePercent,
    snapVolumeToNorm,
    adjustStreamVolume,
    scrollStepPercent,
    scrollStepFraction,
    sliderScrollStepRatio,
    invertScrollDelta
};
