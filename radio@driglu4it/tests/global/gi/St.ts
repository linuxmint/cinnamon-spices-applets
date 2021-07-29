import { Event, Actor, Text, ActorOptions } from './Clutter'
import { Role } from './Atk'

export enum Side {
    TOP,
    RIGHT,
    BOTTOM,
    LEFT
}

export enum IconType {
    SYMBOLIC,
    FULLCOLOR
}

export enum Align {
    START,
    MIDDLE,
    END
}

export interface WidgetOptions extends ActorOptions {
    accessible_name?: string,
    accessible_role?: Role,
    can_focus?: boolean,
    hover?: boolean,
    style_class?: string,
    track_hover?: boolean
}

export class Widget extends Actor {

    #track_hover: boolean
    #can_focus: boolean
    #accessible_role: Role
    #style_class: string
    #style: string

    constructor(options?: WidgetOptions) {

        super({})

        if (options) {
            Object.assign(this, options)
        }
    }

    get accessible_role() {
        this._check_destroyed()
        return this.#accessible_role
    }

    set accessible_role(accessible_role: Role) {
        this._check_destroyed()
        this.#accessible_role = accessible_role
    }

    get can_focus() {
        this._check_destroyed()
        return this.#can_focus
    }

    set can_focus(can_focus: boolean) {
        this._check_destroyed()
        this.#can_focus = can_focus
    }

    get track_hover() {
        this._check_destroyed()
        return this.#track_hover
    }

    set track_hover(track_hover: boolean) {
        this._check_destroyed()
        this.#track_hover = track_hover
    }

    set style(style: string) {
        this._check_destroyed()
        this.#style = style
    }

    set_style(style: string) {
        this.style = style
    }

    get style() {
        this._check_destroyed()
        return this.#style
    }

    get_style() {
        return this.style
    }

    get style_class() {
        this._check_destroyed()
        return this.#style_class
    }

    set style_class(style_class: string) {
        this._check_destroyed()
        this.#style_class = style_class
    }


}

export class BoxLayout extends Widget {


    constructor(options?: any) {
        super()

        if (options) {
            Object.assign(this, options)
        }
    }

    add(element: Actor) {
        this.add_actor(element)
    }

}


interface BinOptions extends WidgetOptions {
    child: Actor
}

export class Bin extends Widget {
    #child: Actor

    constructor(options?: BinOptions) {
        super()

        if (options) {
            Object.assign(this, options)
        }
    }

    get child() {
        this._check_destroyed()
        return this.#child
    }

    set child(child: Actor) {
        this._check_destroyed()
        this.#child = child
    }

}

export class Icon extends Widget {

    #icon_type: IconType
    #icon_name: string
    #icon_size: number


    constructor(options?: any) {

        super()

        if (options) {
            Object.assign(this, options)
        }
    }

    set icon_name(icon_name: string) {
        this._check_destroyed()
        this.#icon_name = icon_name
    }

    get icon_name() {
        this._check_destroyed()
        return this.#icon_name
    }

    set icon_type(icon_type: IconType) {
        this._check_destroyed()
        this.#icon_type = icon_type
    }

    get icon_type() {
        this._check_destroyed()
        return this.#icon_type
    }

    set icon_size(iconSize: number) {
        this._check_destroyed()
        this.#icon_size = iconSize
    }

    get icon_size() {
        this._check_destroyed()
        return this.#icon_size
    }


}

interface LabelOptions extends WidgetOptions {
    text?: string
}

export class Label extends Widget {

    #text: string
    #clutter_text: Text

    constructor(options?: LabelOptions) {

        super()

        this.#clutter_text = new Text()

        if (options) {
            Object.assign(this, options)
        }

    }

    set text(text: string) {
        this._check_destroyed()
        this.#text = text
    }

    get text() {
        this._check_destroyed()
        return this.#text
    }

    get clutter_text() {
        this._check_destroyed()
        return this.#clutter_text
    }

    set_text(text: string) {
        this.text = text
    }

    get_text() {
        return this.text
    }
}
