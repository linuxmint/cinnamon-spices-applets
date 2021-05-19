import { BoxLayout, Side, Icon, IconType, Label } from '../gi/St'

export enum AllowedLayout {
    VERTICAL = 'vertical',
    HORIZONTAL = 'horizontal',
    BOTH = 'both'
}

export class Applet {

    private _orientation: imports.gi.St.Side;
    private _panelHeight: number;
    public instance_id: number;
    private _allowedLayout: AllowedLayout
    public actor: BoxLayout
    private _applet_tooltip_text: string

    constructor(orientation: imports.gi.St.Side, panel_height: number, instance_id: number) {
        this._orientation = orientation;
        this._panelHeight = panel_height
        this.instance_id = instance_id
        this.actor = new BoxLayout()
    }

    on_applet_clicked(event: imports.gi.Clutter.Event) { }

    on_applet_removed_from_panel() { }

    set_applet_tooltip(tooltip: string) {
        this._applet_tooltip_text = tooltip
    }

    setAllowedLayout(layout: AllowedLayout) {
        this._allowedLayout = layout
    }

}

export class IconApplet extends Applet {

    private _applet_icon: Icon

    constructor(...args) {
        // @ts-ignore
        super(...args)
    }

    set_applet_icon_name(icon_name: string) {
        this.ensureIcon()

        this._applet_icon.icon_type = IconType.FULLCOLOR
        this._applet_icon.icon_name = icon_name
    }

    set_applet_icon_symbolic_name(icon_name: string) {
        this.ensureIcon()

        this._applet_icon.icon_type = IconType.SYMBOLIC
        this._applet_icon.icon_name = icon_name
    }


    private ensureIcon() {
        if (!this._applet_icon) {
            this._applet_icon = new Icon()
        }
    }
}


export class TextIconApplet extends IconApplet {

    private _applet_label: Label


    constructor(...args) {
        // @ts-ignore
        super(...args)

        this._applet_label = new Label()

    }


    set_applet_label(text: string) {
        this._applet_label.text = text
    }


}