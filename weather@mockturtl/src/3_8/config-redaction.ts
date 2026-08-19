function IsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function RedactAppletConfig<T extends Record<string, unknown>>(config: T): T {
	const redacted = JSON.parse(JSON.stringify(config)) as T;

	for (const [key, setting] of Object.entries(redacted)) {
		if (/api_?key|apikey|token/i.test(key) && IsRecord(setting) && "value" in setting)
			setting.value = "REDACTED";
	}

	const location = redacted.location;
	if (IsRecord(location) && "value" in location)
		location.value = "REDACTED";

	const locationList = redacted.locationList;
	if (IsRecord(locationList) && Array.isArray(locationList.value)) {
		for (const location of locationList.value) {
			if (!IsRecord(location))
				continue;
			location.lat = "REDACTED";
			location.lon = "REDACTED";
			location.city = "REDACTED";
			location.entryText = "REDACTED";
		}
	}

	return redacted;
}
