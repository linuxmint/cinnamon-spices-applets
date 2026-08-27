/* global imports, global */
const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Gettext = imports.gettext;

const uuid = "cinnamon-workspace-name-applet@curbsoftware";
const MIN_SWITCH_INTERVAL_MS = 220;

Gettext.bindtextdomain(uuid, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(uuid, str);
}

let WorkspaceActions = null;
let RenameDialog = null;

function _loadModules() {
    if (WorkspaceActions && RenameDialog)
        return true;
    try {
        const dir = imports.ui.appletManager.applets[uuid];
        WorkspaceActions = dir.workspaceActions;
        RenameDialog = dir.renameDialog;
        return !!(WorkspaceActions && RenameDialog);
    } catch (e) {
        global.logError(uuid + " could not load helper modules: " + e);
        return false;
    }
}

function WorkspaceNamesApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

WorkspaceNamesApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.orientation = orientation;
        this._signalManager = new SignalManager.SignalManager(null);
        this._workspaceItems = [];
        this.buttons = [];
        this._rebuildSource = 0;
        this._actionSources = [];
        this._wsNameId = 0;
        this._lastSwitchTime = 0;
        this._destroyed = false;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.add_style_class_name("curb-workspace-names-applet");
        this.actor.set_track_hover(false);

        if (_loadModules()) {
            WorkspaceActions.setTranslate(_);
            RenameDialog.setTranslate(_);
        }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._migrateSettings();
        this.settings.bind("display-mode", "displayMode", this._queueRebuild);
        this.settings.bind("maximum-label-width", "maximumLabelWidth", this._queueRebuild);
        this.settings.bind("scroll-behavior", "scrollBehavior");
        this.settings.bind("enable-workspace-editing", "enableEditing", this._onEditingChanged);
        this.settings.bind("show-add-button", "showAddButton", this._queueRebuild);
        this.settings.bind("confirm-remove", "confirmRemove");

        this._buildContextMenu();
        this._connectSignals();
        this.on_orientation_changed(orientation);
        this._queueRebuild();
    },

    _migrateSettings: function () {
        try {
            const legacyScroll = this.settings.getValue("scroll-to-switch");
            const current = this.settings.getValue("scroll-behavior");
            if (legacyScroll === true && current === "disabled")
                this.settings.setValue("scroll-behavior", "normal");
            if (legacyScroll === true)
                this.settings.setValue("scroll-to-switch", false);
        } catch (e) {
            global.logError(uuid + " settings migration failed: " + e);
        }
    },

    _connectSignals: function () {
        this._signalManager.connect(global.window_manager, "switch-workspace", this._onWorkspaceSwitched, this);
        this._signalManager.connect(global.workspace_manager, "notify::n-workspaces", this._onWorkspacesChanged, this);
        this._signalManager.connect(global.workspace_manager, "workspace-added", this._onWorkspacesChanged, this);
        this._signalManager.connect(global.workspace_manager, "workspace-removed", this._onWorkspacesChanged, this);
        this._signalManager.connect(global.workspace_manager, "workspaces-reordered", this._onWorkspacesChanged, this);
        this._signalManager.connect(global.settings, "changed::panel-edit-mode", this._updateReactivity, this);

        if (WorkspaceActions)
            this._wsNameId = WorkspaceActions.connectNameChanges(this._onWorkspacesChanged.bind(this));
    },

    _buildContextMenu: function () {
        const expo = new PopupMenu.PopupIconMenuItem(
            _("Manage workspaces (Expo)"), "xsi-view-grid-symbolic", St.IconType.SYMBOLIC);
        expo.connect("activate", function () {
            if (!imports.ui.main.expo.animationInProgress)
                imports.ui.main.expo.toggle();
        });
        this._applet_context_menu.addMenuItem(expo);

        this._addMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Add workspace"), "xsi-list-add", St.IconType.SYMBOLIC);
        this._addMenuItem.connect("activate", this._onAddWorkspace.bind(this));
        this._applet_context_menu.addMenuItem(this._addMenuItem);

        this._renameMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Rename current workspace"), "edit-rename-symbolic", St.IconType.SYMBOLIC);
        this._renameMenuItem.connect("activate", () => {
            this._onRenameWorkspace(WorkspaceActions.getActiveWorkspaceIndex());
        });
        this._applet_context_menu.addMenuItem(this._renameMenuItem);

        this._removeMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Remove current workspace"), "xsi-list-remove", St.IconType.SYMBOLIC);
        this._removeMenuItem.connect("activate", () => {
            this._onRemoveWorkspace(WorkspaceActions.getActiveWorkspaceIndex());
        });
        this._applet_context_menu.addMenuItem(this._removeMenuItem);
    },

    _onEditingChanged: function () {
        this._refreshContextMenu();
        this._queueRebuild();
    },

    _refreshContextMenu: function () {
        if (!WorkspaceActions || !this._addMenuItem)
            return;
        this._addMenuItem.setSensitive(!!this.enableEditing && WorkspaceActions.canAdd());
        this._renameMenuItem.setSensitive(!!this.enableEditing);
        this._removeMenuItem.setSensitive(!!this.enableEditing && WorkspaceActions.canRemove());
    },

    on_orientation_changed: function (orientation) {
        this.orientation = orientation;
        const vertical = orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
        this.actor.set_vertical(vertical);
        if (vertical)
            this.actor.add_style_class_name("vertical");
        else
            this.actor.remove_style_class_name("vertical");
        this._queueRebuild();
    },

    on_panel_height_changed: function () {
        this._queueRebuild();
    },

    on_applet_clicked: function () {
        /* Workspace buttons own primary clicks. Right click remains applet menu. */
    },

    on_applet_scroll_event: function (actor, event) {
        if (!WorkspaceActions || this.scrollBehavior === "disabled")
            return false;

        const direction = event.get_scroll_direction();
        if (direction !== Clutter.ScrollDirection.UP && direction !== Clutter.ScrollDirection.DOWN)
            return false;

        const now = GLib.get_monotonic_time() / 1000;
        if (now - this._lastSwitchTime < MIN_SWITCH_INTERVAL_MS)
            return true;

        const count = WorkspaceActions.getWorkspaceCount();
        const active = WorkspaceActions.getActiveWorkspaceIndex();
        let delta = direction === Clutter.ScrollDirection.UP ? -1 : 1;
        if (this.scrollBehavior === "reversed")
            delta *= -1;
        const target = Math.max(0, Math.min(count - 1, active + delta));

        if (target !== active) {
            WorkspaceActions.activateWorkspaceByIndex(target);
            this._lastSwitchTime = now;
        }
        return true;
    },

    _onWorkspaceSwitched: function () {
        this._updateActiveState();
    },

    _onWorkspacesChanged: function () {
        this._queueRebuild();
    },

    _queueRebuild: function () {
        if (this._destroyed || this._rebuildSource)
            return;
        this._rebuildSource = Mainloop.timeout_add(0, () => {
            this._rebuildSource = 0;
            this._rebuild();
            return false;
        });
    },

    _rebuild: function () {
        if (this._destroyed || !_loadModules())
            return;

        this._destroyWorkspaceItems();
        const count = WorkspaceActions.getWorkspaceCount();
        this._buttonMetrics = this._getButtonMetrics(count);
        for (let index = 0; index < count; index++)
            this._addWorkspaceButton(index);

        if (this.enableEditing && this.showAddButton && WorkspaceActions.canAdd())
            this._addTrailingButton();

        this._refreshContextMenu();
        this._updateReactivity();
        this._updateActiveState();
    },

    _workspaceLabel: function (index, name) {
        if (this.displayMode === "number")
            return String(index + 1);
        const vertical = this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT;
        if (vertical) {
            const availableChars = Math.max(1, Math.min(4,
                Math.floor((this._panelHeight - 10) / 7)));
            const shortName = Array.from(name).slice(0, availableChars).join("");
            if (this.displayMode === "both")
                return String(index + 1) + " " + shortName.slice(0, 1);
            return shortName;
        }
        if (this.displayMode === "both")
            return String(index + 1) + ": " + name;
        return name;
    },

    _getButtonMetrics: function (count) {
        const vertical = this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT;
        const monitor = Main.layoutManager.findMonitorForActor(this.actor) ||
            Main.layoutManager.primaryMonitor;
        if (vertical) {
            const panelLength = monitor ? monitor.height : 1080;
            return {
                labelWidth: Math.max(16, this._panelHeight - 10),
                buttonLength: Math.max(20, Math.min(48,
                    Math.floor(panelLength * 0.68 / Math.max(1, count))))
            };
        }

        const panelLength = this.panel && this.panel.actor && this.panel.actor.width > 0
            ? this.panel.actor.width
            : (monitor ? monitor.width : 1920);
        const slot = Math.max(22, Math.floor(panelLength * 0.62 / Math.max(1, count)));
        return {
            labelWidth: Math.max(12, Math.min(this.maximumLabelWidth || 140, slot - 10)),
            buttonLength: slot
        };
    },

    _addWorkspaceButton: function (index) {
        const name = WorkspaceActions.getWorkspaceName(index);
        const button = new St.Button({
            style_class: "curb-workspace-names-button",
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: _("Workspace %d: %s").format(index + 1, name)
        });
        button.index = index;

        const label = new St.Label({
            text: this._workspaceLabel(index, name),
            style_class: "curb-workspace-names-label",
            y_align: Clutter.ActorAlign.CENTER
        });
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        label.set_style("max-width: " + this._buttonMetrics.labelWidth + "px;");
        button.set_child(label);
        button.connect("clicked", () => WorkspaceActions.activateWorkspaceByIndex(index));

        const vertical = this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT;
        if (vertical) {
            button.set_width(Math.max(24, this._panelHeight));
            button.set_height(this._buttonMetrics.buttonLength);
        } else {
            button.set_height(Math.max(24, this._panelHeight));
            button.set_width(Math.min(this._buttonMetrics.buttonLength,
                this._buttonMetrics.labelWidth + 10));
        }

        const tooltip = new Tooltips.Tooltip(button, name);
        this.actor.add_actor(button);
        this.buttons.push(button);
        this._workspaceItems.push({ actor: button, tooltip: tooltip });
    },

    _addTrailingButton: function () {
        const button = new St.Button({
            style_class: "curb-workspace-names-add-button",
            reactive: true,
            can_focus: true,
            accessible_name: _("Add workspace")
        });
        button.set_child(new St.Icon({
            icon_name: "list-add-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: Math.max(12, Math.min(18, this._panelHeight - 12))
        }));
        button.connect("clicked", this._onAddWorkspace.bind(this));
        const tooltip = new Tooltips.Tooltip(button, _("Add workspace"));
        this.actor.add_actor(button);
        this._workspaceItems.push({ actor: button, tooltip: tooltip });
    },

    _updateActiveState: function () {
        if (!WorkspaceActions)
            return;
        const active = WorkspaceActions.getActiveWorkspaceIndex();
        for (let i = 0; i < this.buttons.length; i++) {
            const button = this.buttons[i];
            const name = WorkspaceActions.getWorkspaceName(button.index);
            const isActive = button.index === active;
            button.change_style_pseudo_class("outlined", isActive);
            button.set_accessible_name((isActive ? _("Current workspace") + ", " : "") +
                _("Workspace %d: %s").format(button.index + 1, name));
        }
    },

    _updateReactivity: function () {
        const reactive = !global.settings.get_boolean("panel-edit-mode");
        for (let i = 0; i < this._workspaceItems.length; i++)
            this._workspaceItems[i].actor.reactive = reactive;
    },

    _destroyWorkspaceItems: function () {
        for (let i = 0; i < this._workspaceItems.length; i++) {
            const item = this._workspaceItems[i];
            if (item.tooltip)
                item.tooltip.destroy();
            if (item.actor && item.actor.get_parent())
                item.actor.destroy();
        }
        this._workspaceItems = [];
        this.buttons = [];
    },

    _deferAction: function (fn) {
        let id = Mainloop.timeout_add(0, () => {
            this._actionSources = this._actionSources.filter(source => source !== id);
            if (!this._destroyed) {
                try {
                    fn.call(this);
                } catch (e) {
                    global.logError(uuid + " deferred action failed: " + e);
                }
            }
            return false;
        });
        this._actionSources.push(id);
    },

    _onAddWorkspace: function () {
        this._deferAction(function () {
            if (this.enableEditing)
                WorkspaceActions.addWorkspace();
        });
    },

    _onRemoveWorkspace: function (index) {
        this._deferAction(function () {
            if (this.enableEditing)
                WorkspaceActions.removeWorkspaceByIndex(index, { confirm: this.confirmRemove });
        });
    },

    _onRenameWorkspace: function (index) {
        this._deferAction(function () {
            if (!this.enableEditing || !WorkspaceActions.isValidIndex(index))
                return;
            const current = WorkspaceActions.getWorkspaceName(index);
            RenameDialog.promptRename(current, function (newName) {
                WorkspaceActions.renameWorkspace(index, newName);
            });
        });
    },

    on_applet_removed_from_panel: function () {
        if (this._destroyed)
            return;
        this._destroyed = true;

        if (this._rebuildSource) {
            Mainloop.source_remove(this._rebuildSource);
            this._rebuildSource = 0;
        }
        for (let i = 0; i < this._actionSources.length; i++)
            Mainloop.source_remove(this._actionSources[i]);
        this._actionSources = [];

        this._destroyWorkspaceItems();
        if (this._wsNameId && WorkspaceActions) {
            WorkspaceActions.disconnectNameChanges(this._wsNameId);
            this._wsNameId = 0;
        }
        this._signalManager.disconnectAllSignals();
        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new WorkspaceNamesApplet(metadata, orientation, panelHeight, instanceId);
}
