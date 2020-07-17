const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Tweener = imports.ui.tweener;
const St = imports.gi.St;
const { AppletSettings } = imports.ui.settings; 
const SignalManager = imports.misc.signalManager;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;




class CleanShowDesktop extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new AppletSettings(this, "clean-show-desktop@filipetorresbr", instance_id);
        this.settings.bind("peek-at-desktop", "peek_at_desktop");
        this.settings.bind("peek-delay", "peek_delay");
        this.settings.bind("peek-opacity", "peek_opacity");
        this.settings.bind("peek-blur", "peek_blur");
        this.actor.track_hover = true;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.set_style_class_name("spacer-box");
        this.bin = new St.Bin();
        this.actor.add(this.bin);
        this.settings.bind("width", "width", this.size_changed);
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_pane_edit_mode_changed));
        this.orientation = orientation;
        this.size_changed();
        this.on_pane_edit_mode_changed();
        this._did_peek = true;
        this._peek_timeout_id = 0;

        let showDeskletsOption = new PopupMenu.PopupIconMenuItem(
            _('Show Desklets'),
            'cs-desklets',
            St.IconType.SYMBOLIC
        );
        showDeskletsOption.connect('activate', () => this.toggleShowDesklets());
        this._applet_context_menu.addMenuItem(showDeskletsOption);
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
    }

    show_all_windows(time) {
        let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];
            if(window.get_title() == "Desktop"){
                Tweener.addTween(compositor, { opacity: 255, time: time, transition: "easeOutSine" });
            }
            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }
        Tweener.addTween(global.window_group, { opacity: 255, time: time, transition: "easeOutSine" });
    }

    _on_enter(event) {
        if (this.peek_at_desktop) {

            if (this._peek_timeout_id > 0) {
                Mainloop.source_remove(this._peek_timeout_id);
                this._peek_timeout_id = 0;
            }

            this._peek_timeout_id = Mainloop.timeout_add(this.peek_delay, Lang.bind(this, function() {
                if (this.actor.hover &&
                    !this._applet_context_menu.isOpen &&
                    !global.settings.get_boolean("panel-edit-mode")) {

                    Tweener.addTween(global.window_group,
                                     {opacity: 255, time: 0.275, transition: "easeInSine"});

                    let windows = global.get_window_actors();
                    for (let i = 0; i < windows.length; i++) {
                        let compositor = windows[i];

                        if (this.peek_blur) {
                            if (!compositor.eff)
                                compositor.eff = new Clutter.BlurEffect();
                            compositor.add_effect_with_name('peek-blur', compositor.eff);
                        }
                    }
                    this._did_peek = true;
                }
                this._peek_timeout_id = 0;
                return false;
            }));
        }
    }

    _on_leave(event) {
        if (this._did_peek) {
            this.show_all_windows(0.2);
            this._did_peek = false;
        }
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
    }

    on_applet_clicked(event) {
        global.screen.toggle_desktop(global.get_current_time());
        this.show_all_windows(0);
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
        this._did_peek = false;
    }

    on_applet_middle_clicked(event) {
        Main.deskletContainer.toggle();
    }

    toggleShowDesklets() {
        if (!Main.deskletContainer.isModal) {
            Main.deskletContainer.raise();
        }
    }
    on_pane_edit_mode_changed(settings, key) {
        if (global.settings.get_boolean("panel-edit-mode")) {
            this.actor.add_style_class_name("edit-mode");
        } else {
            this.actor.add_style_class_name("edit-mode");
        }
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;
        this.size_changed();
    }

    size_changed() {
        let scaled_width = this.width * global.ui_scale;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.bin.natural_width = scaled_width;
            this.bin.natural_height_set = false;
        }
        else {
            this.bin.natural_height = scaled_width;
            this.bin.natural_width_set = false
        }
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CleanShowDesktop(orientation, panel_height, instance_id);
}



