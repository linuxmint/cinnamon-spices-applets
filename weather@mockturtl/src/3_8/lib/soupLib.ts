import { REQUEST_TIMEOUT_SECONDS } from "../consts";
import { setTimeout } from "../utils";
import type { HTTPHeaders, HTTPParams, Method } from "./httpLib";
import { LoadContents } from "./io_lib";
import { Logger } from "./services/logger";
const { Message, Session } = imports.gi.Soup;
const { PRIORITY_DEFAULT }  = imports.gi.GLib;
const { Cancellable, File } = imports.gi.Gio;
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

	/**
	 * Needs to be called at least once on startup!
	 * @param userAgent
	 * @returns
	 */
	SetUserAgent: (userAgent: string | null) => Promise<void>;
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

/**
 * Best attempt at getting a unique user agent the make sure we are only blocked if we are really doing something wrong.
 *
 * No CGNAT, VPN or Tor issues.
 * @returns
 */
async function GetDefaultUserAgent(): Promise<string> {
	const machineIDFile = File.new_for_path("/etc/machine-id");
	let machineID: string | null = null;
	try {
		machineID = await LoadContents(machineIDFile);
	}
	catch (e) {
		if (e instanceof Error)
			Logger.Error("Error reading machine-id file: ", e);
	}

	machineID = machineID?.trim() ?? null;

	// Trailing space is important because Soup will append it's own version to the user agent. We need to make this as unique as possible.
	return `Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0 ${imports.misc.config.PACKAGE_NAME}/${imports.misc.config.PACKAGE_VERSION} ${machineID ?? "none"} `;
}


class Soup3 implements SoupLib {

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession = new Session();

	private defaultUserAgent: string | null = null;
	private defaultUserAgentReady: Promise<void>;
	private defaultUserAgentResolver: (() => void) | null = null;

	private async EnsureUserAgent(): Promise<string> {
		if (this.defaultUserAgent == null)
			this.defaultUserAgent = await GetDefaultUserAgent();

		return this.defaultUserAgent;
	}

    constructor() {
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		this.defaultUserAgentReady = new Promise((resolve) => {
			this.defaultUserAgentResolver = resolve;
		});
    }

	public SetUserAgent = async (userAgent: string | null) =>  {
		const DEFAULT_USER_AGENT = await this.EnsureUserAgent();
		Logger.Info("Setting user agent to: " + (userAgent || DEFAULT_USER_AGENT));
		this._httpSession.user_agent = userAgent || DEFAULT_USER_AGENT;
		this.defaultUserAgentResolver?.();
	};

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

		await this.defaultUserAgentReady;

		if (cancellable?.is_cancelled()) {
			return null;
		}

        // Add params to url
        url = AddParamsToURI(url, params);

		const query = noEncode ? url : encodeURI(url);
        Logger.Debug("URL called: " + query);
        const data: SoupResponse | null = await new Promise((resolve) => {
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

                this._httpSession.send_and_read_async(message, PRIORITY_DEFAULT, finalCancellable, (session, result) => {
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
						if (e instanceof Error)
							Logger.Error("Error reading http request's response: " + e.message, e);
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


interface Soup2Session extends Omit<imports.gi.Soup.Session, "send_async"> {
	use_thread_context: boolean;
	send_async: (message: imports.gi.Soup.Message, cancellable: imports.gi.Gio.Cancellable | null, callback: (session: unknown, result: imports.gi.Gio.AsyncResult) => void) => void;
}

class Soup2 implements SoupLib {

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession: Soup2Session;

	private defaultUserAgent: string | null = null;
	private defaultUserAgentReady: Promise<void>;
	private defaultUserAgentResolver: (() => void) | null = null;

	private async EnsureUserAgent(): Promise<string> {
		if (this.defaultUserAgent == null)
			this.defaultUserAgent = await GetDefaultUserAgent();

		return this.defaultUserAgent;
	}

	public SetUserAgent = async (userAgent: string | null) =>  {
		const DEFAULT_USER_AGENT = await this.EnsureUserAgent();
		Logger.Info("Setting user agent to: " + (userAgent || DEFAULT_USER_AGENT));
		this._httpSession.user_agent = userAgent || DEFAULT_USER_AGENT;
		this.defaultUserAgentResolver?.();
	};

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const { ProxyResolverDefault, SessionAsync } = (imports.gi.Soup as any);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		this._httpSession = new SessionAsync();
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		this._httpSession.use_thread_context = true;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
		this._httpSession.add_feature(new ProxyResolverDefault());
		this.defaultUserAgentReady = new Promise((resolve) => {
			this.defaultUserAgentResolver = resolve;
		});
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

		await this.defaultUserAgentReady;

		if (cancellable?.is_cancelled()) {
			return null;
		}

		// Add params to url
		url = AddParamsToURI(url, params);

		const query = encodeURI(url);
		Logger.Debug("URL called: " + query);
		const data: SoupResponse | null = await new Promise((resolve) => {
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

				Logger.Debug("Sending http request to " + query);
				this._httpSession.send_async(message, finalCancellable, async (session: unknown, result: imports.gi.Gio.AsyncResult) => {
					if (timeout != null)
						clearTimeout(timeout);

					const headers: Record<string, string> = {};
					let res: string | null = null;
					try {
						Logger.Debug("Reading reply from " + query);
						const stream: imports.gi.Gio.InputStream = this._httpSession.send_finish(result);
						Logger.Debug("Reply received from " + query + " with status code " + message.status_code + " and reason: " + message.reason_phrase);
						res = await this.read_all_bytes(stream, finalCancellable);
						stream.close(null);
						message.response_headers.foreach((name: string, value: string) => {
							headers[name] = value;
						})
					}
					catch(e) {
						if (e instanceof Error)
							Logger.Error("Error reading http request's response: " + e.message, e);
					}

					resolve({
						reason_phrase: message.reason_phrase,
						status_code: message.status_code,
						response_body: res,
						response_headers: headers
					});

					return;
				});
			}
		});

		return data;
	}

	private async read_all_bytes(stream: imports.gi.Gio.InputStream, cancellable: imports.gi.Gio.Cancellable): Promise<string | null> {
		if (cancellable.is_cancelled())
			return null;

		Logger.Debug("Reading all bytes from http request stream.");

		const read_chunk_async = () => {
			Logger.Verbose("Reading chunk from http request stream.");
			return new Promise<imports.gi.GLib.Bytes>((resolve) => {
				stream.read_bytes_async(8192, 0, cancellable, (source, read_result) => {
					try {
						Logger.Verbose("Reading chunk from http request stream finished.");
						resolve(stream.read_bytes_finish(read_result));
					}
					catch(e) {
						if (e instanceof Error)
							Logger.Error("Error reading chunk from http request stream: " + e.message, e);
						resolve(imports.gi.GLib.Bytes.new());
					}
				});
			})
		}

		let res: string | null = null;
		let chunk: imports.gi.GLib.Bytes;
		Logger.Verbose("Reading First chunk from http request stream.")
		chunk = await read_chunk_async();
		Logger.Verbose("Reading First chunk from http request stream finished.")
		while (chunk.get_size() > 0) {
			if (cancellable.is_cancelled())
				return res;

			const chunkAsString = ByteArray.fromGBytes(chunk).toString();
			if (res === null) {
				res = chunkAsString;
			}
			else {
				res += chunkAsString;
			}

			Logger.Verbose("Reading Next chunk from http request stream.")
			chunk = await read_chunk_async();
			Logger.Verbose("Reading Next chunk from http request stream finished.")
		}

		Logger.Verbose("Reading all bytes from http request stream finished.");
		return res;
	}
}

// SessionAsync is a Soup2 class
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
export const soupLib: SoupLib = (imports.gi.Soup as any).SessionAsync != undefined ? new Soup2() : new Soup3();