const Applet = imports.ui.applet;
const Main = imports.ui.main;
const St = imports.gi.St;
const { AppletSettings } = imports.ui.settings; 
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const SignalManager = imports.misc.signalManager;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const UUID = "clean-show-desktop@filipetorresbr";
const AppletPath = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}

class CleanShowDesktop extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.settings = new AppletSettings(this, "clean-show-desktop@filipetorresbr", instance_id);
        this.settings.bind("peek-at-desktop", "peek_at_desktop");
        this.settings.bind("peek-blur", "peek_blur");
        this.settings.bind("peek-delay", "peek_delay");
        this.settings.bind("peek-opacity", "peek_opacity");
        this.settings.bind("width", "width");
        this.settings.bind("background", "background");
        this.settings.bind("border", "border");
        this.settings.bind("on-hover-background", "hoverbackground");
        this.settings.bind("on-hover-border", "hoverborder");
        this.settings.bind("border-width", "borderwidth");
        this.settings.bind("margin", "margin");
        this.settings.bind("custom-color", "custom_color");
        this.actor.track_hover = true;
        this.signals = new SignalManager.SignalManager(null);
        this.actor.connect('enter-event', Lang.bind(this, this._on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this._on_leave));
        this.signals.connect(global.stage, 'notify::key-focus', this._on_leave, this);
        this._did_peek = true;
        this._peek_timeout_id = 0;

		GLib.spawn_command_line_sync("bash -c " + AppletPath + "/themecolor.sh");
	   	let [ok, out, err, exit] = GLib.spawn_command_line_sync("cat " + AppletPath + "/themecolor.txt");
		this.color = out; 
        this.fillcolor("leave");
        
        global.log(AppletPath);
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

    fillcolor(state){
	  	if (this.custom_color == true) {
	  		if (state == "hover") {
        		const STYLE = "padding: " + this.width + "px;background: " + this.hoverbackground + ";border-color: " + this.hoverborder +  ";border-left: " + this.borderwidth + "px;" + "margin-left: " + this.margin + "px";
        		this.actor.set_style(STYLE);

	  		}else{
        	   	const STYLE = "padding: " + this.width + "px;background: " + this.background + ";border-color: " + this.border +  ";border-left: " + this.borderwidth + "px;" + "margin-left: " + this.margin + "px";
	        	this.actor.set_style(STYLE);		
	  		}	
    	}else{
	  		if (state == "hover") {
        		const STYLE = "padding: " + this.width + "px;background: " + this.color + ", 1);border-color: " + this.color +  ", 1);border-left: " + this.borderwidth + "px;" + "margin-left: " + this.margin + "px";
        		this.actor.set_style(STYLE);

	  		}else{
        	   	const STYLE = "padding: " + this.width + "px;background: " + this.color + ", 0.5);border-color: " + this.color +  ", 1);border-left: " + this.borderwidth + "px;" + "margin-left: " + this.margin + "px";
	        	this.actor.set_style(STYLE);
	  		}	
    	}
    }
    show_all_windows(time) {
         let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];
            if(window.get_title() == "Desktop"){
                Tweener.addTween(compositor, {opacity: 255, time: time, transition: "easeOutSine"});
            }
            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }

        Tweener.addTween(global.window_group, {opacity: 255, time: time, transition: "easeOutSine"});
    }

    _on_enter(event) {
        this._appletEnterEventId = this.actor.connect('enter-event', () => {
            if (this.hover_delay_ms > 0) {
                this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms, () => {
                	this.fillcolor("hover");
                });
            }else{
                this.fillcolor("hover");
            }
        });
        if (this.peek_at_desktop) {
            if (this._peek_timeout_id > 0) {
                Mainloop.source_remove(this._peek_timeout_id);
                this._peek_timeout_id = 0;
            }
            this._peek_timeout_id = Mainloop.timeout_add(this.peek_delay, Lang.bind(this, function() {
                if (this.actor.hover &&
                    !this._applet_context_menu.isOpen && !global.settings.get_boolean("panel-edit-mode")) {
                        Tweener.addTween(global.window_group, {opacity: this.peek_opacity, time: 0.275, transition: "easeInSine"});
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
        this._appletLeaveEventId = this.actor.connect('leave-event', () => { 
            this.fillcolor("leave");
        });

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

    handleDragOver(source, actor, x, y, time){
      global.screen.show_desktop(global.get_current_time());
    }

    on_applet_middle_clicked(event) {
        Main.deskletContainer.toggle();
    }

    toggleShowDesklets() {
        if (!Main.deskletContainer.isModal) {
            Main.deskletContainer.raise();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CleanShowDesktop(orientation, panel_height, instance_id);
}

