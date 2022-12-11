/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") to log the error message regardless of the DEBUG() return.
 */
const DEBUG = false;
function log(message, alwaysLog=false) {
  if (DEBUG || alwaysLog) global.log("[httpLib.js]: " + message);
}

function logError(error) {
  global.logError("\n[httpLib.js]: " + error + "\n")
}


/// Code from the Weather applet (weather@mockturtl). Many thanks to @Gr3q! ///
const { Message, ProxyResolverDefault, SessionAsync, MessageHeaders, MessageHeadersType } = imports.gi.Soup;
class HttpLib {
    constructor() {
        this._httpSession = new SessionAsync();
        this._httpSession.user_agent = "Mozilla/5.0 (compatible; Radio3.0; https://radiodb.fr/)";
        this._httpSession.timeout = 10;
        this._httpSession.idle_timeout = 10;
        this._httpSession.add_feature(new ProxyResolverDefault());
    }
    static get Instance() {
        if (this.instance == null)
            this.instance = new HttpLib();
        return this.instance;
    }
    async LoadJsonAsync(url, params, headers, method = "GET") {
        let response = await this.LoadAsync(url, params, headers, method);
        if (!response.Success)
            return response;
        try {
            let payload = JSON.parse(response.Data);
            response.Data = payload;
        }
        catch (e) {
            log("Error: API response is not JSON. The response: " + response.Data, e);
            response.Success = false;
            response.ErrorData = {
                code: -1,
                message: "bad api response - non json",
                reason_phrase: "",
            };
        }
        finally {
            return response;
        }
    }
    async LoadAsync(url, params, headers, method = "GET") {
        var _a, _b, _c, _d, _e;
        let message = await this.Send(url, params, headers, method);
        let error = undefined;
        if (!message) {
            error = {
                code: 0,
                message: "no network response",
                reason_phrase: "no network response",
                response: undefined
            };
        }
        else if (message.status_code < 100 && message.status_code >= 0) {
            error = {
                code: message.status_code,
                message: "no network response",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (message.status_code > 300 || message.status_code < 200) {
            error = {
                code: message.status_code,
                message: "bad status code",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (!message.response_body) {
            error = {
                code: message.status_code,
                message: "no response body",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (!message.response_body.data) {
            error = {
                code: message.status_code,
                message: "no response data",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        if ((message === null || message === void 0 ? void 0 : message.status_code) > 200 && (message === null || message === void 0 ? void 0 : message.status_code) < 300) {
            log("Warning: API returned non-OK status code '" + (message === null || message === void 0 ? void 0 : message.status_code) + "'");
        }
        log("API full response: " + ((_b = (_a = message === null || message === void 0 ? void 0 : message.response_body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()));
        if (error != null)
            logError("Error calling URL: " + error.reason_phrase + ", " + ((_d = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.response_body) === null || _d === void 0 ? void 0 : _d.data));
        return {
            Success: (error == null),
            Data: (_e = message === null || message === void 0 ? void 0 : message.response_body) === null || _e === void 0 ? void 0 : _e.data,
            ErrorData: error
        };
    }
    async Send(url, params, headers, method = "GET") {
        if (params != null) {
            let items = Object.keys(params);
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                url += (index == 0) ? "?" : "&";
                url += (item) + "=" + params[item];
            }
        }
        let query = encodeURI(url);
        log("URL called: " + query);
        let data = await new Promise((resolve, reject) => {
            let message = Message.new(method, query);
            if (headers != null) {
                for (const key in headers) {
                    message.request_headers.append(key, headers[key]);
                }
            }
            this._httpSession.queue_message(message, (session, message) => {
                resolve(message);
            });
        });
        return data;
    }
}
