declare namespace imports.ui.popupMenu {

	export enum PanelLoc {
		top = 0,
		bottom = 1,
		left = 2,
		right = 3
	}

	export enum OrnamentType {
		NONE = 0,
		CHECK = 1,
		DOT = 2,
		ICON = 3
	}

	export enum FactoryClassTypes {
		RootMenuClass = "RootMenuClass",
		MenuItemClass = "MenuItemClass",
		SubMenuMenuItemClass = "SubMenuMenuItemClass",
		MenuSectionMenuItemClass = "MenuSectionMenuItemClass",
		SeparatorMenuItemClass = "SeparatorMenuItemClass"
	}

	export enum FactoryEventTypes {
		opened = "opened",
		closed = "closed",
		clicked = "clicked"
	}

	/**
	 * 
	 * @param side  to which the arrow points.
	 */
	export function arrowIcon(side: gi.St.Side): gi.St.Icon;

	interface PopupBaseMenuItemParams {
		reactive?: boolean,
		activate?: boolean,
		hover?: boolean,
		sensitive?: boolean,
		style_class?: string,
		focusOnHover?: boolean
	}

	interface AddActorParams {
		/** defaults to 1, -1 means "all the remaining width", 0 means "no new column after this actor", */
		span: number,
		/** defaults to #false */
		expand: boolean,
		/** defaults to St.Align.START */
		align: gi.St.Align
	}

	export class PopupBaseMenuItem {
		public readonly actor: gi.Cinnamon.GenericContainer;
		public readonly active: boolean;
		public readonly sensitive: boolean;
		public readonly focusOnHover: boolean;

		constructor(params?: PopupBaseMenuItemParams)

		private _onStyleChanged(actor: gi.Clutter.Actor): void;

		private _onButtonReleaseEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): any;

		private _onKeyPressEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		private _onKeyFocusIn(actor: gi.Clutter.Actor): void;

		private _onKeyFocusOut(actor: gi.Clutter.Actor): void;

		private _onHoverChanged(actor: gi.Clutter.Actor): void;

		activate(event: any, keepMenu?: boolean): void;

		setActive(active: boolean): void;

		setSensitive(sensitive: boolean): void;

		destroy(): void;

		/**
		 * adds an actor to the menu item;
		 * @param child 
		 * @param params 
		 */
		addActor(child: gi.Clutter.Actor, params?: Partial<AddActorParams>): void;

		private _removeChild(child: gi.Clutter.Actor): void;

		removeActor(child: gi.Clutter.Actor): void;

		setShowDot(show: boolean): void;

		private _onRepaintDot(area: any): void;

		/**
		 * This returns column widths in logical order (i.e. from the dot
		 * to the image), not in visual order (left to right)
		 */
		getColumnWidths(): number[];

		private _getPreferredWidth(actor: gi.Clutter.Actor, forHeight: number, alloc: gi.Clutter.Actor): void;

		private _getPreferredHeight(actor: gi.Clutter.Actor, forWidth: number, alloc: gi.Clutter.Actor): void;

		private _allocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags: any): void;

		setColumnWidths(widths: number[]): void;

		public connect(event: string, callback: Function): void

	}

	export class PopupMenuItem extends PopupBaseMenuItem {
		constructor(text: string, params?: PopupBaseMenuItemParams);

		setLabel(label: string): void;
		private _onRepaint(area: any): void;
	}

	export class PopupSeparatorMenuItem extends PopupBaseMenuItem {
		constructor();
	}

	export enum PopupAlternatingMenuItemState {
		DEFAULT = 0,
		ALTERNATIVE = 1
	}

	export class PopupAlternatingMenuItem extends PopupBaseMenuItem {
		label: gi.St.Label;
		state: PopupAlternatingMenuItemState;
		constructor(text: string, alternateText: string, params?: PopupBaseMenuItemParams);

		private _onMapped(): void;

		private _setState(state: PopupAlternatingMenuItemState): void;

		private _updateStateFromModifiers(): void;

		private _onCapturedEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		private _updateLabel(): void;

		private _canAlternate(): boolean;

		updateText(text: string, alternateText: string): void;
	}

	export class PopupSliderMenuItem extends PopupBaseMenuItem {
		constructor(value: number);

		protected _slider: gi.St.DrawingArea;
		protected _releaseId: number;
		protected _dragging: boolean;
		protected _mark_position: boolean;

		setValue(value: number): void;

		private _sliderRepaint(area: any): void;

		private _startDragging(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void;

		private _endDragging(): boolean;

		private _onScrollEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void;

		private _motionEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		private _moveHandle(absX: number, absY: number): void;

		get value(): number;
		set_mark(value: number): void;
	}

	export class Switch {
		state: boolean;
		constructor(state: boolean);

		setToggleState(state: boolean): void
		toggle(): void;
	}

	export class PopupSwitchMenuItem extends PopupBaseMenuItem {
		label: gi.St.Label;
		constructor(text: string, active: boolean, params?: PopupBaseMenuItemParams)

		setStatus(text: string): void;
		activate(event: any): void;
		toggle(): void;
		get state(): boolean;
		setToggleState(state: boolean): void;
	}

	export class PopupSwitchIconMenuItem extends PopupBaseMenuItem {

		/**
		 * 
		 * @param text text to display in the label
		 * @param active to set switch on or off
		 * @param iconName name of the icon used
		 * @param iconType the type of icon (usually #St.IconType.SYMBOLIC
		 * or #St.IconType.FULLCOLOR
		 * @param params 
		 */
		constructor(text: string, active: boolean, iconName: string, iconType: gi.St.IconType, params?: PopupBaseMenuItemParams);

		/**
		 * Changes the icon to a symbolic icon with name iconName.
		 * @param iconName name of the icon
		 */
		setIconSymbolicName(iconName: string): void;

		/**
		 * Changes the icon to a full color icon with name iconName.
		 * @param iconName name of the icon
		 */
		setIconName(iconName: string): void;

		setStatus(text: string): void;

		activate(event: any): void;

		toggle(): void;

		get state(): boolean;

		setToggleState(state: boolean): void;
	}

	/**
	 * short_description: A menu item with an icon and a text.
	 *
	 * This is a popup menu item displaying an icon and a text. The icon is
	 * displayed to the left of the text. #PopupImageMenuItem is a similar,
	 * deprecated item, that displays the icon to the right of the text, which is
	 * ugly in most cases. Do not use it. If you think you need to display the icon
	 * on the right, make your own menu item (by copy and pasting the code found
	 * below) because PopupImageMenuItem is deprecated and may disappear any time.
	 */
	export class PopupIconMenuItem extends PopupBaseMenuItem {
		/**
		 * 
		 * @param text text to display in the label
		 * @param iconName name of the icon used
		 * @param iconType the type of icon (usually #St.IconType.SYMBOLIC
		 * or #St.IconType.FULLCOLOR)
		 * @param params parameters to pass to %PopupMenu.PopupBaseMenuItem._init
		 */
		constructor(text: string, iconName: string, iconType: gi.St.IconType, params?: PopupBaseMenuItemParams)

		/**
		 * Changes the icon to a symbolic icon with name @iconName.
		 * @param iconName name of the icon
		 */
		setIconSymbolicName(iconName: string): void;

		/**
		 * Changes the icon to a full color icon with name @iconName.
		 * @param iconName name of the icon
		 */
		setIconName(iconName: string): void;
	}

	// Deprecated. Do not use
	export class PopupImageMenuItem extends PopupBaseMenuItem {
		constructor(text: string, iconName: string, params?: PopupBaseMenuItemParams)

		setIcon(name: string): void;
	}

	/**
	 * #PopupIndicatorMenuItem:
	 * @short_description: A menu item with text, ornaments and accel.
	 *
	 * This is a popup menu item displaying an text, a accel, and a ornament. The ornament
	 * is displayed to the left of the text and the accel will be displayed at the end of
	 * the item. The default ornament is an icon,  but can be replace for a check button,
	 * a radio button or empty.
	 */

	export class PopupIndicatorMenuItem extends PopupBaseMenuItem {
		constructor(text: string, params?: PopupBaseMenuItemParams)

		setAccel(accel: string): void;

		haveIcon(): boolean;

		setIconName(name: string): void;

		setGIcon(gicon: string): void;

		setOrnament(ornamentType: OrnamentType, state: boolean): void;

		destroy(): void;
	}

	export interface PopupMenuAbstractItemParams {
		label?: string;
		accel?: string;
		sensitive?: boolean;
		visible?: boolean;
		toggleType?: string;
		toggleState?: boolean;
		iconName?: string;
		iconData?: any;
		action?: string;
		paramType?: string; // This is a variant for GTK, better remove it?
		type?: FactoryClassTypes
	}

	/**
	 * short_description: A class to represent any abstract menu item.
	 *
	 * This is an abstract class for create a binding between the PopupMenuItem class ,
	 * and an abstract representation of a menu item. If you want to create a cinnamon
	 * menu structure, you need to inherit from this class and implement the functions
	 * getItemById and handleEvent. All instances of this class need to have a unique
	 * id to represent a menu item.
	 */
	export class PopupMenuAbstractItem {
		shellItem: any;
		parent: any;

		constructor(id: string, childrenIds: string[], params?: PopupMenuAbstractItemParams);

		getItemById(id: string): any;
		handleEvent(event: any, params: any): any;

		isVisible(): boolean;

		setVisible(visible: boolean): void;

		isSensitive(): boolean;

		setSensitive(sensitive: boolean): void;

		getLabel(): string;

		setLabel(label: string): void;

		getAction(): string;

		setAction(action: string): void;

		getParamType(): string;

		setParamType(paramType: string): void;

		getFactoryType(): FactoryClassTypes;

		setFactoryType(type: FactoryClassTypes): void;

		getIconName(): string;

		setIconName(iconName: string): void;

		getGdkIcon(): any;

		setGdkIcon(iconData: any): void;

		getToggleType(): string;

		setToggleType(toggleType: string): void;

		getToggleState(): boolean;

		setToggleState(toggleState: boolean): void;

		getAccel(): string;

		setAccel(accel: string): void;

		setShellItem(shellItem: any, handlers: any[]): void;

		private _updateLabel(): void;

		private _updateOrnament(): void;

		private _updateAccel(): void;

		private _updateImage(): void;

		private _updateVisible(): void;

		private _updateSensitive(): void;

		private _updateType(): void;

		getShellItem(): any;

		getId(): string;

		getChildrenIds(): string;

		getChildren(): any[];

		getParent(): any;

		setParent(parent: any): void;

		addChild(pos: number, child_id: string): void;

		removeChild(child_id: string): void;

		moveChild(child_id: string, newpos: number): void;

		connectAndRemoveOnDestroy(handlers: any[]): void;

		destroyShellItem(): void;

		// We try to not crash cinnamon if a shellItem will be destroyed and has the focus,
		// then we are moving the focus to the source actor.
		private _destroyShellItem(shellItem: any): void;

		/**
		 * 
		 * @param target 
		 * @param handlers { "signal": handler }
		 * @param idArray 
		 */
		private _connectAndSaveId(target: any, handlers: any, idArray: number[]): number[];

		private _disconnectSignals(obj: any, signals_handlers: any[]): void;

		private _onActivate(shellItem: any, event: gi.Clutter.Event, keepMenu?: boolean): void;

		private _onOpenStateChanged(menu: PopupMenuBase, open: boolean): void;

		private _onShellItemDestroyed(shellItem: any): void;

		private _onShellMenuDestroyed(shellMenu: any): void;

		destroy(): void;
	}

	/**
	 * This is a base popup menu class for more sophisticated popup menus to
	 * inherit. This cannot be instantiated.
	 */
	export class PopupMenuBase {
		/** The box containing the popup menu widgets. */
		readonly box: imports.gi.St.BoxLayout;
		/** Whether the popup menu is open. */
		readonly isOpen: boolean;
		length: number;
		/** Can be set while a menu is up to let all events
		 * through without special menu handling useful for scrollbars in menus, and
		 * probably not otherwise. */
		passEvents: boolean;
		/** If set, we don't send events (including
		 * crossing events) to the source actor for the menu which causes its prelight
		 * state to freeze */
		blockSourceEvents: boolean;
		sourceActor: gi.St.Widget;
		/**
		 * 
		 * @param sourceActor the actor that owns the popup menu
		 * @param styleClass the style class of the popup menu
		 */
		constructor(sourceActor: gi.St.Widget, styleClass?: string);

		/**
		 * Adds a #PopupMenuItem with label title to the menu. When the item is
		 * clicked, callback will be called.
		 * @param title the text to display on the item
		 * @param callback the function to call when clicked
		 * @returns the menu item created.
		 */
		addAction(title: string, callback: (event: any) => void): PopupMenuItem

		/**
		 * Adds a #PopupMenuItem with label title to the menu. When the item is
		 * clicked, Cinnamon Settings will be launched with the module module
		 * activated.
		 * @param title he text to display on the item
		 * @param module the module to launch
		 * @returns the menu item created.
		 */
		addSettingsAction(title: string, module: string): PopupMenuItem;

		/**
		 * Adds a #PopupMenuItem with label title to the menu. When the item is
		 * clicked, the command cmd will be executed.
		 * @param title the text to display on the item
		 * @param cmd the command to call
		 * @returnsthe menu item created.
		 */
		addCommandlineAction(title: string, cmd: string): PopupMenuItem;

		/**
		 * 
		 * @param menu the menu of interest
		 * @returns whether menu is a submenu of this menu.
		 */
		isChildMenu(menu: PopupMenuBase): boolean;

		/**
		 * Makes menu a submenu of this menu.
		 * @param menu the menu of interest
		 */
		addChildMenu(menu: PopupMenuBase): void;

		/**
		 * Removes menu from the current menu if it is a child.
		 * @param menu the menu of interest
		 */
		removeChildMenu(menu: PopupMenuBase): void;

		private _connectSubMenuSignals(object: any, menu: PopupMenuBase): void;

		private _connectItemSignals(menuItem: PopupMenuAbstractItem): void;

		private _updateSeparatorVisibility(menuItem: PopupMenuAbstractItem): void;

		/**
		 * Adds the menuItem to the menu.
		 * @param menuItem the item to include (can also
		 * be a #PopupMenuSection)
		 * @param position position to add the item at (empty for end
		 * of menu)
		 */
		addMenuItem(menuItem: PopupBaseMenuItem | PopupMenuSection, position?: number): void;

		/**
		 * Gets the width of each column this thing has. In popup menus, everything
		 * is put into columns, and the columns of all items align. This is used
		 * internally and shouldn't be fiddled with unless you are implementing
		 * other popup menu items.
		 */
		getColumnWidths(): number[];

		/**
		 * Sets the widths of each column according to widths so that things can
		 * align.
		 * @param widths the widths of each column
		 */
		setColumnWidths(widths: number[]): void;

		private _menuQueueRelayout(): void;

		addActor(actor: gi.St.Widget): void;

		private _getMenuItems(): PopupBaseMenuItem[];

		/** 
		 * The first item in the popup menu
		 */
		get firstMenuItem(): gi.St.Widget;

		/** The number of items in the popup menu. */
		get numMenuItems(): number;

		/**
		 * Clears everything inside the menu.
		 */
		removeAll(): void;

		/**
		 * Toggles the open/close state of the menu.
		 */
		toggle(): void;

		/**
		 * Toggles the open/close state of the menu with extra parameters
		 * @param animate whether or not to animate the open/close.
		 * @param onComplete the function to call when the toggle action
		 * completes.
		 */
		toggle_with_options(animate: boolean, onComplete: Function): void;

		/**
		 * Destroys the popup menu completely.
		 */
		destroy(): void;
	}

	/** An actual popup menu */
	export class PopupMenu extends PopupMenuBase {
		readonly actor: gi.St.Bin;
		/** Whether the popup menu is currently performing the
		* open/close animation. */
		readonly animating: boolean;
		/** Position relative to the sourceActor of the menu upon which the menu will be centered
		* (if possible). If -1, the menu will be centered on the @sourceActor. See %shiftToPosition for more details. */
		readonly slidePosition: number;
		customStyleClass: string;

		/**
		 * 
		 * @param sourceActor the actor that owns the popup menu
		 * @param orientation the side of the menu that will be attached to @ourceActor. See %setOrientation() for details
		 */
		constructor(sourceActor: gi.St.Widget, orientation: gi.St.Side);

		/**
		 * Sets the orientation of the sourceActor with respect to the menu. This function is deprecated and kept
		 * for compatibility with older code. Please use %setOrientation instead.
		 * @param side The new side of the menu
		 */
		setArrowSide(side: gi.St.Side): void;

		/**
		 * Sets the orientation of the sourceActor with respect to the menu. For example, if you use St.Side.TOP,
		 * the menu will try to place itself below the sourcActor unless there is not enough room for it.
		 * @param orientation The new orientation of the menu
		 */
		setOrientation(orientation: gi.St.Side): void;

		/**
		 * Adds a custom class name to the menu which allows it to be styled separately from other menus.
		 * @param className the custom class name to add
		 */
		setCustomStyleClass(className: string): void;

		/**
		 * Since the boxpointer was removed from the menu, this function now does nothing. Please do not use this
		 * function in new code.
		 * @param alignment the position of the arrow relative to the source
		 * actor.
		 */
		setSourceAlignment(alignment: number): void;

		/**
		 * Opens the popup menu
		 * @param animate  whether to animate the open effect or not
		 */
		open(animate: boolean): void;

		/**
		 * Closes the popup menu.
		 * @param animate whether to animate the close effect or not
		 */
		close(animate: boolean): void;

		/**
		 * This function specifies a new position at which to center the menu. The position is given in coordinates
		 * relative to the @sourceActor, and as such should always be positive. This is useful if, for example, you want
		 * the menu to open at the location of a mouse click rather than at the center of the actor. This function only
		 * moves the menu along one axis as determined by the orientation of the menu, so that the menu is always attached
		 * to the @sourceActor. For example, if the orientation is set to St.Side.TOP, this function will move the center
		 * along the x axis. If you have set the @slidePosition using this function and then wish to return to centering
		 * the menu on the center of the @sourceActor, you can do so by setting it to -1.
		 * @param slidePosition Position relative to the sourceActor of the menu upon which the menu will be centered
		 * (if possible). If -1, the menu will be centered on the sourceActor.
		 */
		shiftToPosition(slidePosition: number): void;

		private _calculatePosition(): void;

		/**
		 * This function is called internally to set the max-height and max-width
		 * properties of the popup menu such that it does not grow to a size larger
		 * than the monitor. Individual popup menus can override this method to
		 * change the max height/width if they really want to.
		 *
		 * Note that setting the max-height won't do any good if the minimum height
		 * of the menu is higher then the screen; it's useful if part of the menu
		 * is scrollable so the minimum height is smaller than the natural height.
		 */
		setMaxHeight(): void;

		private _boxGetPreferredWidth(actor: gi.Clutter.Actor, forHeight: number, alloc: gi.Clutter.Actor): void;

		private _boxGetPreferredHeight(actor: gi.Clutter.Actor, forWidth: number, alloc: gi.Clutter.Actor): void;

		private _boxAllocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags: any): void;

		private _onKeyPressEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		on_paint(actor: gi.St.Widget): void;
	}

	/**
	 * A submenu that can show and hide
	 *
	 * A submenu to be included in #PopupMenus/#PopupMenuSections. You usually
	 * don't want to create these manually. Instead you want to create a
	 * #PopupSubMenuMenuItem, which creates a #PopupSubMenu, and shows/hides the
	 * menu when clicked.
	 *
	 * Since submenus are usually used to hide long lists of things, they are
	 * automatically put into a #St.ScrollView such that their height will be limited
	 * by the css max-height property.
	 */
	export class PopupSubMenu extends PopupMenuBase {
		actor: gi.St.ScrollView;

		/**
		 * 
		 * @param sourceActor the actor that owns the popup menu
		 * @param sourceArrow a little arrow object inside the
		 * #PopupSubMenuMenuItem. When the submenu opens, the arrow is rotated by
		 * pi/2 clockwise to denote the status of the submenu.
		 */
		constructor(sourceActor: gi.St.Widget, sourceArrow?: gi.St.Icon);

		private _getTopMenu(): PopupMenu;

		private _needsScrollbar(): boolean;

		/**
		 * Opens the submenu
		 * @param animate whether the animate the open effect
		 */
		open(animate: boolean): void;

		/**
		 * Closes the submenu
		 * @param animate whether the animate the close effect
		 */
		close(animate: boolean): void;

		/**
		 * Closes the submenu after it has been unmapped. Used to prevent size changes
		 * when the parent is closing at the same time and may be tweening.
		 */
		closeAfterUnmap(): void;

		private _onKeyPressEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;
	}

	/**
	 * A section of a #PopupMenu that is transparent to user
	 *
	 * A section of a PopupMenu which is handled like a submenu (you can add and
	 * remove items, you can destroy it, you can add it to another menu), but is
	 * completely transparent to the user. This is helpful for grouping things
	 * together so that you can manage them in bulk. A common use case might be to
	 * let an object inherit a #PopupMenuSection and then add the whole object to a
	 * popup menu.
	 *
	 * Note that you cannot close a #PopupMenuSection.
	 */
	export class PopupMenuSection extends PopupMenuBase {
		open(animate: boolean): void;
		close(): void;
	}

	export class PopupSubMenuMenuItem extends PopupBaseMenuItem {
		constructor(text: string)

		private _subMenuOpenStateChanged(menu: PopupMenu, open: boolean): void;

		destroy(): void;
		activate(event: any): void;
		menu: PopupSubMenu;
	}

	export class PopupComboMenu extends PopupMenuBase {
		constructor(sourceActor: gi.St.Widget);

		open(): void;

		private _onKeyFocusIn(actor: gi.Clutter.Actor): void;

		close(): void;

		setActiveItem(position: number): void;

		setItemVisible(position: number, visible: boolean): void;

		getItemVisible(position: number): boolean;
	}

	export class PopupComboBoxMenuItem extends PopupBaseMenuItem {
		constructor(parasm?: PopupBaseMenuItemParams);

		private _getTopMenu(): PopupMenu;

		private _onScrollEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void;

		activate(event: any): void;

		addMenuItem(menuItem: gi.St.Widget, position?: number): void;

		checkAccessibleLabel(): void;

		setActiveItem(position: number): void;

		setItemVisible(position: number, visible: boolean): void;

		private _itemActivated(menuItem: PopupBaseMenuItem, event: gi.Clutter.Event, position: number): void;
	}

	/**
	 A class to build a cinnamon menu using some abstract menu items.
	*
	* This class can build a cinnamon menu, using the instances of a heir of the
	* PopupMenuAbstractItem class. Please see the description of the PopupMenuAbstractItem
	* class to more details. To initialize the construction you need to provide the root
	* instance of your abstract menu items.
	*/
	export class PopupMenuFactory {

		private _createShellItem(factoryItem: any, launcher: any, orientation: gi.St.Side): any;

		getShellMenu(factoryMenu: any): any;

		buildShellMenu(client: any, launcher: any, orientation: gi.St.Side): any;

		private _attachToMenu(shellItem: any, factoryItem: any): void;

		private _onDestroyMainMenu(factoryItem: any): void;

		private _createItem(factoryItem: any): any;

		private _createChildrens(factoryItem: any): void;

		private _onChildAdded(factoryItem: any, child: any, position: number): void;

		private _onChildMoved(factoryItem: any, child: any, oldpos: number, newpos: number): void;

		private _onTypeChanged(factoryItem: any): void;

		private _moveItemInMenu(menu: PopupMenu, factoryItem: any, newpos: number): void;
	}

	/* Basic implementation of a menu manager.
	* Call addMenu to add menus
	*/
	export class PopupMenuManager {
		readonly grabbed: boolean;
		readonly _signals: misc.signalManager.SignalManager;
		readonly shouldGrab: boolean;

		constructor(owner: any, shouldGrab?: boolean);

		addMenu(menu: PopupMenuBase, position?: number): void;

		removeMenu(menu: PopupMenuBase): void;

		private _grab(): void;

		private _ungrab(): void;

		private _onMenuOpenState(menu: PopupMenu, open: boolean): void;

		private _onChildMenuAdded(menu: PopupMenu, childMenu: PopupBaseMenuItem): void;

		private _onChildMenuRemoved(menu: PopupMenu, childMenu: PopupBaseMenuItem): void;

		// change the currently-open menu without dropping grab
		private _changeMenu(newMenu: PopupMenu): void;

		private _onMenuSourceEnter(menu: PopupMenu): boolean;

		private _onKeyFocusChanged(): void;

		private _onMenuDestroy(menu: PopupMenu): void;

		private _activeMenuContains(actor: gi.Clutter.Actor): boolean;

		private _eventIsOnActiveMenu(event: gi.Clutter.Event): void;

		private _shouldBlockEvent(event: gi.Clutter.Event): boolean;

		private _onEventCapture(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		private _closeMenu(): void;

		destroy(): void;
	}
}