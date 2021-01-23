"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherButton = void 0;
const { Button } = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;
class WeatherButton {
    constructor(options) {
        this.signals = new SignalManager();
        this.disabled = false;
        this.actor = new Button(options);
        this.actor.add_style_class_name("popup-menu-item");
        this.actor.style = 'padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;';
        this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
        this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
        this.actor.connect("clicked", () => this.clicked());
    }
    handleEnter(actor) {
        if (!this.disabled)
            this.actor.add_style_pseudo_class('active');
    }
    handleLeave() {
        this.actor.remove_style_pseudo_class('active');
    }
    disable() {
        this.disabled = true;
        this.actor.reactive = false;
    }
    enable() {
        this.disabled = false;
        this.actor.reactive = true;
    }
    clicked() {
        if (!this.disabled)
            this.actor.add_style_pseudo_class('active');
    }
}
exports.WeatherButton = WeatherButton;
