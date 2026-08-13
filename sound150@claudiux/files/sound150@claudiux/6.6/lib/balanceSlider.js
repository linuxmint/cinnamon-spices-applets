//!/usr/bin/cjs

const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Cvc = imports.gi.Cvc;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;

const { ControlButton } = require("./lib/controlButton");

class BalanceSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet) {
        const startLevel = 1 * applet.balance;
        super(startLevel);
        this.applet = applet;
        this.tooltipText = _("Balance");
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);
        
        this.set_mark(0.5);
        Gtk.IconTheme.get_default().append_search_path("./icons");
        this.iconName = "balance";
        this.icon = new St.Icon({
            icon_name: this.iconName,
            icon_type: St.IconType.SYMBOLIC,
            icon_size: Math.trunc(20 * this.applet.real_ui_scale)
        });
        if (this._slider)
            this.removeActor(this._slider);
        this.addActor(this.icon, {span: 0});
        this.addActor(this._slider, {
            span: -1,
            expand: true
        });
        this.getChannelMap();
        let changedId = this.connect("value-changed", () => this._onValueChanged());
        let dragendId = this.connect("drag-end", () => this._onDragEnd());
        this.connect("destroy", () => {
            this.disconnect(dragendId);
            this.disconnect(changedId);
        });
        
    }
    
    _onValueInit() {
        var bal = 0.5;
        this.getChannelMap();
        if (this.channelMap != null) {
            bal = (this.channelMap.get_balance() + 1) / 2;
            bal = this.adjust_bal(bal);
        }
        this._value = bal;
        this.applet.balance = bal;
    }
    
    _onValueChanged() {
        let bal = Math.round(this._value * 1000) / 1000;
        bal = this.adjust_bal(bal);
        this.applet.balance = bal;
        this.getChannelMap();
        if (this.channelMap != null) {
            this.channelMap.set_balance(2 * bal - 1);
        }
    }
    
    _onDragEnd() {
        let bal = Math.round(this._value * 1000) / 1000;
        bal = this.adjust_bal(bal);
        this.applet.balance = bal;
        this.getChannelMap();
        if (this.channelMap != null) {
            this.channelMap.set_balance(2 * bal - 1);
        }
    }
    
    getChannelMap() {
        this.channelMap = this.applet._channelMap;
    }
    
    adjust_bal(bal) {
        if (Math.abs(bal - 0.5) < 0.025)
            return 0.5;
        else
            return Math.round(bal * 200) / 200;
    }
    
}
Signals.addSignalMethods(BalanceSlider.prototype);

module.exports = {
    BalanceSlider
}
