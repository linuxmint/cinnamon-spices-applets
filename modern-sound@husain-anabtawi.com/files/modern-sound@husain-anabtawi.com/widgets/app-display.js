const St = imports.gi.St;

function appStreamLabel(stream) {
    let name = stream.name || _("Application");
    if (name.length > 2)
        name = name.charAt(0).toUpperCase() + name.slice(1);
    return name;
}

function applyAppStreamIcon(icon, stream) {
    if (!icon || !stream)
        return;

    let iconName = stream.icon_name;
    const name = stream.name || "";

    if (name === "Banshee")
        iconName = "banshee";
    else if (name === "Spotify")
        iconName = "spotify";
    else if (name === "VBox") {
        iconName = "virtualbox";
    } else if (name === "Firefox")
        iconName = "firefox";
    else if (iconName === "audio")
        iconName = "audio-x-generic";

    icon.gicon = null;
    icon.icon_name = iconName || "application-x-executable";
    icon.icon_type = St.IconType.FULLCOLOR;
}

module.exports = { appStreamLabel, applyAppStreamIcon };
