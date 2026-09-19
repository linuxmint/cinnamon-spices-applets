import type { ImmediatePrecipitation } from "../weather-data";

export function FindPrecipitationWindow(values: readonly number[], stepMinutes: number): ImmediatePrecipitation {
	let start = -1;
	for (const [index, value] of values.entries()) {
		if (value > 0 && start === -1) {
			start = index * stepMinutes;
			continue;
		}

		if (value <= 0 && start !== -1)
			return { start, end: index * stepMinutes };
	}

	return { start, end: -1 };
}
