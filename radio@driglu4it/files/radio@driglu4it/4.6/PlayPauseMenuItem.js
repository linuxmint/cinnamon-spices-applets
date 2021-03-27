"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayMausMenuItem = void 0;
const { PopupBaseMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;
class PlayMausMenuItem extends PopupBaseMenuItem {
    constructor(text) {
        super();
        this.label = new St.Label({ text });
        this.addActor(this.label);
    }
    addIcon(status) {
        this.status = status;
        let iconName;
        if (status === "Playing")
            iconName = "media-playback-start";
        if (status === "Paused")
            iconName = "media-playback-pause";
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC
        });
        this.addActor(this.icon, { span: 0 });
    }
    removeIcon() {
        if (this.status === "Stopped")
            return;
        if (this.icon) {
            this.removeActor(this.icon);
            this.icon.destroy();
        }
    }
    changePlayPauseOffStatus(newStatus) {
        this.removeIcon();
        if (newStatus !== "Stopped") {
            this.removeActor(this.label);
            this.addIcon(newStatus);
            this.addActor(this.label);
        }
        this.status = newStatus;
    }
}
exports.PlayMausMenuItem = PlayMausMenuItem;
