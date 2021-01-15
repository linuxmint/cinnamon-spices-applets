
const { Button } = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;

class WeatherButton {
    public actor: imports.gi.St.Button;
    private signals = new SignalManager();
    private disabled = false;
    constructor(options: any) {
        this.actor = new Button(options);
        this.actor.add_style_class_name("popup-menu-item");

        this.actor.style = 'padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;';

        this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
        this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
    }

    handleEnter(actor?: WeatherButton) {
        if (!this.disabled) this.actor.add_style_pseudo_class('active');
        //global.set_cursor(imports.gi.Cinnamon.Cursor.POINTING_HAND);
    }

    handleLeave() {
        this.actor.remove_style_pseudo_class('active');
        //global.unset_cursor()
    }

    disable() {
        this.disabled = true;
        this.actor.reactive = false;
    }

    enable() {
        this.disabled = false;
        this.actor.reactive = true;
    }
}