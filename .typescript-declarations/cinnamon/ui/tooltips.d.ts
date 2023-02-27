declare namespace imports.ui.tooltips {

	/**
	 *
	 * This is a base class for other tooltip items to inherit. This cannot be
	 * instantiated.
	 *
	 * All other tooltip items inherit this object. This base class is responsible
	 * for listening to mouse events and determining when to show the tooltip. When
	 * it thinks a tooltip should be shown, it calls `this.show()`. When it thinks
	 * it should be hidden, it calls `this.hide()`. When the @item is destroyed, it
	 * will call `this._destroy()`;
	 *
	 * Any object wishing to implement a tooltip should inherit this class, and
	 * then implement the three functions above. It should be noted that the sole
	 * responsibility of this class is to call the three functions above. It is
	 * thus the user's job to create the tooltip actor and position it correctly in
	 * the `show` function. Example implementations for reference include the
	 * #Tooltips.Tooltip object as well as the `WindowPreview` object in the window
	 * list applet.
	 *
	 * When calling the `show` function, #TooltipBase will set the
	 * `this.mousePosition` to the mouse coordinates at which the event is
	 * triggered.
	 *
	 * When implementing the `show` and `hide` functions, the user should set the
	 * `this.visible` variable to the visibility state of the tooltip. This is
	 * since calling the `show` function does not necessarily actually show the
	 * tooltip, eg. when the tooltip text is empty and the tooltip refuses to show.
	 * The `this.visible` variable should be set properly to reflect the actual
	 * status of the tooltip.
	 *
	 * Finally, if the user wishes to inhibit the display of a tooltip, eg. when
	 * the owner is being dragged, they can set the `this.preventShow` variable to
	 * `true`.
	 */
	export class TooltipBase<T = gi.Clutter.Actor> {
		/** The object owning the tooltip. */
		public readonly item: T;
		/** Whether the tooltip is currently visible */
		public readonly visible: boolean;
		/** Whether to inhibit the display of the tooltip */
		public readonly preventShow: boolean;
		/** The coordinates of the event that triggered the show */
		public readonly mousePosition: number[];

		public readonly signals: misc.signalManager.SignalManager;

		constructor(item: T);

		private _onMotionEvent(actor: T, event: gi.Clutter.Event): void;

		private _onEnterEvent(actor: T, event: gi.Clutter.Event): void;

		private _onShowTimerComplete(): void | boolean;

		private _onHideTimerComplete(): void | boolean;

		private _hide(actor: T, event: gi.Clutter.Event): void;
		/**
		 * Destroys the tooltip.
		 */
		public destroy(): void;
	}

	/**
	 * #Tooltip:
	 *
	 * This is a tooltip item that displays some text. The tooltip will be
	 * displayed such that the top left corner of the label is at the mouse
	 * position.
	 *
	 * This is not suitable for use in applets, since in the case of applets, we
	 * don't want the tooltip at the position of the mouse. Instead, it should
	 * appear above/below the panel without overlapping with the applet. Hence the
	 * #PanelItemTooltip class should be used instead.
	 *
	 * Note that the tooltip refuses to show if the tooltip text is empty.
	 */
	export class Tooltip<T = gi.Clutter.Actor> extends TooltipBase<T> {
		public readonly desktop_settings: gi.Gio.Settings;
		private readonly _tooltip: gi.St.Label;

		/**
		 * 
		 * @param item  the actor owning the tooltip
		 * @param initTitle the string to display initially
		 */
		constructor(item: T, initTitle?: string | null);

		public hide(): void;

		public show(): void;

		/**
		 * Sets the text to display to @text.
		 * @param text new text to display
		 */
		public set_text(text: string): void;

		/**
		 * Sets the text to display to markup.
		 * @param markup new text to display
		 */
		public set_markup(markup: string): void;

		private _destroy(): void;
	}

	/**
	 * A tooltip for panel applets. This is displayed above/below the panel instead
	 * of at exactly the mouse position to avoid covering the applet.
	 *
	 * It is possible that panelItem is not an applet, but a child of an applet.
	 * An immediate example is for use in the window list, where each individual
	 * item, instead of the applet,  has its own tooltip. These objects must have
	 * `panelItem._applet` set as the actual applet, since we need to access the
	 * applet to listen to orientation changes.
	 */
	export class PanelItemTooltip extends Tooltip<gi.St.BoxLayout> {
		/** The applet owning the tooltip */
		public readonly _panelItem: applet.Applet;
		/** The orientation of the applet */
		public readonly orientation: gi.St.Side;

		/**
		 * It should be noted that panelItem is the *applet* owning the tooltip,
		 * while that usually passed to #Tooltips.Tooltip is the *actor*. These are
		 * different objects.
		 * @param panelItem the applet owning the tooltip
		 * @param initTitle the initial string of the tooltip
		 * @param orientation the orientation of the applet.
		 */
		constructor(panelItem: applet.Applet, initTitle: string | null | undefined, orientation: gi.St.Side);

		public show(): void;

		private _onOrientationChanged(a: applet.Applet, orientation: gi.St.Side): void;
	}
}
