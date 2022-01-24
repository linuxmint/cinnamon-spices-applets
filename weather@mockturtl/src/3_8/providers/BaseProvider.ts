import { Services } from "../config";
import { WeatherApplet } from "../main";
import { LocationData, WeatherData, WeatherProvider } from "../types";

export abstract class BaseProvider implements WeatherProvider {
    public abstract readonly needsApiKey: boolean;
    public abstract readonly prettyName: string;
    public abstract readonly name: Services;
    public abstract readonly maxForecastSupport: number;
    public abstract readonly maxHourlyForecastSupport: number;
    public abstract readonly website: string;

    protected readonly app: WeatherApplet;


    public abstract GetWeather(loc: LocationData): Promise<WeatherData | null>;

    public constructor(app: WeatherApplet) {
        this.app = app;
    }
}