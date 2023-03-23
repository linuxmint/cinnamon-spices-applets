const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

function GridStyle(applet, cols, rows, height) {
    this._init(applet, cols, rows, height);
}

GridStyle.prototype = {

    _init: function (applet, cols, rows, height) {
        this.scrollby = 'col';
        this.applet = applet;
        this.button = [];
        this.update_grid(cols, rows, height);
        this.event_handlers = [];
        this.switch_id = global.window_manager.connect('switch-workspace', Lang.bind(this, this.update));
        this.scroll_id = this.applet.actor.connect('scroll-event', Lang.bind(this, this.onMouseScroll));
    },

    cleanup: function () {
        global.window_manager.disconnect(this.switch_id);
        this.applet.actor.disconnect(this.scroll_id);
    },

    update_grid: function (cols, rows, height) {
        this.cols = cols;
        this.rows = rows;
        this.height = height;
        this.rebuild();
    },

    onMouseScroll: function (actor, event) {
        if (this.scrollby == 'row')
            this.scrollByRow(event);
        else
            this.scrollByCol(event);
    },

    scrollByCol: function (event) {
        var idx = global.workspace_manager.get_active_workspace_index();

        if (event.get_scroll_direction() == 0) idx--;
        else if (event.get_scroll_direction() == 1) idx++;

        if (global.workspace_manager.get_workspace_by_index(idx) != null)
            global.workspace_manager.get_workspace_by_index(idx).activate(global.get_current_time());
    },

    scrollByRow: function (event) {
        var idx = global.workspace_manager.get_active_workspace_index();
        var numworkspaces = this.rows * this.cols;

        var row = Math.floor(idx / this.cols);
        var col = idx % this.cols;

        if (event.get_scroll_direction() == 0) {
            row--;
            if (row < 0) {
                row = this.rows - 1;
                col--;
            }
        }
        else if (event.get_scroll_direction() == 1) {
            row++;
            if (row >= this.rows) {
                row = 0;
                col++;
            }
        }

        if (col < 0 || col >= this.cols)
            return;

        idx = row * this.cols + col;

        if (global.workspace_manager.get_workspace_by_index(idx) != null)
            global.workspace_manager.get_workspace_by_index(idx).activate(global.get_current_time());
    },

    onWorkspaceButtonClicked: function (actor, event) {
        if (event.get_button() != 1) return false;
        global.workspace_manager.get_workspace_by_index(actor.index).activate(global.get_current_time());
    },

    setReactivity: function (reactive) {
        for (let i = 0; i < this.button.length; ++i)
            this.button[i].reactive = reactive;
    },

    rebuild: function () {
        this.applet.actor.destroy_all_children();
        this.table = new St.Table({ homogeneous: false, reactive: true });
        this.applet.actor.add(this.table);

        let btn_height = this.height / this.rows;
        this.button = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let i = (r * this.cols) + c;

                this.button[i] = new St.Button({ name: 'workspaceButton', style_class: 'workspace-button', reactive: true });
                this.button[i].index = i;
                this.button[i].set_height(btn_height);
                this.button[i].set_width(btn_height * 1.25);
                this.button[i].connect('button-release-event', Lang.bind(this, this.onWorkspaceButtonClicked));
                this.table.add(this.button[i], { row: r, col: c });
            }
        }
        this.update();
    },

    update: function () {
        let active_ws = global.workspace_manager.get_active_workspace_index();

        for (let i = 0; i < this.button.length; ++i) {
            if (i == active_ws)
                this.button[i].add_style_pseudo_class('outlined');
            else
                this.button[i].remove_style_pseudo_class('outlined');
        }
    }
};

