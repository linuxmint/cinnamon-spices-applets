const { PopupSeparatorMenuItem } = imports.ui.popupMenu;

export class UISeparator {
	public actor: imports.ui.popupMenu.PopupSeparatorMenuItem;

	public get Actor(): imports.gi.Cinnamon.GenericContainer {
		return this.actor.actor;
	}

	constructor() {
		this.actor = new PopupSeparatorMenuItem();
		// removing styling to make them span full width
		this.actor.actor.remove_style_class_name("popup-menu-item");
	}

	public Show(): void {
		this.actor.actor.show();
	}

	public Hide(): void {
		this.actor.actor.hide();
	}
}