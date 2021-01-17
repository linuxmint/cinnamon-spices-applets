"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = exports.HttpLib = void 0;
const logger_1 = require("./logger");
const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
class HttpLib {
    constructor() {
        this._httpSession = new SessionAsync();
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        this._httpSession.timeout = 10;
        this._httpSession.idle_timeout = 10;
        Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
    }
    async LoadJsonAsync(url, params, method = "GET") {
        let response = await this.LoadAsync(url, params, method);
        if (!response.Success)
            return response;
        try {
            let payload = JSON.parse(response.Data);
            response.Data = payload;
        }
        catch (e) {
            logger_1.Logger.Error("Error: API response is not JSON. The response: " + response.Data);
            response.Success = false;
            response.ErrorData = {
                code: -1,
                message: "bad api response - non json",
                reason_phrase: null,
            };
        }
        finally {
            return response;
        }
    }
    async LoadAsync(url, params, method = "GET") {
        var _a, _b, _c;
        let message = await this.Send(url, params, method);
        let error = null;
        if (!message) {
            error = {
                code: 0,
                message: "no network response",
                reason_phrase: "no network response",
                response: null
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
        logger_1.Logger.Debug2("API full response: " + ((_b = (_a = message === null || message === void 0 ? void 0 : message.response_body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()));
        return {
            Success: (error == null),
            Data: (_c = message === null || message === void 0 ? void 0 : message.response_body) === null || _c === void 0 ? void 0 : _c.data,
            ErrorData: error
        };
    }
    async Send(url, params, method = "GET") {
        if (params != null) {
            url += "?";
            let items = Object.keys(params);
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                url += (index == 0) ? "?" : "&";
                url += (item) + "=" + params[item];
            }
        }
        let query = encodeURI(url);
        logger_1.Logger.Debug("URL called: " + query);
        let data = await new Promise((resolve, reject) => {
            let message = Message.new(method, query);
            this._httpSession.queue_message(message, (session, message) => {
                resolve(message);
            });
        });
        return data;
    }
}
exports.HttpLib = HttpLib;
exports.Http = new HttpLib();
