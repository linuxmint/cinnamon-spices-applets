const Lang = imports.lang;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

class CinnamonSlideshowApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this._slideshowSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background.slideshow" });
        this._backgroundSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });

        if (this._slideshowSettings.get_boolean("slideshow-enabled")) {
            this.set_applet_icon_symbolic_name('slideshow-next');
            this.set_applet_tooltip(_("Click to change image"));
        } else {
            this.set_applet_icon_symbolic_name('slideshow-disabled');
            this.set_applet_tooltip(_("The slideshow is disabled"));
        }

        // this._applet_context_menu.connect('open-state-changed', () => this._update_background_name());
    }

    on_applet_clicked(event) {
        this.get_next_image();
    }


    get_next_image() {
        Main.slideshowManager.getNextImage();
    }


    // _update_background_name() {
    //     const file = decodeURIComponent(this._backgroundSettings.get_string("picture-uri") || "");
    //     const background = file.split("/").pop();
    //     this._current_background_menu.label.set_text(_("Current background: ") + background);
    // }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonSlideshowApplet(metadata, orientation, panel_height, instanceId);
}