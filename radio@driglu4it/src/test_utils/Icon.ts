export class Icon {

    public icon_name: string

    constructor(options: imports.gi.St.IconOptions) {
        const { icon_name } = options
        this.icon_name = icon_name
    }
}