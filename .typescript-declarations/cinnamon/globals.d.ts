declare function require(path: string): any;

declare const setInterval: typeof imports.misc.util.setInterval
declare const clearInterval: typeof imports.misc.util.clearInterval
declare const setTimeout: typeof imports.misc.util.setTimeout
declare const clearTimeout: typeof imports.misc.util.clearTimeout

/** Interface typing for the global variable.
 * Extendable, for example overloading in a d.ts file:
 * @example declare interface GlobalExtensions {
		trayReloading?: boolean;
	}
 */
declare interface Global {
    log: typeof imports.ui.main._logInfo;
    logWarning: typeof imports.ui.main._logWarning
    logError: typeof imports.ui.main._logError
    logTrace: typeof imports.ui.main._logTrace
    
    create_app_launch_context(): imports.gi.Gio.AppLaunchContext;
    /** Main Cinnamon settings */
    settings: imports.gi.Gio.Settings;
    set_cursor(cursor: imports.gi.Cinnamon.Cursor): void;
    unset_cursor(): void;
    /** equivalent to imports.gi.Meta */
    screen: imports.gi.Meta.Screen;
    display: imports.gi.Meta.Display;
    stage: imports.gi.Clutter.Stage;
    /** Gets the pointer coordinates and current modifier key state */
    get_pointer(): [number, number, imports.gi.Clutter.ModifierType]
    /**
     * Sets the pointer coordinates
     * 
     * @param x the X coordinate of the pointer, in global coordinates
     * @param y the Y coordinate of the pointer, in global coordinates
     */
    set_pointer(x: number, y: number): void
    focus_manager: imports.gi.St.FocusManager

    ui_scale: number;

    stage_input_mode: imports.gi.Cinnamon.StageInputMode;

    reparentActor(actor_before: imports.gi.Clutter.Actor, actor_after: imports.gi.Clutter.Actor): void
}

declare const global: Global;

interface String {
    format(...args: string[]): string
}

declare interface  Meta {
    uuid: string;
    path: string;
    name: string;
    description: string;
    "max-instances": number;
    multiversion: boolean;
    author: string;
    "last-edited": number;
    error: any;
    "force-loaded": boolean
}

declare const __meta: Meta

declare const __dirname: string
declare const __filename: string

declare class GJSError extends Error {
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

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

/** @deprecated Mainloop is simply a layer of convenience and backwards-compatibility over some GLib functions (such as `GLib.timeout_add()` which in GJS is mapped to `g_timeout_add_full()`). It's use is not generally recommended anymore */
declare namespace imports.mainloop {
    /**
     * Calls callback function after given seconds
     * @param seconds 
     * @param binding 
     */
    export function timeout_add_seconds(seconds: number, binding: () => any): void;
    export function timeout_add(milliseconds: number, binding: () => any, errorCallback?: () => null): number;
    export function source_remove(id: any): void;
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

    export const signals: Signals

    class Signals {
        addSignalMethods(prototype: any): void
    }
}

declare namespace imports.gi {
    const versions: Record<string, string>;
}