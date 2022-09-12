const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

function BarIndicatorStyle(applet, cols, rows, height) {
    this._init(applet, cols, rows, height);
}

BarIndicatorStyle.prototype = {

    _init: function(applet, cols, rows, height) {
        this.applet = applet;
        this.button = [];
        this.update_grid(cols, rows, height);
        this.switch_id = global.window_manager.connect('switch-workspace', Lang.bind(this, this.update));
        this.scroll_id = this.applet.actor.connect('scroll-event', Lang.bind(this,this.onMouseScroll));
    },

    update_grid: function(cols, rows, height) {
        this.cols = cols;
        this.rows = rows;
        this.height = height;
        this.rebuild();
    },

    cleanup: function() {
        global.window_manager.disconnect(this.switch_id);
        this.applet.actor.disconnect(this.scroll_id);
    },

    onMouseScroll: function(actor, event){
        if (this.scrollby == 'row')
            this.scrollByRow(event);
        else
            this.scrollByCol(event);
    },

    scrollByCol: function(event) {
        var idx = global.screen.get_active_workspace_index();

        if (event.get_scroll_direction() == 0) idx--;
        else if (event.get_scroll_direction() == 1) idx++;

        if(global.screen.get_workspace_by_index(idx) != null)
            global.screen.get_workspace_by_index(idx).activate(global.get_current_time());
    },

    scrollByRow: function(event) {
        var idx = global.screen.get_active_workspace_index();
        var numworkspaces = this.rows * this.cols;

        var row = Math.floor(idx/this.cols);
        var col = idx % this.cols;

        if (event.get_scroll_direction() == 0) {
            row--;
            if (row < 0) {
                row=this.rows-1;
                col--;
            }
        }
        else if (event.get_scroll_direction() == 1) {
            row++;
            if (row >= this.rows) {
                row=0;
                col++;
            }
        }

        if (col < 0 || col >= this.cols)
            return;

        idx = row*this.cols + col;

        if(global.screen.get_workspace_by_index(idx) != null)
            global.screen.get_workspace_by_index(idx).activate(global.get_current_time());
    },

    onRowIndicatorClicked: function(actor, event) {
        if (event.get_button() != 1) return false;

        let curws_idx = global.screen.get_active_workspace_index();
        let curws_row = Math.floor(curws_idx/this.cols);
        let [x, y] = event.get_coords();
        let [wx, wy] = actor.get_transformed_position();
        let [w, h] = actor.get_size();
        y -= wy;

        let clicked_row = Math.floor(this.rows*y/h);
        clicked_idx = (clicked_row * this.cols) + (curws_idx % this.cols);

        global.screen.get_workspace_by_index(clicked_idx).activate(global.get_current_time());
        return true;
    },

    onWorkspaceButtonClicked: function(actor, event) {
        if (event.get_button() != 1) return false;
        global.screen.get_workspace_by_index(actor.index).activate(global.get_current_time());
    },

    setReactivity: function(reactive) {
        for (let i=0; i < this.button.length; ++i)
            this.button[i].set_reactive(reactive);
    },

    rebuild: function() {
        this.applet.actor.destroy_all_children();

        if (this.rows > 1) {
            this.row_indicator = new St.DrawingArea({ reactive: true });
            this.row_indicator.set_width(this.height/1.75);
            this.row_indicator.connect('repaint', Lang.bind(this, this.draw_row_indicator));
            this.row_indicator.connect('button-press-event', Lang.bind(this, this.onRowIndicatorClicked));
            this.applet.actor.add(this.row_indicator);
        }

        this.button = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            this.button[i] = new St.Button({ name: 'workspaceButton', style_class: 'workspace-button', reactive: true });

            let text = (i+1).toString();
            let label = new St.Label({ text: text });
            label.set_style("font-weight: bold");
            this.button[i].set_child(label);
            this.applet.actor.add(this.button[i]);
            this.button[i].index = i;
            this.button[i].set_height(this.height);
            this.button[i].set_width(this.height*1.25);
            this.button[i].connect('button-release-event', Lang.bind(this, this.onWorkspaceButtonClicked));
        }
        this.update();
    },

    update: function() {
        let nworks = this.button.length;
        let active_ws = global.screen.get_active_workspace_index();
        let active_row = Math.floor(active_ws/this.cols);
        let low = (active_row)*this.cols;
        let high = low + this.cols;

        // If the user added or removed workspaces external to this applet then
        // we could end up with a selected workspaces that is out of bounds. Just
        // revert to displaying the last row in that case.
        if (active_ws >= nworks) {
            high = nworks - 1;
            low = high - this.cols;
        }

        for (let i=0; i < nworks; ++i) {
            if (i >= low && i < high) this.button[i].show();
            else this.button[i].hide();

            if (i == active_ws) {
                this.button[i].get_child().set_text((i+1).toString());
                this.button[i].add_style_pseudo_class('outlined');
            }
            else {
                this.button[i].get_child().set_text((i+1).toString());
                this.button[i].remove_style_pseudo_class('outlined');
            }
        }

        if ( this.row_indicator ) {
            this.row_indicator.queue_repaint();
        }
    },

    draw_row_indicator: function(area) {
        let [width, height] = area.get_surface_size();
        let themeNode = this.row_indicator.get_theme_node();
        let cr = area.get_context();

        let base_color = this.get_base_color();
        let active_color = null;
        let inactive_color = null;

        if (this.is_theme_light_on_dark()) {
            active_color = base_color.lighten();
            inactive_color = base_color.darken();
        }
        else {
            active_color = base_color.darken().darken();
            inactive_color = base_color.lighten().lighten();
        }

        let active = global.screen.get_active_workspace_index();
        let active_row = Math.floor(active/this.cols);

        // Catch overflow due to externally added/removed workspaces
        if (active >= this.button.length) active_row = (this.button.length-1) /this.cols;

        for ( let i=0; i < this.rows; ++i ) {
            let y = (i+1)*height/(this.rows+1);
            let endx = (width / 10) * 9;
            cr.moveTo(0, y);
            cr.lineTo(endx, y);
            let color = active_row == i ? active_color : inactive_color;
            Clutter.cairo_set_source_color(cr, color);
            cr.setLineWidth(2.0);
            cr.stroke();
        }
    },

    is_theme_light_on_dark: function() {
        let selected_idx = global.screen.get_active_workspace_index();
        let unselected_idx = 0;
        if (unselected_idx == selected_idx) unselected_idx = 1;

        let selected_txt_color = this.button[selected_idx].get_theme_node().get_color('color');
        let unselected_txt_color = this.button[unselected_idx].get_theme_node().get_color('color');

        let sel_avg = (selected_txt_color.red + selected_txt_color.green + selected_txt_color.blue)/3;
        let unsel_avg = (unselected_txt_color.red + unselected_txt_color.green + unselected_txt_color.blue)/3;
        return (sel_avg < unsel_avg);
    },

    // All colors we use in this applet are based on this theme defined color.
    // We simply grab the color of a normal, non-outlined workspae button.
    get_base_color: function() {
        let unselected_idx = 0;
        if (unselected_idx == global.screen.get_active_workspace_index()) unselected_idx = 1;
        return this.button[unselected_idx].get_theme_node().get_color('color');
    }
};

