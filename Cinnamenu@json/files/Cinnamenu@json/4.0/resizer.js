const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;
const System = imports.system;

const ZONE_SIZE = 10;

const NOT_DRAGGABLE = 0;
const LEFT_EDGE_DRAGGABLE = 1 << 0;
const RIGHT_EDGE_DRAGGABLE = 1 << 1;
const TOP_EDGE_DRAGGABLE = 1 << 2;
const BOTTOM_EDGE_DRAGGABLE = 1 << 3;

var PopupResizeHandler = class PopupResizeHandler {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(applet, actor, wmin, wmax, hmin, hmax, resized_callback, get_user_width, get_user_height) {
        this.applet = applet;
        this.actor = actor;
        this.wmin = wmin * global.ui_scale;
        this.wmax = wmax * global.ui_scale;
        this.hmin = hmin * global.ui_scale;
        this.hmax = hmax * global.ui_scale;
        this.callback = resized_callback;
        this.get_user_width = get_user_width;
        this.get_user_height = get_user_height;

        // TODO: automatically handle storing the user size, maybe having it become part of the enabled-applets
        // gsettings entries?

        this._draggable = DND.makeDraggable(this.actor);

        //this._grab_actor = new Clutter.Rectangle({ width: 1, height: 1, opacity: 0 });
        //global.stage.add_actor(this._grab_actor);
        //this._grab_actor.hide();
        this._draggable.inhibit = true;
        this.inhibit_resizing = false;

        this._signals = new SignalManager.SignalManager(null);

        this._signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._drag_begin));
        this._signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._drag_cancel));
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._drag_end));

        this._signals.connect(this.actor, "motion-event", Lang.bind(this, this._motion_event));
        this._signals.connect(this.actor, "leave-event", Lang.bind(this, this._leave_event));

        this._current_resize_direction = NOT_DRAGGABLE;

        this.drag_start_pos = null;
        this.drag_start_size = null;
        this.scaled_zone_size = ZONE_SIZE * global.ui_scale;

        this.edges = { top:    0,
                       bottom: 0,
                       left:   0,
                       right:  0 };

        this.poll_timer_id = 0;
        this.active = false;
    }

    _drag_begin(time) {
        this.scaled_zone_size = ZONE_SIZE * global.ui_scale;
        this._collect_work_area_edges();

        this.start_drag();
    }

    _drag_cancel(time) {
        this.stop_drag();
    }

    _drag_end(time) {
        this.stop_drag();
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

        // log(`top: ${this.edges.top}, bottom: ${this.edges.bottom} left: ${this.edges.left} right: ${this.edges.right}`);
    }

    _motion_event(box, event) {
        if (this.poll_timer_id > 0) {
            return Clutter.EVENT_STOP;
        }
        if (this.inhibit_resizing) {
            return Clutter.EVENT_PROPAGATE;
        }
        this._collect_work_area_edges();

        let l, r, t, b = false;
        let cursor = 0;

        let [x, y] = event.get_coords();
        // log(`motion! ${x}, ${y} ---- actor: ${this.actor.x}, ${this.actor.y}, ${this.actor.width}x${this.actor.height}`);

        const oversized_height = this.actor.height >= this.workAreaHeight;
        const oversized_width = this.actor.width >= this.workAreaWidth;

        if (this.in_top_resize_zone (x, y, oversized_height)) {
            t = true;
            this._current_resize_direction |= TOP_EDGE_DRAGGABLE;
        } else
        if (this.in_bottom_resize_zone (x, y, oversized_height)) {
            b = true;
            this._current_resize_direction |= BOTTOM_EDGE_DRAGGABLE;
        }
        if (this.in_left_resize_zone (x, y, oversized_width)) {
            l = true;
            this._current_resize_direction |= LEFT_EDGE_DRAGGABLE;
        } else
        if (this.in_right_resize_zone (x, y, oversized_width)) {
            r = true;
            this._current_resize_direction |= RIGHT_EDGE_DRAGGABLE;
        }

        if (!(t || b || l || r)) {
            this._current_resize_direction = NOT_DRAGGABLE;
            this._draggable.inhibit = true;
            global.unset_cursor();
            return Clutter.EVENT_PROPAGATE;
        }

        this._draggable.inhibit = false;

        if (t && l) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_LEFT;
        } else if (t && r) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_RIGHT;
        } else if (b && l) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_LEFT;
        } else if (b && r) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_RIGHT;
        } else if (t) {
            cursor = Cinnamon.Cursor.RESIZE_TOP;
        } else if (b) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM;
        } else if (l) {
            cursor = Cinnamon.Cursor.RESIZE_LEFT;
        } else if (r) {
            cursor = Cinnamon.Cursor.RESIZE_RIGHT;
        }

        global.set_cursor (cursor);

        return Clutter.EVENT_PROPAGATE;
    }

    _poll_timeout() {
        let mouse = Clutter.DeviceManager.get_default().get_core_device(Clutter.InputDeviceType.POINTER_DEVICE);

        let [s, p] = mouse.get_coords(null);
        let x = p.x;
        let y = p.y;
        let delta_width = 0;
        let delta_height = 0;

        // this.hmin = this.actor.get_preferred_height(-1)[0];
        if (this._current_resize_direction & LEFT_EDGE_DRAGGABLE) {
            let start_x = this.drag_start_position.x;
            let start_w = this.drag_start_size.width;

            let diff = start_x - x;
            const new_width = (start_w + diff).clamp(this.wmin, this.wmax);
            delta_width = new_width - start_w;
        }
        else
        if (this._current_resize_direction & RIGHT_EDGE_DRAGGABLE) {
            let start_x = this.drag_start_position.x;
            let start_w = this.drag_start_size.width;

            let diff = x - start_x;
            const new_width = (start_w + diff).clamp(this.wmin, this.wmax);
            delta_width = new_width - start_w;
        }

        if (this._current_resize_direction & TOP_EDGE_DRAGGABLE) {
            let start_y = this.drag_start_position.y;
            let start_h = this.drag_start_size.height;

            let diff = start_y - y;
            const new_height = (start_h + diff).clamp(this.hmin, this.hmax);
            delta_height = new_height - start_h;
        }
        else
        if (this._current_resize_direction & BOTTOM_EDGE_DRAGGABLE) {
            let start_y = this.drag_start_position.y;
            let start_h= this.drag_start_size.height;

            let diff = y - start_y;
            const new_height = (start_h + diff).clamp(this.hmin, this.hmax);
            delta_height = new_height - start_h;
        }

        const new_user_width = this.init_user_width + delta_width;
        const new_user_height = this.init_user_height + delta_height;
        this.callback(new_user_width, new_user_height);

        //cinnamon sometimes crashes when the time_out occurs while cjs is in garbage collection.
        //To reduce the chance of this, 1ms is used so that gc occurs while
        //cinnamenu's code is being run. And a maximum drag time of 20seconds is because the
        //crashes almost always happens 25+ seconds after drag start.
        if (Date.now() < this.dragStartTime + 20000) {
            this.poll_timer_id = Mainloop.timeout_add(1, Lang.bind(this, this._poll_timeout));
        } else {
            this.poll_timer_id = 0;
            this.stop_drag();
        }
        return GLib.SOURCE_REMOVE;
    }

    _leave_event(box, event) {
        if (this.poll_timer_id == 0) {
            global.unset_cursor();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    start_drag() {
        this.active = true;

        let mouse = Clutter.DeviceManager.get_default().get_core_device(Clutter.InputDeviceType.POINTER_DEVICE);
        let [s, p] = mouse.get_coords(null);

        this.drag_start_position = {x: p.x, y: p.y};
        this.drag_start_size = {width: this.actor.width, height: this.actor.height};
        this.init_user_width = this.get_user_width();
        this.init_user_height = this.get_user_height();
        this.dragStartTime = Date.now();

        this.poll_timer_id = Mainloop.timeout_add(5, Lang.bind(this, this._poll_timeout));
    }

    stop_drag() {
        if (this.poll_timer_id > 0) {
            Mainloop.source_remove(this.poll_timer_id);
            this.poll_timer_id = 0;
        }
        if (!this.active) {
            return;
        }
        //this.callback(this.actor.width, this.actor.height, new_user_width, new_user_height);
        this.actor.queue_relayout();

        this.drag_start_position = null;
        this.drag_start_size = null;
        this.active = false;
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
};
