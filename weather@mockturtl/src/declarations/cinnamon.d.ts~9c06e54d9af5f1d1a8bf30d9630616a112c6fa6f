declare function require(path: string): any;

declare class global {
    static log(...text: Array < string > ): void;
    static logError(...text: Array < string > ): void;
    static create_app_launch_context(): imports.gi.Gio.AppLaunchContext;
}

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

declare namespace imports.ui.main {
    export class KeybindingManager {
        addHotKey(UUID: string, keybinding: any, binding: void): void;
    }

    export const messageTray: any;

    export const keybindingManager: KeybindingManager;
    /**
     * getThemeStylesheet:
     *
     * Get the theme CSS file that Cinnamon will load
     *
     * Returns (string): A file path that contains the theme CSS,
     *                   null if using the default
     */
    export function getThemeStyleSheet(): string;
    /**
     * setThemeStylesheet:
     * @cssStylesheet (string): A file path that contains the theme CSS,
     *                         set it to null to use the default
     *
     * Set the theme CSS file that Cinnamon will load
     */
    export function setThemeStyleSheet(cssStylesheet: string): void
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
    export function criticalNotify(msg: string, details: string, icon: any): void;
    /**
     * warningNotify:
     * @msg: A warning message
     * @details: Additional information
     */
    export function warningNotify(msg: string, details: string, icon: any): void;
    /**
     * @msg An error message
     * @details Additional information
     *
     * See cinnamon_global_notify_problem().
     */
    export function notifyError(msg: string, details: string): void;
    /**
     * @arg : A single argument.
     * @recursion Keeps track of the number of recursions.
     * @depth Controls how deeply to inspect object structures.
     *
     * Used by _log to handle each argument type and its formatting.
     */
    export function formatLogArgument(arg ? : any, recursion ? : number, depth ? : number): void;

    /**
     * @obj (Object): the object to be tested
     *
     * Tests whether @obj is an error object
     *
     * Returns (boolean): whether @obj is an error object
     */
    export function isError(obj: object): boolean;

    /**
     * @stack the stack trace
     *
     * Prints the stack trace to the LookingGlass
     * error stream in a predefined format
     */
    export function _LogTraceFormatted(stack: string): void;

    /**
     * @msg An error object
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
    export function _logTrace(msg: Error): void;
    /**
     * @msg An error object or the message string
     *
     * Logs the message to the LookingGlass error
     * stream.
     *
     * If msg is an error, its stack-trace will be
     * printed.
     */
    export function _logWarning(msg: Error | string): void;

    /**
     * @msg The message string
     * @error The error object
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
    export function _logError(msg ? : string, error ? : Error): void;

    // If msg is an Error, its message will be printed as 'info' and its stack-trace will be printed as 'trace'
    /**
     * @msg The error object or the message string
     *
     * Logs the message to the LookingGlass
     * error stream. If @msg is an Error object,
     * its stack trace will also be printed
     */
    export function _logInfo(msg: Error | string): void;
}

declare namespace imports.ui.applet {
    /**
     * #Applet
     * @short_description: Base applet class
     *
     * @actor (St.BoxLayout): Actor of the applet
     * @instance_id (int): Instance id of the applet
     * @_uuid (string): UUID of the applet. This is set by appletManager *after*
     * the applet is loaded.
     * @_panelLocation (St.BoxLayout): Panel sector containing the applet. This is
     * set by appletManager *after* the applet is loaded.
     * @panel (Panel.Panel): The panel object containing the applet. This is set by
     * appletManager *after* the applet is loaded.
     * @_meta (JSON): The metadata of the applet. This is set by appletManager
     * *after* the applet is loaded.
     * @_order (int): The order of the applet within a panel location This is set
     * by appletManager *after* the applet is loaded.
     * @_draggable (Dnd._Draggable): The draggable object of the applet
     * @_applet_tooltip (Tooltips.PanelItemTooltip): The tooltip of the applet
     * @_menuManager (PopupMenu.PopupMenuManager): The menu manager of the applet
     * @_applet_context_menu (Applet.AppletContextMenu): The context menu of the applet
     * @_applet_tooltip_text (string): Text of the tooltip
     * @_allowedLayout (Applet.AllowedLayout): The allowed layout of the applet. This
     * determines the type of panel an applet is allowed in. By default this is set
     * to Applet.AllowedLayout.HORIZONTAL
     *
     * Base applet class that other applets can inherit
     */
    export class Applet {

    }

    export class TextIconApplet {
        constructor(orientation: string, panelHeight: number, instanceID: number);
        protected set_applet_icon_name(text: string): void;
        protected set_applet_icon_symbolic_name(iconName: string): void;
        protected set_applet_label(text: string): void;
        protected set_applet_tooltip(text: string): void;
        protected setAllowedLayout(text: string): void;
        protected hide_applet_label(hide: boolean): void;
    }

    /**
     * #AppletPopupMenu:
     * @short_description: Applet left-click menu
     *
     * A popupmenu menu (left-click menu) to be used by an applet
     *
     * Inherits: PopupMenu.PopupMenu
     */
    export class AppletPopupMenu extends popupMenu.PopupIconMenuItem {
        constructor(context: any, orinentation: string);

        _onOrientationChanged(a: any, orientation: string): void;
        _onOpenStateChanged(menu: any, open: any, sourceActor: any): void;
        setCustomStyleClass(classname: string): void;
        actor: any;
        addActor(menu: any): void;
        toggle(): void;
    }

    /**
     * #AppletContextMenu
     * @short_description: Applet right-click menu
     *
     * A context menu (right-click menu) to be used by an applet
     *
     * Inherits: PopupMenu.PopupMenu
     */
    export class AppletContextMenu extends popupMenu.PopupMenu {
        constructor(launcher: any, orientation: string);

        _onOpenStateChanged(menu: any, open: any, sourceActor: any): void;
    }
    /**
     * #MenuItem
     * @short_description: Deprecated. Use #PopupMenu.PopupIconMenuItem instead.
     */
    export class MenuItem {
        constructor(itemLabel: string, GTKEdit: any, binding: Function);
    }

    export interface AllowedLayouts {
        BOTH: string,
            VERTICAL: string,
            HORIZONTAL: string;
    }
    export const AllowedLayout: AllowedLayouts;
}

declare namespace imports.ui.messageTray {
    export class Notification {
        constructor(source: SystemNotificationSource, title: string, message: string);
        setTransient(value: boolean): void;
    }

    export class SystemNotificationSource {
        constructor(name: string)

        notify(notification: Notification): void;
    }
}

declare namespace imports.ui.popupMenu {
    export class PopupMenuManager {
        constructor(context: any);
        addMenu(menu: any): void;
    }
    export class PopupMenu {
        constructor();
    }
    export class PopupIconMenuItem {

    }
}
declare namespace imports.ui.settings {
    export class AppletSettings {
        constructor(context: any, UUID: string, instanceID: number);
        setValue(key: string, value: any): void;
        getValue(key: string): any;
        connect(key: string, callback: Function): void;
        bindProperty(direction: BindingDirection, key: string, keyProp: string, callback: Function, something: any): void;
    }

    export enum BindingDirection {
        IN = 1,
        BIDIRECTIONAL = 2,
        OUT = 3
    }



}
declare namespace imports.ui.appletManager {
    export var applets: any;
    export var appletMeta: any;
}

declare namespace imports.mainloop {
    /**
     * Calls callback function after given seconds
     * @param seconds 
     * @param binding 
     */
    export function timeout_add_seconds(seconds: number, binding: () => any): void;
    export function timeout_add(milliseconds: number, binding: () => any, errorCallback: () => null): void;
    export function source_remove(id: any): void;
}

declare namespace imports.gi.Cinnamon {
    function util_format_date(format: string, milliseconds: number): string;
}
declare namespace imports.gi.Soup {
    export class SessionAsync {
        user_agent: string;
        queue_message(message: Message, callback: (session: SessionAsync, message: Message) => void): void;
        send_async(msg: Message, cancellable: any, callback: Gio.AsyncReadyCallback): any;
        send_finish(result: Gio.AsyncResult, user_data ? : Object): any;
        request(uri_string: string): SoupRequest;
    }
    export class Session {
        add_feature(session: SessionAsync, proxyResolver: ProxyResolverDefault): void;
    }

    export class SoupRequest {}

    export class ProxyResolverDefault {

    }
    export class Message {
        static new(method: string, query: string): Message;
        status_code: number;
        reason_phrase: string;
        response_body: SoupMessageBody;
        response_headers: any;
    }

    export interface SoupMessageBody {
        data: string;
        goffset: number;
    }

}
declare namespace imports.gi.St {
    export class Widget {
        destroy(): void;
        style_class: string;
        connect(id: string, binding: (...args: any) => any): void;
    }
    export class BoxLayout extends Widget {
        constructor(options ? : any)
        add_actor(element: Widget): void;
    }
    export class Bin extends Widget {
        constructor(options ? : any)
        get_child(): Widget;
        set_child(widget: Widget): void;
    }
    export class DrawingArea extends Widget {
        constructor(options ? : any)
        width: number;
    }
    export class Label extends Widget {
        text: string;
        constructor(options ? : any);
    }
    export class Icon extends Widget {
        icon_type: string;
        icon_size: number;
        icon_name: string;
        constructor(options ? : any);
    }
    export class Button extends Widget {
        reactive: boolean;
        label: string;
        url: string;
        constructor(options ? : any);
    }

    export interface Sides {
        LEFT: string,
            RIGHT: string
    }
    export interface IconTypes {
        SYMBOLIC: string,
            FULLCOLOR: string
    }

    export const Side: Sides;
    export const IconType: IconTypes;
}

declare namespace imports.misc.config {
    export const PACKAGE_VERSION: string;
}
declare namespace imports.misc.util {
    export function spawnCommandLine(CMDSettings: string): void;
    export function spawn_async(cmd: string[], callback: Function): any;
}

declare namespace imports.gettext {
    function bindtextdomain(UUID: string, homeDir: string): void;

    function dgettext(UUID: string, text: string): string;
}

declare namespace imports {
    export const lang: any;
}