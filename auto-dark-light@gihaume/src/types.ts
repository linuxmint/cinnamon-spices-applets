import type { Time_of_day } from "./lib/core/Time_of_day";

export type Time_hms = {
    h: number;
    m: number;
    s: number;
};

export type Location = {
    latitude: number;
    longitude: number;
};

export type Twilights = {
    sunrise: Time_of_day;
    sunset: Time_of_day;
};

export type Color_scheme = 'default' | 'prefer-dark' | 'prefer-light';

export type Command = {
    name: string;
    active: boolean;
    expiry: number;
    command: string;
};

export type Keybinding = `${string}::${'' | `${string}`}`;
