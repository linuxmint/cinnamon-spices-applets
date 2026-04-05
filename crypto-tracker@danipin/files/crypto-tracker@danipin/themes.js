const Gtk = imports.gi.Gtk;

var _applet;

function init(applet) {
    _applet = applet;
    registerIconPath();
}

function registerIconPath() {
    try {
        let iconTheme = Gtk.IconTheme.get_default();
        let iconAppletPath = _applet.metadata.path + "/icons";
        let searchPath = iconTheme.get_search_path();
        if (!searchPath.includes(iconAppletPath)) {
            iconTheme.append_search_path(iconAppletPath);
        }
    } catch (e) { global.logError("IconPath Registration Error: " + e); }
}

var Themes = {
    init: init,
    registerIconPath: registerIconPath
};