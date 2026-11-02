// ---------------------------------------------------------------------------
//  和风天气 Weather API v1 响应的 TypeScript 类型定义
//  (仅声明本 Provider 使用到的字段，字段单位见各接口注释)
// ---------------------------------------------------------------------------

/** 和风天气的天气现象 */
export interface QWCondition {
	/** 天气现象的本地化描述(按 lang 参数返回，如"晴"、"多云") */
	text: string;
	/** 天气现象代码(如 "100"、"305"，见官方文档"天气现象"代码表) */
	code: string;
}

/** 风的数据：风向(角度+方位代码)、风速(m/s)与蒲福风级 */
export interface QWWind {
	direction: {
		/** 风向角度，取值范围 [0, 359] */
		degree: number;
		/** 风向方位代码(n/nne/ne/.../vrb) */
		compass: string;
	};
	speed: {
		/** 风速数值，单位 m/s */
		value: number;
		unit: string;
	};
	/** 蒲福风级 */
	scale: number;
}

/** 降水数据：累计降水量(mm)、降水强度(mm/h)、降水概率([0,1])与降水类型 */
export interface QWPrecipitation {
	amount: {
		value: number;
		unit: string;
	};
	intensity: {
		value: number;
		unit: string;
	};
	/** 预报降水概率，取值范围 [0,1] */
	probability?: number;
	/** 降水类型代码：rain(雨)、snow(雪)、ice(冰粒或冻雨)、mixed(混合降水)、none(无降水)、unknown(未知) */
	type: string;
}

/**
 * 实时天气接口响应：GET /weather/v1/current/{latitude}/{longitude}
 * 温度为摄氏度、风速为 m/s、气压为 hPa、相对湿度为 [0,1]。
 */
export interface QWCurrentResponse {
	condition: QWCondition;
	temperature: {
		value: number;
		unit: string;
	};
	/** 体感温度(摄氏度) */
	feelsLike: {
		value: number;
		unit: string;
	};
	/** 相对湿度 [0,1] */
	humidity: number;
	wind: QWWind;
	/** 阵风风速(m/s) */
	windGust: {
		value: number;
		unit: string;
	};
	precipitation: QWPrecipitation;
	/** 海平面气压(hPa) */
	pressure: {
		value: number;
		unit: string;
	};
	/** 能见度(m) */
	visibility: {
		value: number;
		unit: string;
	};
	/** 露点温度(摄氏度) */
	dewPoint: {
		value: number;
		unit: string;
	};
	/** 云量 [0,1] */
	cloudCover: number;
	/** 紫外线指数 [0,15] */
	uvIndex: number;
}

/**
 * 每日预报接口响应：GET /weather/v1/daily/{latitude}/{longitude}?days=1-10
 * 每天分为白天([07:00,19:00))与夜间([19:00,次日07:00))两个时段，
 * 时间字段均为 UTC ISO-8601 格式(如 "2024-08-11T04:22Z")。
 */
export interface QWDailyResponse {
	days: QWDaily[];
}

/** 单日预报数据 */
export interface QWDaily {
	/** 预报时段开始时间(UTC) */
	forecastStartTime: string;
	/** 预报时段结束时间(不含，UTC) */
	forecastEndTime: string;
	/** 太阳与月亮天文事件(含日出日落、月升月落与月相) */
	astro: {
		sunrise: string;
		sunset: string;
		moonrise: string;
		moonset: string;
		moonPhase: string;
	};
	/** 全天最高温度(摄氏度) */
	temperatureMax: {
		value: number;
		unit: string;
	};
	/** 全天最低温度(摄氏度) */
	temperatureMin: {
		value: number;
		unit: string;
	};
	/** 当日平均温度(摄氏度) */
	temperatureAvg: {
		value: number;
		unit: string;
	};
	/** 当日最大紫外线指数 [0,15] */
	uvIndexMax: number;
	/** 白天时段预报(当地时间 [07:00,19:00)) */
	daytime: QWDayPart;
	/** 夜间时段预报(当地时间 [19:00,次日07:00)) */
	nighttime: QWDayPart;
}

/** 白天/夜间时段的预报数据 */
export interface QWDayPart {
	/** 时段开始时间(UTC) */
	forecastStartTime: string;
	/** 时段结束时间(不含，UTC) */
	forecastEndTime: string;
	condition: QWCondition;
	/** 时段最高温度(摄氏度) */
	temperatureMax: {
		value: number;
		unit: string;
	};
	/** 时段最低温度(摄氏度) */
	temperatureMin: {
		value: number;
		unit: string;
	};
	/** 时段平均相对湿度 [0,1] */
	humidity: number;
	wind: QWWind;
	/** 时段最大阵风风速(m/s) */
	windGustMax: {
		value: number;
		unit: string;
	};
	precipitation: QWPrecipitation;
	/** 时段平均总云量 [0,1] */
	cloudCover: number;
}

/**
 * 逐小时预报接口响应：GET /weather/v1/hourly/{latitude}/{longitude}?hours=1-240
 * forecastTime 为 UTC ISO-8601 格式，默认返回 24 小时。
 */
export interface QWHourlyResponse {
	hours: QWHour[];
}

/** 单小时预报数据 */
export interface QWHour {
	/** 预报时间(UTC ISO-8601，如 "2024-05-31T03:00Z") */
	forecastTime: string;
	condition: QWCondition;
	/** 温度(摄氏度) */
	temperature: {
		value: number;
		unit: string;
	};
	/** 体感温度(摄氏度) */
	feelsLike: {
		value: number;
		unit: string;
	};
	/** 相对湿度 [0,1] */
	humidity: number;
	wind: QWWind;
	precipitation: QWPrecipitation;
	/** 海平面气压(hPa) */
	pressure: {
		value: number;
		unit: string;
	};
	/** 露点温度(摄氏度) */
	dewPoint: {
		value: number;
		unit: string;
	};
}
