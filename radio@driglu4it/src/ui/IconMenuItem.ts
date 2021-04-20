const { Label, Icon, IconType } = imports.gi.St
const { PopupBaseMenuItem } = imports.ui.popupMenu

export class IconMenuItem extends PopupBaseMenuItem {

    public label: imports.gi.St.Label
    private icon: imports.gi.St.Icon

    /**
     * a Menu Item with a left aligned Icon (optional) and a Label. 
     * 
     * The Icons and Labels can be easily changed dynamically or removed (currently
     * only the icon can be removed but it is easily possible to extend for the label as well)
     * 
     * TODO: hide the parent properties somehow (without violating the Liskow Substitution Principle ...). classes Implementing the iconMenuItem shouldn't see "label" in the intelsense ... 
     * 
     * @param text the text shown on the menu item
     * @param params the parameter from the base class
     * @param iconName (optional) the name of the icon shown on the menu item
     */
    constructor(
        text: string,
        iconName?: string,
        params?: imports.ui.popupMenu.PopupBaseMenuItemParams,
    ) {
        super(params)

        this.iconName = iconName
        this.text = text
    }

    /**
     * @param newName: the iconName. If null no Icon is shown
     */
    public set iconName(newName: string | null) {
        if (this.icon && !newName) {
            this.removeActor(this.icon);
            this.icon.destroy()
            this.icon = null
        }

        if (this.icon && newName) this.icon.icon_name = newName

        if (!this.icon && newName) {
            this.icon = new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_name: newName,
                style_class: 'popup-menu-icon' // this ensure the icon has a good height
            })
            this.addActor(this.icon, { span: 0 }, 0)
        }
    };


    public set text(newText: string) {

        if (!newText) return

        if (!this.label) {
            this.label = new Label({ text: newText })
            this.addActor(this.label)
            return
        }
        this.label.text = newText
    }


    /**
     * 
     * @param actor 
     * @param params 
     * @param position position to add the actor beginning with 0   
     * @returns 
     */
    public addActor(
        actor: imports.gi.Clutter.Actor,
        params?: Partial<imports.ui.popupMenu.AddActorParams>,
        position?: number
    ) {
        // @ts-ignore
        const children = this._children

        if (position > children.length || children.length === 0 || position == null) {
            super.addActor(actor, params)
            return
        }
        // @ts-ignore
        children.forEach((child, index) => {
            const { actor: childActor, ...childParams } = child
            this.removeActor(childActor)
            if (index === position) super.addActor(actor, params)
            super.addActor(childActor, childParams)
        })
    }

}