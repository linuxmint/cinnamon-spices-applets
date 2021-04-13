export class Button {

    #onClick: Function

    constructor(options: imports.gi.St.ButtonOptions) {

    }

    connect(eventType: string, cb: Function) {
        if (eventType === "clicked") this.#onClick = cb
    }

    click() {
        this.#onClick()
    }


}