

declare namespace imports.gi.Meta {
	export class Rectangle {}

	export type WindowSignals = "focus" | "position-changed" | "raised" | "shown" | "size-changed" | "unmanaged" | "unmanaging" | "workspace-changed";
	export class Window extends GObject.Object {
		public readonly above: boolean;
		//public readonly appears_focused: boolean;
		public readonly decorated: boolean;
		public readonly demands_attention: boolean;
		public readonly fullscreen: boolean;
		public readonly gtk_app_menu_object_path: string;
		public readonly gtk_application_id: string;
		public readonly gtk_application_object_path: string;
		public readonly gtk_menubar_object_path: string;
		public readonly gtk_unique_bus_name: string;
		public readonly gtk_window_object_path: string;
		public readonly icon: void;
		public readonly maximized_horizontally: boolean;
		public readonly maximized_vertically: boolean;
		public readonly mini_icon: void;
		public readonly minimized: boolean;
		public readonly mutter_hints: string;
		public readonly on_all_workspaces: boolean;
		public readonly resizeable: boolean;
		public readonly skip_taskbar: boolean;
		public readonly title: string;
		public readonly urgent: boolean;
		public readonly user_time: number;
		public readonly window_type: WindowType;
		public readonly wm_class: string;


		public activate(current_time: number) : void;
		public activate_with_workspace(current_time: number, workspace: Workspace): void;
		public allows_move(): boolean;
		public allows_resize(): boolean;
		/**
		 * Determines if the window should be drawn with a focused appearance. This is
		true for focused windows but also true for windows with a focused modal
		dialog attached.
		 * @returns true if the window should be drawn with a focused frame
		 */
		public appears_focused(): boolean;
		public begin_grab_op(op: GrabOp, frame_action: boolean, timestamp: number): void;
		public can_close(): boolean;
		public can_maximize(): boolean;
		public can_minimize(): boolean;
		public can_shade(): boolean;
		public change_workspace(workspace: Workspace): void;
		public change_workspace_by_index(space_index: number, append: boolean): void;
		public check_alive(timestamp: number): void;
		/**
		 * Converts a desired bounds of the client window into the corresponding bounds
		of the window frame (excluding invisible borders and client side shadows.)
		 * @param client_rect client rectangle in root coordinates
		 * @returns location to store the computed corresponding frame bounds.
		 */
		public client_rect_to_frame_rect(client_rect: Rectangle): Rectangle;
		public compute_group(): void;
		public delete(timestamp: number): void;
		/**
		 * Follow the chain of parents of this, skipping transient windows,
			and return the "root" window which has no non-transient parent.
		 * @returns The root ancestor window
		 */
		public find_root_ancestor(): Window;
		public focus(timestamp: number): void;
		/**
		 * If this is transient, call func with the window for which it's transient,
			repeatedly until either we find a non-transient window, or func returns false.
		 * @param func  Called for each window which is a transient parent of this
		 */
		public foreach_ancestor(func: WindowForeachFunc): void;
		/**
		 * Call func for every window which is either transient for this, or is
			a transient of a window which is in turn transient for this.
			The order of window enumeration is not defined.

			Iteration will stop if func at any point returns false.
		 * @param func Called for each window which is a transient of this (transitively)
		 */
		public foreach_transient(func: WindowForeachFunc): void;
		/**
		 * Converts a desired frame bounds for a window into the bounds of the client
			window.
		 * @param frame_rect desired frame bounds for the window
		 * @returns  location to store the computed corresponding client rectangle.
		 */
		public frame_rect_to_client_rect(frame_rect: Rectangle): Rectangle;
		/**
		 * Gets the rectangle that the pixmap or buffer of this occupies.

		For X11 windows, this is the server-side geometry of the toplevel
		window.

		For Wayland windows, this is the bounding rectangle of the attached
		buffer.
		 * @returns pointer to an allocated Meta.Rectangle
		 */
		public get_buffer_rect(): Rectangle;
		/**
		 * Returns name of the client machine from which this windows was created,
		if known (obtained from the WM_CLIENT_MACHINE property).
		 * @returns the machine name, or NULL; the string is
			owned by the window manager and should not be freed or modified by the
			caller.
		 */
		public get_client_machine(): string;
		/**
		 * Returns the Meta.WindowClientType of the window.
		 * @returns The root ancestor window
		 */
		public get_client_type(): WindowClientType;
		/**
		 * Gets the compositor's wrapper object for this
		 * @returns the wrapper object.
		 */
		public get_compositor_private(): GObject.Object;
		public get_description(): string;
		public get_display(): Display;
		/**
		 * Gets a region representing the outer bounds of the window's frame.
		 * @returns a #cairo_region_t
		holding the outer bounds of the window, or null if the window
		doesn't have a frame.
		 */
		public get_frame_bounds(): cairo.Region;
		/**
		 * Gets the rectangle that bounds this that is what the user thinks of
		as the edge of the window. This doesn't include any extra reactive
		area that we or the client adds to the window, or any area that the
		client adds to draw a client-side shadow.
		 * @returns pointer to an allocated Meta.Rectangle
		 */
		public get_frame_rect(): Rectangle;
		/**
		 * Gets the type of window decorations that should be used for this window.
		 * @returns the frame type
		 */
		public get_frame_type(): FrameType;
		/**
		 * @returns the object path
		 */
		public get_gtk_app_menu_object_path(): string;
		/**
		 * @returns the application ID
		 */
		public get_gtk_application_id(): string;
		/**
		 * @returns the object path
		 */
		public get_gtk_application_object_path(): string;
		/**
		 * @returns the object path
		 */
		public get_gtk_menubar_object_path(): string;
		/**
		 * @returns the theme variant of `null`
		 */
		public get_gtk_theme_variant(): string;
		/**
		 * @returns the unique name
		 */
		public get_gtk_unique_bus_name(): string;
		/**
		 * @returns the object path
		 */
		public get_gtk_window_object_path(): string;
		/**
		 * Gets the location of the icon corresponding to the window. The location
		will be provided set by the task bar or other user interface element
		displaying the icon, and is relative to the root window.
		 * @returns
		 * - ok (boolean) - true if the icon geometry was successfully retrieved.
		 * - rect (Rectangle) - rectangle into which to store the returned geometry.
		 */
		public get_icon_geometry(): any[];
		/**
		 * Returns the window id associated with window.
		 * @returns the window id
		 */
		public get_id(): number;
		public get_layer(): StackLayer;
		/**
		 * Gets the current maximization state of the window, as combination
		of the Meta.MaximizeFlags.HORIZONTAL and Meta.MaximizeFlags.VERTICAL flags;
		 * @returns current maximization state
		 */
		public get_maximized(): MaximizeFlags;
		/**
		 * Gets index of the monitor that this window is on.
		 * @returns  The index of the monitor in the screens monitor list, or -1
		if the window has been recently unmanaged and does not have a monitor.
		 */
		public get_monitor(): number;
		/**
		 * Gets the current value of the _MUTTER_HINTS property.

		The purpose of the hints is to allow fine-tuning of the Window Manager and
		Compositor behaviour on per-window basis, and is intended primarily for
		hints that are plugin-specific.

		The property is a list of colon-separated key=value pairs. The key names for
		any plugin-specific hints must be suitably namespaced to allow for shared
		use; 'mutter-' key prefix is reserved for internal use, and must not be used
		by plugins.
		 * @returns the _MUTTER_HINTS string, or null if no hints
		are set.	
		 */
		public get_mutter_hints(): string;
		/**
		 * Returns the pid of the process that created this window, if available
		to the windowing system.

		Note that the value returned by this is vulnerable to spoofing attacks
		by the client.
		 * @returns the pid, or 0 if not known.
		 */
		public get_pid(): number;
		public get_role(): string;
		/**
		 * Gets an unique id for a sandboxed app (currently flatpaks and snaps are
		supported).
		 * @returns the sandboxed application ID or null
		 */
		public get_sandboxed_app_id(): string;
		/**
		 * The stable sequence number is a monotonicially increasing
		unique integer assigned to each Meta.Window upon creation.

		This number can be useful for sorting windows in a stable
		fashion.
		 * @returns Internal sequence number for this window
		 */
		public get_stable_sequence(): number;
		public get_startup_id(): string;
		/**
		 * Returns the matching tiled window on the same monitor as this. This is
			the topmost tiled window in a complementary tile mode that is:

		- on the same monitor;
    	- on the same workspace;
    	- spanning the remaining monitor width;
    	- there is no 3rd window stacked between both tiled windows that's
    		partially visible in the common edge.

		 * @returns the matching tiled window or
			null if it doesn't exist.
		 */
		public get_tile_match(): Window;
		/**
		 * @returns the current tile of the window
		 */
		public get_tile(): string;
		/**
		 * Returns the Meta.Window for the window that is pointed to by the
		WM_TRANSIENT_FOR hint on this window (see XGetTransientForHint()
		or XSetTransientForHint()). Metacity keeps transient windows above their
		parents. A typical usage of this hint is for a dialog that wants to stay
		above its associated window.
		 * @returns the window this window is transient for, or
		null if the WM_TRANSIENT_FOR hint is unset or does not point to a toplevel
		window that Metacity knows about.
		 */
		public get_transient_for(): Window;
		/**
		 * The user time represents a timestamp for the last time the user
		interacted with this window. Note this property is only available
		for non-override-redirect windows.

		The property is set by Mutter initially upon window creation,
		and updated thereafter on input events (key and button presses) seen by Mutter,
		client updates to the _NET_WM_USER_TIME property (if later than the current time)
		and when focusing the window.
		 * @returns The last time the user interacted with this window.
		 */
		public get_user_time(): number;
		public get_window_type(): WindowType;
		/**
		 * Return the current value of the instance part of WM_CLASS X property.
		 */
		public get_wm_class_instance(): string;
		/**
		 * Get the work area for the monitor this is currently on.
		 * @returns  a location to store the work area
		 */
		public get_work_area_all_monitors(): Rectangle;
		/**
		 * Get the work area for this, given the monitor index
		which_monitor.
		 * @param which_monitor a monitor to get the work area for
		 * @returns a location to store the work area
		 */
		public get_work_area_for_monitor(which_monitor: number): Rectangle;
		/**
		 * Gets the Meta.Workspace that the window is currently displayed on.
		If the window is on all workspaces, returns the currently active
		workspace.
		 * @returns the Meta.Workspace for the window
		 */
		public get_workspace(): Workspace;
		public group_leader_changed(): void;
		public has_focus(): boolean;
		public is_above(): boolean;
		public is_always_on_all_workspaces(): boolean;
		/**
		 * The function determines whether this is an ancestor of transient; it does
		so by traversing the transient's ancestors until it either locates this
		or reaches an ancestor that is not transient.
		 * @param transient a Meta.Window
		 * @returns true if window is an ancestor of transient
		 */
		public is_ancestor_of_transient(transient: Window): boolean;
		/**
		 * Tests if this is should be attached to its parent window.
		(If the "attach_modal_dialogs" option is not enabled, this will
		always return false.)
		 * @returns whether this should be attached to its parent
		 */
		public is_attached_dialog(): boolean;
		/**
		 * Check if if the window has decorations drawn by the client.
		(window->decorated refers only to whether we should add decorations)
		 */
		public is_client_decorated(): boolean;
		public is_fullscreen(): boolean;
		public is_hidden(): boolean;
		/**
		 * @returns true if the window is occupies an entire monitor or
		the whole screen.
		 */
		public is_monitor_sized(): boolean;
		public is_on_all_workspaces(): boolean;
		public is_on_primary_monitor(): boolean;
		/**
		 * @returns true if this window isn't managed by mutter; it will
		control its own positioning and mutter won't draw decorations
		among other things. In X terminology this is "override redirect".
		 */
		public is_override_redirect(): boolean;
		/**
		 * @returns true if this window originates from a host
			different from the one running mutter.
		 */
		public is_remote(): boolean;
		/**
		 * @returns  true if the window is occupies the
		the whole screen (all monitors).
		 */
		public is_screen_sized(): boolean;
		public is_shaded(): boolean;
		/**
		 * Gets whether this window should be ignored by task lists.
		 * @returns true if the skip bar hint is set.
		 */
		public is_skip_taskbar(): boolean;
		public kill(): void;
		/**
		 * 
		 * @param workspace a Meta.Workspace
		 * @returns whether this is displayed on workspace, or whether it
		will be displayed on all workspaces.
		 */
		public located_on_workspace(workspace: Workspace): boolean;
		public lower(): void;
		public make_above(): void;
		public make_fullscreen(): void;
		public maximize(directions: MaximizeFlags): void;
		public minimize(): void;
		/**
		 * Moves the window to the desired location on window's assigned
		workspace, using the northwest edge of the frame as the reference,
		instead of the actual window's origin, but only if a frame is present.
		Otherwise, acts identically to meta_window_move().
		 * @param user_op bool to indicate whether or not this is a user operations
		 * @param root_x_nw desired x pos
		 * @param root_y_nw desired y pos
		 */
		public move_frame(user_op: boolean, root_x_nw: number, root_y_nw: number): void;
		/**
		 * Resizes the window so that its outer bounds (including frame)
		fit within the given rect
		 * @param user_op bool to indicate whether or not this is a user operation
		 * @param root_x_nw new x
		 * @param root_y_nw new y
		 * @param w desired width
		 * @param h desired hight
		 */
		public move_resize_frame(user_op: boolean, root_x_nw: number, root_y_nw: number, w: number, h: number): void;
		/**
		 * Moves the window to the monitor with index monitor, keeping
		the relative position of the window's top left corner.
		 * @param monitor desired monitor index
		 */
		public move_to_monitor(monitor: number): void;
		public raise(): void;
		public set_compositor_private(priv: GObject.Object): void;
		public set_demands_attention(): void;
		/**
		* Sets or unsets the location of the icon corresponding to the window. If
		set, the location should correspond to a dock, task bar or other user
		interface element displaying the icon, and is relative to the root window.
		 * @param rect  rectangle with the desired geometry or null.
		 */
		public set_icon_geometry(rect: Rectangle): void;
		public shade(timestamp: number): void;
		public shove_titlebar_onscreen(): void;
		/**
		 * @returns true if window would be visible, if its workspace was current
		 */
		public shoving_on_its_workspace(): boolean;
		public shutdown_group(): void;
		public stick(): void;
		public titlebar_is_onscreen(): boolean;
		public unmake_above(): void;
		public unmake_fullscreen(): void;
		public unmaximize(directions: MaximizeFlags): void;
		public unminimize(): void;
		public unset_demands_attention(): void;
		public unshade(timestamp: number): void;
		public unstick(): void;
	}


	export class Workspace {}
	export class Screen {}
	export class Display {}
	export class StackLayer {}
	export interface ModalOptions {

	}

	export enum GrabOp {
		NONE = 0,
		WINDOW_BASE = 1,
		COMPOSITOR = 2,
		WAYLAND_POPUP = 3,
		FRAME_BUTTON = 4,
		MOVING = 1,
		RESIZING_NW = 36865,
		RESIZING_N = 32769,
		RESIZING_NE = 40961,
		RESIZING_E = 8193,
		RESIZING_SW = 20481,
		RESIZING_S = 16385,
		RESIZING_SE = 24577,
		RESIZING_W = 4097,
		KEYBOARD_MOVING = 257,
		KEYBOARD_RESIZING_UNKNOWN = 769,
		KEYBOARD_RESIZING_NW = 37121,
		KEYBOARD_RESIZING_N = 33025,
		KEYBOARD_RESIZING_NE = 41217,
		KEYBOARD_RESIZING_E = 8449,
		KEYBOARD_RESIZING_SW = 20737,
		KEYBOARD_RESIZING_S = 16641,
		KEYBOARD_RESIZING_SE = 24833,
		KEYBOARD_RESIZING_W = 4353
	}

	export enum WindowType {
		NORMAL = 0,
		DESKTOP = 1,
		DOCK = 2,
		DIALOG = 3,
		MODAL_DIALOG = 4,
		TOOLBAR = 5,
		MENU = 6,
		UTILITY = 7,
		SPLASHSCREEN = 8,
		DROPDOWN_MENU = 9,
		POPUP_MENU = 10,
		TOOLTIP = 11,
		NOTIFICATION = 12,
		COMBO = 13,
		DND = 14,
		OVERRIDE_OTHER = 15
	}

	export enum WindowClientType {
		WAYLAND = 0,
		X11 = 1
	}

	export enum FrameType {
		/** Normal Frame */
		NORMAL = 0,
		/** Dialog Frame */
		DIALOG = 1,
		/** Modal dialog frame */
		MODAL_DIALOG = 2,
		/** Utility frame */
		UTILITY = 3,
		/** Menu Frame */
		MENU = 4,
		/** border Frame */
		BORDER = 5,
		/** Attached frame */
		ATTACHED = 6,
		/** Marks the end of the Meta.FrameType enumerations */
		LAST = 7
	}

	export enum MaximizeFlags {
		HORIZONTAL = 1,
		VERTICAL = 2,
		BOTH = 3
	}

	export type WindowForeachFunc = () => boolean;
}