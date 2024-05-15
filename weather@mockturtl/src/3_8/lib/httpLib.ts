import { Logger } from "./logger";
import { ErrorDetail } from "../types";
import { _ } from "../utils";
import { soupLib, SoupResponse } from "./soupLib";
import { Event } from "./events";

export type LoadAsyncOptions = {
	params?: HTTPParams;
	headers?: HTTPHeaders;
	method?: Method;
	url: string;
	cancellable: imports.gi.Gio.Cancellable;
	/**
	 * If the request is successful, this function will be called to check if the response is valid.
	 *
	 * If the function returns true, the error will be handled by the HttpLib.
	 */
	HandleError?: (message: ErrorResponse<any>) => boolean;
};

export class HttpLib {
	private static instance: HttpLib;
	/** Single instance of log */
	public static get Instance() {
		if (this.instance == null)
			this.instance = new HttpLib();
		return this.instance;
	}

	public readonly UnhandledError: Event<HttpLib, HttpError> = new Event<HttpLib, HttpError>();

	public async LoadJsonSimple<T>(options: LoadAsyncOptions): Promise<T | null> {
		const response = await this.LoadJsonAsync<T>(options);
		return response.Success ? response.Data : null;
	}

	/**
	 * Handles obtaining JSON over http.
	 */
	public async LoadJsonAsync<T, E = any>(
		options: LoadAsyncOptions
	): Promise<Response<T, E>> {
		const {HandleError, ...rest} = options;

		const response = await this.LoadAsync({
			...rest,
			// we will handle error this level
			HandleError: () => false
		});

		try {
			const payload = JSON.parse(response.Data);
			response.Data = payload;
		}
		catch (e) { // Payload is not JSON
			// Only care about JSON parse errors if the request was successful before
			if (response.Success) {
				if (e instanceof Error)
				 	Logger.Error("Error: API response is not JSON. The response: " + response.Data, e);
				(<GenericResponse>response).Success = false;
				(<GenericResponse>response).ErrorData = {
					code: -1,
					message: "bad api response - non json",
					reason_phrase: "",
				}
			}
		}

		if (!response.Success && (!HandleError || HandleError(response)))
			this.UnhandledError.Invoke(this, response.ErrorData);
		return response as Response<T, E>;
	}

	public async LoadAsyncSimple(options: LoadAsyncOptions): Promise<string | null> {
		const response = await this.LoadAsync(options);
		return response.Success ? response.Data : null;
	}

	/**
	 * Handles obtaining data over http.
	 */
	public async LoadAsync<E = any>(
		options: LoadAsyncOptions
	): Promise<Response<string | null, E>> {
		const {url, HandleError, ...rest} = options

		const message = await soupLib.Send(url, rest);

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
				message: "no response data",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}

		if ((message?.status_code ?? -1) > 200 && (message?.status_code ?? -1) < 300) {
			Logger.Info("Warning: API returned non-OK status code '" + message?.status_code + "'");
		}

		Logger.Verbose("API full response: " + message?.response_body?.toString());
		const result = <GenericResponse>{
			Success: (error == null),
			Data: (message?.response_body ?? null),
			ResponseHeaders: message?.response_headers,
			ErrorData: error,
			Response: message
		}

		if (error != null) {
			Logger.Info(`Error calling URL: ${error.code}, ${error.reason_phrase}, ${error?.response?.response_body ?? "None"}`);
		}

		// check if caller wants
		if (!result.Success && (!HandleError || HandleError(result as ErrorResponse<any>)))
			this.UnhandledError.Invoke(this, result.ErrorData);

		return result;
	}
}

// Declarations
export type Method = "GET" | "POST" | "PUT" | "DELETE";
export type NetworkError = "";

export type Response<T, E = any> = SuccessResponse<T> | ErrorResponse<E>;

export interface SuccessResponse<T> extends GenericSuccessResponse {
	Data: T;
}

export interface ErrorResponse<E = any> extends GenericErrorResponse {
	Data: E;
}

type GenericResponse = GenericErrorResponse | GenericSuccessResponse;

interface GenericErrorResponse extends BaseGenericResponse {
	Success: false;
	ErrorData: HttpError;
}

interface GenericSuccessResponse extends BaseGenericResponse {
	Success: true;
	ErrorData: undefined;
}

interface BaseGenericResponse {
	Data: any | undefined;
	ResponseHeaders: Record<string, string>;
}

export interface HTTPParams {
	[key: string]: boolean | string | number | null;
}

export type HTTPHeaders = Record<string, string>;

export interface HttpError {
	code: number;
	message: ErrorDetail;
	reason_phrase: string;
	response?: SoupResponse | undefined
}




// 	/**
// 	 * Send a http request
// 	 * @param url
// 	 * @param params
// 	 * @param method
// 	 */
// 	 public async Send(url: string, params?: HTTPParams | null, headers?: HTTPHeaders, method: Method = "GET"): Promise<SoupResponse | null> {
// 		// Add params to url
// 		if (params != null) {
// 			const items = Object.keys(params);
// 			for (const [index, item] of items.entries()) {
// 				url += (index == 0) ? "?" : "&";
// 				url += (item) + "=" + params[item]
// 			}
// 		}

// 		const query = encodeURI(url);
// 		Logger.Debug("URL called: " + query);
// 		const data: SoupResponse | null = await new Promise((resolve, reject) => {
// 			const message = Message.new(method, query);
// 			if (message == null) {
// 				resolve(null);
// 			}
// 			else {
// 				if (headers != null) {
// 					for (const key in headers) {
// 						message.request_headers.append(key, headers[key]);
// 					}
// 				}
// 				this._httpSession.send_async(message, null, (session, result) => {
// 					const stream: imports.gi.Gio.InputStream | null = this._httpSession.send_finish(result);
// 					if (stream == null)
// 						resolve(null);

// 					const headers: Record<string, string> = {};
// 					message.response_headers.foreach((name, value) => {
// 						headers[name] = value;
// 					})

// 					let text = "";
// 					while (true) {
// 						const data = await ReadFromStream(stream);
// 						if (data == null)
// 							break;
// 						text+= data;
// 					}

// 					resolve({
// 						reason_phrase: message.reason_phrase,
// 						response_body: text,
// 						response_headers: headers,
// 						status_code: message.status_code
// 					})
// 				});
// 			}
// 		});

// 		return data;
// 	}
// }

// async function ReadFromStream(stream: imports.gi.Gio.InputStream): Promise<string | null> {
// 	return new Promise((resolve)=> {
// 		stream.read_bytes_async(imports.gi.GLib.MAXINT32, imports.gi.GLib.PRIORITY_DEFAULT, null, (session, finished) => {
// 			const data = stream.read_bytes_finish(finished);

// 			resolve(data != null ? ByteArray.toString(ByteArray.fromGBytes(data)) : null);
// 		})
// 	})
// }