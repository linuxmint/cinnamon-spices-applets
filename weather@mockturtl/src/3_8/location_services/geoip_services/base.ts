import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";

export interface GeoIP {
	GetLocation: () => Promise<LocationData | null>;
}