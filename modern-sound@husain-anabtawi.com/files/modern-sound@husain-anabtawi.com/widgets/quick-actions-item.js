const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

class QuickActionsItem extends PopupMenu.PopupBaseMenuItem {
    constructor(applet) {
        super({ activate: false, hover: false });
        this._applet = applet;
        this.actor.add_style_class_name("modern-sound-quick-actions-item");

        this._muteSoundBtn = this._makeAction(
            "audio-volume-muted-symbolic",
            _("Mute Sound"),
            () => applet.toggleSoundMute()
        );
        this._muteMicBtn = this._makeAction(
            "microphone-sensitivity-muted-symbolic",
            _("Mute Mic"),
            () => applet.toggleInputMute()
        );
        this._settingsBtn = this._makeAction(
            "cs-sound",
            _("Open Settings"),
            () => applet.openSettings(),
            St.IconType.FULLCOLOR
        );

        this._table = new St.Table({
            style_class: "modern-sound-quick-actions",
            homogeneous: true,
            x_expand: true
        });

        this._table.add(this._wrapCell(this._muteSoundBtn), {
            row: 0,
            col: 0,
            x_expand: true,
            x_fill: true,
            y_fill: false
        });
        this._table.add(this._wrapCell(this._muteMicBtn), {
            row: 0,
            col: 1,
            x_expand: true,
            x_fill: true,
            y_fill: false
        });
        this._table.add(this._wrapCell(this._settingsBtn), {
            row: 0,
            col: 2,
            x_expand: true,
            x_fill: true,
            y_fill: false
        });

        this.addActor(this._table, { span: -1, expand: true });
    }

    _wrapCell(button) {
        return new St.Bin({
            style_class: "modern-sound-quick-cell",
            child: button,
            x_expand: true,
            x_fill: true
        });
    }

    _makeAction(iconName, label, callback, iconType = St.IconType.SYMBOLIC) {
        const icon = new St.Icon({
            icon_type: iconType,
            icon_name: iconName,
            icon_size: 24,
            style_class: iconType === St.IconType.SYMBOLIC ?
                `popup-menu-icon modern-sound-quick-icon` :
                "modern-sound-quick-icon",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        const text = new St.Label({
            text: label,
            style_class: "modern-sound-quick-label",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        const content = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-quick-content",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        content.add_actor(icon);
        content.add_actor(text);

        const btn = new St.Button({
            style_class: "modern-sound-quick-btn",
            child: new St.Bin({
                x_expand: true,
                y_expand: true,
                x_fill: true,
                y_fill: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                child: content
            }),
            x_expand: true,
            x_fill: true,
            can_focus: true,
            reactive: true,
            track_hover: true
        });
        btn.connect("clicked", callback);

        return btn;
    }

    setSoundMuted(muted) {
        this._muteSoundBtn.change_style_pseudo_class("active", muted);
    }

    setInputMuted(muted) {
        this._muteMicBtn.change_style_pseudo_class("active", muted);
    }
}

module.exports = { QuickActionsItem };
