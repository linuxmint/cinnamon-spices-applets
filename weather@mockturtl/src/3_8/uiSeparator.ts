const { PopupSeparatorMenuItem } = imports.ui.popupMenu;

export class UISeparator {
    public actor: imports.ui.popupMenu.PopupSeparatorMenuItem;

    public get Actor() {
        return this.actor.actor;
    }

    constructor() {
        this.actor = new PopupSeparatorMenuItem();
        // removing styling to make them span full width
        this.actor.actor.remove_style_class_name("popup-menu-item");
    }

    public Show() {
        this.actor.actor.show();
    }

    public Hide() {
        this.actor.actor.hide();
    }
}