export interface VisualCrossingAlert {
	event: string;
	headline: string;
	/**
	 * Non-standard ISO 8601 date-time string
	 */
	ends: string;
	/**
	 * Unix timestamp in milliseconds
	 */
	endsEpoch: number;
	/**
	 * Non-standard ISO 8601 date-time string
	 */
	onset: string;
	/**
	 * Unix timestamp in milliseconds
	 */
	onsetEpoch: number;
	id: string;
	language: string;
	link: string;
	description: string;
}