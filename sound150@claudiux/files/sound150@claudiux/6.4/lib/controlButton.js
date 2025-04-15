//!/usr/bin/cjs

const Tooltips = imports.ui.tooltips;
const St = imports.gi.St;

class ControlButton {
    constructor(icon, tooltip, callback, small = false) {
        this.destroyed = false;
        this.actor = new St.Bin();

        this.button = new St.Button();
        this.button.connect("clicked", callback);

        if (small) {
            this.button.add_style_pseudo_class("small");
        }

        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            style_class: (small) ? "popup-menu-icon" : null
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

        this.tooltip = new Tooltips.Tooltip(this.button, tooltip);
    }

    getActor() {
        if (this.destroyed) return null;
        return this.actor;
    }

    setData(icon, tooltip) {
        if (this.destroyed) return;
        try {
            if (this.icon) this.icon.icon_name = icon;
            if (this.tooltip) this.tooltip.set_text(tooltip);
        } catch (e) {}
    }

    setIconName(icon) {
        if (this.destroyed) return;
        try {
            this.icon.icon_name = icon;
        } catch (e) {}
    }

    setActive(status) {
        if (this.destroyed) return;
        try {
            if (this.button) this.button.change_style_pseudo_class("active", status);
        } catch (e) {}
    }

    setEnabled(status) {
        if (this.destroyed) return;
        try {
            if (this.button) this.button.change_style_pseudo_class("insensitive", !status);
            if (this.button) this.button.can_focus = status;
            if (this.button) this.button.reactive = status;
        } catch (e) {}
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        try {
            if (this.tooltip) this.tooltip.destroy();
            //~ this.button.remove_all_children();
            if (this.button) {
                this.button.disconnect("clicked");
                this.actor.remove_actor(this.button);
                this.button.destroy();
            }
            this.actor.destroy();
        } catch (e) {
            logError("Error destroying ControllButton: " + e);
        } finally {
            this.tooltip = null;
            this.button = null;
            //~ this.actor = null;
        }
    }
}
