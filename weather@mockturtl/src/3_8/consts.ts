import { type DistanceUnits, type WeatherWindSpeedUnits } from "./config";

export const UUID = "weather@mockturtl"

/** Signal string to prepend keys */
export const SIGNAL_CHANGED = 'changed::';
/** Signal string to prepend keys */
export const SIGNAL_CLICKED = 'clicked';
/** Signal string to prepend keys */
export const SIGNAL_REPAINT = 'repaint';

/** Default applet icon */
export const APPLET_ICON = "view-refresh-symbolic";
/** Refresh icon name */
export const REFRESH_ICON = "view-refresh";

/** Blank magic string */
export const BLANK = '   ';
/** Ellipsis magic string */
export const ELLIPSIS = '...';
/** En dash magic string */
export const EN_DASH = '\u2013';
/** Forward slash magic string */
export const FORWARD_SLASH = '\u002F';

export const STYLE_HIDDEN = "weather-hidden";

export type LogLevel = "info" | "debug" | "verbose" | "critical" | "error" | "always";

const US_TIMEZONES: string[] = [
    "America/Adak",
    "America/Anchorage",
    "America/Atka",
    "America/Boise",
    "America/Chicago",
    "America/Denver",
    "America/Detroit",
    "America/Fort_Wayne",
    "America/Indiana/Indianapolis",
    "America/Indiana/Knox",
    "America/Indiana/Marengo",
    "America/Indiana/Petersburg",
    "America/Indiana/Tell_City",
    "America/Indiana/Vevay",
    "America/Indiana/Vincennes",
    "America/Indiana/Winamac",
    "America/Indianapolis",
    "America/Juneau",
    "America/Kentucky/Louisville",
    "America/Kentucky/Monticello",
    "America/Knox_IN",
    "America/Los_Angeles",
    "America/Louisville",
    "America/Menominee",
    "America/Metlakatla",
    "America/New_York",
    "America/Nome",
    "America/North_Dakota/Beulah",
    "America/North_Dakota/Center",
    "America/North_Dakota/New_Salem",
    "America/Phoenix",
    "America/Shiprock",
    "America/Sitka",
    "America/Yakutat",
    "Navajo",
    "Pacific/Honolulu",
    "US/Alaska",
    "US/Aleutian",
    "US/Arizona",
    "US/Central",
    "US/East-Indiana",
    "US/Eastern",
    "US/Hawaii",
    "US/Indiana-Starke",
    "US/Michigan",
    "US/Mountain",
    "US/Pacific",
]

const GB_TIMEZONES = [
    "Europe/Belfast",
    "Europe/London",
]

/**
 * Info partially from https://github.com/unicode-org/cldr/blob/release-38-1/common/supplemental/units.xml
 * and https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const fahrenheitCountries = [
    // Belize
    "America/Belize",
    // Cayman Islands
    "America/Cayman", 			    // link to America/Panama
    // Federated States of Micronesia
    "Pacific/Chuuk",			    // link to Pacific/Port_Moresby
    // "Pacific/Guadalcanal",		// cant use it SB also uses it
    "Pacific/Kosrae",
    "Pacific/Pohnpei",			    // link to Pacific/Guadalcanal
    "Pacific/Ponape",			    // link to Pacific/Guadalcanal
    // "Pacific/Port_Moresby",		// other countries use it
    "Pacific/Truk",
    "Pacific/Yap",
    // Liberia
    "Africa/Monrovia",
    // Marshall Islands
    "Pacific/Kwajalein",
    "Pacific/Majuro",
    // Palau
    "Pacific/Palau",
    // The Bahamas
    "America/Nassau",
    // US
    ...US_TIMEZONES
];

/**
 * Default kph, gb added to mph keys because it's not in the unicode DB
 *
 * Info partially from https://github.com/unicode-org/cldr/blob/release-38-1/common/supplemental/units.xml
 * and https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const windSpeedUnitLocales: Partial<Record<WeatherWindSpeedUnits, string[]>> = {
    "m/s" : [
        // FI
        "Europe/Helsinki",
        // KR
        "Asia/Seoul",
        // NO
        "Europe/Oslo",
        // PL
        "Europe/Warsaw",
        // RU
        "Asia/Anadyr",
        "Asia/Barnaul",
        "Asia/Chita",
        "Asia/Irkutsk",
        "Asia/Kamchatka",
        "Asia/Khandyga",
        "Asia/Krasnoyarsk",
        "Asia/Magadan",
        "Asia/Novokuznetsk",
        "Asia/Novosibirsk",
        "Asia/Omsk",
        "Asia/Sakhalin",
        "Asia/Srednekolymsk",
        "Asia/Tomsk",
        "Asia/Ust-Nera",
        "Asia/Vladivostok",
        "Asia/Yakutsk",
        "Asia/Yekaterinburg",
        "Europe/Astrakhan",
        "Europe/Kaliningrad",
        "Europe/Kirov",
        "Europe/Moscow",
        "Europe/Samara",
        "Europe/Saratov",
        "Europe/Ulyanovsk",
        "Europe/Volgograd",
        // SE
        "Europe/Stockholm",
    ],
    "mph": [
        // GB
        ...GB_TIMEZONES,
        // US
        ...US_TIMEZONES
    ]
};

/** Default metric
 *
 * Info partially from https://github.com/unicode-org/cldr/blob/release-38-1/common/supplemental/units.xml
 * and https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
*/
export const distanceUnitLocales: Partial<Record<DistanceUnits, string[]>> = {
    "imperial": [
        ...GB_TIMEZONES,
        ...US_TIMEZONES
    ]
}