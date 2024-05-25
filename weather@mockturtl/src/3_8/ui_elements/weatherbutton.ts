import { Event } from "../lib/events";

const { Button } = imports.gi.St;

export class WeatherButton<T = never> {
	public actor: imports.gi.St.Button;
	private disabled = false;

	public ID: T | undefined;
	public url?: string;

	public Hovered: Event<WeatherButton<T>, imports.gi.Clutter.CrossingEvent> = new Event();
	public Clicked: Event<WeatherButton<T>, imports.gi.Clutter.CrossingEvent | null> = new Event();

	constructor(options: Partial<imports.gi.St.ButtonInitOptions>, doNotAddPadding: boolean = false) {
		this.actor = new Button(options);
		this.actor.add_style_class_name("popup-menu-item");

		if (doNotAddPadding)
			this.actor.set_style('padding: 0px; border-radius: 2px;');
		else
			this.actor.set_style('padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;');

		this.actor.connect("clicked", () => this.clicked());
		this.actor.connect("enter-event", (actor, event) => this.onHoverEnter(event));
		this.actor.connect("leave-event", () => this.onHoverLeave());
	}

	handleEnter(): void {
		if (!this.disabled) this.actor.add_style_pseudo_class('active');
		//global.set_cursor(imports.gi.Cinnamon.Cursor.POINTING_HAND);
	}

	handleLeave(): void {
		this.actor.remove_style_pseudo_class('active');
		//global.unset_cursor()
	}

	disable(): void {
		this.disabled = true;
		this.actor.reactive = false;
	}

	enable(): void {
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

	private onHoverEnter(event: imports.gi.Clutter.CrossingEvent) {
		this.handleEnter();
		this.Hovered.Invoke(this, event);
		return false;
	}

	private onHoverLeave = () => {
		this.handleLeave();
		return false;
	}
}