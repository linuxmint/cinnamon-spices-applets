declare function require(path: string): any;

declare class global {
    static log(...any: Array < any > ): void;
    static logError(...text: Array < string > ): void;
    static create_app_launch_context(): imports.gi.Gio.AppLaunchContext;
	static settings: any;
	static set_cursor(cursor: imports.gi.Cinnamon.Cursor): void;
	static unset_cursor(): void;
}

declare class __meta {
    static uuid: string;
    static path: string;
    static name: string;
    static description: string;
    static "max-instances": number;
    static multiversion: boolean;
    static author: string;
    static "last-edited": number;
    static error: any;
    static "force-loaded": boolean
}

declare class GJSError {
    stack: any;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    domain: number;
    code: number;
    message: string;
    toString(): string;
    copy(): Error;
    free(): void;
    matches(domain: number, code: imports.gi.Gio.IOErrorEnum): boolean;
}

declare namespace imports {
   export const byteArray: ByteArray;
   class ByteArray {
       toString(array: Uint8Array): string;
       /**
        * Unknown what it does
        * @param text 
        */
       fromGBytes(text: any): any;
       fromString(text: string): gi.GLib.Bytes;
       fromArray(array: Uint8Array): any;
   }
}

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

declare namespace imports.ui.main {
    export class KeybindingManager {
        addHotKey(UUID: string, keybinding: any, binding: (event: any) => void): void;
    }

    export const themeManager: themeManager.ThemeManager;

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
declare namespace imports.ui.settings {
    export class AppletSettings {
        constructor(context: any, UUID: string, instanceID: number);
        setValue(key: string, value: any): void;
        getValue(key: string): any;
        connect(key: string, callback: Function): void;
        bindProperty(direction: BindingDirection, key: string, keyProp: string, callback: Function, something: any): void;
        bind(key: string, applet_prop: string | boolean | number, callback?: Function, user_data?: any): void
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
    export function timeout_add(milliseconds: number, binding: () => any, errorCallback: () => null): number;
    export function source_remove(id: any): void;
}

declare namespace imports.gi.Cinnamon {
	function util_format_date(format: string, milliseconds: number): string;
	enum Cursor {
		//INCOMPLETE
		DND_UNSUPPORTED_TARGET,
		DND_COPY,
		DND_MOVE,
		POINTING_HAND,
	}

	export class GenericContainer extends gi.St.Widget {

	}
}

declare namespace imports.gettext {
    function bindtextdomain(UUID: string, homeDir: string): void;

    function dgettext(UUID: string, text: string): string;
    function gettext(text: string): string;
}

declare namespace imports {
    export const lang: Lang;
    class Lang {
        bind<T, CTX>(ctx: CTX, func: T): T;
    }
}
