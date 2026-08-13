const St = imports.gi.St;

const DEVICE_FALLBACK_ICON = "audio-speakers-symbolic";
const INPUT_DEVICE_FALLBACK_ICON = "audio-input-microphone-symbolic";

function applyDeviceIcon(icon, device, fallbackIcon) {
    const fallback = fallbackIcon || DEVICE_FALLBACK_ICON;
    if (!icon)
        return;

    if (!device) {
        icon.gicon = null;
        icon.icon_name = fallback;
        icon.icon_type = St.IconType.SYMBOLIC;
        return;
    }

    const gicon = device.get_gicon ? device.get_gicon() : null;
    if (gicon) {
        icon.gicon = gicon;
        icon.icon_type = St.IconType.FULLCOLOR;
        return;
    }

    const name = device.get_icon_name ? device.get_icon_name() : null;
    if (name) {
        icon.gicon = null;
        icon.icon_name = name;
        icon.icon_type = name.endsWith("-symbolic") ?
            St.IconType.SYMBOLIC :
            St.IconType.FULLCOLOR;
        return;
    }

    icon.gicon = null;
    icon.icon_name = fallback;
    icon.icon_type = St.IconType.SYMBOLIC;
}

function deviceDisplayIcon(device, fallbackIcon) {
    if (device && device.get_icon_name) {
        const name = device.get_icon_name();
        if (name)
            return name;
    }
    return fallbackIcon || DEVICE_FALLBACK_ICON;
}

module.exports = {
    applyDeviceIcon,
    deviceDisplayIcon,
    DEVICE_FALLBACK_ICON,
    INPUT_DEVICE_FALLBACK_ICON
};
