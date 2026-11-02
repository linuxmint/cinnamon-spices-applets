//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////          HeFeng / QWeather           ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import { getTimes } from "suncalc";
import type { Config } from "../../config";
import { Services } from "../../config";
import type { ErrorResponse, HTTPParams } from "../../lib/httpLib";
import { HttpLib } from "../../lib/httpLib";
import { Logger } from "../../lib/services/logger";
import { ErrorHandler } from "../../lib/services/error_handler";
import type { BuiltinIcons, Condition, CustomIcons, ForecastData, HourlyForecastData, PrecipitationType, WeatherData } from "../../weather-data";
import { CelsiusToKelvin, IsLangSupported, IsNight, _ } from "../../utils";
import { ProviderErrorCode, type LocationData, type WeatherProvider } from "../../types";
import type { QWCondition, QWCurrentResponse, QWDailyResponse, QWHourlyResponse } from "./payload";

/**
 * 和风天气(QWeather) Provider 的专属配置项。
 * 由 Config.GetServiceConfig(Services.QWeather) 构造并提供给本类。
 */
export interface HeFengOptions {
	/** 用户在和风天气控制台创建的 API KEY */
	apiKey: string;
	/**
	 * 用户专属的 API Host(例如 abcxyz.qweatherapi.com)。
	 * 和风天气从 2026 年起逐步停用公共域名(devapi.qweather.com / api.qweather.com)，
	 * 新建凭据必须在控制台-设置中查看并使用自己的专属 Host。
	 */
	host: string;
}

/**
 * 和风天气(QWeather)数据提供者。
 *
 * 基于"和风天气开发服务"新版 Weather API v1 实现，接口特点：
 *  - 请求路径为 /weather/v1/{current|daily|hourly}/{latitude}/{longitude}，
 *    坐标作为路径参数且顺序为 纬度/经度，最多支持小数点后两位；
 *  - 身份认证使用 API KEY：以 key 查询参数或 X-QW-Api-Key 请求头传递；
 *  - 响应数据均使用 Gzip 压缩(libsoup 默认自动处理)；
 *  - 温度为摄氏度、风速为 m/s、气压为 hPa、相对湿度取值范围为 [0,1]。
 *
 * 项目内部统一格式(weather-data.ts)要求：
 *  - 温度为开尔文(摄氏度需转换)、风速为 m/s(直接一致)、气压为 hPa(直接一致)、
 *    相对湿度为百分比([0,1] 需乘以 100)。
 */
export class HeFeng implements WeatherProvider<Services.QWeather, HeFengOptions> {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------

	/** 该服务必须由用户提供 API Key */
	public readonly needsApiKey = true;
	/** 在 "Powered by ..." 署名中显示的服务名称 */
	public readonly prettyName = _("QWeather");
	/** 与 Services 枚举中的 QWeather 成员对应 */
	public readonly name = Services.QWeather;
	/** 每日预报接口最多支持 10 天 */
	public readonly maxForecastSupport = 10;
	/** 逐小时预报接口最多支持 240 小时 */
	public readonly maxHourlyForecastSupport = 240;
	/** 服务主页，在配置界面中展示 */
	public readonly website = "https://www.qweather.com/";
	/** 接口未返回剩余调用次数信息，固定为 null */
	public readonly remainingCalls: number | null = null;
	/** 逐小时预报支持降水概率(百分比) */
	public readonly supportHourlyPrecipChance = true;
	/** 逐小时预报支持降水量(毫米) */
	public readonly supportHourlyPrecipVolume = true;
	/** 和风天气 v1 接口使用经纬度坐标定位 */
	public readonly locationType = "coordinates";

	/**
	 * 旧版公共 API Host(开发版)，作为用户未填写 Host 时的默认值。
	 * 注意：公共域名正在逐步停用，推荐用户在设置中填写专属 API Host。
	 */
	private readonly defaultHost = "devapi.qweather.com";

	/** 和风天气多语言设置(lang 查询参数)支持的语言代码 */
	private readonly supportedLanguages = [
		'zh', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-hk',
		'en', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'pt', 'ru',
		'th', 'ar', 'hi', 'id', 'tr', 'vi', 'nl', 'pl', 'uk',
		'sv', 'da', 'fi', 'no', 'cs', 'ro', 'hu', 'el', 'he',
		'ms', 'bn'
	];

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------

	/**
	 * 获取天气数据的主入口。
	 * 并行请求实时天气、每日预报与逐小时预报，其中仅实时天气为必需数据。
	 * @param loc 已解析的地点信息(含坐标与时区)
	 * @param cancellable 取消令牌
	 * @param config 全局配置
	 * @param options 和风天气专属配置(API Key 与 Host)
	 */
	public GetWeather = async (loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config, options: HeFengOptions): Promise<WeatherData | null> => {
		// 和风天气 v1 接口的坐标最多支持小数点后两位，先做四舍五入避免请求被拒绝
		const lat = Math.round(loc.lat * 100) / 100;
		const lon = Math.round(loc.lon * 100) / 100;
		// 坐标是路径参数，且顺序为 纬度/经度
		const coordinates = `${lat}/${lon}`;
		const baseUrl = this.GetBaseUrl(options);
		// API 是否按用户语言返回本地化的天气现象文本
		const translated = this.IsConditionTranslated(config);

		// 请求天数/小时数按用户设置收敛到接口支持的范围内
		const days = Math.min(Math.max(config._forecastDays, 1), this.maxForecastSupport);
		const hours = Math.min(Math.max(config._forecastHours, 1), this.maxHourlyForecastSupport);

		// 先行发起每日预报请求(含日出日落等天文数据，稍后用于填充 sunrise/sunset)
		const dailyPromise = HttpLib.Instance.LoadJsonSimple<QWDailyResponse>({
			url: `${baseUrl}/weather/v1/daily/${coordinates}`,
			params: this.ConstructQuery(config, options, { days: days }),
			cancellable,
			HandleError: (e) => this.HandleError(e)
		});

		// 逐小时预报请求与其并行(失败时不阻塞整体刷新，例如订阅套餐未覆盖)
		const hourlyPromise = HttpLib.Instance.LoadJsonSimple<QWHourlyResponse>({
			url: `${baseUrl}/weather/v1/hourly/${coordinates}`,
			params: this.ConstructQuery(config, options, { hours: hours }),
			cancellable,
			HandleError: (e) => this.HandleHourlyError(e)
		});

		// 实时天气是必需数据，获取失败则本次刷新失败
		const currentPayload = await HttpLib.Instance.LoadJsonSimple<QWCurrentResponse>({
			url: `${baseUrl}/weather/v1/current/${coordinates}`,
			params: this.ConstructQuery(config, options),
			cancellable,
			HandleError: (e) => this.HandleError(e)
		});
		if (currentPayload == null)
			return null;

		// 解析实时天气，得到 WeatherData 骨架(预报数据稍后填充)
		const weather = this.ParseCurrent(loc, currentPayload, translated);
		if (weather == null)
			return null;

		// 等待每日预报结果，填充每日预报列表与今日日出日落
		const dailyPayload = await dailyPromise;
		if (dailyPayload != null) {
			weather.forecasts = this.ParseForecasts(dailyPayload, loc, translated) ?? [];
			// 今日日出/日落取自每日预报第一条的 astro 天文数据(ISO-8601 UTC 格式)
			const today = dailyPayload.days[0];
			if (today?.astro?.sunrise != null)
				weather.sunrise = DateTime.fromISO(today.astro.sunrise).setZone(loc.timeZone);
			if (today?.astro?.sunset != null)
				weather.sunset = DateTime.fromISO(today.astro.sunset).setZone(loc.timeZone);
		}

		// 每日预报不可用时，使用本地天文算法(suncalc)计算日出日落作为回退方案
		if (weather.sunrise == null || weather.sunset == null) {
			Logger.Info("QWeather daily data unavailable, calculating sunrise/sunset locally.");
			const sunTimes = getTimes(new Date(), loc.lat, loc.lon);
			weather.sunrise = DateTime.fromJSDate(sunTimes.sunrise).setZone(loc.timeZone);
			weather.sunset = DateTime.fromJSDate(sunTimes.sunset).setZone(loc.timeZone);
		}

		// 等待逐小时预报结果(获取失败时仅影响小时预报显示，显示为空)
		const hourlyPayload = await hourlyPromise;
		weather.hourlyForecasts = hourlyPayload != null ? this.ParseHourly(hourlyPayload, loc, translated) ?? [] : [];

		return weather;
	};

	/**
	 * 校验服务配置是否有效(例如 API Key 是否已填写)。
	 * 返回 NO_KEY 时主循环会进入"缺少密钥"状态并提示用户。
	 */
	public ValidConfiguration(config: Config, customConfig: HeFengOptions): ProviderErrorCode {
		// 和风天气必须提供 API Key
		if (!customConfig.apiKey) {
			return ProviderErrorCode.NO_KEY;
		}
		return ProviderErrorCode.OK;
	}

	//--------------------------------------------------------
	//  请求构造与错误处理
	//--------------------------------------------------------

	/**
	 * 规范化用户填写的 API Host 并拼接为接口基础 URL。
	 * 兼容以下输入形式：abcxyz.qweatherapi.com、https://abcxyz.qweatherapi.com/。
	 */
	private GetBaseUrl(options: HeFengOptions): string {
		// 去除首尾空白；为空时回退到旧版公共 Host
		let host = (options.host ?? "").trim() || this.defaultHost;
		// 去除可能误填的协议前缀与结尾斜杠
		host = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
		return `https://${host}`;
	}

	/**
	 * 构造公共查询参数：API KEY 认证 + 可选的多语言设置。
	 * @param extra 额外的接口参数(如每日预报的 days、逐小时预报的 hours)
	 */
	private ConstructQuery(config: Config, options: HeFengOptions, extra?: HTTPParams): HTTPParams {
		const params: HTTPParams = {
			// 和风天气支持以 key 查询参数的方式进行 API KEY 身份认证
			key: options.apiKey
		};

		// 用户开启了"翻译天气状况"且当前系统语言被和风天气支持时，请求本地化文本
		const lang = this.ConvertToAPILocale(config.currentLocale);
		if (config._translateCondition && IsLangSupported(lang, this.supportedLanguages))
			params.lang = lang;

		if (extra != null)
			Object.assign(params, extra);
		return params;
	}

	/**
	 * 将系统区域设置(如 zh-CN、en-US)转换为和风天气 lang 参数取值。
	 * @returns null 表示无法转换
	 */
	private ConvertToAPILocale(systemLocale: string | null): string | null {
		if (!systemLocale)
			return null;

		const split = systemLocale.split("-");
		const lang = split[0];
		const region = split[1];

		if (lang == "zh") {
			// 中文按地区区分繁简体
			if (region == "TW" || region == "HK" || region == "MO")
				return "zh-hant";
			return "zh";
		}

		// 其余语言直接使用语言代码(如 en-US -> en)
		return lang;
	}

	/** API 是否会返回(按用户语言的)本地化天气现象文本 */
	private IsConditionTranslated(config: Config): boolean {
		const lang = this.ConvertToAPILocale(config.currentLocale);
		return config._translateCondition && IsLangSupported(lang, this.supportedLanguages);
	}

	/**
	 * 处理实时天气/每日预报接口的 HTTP 错误(依据和风天气错误码语义)。
	 * @returns false 表示错误已被本方法处理(不再上报通用错误)；true 表示交由通用逻辑处理
	 */
	private HandleError(message: ErrorResponse): boolean {
		switch (message.ErrorData.code) {
			case 401: // 认证失败：API Key 无效或已过期
			case 403: // 认证失败(旧版语义)
				ErrorHandler.Instance.PostError({
					type: "hard",
					userError: true,
					detail: "bad key",
					service: "qweather",
					message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
				});
				return false;
			case 402: // 已超过每日访问次数(订阅配额用尽)
				ErrorHandler.Instance.PostError({
					type: "hard",
					userError: true,
					detail: "key blocked",
					service: "qweather",
					message: _("API key quota exceeded, please check your QWeather subscription plan")
				});
				return false;
			case 404: // 查询的位置数据不存在(或 Host 配置错误)
				ErrorHandler.Instance.PostError({
					type: "hard",
					userError: true,
					detail: "location not covered",
					service: "qweather",
					message: _("Location is not covered by QWeather, please check your location and API Host settings")
				});
				return false;
			case 429: // 超过访问频次限制，等待下次刷新自动重试
				ErrorHandler.Instance.PostError({
					type: "soft",
					userError: false,
					detail: "key blocked",
					service: "qweather",
					message: _("QWeather rate limit exceeded, will retry at the next refresh")
				});
				return false;
			default:
				// 其余错误交由通用错误处理逻辑("bad status code" 等)
				return true;
		}
	}

	/**
	 * 逐小时预报接口的错误处理：任何失败都仅跳过小时预报，
	 * 不产生额外的用户提示(避免与实时天气的错误提示重复)。
	 */
	private HandleHourlyError(message: ErrorResponse): boolean {
		Logger.Info("QWeather hourly forecast is inaccessible, skipping. (" + message.ErrorData.code + ")");
		return false;
	}

	//--------------------------------------------------------
	//  数据解析(和风天气 JSON -> 内部 WeatherData 格式)
	//--------------------------------------------------------

	/**
	 * 解析实时天气接口(/weather/v1/current)响应。
	 * v1 接口未返回观测时间，和风天气数据为分钟级更新，因此使用当前时间。
	 */
	private ParseCurrent(loc: LocationData, payload: QWCurrentResponse, translated: boolean): WeatherData | null {
		try {
			// 使用本地天文算法判断昼夜，用于为晴/多云类代码选择日间或夜间图标
			// (和风天气 v1 的天气代码本身不区分昼夜)
			const sunTimes = getTimes(new Date(), loc.lat, loc.lon);
			const isNight = IsNight({
				sunrise: DateTime.fromJSDate(sunTimes.sunrise).setZone(loc.timeZone),
				sunset: DateTime.fromJSDate(sunTimes.sunset).setZone(loc.timeZone)
			});

			const weather: WeatherData = {
				coord: {
					lat: loc.lat,
					lon: loc.lon
				},
				location: {
					// v1 实时接口不返回地点名称，使用定位数据中的城市/国家
					city: loc.city,
					country: loc.country,
					timeZone: loc.timeZone
				},
				// 未返回观测时间，使用当前位置时区的当前时间
				date: DateTime.now().setZone(loc.timeZone),
				// 日出日落稍后从每日预报的天文数据中填充
				sunrise: null,
				sunset: null,
				wind: {
					// v1 接口风速单位为 m/s，与内部格式一致
					speed: payload.wind?.speed?.value ?? null,
					// 风向角度(气象度数)
					degree: payload.wind?.direction?.degree ?? null
				},
				// 温度：摄氏度 -> 开尔文(内部格式)
				temperature: CelsiusToKelvin(payload.temperature?.value ?? null),
				// 海平面气压：hPa，与内部格式一致
				pressure: payload.pressure?.value ?? null,
				// 相对湿度由 [0,1] 转换为百分比
				humidity: payload.humidity != null ? payload.humidity * 100 : null,
				// 露点温度：摄氏度 -> 开尔文
				dewPoint: CelsiusToKelvin(payload.dewPoint?.value ?? null),
				condition: this.ParseCondition(payload.condition, translated, isNight),
				// 附加字段：体感温度(开尔文)
				extra_field: {
					name: _("Feels Like"),
					value: CelsiusToKelvin(payload.feelsLike?.value ?? null) ?? 0,
					type: "temperature"
				},
				// 紫外线指数
				uvIndex: payload.uvIndex ?? null,
				// 每日预报稍后填充
				forecasts: []
			};

			return weather;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("QWeather Weather Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "qweather", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
			return null;
		}
	}

	/**
	 * 解析每日预报接口(/weather/v1/daily)响应。
	 * 每天包含白天([07:00,19:00))与夜间([19:00,次日07:00))两个时段，
	 * 每日预报的天气现象优先采用白天时段数据。
	 */
	private ParseForecasts(json: QWDailyResponse, loc: LocationData, translated: boolean): ForecastData[] | null {
		const forecasts: ForecastData[] = [];
		try {
			for (const day of json.days) {
				const forecast: ForecastData = {
					// 以预报日(当地时区)的 12:00 作为该日的展示时间
					date: DateTime.fromISO(day.forecastStartTime).setZone(loc.timeZone).set({
						hour: 12,
						minute: 0,
						second: 0,
						millisecond: 0
					}),
					// 最低/最高温度：摄氏度 -> 开尔文
					temp_min: CelsiusToKelvin(day.temperatureMin?.value ?? null),
					temp_max: CelsiusToKelvin(day.temperatureMax?.value ?? null),
					// 每日预报展示白天时段的天气现象(日间图标)
					condition: this.ParseCondition(day.daytime?.condition ?? day.nighttime?.condition ?? null, translated, false)
				};
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("QWeather Forecast Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "qweather", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}

	/**
	 * 解析逐小时预报接口(/weather/v1/hourly)响应。
	 * 每个小时的预报时间(forecastTime)为 UTC ISO-8601 格式，转换为当地时区时间，
	 * 并依据该时刻的日出日落判断昼夜、选择日间/夜间图标。
	 */
	private ParseHourly(json: QWHourlyResponse, loc: LocationData, translated: boolean): HourlyForecastData[] | null {
		const forecasts: HourlyForecastData[] = [];
		try {
			for (const hour of json.hours) {
				const date = DateTime.fromISO(hour.forecastTime).setZone(loc.timeZone);
				// 计算该时刻所在日期的日出日落，判断昼夜以选择图标
				const sunTimes = getTimes(date.toJSDate(), loc.lat, loc.lon);
				const isNight = IsNight({
					sunrise: DateTime.fromJSDate(sunTimes.sunrise).setZone(loc.timeZone),
					sunset: DateTime.fromJSDate(sunTimes.sunset).setZone(loc.timeZone)
				}, date);

				const forecast: HourlyForecastData = {
					date: date,
					// 温度：摄氏度 -> 开尔文
					temp: CelsiusToKelvin(hour.temperature?.value ?? null),
					condition: this.ParseCondition(hour.condition, translated, isNight),
					precipitation: {
						// 降水类型转换(rain/snow/ice/mixed/none)
						type: this.ParsePrecipType(hour.precipitation?.type),
						// 当前时段累计降水量(mm)
						volume: hour.precipitation?.amount?.value ?? undefined,
						// 降水概率由 [0,1] 转换为百分比
						chance: hour.precipitation?.probability != null ? hour.precipitation.probability * 100 : undefined
					}
				};
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("QWeather Hourly Forecast Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "qweather", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}

	/**
	 * 将和风天气的天气现象(condition)转换为内部 Condition 结构。
	 * v1 天气代码不区分昼夜，因此由调用方传入 isNight 以选择日间/夜间图标。
	 * @param condition 和风天气返回的天气现象(可能缺失)
	 * @param translated API 是否已返回(用户语言的)本地化文本
	 * @param isNight 当前(或预报)时刻是否为夜间
	 */
	private ParseCondition(condition: QWCondition | null | undefined, translated: boolean, isNight: boolean): Condition {
		// translated 为 true 时直接使用 API 返回的本地化文本
		if (translated && condition?.text != null) {
			return {
				main: condition.text,
				description: condition.text,
				icons: this.ResolveIcon(condition.code, isNight),
				customIcon: this.ResolveCustomIcon(condition.code, isNight)
			};
		}

		// 否则使用内置的代码->文本映射(经由 gettext 翻译)
		return {
			main: this.CodeToMain(condition?.code),
			description: this.CodeToDescription(condition?.code),
			icons: this.ResolveIcon(condition?.code, isNight),
			customIcon: this.ResolveCustomIcon(condition?.code, isNight)
		};
	}

	/** 将和风天气降水类型代码转换为内部降水类型 */
	private ParsePrecipType(type: string | null | undefined): PrecipitationType {
		switch (type) {
			case "rain": // 雨
				return "rain";
			case "snow": // 雪
				return "snow";
			case "ice": // 冰粒或冻雨
				return "ice pellets";
			case "mixed": // 混合降水(雨夹雪)归为雪
				return "snow";
			default: // none / unknown / 缺失
				return "none";
		}
	}

	//--------------------------------------------------------
	//  天气代码映射(代码表来自和风天气官方文档"天气现象")
	//--------------------------------------------------------

	/**
	 * 将和风天气代码转换为(已翻译的)天气现象简短描述，
	 * 用于面板标签与预报摘要。
	 */
	private CodeToMain(code: string | null | undefined): string {
		switch (code) {
			// 晴
			case "100":
				return _("Clear");
			// 少云 / 晴间多云
			case "102":
				return _("Few clouds");
			case "103":
				return _("Partly cloudy");
			// 多云 / 阴
			case "101":
				return _("Cloudy");
			case "104":
				return _("Overcast");
			// 雷阵雨类
			case "302":
			case "303":
			case "304":
				return _("Thunderstorm");
			// 阵雨类
			case "300":
			case "301":
			case "407":
				return _("Showers");
			// 冻雨
			case "313":
				return _("Freezing rain");
			// 毛毛雨
			case "309":
				return _("Drizzle");
			// 雨类(小雨到大暴雨再到特大暴雨)
			case "305":
			case "306":
			case "307":
			case "308":
			case "310":
			case "311":
			case "312":
			case "314":
			case "315":
			case "316":
			case "317":
			case "318":
			case "399":
				return _("Rain");
			// 雨夹雪类
			case "404":
			case "405":
			case "406":
				return _("Sleet");
			// 雪类
			case "400":
			case "401":
			case "402":
			case "403":
			case "408":
			case "409":
			case "410":
			case "499":
				return _("Snow");
			// 雾类
			case "500":
			case "501":
			case "509":
			case "510":
			case "514":
			case "515":
				return _("Fog");
			// 霾类
			case "502":
			case "511":
			case "512":
			case "513":
				return _("Haze");
			// 沙尘类
			case "503":
			case "504":
				return _("Dust");
			case "507":
			case "508":
				return _("Sandstorm");
			// 热 / 冷
			case "900":
				return _("Hot");
			case "901":
				return _("Cold");
			case "999":
			default:
				return _("Unknown")
		}
	}

	/**
	 * 将和风天气代码转换为(已翻译的)天气现象完整描述，
	 * 用于详情文本。
	 */
	private CodeToDescription(code: string | null | undefined): string {
		switch (code) {
			// 晴 / 多云 / 少云 / 晴间多云 / 阴
			case "100":
				return _("Sunny");
			case "101":
				return _("Cloudy");
			case "102":
				return _("Few clouds");
			case "103":
				return _("Partly cloudy");
			case "104":
				return _("Overcast");
			// 阵雨类
			case "300":
				return _("Shower rain");
			case "301":
				return _("Heavy shower rain");
			case "302":
				return _("Thundershower");
			case "303":
				return _("Heavy thundershower");
			case "304":
				return _("Thundershower with hail");
			case "305":
				return _("Light rain");
			case "306":
				return _("Moderate rain");
			case "307":
				return _("Heavy rain");
			case "308":
				return _("Extreme rain");
			case "309":
				return _("Drizzle");
			case "310":
				return _("Storm");
			case "311":
				return _("Heavy storm");
			case "312":
				return _("Severe storm");
			case "313":
				return _("Freezing rain");
			case "314":
				return _("Light to moderate rain");
			case "315":
				return _("Moderate to heavy rain");
			case "316":
				return _("Heavy rain to storm");
			case "317":
				return _("Storm to heavy storm");
			case "318":
				return _("Heavy storm to severe storm");
			case "399":
				return _("Rain");
			// 雪类
			case "400":
				return _("Light snow");
			case "401":
				return _("Moderate snow");
			case "402":
				return _("Heavy snow");
			case "403":
				return _("Snowstorm");
			case "404":
				return _("Sleet");
			case "405":
				return _("Rain and snow");
			case "406":
				return _("Sleet showers");
			case "407":
				return _("Snow showers");
			case "408":
				return _("Light to moderate snow");
			case "409":
				return _("Moderate to heavy snow");
			case "410":
				return _("Heavy snow to snowstorm");
			case "499":
				return _("Snow");
			// 雾 / 霾 / 沙尘类
			case "500":
				return _("Mist");
			case "501":
				return _("Fog");
			case "502":
				return _("Haze");
			case "503":
				return _("Sand");
			case "504":
				return _("Dust");
			case "507":
				return _("Sandstorm");
			case "508":
				return _("Severe sandstorm");
			case "509":
				return _("Dense fog");
			case "510":
				return _("Thick fog");
			case "511":
				return _("Moderate haze");
			case "512":
				return _("Heavy haze");
			case "513":
				return _("Severe haze");
			case "514":
				return _("Heavy fog");
			case "515":
				return _("Very dense fog");
			// 热 / 冷 / 未知
			case "900":
				return _("Hot");
			case "901":
				return _("Cold");
			case "999":
			default:
				return _("Unknown")
		}
	}

	/**
	 * 将和风天气代码映射为内置 GTK 图标名列表(按适配程度降序排列)。
	 * @param isNight 用于在晴/多云类代码上区分日间与夜间图标
	 */
	private ResolveIcon(code: string | null | undefined, isNight: boolean): BuiltinIcons[] {
		switch (code) {
			// 晴
			case "100":
				return isNight ?
					["weather-clear-night", "weather-clear"] :
					["weather-clear"];
			// 少云 / 晴间多云
			case "102":
			case "103":
				return isNight ?
					["weather-few-clouds-night", "weather-clouds-night", "weather-few-clouds"] :
					["weather-few-clouds", "weather-clouds"];
			// 多云
			case "101":
				return isNight ?
					["weather-clouds-night", "weather-few-clouds-night", "weather-clouds"] :
					["weather-clouds", "weather-few-clouds", "weather-overcast"];
			// 阴
			case "104":
				return ["weather-overcast", "weather-clouds", "weather-many-clouds"];
			// 雷阵雨类
			case "302":
			case "303":
				return ["weather-storm"];
			case "304": // 雷阵雨伴有冰雹
				return ["weather-storm", "weather-hail"];
			// 阵雨类
			case "300":
				return isNight ?
					["weather-showers-scattered-night", "weather-showers-scattered", "weather-rain"] :
					["weather-showers-scattered", "weather-rain"];
			case "301":
				return isNight ?
					["weather-showers-night", "weather-showers", "weather-rain"] :
					["weather-showers", "weather-rain"];
			// 冻雨
			case "313":
				return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
			// 毛毛雨
			case "309":
				return ["weather-showers-scattered", "weather-rain"];
			// 雨类
			case "305":
			case "314":
				return ["weather-rain", "weather-showers-scattered", "weather-showers"];
			case "306":
			case "307":
			case "308":
			case "310":
			case "311":
			case "312":
			case "315":
			case "316":
			case "317":
			case "318":
			case "399":
				return ["weather-rain", "weather-showers", "weather-showers-scattered"];
			// 雨夹雪类
			case "404":
			case "405":
			case "406":
				return ["weather-snow-rain", "weather-snow", "weather-rain"];
			// 雪类
			case "400":
			case "408":
				return ["weather-snow-scattered", "weather-snow"];
			case "401":
			case "402":
			case "403":
			case "409":
			case "410":
			case "499":
				return ["weather-snow"];
			// 阵雪
			case "407":
				return ["weather-snow-scattered", "weather-snow-scattered-day", "weather-snow"];
			// 雾 / 霾 / 沙尘类
			case "500":
			case "501":
			case "502":
			case "503":
			case "504":
			case "507":
			case "508":
			case "509":
			case "510":
			case "511":
			case "512":
			case "513":
			case "514":
			case "515":
				return ["weather-fog"];
			// 热 / 冷
			case "900":
				return ["weather-clear"];
			case "901":
				return ["weather-snow"];
			case "999":
			default:
				return ["weather-severe-alert"]
		}
	}

	/**
	 * 将和风天气代码映射为 applet 自带的自定义图标(weather-icons 图标集)。
	 * @param isNight 用于在晴/多云类代码上区分日间与夜间图标
	 */
	private ResolveCustomIcon(code: string | null | undefined, isNight: boolean): CustomIcons {
		switch (code) {
			// 晴
			case "100":
				return isNight ? "night-clear-symbolic" : "day-sunny-symbolic";
			// 少云 / 晴间多云
			case "102":
				return isNight ? "night-alt-cloudy-high-symbolic" : "day-cloudy-high-symbolic";
			case "103":
				return isNight ? "night-alt-partly-cloudy-symbolic" : "day-sunny-overcast-symbolic";
			// 多云 / 阴
			case "101":
				return isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic";
			case "104":
				return "cloudy-symbolic";
			// 雷阵雨类
			case "302":
				return "day-thunderstorm-symbolic";
			case "303":
				return "thunderstorm-symbolic";
			case "304": // 雷阵雨伴有冰雹
				return "day-rain-mix-storm-symbolic";
			// 阵雨类
			case "300":
				return isNight ? "night-alt-showers-symbolic" : "day-showers-symbolic";
			case "301":
				return isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic";
			// 冻雨
			case "313":
				return "rain-mix-symbolic";
			// 毛毛雨 / 小雨
			case "309":
			case "305":
			case "314":
				return "sprinkle-symbolic";
			// 雨类
			case "306":
			case "307":
			case "308":
			case "310":
			case "311":
			case "312":
			case "315":
			case "316":
			case "317":
			case "318":
			case "399":
				return "rain-symbolic";
			// 雨夹雪类
			case "404":
			case "405":
			case "406":
				return "sleet-symbolic";
			// 雪类
			case "400":
			case "408":
				return "day-snow-symbolic";
			case "401":
			case "402":
			case "403":
			case "409":
			case "410":
			case "499":
				return "snow-symbolic";
			// 阵雪
			case "407":
				return "day-snow-symbolic";
			// 雾类
			case "500":
			case "501":
			case "509":
			case "510":
			case "514":
			case "515":
				return "fog-symbolic";
			// 霾类
			case "502":
			case "511":
			case "512":
			case "513":
				return "smog-symbolic";
			// 沙尘类
			case "503":
			case "504":
				return "dust-symbolic";
			case "507":
			case "508":
				return "sandstorm-symbolic";
			// 热 / 冷
			case "900":
				return "hot-symbolic";
			case "901":
				return "snowflake-cold-symbolic";
			case "999":
			default:
				return "alien-symbolic"
		}
	}
}
