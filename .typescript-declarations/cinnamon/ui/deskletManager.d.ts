declare namespace imports.ui.deskletManager {

	interface DeskletImports {
		[key: string]: any;
	}
	/** Maps uuid -> importer object (desklet directory tree) */
	var desklets: DeskletImports;

	interface DeskletMeta {
		/** Path to the current desklet instance */
		path: string;
	}

	interface DeskletMetaLibrary {
		[key: string]: DeskletMeta;
	}

	/** Kept for compatibility*/
	var deskletMeta: DeskletMetaLibrary;

	const rawDefinitions: any;

	interface DeskletDefinition {
		uuid: string;
		desklet_id: number;
		x: number;
		y: number;
		desklet?: imports.ui.desklet.Desklet;
	}


	const definitions: DeskletDefinition[];

	const deskletsLoaded: boolean;

	const deskletsDragging: boolean;

	const userDeskletsDir: any;

	const mouseTrackEnabled: boolean;
	const mouseTrackTimoutId: number;
	const promises: any[];

	const deskletChangeKey: number;
	const ENABLED_DESKLETS_KEY: string;
	const DESKLET_SNAP_KEY: string;
	const DESKLET_SNAP_INTERVAL_KEY: string;
	const KEYBINDING_SCHEMA: string;
	const SHOW_DESKLETS_KEY: string;

	function initEnabledDesklets(): Promise<void>;

	function unloadRemovedDesklets(removedDeskletUUIDs: string[]): void;

	/**
	 * init:
	 *
	 * Initialize desklet manager
	 */
	function init(): Promise<void>;

	function getDeskletDefinition(definition: DeskletDefinition): DeskletDefinition;

	function updateMouseTracking(): void;

	function hasMouseWindow(): boolean;

	function checkMouseTracking(): boolean;

	/**
	 * removeDesklet:
	 * @uuid (string): uuid of the desklet
	 * @desklet_id (int): id of the desklet
	 *
	 * Disable and remove the desklet @uuid:@desklet_id
	 */
	function removeDesklet(uuid: string, desklet_id: number): void;

	/**
	 * getDefinitons:
	 *
	 * Gets the list of enabled desklets. Returns an associative array of three items:
	 * raw: the unprocessed array from gsettings
	 * definitions: Array(Object)
	 *
	 * Returns (dictionary): Associative array of three items
	 */
	function getDefinitions(): DeskletDefinition[];

	// Callback for extension.js
	function finishExtensionLoad(extensionIndex: number): boolean;

	// Callback for extension.js
	function prepareExtensionUnload(extension: any, deleteConfig: boolean): void;

	// Callback for extension.js
	function prepareExtensionReload(extension: any): void;

	function _onEnabledDeskletsChanged(): void;

	function _unloadDesklet(deskletDefinition: DeskletDefinition, deleteConfig: boolean): void;

	function _removeDeskletConfigFile(uuid: string, instanceId: number): void;

	function _loadDesklet(extension: any, deskletDefinition: DeskletDefinition): void;

	function _createDesklets(extension: any, deskletDefinition: DeskletDefinition): imports.ui.desklet.Desklet;

	function createDeskletDefinition(definition: DeskletDefinition): DeskletDefinition;

	function _deskletDefinitionsEqual(a: DeskletDefinition, b: DeskletDefinition): boolean;

	function get_object_for_uuid(uuid: string, instanceId: number): imports.ui.desklet.Desklet;

	function _onDeskletSnapChanged(): void;

	/**
	 * #DeskletContainer
	 *
	 * Container that contains manages all desklets actors
	 */
	class DeskletContainer {
		public actor: imports.gi.Clutter.Actor;
		public last_x: number;
		public last_y: number;

		protected _dragPlaceholder: imports.gi.St.Bin;

		public isModal: boolean;
		public stageEventIds: any[];

		public keyBindingSettings: imports.gi.Gio.Settings;

		public applyKeyBindings(): void;

		/**
		 * addDesklet:
		 * @actor (Clutter.Actor): actor of desklet to be added
		 *
		 * Adds @actor to the desklet container
		 */
		public addDesklet(actor: imports.gi.Clutter.Actor): void;

		/**
		 * contains:
		 * @actor (Clutter.Actor): actor to be tested
		 *
		 * Whether the desklet container contains @actor
		 *
		 * Returns (boolean): whether the desklet container contains the actor
		 */
		public contains(actor: gi.Clutter.Actor): boolean;

		public handleDragOver(source: any, actor: gi.Clutter.Actor, x: number, y: number, time?: number): dnd.DragMotionResult;

		public acceptDrop(source: any, actor: gi.Clutter.Actor, x: number, y: number, time?: number): boolean;

		public cancelDrag(source: any, actor: gi.Clutter.Actor): boolean;

		public hideDragPlaceholder(): void;

		public setModal(): void;

		public unsetModal(): void;

		public handleStageEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean;

		public raise(): void;

		public lower(): void;

		public toggle(): void;
	}

}