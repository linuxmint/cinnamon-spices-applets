const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;

function WorkspaceNameApplet(metadata, orientation, panel_height, instanceId) {
  this._init(metadata, orientation, panel_height, instanceId);
}

WorkspaceNameApplet.prototype = {
  __proto__: Applet.TextApplet.prototype,

  _init: function(metadata, orientation, panel_height, instanceId) {
    Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instanceId);
    this.metadata = metadata;

    try {
      this.log(this.metadata.version);

      // Set up the label.
      global.window_manager.connect('switch-workspace', Lang.bind(this, this.updateLabel));
      global.settings.connect('changed::workspace-name-overrides', Lang.bind(this, this.updateLabel));
      this.updateLabel();

      // Set up the menu.
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menuManager.addMenu(this.menu);
    } catch(e) {
      this.logError(this.uuid + " Main Applet Exception: " + e.toString());
    }
  },

  on_applet_clicked: function(event) {
    this.updateMenu();
    this.menu.toggle();
  },

  log: function(message) {
    global.log('[' + this.metadata.uuid + '] ' + message);
  },

  logError: function(message) {
    global.logError('[' + this.metadata.uuid + '] ' + message);
  },

  updateLabel: function() {
    this.log('Updating label');
    let activeWorkspace = global.screen.get_active_workspace();
    let name = Main.getWorkspaceName(activeWorkspace.index());
    this.set_applet_label(name);
  },

  updateMenu: function() {
    this.menu.removeAll();

    for (let i = 0, workspaceCount = global.screen.n_workspaces; i < workspaceCount; i++) {
      let workspaceName = Main.getWorkspaceName(i);
      let workspace = global.screen.get_workspace_by_index(i);
      let menuItem = new PopupMenu.PopupMenuItem(workspaceName);

      if (i === global.screen.get_active_workspace_index()) {
        menuItem.actor.reactive = false;
        menuItem.actor.can_focus = false;
        menuItem.label.add_style_class_name('popup-subtitle-menu-item');
      }

      menuItem.connect('activate', Lang.bind(this, function() { this.activateWorkspace(workspace); }));
      this.menu.addMenuItem(menuItem);
    }
  },

  activateWorkspace: function(workspace) {
    workspace.activate(global.get_current_time());
  }
}

function main(metadata, orientation, panel_height, instanceId) {
  return new WorkspaceNameApplet(metadata, orientation, panel_height, instanceId);
}
