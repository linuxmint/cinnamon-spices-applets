declare function require(path: string): any;

declare function setInterval(callback: { (): void }, delay: number): number;
declare function clearInterval(intervalID: number): void;
declare function setTimeout(callback: { (): void }, delay: number): number;
declare function clearTimeout(timouetId: number): void;

declare class global {
    static log(...any: Array<any>): void;
    static logWarning(...any: Array<any>): void;
    static logError(...text: Array<string>): void;
    static create_app_launch_context(): imports.gi.Gio.AppLaunchContext;
    /** Main Cinnamon settings */
    static settings: imports.gi.Gio.Settings;
    static set_cursor(cursor: imports.gi.Cinnamon.Cursor): void;
    static unset_cursor(): void;
    /** equivalent to imports.gi.Meta */
    static screen: any;
    static display: imports.gi.Meta.Display;
    static stage: imports.gi.Clutter.Stage;
    /** Gets the pointer coordinates and current modifier key state */
    static get_pointer(): [number, number, imports.gi.Clutter.ModifierType]
    /**
     * Sets the pointer coordinates
     * 
     * @param x the X coordinate of the pointer, in global coordinates
     * @param y the Y coordinate of the pointer, in global coordinates
     */
    static set_pointer(x: number, y: number): void
    static focus_manager: imports.gi.St.FocusManager

    static ui_scale: number

    static stage_input_mode: imports.gi.Cinnamon.StageInputMode


}

interface String {
    format(...args: string[]): string
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

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

/** DEPRECATED. Mainloop is simply a layer of convenience and backwards-compatibility over some GLib functions (such as `GLib.timeout_add()` which in GJS is mapped to `g_timeout_add_full()`). It's use is not generally recommended anymore */
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
        addSignalMethods(protoype: any): void
    }
}