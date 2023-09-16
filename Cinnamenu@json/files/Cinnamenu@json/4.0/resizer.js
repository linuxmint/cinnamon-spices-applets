const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;
const St = imports.gi.St;

const ZONE_SIZE = 10;

class PopupResizeHandler {
    constructor(actor, get_orientation, resized_callback, get_user_width, get_user_height) {
        this.actor = actor;
        this._get_orientation = get_orientation;
        this._resized_callback = resized_callback;
        this._get_user_width = get_user_width;
        this._get_user_height = get_user_height;

        this._signals = new SignalManager.SignalManager(null);

        this._signals.connect(this.actor, 'motion-event', (...args) => this._motion_event(...args));
        this._signals.connect(this.actor, 'leave-event', (...args) => this._leave_event(...args));
        this._signals.connect(this.actor, 'button-press-event', (...args) => this._onButtonPress(...args));

        this._no_edges_draggable = true;
        this.inhibit_resizing = false;

        this._drag_start_position = null;
        this._drag_start_size = null;
        this._scaled_zone_size = null;

        this._edges = { top:    0,
                       bottom: 0,
                       left:   0,
                       right:  0 };

        this.resizingInProgress = false;
        this._workAreaHeight = null;
        this._workAreaWidth = null;
    }

    _onButtonPress(actor, event) {
        if (this.inhibit_resizing || this._no_edges_draggable)
            return false;

        if (event.get_button() != Clutter.BUTTON_PRIMARY)
            return false;

        //---Start drag------

        this._grabEvents(event);
        this.resizingInProgress = true;

        let [stageX, stageY] = event.get_coords();
        this._drag_start_position = {x: stageX, y: stageY};
        this._drag_start_size = {width: this.actor.width, height: this.actor.height};
        this._init_user_width = this._get_user_width();
        this._init_user_height = this._get_user_height();

        return true;
    }

    _grabEvents(event) {
        this._eventsGrabbed = true;

        this._drag_device = event.get_device();
        this._drag_device.grab(this.actor);

        this._onEventId = this.actor.connect('event', (...args) => this._onEvent(...args));
    }

    _ungrabEvents(event) {
        if (!this._eventsGrabbed)
            return;

        if (this._drag_device) {
            this._drag_device.ungrab();
            this._drag_device = null;
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

        //this.actor.queue_relayout();

        this._drag_start_position = null;
        this._drag_start_size = null;
        this.resizingInProgress = false;
        
        //update position again while this.resizingInProgress === false so that applet can update settings
        this._resized_callback(this._new_user_width, this._new_user_height);
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
        } else if (event.type() == Clutter.EventType.KEY_RELEASE && this.resizingInProgress) {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._stop_drag();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_STOP;
        }
        return false;
    }

    _collect_work_area_edges() {
        const monitor = Main.layoutManager.findMonitorForActor(this.actor);
        const ws = global.screen.get_active_workspace();
        const area = ws.get_work_area_for_monitor(monitor.index);

        this._edges.top = area.y;
        this._edges.bottom = area.y + area.height;
        this._edges.left = area.x;
        this._edges.right = area.x + area.width;

        this._workAreaHeight = area.height;
        this._workAreaWidth = area.width;
    }

    _motion_event(box, event) {
        if (this.inhibit_resizing) {
            return Clutter.EVENT_PROPAGATE;
        }
        this._collect_work_area_edges();
        this._scaled_zone_size = ZONE_SIZE * global.ui_scale;

        let cursor = 0;

        let [x, y] = event.get_coords();
        
        //Immediately resize actor if greater than work area. This can happen after a
        //change of resolution or monitor scaling.
        if (this.actor.height > this._workAreaHeight) {
            const overHeight = this.actor.height - this._workAreaHeight;
            this._resized_callback(this._get_user_width(), this._get_user_height() - overHeight);
            return Clutter.EVENT_PROPAGATE;
        }
        if (this.actor.width > this._workAreaWidth) {
            const overWidth = this.actor.width - this._workAreaWidth;
            this._resized_callback(this._get_user_width() - overWidth, this._get_user_height());
            return Clutter.EVENT_PROPAGATE;
        }

        this._top_edge_draggable = this._in_top_resize_zone (x, y);
        this._bottom_edge_draggable = this._in_bottom_resize_zone (x, y);
        this._left_edge_draggable = this._in_left_resize_zone (x, y,);
        this._right_edge_draggable = this._in_right_resize_zone (x, y);

        this._no_edges_draggable = false;
        if (this._top_edge_draggable && this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_LEFT;
        } else if (this._top_edge_draggable && this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_RIGHT;
        } else if (this._bottom_edge_draggable && this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_LEFT;
        } else if (this._bottom_edge_draggable && this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_RIGHT;
        } else if (this._top_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP;
        } else if (this._bottom_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM;
        } else if (this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_LEFT;
        } else if (this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_RIGHT;
        } else {
            global.unset_cursor();
            this._no_edges_draggable = true;
            return Clutter.EVENT_PROPAGATE;
        }

        global.set_cursor (cursor);
        return Clutter.EVENT_PROPAGATE;
    }

    _updateDragPosition(event) {
        let [stageX, stageY] = event.get_coords();
        let delta_width = 0;
        let delta_height = 0;

        const start_w = this._drag_start_size.width;
        const start_h = this._drag_start_size.height;

        if (this._left_edge_draggable) {
            const x_diff = this._drag_start_position.x - stageX;
            const new_width = (start_w + x_diff).clamp(0, this._workAreaWidth);
            delta_width = new_width - start_w;
        } else if (this._right_edge_draggable) {
            const x_diff = stageX - this._drag_start_position.x;
            const new_width = (start_w + x_diff).clamp(0, this._workAreaWidth);
            delta_width = new_width - start_w;
        }

        if (this._top_edge_draggable) {
            const y_diff = this._drag_start_position.y - stageY;
            const new_height = (start_h + y_diff).clamp(0, this._workAreaHeight);
            delta_height = new_height - start_h;
        } else if (this._bottom_edge_draggable) {
            const y_diff = stageY - this._drag_start_position.y;
            const new_height = (start_h + y_diff).clamp(0, this._workAreaHeight);
            delta_height = new_height - start_h;
        }

        this._new_user_width = this._init_user_width + delta_width;
        this._new_user_height = this._init_user_height + delta_height;
        this._resized_callback(this._new_user_width, this._new_user_height);
        
        return true;
    }

    _leave_event(box, event) {
        if (!this.resizingInProgress) {
            global.unset_cursor();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _in_top_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this._get_orientation() === St.Side.TOP) {
            return false;
        }

        return y <= this.actor.y + this._scaled_zone_size && y >= this.actor.y &&
               this.actor.y >= this._edges.top;
    }

    _in_bottom_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this._get_orientation() === St.Side.BOTTOM) {
            return false;
        }

        return y >= this.actor.y + this.actor.height - this._scaled_zone_size &&
               y <= this.actor.y + this.actor.height && this.actor.y + this.actor.height <= this._edges.bottom;
    }

    _in_left_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this._get_orientation() === St.Side.LEFT) {
            return false;
        }

        return x <= this.actor.x + this._scaled_zone_size &&
               x >= this.actor.x && this.actor.x >= this._edges.left;
    }

    _in_right_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this._get_orientation() === St.Side.RIGHT) {
            return false;
        }

        return x >= this.actor.x + this.actor.width - this._scaled_zone_size &&
               x <= this.actor.x + this.actor.width && this.actor.x + this.actor.width <= this._edges.right;
    }
}
