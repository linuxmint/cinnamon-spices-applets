export type Conditions =
"clearsky" |
"cloudy" |
"fair" |
"fog" |
"heavyrain" |
"heavyrainandthunder" |
"heavyrainshowers" |
"heavyrainshowersandthunder" |
"heavysleet" |
"heavysleetandthunder" |
"heavysleetshowers" |
"heavysleetshowersandthunder" |
"heavysnow" |
"heavysnowandthunder" |
"heavysnowshowers" |
"heavysnowshowersandthunder" |
"lightrain" |
"lightrainandthunder" |
"lightrainshowers" |
"lightrainshowersandthunder" |
"lightsleet" |
"lightsleetandthunder" |
"lightsleetshowers" |
"lightsnow" |
"lightsnowandthunder" |
"lightsnowshowers" |
"lightssleetshowersandthunder" |
"lightssnowshowersandthunder" |
"partlycloudy" |
"rain" |
"rainandthunder" |
"rainshowers" |
"rainshowersandthunder" |
"sleet" |
"sleetandthunder" |
"sleetshowers" |
"sleetshowersandthunder" |
"snow" |
"snowandthunder" |
"snowshowers" |
"snowshowersandthunder";


export type ConditionProperties = {
	[key in Conditions]: number
}

/** https://api.met.no/weatherapi/weathericon/2.0/documentation#!/data/get_legends */
export const conditionSeverity: ConditionProperties = {
	clearsky: 1,
	cloudy: 4,
	fair: 2,
	fog: 15,
	heavyrain: 10,
	heavyrainandthunder: 11,
	heavyrainshowers: 41,
	heavyrainshowersandthunder: 25,
	heavysleet: 48,
	heavysleetandthunder: 32,
	heavysleetshowers: 43,
	heavysleetshowersandthunder: 27,
	heavysnow: 50,
	heavysnowandthunder: 34,
	heavysnowshowers: 45,
	heavysnowshowersandthunder: 29,
	lightrain: 46,
	lightrainandthunder: 30,
	lightrainshowers: 40,
	lightrainshowersandthunder: 24,
	lightsleet: 47,
	lightsleetandthunder: 31,
	lightsleetshowers: 42,
	lightsnow: 49,
	lightsnowandthunder: 33,
	lightsnowshowers: 44,
	lightssleetshowersandthunder: 26,
	lightssnowshowersandthunder: 28,
	partlycloudy: 3,
	rain: 9,
	rainandthunder: 22,
	rainshowers: 5,
	rainshowersandthunder: 6,
	sleet: 12,
	sleetandthunder: 23,
	sleetshowers: 7,
	sleetshowersandthunder: 20,
	snow: 13,
	snowandthunder: 14,
	snowshowers: 8,
	snowshowersandthunder: 21
}

export type TimeOfDay = "day" | "night" | "polartwilight";