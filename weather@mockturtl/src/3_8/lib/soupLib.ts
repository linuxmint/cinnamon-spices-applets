import { REQUEST_TIMEOUT_SECONDS } from "../consts";
import { setTimeout } from "../utils";
import { HTTPHeaders, HTTPParams, Method } from "./httpLib";
import { Logger } from "./logger";
const { Message, Session } = imports.gi.Soup;
const { PRIORITY_DEFAULT }  = imports.gi.GLib;
const { Cancellable } = imports.gi.Gio;
const ByteArray = imports.byteArray;

export interface SoupLibSendOptions {
	params?: HTTPParams | null,
	headers?: HTTPHeaders,
	method?: Method,
	/**
	 * If not provided, a timeout is set to REQUEST_TIMEOUT_SECONDS automatically.
	 */
	cancellable?: imports.gi.Gio.Cancellable,
	/** Do not encode the url.  */
	noEncode?: boolean
}
export interface SoupLib {
    Send: (
		url: string,
		options?: SoupLibSendOptions
	) => Promise<SoupResponse | null>;
}

export interface SoupResponse {
	status_code: number;
	reason_phrase: string;
	response_body: string | null;
	response_headers: Record<string, string>;
}

function AddParamsToURI(url: string, params?: HTTPParams | null): string {
    let result = url;
    if (params != null) {
        const items = Object.keys(params);
        for (const [index, item] of items.entries()) {
            result += (index == 0) ? "?" : "&";
            result += (item) + "=" + params[item]
        }
    }
    return result;
}

function AddHeadersToMessage(message: imports.gi.Soup.Message, headers?: HTTPHeaders): void {
    if (headers != null) {
        for (const key in headers) {
            message.request_headers.append(key, headers[key]);
        }
    }
}

class Soup3 implements SoupLib {

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession = new Session();

    constructor() {
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
    }

    async Send(
		url: string,
		options: SoupLibSendOptions = {}
	): Promise<SoupResponse | null> {
		const {
			params,
			headers,
			method = "GET",
			cancellable,
			noEncode = false
		} = options;

		if (cancellable?.is_cancelled()) {
			return Promise.resolve(null);
		}

        // Add params to url
        url = AddParamsToURI(url, params);

		const query = noEncode ? url : encodeURI(url);
        Logger.Debug("URL called: " + query);
        const data: SoupResponse | null = await new Promise((resolve, reject) => {
            const message = Message.new(method, query);
            if (message == null) {
                resolve(null);
            }
            else {
                AddHeadersToMessage(message, headers);
				const finalCancellable = cancellable ?? Cancellable.new();

				let timeout: number | null = null;
				// If cancellable is not provided, we create a timeout to cancel the request after REQUEST_TIMEOUT_SECONDS
				if (cancellable == null) {
					timeout = setTimeout(() => finalCancellable.cancel(), REQUEST_TIMEOUT_SECONDS * 1000);
				}

                this._httpSession.send_and_read_async(message, PRIORITY_DEFAULT, finalCancellable, (session: any, result: any) => {
					const headers: Record<string, string> = {};
					let res: imports.gi.GLib.Bytes | null = null;
					if (timeout != null)
						clearTimeout(timeout);
					try {
						res = this._httpSession.send_and_read_finish(result);
						message.get_response_headers().foreach((name: string, value: string) => {
							headers[name] = value;
						})
					}
					catch(e) {
						Logger.Error("Error reading http request's response: " + e);
					}
					finally {
						resolve({
							reason_phrase: message.get_reason_phrase() ?? "",
							status_code: message.get_status(),
							response_body: res != null ? ByteArray.toString(ByteArray.fromGBytes(res)) : null,
							response_headers: headers
						});
					}
                });
            }
        });

        return data;
    }
}

class Soup2 implements SoupLib {

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession: any;

    constructor() {
        const { ProxyResolverDefault, SessionAsync } = (imports.gi.Soup as any);
		this._httpSession = new SessionAsync();
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		this._httpSession.use_thread_context = true;
		this._httpSession.add_feature(new ProxyResolverDefault());
    }

    /**
	 * Send a http request
	 * @param url
	 * @param params
	 * @param method
	 */
	public async Send(
		url: string,
		options: SoupLibSendOptions = {}
	): Promise<SoupResponse | null> {
		const {
			params,
			headers,
			method = "GET",
			cancellable
		} = options;

		if (cancellable?.is_cancelled()) {
			return Promise.resolve(null);
		}

		// Add params to url
		url = AddParamsToURI(url, params);

		const query = encodeURI(url);
		Logger.Debug("URL called: " + query);
		const data: SoupResponse | null = await new Promise((resolve, reject) => {
			const message = Message.new(method, query);
			if (message == null) {
				resolve(null);
			}
			else {
				AddHeadersToMessage(message, headers);
				const finalCancellable = cancellable ?? Cancellable.new();

				let timeout: number | null = null;
				// If cancellable is not provided, we create a timeout to cancel the request after REQUEST_TIMEOUT_SECONDS
				if (cancellable == null) {
					timeout = setTimeout(() => finalCancellable.cancel(), REQUEST_TIMEOUT_SECONDS * 1000);
				}

				this._httpSession.send_async(message, cancellable, async (session: any, result: imports.gi.Gio.AsyncResult) => {
					if (timeout != null)
						clearTimeout(timeout);

					const headers: Record<string, string> = {};
					let res: string | null = null;
					try {
						const stream: imports.gi.Gio.InputStream = this._httpSession.send_finish(result);
						res = await this.read_all_bytes(stream, finalCancellable);
						message.response_headers.foreach((name: any, value: any) => {
							headers[name] = value;
						})
					}
					catch(e) {
						Logger.Error("Error reading http request's response: " + e);
					}

					resolve({
						reason_phrase: message.reason_phrase,
						status_code: message.status_code,
						response_body: res,
						response_headers: headers
					});

				});
			}
		});

		return data;
	}

	private async read_all_bytes(stream: imports.gi.Gio.InputStream, cancellable: imports.gi.Gio.Cancellable): Promise<string | null> {
		if (cancellable.is_cancelled())
			return null;

		const read_chunk_async = () => {
			return new Promise<imports.gi.GLib.Bytes>((resolve) => {
				stream.read_bytes_async(8192, 0, cancellable, (source, read_result) => {
					try {
						resolve(stream.read_bytes_finish(read_result));
					}
					catch(e) {
						Logger.Error("Error reading chunk from http request stream: " + e);
						resolve(imports.gi.GLib.Bytes.new());
					}
				});
			})
		}

		let res: string | null = null;
		let chunk: imports.gi.GLib.Bytes;
		chunk = await read_chunk_async();
		while (chunk.get_size() > 0) {
			if (cancellable.is_cancelled())
				return res;

			const chunkAsString = ByteArray.fromGBytes(chunk).toString();
			if (res === null) {
				res = chunkAsString;
			}
			else {
				(res as string) += chunkAsString;
			}

			chunk = await read_chunk_async();
		}

		return res;
	}
}

// SessionAsync is a Soup2 class
export const soupLib: SoupLib = (imports.gi.Soup as any).SessionAsync != undefined ? new Soup2() : new Soup3();