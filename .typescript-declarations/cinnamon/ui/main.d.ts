declare namespace imports.ui.main {
/**
 * FILE:main.js
 * @short_description: This is the heart of Cinnamon, the mother of everything.
 * @placesManager (PlacesManager.PlacesManager): The places manager
 * @overview (Overview.Overview): The "scale" overview
 * @expo (Expo.Expo): The "expo" overview
 * @runDialog (RunDialog.RunDialog): The run dialog
 * @lookingGlass (LookingGlass.Melange): The looking glass object
 * @wm (WindowManager.WindowManager): The window manager
 * @messageTray (MessageTray.MessageTray): The mesesage tray
 * @notificationDaemon (NotificationDaemon.NotificationDaemon): The notification daemon
 * @windowAttentionHandler (WindowAttentionHandler.WindowAttentionHandler): The window attention handler
 * @recorder (Cinnamon.Recorder): The recorder
 * @cinnamonDBusService (CinnamonDBus.Cinnamon): The cinnamon dbus object
 * @modalCount (int): The number of modals "pushed"
 * @modalActorFocusStack (array): Array of pushed modal actors
 * @uiGroup (Cinnamon.GenericContainer): The group containing all Cinnamon and
 * Muffin actors
 *
 * @magnifier (Magnifier.Magnifier): The magnifier
 * @xdndHandler (XdndHandler.XdndHandler): The X DND handler
 * @statusIconDispatcher (StatusIconDispatcher.StatusIconDispatcher): The status icon dispatcher
 * @keyboard (Keyboard.Keyboard): The keyboard object
 * @layoutManager (Layout.LayoutManager): The layout manager.
 * \
 * All actors that are part of the Cinnamon UI ar handled by the layout
 * manager, which will determine when to show and hide the actors etc.
 *
 * @panelManager (Panel.PanelManager): The panel manager.
 * \
 * This is responsible for handling events relating to panels, eg. showing all
 * panels.
 *
 * @themeManager (ThemeManager.ThemeManager): The theme manager
 * @soundManager (SoundManager.SoundManager): The sound manager
 * @settingsManager (Settings.SettingsManager): The manager of the xlet Settings API
 *
 * @backgroundManager (BackgroundManager.BackgroundManager): The background
 * manager.
 * \
 * This listens to changes in the GNOME background settings and mirrors them to
 * the Cinnamon settings, since many applications have a "Set background"
 * button that modifies the GNOME background settings.
 *
 * @slideshowManager (SlideshowManager.SlideshowManager): The slideshow manager.
 * \
 * This is responsible for managing the background slideshow, since the
 * background "slideshow" is created by cinnamon changing the active background
 * gsetting every x minutes.
 *
 * @keybindingManager (KeybindingManager.KeybindingManager): The keybinding manager
 * @systrayManager (Systray.SystrayManager): The systray manager
 *
 * @osdWindow (OsdWindow.OsdWindow): Osd window that pops up when you use media
 * keys.
 * @tracker (Cinnamon.WindowTracker): The window tracker
 * @workspace_names (array): Names of workspace
 * @deskletContainer (DeskletManager.DeskletContainer): The desklet container.
 * \
 * This is a container that contains all the desklets as childs. Its actor is
 * put between @global.bottom_window_group and @global.uiGroup.
 * @software_rendering (boolean): Whether software rendering is used
 * @popup_rendering_actor (Clutter.Actor): The popup actor that is in the process of rendering
 * @xlet_startup_error (boolean): Whether there was at least one xlet that did
 * not manage to load
 *
 * The main file is responsible for launching Cinnamon as well as creating its
 * components. The C part of cinnamon calls the @start() function, which then
 * initializes all of cinnamon. Most components of Cinnamon can be accessed
 * through main.
 */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const XApp = imports.gi.XApp;
const PointerTracker = imports.misc.pointerTracker;

const SoundManager = imports.ui.soundManager;
const BackgroundManager = imports.ui.backgroundManager;
const SlideshowManager = imports.ui.slideshowManager;
var AppletManager = imports.ui.appletManager;
const SearchProviderManager = imports.ui.searchProviderManager;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const Keyboard = imports.ui.keyboard;
const MessageTray = imports.ui.messageTray;
const OsdWindow = imports.ui.osdWindow;
const Overview = imports.ui.overview;
const Expo = imports.ui.expo;
const Panel = imports.ui.panel;
const PlacesManager = imports.ui.placesManager;
const RunDialog = imports.ui.runDialog;
const Layout = imports.ui.layout;
const LookingGlass = imports.ui.lookingGlass;
const NotificationDaemon = imports.ui.notificationDaemon;
const WindowAttentionHandler = imports.ui.windowAttentionHandler;
const CinnamonDBus = imports.ui.cinnamonDBus;
const ThemeManager = imports.ui.themeManager;
const Magnifier = imports.ui.magnifier;
const XdndHandler = imports.ui.xdndHandler;
const StatusIconDispatcher = imports.ui.statusIconDispatcher;
const Util = imports.misc.util;
const Keybindings = imports.ui.keybindings;
const Settings = imports.ui.settings;
const Systray = imports.ui.systray;
const Accessibility = imports.ui.accessibility;
const ModalDialog = imports.ui.modalDialog;
const {readOnlyError} = imports.ui.environment;
const {installPolyfills} = imports.ui.overrides;

var LAYOUT_TRADITIONAL: string;
var LAYOUT_FLIPPED: string;
var LAYOUT_CLASSIC: string;

var DEFAULT_BACKGROUND_COLOR: imports.gi.Clutter.Color;

const panel: panel.Panel;
const soundManager: soundManager.SoundManager;
const backgroundManager: backgroundManager.BackgroundManager;
const slideshowManager: slideshowManager.SlideshowManager;
const placesManager: placesManager.PlacesManager;
const panelManager: panel.PanelManager;
const osdWindowManager: osdWindow.OsdWindowManager;
const overview: overview.Overview;
const expo: expo.Expo;
const runDialog: runDialog.RunDialog;
const lookingGlass: lookingGlass.Melange;
const wm: windowManager.WindowManager;
const a11yHandler: accessibility.A11yHandler;
const messageTray: messageTray.MessageTray;
const notificationDaemon: notificationDaemon.NotificationDaemon;
const windowAttentionHandler: windowAttentionHandler.WindowAttentionHandler;
const recorder: gi.Cinnamon.Recorder;
const cinnamonDBusService: cinnamonDBus.CinnamonDBus;
const modalCount: number;
const modalActorFocusStack: any[];
const uiGroup: gi.Cinnamon.GenericContainer;
const magnifier: magnifier.Magnifier;
const xdndHandler: xdndHandler.XdndHandler;
const statusIconDispatcher: statusIconDispatcher.StatusIconDispacher;
const keyboard: keyboard.Keyboard;
const layoutManager: layout.LayoutManager;
const themeManager: themeManager.ThemeManager;
const keybindingManager: keybindings.KeybindingManager;
const _errorLogStack: any[];
const _startDate: Date;
const _defaultCssStylesheet: any;
const _cssStylesheet: any;
const dynamicWorkspaces: any;
const tracker: gi.Cinnamon.WindowTracker;
const settingsManager: settings.SettingsManager;
const systrayManager: systray.SystrayManager;
const wmSettings: gi.Gio.Settings;

var workspace_names: string[];

/**
 * Kept to maintain compatibility. Doesn't seem to be used anywhere
 */
const applet_side: imports.gi.St.Side;
const deskletContainer: deskletManager.DeskletContainer;

const software_rendering: boolean;

const popup_rendering_actor: gi.Clutter.Actor;

const xlet_startup_error: boolean;

const gpu_offload_supported: boolean;

enum RunState {
    INIT = 0,
    STARTUP = 1,
    RUNNING = 2
}

const runState: RunState;

const _: gettext.gettext;

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
export function getWorkspaceName(index) {
    let wsName = index < workspace_names.length ?
        workspace_names[index] :
        "";
    wsName.trim();
    return wsName.length > 0 ?
        wsName :
        _makeDefaultWorkspaceName(index);
}

/**
 * hasDefaultWorkspaceName:
 * @index (int): index of workspace
 *
 * Whether the workspace uses the default name
 *
 * Returns (boolean): whether the workspace uses the default name
 */
function hasDefaultWorkspaceName(index) {
    return getWorkspaceName(index) == _makeDefaultWorkspaceName(index);
}

function _addWorkspace() {
    global.screen.append_new_workspace(false, global.get_current_time());
    return true;
}

function _removeWorkspace(workspace) {
    if (global.screen.n_workspaces == 1)
        return false;
    let index = workspace.index();
    if (index < workspace_names.length) {
        workspace_names.splice (index, 1);
    }
    _trimWorkspaceNames();
    wmSettings.set_strv("workspace-names", workspace_names);
    global.screen.remove_workspace(workspace, global.get_current_time());
    return true;
}

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
function moveWindowToNewWorkspace(metaWindow, switchToNewWorkspace) {
    if (switchToNewWorkspace) {
        let targetCount = global.screen.n_workspaces + 1;
        let nnwId = global.screen.connect('notify::n-workspaces', function() {
            global.screen.disconnect(nnwId);
            if (global.screen.n_workspaces === targetCount) {
                let newWs = global.screen.get_workspace_by_index(global.screen.n_workspaces - 1);
                newWs.activate(global.get_current_time());
            }
        });
    }
    metaWindow.change_workspace_by_index(global.screen.n_workspaces, true, global.get_current_time());
}

/**
 * getThemeStylesheet:
 *
 * Get the theme CSS file that Cinnamon will load
 *
 * Returns (string): A file path that contains the theme CSS,
 *                   null if using the default
 */
function getThemeStylesheet()
{
    return _cssStylesheet;
}

/**
 * setThemeStylesheet:
 * @cssStylesheet (string): A file path that contains the theme CSS,
 *                         set it to null to use the default
 *
 * Set the theme CSS file that Cinnamon will load
 */
function setThemeStylesheet(cssStylesheet)
{
    _cssStylesheet = cssStylesheet;
}

/**
 * loadTheme:
 *
 * Reloads the theme CSS file
 */
function loadTheme() {
    let themeContext = St.ThemeContext.get_for_stage (global.stage);
    let theme = new St.Theme ({ fallback_stylesheet: _defaultCssStylesheet });
    let stylesheetLoaded = false;
    if (_cssStylesheet != null) {
        stylesheetLoaded = theme.load_stylesheet(_cssStylesheet);
    }
    if (!stylesheetLoaded) {
        theme.load_stylesheet(_defaultCssStylesheet);
        if (_cssStylesheet != null) {
            global.logError("There was some problem parsing the theme: " + _cssStylesheet + ".  Falling back to the default theme.");
        }
    }

    themeContext.set_theme (theme);
}

/**
 * notify:
 * @msg (string): A message
 * @details (string): Additional information to be
 *
 * Sends a notification
 */
function notify(msg, details) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details);
    notification.setTransient(true);
    source.notify(notification);
}

/**
 * criticalNotify:
 * @msg: A critical message
 * @details: Additional information
 */
function criticalNotify(msg, details, icon) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.CRITICAL);
    source.notify(notification);
    return notification;
}

function launchDriverManager() {
    Util.spawnCommandLineAsync("cinnamon-driver-manager", null, null);
}

/**
 * warningNotify:
 * @msg: A warning message
 * @details: Additional information
 */
function warningNotify(msg, details, icon) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.HIGH);
    source.notify(notification);
}

/**
 * notifyError:
 * @msg (string): An error message
 * @details (string): Additional information
 *
 * See cinnamon_global_notify_problem().
 */
function notifyError(msg, details) {
    // Also print to stderr so it's logged somewhere
    if (details)
        log('error: ' + msg + ': ' + details);
    else
        log('error: ' + msg);
    notify(msg, details);
}

/**
 * formatLogArgument:
 * @arg (any): A single argument.
 * @recursion (int): Keeps track of the number of recursions.
 * @depth (int): Controls how deeply to inspect object structures.
 *
 * Used by _log to handle each argument type and its formatting.
 */
function formatLogArgument(arg = '', recursion = 0, depth = 6) {
    // Make sure falsey values are clearly indicated.
    if (arg === null) {
        arg = 'null';
    } else if (arg === undefined) {
        arg = 'undefined';
    // Ensure strings are distinguishable.
    } else if (typeof arg === 'string' && recursion > 0) {
        arg = '\'' + arg + '\'';
    }
    // Check if we reached the depth threshold
    if (recursion + 1 > depth) {
        try {
            arg = JSON.stringify(arg);
        } catch (e) {
            arg = arg.toString();
        }
        return arg;
    }
    let isGObject = arg instanceof GObject.Object;
    let space = '';
    for (let i = 0; i < recursion + 1; i++) {
        space += '    ';
    }
    if (typeof arg === 'object') {
        let isArray = Array.isArray(arg);
        let brackets = isArray ? ['[', ']'] : ['{', '}'];
        if (isGObject) {
            arg = Util.getGObjectPropertyValues(arg);
            if (Object.keys(arg).length === 0) {
                return arg.toString();
            }
        }
        let array = isArray ? arg : Object.keys(arg);
        // Add beginning bracket with indentation
        let string = brackets[0] + (recursion + 1 > depth ? '' : '\n');
        for (let j = 0, len = array.length; j < len; j++) {
            if (isArray) {
                string += space + formatLogArgument(arg[j], recursion + 1, depth) + ',\n';
            } else {
                string += space + array[j] + ': ' + formatLogArgument(arg[array[j]], recursion + 1, depth) + ',\n';
            }
        }
        // Remove one level of indentation and add the closing bracket.
        space = space.substr(4, space.length);
        arg = string + space + brackets[1];
    // Functions, numbers, etc.
    } else if (typeof arg === 'function') {
        let array = arg.toString().split('\n');
        for (let i = 0; i < array.length; i++) {
            if (i === 0) continue;
            array[i] = space + array[i];
        }
        arg = array.join('\n');
    } else if (typeof arg !== 'string' || isGObject) {
        arg = arg.toString();
    }
    return arg;
}

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
function _log(category = 'info', msg = '') {
    // Convert arguments into an array so it can be iterated.
    let args = Array.prototype.slice.call(arguments);
    // Remove category from the list of loggable arguments
    args.shift();
    let text = '';

    for (let i = 0, len = args.length; i < len; i++) {
        args[i] = formatLogArgument(args[i]);
    }

    if (args.length === 2) {
        text = args[0] + ': ' + args[1];
    } else {
        text = args.join(' ');
    }
    let out = {
        timestamp: new Date().getTime().toString(),
        category: category,
        message: text
    };

    _errorLogStack.push(out);

    if (lookingGlass) {
        lookingGlass.emitLogUpdate();
    }

    log(`[LookingGlass/${category}] ${text}`);
}

/**
 * isError:
 * @obj (Object): the object to be tested
 *
 * Tests whether @obj is an error object
 *
 * Returns (boolean): whether @obj is an error object
 */
function isError(obj) {
    if (obj == undefined) return false;

    let isErr = false;
    if (typeof(obj) == 'object' && 'message' in obj && 'stack' in obj) {
        isErr = true;
    } else if (obj instanceof GLib.Error) {
        // Make existing logging functionality work as expected when passed
        // a GLib.Error which doesn't normally have a stack trace attached.
        let stack = new Error().stack;
        // This is reached the first time isError is called by a _log function,
        // so strip off this function call and the _log function that called us.
        let strPos = stack.indexOf('\n', stack.indexOf('\n') + 1)  + 1;
        stack = stack.substr(strPos);
        obj.stack = stack;
        isErr = true;
    }
    return isErr;
}

/**
 * _LogTraceFormatted:
 * @stack (string): the stack trace
 *
 * Prints the stack trace to the LookingGlass
 * error stream in a predefined format
 */
function _LogTraceFormatted(stack) {
    _log('trace', '\n<----------------\n' + stack + '---------------->');
}

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
function _logTrace(msg) {
    if(isError(msg)) {
        _LogTraceFormatted(msg.stack);
    } else {
        try {
            throw new Error();
        } catch (e) {
            // e.stack must have at least two lines, with the first being
            // _logTrace() (which we strip off), and the second being
            // our caller.
            let trace = e.stack.substr(e.stack.indexOf('\n') + 1);
            _LogTraceFormatted(trace);
        }
    }
}

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
function _logWarning(msg) {
    if(isError(msg)) {
        _log('warning', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        _log('warning', msg);
    }
}

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
function _logError(msg, error) {
    if(error && isError(error)) {
        _log('error', error.message);
        _LogTraceFormatted(error.stack);
        _log('error', msg);
    } else if(isError(msg)) {
        _log('error', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        _log('error', msg);
    }
}

// If msg is an Error, its message will be printed as 'info' and its stack-trace will be printed as 'trace'
/**
 * _logInfo:
 * @msg (Error/string): The error object or the message string
 *
 * Logs the message to the LookingGlass
 * error stream. If @msg is an Error object,
 * its stack trace will also be printed
 */

function _logInfo(msg) {
    if (isError(msg)) {
        _log('info', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        // Convert arguments to an array, add 'info' to the beginning of it. Invoke _log with apply so
        // unlimited arguments can be passed to it.
        let args = Array.prototype.slice.call(arguments);
        _log.apply(this, ['info'].concat(args));
    }
}

/**
 * logStackTrace:
 * @msg (string): message
 *
 * Logs the message @msg to stdout with backtrace
 */
function logStackTrace(msg) {
    try {
        throw new Error();
    } catch (e) {
        // e.stack must have at least two lines, with the first being
        // logStackTrace() (which we strip off), and the second being
        // our caller.
        let trace = e.stack.substr(e.stack.indexOf('\n') + 1);
        log(msg ? (msg + '\n' + trace) : trace);
    }
}

/**
 * isWindowActorDisplayedOnWorkspace:
 * @win (Meta.WindowActor): window actor
 * @workspaceIndex (int): index of workspace
 *
 * Determines whether the window actor belongs to a specific workspace
 *
 * Returns (boolean): whether the window is on the workspace
 */
function isWindowActorDisplayedOnWorkspace(win, workspaceIndex) {
    if (win.get_workspace() == workspaceIndex) {return true;}
    let mwin = win.get_meta_window();
    return mwin && (mwin.is_on_all_workspaces() ||
        (wm.workspacesOnlyOnPrimary && mwin.get_monitor() != layoutManager.primaryIndex)
    );
}

/**
 * getWindowActorsForWorkspace:
 * @workspaceIndex (int): index of workspace
 *
 * Gets a list of actors on a workspace
 *
 * Returns (array): the array of window actors
 */
function getWindowActorsForWorkspace(workspaceIndex) {
    return global.get_window_actors().filter(function (win) {
        return isWindowActorDisplayedOnWorkspace(win, workspaceIndex);
    });
}

// This function encapsulates hacks to make certain global keybindings
// work even when we are in one of our modes where global keybindings
// are disabled with a global grab. (When there is a global grab, then
// all key events will be delivered to the stage, so ::captured-event
// on the stage can be used for global keybindings.)
function _stageEventHandler(actor, event) {
    if (modalCount == 0)
        return false;
    if (event.type() != Clutter.EventType.KEY_PRESS) {
        if(!popup_rendering_actor || event.type() != Clutter.EventType.BUTTON_RELEASE)
            return false;
        return (event.get_source() && popup_rendering_actor.contains(event.get_source()));
    }

    let symbol = event.get_key_symbol();
    let keyCode = event.get_key_code();
    let modifierState = Cinnamon.get_event_state(event);

    // This relies on the fact that Clutter.ModifierType is the same as Gdk.ModifierType
    let action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action == Meta.KeyBindingAction.CUSTOM) {
        global.display.keybinding_action_invoke_by_code(keyCode, modifierState);
    }

    // Other bindings are only available when the overview is up and no modal dialog is present
    if (((!overview.visible && !expo.visible) || modalCount > 1))
        return false;

    // This isn't a Meta.KeyBindingAction yet
    if (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R) {
        if (expo.visible) {
            expo.hide();
            return true;
        }
    }

    if (action == Meta.KeyBindingAction.SWITCH_PANELS) {
        //Used to call the ctrlalttabmanager in Gnome Shell
        return true;
    }

    switch (action) {
        // left/right would effectively act as synonyms for up/down if we enabled them;
        // but that could be considered confusing; we also disable them in the main view.
        case Meta.KeyBindingAction.WORKSPACE_LEFT:
            wm.actionMoveWorkspaceLeft();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_RIGHT:
            wm.actionMoveWorkspaceRight();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_UP:
            overview.hide();
            expo.hide();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_DOWN:
            overview.hide();
            expo.hide();
            return true;
        case Meta.KeyBindingAction.PANEL_RUN_DIALOG:
            getRunDialog().open();
            return true;
    }

    return false;
}

function _findModal(actor) {
    for (let i = 0; i < modalActorFocusStack.length; i++) {
        if (modalActorFocusStack[i].actor == actor)
            return i;
    }
    return -1;
}

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
function pushModal(actor, timestamp, options) {
    if (timestamp == undefined)
        timestamp = global.get_current_time();

    if (modalCount == 0) {
        if (!global.begin_modal(timestamp, options ? options : 0)) {
            log('pushModal: invocation of begin_modal failed');
            return false;
        }
        Meta.disable_unredirect_for_screen(global.screen);
    }

    global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);

    modalCount += 1;
    let actorDestroyId = actor.connect('destroy', function() {
        let index = _findModal(actor);
        if (index >= 0)
            popModal(actor);
    });

    let record = {
        actor: actor,
        focus: global.stage.get_key_focus(),
        destroyId: actorDestroyId
    };
    if (record.focus != null) {
        record.focusDestroyId = record.focus.connect('destroy', function() {
            record.focus = null;
            record.focusDestroyId = null;
        });
    }
    modalActorFocusStack.push(record);

    global.stage.set_key_focus(actor);

    layoutManager.updateChrome(true);
    return true;
}

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
function popModal(actor, timestamp) {
    if (timestamp == undefined)
        timestamp = global.get_current_time();

    let focusIndex = _findModal(actor);
    if (focusIndex < 0) {
        global.stage.set_key_focus(null);
        global.end_modal(timestamp);
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);

        throw new Error('incorrect pop');
    }

    modalCount -= 1;

    let record = modalActorFocusStack[focusIndex];
    if (record.destroyId) record.actor.disconnect(record.destroyId);
    record.destroyId = 0;

    if (focusIndex == modalActorFocusStack.length - 1) {
        if (record.focusDestroyId) {
            record.focus.disconnect(record.focusDestroyId);
            record.focusDestroyId = 0;
        }
        global.stage.set_key_focus(record.focus);
    } else {
        let t = modalActorFocusStack[modalActorFocusStack.length - 1];
        if (t.focus)
            t.focus.disconnect(t.focusDestroyId);
        // Remove from the middle, shift the focus chain up
        for (let i = modalActorFocusStack.length - 1; i > focusIndex; i--) {
            modalActorFocusStack[i].focus = modalActorFocusStack[i - 1].focus;
            modalActorFocusStack[i].focusDestroyId = modalActorFocusStack[i - 1].focusDestroyId;
        }
    }
    modalActorFocusStack.splice(focusIndex, 1);

    if (modalCount > 0)
        return;

    global.end_modal(timestamp);
    global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);

    layoutManager.updateChrome(true);

    Meta.enable_unredirect_for_screen(global.screen);
}

/**
 * createLookingGlass:
 *
 * Obtains the looking glass object. Create if it does not exist
 *
 * Returns (LookingGlass.Melange): looking glass object
 */
function createLookingGlass() {
    if (lookingGlass == null) {
        lookingGlass = new LookingGlass.Melange();
    }
    return lookingGlass;
}

/**
 * getRunDialog:
 *
 * Obtains the run dialog object. Create if it does not exist
 *
 * Returns (RunDialog.RunDialog): run dialog object
 */
function getRunDialog() {
    if (runDialog == null) {
        runDialog = new RunDialog.RunDialog();
    }
    return runDialog;
}

/**
 * activateWindow:
 * @window (Meta.Window): the Meta.Window to activate
 * @time (int): (optional) current event time
 * @workspaceNum (int): (optional) window's workspace number
 *
 * Activates @window, switching to its workspace first if necessary,
 * and switching out of the overview if it's currently active
 */
function activateWindow(window, time, workspaceNum) {
    let activeWorkspaceNum = global.screen.get_active_workspace_index();
    let windowWorkspaceNum = (workspaceNum !== undefined) ? workspaceNum : window.get_workspace().index();

    if (!time)
        time = global.get_current_time();

    if (windowWorkspaceNum != activeWorkspaceNum) {
        let workspace = global.screen.get_workspace_by_index(windowWorkspaceNum);
        workspace.activate_with_focus(window, time);
    } else {
        window.activate(time);
        Mainloop.idle_add(function() {
            window.foreach_transient(function(win) {
                win.activate(time);
            });
        });
    }

    overview.hide();
    expo.hide();
}

// TODO - replace this timeout with some system to guess when the user might
// be e.g. just reading the screen and not likely to interact.
const DEFERRED_TIMEOUT_SECONDS = 20;
var _deferredWorkData = {};
// Work scheduled for some point in the future
var _deferredWorkQueue = [];
// Work we need to process before the next redraw
var _beforeRedrawQueue = [];
// Counter to assign work ids
var _deferredWorkSequence = 0;
var _deferredTimeoutId = 0;

function _runDeferredWork(workId) {
    if (!_deferredWorkData[workId])
        return;
    let index = _deferredWorkQueue.indexOf(workId);
    if (index < 0)
        return;

    _deferredWorkQueue.splice(index, 1);
    _deferredWorkData[workId].callback();
    if (_deferredWorkQueue.length == 0 && _deferredTimeoutId > 0) {
        Mainloop.source_remove(_deferredTimeoutId);
        _deferredTimeoutId = 0;
    }
}

function _runAllDeferredWork() {
    while (_deferredWorkQueue.length > 0)
        _runDeferredWork(_deferredWorkQueue[0]);
}

function _runBeforeRedrawQueue() {
    for (let i = 0; i < _beforeRedrawQueue.length; i++) {
        let workId = _beforeRedrawQueue[i];
        _runDeferredWork(workId);
    }
    _beforeRedrawQueue = [];
}

function _queueBeforeRedraw(workId) {
    _beforeRedrawQueue.push(workId);
    if (_beforeRedrawQueue.length == 1) {
        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, function () {
            _runBeforeRedrawQueue();
            return false;
        });
    }
}

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
function initializeDeferredWork(actor, callback, props) {
    // Turn into a string so we can use as an object property
    let workId = '' + (++_deferredWorkSequence);
    _deferredWorkData[workId] = { 'actor': actor,
                                  'callback': callback };
    actor.connect('notify::mapped', function () {
        if (!(actor.mapped && _deferredWorkQueue.indexOf(workId) >= 0))
            return;
        _queueBeforeRedraw(workId);
    });
    actor.connect('destroy', function() {
        let index = _deferredWorkQueue.indexOf(workId);
        if (index >= 0)
            _deferredWorkQueue.splice(index, 1);
        delete _deferredWorkData[workId];
    });
    queueDeferredWork(workId);
    return workId;
}

/**
 * queueDeferredWork:
 * @workId (string): work identifier
 *
 * Ensure that the work identified by @workId will be
 * run on map or timeout.  You should call this function
 * for example when data being displayed by the actor has
 * changed.
 */
function queueDeferredWork(workId) {
    let data = _deferredWorkData[workId];
    if (!data) {
        global.logError('invalid work id: ' +  workId);
        return;
    }
    if (_deferredWorkQueue.indexOf(workId) < 0)
        _deferredWorkQueue.push(workId);
    if (data.actor.mapped) {
        _queueBeforeRedraw(workId);
        return;
    } else if (_deferredTimeoutId == 0) {
        _deferredTimeoutId = Mainloop.timeout_add_seconds(DEFERRED_TIMEOUT_SECONDS, function () {
            _runAllDeferredWork();
            _deferredTimeoutId = 0;
            return false;
        });
    }
}

/**
 * isInteresting:
 * @metaWindow (Meta.Window): the window to be tested
 *
 * Determines whether a window is "interesting", i.e.
 * ones to be displayed in alt-tab, window list etc.
 *
 * Returns (boolean): whether the window is interesting
 */
function isInteresting(metaWindow) {

    if (metaWindow.get_title() == "JavaEmbeddedFrame")
        return false;

    // Include any window the tracker finds interesting
    if (metaWindow.is_interesting()) {
        return true;
    }

    // Include app-less dialogs
    let type = metaWindow.get_window_type();
    if (!tracker.get_window_app(metaWindow) && (type === Meta.WindowType.DIALOG || type === Meta.WindowType.MODAL_DIALOG)) {
        return true;
    }

    return false;
}

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
function getTabList(workspaceOpt, screenOpt) {
    let screen = screenOpt || global.screen;
    let display = screen.get_display();
    let workspace = workspaceOpt || screen.get_active_workspace();

    let windows = []; // the array to return

    let allwindows = display.get_tab_list(Meta.TabList.NORMAL_ALL, screen,
                                       workspace);
    let registry = {}; // to avoid duplicates

    for (let i = 0; i < allwindows.length; ++i) {
        let window = allwindows[i];
        if (isInteresting(window)) {
            let seqno = window.get_stable_sequence();
            if (!registry[seqno]) {
                windows.push(window);
                registry[seqno] = true; // there may be duplicates in the list (rare)
            }
        }
    }
    return windows;
}

function restartCinnamon(showOsd = false) {
    if (showOsd) {
        let dialog = new ModalDialog.InfoOSD(_("Restarting Cinnamon..."));
        dialog.actor.add_style_class_name('restart-osd');
        dialog.show();
    }

    global.reexec_self();
}

}