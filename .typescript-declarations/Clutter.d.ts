declare namespace imports.gi.Clutter {
	export class GridLayout {
		constructor(options: any);
		set_column_homogeneous(homogeneous: boolean): void;
		set_row_homogeneous(homogeneous: boolean): void;
		set_column_spacing(spacing: number): void;
		set_row_spacing(spacing: number): void;
		attach(widget: imports.gi.St.Widget, col: number, row: number, colspan: number, rowspan: number): void;
	}

	export class Actor {
		add_child(child: any): void;
		add_actor(element: any): void;
		hide(): void;
		show(): void;
		get_preferred_height(for_width: number): number[];
		get_preferred_width(for_height: number): number[];
		get_width(): number;
		get_height(): number;
		set_clip_to_allocation(clip_set: boolean): void;
		destroy_all_children(): void;
		remove_all_children(): void;
		height: number;
		width: number;
		set_width(width: number): void;
		set_height(height: number): void;
		remove_clip(): void;
		set_size(width: number, height: number): void;
		opacity: number;
		allocation: Clutter.ActorBox;
		//clip_to_allocation: boolean;
		set_x_align(x_align: ActorAlign): void;
		set_y_align(y_align: ActorAlign): void;
		set_x_expand(expand: boolean): void;
		set_y_expand(expand: boolean): void;
	}

	export class ActorBox {
		get_width(): number;
		get_height(): number;
		/** In pixels */
		get_area(): number;
		/** x and y */
		get_origin(): number[];
	}

	export class Text extends Actor {
		set_line_wrap(line_wrap: boolean): void;
		set_ellipsize(mode: gi.Pango.EllipsizeMode): void;
		set_line_alignment(alignment: gi.Pango.Alignment): void;
		set_line_wrap_mode(wrap_mode: gi.Pango.WrapMode): void;
		get_layout(): gi.Pango.Layout;
	}

	export enum ActorAlign {
		CENTER,
		END,
		FILL,
		START
	}

	export enum Orientation {
		HORIZONTAL,
		VERTICAL
	}

	export enum EventType {
		NOTHING = 0,
		KEY_PRESS = 1,
		KEY_RELEASE = 2,
		MOTION = 3,
		ENTER = 4,
		LEAVE = 5,
		BUTTON_PRESS = 6,
		BUTTON_RELEASE = 7,
		SCROLL = 8,
		STAGE_STATE = 9,
		DESTROY_NOTIFY = 10,
		CLIENT_MESSAGE = 11,
		TOUCH_BEGIN = 12,
		TOUCH_UPDATE = 13,
		TOUCH_END = 14,
		TOUCH_CANCEL = 15,
		TOUCHPAD_PINCH = 16,
		TOUCHPAD_SWIPE = 17,
		PROXIMITY_IN = 18,
		PROXIMITY_OUT = 19,
		PAD_BUTTON_PRESS = 20,
		PAD_BUTTON_RELEASE = 21,
		PAD_STRIP = 22,
		PAD_RING = 23,
		DEVICE_ADDED = 24,
		DEVICE_REMOVED = 25,
		IM_COMMIT = 26,
		IM_DELETE = 27,
		IM_PREEDIT = 28,
		EVENT_LAST = 29
	}

	export enum ScrollDirection {
		DOWN,
		LEFT,
		RIGHT,
		SMOOTH,
		UP
	}

	export class Event {
		public get_button(): number;
		public get_coords(): number[];
		public type(): EventType;
	}

	export class Color {

	}

	interface Coords {
		x: number;
		y: number;
	}
}
