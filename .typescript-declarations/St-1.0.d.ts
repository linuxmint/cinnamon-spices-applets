declare namespace imports.gi.St {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Adjustment} instead.
	 */
	interface IAdjustment {
		/**
		 * If the adjustment is used as #ClutterAnimatable for a
		 * #ClutterPropertyTransition, this property is used to determine which
		 * monitor should drive the animation.
		 */
		actor: Clutter.Actor;
		/**
		 * The minimum value of the adjustment.
		 */
		lower: number;
		/**
		 * The page increment of the adjustment.
		 */
		page_increment: number;
		/**
		 * The page size of the adjustment.
		 * 
		 * Note that the page-size is irrelevant and should be set to zero if the
		 * adjustment is used for a simple scalar value.
		 */
		page_size: number;
		/**
		 * The step increment of the adjustment.
		 */
		step_increment: number;
		/**
		 * The maximum value of the adjustment.
		 * 
		 * Note that values will be restricted by `upper - page-size` if
		 * {@link Adjustment}:page-size is non-zero.
		 */
		upper: number;
		/**
		 * The value of the adjustment.
		 */
		value: number;
		/**
		 * Add a #ClutterTransition for the adjustment. If the transition stops, it will
		 * be automatically removed if #ClutterTransition:remove-on-complete is %TRUE.
		 * @param name a unique name for the transition
		 * @param transition a #ClutterTransition
		 */
		add_transition(name: string, transition: Clutter.Transition): void;
		/**
		 * Adjusts the adjustment using delta values from a scroll event.
		 * You should use this instead of using st_adjustment_set_value()
		 * as this method will tweak the values directly using the same
		 * math as GTK+, to ensure that scrolling is consistent across
		 * the environment.
		 * @param delta A delta, retrieved directly from clutter_event_get_scroll_delta()
		 *   or similar.
		 */
		adjust_for_scroll_event(delta: number): void;
		/**
		 * Set {@link Adjustment}:value to a value clamped between #lower and #upper. The
		 * clamping described by st_adjustment_set_value() still applies.
		 * @param lower the lower value
		 * @param upper the upper value
		 */
		clamp_page(lower: number, upper: number): void;
		/**
		 * Get the #ClutterTransition for #name previously added with
		 * st_adjustment_add_transition() or %NULL if not found.
		 * @param name a transition name
		 * @returns a #ClutterTransition
		 */
		get_transition(name: string): Clutter.Transition | null;
		/**
		 * Gets the current value of the adjustment. See st_adjustment_set_value().
		 * @returns The current value of the adjustment
		 */
		get_value(): number;
		/**
		 * Gets all of #adjustment's values at once.
		 * @returns the current value
		 * 
		 * the lower bound
		 * 
		 * the upper bound
		 * 
		 * the step increment
		 * 
		 * the page increment
		 * 
		 * the page size
		 */
		get_values(): [ value: number | null, lower: number | null, upper: number | null, step_increment: number | null, page_increment: number | null, page_size: number | null ];
		remove_transition(name: string): void;
		/**
		 * Sets the {@link Adjustment} value. The value is clamped to lie between
		 * #StAdjustment:lower and #StAdjustment:upper - #StAdjustment:page-size.
		 * @param value the new value
		 */
		set_value(value: number): void;
		/**
		 * Sets all properties of the adjustment at once.
		 * 
		 * Use this function to avoid multiple emissions of the #GObject::notify and
		 * {@link Adjustment}::changed signals. See st_adjustment_set_lower() for an
		 * alternative way of compressing multiple emissions of #GObject::notify into
		 * one.
		 * @param value the new value
		 * @param lower the new minimum value
		 * @param upper the new maximum value
		 * @param step_increment the new step increment
		 * @param page_increment the new page increment
		 * @param page_size the new page size
		 */
		set_values(value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number): void;
		/**
		 * Emitted when any of the adjustment properties have changed, except for
		 * {@link Adjustment}:value.
		 */
		connect(signal: "changed", callback: (owner: this) => void): number;

		connect(signal: "notify::actor", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::lower", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::page_increment", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::page_size", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::step_increment", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::upper", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::value", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Adjustment} instead.
	 */
	type AdjustmentMixin = IAdjustment & GObject.Object & Clutter.Animatable;

	interface Adjustment extends AdjustmentMixin {}

	class Adjustment {
		public constructor();
		/**
		 * Creates a new {@link Adjustment}
		 * @param actor a #ClutterActor
		 * @param value the initial value
		 * @param lower the minimum value
		 * @param upper the maximum value
		 * @param step_increment the step increment
		 * @param page_increment the page increment
		 * @param page_size the page size
		 * @returns a new {@link Adjustment}
		 */
		public static new(actor: Clutter.Actor | null, value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number): Adjustment;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	interface IBin {
		/**
		 * The child #ClutterActor of the {@link Bin} container.
		 */
		child: Clutter.Actor;
		/**
		 * Gets the #ClutterActor child for #bin.
		 * @returns a #ClutterActor, or %NULL
		 */
		get_child(): Clutter.Actor | null;
		/**
		 * Sets #child as the child of #bin.
		 * 
		 * If #bin already has a child, the previous child is removed.
		 * @param child a #ClutterActor, or %NULL
		 */
		set_child(child: Clutter.Actor | null): void;
		connect(signal: "notify::child", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	type BinMixin = IBin & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Bin extends BinMixin {}

	class Bin {
		public constructor();
		/**
		 * Creates a new {@link Bin}, a simple container for one child.
		 * @returns the newly created {@link Bin} actor
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BorderImage} instead.
	 */
	interface IBorderImage {
		/**
		 * Check if two {@link BorderImage} objects are identical.
		 * @param other a different {@link BorderImage}
		 * @returns %TRUE if the two border image objects are identical
		 */
		equal(other: BorderImage): boolean;
		get_borders(border_top: number, border_right: number, border_bottom: number, border_left: number): void;
		/**
		 * Get the #GFile for #image.
		 * @returns a #GFile
		 */
		get_file(): Gio.File;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BorderImage} instead.
	 */
	type BorderImageMixin = IBorderImage & GObject.Object;

	interface BorderImage extends BorderImageMixin {}

	class BorderImage {
		public constructor();
		/**
		 * Creates a new {@link BorderImage}.
		 * @param file a #GFile
		 * @param border_top the top border
		 * @param border_right the right border
		 * @param border_bottom the bottom border
		 * @param border_left the left border
		 * @param scale_factor the scale factor
		 * @returns a new {@link BorderImage}.
		 */
		public static new(file: Gio.File, border_top: number, border_right: number, border_bottom: number, border_left: number, scale_factor: number): BorderImage;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayout} instead.
	 */
	interface IBoxLayout {
		/**
		 * A convenience property for the #ClutterBoxLayout:pack-start property of the
		 * internal layout for {@link BoxLayout}.
		 */
		pack_start: boolean;
		/**
		 * A convenience property for the #ClutterBoxLayout:vertical property of the
		 * internal layout for {@link BoxLayout}.
		 */
		vertical: boolean;
		/**
		 * Get the value of the {@link BoxLayout}:pack-start property.
		 * @returns %TRUE if pack-start is enabled
		 */
		get_pack_start(): boolean;
		/**
		 * Get the value of the {@link BoxLayout}:vertical property.
		 * @returns %TRUE if the layout is vertical
		 */
		get_vertical(): boolean;
		/**
		 * Set the value of the {@link BoxLayout}:pack-start property.
		 * @param pack_start %TRUE if the layout should use pack-start
		 */
		set_pack_start(pack_start: boolean): void;
		/**
		 * Set the value of the {@link BoxLayout}:vertical property
		 * @param vertical %TRUE if the layout should be vertical
		 */
		set_vertical(vertical: boolean): void;
		connect(signal: "notify::pack_start", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vertical", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayout} instead.
	 */
	type BoxLayoutMixin = IBoxLayout & Viewport & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable & Scrollable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface BoxLayout extends BoxLayoutMixin {}

	class BoxLayout {
		public constructor();
		/**
		 * Create a new {@link BoxLayout}.
		 * @returns a newly allocated {@link BoxLayout}
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Button} instead.
	 */
	interface IButton {
		/**
		 * Which buttons will trigger the {@link Button}::clicked signal.
		 */
		button_mask: ButtonMask;
		/**
		 * If {@link Button}:toggle-mode is %TRUE, indicates if the #StButton is toggled
		 * "on" or "off".
		 * 
		 * When the value is %TRUE, the #StButton will have the `checked` CSS
		 * pseudo-class set.
		 */
		checked: boolean;
		/**
		 * The label of the {@link Button}.
		 */
		label: string;
		/**
		 * In contrast to {@link Button}:checked, this property indicates whether the
		 * #StButton is being actively pressed, rather than just in the "on" state.
		 */
		readonly pressed: boolean;
		/**
		 * Whether the {@link Button} is operating in toggle mode (on/off).
		 */
		toggle_mode: boolean;
		/**
		 * If this widget is holding a pointer grab, this function will
		 * will ungrab it, and reset the {@link Button}:pressed state.  The effect is
		 * similar to if the user had released the mouse button, but without
		 * emitting the #StButton::clicked signal.
		 * 
		 * This function is useful if for example you want to do something
		 * after the user is holding the mouse button for a given period of
		 * time, breaking the grab.
		 */
		fake_release(): void;
		/**
		 * Gets the mask of mouse buttons that #button emits the
		 * {@link Button}::clicked signal for.
		 * @returns the mask of mouse buttons that #button emits the
		 * {@link Button}::clicked signal for.
		 */
		get_button_mask(): ButtonMask;
		/**
		 * Get the {@link Button}:checked property of a #StButton that is in toggle mode.
		 * @returns %TRUE if the button is checked, or %FALSE if not
		 */
		get_checked(): boolean;
		/**
		 * Get the text displayed on the button. If the label is empty, an empty string
		 * will be returned instead of %NULL.
		 * @returns the text for the button
		 */
		get_label(): string;
		/**
		 * Get the toggle mode status of the button.
		 * @returns %TRUE if toggle mode is set, otherwise %FALSE
		 */
		get_toggle_mode(): boolean;
		/**
		 * Sets which mouse buttons #button emits {@link Button}::clicked for.
		 * @param mask the mask of mouse buttons that #button responds to
		 */
		set_button_mask(mask: ButtonMask): void;
		/**
		 * Set the {@link Button}:checked property of the button. This is only really useful
		 * if the button has #StButton:toggle-mode property set to %TRUE.
		 * @param checked %TRUE or %FALSE
		 */
		set_checked(checked: boolean): void;
		/**
		 * Sets the text displayed on the button.
		 * @param text text to set the label to
		 */
		set_label(text: string | null): void;
		/**
		 * Enables or disables toggle mode for the button. In toggle mode, the active
		 * state will be "toggled" when the user clicks the button.
		 * @param toggle %TRUE or %FALSE
		 */
		set_toggle_mode(toggle: boolean): void;
		/**
		 * Emitted when the user activates the button, either with a mouse press and
		 * release or with the keyboard.
		 */
		connect(signal: "clicked", callback: (owner: this, clicked_button: number) => void): number;

		connect(signal: "notify::button_mask", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::checked", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::label", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::pressed", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::toggle_mode", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Button} instead.
	 */
	type ButtonMixin = IButton & Bin & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Button extends ButtonMixin {}

	class Button {
		public constructor();
		/**
		 * Create a new button
		 * @returns a new {@link Button}
		 */
		public static new(): Widget;
		/**
		 * Create a new {@link Button} with the specified label
		 * @param text text to set the label to
		 * @returns a new {@link Button}
		 */
		public static new_with_label(text: string): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clipboard} instead.
	 */
	interface IClipboard {
		/**
		 * Request the data from the clipboard in #GBytes form. #callback is executed
		 * when the data is retrieved.
		 * @param type The type of clipboard data you want
		 * @param mimetype The mimetype to get content for
		 * @param callback function to be called when the type is retrieved
		 */
		get_content(type: ClipboardType, mimetype: string, callback: ClipboardContentCallbackFunc): void;
		/**
		 * Gets a list of the mimetypes supported by the default {@link Clipboard}.
		 * @param type
		 * @returns the supported mimetypes
		 */
		get_mimetypes(type: ClipboardType): GLib.List;
		/**
		 * Request the data from the clipboard in text form. #callback is executed
		 * when the data is retrieved.
		 * @param type The type of clipboard data you want
		 * @param callback function to be called when the text is retrieved
		 */
		get_text(type: ClipboardType, callback: ClipboardCallbackFunc): void;
		/**
		 * Sets the clipboard content to #bytes.
		 * 
		 * #mimetype is a semi-colon separated list of mime-type strings.
		 * @param type The type of clipboard that you want to set
		 * @param mimetype content mimetype
		 * @param bytes content data
		 */
		set_content(type: ClipboardType, mimetype: string, bytes: GLib.Bytes): void;
		/**
		 * Sets text as the current contents of the clipboard.
		 * @param type The type of clipboard that you want to set
		 * @param text text to copy to the clipboard
		 */
		set_text(type: ClipboardType, text: string): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clipboard} instead.
	 */
	type ClipboardMixin = IClipboard & GObject.Object;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Clipboard extends ClipboardMixin {}

	class Clipboard {
		public constructor();
		/**
		 * Get the global {@link Clipboard} object that represents the clipboard.
		 * @returns a {@link Clipboard} owned by St and must not be
		 * unrefferenced or freed.
		 */
		public static get_default(): Clipboard;
		/**
		 * Sets the #MetaSelection of the default {@link Clipboard}.
		 * 
		 * This function is called during the initialization of GNOME Shell.
		 * @param selection
		 */
		public static set_selection(selection: Meta.Selection): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DrawingArea} instead.
	 */
	interface IDrawingArea {
		/**
		 * Gets the Cairo context to paint to. This function must only be called
		 * from a signal handler or virtual function for the {@link DrawingArea}::repaint
		 * signal.
		 * 
		 * JavaScript code must call the special dispose function before returning from
		 * the signal handler or virtual function to avoid leaking memory:
		 * 
		 * |[<!-- language="JavaScript" -->
		 * function onRepaint(area) {
		 *     let cr = area.get_context();
		 * 
		 *     // Draw to the context
		 * 
		 *     cr.$dispose();
		 * }
		 * 
		 * let area = new St.DrawingArea();
		 * area.connect('repaint', onRepaint);
		 * ]|
		 * @returns the Cairo context for the paint operation
		 */
		get_context(): cairo.Context;
		/**
		 * Gets the size of the cairo surface being painted to, which is equal
		 * to the size of the content area of the widget. This function must
		 * only be called from a signal handler for the {@link DrawingArea}::repaint signal.
		 * @returns location to store the width of the painted area
		 * 
		 * location to store the height of the painted area
		 */
		get_surface_size(): [ width: number | null, height: number | null ];
		/**
		 * Will cause the actor to emit a {@link DrawingArea}::repaint signal before it is
		 * next drawn to the scene. Useful if some parameters for the area being
		 * drawn other than the size or style have changed. Note that
		 * clutter_actor_queue_redraw() will simply result in the same
		 * contents being drawn to the scene again.
		 */
		queue_repaint(): void;
		connect(signal: "repaint", callback: (owner: this) => void): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DrawingArea} instead.
	 */
	type DrawingAreaMixin = IDrawingArea & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface DrawingArea extends DrawingAreaMixin {}

	class DrawingArea {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Entry} instead.
	 */
	interface IEntry {
		/**
		 * The internal #ClutterText actor supporting the {@link Entry}.
		 */
		readonly clutter_text: Clutter.Text;
		/**
		 * A #ClutterActor to display when the entry is empty and unfocused. Setting
		 * this will replace the actor displaying {@link Entry}:hint-text.
		 */
		hint_actor: Clutter.Actor;
		/**
		 * The text to display when the entry is empty and unfocused. Setting this
		 * will replace the actor of {@link Entry}::hint-actor.
		 */
		hint_text: string;
		/**
		 * The #ClutterInputContentHintFlags providing additional hints (beyond
		 * {@link Entry}:input-purpose) that allow input methods to fine-tune their
		 * behaviour.
		 */
		input_hints: Clutter.InputContentHintFlags;
		/**
		 * The #ClutterInputContentPurpose that helps on-screen keyboards and similar
		 * input methods to decide which keys should be presented to the user.
		 */
		input_purpose: Clutter.InputContentPurpose;
		/**
		 * The #ClutterActor acting as the primary icon at the start of the {@link Entry}.
		 */
		primary_icon: Clutter.Actor;
		/**
		 * The #ClutterActor acting as the secondary icon at the end of the {@link Entry}.
		 */
		secondary_icon: Clutter.Actor;
		/**
		 * The current text value of the {@link Entry}.
		 */
		text: string;
		/**
		 * Retrieve the internal #ClutterText so that extra parameters can be set.
		 * @returns the #ClutterText used by #entry
		 */
		get_clutter_text(): Clutter.Actor;
		/**
		 * Get the value of the {@link Entry}:hint-actor property.
		 * @returns a #ClutterActor
		 */
		get_hint_actor(): Clutter.Actor | null;
		/**
		 * Gets the text that is displayed when the entry is empty and unfocused or
		 * %NULL if the {@link Entry}:hint-actor was set to an actor that is not a #StLabel.
		 * 
		 * Unlike st_entry_get_text() this function may return %NULL if
		 * #StEntry:hint-actor is not a #StLabel.
		 * @returns the current value of the hint property
		 */
		get_hint_text(): string | null;
		/**
		 * Gets the value of the {@link Entry}:input-hints property.
		 * @returns the input hints for the entry
		 */
		get_input_hints(): Clutter.InputContentHintFlags;
		/**
		 * Gets the value of the {@link Entry}:input-purpose property.
		 * @returns the input purpose of the entry
		 */
		get_input_purpose(): Clutter.InputContentPurpose;
		/**
		 * Get the value of the {@link Entry}:primary-icon property.
		 * @returns a #ClutterActor
		 */
		get_primary_icon(): Clutter.Actor | null;
		/**
		 * Get the value of the {@link Entry}:secondary-icon property.
		 * @returns a #ClutterActor
		 */
		get_secondary_icon(): Clutter.Actor | null;
		/**
		 * Get the text displayed on the entry. If #entry is empty, an empty string will
		 * be returned instead of %NULL.
		 * @returns the text for the entry
		 */
		get_text(): string;
		/**
		 * Set the hint actor of the entry to #hint_actor.
		 * @param hint_actor a #ClutterActor
		 */
		set_hint_actor(hint_actor: Clutter.Actor | null): void;
		/**
		 * Sets the text to display when the entry is empty and unfocused. When the
		 * entry is displaying the hint, it has a pseudo class of `indeterminate`.
		 * A value of %NULL unsets the hint.
		 * @param text text to set as the entry hint
		 */
		set_hint_text(text: string | null): void;
		/**
		 * Sets the {@link Entry}:input-hints property, which
		 * allows input methods to fine-tune their behaviour.
		 * @param hints the hints
		 */
		set_input_hints(hints: Clutter.InputContentHintFlags): void;
		/**
		 * Sets the {@link Entry}:input-purpose property which
		 * can be used by on-screen keyboards and other input
		 * methods to adjust their behaviour.
		 * @param purpose the purpose
		 */
		set_input_purpose(purpose: Clutter.InputContentPurpose): void;
		/**
		 * Set the primary icon of the entry to #icon.
		 * @param icon a #ClutterActor
		 */
		set_primary_icon(icon: Clutter.Actor | null): void;
		/**
		 * Set the secondary icon of the entry to #icon.
		 * @param icon an #ClutterActor
		 */
		set_secondary_icon(icon: Clutter.Actor | null): void;
		/**
		 * Sets the text displayed on the entry. If #text is %NULL, the #ClutterText
		 * will instead be set to an empty string.
		 * @param text text to set the entry to
		 */
		set_text(text: string | null): void;
		/**
		 * Emitted when the primary icon is clicked.
		 */
		connect(signal: "primary-icon-clicked", callback: (owner: this) => void): number;
		/**
		 * Emitted when the secondary icon is clicked.
		 */
		connect(signal: "secondary-icon-clicked", callback: (owner: this) => void): number;

		connect(signal: "notify::clutter_text", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hint_actor", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hint_text", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::input_hints", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::input_purpose", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::primary_icon", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::secondary_icon", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Entry} instead.
	 */
	type EntryMixin = IEntry & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Entry extends EntryMixin {}

	class Entry {
		public constructor();
		/**
		 * Create a new {@link Entry} with the specified text.
		 * @param text text to set the entry to
		 * @returns a new {@link Entry}
		 */
		public static new(text: string | null): Widget;
		/**
		 * This function is for private use by libgnome-shell.
		 * Do not ever use.
		 * @param func
		 */
		public static set_cursor_func(func: EntryCursorFunc): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FocusManager} instead.
	 */
	interface IFocusManager {
		/**
		 * Adds a new focus group to #manager. When the focus is in an actor
		 * that is a descendant of #root, #manager will handle moving focus
		 * from one actor to another within #root based on keyboard events.
		 * @param root the root container of the group
		 */
		add_group(root: Widget): void;
		/**
		 * Checks if #widget is inside a focus group, and if so, returns
		 * the root of that group.
		 * @param widget an {@link Widget}
		 * @returns the focus group root, or %NULL if
		 * #widget is not in a focus group
		 */
		get_group(widget: Widget): Widget;
		/**
		 * Try to navigate from #event as if it bubbled all the way up to
		 * the stage. This is useful in complex event handling situations
		 * where you want key navigation, but a parent might be stopping
		 * the key navigation event from bubbling all the way up to the stage.
		 * @param event a #ClutterEvent
		 * @returns Whether a new actor was navigated to
		 */
		navigate_from_event(event: Clutter.Event): boolean;
		/**
		 * Removes the group rooted at #root from #manager
		 * @param root the root container of the group
		 */
		remove_group(root: Widget): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FocusManager} instead.
	 */
	type FocusManagerMixin = IFocusManager & GObject.Object;

	/**
	 * The {@link FocusManager} struct contains only private data
	 */
	interface FocusManager extends FocusManagerMixin {}

	class FocusManager {
		public constructor();
		/**
		 * Gets the {@link FocusManager} for #stage, creating it if necessary.
		 * @param stage a #ClutterStage
		 * @returns the focus manager for #stage
		 */
		public static get_for_stage(stage: Clutter.Stage): FocusManager;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GenericAccessible} instead.
	 */
	interface IGenericAccessible {

		/**
		 * Emitted when atk_value_get_current_value() is called on
		 * #self. Right now we only care about doubles, so the value is
		 * directly returned by the signal.
		 */
		connect(signal: "get-current-value", callback: (owner: this) => number): number;
		/**
		 * Emitted when atk_value_get_maximum_value() is called on
		 * #self. Right now we only care about doubles, so the value is
		 * directly returned by the signal.
		 */
		connect(signal: "get-maximum-value", callback: (owner: this) => number): number;
		/**
		 * Emitted when atk_value_get_minimum_increment() is called on
		 * #self. Right now we only care about doubles, so the value is
		 * directly returned by the signal.
		 */
		connect(signal: "get-minimum-increment", callback: (owner: this) => number): number;
		/**
		 * Emitted when atk_value_get_current_value() is called on
		 * #self. Right now we only care about doubles, so the value is
		 * directly returned by the signal.
		 */
		connect(signal: "get-minimum-value", callback: (owner: this) => number): number;
		/**
		 * Emitted when atk_value_set_current_value() is called on
		 * #self. Right now we only care about doubles, so the value is
		 * directly returned by the signal.
		 */
		connect(signal: "set-current-value", callback: (owner: this, new_value: number) => void): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GenericAccessible} instead.
	 */
	type GenericAccessibleMixin = IGenericAccessible & WidgetAccessible & Atk.Action & Atk.Component & Atk.Value;

	interface GenericAccessible extends GenericAccessibleMixin {}

	class GenericAccessible {
		public constructor();
		/**
		 * Create a new {@link GenericAccessible} for #actor.
		 * 
		 * This is useful only for custom widgets that need a proxy for #AtkObject.
		 * @param actor a #Clutter Actor
		 * @returns a new #AtkObject
		 */
		public static new_for_actor(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Icon} instead.
	 */
	interface IIcon {
		/**
		 * The fallback #GIcon to display if {@link Icon}:gicon fails to load.
		 */
		fallback_gicon: Gio.Icon;
		/**
		 * The fallback icon name of the {@link Icon}. See st_icon_set_fallback_icon_name()
		 * for details.
		 */
		fallback_icon_name: string;
		/**
		 * The #GIcon being displayed by this {@link Icon}.
		 */
		gicon: Gio.Icon;
		/**
		 * The name of the icon if the icon being displayed is a #GThemedIcon.
		 */
		icon_name: string;
		/**
		 * The size of the icon, if greater than `0`. Other the icon size is derived
		 * from the current style.
		 */
		icon_size: number;
		/**
		 * Gets the currently set fallback #GIcon.
		 * @returns The fallback #GIcon, if set, otherwise %NULL
		 */
		get_fallback_gicon(): Gio.Icon;
		/**
		 * This is a convenience method to get the icon name of the fallback
		 * #GThemedIcon that is currently set.
		 * @returns The name of the icon or %NULL if no icon is set
		 */
		get_fallback_icon_name(): string;
		/**
		 * Gets the current #GIcon in use.
		 * @returns The current #GIcon, if set, otherwise %NULL
		 */
		get_gicon(): Gio.Icon | null;
		/**
		 * This is a convenience method to get the icon name of the current icon, if it
		 * is currenyly a #GThemedIcon, or %NULL otherwise.
		 * @returns The name of the icon or %NULL
		 */
		get_icon_name(): string | null;
		/**
		 * Gets the explicit size set using st_icon_set_icon_size() for the icon.
		 * This is not necessarily the size that the icon will be displayed at.
		 * @returns The explicitly set size, or -1 if no size has been set
		 */
		get_icon_size(): number;
		/**
		 * Sets a fallback #GIcon to show if the normal icon fails to load.
		 * If #fallback_gicon is %NULL or fails to load, the icon is unset and no
		 * texture will be visible for the fallback icon.
		 * @param fallback_gicon the fallback #GIcon
		 */
		set_fallback_gicon(fallback_gicon: Gio.Icon | null): void;
		/**
		 * This is a convenience method to set the fallback #GIcon to a #GThemedIcon
		 * created using the given icon name. If #fallback_icon_name is an empty
		 * string, %NULL or fails to load, the icon is unset and no texture will
		 * be visible for the fallback icon.
		 * @param fallback_icon_name the name of the fallback icon
		 */
		set_fallback_icon_name(fallback_icon_name: string | null): void;
		/**
		 * Sets a #GIcon to show for the icon. If #gicon is %NULL or fails to load,
		 * the fallback icon set using st_icon_set_fallback_icon() will be shown.
		 * @param gicon a #GIcon
		 */
		set_gicon(gicon: Gio.Icon | null): void;
		/**
		 * This is a convenience method to set the #GIcon to a #GThemedIcon created
		 * using the given icon name. If #icon_name is an empty string, %NULL or
		 * fails to load, the fallback icon will be shown.
		 * @param icon_name the name of the icon
		 */
		set_icon_name(icon_name: string | null): void;
		/**
		 * Sets an explicit size for the icon. Setting #size to -1 will use the size
		 * defined by the current style or the default icon size.
		 * @param size if positive, the new size, otherwise the size will be
		 *   derived from the current style
		 */
		set_icon_size(size: number): void;
		connect(signal: "notify::fallback_gicon", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::fallback_icon_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::gicon", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::icon_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::icon_size", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Icon} instead.
	 */
	type IconMixin = IIcon & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface Icon extends IconMixin {}

	class Icon {
		public constructor();
		/**
		 * Create a newly allocated {@link Icon}.
		 * @returns A newly allocated {@link Icon}
		 */
		public static new(): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ImageContent} instead.
	 */
	interface IImageContent {
		preferred_height: number;
		preferred_width: number;

		connect(signal: "notify::preferred_height", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::preferred_width", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ImageContent} instead.
	 */
	type ImageContentMixin = IImageContent & Clutter.Image & Clutter.Content & Gio.Icon & Gio.LoadableIcon;

	interface ImageContent extends ImageContentMixin {}

	class ImageContent {
		public constructor();
		/**
		 * Creates a new {@link ImageContent}, a simple content for sized images.
		 * 
		 * See #ClutterImage for setting the actual image to display or #StIcon for
		 * displaying icons.
		 * @param width The preferred width to be used when drawing the content
		 * @param height The preferred width to be used when drawing the content
		 * @returns the newly created {@link ImageContent} content
		 *   Use g_object_unref() when done.
		 */
		public static new_with_preferred_size(width: number, height: number): Clutter.Content;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Label} instead.
	 */
	interface ILabel {
		/**
		 * The internal #ClutterText actor supporting the label
		 */
		readonly clutter_text: Clutter.Text;
		/**
		 * The current text being display in the {@link Label}.
		 */
		text: string;
		/**
		 * Retrieve the internal #ClutterText used by #label so that extra parameters
		 * can be set.
		 * @returns the #ClutterText used by {@link Label}. The actor
		 * is owned by the #StLabel and should not be destroyed by the application.
		 */
		get_clutter_text(): Clutter.Actor;
		/**
		 * Get the text displayed on the label.
		 * @returns the text for the label. This must not be freed by
		 * the application
		 */
		get_text(): string;
		/**
		 * Sets the text displayed by the label.
		 * @param text text to set the label to
		 */
		set_text(text: string | null): void;
		connect(signal: "notify::clutter_text", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Label} instead.
	 */
	type LabelMixin = ILabel & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Label extends LabelMixin {}

	class Label {
		public constructor();
		/**
		 * Create a new {@link Label} with the label specified by #text.
		 * @param text text to set the label to
		 * @returns a new {@link Label}
		 */
		public static new(text: string | null): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PasswordEntry} instead.
	 */
	interface IPasswordEntry {
		/**
		 * Whether the text in the entry is masked for privacy.
		 */
		password_visible: boolean;
		/**
		 * Whether to display an icon button to toggle the masking enabled by the
		 * {@link PasswordEntry}:password-visible property.
		 */
		show_peek_icon: boolean;
		/**
		 * Gets whether the text is masked in the password entry.
		 * @returns %TRUE if visible
		 */
		get_password_visible(): boolean;
		/**
		 * Gets whether peek-icon is shown or hidden in the password entry.
		 * @returns %TRUE if visible
		 */
		get_show_peek_icon(): boolean;
		/**
		 * Sets whether to show or hide text in the password entry.
		 * @param value %TRUE to show the password in the entry, #FALSE otherwise
		 */
		set_password_visible(value: boolean): void;
		/**
		 * Sets whether to show or hide the peek-icon in the password entry. If %TRUE,
		 * a icon button for temporarily unmasking the password will be shown at the
		 * end of the entry.
		 * @param value %TRUE to show the peek-icon in the entry
		 */
		set_show_peek_icon(value: boolean): void;
		connect(signal: "notify::password_visible", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::show_peek_icon", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PasswordEntry} instead.
	 */
	type PasswordEntryMixin = IPasswordEntry & Entry & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface PasswordEntry extends PasswordEntryMixin {}

	class PasswordEntry {
		public constructor();
		/**
		 * Create a new {@link PasswordEntry}.
		 * @returns a new {@link Entry}
		 */
		public static new(): Entry;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollBar} instead.
	 */
	interface IScrollBar {
		/**
		 * The {@link Adjustment} controlling the #StScrollBar.
		 */
		adjustment: Adjustment;
		/**
		 * Whether the {@link ScrollBar} is vertical. If %FALSE it is horizontal.
		 */
		vertical: boolean;
		/**
		 * Gets the {@link Adjustment} that controls the current position of #bar.
		 * @returns an {@link Adjustment}
		 */
		get_adjustment(): Adjustment;
		set_adjustment(adjustment: Adjustment): void;
		/**
		 * Emitted when the {@link ScrollBar} begins scrolling.
		 */
		connect(signal: "scroll-start", callback: (owner: this) => void): number;
		/**
		 * Emitted when the {@link ScrollBar} finishes scrolling.
		 */
		connect(signal: "scroll-stop", callback: (owner: this) => void): number;

		connect(signal: "notify::adjustment", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vertical", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollBar} instead.
	 */
	type ScrollBarMixin = IScrollBar & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface ScrollBar extends ScrollBarMixin {}

	class ScrollBar {
		public constructor();
		public static new(adjustment: Adjustment): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollView} instead.
	 */
	interface IScrollView {
		content_padding: Clutter.Margin;
		/**
		 * Whether to enable automatic mouse wheel scrolling.
		 */
		enable_mouse_scrolling: boolean;
		/**
		 * The horizontal {@link ScrollBar} for the #StScrollView.
		 */
		readonly hscroll: ScrollBar;
		/**
		 * The {@link PolicyType} for when to show the horizontal #StScrollBar.
		 */
		hscrollbar_policy: PolicyType;
		/**
		 * Whether the horizontal {@link ScrollBar} is visible.
		 */
		readonly hscrollbar_visible: boolean;
		/**
		 * Whether scrollbars are painted on top of the content.
		 */
		overlay_scrollbars: boolean;
		/**
		 * The vertical {@link ScrollBar} for the #StScrollView.
		 */
		readonly vscroll: ScrollBar;
		/**
		 * The {@link PolicyType} for when to show the vertical #StScrollBar.
		 */
		vscrollbar_policy: PolicyType;
		/**
		 * Whether the vertical {@link ScrollBar} is visible.
		 */
		readonly vscrollbar_visible: boolean;
		/**
		 * Get the step increment of the horizontal plane.
		 * @returns the horizontal step increment
		 */
		get_column_size(): number;
		/**
		 * Gets the horizontal {@link ScrollBar} of the #StScrollView.
		 * @returns the horizontal scrollbar
		 */
		get_hscroll_bar(): ScrollBar;
		/**
		 * Get whether automatic mouse wheel scrolling is enabled or disabled.
		 * @returns %TRUE if enabled, %FALSE otherwise
		 */
		get_mouse_scrolling(): boolean;
		/**
		 * Gets whether scrollbars are painted on top of the content.
		 * @returns %TRUE if enabled, %FALSE otherwise
		 */
		get_overlay_scrollbars(): boolean;
		/**
		 * Get the step increment of the vertical plane.
		 * @returns the vertical step increment
		 */
		get_row_size(): number;
		/**
		 * Gets the vertical scrollbar of the {@link ScrollView}.
		 * @returns the vertical {@link ScrollBar}
		 */
		get_vscroll_bar(): ScrollBar;
		/**
		 * Set the step increment of the horizontal plane to #column_size.
		 * @param column_size horizontal step increment
		 */
		set_column_size(column_size: number): void;
		/**
		 * Sets automatic mouse wheel scrolling to enabled or disabled.
		 * @param enabled %TRUE or %FALSE
		 */
		set_mouse_scrolling(enabled: boolean): void;
		/**
		 * Sets whether scrollbars are painted on top of the content.
		 * @param enabled Whether to enable overlay scrollbars
		 */
		set_overlay_scrollbars(enabled: boolean): void;
		/**
		 * Set the scroll policy.
		 * @param hscroll Whether to enable horizontal scrolling
		 * @param vscroll Whether to enable vertical scrolling
		 */
		set_policy(hscroll: PolicyType, vscroll: PolicyType): void;
		/**
		 * Set the step increment of the vertical plane to #row_size.
		 * @param row_size vertical step increment
		 */
		set_row_size(row_size: number): void;
		/**
		 * Sets the fade effects in all four edges of the view. A value of 0
		 * disables the effect.
		 * @param fade_margins a #ClutterMargin defining the vertical fade effects, in pixels.
		 */
		update_fade_effect(fade_margins: Clutter.Margin): void;
		connect(signal: "notify::content_padding", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::enable_mouse_scrolling", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hscroll", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hscrollbar_policy", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hscrollbar_visible", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::overlay_scrollbars", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vscroll", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vscrollbar_policy", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vscrollbar_visible", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollView} instead.
	 */
	type ScrollViewMixin = IScrollView & Bin & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface ScrollView extends ScrollViewMixin {}

	class ScrollView {
		public constructor();
		/**
		 * Create a new {@link ScrollView}.
		 * @returns a new {@link ScrollView}
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollViewFade} instead.
	 */
	interface IScrollViewFade {
		/**
		 * Whether faded edges should extend beyond the faded area of the {@link ScrollViewFade}.
		 */
		extend_fade_area: boolean;
		/**
		 * Whether the faded area should extend to the edges of the {@link ScrollViewFade}.
		 */
		fade_edges: boolean;
		/**
		 * The margins widths that are faded.
		 */
		fade_margins: Clutter.Margin;

		connect(signal: "notify::extend_fade_area", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::fade_edges", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::fade_margins", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollViewFade} instead.
	 */
	type ScrollViewFadeMixin = IScrollViewFade & Clutter.ShaderEffect;

	interface ScrollViewFade extends ScrollViewFadeMixin {}

	class ScrollViewFade {
		public constructor();
		/**
		 * Create a new {@link ScrollViewFade}.
		 * @returns a new {@link ScrollViewFade}
		 */
		public static new(): Clutter.Effect;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Settings} instead.
	 */
	interface ISettings {
		/**
		 * The threshold before a drag operation begins.
		 */
		readonly drag_threshold: number;
		/**
		 * Whether animations are enabled.
		 */
		readonly enable_animations: boolean;
		/**
		 * The current font name.
		 */
		readonly font_name: string;
		/**
		 * The current GTK icon theme
		 */
		readonly gtk_icon_theme: string;
		/**
		 * The current GTK theme.
		 */
		readonly gtk_theme: string;
		/**
		 * Whether the accessibility magnifier is active.
		 */
		readonly magnifier_active: boolean;
		/**
		 * Whether pasting from the `PRIMARY` selection is supported (eg. middle-click
		 * paste).
		 */
		readonly primary_paste: boolean;
		/**
		 * The slow-down factor applied to all animation durations.
		 */
		slow_down_factor: number;
		inhibit_animations(): void;
		uninhibit_animations(): void;
		connect(signal: "notify::drag_threshold", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::enable_animations", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::font_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::gtk_icon_theme", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::gtk_theme", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::magnifier_active", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::primary_paste", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::slow_down_factor", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Settings} instead.
	 */
	type SettingsMixin = ISettings & GObject.Object;

	interface Settings extends SettingsMixin {}

	class Settings {
		public constructor();
		/**
		 * Gets the global {@link Settings} object.
		 * @returns the global {@link Settings} object
		 */
		public static get(): Settings;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TextureCache} instead.
	 */
	interface ITextureCache {
		/**
		 * Create a #GIcon which tracks the #cairo_surface_t value of a GObject property
		 * named by #property_name.  Unlike other methods in StTextureCache, the underlying
		 * #CoglTexture is not shared by default with other invocations to this method.
		 * 
		 * If the source object is destroyed, the texture will continue to show the last
		 * value of the property.
		 * @param object A #GObject with a property #property_name of type #cairo_surface_t
		 * @param property_name Name of a property
		 * @returns A new #GIcon
		 */
		bind_cairo_surface_property(object: GObject.Object, property_name: string): Gio.Icon;
		/**
		 * Load an arbitrary texture, caching it.  The string chosen for #key
		 * should be of the form "type-prefix:type-uuid".  For example,
		 * "url:file:///usr/share/icons/hicolor/48x48/apps/firefox.png", or
		 * "stock-icon:gtk-ok".
		 * @param key Arbitrary string used to refer to item
		 * @param policy Caching policy
		 * @param load Function to create the texture, if not already cached
		 * @param data User data passed to #load
		 * @returns A newly-referenced handle to the texture
		 */
		load(key: string, policy: TextureCachePolicy, load: TextureCacheLoader, data: any | null): Cogl.Texture;
		/**
		 * Create a #GIcon from #surface.
		 * @param surface A #cairo_surface_t
		 * @returns A new #GIcon
		 */
		load_cairo_surface_to_gicon(surface: cairo.Surface): Gio.Icon;
		/**
		 * Asynchronously load an image.   Initially, the returned texture will have a natural
		 * size of zero.  At some later point, either the image will be loaded successfully
		 * and at that point size will be negotiated, or upon an error, no image will be set.
		 * @param file a #GFile of the image file from which to create a pixbuf
		 * @param available_width available width for the image, can be -1 if not limited
		 * @param available_height available height for the image, can be -1 if not limited
		 * @param paint_scale scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns A new #ClutterActor with no image loaded initially.
		 */
		load_file_async(file: Gio.File, available_width: number, available_height: number, paint_scale: number, resource_scale: number): Clutter.Actor;
		/**
		 * This function synchronously loads the given file path
		 * into a cairo surface.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file A #GFile in supported image format
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns a new #cairo_surface_t
		 */
		load_file_to_cairo_surface(file: Gio.File, paint_scale: number, resource_scale: number): cairo.Surface;
		/**
		 * This function synchronously loads the given file path
		 * into a COGL texture.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file A #GFile in supported image format
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns a new #CoglTexture
		 */
		load_file_to_cogl_texture(file: Gio.File, paint_scale: number, resource_scale: number): Cogl.Texture;
		/**
		 * This method returns a new #ClutterActor for a given #GIcon. If the
		 * icon isn't loaded already, the texture will be filled
		 * asynchronously.
		 * @param theme_node The {@link ThemeNode} to use for colors, or %NULL
		 *                            if the icon must not be recolored
		 * @param icon the #GIcon to load
		 * @param size Size of themed
		 * @param paint_scale Scale factor of display
		 * @param resource_scale Resource scale factor
		 * @returns A new #ClutterActor for the icon, or %NULL if not found
		 */
		load_gicon(theme_node: ThemeNode | null, icon: Gio.Icon, size: number, paint_scale: number, resource_scale: number): Clutter.Actor | null;
		/**
		 * This function reads a single image file which contains multiple images internally.
		 * The image file will be divided using #grid_width and #grid_height;
		 * note that the dimensions of the image loaded from #path
		 * should be a multiple of the specified grid dimensions.
		 * @param file A #GFile
		 * @param grid_width Width in pixels
		 * @param grid_height Height in pixels
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale
		 * @param load_callback Function called when the image is loaded, or %NULL
		 * @returns A new #ClutterActor
		 */
		load_sliced_image(file: Gio.File, grid_width: number, grid_height: number, paint_scale: number, resource_scale: number, load_callback: GLib.Func | null): Clutter.Actor;
		/**
		 * Rescan the current icon theme, if necessary.
		 * @returns %TRUE if the icon theme has changed and needed to be reloaded.
		 */
		rescan_icon_theme(): boolean;
		/**
		 * Emitted when the icon theme is changed.
		 */
		connect(signal: "icon-theme-changed", callback: (owner: this) => void): number;
		/**
		 * Emitted when the source file of a texture is changed.
		 */
		connect(signal: "texture-file-changed", callback: (owner: this, file: Gio.File) => void): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TextureCache} instead.
	 */
	type TextureCacheMixin = ITextureCache & GObject.Object;

	interface TextureCache extends TextureCacheMixin {}

	class TextureCache {
		public constructor();
		public static get_default(): TextureCache;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Theme} instead.
	 */
	interface ITheme {
		/**
		 * The highest priority stylesheet, representing application-specific
		 * styling; this is associated with the CSS "author" stylesheet.
		 */
		application_stylesheet: Gio.File;
		/**
		 * The lowest priority stylesheet, representing global default
		 * styling; this is associated with the CSS "user agent" stylesheet.
		 */
		default_stylesheet: Gio.File;
		/**
		 * The second priority stylesheet, representing theme-specific styling;
		 * this is associated with the CSS "user" stylesheet.
		 */
		theme_stylesheet: Gio.File;
		/**
		 * Get a list of the stylesheet files loaded with st_theme_load_stylesheet().
		 * @returns the list of stylesheet files
		 *          that were loaded with st_theme_load_stylesheet()
		 */
		get_custom_stylesheets(): GLib.SList;
		/**
		 * Load the stylesheet associated with #file.
		 * @param file a #GFile
		 * @returns %TRUE if successful
		 */
		load_stylesheet(file: Gio.File): boolean;
		/**
		 * Unload the stylesheet associated with #file. If #file was not loaded this
		 * function does nothing.
		 * @param file a #GFile
		 */
		unload_stylesheet(file: Gio.File): void;
		connect(signal: "custom-stylesheets-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::application_stylesheet", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::default_stylesheet", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::theme_stylesheet", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Theme} instead.
	 */
	type ThemeMixin = ITheme & GObject.Object;

	interface Theme extends ThemeMixin {}

	class Theme {
		public constructor();
		public static new(application_stylesheet: Gio.File, theme_stylesheet: Gio.File, default_stylesheet: Gio.File): Theme;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeContext} instead.
	 */
	interface IThemeContext {
		/**
		 * The scaling factor used for HiDPI scaling.
		 */
		scale_factor: number;
		/**
		 * Gets the default font for the theme context. See st_theme_context_set_font().
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
		 * Return the current scale factor of #context.
		 * @returns an integer scale factor
		 */
		get_scale_factor(): number;
		/**
		 * Gets the default theme for the context. See st_theme_context_set_theme()
		 * @returns the default theme for the context
		 */
		get_theme(): Theme;
		/**
		 * Return an existing node matching #node, or if that isn't possible,
		 * #node itself.
		 * @param node a {@link ThemeNode}
		 * @returns a node with the same properties as #node
		 */
		intern_node(node: ThemeNode): ThemeNode;
		/**
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
		 * @param theme a {@link Theme}
		 */
		set_theme(theme: Theme): void;
		/**
		 * Emitted when the icon theme, font, resolution, scale factor or the current
		 * theme's custom stylesheets change.
		 */
		connect(signal: "changed", callback: (owner: this) => void): number;

		connect(signal: "notify::scale_factor", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeContext} instead.
	 */
	type ThemeContextMixin = IThemeContext & GObject.Object;

	interface ThemeContext extends ThemeContextMixin {}

	class ThemeContext {
		public constructor();
		/**
		 * Create a new theme context not associated with any #ClutterStage.
		 * This can be useful in testing scenarios, or if using StThemeContext
		 * with something other than #ClutterActor objects, but you generally
		 * should use st_theme_context_get_for_stage() instead.
		 * @returns a new {@link ThemeContext}
		 */
		public static new(): ThemeContext;
		/**
		 * Gets a singleton theme context associated with the stage.
		 * @param stage a #ClutterStage
		 * @returns the singleton theme context for the stage
		 */
		public static get_for_stage(stage: Clutter.Stage): ThemeContext;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeNode} instead.
	 */
	interface IThemeNode {
		/**
		 * Adjusts a "for height" passed to clutter_actor_get_preferred_width() to
		 * account for borders and padding. This is a convenience function meant
		 * to be called from a get_preferred_width() method of a #ClutterActor
		 * subclass. The value after adjustment is the height available for the actor's
		 * content.
		 */
		adjust_for_height(): void;
		/**
		 * Adjusts a "for width" passed to clutter_actor_get_preferred_height() to
		 * account for borders and padding. This is a convenience function meant
		 * to be called from a get_preferred_height() method of a #ClutterActor
		 * subclass. The value after adjustment is the width available for the actor's
		 * content.
		 */
		adjust_for_width(): void;
		/**
		 * Adjusts the minimum and natural height computed for an actor by
		 * adding on the necessary space for borders and padding and taking
		 * into account any minimum or maximum height. This is a convenience
		 * function meant to be called from the get_preferred_height() method
		 * of a #ClutterActor subclass
		 */
		adjust_preferred_height(): void;
		/**
		 * Adjusts the minimum and natural width computed for an actor by
		 * adding on the necessary space for borders and padding and taking
		 * into account any minimum or maximum width. This is a convenience
		 * function meant to be called from the get_preferred_width() method
		 * of a #ClutterActor subclass
		 */
		adjust_preferred_width(): void;
		/**
		 * Compare two {@link ThemeNodes}. Two nodes which compare equal will match
		 * the same CSS rules and have the same style properties. However, two
		 * nodes that have ended up with identical style properties do not
		 * necessarily compare equal.
		 * 
		 * In detail, #node_a and #node_b are considered equal if and only if:
		 * 
		 * - they share the same #StTheme and #StThemeContext
		 * - they have the same parent
		 * - they have the same element type
		 * - their id, class, pseudo-class and inline-style match
		 * @param node_b second {@link ThemeNode}
		 * @returns %TRUE if #node_a equals #node_b
		 */
		equal(node_b: ThemeNode): boolean;
		/**
		 * Tests if two theme nodes have the same borders and padding; this can be
		 * used to optimize having to relayout when the style applied to a Clutter
		 * actor changes colors without changing the geometry.
		 * @param other a different {@link ThemeNode}
		 * @returns %TRUE if equal, %FALSE otherwise
		 */
		geometry_equal(other: ThemeNode): boolean;
		/**
		 * Gets #node's background color.
		 * @param color location to store the color
		 */
		get_background_color(color: Clutter.Color): void;
		/**
		 * The #start and #end arguments will only be set if #type is not #ST_GRADIENT_NONE.
		 * @param start Color at start of gradient
		 * @param end Color at end of gradient
		 */
		get_background_gradient(start: Clutter.Color, end: Clutter.Color): void;
		get_background_image(): Gio.File;
		/**
		 * Gets the value for the -st-background-image-shadow style property
		 * @returns the node's background image shadow, or
		 *   %NULL if node has no such shadow
		 */
		get_background_image_shadow(): Shadow | null;
		/**
		 * Gets the box used to paint the actor's background, including the area
		 * occupied by properties which paint outside the actor's assigned allocation.
		 * @param allocation the box allocated to a #ClutterActor
		 * @param paint_box computed box occupied when painting the actor's background
		 */
		get_background_paint_box(allocation: Clutter.ActorBox, paint_box: Clutter.ActorBox): void;
		/**
		 * Gets the color of #node's border on #side
		 * @param side a {@link Side}
		 * @param color location to store the color
		 */
		get_border_color(side: Side, color: Clutter.Color): void;
		/**
		 * Gets the value for the border-image style property
		 * @returns the border image, or %NULL
		 *   if there is no border image.
		 */
		get_border_image(): BorderImage;
		/**
		 * Get the border radius for #node at #corner, in physical pixels.
		 * @param corner a {@link Corner}
		 * @returns the border radius in physical pixels
		 */
		get_border_radius(corner: Corner): number;
		/**
		 * Get the border width for #node on #side, in physical pixels.
		 * @param side a {@link Corner}
		 * @returns the border width in physical pixels
		 */
		get_border_width(side: Side): number;
		/**
		 * Gets the value for the box-shadow style property
		 * @returns the node's shadow, or %NULL
		 *   if node has no shadow
		 */
		get_box_shadow(): Shadow | null;
		/**
		 * Generically looks up a property containing a single color value. When
		 * specific getters (like st_theme_node_get_background_color()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * If #property_name is not found, a warning will be logged and a
		 * default color returned.
		 * 
		 * See also st_theme_node_lookup_color(), which provides more options,
		 * and lets you handle the case where the theme does not specify the
		 * indicated color.
		 * @param property_name The name of the color property
		 * @param color location to store the color that
		 *   was determined.
		 */
		get_color(property_name: string, color: Clutter.Color): void;
		/**
		 * Gets the box within an actor's allocation that contents the content
		 * of an actor (excluding borders and padding). This is a convenience function
		 * meant to be used from the allocate() or paint() methods of a #ClutterActor
		 * subclass.
		 * @param allocation the box allocated to a #ClutterAlctor
		 * @param content_box computed box occupied by the actor's content
		 */
		get_content_box(allocation: Clutter.ActorBox, content_box: Clutter.ActorBox): void;
		/**
		 * Generically looks up a property containing a single numeric value
		 *  without units.
		 * 
		 * See also st_theme_node_lookup_double(), which provides more options,
		 * and lets you handle the case where the theme does not specify the
		 * indicated value.
		 * @param property_name The name of the numeric property
		 * @returns the value found. If #property_name is not
		 *  found, a warning will be logged and 0 will be returned.
		 */
		get_double(property_name: string): number;
		/**
		 * Get the list of element classes for #node.
		 * @returns the element's classes
		 */
		get_element_classes(): string[];
		/**
		 * Get the unique element ID for #node.
		 * @returns the element's ID
		 */
		get_element_id(): string;
		/**
		 * Get the element #GType for #node.
		 * @returns the element type
		 */
		get_element_type(): GObject.Type;
		/**
		 * Get the current font of #node as a #PangoFontDescription
		 * @returns the current font
		 */
		get_font(): Pango.FontDescription;
		/**
		 * Get the CSS font-features for #node.
		 * @returns font-features as a string
		 */
		get_font_features(): string;
		/**
		 * Gets #node's foreground color.
		 * @param color location to store the color
		 */
		get_foreground_color(color: Clutter.Color): void;
		/**
		 * Get the height for #node, in physical pixels.
		 * @returns the height in physical pixels
		 */
		get_height(): number;
		/**
		 * Gets the total horizontal padding (left + right padding), in physical pixels.
		 * @returns the total horizontal padding in physical pixels
		 */
		get_horizontal_padding(): number;
		/**
		 * Gets the colors that should be used for colorizing symbolic icons according
		 * the style of this node.
		 * @returns the icon colors to use for this theme node
		 */
		get_icon_colors(): IconColors;
		/**
		 * Get the icon style for #node (eg. symbolic, regular). This corresponds to the
		 * special `-st-icon-style` CSS property.
		 * @returns the icon style for #node
		 */
		get_icon_style(): IconStyle;
		/**
		 * Generically looks up a property containing a single length value. When
		 * specific getters (like st_theme_node_get_border_width()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * Unlike st_theme_node_get_color() and st_theme_node_get_double(),
		 * this does not print a warning if the property is not found; it just
		 * returns 0.
		 * 
		 * See also st_theme_node_lookup_length(), which provides more options. The
		 * returned value is in physical pixels, as opposed to logical pixels.
		 * @param property_name The name of the length property
		 * @returns the length, in pixels, or 0 if the property was not found.
		 */
		get_length(property_name: string): number;
		/**
		 * Gets the value for the letter-spacing style property, in physical pixels.
		 * @returns the value of the letter-spacing property, if
		 *   found, or zero if such property has not been found.
		 */
		get_letter_spacing(): number;
		/**
		 * Get the margin for #node on #side, in physical pixels. This corresponds to
		 * the CSS properties such as `margin-top`.
		 * @param side a {@link Side}
		 * @returns the margin size in physical pixels
		 */
		get_margin(side: Side): number;
		/**
		 * Get the maximum height for #node, in physical pixels.
		 * @returns the maximum height in physical pixels
		 */
		get_max_height(): number;
		/**
		 * Get the maximum width for #node, in physical pixels.
		 * @returns the maximum width in physical pixels
		 */
		get_max_width(): number;
		/**
		 * Get the minimum height for #node, in physical pixels.
		 * @returns the minimum height in physical pixels
		 */
		get_min_height(): number;
		/**
		 * Get the minimum width for #node, in physical pixels.
		 * @returns the minimum width in physical pixels
		 */
		get_min_width(): number;
		/**
		 * Gets the color of #node's outline.
		 * @param color location to store the color
		 */
		get_outline_color(color: Clutter.Color): void;
		/**
		 * Get the width of the outline for #node, in physical pixels.
		 * @returns the width in physical pixels
		 */
		get_outline_width(): number;
		/**
		 * Get the padding for #node on #side, in physical pixels. This corresponds to
		 * the CSS properties such as `padding-top`.
		 * @param side a {@link Side}
		 * @returns the padding size in physical pixels
		 */
		get_padding(side: Side): number;
		/**
		 * Gets the box used to paint the actor, including the area occupied
		 * by properties which paint outside the actor's assigned allocation.
		 * When painting #node to an offscreen buffer, this function can be
		 * used to determine the necessary size of the buffer.
		 * @param allocation the box allocated to a #ClutterActor
		 * @param paint_box computed box occupied when painting the actor
		 */
		get_paint_box(allocation: Clutter.ActorBox, paint_box: Clutter.ActorBox): void;
		/**
		 * Gets the parent themed element node.
		 * @returns the parent {@link ThemeNode}, or %NULL if
		 *  this is the root node of the tree of theme elements.
		 */
		get_parent(): ThemeNode | null;
		/**
		 * Get the list of pseudo-classes for #node (eg. `:focused`).
		 * @returns the element's pseudo-classes
		 */
		get_pseudo_classes(): string[];
		/**
		 * Generically looks up a property containing a set of shadow values. When
		 * specific getters (like st_theme_node_get_box_shadow()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * Like st_theme_get_length(), this does not print a warning if the property is
		 * not found; it just returns %NULL
		 * 
		 * See also st_theme_node_lookup_shadow (), which provides more options.
		 * @param property_name The name of the shadow property
		 * @returns the shadow, or %NULL if the property was
		 *   not found.
		 */
		get_shadow(property_name: string): Shadow | null;
		/**
		 * Get the text alignment of #node.
		 * @returns the alignment of text for #node
		 */
		get_text_align(): TextAlign;
		/**
		 * Get the text decoration for #node (eg. underline, line-through, etc).
		 * @returns the text decoration for #node
		 */
		get_text_decoration(): TextDecoration;
		/**
		 * Gets the value for the text-shadow style property
		 * @returns the node's text-shadow, or %NULL
		 *   if node has no text-shadow
		 */
		get_text_shadow(): Shadow | null;
		/**
		 * Gets the theme stylesheet set that styles this node
		 * @returns the theme stylesheet set
		 */
		get_theme(): Theme;
		/**
		 * Get the value of the transition-duration property, which
		 * specifies the transition time between the previous {@link ThemeNode}
		 * and #node.
		 * @returns the node's transition duration in milliseconds
		 */
		get_transition_duration(): number;
		/**
		 * Looks up a property containing a single URL value.
		 * 
		 * See also st_theme_node_lookup_url(), which provides more options,
		 * and lets you handle the case where the theme does not specify the
		 * indicated value.
		 * @param property_name The name of the string property
		 * @returns the newly allocated value if found.
		 *  If #property_name is not found, a warning will be logged and %NULL
		 *  will be returned.
		 */
		get_url(property_name: string): Gio.File | null;
		/**
		 * Gets the total vertical padding (top + bottom padding), in physical pixels.
		 * @returns the total vertical padding in physical pixels
		 */
		get_vertical_padding(): number;
		/**
		 * Get the width for #node, in physical pixels.
		 * @returns the width in physical pixels
		 */
		get_width(): number;
		/**
		 * Converts #node to a hash value.
		 * @returns a hash value corresponding to #node
		 */
		hash(): number;
		invalidate_background_image(): void;
		invalidate_border_image(): void;
		/**
		 * Generically looks up a property containing a single color value. When
		 * specific getters (like st_theme_node_get_background_color()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also st_theme_node_get_color(), which provides a simpler API.
		 * @param property_name The name of the color property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @param color location to store the color that was
		 *   determined. If the property is not found, the value in this location
		 *   will not be changed.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 */
		lookup_color(property_name: string, inherit: boolean, color: Clutter.Color): boolean;
		/**
		 * Generically looks up a property containing a single numeric value
		 *  without units.
		 * 
		 * See also st_theme_node_get_double(), which provides a simpler API.
		 * @param property_name The name of the numeric property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 */
		lookup_double(property_name: string, inherit: boolean): boolean;
		/**
		 * Generically looks up a property containing a single length value. When
		 * specific getters (like st_theme_node_get_border_width()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also st_theme_node_get_length(), which provides a simpler API.
		 * @param property_name The name of the length property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 */
		lookup_length(property_name: string, inherit: boolean): boolean;
		/**
		 * If the property is not found, the value in the shadow variable will not
		 * be changed.
		 * 
		 * Generically looks up a property containing a set of shadow values. When
		 * specific getters (like st_theme_node_get_box_shadow ()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also st_theme_node_get_shadow(), which provides a simpler API.
		 * @param property_name The name of the shadow property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *   theme node (or in the properties of parent nodes when inheriting.), %FALSE
		 *   if the property was not found, or was explicitly set to 'none'.
		 */
		lookup_shadow(property_name: string, inherit: boolean): boolean;
		/**
		 * Generically looks up a property containing a single time value,
		 *  which is converted to milliseconds.
		 * @param property_name The name of the time property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 */
		lookup_time(property_name: string, inherit: boolean): boolean;
		/**
		 * Looks up a property containing a single URL value.
		 * 
		 * See also st_theme_node_get_url(), which provides a simpler API.
		 * @param property_name The name of the string property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 */
		lookup_url(property_name: string, inherit: boolean): boolean;
		paint(state: ThemeNodePaintState, framebuffer: Cogl.Framebuffer, box: Clutter.ActorBox, paint_opacity: number, resource_scale: number): void;
		/**
		 * Check if st_theme_node_paint() will paint identically for #node as it does
		 * for #other. Note that in some cases this function may return %TRUE even
		 * if there is no visible difference in the painting.
		 * @param other a different {@link ThemeNode}
		 * @returns %TRUE if the two theme nodes paint identically. %FALSE if the
		 *   two nodes potentially paint differently.
		 */
		paint_equal(other: ThemeNode | null): boolean;
		/**
		 * Serialize #node to a string of its #GType name, CSS ID, classes and
		 * pseudo-classes.
		 * @returns the serialized theme node
		 */
		to_string(): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeNode} instead.
	 */
	type ThemeNodeMixin = IThemeNode & GObject.Object;

	interface ThemeNode extends ThemeNodeMixin {}

	class ThemeNode {
		public constructor();
		/**
		 * Creates a new {@link ThemeNode}. Once created, a node is immutable. If any
		 * of the attributes of the node (like the #element_class) change the node
		 * and its child nodes must be destroyed and recreated.
		 * @param context the context representing global state for this themed tree
		 * @param parent_node the parent node of this node
		 * @param theme a theme (stylesheet set) that overrides the
		 *   theme inherited from the parent node
		 * @param element_type the type of the GObject represented by this node
		 *  in the tree (corresponding to an element if we were theming an XML
		 *  document. %G_TYPE_NONE means this style was created for the stage
		 * actor and matches a selector element name of 'stage'.
		 * @param element_id the ID to match CSS rules against
		 * @param element_class a whitespace-separated list of classes
		 *   to match CSS rules against
		 * @param pseudo_class a whitespace-separated list of pseudo-classes
		 *   (like 'hover' or 'visited') to match CSS rules against
		 * @param inline_style
		 * @returns a new {@link ThemeNode}
		 */
		public static new(context: ThemeContext, parent_node: ThemeNode | null, theme: Theme | null, element_type: GObject.Type, element_id: string | null, element_class: string | null, pseudo_class: string | null, inline_style: string): ThemeNode;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Viewport} instead.
	 */
	interface IViewport {
		clip_to_view: boolean;

		connect(signal: "notify::clip_to_view", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Viewport} instead.
	 */
	type ViewportMixin = IViewport & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable & Scrollable;

	interface Viewport extends ViewportMixin {}

	class Viewport {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Widget} instead.
	 */
	interface IWidget {
		/**
		 * Object instance's name for assistive technology access.
		 */
		accessible_name: string;
		/**
		 * The accessible role of this object
		 */
		accessible_role: Atk.Role;
		/**
		 * Whether or not the widget can be focused via keyboard navigation.
		 */
		can_focus: boolean;
		/**
		 * Whether or not the pointer is currently hovering over the widget. This is
		 * only tracked automatically if {@link Widget}:track-hover is %TRUE, but you can
		 * adjust it manually in any case.
		 */
		hover: boolean;
		/**
		 * An actor that labels this widget.
		 */
		label_actor: Clutter.Actor;
		/**
		 * The pseudo-class of the actor. Typical values include "hover", "active",
		 * "focus".
		 */
		pseudo_class: string;
		/**
		 * Inline style information for the actor as a ';'-separated list of
		 * CSS properties.
		 */
		style: string;
		/**
		 * The style-class of the actor for use in styling.
		 */
		style_class: string;
		/**
		 * Determines whether the widget tracks pointer hover state. If
		 * %TRUE (and the widget is visible and reactive), the
		 * {@link Widget}:hover property and "hover" style pseudo class will be
		 * adjusted automatically as the pointer moves in and out of the
		 * widget.
		 */
		track_hover: boolean;
		/**
		 * This method adds #state as one of the accessible states for
		 * #widget. The list of states of a widget describes the current state
		 * of user interface element #widget and is provided so that assistive
		 * technologies know how to present #widget to the user.
		 * 
		 * Usually you will have no need to add accessible states for an
		 * object, as the accessible object can extract most of the states
		 * from the object itself (ie: a {@link Button} knows when it is pressed).
		 * This method is only required when one cannot extract the
		 * information automatically from the object itself (i.e.: a generic
		 * container used as a toggle menu item will not automatically include
		 * the toggled state).
		 * @param state #AtkStateType state to add
		 */
		add_accessible_state(state: Atk.StateType): void;
		/**
		 * Adds #style_class to #actor's style class name list, if it is not
		 * already present.
		 * @param style_class a style class name string
		 */
		add_style_class_name(style_class: string): void;
		/**
		 * Adds #pseudo_class to #actor's pseudo class list, if it is not
		 * already present.
		 * @param pseudo_class a pseudo class string
		 */
		add_style_pseudo_class(pseudo_class: string): void;
		/**
		 * Ensures that #widget has read its style information and propagated any
		 * changes to its children.
		 */
		ensure_style(): void;
		/**
		 * Gets the accessible name for this widget. See
		 * st_widget_set_accessible_name() for more information.
		 * @returns a character string representing the accessible name
		 * of the widget.
		 */
		get_accessible_name(): string;
		/**
		 * Gets the #AtkRole for this widget. See
		 * st_widget_set_accessible_role() for more information.
		 * @returns accessible #AtkRole for this widget
		 */
		get_accessible_role(): Atk.Role;
		/**
		 * Returns the current value of the can-focus property. See
		 * st_widget_set_can_focus() for more information.
		 * @returns current value of can-focus on #widget
		 */
		get_can_focus(): boolean;
		/**
		 * Gets a list of the focusable children of #widget, in "Tab"
		 * order. By default, this returns all visible
		 * (as in clutter_actor_is_visible()) children of #widget.
		 * @returns 
		 *   #widget's focusable children
		 */
		get_focus_chain(): GLib.List;
		/**
		 * If {@link Widget}:track-hover is set, this returns whether the pointer
		 * is currently over the widget.
		 * @returns current value of hover on #widget
		 */
		get_hover(): boolean;
		/**
		 * Gets the label that identifies #widget if it is defined
		 * @returns the label that identifies the widget
		 */
		get_label_actor(): Clutter.Actor;
		/**
		 * Get the current inline style string. See st_widget_set_style().
		 * @returns The inline style string, or %NULL. The
		 *   string is owned by the {@link Widget} and should not be modified or freed.
		 */
		get_style(): string | null;
		/**
		 * Get the current style class name
		 * @returns the class name string. The string is owned by the {@link Widget} and
		 * should not be modified or freed.
		 */
		get_style_class_name(): string;
		/**
		 * Get the current style pseudo class list.
		 * 
		 * Note that an actor can have multiple pseudo classes; if you just
		 * want to test for the presence of a specific pseudo class, use
		 * st_widget_has_style_pseudo_class().
		 * @returns the pseudo class list string. The string is owned by the
		 * {@link Widget} and should not be modified or freed.
		 */
		get_style_pseudo_class(): string;
		/**
		 * Gets the theme node holding style information for the widget.
		 * The theme node is used to access standard and custom CSS
		 * properties of the widget.
		 * 
		 * Note: it is a fatal error to call this on a widget that is
		 *  not been added to a stage.
		 * @returns the theme node for the widget.
		 *   This is owned by the widget. When attributes of the widget
		 *   or the environment that affect the styling change (for example
		 *   the style_class property of the widget), it will be recreated,
		 *   and the ::style-changed signal will be emitted on the widget.
		 */
		get_theme_node(): ThemeNode;
		/**
		 * Returns the current value of the {@link Widget}:track-hover property. See
		 * st_widget_set_track_hover() for more information.
		 * @returns current value of track-hover on #widget
		 */
		get_track_hover(): boolean;
		/**
		 * Tests if #actor's style class list includes #style_class.
		 * @param style_class a style class string
		 * @returns whether or not #actor's style class list includes
		 * #style_class.
		 */
		has_style_class_name(style_class: string): boolean;
		/**
		 * Tests if #actor's pseudo class list includes #pseudo_class.
		 * @param pseudo_class a pseudo class string
		 * @returns whether or not #actor's pseudo class list includes
		 * #pseudo_class.
		 */
		has_style_pseudo_class(pseudo_class: string): boolean;
		/**
		 * Tries to update the keyboard focus within #widget in response to a
		 * keyboard event.
		 * 
		 * If #from is a descendant of #widget, this attempts to move the
		 * keyboard focus to the next descendant of #widget (in the order
		 * implied by #direction) that has the {@link Widget}:can-focus property
		 * set. If #from is %NULL, this attempts to focus either #widget
		 * itself, or its first descendant in the order implied by
		 * #direction. If #from is outside of #widget, it behaves as if it was
		 * a descendant if #direction is one of the directional arrows and as
		 * if it was %NULL otherwise.
		 * 
		 * If a container type is marked #StWidget:can-focus, the expected
		 * behavior is that it will only take up a single slot on the focus
		 * chain as a whole, rather than allowing navigation between its child
		 * actors (or having a distinction between itself being focused and
		 * one of its children being focused).
		 * 
		 * Some widget classes might have slightly different behavior from the
		 * above, where that would make more sense.
		 * 
		 * If #wrap_around is %TRUE and #from is a child of #widget, but the
		 * widget has no further children that can accept the focus in the
		 * given direction, then st_widget_navigate_focus() will try a second
		 * time, using a %NULL #from, which should cause it to reset the focus
		 * to the first available widget in the given direction.
		 * @param from the actor that the focus is coming from
		 * @param direction the direction focus is moving in
		 * @param wrap_around whether focus should wrap around
		 * @returns %TRUE if clutter_actor_grab_key_focus() has been
		 * called on an actor. %FALSE if not.
		 */
		navigate_focus(from: Clutter.Actor | null, direction: DirectionType, wrap_around: boolean): boolean;
		/**
		 * Paint the background of the widget. This is meant to be called by
		 * subclasses of StWidget that need to paint the background without
		 * painting children.
		 * @param paint_context
		 */
		paint_background(paint_context: Clutter.PaintContext): void;
		/**
		 * Returns the theme node for the widget if it has already been
		 * computed, %NULL if the widget hasn't been added to a  stage or the theme
		 * node hasn't been computed. If %NULL is returned, then ::style-changed
		 * will be reliably emitted before the widget is allocated or painted.
		 * @returns the theme node for the widget.
		 *   This is owned by the widget. When attributes of the widget
		 *   or the environment that affect the styling change (for example
		 *   the style_class property of the widget), it will be recreated,
		 *   and the ::style-changed signal will be emitted on the widget.
		 */
		peek_theme_node(): ThemeNode;
		/**
		 * Asks the widget to pop-up a context menu by emitting {@link Widget}::popup-menu.
		 */
		popup_menu(): void;
		/**
		 * This method removes #state as on of the accessible states for
		 * #widget. See st_widget_add_accessible_state() for more information.
		 * @param state #AtkState state to remove
		 */
		remove_accessible_state(state: Atk.StateType): void;
		/**
		 * Removes #style_class from #actor's style class name, if it is
		 * present.
		 * @param style_class a style class name string
		 */
		remove_style_class_name(style_class: string): void;
		/**
		 * Removes #pseudo_class from #actor's pseudo class, if it is present.
		 * @param pseudo_class a pseudo class string
		 */
		remove_style_pseudo_class(pseudo_class: string): void;
		/**
		 * This method allows to set a customly created accessible object to
		 * this widget. For example if you define a new subclass of
		 * {@link WidgetAccessible} at the javascript code.
		 * 
		 * NULL is a valid value for #accessible. That contemplates the
		 * hypothetical case of not needing anymore a custom accessible object
		 * for the widget. Next call of st_widget_get_accessible() would
		 * create and return a default accessible.
		 * 
		 * It assumes that the call to atk_object_initialize that bound the
		 * gobject with the custom accessible object was already called, so
		 * not a responsibility of this method.
		 * @param accessible an accessible (#AtkObject)
		 */
		set_accessible(accessible: Atk.Object): void;
		/**
		 * This method sets #name as the accessible name for #widget.
		 * 
		 * Usually you will have no need to set the accessible name for an
		 * object, as usually there is a label for most of the interface
		 * elements. So in general it is better to just use
		 * #st_widget_set_label_actor. This method is only required when you
		 * need to set an accessible name and there is no available label
		 * object.
		 * @param name a character string to be set as the accessible name
		 */
		set_accessible_name(name: string | null): void;
		/**
		 * This method sets #role as the accessible role for #widget. This
		 * role describes what kind of user interface element #widget is and
		 * is provided so that assistive technologies know how to present
		 * #widget to the user.
		 * 
		 * Usually you will have no need to set the accessible role for an
		 * object, as this information is extracted from the context of the
		 * object (ie: a {@link Button} has by default a push button role). This
		 * method is only required when you need to redefine the role
		 * currently associated with the widget, for instance if it is being
		 * used in an unusual way (ie: a #StButton used as a togglebutton), or
		 * if a generic object is used directly (ie: a container as a menu
		 * item).
		 * 
		 * If #role is #ATK_ROLE_INVALID, the role will not be changed
		 * and the accessible's default role will be used instead.
		 * @param role The role to use
		 */
		set_accessible_role(role: Atk.Role): void;
		/**
		 * Marks #widget as being able to receive keyboard focus via
		 * keyboard navigation.
		 * @param can_focus %TRUE if the widget can receive keyboard focus
		 *   via keyboard navigation
		 */
		set_can_focus(can_focus: boolean): void;
		/**
		 * Sets #widget's hover property and adds or removes "hover" from its
		 * pseudo class accordingly.
		 * 
		 * If you have set {@link Widget}:track-hover, you should not need to call
		 * this directly. You can call st_widget_sync_hover() if the hover
		 * state might be out of sync due to another actor's pointer grab.
		 * @param hover whether the pointer is hovering over the widget
		 */
		set_hover(hover: boolean): void;
		/**
		 * Sets #label as the #ClutterActor that identifies (labels)
		 * #widget. #label can be %NULL to indicate that #widget is not
		 * labelled any more
		 * @param label a #ClutterActor
		 */
		set_label_actor(label: Clutter.Actor): void;
		/**
		 * Set the inline style string for this widget. The inline style string is an
		 * optional ';'-separated list of CSS properties that override the style as
		 * determined from the stylesheets of the current theme.
		 * @param style a inline style string, or %NULL
		 */
		set_style(style: string | null): void;
		/**
		 * Set the style class name list. #style_class_list can either be
		 * %NULL, for no classes, or a space-separated list of style class
		 * names. See also st_widget_add_style_class_name() and
		 * st_widget_remove_style_class_name().
		 * @param style_class_list a new style class list string
		 */
		set_style_class_name(style_class_list: string | null): void;
		/**
		 * Set the style pseudo class list. #pseudo_class_list can either be
		 * %NULL, for no classes, or a space-separated list of pseudo class
		 * names. See also st_widget_add_style_pseudo_class() and
		 * st_widget_remove_style_pseudo_class().
		 * @param pseudo_class_list a new pseudo class list string
		 */
		set_style_pseudo_class(pseudo_class_list: string | null): void;
		/**
		 * Enables hover tracking on the {@link Widget}.
		 * 
		 * If hover tracking is enabled, and the widget is visible and
		 * reactive, then #widget's #StWidget:hover property will be updated
		 * automatically to reflect whether the pointer is in #widget (or one
		 * of its children), and #widget's #StWidget:pseudo-class will have
		 * the "hover" class added and removed from it accordingly.
		 * 
		 * Note that currently it is not possible to correctly track the hover
		 * state when another actor has a pointer grab. You can use
		 * st_widget_sync_hover() to update the property manually in this
		 * case.
		 * @param track_hover %TRUE if the widget should track the pointer hover state
		 */
		set_track_hover(track_hover: boolean): void;
		style_changed(): void;
		/**
		 * Sets #widget's hover state according to the current pointer
		 * position. This can be used to ensure that it is correct after
		 * (or during) a pointer grab.
		 */
		sync_hover(): void;
		/**
		 * Emitted when the user has requested a context menu (eg, via a keybinding)
		 */
		connect(signal: "popup-menu", callback: (owner: this) => void): number;
		/**
		 * Emitted when the style information that the widget derives from the
		 * theme changes
		 */
		connect(signal: "style-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::accessible_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::accessible_role", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::can_focus", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::hover", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::label_actor", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::pseudo_class", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::style", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::style_class", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::track_hover", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Widget} instead.
	 */
	type WidgetMixin = IWidget & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Widget extends WidgetMixin {}

	class Widget {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WidgetAccessible} instead.
	 */
	interface IWidgetAccessible {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WidgetAccessible} instead.
	 */
	type WidgetAccessibleMixin = IWidgetAccessible & Cally.Actor & Atk.Action & Atk.Component;

	interface WidgetAccessible extends WidgetAccessibleMixin {}

	class WidgetAccessible {
		public constructor();
	}

	/**
	 * Base class for {@link Adjustment}.
	 */
	interface AdjustmentClass {}
	class AdjustmentClass {
		public constructor();
		public changed: {(adjustment: Adjustment): void;};
	}

	/**
	 * The {@link BinClass} struct contains only private data
	 */
	interface BinClass {}
	class BinClass {
		public constructor();
	}

	interface BorderImageClass {}
	class BorderImageClass {
		public constructor();
	}

	interface BoxLayoutClass {}
	class BoxLayoutClass {
		public constructor();
	}

	interface BoxLayoutPrivate {}
	class BoxLayoutPrivate {
		public constructor();
	}

	interface ButtonClass {}
	class ButtonClass {
		public constructor();
		public transition: {(button: Button): void;};
		public clicked: {(button: Button, clicked_button: number): void;};
	}

	interface ClipboardClass {}
	class ClipboardClass {
		public constructor();
	}

	interface DrawingAreaClass {}
	class DrawingAreaClass {
		public constructor();
		public repaint: {(area: DrawingArea): void;};
	}

	interface EntryClass {}
	class EntryClass {
		public constructor();
		public primary_icon_clicked: {(entry: Entry): void;};
		public secondary_icon_clicked: {(entry: Entry): void;};
	}

	interface FocusManagerClass {}
	class FocusManagerClass {
		public constructor();
	}

	interface FocusManagerPrivate {}
	class FocusManagerPrivate {
		public constructor();
	}

	interface GenericAccessibleClass {}
	class GenericAccessibleClass {
		public constructor();
	}

	interface GenericAccessiblePrivate {}
	class GenericAccessiblePrivate {
		public constructor();
	}

	interface IconClass {}
	class IconClass {
		public constructor();
	}

	/**
	 * The {@link IconColors} structure encapsulates colors for colorizing a symbolic
	 * icon.
	 */
	interface IconColors {}
	class IconColors {
		public constructor();
		/**
		 * Creates a new {@link IconColors}. All colors are initialized to transparent black.
		 * @returns a newly created {@link IconColors}. Free with st_icon_colors_unref()
		 */
		public static new(): IconColors;
		public ref_count: number;
		/**
		 * foreground color
		 */
		public foreground: Clutter.Color;
		/**
		 * color indicating a warning state
		 */
		public warning: Clutter.Color;
		/**
		 * color indicating an error state
		 */
		public error: Clutter.Color;
		/**
		 * color indicating a successful operation
		 */
		public success: Clutter.Color;
		/**
		 * Creates a new StIconColors structure that is a copy of the passed
		 * in #colors. You would use this function instead of st_icon_colors_ref()
		 * if you were planning to change colors in the result.
		 * @returns a newly created {@link IconColors}.
		 */
		public copy(): IconColors;
		/**
		 * Check if two {@link IconColors} objects are identical.
		 * @param other another {@link IconColors}
		 * @returns %TRUE if the {@link IconColors} are equal
		 */
		public equal(other: IconColors): boolean;
		/**
		 * Atomically increments the reference count of #colors by one.
		 * @returns the passed in {@link IconColors}.
		 */
		public ref(): IconColors;
		/**
		 * Atomically decrements the reference count of #colors by one.
		 * If the reference count drops to 0, all memory allocated by the
		 * {@link IconColors} is released.
		 */
		public unref(): void;
	}

	interface IconPrivate {}
	class IconPrivate {
		public constructor();
	}

	interface ImageContentClass {}
	class ImageContentClass {
		public constructor();
	}

	interface LabelClass {}
	class LabelClass {
		public constructor();
	}

	interface LabelPrivate {}
	class LabelPrivate {
		public constructor();
	}

	interface PasswordEntryClass {}
	class PasswordEntryClass {
		public constructor();
	}

	interface ScrollBarClass {}
	class ScrollBarClass {
		public constructor();
		public scroll_start: {(bar: ScrollBar): void;};
		public scroll_stop: {(bar: ScrollBar): void;};
	}

	interface ScrollViewClass {}
	class ScrollViewClass {
		public constructor();
	}

	interface ScrollViewFadeClass {}
	class ScrollViewFadeClass {
		public constructor();
	}

	interface ScrollViewPrivate {}
	class ScrollViewPrivate {
		public constructor();
	}

	interface ScrollableInterface {}
	class ScrollableInterface {
		public constructor();
		public set_adjustments: {(scrollable: Scrollable, hadjustment: Adjustment, vadjustment: Adjustment): void;};
		public get_adjustments: {(scrollable: Scrollable, hadjustment: Adjustment, vadjustment: Adjustment): void;};
	}

	interface SettingsClass {}
	class SettingsClass {
		public constructor();
	}

	/**
	 * Attributes of the -st-shadow property.
	 */
	interface Shadow {}
	class Shadow {
		public constructor();
		/**
		 * Creates a new {@link Shadow}
		 * @param color shadow's color
		 * @param xoffset horizontal offset
		 * @param yoffset vertical offset
		 * @param blur blur radius
		 * @param spread spread radius
		 * @param inset whether the shadow should be inset
		 * @returns the newly allocated shadow. Use st_shadow_free() when done
		 */
		public static new(color: Clutter.Color, xoffset: number, yoffset: number, blur: number, spread: number, inset: boolean): Shadow;
		/**
		 * shadow's color
		 */
		public color: Clutter.Color;
		/**
		 * horizontal offset - positive values mean placement to the right,
		 *           negative values placement to the left of the element.
		 */
		public xoffset: number;
		/**
		 * vertical offset - positive values mean placement below, negative
		 *           values placement above the element.
		 */
		public yoffset: number;
		/**
		 * shadow's blur radius - a value of 0.0 will result in a hard shadow.
		 */
		public blur: number;
		/**
		 * shadow's spread radius - grow the shadow without enlarging the
		 *           blur.
		 */
		public spread: number;
		public inset: boolean;
		public ref_count: number;
		/**
		 * Check if two shadow objects are identical. Note that two shadows may
		 * compare non-identically if they differ only by floating point rounding
		 * errors.
		 * @param other a different {@link Shadow}
		 * @returns %TRUE if the two shadows are identical
		 */
		public equal(other: Shadow): boolean;
		/**
		 * Gets the box used to paint #shadow, which will be partly
		 * outside of #actor_box
		 * @param actor_box the box allocated to a #ClutterAlctor
		 * @param shadow_box computed box occupied by #shadow
		 */
		public get_box(actor_box: Clutter.ActorBox, shadow_box: Clutter.ActorBox): void;
		/**
		 * Atomically increments the reference count of #shadow by one.
		 * @returns the passed in {@link Shadow}.
		 */
		public ref(): Shadow;
		/**
		 * Atomically decrements the reference count of #shadow by one.
		 * If the reference count drops to 0, all memory allocated by the
		 * {@link Shadow} is released.
		 */
		public unref(): void;
	}

	interface ShadowHelper {}
	class ShadowHelper {
		public constructor();
		/**
		 * Builds a {@link ShadowHelper} that will build a drop shadow
		 * using #source as the mask.
		 * @param shadow a {@link Shadow} representing the shadow properties
		 * @returns a new {@link ShadowHelper}
		 */
		public static new(shadow: Shadow): ShadowHelper;
		public copy(): ShadowHelper;
		/**
		 * Free resources associated with #helper.
		 */
		public free(): void;
		/**
		 * Paints the shadow associated with #helper This must only
		 * be called from the implementation of ClutterActor::paint().
		 * @param framebuffer a #CoglFramebuffer
		 * @param actor_box the bounding box of the shadow
		 * @param paint_opacity the opacity at which the shadow is painted
		 */
		public paint(framebuffer: Cogl.Framebuffer, actor_box: Clutter.ActorBox, paint_opacity: number): void;
		/**
		 * Update #helper from #source.
		 * @param source a #ClutterActor
		 */
		public update(source: Clutter.Actor): void;
	}

	interface TextureCacheClass {}
	class TextureCacheClass {
		public constructor();
	}

	interface TextureCachePrivate {}
	class TextureCachePrivate {
		public constructor();
	}

	interface ThemeClass {}
	class ThemeClass {
		public constructor();
	}

	interface ThemeContextClass {}
	class ThemeContextClass {
		public constructor();
	}

	interface ThemeNodeClass {}
	class ThemeNodeClass {
		public constructor();
	}

	interface ThemeNodePaintState {}
	class ThemeNodePaintState {
		public constructor();
		public node: ThemeNode;
		public alloc_width: number;
		public alloc_height: number;
		public box_shadow_width: number;
		public box_shadow_height: number;
		public resource_scale: number;
		public box_shadow_pipeline: Cogl.Pipeline;
		public prerendered_texture: Cogl.Pipeline;
		public prerendered_pipeline: Cogl.Pipeline;
		public corner_material: Cogl.Pipeline[];
		public copy(other: ThemeNodePaintState): void;
		public free(): void;
		public init(): void;
		public invalidate(): void;
		public invalidate_for_file(file: Gio.File): boolean;
		public set_node(node: ThemeNode): void;
	}

	interface ViewportClass {}
	class ViewportClass {
		public constructor();
	}

	interface WidgetAccessibleClass {}
	class WidgetAccessibleClass {
		public constructor();
	}

	interface WidgetAccessiblePrivate {}
	class WidgetAccessiblePrivate {
		public constructor();
	}

	/**
	 * Base class for stylable actors.
	 */
	interface WidgetClass {}
	class WidgetClass {
		public constructor();
		public style_changed: {(self: Widget): void;};
		public popup_menu: {(self: Widget): void;};
		public navigate_focus: {(self: Widget, from: Clutter.Actor | null, direction: DirectionType): boolean;};
		public get_accessible_type: {(): GObject.Type;};
		public get_focus_chain: {(widget: Widget): GLib.List;};
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scrollable} instead.
	 */
	interface IScrollable {
		/**
		 * The horizontal {@link Adjustment} used by the #StScrollable.
		 * 
		 * Implementations should override this property to provide read-write
		 * access to the #StAdjustment.
		 * 
		 * JavaScript code may override this as demonstrated below:
		 * 
		 * |[<!-- language="JavaScript" -->
		 * var MyScrollable = GObject.registerClass({
		 *     Properties: {
		 *         'hadjustment': GObject.ParamSpec.override(
		 *             'hadjustment',
		 *             St.Scrollable
		 *         )
		 *     }
		 * }, class MyScrollable extends St.Scrollable {
		 * 
		 *     get hadjustment() {
		 *         return this._hadjustment || null;
		 *     }
		 * 
		 *     set hadjustment(adjustment) {
		 *         if (this.hadjustment === adjustment)
		 *             return;
		 * 
		 *         this._hadjustment = adjustment;
		 *         this.notify('hadjustment');
		 *     }
		 * });
		 * ]|
		 */
		hadjustment: Adjustment;
		/**
		 * The vertical {@link Adjustment} used by the #StScrollable.
		 * 
		 * Implementations should override this property to provide read-write
		 * access to the #StAdjustment.
		 * 
		 * See #StScrollable:hadjustment for an example of how to override this
		 * property in JavaScript code.
		 */
		vadjustment: Adjustment;
		get_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): void;
		/**
		 * This method should be implemented by classes implementing the {@link Scrollable}
		 * interface.
		 * 
		 * JavaScript code should do this by overriding the `vfunc_set_adjustments()`
		 * method.
		 * @param hadjustment the horizontal {@link Adjustment}
		 * @param vadjustment the vertical {@link Adjustment}
		 */
		set_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): void;
		connect(signal: "notify::hadjustment", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::vadjustment", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scrollable} instead.
	 */
	type ScrollableMixin = IScrollable;

	interface Scrollable extends ScrollableMixin {}

	class Scrollable {
		public constructor();
	}



	enum Align {
		START = 0,
		MIDDLE = 1,
		END = 2
	}

	enum BackgroundSize {
		AUTO = 0,
		CONTAIN = 1,
		COVER = 2,
		FIXED = 3
	}

	enum ClipboardType {
		PRIMARY = 0,
		CLIPBOARD = 1
	}

	/**
	 * Used to target a particular corner of a {@link ThemeNode} element.
	 */
	enum Corner {
		/**
		 * The top-right corner.
		 */
		TOPLEFT = 0,
		/**
		 * The top-right corner.
		 */
		TOPRIGHT = 1,
		/**
		 * The bottom-right corner.
		 */
		BOTTOMRIGHT = 2,
		/**
		 * The bottom-left corner.
		 */
		BOTTOMLEFT = 3
	}

	/**
	 * Enumeration for focus direction.
	 */
	enum DirectionType {
		/**
		 * Move forward.
		 */
		TAB_FORWARD = 0,
		/**
		 * Move backward.
		 */
		TAB_BACKWARD = 1,
		/**
		 * Move up.
		 */
		UP = 2,
		/**
		 * Move down.
		 */
		DOWN = 3,
		/**
		 * Move left.
		 */
		LEFT = 4,
		/**
		 * Move right.
		 */
		RIGHT = 5
	}

	/**
	 * Used to specify options when rendering gradients.
	 */
	enum GradientType {
		/**
		 * No gradient.
		 */
		NONE = 0,
		/**
		 * A vertical gradient.
		 */
		VERTICAL = 1,
		/**
		 * A horizontal gradient.
		 */
		HORIZONTAL = 2,
		/**
		 * Lookup the style requested in the icon name.
		 */
		RADIAL = 3
	}

	/**
	 * Used to specify options when looking up icons.
	 */
	enum IconStyle {
		/**
		 * Lookup the style requested in the icon name.
		 */
		REQUESTED = 0,
		/**
		 * Try to always load regular icons, even when symbolic
		 *   icon names are given.
		 */
		REGULAR = 1,
		/**
		 * Try to always load symbolic icons, even when regular
		 *   icon names are given.
		 */
		SYMBOLIC = 2
	}

	enum PolicyType {
		ALWAYS = 0,
		AUTOMATIC = 1,
		NEVER = 2,
		EXTERNAL = 3
	}

	/**
	 * Used to target a particular side of a {@link ThemeNode} element.
	 */
	enum Side {
		/**
		 * The top side.
		 */
		TOP = 0,
		/**
		 * The right side.
		 */
		RIGHT = 1,
		/**
		 * The bottom side.
		 */
		BOTTOM = 2,
		/**
		 * The left side.
		 */
		LEFT = 3
	}

	/**
	 * Used to align text in a label.
	 */
	enum TextAlign {
		/**
		 * Text is aligned at the beginning of the label.
		 */
		LEFT = 0,
		/**
		 * Text is aligned in the middle of the label.
		 */
		CENTER = 1,
		/**
		 * Text is aligned at the end of the label.
		 */
		RIGHT = 2,
		JUSTIFY = 3
	}

	enum TextureCachePolicy {
		NONE = 0,
		FOREVER = 1
	}

	/**
	 * A mask representing which mouse buttons an {@link Button} responds to.
	 */
	enum ButtonMask {
		/**
		 * button 1 (left)
		 */
		ONE = 1,
		/**
		 * button 2 (middle)
		 */
		TWO = 2,
		/**
		 * button 3 (right)
		 */
		THREE = 4
	}

	/**
	 * Flags used to determine the decoration of text.
	 * 
	 * Not that neither %ST_TEXT_DECORATION_OVERLINE or %ST_TEXT_DECORATION_BLINK
	 * are implemented, currently.
	 */
	enum TextDecoration {
		UNDERLINE = 1,
		/**
		 * Text is overlined
		 */
		OVERLINE = 2,
		/**
		 * Text is striked out
		 */
		LINE_THROUGH = 4,
		/**
		 * Text blinks
		 */
		BLINK = 8
	}

	/**
	 * Callback function called when text is retrieved from the clipboard.
	 */
	interface ClipboardCallbackFunc {
		/**
		 * Callback function called when text is retrieved from the clipboard.
		 * @param clipboard A {@link Clipboard}
		 * @param text text from the clipboard
		 */
		(clipboard: Clipboard, text: string): void;
	}

	/**
	 * Callback function called when content is retrieved from the clipboard.
	 */
	interface ClipboardContentCallbackFunc {
		/**
		 * Callback function called when content is retrieved from the clipboard.
		 * @param clipboard A {@link Clipboard}
		 * @param bytes content from the clipboard
		 */
		(clipboard: Clipboard, bytes: GLib.Bytes): void;
	}

	interface EntryCursorFunc {
		(entry: Entry, use_ibeam: boolean, data: any | null): void;
	}

	/**
	 * See st_texture_cache_load().  Implementations should return a
	 * texture handle for the given key, or set #error.
	 */
	interface TextureCacheLoader {
		/**
		 * See st_texture_cache_load().  Implementations should return a
		 * texture handle for the given key, or set #error.
		 * @param cache a {@link TextureCache}
		 * @param key Unique identifier for this texture
		 * @param data Callback user data
		 * @returns 
		 */
		(cache: TextureCache, key: string, data: any | null): Cogl.Texture;
	}

	/**
	 * Creates a string describing #actor, for use in debugging. This
	 * includes the class name and actor name (if any), plus if #actor
	 * is an {@link Widget}, its style class and pseudo class names.
	 * @param actor a #ClutterActor
	 * @returns the debug name.
	 */
	function describe_actor(actor: Clutter.Actor): string;

}