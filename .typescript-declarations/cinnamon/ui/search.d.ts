declare namespace imports.ui.search {
	
	const DISABLED_OPEN_SEARCH_PROVIDERS_KEY: string;

	/**
	 * Not currently referenced by the search API, but
	 * this enumeration can be useful for provider
	 * implementations.
	 */
	const enum MatchType {
		NONE = 0,
		SUBSTRING = 1,
		MULTIPLE_SUBSTRING = 2,
		PREFIX = 3,
		MULTIPLE_PREFIX = 4
	}

	class SearchResultDisplay {
		public provider: any;
		public actor: imports.gi.Clutter.Actor;
		public selectionIndex: number;
		public constructor(provider: Provider);

		/**
		 * renderResults:
		 * @results: List of identifier strings
		 * @terms: List of search term strings
		 *
		 * Display the given search matches which resulted
		 * from the given terms.  It's expected that not
		 * all results will fit in the space for the container
		 * actor; in this case, show as many as makes sense
		 * for your result type.
		 *
		 * The terms are useful for search match highlighting.
		 */
		public renderResults(results: string[], terms: string[]): void;

		/**
		 * clear:
		 * Remove all results from this display and reset the selection index.
		 */
		public clear(): void;

		/**
		 * getSelectionIndex:
		 *
		 * Returns the index of the selected actor, or -1 if none.
		 */
		public getSelectionIndex(): number;

		/**
		 * getVisibleResultCount:
		 *
		 * Returns: The number of actors visible.
		 */
		public getVisibleResultCount(): number;

		/**
		 * selectIndex:
		 * @index: Integer index
		 *
		 * Move selection to the given index.
		 * Return true if successful, false if no more results
		 * available.
		 */
		public selectIndex(): boolean;

		/**
		 * Activate the currently selected search result.
		 */
		public activateSelected: void;
	}

	interface SearchResult {
		"id": string;
		"name": string;
		"createIcon"(size: number): imports.gi.St.Icon;
	}

	/**
	 * SearchProvider:
	 *
	 * Subclass this object to add a new result type
	 * to the search system, then call registerProvider()
	 * in SearchSystem with an instance.
	 */
	class SearchProvider {
		public constructor(title: string);
		public title: string;
		public searchSystem: any;
		public searchAsync: boolean;


		protected _asyncCancelled(): boolean;

		public startAsync(): void;

		public tryCancelAsync(): void;

		/**
		 * addItems:
		 * @items: an array of result identifier strings representing
		 * items which match the last given search terms.
		 *
		 * This should be used for something that requires a bit more
		 * logic; it's designed to be an asyncronous way to add a result
		 * to the current search.
		 */
		public addItems(items: string[]): void;

		/**
		 * getInitialResultSet:
		 * @terms: Array of search terms, treated as logical AND
		 *
		 * Called when the user first begins a search (most likely
		 * therefore a single term of length one or two), or when
		 * a new term is added.
		 *
		 * Should return an array of result identifier strings representing
		 * items which match the given search terms.  This
		 * is expected to be a substring match on the metadata for a given
		 * item.  Ordering of returned results is up to the discretion of the provider,
		 * but you should follow these heruistics:
		 *
		 *  * Put items where the term matches multiple criteria (e.g. name and
		 *    description) before single matches
		 *  * Put items which match on a prefix before non-prefix substring matches
		 *
		 * This function should be fast; do not perform unindexed full-text searches
		 * or network queries.
		 */
		public getInitialResultSet(terms: string[]): string[];

		/**
		 * getSubsearchResultSet:
		 * @previousResults: Array of item identifiers
		 * @newTerms: Updated search terms
		 *
		 * Called when a search is performed which is a "subsearch" of
		 * the previous search; i.e. when every search term has exactly
		 * one corresponding term in the previous search which is a prefix
		 * of the new term.
		 *
		 * This allows search providers to only search through the previous
		 * result set, rather than possibly performing a full re-query.
		 */
		public getSubsearchResultSet(previousResults: string[], newTerms: string[]): string[];

		/**
		 * getResultMeta:
		 * @id: Result identifier string
		 *
		 * Return an object with 'id', 'name', (both strings) and 'createIcon'
		 * (function(size) returning a Clutter.Texture) properties which describe
		 * the given search result.
		 */
		public getResultMeta(id: string): SearchResult;

		/**
		 * createResultContainer:
		 *
		 * Search providers may optionally override this to render their
		 * results in a custom fashion.  The default implementation
		 * will create a vertical list.
		 *
		 * Returns: An instance of SearchResultDisplay.
		 */
		public createResultContainerActor(): SearchResultDisplay;

		/**
		 * createResultActor:
		 * @resultMeta: Object with result metadata
		 * @terms: Array of search terms, should be used for highlighting
		 *
		 * Search providers may optionally override this to render a
		 * particular serch result in a custom fashion.  The default
		 * implementation will show the icon next to the name.
		 *
		 * The actor should be an instance of St.Widget, with the style class
		 * 'search-result-content'.
		 */
		public createResultActor(resultMeta: SearchResult, terms: string[]): imports.gi.St.Widget;

		/**
		 * activateResult:
		 * @id: Result identifier string
		 *
		 * Called when the user chooses a given result.
		 */
		public activateResult(id: string, ...params: any): void;
	}

	interface ProviderResult {
		id: string;
		name: string;
	}

	interface Provider {
		name: string;
		url: string;
		id: number;
		icon_uri: string;
		langs: string[]
	}

	class OpenSearchSystem {
		protected _providers: Provider[];
		public constructor();

		public getProviders(): ProviderResult[];

		public setSearchTerms(terms: string[]): void;

		protected _checkSupportedProviderLanguage(provider: Provider): boolean;

		public activateResult(id: string, params: any): void;

		protected _addProvider(fileName: string): void;

		protected _refresh(): void;

	}

	/**
	 * Signals emitted: 
	 * `search-completed`, `search-updated`
	 */
	class SearchSystem {
		protected _providers: Provider[];
		protected _previousTerms: string[];
		public constructor();


		public registerProvider(provider: Provider): void;

		public unregisterProvider(provider: Provider): void;

		public getProviders(): Provider[];

		public getTerms(): string[];

		public reset(): void;

		public addProviderItems(provider: Provider, items: string[]): void;

		public updateSearch(searchString: string): void;

		public updateSearchResults(terms: string[]): void;
	}

}