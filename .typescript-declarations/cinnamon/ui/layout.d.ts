/** The file responsible for managing Cinnamon chrome */
declare namespace imports.ui.layout {

	function isPopupMetaWindow(actor: gi.Clutter.Actor): boolean;

	interface ChromeParams {
		/** The actor should be hidden when a window on the same monitor is fullscreen. Default %false. */
		visibleInFullcreen: boolean;
		/** The actor's allocation should be used to add window manager struts. Default %false. */
		affectsStruts: boolean;
		/**  The actor should be added to the stage input region. Default %true. */
		affectsInputRegion: boolean;
		/** The actor should be added as a top-level window. Default %false. */
		addToWindowgroup: boolean;
		/** The actor should not be added to the uiGroup. This has no effect if %addToWindowgroup is %true. Default %false.	 */
		doNotAdd: boolean;
	}

	export class Monitor {
		public index: number;
		public x: number;
		public y: number;
		public width: number;
		public height: number;

		public constructor(index: number, geometry: gi.Meta.Rectangle);

		get inFullscreen(): boolean;
	}


	export type LayoutManagerSignals = "monitors-changed";

	/**
	 * #LayoutManager
	 *
	 * @short_description: Manager of Cinnamon Chrome
	 *
	 * Creates and manages the Chrome container which holds
	 * all of the Cinnamon UI actors.
	 */
	export class LayoutManager {
		protected _rtl: boolean;
		public monitors: Monitor[];
		public primaryMonitor: Monitor;
		public primaryIndex: number;
		public hotCornerManager: hotCorner.HotCornerManager;
		public edgeRight: edgeFlip.EdgeFlipper;
		public edgeLeft: edgeFlip.EdgeFlipper;
		public hideIdleId: number;
		protected _Chrome: Chrome;
		public enabledEdgeFlip: boolean;
		public edgeFlipDelay: number;
		public keyboardBox: gi.St.BoxLayout;
		protected _activationTime: number;
		protected _coverPane: gi.Clutter.Actor;

		protected _onEdgeFlipChanged(): void;

		/**
		 * This is called by Main after everything else is constructed;
		 * Certain functions need to access other Main elements that do
		 * not exist yet when the LayoutManager was constructed.
		 */
		public init(): void;

		protected _toggleExpo(): void;

		protected _updateMonitors(): void;

		protected _updateBoxes(): void;

		protected _monitorsChanged(): void;

		public get focusIndex(): number;

		public get focusMonitor(): Monitor;

		public get currentMonitor(): Monitor;

		protected _prepareStartupAnimation(): void;

		protected _doStartupAnimation(): void;

		protected _startupAnimationComplete(): void;

		public showKeyboard(): void;

		public queueHideKeyboard(): void;

		public hideKeyboard(immediate: boolean): boolean;

		/**
		 * Updates input region and struts for all chrome actors. If `doVisibility` is true,
		 * then the visibility state of all chrome actors is recalculated first.
		 *
		 * Use with care as this is already frequently updated, and can reduce performance
		 * if called unnecessarily.
		 * @param doVisibility whether to recalculate visibility.
		 */
		public updateChrome(doVisibility?: boolean): void;

		/**
		 * Adds @actor to the chrome, and (unless %affectsInputRegion in
		 * @params is %false) extends the input region to include it.
		 * Changes in @actor's size, position, and visibility will
		 * automatically result in appropriate changes to the input
		 * region.
		 *
		 * If %affectsStruts in @params is %true (and @actor is along a
		 * screen edge), then @actor's size and position will also affect
		 * the window manager struts. Changes to @actor's visibility will
		 * NOT affect whether or not the strut is present, however.
		 *
		 * If %visibleInFullscreen in @params is %true, the actor will be
		 * visible even when a fullscreen window should be covering it.
		 * @param actor an actor to add to the chrome
		 * @param params additional params
		 */
		public addChrome(actor: gi.Clutter.Actor, params?: Partial<ChromeParams>): void;

		/**
		 * Tells the chrome to track @actor, which must be a descendant
		 * of an actor added via addChrome(). This can be used to extend the
		 * struts or input region to cover specific children.
		 *
		 * @params can have any of the same values as in addChrome(),
		 * though some possibilities don't make sense (eg, trying to have
		 * a %visibleInFullscreen child of a non-%visibleInFullscreen
		 * parent).
		 * @param actor a descendant of the chrome to begin tracking
		 * @param params additional params - defaults to same as chrome ancestor
		 */
		public trackChrome(actor: gi.Clutter.Actor, params?: Partial<ChromeParams>): void;

		/**
		 *  Undoes the effect of trackChrome()
		 * @param actor an actor previously tracked via trackChrome()
		 */
		public untrackChrome(actor: gi.Clutter.Actor): void;

		/**
		 * Removes the actor from the chrome
		 * @param actor a chrome actor
		 */
		public removeChrome(actor: gi.Clutter.Actor): void;

		/**
		 * Finds the monitor the actor is currently located on.
		 * If the actor is not found the primary monitor is returned.
		 * @param actor the actor to locate
		 * @returns the monitor
		 */
		public findMonitorForActor(actor: gi.Clutter.Actor): Monitor;

		/**
		 * Finds the index of the monitor the actor is currently
		 * located on. If the actor is not found the primary monitor
		 * index is returned.
		 * @param actor the actor to locate
		 * @returns the monitor index
		 */
		public findMonitorIndexForActor(actor: gi.Clutter.Actor): number;

		/**
		 * Determines whether the actor is currently tracked or not.
		 * @param actor the actor to check
		 * @returns whether the actor is currently tracked
		 */
		public isTrackingChrome(actor: gi.Clutter.Actor): boolean;
	}

	export class Chrome {
		protected _layoutManager: LayoutManager;
		protected _monitors: Monitor[];
		protected _inOverview: boolean;
		protected _isPopupWindowVisible: boolean;
		protected _primaryMonitor: Monitor;
		protected _primaryIndex: number;
		protected _updateRegionIdle: number;
		protected _freezeUpdateCount: number;
		protected _trackedActors: gi.Clutter.Actor[];

		public constructor(layoutManager: LayoutManager);

		public init(): void;

		public addActor(actor: gi.Clutter.Actor, params?: Partial<ChromeParams>): void;

		public trackActor(actor: gi.Clutter.Actor, params?: Partial<ChromeParams>): void;

		public untrackActor(actor: gi.Clutter.Actor): void;

		public removeActor(actor: gi.Clutter.Actor): void;

		protected _findActor(actor: gi.Clutter.Actor): boolean;

		public modifyActorParams(actor: gi.Clutter.Actor, params: Partial<ChromeParams>): void;

		protected _trackActor(actor: gi.Clutter.Actor, params?: Partial<ChromeParams>): void;

		protected _untrackActor(actor: gi.Clutter.Actor): void;

		protected _actorReparented(actor: gi.Clutter.Actor, oldParent?: gi.Clutter.Actor): void;

		protected _updateVisibility(): void;

		protected _overviewShowing(): void;

		protected _overviewHidden(): void;

		protected _relayout(): void;

		/**
		 * 
		 * @param x 
		 * @param y 
		 * @param w 
		 * @param h 
		 * @returns [index, Monitor]
		 */
		protected _findMonitorForRect(x: number, y: number, w: number, h: number): any[];

		protected _findMonitorForWindow(window: gi.Meta.Rectangle): Monitor;

		/**
		 * 
		 * @param actor 
		 * @returns [monitorIndex, layout.Monitor]
		 */
		public getMonitorInfoForActor(actor: gi.Clutter.Actor): any[];

		// This call guarantees that we return some monitor to simplify usage of it
		// In practice all tracked actors should be visible on some monitor anyway
		public findMonitorForActor(actor: gi.Clutter.Actor): Monitor;

		public findMonitorIndexForActor(actor: gi.Clutter.Actor): number;

		protected _queueUpdateRegions(): void;

		public freezeUpdateRegions(): void;

		public thawUpdateRegions(): void;

		public _windowsRestacked(): void;

		public updateRegions(): boolean;
	}
}