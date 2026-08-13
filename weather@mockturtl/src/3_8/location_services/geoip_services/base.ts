import type { Config, LocationProvider } from "../../config";
import type { LocationServiceResult } from "../../types";

export interface GeoIP {
	readonly provider: LocationProvider;
	GetLocation: (cancellable: imports.gi.Gio.Cancellable, config: Config) => Promise<LocationServiceResult | null>;
}