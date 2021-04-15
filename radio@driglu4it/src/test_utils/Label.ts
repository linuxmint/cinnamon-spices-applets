
interface LabelOptions {
    name: string
}

export class Label {

    public text: string

    constructor() {
    }

    set_text(newText: string) {
        this.text = newText
    }
}