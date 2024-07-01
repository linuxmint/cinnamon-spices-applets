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


/// Code from the Weather applet (weather@mockturtl). Many thanks to @Gr3q!
const { Message, Session, SessionAsync } = imports.gi.Soup;
const { PRIORITY_DEFAULT } = imports.gi.GLib;
const soupLib_ByteArray = imports.byteArray;
function AddParamsToURI(url, params) {
    let result = url;
    if (params != null) {
        const items = Object.keys(params);
        for (const [index, item] of items.entries()) {
            result += (index == 0) ? "?" : "&";
            result += (item) + "=" + params[item];
        }
    }
    return result;
}
function AddHeadersToMessage(message, headers) {
    if (headers != null) {
        for (const key in headers) {
            message.request_headers.append(key, headers[key]);
        }
    }
}
class Soup3 {
    constructor() {
        this._httpSession = new Session();
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        //this._httpSession.timeout = 10;
        //this._httpSession.idle_timeout = 10;
    }
    async Send(url, params, headers, method = "GET") {
        url = AddParamsToURI(url, params);
        const query = encodeURI(url);
        log("URL called: " + query);
        const data = await new Promise((resolve, reject) => {
            const message = Message.new(method, query);
            if (message == null) {
                resolve(null);
            }
            else {
                AddHeadersToMessage(message, headers);
                this._httpSession.send_and_read_async(message, PRIORITY_DEFAULT, null, (session, result) => {
                    var _a;
                    const res = this._httpSession.send_and_read_finish(result);
                    const headers = {};
                    message.get_response_headers().foreach((name, value) => {
                        headers[name] = value;
                    });
                    resolve({
                        reason_phrase: (_a = message.get_reason_phrase()) !== null && _a !== void 0 ? _a : "",
                        status_code: message.get_status(),
                        response_body: res != null ? soupLib_ByteArray.toString(soupLib_ByteArray.fromGBytes(res)) : null,
                        response_headers: headers
                    });
                });
            }
        });
        return data;
    }
}
class Soup2 {
    constructor() {
        this._httpSession = new SessionAsync();
        const { ProxyResolverDefault } = imports.gi.Soup;
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        //this._httpSession.timeout = 10;
        //this._httpSession.idle_timeout = 10;
        this._httpSession.add_feature(new ProxyResolverDefault());
    }
    async Send(url, params, headers, method = "GET") {
        url = AddParamsToURI(url, params);
        const query = encodeURI(url);
        log("URL called: " + query);
        const data = await new Promise((resolve, reject) => {
            const message = Message.new(method, query);
            if (message == null) {
                resolve(null);
            }
            else {
                AddHeadersToMessage(message, headers);
                this._httpSession.queue_message(message, (session, message) => {
                    var _a, _b;
                    const headers = {};
                    message.response_headers.foreach((name, value) => {
                        headers[name] = value;
                    });
                    resolve({
                        reason_phrase: message.reason_phrase,
                        status_code: message.status_code,
                        response_body: (_b = (_a = message.response_body) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : null,
                        response_headers: headers
                    });
                });
            }
        });
        return data;
    }
}
const soupLib = imports.gi.Soup.MAJOR_VERSION == 3 ? new Soup3() : new Soup2();

;// CONCATENATED MODULE: ./src/3_8/lib/httpLib.ts


class HttpLib {
    static get Instance() {
        if (this.instance == null)
            this.instance = new HttpLib();
        return this.instance;
    }
    async LoadJsonAsync(url, params, headers, method = "GET") {
        const response = await this.LoadAsync(url, params, headers, method);
        try {
            const payload = JSON.parse(response.Data);
            response.Data = payload;
        }
        catch (e) {
            if (response.Success) {
                if (e instanceof Error)
                    logError("Error: API response is not JSON. The response: " + response.Data, e);
                response.Success = false;
                response.ErrorData = {
                    code: -1,
                    message: "bad api response - non json",
                    reason_phrase: "",
                };
            }
        }
        finally {
            return response;
        }
    }
    async LoadAsync(url, params, headers, method = "GET") {
        var _a, _b, _c, _d, _e;
        const message = await soupLib.Send(url, params, headers, method);
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
                message: "no response data",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        if (((_a = message === null || message === void 0 ? void 0 : message.status_code) !== null && _a !== void 0 ? _a : -1) > 200 && ((_b = message === null || message === void 0 ? void 0 : message.status_code) !== null && _b !== void 0 ? _b : -1) < 300) {
            log("Warning: API returned non-OK status code '" + (message === null || message === void 0 ? void 0 : message.status_code) + "'");
        }
        log("API full response: " + ((_c = message === null || message === void 0 ? void 0 : message.response_body) === null || _c === void 0 ? void 0 : _c.toString()));
        if (error != null)
            log("Error calling URL: " + error.reason_phrase + ", " + ((_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.response_body));
        return {
            Success: (error == null),
            Data: ((_e = message === null || message === void 0 ? void 0 : message.response_body) !== null && _e !== void 0 ? _e : null),
            ResponseHeaders: message === null || message === void 0 ? void 0 : message.response_headers,
            ErrorData: error,
            Response: message
        };
    }
}
