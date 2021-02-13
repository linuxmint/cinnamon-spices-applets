const Applet = imports.ui.applet;
const Main = imports.ui.main;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("unsplash");
        this.set_applet_tooltip(_("Click here to change background"));
    },

    on_applet_clicked: function() {
        const uuid = "Mint-Unsplash-Background@omidmaldar";
        const dir = imports.ui.appletManager.appletMeta[uuid].path;
        Main.Util.spawnCommandLine(dir + "/download.sh");
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
