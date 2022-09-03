import { HTTPHeaders, HTTPParams, Method } from "./httpLib";
import { Logger } from "./logger";
const { Message, Session } = imports.gi.Soup;

export interface SoupLib {
    Send: (url: string, params?: HTTPParams | null, headers?: HTTPHeaders, method?: Method) => Promise<SoupResponse | null>;
}

export interface SoupResponse {
	status_code: number;
	reason_phrase: string;
	response_body: string | null;
	response_headers: Record<string, string>;
}

class Soup2 implements SoupLib {

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession = new Session();

    constructor() {
        const {ProxyResolverDefault}  = imports.gi.Soup;
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
		this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		this._httpSession.add_feature(new ProxyResolverDefault());
    }

    /**
	 * Send a http request
	 * @param url 
	 * @param params 
	 * @param method 
	 */
	public async Send(url: string, params?: HTTPParams | null, headers?: HTTPHeaders, method: Method = "GET"): Promise<SoupResponse | null> {
		// Add params to url
		if (params != null) {
			const items = Object.keys(params);
			for (const [index, item] of items.entries()) {
				url += (index == 0) ? "?" : "&";
				url += (item) + "=" + params[item]
			}
		}

		const query = encodeURI(url);
		Logger.Debug("URL called: " + query);
		const data: SoupResponse | null = await new Promise((resolve, reject) => {
			const message = Message.new(method, query);
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
					const headers: Record<string, string> = {};
					message.response_headers.foreach((name, value) => {
						headers[name] = value;
					})

					resolve({
						reason_phrase: message.reason_phrase,
						status_code: message.status_code,
						response_body: message.response_body?.data ?? null,
						response_headers: headers
					});
				});
			}
		});

		return data;
	}
}


export const soupLib: SoupLib = new Soup2();