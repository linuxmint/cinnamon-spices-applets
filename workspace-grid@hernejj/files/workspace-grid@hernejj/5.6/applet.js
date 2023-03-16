/*
 * This application is released under the GNU General Public License v2. A full
 * copy of the license can be found here: http://www.gnu.org/licenses/gpl.txt
 * Thank you for using free software!
 *
 * Cinnamon 2D Workspace Grid (c) Jason J. Herne <hernejj@gmail.com> 2022
 */
const St = imports.gi.St;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
let WorkspaceController, BarIndicatorStyle, GridStyle;
if (typeof require !== 'undefined') {
    WorkspaceController = require('WorkspaceController');
    BarIndicatorStyle = require('BarIndicatorStyle');
    GridStyle = require('GridStyle');
} else {
    const AppletDir = imports.ui.appletManager.applets['workspace-grid@hernejj'];
    WorkspaceController = AppletDir.WorkspaceController;
    BarIndicatorStyle = AppletDir.BarIndicatorStyle;
    GridStyle = AppletDir.GridStyle;
}

function registerKeyBindings(registerUpDownKeyBindings) {
    try {
        if (registerUpDownKeyBindings) {
            Meta.keybindings_set_custom_handler('switch-to-workspace-up', switchWorkspaceUp);
            Meta.keybindings_set_custom_handler('switch-to-workspace-down', switchWorkspaceDown);
        }
        else {
            Meta.keybindings_set_custom_handler('switch-to-workspace-up', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
            Meta.keybindings_set_custom_handler('switch-to-workspace-down', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
        }
        Meta.keybindings_set_custom_handler('switch-to-workspace-left', switchWorkspaceLeft);
        Meta.keybindings_set_custom_handler('switch-to-workspace-right', switchWorkspaceRight);
    }
    catch (e) {
        global.log("workspace-grid@hernejj: Registering keybindings failed!");
        global.logError("workspace-grid@hernejj exception: " + e.toString());
    }
}

function deregisterKeyBindings() {
    Meta.keybindings_set_custom_handler('switch-to-workspace-up', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
    Meta.keybindings_set_custom_handler('switch-to-workspace-down', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
    Meta.keybindings_set_custom_handler('switch-to-workspace-left', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
    Meta.keybindings_set_custom_handler('switch-to-workspace-right', (d, w, b) => Main.wm._showWorkspaceSwitcher(d, w, b));
}

function switchWorkspaceUp(display, screen, window) {
    let current_workspace_index = global.workspace_manager.get_active_workspace_index();

    Main.wm.actionMoveWorkspaceUp();

    if (current_workspace_index !== global.workspace_manager.get_active_workspace_index())
        Main.wm.showWorkspaceOSD();
}

function switchWorkspaceDown(display, screen, window) {
    let current_workspace_index = global.workspace_manager.get_active_workspace_index();

    Main.wm.actionMoveWorkspaceDown();

    if (current_workspace_index !== global.workspace_manager.get_active_workspace_index())
        Main.wm.showWorkspaceOSD();
}

function switchWorkspaceLeft(display, screen, window) {
    let current_workspace_index = global.workspace_manager.get_active_workspace_index();

    Main.wm.actionMoveWorkspaceLeft();

    if (current_workspace_index !== global.workspace_manager.get_active_workspace_index())
        Main.wm.showWorkspaceOSD();
}

function switchWorkspaceRight(display, screen, window) {
    let current_workspace_index = global.workspace_manager.get_active_workspace_index();

    Main.wm.actionMoveWorkspaceRight();

    if (current_workspace_index !== global.workspace_manager.get_active_workspace_index())
        Main.wm.showWorkspaceOSD();
}

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function (metadata, orientation, panel_height, instanceId) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instanceId);
        this.metadata = metadata;

        try {
            global.log("workspace-grid@hernejj: v0.9");
            this.actor.set_style_class_name("workspace-switcher-box");
            this.settings = new Settings.AppletSettings(this, "workspace-grid@hernejj", instanceId);
            this.settings.bindProperty(Settings.BindingDirection.IN, "numCols", "numCols", this.onUpdateNumberOfWorkspaces, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "numRows", "numRows", this.onUpdateNumberOfWorkspaces, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "style", "style", this.onUpdateStyle, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "registerUpDownKeyBindings", "registerUpDownKeyBindings", this.onKeyBindingChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "scrollWheelBehavior", "scrollWheelBehavior", this.onUpdateScrollWheelBehavior, null);

            this.wscon = new WorkspaceController.WorkspaceController(this.numCols, this.numRows);
            this.onUpdateStyle();

            this.onPanelEditModeChanged();
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.onPanelEditModeChanged));
        }
        catch (e) {
            global.logError("workspace-grid@hernejj Main Applet Exception: " + e.toString());
        }
    },

    on_applet_added_to_panel: function () {
        registerKeyBindings(this.registerUpDownKeyBindings);
    },

    on_applet_removed_from_panel: function () {
        this.wscon.release_control();
        deregisterKeyBindings();
    },

    onKeyBindingChanged: function () {
        registerKeyBindings(this.registerUpDownKeyBindings);
    },

    onUpdateNumberOfWorkspaces: function () {
        this.wscon.set_workspace_grid(this.numCols, this.numRows);
        this.ui.update_grid(this.numCols, this.numRows, this._panelHeight);
    },

    onUpdateStyle: function () {
        if (this.ui) this.ui.cleanup();
        if (this.style == 'single-row')
            this.ui = new BarIndicatorStyle.BarIndicatorStyle(this, this.numCols, this.numRows, this._panelHeight);
        else
            this.ui = new GridStyle.GridStyle(this, this.numCols, this.numRows, this._panelHeight);
        this.onUpdateScrollWheelBehavior();
    },

    onUpdateScrollWheelBehavior: function () {
        this.ui.scrollby = this.scrollWheelBehavior;
    },

    onPanelEditModeChanged: function () {
        this.ui.setReactivity(!global.settings.get_boolean('panel-edit-mode'));
    },

    on_panel_height_changed: function () {
        this.ui.update_grid(this.numCols, this.numRows, this._panelHeight);
    },
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
