function volumeIconName(ratio, muted) {
    if (muted || ratio < 0.005)
        return "xsi-audio-volume-muted";
    if (ratio < 0.33)
        return "xsi-audio-volume-low";
    if (ratio < 0.66)
        return "xsi-audio-volume-medium";
    return "xsi-audio-volume-high";
}

function micIconName(ratio, muted) {
    if (muted || ratio < 0.005)
        return "xsi-microphone-sensitivity-muted";
    if (ratio < 0.33)
        return "xsi-microphone-sensitivity-low";
    if (ratio < 0.66)
        return "xsi-microphone-sensitivity-medium";
    return "xsi-microphone-sensitivity-high";
}

module.exports = { volumeIconName, micIconName };
