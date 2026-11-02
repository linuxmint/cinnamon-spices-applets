// PocketTray - a system tray with a pocket for the icons you rarely need.
//
// Replaces both stock tray applets (systray@cinnamon.org for legacy X11
// icons, xapp-status@cinnamon.org for XApp/StatusNotifier icons) and sorts
// every tray icon either into the panel or into a pocket that opens from a
// button next to the icons.
//
// Structure (all modules in lib/):
//
//   applet.js           this file: Cinnamon lifecycle, settings, wiring
//   lib/xembedHost.js   legacy X11 icons via Main.statusIconDispatcher
//   lib/xappHost.js     XApp status icons via XApp.StatusIconMonitor
//   lib/xappStatusIcon.js  a single XApp icon, screen-recording indicator
//   lib/hiddenList.js   which icon ids belong into the pocket
//   lib/pocketButton.js the button in the panel and its icon
//   lib/pocket.js       the popup holding the hidden icons, click/hover
//   lib/iconMenu.js     context menu: one switch per icon
//   lib/rivalGuard.js   steps back when another tray applet is enabled
//   lib/i18n.js         translations
//
// Data flow: a host gets an icon -> applet.placeIcon() asks the hidden list
// and puts the icon into panelBox or pocket.box -> applet.iconsChanged()
// lets the pocket show or hide its button. When the hidden list changes,
// both hosts re-sort their icons.

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

// Modules in lib/ are loaded through Cinnamon's per-applet importer, which
// works on Cinnamon 6.6 and later. Cinnamon drops this importer cache when the
// applet is unloaded, so a reload picks up edited modules.
const Me = imports.ui.appletManager.applets["PocketTray@spex"];
const { HiddenList } = Me.lib.hiddenList;
const { PocketButton } = Me.lib.pocketButton;
const { Pocket } = Me.lib.pocket;
const { XEmbedHost } = Me.lib.xembedHost;
const { XAppHost } = Me.lib.xappHost;
const { IconMenuSection } = Me.lib.iconMenu;
const RivalGuard = Me.lib.rivalGuard;

// Value of the "pocket-position" setting that puts the button first.
const BUTTON_BEFORE_ICONS = "left";

class PocketTrayApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        // Look like the stock tray: no box around the whole applet
        this.actor.remove_style_class_name("applet-box");
        this.actor.set_style_class_name("systray");
        this.actor.set_important(true);

        this.orientation = orientation;
        this._uuid = metadata.uuid;
        this._instanceId = instanceId;
        this._retired = false;
        this._signals = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

        this._bindSettings();

        // Icons that stay in the panel
        this.panelBox = new St.BoxLayout({ vertical: this.isVertical() });
        this.actor.add_actor(this.panelBox);

        this.pocketButton = new PocketButton(this, this.config);
        this.actor.add_actor(this.pocketButton.actor);
        this._updateButtonPosition();

        this.pocket = new Pocket(this, this.config, this.pocketButton);

        this.hiddenList = new HiddenList(this.settings, () => this._onHiddenListChanged());
        this._xembed = new XEmbedHost(this);
        this._xapp = new XAppHost(this);
        this._iconMenu = new IconMenuSection(this._applet_context_menu, [this._xembed, this._xapp], this.hiddenList);
    }

    // All settings except "hidden-apps" (see HiddenList) end up in
    // this.config, which PocketButton and Pocket read from.
    _bindSettings() {
        this.settings = new Settings.AppletSettings(this, this._uuid, this._instanceId);
        this.config = {};
        const bind = (key, prop, onChange) =>
            this.settings.bindWithObject(this.config, key, prop, onChange || null);

        bind("open-trigger", "openTrigger");
        bind("hover-delay", "hoverDelay");
        bind("close-delay", "closeDelay");
        bind("pocket-position", "pocketPosition", () => this._updateButtonPosition());
        bind("pocket-icon", "pocketIcon", () => this.pocketButton.update());
        bind("custom-icon", "customIcon", () => this.pocketButton.update());
    }

    // ------------------------------------------------------------------
    // Interface for the hosts (XEmbedHost, XAppHost)
    // ------------------------------------------------------------------
    isVertical() {
        return this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT;
    }

    // Puts an icon actor into the pocket or the panel, depending on the
    // hidden list; moves it if it is in the wrong one. Returns true for the
    // pocket.
    placeIcon(actor, id, atStart) {
        const toPocket = this.hiddenList.has(id);
        const target = toPocket ? this.pocket.box : this.panelBox;
        const parent = actor.get_parent();

        if (parent !== target) {
            if (parent) parent.remove_child(actor);
            if (atStart) {
                target.insert_child_at_index(actor, 0);
            } else {
                target.add_child(actor);
            }
        }
        return toPocket;
    }

    // Icons were added, removed, moved or hidden.
    iconsChanged() {
        this.pocket.updateVisibility();
    }

    // ------------------------------------------------------------------
    // Cinnamon applet lifecycle
    // ------------------------------------------------------------------
    on_applet_added_to_panel() {
        const rivals = RivalGuard.findRivalTrays(this._uuid);
        if (rivals) {
            // Never touch the tray icons while another tray applet runs.
            this._retire(rivals, false);
            return;
        }

        this._xembed.start();
        this._xapp.start();

        this._signals.connect(global, "scale-changed", this._onUiScaleChanged, this);
        this._signals.connect(global.settings, "changed::panel-edit-mode", this.on_panel_edit_mode_changed, this);
        this._signals.connect(global.settings, "changed::enabled-applets", this._onEnabledAppletsChanged, this);
    }

    on_applet_removed_from_panel() {
        this._stopAll();
        this.settings.finalize();
        this.pocket.destroy();
    }

    // The X11 tray dispatcher keeps running across an applet reload;
    // XEmbedHost.start() reads this flag to not start it a second time.
    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_applet_clicked(event) {
        // Clicks go to the icons and the pocket button.
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.panelBox.set_vertical(this.isVertical());
        this.pocket.setVertical(this.isVertical());
        this.pocketButton.update();
        this._xembed.updateOrientation();
        this._xapp.refresh();
    }

    on_panel_icon_size_changed(size) {
        this._resizeIcons();
    }

    on_panel_edit_mode_changed() {
        this._xapp.setReactive(!global.settings.get_boolean("panel-edit-mode"));
        this._resizeIcons();
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------
    _onHiddenListChanged() {
        this._xembed.redisplay();   // X11 icons are re-added and re-sorted
        this._xapp.sync();          // XApp icons are moved directly
    }

    _updateButtonPosition() {
        if (!this.pocketButton) return;   // settings callback during construction
        const index = this.config.pocketPosition === BUTTON_BEFORE_ICONS ? 0 : this.actor.get_n_children() - 1;
        this.actor.set_child_at_index(this.pocketButton.actor, index);
    }

    _resizeIcons() {
        this.pocketButton.update();
        this._xapp.refresh();
        this._xembed.resize();
    }

    // UI scale changes come in bursts; resize once they have settled.
    _onUiScaleChanged() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
        }
        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this._scaleUpdateId = 0;
            this._resizeIcons();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onEnabledAppletsChanged() {
        const rivals = RivalGuard.findRivalTrays(this._uuid);
        if (rivals) {
            this._retire(rivals, true);
        }
    }

    // Steps back for another tray applet (see lib/rivalGuard.js).
    // wasRunning: PocketTray already hosted icons and has to hand them over.
    _retire(rivals, wasRunning) {
        if (this._retired) return;
        this._retired = true;

        if (wasRunning) {
            this._stopAll();
            RivalGuard.handOverIcons(rivals);
        }
        RivalGuard.retire(this._uuid, this._instanceId, rivals);
    }

    // Stops hosting icons and listening to anything. Safe to call twice:
    // retiring is followed by on_applet_removed_from_panel().
    _stopAll() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }
        this._signals.disconnectAllSignals();
        this.pocket.close();
        this._xembed.stop();
        this._xapp.stop();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new PocketTrayApplet(metadata, orientation, panelHeight, instanceId);
}
