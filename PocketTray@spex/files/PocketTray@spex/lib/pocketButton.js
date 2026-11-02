// The pocket button in the panel.
//
// Shows the icon chosen in the settings ("pocket-icon", "custom-icon") and
// turns it towards the side where the pocket opens. The button is only
// visible while the pocket holds at least one icon; Pocket decides that.

const St = imports.gi.St;
const Gio = imports.gi.Gio;

// Bundled icons: icons/pockettray-<key>-symbolic.svg. Cinnamon adds the
// applet's icons/ directory to the icon theme, and being "-symbolic" they are
// recoloured like theme icons. All are drawn for a bottom panel, i.e.
// pointing up:
//   directional:  rotated so that they point to where the pocket opens
//   flipWhenOpen: additionally turned around while the pocket is open
const BUNDLED_ICONS = {
    "triangles":      { directional: false, flipWhenOpen: false },
    "triangles-down": { directional: false, flipWhenOpen: false },
    "circles":        { directional: false, flipWhenOpen: false },
    "grid":           { directional: false, flipWhenOpen: false },
    "dots":           { directional: false, flipWhenOpen: false },
    "pocket":         { directional: false, flipWhenOpen: false },
    "drawer":         { directional: true,  flipWhenOpen: false },
    "arrow":          { directional: true,  flipWhenOpen: true  }
};

// Settings values with a special meaning (see settings-schema.json).
const THEME_ARROW = "theme";    // arrow from the user's icon theme
const CUSTOM_ICON = "custom";   // icon name or file from "custom-icon"

var PocketButton = class PocketButton {
    // applet: provides orientation and getPanelIconSize()
    // config: settings object with pocketIcon and customIcon
    constructor(applet, config) {
        this._applet = applet;
        this._config = config;
        this._open = false;

        this.actor = new St.Button({
            style_class: "applet-box",
            reactive: true,
            track_hover: true,
            can_focus: true,
            visible: false
        });

        this._icon = new St.Icon({ icon_type: St.IconType.SYMBOLIC });
        this._icon.set_pivot_point(0.5, 0.5);   // rotate around the centre
        this.actor.set_child(this._icon);

        this.update();
    }

    // Called by Pocket when it opens or closes.
    setOpen(open) {
        this._open = open;
        this.actor.change_style_pseudo_class("checked", open);
        this.update();
    }

    // Re-reads the settings, panel orientation and icon size.
    update() {
        const icon = this._icon;
        const key = this._config.pocketIcon;
        const custom = this._config.customIcon;
        let angle = 0;

        icon.set_icon_size(this._applet.getPanelIconSize(St.IconType.SYMBOLIC));

        if (key === CUSTOM_ICON && custom) {
            // "iconfilechooser" yields either an absolute path or an icon name
            if (custom.startsWith("/")) {
                icon.set_gicon(new Gio.FileIcon({ file: Gio.File.new_for_path(custom) }));
            } else {
                icon.set_icon_name(custom);
            }
        } else if (BUNDLED_ICONS[key]) {
            const def = BUNDLED_ICONS[key];
            icon.set_icon_name("pockettray-" + key + "-symbolic");
            if (def.directional) angle = this._openDirectionAngle();
            if (def.flipWhenOpen && this._open) angle += 180;
        } else {
            // THEME_ARROW, an unknown value, or CUSTOM_ICON without a file
            icon.set_icon_name(this._themeArrowName());
        }

        icon.rotation_angle_z = angle % 360;
    }

    // Theme arrow pointing towards the pocket, or back while it is open.
    _themeArrowName() {
        const open = this._open;
        switch (this._applet.orientation) {
            case St.Side.TOP:    return open ? "pan-up-symbolic"    : "pan-down-symbolic";
            case St.Side.LEFT:   return open ? "pan-start-symbolic" : "pan-end-symbolic";
            case St.Side.RIGHT:  return open ? "pan-end-symbolic"   : "pan-start-symbolic";
            default:             return open ? "pan-down-symbolic"  : "pan-up-symbolic";
        }
    }

    // Rotation that turns an upward-pointing icon towards the pocket.
    _openDirectionAngle() {
        switch (this._applet.orientation) {
            case St.Side.TOP:   return 180;   // pocket opens downwards
            case St.Side.LEFT:  return 90;    // ... to the right
            case St.Side.RIGHT: return 270;   // ... to the left
            default:            return 0;     // bottom panel: upwards
        }
    }
};
