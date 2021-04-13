import { ChannelMenuItem } from "ui/ChannelMenuItem"


class Menu {
    menuItems: ChannelMenuItem[] = []

    constructor() { }

    addMenuItem(item: ChannelMenuItem) {

        this.menuItems.push(item)
    }

}



export class PopupSubMenuMenuItem {

    menu: Menu

    constructor(title: string) {
        this.menu = new Menu()
    }
}