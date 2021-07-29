
/**
 * @short_description The file responsible for managing panels
 *
 * This file is where everything about panels happens. #Main will create a
 * #PanelManager object, which is responsible for creating and moving panels.
 * There is also a %checkPanelUpgrade function used as a transition between the
 * old panel settings and the new panel settings.
 */
declare namespace imports.ui.panel {

	export enum Direction {
		LEFT = 0,
		RIGHT = 1
	}

	export enum CornerType {
		topleft = 0,
		topright = 1,
		bottomleft = 2,
		bottomright = 3,
		dummy = 4
	}

	export enum PanelLoc {
		top = 0,
		bottom = 1,
		left = 2,
		right = 3
	}

	// To make sure the panel corners blend nicely with the panel,
	// we draw background and borders the same way, e.g. drawing
	// them as filled shapes from the outside inwards instead of
	// using cairo stroke(). So in order to give the border the
	// appearance of being drawn on top of the background, we need
	// to blend border and background color together.
	// For that purpose we use the following helper methods, taken
	// from st-theme-node-drawing.c
	function _norm(x: number): number;

	function _over(srcColor: gi.Clutter.Color, dstColor: gi.Clutter.Color): gi.Clutter.Color;

	function _premultiply(color: gi.Clutter.Color): gi.Clutter.Color;

	function _unpremultiply(color: gi.Clutter.Color): gi.Clutter.Color;

	/**
	 * Run from main, prior to PanelManager being initialized
	 * this handles the one-time transition between panel implementations
	 * to make this transition invisible to the user.  We will evaluate the
	 * desktop-layout key, and pre-set applets-enabled and panels-enabled
	 * appropriately.
	 */
	export function checkPanelUpgrade(): void;

	/**
	 * Retrieves the heights used in horizontal panels on the monitor to that
	 * vertical panels can be sized and positioned not to overlap them
	 * @param monitorIndex (integer) index of monitor
	 * @param listofpanels array of panels
	 * @returns a two element array
	 */
	export function heightsUsedMonitor(monitorIndex: number, listofpanels: Panel[]): number[];

	/**
	 * get the panel numeric type from its name in settings
	 * @param pname panel type
	 * @returns panel type
	 */
	export function getPanelLocFromName(pname: string): PanelLoc;

	/**
	 * Calculates the nearest standard icon size up to a maximum.
	 * @param maxSize he maximum size of the icon
	 * @returns an integer, the icon size
	 */
	export function toStandardIconSize(maxSize: number): number;

	export function setHeightForPanel(panel: Panel): number;

	/**
	 * Manager of Cinnamon panels
	 *
	 * #PanelManager creates panels and startup and
	 * provides methods for easier access of panels
	 */
	export class PanelManager {
		public readonly dummyPanels: Panel[];
		public readonly panelCount: number;
		public readonly panels: Panel[];
		public readonly panelsMeta: any[];
		public readonly canAdd: boolean;
		public readonly addPanelMode: boolean;

		/** Does a full load of all panels
		 * _fullPanelLoad loads all panels in order, and makes any adjustments to permit vertical panels to fit snugly
		 *                 between horizontal ones
		 */
		private _fullPanelLoad(): void;

		/**
		 * Disables (hide and lock) all panels
		 */
		public disablePanels(): void;

		/**
		 * Enables all panels
		 */
		public enablePanels(): void;

		/**
		 * Sets the opacity of all panels to @opacity
		 * @param opacity (int) opacity of panels
		 */
		public setPanelsOpacity(opacity: number): void;

		/**
		 * Lowers actor to just under the panel actors
		 * @param actor actor to stack below the panels
		 * @param group 
		 */
		public lowerActorBelowPanels(actor: gi.Clutter.Actor, group?: any): void;

		/**
		 * Remove the panel from the list panels-enabled
		 * @param panelId Panel id of the panel to be removed
		 */
		public removePanel(panelId: number): void;

		/**
		 * Adds a new panel to the specified position
		 * @param monitorIndex monitor to be added to
		 * @param panelPosition where the panel is added
		 */
		public addPanel(monitorIndex: number, panelPosition: number): void;

		/**
		 * Moves the panel of id this.moveId to the specified position
		 * @param monitorIndex monitor to be added to
		 * @param panelPosition where the panel is added
		 */
		public movePanel(monitorIndex: number, panelPosition: number): void;

		/**
		 * Destroys all panel dummies
		 */
		private _destroyDummyPanels(): void;

		/**
		 * Retrieves all the panels in the monitor of index monitorIndex
		 * @param monitorIndex index of monitor
		 * @returns an array of panels
		 */
		public getPanelsInMonitor(monitorIndex: number): Panel[];

		/**
		 * Retrieves all panels
		 * @returns an array of panels
		 */
		public getPanels(): Panel[];

		/**
		 * Gets a specific panel in monitor @monitorIndex
		 * @param monitorIndex index of monitor
		 * @param panelPosition where the panel is added
		 * @returns the panel required (null if panel not found)
		 */
		public getPanel(monitorIndex: number, panelPosition: number): Panel;

		/**
		 * Prompts every panel to update its visibility (show/hide). This is used
		 * by WindowManager after window map/tile/etc animations, and after popup
		 * menus close.
		 */
		public updatePanelsVisibility(): void;

		/**
		 * Loads a panel with the given properties and appends it to @panelList. @panelList is usually this.panels but is a different array when used by _onPanelsEnabledChanged.
		 * @param ID panel id
		 * @param monitorIndex index of monitor of panel
		 * @param panelPosition  where the panel should be
		 * @param drawcorner whether to draw corners for [left, right]
		 * @param panelList (optional) the list in which the new panel should be appended to (not necessarily this.panels, c.f. _onPanelsEnabledChanged) Default: this.panels
		 * @param metaList (optional) the list in which the new panel metadata should be appended to (not necessarily this.panelsMeta, c.f. _onPanelsEnabledChanged)
		 *                   Default: this.panelsMeta
		 * @returns Panel created
		 */
		private _loadPanel(ID: number, monitorIndex: number, panelPosition: PanelLoc, drawcorner: number[], panelList?: Panel[], metaList?: any[]): Panel;

		private _checkCanAdd(): void;

		private _updateAllPointerBarriers(): void;

		/**
		 * This will be called whenever the panels-enabled settings key is changed
		 * i.e. when panels are added, moved or removed.
		 */
		private onPanelsEnabledChanged(): void;

		/**
		 * Load all corners
		 * @param panelProperties panels-enabled settings string
		 */
		private _fullCornerLoad(panelProperties: string): void;

		private _onMonitorsChanged(): void;

		private _onPanelEditModeChanged(): void;

		/**
		 * Prompts user where to add the panel
		 */
		public addPanelQuery(): void;

		/**
		 * Prompts user where to move the panel
		 * @param id the id of the panel to be moved
		 */
		public movePanelQuery(id: number): void;

		/**
		 * shows the dummy panels
		 * @param callback 
		 */
		private _showDummyPanels(callback: () => void): boolean;

		/**
		 * Set Main.panel so that applets that look for it don't break
		 */
		private _setMainPanel(): void;

		public resetPanelDND(): void;

	}

	/** Dummy panels for users to select new position of panel
	 *
	 * #PanelDummy creates some boxes at possible panel locations for users to
	 * select where to place their new panels
	 */
	export class PanelDummy {
		public readonly monitorIndex: number;
		public readonly panelPosition: number;
		public readonly callback: number;
		public readonly monitor: any;
		public readonly actor: gi.Cinnamon.GenericContainer;

		constructor(monitorIndex: number, panelPosition: PanelLoc, callback: () => void);

		private _onClicked(): void;

		private _onEnter(): void;

		private _onLeave(): void;

		/**
		 * Destroys panel dummy actor
		 */
		private destroy(): void;
	}

	export class AnimatedIcon {
		public readonly actor: gi.St.Bin;

		constructor(name: string, size: number)

		private _update(): boolean;

		private _onDestroy(): void;
	}

	export class TextShadower {
		public readonly actor: gi.Cinnamon.GenericContainer;
		private readonly _label: gi.St.Label;

		private _getPreferredWidth(actor: gi.Cinnamon.GenericContainer, forHeight: number, alloc: gi.St.Widget): void;

		private _getPreferredHeight(actor: gi.Cinnamon.GenericContainer, forHeight: number, alloc: gi.St.Widget): void;

		private _allocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags?: any): void;
	}

	/**
	 * PanelCorner:
	 * @box: the box in a panel the corner is associated with
	 * @side: the side of the box a text or icon/text applet starts from (RTL or LTR driven)
	 * @cornertype:  top left, bottom right etc.
	 *
	 * Sets up a panel corner
	 *
	 * The panel corners are there for a non-obvious reason.  They are used as the positioning points for small
	 * drawing areas that use some optional css to draw small filled arcs (in the repaint function).  This allows
	 * windows with rounded corners to be blended into the panels in some distros, gnome shell in particular.
	 * In mint tiling and full screen removes any rounded window corners anyway, so this optional css is not there in
	 * the main mint themes, and the corner/cairo functionality is unused in this case. Where the corners are used they will be
	 * positioned so as to fill in the tiny gap at the corners of full screen windows, and if themed right they
	 * will be invisble to the user, other than the window will appear to go right up to the corner when full screen
	 */
	export class PanelCorner {
		private readonly _side: any;
		private readonly _box: gi.Clutter.ActorBox;
		private readonly _cornertype: any;
		public readonly cornerRadius: number;
		public readonly actor: gi.St.DrawingArea;

		constructor(box: gi.Clutter.ActorBox, side: any, cornertype: any);

		private _repaint(): void;

		private _styleChanged(): void;
	}

	export class SettingsLaucnher extends popupMenu.PopupIconMenuItem {

		constructor(label: string, keyword: string, icon: string);
	}

	export class PanelContextMenu extends popupMenu.PopupMenu {

		constructor(launcher: gi.St.Widget, orientation: gi.St.Side, panelId: number);

		public open(animate: boolean): void;
	}

	export class PanelZoneDNDHandler {

		constructor(panelZone: PanelLoc, zoneString: string, panelId: number);

		public handleDragOver(source: applet.Applet, actor: gi.Clutter.Actor, x: number, y: number, time: number): dnd.DragMotionResult;

		private _handleLeaveEvent(): void;

		private handleDragOut(): void;

		public acceptDrop(source: applet.Applet, actor: gi.Clutter.Actor, x: number, y: number, time: number): boolean;

		private _clearDragPlaceholder(): void;

		private _hasSupportedLayout(applet: applet.Applet): boolean;

		public reset(): void;
	}

	interface EmptyZoneSizes {
		fullcolor: Sides;
		symbolic: Sides;
		text: Sides;
	}

	interface Sides {
		left: number;
		center: number;
		right: number;
	}

	type PanelVisibility = "true" | "false" | "intel";

	/**
	 * #Panel:A panel object on the monitor
	 *
	 * This represents a panel on the screen.
	 */

	export class Panel {
		/**  the id of the panel */
		public readonly panelId: number;
		/** the index of the monitor containing the panel */
		public readonly monitorIndex: number;
		/** the height already taken on the screen by a top panel */
		public readonly toppanelHeight: number;
		/** the height already taken on the screen by a bottom panel */
		public readonly bottompanelHeight: number;
		/** [left, right] whether to draw corners alongside the panel */
		public readonly drawcorner: number[];

		/** the geometry (bounding box) of the monitor */
		public readonly monitor: gi.Meta.Rectangle;
		/** where the panel is on the screen */
		public readonly panelPosition: PanelLoc;
		/** the actor of the panel */
		public readonly actor: gi.Cinnamon.GenericContainer;

		public readonly height: number;
		public readonly margin_top: number;
		public readonly margin_bottom: number;
		public readonly margin_left: number;
		public readonly margin_right: number;

		public readonly themeSettings: gi.Gio.Settings;

		/** the box containing all the applets in the left region */
		private _leftBox: gi.St.BoxLayout;
		/** the box containing all the applets in the center region */
		private _centerBox: gi.St.BoxLayout;
		/** the box containing all the applets in the right region */
		private _rightBox: gi.St.BoxLayout;
		/** whether the panel is currently hidden  */
		private _hidden: boolean;
		/** whether the panel is disabled */
		private _disabled: boolean;
		/**  whether the panel edit mode is on */
		private _panelEditMode: boolean;
		/** the context menu of the panel */
		private _context_menu: PanelContextMenu;
		private _signalManager: misc.signalManager.SignalManager;


		/**
		 * 
		 * @param id the id of the panel
		 * @param monitorIndex the index of the monitor containing the panel
		 * @param panelPosition where the panel is on the screen
		 * @param toppanelHeight the height already taken on the screen by a top panel
		 * @param bottompanelHeight the height already taken on the screen by a bottom panel
		 * @param drawcorner [left, right] whether to draw corners alongside the panel
		 */
		constructor(id: number, monitorIndex: number, panelPosition: PanelLoc, toppanelHeight: number, bottompanelHeight: number, drawcorner: number[]);

		public drawCorners(drawcorner: number[]): void;

		private _destroycorners(): void;

		/**
		 * Moves the panel to the monitor monitorIndex and position panelPosition
		 * @param monitorIndex integer, index of monitor
		 * @param panelPosition integer, where the panel should be placed
		 */
		public updatePosition(monitorIndex: number, panelPosition: number): void;

		/**
		 * Adds a context menu to the panel
		 * @param panelPosition 
		 */
		public addContextMenuToPanel(panelPosition: number): void;

		/**
		 * Adds the panel style class.  NB the original #panel style class is kept
		 * @param panelPosition 
		 */
		public addPanelStyleClass(panelPosition: number): void;

		/**
		 * Destroys the pane
		 * @param removeIconSizes whether to remove zone icon size settings. Default value is true.
		 */
		public destroy(removeIconSizes?: boolean): void;


		public peekPanel(): void | boolean;

		/**
		 * Turns on/off the highlight of the panel
		 * @param highlight whether to turn on or off
		 */
		public highlight(highlight: boolean): void;

		/**
		 * @returns whether the panel can be hidden (auto-hide or intellihide)
		 */
		public isHideable(): boolean

		/**
		 * Gets the desired property of the panel from gsettings
		 * @param key name of gsettings key
		 * @param type type of data requested. "b" for boolean, "i" for integer. Default value is string
		 * @returns property required
		 */
		private _getProperty(key: string, type?: string): string | boolean | number;

		/**
		 * Gets the desired JSON encoded property of the panel from gsettings
		 * @param key name of gsettings key
		 * @returns property required
		 */
		private _getJSONProperty(key: string): any;

		public handleDragOver(source: any, actor: gi.Clutter.Actor, x: number, y: number, time: number): dnd.DragMotionResult;

		/**
		 * _updatePanelBarriers:
		 *
		 * https://cgit.freedesktop.org/cgit/?url=xorg/proto/fixesproto/plain/fixesproto.txt
		 */
		private _updatePanelBarriers(): void;

		private _clearPanelBarriers(): void;

		private _onPanelEditModeChanged(): void;

		private _onButtonPressEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void;

		private _onFocusChanged(): void;

		private _processPanelAutoHide(): void;

		/**
		 * Function to calculate the desired panel height
		 * @returns panelheight
		 */
		private _getScaledPanelHeight(): number;

		/**
			* If hidden is true the clip region is set to the one exposed strip of pixels
			* adjacent to the monitor edge. Otherwise, the clip region is set to the panel
			* size plus the shadow on the side of the panel opposite the monitor edge.
			*
			* @ffset is only used during tweens. If provided, it is used to offset the
			* current position in order to calculate the exposed size.
			* @param hidden whether the panel should be clipped for hide
			* @param offset x or y position offset
			*/
		private _setClipRegion(hidden: boolean, offset?: number): void;

		/**
		 * Function to update the panel position, size, and clip region according to settings
		 * values.  Note that this is also called when the style changes.
		 */
		private _moveResizePanel(): boolean;

		private _set_orientation(): void;

		private _set_vertical_panel_style(): void;

		private _set_horizontal_panel_style(): void;

		private _setPanelHeight(): void;


		private _createEmptyZoneSizes(): EmptyZoneSizes;

		private _onPanelZoneSizesChanged(value: number, key: string): void;

		private _clampPanelZoneTextSize(panelZoneSizeSet: any, typeString: string, zoneString: string, defaults: any): number;

		private _clampPanelZoneColorIconSize(panelZoneSizeSet: any, typeString: string, zoneString: string, defaults: any): number;

		private _clampPanelZoneSymbolicIconSize(panelZoneSizeSet: any, typeString: string, zoneString: string, defaults: any): number;

		public getPanelZoneIconSize(locationLabel: string, iconType: gi.St.IconType): number;

		private _removeZoneIconSizes(): void;

		private _getPreferredWidth(actor: gi.Clutter.Actor, forHeight: number, alloc: gi.Clutter.Actor): void;

		private _getPreferredHeight(actor: gi.Clutter.Actor, forHeight: number, alloc: gi.Clutter.Actor): void;

		/**
		 * Given the minimum and natural width requested by each box, this function
		 * calculates how much width should actually allocated to each box. The
		 * function returns two variables [@leftBoundary, @rightBoundary]
		 *
		 * The expected outcome of the code is as follows:
		 *
		 * Horizontal panels:
		 * Assuming that the centerBox is filled, the primary objective is to center
		 * the centerBox whenever possible. This will be done all the time unless doing
		 * so requires some box's width to go under its minimum width.
		 *
		 * If we are centering the centerBox, there are two possible scenarios.
		 * Firstly, if the centerBox can be perfectly centered while everything takes
		 * their natural size, then everything will be allocated at least their natural
		 * size such that the centerBox is centered, leftBox is left aligned, rightBox
		 * is right aligned.
		 *
		 * Otherwise, we first allocate the minWidth to every box, and then distribute
		 * the remaining space proportional to how much more space each box wants.
		 * This is done in a way that ensures the leftWidth and rightWidth are equal.
		 *
		 * If it is not possible to center the centerBox, but there is enough space to
		 * just allocate the boxes, the centerBox will be made as centered as possible
		 * without making things go under their minWidth. This is achieved by making
		 * the shorter box go to their min width, and distributing the remaining space
		 * among the two other boxes.
		 *
		 * Finally, if there isn't even enough space to just put the things, the width
		 * allocated is just proportional to the minimum width.
		 *
		 * In the cases where the centerBox is not occupied, a similar mechanism is
		 * employed. If there is enough space for everything to get their natural
		 * width, this will happen. Otherwise, we first allocate the minimum width and
		 * then distribute the remaining space proportional to how much more space each
		 * box wants. In the scenario where the isn't enough space to just allocate the
		 * minimum width, we just allocate proportional to the minimum width.
		 *
		 * FIXME: consider replacing all of this with clutter constraints.  Fundamentally
		 * we have three boxes constrained to be butted up against each other and to stretch
		 * over the whole panel.  If the centre box is populated then it needs to be centred.
		 * Any field has to be given a minimum size in edit mode to allow drag and drop.
		 * @param allocWidth allocated total width
		 * @param allocHeight allocated total height
		 * @param vertical if on vertical panel
		 * @returns The left and right widths to be allocated.
		 */
		private _calcBoxSizes(allocWidth: number, allocHeight: number, vertical: boolean): number[];

		private _setCornerChildbox(childbox: gi.Clutter.ActorBox, x1: number, x2: number, y1: number, y2: number): void;

		private _setVertChildbox(childbox: gi.Clutter.ActorBox, y1: number, y2: number): void;

		private _setHorizChildbox(childbox: gi.Clutter.ActorBox, x1: number, x2: number, x1_rtl: number, x2_rtl: number): void;

		private _allocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags?: any): void;

		/**
		 * Checks whether the panel should show based on the autohide settings and
		 * position of mouse/active window. It then calls the _queueShowHidePanel
		 * function to show or hide the panel as necessary.
		 */
		private _updatePanelVisibility(): PanelVisibility;

		/**
		 * Makes the panel show or hide after a delay specified by
		 * panels-show-delay and panels-hide-delay.
		 */
		private _queueShowHidePanel(): void;

		private _enterPanel(): void;

		private _leavePanel(): void;

		/**

		* Disables the panel by settings the opacity to 0 and hides if autohide is
		* enable. The actor is then hidden after the animation.
		*/
		public disable(): void;

		/**
		 * Reverses the effects of the disable function.
		 */
		public enable(): void;

		/**
		 * A function to force the panel to show. This has no effect if the panel
		 * is disabled.
		 */
		private _showPanel(): void;

		/**
		 * This hides the panel unless this._shouldShow is false. This behaviour is
		 * overridden if the force argument is set to true. However, the panel
		 * will always not be hidden if a menu is open, regardless of the value of
		 * force.
		 * @param force whether or not to force the hide.
		 */
		private _hidePanel(force: boolean): void;

		public getIsVisible(): boolean;

		public resetDNDZones(): void;

		public connect(event: 'size-changed', cb: (actor: this, height: number) => void): number
		public connect(event: 'icon-size-changed', cb: (actor: this) => void): number
	}
}
