const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;
const St = imports.gi.St;

/*  This is a hijack of Cinnamon's PanelItemTooltip.
    It allows the tooltip container to be a BoxLayout,
    instead of a single Label, hence it can contain anything.
*/
class BoxLayoutTooltip extends Tooltips.PanelItemTooltip {
    constructor(panelItem, initTitle, orientation){
        super(panelItem, initTitle, orientation);
        Main.uiGroup.remove_child(this._tooltip) // remove the label
        this._tooltip = new St.BoxLayout({vertical:true});
        this._tooltip.show_on_set_parent = false;
        this._tooltip.get_text = function () {return '/';} // without this trick the tooltip will never be displayed.
        Main.uiGroup.add_actor(this._tooltip); // add our BoxLayout.
    }
}
