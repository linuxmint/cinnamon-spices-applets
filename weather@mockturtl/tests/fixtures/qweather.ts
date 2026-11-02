import type { QWeatherAlertResponse } from "../../src/3_8/providers/qweather/payload/alert";
import type { QWeatherCurrentResponse } from "../../src/3_8/providers/qweather/payload/current";
import type { QWeatherDailyResponse } from "../../src/3_8/providers/qweather/payload/daily";
import type { QWeatherHourlyResponse } from "../../src/3_8/providers/qweather/payload/hourly";
import type { QWeatherMinutelyResponse } from "../../src/3_8/providers/qweather/payload/minutely";
import type { QWeatherPayloadSet } from "../../src/3_8/providers/qweather/parser";
import type { LocationData } from "../../src/3_8/types";

export const beijing: LocationData = {
	lat: 39.9042,
	lon: 116.4074,
	city: "Beijing",
	country: "China",
	timeZone: "Asia/Shanghai",
	entryText: "Beijing",
};

export const qweatherCurrent = {
	code: "200",
	updateTime: "2026-08-19T12:30+08:00",
	fxLink: "https://www.qweather.com/weather/beijing-101010100.html",
	now: {
		obsTime: "2026-08-19T12:20+08:00",
		temp: "20",
		feelsLike: "22",
		icon: "101",
		text: "多云",
		wind360: "135",
		windDir: "东南风",
		windScale: "3",
		windSpeed: "18",
		humidity: "65",
		precip: "0.0",
		pressure: "1003",
		vis: "20",
		cloud: "40",
		dew: "12",
	},
	refer: { sources: ["QWeather"], license: ["QWeather Developers License"] },
} satisfies QWeatherCurrentResponse;

export const qweatherDaily = {
	code: "200",
	updateTime: "2026-08-19T12:30+08:00",
	fxLink: "https://www.qweather.com/weather/beijing-101010100.html",
	daily: [{
		fxDate: "2026-08-19",
		sunrise: "05:30",
		sunset: "18:55",
		moonrise: "11:33",
		moonset: "23:10",
		moonPhase: "Waxing crescent",
		moonPhaseIcon: "801",
		tempMax: "24",
		tempMin: "10",
		iconDay: "101",
		textDay: "多云",
		iconNight: "150",
		textNight: "晴",
		wind360Day: "135",
		windDirDay: "东南风",
		windScaleDay: "3",
		windSpeedDay: "18",
		wind360Night: "90",
		windDirNight: "东风",
		windScaleNight: "2",
		windSpeedNight: "10",
		humidity: "65",
		precip: "0.0",
		pressure: "1003",
		vis: "20",
		cloud: "40",
		uvIndex: "6",
	}],
	refer: { sources: ["QWeather"], license: ["QWeather Developers License"] },
} satisfies QWeatherDailyResponse;

export const qweatherHourly = {
	code: "200",
	updateTime: "2026-08-19T12:30+08:00",
	fxLink: "https://www.qweather.com/weather/beijing-101010100.html",
	hourly: [{
		fxTime: "2026-08-19T13:00+08:00",
		temp: "21",
		icon: "101",
		text: "多云",
		wind360: "135",
		windDir: "东南风",
		windScale: "3",
		windSpeed: "18",
		humidity: "65",
		pop: "0",
		precip: "0.0",
		pressure: "1003",
		cloud: "40",
		dew: "12",
	}, {
		fxTime: "2026-08-19T14:00+08:00",
		temp: "19",
		icon: "305",
		text: "小雨",
		wind360: "140",
		windDir: "东南风",
		windScale: "3",
		windSpeed: "20",
		humidity: "75",
		pop: "80",
		precip: "1.2",
		pressure: "1002",
		cloud: "80",
		dew: "14",
	}],
	refer: { sources: ["QWeather"], license: ["QWeather Developers License"] },
} satisfies QWeatherHourlyResponse;

export const qweatherMinutely = {
	code: "200",
	updateTime: "2026-08-19T12:30+08:00",
	fxLink: "https://www.qweather.com/weather/beijing-101010100.html",
	summary: "未来两小时有小雨",
	minutely: [{
		fxTime: "2026-08-19T12:35+08:00",
		precip: "0",
		type: "rain",
	}, {
		fxTime: "2026-08-19T12:40+08:00",
		precip: "0.2",
		type: "rain",
	}, {
		fxTime: "2026-08-19T12:45+08:00",
		precip: "0.1",
		type: "rain",
	}, {
		fxTime: "2026-08-19T12:50+08:00",
		precip: "0",
		type: "rain",
	}],
	refer: { sources: ["QWeather"], license: ["QWeather Developers License"] },
} satisfies QWeatherMinutelyResponse;

export const qweatherAlerts = {
	metadata: {
		tag: "fixture-alert-tag",
		zeroResult: false,
		attributions: [
			"https://developer.qweather.com/attribution.html",
			"当前预警数据可能存在延迟或信息过时，以官方数据发布为准。",
		],
	},
	alerts: [{
		id: "fixture-severe-alert",
		senderName: "北京市气象台",
		issuedTime: "2026-08-19T12:00+08:00",
		messageType: { code: "alert", supersedes: null },
		latestChange: null,
		eventType: { name: "暴雨", code: "2001" },
		urgency: "immediate",
		severity: "severe",
		certainty: "observed",
		icon: "2001",
		color: { code: "red", red: 255, green: 0, blue: 0, alpha: 1 },
		effectiveTime: "2026-08-19T12:00+08:00",
		onsetTime: "2026-08-19T12:00+08:00",
		expireTime: "2026-08-19T18:00+08:00",
		headline: "暴雨红色预警",
		description: "未来六小时将出现强降雨。",
		criteria: null,
		responseTypes: ["monitor"],
		instruction: "注意防范城市内涝。",
	}],
} satisfies QWeatherAlertResponse;

export const qweatherPayloadSet = {
	current: qweatherCurrent,
	daily: qweatherDaily,
	hourly: qweatherHourly,
	minutely: qweatherMinutely,
	alerts: qweatherAlerts,
} satisfies QWeatherPayloadSet;
