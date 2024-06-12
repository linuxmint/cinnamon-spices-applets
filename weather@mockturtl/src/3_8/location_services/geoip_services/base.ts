import type { Config } from "../../config";
import type { LocationServiceResult } from "../../types";

export interface GeoIP {
	GetLocation: (cancellable: imports.gi.Gio.Cancellable, config: Config) => Promise<LocationServiceResult | null>;
}