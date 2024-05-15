import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";

export interface GeoIP {
	GetLocation: (cancellable: imports.gi.Gio.Cancellable) => Promise<LocationData | null>;
}