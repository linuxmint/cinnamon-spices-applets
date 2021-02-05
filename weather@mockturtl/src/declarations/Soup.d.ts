declare namespace imports.gi.Soup {
    export class SessionAsync {
        user_agent: string;
        queue_message(message: Message, callback: (session: SessionAsync, message: Message) => void): void;
        send_async(msg: Message, cancellable: any, callback: Gio.AsyncReadyCallback): any;
        send_finish(result: Gio.AsyncResult, user_data ? : Object): any;
        request(uri_string: string): SoupRequest;
        /**
         * Cancels all pending requests in this and closes all idle
         *   persistent connections.
         */
        abort(): void;
        /**
         * The timeout (in seconds) for socket I/O operations
            (including connecting to a server, and waiting for a reply
            to an HTTP request).

            Although you can change this property at any time, it will
            only affect newly-created connections, not currently-open
            ones. You can call Soup.Session.abort after setting this
            if you want to ensure that all future connections will have
            this timeout value.

            Note that the default value of 60 seconds only applies to
            plain Soup.Sessions. If you are using Soup.SessionAsync or
            Soup.SessionSync, the default value is 0 (meaning socket I/O
            will not time out).

            Not to be confused with Soup.Session.idle-timeout (which is
            the length of time that idle persistent connections will be
            kept open).
        */
        timeout: number;
        /**
         * Connection lifetime (in seconds) when idle. Any connection
            left idle longer than this will be closed.

            Although you can change this property at any time, it will
            only affect newly-created connections, not currently-open
            ones. You can call Soup.Session.abort after setting this
            if you want to ensure that all future connections will have
            this timeout value.

            Note that the default value of 60 seconds only applies to
            plain Soup.Sessions. If you are using Soup.SessionAsync or
            Soup.SessionSync, the default value is 0 (meaning idle
            connections will never time out).
        */
        idle_timeout: number;
    }
    export class Session {
        add_feature(session: SessionAsync, proxyResolver: ProxyResolverDefault): void;
    }

    export class SoupRequest {}

    export class ProxyResolverDefault {

    }
    export class Message {
        static new(method: string, query: string): Message;
        status_code: number;
        reason_phrase: string;
        response_body: SoupMessageBody;
        response_headers: any;
    }

    export interface SoupMessageBody {
        data: string;
        goffset: number;
    }
}