import { Logger } from "./logger";
import { ErrorDetail } from "../types";
import { _ } from "../utils";

const { Message, ProxyResolverDefault, SessionAsync, MessageHeaders, MessageHeadersType } = imports.gi.Soup;

export class HttpLib {
	private static instance: HttpLib;
	/** Single instance of log */
	public static get Instance() {
		if (this.instance == null)
			this.instance = new HttpLib();
		return this.instance;
	}

	/** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession = new SessionAsync();

	private constructor() {
		this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		this._httpSession.add_feature(new ProxyResolverDefault());
	}

	/**
	 * Handles obtaining JSON over http. 
	 */
	public async LoadJsonAsync<T>(url: string, params?: HTTPParams, headers?: HTTPHeaders, method: Method = "GET"): Promise<Response<T>> {
		let response = await this.LoadAsync(url, params, headers, method);

		if (!response.Success)
			return response;

		try {
			let payload = JSON.parse(response.Data);
			response.Data = payload;
		}
		catch (e) { // Payload is not JSON
			if (e instanceof Error)
				Logger.Error("Error: API response is not JSON. The response: " + response.Data, e);
			response.Success = false;
			response.ErrorData = {
				code: -1,
				message: "bad api response - non json",
				reason_phrase: "",
			}
		}
		finally {
			return response as Response<T>;
		}
	}

	/**
	 * Handles obtaining data over http. 
	 */
	public async LoadAsync(url: string, params?: HTTPParams, headers?: HTTPHeaders, method: Method = "GET"): Promise<GenericResponse> {
		let message = await this.Send(url, params, headers, method);

		let error: HttpError | undefined = undefined;

		// Error generation
		if (!message) {
			error = {
				code: 0,
				message: "no network response",
				reason_phrase: "no network response",
				response: undefined
			}
		}
		// network or DNS error
		else if (message.status_code < 100 && message.status_code >= 0) {
			error = {
				code: message.status_code,
				message: "no network response",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}
		else if (message.status_code > 300 || message.status_code < 200) {
			error = {
				code: message.status_code,
				message: "bad status code",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}
		else if (!message.response_body) {
			error = {
				code: message.status_code,
				message: "no response body",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}
		else if (!message.response_body.data) {
			error = {
				code: message.status_code,
				message: "no response data",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}

		if ((message?.status_code ?? -1) > 200 && (message?.status_code ?? -1) < 300) {
			Logger.Info("Warning: API returned non-OK status code '" + message?.status_code + "'");
		}

		Logger.Verbose("API full response: " + message?.response_body?.data?.toString());
		if (error != null)
			Logger.Error("Error calling URL: " + error.reason_phrase + ", " + error?.response?.response_body?.data);
		return {
			Success: (error == null),
			Data: message?.response_body?.data,
			ErrorData: error
		}
	}

	/**
	 * Send a http request
	 * @param url 
	 * @param params 
	 * @param method 
	 */
	public async Send(url: string, params?: HTTPParams | null, headers?: HTTPHeaders, method: Method = "GET"): Promise<imports.gi.Soup.Message | null> {
		// Add params to url
		if (params != null) {
			let items = Object.keys(params);
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				url += (index == 0) ? "?" : "&";
				url += (item) + "=" + params[item]
			}
		}

		let query = encodeURI(url);
		Logger.Debug("URL called: " + query);
		let data: imports.gi.Soup.Message | null = await new Promise((resolve, reject) => {
			let message = Message.new(method, query);
			if (message == null) {
				resolve(null);
			}
			else {
				if (headers != null) {
					for (const key in headers) {
						message.request_headers.append(key, headers[key]);
					}
				}
				this._httpSession.queue_message(message, (session, message) => {
					resolve(message);
				});
			}
		});

		return data;
	}
}

// Declarations
export type Method = "GET" | "POST" | "PUT" | "DELETE";
export type NetworkError = "";

export interface Response<T> extends GenericResponse {
	Data: T,
}

interface GenericResponse {
	Success: boolean;
	Data: any | undefined;
	ErrorData: HttpError | undefined;
}

export interface HTTPParams {
	[key: string]: boolean | string | number | null;
}

export interface HTTPHeaders {
	[key: string]: string;
}

export interface HttpError {
	code: number;
	message: ErrorDetail;
	reason_phrase: string;
	data?: any;
	response?: imports.gi.Soup.Message | undefined
}