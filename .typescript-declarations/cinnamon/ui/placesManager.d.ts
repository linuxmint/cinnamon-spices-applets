declare namespace imports.ui.placesManager {

	/**
	 * Represents a place object, which is most normally a bookmark entry,
	 * a mount/volume, or a special place like the Home Folder, Computer, and Network.
	 *
	 * @name: String title
	 * @iconFactory: A JavaScript callback which will create an icon texture given a size parameter
	 * @launch: A JavaScript callback to launch the entry
	 */
	class PlaceInfo {
		public id: string;
		public idDecoded: string;
		public name: string;
		protected _lowerName: string;
		public iconFactory(...params: any[]): imports.gi.St.Icon;
		public launch(...params: any): void;
		public constructor(id: number, name: string, iconFactory: Function, launch: Function);

		public matchTerms(terms: string[]): imports.ui.search.MatchType;

		public isRemovable(): boolean;
	}

	interface LauchContextParams {
		workspace: number;
		timestamp: number;
	}
	/**
	 * Helper function to translate launch parameters into a GAppLaunchContext */
	function _makeLaunchContext(params: Partial<LauchContextParams>): imports.gi.Gio.AppLaunchContext;

	class PlaceDeviceInfo extends PlaceInfo {
		protected _mount: any;
		public name: string;
		protected _lowerName: string;
		public id: string;
		public idDecoded: string;

		public busyWaitId: number;
		public destroySignalId: number;
		public busyNotification: any;
		public constructor(mount: any);


		public iconFactory(size: number): imports.gi.St.Icon;

		public launch(params: Partial<LauchContextParams>): void;

		public remove(): void;

		protected _tryRemove(): boolean | null;

		/**
		 * 
		 * @param msg1 
		 * @param msg2 default null
		 * @param withButton default false
		 * @param persistent default false
		 */
		protected _sendNotification(msg1: string, msg2?: string, withButton?: boolean, persistent?: boolean): void;

		protected _stopFinish(drive: any, res: any): void;

		protected _ejectFinish(source: any, res: any, is_drive: boolean): void;

		protected _removeFinish(o: any, res: any, data: any): void;
	}

	class PlacesManager {
		protected _defaultPlaces: PlaceInfo[];
		protected _mounts: PlaceDeviceInfo[];
		protected _bookmarks: PlaceInfo[];
		protected _home: PlaceInfo;
		protected _desktopMenu: PlaceInfo;
		protected _connect: PlaceInfo;
		protected _volumeMonitor: imports.gi.Gio.VolumeMonitor;
		protected _deviceUpdateAwaiting: boolean;
		protected _bookmarksPath: string;
		protected _bookmarksFile: imports.gi.Gio.File;
		protected _bookmarkTimeoutId: number;
		public monitor: imports.gi.Gio.FileMonitor;

		public constructor();

		/**
		 * Mounting a device triggers a lot of different events, wait 3 seconds and try to only call this._updateDevices() once
		 */
		protected _updateDevicesAsync(): void;

		protected _onVolumeAdded(): void;

		protected _onVolumeRemoved(): void;

		protected _onVolumeChanged(): void;

		protected _onMountAdded(): void;

		protected _onMountRemoved(): void;

		protected _onMountChanged(): void;

		protected _onDriveConnected(): void;

		protected _onDriveDisconnected(): void;

		protected _onDriveChanged(): void;

		protected _updateDevices(): void;

		protected _reloadBookmarks(): void;

		protected _addMount(mount: any): void;

		public getAllPlaces(): PlaceInfo[];

		public getDefaultPlaces(): PlaceInfo[];

		public getBookmarks(): PlaceInfo[];

		public getMounts(): PlaceInfo[];

		protected _lookupIndexById(sourceArray: PlaceInfo[], id: string): number;

		public lookupPlaceById(id: string): PlaceInfo;

	}



	class PlaceSearchProvider extends imports.ui.search.SearchProvider {
		public constructor();

		public getResultMeta(resultId: string): imports.ui.search.SearchResult;

		public activateResult(id: string, params: Partial<LauchContextParams>): void;

		protected _compareResultMeta(idA: string, idB: string): number;

		protected _searchPlaces(places: PlaceInfo[], terms: string[]): string[];

		public getInitialResultSet(terms: string[]): string[];

		public getSubsearchResultSet(previousResults: string[], terms: string[]): string[];
	}
}