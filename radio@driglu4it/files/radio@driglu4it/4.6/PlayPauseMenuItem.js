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
    addIcon(playbackStatus) {
        this._playbackStatus = playbackStatus;
        let iconName;
        if (playbackStatus === "Playing")
            iconName = "media-playback-start";
        if (playbackStatus === "Paused")
            iconName = "media-playback-pause";
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC
        });
        this.addActor(this.icon, { span: 0 });
    }
    removeIcon() {
        if (this._playbackStatus === "Stopped")
            return;
        if (this.icon) {
            this.removeActor(this.icon);
            this.icon.destroy();
        }
    }
    set playbackStatus(newStatus) {
        this.removeIcon();
        if (newStatus !== "Stopped") {
            this.removeActor(this.label);
            this.addIcon(newStatus);
            this.addActor(this.label);
        }
        this._playbackStatus = newStatus;
    }
    get playbackStatus() {
        return this._playbackStatus;
    }
}
exports.PlayMausMenuItem = PlayMausMenuItem;
