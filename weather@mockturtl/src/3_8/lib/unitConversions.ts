export function KPHtoMPS(speed: number | null): number {
	return speed == null ? 0 : speed / 3.6;
}

export function CelsiusToKelvin(celsius: number): number;
export function CelsiusToKelvin(celsius: number | null): number | null;
export function CelsiusToKelvin(celsius: number | null): number | null {
	return celsius == null ? null : celsius + 273.15;
}

export function PascalsToHectopascals(pressure: number | null): number | null {
	return pressure == null ? null : pressure / 100;
}
