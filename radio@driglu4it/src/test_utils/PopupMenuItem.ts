export class PopupMenuItem {

    #onClick: Function

    constructor(title: string) { }

    connect(eventType: string, cb: Function) {
        if (eventType === "activate") this.#onClick = cb
    }

    click() {
        this.#onClick()
    }

}