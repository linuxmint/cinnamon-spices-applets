import { HttpLib } from "../lib/httpLib";

interface GeoTimezonePayload {
	longitude: number;
	latitude: number;
	location: string;
	country_iso: string;
	iana_timezone: string;
	timezone_abbreviation: string;
	dst_abbreviation: string;
	offset: string;
	dst_offset: string | null;
	current_local_datetime: string;
	current_utc_datetime: string;
}

interface TZCacheInfo {
	tz: string;
	retrieved: Date;
}

export class GeoTimezone {

	private readonly maxCacheAge = 1000 * 60 * 60 * 24; // 1 day

	private cache: Record<string, TZCacheInfo> = {};

	public async GetTimezone(lat: number, lon: number, cancellable: imports.gi.Gio.Cancellable): Promise<string | null> {
		const key = `${lat},${lon}`;
		const cached = this.cache[key];
		if (cached && this.IsCacheValid(cached)) {
			return cached.tz;
		}

		const result = await HttpLib.Instance.LoadJsonSimple<GeoTimezonePayload>({
			url: "https://api.geotimezone.com/public/timezone",
			cancellable,
			params: {
				latitude: lat,
				longitude: lon,
			}
		});

		if (!result) {
			return null;
		}

		this.cache[key] = {
			tz: result.iana_timezone,
			retrieved: new Date(),
		}
		return result.iana_timezone;
	}

	private IsCacheValid(cache: TZCacheInfo): boolean {
		return Date.now() - cache.retrieved.getTime() < this.maxCacheAge;
	}
}