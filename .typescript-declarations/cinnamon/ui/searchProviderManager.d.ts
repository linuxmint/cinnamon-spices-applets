declare namespace imports.ui.searchProviderManager {

	/** Maps uuid -> importer object (extension directory tree) */
	var extensions: object;
	/**  Kept for compatibility */
	var extensionMeta: object;
	/** Maps uuid -> extension state object (returned from init()) */
	var searchProviderObj: object;
	/** Arrays of uuids */
	var enabledSearchProviders: string[];
	var promises: any[];
	var ENABLED_SEARCH_PROVIDERS_KEY: string;

	/** Callback for extension.js */
	function prepareExtensionUnload(extension: any): void;

	/** Callback for extension.js */
	function finishExtensionLoad(extensionIndex: number): boolean;

	function onEnabledSearchProvidersChanged(): void;

	function initEnabledSearchProviders(): Promise<void>;

	function unloadRemovedSearchProviders(): boolean | void;

	function init(): Promise<void>;

	function get_object_for_uuid(uuid: string): imports.ui.search.Provider;

	function checkLocaleSupport(meta: any, language_names: string[]): boolean;

	function override_send_results(provider: imports.ui.search.Provider, callback: (provider: imports.ui.search.Provider, results: any) => void): Function;

	function override_get_locale_string(meta: any, language_names: string[]): string;

	function launch_all(pattern: string, callback: (provider: imports.ui.search.Provider, results: any) => void): void;
}