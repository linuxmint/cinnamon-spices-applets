const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;
const St = imports.gi.St;

const ZONE_SIZE = 10;

class PopupResizeHandler {
    constructor( actor, get_orientation, resized_callback, get_user_width, get_user_height) {
        this.actor = actor;
        this.get_orientation = get_orientation;
        this.resized_callback = resized_callback;
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

        if (event.get_button() != Clutter.BUTTON_PRIMARY)
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
        this.resized_callback(this.new_user_width, this.new_user_height);
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
        const monitor = Main.layoutManager.findMonitorForActor(this.actor);
        //let monitor = Main.layoutManager.currentMonitor;
        const ws = global.screen.get_active_workspace();
        const area = ws.get_work_area_for_monitor(monitor.index);

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
        
        if (this.actor.height > this.workAreaHeight) {
            const overHeight = this.actor.height - this.workAreaHeight;
            this.resized_callback(this.get_user_width(), this.get_user_height() - overHeight);
            return Clutter.EVENT_PROPAGATE;
        }
        if (this.actor.width > this.workAreaWidth) {
            const overWidth = this.actor.width - this.workAreaWidth;
            this.resized_callback(this.get_user_width() - overWidth, this.get_user_height());
            return Clutter.EVENT_PROPAGATE;
        }

        this.top_edge_draggable = this.in_top_resize_zone (x, y);
        this.bottom_edge_draggable = this.in_bottom_resize_zone (x, y);
        this.left_edge_draggable = this.in_left_resize_zone (x, y,);
        this.right_edge_draggable = this.in_right_resize_zone (x, y);

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
        let delta_width = 0;
        let delta_height = 0;

        const start_w = this.drag_start_size.width;
        const start_h = this.drag_start_size.height;

        if (this.left_edge_draggable) {
            const x_diff = this.drag_start_position.x - stageX;
            const new_width = (start_w + x_diff).clamp(0, this.workAreaWidth);
            delta_width = new_width - start_w;
        } else if (this.right_edge_draggable) {
            const x_diff = stageX - this.drag_start_position.x;
            const new_width = (start_w + x_diff).clamp(0, this.workAreaWidth);
            delta_width = new_width - start_w;
        }

        if (this.top_edge_draggable) {
            const y_diff = this.drag_start_position.y - stageY;
            const new_height = (start_h + y_diff).clamp(0, this.workAreaHeight);
            delta_height = new_height - start_h;
        } else if (this.bottom_edge_draggable) {
            const y_diff = stageY - this.drag_start_position.y;
            const new_height = (start_h + y_diff).clamp(0, this.workAreaHeight);
            delta_height = new_height - start_h;
        }

        this.new_user_width = this.init_user_width + delta_width;
        this.new_user_height = this.init_user_height + delta_height;
        this.resized_callback(this.new_user_width, this.new_user_height);
        
        return true;
    }

    _leave_event(box, event) {
        if (!this.resizingInProgress) {
            global.unset_cursor();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    in_top_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this.get_orientation() === St.Side.TOP) {
            return false;
        }

        return y <= this.actor.y + this.scaled_zone_size && y >= this.actor.y &&
               this.actor.y >= this.edges.top;
    }

    in_bottom_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this.get_orientation() === St.Side.BOTTOM) {
            return false;
        }

        return y >= this.actor.y + this.actor.height - this.scaled_zone_size &&
               y <= this.actor.y + this.actor.height && this.actor.y + this.actor.height <= this.edges.bottom;
    }

    in_left_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this.get_orientation() === St.Side.LEFT) {
            return false;
        }

        return x <= this.actor.x + this.scaled_zone_size &&
               x >= this.actor.x && this.actor.x >= this.edges.left;
    }

    in_right_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this.get_orientation() === St.Side.RIGHT) {
            return false;
        }

        return x >= this.actor.x + this.actor.width - this.scaled_zone_size &&
               x <= this.actor.x + this.actor.width && this.actor.x + this.actor.width <= this.edges.right;
    }

    //destroy() {
    //    this._signals.disconnectAllSignals();
    //}
}
