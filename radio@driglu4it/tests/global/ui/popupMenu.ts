import { Label, BoxLayout, Align } from '../gi/St'
import { GenericContainer } from '../gi/Cinnamon'
import { Actor } from '../gi/Clutter'
import { parse } from '../misc/params'
import { Role } from '../gi/Atk'
import { SignalManager } from '../misc/signalManager'

export class PopupBaseMenuItem {

    private _children: ParsedActorParams[]
    public actor: GenericContainer
    private _signals: SignalManager
    private _activatable: boolean


    constructor(params?: imports.ui.popupMenu.PopupBaseMenuItemParams) {

        params = parse(params, {
            reactive: true,
            activate: true,
            hover: true,
            sensitive: true,
            style_class: null,
            focusOnHover: true
        }) as Required<imports.ui.popupMenu.PopupBaseMenuItemParams>

        this._signals = new SignalManager()

        this.actor = new GenericContainer({
            style_class: 'popup-menu-item',
            track_hover: params.reactive,
            can_focus: params.reactive,
            accessible_role: Role.menu_item

        })

        this._children = []

        this._activatable = params.reactive && params.activate;

        if (this._activatable) {
        }

        if (params.reactive && params.hover) {
            this._signals.connect(this.actor, 'notify::hover', this._onHoverChanged)
        }

    }


    private _onHoverChanged() {

    }

    public connect(eventName: string, cb: () => void) {
    }




    addActor(actor: Actor, params?: Partial<imports.ui.popupMenu.AddActorParams>) {

        const parsedParams = parse(params, { span: 1, expand: false, align: Align.START }) as ParsedActorParams;


        parsedParams.actor = actor
        this._children.push(parsedParams)
        // TODO connect to signal
        this.actor.add_actor(actor)
    }

    destroy() {
        this.actor.destroy()
    }

    removeActor(actor: Actor) {
        this.actor.remove_actor(actor)

        this._children = this._children.filter(param => {
            return param.actor !== actor
        })
    }
}

export class PopupMenuBase {

    public box: BoxLayout
    #menuItems: PopupBaseMenuItem[] // doesn't exist in real file. But in that in way it is much easier to get the menuItems


    constructor() {
        this.box = new BoxLayout()

        this.#menuItems = []
    }

    removeAll() {

        while (this.#menuItems.length) {
            const menuItem = this.#menuItems.pop()
            menuItem.destroy()
        }
    }

    addMenuItem(menuItem: PopupBaseMenuItem, position?: number) {
        if (!position) {
            this.box.add(menuItem.actor)
            this.#menuItems.push(menuItem)
        }

        if (position) throw new Error("not yet implemented in testing");

    }

    _getMenuItems(): PopupBaseMenuItem[] {
        return this.#menuItems
    }

}

export class PopupSubMenu extends PopupMenuBase {
    constructor() {
        super()
    }




}

interface ParsedActorParams extends imports.ui.popupMenu.AddActorParams {
    actor: Actor,
}

export class PopupMenuItem extends PopupBaseMenuItem {

    public label: Label

    constructor(text: string, params?: imports.ui.popupMenu.PopupBaseMenuItemParams) {
        super(params)
        this.label = new Label({ text })
    }
}

export class PopupSubMenuMenuItem extends PopupBaseMenuItem {

    public label: Label
    public menu: PopupSubMenu


    constructor(text: string) {
        super()

        this.menu = new PopupSubMenu()

        this.label = new Label({ text })

    }
}