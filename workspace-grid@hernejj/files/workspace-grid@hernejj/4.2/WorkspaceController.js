const Lang = imports.lang;
const Meta = imports.gi.Meta;

function WorkspaceController(cols, rows) {
    this._init(cols, rows);
}

WorkspaceController.prototype = {

    _init: function(cols, rows) {
        this.set_workspace_grid(cols, rows);
    },

    // Create proper workspace layout geometry within Gnome
    set_workspace_grid: function (cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.__equalize_num_workspaces();
        global.screen.override_workspace_layout(Meta.ScreenCorner.TOPLEFT, false, rows, cols);
    },

    // Update Gnome's view of workspaces to reflect our count based on row*col.
    __equalize_num_workspaces: function() {
        let new_ws_count = this.cols * this.rows;
        let old_ws_count = global.screen.n_workspaces;

        if (new_ws_count > old_ws_count) {
            for (let i=old_ws_count; i<new_ws_count; i++)
                global.screen.append_new_workspace(false, global.get_current_time());
        }
        else if (new_ws_count < old_ws_count) {
            for (let i=old_ws_count; i>new_ws_count; i--) {
                let ws = global.screen.get_workspace_by_index( global.screen.n_workspaces-1 );
                global.screen.remove_workspace(ws, global.get_current_time());
            }
        }
    },

    // This applet is going away. Revert to allowing Cinnamon to control workspaces.
    release_control: function() {
        this.set_workspace_grid(-1, 1); // Set to no rows, and a single desktop
    }
};

