import { Services } from "../config";
import { WeatherApplet } from "../main";
import { LocationData, WeatherData, WeatherProvider } from "../types";

/** Base Class for providers, mostly to enforce constructor signature */
export abstract class BaseProvider implements WeatherProvider {
    public abstract readonly needsApiKey: boolean;
    public abstract readonly prettyName: string;
    public abstract readonly name: Services;
    public abstract readonly maxForecastSupport: number;
    public abstract readonly maxHourlyForecastSupport: number;
    public abstract readonly website: string;
    public abstract readonly remainingCalls: number | null;
    public abstract readonly supportHourlyPrecipChance: boolean;
    public abstract readonly supportHourlyPrecipVolume: boolean;

    protected readonly app: WeatherApplet;

    public abstract GetWeather(loc: LocationData): Promise<WeatherData | null>;

    public constructor(app: WeatherApplet) {
        this.app = app;
    }
}