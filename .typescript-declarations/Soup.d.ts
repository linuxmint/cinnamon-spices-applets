declare namespace imports.gi.Soup {

	interface Address extends GObject.Object, Gio.SocketConnectable {
		equal_by_ip(addr2: Address): boolean;
		equal_by_name(addr2: Address): boolean;
		get_gsockaddr(): Gio.SocketAddress;
		get_name(): string;
		get_physical(): string;
		get_port(): number;
		get_sockaddr(len: number): any;
		hash_by_ip(): number;
		hash_by_name(): number;
		is_resolved(): boolean;
		resolve_async(async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: AddressCallback, user_data: any): void;
		resolve_sync(cancellable: Gio.Cancellable): number;
	}

	var Address: {
		new(name: string, _port: number): Address;
		new_any(family: AddressFamily, _port: number): Address;
		new_from_sockaddr(sa: any, len: number): Address;

	}

	interface Auth extends GObject.Object {
		authenticate(username: string, password: string): void;
		can_authenticate(): boolean;
		free_protection_space(space: GLib.SList): void;
		get_authorization(msg: Message): string;
		get_host(): string;
		get_info(): string;
		get_protection_space(source_uri: URI): GLib.SList;
		get_realm(): string;
		get_saved_password(user: string): string;
		get_saved_users(): GLib.SList;
		get_scheme_name(): string;
		has_saved_password(username: string, password: string): void;
		is_authenticated(): boolean;
		is_for_proxy(): boolean;
		is_ready(msg: Message): boolean;
		save_password(username: string, password: string): void;
		update(msg: Message, auth_header: string): boolean;
	}

	var Auth: {
		new(_type: GObject.Type, msg: Message, auth_header: string): Auth;

	}




	interface AuthBasic extends Auth {

	}

	var AuthBasic: {


	}




	interface AuthDigest extends Auth {

	}

	var AuthDigest: {


	}




	interface AuthDomain extends GObject.Object {
		accepts(msg: Message): string;
		add_path(path: string): void;
		challenge(msg: Message): void;
		check_password(msg: Message, username: string, password: string): boolean;
		covers(msg: Message): boolean;
		get_realm(): string;
		remove_path(path: string): void;
		set_filter(filter: AuthDomainFilter, filter_data: any, dnotify: GLib.DestroyNotify): void;
		set_generic_auth_callback(auth_callback: AuthDomainGenericAuthCallback, auth_data: any, dnotify: GLib.DestroyNotify): void;
		try_generic_auth_callback(msg: Message, username: string): boolean;
	}

	var AuthDomain: {


	}




	interface AuthDomainBasic extends AuthDomain {
		set_auth_callback(callback: AuthDomainBasicAuthCallback, user_data: any, dnotify: GLib.DestroyNotify): void;
	}

	var AuthDomainBasic: {
		new(optname1: string): AuthDomain;

	}




	interface AuthDomainDigest extends AuthDomain {
		set_auth_callback(callback: AuthDomainDigestAuthCallback, user_data: any, dnotify: GLib.DestroyNotify): void;
	}

	var AuthDomainDigest: {
		new(optname1: string): AuthDomain;
		encode_password(username: string, realm: string, password: string): string;
	}




	interface AuthManager extends GObject.Object, SessionFeature {
		clear_cached_credentials(): void;
		use_auth(uri: URI, auth: Auth): void;
	}

	var AuthManager: {


	}




	interface AuthNTLM extends Auth {

	}

	var AuthNTLM: {


	}




	interface AuthNegotiate extends Auth {

	}

	var AuthNegotiate: {

		supported(): boolean;
	}




	interface Cache extends GObject.Object, SessionFeature {
		clear(): void;
		dump(): void;
		flush(): void;
		get_max_size(): number;
		load(): void;
		set_max_size(max_size: number): void;
	}

	var Cache: {
		new(cache_dir: string, cache_type: CacheType): Cache;

	}




	interface ContentDecoder extends GObject.Object, SessionFeature {

	}

	var ContentDecoder: {


	}




	interface ContentSniffer extends GObject.Object, SessionFeature {
		get_buffer_size(): number;
		sniff(msg: Message, buffer: Buffer, params: GLib.HashTable): string;
	}

	var ContentSniffer: {
		new(): ContentSniffer;

	}




	interface CookieJar extends GObject.Object, SessionFeature {
		add_cookie(cookie: Cookie): void;
		add_cookie_with_first_party(first_party: URI, cookie: Cookie): void;
		all_cookies(): GLib.SList;
		delete_cookie(cookie: Cookie): void;
		get_accept_policy(): CookieJarAcceptPolicy;
		get_cookie_list(uri: URI, for_http: boolean): GLib.SList;
		get_cookies(uri: URI, for_http: boolean): string;
		is_persistent(): boolean;
		save(): void;
		set_accept_policy(policy: CookieJarAcceptPolicy): void;
		set_cookie(uri: URI, cookie: string): void;
		set_cookie_with_first_party(uri: URI, first_party: URI, cookie: string): void;
	}

	var CookieJar: {
		new(): CookieJar;

	}




	interface CookieJarDB extends CookieJar, SessionFeature {

	}

	var CookieJarDB: {
		new(filename: string, read_only: boolean): CookieJar;

	}




	interface CookieJarText extends CookieJar, SessionFeature {

	}

	var CookieJarText: {
		new(filename: string, read_only: boolean): CookieJar;

	}




	interface Logger extends GObject.Object, SessionFeature {
		attach(session: Session): void;
		detach(session: Session): void;
		set_printer(printer: LoggerPrinter, printer_data: any, destroy: GLib.DestroyNotify): void;
		set_request_filter(request_filter: LoggerFilter, filter_data: any, destroy: GLib.DestroyNotify): void;
		set_response_filter(response_filter: LoggerFilter, filter_data: any, destroy: GLib.DestroyNotify): void;
	}

	var Logger: {
		new(level: LoggerLogLevel, max_body_size: number): Logger;

	}




	class Message extends GObject.Object {
		first_party: URI;
		flags: MessageFlags;
		http_version: HTTPVersion;
		is_top_level_navigation: boolean;
		method: string;
		priority: MessagePriority;
		reason_phrase: string;
		request_body: MessageBody;
		request_body_data: ByteArray;
		request_headers: MessageHeaders;
		response_body: MessageBody;
		response_body_data: ByteArray
		response_headers: MessageHeaders;
		server_side: boolean;
		site_for_cookies: URI;
		status_code: number;
		tls_certificate: Gio.TlsCertificate;
		tls_errors: Gio.TlsCertificateFlags;
		uri: URI;
		add_header_handler(signal: string, header: string, callback: GObject.Callback, user_data: any): number;
		add_status_code_handler(signal: string, status_code: number, callback: GObject.Callback, user_data: any): number;
		content_sniffed(content_type: string, params: GLib.HashTable): void;
		disable_feature(feature_type: GObject.Type): void;
		finished(): void;
		get_address(): Address;
		get_first_party(): URI;
		get_flags(): MessageFlags;
		get_http_version(): HTTPVersion;
		get_https_status(certificate: Gio.TlsCertificate, errors: Gio.TlsCertificateFlags): boolean;
		get_priority(): MessagePriority;
		get_soup_request(): Request;
		get_uri(): URI;
		got_body(): void;
		got_chunk(chunk: Buffer): void;
		got_headers(): void;
		got_informational(): void;
		is_keepalive(): boolean;
		restarted(): void;
		set_chunk_allocator(allocator: ChunkAllocator, user_data: any, destroy_notify: GLib.DestroyNotify): void;
		set_first_party(first_party: URI): void;
		set_flags(flags: MessageFlags): void;
		set_http_version(version: HTTPVersion): void;
		set_priority(priority: MessagePriority): void;
		set_redirect(status_code: number, redirect_uri: string): void;
		set_request(content_type: string, req_use: MemoryUse, req_body: number[], req_length: number): void;
		set_response(content_type: string, resp_use: MemoryUse, resp_body: number[], resp_length: number): void;
		set_status(status_code: number): void;
		set_status_full(status_code: number, reason_phrase: string): void;
		set_uri(uri: URI): void;
		starting(): void;
		wrote_body(): void;
		wrote_body_data(chunk: Buffer): void;
		wrote_chunk(): void;
		wrote_headers(): void;
		wrote_informational(): void;
		static new(method: string, uri_string: string): Message;
		static new_from_uri(method: string, uri: URI): Message;
	}


	interface MultipartInputStream extends Gio.FilterInputStream, Gio.PollableInputStream {
		get_headers(): MessageHeaders;
		next_part(cancellable: Gio.Cancellable): Gio.InputStream;
		next_part_async(io_priority: number, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, data: any): void;
		next_part_finish(result: Gio.AsyncResult): Gio.InputStream;
	}

	var MultipartInputStream: {
		new(msg: Message, base_stream: Gio.InputStream): MultipartInputStream;

	}




	interface ProxyResolverDefault extends GObject.Object, ProxyURIResolver, SessionFeature {

	}

	var ProxyResolverDefault: {
		new(): ProxyResolverDefault;
	}




	interface Request extends GObject.Object, Gio.Initable {
		get_content_length(): number;
		get_content_type(): string;
		get_session(): Session;
		get_uri(): URI;
		send(cancellable: Gio.Cancellable): Gio.InputStream;
		send_async(cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any): void;
		send_finish(result: Gio.AsyncResult): Gio.InputStream;
	}

	var Request: {


	}




	interface RequestData extends Request, Gio.Initable {

	}

	var RequestData: {


	}




	interface RequestFile extends Request, Gio.Initable {
		get_file(): Gio.File;
	}

	var RequestFile: {


	}




	interface RequestHTTP extends Request, Gio.Initable {
		get_message(): Message;
	}

	var RequestHTTP: {


	}




	interface Requester extends GObject.Object, SessionFeature {
		request(uri_string: string): Request;
		request_uri(uri: URI): Request;
	}

	var Requester: {
		new(): Requester;

	}




	interface Server extends GObject.Object {
		accept_iostream(stream: Gio.IOStream, local_addr: Gio.SocketAddress, remote_addr: Gio.SocketAddress): boolean;
		add_auth_domain(auth_domain: AuthDomain): void;
		add_early_handler(path: string, callback: ServerCallback, user_data: any, destroy: GLib.DestroyNotify): void;
		add_handler(path: string, callback: ServerCallback, user_data: any, destroy: GLib.DestroyNotify): void;
		add_websocket_handler(path: string, origin: string, protocols: string[], callback: ServerWebsocketCallback, user_data: any, destroy: GLib.DestroyNotify): void;
		disconnect(): void;
		get_async_context(): GLib.MainContext;
		get_listener(): Socket;
		get_listeners(): GLib.SList;
		get_port(): number;
		get_uris(): GLib.SList;
		is_https(): boolean;
		listen(address: Gio.SocketAddress, options: ServerListenOptions): boolean;
		listen_all(_port: number, options: ServerListenOptions): boolean;
		listen_fd(fd: number, options: ServerListenOptions): boolean;
		listen_local(_port: number, options: ServerListenOptions): boolean;
		listen_socket(socket: Gio.Socket, options: ServerListenOptions): boolean;
		pause_message(msg: Message): void;
		quit(): void;
		remove_auth_domain(auth_domain: AuthDomain): void;
		remove_handler(path: string): void;
		run(): void;
		run_async(): void;
		set_ssl_cert_file(ssl_cert_file: string, ssl_key_file: string): boolean;
		unpause_message(msg: Message): void;
	}

	var Server: {
		new(optname1: string): Server;

	}




	interface Session extends GObject.Object {
		user_agent: string;
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

		/**
		 * Cancels all pending requests in this and closes all idle
		 *   persistent connections.
		 */
		abort(): void;
		add_feature(feature: SessionFeature): void;
		add_feature_by_type(feature_type: GObject.Type): void;
		cancel_message(msg: Message, status_code: number): void;
		connect_async(uri: URI, cancellable: Gio.Cancellable, progress_callback: SessionConnectProgressCallback, callback: Gio.AsyncReadyCallback, user_data: any): void;
		connect_finish(result: Gio.AsyncResult): Gio.IOStream;
		get_async_context(): GLib.MainContext;
		get_feature(feature_type: GObject.Type): SessionFeature;
		get_feature_for_message(feature_type: GObject.Type, msg: Message): SessionFeature;
		get_features(feature_type: GObject.Type): GLib.SList;
		has_feature(feature_type: GObject.Type): boolean;
		pause_message(msg: Message): void;
		prefetch_dns(hostname: string, cancellable: Gio.Cancellable, callback: AddressCallback, user_data: any): void;
		prepare_for_uri(uri: URI): void;
		queue_message(msg: Message, callback: SessionCallback, user_data?: any): void;
		redirect_message(msg: Message): boolean;
		remove_feature(feature: SessionFeature): void;
		remove_feature_by_type(feature_type: GObject.Type): void;
		request(uri_string: string): Request;
		request_http(method: string, uri_string: string): RequestHTTP;
		request_http_uri(method: string, uri: URI): RequestHTTP;
		request_uri(uri: URI): Request;
		requeue_message(msg: Message): void;
		send(msg: Message, cancellable: Gio.Cancellable): Gio.InputStream;
		send_async(msg: Message, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any): void;
		send_finish(result: Gio.AsyncResult): Gio.InputStream;
		send_message(msg: Message): number;
		steal_connection(msg: Message): Gio.IOStream;
		unpause_message(msg: Message): void;
		websocket_connect_async(msg: Message, origin: string, protocols: string[], cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any): void;
		websocket_connect_finish(result: Gio.AsyncResult): WebsocketConnection;
		would_redirect(msg: Message): boolean;
	}

	var Session: {
		new(): Session;
		new_with_options(optname1: string): Session;

	}




	interface SessionAsync extends Session {

	}

	var SessionAsync: {
		new(): Session;
		new_with_options(optname1: string): Session;

	}




	interface SessionSync extends Session {

	}

	var SessionSync: {
		new(): Session;
		new_with_options(optname1: string): Session;

	}




	interface Socket extends GObject.Object, Gio.Initable {
		connect_async(cancellable: Gio.Cancellable, callback: SocketCallback, user_data: any): void;
		connect_sync(cancellable: Gio.Cancellable): number;
		disconnect(): void;
		get_fd(): number;
		get_local_address(): Address;
		get_remote_address(): Address;
		is_connected(): boolean;
		is_ssl(): boolean;
		listen(): boolean;
		read(buffer: number[], len: number, nread: number, cancellable: Gio.Cancellable): SocketIOStatus;
		read_until(buffer: number[], len: number, boundary: any, boundary_len: number, nread: number, got_boundary: boolean, cancellable: Gio.Cancellable): SocketIOStatus;
		start_proxy_ssl(ssl_host: string, cancellable: Gio.Cancellable): boolean;
		start_ssl(cancellable: Gio.Cancellable): boolean;
		write(buffer: number[], len: number, nwrote: number, cancellable: Gio.Cancellable): SocketIOStatus;
	}

	var Socket: {
		new(optname1: string): Socket;

	}




	interface WebsocketConnection extends GObject.Object {
		close(code: number, data: string): void;
		get_close_code(): number;
		get_close_data(): string;
		get_connection_type(): WebsocketConnectionType;
		get_io_stream(): Gio.IOStream;
		get_keepalive_interval(): number;
		get_max_incoming_payload_size(): number;
		get_origin(): string;
		get_protocol(): string;
		get_state(): WebsocketState;
		get_uri(): URI;
		send_binary(data: number[], length: number): void;
		send_text(text: string): void;
		set_keepalive_interval(interval: number): void;
		set_max_incoming_payload_size(max_incoming_payload_size: number): void;
	}

	var WebsocketConnection: {
		new(stream: Gio.IOStream, uri: URI, _type: WebsocketConnectionType, origin: string, protocol: string): WebsocketConnection;

	}




	class AddressClass {
		public parent_class: GObject.ObjectClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class AuthClass {
		public parent_class: GObject.ObjectClass;
		public scheme_name: string;
		public strength: number;

		update: { (auth: Auth, msg: Message, auth_header: GLib.HashTable): boolean; };
		get_protection_space: { (auth: Auth, source_uri: URI): GLib.SList; };
		authenticate: { (auth: Auth, username: string, password: string): void; };
		is_authenticated: { (auth: Auth): boolean; };
		get_authorization: { (auth: Auth, msg: Message): string; };
		is_ready: { (auth: Auth, msg: Message): boolean; };
		can_authenticate: { (auth: Auth): boolean; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class AuthDomainBasicClass {
		public parent_class: AuthDomainClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class AuthDomainClass {
		public parent_class: GObject.ObjectClass;

		accepts: { (domain: AuthDomain, msg: Message, header: string): string; };
		challenge: { (domain: AuthDomain, msg: Message): string; };
		check_password: { (domain: AuthDomain, msg: Message, username: string, password: string): boolean; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class AuthDomainDigestClass {
		public parent_class: AuthDomainClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class AuthManagerClass {
		public parent_class: GObject.ObjectClass;

		authenticate: { (manager: AuthManager, msg: Message, auth: Auth, retrying: boolean): void; };

	}



	class AuthManagerPrivate {


	}



	class Buffer {
		public data: any;
		public length: number;


		public copy(): Buffer;
		public free(): void;
		public get_as_bytes(): GLib.Bytes;
		public get_data(data: number[], length: number): void;
		public get_owner(): any;
		public new_subbuffer(offset: number, length: number): Buffer;
	}



	class CacheClass {
		public parent_class: GObject.ObjectClass;

		get_cacheability: { (cache: Cache, msg: Message): Cacheability; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };

	}



	class CachePrivate {


	}



	class ClientContext {


		public get_address(): Address;
		public get_auth_domain(): AuthDomain;
		public get_auth_user(): string;
		public get_gsocket(): Gio.Socket;
		public get_host(): string;
		public get_local_address(): Gio.SocketAddress;
		public get_remote_address(): Gio.SocketAddress;
		public get_socket(): Socket;
		public steal_connection(): Gio.IOStream;
	}



	class Connection {


	}



	class ContentDecoderClass {
		public parent_class: GObject.ObjectClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };
		_libsoup_reserved5: { (): void; };

	}



	class ContentDecoderPrivate {


	}



	class ContentSnifferClass {
		public parent_class: GObject.ObjectClass;

		sniff: { (sniffer: ContentSniffer, msg: Message, buffer: Buffer, params: GLib.HashTable): string; };
		get_buffer_size: { (sniffer: ContentSniffer): number; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };
		_libsoup_reserved5: { (): void; };

	}



	class ContentSnifferPrivate {


	}



	class Cookie {
		public name: string;
		public value: string;
		public domain: string;
		public path: string;
		public expires: Date;
		public secure: boolean;
		public http_only: boolean;


		public applies_to_uri(uri: URI): boolean;
		public copy(): Cookie;
		public domain_matches(host: string): boolean;
		public equal(cookie2: Cookie): boolean;
		public free(): void;
		public get_domain(): string;
		public get_expires(): Date;
		public get_http_only(): boolean;
		public get_name(): string;
		public get_path(): string;
		public get_secure(): boolean;
		public get_value(): string;
		public set_domain(domain: string): void;
		public set_expires(expires: Date): void;
		public set_http_only(http_only: boolean): void;
		public set_max_age(max_age: number): void;
		public set_name(name: string): void;
		public set_path(path: string): void;
		public set_secure(secure: boolean): void;
		public set_value(value: string): void;
		public to_cookie_header(): string;
		public to_set_cookie_header(): string;
	}



	class CookieJarClass {
		public parent_class: GObject.ObjectClass;

		save: { (jar: CookieJar): void; };
		is_persistent: { (jar: CookieJar): boolean; };
		changed: { (jar: CookieJar, old_cookie: Cookie, new_cookie: Cookie): void; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };

	}



	class CookieJarDBClass {
		public parent_class: CookieJarClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class CookieJarTextClass {
		public parent_class: CookieJarClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class Date {
		public year: number;
		public month: number;
		public day: number;
		public hour: number;
		public minute: number;
		public second: number;
		public utc: boolean;
		public offset: number;


		public copy(): Date;
		public free(): void;
		public get_day(): number;
		public get_hour(): number;
		public get_minute(): number;
		public get_month(): number;
		public get_offset(): number;
		public get_second(): number;
		public get_utc(): number;
		public get_year(): number;
		public is_past(): boolean;
		public to_string(format: DateFormat): string;
		public to_time_t(): number;
		public to_timeval(time: GLib.TimeVal): void;
	}



	class LoggerClass {
		public parent_class: GObject.ObjectClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class MessageBody {
		public data: string;
		public length: number;


		public append(use: MemoryUse, data: number[], length: number): void;
		public append_buffer(buffer: Buffer): void;
		public append_take(data: number[], length: number): void;
		public complete(): void;
		public flatten(): Buffer;
		public free(): void;
		public get_accumulate(): boolean;
		public get_chunk(offset: number): Buffer;
		public got_chunk(chunk: Buffer): void;
		public set_accumulate(accumulate: boolean): void;
		public truncate(): void;
		public wrote_chunk(chunk: Buffer): void;
	}



	class MessageClass {
		public parent_class: GObject.ObjectClass;

		wrote_informational: { (msg: Message): void; };
		wrote_headers: { (msg: Message): void; };
		wrote_chunk: { (msg: Message): void; };
		wrote_body: { (msg: Message): void; };
		got_informational: { (msg: Message): void; };
		got_headers: { (msg: Message): void; };
		got_chunk: { (msg: Message, chunk: Buffer): void; };
		got_body: { (msg: Message): void; };
		restarted: { (msg: Message): void; };
		finished: { (msg: Message): void; };
		starting: { (msg: Message): void; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };

	}



	class MessageHeaders {


		public append(name: string, value: string): void;
		public clean_connection_headers(): void;
		public clear(): void;
		public foreach(_func: MessageHeadersForeachFunc, user_data: any): void;
		public free(): void;
		public free_ranges(ranges: Range): void;
		public get(name: string): string;
		public get_content_disposition(disposition: string, params: GLib.HashTable): boolean;
		public get_content_length(): number;
		public get_content_range(start: number, _end: number, total_length: number): boolean;
		public get_content_type(params: GLib.HashTable): string;
		public get_encoding(): Encoding;
		public get_expectations(): Expectation;
		public get_headers_type(): MessageHeadersType;
		public get_list(name: string): string;
		public get_one(name: string): string;
		public get_ranges(total_length: number, ranges: Range[], length: number): boolean;
		public header_contains(name: string, token: string): boolean;
		public header_equals(name: string, value: string): boolean;
		public remove(name: string): void;
		public replace(name: string, value: string): void;
		public set_content_disposition(disposition: string, params: GLib.HashTable): void;
		public set_content_length(content_length: number): void;
		public set_content_range(start: number, _end: number, total_length: number): void;
		public set_content_type(content_type: string, params: GLib.HashTable): void;
		public set_encoding(encoding: Encoding): void;
		public set_expectations(expectations: Expectation): void;
		public set_range(start: number, _end: number): void;
		public set_ranges(ranges: Range, length: number): void;
	}



	class MessageHeadersIter {
		public dummy: any[];


		public next(name: string, value: string): boolean;
	}



	class MessageQueue {


	}



	class MessageQueueItem {


	}



	class Multipart {


		public append_form_file(control_name: string, filename: string, content_type: string, body: Buffer): void;
		public append_form_string(control_name: string, data: string): void;
		public append_part(headers: MessageHeaders, body: Buffer): void;
		public free(): void;
		public get_length(): number;
		public get_part(part: number, headers: MessageHeaders, body: Buffer): boolean;
		public to_message(dest_headers: MessageHeaders, dest_body: MessageBody): void;
	}



	class MultipartInputStreamClass {
		public parent_class: Gio.FilterInputStreamClass;


	}



	class MultipartInputStreamPrivate {


	}



	class PasswordManagerInterface {
		public base: GObject.TypeInterface;

		get_passwords_async: { (password_manager: PasswordManager, msg: Message, auth: Auth, retrying: boolean, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: PasswordManagerCallback, user_data: any): void; };
		get_passwords_sync: { (password_manager: PasswordManager, msg: Message, auth: Auth, cancellable: Gio.Cancellable): void; };

	}



	class ProxyResolverDefaultClass {
		public parent_class: GObject.ObjectClass;


	}



	class ProxyResolverInterface {
		public base: GObject.TypeInterface;

		get_proxy_async: { (proxy_resolver: ProxyResolver, msg: Message, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: ProxyResolverCallback, user_data: any): void; };
		get_proxy_sync: { (proxy_resolver: ProxyResolver, msg: Message, cancellable: Gio.Cancellable, addr: Address): number; };

	}



	class ProxyURIResolverInterface {
		public base: GObject.TypeInterface;

		get_proxy_uri_async: { (proxy_uri_resolver: ProxyURIResolver, uri: URI, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: ProxyURIResolverCallback, user_data: any): void; };
		get_proxy_uri_sync: { (proxy_uri_resolver: ProxyURIResolver, uri: URI, cancellable: Gio.Cancellable, proxy_uri: URI): number; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class Range {
		public start: number;
		public end: number;


	}



	class RequestClass {
		public parent: GObject.ObjectClass;
		public schemes: string;

		check_uri: { (req_base: Request, uri: URI): boolean; };
		send: { (request: Request, cancellable: Gio.Cancellable): Gio.InputStream; };
		send_async: { (request: Request, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any): void; };
		send_finish: { (request: Request, result: Gio.AsyncResult): Gio.InputStream; };
		get_content_length: { (request: Request): number; };
		get_content_type: { (request: Request): string; };

	}



	class RequestDataClass {
		public parent: RequestClass;


	}



	class RequestDataPrivate {


	}



	class RequestFileClass {
		public parent: RequestClass;


	}



	class RequestFilePrivate {


	}



	class RequestHTTPClass {
		public parent: RequestClass;


	}



	class RequestHTTPPrivate {


	}



	class RequestPrivate {


	}



	class RequesterClass {
		public parent_class: GObject.ObjectClass;


	}



	class RequesterPrivate {


	}



	class ServerClass {
		public parent_class: GObject.ObjectClass;

		request_started: { (server: Server, msg: Message, client: ClientContext): void; };
		request_read: { (server: Server, msg: Message, client: ClientContext): void; };
		request_finished: { (server: Server, msg: Message, client: ClientContext): void; };
		request_aborted: { (server: Server, msg: Message, client: ClientContext): void; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class SessionAsyncClass {
		public parent_class: SessionClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class SessionClass {
		public parent_class: GObject.ObjectClass;

		request_started: { (session: Session, msg: Message, socket: Socket): void; };
		authenticate: { (session: Session, msg: Message, auth: Auth, retrying: boolean): void; };
		queue_message: { (session: Session, msg: Message, callback: SessionCallback, user_data: any): void; };
		requeue_message: { (session: Session, msg: Message): void; };
		send_message: { (session: Session, msg: Message): number; };
		cancel_message: { (session: Session, msg: Message, status_code: number): void; };
		auth_required: { (session: Session, msg: Message, auth: Auth, retrying: boolean): void; };
		flush_queue: { (session: Session): void; };
		kick: { (session: Session): void; };
		_libsoup_reserved4: { (): void; };

	}



	class SessionFeatureInterface {
		public parent: GObject.TypeInterface;

		attach: { (feature: SessionFeature, session: Session): void; };
		detach: { (feature: SessionFeature, session: Session): void; };
		request_queued: { (feature: SessionFeature, session: Session, msg: Message): void; };
		request_started: { (feature: SessionFeature, session: Session, msg: Message, socket: Socket): void; };
		request_unqueued: { (feature: SessionFeature, session: Session, msg: Message): void; };
		add_feature: { (feature: SessionFeature, _type: GObject.Type): boolean; };
		remove_feature: { (feature: SessionFeature, _type: GObject.Type): boolean; };
		has_feature: { (feature: SessionFeature, _type: GObject.Type): boolean; };

	}



	class SessionSyncClass {
		public parent_class: SessionClass;

		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class SocketClass {
		public parent_class: GObject.ObjectClass;

		readable: { (sock: Socket): void; };
		writable: { (sock: Socket): void; };
		disconnected: { (sock: Socket): void; };
		new_connection: { (listener: Socket, new_sock: Socket): void; };
		_libsoup_reserved1: { (): void; };
		_libsoup_reserved2: { (): void; };
		_libsoup_reserved3: { (): void; };
		_libsoup_reserved4: { (): void; };

	}



	class URI {
		constructor(uri: string)

		public scheme: string;
		public user: string;
		public password: string;
		public host: string;
		public port: number;
		public path: string;
		public query: string;
		public fragment: string;


		public copy(): URI;
		public copy_host(): URI;
		public equal(uri2: URI): boolean;
		public free(): void;
		public get_fragment(): string;
		public get_host(): string;
		public get_password(): string;
		public get_path(): string;
		public get_port(): number;
		public get_query(): string;
		public get_scheme(): string;
		public get_user(): string;
		public host_equal(v2: URI): boolean;
		public host_hash(): number;
		public set_fragment(fragment: string): void;
		public set_host(host: string): void;
		public set_password(password: string): void;
		public set_path(path: string): void;
		public set_port(_port: number): void;
		public set_query(query: string): void;
		public set_query_from_fields(first_field: string): void;
		public set_query_from_form(form: GLib.HashTable): void;
		public set_scheme(scheme: string): void;
		public set_user(user: string): void;
		public to_string(just_path_and_query: boolean): string;
		public uses_default_port(): boolean;

		static decode(part: string): string;
		static encode(part: string, escape_extra: string): string;
		static normalize(part: string, enescape_extra: string): string;
		static new(uri_string: string): URI;
		static new_with_base(base: URI, uri_string: string): URI;
	}



	class WebsocketConnectionClass {
		public parent: GObject.ObjectClass;

		message: { (self: WebsocketConnection, _type: WebsocketDataType, message: GLib.Bytes): void; };
		error: { (self: WebsocketConnection, error: GLib.Error): void; };
		closing: { (self: WebsocketConnection): void; };
		closed: { (self: WebsocketConnection): void; };
		pong: { (self: WebsocketConnection, message: GLib.Bytes): void; };

	}



	class WebsocketConnectionPrivate {


	}



	class XMLRPCParams {


		public free(): void;
		public parse(signature: string): GLib.Variant;
	}



	interface PasswordManager {
		get_passwords_async(msg: Message, auth: Auth, retrying: boolean, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: PasswordManagerCallback, user_data: any): void;
		get_passwords_sync(msg: Message, auth: Auth, cancellable: Gio.Cancellable): void;
	}

	var PasswordManager: {


	}




	interface ProxyResolver {
		get_proxy_async(msg: Message, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: ProxyResolverCallback, user_data: any): void;
		get_proxy_sync(msg: Message, cancellable: Gio.Cancellable, addr: Address): number;
	}

	var ProxyResolver: {


	}




	interface ProxyURIResolver {
		get_proxy_uri_async(uri: URI, async_context: GLib.MainContext, cancellable: Gio.Cancellable, callback: ProxyURIResolverCallback, user_data: any): void;
		get_proxy_uri_sync(uri: URI, cancellable: Gio.Cancellable, proxy_uri: URI): number;
	}

	var ProxyURIResolver: {


	}




	interface SessionFeature {
		add_feature(_type: GObject.Type): boolean;
		attach(session: Session): void;
		detach(session: Session): void;
		has_feature(_type: GObject.Type): boolean;
		remove_feature(_type: GObject.Type): boolean;
	}

	var SessionFeature: {


	}




	enum AddressFamily {
		invalid = -1,
		ipv4 = 2,
		ipv6 = 10
	}



	enum CacheResponse {
		fresh = 0,
		needs_validation = 1,
		stale = 2
	}



	enum CacheType {
		single_user = 0,
		shared = 1
	}



	enum ConnectionState {
		new = 0,
		connecting = 1,
		idle = 2,
		in_use = 3,
		remote_disconnected = 4,
		disconnected = 5
	}



	enum CookieJarAcceptPolicy {
		always = 0,
		never = 1,
		no_third_party = 2
	}



	enum DateFormat {
		http = 1,
		cookie = 2,
		rfc2822 = 3,
		iso8601_compact = 4,
		iso8601_full = 5,
		iso8601 = 5,
		iso8601_xmlrpc = 6
	}



	enum Encoding {
		unrecognized = 0,
		none = 1,
		content_length = 2,
		eof = 3,
		chunked = 4,
		byteranges = 5
	}



	enum HTTPVersion {
		http_1_0 = 0,
		http_1_1 = 1
	}



	enum KnownStatusCode {
		none = 0,
		cancelled = 1,
		cant_resolve = 2,
		cant_resolve_proxy = 3,
		cant_connect = 4,
		cant_connect_proxy = 5,
		ssl_failed = 6,
		io_error = 7,
		malformed = 8,
		try_again = 9,
		too_many_redirects = 10,
		tls_failed = 11,
		continue = 100,
		switching_protocols = 101,
		processing = 102,
		ok = 200,
		created = 201,
		accepted = 202,
		non_authoritative = 203,
		no_content = 204,
		reset_content = 205,
		partial_content = 206,
		multi_status = 207,
		multiple_choices = 300,
		moved_permanently = 301,
		found = 302,
		moved_temporarily = 302,
		see_other = 303,
		not_modified = 304,
		use_proxy = 305,
		not_appearing_in_this_protocol = 306,
		temporary_redirect = 307,
		bad_request = 400,
		unauthorized = 401,
		payment_required = 402,
		forbidden = 403,
		not_found = 404,
		method_not_allowed = 405,
		not_acceptable = 406,
		proxy_authentication_required = 407,
		proxy_unauthorized = 407,
		request_timeout = 408,
		conflict = 409,
		gone = 410,
		length_required = 411,
		precondition_failed = 412,
		request_entity_too_large = 413,
		request_uri_too_long = 414,
		unsupported_media_type = 415,
		requested_range_not_satisfiable = 416,
		invalid_range = 416,
		expectation_failed = 417,
		unprocessable_entity = 422,
		locked = 423,
		failed_dependency = 424,
		internal_server_error = 500,
		not_implemented = 501,
		bad_gateway = 502,
		service_unavailable = 503,
		gateway_timeout = 504,
		http_version_not_supported = 505,
		insufficient_storage = 507,
		not_extended = 510
	}



	enum LoggerLogLevel {
		none = 0,
		minimal = 1,
		headers = 2,
		body = 3
	}



	enum MemoryUse {
		static = 0,
		take = 1,
		copy = 2,
		temporary = 3
	}



	enum MessageHeadersType {
		request = 0,
		response = 1,
		multipart = 2
	}



	enum MessagePriority {
		very_low = 0,
		low = 1,
		normal = 2,
		high = 3,
		very_high = 4
	}



	enum RequestError {
		bad_uri = 0,
		unsupported_uri_scheme = 1,
		parsing = 2,
		encoding = 3
	}



	enum RequesterError {
		bad_uri = 0,
		unsupported_uri_scheme = 1
	}



	enum SocketIOStatus {
		ok = 0,
		would_block = 1,
		eof = 2,
		error = 3
	}



	enum Status {
		none = 0,
		cancelled = 1,
		cant_resolve = 2,
		cant_resolve_proxy = 3,
		cant_connect = 4,
		cant_connect_proxy = 5,
		ssl_failed = 6,
		io_error = 7,
		malformed = 8,
		try_again = 9,
		too_many_redirects = 10,
		tls_failed = 11,
		continue = 100,
		switching_protocols = 101,
		processing = 102,
		ok = 200,
		created = 201,
		accepted = 202,
		non_authoritative = 203,
		no_content = 204,
		reset_content = 205,
		partial_content = 206,
		multi_status = 207,
		multiple_choices = 300,
		moved_permanently = 301,
		found = 302,
		moved_temporarily = 302,
		see_other = 303,
		not_modified = 304,
		use_proxy = 305,
		not_appearing_in_this_protocol = 306,
		temporary_redirect = 307,
		bad_request = 400,
		unauthorized = 401,
		payment_required = 402,
		forbidden = 403,
		not_found = 404,
		method_not_allowed = 405,
		not_acceptable = 406,
		proxy_authentication_required = 407,
		proxy_unauthorized = 407,
		request_timeout = 408,
		conflict = 409,
		gone = 410,
		length_required = 411,
		precondition_failed = 412,
		request_entity_too_large = 413,
		request_uri_too_long = 414,
		unsupported_media_type = 415,
		requested_range_not_satisfiable = 416,
		invalid_range = 416,
		expectation_failed = 417,
		unprocessable_entity = 422,
		locked = 423,
		failed_dependency = 424,
		internal_server_error = 500,
		not_implemented = 501,
		bad_gateway = 502,
		service_unavailable = 503,
		gateway_timeout = 504,
		http_version_not_supported = 505,
		insufficient_storage = 507,
		not_extended = 510
	}



	enum TLDError {
		invalid_hostname = 0,
		is_ip_address = 1,
		not_enough_domains = 2,
		no_base_domain = 3,
		no_psl_data = 4
	}



	enum WebsocketCloseCode {
		normal = 1000,
		going_away = 1001,
		protocol_error = 1002,
		unsupported_data = 1003,
		no_status = 1005,
		abnormal = 1006,
		bad_data = 1007,
		policy_violation = 1008,
		too_big = 1009,
		no_extension = 1010,
		server_error = 1011,
		tls_handshake = 1015
	}



	enum WebsocketConnectionType {
		unknown = 0,
		client = 1,
		server = 2
	}



	enum WebsocketDataType {
		text = 1,
		binary = 2
	}



	enum WebsocketError {
		failed = 0,
		not_websocket = 1,
		bad_handshake = 2,
		bad_origin = 3
	}



	enum WebsocketState {
		open = 1,
		closing = 2,
		closed = 3
	}



	enum XMLRPCError {
		arguments = 0,
		retval = 1
	}



	enum XMLRPCFault {
		parse_error_not_well_formed = -32700,
		parse_error_unsupported_encoding = -32701,
		parse_error_invalid_character_for_encoding = -32702,
		server_error_invalid_xml_rpc = -32600,
		server_error_requested_method_not_found = -32601,
		server_error_invalid_method_parameters = -32602,
		server_error_internal_xml_rpc_error = -32603,
		application_error = -32500,
		system_error = -32400,
		transport_error = -32300
	}



	enum Cacheability {
		cacheable = 1,
		uncacheable = 2,
		invalidates = 4,
		validates = 8
	}



	enum Expectation {
		unrecognized = 1,
		continue = 2
	}



	enum MessageFlags {
		no_redirect = 2,
		can_rebuild = 4,
		overwrite_chunks = 8,
		content_decoded = 16,
		certificate_trusted = 32,
		new_connection = 64,
		idempotent = 128,
		ignore_connection_limits = 256,
		do_not_use_auth_cache = 512
	}



	enum ServerListenOptions {
		https = 1,
		ipv4_only = 2,
		ipv6_only = 4
	}



	interface AddressCallback {
		(addr: Address, status: number, user_data: any): void;
	}



	interface AuthDomainBasicAuthCallback {
		(domain: AuthDomainBasic, msg: Message, username: string, password: string, user_data: any): boolean;
	}



	interface AuthDomainDigestAuthCallback {
		(domain: AuthDomainDigest, msg: Message, username: string, user_data: any): string;
	}



	interface AuthDomainFilter {
		(domain: AuthDomain, msg: Message, user_data: any): boolean;
	}



	interface AuthDomainGenericAuthCallback {
		(domain: AuthDomain, msg: Message, username: string, user_data: any): boolean;
	}



	interface ChunkAllocator {
		(msg: Message, max_len: number, user_data: any): Buffer;
	}



	interface LoggerFilter {
		(logger: Logger, msg: Message, user_data: any): LoggerLogLevel;
	}



	interface LoggerPrinter {
		(logger: Logger, level: LoggerLogLevel, direction: string, data: string, user_data: any): void;
	}



	interface MessageHeadersForeachFunc {
		(name: string, value: string, user_data: any): void;
	}



	interface PasswordManagerCallback {
		(password_manager: PasswordManager, msg: Message, auth: Auth, retrying: boolean, user_data: any): void;
	}



	interface ProxyResolverCallback {
		(proxy_resolver: ProxyResolver, msg: Message, _arg: number, addr: Address, user_data: any): void;
	}



	interface ProxyURIResolverCallback {
		(resolver: ProxyURIResolver, status: number, proxy_uri: URI, user_data: any): void;
	}



	interface ServerCallback {
		(server: Server, msg: Message, path: string, query: GLib.HashTable, client: ClientContext, user_data: any): void;
	}



	interface ServerWebsocketCallback {
		(server: Server, connection: WebsocketConnection, path: string, client: ClientContext, user_data: any): void;
	}



	interface SessionCallback {
		(session: Session, msg: Message, user_data: any): void;
	}



	interface SessionConnectProgressCallback {
		(session: Session, event: Gio.SocketClientEvent, connection: Gio.IOStream, user_data: any): void;
	}



	interface SocketCallback {
		(sock: Socket, status: number, user_data: any): void;
	}



	function add_completion(async_context: GLib.MainContext, _function: GLib.SourceFunc, data: any): GLib.Source;
	function add_idle(async_context: GLib.MainContext, _function: GLib.SourceFunc, data: any): GLib.Source;
	function add_io_watch(async_context: GLib.MainContext, chan: GLib.IOChannel, condition: GLib.IOCondition, _function: GLib.IOFunc, data: any): GLib.Source;
	function add_timeout(async_context: GLib.MainContext, interval: number, _function: GLib.SourceFunc, data: any): GLib.Source;
	function check_version(major: number, minor: number, micro: number): boolean;
	function cookie_parse(header: string, origin: URI): Cookie;
	function cookies_free(cookies: GLib.SList): void;
	function cookies_from_request(msg: Message): GLib.SList;
	function cookies_from_response(msg: Message): GLib.SList;
	function cookies_to_cookie_header(cookies: GLib.SList): string;
	function cookies_to_request(cookies: GLib.SList, msg: Message): void;
	function cookies_to_response(cookies: GLib.SList, msg: Message): void;
	function form_decode(encoded_form: string): GLib.HashTable;
	function form_decode_multipart(msg: Message, file_control_name: string, filename: string, content_type: string, file: Buffer): GLib.HashTable;
	function form_encode(first_field: string): string;
	function form_encode_datalist(form_data_set: GLib.Data): string;
	function form_encode_hash(form_data_set: GLib.HashTable): string;
	function form_encode_valist(first_field: string, args: any[]): string;
	function form_request_new(method: string, uri: string, first_field: string): Message;
	function form_request_new_from_datalist(method: string, uri: string, form_data_set: GLib.Data): Message;
	function form_request_new_from_hash(method: string, uri: string, form_data_set: GLib.HashTable): Message;
	function form_request_new_from_multipart(uri: string, multipart: Multipart): Message;
	function get_major_version(): number;
	function get_micro_version(): number;
	function get_minor_version(): number;
	function header_contains(header: string, token: string): boolean;
	function header_free_list(list: GLib.SList): void;
	function header_free_param_list(param_list: GLib.HashTable): void;
	function header_g_string_append_param(string: GLib.String, name: string, value: string): void;
	function header_g_string_append_param_quoted(string: GLib.String, name: string, value: string): void;
	function header_parse_list(header: string): GLib.SList;
	function header_parse_param_list(header: string): GLib.HashTable;
	function header_parse_param_list_strict(header: string): GLib.HashTable;
	function header_parse_quality_list(header: string, unacceptable: GLib.SList): GLib.SList;
	function header_parse_semi_param_list(header: string): GLib.HashTable;
	function header_parse_semi_param_list_strict(header: string): GLib.HashTable;
	function headers_parse(_str: string, len: number, dest: MessageHeaders): boolean;
	function headers_parse_request(_str: string, len: number, req_headers: MessageHeaders, req_method: string, req_path: string, ver: HTTPVersion): number;
	function headers_parse_response(_str: string, len: number, headers: MessageHeaders, ver: HTTPVersion, status_code: number, reason_phrase: string): boolean;
	function headers_parse_status_line(status_line: string, ver: HTTPVersion, status_code: number, reason_phrase: string): boolean;
	function http_error_quark(): GLib.Quark;
	function message_headers_iter_init(iter: MessageHeadersIter, hdrs: MessageHeaders): void;
	function request_error_quark(): GLib.Quark;
	function requester_error_quark(): GLib.Quark;
	function status_get_phrase(status_code: number): string;
	function status_proxify(status_code: number): number;
	function str_case_equal(v1: any, v2: any): boolean;
	function str_case_hash(key: any): number;
	function tld_domain_is_public_suffix(domain: string): boolean;
	function tld_error_quark(): GLib.Quark;
	function tld_get_base_domain(hostname: string): string;
	function uri_decode(part: string): string;
	function uri_encode(part: string, escape_extra: string): string;
	function uri_normalize(part: string, unescape_extra: string): string;
	function value_array_append(array: GObject.ValueArray, _type: GObject.Type): void;
	function value_array_append_vals(array: GObject.ValueArray, first_type: GObject.Type): void;
	function value_array_from_args(args: any[]): GObject.ValueArray;
	function value_array_get_nth(array: GObject.ValueArray, index_: number, _type: GObject.Type): boolean;
	function value_array_insert(array: GObject.ValueArray, index_: number, _type: GObject.Type): void;
	function value_array_new(): GObject.ValueArray;
	function value_array_new_with_vals(first_type: GObject.Type): GObject.ValueArray;
	function value_array_to_args(array: GObject.ValueArray, args: any[]): boolean;
	function value_hash_insert(hash: GLib.HashTable, key: string, _type: GObject.Type): void;
	function value_hash_insert_vals(hash: GLib.HashTable, first_key: string): void;
	function value_hash_insert_value(hash: GLib.HashTable, key: string, value: GObject.Value): void;
	function value_hash_lookup(hash: GLib.HashTable, key: string, _type: GObject.Type): boolean;
	function value_hash_lookup_vals(hash: GLib.HashTable, first_key: string): boolean;
	function value_hash_new(): GLib.HashTable;
	function value_hash_new_with_vals(first_key: string): GLib.HashTable;
	function websocket_client_prepare_handshake(msg: Message, origin: string, protocols: string[]): void;
	function websocket_client_verify_handshake(msg: Message): boolean;
	function websocket_error_get_quark(): GLib.Quark;
	function websocket_server_check_handshake(msg: Message, origin: string, protocols: string[]): boolean;
	function websocket_server_process_handshake(msg: Message, expected_origin: string, protocols: string[]): boolean;
	function xmlrpc_build_fault(fault_code: number, fault_format: string): string;
	function xmlrpc_build_method_call(method_name: string, params: GObject.Value[], n_params: number): string;
	function xmlrpc_build_method_response(value: GObject.Value): string;
	function xmlrpc_build_request(method_name: string, params: GLib.Variant): string;
	function xmlrpc_build_response(value: GLib.Variant): string;
	function xmlrpc_error_quark(): GLib.Quark;
	function xmlrpc_extract_method_call(method_call: string, length: number, method_name: string): boolean;
	function xmlrpc_extract_method_response(method_response: string, length: number, error: GLib.Error, _type: GObject.Type): boolean;
	function xmlrpc_fault_quark(): GLib.Quark;
	function xmlrpc_message_new(uri: string, method_name: string, params: GLib.Variant): Message;
	function xmlrpc_message_set_fault(msg: Message, fault_code: number, fault_format: string): void;
	function xmlrpc_message_set_response(msg: Message, value: GLib.Variant): boolean;
	function xmlrpc_parse_method_call(method_call: string, length: number, method_name: string, params: GObject.ValueArray): boolean;
	function xmlrpc_parse_method_response(method_response: string, length: number, value: GObject.Value): boolean;
	function xmlrpc_parse_request(method_call: string, length: number, params: XMLRPCParams): string;
	function xmlrpc_parse_response(method_response: string, length: number, signature: string): GLib.Variant;
	function xmlrpc_request_new(uri: string, method_name: string): Message;
	function xmlrpc_set_fault(msg: Message, fault_code: number, fault_format: string): void;
	function xmlrpc_set_response(msg: Message, _type: GObject.Type): void;
	function xmlrpc_variant_get_datetime(variant: GLib.Variant): Date;
	function xmlrpc_variant_new_datetime(date: Date): GLib.Variant;

}