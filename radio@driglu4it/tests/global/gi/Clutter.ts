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

    _checkIfActor(actor: Actor) {
        if (!(actor instanceof Actor)) {
            throw new TypeError('argument must be of type Actor')
        }
    }


    add_actor(actor: Actor) {
        this.add_child(actor)
        this.#children.push(actor)
    }

    add_child(child: Actor) {

        this._checkIfActor(child)

        this._check_destroyed()
        this.#children.push(child)
    }


    insert_child_at_index(child: Actor, index: number) {
        this._checkIfActor(child)
        this._check_destroyed()

        this.#children.splice(index, 0, child)

    }

    remove_actor(actor: Actor) {
        this._check_destroyed()
        this._checkIfActor(actor)

        this.#children = this.#children.filter(act => act !== actor)
    }

    remove_child(actor: Actor) {
        this.remove_actor(actor)
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

    remove_all_children() {
        this._check_destroyed()
        this.#children = []
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