// Two linked, mutually exclusive buttons. The screen icon includes both
// text and an image: it must not suggest an image-only scaling method.
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const { _ } = require("./i18n");

class ModeSelector extends PopupMenu.PopupBaseMenuItem {
    _init(appletPath, uiMode, showTooltips = true) {
        super._init({ activate: false, hover: false });
        this.actor.set_style("min-width: 0; padding: 0.4em 0.65em; spacing: 0;");
        this.actor.can_focus = false;
        this.actor.accessible_name = _("Scaling method");
        this._enabled = true;
        this._buttons = [];
        this._buttonStyles = [];
        this._tooltips = [];
        const group = new St.BoxLayout();
        group.set_style("spacing: 0;");
        const modes = [
            { file: "mode-text-symbolic.svg", name: _("Text scaling: fonts and layout") },
            { file: "mode-screen-symbolic.svg", name: _("Screen scaling with text compensation") }
        ];
        modes.forEach((mode, index) => {
            const button = new St.Button({
                style_class: "notification-button",
                toggle_mode: true,
                can_focus: true,
                accessible_name: mode.name,
                accessible_role: Atk.Role.RADIO_BUTTON
            });
            this._buttonStyles.push("padding: 0.35em 0.6em; margin: 0; border-radius: " +
                (index === 0 ? "0.4em 0 0 0.4em;" : "0 0.4em 0.4em 0;"));
            button.set_child(new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(
                    GLib.build_filenamev([appletPath, mode.file])) }),
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 24
            }));
            group.add(button, { expand: true, x_fill: true });
            this._buttons.push(button);
            this._tooltips.push(new Tooltips.Tooltip(button, mode.name));
            this._signals.connect(button, "clicked", () => this._choose(index === 1));
            this._signals.connect(button, "key-press-event", (actor, event) => {
                const key = event.get_key_symbol();
                if (key !== Clutter.KEY_Left && key !== Clutter.KEY_Right)
                    return Clutter.EVENT_PROPAGATE;
                if (this._enabled) {
                    const rtl = group.get_direction() === St.TextDirection.RTL;
                    const next = (key === Clutter.KEY_Right) !== rtl ? 1 : 0;
                    this._buttons[next].grab_key_focus();
                    this._choose(next === 1);
                }
                return Clutter.EVENT_STOP;
            });
        });
        this.addActor(group, { span: -1, expand: true });
        this.setMode(uiMode);
        this.setTooltipsEnabled(showTooltips);
    }

    _choose(uiMode) {
        if (!this._enabled || uiMode === this._uiMode) {
            this.setMode(this._uiMode);
            return;
        }
        this.setMode(uiMode);
        this.emit("mode-selected", uiMode);
    }

    chooseAtPoint(absX, absY) {
        if (!this._enabled)
            return false;
        for (let index = 0; index < this._buttons.length; index++) {
            const button = this._buttons[index];
            const [x, y] = button.get_transformed_position();
            const [width, height] = button.get_transformed_size();
            if (absX >= x && absX < x + width && absY >= y && absY < y + height) {
                this._choose(index === 1);
                return true;
            }
        }
        return false;
    }

    setMode(uiMode) {
        this._uiMode = uiMode === true;
        this._buttons.forEach((button, index) => {
            const selected = (index === 1) === this._uiMode;
            button.checked = selected;
            // Cinnamon themes style the regular notification buttons, rather
            // than GTK's generic .button class. Keep their pressed colors and
            // add a small raised/inset relief, independent of hover.
            button.change_style_pseudo_class("active", selected);
            button.set_style(this._buttonStyles[index] + (selected
                ? "box-shadow: inset 0 2px 3px rgba(0,0,0,0.55);"
                : "box-shadow: 0 2px 2px rgba(0,0,0,0.35);"));
        });
    }

    setButtonsSensitive(sensitive) {
        this._enabled = sensitive;
        this._buttons.forEach(button => {
            button.reactive = sensitive;
            button.can_focus = sensitive;
            button.change_style_pseudo_class("insensitive", !sensitive);
        });
    }

    setTooltipsEnabled(enabled) {
        for (const tooltip of this._tooltips) {
            tooltip.preventShow = !enabled;
            if (!enabled)
                tooltip.hide();
        }
    }
}

module.exports = ModeSelector;
