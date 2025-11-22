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

export interface Disposable {
    /** Releases acquired resources */
    dispose(): void;
}

export interface Observer extends Disposable {
    callback: ((value: any) => void) | null;

    /** Note: it doesn't do anything if already enabled. */
    enable(): void;

    /** Note: it doesn't do anything if already disabled. */
    disable(): void;
}
