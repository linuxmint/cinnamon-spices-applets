declare namespace imports.gi.Cinnamon {


	// CLASSES 
	interface IGenericContainer {
		connect(signal: 'allocate', callback: (actor: this, box: Clutter.ActorBox, flags: Clutter.AllocationFlags, user_data?: any) => void): number;

		connect(signal: 'get-preferred-width', callback: (actor: this, for_height: number, alloc: GenericContainerAllocation, user_data?: any) => void): number

		connect(signal: 'get-preferred-height', callback: (actor: this, for_width: number, alloc: GenericContainerAllocation, user_data?: any) => void): number

	}

	type GenericContainerType = IGenericContainer & St.Widget
	interface GenericContainer extends GenericContainerType { }

	class GenericContainer {
		constructor(options?: any)
	}

	class TrayManager {
		public redisplay(): void;
		public set_orientation(orientation: St.Side): void;
		public manage_stage(state: any, themeWidget: any): void;
	}

	class TrayIcon extends St.Icon {
		obsolete?: boolean;
		window: EmbeddedWindow;
		click(e: gi.Clutter.Event): void;
	}

	class GenericContainerAllocation {
		public min_size: number
		public natural_size: number
	}

	class EmbeddedWindow extends Gtk.Window {
		show(): void;
		hide(): void;
	}

	class Recorder {

	}

	enum CinnamonAppState {
		STOPPED,
		STARTING,
		RUNNING
	}

	class CinnamonApp {

		static new_for_window(window: gi.Meta.Window): CinnamonApp;

		readonly parent: gi.GObject.Object;
		readonly state: CinnamonAppState;
		//info: GMenuDesktopAppInfo;
		//entry: GMenuTreeEntry;
		readonly started_on_workspace: number;
		readonly window_id_string: string;
		readonly keywords: string;
		readonly unique_name: string;
		readonly hidden_as_duplicate: boolean;
		readonly is_flatpak: boolean;

		get_id(): string;
		get_name(): string;
		get_description(): string;
		get_keywords(): string;
		get_nodisplay(): boolean;
		/**
		 * @returns State of the application
		 */
		get_state(): CinnamonAppState;
		/**
		 * @returns TRUE if #app is a flatpak app, FALSE if not
		 */
		get_is_flatpak(): boolean;

		/**
		 * Get the toplevel, interesting windows which are associated with this
 		 * application.  The returned list will be sorted first by whether
 		 * they're on the active workspace, then by whether they're visible,
 		 * and finally by the time the user last interacted with them.
		 * @returns List of windows
		 */
		get_windows(): gi.Meta.Window[];

		get_n_windows(): number;

		is_on_workspace(workspace: gi.Meta.Workspace): boolean;

		/**
		 * Bring all windows for the given app to the foreground,
 		 * but ensure that @window is on top.  If @window is %NULL,
 		 * the window with the most recent user time for the app
 		 * will be used.
 		 *
 		 * This function has no effect if @app is not currently running.
		 * @param window Window to be focused
		 * @param timestamp Event timestamp, uint
		 */
		activate_window(window: gi.Meta.Window | null, timestamp: number): void;

		/**
		 * like {@link activate_full}, but using the default workspace and
		 * event timestamp.
		 */
		activate(): void;

		/**
		 * Perform an appropriate default action for operating on this application,
  		 * dependent on its current state.  For example, if the application is not
  		 * currently running, launch it.  If it is running, activate the most
  		 * recently used NORMAL window (or if that window has a transient, the most
  		 * recently used transient for that window).
		 * @param workspace launch on this workspace, or -1 for default. Ignored if
 		 *   activating an existing window
		 * @param timestamp Event timestamp, unit
		 */
		activate_full(workspace: number, timestamp: number): void;

		/**
		 * A window backed application is one which represents just an open
		 * window, i.e. there's no .desktop file association, so we don't know
		 * how to launch it again.
		 */
		is_window_backed(): boolean;
		/**
		 * Look up the icon for this application, and create a #ClutterTexture
 		 * for it at the given size.
		 * @param size the size of the icon to create
		 * @return (transfer none): A floating #ClutterActor
		 */
		create_icon_texture(size: number): gi.Clutter.Actor;
		/**
		 * Look up the icon for this application, and create a #ClutterTexture
 		 * for it at the given size.  If for_window is NULL, it bases the icon
 		 * off the most-recently-used window for the app, otherwise it attempts to
 		 * use for_window for determining the icon.
		 * @param size the size of the icon to create
		 * @param window (nullable): Optional - the backing MetaWindow to look up for.
		 * @returns a floating {@link gi.Clutter.Actor}
		 */
		create_icon_texture_for_window(size: number, window?: gi.Meta.Window | null): gi.Clutter.Actor;

		/**
		 * Request that the application create a new window.
		 * @param workspace open on this workspace, or -1 for default
		 */
		open_new_window(workspace: number): void;

		/**
		 * Returns %TRUE if the app supports opening a new window through
 		 * cinnamon_app_open_new_window() (ie, if calling that function will
 		 * result in actually opening a new window and not something else,
 		 * like presenting the most recently active one)
		 */
		can_open_new_window(): boolean;
	}

	class WindowTracker {
		static get_default(): WindowTracker;

		connect(id: "notify::focus-app", callback: () => void): number;
		/**
		 * 
		 * @param window A #MetaWindow
		 * @returns Application associated with window
		 */
		get_window_app(window: imports.gi.Meta.Window): CinnamonApp;
		/**
		 * Look up the application corresponding to a process.
		 * @param pid A Unix process identifier
		 * @returns A #CinnamonApp, or %NULL if none
		 */
		get_app_from_pid(pid: number): CinnamonApp | null;
		/**
		 * The CinnamonWindowTracker associates certain kinds of windows with
		 * applications; however, others we don't want to
		 * appear in places where we want to give a list of windows
		 * for an application, such as the alt-tab dialog.
		 *
		 * An example of a window we don't want to show is the root
		 * desktop window.  We skip all override-redirect types, and also
		 * exclude other window types like tooltip explicitly, though generally
		 * most of these should be override-redirect.
		 * @param window 
		 * @returns %TRUE if a window is "interesting"
		 */
		is_window_interesting(window: imports.gi.Meta.Window): boolean;

		static focus_app(tracker: WindowTracker, app: CinnamonApp): void;
	}

	// ENUMS
	enum Cursor {
		//INCOMPLETE
		DND_UNSUPPORTED_TARGET,
		DND_COPY,
		DND_MOVE,
		POINTING_HAND,
	}

	enum StageInputMode {
		NONREACTIVE,
		NORMAL,
		FOCUSED,
		FULLSCREEN
	}


	// FUNCTIONS
	function util_format_date(format: string, milliseconds: number): string;
	function util_get_transformed_allocation(actor: imports.gi.Clutter.Actor): gi.Clutter.ActorBox

	function util_get_week_start(): number;

	function get_file_contents_utf8_sync(path: string): string

}