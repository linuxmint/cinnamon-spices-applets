const St = imports.gi.St;
const { PopupBaseMenuItem } = imports.ui.popupMenu;

class PlayPauseIconMenuItem extends PopupBaseMenuItem {

    /**
     * _init:
     * @text (string): text to display in the label
     */
    _init(text) {
        super._init.call(this);
        this.label = new St.Label({ text: text });
        this.addActor(this.label);
    }

    _addIcon(status) {
        this.status = status

        let iconName
        if (status === "Playing") iconName = "media-playback-start"
        if (status === "Paused") iconName = "media-playback-pause"

        this._icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC
        });
        this.addActor(this._icon, { span: 0 });
    }

    _removeIcon() {

        // Only access "this._icon" when it exists to prevent "Object St.Icon (0x55a3f21c9810), has been already deallocated — impossible to access it ..." in logs. 
        if (this.status === "OFF") return

        if (this._icon) {
            this.removeActor(this._icon)
            this._icon.destroy()
        }
    }

    changePlayPauseOffStatus(newStatus) {

        this._removeIcon()

        if (newStatus !== "OFF") {
            // removing the label first to make sure the icon is in front of the label
            this.removeActor(this.label)
            this._addIcon(newStatus)
            this.addActor(this.label)
        }

        this.status = newStatus
    }
}