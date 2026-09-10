const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

var HttpClientError = class HttpClientError extends Error {
    constructor(kind, message, details = {}) {
        super(message);
        this.name = "HttpClientError";
        this.kind = kind;
        this.status = details.status ?? null;
        this.url = details.url ?? null;
    }
};

function _transportKind(error) {
    const text = String(error?.message || error || "").toLowerCase();
    if (text.includes("timed out") || text.includes("timeout"))
        return "timeout";
    return "network";
}

var HttpClient = class HttpClient {
    constructor(userAgent, timeoutSeconds = 20) {
        this._destroyed = false;
        this._session = new Soup.Session({
            user_agent: userAgent
        });
        this._session.timeout = timeoutSeconds;
    }

    getJson(url, callback) {
        if (this._destroyed) {
            callback(new HttpClientError("closed", "HTTP client is closed", { url }), null);
            return;
        }

        let message;

        try {
            message = Soup.Message.new("GET", url);
        } catch (error) {
            callback(new HttpClientError("config", String(error.message || error), { url }), null);
            return;
        }

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                if (this._destroyed)
                    return;

                let bytes;
                try {
                    bytes = session.send_and_read_finish(result);
                } catch (error) {
                    callback(new HttpClientError(
                        _transportKind(error),
                        String(error.message || error),
                        { url }
                    ), null);
                    return;
                }

                const status = message.get_status();
                if (status < 200 || status >= 300) {
                    callback(new HttpClientError(
                        "http",
                        `HTTP ${status}`,
                        { status, url }
                    ), null);
                    return;
                }

                let text;
                try {
                    text = ByteArray.toString(bytes.get_data());
                } catch (error) {
                    callback(new HttpClientError(
                        "network",
                        `response decode: ${error.message || error}`,
                        { url }
                    ), null);
                    return;
                }

                try {
                    callback(null, JSON.parse(text));
                } catch (error) {
                    callback(new HttpClientError(
                        "json",
                        String(error.message || error),
                        { url }
                    ), null);
                }
            }
        );
    }

    destroy() {
        this._destroyed = true;

        if (this._session) {
            this._session.abort();
            this._session = null;
        }
    }
};
