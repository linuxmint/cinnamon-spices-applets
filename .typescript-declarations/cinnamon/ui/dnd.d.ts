declare namespace imports.ui.dnd {

	export enum DragMotionResult {
		NO_DROP = 0,
		COPY_DROP = 1,
		MOVE_DROP = 2,
		POINTING_DROP = 3,
		CONTINUE = 4
	}

	export enum DragDropResult {
		FAILURE = 0,
		SUCCESS = 1,
		CONTINUE = 2
	}

	function _getEventHandlerActor(): gi.Clutter.Actor;

	export function addDragMonitor(monitor: any): void;

	export function removeDragMonitor(monitor: any): void;

	export function isDragging(): boolean;

	export interface DraggableParams {
		manualMode?: boolean;
		restoreOnSuccess?: boolean;
		overrideX?: number;
		overrideY?: number;
		dragActorMaxSize?: number;
		dragActorOpacity?: number;
	}

	export class Draggable {
		public readonly Name: string;
		public readonly actor: gi.Clutter.Actor;
		public readonly target: any;
		public readonly inhibit: boolean;
		public readonly recentDropTarget: any;
		public readonly buttonPressEventId: number;
		public readonly destroyEventId: number;

		constructor(actor: gi.Clutter.Actor, params?: DraggableParams, target?: any)

		private _onButtonPress(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void;

		private _grabActor(): void;

		private _ungrabActor(): void;

		private _grabEvents(): void;

		private _ungrabEvents(): void;

		private _onEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		/**
		 * Fake a release event.
		 * Must be called if you want to intercept release events on draggable
		 * actors for other purposes (for example if you're using
		 * PopupMenu.ignoreRelease())
		 */
		public fakeRelease(): void;

		/**
		 * Directly initiate a drag and drop operation from the given actor.
		 * This function is useful to call if you've specified manualMode
		 * for the draggable.
		 * @param stageX coordinate of event
		 * @param stageY Y coordinate of event
		 * @param time Event timestamp
		 */
		public startDrag(stageX: number, stageY: number, time: number): void;

		private _maybeStartDrag(event: gi.Clutter.Event): boolean;

		private _updateDragHover(): void | boolean;

		private _queueUpdateDragHover(): void;

		private _updateDragPosition(event: gi.Clutter.Event): boolean;

		private _setDragActorPosition(): void;

		private _dragActorDropped(event: gi.Clutter.Event): boolean;

		private _getRestoreLocation(): number[];

		private _cancelDrag(eventTime: number): void;

		private _onAnimationComplete(dragActor: gi.Clutter.Actor, eventTime: number): void;
	}

	/**
	 *  Create an object which controls drag and drop for the given actor.
	 *
	 * If %manualMode is %true in @params, do not automatically start
	 * drag and drop on click
	 *
	 * If %dragActorMaxSize is present in @params, the drag actor will
	 * be scaled down to be no larger than that size in pixels.
	 *
	 * If %dragActorOpacity is present in @params, the drag actor will
	 * will be set to have that opacity during the drag.
	 *
	 * Note that when the drag actor is the source actor and the drop
	 * succeeds, the actor scale and opacity aren't reset; if the drop
	 * target wants to reuse the actor, it's up to the drop target to
	 * reset these values.
	 * @param actor Source actor
	 * @param params Additional parameters
	 * @param target 
	 */
	export function makeDraggable(actor: gi.Clutter.Actor, params?: DraggableParams, target?: any): Draggable;

	export class GenericDragItemContainer {
		public readonly actor: gi.Clutter.Actor;
		animatingOut: boolean;
		child: gi.Clutter.Actor;

		constructor();

		private _allocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags?: any): void;

		private _getPreferredHeight(actor: gi.Clutter.Actor, forWidth: number, alloc: gi.Clutter.Actor): void;

		private _getPreferredWidth(actor: gi.Clutter.Actor, forHeight: number, alloc: gi.Clutter.Actor): void;

		public animateIn(onCompleteFunc?: () => void): void;

		public animateOutAndDestroy(onCompleteFunc?: () => void): void;

		public set childScale(scale: number);

		public get childScale(): number;

		public set childOpacity(opacity: number);

		public get childOpacity(): number;
	}

	export class GenericDragPlaceholderItem extends GenericDragItemContainer { }

	export class LauncherDraggable {
		public readonly launchersBox: any;
		constructor(launchersBox: any);

		public getId(): any;
	}

}
