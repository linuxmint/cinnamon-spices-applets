"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherButton = void 0;
const events_1 = require("lib/events");
const { Button } = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;
class WeatherButton {
    constructor(options, doNotAddPadding = false) {
        this.signals = new SignalManager();
        this.disabled = false;
        this.Hovered = new events_1.Event();
        this.Clicked = new events_1.Event();
        this.actor = new Button(options);
        this.actor.add_style_class_name("popup-menu-item");
        if (doNotAddPadding)
            this.actor.set_style('padding: 0px; border-radius: 2px;');
        else
            this.actor.set_style('padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;');
        this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
        this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
        this.actor.connect("clicked", () => this.clicked());
        this.actor.connect("enter-event", (ev) => this.hovered(ev));
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
        if (!this.disabled) {
            this.actor.add_style_pseudo_class('active');
            this.Clicked.Invoke(this, null);
        }
    }
    hovered(event) {
        this.Hovered.Invoke(this, event);
    }
}
exports.WeatherButton = WeatherButton;
