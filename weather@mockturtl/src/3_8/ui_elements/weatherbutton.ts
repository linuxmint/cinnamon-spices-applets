import { Event } from "../lib/events";

const { Button } = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;

export class WeatherButton {
	public actor: imports.gi.St.Button;
	private signals = new SignalManager();
	private disabled = false;

	public ID: any;
	public url?: string;

	public Hovered: Event<WeatherButton, imports.gi.Clutter.Event> = new Event();
	public Clicked: Event<WeatherButton, imports.gi.Clutter.Event | null> = new Event();

	constructor(options: Partial<imports.gi.St.ButtonOptions>, doNotAddPadding: boolean = false) {
		this.actor = new Button(options);
		this.actor.add_style_class_name("popup-menu-item");

		if (doNotAddPadding)
			this.actor.set_style('padding: 0px; border-radius: 2px;');
		else
			this.actor.set_style('padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;');

		this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
		this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
		this.actor.connect("clicked", () => this.clicked());
		this.actor.connect("enter-event", (actor, event) => this.hovered(event));
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

	private clicked() {
		// when clicked the button loses active styling, so we readd
		if (!this.disabled) {
			this.actor.add_style_pseudo_class('active');
			this.Clicked.Invoke(this, null);
		}
	}

	private hovered(event: imports.gi.Clutter.Event) {
		this.Hovered.Invoke(this, event);
	}
}