export interface DataProvider {
    GetWeather: () => Promise<boolean>;
}