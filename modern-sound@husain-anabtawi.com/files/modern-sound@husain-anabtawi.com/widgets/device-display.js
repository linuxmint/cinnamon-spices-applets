const St = imports.gi.St;

const DEVICE_FALLBACK_ICON = "audio-speakers-symbolic";

function applyDeviceIcon(icon, device) {
    if (!icon)
        return;

    if (!device) {
        icon.gicon = null;
        icon.icon_name = DEVICE_FALLBACK_ICON;
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
    icon.icon_name = DEVICE_FALLBACK_ICON;
    icon.icon_type = St.IconType.SYMBOLIC;
}

function deviceDisplayIcon(device) {
    if (device && device.get_icon_name) {
        const name = device.get_icon_name();
        if (name)
            return name;
    }
    return DEVICE_FALLBACK_ICON;
}

module.exports = { applyDeviceIcon, deviceDisplayIcon, DEVICE_FALLBACK_ICON };
