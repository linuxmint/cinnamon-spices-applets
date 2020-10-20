declare function require(path: string): any;

declare class global {
    static log(...any: Array < any > ): void;
    static logError(...text: Array < string > ): void;
    static create_app_launch_context(): imports.gi.Gio.AppLaunchContext;
	static settings: any;
	static set_cursor(cursor: imports.gi.Cinnamon.Cursor): void;
	static unset_cursor(): void;
}

declare namespace imports {
   export const byteArray: ByteArray;
   class ByteArray {
       toString(array: any): string;
   }
}

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

declare namespace imports.ui.themeManager {
    /**
     * Wrapper on Gio.Settings, emits "theme-set" event
     * when theme is changed
     */
    export class ThemeManager {

    }
}

declare namespace imports.ui.main {
    export class KeybindingManager {
        addHotKey(UUID: string, keybinding: any, binding: void): void;
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
        constructor(orientation: gi.St.Side, panelHeight: number, instanceID: number);
        protected set_applet_icon_name(text: string): void;
        protected set_applet_icon_symbolic_name(iconName: string): void;
        protected set_applet_label(text: string): void;
        protected set_applet_tooltip(text: string): void;
        protected setAllowedLayout(text: string): void;
        protected hide_applet_label(hide: boolean): void;
        protected set_show_label_in_vertical_panels (show: boolean): void;
        protected hide_applet_icon(): void;
        protected panel: any;
        protected actor: imports.gi.St.BoxLayout;
        protected _applet_context_menu: any;
    }

    /**
     * #AppletPopupMenu:
     * @short_description: Applet left-click menu
     *
     * A popupmenu menu (left-click menu) to be used by an applet
     *
     * Inherits: PopupMenu.PopupMenu
     */
    export class AppletPopupMenu extends popupMenu.PopupMenu {
        constructor(context: any, orinentation: imports.gi.St.Side);

        _onOrientationChanged(a: any, orientation: string): void;
        _onOpenStateChanged(menu: any, open: any, sourceActor: any): void;
        setCustomStyleClass(classname: string): void;
        addActor(menu: any): void;
        toggle(): void;
        passEvents: boolean;
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

declare namespace imports.misc.signalManager {
    export class SignalManager {
        connect(obj: any, sigName: string, callback: Function, bind: any, force?: boolean): void
    }
}

declare namespace imports.ui.popupMenu {
    export class PopupMenuBase {
        constructor(context: any);
        box: imports.gi.St.BoxLayout;
    }
    export class PopupMenuManager {
        constructor(context: any);
        addMenu(menu: any): void;
        _signals: misc.signalManager.SignalManager;
    }
    export class PopupMenu extends PopupMenuBase {
        constructor();
        public customStyleClass: string;
        public actor: imports.gi.St.Bin;
    }
    export class PopupIconMenuItem {

    }

    export class PopupSeparatorMenuItem {
        actor: gi.St.Widget;
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

declare namespace imports.ui.tweener {
    export function addTween(actor: gi.St.Widget, params: any): void;
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
	enum Cursor {
		//INCOMPLETE
		POINTING_HAND,
	}
}
declare namespace imports.gi.Soup {
    export class SessionAsync {
        user_agent: string;
        queue_message(message: Message, callback: (session: SessionAsync, message: Message) => void): void;
        send_async(msg: Message, cancellable: any, callback: Gio.AsyncReadyCallback): any;
        send_finish(result: Gio.AsyncResult, user_data ? : Object): any;
        request(uri_string: string): SoupRequest;
        /**
         * Cancels all pending requests in this and closes all idle
         *   persistent connections.
         */
        abort(): void;
        /**
         * The timeout (in seconds) for socket I/O operations
            (including connecting to a server, and waiting for a reply
            to an HTTP request).

            Although you can change this property at any time, it will
            only affect newly-created connections, not currently-open
            ones. You can call Soup.Session.abort after setting this
            if you want to ensure that all future connections will have
            this timeout value.

            Note that the default value of 60 seconds only applies to
            plain Soup.Sessions. If you are using Soup.SessionAsync or
            Soup.SessionSync, the default value is 0 (meaning socket I/O
            will not time out).

            Not to be confused with Soup.Session.idle-timeout (which is
            the length of time that idle persistent connections will be
            kept open).
        */
        timeout: number;
        /**
         * Connection lifetime (in seconds) when idle. Any connection
            left idle longer than this will be closed.

            Although you can change this property at any time, it will
            only affect newly-created connections, not currently-open
            ones. You can call Soup.Session.abort after setting this
            if you want to ensure that all future connections will have
            this timeout value.

            Note that the default value of 60 seconds only applies to
            plain Soup.Sessions. If you are using Soup.SessionAsync or
            Soup.SessionSync, the default value is 0 (meaning idle
            connections will never time out).
        */
        idle_timeout: number;
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
}

declare namespace imports.gi.St {
    export class Widget extends Clutter.Actor {
        constructor(options?: any);
        destroy(): void;
        style_class: string;
        connect(id: string, binding: (...args: any) => any): void;
		add_style_class_name(style_class: string): void; 
		add_style_pseudo_class(style_class: string): void; 
		remove_style_pseudo_class(pseudo_class: string): void;
        get_style_class_name(): string;
        remove_style_class_name(style_class: string): void;
        get_style(): string;
        set_style(style: string): string;
        get_theme(): imports.gi.St.Theme;
        get_theme_node(): ThemeNode;
        show(): void;
		hide(): void;
		style: string;
    }

    export class BoxLayout extends Widget {
        constructor(options ? : any)
        /** Deprecated, use add_child instead */
        add_actor(element: Widget): void;
        add_child(element: Widget): void;
        add(element: Widget, options?: AddOptions): void;
        /** private function by default? */


    }
    export class Bin extends Widget {
        constructor(options ? : any)
        get_child(): Widget;
        set_child(widget: Widget): void;
    }
    export class DrawingArea extends Widget {
        constructor(options ? : any)
        queue_repaint(): void;
        get_context(): any;
        get_surface_size(): number[];
        width: number;
    }
    export class Label extends Widget {
		text: string;
		get_clutter_text(): gi.Clutter.Text;
		clutter_text: gi.Clutter.Text;
        constructor(options ? : any);
    }
    export class Icon extends Widget {
        icon_type: IconType;
        icon_size: number;
        icon_name: string;
        constructor(options ? : any);
    }
    export class Button extends Widget {
        reactive: boolean;
        label: string;
        url: string;
        child: any;
        constructor(options ? : any);
    }

    export class ScrollView  extends Widget {
		set_row_size(row_size:number): void;
		get_row_size(): number;
        set_policy(hscroll: any, vscroll: any): void;
        get_vscroll_bar(): ScrollBar;
        get_hscroll_bar(): ScrollBar;
		overlay_scrollbars: boolean; 
		"hscrollbar-policy": Gtk.PolicyType;
		"vscrollbar-policy": Gtk.PolicyType;
		"hscrollbar-visible": boolean;
		"vscrollbar-visible": boolean;
        clip_to_allocation: boolean;
        constructor(options ? : any);
	}
	
	export class ScrollBar extends Widget {
		get_adjustment(): Adjustment;
		set_adjustment(adjustment: Adjustment): void;
	}

	export class Adjustment {
		set_value(value: number): void; 
	}

    export class Theme {
        constructor();
        get_custom_stylesheets(): imports.gi.Gio.File[]; 
    }

    export class ThemeNode {
        constructor();
        get_length(property: string): number;
        get_foreground_color(): Color;
        get_background_color(): Color;
        geometry_equal(other: ThemeNode): boolean;
        get_background_gradient(): any;
        get_background_image(): imports.gi.Gio.File;
        get_background_image_shadow(): any //shadow;
        get_background_paint_box(allocation: any): any; //clutter.ActorBox
        get_border_color(side: Side): Color;
        get_border_image(): any; //BorderImage
        get_border_radius(corner: any): number;
        get_border_width(side: Side): number;
        get_box_shadow(): any; //shadow
        get_color(property_name: string): Color;
        /*get_content_box(allocation)
        get_double(property_name)
        get_element_classes()
        get_element_id()
        get_element_type()
        get_font()
        get_font_features()
        get_foreground_color()
        get_height()
        get_horizontal_padding()
        get_icon_colors()
        get_icon_style()
        get_length(property_name)
        get_letter_spacing()*/
        get_margin(side: Side): number;
        /*get_max_height()
        get_max_width()
        get_min_height()
        get_min_width()
        get_outline_color()
        get_outline_width()*/
        get_padding(side: Side): number;
        /*get_paint_box(allocation)
        get_parent()
        get_pseudo_classes()
        get_shadow(property_name)
        get_text_align()
        get_text_decoration()
        get_text_shadow()
        get_theme()
        get_transition_duration()
        get_url(property_name)
        get_vertical_padding()
        get_width()
        hash()
        invalidate_background_image()
        invalidate_border_image()
        lookup_color(property_name, inherit)
        lookup_double(property_name, inherit)
        lookup_length(property_name, inherit)
        lookup_shadow(property_name, inherit)
        lookup_time(property_name, inherit)
        lookup_url(property_name, inherit)
        paint_equal(other)*/
        to_string(): string;
    }

    export enum Side {
		TOP,
		RIGHT,
		BOTTOM,
		LEFT
	}
	
    export enum IconType {
        SYMBOLIC,
        FULLCOLOR
    }

    export enum Align {
        START,
        MIDDLE,
        END
    }

    /*export enum PolicyType {
        ALWAYS,
        AUTOMATIC,
        EXTERNAL,
        NEVER
    }*/

    /**
     * Colors are represented by a number from 0 to 255
     */
    export interface Color {
        red: number;
        green: number;
        blue: number;
        alpha: number;
        to_string(): string;
    }

    export interface Shadow {

    }

    export interface AddOptions {
        x_fill?: boolean;
        x_align?: Align;
        y_align?: Align;
        y_fill?: boolean;
        expand?: boolean;
    }
}

declare namespace imports.misc.config {
    export const PACKAGE_VERSION: string;
}
declare namespace imports.misc.util {
    export function spawnCommandLine(CMDSettings: string): void;
    export function spawn_async(cmd: string[], callback: Function): any;
    export function trySpawnCommandLine(CMDSettings: string): void;
}

declare namespace imports.gettext {
    function bindtextdomain(UUID: string, homeDir: string): void;

    function dgettext(UUID: string, text: string): string;
}

declare namespace imports {
    export const lang: any;
}