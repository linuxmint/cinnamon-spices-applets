declare namespace imports.gi.Meta {

	export class Backend {

	}

	export class Background {

	}

	export class BackgroundActor {

	}

	export class BackgroundGroup {

	}
	export class BackgroundImage {

	}
	export class BackgroundImageCache {

	}
	export class Barrier {

	}
	export class ButtonLayout {

	}
	export class CloseDialog {

	}
	export class CursorTracker {

	}
	export class Display extends GObject.Object {
		public readonly focus_window: Window;

		/**
		 * Save the specified serial and ignore crossing events with that
		 * serial for the purpose of focus-follows-mouse. This can be used
		 * for certain changes to the window hierarchy that we don't want
		 * to change the focus window, even if they cause the pointer to
		 * end up in a new window.
		 * @param serial the serial to ignore
		 */
		public add_ignored_crossing_serial(serial: number): void;

		/**
		 * Add a keybinding at runtime. The key name in @schema needs to be of
		 * type %G_VARIANT_TYPE_STRING_ARRAY, with each string describing a
		 * keybinding in the form of "&lt;Control&gt;a" or "&lt;Shift&gt;&lt;Alt&gt;F1". The parser
		 * is fairly liberal and allows lower or upper case, and also abbreviations
		 * such as "&lt;Ctl&gt;" and "&lt;Ctrl&gt;". If the key is set to the empty list or a
		 * list with a single element of either "" or "disabled", the keybinding is
		 * disabled.
		 * 
		 * Use Meta.Display.remove_keybinding to remove the binding.
		 * @param name the binding's name
		 * @param settings the Gio.Settings object where name is stored
		 * @param flags flags to specify binding details
		 * @param handler function to run when the keybinding is invoked
		 * @returns the corresponding keybinding action if the keybinding was
		 * added successfully, otherwise Meta.KeyBindingAction.NONE
		 */
		public add_keybinding(name: string, settings: Gio.Settings, flags: KeyBindingFlags, handler: Function): number;

		public begin_grab_op(window: Window, op: GrabOp, pointer_already_grabbed: boolean, frame_action: boolean, button: number, modmask: number, timestamp: number, root_x: number, root_y: number): boolean;

		/**
		 * Sets the mouse-mode flag to false, which means that motion events are
		 * no longer ignored in mouse or sloppy focus.
		 * This is an internal function. It should be used only for reimplementing
		 * keybindings, and only in a manner compatible with core code.
		 */
		public clear_mouse_mode(): void;

		public close(timestamp: number): void;
		public end_grab_op(timestamp: number): void;
		public focus_default_window(timestamp: number): void;
		public freeze_keyboard(timestamp: number): void;

		/**
		 * Gets the index of the monitor that currently has the mouse pointer.
		 * @returns a monitor index
		 */
		public get_current_monitor(): number;
		public get_current_time(): number;
		public get_current_time_roundtrip(): number;

		/**
		 * Get our best guess as to the "currently" focused window (that is,
		 * the window that we expect will be focused at the point when the X
		 * server processes our next request).
		 * @returns The current focus window
		 */
		public get_focus_window(): Window;

		/**
		 * Gets the current grab operation, if any.
		 * @returns he current grab operation, or Meta.GrabOp.NONE if
		 * Mutter doesn't currently have a grab. Meta.GrabOp.COMPOSITOR will
		 * be returned if a compositor-plugin modal operation is in effect
		 * (See mutter_begin_modal_for_plugin())
		 */
		public get_grab_op(): GrabOp;

		/**
		 * Get the keybinding action bound to keycode. Builtin keybindings
		 * have a fixed associated Meta.KeyBindingAction, for bindings added
		 * dynamically the function will return the keybinding action
		 * Meta.Display.add_keybinding returns on registration.
		 * @param keycode Raw keycode
		 * @param mask Event mask
		 * @returns The action that should be taken for the given key, or
		 * Meta.KeyBindingAction.NONE.
		 */
		public get_keybinding_action(keycode: number, mask: number): KeyBindingAction;

		/**
		 * @returns Timestamp of the last user interaction event with a window
		 */
		public get_last_user_time(): number;

		/**
		 * Stores the location and size of the indicated monitor in @geometry.
		 * @param monitor the monitor number
		 * @returns location to store the monitor geometry
		 */
		public get_monitor_geometry(monitor: number): Rectangle;

		/**
		 * Determines whether there is a fullscreen window obscuring the specified
		 * monitor. If there is a fullscreen window, the desktop environment will
		 * typically hide any controls that might obscure the fullscreen window.
		 * 
		 * You can get notification when this changes by connecting to
		 * MetaDisplay::in-fullscreen-changed.
		 * @param monitor  the monitor number
		 * @returns true if there is a fullscreen window covering the specified monitor.
		 */
		public get_monitor_in_fullscreen(monitor: number): boolean;
		public get_monitor_index_for_rect(rect: Rectangle): number;
		public get_monitor_neighbor_index(which_monitor: number, dir: DisplayDirection): number;

		/**
		 * Gets the monitor scaling value for the given monitor.
		 * @param monitor the monitor number
		 * @returns the monitor scaling value
		 */
		public get_monitor_scale(monitor: number): number;

		/**
		 * Gets the number of monitors that are joined together to form this.
		 * @returns  the number of monitors
		 */
		public get_n_monitors(): number;
		public get_pad_action_label(pad: Clutter.InputDevice, action_type: PadActionType, action_number: number): string;

		/**
		 * Gets the index of the primary monitor on this this.
		 * @returns a monitor index
		 */
		public get_primary_monitor(): number;

		/**
		 * @returns The selection manager of the display
		 */
		public get_selection(): Selection;

		/**
		 * Retrieve the size of the display.
		 * @returns - width (Number) — The width of the screen
		- height (Number) — The height of the screen
		 */
		public get_size(): number[];

		/**
		 * @returns The sound player of the display
		 */
		public get_sound_player(): SoundPlayer;

		/**
		 * Determine the active window that should be displayed for Alt-TAB.
		 * @param type type of tab list
		 * @param workspace origin workspace
		 * @returns Current window
		 */
		public get_tab_current(type: TabList, workspace: Workspace): Window;

		/**
		 * Determine the list of windows that should be displayed for Alt-TAB
		 * functionality. The windows are returned in most recently used order.
		 * If workspace is not null, the list only contains windows that are on
		 * workspace or have the demands-attention hint set; otherwise it contains
		 * all windows.
		 * @param type type of tab list
		 * @param workspace origin workspace
		 * @returns List of windows
		 */
		public get_tab_list(type: TabList, workspace: Workspace): Window[];

		/**
		 * Determine the next window that should be displayed for Alt-TAB
		 * functionality.
		 * @param type type of tab list
		 * @param workspace origin workspace
		 * @param window  starting window
		 * @param backward If true, look for the previous window
		 * @returns Next window
		 */
		public get_tab_next(type: TabList, workspace: Workspace, window: Window, backward: boolean): Window;

		/**
		 * @returns The workspace manager of the display
		 */
		public get_workspace_manager(): WorkspaceManager;
		public grab_accelerator(accelerator: string, flags: KeyBindingFlags): number;

		/**
		 * Tells whether the event sequence is the used for pointer emulation
		 * and single-touch interaction.
		 * @param sequence a Clutter.EventSequence
		 * @returns TRUE if the sequence emulates pointer behavior
		 */
		public is_pointer_emulating_sequence(sequence: Clutter.EventSequence): boolean;

		/**
		 * Remove keybinding name; the function will fail if name is not a known
		 * keybinding or has not been added with Meta.Display.add_keybinding.
		 * @param name name of the keybinding to remove
		 * @returns true if the binding has been removed successfully,
		 * otherwise false
		 */
		public remove_keybinding(name: string): boolean;
		public request_pad_osd(pad: Clutter.InputDevice, edition_mode: boolean): void;
		public set_cursor(cursor: Cursor): void;
		public set_input_focus(window: Window, focus_frame: boolean, timestamp: number): void;

		/**
		 * Sorts a set of windows according to their current stacking order. If windows
		 * from multiple screens are present in the set of input windows, then all the
		 * windows on screen 0 are sorted below all the windows on screen 1, and so forth.
		 * Since the stacking order of override-redirect windows isn't controlled by
		 * Metacity, if override-redirect windows are in the input, the result may not
		 * correspond to the actual stacking order in the X server.
		 * 
		 * An example of using this would be to sort the list of transient dialogs for a
		 * window into their current stacking order.
		 * @param windows Set of windows
		 * @returns Input windows sorted by stacking order, from lowest to highest
		 */
		public sort_windows_by_stacking(windows: Window[]): Window[];

		/**
		 * @returns whether pointer barriers can be supported.
		 *
		 * When running as an X compositor the X server needs XInput 2
		 * version 2.3. When running as a display server it is supported
		 * when running on the native backend.
		 * 
		 * Clients should use this method to determine whether their
		 * interfaces should depend on new barrier features.
		 */
		public supports_extended_barriers(): boolean;
		public unfreeze_keyboard(timestamp: number): void;
		public ungrab_accelerator(action_id: number): void;
		public ungrab_keyboard(timestamp: number): void;
		public unset_input_focus(timestamp: number): void;

		/**
		 * Xserver time can wraparound, thus comparing two timestamps needs to take
		 * this into account. If no wraparound has occurred, this is equivalent to
		 * time1 < time2
		 * Otherwise, we need to account for the fact that wraparound can occur
		 * and the fact that a timestamp of 0 must be special-cased since it
		 * means "older than anything else".
		 * 
		 * Note that this is NOT an equivalent for time1 <= time2; if that's what
		 * you need then you'll need to swap the order of the arguments and negate
		 * the result.
		 * @param time1 An event timestamp
		 * @param time2 An event timestamp
		 */
		public xserver_time_is_before(time1: number, time2: number): boolean;
	}
	export class Dnd {

	}
	export class IdleMonitor {

	}
	export class InhibitShortcutsDialog {

	}
	export class LaunchContext {

	}
	export class MonitorManager {

	}
	export class Plugin {

	}
	export class RemoteAccessController {

	}
	export class RemoteAccessHandle {

	}

	interface ISelection {
		connect(signal: "owner-changed", callback: (object: number, p0: SelectionSource) => void): void;
	}

	type SelectionMixin = ISelection & GObject.Object;

	interface Selection extends SelectionMixin { }

	export class Selection {
		public static new(display: Display): Selection;

		/**
		 * Returns the list of supported mimetypes for the given selection type.
		 * @param selection_type Selection to query
		 * @returns  The supported mimetypes
		 */
		public get_mimetypes(selection_type: SelectionType): string[];

		/**
		 * Sets owner as the owner of the selection given by selection_type,
		 * unsets any previous owner there was.
		 * @param selection_type Selection type
		 * @param owner New selection owner
		 */
		public set_owner(selection_type: SelectionType, owner: SelectionSource): void;

		/**
		 * Requests a transfer of mimetype on the selection given by
		 * selection_type.
		 * @param selection_type Selection type
		 * @param mimetype Mimetype to transfer
		 * @param size Maximum size to transfer, -1 for unlimited
		 * @param output Output stream to write contents to
		 * @param cancellable Cancellable
		 * @param callback User callback
		 */
		public transfer_async(selection_type: SelectionType, mimetype: string, size: number, output: Gio.OutputStream, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback): void;

		/**
		 * Finishes the transfer of a queried mimetype.
		 * @param result The async result
		 * @returns true if the transfer was successful
		 * @throws Error
		 */
		public transfer_finish(result: Gio.AsyncResult): boolean;

		/**
		 * Unsets owner as the owner the selection given by selection_type. If
		 * owner does not own the selection, nothing is done.
		 * @param selection_type Selection type
		 * @param owner  Owner to unset
		 */
		public unset_owner(selection_type: SelectionType, owner: SelectionSource): void;
	}
	export class SelectionSource {

	}
	export class SelectionSourceMemory {

	}
	export class ShadowFactory {

	}
	export class ShapedTexture {

	}
	export class SoundPlayer {

	}
	export class Stage {

	}
	export class StartupNotification {

	}
	export class StartupSequence {

	}
	export class WaylandClient {

	}
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


		public activate(current_time: number): void;
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
	export class WindowActor {

	}
	export class WindowGroup {

	}
	interface IWorkspace {
		connect(signal: "window-added" | "window-removed", callback: (object: Window) => void): void;
	}

	type WorkspaceMixin = IWorkspace & GObject.Object;

	interface Workspace extends WorkspaceMixin { }

	export class Workspace {
		public readonly active: boolean;
		public readonly n_windows: number;
		public readonly workspace_index: number;

		public activate(timestamp: number): void;

		/**
		 * Switches to this and possibly activates the window focus_this.

		 * The window focus_this is activated by calling Meta.Window.activate
		 * which will unminimize it and transient parents, raise it and give it
		 * the focus.
		 * 
		 * If a window is currently being moved by the user, it will be
		 * moved to this.
		 * 
		 * The advantage of calling this function instead of Meta.Workspace.activate
		 * followed by Meta.Window.activate is that it happens as a unit, so
		 * no other window gets focused first before focus_this.
		 * @param focus_this the Meta.Window to be focused, or null
		 * @param timestamp timestamp for focus_this
		 */
		public activate_with_focus(focus_this: Window, timestamp: number): void;

		/**
		 * Gets the Meta.Display that the workspace is part of.
		 * @returns the Meta.Display for the workspace
		 */
		public get_display(): Display;

		/**
		 * Calculate and retrieve the workspace that is next to this,
		 * according to direction and the current workspace layout, as set
		 * by meta_screen_override_workspace_layout().
		 * @param direction a Meta.MotionDirection, relative to this
		 * @returns the workspace next to this, or this itself if the neighbor would be outside the layout
		 */
		public get_neighbor(direction: MotionDirection): Workspace;

		/**
		 * Stores the work area in @area.
		 * @returns location to store the work area
		 */
		public get_work_area_all_monitors(): Rectangle;

		/**
		 * Stores the work area for which_monitor on this
		 * in @area.
		 * @param which_monitor a monitor index
		 * @returns  location to store the work area
		 */
		public get_work_area_for_monitor(which_monitor: number): Rectangle;

		public index(): number;

		/**
		 * Gets windows contained on the workspace, including workspace->windows
		 * and also sticky windows. Override-redirect windows are not included.
		 * @returns the list of windows.
		 */
		public list_windows(): Window[];

		/**
		 * Sets a list of struts that will be used in addition to the struts
		 * of the windows in the workspace when computing the work area of
		 * the workspace.
		 * @param struts list of Meta.Strut
		 */
		public set_builtin_struts(struts: Strut[]): void;
	}
	export class WorkspaceManager {

	}
	export class X11Display {

	}

	// Legacy? Classes
	export class Rectangle {
		x: number;
		y: number;
		width: number;
		height: number;
	}

	export class Screen {

	}

	export class Strut {
		rect: Rectangle;
		side: Side;
	}


	// INTERFACES

	export type WindowForeachFunc = () => boolean;
	export type KeyHandlerFunc = Function;

	export interface ModalOptions {

	}

	export interface KeyBindingFlags {

	}

	export interface VirtualModifier {

	}

	// ENUMS


	export enum ButtonFunction {

	}
	export enum CloseDialogResponse {

	}
	export enum CompEffect {

	}
	export enum Cursor {

	}
	export enum DebugPaintFlag {

	}
	export enum DebugTopic {

	}
	export enum DisplayCorner {

	}
	export enum DisplayDirection {
		UP = 0,
		DOWN = 1,
		LEFT = 2,
		RIGHT = 3
	}
	export enum EdgeType {

	}
	export enum ExitCode {

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
	export enum Gravity {

	}
	export enum InhibitShortcutsDialogResponse {

	}
	export enum KeyBindingAction {
		NONE = 0,
		WORKSPACE_1 = 1,
		WORKSPACE_2 = 2,
		WORKSPACE_3 = 3,
		WORKSPACE_4 = 4,
		WORKSPACE_5 = 5,
		WORKSPACE_6 = 6,
		WORKSPACE_7 = 7,
		WORKSPACE_8 = 8,
		WORKSPACE_9 = 9,
		WORKSPACE_10 = 10,
		WORKSPACE_11 = 11,
		WORKSPACE_12 = 12,
		WORKSPACE_LEFT = 13,
		WORKSPACE_RIGHT = 14,
		WORKSPACE_UP = 15,
		WORKSPACE_DOWN = 16,
		WORKSPACE_LAST = 17,
		SWITCH_APPLICATIONS = 18,
		SWITCH_APPLICATIONS_BACKWARD,
		SWITCH_GROUP = 20,
		SWITCH_GROUP_BACKWARD,
		SWITCH_WINDOWS = 22,
		SWITCH_WINDOWS_BACKWARD = 23,
		SWITCH_PANELS = 24,
		SWITCH_PANELS_BACKWARD = 25,
		CYCLE_GROUP = 26,
		CYCLE_GROUP_BACKWARD = 27,
		CYCLE_WINDOWS = 28,
		CYCLE_WINDOWS_BACKWARD = 29,
		CYCLE_PANELS = 30,
		CYCLE_PANELS_BACKWARD = 31,
		SHOW_DESKTOP = 32,
		PANEL_MAIN_MENU = 33,
		PANEL_RUN_DIALOG = 34,
		TOGGLE_RECORDING = 35,
		SET_SPEW_MARK = 36,
		ACTIVATE_WINDOW_MENU = 37,
		TOGGLE_FULLSCREEN = 38,
		TOGGLE_MAXIMIZED = 39,
		TOGGLE_TILED_LEFT = 40,
		TOGGLE_TILED_RIGHT = 41,
		TOGGLE_ABOVE = 42,
		MAXIMIZE = 43,
		UNMAXIMIZE = 44,
		TOGGLE_SHADED = 45,
		MINIMIZE = 46,
		CLOSE = 47,
		BEGIN_MOVE = 48,
		BEGIN_RESIZE = 49,
		TOGGLE_ON_ALL_WORKSPACES = 50,
		MOVE_TO_WORKSPACE_1 = 51,
		MOVE_TO_WORKSPACE_2 = 52,
		MOVE_TO_WORKSPACE_3 = 53,
		MOVE_TO_WORKSPACE_4 = 54,
		MOVE_TO_WORKSPACE_5 = 55,
		MOVE_TO_WORKSPACE_6 = 56,
		MOVE_TO_WORKSPACE_7 = 57,
		MOVE_TO_WORKSPACE_8 = 58,
		MOVE_TO_WORKSPACE_9 = 59,
		MOVE_TO_WORKSPACE_10 = 60,
		MOVE_TO_WORKSPACE_11 = 61,
		MOVE_TO_WORKSPACE_12 = 62,
		MOVE_TO_WORKSPACE_LEFT = 63,
		MOVE_TO_WORKSPACE_RIGHT = 64,
		MOVE_TO_WORKSPACE_UP = 65,
		MOVE_TO_WORKSPACE_DOWN = 66,
		MOVE_TO_WORKSPACE_LAST = 67,
		MOVE_TO_MONITOR_LEFT = 68,
		MOVE_TO_MONITOR_RIGHT = 69,
		MOVE_TO_MONITOR_UP = 70,
		MOVE_TO_MONITOR_DOWN = 71,
		RAISE_OR_LOWER = 72,
		RAISE = 73,
		LOWER = 74,
		MAXIMIZE_VERTICALLY = 75,
		MAXIMIZE_HORIZONTALLY = 76,
		MOVE_TO_CORNER_NW = 77,
		MOVE_TO_CORNER_NE = 78,
		MOVE_TO_CORNER_SW = 79,
		MOVE_TO_CORNER_SE = 80,
		MOVE_TO_SIDE_N = 81,
		MOVE_TO_SIDE_S = 82,
		MOVE_TO_SIDE_E = 83,
		MOVE_TO_SIDE_W = 84,
		MOVE_TO_CENTER = 85,
		OVERLAY_KEY = 86,
		LOCATE_POINTER_KEY = 87,
		ISO_NEXT_GROUP = 88,
		ALWAYS_ON_TOP = 89,
		SWITCH_MONITOR = 90,
		ROTATE_MONITOR = 91,
		LAST = 92,
	}
	export enum LaterType {

	}
	export enum LocaleDirection {

	}
	export enum MaximizeFlags {
		HORIZONTAL = 1,
		VERTICAL = 2,
		BOTH = 3
	}
	export enum MonitorSwitchConfigType {

	}
	export enum MotionDirection {
		/** Upwards motion */
		UP = -1,
		/** Downwards motion */
		DOWN = -2,
		/** Motion to the left */
		LEFT = -3,
		/** Motion to the right */
		RIGHT = -4,
		/** Motion up and to the left */
		UP_LEFT = -5,
		/** Motion up and to the right */
		UP_RIGHT = -6,
		/** Motion down and to the left */
		DOWN_LEFT = -7,
		/** Motion down and to the right */
		DOWN_RIGHT = -8
	}
	export enum PadActionType {
		BUTTON = 0,
		RING = 1,
		STRIP = 2
	}
	export enum Preference {

	}
	export enum SelectionType {
		SELECTION_PRIMARY = 0,
		SELECTION_CLIPBOARD = 1,
		SELECTION_DND = 2,
		N_SELECTION_TYPES = 3
	}
	export enum ShadowMode {

	}
	export enum Side {
		LEFT = 1,
		RIGHT = 2,
		TOP = 4,
		BOTTOM = 8
	}
	export enum SizeChange {

	}
	export enum StackLayer {

	}
	export enum TabList {
		/** Normal windows */
		NORMAL = 0,
		/** Dock windows */
		DOCKS = 1,
		/** Groups */
		GROUP = 2,
		/** All windows */
		NORMAL_ALL = 3
	}
	export enum TabShowType {

	}
	export enum WindowClientType {
		WAYLAND = 0,
		X11 = 1
	}
	export enum WindowMenuType {

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

	// FUNCTIONS


	/**
	 * Tells mutter to activate the session. When mutter is a
	 * display server, this tells logind to switch over to
	 * the new session.
	 */
	export function activate_session(): boolean;
	export function add_clutter_debug_flags(debug_flags: Clutter.DebugFlag, draw_flags: Clutter.DrawDebugFlag, pick_flags: Clutter.PickDebugFlag): void;
	export function add_debug_paint_flag(flag: DebugPaintFlag): void;
	/**
	 * Ensure log messages for the given topic topic
	 * will be printed.
	 * @param topic Topic for which logging will be started
	 */
	export function add_verbose_topic(topic: DebugTopic): void;
	export function clutter_init(): void;
	/**
	 * Disables unredirection, can be useful in situations where having
	 * unredirected windows is undesirable like when recording a video.
	 * @param display a Meta.Display
	 */
	export function disable_unredirect_for_display(display: Display): void;
	/**
	 * Enables unredirection which reduces the overhead for apps like games.
	 * @param display a Meta.Display
	 */
	export function enable_unredirect_for_display(display: Display): void;
	export function exit(code: ExitCode): void;
	export function external_binding_name_for_action(keybinding_action: number): string;
	export function focus_stage_window(display: Display, timestamp: number): void;
	export function frame_type_to_string(): any;
	export function g_utf8_strndup(): any;

	/**
	 * Accessor for the singleton MetaBackend.
	 * @returns The only Meta.Backend there is.
	 */
	export function get_backend(): Backend;
	export function get_debug_paint_flags(): DebugPaintFlag;
	/**
	 * 
	 * @param display a Meta.Display
	 * @returns The feedback group corresponding to display
	 */
	export function get_feedback_group_for_display(display: Display): Clutter.Actor;
	export function get_locale_direction(): LocaleDirection;
	export function get_replace_current_wm(): boolean;
	/**
	 * 
	 * @param display a Meta.Display
	 * @returns The top window group corresponding to display
	 */
	export function get_stage_for_display(display: Display): Clutter.Actor;
	/**
	 * 
	 * @param display a  Meta.Display
	 * @returns The top window group corresponding to display
	 */
	export function get_top_window_group_for_display(display: Display): Clutter.Actor;
	/**
	 * 
	 * @param display a Meta.Display
	 * @returns The set of Meta.WindowActor on display
	 */
	export function get_window_actors(display: Display): Clutter.Actor[];
	/**
	 * 
	 * @param display a Meta.Display
	 * @returns The window group corresponding to display
	 */
	export function get_window_group_for_display(display: Display): Clutter.Actor;
	export function gravity_to_string(): any;
	export function is_debugging(): boolean;
	/**
	 * Returns true if this instance of Mutter comes from Mutter
	 * restarting itself (for example to enable/disable stereo.)
	 * See Meta.restart. If this is the case, any startup visuals
	 * or animations should be suppressed.
	 */
	export function is_restart(): boolean;
	/**
	 * Returns whether X synchronisation is currently enabled.

	 * FIXME: This is only called by meta_display_open(), but by that time
	 * we have already turned syncing on or off on startup, and we don't
	 * have any way to do so while Mutter is running, so it's rather
	 * pointless.
	 * @returns true if we must wait for events whenever we send X requests;
	 * false otherwise.
	 */
	export function is_syncing(): boolean;
	export function is_verbose(): boolean;
	export function is_wayland_compositor(): boolean;
	/**
	 * Allows users to register a custom handler for a
	 * builtin key binding.
	 * @param name The name of the keybinding to set
	 * @param handler The new handler function
	 * @returns true if the binding known as name was found,
	 * false otherwise.
	 */
	export function keybindings_set_custom_handler(name: string, handler: KeyHandlerFunc): boolean;
	/**
	 * Sets up a callback to be called at some later time. when determines the
	 * particular later occasion at which it is called. This is much like GLib,
	 * except that the functions interact properly with clutter event handling.
	 * If a "later" function is added from a clutter event handler, and is supposed
	 * to be run before the stage is redrawn, it will be run before that redraw
	 * of the stage, not the next one.
	 * @param when  enumeration value determining the phase at which to run the callback
	 * @param func callback to run later
	 * @returns an integer ID (guaranteed to be non-zero) that can be used
	 * to cancel the callback and prevent it from being run.
	 */
	export function later_add(when: LaterType, func: GLib.SourceFunc): number;
	/**
	 * Removes a callback added with Meta.later_add
	 * @param later_id the integer ID returned from Meta.later_add
	 */
	export function later_remove(later_id: number): void;
	export function pop_no_msg_prefix(): void;
	export function preference_to_string(): any;
	export function prefs_bell_is_audible(): boolean;
	export function prefs_change_workspace_name(i: number, name: string): void;
	/**
	 * @returns GDesktopEnums.TitlebarAction
	 */
	export function prefs_get_action_double_click_titlebar(): any;
	/**
	 * @returns GDesktopEnums.TitlebarAction
	 */
	export function prefs_get_action_middle_click_titlebar(): any;
	/**
	 * @returns GDesktopEnums.TitlebarAction
	 */
	export function prefs_get_action_right_click_titlebar(): any;
	export function prefs_get_attach_modal_dialogs(): boolean;
	export function prefs_get_auto_maximize(): boolean;
	export function prefs_get_auto_raise(): boolean;
	export function prefs_get_auto_raise_delay(): number;
	export function prefs_get_button_layout(): ButtonLayout;
	export function prefs_get_center_new_windows(): boolean;
	export function prefs_get_check_alive_timeout(): number;
	export function prefs_get_compositing_manager(): boolean;
	export function prefs_get_cursor_size(): number;
	export function prefs_get_cursor_theme(): string;
	export function prefs_get_disable_workarounds(): boolean;
	export function prefs_get_drag_threshold(): number;
	export function prefs_get_draggable_border_width(): number;
	export function prefs_get_dynamic_workspaces(): boolean;
	export function prefs_get_edge_tiling(): boolean;
	export function prefs_get_focus_change_on_pointer_rest(): boolean;
	/**
	 * @returns GDesktopEnums.FocusMode
	 */
	export function prefs_get_focus_mode(): any;
	/**
	 * @returns GDesktopEnums.FocusNewWindows
	 */
	export function prefs_get_focus_new_windows(): any;
	export function prefs_get_force_fullscreen(): boolean;
	export function prefs_get_gnome_accessibility(): boolean;
	export function prefs_get_gnome_animations(): boolean;
	export function prefs_get_keybinding_action(name: string): KeyBindingAction;
	export function prefs_get_mouse_button_menu(): number;
	export function prefs_get_mouse_button_mods(): VirtualModifier;
	export function prefs_get_mouse_button_resize(): number;
	export function prefs_get_num_workspaces(): number;
	export function prefs_get_raise_on_click(): boolean;
	export function prefs_get_show_fallback_app_menu(): boolean;
	export function prefs_get_titlebar_font(): Pango.FontDescription;
	export function prefs_get_visual_bell(): boolean;
	/**
	 * @returns GDesktopEnums.VisualBellType
	 */
	export function prefs_get_visual_bell_type(): any;
	export function prefs_get_workspace_name(i: number): string;
	export function prefs_get_workspaces_only_on_primary(): boolean;
	export function prefs_init(): void;
	export function prefs_set_force_fullscreen(whether: boolean): void;
	export function prefs_set_num_workspaces(n_workspaces: number): void;
	export function prefs_set_show_fallback_app_menu(whether: boolean): void;
	export function push_no_msg_prefix(): void;

	/**
	 * Stops Mutter. This tells the event loop to stop processing; it is
	 * rather dangerous to use this because this will leave the user with
	 * no window manager. We generally do this only if, for example, the
	 * session manager asks us to; we assume the session manager knows
	 * what it's talking about.
	 * @param code The success or failure code to return to the calling process.
	 */
	export function quit(code: ExitCode): void;
	export function rect(x: number, y: number, width: number, height: number): Rectangle;
	/**
	 * Registers mutter with the session manager. Call this after completing your own
	 * initialization.
	 * 
	 * This should be called when the session manager can safely continue to the
	 * next phase of startup and potentially display windows.
	 */
	export function register_with_session(): void;
	export function remove_clutter_debug_flags(debug_flags: Clutter.DebugFlag, draw_flags: Clutter.DrawDebugFlag, pick_flags: Clutter.PickDebugFlag): void;
	export function remove_debug_paint_flag(flag: DebugPaintFlag): void;
	/**
	 * Stop printing log messages for the given topic topic. Note
	 * that this method does not stack with Meta.add_verbose_topic;
	 * i.e. if two calls to Meta.add_verbose_topic for the same
	 * topic are made, one call to Meta.remove_verbose_topic will
	 * remove it.
	 * @param topic Topic for which logging will be stopped
	 */
	export function remove_verbose_topic(topic: DebugTopic): void;
	/**
	 * 
	 * @param message message to display to the user, or null
	 */
	export function restart(message: string): void;
	export function test_init(): void;
	export function unsigned_long_equal(v1: void, v2: void): number;
	export function unsigned_long_hash(v: void): number;
	export function x11_error_trap_pop(x11_display: X11Display): void;
	export function x11_error_trap_pop_with_return(x11_display: X11Display): number;
	export function x11_error_trap_push(x11_display: X11Display): void;
	export function x11_init_gdk_display(): boolean;


	// CONSTANTS

	export const CURRENT_TIME: number;
	export const DEFAULT_ICON_NAME: string;
	export const ICON_HEIGHT: number;
	export const ICON_WIDTH: number;
	export const MAJOR_VERSION: number;
	export const MICRO_VERSION: number;
	export const MINI_ICON_HEIGHT: number;
	export const MINI_ICON_WIDTH: number;
	export const MINOR_VERSION: number;
	export const PLUGIN_API_VERSION: number;
	export const PRIORITY_BEFORE_REDRAW: number;
	export const PRIORITY_PREFS_NOTIFY: number;
	export const PRIORITY_REDRAW: number;
	export const PRIORITY_RESIZE: number;
	export const VIRTUAL_CORE_KEYBOARD_ID: number;
	export const VIRTUAL_CORE_POINTER_ID: number;

}