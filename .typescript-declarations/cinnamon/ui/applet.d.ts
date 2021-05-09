declare namespace imports.ui.applet {

	/** the panel layout that an applet is suitable for */
	export enum AllowedLayout {
		VERTICAL = 'vertical',
		HORIZONTAL = 'horizontal',
		BOTH = 'both'
	}

	/**
	 * #MenuItem
	 * @short_description: Deprecated. Use #PopupMenu.PopupIconMenuItem instead.
	 */
	export class MenuItem extends ui.popupMenu.PopupIconMenuItem {
		constructor(label: string, icon: string, callback: Function);
	}

	/**
	 Applet right-click menu
	*
	* A context menu (right-click menu) to be used by an applet
	*/
	export class AppletContextMenu extends popupMenu.PopupMenu {
		constructor(launcher: any, orientation: gi.St.Side);

		private _onOpenStateChanged(menu: popupMenu.PopupMenuBase, open: boolean, sourceActor: gi.St.Widget): void;
	}

	/**
	 *
	 * A popupmenu menu (left-click menu) to be used by an applet
	 *
	 * Inherits: PopupMenu.PopupMenu
	 */
	export class AppletPopupMenu extends popupMenu.PopupMenu {
		/**
		 * 
		 * @param launcher The applet that contains the context menu
		 * @param orinentation The orientation of the applet
		 */
		constructor(launcher: any, orinentation: gi.St.Side);

		private _onOrientationChanged(a: any, orientation: gi.St.Side): void;
		private _onOpenStateChanged(menu: popupMenu.PopupMenuBase, open: boolean, sourceActor: gi.St.Widget): void;
	}

	interface AppletMetadata {
		uuid: string;
		name: string;
		description: string;
    	"max-instances"?: number;
    	version?: string;
    	multiversion?: boolean;
    	"cinnamon-version"?: string[];
    	state?: number;
    	path: string;
		error?: string;
    	force_loaded: boolean;
	}

	/**
	 Base applet class
	*
	* Base applet class that other applets can inherit
	*/
	export class Applet {
		/** Actor of the applet */
		public readonly actor: gi.St.BoxLayout;
		/**  Instance id of the applet */
		public readonly instance_id: number;
		/** The panel object containing the applet. This is set by
		* appletManager *after* the applet is loaded. */
		public readonly panel: panel.Panel;

		/** UUID of the applet. This is set by appletManager *after*
		* the applet is loaded. */
		private _uuid: string;
		/** Panel sector containing the applet. This is
		* set by appletManager *after* the applet is loaded. */
		private _panelLocation: gi.St.BoxLayout;
		/** The metadata of the applet. This is set by appletManager
		* *after* the applet is loaded. */
		private _meta: AppletMetadata;
		/** The order of the applet within a panel location This is set
		* by appletManager *after* the applet is loaded. */
		private _order: number;
		/** The draggable object of the applet */
		private _draggable: dnd.Draggable;
		/** The tooltip of the applet */
		private _applet_tooltip: tooltips.PanelItemTooltip;
		/** The menu manager of the applet */
		public readonly _menuManager: popupMenu.PopupMenuManager;
		/** The context menu of the applet */
		public readonly _applet_context_menu: AppletContextMenu;
		/** Text of the tooltip */
		private _applet_tooltip_text: string;
		/** The allowed layout of the applet. This
		 * determines the type of panel an applet is allowed in. By default this is set
		 * to Applet.AllowedLayout.HORIZONTAL */
		private _allowedLayout: AllowedLayout;

		/**
		 * 
		 * @param orientation orientation of the applet; Orientation of panel containing the actor
		 * @param panel_height height of the panel containing the applet
		 * @param instance_id instance id of the applet
		 */
		constructor(orientation: gi.St.Side, panel_height: number, instance_id: number);

		public getDragActor(): gi.St.BoxLayout;

		/**
		 * Returns the original actor that should align with the actor we show as the item is being dragged.
		 */
		public getDragActorSource(): gi.St.BoxLayout;


		private _addStyleClass(className: string): void;

		private _getPanelInfo(instance_id: number): void;

		private _setAppletReactivity(): void;

		private _onDragBegin(): void;

		private _onDragEnd();

		private _onDragCancelled(): void;

		private _onButtonPressEvent(actor: gi.St.Widget, event: any): boolean;

		/**
		 * Sets the tooltip of the applet
		 * @param text the tooltip text to be set
		 * @param use_markup parse the text as markup if true
		 */
		public set_applet_tooltip(text: string, use_markup?: boolean): void;

		/**
		 * Sets whether the applet is enabled or not. A disabled applet sets its
		 * padding to 0px and doesn't react to clicks
		 * @param enabled  whether this applet is enabled or not
		 */
		public set_applet_enabled(enabled: boolean): void;

		/**
		 * This function is called when the applet is clicked.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param event the event object
		 */
		public on_applet_clicked(event: gi.Clutter.Event): any;

		/**
		 * This function is called when the applet is clicked with the middle mouse button.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param event the event object
		 */
		public on_applet_middle_clicked(event: gi.Clutter.Event): any;

		/**
		 * This function is called when an applet *of the same uuid* is added or
		 * removed from the panels. It is intended to assist in delegation of
		 * responsibilities between duplicate applet instances.
		 *
		 * Applets should not create any references to @instance, since that
		 * could impede garbage collection.
		 *
		 * This is meant to be overridden in individual applets
		 * @param instance the instance that was changed
		 */
		public on_applet_instances_changed(instance?: Applet): any;

		private on_applet_added_to_panel_internal(userEnabled: boolean): boolean | void;

		/**
		 * This function is called by appletManager when the applet is added to the panel.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param userEnabled 
		 */
		public on_applet_added_to_panel(userEnabled: boolean): any;

		/**
		 * This function is called by appletManager when the applet is removed from the panel.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param deleteConfig 
		 */
		public on_applet_removed_from_panel(deleteConfig: any): any;

		/**
		 * This function is called by appletManager when the applet is reloaded.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param deleteConfig 
		 */
		public on_applet_reloaded(deleteConfig: any): any;

		// should only be called by appletManager
		private _onAppletRemovedFromPanel(deleteConfig: any): void;

		/**
		 * Sets the orientation of the St.BoxLayout.
		 * @param orientation the orientation
		 */
		private setOrientationInternal(orientation: gi.St.Side): void;

		/**
		 * Sets the orientation of the applet.
		 *
		 * This function should only be called by appletManager
		 * @param orientation the orientation
		 */
		public setOrientation(orientation: gi.St.Side): void;

		/**
		 * Sets the layout allowed by the applet. Possible values are
		 * AllowedLayout.HORIZONTAL, AllowedLayout.VERTICAL, and
		 * AllowedLayout.BOTH.
		 * @param layout the allowed layout
		 */
		public setAllowedLayout(layout: AllowedLayout): void;

		/**
		 * Retrieves the type of layout an applet is allowed to have.
		 * @returns The allowed layout of the applet
		 */
		public getAllowedLayout(): AllowedLayout;

		/**
		 * This function is called when the applet is changes orientation.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param orientation new orientation of the applet
		 */
		public on_orientation_changed(orientation: gi.St.Side): any;

		public getPanelIconSize(iconType: gi.St.IconType): number;

		/**
		 * This function is called when the panel containing the applet changes height
		 */
		private on_panel_height_changed_internal(): void;

		/**
		 * This function is called when the panel containing the applet changes height
		 *
		 * This is meant to be overridden in individual applets.
		 */
		protected on_panel_height_changed(): any;

		private on_panel_icon_size_changed_internal(): void;

		/**
		 * This function is called when the icon size preference for the panel zone
		 * containing this applet is changed.
		 *
		 * This is meant to be overridden in individual applets.
		 * @param size new icon size
		 */
		public on_panel_icon_size_changed(size: number): any;

		public confirmRemoveApplet(event: any): void;

		public finalizeContextMenu(): void;

		/**
		 * translation
		 * @param str 
		 */
		public _(str: string): string;

		/**
		 * Turns on/off the highlight of the applet
		 * @param highlight whether to turn on or off
		 */
		public highlight(highlight: boolean): void;

		public openAbout(): void;

		public configureApplet(tab?: number): void;

		public get _panelHeight(): number;

		public get _scaleMode(): boolean;
	}

	/** Applet with icon */
	export class IconApplet extends Applet {
		/** Actor of the icon */
		private _applet_icon: gi.St.Icon;

		/**
		 * 
		 * @param orientation orientation of the applet; Orientation of panel containing the actor
		 * @param panel_height height of the panel containing the applet
		 * @param instance_id instance id of the applet
		 */
		constructor(orientation: gi.St.Side, panel_height: number, instance_id: number);

		/**
		 * Sets the icon of the applet to icon_name.
		 *
		 * The icon will be full color
		 * @param icon_name Name of the icon
		 */
		public set_applet_icon_name(icon_name: string): void;

		/**
		 * Sets the icon of the applet to icon_name.
		 *
		 * The icon will be symbolic
		 * @param icon_name Name of the icon
		 */
		public set_applet_icon_symbolic_name(icon_name: string): void;

		/**
		 * Sets the icon of the applet to the image file at @icon_path
		 *
		 * The icon will be full color
		 * @param icon_path path of the icon
		 */
		public set_applet_icon_path(icon_path: string): void;

		/**
		 * Sets the icon of the applet to the image file at @icon_path
		 *
		 * The icon will be symbolic
		 * @param icon_path path of the icon
		 */
		public set_applet_icon_symbolic_path(icon_path: string): void;

		private _ensureIcon(): void;

		private _setStyle(): void;
	}

	/**Applet with label
	 *
	 * Applet that displays a text
	 */
	export class TextApplet extends Applet {
		/** Label of the applet */
		private _applet_label: gi.St.Label;

		/**
		 * Note that suitability for display in a vertical panel is handled by having applets declare
		 * they work OK, handled elsewhere
		 * @param orientation orientation of the applet; Orientation of panel containing the actor
		 * @param panel_height height of the panel containing the applet
		 * @param instance_id instance id of the applet
		 */
		constructor(orientation: gi.St.Side, panel_height: number, instance_id: number);

		/**
		 * set_applet_label:
		 * @text (string): text to be displayed at the label
		 *
		 * Sets the text of the actor to @text
		 */
		public set_applet_label(text: string): void;

		public on_applet_added_to_panel(): void;
	}

	/**
	 * Applet with icon and label
	 *
	 * Applet that displays an icon and a text. The icon is on the left of the text
	 *
	 * Note that suitability for display in a vertical panel is handled by having applets declare
	 * they work OK, handled elsewhere
	 */
	export class TextIconApplet extends IconApplet {
		/** Label of the applet */
		private _applet_label: gi.St.Label;

		public readonly show_label_in_vertical_panels: boolean;

		/**
		 * 
		 * @param orientation orientation of the applet; Orientation of panel containing the actor
		 * @param panel_height height of the panel containing the applet
		 * @param instance_id instance id of the applet
		 */
		constructor(orientation: gi.St.Side, panel_height: number, instance_id: number);

		/**
		 * Sets whether to show the label in vertical panels
		 * @param show whether to show the label in vertical panels
		 */
		public set_show_label_in_vertical_panels(show: boolean): void;

		/**
		 * Sets the text of the actor to text
		 * @param text text to be displayed at the label
		 */
		public set_applet_label(text: string): void;

		/**
		 * Sets whether the applet is enabled or not. A disabled applet sets its
		 * padding to 0px and doesn't react to clicks
		 * @param enabled whether this applet is enabled or not
		 */
		public set_applet_enabled(enabled: boolean): void;

		/**
		 * Sets whether the applets label is hidden or not. A convenience
		 * function to hide applet labels when an applet is placed in a vertical
		 * panel
		 * @param hide whether the applet label is hidden or not
		 */
		public hide_applet_label(hide: boolean): void;

		/**
		 * Hides the applet label
		 */
		public hideLabel(): void;

		/**
		 * Shows the applet label
		 */
		public showLabel(): void;

		/**
		 * Hides the icon of the applet
		 */
		public hide_applet_icon(): void;

		public on_applet_added_to_panel(): void;
	}

}
