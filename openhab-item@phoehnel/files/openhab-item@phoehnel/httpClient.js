const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;

const SOUP_MAJOR = Soup.MAJOR_VERSION;

var HttpClient = class HttpClient {
    constructor() {
        if (SOUP_MAJOR === 3) {
            this._session = new Soup.Session();
        } else {
            this._session = new Soup.SessionAsync();
            Soup.Session.prototype.add_feature.call(
                this._session, new Soup.ProxyResolverDefault()
            );
        }
        this._session.timeout = 10;
    }

    get(url, apiToken, onSuccess, onError) {
        this._request("GET", url, null, apiToken, onSuccess, onError);
    }

    post(url, body, apiToken, onSuccess, onError) {
        this._request("POST", url, body, apiToken, onSuccess, onError);
    }

    _request(method, url, body, apiToken, onSuccess, onError) {
        let message;
        try {
            message = Soup.Message.new(method, url);
            if (!message) {
                onError("Invalid URL: " + url);
                return;
            }
        } catch (e) {
            onError("Failed to create request: " + e.message);
            return;
        }

        if (apiToken) {
            if (SOUP_MAJOR === 3) {
                message.get_request_headers().append("Authorization", "Bearer " + apiToken);
            } else {
                message.request_headers.append("Authorization", "Bearer " + apiToken);
            }
        }

        if (SOUP_MAJOR === 3) {
            message.get_request_headers().append("Accept", "application/json");
        } else {
            message.request_headers.append("Accept", "application/json");
        }

        if (body !== null && body !== undefined) {
            if (SOUP_MAJOR === 3) {
                let bytes = GLib.Bytes.new(new TextEncoder().encode(body.toString()));
                message.set_request_body_from_bytes("text/plain", bytes);
            } else {
                message.set_request(
                    "text/plain",
                    Soup.MemoryUse.COPY,
                    body.toString()
                );
            }
        }

        if (SOUP_MAJOR === 3) {
            this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        let bytes = session.send_and_read_finish(result);
                        let status = message.get_status();
                        if (status === Soup.Status.OK || status === 200) {
                            let data = new TextDecoder().decode(bytes.get_data());
                            onSuccess(data, status);
                        } else {
                            onError("HTTP " + status, status);
                        }
                    } catch (e) {
                        onError(e.message, 0);
                    }
                }
            );
        } else {
            this._session.queue_message(message, (session, msg) => {
                let status = msg.status_code;
                if (status === Soup.KnownStatusCode.OK || status === 200) {
                    onSuccess(msg.response_body.data, status);
                } else {
                    onError("HTTP " + status, status);
                }
            });
        }
    }

    destroy() {
        if (this._session) {
            if (SOUP_MAJOR === 3) {
                // Soup3 sessions don't need explicit abort
            } else if (this._session.abort) {
                this._session.abort();
            }
            this._session = null;
        }
    }
};
