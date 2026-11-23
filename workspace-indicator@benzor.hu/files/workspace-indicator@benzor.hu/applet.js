const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;

const MIN_SWITCH_INTERVAL_MS = 220;

class IndicatorButton {
    constructor(applet) {
        this.applet = applet;
        this.actor = new St.Button(
            {
                name: 'indicator_button',
                style_class: 'workspace-button',
                reactive: true,
                can_focus: true
            }
        );
        if (applet.orientation == St.Side.TOP || applet.orientation == St.Side.BOTTOM) {
            this.actor.set_height(applet._panelHeight);
        } else {
            this.actor.set_width(applet._panelHeight);
            this.actor.add_style_class_name('vertical');
        }
        this.label = new St.Label({text: ''});
        this.label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this.actor.set_child(this.label);
        this.update_signal = global.workspace_manager.connect('active-workspace-changed', () => this.update());
        this.update();
    }

    show() {
        this.actor.connect('button-release-event', (actor, event) => this.on_click(actor, event));
        this.tooltip = new Tooltips.PanelItemTooltip(this, 'Current workspace', this.applet.orientation);
        this.actor.add_style_pseudo_class('outlined');
    }

    on_click(actor, event) {
        if (!this.applet.enable_expo_click)
            return;
        if (event.get_button() === 1 && !Main.expo.animationInProgress) // (1, 2, 3) = (left, middle, right)
            Main.expo.toggle();
    }

    update() {
        let idx = global.workspace_manager.get_active_workspace_index();
        this.label.text = `${idx + 1}`;
    }

    destroy() {
        if (this.tooltip)
            this.tooltip.destroy();
        global.workspace_manager.disconnect(this.update_signal);
        this.actor.destroy();
    }
}

class WorkspaceIndicatorApplet extends Applet.Applet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(
            this,
            metadata.uuid,
            instance_id
        );

        this.settings.bind(
            "enable-expo-click",
            "enable_expo_click"
        );

        this.settings.bind(
            "enable-scroll-switch",
            "enable_scroll_switch"
        );

        this.orientation = orientation;
        this.button = null;

        this.last_switch = 0;
        this.last_switch_direction = 0;

        this.scroll_signal = this.actor.connect('scroll-event', this.on_scroll_event.bind(this));
        this.create_button();

        this.edit_mode_signal = global.settings.connect('changed::panel-edit-mode', () => this.on_panel_edit_mode_changed());
    }

    create_button() {
        if (this.button) {
            this.button.destroy();
            this.button = null;
        }
        this.actor.set_style_class_name('workspace-switcher');
        this.button = new IndicatorButton(this);
        this.actor.add_actor(this.button.actor);
        this.button.show()
    }

    on_scroll_event(actor, event) {
        if (!this.enable_scroll_switch)
            return;
        let direction = event.get_scroll_direction();

        if (direction !== 0 && direction !== 1) return;

        const now = (new Date()).getTime();

        if ((now - this.last_switch) >= MIN_SWITCH_INTERVAL_MS || direction !== this.last_switch_direction) {
            direction === 0 ? Main.wm.actionMoveWorkspaceLeft() : Main.wm.actionMoveWorkspaceRight();
        }

        this.last_switch = now;
        this.last_switch_direction = direction;
    }

    on_applet_removed_from_panel() {
        if (this.button) {
            this.button.destroy();
            this.button = null;
        }
        if (this.edit_mode_signal)
            global.settings.disconnect(this.edit_mode_signal);
        if (this.scroll_signal)
            this.actor.disconnect(this.scroll_signal);
        this.settings.finalize();
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
            this.actor.set_vertical(false);
        else
            this.actor.set_vertical(true);

        this.create_button();
    }

    on_panel_height_changed() {
        this.create_button();
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        if (this.button)
            this.button.actor.reactive = reactive;
    }

    destroy() {
        this.on_applet_removed_from_panel();
        super.destroy();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new WorkspaceIndicatorApplet(
        metadata,
        orientation,
        panel_height,
        instance_id
    );
}