import { EllipsizeMode } from './Pango'

export class Event {
    constructor() { }

    get_scroll_direction() {
        return 0
    }
}


interface Container {
    add_actor(actor: Actor): void
    remove_actor(actor: Actor): void
}

export interface ActorOptions {
    reactive?: boolean
    name?: string
}

export class Actor implements Container {

    #children: Actor[] = []
    #numberSignals = 0
    #visible: boolean = true
    #reactive: boolean
    #name: string

    // not existing in GJS only for mocking 
    #destroyed = false

    constructor(options: ActorOptions) {

        if (options) {
            Object.assign(this, options)
        }
    }

    get reactive() {
        this._check_destroyed()
        return this.#reactive
    }

    set reactive(reactive: boolean) {
        this._check_destroyed()
        this.#reactive = reactive
    }

    get visible() {
        this._check_destroyed()
        return this.#visible
    }

    set visible(visibility: boolean) {
        this._check_destroyed()
        this.#visible = visibility
    }

    get name() {
        this._check_destroyed()
        return this.#name
    }

    set name(name: string) {
        this._check_destroyed()
        this.#name = name
    }


    // not existing in GJS!
    _check_destroyed() {
        if (this.#destroyed) {
            throw new Error("Object .... has been already deallocated — impossible to set any property on it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.");
        }
    }

    add_actor(actor: Actor) {
        this._check_destroyed()
        this.#children.push(actor)
    }

    remove_actor(actor: Actor) {
        this._check_destroyed()
        if (!actor) throw new Error('Expected an object of type ClutterActor for argument but got type undefined')
        this.#children = this.#children.filter(act => act !== actor)
    }

    connect(signal: any, cb: any) {
        this._check_destroyed()
        return (this.#numberSignals++)
    }

    destroy() {
        this._check_destroyed()
        this.#destroyed = true
    }

    hide() {
        this._check_destroyed()
        this.visible = false
    }

    show() {
        this._check_destroyed()
        this.visible = true
    }

    get_children() {
        this._check_destroyed()
        return this.#children
    }

    get_child_at_index(index: number) {
        this._check_destroyed()
        return this.#children[index]
    }
}

export class Text extends Actor {

    #ellipsize: EllipsizeMode

    constructor() {
        super({})
    }

    get ellipsize() {
        this._check_destroyed()
        return this.#ellipsize
    }

    set ellipsize(ellipsize: EllipsizeMode) {
        this._check_destroyed()

        this.#ellipsize = ellipsize
    }
}