// UI Scaling applet by joka42 
// based on Resolution Switcher applet by dennis@nixdev.com
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

function ConfirmDialog() {
    this._init();
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_symbolic_name("video-display-symbolic");
            this.set_applet_tooltip(_("Scale User Interface with one click"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            //HiDPI 200% Scaling
            this.menu.addAction(_("Scale 200%"), function (event) {
                Main.Util.spawnCommandLine(`${__meta.path}/uiscaler 200`);
            });
            //HiDPI 175% Scale
            this.menu.addAction(_("Scale 175%"), function (event) {
                Main.Util.spawnCommandLine(`${__meta.path}/uiscaler 175`);
            });
            //HiDPI 150% Scale
            this.menu.addAction(_("Scale 150%"), function (event) {
                Main.Util.spawnCommandLine(`${__meta.path}/uiscaler 150`);
            });
            //HiDPI 125% Scale
            this.menu.addAction(_("Scale 125%"), function (event) {
                Main.Util.spawnCommandLine(`${__meta.path}/uiscaler 125`);
            });
            //Reset 100% 
            this.menu.addAction(_("Reset 100%"), function (event) {
                Main.Util.spawnCommandLine(`${__meta.path}/uiscaler 100`);
            });
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function (event) {
        this.menu.toggle();
    },

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
