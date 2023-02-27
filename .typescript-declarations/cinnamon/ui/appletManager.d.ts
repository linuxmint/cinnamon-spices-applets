declare namespace imports.ui.appletManager {

	interface AppletImports {
		[key: string]: any;
	}

	interface AppletObject {

	}

	interface AppletMeta {
		/** Path to the current applet instance */
		path: string;
	}

	interface AppletMetaLibrary {
		[key: string]: AppletMeta;
	}

	/** Maps uuid -> importer object (applet directory tree) **/
	var applets: AppletImports;
	/** Maps UUID -> Applet Meta information. Kept for compatibility. */
	var appletMeta: AppletMetaLibrary;
	/** Maps applet_id -> applet objects */
	var appletObj: any[];
	var appletsLoaded: boolean;

	/**
	 * An applet can assume a role
	 * Instead of hardcoding looking for a particular applet,
	 * We let applets announce that they can fill a particular
	 * role, using the 'role' metadata entry.
	 * For now, just notifications, but could be expanded.
	 * question - should multiple applets be able to fill
	 * the same role?
	 */
	enum Roles {
		NOTIFICATIONS = 'notifications',
		PANEL_LAUNCHER = 'panellauncher'
	}

	var rawDefinitions: any;
	var definitions: AppletDefinition[];
	var clipboard: any[];
	var promises: any;

	type LocationLabel = 'left' | 'center' | 'right'

	interface AppletDefinition {
		panelId: number;
		orientation: imports.gi.St.Side;
		location_label: LocationLabel;
		center: boolean;
		order: number;
		uuid: string;
		real_uuid: string;
		applet_id: number;
		applet?: imports.ui.applet.Applet;
	}


	function initEnabledApplets(): Promise<void>;

	function unloadRemovedApplets(removedApplets: any[]): void;

	function init(): Promise<void>;

	function getAppletDefinition(definition: Partial<AppletDefinition>): AppletDefinition;

	function filterDefinitionsByUUID(uuid: string): AppletDefinition[];

	/** Callback for extension.js */
	function finishExtensionLoad(extensionIndex: number): boolean;

	/** Callback for extension.js */
	function prepareExtensionUnload(extension: any, deleteConfig: boolean): void;

	/** Callback for extension.js */
	function prepareExtensionReload(extension: any): void;

	function getDefinitions(): any[];

	/**
	 * 
	 * @param definition format used in gsettings is `panel:location:order:uuid:applet_id` where:
		 - panel is something like 'panel1',
		 - location is either 'left', 'center' or 'right',
		 - order is an integer representing the order of the applet within the panel/location (i.e. 1st, 2nd etc..).
		 - applet_id is a unique id assigned to the applet instance when added.
	 */
	function createAppletDefinition(definition: string): AppletDefinition;

	function setOrientationForPanel(panelPos: imports.ui.panel.PanelLoc): imports.gi.St.Side;

	function checkForUpgrade(newEnabledApplets: string[]): string[];

	function appletDefinitionsEqual(a: AppletDefinition, b: AppletDefinition): boolean;

	function onEnabledAppletsChanged(): void;

	function removeAppletFromPanels(appletDefinition: AppletDefinition, deleteConfig: boolean, changed?: boolean): void;

	function _removeAppletConfigFile(uuid: string, instanceId: number): void;

	function addAppletToPanels(extension: any, appletDefinition: AppletDefinition, panel?: imports.ui.panel.Panel): boolean;

	/**
	 * 
	 * We want to ensure that applets placed in a panel can be shown correctly particularly because wide applets will not fit in a vertical panel unless
	   they have logic to manage this explicitly.
			  If the applet is of type IconApplet (and not a TextIconApplet) then it should be fine.
			  If not, we check if the user has previously opted to leave it there anyway.
			  Then we look to see if it has declared itself suitable via a call to applet.getAllowedLayout().
		  If the applet turns out to be unsuitable the user is then asked if they want to keep it anyway,
		remove it, or try to find another panel that supports it.
	 * @param extension 
	 * @param appletDefinition 
	 */
	function removeAppletFromInappropriatePanel(extension: any, appletDefinition: AppletDefinition): void;

	function verticalPanelOverride(appletDefinition: AppletDefinition): void;

	function removeApplet(appletDefinition: AppletDefinition): void;

	function moveApplet(appletDefinition: AppletDefinition, allowedLayout: imports.ui.applet.AllowedLayout): void;

	function get_role_provider(role: Roles): any;

	function get_role_provider_exists(role: Roles): boolean;

	function createApplet(extension: any, appletDefinition: AppletDefinition, panel?: imports.ui.panel.Panel): boolean | any;

	function _addAppletStyleClassUuid(applet: any, metadata: ui.applet.AppletMetadata): boolean;

	function _generateAppletStyleClassUuid(metadata: ui.applet.AppletMetadata): string;

	function _removeAppletFromPanel(uuid: string, applet_id: number): void;

	function saveAppletsPositions(): void;

	/**
	 * Deprecated, kept for compatibility reasons
	 * @param uuid 
	 */
	function _find_applet(uuid: string): imports.ui.applet.Applet;

	function get_object_for_instance(appletId: number): imports.ui.applet.Applet;

	function get_object_for_uuid(uuid: string, instanceId: number): imports.ui.applet.Applet;


	/**
	 * loadAppletsOnPanel:
	 * @panel (Panel.Panel): The panel
	 *
	 * Loads all applets on the panel if not loaded
	 */
	function loadAppletsOnPanel(panel: imports.ui.panel.Panel): void;

	/**
	 * updateAppletsOnPanel:
	 * @panel (Panel.Panel): The panel
	 *
	 * Updates the definition, orientation and height of applets on the panel
	 */
	function updateAppletsOnPanel(panel: imports.ui.panel.Panel): void;

	/**
	 * unloadAppletsOnPanel:
	 * @panel (Panel.Panel): The panel
	 *
	 * Unloads all applets on the panel
	 */
	function unloadAppletsOnPanel(panelId: number): void;

	function copyAppletConfiguration(panelId: number): void;

	function clearAppletConfiguration(panelId: number): void;

	function pasteAppletConfiguration(panelId: number): void;

	function getRunningInstancesForUuid(uuid: string): any[];

	function callAppletInstancesChanged(uuid: string, originInstance: number): void;

	function getLocation(panel: imports.ui.panel.Panel, location: string): any;
}