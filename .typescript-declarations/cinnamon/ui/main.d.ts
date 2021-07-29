
/**
 * @short_description This is the heart of Cinnamon, the mother of everything.
 * 
 * The main file is responsible for launching Cinnamon as well as creating its
 * components. The C part of cinnamon calls the start() function, which then
 * initializes all of cinnamon. Most components of Cinnamon can be accessed
 * through main.
 */
declare namespace imports.ui.main {
    var LAYOUT_TRADITIONAL: string;
    var LAYOUT_FLIPPED: string;
    var LAYOUT_CLASSIC: string;

    var DEFAULT_BACKGROUND_COLOR: imports.gi.Clutter.Color;

    /**  */
    const panel: panel.Panel;
    /**  The sound manager */
    const soundManager: soundManager.SoundManager;
    /** The background
     * manager.
     * \
     * This listens to changes in the GNOME background settings and mirrors them to
     * the Cinnamon settings, since many applications have a "Set background"
     * button that modifies the GNOME background settings. */
    const backgroundManager: backgroundManager.BackgroundManager;
    /** The slideshow manager.
     * \
     * This is responsible for managing the background slideshow, since the
     * background "slideshow" is created by cinnamon changing the active background
     * gsetting every x minutes. */
    const slideshowManager: slideshowManager.SlideshowManager;
    /**  The places manager */
    const placesManager: placesManager.PlacesManager;
    /** The panel manager. \
     * This is responsible for handling events relating to panels, eg. showing all
     * panels. */
    const panelManager: panel.PanelManager;
    /** Osd window that pops up when you use media
     * keys. */
    const osdWindowManager: osdWindow.OsdWindowManager;
    /**  The "scale" overview */
    const overview: overview.Overview;
    /**  The "expo" overview */
    const expo: expo.Expo;
    /** The run dialog */
    const runDialog: runDialog.RunDialog;
    /** The looking glass object */
    const lookingGlass: lookingGlass.Melange;
    /** The window manager */
    const wm: windowManager.WindowManager;
    const a11yHandler: accessibility.A11yHandler;
    /** The mesesage tray */
    const messageTray: messageTray.MessageTray;
    /** The notification daemon */
    const notificationDaemon: notificationDaemon.NotificationDaemon;
    /**  The window attention handler */
    const windowAttentionHandler: windowAttentionHandler.WindowAttentionHandler;
    /** The recorder */
    const recorder: gi.Cinnamon.Recorder;
    /**  The cinnamon dbus object */
    const cinnamonDBusService: cinnamonDBus.CinnamonDBus;
    /**  The number of modals "pushed" */
    const modalCount: number;
    /** Array of pushed modal actors */
    const modalActorFocusStack: any[];
    /**  The group containing all Cinnamon and
     * Muffin actors */
    const uiGroup: gi.Cinnamon.GenericContainer;
    /**  The magnifier */
    const magnifier: magnifier.Magnifier;
    /**  The X DND handler */
    const xdndHandler: xdndHandler.XdndHandler;
    /** The status icon dispatcher */
    const statusIconDispatcher: statusIconDispatcher.StatusIconDispacher;
    /**  The keyboard object */
    const keyboard: keyboard.Keyboard;
    /**  The layout manager.
     * \
     * All actors that are part of the Cinnamon UI ar handled by the layout
     * manager, which will determine when to show and hide the actors etc. */
    const layoutManager: layout.LayoutManager;
    /** The theme manager */
    const themeManager: themeManager.ThemeManager;
    /** The keybinding manager */
    const keybindingManager: keybindings.KeybindingManager;
    const _errorLogStack: any[];
    const _startDate: Date;
    const _defaultCssStylesheet: any;
    const _cssStylesheet: any;
    const dynamicWorkspaces: any;
    /** The window tracker */
    const tracker: gi.Cinnamon.WindowTracker;
    /**  The manager of the xlet Settings API */
    const settingsManager: settings.SettingsManager;
    /** The systray manager */
    const systrayManager: systray.SystrayManager;
    const wmSettings: gi.Gio.Settings;

    /**  Names of workspace */
    const workspace_names: string[];

    /**
     * Kept to maintain compatibility. Doesn't seem to be used anywhere
     */
    const applet_side: imports.gi.St.Side;
    /**  The desklet container.
     * \
     * This is a container that contains all the desklets as childs. Its actor is
     * put between @global.bottom_window_group and @global.uiGroup. */
    const deskletContainer: deskletManager.DeskletContainer;

    /**  Whether software rendering is used */
    const software_rendering: boolean;

    /** The popup actor that is in the process of rendering */
    const popup_rendering_actor: gi.Clutter.Actor;

    /** Whether there was at least one xlet that did
     * not manage to load */
    const xlet_startup_error: boolean;

    const gpu_offload_supported: boolean;

    enum RunState {
        INIT = 0,
        STARTUP = 1,
        RUNNING = 2
    }

    const runState: RunState;

    function setRunState(state: RunState): void;

    function _initRecorder(): void;

    function _addXletDirectoriesToSearchPath(): void;

    function _initUserSession(): void;

    function do_shutdown_sequence(): void;

    function _reparentActor(actor: gi.Clutter.Actor, newParent: gi.Clutter.Actor): void;

    /**
     * start:
     *
     * Starts cinnamon. Should not be called in JavaScript code
     */
    function start(): void;

    function notifyCinnamon2d(): void;

    function notifyXletStartupError(): void;

    /* Provided by panelManager now, but kept here for xlet compatibility */

    function enablePanels(): void;

    function disablePanels(): void;

    function getPanels(): void;

    let _workspaces: any[];
    let _checkWorkspacesId: number;

    /*
     * When the last window closed on a workspace is a dialog or splash
     * screen, we assume that it might be an initial window shown before
     * the main window of an application, and give the app a grace period
     * where it can map another window before we remove the workspace.
     */
    const LAST_WINDOW_GRACE_TIME: number;

    function _fillWorkspaceNames(index: number): void;

    function _shouldTrimWorkspace(i: number): boolean;

    function _trimWorkspaceNames(): void;

    function _makeDefaultWorkspaceName(index: number): string;

    /**
     * setWorkspaceName:
     * @index (int): index of workspace
     * @name (string): name of workspace
     *
     * Sets the name of the workspace @index to @name
     */
    export function setWorkspaceName(index: number, name: string): void;

    /**
     * getWorkspaceName:
     * @index (int): index of workspace
     *
     * Retrieves the name of the workspace @index
     *
     * Returns (string): name of workspace
     */
    export function getWorkspaceName(index: number): void;

    /**
     * hasDefaultWorkspaceName:
     * @index (int): index of workspace
     *
     * Whether the workspace uses the default name
     *
     * Returns (boolean): whether the workspace uses the default name
     */
    export function hasDefaultWorkspaceName(index: number): boolean;

    function _addWorkspace(): boolean;

    function _removeWorkspace(workspace: any): boolean;

    /**
     * moveWindowToNewWorkspace:
     * @metaWindow (Meta.Window): the window to be moved
     * @switchToNewWorkspace (boolean): whether or not to switch to the
     *                                  new created workspace
     *
     * Moves the window to a new workspace.
     *
     * If @switchToNewWorkspace is true, it will switch to the new workspace
     * after moving the window
     */
    export function moveWindowToNewWorkspace(metaWindow: gi.Meta.Window, switchToNewWorkspace: boolean): void;

    /**
     * getThemeStylesheet:
     *
     * Get the theme CSS file that Cinnamon will load
     *
     * Returns (string): A file path that contains the theme CSS,
     *                   null if using the default
     */
    export function getThemeStylesheet(): string;

    /**
     * setThemeStylesheet:
     * @cssStylesheet (string): A file path that contains the theme CSS,
     *                         set it to null to use the default
     *
     * Set the theme CSS file that Cinnamon will load
     */
    export function setThemeStylesheet(cssStylesheet: string): void;

    /**
     * loadTheme:
     *
     * Reloads the theme CSS file
     */
    export function loadTheme(): void;

    /**
     * notify:
     * @msg (string): A message
     * @details (string): Additional information to be
     *
     * Sends a notification
     */
    export function notify(msg: string, details: string): void;

    /**
     * criticalNotify:
     * @msg: A critical message
     * @details: Additional information
     */
    export function criticalNotify(msg: string, details: string, icon?: any): messageTray.Notification;

    export function launchDriverManager(): void;

    /**
     * warningNotify:
     * @msg: A warning message
     * @details: Additional information
     */
    export function warningNotify(msg: string, details: string, icon?: any): void;

    /**
     * notifyError:
     * @msg (string): An error message
     * @details (string): Additional information
     *
     * See cinnamon_global_notify_problem().
     */
    export function notifyError(msg: string, details: string): void;

    /**
     * formatLogArgument:
     * @arg (any): A single argument.
     * @recursion (int): Keeps track of the number of recursions.
     * @depth (int): Controls how deeply to inspect object structures.
     *
     * Used by _log to handle each argument type and its formatting.
     */
    export function formatLogArgument(arg?: string, recursion?: number, depth?: number): string;

    /**
     * _log:
     * @category (string): string message type ('info', 'error')
     * @msg (string): A message string
     * @...: Any further arguments are converted into JSON notation,
     *       and appended to the log message, separated by spaces.
     *
     * Log a message into the LookingGlass error
     * stream.  This is primarily intended for use by the
     * extension system as well as debugging.
     */
    export function _log(category?: string, msg?: string): void;

    /**
     * isError:
     * @obj (Object): the object to be tested
     *
     * Tests whether @obj is an error object
     *
     * Returns (boolean): whether @obj is an error object
     */
    export function isError(obj: any): boolean;

    /**
     * _LogTraceFormatted:
     * @stack (string): the stack trace
     *
     * Prints the stack trace to the LookingGlass
     * error stream in a predefined format
     */
    export function _LogTraceFormatted(stack: string): void;

    /**
     * _logTrace:
     * @msg (Error): An error object
     *
     * Prints a stack trace of the given object.
     *
     * If msg is an error, its stack-trace will be
     * printed. Otherwise, a stack-trace of the call
     * will be generated
     *
     * If you want to print the message of an Error
     * as well, use the other log functions instead.
     */
    export function _logTrace(msg: string): void;

    /**
     * _logWarning:
     * @msg (Error/string): An error object or the message string
     *
     * Logs the message to the LookingGlass error
     * stream.
     *
     * If msg is an error, its stack-trace will be
     * printed.
     */
    export function _logWarning(msg: string): void;

    /**
     * _logError:
     * @msg (string): (optional) The message string
     * @error (Error): (optional) The error object
     *
     * Logs the following (if present) to the
     * LookingGlass error stream:
     * - The message from the error object
     * - The stack trace of the error object
     * - The message @msg
     *
     * It can be called in the form of either _logError(msg),
     * _logError(error) or _logError(msg, error).
     */
    export function _logError(msg: string, error: string): void;

    // If msg is an Error, its message will be printed as 'info' and its stack-trace will be printed as 'trace'
    /**
     * _logInfo:
     * @msg (Error/string): The error object or the message string
     *
     * Logs the message to the LookingGlass
     * error stream. If @msg is an Error object,
     * its stack trace will also be printed
     */

    export function _logInfo(msg: string): void;

    /**
     * logStackTrace:
     * @msg (string): message
     *
     * Logs the message @msg to stdout with backtrace
     */
    export function logStackTrace(msg: string): void;

    /**
     * isWindowActorDisplayedOnWorkspace:
     * @win (Meta.WindowActor): window actor
     * @workspaceIndex (int): index of workspace
     *
     * Determines whether the window actor belongs to a specific workspace
     *
     * Returns (boolean): whether the window is on the workspace
     */
    export function isWindowActorDisplayedOnWorkspace(win: gi.Meta.Window, workspaceIndex: number): boolean;

    /**
     * getWindowActorsForWorkspace:
     * @workspaceIndex (int): index of workspace
     *
     * Gets a list of actors on a workspace
     *
     * Returns (array): the array of window actors
     */
    export function getWindowActorsForWorkspace(workspaceIndex: number): boolean;

    // This function encapsulates hacks to make certain global keybindings
    // work even when we are in one of our modes where global keybindings
    // are disabled with a global grab. (When there is a global grab, then
    // all key events will be delivered to the stage, so ::captured-event
    // on the stage can be used for global keybindings.)
    function _stageEventHandler(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

    function _findModal(actor: gi.Clutter.Actor): number;

    /**
     * pushModal:
     * @actor (Clutter.Actor): actor which will be given keyboard focus
     * @timestamp (int): optional timestamp
     * @options (Meta.ModalOptions): (optional) flags to indicate that the pointer
     * is alrady grabbed
     *
     * Ensure we are in a mode where all keyboard and mouse input goes to
     * the stage, and focus @actor. Multiple calls to this function act in
     * a stacking fashion; the effect will be undone when an equal number
     * of popModal() invocations have been made.
     *
     * Next, record the current Clutter keyboard focus on a stack. If the
     * modal stack returns to this actor, reset the focus to the actor
     * which was focused at the time pushModal() was invoked.
     *
     * @timestamp is optionally used to associate the call with a specific user
     * initiated event.  If not provided then the value of
     * global.get_current_time() is assumed.
     *
     * Returns (boolean): true iff we successfully acquired a grab or already had one
     */
    export function pushModal(actor: gi.Clutter.Actor, timestamp?: number, options?: gi.Meta.ModalOptions): boolean;

    /**
     * popModal:
     * @actor (Clutter.Actor): actor passed to original invocation of pushModal().
     * @timestamp (int): optional timestamp
     *
     * Reverse the effect of pushModal().  If this invocation is undoing
     * the topmost invocation, then the focus will be restored to the
     * previous focus at the time when pushModal() was invoked.
     *
     * @timestamp is optionally used to associate the call with a specific user
     * initiated event.  If not provided then the value of
     * global.get_current_time() is assumed.
     */
    export function popModal(actor: gi.Clutter.Actor, timestamp?: number): void;

    /**
     * createLookingGlass:
     *
     * Obtains the looking glass object. Create if it does not exist
     *
     * Returns (LookingGlass.Melange): looking glass object
     */
    export function createLookingGlass(): lookingGlass.Melange;

    /**
     * getRunDialog:
     *
     * Obtains the run dialog object. Create if it does not exist
     *
     * Returns (RunDialog.RunDialog): run dialog object
     */
    export function getRunDialog(): runDialog.RunDialog;

    /**
     * activateWindow:
     * @window (Meta.Window): the Meta.Window to activate
     * @time (int): (optional) current event time
     * @workspaceNum (int): (optional) window's workspace number
     *
     * Activates @window, switching to its workspace first if necessary,
     * and switching out of the overview if it's currently active
     */
    export function activateWindow(window: gi.Meta.Window, time?: number, workspaceNum?: number): void;

    // TODO - replace this timeout with some system to guess when the user might
    // be e.g. just reading the screen and not likely to interact.
    const DEFERRED_TIMEOUT_SECONDS: number;
    var _deferredWorkData: any;
    // Work scheduled for some point in the future
    var _deferredWorkQueue: any[];
    // Work we need to process before the next redraw
    var _beforeRedrawQueue: any[];
    // Counter to assign work ids
    var _deferredWorkSequence: number;
    var _deferredTimeoutId: number;

    function _runDeferredWork(workId: string): void;

    function _runAllDeferredWork(): void;

    function _runBeforeRedrawQueue(): void;

    function _queueBeforeRedraw(workId: string): boolean;

    /**
     * initializeDeferredWork:
     * @actor (Clutter.Actor): A #ClutterActor
     * @callback (function): Function to invoke to perform work
     *
     * This function sets up a callback to be invoked when either the
     * given actor is mapped, or after some period of time when the machine
     * is idle.  This is useful if your actor isn't always visible on the
     * screen (for example, all actors in the overview), and you don't want
     * to consume resources updating if the actor isn't actually going to be
     * displaying to the user.
     *
     * Note that queueDeferredWork is called by default immediately on
     * initialization as well, under the assumption that new actors
     * will need it.
     *
     * Returns (string): A string work identifer
     */
    export function initializeDeferredWork(actor: gi.Clutter.Actor, callback: Function, props?: any): string;

    /**
     * queueDeferredWork:
     * @workId (string): work identifier
     *
     * Ensure that the work identified by @workId will be
     * run on map or timeout.  You should call this function
     * for example when data being displayed by the actor has
     * changed.
     */
    export function queueDeferredWork(workId: string): void | boolean;

    /**
     * isInteresting:
     * @metaWindow (Meta.Window): the window to be tested
     *
     * Determines whether a window is "interesting", i.e.
     * ones to be displayed in alt-tab, window list etc.
     *
     * Returns (boolean): whether the window is interesting
     */
    export function isInteresting(metaWindow: gi.Meta.Window): boolean;

    /**
     * getTabList:
     * @workspaceOpt (Meta.Workspace): (optional) workspace, defaults to global.screen.get_active_workspace()
     * @screenOpt (Meta.Screen): (optional) screen, defaults to global.screen
     *
     * Return a list of the interesting windows on a workspace (by default,
     * the active workspace).
     * The list will include app-less dialogs.
     *
     * Returns (array): list of windows
     */
    export function getTabList(workspaceOpt?: gi.Meta.Workspace, screenOpt?: gi.Meta.Screen): gi.Meta.Window[];

    export function restartCinnamon(showOsd?: boolean): void;

}