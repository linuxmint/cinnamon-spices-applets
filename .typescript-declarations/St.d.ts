declare namespace imports.gi.St {


	// CLASSES

	export class Adjustment {
		actor: Clutter.Actor;
		lower: number;
		page_increment: number;
		page_size: number;
		step_increment: number;
		upper: number;
		value: number;
		set_value(value: number): void;
		/**
		 * @returns :
		 - value (Number) — the current value
		 - lower (Number) — the lower bound
		 - upper (Number) — the upper bound
		 - step_increment (Number) — the step increment
		 - page_increment (Number) — the page increment
		 - page_size (Number) — the page size
		 */
		get_values(): number[];
		get_value(): number;
	}


	interface BinOptions extends WidgetOptions {
		child: Clutter.Actor | null,
		x_align: Align,
		y_align: Align,
		x_fill: boolean,
		y_fill: boolean
	}


	interface Bin extends BinOptions, WidgetMethodsReadableProps {
		get_child(): Widget;
		set_child(widget: Widget): void
	}

	export class Bin {
		constructor(options?: Partial<BinOptions>)
	}

	export class BorderImage {

	}

	type BoxLayoutOptionsType = WidgetOptions

	interface BoxLayoutOptions extends BoxLayoutOptionsType {
		vertical: boolean;
		pack_start: boolean;
	}

	interface BoxLayoutMethodsReadableProps extends WidgetMethodsReadableProps {
		add(element: Widget, options?: AddOptions): void;
		/**
		 * Get the value of the St.BoxLayout.pack-start property.
		 * @returns true if pack-start is enabled
		 */
		get_pack_start(): boolean;
		/**
		 * Get the value of the St.BoxLayout.vertical property.
		 * @returns true if the layout is vertical
		 */
		get_vertical(): boolean;
		/**
		 * Set the value of the St.BoxLayout.pack-start property.
		 * @param pack_start true if the layout should use pack-start
		 */
		set_pack_start(pack_start: boolean): void;
		/**
		 * Set the value of the St.BoxLayout.vertical property
		 * @param vertical true if the layout should be vertical
		 */
		set_vertical(vertical: boolean): void; 
	}

	interface BoxLayout extends BoxLayoutOptions, BoxLayoutMethodsReadableProps, Scrollable { }

	export class BoxLayout {
		constructor(options?: Partial<BoxLayoutOptions>)
	}

	interface ButtonOptions extends BinOptions {
		label: string;
	}

	interface IButtonMethodsReadableProps {
		connect(signal: 'clicked', callback: (actor: this, clicked_button: number) => void): number
	}

	type ButtonType = ButtonOptions & IButtonMethodsReadableProps & Bin

	interface Button extends ButtonType { }

	export class Button {
		constructor(options?: Partial<ButtonOptions>);
	}

	export class Clipboard {
		static get_default(): Clipboard;
		set_text(type: ClipboardType, text: string): void
	}

	interface IDrawingArea {
		queue_repaint(): void;
		get_context(): gi.cairo.Context;
		get_surface_size(): number[];
		connect(signal: 'repaint', callback: (actor: this) => void): number
	}

	type DrawingAreaType = IDrawingArea & Widget
	interface DrawingArea extends DrawingAreaType { }

	export class DrawingArea {
		constructor(options?: Partial<WidgetOptions>)
	}

	export class Entry {

	}

	export class FocusManager extends gi.GObject.Object {
		public static get_for_stage(stage: gi.Clutter.Stage): FocusManager;
		public add_group(root: Widget): void;
		public get_group(widget: Widget): Widget;
		public navigate_from_event(event: Clutter.Event): boolean;
		public remove_group(root: Widget): void;
	}

	export class GenericAccessible {

	}

	type IconOptionsType = WidgetOptions

	interface IconOptions extends IconOptionsType {

		/** The fallback Gio.Icon to display if St.Icon.gicon fails to load. */
		fallback_gicon: Gio.Icon
		/** The fallback icon name of the St.Icon. See St.Icon.set_fallback_icon_name 
		 * for details. */
		fallback_icon_name: string
		/** The Gio.Icon being displayed by this St.Icon. */
		gicon: Gio.Icon
		/** The name of the icon if the icon being displayed is a Gio.ThemedIcon. */
		icon_name: string;
		/** The size of the icon, if greater than 0. Other the icon size is derived 
		 * from the current style. */
		icon_size: number;
		icon_type: IconType;
	}

	interface Icon extends IconOptions, WidgetMethodsReadableProps {
		/**
		 * Gets the currently set fallback Gio.Icon
		 * 
		 * @returns The fallback Gio.Icon, if set, otherwise null
		 */
		get_fallback_gicon(): Gio.Icon


		/**
		 * This is a convenience method to get the icon name of the fallback 
		 * Gio.ThemedIcon that is currently set.
		 * 
		 * @returns The name of the icon or null if no icon is set
		 */
		get_fallback_icon_name(): string

		/**
		 * Gets the current Gio.Icon in use.
		 * 
		 * @returns The current Gio.Icon, if set, otherwise null
		 */
		get_gicon(): Gio.Icon

		/**
		 * This is a convenience method to get the icon name of the current icon, if it
		 * is currenyly a Gio.ThemedIcon, or null otherwise.
		 * 
		 * @returns The name of the icon or null
		 */
		get_icon_name(): string

		/**
		 * Gets the explicit size set using St.Icon.set_icon_size for the icon. 
		 * This is not necessarily the size that the icon will be displayed at.
		 * 
		 * @returns The explicitly set size, or -1 if no size has been set
		 */
		get_icon_size(): number

		/**
		 * Sets a fallback Gio.Icon to show if the normal icon fails to load.
		 * If fallback_gicon is null or fails to load, the icon is unset and no
		 * texture will be visible for the fallback icon.
		 * 
		 * @param fallback_gicon the fallback Gio.Icon
		 */
		set_fallback_gicon(fallback_gicon: Gio.Icon): void

		/**
		 * This is a convenience method to set the fallback Gio.Icon to a Gio.ThemedIcon
		 * created using the given icon name. If fallback_icon_name is an empty
		 * string, null or fails to load, the icon is unset and no texture will
		 * be visible for the fallback icon.
		 * 
		 * @param fallback_icon_name the name of the fallback icon
		 */
		set_fallback_icon_name(fallback_icon_name: string): void

		/**
		 * Sets a Gio.Icon to show for the icon. If gicon is null or fails to load,
		 * the fallback icon set using st_icon_set_fallback_icon() will be shown.
		 * 
		 * @param gicon 
		 */
		set_gicon(gicon: Gio.Icon): void

		/**
		 * This is a convenience method to set the Gio.Icon to a Gio.ThemedIcon created
		 * using the given icon name. If icon_name is an empty string, null or
		 * fails to load, the fallback icon will be shown.
		 * 
		 * @param icon_name the name of the icon
		 */
		set_icon_name(icon_name: string): void


		/**
		 * Sets an explicit size for the icon. Setting size to -1 will use the size
		 * defined by the current style or the default icon size.
		 * 
		 * @param size if positive, the new size, otherwise the size will be
		 * derived from the current style
		 */
		set_icon_size(size: number): void

		set_icon_type(icon_type: IconType): void
	}

	export class Icon {
		constructor(options?: Partial<IconOptions>);
	}

	export class ImageContent {

	}

	type LabelOptionsType = WidgetOptions

	interface LabelOptions extends LabelOptionsType {
		clutter_text: gi.Clutter.Text;
		text: string;
	}

	interface Label extends LabelOptions, WidgetMethodsReadableProps {
		get_text(): string;
		set_text(text: string): void
		get_clutter_text(): gi.Clutter.Text;
	}

	export class Label {
		constructor(options?: Partial<LabelOptions>);
	}


	export class PasswordEntry {

	}
	interface IScrollBar {
		get_adjustment(): Adjustment;
		set_adjustment(adjustment: Adjustment): void;
		connect(signal: 'scroll-start' | 'scroll-stop', callback: (actor: this) => void): number
	}

	type ScrollBarType = IScrollBar & Widget
	interface ScrollBar extends ScrollBarType { }

	export class ScrollBar {
		get_adjustment(): Adjustment;
		set_adjustment(adjustment: Adjustment): void;
	}

	interface ScrollViewOptions extends BinOptions {
		overlay_scrollbars: boolean;
		hscrollbar_policy: Gtk.PolicyType;
		vscrollbar_policy: Gtk.PolicyType;
		hscrollbar_visible: boolean;
		vscrollbar_visible: boolean;
	}

	interface ScrollView extends ScrollViewOptions, Bin {
		set_row_size(row_size: number): void;
		get_row_size(): number;
		set_policy(hscroll: any, vscroll: any): void;
		get_vscroll_bar(): ScrollBar;
		get_hscroll_bar(): ScrollBar;
	}

	export class ScrollView {

		constructor(options?: Partial<ScrollViewOptions>);
	}
	export class ScrollViewFade {

	}

	interface Scrollable {
		hadjustment: Adjustment;
		vadjustment: Adjustment;
		get_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): [hadjustment: Adjustment, vadjustment: Adjustment];
		set_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): void;
	}
	export class Settings {

	}
	export class TextureCache {

	}
	export class Theme {
		constructor();
		get_custom_stylesheets(): imports.gi.Gio.File[];
	}
	export class ThemeContext {
		/**
		 * Gets a singleton theme context associated with the stage.
		 * @param stage  a Clutter.Stage
		 * @returns the singleton theme context for the stage
		 */
		static get_for_stage(stage: gi.Clutter.Stage): ThemeContext;
		/**
		 * Create a new theme context not associated with any Clutter.Stage.
		 * This can be useful in testing scenarios, or if using StThemeContext
		 * with something other than Clutter.Actor objects, but you generally
		 * should use St.ThemeContext.get_for_stage instead.
		 * @returns  a new St.ThemeContext
		 */
		static new(): ThemeContext;

		/** The scaling factor used for HiDPI scaling. */
		scale_factor: number;
		/**
		 * Gets the default font for the theme context. See St.ThemeContext.set_font.
		 * @returns the default font for the theme context.
		 */
		get_font(): Pango.FontDescription;
		/**
		 * Gets the root node of the tree of theme style nodes that associated with this
		 * context. For the node tree associated with a stage, this node represents
		 * styles applied to the stage itself.
		 * @returns the root node of the context's style tree
		 */
		get_root_node(): ThemeNode;
		/**
		 * Return the current scale factor of this.
		 * @returns an integer scale factor
		 */
		//get_scale_factor(): number;
		/**
		 * Gets the default theme for the context. See St.ThemeContext.set_theme
		 * @returns the default theme for the context
		 */
		get_theme(): Theme;
		/**
		 * Return an existing node matching node, or if that isn't possible,
		 * node itself.	
		 * @param node 
		 * @returns a node with the same properties as node
		 */
		intern_node(node: ThemeNode): ThemeNode;
		/**
		 * 
		 * Sets the default font for the theme context. This is the font that
		 * is inherited by the root node of the tree of theme nodes. If the
		 * font is not overridden, then this font will be used. If the font is
		 * partially modified (for example, with 'font-size: 110%'), then that
		 * modification is based on this font.
		 * @param font the default font for theme context
		 */
		set_font(font: Pango.FontDescription): void;
		/**
		 * Sets the default set of theme stylesheets for the context. This theme will
		 * be used for the root node and for nodes descending from it, unless some other
		 * style is explicitly specified.
		 * @param theme 
		 */
		set_theme(theme: Theme): void;

		connect(signal: "changed" | "changed::scale_factor", callback: () => void): void;
	}
	export class ThemeNode {
		constructor();
		get_length(property: string): number;
		get_foreground_color(): Clutter.Color;
		get_background_color(): Clutter.Color;
		geometry_equal(other: ThemeNode): boolean;
		get_background_gradient(): any;
		get_background_image(): imports.gi.Gio.File;
		get_background_image_shadow(): any //shadow;
		get_background_paint_box(allocation: any): any; //clutter.ActorBox
		get_border_color(side: Side): Clutter.Color;
		get_border_image(): any; //BorderImage
		get_border_radius(corner: any): number;
		get_border_width(side: Side): number;
		get_box_shadow(): any; //shadow
		get_color(property_name: string): Clutter.Color;
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
	export class Viewport {

	}

	interface WidgetOptions extends Clutter.ActorOptions {
		/** Object instance's name for assistive technology access */
		accessible_name: string;
		/** The accessible role of this object */
		accessible_role: Atk.Role;
		/** Whether or not the widget can be focused via keyboard navigation */
		can_focus: boolean;
		/** Whether or not the pointer is currently hovering over the widget. This is
		 * only tracked automatically if St.Widget.track-hover is true, but you can
		 * adjust it manually in any case. */
		hover: boolean;
		/** An actor that labels this widget. */
		label_actor: gi.Clutter.Actor;
		/** The pseudo-class of the actor. Typical values include "hover", "active", "focus". */
		pseudo_class: string;
		/** Inline style information for the actor as a ';'-separated list of CSS properties. */
		style: string;
		/** The style-class of the actor for use in styling. */
		style_class: string;
		/** Determines whether the widget tracks pointer hover state. If 
		 * true (and the widget is visible and reactive), the 
		 * St.Widget.hover property and "hover" style pseudo class will be 
		 * adjusted automatically as the pointer moves in and out of the 
		 * widget.
		 */
		track_hover: boolean;

		// no idea where it comes from but it exists
		important: boolean
	}

	interface IWidgetMethodsReadableProps {
		add_accessible_state(state: Atk.StateType): void
		add_style_class_name(style_class: string): void;
		add_style_pseudo_class(style_class: string): void;
		change_style_pseudo_class(style_class: string, active: boolean): void;
		destroy(): void;
		remove_style_pseudo_class(pseudo_class: string): void;
		get_style_class_name(): string;
		set_style_class_name(style_class_list: string): void;
		remove_style_class_name(style_class: string): void;
		get_direction(): TextDirection;
		get_style(): string;
		set_style(style: string): string;
		get_theme(): imports.gi.St.Theme;
		get_theme_node(): ThemeNode;
		peek_theme_node(): ThemeNode;
		show(): void;
		hide(): void;
		ensure_style(): void;
		navigate_focus(from: Clutter.Actor, direction: St.DirectionType, wrap_around: boolean): boolean
		remove_accessible_state(state: Atk.StateType): void
		connect(signal: 'style-changed' | 'popup-menu' | 'notify::hover', callback: (actor: this) => boolean | void): number;
	}

	// This is the only way we can extend a class when its bases has different signatures. 
	// See: https://github.com/linuxmint/cinnamon-spices-applets/pull/3766
	type WidgetMethodsReadableProps = IWidgetMethodsReadableProps & Clutter.ActorMethodsReadableProps

	interface Widget extends WidgetOptions, WidgetMethodsReadableProps { }

	export class Widget {
		constructor(options?: Partial<WidgetOptions>);
	}
	export class WidgetAccessible {

	}

	interface TableAddOptions {
		row: number,
		col: number,
		col_span: number,
		x_expand: boolean,
		y_expand: boolean,
		x_fill: boolean,
		y_fill: boolean,
		x_align: Align,
	}

	export class Table extends Widget {
		row_count: number

		add(actor: Clutter.Actor, options: Partial<TableAddOptions>): void
	}

	export class Content {
		get_preferred_size(): any[];
		invalidate(): void;
		invalidate_size(): void;
	}

	interface IImage {
		get_texture(): any;
	}

	type ImageExtends = Content & gi.GObject.Object;
	interface Image extends ImageExtends { }
	export class Image {
		static new(): Image;
	}

	// ENUMS


	export enum Align {
		START,
		MIDDLE,
		END
	}
	export enum BackgroundSize {

	}
	export enum ClipboardType {
		CLIPBOARD,
		PRIMARY
	}
	export enum Corner {

	}
	/** Enumeration for focus direction. */
	export enum DirectionType {
		/** Move forward. */
		TAB_FORWARD = 0,
		/** Move backward. */
		TAB_BACKWARD = 1,
		/** Move up. */
		UP = 2,
		/** Move down. */
		DOWN = 3,
		/** Move left. */
		LEFT = 4,
		/** Move right. */
		RIGHT = 5
	}
	export enum GradientType {

	}
	export enum IconStyle {
		/** Lookup the style requested in the icon name. */
		REQUESTED = 0,
		/** Try to always load regular icons, even when symbolic
		icon names are given. */
		REGULAR = 1,
		/** Try to always load symbolic icons, even when regular
		icon names are given. */
		SYMBOLIC = 2
	}
	export enum IconType {
		SYMBOLIC,
		FULLCOLOR
	}
	export enum PolicyType {
		ALWAYS = 0,
		AUTOMATIC = 1,
		NEVER = 2,
		EXTERNAL = 3
	}
	export enum Side {
		TOP = 0,
		RIGHT = 1,
		BOTTOM = 2,
		LEFT = 3
	}
	/** Used to align text in a label. */
	export enum TextAlign {
		LEFT = 0,
		CENTER = 1,
		RIGHT = 2,
		JUSTIFY = 3
	}
	export enum TextureCachePolicy {

	}
	export enum TextDirection {
		/** Use the default setting, as returned
		by Clutter.get_default_text_direction */
		DEFAULT = 0,
		/** Use left-to-right text direction */
		LTR = 1,
		/** Use right-to-left text direction */
		RTL = 2
	}

	// INTERFACES

	export interface Shadow {

	}

	export interface AddOptions {
		x_fill?: boolean;
		x_align?: Align;
		y_align?: Align;
		y_fill?: boolean;
		expand?: boolean;
	}

	// FUNCTIONS
	/**
	 * Creates a string describing actor, for use in debugging. This
	 * includes the class name and actor name (if any), plus if actor
	 * is an St.Widget, its style class and pseudo class names.
	 * @param actor  a Clutter.Actor
	 * @returns the debug name.
	 */
	export function describe_actor(actor: Clutter.Actor): string;
}
