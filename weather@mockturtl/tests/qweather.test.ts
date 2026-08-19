import { NormalizeQWeatherApiHost, QWeatherAlertPath, QWeatherLanguage, QWeatherLocation } from "../src/3_8/providers/qweather/config";
import { QWeatherCondition } from "../src/3_8/providers/qweather/condition";
import { QWeatherResponseToData } from "../src/3_8/providers/qweather/parser";
import type { QWeatherCurrentResponse } from "../src/3_8/providers/qweather/payload/current";
import { deepEqual, equal, ok, test } from "./harness";
import { beijing, qweatherCurrent, qweatherPayloadSet } from "./fixtures/qweather";

const identity = (text: string): string => text;

test("normalizes only dedicated QWeather API hosts", () => {
	equal(NormalizeQWeatherApiHost("https://AbC.Def.qweatherapi.com/"), "abc.def.qweatherapi.com");
	equal(NormalizeQWeatherApiHost("devapi.qweather.com"), null);
	equal(NormalizeQWeatherApiHost("qweatherapi.com.evil.example"), null);
});

test("selects QWeather language from translation and locale settings", () => {
	equal(QWeatherLanguage("zh-CN", false), "en");
	equal(QWeatherLanguage("zh-CN", true), "zh");
	equal(QWeatherLanguage("zh-TW", true), "zh-hant");
	equal(QWeatherLanguage("zh-Hans-CN", true), "zh");
	equal(QWeatherLanguage("fr-CA", true), "fr");
	equal(QWeatherLanguage(null, true), "en");
});

test("formats QWeather coordinates to the documented precision", () => {
	equal(QWeatherLocation({ lat: 39.904234, lon: 116.407428 }), "116.41,39.90");
});

test("builds the QWeather alert path with latitude before longitude", () => {
	equal(QWeatherAlertPath({ lat: 39.904234, lon: 116.407428 }), "/weatheralert/v1/current/39.90/116.41");
});

test("maps QWeather condition icon families", () => {
	deepEqual(QWeatherCondition("100", "晴", identity).icons, ["weather-clear"]);
	deepEqual(QWeatherCondition("150", "晴", identity).icons, ["weather-clear-night"]);
	deepEqual(QWeatherCondition("302", "雷阵雨", identity).icons, ["weather-storm"]);
	deepEqual(QWeatherCondition("400", "小雪", identity).icons, ["weather-snow"]);
	deepEqual(QWeatherCondition("502", "霾", identity).icons, ["weather-fog"]);
	deepEqual(QWeatherCondition("999", "", identity), {
		main: "Unknown",
		description: "Unknown",
		icons: ["weather-severe-alert"],
		customIcon: "na-symbolic",
	});
});

test("maps a complete QWeather response", () => {
	const weather = QWeatherResponseToData(qweatherPayloadSet, beijing, identity);
	ok(weather !== null);
	equal(weather.temperature, 293.15);
	equal(weather.extra_field?.value, 295.15);
	equal(weather.wind.speed, 5);
	equal(weather.pressure, 1003);
	equal(weather.forecasts[0].temp_min, 283.15);
	equal(weather.forecasts[0].temp_max, 297.15);
	equal(weather.hourlyForecasts?.[1].precipitation?.chance, 80);
	deepEqual(weather.immediatePrecipitation, { start: 5, end: 15 });
	equal(weather.alerts?.[0].level, "severe");
	equal(weather.alerts?.[0].description, "未来六小时将出现强降雨。\nhttps://developer.qweather.com/attribution.html\n当前预警数据可能存在延迟或信息过时，以官方数据发布为准。");
	equal(weather.sunrise?.toISO(), "2026-08-19T05:30:00.000+08:00");
});

test("keeps current weather when optional QWeather payloads are absent", () => {
	const weather = QWeatherResponseToData({ current: qweatherCurrent }, beijing, identity);
	ok(weather !== null);
	deepEqual(weather.forecasts, []);
	deepEqual(weather.hourlyForecasts, []);
	equal(weather.immediatePrecipitation, undefined);
});

test("uses null for absent QWeather numeric values", () => {
	const weather = QWeatherResponseToData({
		current: {
			...qweatherCurrent,
			now: {
				...qweatherCurrent.now,
				temp: "",
				windSpeed: "",
				pressure: "",
				humidity: "",
				dew: "",
			},
		},
	}, beijing, identity);
	ok(weather !== null);
	equal(weather.temperature, null);
	equal(weather.wind.speed, null);
	equal(weather.pressure, null);
	equal(weather.humidity, null);
	equal(weather.dewPoint, null);
});

test("rejects a non-success QWeather current payload", () => {
	equal(QWeatherResponseToData({
		current: { code: "401" } as QWeatherCurrentResponse,
	}, beijing, identity), null);
});
