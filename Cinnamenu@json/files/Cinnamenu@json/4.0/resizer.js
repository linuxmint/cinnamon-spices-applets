const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;

const ZONE_SIZE = 10;

class PopupResizeHandler {
    constructor(applet, actor, wmin, wmax, hmin, hmax, resized_callback, get_user_width, get_user_height) {
        this.applet = applet;
        this.actor = actor;
        this.wmin = wmin * global.ui_scale;
        this.wmax = wmax * global.ui_scale;
        this.hmin = hmin * global.ui_scale;
        this.hmax = hmax * global.ui_scale;
        this.callback = resized_callback;
        this.get_user_width = get_user_width;
        this.get_user_height = get_user_height;

        this._signals = new SignalManager.SignalManager(null);

        this._signals.connect(this.actor, 'motion-event', (...args) => this._motion_event(...args));
        this._signals.connect(this.actor, 'leave-event', (...args) => this._leave_event(...args));
        this._signals.connect(this.actor, 'button-press-event', (...args) => this._onButtonPress(...args));

        this.no_edges_draggable = true;
        this.inhibit_resizing = false;

        this.drag_start_pos = null;
        this.drag_start_size = null;
        this.scaled_zone_size = ZONE_SIZE * global.ui_scale;

        this.edges = { top:    0,
                       bottom: 0,
                       left:   0,
                       right:  0 };

        this.resizingInProgress = false;
    }

    _onButtonPress(actor, event) {
        if (this.inhibit_resizing || this.no_edges_draggable)
            return false;

        if (event.get_button() != 1)
            return false;

        //---Start drag------

        this._grabEvents(event);
        this.resizingInProgress = true;

        let [stageX, stageY] = event.get_coords();
        this.drag_start_position = {x: stageX, y: stageY};
        this.drag_start_size = {width: this.actor.width, height: this.actor.height};
        this.init_user_width = this.get_user_width();
        this.init_user_height = this.get_user_height();

        return true;
    }

    _grabEvents(event) {
        this._eventsGrabbed = true;

        this.drag_device = event.get_device();
        this.drag_device.grab(this.actor);

        this._onEventId = this.actor.connect('event', (...args) => this._onEvent(...args));
    }

    _ungrabEvents(event) {
        if (!this._eventsGrabbed)
            return;

        if (this.drag_device) {
            this.drag_device.ungrab();
            this.drag_device = null;
        } else if (event) {//this shouldn't arise
            event.get_device().ungrab();
        }
        this._eventsGrabbed = false;

        this.actor.disconnect(this._onEventId);
        this._onEventId = null;
    }

    _stop_drag(event) {
        if (!this.resizingInProgress) {
            return;
        }
        global.unset_cursor();
        this._ungrabEvents(event);

        this.actor.queue_relayout();

        this.drag_start_position = null;
        this.drag_start_size = null;
        this.resizingInProgress = false;
        //update position again while this.resizingInProgress === false so that applet can update settings
        this.callback(this.last_new_user_width, this.last_new_user_height);
    }

    _onEvent(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_RELEASE) {
            this._stop_drag();
            return true;
        } else if (event.type() == Clutter.EventType.MOTION) {
            if (this.resizingInProgress) {
                this._updateDragPosition(event);
                return true;
            }
        } else if (event.type() == Clutter.EventType.KEY_PRESS && this.resizingInProgress) {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._stop_drag();
                return Clutter.EVENT_STOP;//doesn't work, event not stopping??
            }
            return Clutter.EVENT_STOP;
        }
        return false;
    }

    _collect_work_area_edges() {
        let monitor = Main.layoutManager.currentMonitor;

        let ws = global.screen.get_active_workspace();
        let area = ws.get_work_area_for_monitor(monitor.index);

        this.edges.top = area.y;
        this.edges.bottom = area.y + area.height;
        this.edges.left = area.x;
        this.edges.right = area.x + area.width;

        this.workAreaHeight = area.height;
        this.workAreaWidth = area.width;
    }

    _motion_event(box, event) {
        if (this.inhibit_resizing) {
            return Clutter.EVENT_PROPAGATE;
        }
        this._collect_work_area_edges();
        this.scaled_zone_size = ZONE_SIZE * global.ui_scale;

        let cursor = 0;

        let [x, y] = event.get_coords();

        const oversized_height = this.actor.height >= this.workAreaHeight;
        const oversized_width = this.actor.width >= this.workAreaWidth;

        this.top_edge_draggable = this.in_top_resize_zone (x, y, oversized_height);
        this.bottom_edge_draggable = this.in_bottom_resize_zone (x, y, oversized_height);
        this.left_edge_draggable = this.in_left_resize_zone (x, y, oversized_width);
        this.right_edge_draggable = this.in_right_resize_zone (x, y, oversized_width);

        this.no_edges_draggable = false;
        if (this.top_edge_draggable && this.left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_LEFT;
        } else if (this.top_edge_draggable && this.right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_RIGHT;
        } else if (this.bottom_edge_draggable && this.left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_LEFT;
        } else if (this.bottom_edge_draggable && this.right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_RIGHT;
        } else if (this.top_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP;
        } else if (this.bottom_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM;
        } else if (this.left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_LEFT;
        } else if (this.right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_RIGHT;
        } else {
            global.unset_cursor();
            this.no_edges_draggable = true;
            return Clutter.EVENT_PROPAGATE;
        }

        global.set_cursor (cursor);
        return Clutter.EVENT_PROPAGATE;
    }

    _updateDragPosition(event) {
        let [stageX, stageY] = event.get_coords();
        let x = stageX;
        let y = stageY;
        let delta_width = 0;
        let delta_height = 0;

        if (this.left_edge_draggable) {
            let start_x = this.drag_start_position.x;
            let start_w = this.drag_start_size.width;

            let diff = start_x - x;
            const new_width = (start_w + diff).clamp(this.wmin, this.wmax);
            delta_width = new_width - start_w;
        } else if (this.right_edge_draggable) {
            let start_x = this.drag_start_position.x;
            let start_w = this.drag_start_size.width;

            let diff = x - start_x;
            const new_width = (start_w + diff).clamp(this.wmin, this.wmax);
            delta_width = new_width - start_w;
        }

        if (this.top_edge_draggable) {
            let start_y = this.drag_start_position.y;
            let start_h = this.drag_start_size.height;

            let diff = start_y - y;
            const new_height = (start_h + diff).clamp(this.hmin, this.hmax);
            delta_height = new_height - start_h;
        } else if (this.bottom_edge_draggable) {
            let start_y = this.drag_start_position.y;
            let start_h= this.drag_start_size.height;

            let diff = y - start_y;
            const new_height = (start_h + diff).clamp(this.hmin, this.hmax);
            delta_height = new_height - start_h;
        }

        const new_user_width = this.init_user_width + delta_width;
        const new_user_height = this.init_user_height + delta_height;
        this.callback(new_user_width, new_user_height);
        this.last_new_user_width = new_user_width;
        this.last_new_user_height = new_user_height;

        return true;
    }

    _leave_event(box, event) {
        if (!this.resizingInProgress) {
            global.unset_cursor();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    in_top_resize_zone(x, y, oversized_height) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width) {
            return false;
        }

        return y <= this.actor.y + this.scaled_zone_size && y >= this.actor.y &&
               this.actor.y > this.edges.top ||
               oversized_height &&
               y <= this.edges.top + this.scaled_zone_size && y >= this.edges.top;
    }

    in_bottom_resize_zone(x, y, oversized_height) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width) {
            return false;
        }

        return y >= this.actor.y + this.actor.height - this.scaled_zone_size &&
               y <= this.actor.y + this.actor.height && this.actor.y + this.actor.height < this.edges.bottom ||
               oversized_height &&
               y >= this.edges.bottom - this.scaled_zone_size && y <= this.edges.bottom;
    }

    in_left_resize_zone(x, y, oversized_width) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height) {
            return false;
        }

        return x <= this.actor.x + this.scaled_zone_size &&
               x >= this.actor.x && this.actor.x > this.edges.left ||
               oversized_width &&
               x <= this.edges.left + this.scaled_zone_size && x >= this.edges.left;
    }

    in_right_resize_zone(x, y, oversized_width) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height) {
            return false;
        }

        return x >= this.actor.x + this.actor.width - this.scaled_zone_size &&
               x <= this.actor.x + this.actor.width && this.actor.x + this.actor.width < this.edges.right ||
               oversized_width &&
               x >= this.edges.right - this.scaled_zone_size && x <= this.edges.right;
    }

    //destroy() {
    //    this._signals.disconnectAllSignals();
    //}
}
