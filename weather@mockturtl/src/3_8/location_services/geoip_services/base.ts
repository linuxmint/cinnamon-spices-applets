import type { Config } from "../../config";
import type { LocationData } from "../../types";

export interface GeoIP {
	GetLocation: (cancellable: imports.gi.Gio.Cancellable, config: Config) => Promise<LocationData | null>;
}