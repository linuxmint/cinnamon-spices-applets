declare namespace imports.gi.Gio {

    interface AppInfoMonitor extends GObject.Object {
        
    }
    
    var AppInfoMonitor: {
        
        get () : AppInfoMonitor;
    }
    
    
    
    
    interface AppLaunchContext extends GObject.Object {
        get_display (info: AppInfo, files: GLib.List) : string;
        get_environment () : string[];
        get_startup_notify_id (info: AppInfo, files: GLib.List) : string;
        launch_failed (startup_notify_id: string) : void;
        setenv (variable: string, value: string) : void;
        unsetenv (variable: string) : void;
    }
    
    var AppLaunchContext: {
        new () : AppLaunchContext;
        
    }
    
    
    
    
    interface Application extends GObject.Object, ActionGroup, ActionMap {
        activate () : void;
        add_main_option (long_name: string, short_name: string, flags: GLib.OptionFlags, _arg: GLib.OptionArg, description: string, arg_description: string) : void;
        add_main_option_entries (entries: GLib.OptionEntry[]) : void;
        add_option_group (group: GLib.OptionGroup) : void;
        bind_busy_property (object: GObject.Object, property: string) : void;
        get_application_id () : string;
        get_dbus_connection () : DBusConnection;
        get_dbus_object_path () : string;
        get_flags () : ApplicationFlags;
        get_inactivity_timeout () : number;
        get_is_busy () : boolean;
        get_is_registered () : boolean;
        get_is_remote () : boolean;
        get_resource_base_path () : string;
        hold () : void;
        mark_busy () : void;
        open (files: File[], n_files: number, hint: string) : void;
        quit () : void;
        register (cancellable: Cancellable) : boolean;
        release () : void;
        run (argc: number, argv: string[]) : number;
        send_notification (_id: string, notification: Notification) : void;
        set_action_group (action_group: ActionGroup) : void;
        set_application_id (application_id: string) : void;
        set_default () : void;
        set_flags (flags: ApplicationFlags) : void;
        set_inactivity_timeout (inactivity_timeout: number) : void;
        set_option_context_description (description: string) : void;
        set_option_context_parameter_string (parameter_string: string) : void;
        set_option_context_summary (summary: string) : void;
        set_resource_base_path (resource_path: string) : void;
        unbind_busy_property (object: GObject.Object, property: string) : void;
        unmark_busy () : void;
        withdraw_notification (_id: string) : void;
    }
    
    var Application: {
        new (application_id: string, flags: ApplicationFlags) : Application;
        get_default () : Application;
        id_is_valid (application_id: string) : boolean;
    }
    
    
    
    
    interface ApplicationCommandLine extends GObject.Object {
        create_file_for_arg (_arg: string) : File;
        get_arguments (argc: number) : string[];
        get_cwd () : string;
        get_environ () : string[];
        get_exit_status () : number;
        get_is_remote () : boolean;
        get_options_dict () : GLib.VariantDict;
        get_platform_data () : GLib.Variant;
        get_stdin () : InputStream;
        getenv (name: string) : string;
        print (format: string) : void;
        printerr (format: string) : void;
        set_exit_status (exit_status: number) : void;
    }
    
    var ApplicationCommandLine: {
        
        
    }
    
    
    
    
    interface BufferedInputStream extends FilterInputStream, Seekable {
        fill (count: number, cancellable: Cancellable) : number;
        fill_async (count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        fill_finish (result: AsyncResult) : number;
        get_available () : number;
        get_buffer_size () : number;
        peek (buffer: number[], offset: number, count: number) : number;
        peek_buffer (count: number) : number[];
        read_byte (cancellable: Cancellable) : number;
        set_buffer_size (size: number) : void;
    }
    
    var BufferedInputStream: {
        new (base_stream: InputStream) : InputStream;
        new_sized (base_stream: InputStream, size: number) : InputStream;
        
    }
    
    
    
    
    interface BufferedOutputStream extends FilterOutputStream, Seekable {
        get_auto_grow () : boolean;
        get_buffer_size () : number;
        set_auto_grow (auto_grow: boolean) : void;
        set_buffer_size (size: number) : void;
    }
    
    var BufferedOutputStream: {
        new (base_stream: OutputStream) : OutputStream;
        new_sized (base_stream: OutputStream, size: number) : OutputStream;
        
    }
    
    
    
    
    interface BytesIcon extends GObject.Object, Icon, LoadableIcon {
        get_bytes () : GLib.Bytes;
    }
    
    var BytesIcon: {
        new (bytes: GLib.Bytes) : BytesIcon;
        
    }
    
    
    
    
    interface Cancellable extends GObject.Object {
        cancel () : void;
        connect (callback: GObject.Callback, data: any, data_destroy_func: GLib.DestroyNotify) : number;
        disconnect (handler_id: number) : void;
        get_fd () : number;
        is_cancelled () : boolean;
        make_pollfd (pollfd: GLib.PollFD) : boolean;
        pop_current () : void;
        push_current () : void;
        release_fd () : void;
        reset () : void;
        set_error_if_cancelled () : boolean;
        source_new () : GLib.Source;
    }
    
    var Cancellable: {
        new () : Cancellable;
        get_current () : Cancellable;
    }
    
    
    
    
    interface CharsetConverter extends GObject.Object, Converter, Initable {
        get_num_fallbacks () : number;
        get_use_fallback () : boolean;
        set_use_fallback (use_fallback: boolean) : void;
    }
    
    var CharsetConverter: {
        new (to_charset: string, from_charset: string) : CharsetConverter;
        
    }
    
    
    
    
    interface ConverterInputStream extends FilterInputStream, PollableInputStream {
        get_converter () : Converter;
    }
    
    var ConverterInputStream: {
        new (base_stream: InputStream, converter: Converter) : InputStream;
        
    }
    
    
    
    
    interface ConverterOutputStream extends FilterOutputStream, PollableOutputStream {
        get_converter () : Converter;
    }
    
    var ConverterOutputStream: {
        new (base_stream: OutputStream, converter: Converter) : OutputStream;
        
    }
    
    
    
    
    interface Credentials extends GObject.Object {
        get_native (native_type: CredentialsType) : any;
        get_unix_pid () : number;
        get_unix_user () : number;
        is_same_user (other_credentials: Credentials) : boolean;
        set_native (native_type: CredentialsType, _native: any) : void;
        set_unix_user (uid: number) : boolean;
        to_string () : string;
    }
    
    var Credentials: {
        new () : Credentials;
        
    }
    
    
    
    
    interface DBusActionGroup extends GObject.Object, ActionGroup, RemoteActionGroup {
        
    }
    
    var DBusActionGroup: {
        
        get (connection: DBusConnection, bus_name: string, object_path: string) : DBusActionGroup;
    }
    
    
    
    
    interface DBusAuthObserver extends GObject.Object {
        allow_mechanism (mechanism: string) : boolean;
        authorize_authenticated_peer (stream: IOStream, credentials: Credentials) : boolean;
    }
    
    var DBusAuthObserver: {
        new () : DBusAuthObserver;
        
    }
    
    
    
    
    interface DBusConnection extends GObject.Object, AsyncInitable, Initable {
        add_filter (filter_function: DBusMessageFilterFunction, user_data: any, user_data_free_func: GLib.DestroyNotify) : number;
        call (bus_name: string, object_path: string, interface_name: string, method_name: string, parameters: GLib.Variant, reply_type: GLib.VariantType, flags: DBusCallFlags, timeout_msec: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        call_finish (res: AsyncResult) : GLib.Variant;
        call_sync (bus_name: string, object_path: string, interface_name: string, method_name: string, parameters: GLib.Variant, reply_type: GLib.VariantType, flags: DBusCallFlags, timeout_msec: number, cancellable: Cancellable) : GLib.Variant;
        call_with_unix_fd_list (bus_name: string, object_path: string, interface_name: string, method_name: string, parameters: GLib.Variant, reply_type: GLib.VariantType, flags: DBusCallFlags, timeout_msec: number, fd_list: UnixFDList, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        call_with_unix_fd_list_finish (out_fd_list: UnixFDList, res: AsyncResult) : GLib.Variant;
        call_with_unix_fd_list_sync (bus_name: string, object_path: string, interface_name: string, method_name: string, parameters: GLib.Variant, reply_type: GLib.VariantType, flags: DBusCallFlags, timeout_msec: number, fd_list: UnixFDList, out_fd_list: UnixFDList, cancellable: Cancellable) : GLib.Variant;
        close (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        close_finish (res: AsyncResult) : boolean;
        close_sync (cancellable: Cancellable) : boolean;
        emit_signal (destination_bus_name: string, object_path: string, interface_name: string, signal_name: string, parameters: GLib.Variant) : boolean;
        export_action_group (object_path: string, action_group: ActionGroup) : number;
        export_menu_model (object_path: string, menu: MenuModel) : number;
        flush (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        flush_finish (res: AsyncResult) : boolean;
        flush_sync (cancellable: Cancellable) : boolean;
        get_capabilities () : DBusCapabilityFlags;
        get_exit_on_close () : boolean;
        get_flags () : DBusConnectionFlags;
        get_guid () : string;
        get_last_serial () : number;
        get_peer_credentials () : Credentials;
        get_stream () : IOStream;
        get_unique_name () : string;
        is_closed () : boolean;
        register_object (object_path: string, interface_info: DBusInterfaceInfo, vtable: DBusInterfaceVTable, user_data: any, user_data_free_func: GLib.DestroyNotify) : number;
        register_object_with_closures (object_path: string, interface_info: DBusInterfaceInfo, method_call_closure: GObject.Closure, get_property_closure: GObject.Closure, set_property_closure: GObject.Closure) : number;
        register_subtree (object_path: string, vtable: DBusSubtreeVTable, flags: DBusSubtreeFlags, user_data: any, user_data_free_func: GLib.DestroyNotify) : number;
        remove_filter (filter_id: number) : void;
        send_message (message: DBusMessage, flags: DBusSendMessageFlags, out_serial: number) : boolean;
        send_message_with_reply (message: DBusMessage, flags: DBusSendMessageFlags, timeout_msec: number, out_serial: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        send_message_with_reply_finish (res: AsyncResult) : DBusMessage;
        send_message_with_reply_sync (message: DBusMessage, flags: DBusSendMessageFlags, timeout_msec: number, out_serial: number, cancellable: Cancellable) : DBusMessage;
        set_exit_on_close (exit_on_close: boolean) : void;
        signal_subscribe (sender: string, interface_name: string, member: string, object_path: string, arg0: string, flags: DBusSignalFlags, callback: DBusSignalCallback, user_data: any, user_data_free_func: GLib.DestroyNotify) : number;
        signal_unsubscribe (subscription_id: number) : void;
        start_message_processing () : void;
        unexport_action_group (export_id: number) : void;
        unexport_menu_model (export_id: number) : void;
        unregister_object (registration_id: number) : boolean;
        unregister_subtree (registration_id: number) : boolean;
    }
    
    var DBusConnection: {
        new_finish (res: AsyncResult) : DBusConnection;
        new_for_address_finish (res: AsyncResult) : DBusConnection;
        new_for_address_sync (address: string, flags: DBusConnectionFlags, observer: DBusAuthObserver, cancellable: Cancellable) : DBusConnection;
        new_sync (stream: IOStream, guid: string, flags: DBusConnectionFlags, observer: DBusAuthObserver, cancellable: Cancellable) : DBusConnection;
        new (stream: IOStream, guid: string, flags: DBusConnectionFlags, observer: DBusAuthObserver, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        new_for_address (address: string, flags: DBusConnectionFlags, observer: DBusAuthObserver, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
    }
    
    
    
    
    interface DBusInterfaceSkeleton extends GObject.Object, DBusInterface {
        export (connection: DBusConnection, object_path: string) : boolean;
        flush () : void;
        get_connection () : DBusConnection;
        get_connections () : GLib.List;
        get_flags () : DBusInterfaceSkeletonFlags;
        get_info () : DBusInterfaceInfo;
        get_object_path () : string;
        get_properties () : GLib.Variant;
        get_vtable () : DBusInterfaceVTable;
        has_connection (connection: DBusConnection) : boolean;
        set_flags (flags: DBusInterfaceSkeletonFlags) : void;
        unexport () : void;
        unexport_from_connection (connection: DBusConnection) : void;
    }
    
    var DBusInterfaceSkeleton: {
        
        
    }
    
    
    
    
    interface DBusMenuModel extends MenuModel {
        
    }
    
    var DBusMenuModel: {
        
        get (connection: DBusConnection, bus_name: string, object_path: string) : DBusMenuModel;
    }
    
    
    
    
    interface DBusMessage extends GObject.Object {
        copy () : DBusMessage;
        get_arg0 () : string;
        get_body () : GLib.Variant;
        get_byte_order () : DBusMessageByteOrder;
        get_destination () : string;
        get_error_name () : string;
        get_flags () : DBusMessageFlags;
        get_header (header_field: DBusMessageHeaderField) : GLib.Variant;
        get_header_fields () : number[];
        get_interface () : string;
        get_locked () : boolean;
        get_member () : string;
        get_message_type () : DBusMessageType;
        get_num_unix_fds () : number;
        get_path () : string;
        get_reply_serial () : number;
        get_sender () : string;
        get_serial () : number;
        get_signature () : string;
        get_unix_fd_list () : UnixFDList;
        lock () : void;
        new_method_error (error_name: string, error_message_format: string) : DBusMessage;
        new_method_error_literal (error_name: string, error_message: string) : DBusMessage;
        new_method_error_valist (error_name: string, error_message_format: string, var_args: any[]) : DBusMessage;
        new_method_reply () : DBusMessage;
        print (indent: number) : string;
        set_body (body: GLib.Variant) : void;
        set_byte_order (byte_order: DBusMessageByteOrder) : void;
        set_destination (value: string) : void;
        set_error_name (value: string) : void;
        set_flags (flags: DBusMessageFlags) : void;
        set_header (header_field: DBusMessageHeaderField, value: GLib.Variant) : void;
        set_interface (value: string) : void;
        set_member (value: string) : void;
        set_message_type (_type: DBusMessageType) : void;
        set_num_unix_fds (value: number) : void;
        set_path (value: string) : void;
        set_reply_serial (value: number) : void;
        set_sender (value: string) : void;
        set_serial (serial: number) : void;
        set_signature (value: string) : void;
        set_unix_fd_list (fd_list: UnixFDList) : void;
        to_blob (out_size: number, capabilities: DBusCapabilityFlags) : number[];
        to_gerror () : boolean;
    }
    
    var DBusMessage: {
        new () : DBusMessage;
        new_from_blob (blob: number[], blob_len: number, capabilities: DBusCapabilityFlags) : DBusMessage;
        new_method_call (name: string, path: string, interface_: string, method: string) : DBusMessage;
        new_signal (path: string, interface_: string, signal: string) : DBusMessage;
        bytes_needed (blob: number[], blob_len: number) : number;
    }
    
    
    
    
    interface DBusMethodInvocation extends GObject.Object {
        get_connection () : DBusConnection;
        get_interface_name () : string;
        get_message () : DBusMessage;
        get_method_info () : DBusMethodInfo;
        get_method_name () : string;
        get_object_path () : string;
        get_parameters () : GLib.Variant;
        get_property_info () : DBusPropertyInfo;
        get_sender () : string;
        get_user_data () : any;
        return_dbus_error (error_name: string, error_message: string) : void;
        return_error (domain: GLib.Quark, code: number, format: string) : void;
        return_error_literal (domain: GLib.Quark, code: number, message: string) : void;
        return_error_valist (domain: GLib.Quark, code: number, format: string, var_args: any[]) : void;
        return_gerror (error: GLib.Error) : void;
        return_value (parameters: GLib.Variant) : void;
        return_value_with_unix_fd_list (parameters: GLib.Variant, fd_list: UnixFDList) : void;
        take_error (error: GLib.Error) : void;
    }
    
    var DBusMethodInvocation: {
        
        
    }
    
    
    
    
    interface DBusObjectManagerClient extends GObject.Object, AsyncInitable, DBusObjectManager, Initable {
        get_connection () : DBusConnection;
        get_flags () : DBusObjectManagerClientFlags;
        get_name () : string;
        get_name_owner () : string;
    }
    
    var DBusObjectManagerClient: {
        new_finish (res: AsyncResult) : DBusObjectManagerClient;
        new_for_bus_finish (res: AsyncResult) : DBusObjectManagerClient;
        new_for_bus_sync (bus_type: BusType, flags: DBusObjectManagerClientFlags, name: string, object_path: string, get_proxy_type_func: DBusProxyTypeFunc, get_proxy_type_user_data: any, get_proxy_type_destroy_notify: GLib.DestroyNotify, cancellable: Cancellable) : DBusObjectManagerClient;
        new_sync (connection: DBusConnection, flags: DBusObjectManagerClientFlags, name: string, object_path: string, get_proxy_type_func: DBusProxyTypeFunc, get_proxy_type_user_data: any, get_proxy_type_destroy_notify: GLib.DestroyNotify, cancellable: Cancellable) : DBusObjectManagerClient;
        new (connection: DBusConnection, flags: DBusObjectManagerClientFlags, name: string, object_path: string, get_proxy_type_func: DBusProxyTypeFunc, get_proxy_type_user_data: any, get_proxy_type_destroy_notify: GLib.DestroyNotify, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        new_for_bus (bus_type: BusType, flags: DBusObjectManagerClientFlags, name: string, object_path: string, get_proxy_type_func: DBusProxyTypeFunc, get_proxy_type_user_data: any, get_proxy_type_destroy_notify: GLib.DestroyNotify, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
    }
    
    
    
    
    interface DBusObjectManagerServer extends GObject.Object, DBusObjectManager {
        export (object: DBusObjectSkeleton) : void;
        export_uniquely (object: DBusObjectSkeleton) : void;
        get_connection () : DBusConnection;
        is_exported (object: DBusObjectSkeleton) : boolean;
        set_connection (connection: DBusConnection) : void;
        unexport (object_path: string) : boolean;
    }
    
    var DBusObjectManagerServer: {
        new (object_path: string) : DBusObjectManagerServer;
        
    }
    
    
    
    
    interface DBusObjectProxy extends GObject.Object, DBusObject {
        get_connection () : DBusConnection;
    }
    
    var DBusObjectProxy: {
        new (connection: DBusConnection, object_path: string) : DBusObjectProxy;
        
    }
    
    
    
    
    interface DBusObjectSkeleton extends GObject.Object, DBusObject {
        add_interface (interface_: DBusInterfaceSkeleton) : void;
        flush () : void;
        remove_interface (interface_: DBusInterfaceSkeleton) : void;
        remove_interface_by_name (interface_name: string) : void;
        set_object_path (object_path: string) : void;
    }
    
    var DBusObjectSkeleton: {
        new (object_path: string) : DBusObjectSkeleton;
        
    }
    
    
    
    
    interface DBusProxy extends GObject.Object, AsyncInitable, DBusInterface, Initable {
        call (method_name: string, parameters: GLib.Variant, flags: DBusCallFlags, timeout_msec: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        call_finish (res: AsyncResult) : GLib.Variant;
        call_sync (method_name: string, parameters: GLib.Variant, flags: DBusCallFlags, timeout_msec: number, cancellable: Cancellable) : GLib.Variant;
        call_with_unix_fd_list (method_name: string, parameters: GLib.Variant, flags: DBusCallFlags, timeout_msec: number, fd_list: UnixFDList, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        call_with_unix_fd_list_finish (out_fd_list: UnixFDList, res: AsyncResult) : GLib.Variant;
        call_with_unix_fd_list_sync (method_name: string, parameters: GLib.Variant, flags: DBusCallFlags, timeout_msec: number, fd_list: UnixFDList, out_fd_list: UnixFDList, cancellable: Cancellable) : GLib.Variant;
        disconnectSignal(id: number): void; 
        get_cached_property (property_name: string) : GLib.Variant;
        get_cached_property_names () : string[];
        get_connection () : DBusConnection;
        get_default_timeout () : number;
        get_flags () : DBusProxyFlags;
        get_interface_info () : DBusInterfaceInfo;
        get_interface_name () : string;
        get_name () : string;
        get_name_owner () : string;
        get_object_path () : string;
        set_cached_property (property_name: string, value: GLib.Variant) : void;
        set_default_timeout (timeout_msec: number) : void;
        set_interface_info (info: DBusInterfaceInfo) : void;
    }
    
    var DBusProxy: {
        new_finish (res: AsyncResult) : DBusProxy;
        new_for_bus_finish (res: AsyncResult) : DBusProxy;
        new_for_bus_sync (bus_type: BusType, flags: DBusProxyFlags, info: DBusInterfaceInfo, name: string, object_path: string, interface_name: string, cancellable: Cancellable) : DBusProxy;
        new_sync (connection: DBusConnection, flags: DBusProxyFlags, info: DBusInterfaceInfo, name: string, object_path: string, interface_name: string, cancellable: Cancellable) : DBusProxy;
        new (connection: DBusConnection, flags: DBusProxyFlags, info: DBusInterfaceInfo, name: string, object_path: string, interface_name: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        new_for_bus (bus_type: BusType, flags: DBusProxyFlags, info: DBusInterfaceInfo, name: string, object_path: string, interface_name: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
    }
    
    
    
    
    interface DBusServer extends GObject.Object, Initable {
        get_client_address () : string;
        get_flags () : DBusServerFlags;
        get_guid () : string;
        is_active () : boolean;
        start () : void;
        stop () : void;
    }
    
    var DBusServer: {
        new_sync (address: string, flags: DBusServerFlags, guid: string, observer: DBusAuthObserver, cancellable: Cancellable) : DBusServer;
        
    }
    
    
    
    
    interface DataInputStream extends BufferedInputStream, Seekable {
        get_byte_order () : DataStreamByteOrder;
        get_newline_type () : DataStreamNewlineType;
        read_byte (cancellable: Cancellable) : number;
        read_int16 (cancellable: Cancellable) : number;
        read_int32 (cancellable: Cancellable) : number;
        read_int64 (cancellable: Cancellable) : number;
        read_line (length: number, cancellable: Cancellable) : number[];
        read_line_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        read_line_finish (result: AsyncResult, length: number) : number[];
        read_line_finish_utf8 (result: AsyncResult, length: number) : string;
        read_line_utf8 (length: number, cancellable: Cancellable) : string;
        read_uint16 (cancellable: Cancellable) : number;
        read_uint32 (cancellable: Cancellable) : number;
        read_uint64 (cancellable: Cancellable) : number;
        read_until (stop_chars: string, length: number, cancellable: Cancellable) : string;
        read_until_async (stop_chars: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        read_until_finish (result: AsyncResult, length: number) : string;
        read_upto (stop_chars: string, stop_chars_len: number, length: number, cancellable: Cancellable) : string;
        read_upto_async (stop_chars: string, stop_chars_len: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        read_upto_finish (result: AsyncResult, length: number) : string;
        set_byte_order (order: DataStreamByteOrder) : void;
        set_newline_type (_type: DataStreamNewlineType) : void;
    }
    
    var DataInputStream: {
        new (base_stream: InputStream) : DataInputStream;
        
    }
    
    
    
    
    interface DataOutputStream extends FilterOutputStream, Seekable {
        get_byte_order () : DataStreamByteOrder;
        put_byte (data: number, cancellable: Cancellable) : boolean;
        put_int16 (data: number, cancellable: Cancellable) : boolean;
        put_int32 (data: number, cancellable: Cancellable) : boolean;
        put_int64 (data: number, cancellable: Cancellable) : boolean;
        put_string (_str: string, cancellable: Cancellable) : boolean;
        put_uint16 (data: number, cancellable: Cancellable) : boolean;
        put_uint32 (data: number, cancellable: Cancellable) : boolean;
        put_uint64 (data: number, cancellable: Cancellable) : boolean;
        set_byte_order (order: DataStreamByteOrder) : void;
    }
    
    var DataOutputStream: {
        new (base_stream: OutputStream) : DataOutputStream;
        
    }
    
    
    
    
    interface DesktopAppInfo extends GObject.Object, AppInfo {
        get_action_name (action_name: string) : string;
        get_boolean (key: string) : boolean;
        get_categories () : string;
        get_filename () : string;
        get_generic_name () : string;
        get_is_hidden () : boolean;
        get_keywords () : string[];
        get_locale_string (key: string) : string;
        get_nodisplay () : boolean;
        get_show_in (desktop_env: string) : boolean;
        get_startup_wm_class () : string;
        get_string (key: string) : string;
        get_string_list (key: string, length: number) : string[];
        has_key (key: string) : boolean;
        launch_action (action_name: string, launch_context: AppLaunchContext) : void;
        launch_uris_as_manager (uris: GLib.List, launch_context: AppLaunchContext, spawn_flags: GLib.SpawnFlags, user_setup: GLib.SpawnChildSetupFunc, user_setup_data: any, pid_callback: DesktopAppLaunchCallback, pid_callback_data: any) : boolean;
        launch_uris_as_manager_with_fds (uris: GLib.List, launch_context: AppLaunchContext, spawn_flags: GLib.SpawnFlags, user_setup: GLib.SpawnChildSetupFunc, user_setup_data: any, pid_callback: DesktopAppLaunchCallback, pid_callback_data: any, stdin_fd: number, stdout_fd: number, stderr_fd: number) : boolean;
        list_actions () : string[];
    }
    
    var DesktopAppInfo: {
        new (desktop_id: string) : DesktopAppInfo;
        new_from_filename (filename: string) : DesktopAppInfo;
        new_from_keyfile (key_file: GLib.KeyFile) : DesktopAppInfo;
        get_implementations (_interface: string) : GLib.List;
        search (search_string: string) : any;
        set_desktop_env (desktop_env: string) : void;
    }
    
    
    
    
    interface Emblem extends GObject.Object, Icon {
        get_icon () : Icon;
        get_origin () : EmblemOrigin;
    }
    
    var Emblem: {
        new (icon: Icon) : Emblem;
        new_with_origin (icon: Icon, origin: EmblemOrigin) : Emblem;
        
    }
    
    
    
    
    interface EmblemedIcon extends GObject.Object, Icon {
        add_emblem (emblem: Emblem) : void;
        clear_emblems () : void;
        get_emblems () : GLib.List;
        get_icon () : Icon;
    }
    
    var EmblemedIcon: {
        new (icon: Icon, emblem: Emblem) : EmblemedIcon;
        
    }
    
    
    
    
    interface FileEnumerator extends GObject.Object {
        close (cancellable: Cancellable) : boolean;
        close_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        close_finish (result: AsyncResult) : boolean;
        get_child (info: FileInfo) : File;
        get_container () : File;
        has_pending () : boolean;
        is_closed () : boolean;
        iterate (out_info: FileInfo, out_child: File, cancellable: Cancellable) : boolean;
        next_file (cancellable: Cancellable) : FileInfo;
        next_files_async (num_files: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        next_files_finish (result: AsyncResult) : GLib.List;
        set_pending (pending: boolean) : void;
    }
    
    var FileEnumerator: {
        
        
    }
    
    
    
    
    interface FileIOStream extends IOStream, Seekable {
        get_etag () : string;
        query_info (attributes: string, cancellable: Cancellable) : FileInfo;
        query_info_async (attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        query_info_finish (result: AsyncResult) : FileInfo;
    }
    
    var FileIOStream: {
        
        
    }
    
    
    
    
    interface FileIcon extends GObject.Object, Icon, LoadableIcon {
        get_file () : File;
    }
    
    class FileIcon {
        static new (file: File) : FileIcon;
		constructor(options?: {file?: File});
        
    }
    
    
    
    
    interface FileInfo extends GObject.Object {
        clear_status () : void;
        copy_into (dest_info: FileInfo) : void;
        dup () : FileInfo;
        get_attribute_as_string (attribute: string) : string;
        get_attribute_boolean (attribute: string) : boolean;
        get_attribute_byte_string (attribute: string) : string;
        get_attribute_data (attribute: string, _type: FileAttributeType, value_pp: any, status: FileAttributeStatus) : boolean;
        get_attribute_int32 (attribute: string) : number;
        get_attribute_int64 (attribute: string) : number;
        get_attribute_object (attribute: string) : GObject.Object;
        get_attribute_status (attribute: string) : FileAttributeStatus;
        get_attribute_string (attribute: string) : string;
        get_attribute_stringv (attribute: string) : string[];
        get_attribute_type (attribute: string) : FileAttributeType;
        get_attribute_uint32 (attribute: string) : number;
        get_attribute_uint64 (attribute: string) : number;
        get_content_type () : string;
        get_deletion_date () : GLib.DateTime;
        get_display_name () : string;
        get_edit_name () : string;
        get_etag () : string;
        get_file_type () : FileType;
        get_icon () : Icon;
        get_is_backup () : boolean;
        get_is_hidden () : boolean;
        get_is_symlink () : boolean;
        get_modification_time (result: GLib.TimeVal) : void;
        get_name () : string;
        get_size () : number;
        get_sort_order () : number;
        get_symbolic_icon () : Icon;
        get_symlink_target () : string;
        has_attribute (attribute: string) : boolean;
        has_namespace (name_space: string) : boolean;
        list_attributes (name_space: string) : string[];
        remove_attribute (attribute: string) : void;
        set_attribute (attribute: string, _type: FileAttributeType, value_p: any) : void;
        set_attribute_boolean (attribute: string, attr_value: boolean) : void;
        set_attribute_byte_string (attribute: string, attr_value: string) : void;
        set_attribute_int32 (attribute: string, attr_value: number) : void;
        set_attribute_int64 (attribute: string, attr_value: number) : void;
        set_attribute_mask (mask: FileAttributeMatcher) : void;
        set_attribute_object (attribute: string, attr_value: GObject.Object) : void;
        set_attribute_status (attribute: string, status: FileAttributeStatus) : boolean;
        set_attribute_string (attribute: string, attr_value: string) : void;
        set_attribute_stringv (attribute: string, attr_value: string[]) : void;
        set_attribute_uint32 (attribute: string, attr_value: number) : void;
        set_attribute_uint64 (attribute: string, attr_value: number) : void;
        set_content_type (content_type: string) : void;
        set_display_name (display_name: string) : void;
        set_edit_name (edit_name: string) : void;
        set_file_type (_type: FileType) : void;
        set_icon (icon: Icon) : void;
        set_is_hidden (is_hidden: boolean) : void;
        set_is_symlink (is_symlink: boolean) : void;
        set_modification_time (mtime: GLib.TimeVal) : void;
        set_name (name: string) : void;
        set_size (size: number) : void;
        set_sort_order (sort_order: number) : void;
        set_symbolic_icon (icon: Icon) : void;
        set_symlink_target (symlink_target: string) : void;
        unset_attribute_mask () : void;
    }
    
    var FileInfo: {
        new () : FileInfo;
        
    }
    
    
    
    
    interface FileInputStream extends InputStream, Seekable {
        query_info (attributes: string, cancellable: Cancellable) : FileInfo;
        query_info_async (attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        query_info_finish (result: AsyncResult) : FileInfo;
    }
    
    var FileInputStream: {
        
        
    }
    
    
    
    
    interface FileMonitor extends GObject.Object {
        cancel () : boolean;
        emit_event (child: File, other_file: File, event_type: FileMonitorEvent) : void;
        is_cancelled () : boolean;
        set_rate_limit (limit_msecs: number) : void;
    }
    
    var FileMonitor: {
        
        
    }
    
    
    
    
    interface FileOutputStream extends OutputStream, Seekable {
        get_etag () : string;
        query_info (attributes: string, cancellable: Cancellable) : FileInfo;
        query_info_async (attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        query_info_finish (result: AsyncResult) : FileInfo;
    }
    
    var FileOutputStream: {
        
        
    }
    
    
    
    
    interface FilenameCompleter extends GObject.Object {
        get_completion_suffix (initial_text: string) : string;
        get_completions (initial_text: string) : string[];
        set_dirs_only (dirs_only: boolean) : void;
    }
    
    var FilenameCompleter: {
        new () : FilenameCompleter;
        
    }
    
    
    
    
    interface FilterInputStream extends InputStream {
        get_base_stream () : InputStream;
        get_close_base_stream () : boolean;
        set_close_base_stream (close_base: boolean) : void;
    }
    
    var FilterInputStream: {
        
        
    }
    
    
    
    
    interface FilterOutputStream extends OutputStream {
        get_base_stream () : OutputStream;
        get_close_base_stream () : boolean;
        set_close_base_stream (close_base: boolean) : void;
    }
    
    var FilterOutputStream: {
        
        
    }
    
    
    
    
    interface IOModule extends GObject.TypeModule, GObject.TypePlugin {
        load () : void;
        unload () : void;
    }
    
    var IOModule: {
        new (filename: string) : IOModule;
        query () : string[];
    }
    
    
    
    
    class IOStream extends GObject.Object {
        clear_pending () : void;
        close (cancellable: Cancellable) : boolean;
        close_async (io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        close_finish (result: AsyncResult) : boolean;
        get_input_stream () : InputStream;
        get_output_stream () : OutputStream;
        has_pending () : boolean;
        is_closed () : boolean;
        set_pending () : boolean;
		splice_async (stream2: IOStream, flags: IOStreamSpliceFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
		static splice_finish (result: AsyncResult) : boolean;
    }
    
    
    
    interface InetAddress extends GObject.Object {
        equal (other_address: InetAddress) : boolean;
        get_family () : SocketFamily;
        get_is_any () : boolean;
        get_is_link_local () : boolean;
        get_is_loopback () : boolean;
        get_is_mc_global () : boolean;
        get_is_mc_link_local () : boolean;
        get_is_mc_node_local () : boolean;
        get_is_mc_org_local () : boolean;
        get_is_mc_site_local () : boolean;
        get_is_multicast () : boolean;
        get_is_site_local () : boolean;
        get_native_size () : number;
        to_bytes () : number;
        to_string () : string;
    }
    
    var InetAddress: {
        new_any (family: SocketFamily) : InetAddress;
        new_from_bytes (bytes: number[], family: SocketFamily) : InetAddress;
        new_from_string (string: string) : InetAddress;
        new_loopback (family: SocketFamily) : InetAddress;
        
    }
    
    
    
    
    interface InetAddressMask extends GObject.Object, Initable {
        equal (mask2: InetAddressMask) : boolean;
        get_address () : InetAddress;
        get_family () : SocketFamily;
        get_length () : number;
        matches (address: InetAddress) : boolean;
        to_string () : string;
    }
    
    var InetAddressMask: {
        new (addr: InetAddress, length: number) : InetAddressMask;
        new_from_string (mask_string: string) : InetAddressMask;
        
    }
    
    
    
    
    interface InetSocketAddress extends SocketAddress, SocketConnectable {
        get_address () : InetAddress;
        get_flowinfo () : number;
        get_port () : number;
        get_scope_id () : number;
    }
    
    var InetSocketAddress: {
        new (address: InetAddress, _port: number) : SocketAddress;
        new_from_string (address: string, _port: number) : SocketAddress;
        
    }
    
    
    
    
    interface InputStream extends GObject.Object {
        clear_pending () : void;
        close (cancellable: Cancellable) : boolean;
        close_async (io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        close_finish (result: AsyncResult) : boolean;
        has_pending () : boolean;
        is_closed () : boolean;
        read (buffer: number[], count: number, cancellable: Cancellable) : number;
        read_all (buffer: number[], count: number, bytes_read: number, cancellable: Cancellable) : boolean;
        read_all_async (buffer: number[], count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        read_all_finish (result: AsyncResult, bytes_read: number) : boolean;
        read_async (buffer: number[], count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        read_bytes (count: number, cancellable: Cancellable) : GLib.Bytes;
        read_bytes_async (count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        read_bytes_finish (result: AsyncResult) : GLib.Bytes;
        read_finish (result: AsyncResult) : number;
        set_pending () : boolean;
        skip (count: number, cancellable: Cancellable) : number;
        skip_async (count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        skip_finish (result: AsyncResult) : number;
    }
    
    var InputStream: {
        
        
    }
    
    
    
    
    interface ListStore extends GObject.Object, ListModel {
        append (item: GObject.Object) : void;
        insert (position: number, item: GObject.Object) : void;
        insert_sorted (item: GObject.Object, compare_func: GLib.CompareDataFunc, user_data: any) : number;
        remove (position: number) : void;
        remove_all () : void;
        sort (compare_func: GLib.CompareDataFunc, user_data: any) : void;
        splice (position: number, n_removals: number, additions: GObject.Object[], n_additions: number) : void;
    }
    
    var ListStore: {
        new (item_type: GObject.Type) : ListStore;
        
    }
    
    
    
    
    interface MemoryInputStream extends InputStream, PollableInputStream, Seekable {
        add_bytes (bytes: GLib.Bytes) : void;
        add_data (data: number[], len: number, destroy: GLib.DestroyNotify) : void;
    }
    
    var MemoryInputStream: {
        new () : InputStream;
        new_from_bytes (bytes: GLib.Bytes) : InputStream;
        new_from_data (data: number[], len: number, destroy: GLib.DestroyNotify) : InputStream;
        
    }
    
    
    
    
    interface MemoryOutputStream extends OutputStream, PollableOutputStream, Seekable {
        get_data () : any;
        get_data_size () : number;
        get_size () : number;
        steal_as_bytes () : GLib.Bytes;
        steal_data () : any;
    }
    
    var MemoryOutputStream: {
        new (data: any, size: number, realloc_function: ReallocFunc, destroy_function: GLib.DestroyNotify) : OutputStream;
        new_resizable () : OutputStream;
        
    }
    
    
    
    
    interface Menu extends MenuModel {
        append (label: string, detailed_action: string) : void;
        append_item (item: MenuItem) : void;
        append_section (label: string, section: MenuModel) : void;
        append_submenu (label: string, submenu: MenuModel) : void;
        freeze () : void;
        insert (position: number, label: string, detailed_action: string) : void;
        insert_item (position: number, item: MenuItem) : void;
        insert_section (position: number, label: string, section: MenuModel) : void;
        insert_submenu (position: number, label: string, submenu: MenuModel) : void;
        prepend (label: string, detailed_action: string) : void;
        prepend_item (item: MenuItem) : void;
        prepend_section (label: string, section: MenuModel) : void;
        prepend_submenu (label: string, submenu: MenuModel) : void;
        remove (position: number) : void;
        remove_all () : void;
    }
    
    var Menu: {
        new () : Menu;
        
    }
    
    
    
    
    interface MenuAttributeIter extends GObject.Object {
        get_name () : string;
        get_next (out_name: string, value: GLib.Variant) : boolean;
        get_value () : GLib.Variant;
        next () : boolean;
    }
    
    var MenuAttributeIter: {
        
        
    }
    
    
    
    
    interface MenuItem extends GObject.Object {
        get_attribute (attribute: string, format_string: string) : boolean;
        get_attribute_value (attribute: string, expected_type: GLib.VariantType) : GLib.Variant;
        get_link (link: string) : MenuModel;
        set_action_and_target (action: string, format_string: string) : void;
        set_action_and_target_value (action: string, target_value: GLib.Variant) : void;
        set_attribute (attribute: string, format_string: string) : void;
        set_attribute_value (attribute: string, value: GLib.Variant) : void;
        set_detailed_action (detailed_action: string) : void;
        set_icon (icon: Icon) : void;
        set_label (label: string) : void;
        set_link (link: string, model: MenuModel) : void;
        set_section (section: MenuModel) : void;
        set_submenu (submenu: MenuModel) : void;
    }
    
    var MenuItem: {
        new (label: string, detailed_action: string) : MenuItem;
        new_from_model (model: MenuModel, item_index: number) : MenuItem;
        new_section (label: string, section: MenuModel) : MenuItem;
        new_submenu (label: string, submenu: MenuModel) : MenuItem;
        
    }
    
    
    
    
    interface MenuLinkIter extends GObject.Object {
        get_name () : string;
        get_next (out_link: string, value: MenuModel) : boolean;
        get_value () : MenuModel;
        next () : boolean;
    }
    
    var MenuLinkIter: {
        
        
    }
    
    
    
    
    interface MenuModel extends GObject.Object {
        get_item_attribute (item_index: number, attribute: string, format_string: string) : boolean;
        get_item_attribute_value (item_index: number, attribute: string, expected_type: GLib.VariantType) : GLib.Variant;
        get_item_link (item_index: number, link: string) : MenuModel;
        get_n_items () : number;
        is_mutable () : boolean;
        items_changed (position: number, removed: number, added: number) : void;
        iterate_item_attributes (item_index: number) : MenuAttributeIter;
        iterate_item_links (item_index: number) : MenuLinkIter;
    }
    
    var MenuModel: {
        
        
    }
    
    
    
    
    interface MountOperation extends GObject.Object {
        get_anonymous () : boolean;
        get_choice () : number;
        get_domain () : string;
        get_is_tcrypt_hidden_volume () : boolean;
        get_is_tcrypt_system_volume () : boolean;
        get_password () : string;
        get_password_save () : PasswordSave;
        get_pim () : number;
        get_username () : string;
        reply (result: MountOperationResult) : void;
        set_anonymous (anonymous: boolean) : void;
        set_choice (choice: number) : void;
        set_domain (domain: string) : void;
        set_is_tcrypt_hidden_volume (hidden_volume: boolean) : void;
        set_is_tcrypt_system_volume (system_volume: boolean) : void;
        set_password (password: string) : void;
        set_password_save (save: PasswordSave) : void;
        set_pim (pim: number) : void;
        set_username (username: string) : void;
    }
    
    var MountOperation: {
        new () : MountOperation;
        
    }
    
    
    
    
    interface NativeVolumeMonitor extends VolumeMonitor {
        
    }
    
    var NativeVolumeMonitor: {
        
        
    }
    
    
    
    
    interface NetworkAddress extends GObject.Object, SocketConnectable {
        get_hostname () : string;
        get_port () : number;
        get_scheme () : string;
    }
    
    var NetworkAddress: {
        new (hostname: string, _port: number) : NetworkAddress;
        new_loopback (_port: number) : NetworkAddress;
        parse (host_and_port: string, default_port: number) : NetworkAddress;
        parse_uri (uri: string, default_port: number) : NetworkAddress;
    }
    
    
    
    
    interface NetworkService extends GObject.Object, SocketConnectable {
        get_domain () : string;
        get_protocol () : string;
        get_scheme () : string;
        get_service () : string;
        set_scheme (scheme: string) : void;
    }
    
    var NetworkService: {
        new (service: string, protocol: string, domain: string) : NetworkService;
        
    }
    
    
    
    
    interface Notification extends GObject.Object {
        add_button (label: string, detailed_action: string) : void;
        add_button_with_target (label: string, action: string, target_format: string) : void;
        add_button_with_target_value (label: string, action: string, target: GLib.Variant) : void;
        set_body (body: string) : void;
        set_default_action (detailed_action: string) : void;
        set_default_action_and_target (action: string, target_format: string) : void;
        set_default_action_and_target_value (action: string, target: GLib.Variant) : void;
        set_icon (icon: Icon) : void;
        set_priority (priority: NotificationPriority) : void;
        set_title (title: string) : void;
        set_urgent (urgent: boolean) : void;
    }
    
    var Notification: {
        new (title: string) : Notification;
        
    }
    
    
    
    
    interface OutputStream extends GObject.Object {
        clear_pending () : void;
        close (cancellable: Cancellable) : boolean;
        close_async (io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        close_finish (result: AsyncResult) : boolean;
        flush (cancellable: Cancellable) : boolean;
        flush_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        flush_finish (result: AsyncResult) : boolean;
        has_pending () : boolean;
        is_closed () : boolean;
        is_closing () : boolean;
        printf (bytes_written: number, cancellable: Cancellable, error: GLib.Error, format: string) : boolean;
        set_pending () : boolean;
        splice (source: InputStream, flags: OutputStreamSpliceFlags, cancellable: Cancellable) : number;
        splice_async (source: InputStream, flags: OutputStreamSpliceFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        splice_finish (result: AsyncResult) : number;
        vprintf (bytes_written: number, cancellable: Cancellable, error: GLib.Error, format: string, args: any[]) : boolean;
        write (buffer: number[], cancellable: Cancellable) : number;
        write_all (buffer: number[], count: number, bytes_written: number, cancellable: Cancellable) : boolean;
        write_all_async (buffer: number[], count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        write_all_finish (result: AsyncResult, bytes_written: number) : boolean;
        write_async (buffer: number[], io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        write_bytes (bytes: GLib.Bytes, cancellable: Cancellable) : number;
        write_bytes_async (bytes: GLib.Bytes, io_priority: number | null, cancellable: Cancellable | null, callback?: AsyncReadyCallback) : void;
        write_bytes_finish (result: AsyncResult) : number;
        write_finish (result: AsyncResult) : number;
        writev (vectors: OutputVector[], n_vectors: number, bytes_written: number, cancellable: Cancellable) : boolean;
        writev_all (vectors: OutputVector[], n_vectors: number, bytes_written: number, cancellable: Cancellable) : boolean;
        writev_all_async (vectors: OutputVector[], n_vectors: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        writev_all_finish (result: AsyncResult, bytes_written: number) : boolean;
        writev_async (vectors: OutputVector[], n_vectors: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        writev_finish (result: AsyncResult, bytes_written: number) : boolean;
    }
    
    var OutputStream: {
        
        
    }
    
    
    
    
    interface Permission extends GObject.Object {
        acquire (cancellable: Cancellable) : boolean;
        acquire_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        acquire_finish (result: AsyncResult) : boolean;
        get_allowed () : boolean;
        get_can_acquire () : boolean;
        get_can_release () : boolean;
        impl_update (allowed: boolean, can_acquire: boolean, can_release: boolean) : void;
        release (cancellable: Cancellable) : boolean;
        release_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        release_finish (result: AsyncResult) : boolean;
    }
    
    var Permission: {
        
        
    }
    
    
    
    
    interface PropertyAction extends GObject.Object, Action {
        
    }
    
    var PropertyAction: {
        new (name: string, object: GObject.Object, property_name: string) : PropertyAction;
        
    }
    
    
    
    
    interface ProxyAddress extends InetSocketAddress, SocketConnectable {
        get_destination_hostname () : string;
        get_destination_port () : number;
        get_destination_protocol () : string;
        get_password () : string;
        get_protocol () : string;
        get_uri () : string;
        get_username () : string;
    }
    
    var ProxyAddress: {
        new (inetaddr: InetAddress, _port: number, protocol: string, dest_hostname: string, dest_port: number, username: string, password: string) : SocketAddress;
        
    }
    
    
    
    
    interface ProxyAddressEnumerator extends SocketAddressEnumerator {
        
    }
    
    var ProxyAddressEnumerator: {
        
        
    }
    
    
    
    
    interface Resolver extends GObject.Object {
        lookup_by_address (address: InetAddress, cancellable: Cancellable) : string;
        lookup_by_address_async (address: InetAddress, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_by_address_finish (result: AsyncResult) : string;
        lookup_by_name (hostname: string, cancellable: Cancellable) : GLib.List;
        lookup_by_name_async (hostname: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_by_name_finish (result: AsyncResult) : GLib.List;
        lookup_by_name_with_flags (hostname: string, flags: ResolverNameLookupFlags, cancellable: Cancellable) : GLib.List;
        lookup_by_name_with_flags_async (hostname: string, flags: ResolverNameLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_by_name_with_flags_finish (result: AsyncResult) : GLib.List;
        lookup_records (rrname: string, record_type: ResolverRecordType, cancellable: Cancellable) : GLib.List;
        lookup_records_async (rrname: string, record_type: ResolverRecordType, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_records_finish (result: AsyncResult) : GLib.List;
        lookup_service (service: string, protocol: string, domain: string, cancellable: Cancellable) : GLib.List;
        lookup_service_async (service: string, protocol: string, domain: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_service_finish (result: AsyncResult) : GLib.List;
        set_default () : void;
    }
    
    var Resolver: {
        
        free_addresses (addresses: GLib.List) : void;
        free_targets (targets: GLib.List) : void;
        get_default () : Resolver;
    }
    
    
    
    
    class Settings extends GObject.Object {
		constructor(options: any);
        apply () : void;
        bind (key: string, object: GObject.Object, property: string, flags: SettingsBindFlags) : void;
        bind_with_mapping (key: string, object: GObject.Object, property: string, flags: SettingsBindFlags, get_mapping: SettingsBindGetMapping, set_mapping: SettingsBindSetMapping, user_data: any, destroy: GLib.DestroyNotify) : void;
        bind_writable (key: string, object: GObject.Object, property: string, inverted: boolean) : void;
        create_action (key: string) : Action;
		delay () : void;
        get (key: string, format: string) : void;
        get_boolean (key: string) : boolean;
        get_child (name: string) : Settings;
        get_default_value (key: string) : GLib.Variant;
        get_double (key: string) : number;
        get_enum (key: string) : number;
        get_flags (key: string) : number;
        get_has_unapplied () : boolean;
        get_int (key: string) : number;
        get_int64 (key: string) : number;
        get_mapped (key: string, mapping: SettingsGetMapping, user_data: any) : any;
        get_range (key: string) : GLib.Variant;
        get_string (key: string) : string;
        get_strv (key: string) : string[];
        get_uint (key: string) : number;
        get_uint64 (key: string) : number;
        get_user_value (key: string) : GLib.Variant;
        get_value (key: string) : GLib.Variant;
        is_writable (name: string) : boolean;
        list_children () : string[];
        list_keys () : string[];
        range_check (key: string, value: GLib.Variant) : boolean;
        reset (key: string) : void;
        revert () : void;
        set (key: string, format: string) : boolean;
        set_boolean (key: string, value: boolean) : boolean;
        set_double (key: string, value: number) : boolean;
        set_enum (key: string, value: number) : boolean;
        set_flags (key: string, value: number) : boolean;
        set_int (key: string, value: number) : boolean;
        set_int64 (key: string, value: number) : boolean;
        set_string (key: string, value: string) : boolean;
        set_strv (key: string, value: string[]) : boolean;
        set_uint (key: string, value: number) : boolean;
        set_uint64 (key: string, value: number) : boolean;
		set_value (key: string, value: GLib.Variant) : boolean;
		static new(schema_id: string): Settings;
		static new_full (schema: SettingsSchema, backend: SettingsBackend, path: string) : Settings;
        static new_with_backend (schema_id: string, backend: SettingsBackend) : Settings;
        static new_with_backend_and_path (schema_id: string, backend: SettingsBackend, path: string) : Settings;
        static new_with_path (schema_id: string, path: string) : Settings;
        static list_relocatable_schemas () : string[];
        static list_schemas () : string[];
        static sync () : void;
        static unbind (object: GObject.Object, property: string) : void;
    }  

    interface SettingsBackend extends GObject.Object {
        changed (key: string, origin_tag: any) : void;
        changed_tree (tree: GLib.Tree, origin_tag: any) : void;
        keys_changed (path: string, items: string[], origin_tag: any) : void;
        path_changed (path: string, origin_tag: any) : void;
        path_writable_changed (path: string) : void;
        writable_changed (key: string) : void;
    }
    
    var SettingsBackend: {
        
        flatten_tree (tree: GLib.Tree, path: string, keys: string[], values: GLib.Variant[]) : void;
        get_default () : SettingsBackend;
    }
    
    
    
    
    interface SimpleAction extends GObject.Object, Action {
        set_enabled (enabled: boolean) : void;
        set_state (value: GLib.Variant) : void;
        set_state_hint (state_hint: GLib.Variant) : void;
    }
    
    var SimpleAction: {
        new (name: string, parameter_type: GLib.VariantType) : SimpleAction;
        new_stateful (name: string, parameter_type: GLib.VariantType, state: GLib.Variant) : SimpleAction;
        
    }
    
    
    
    
    interface SimpleActionGroup extends GObject.Object, ActionGroup, ActionMap {
        add_entries (entries: ActionEntry[], n_entries: number, user_data: any) : void;
        insert (action: Action) : void;
        lookup (action_name: string) : Action;
        remove (action_name: string) : void;
    }
    
    var SimpleActionGroup: {
        new () : SimpleActionGroup;
        
    }
    
    
    
    
    interface SimpleAsyncResult extends GObject.Object, AsyncResult {
        complete () : void;
        complete_in_idle () : void;
        get_op_res_gboolean () : boolean;
        get_op_res_gpointer () : any;
        get_op_res_gssize () : number;
        get_source_tag () : any;
        propagate_error () : boolean;
        run_in_thread (_func: SimpleAsyncThreadFunc, io_priority: number, cancellable: Cancellable) : void;
        set_check_cancellable (check_cancellable: Cancellable) : void;
        set_error (domain: GLib.Quark, code: number, format: string) : void;
        set_error_va (domain: GLib.Quark, code: number, format: string, args: any[]) : void;
        set_from_error (error: GLib.Error) : void;
        set_handle_cancellation (handle_cancellation: boolean) : void;
        set_op_res_gboolean (op_res: boolean) : void;
        set_op_res_gpointer (op_res: any, destroy_op_res: GLib.DestroyNotify) : void;
        set_op_res_gssize (op_res: number) : void;
        take_error (error: GLib.Error) : void;
    }
    
    var SimpleAsyncResult: {
        new (source_object: GObject.Object, callback: AsyncReadyCallback, user_data: any, source_tag: any) : SimpleAsyncResult;
        new_error (source_object: GObject.Object, callback: AsyncReadyCallback, user_data: any, domain: GLib.Quark, code: number, format: string) : SimpleAsyncResult;
        new_from_error (source_object: GObject.Object, callback: AsyncReadyCallback, user_data: any, error: GLib.Error) : SimpleAsyncResult;
        new_take_error (source_object: GObject.Object, callback: AsyncReadyCallback, user_data: any, error: GLib.Error) : SimpleAsyncResult;
        is_valid (result: AsyncResult, source: GObject.Object, source_tag: any) : boolean;
    }
    
    
    
    
    interface SimpleIOStream extends IOStream {
        
    }
    
    var SimpleIOStream: {
        new (input_stream: InputStream, output_stream: OutputStream) : IOStream;
        
    }
    
    
    
    
    interface SimplePermission extends Permission {
        
    }
    
    var SimplePermission: {
        new (allowed: boolean) : Permission;
        
    }
    
    
    
    
    interface SimpleProxyResolver extends GObject.Object, ProxyResolver {
        set_default_proxy (default_proxy: string) : void;
        set_ignore_hosts (ignore_hosts: string) : void;
        set_uri_proxy (uri_scheme: string, proxy: string) : void;
    }
    
    var SimpleProxyResolver: {
        
        new (default_proxy: string, ignore_hosts: string) : ProxyResolver;
    }
    
    
    
    
    interface Socket extends GObject.Object, DatagramBased, Initable {
        accept (cancellable: Cancellable) : Socket;
        bind (address: SocketAddress, allow_reuse: boolean) : boolean;
        check_connect_result () : boolean;
        close () : boolean;
        condition_check (condition: GLib.IOCondition) : GLib.IOCondition;
        condition_timed_wait (condition: GLib.IOCondition, timeout_us: number, cancellable: Cancellable) : boolean;
        condition_wait (condition: GLib.IOCondition, cancellable: Cancellable) : boolean;
        //connect (address: SocketAddress, cancellable: Cancellable) : boolean;
        connection_factory_create_connection () : SocketConnection;
        create_source (condition: GLib.IOCondition, cancellable: Cancellable) : GLib.Source;
        get_available_bytes () : number;
        get_blocking () : boolean;
        get_broadcast () : boolean;
        get_credentials () : Credentials;
        get_family () : SocketFamily;
        get_fd () : number;
        get_keepalive () : boolean;
        get_listen_backlog () : number;
        get_local_address () : SocketAddress;
        get_multicast_loopback () : boolean;
        get_multicast_ttl () : number;
        get_option (level: number, optname: number, value: number) : boolean;
        get_protocol () : SocketProtocol;
        get_remote_address () : SocketAddress;
        get_socket_type () : SocketType;
        get_timeout () : number;
        get_ttl () : number;
        is_closed () : boolean;
        is_connected () : boolean;
        join_multicast_group (group: InetAddress, source_specific: boolean, iface: string) : boolean;
        join_multicast_group_ssm (group: InetAddress, source_specific: InetAddress, iface: string) : boolean;
        leave_multicast_group (group: InetAddress, source_specific: boolean, iface: string) : boolean;
        leave_multicast_group_ssm (group: InetAddress, source_specific: InetAddress, iface: string) : boolean;
        listen () : boolean;
        receive (buffer: number[], size: number, cancellable: Cancellable) : number;
        receive_from (address: SocketAddress, buffer: number[], size: number, cancellable: Cancellable) : number;
        receive_message (address: SocketAddress, vectors: InputVector[], num_vectors: number, messages: SocketControlMessage[], num_messages: number, flags: number, cancellable: Cancellable) : number;
        receive_messages (messages: InputMessage[], num_messages: number, flags: number, cancellable: Cancellable) : number;
        receive_with_blocking (buffer: number[], size: number, blocking: boolean, cancellable: Cancellable) : number;
        send (buffer: number[], size: number, cancellable: Cancellable) : number;
        send_message (address: SocketAddress, vectors: OutputVector[], num_vectors: number, messages: SocketControlMessage[], num_messages: number, flags: number, cancellable: Cancellable) : number;
        send_message_with_timeout (address: SocketAddress, vectors: OutputVector[], num_vectors: number, messages: SocketControlMessage[], num_messages: number, flags: number, timeout_us: number, bytes_written: number, cancellable: Cancellable) : PollableReturn;
        send_messages (messages: OutputMessage[], num_messages: number, flags: number, cancellable: Cancellable) : number;
        send_to (address: SocketAddress, buffer: number[], size: number, cancellable: Cancellable) : number;
        send_with_blocking (buffer: number[], size: number, blocking: boolean, cancellable: Cancellable) : number;
        set_blocking (blocking: boolean) : void;
        set_broadcast (broadcast: boolean) : void;
        set_keepalive (keepalive: boolean) : void;
        set_listen_backlog (backlog: number) : void;
        set_multicast_loopback (loopback: boolean) : void;
        set_multicast_ttl (ttl: number) : void;
        set_option (level: number, optname: number, value: number) : boolean;
        set_timeout (timeout: number) : void;
        set_ttl (ttl: number) : void;
        shutdown (shutdown_read: boolean, shutdown_write: boolean) : boolean;
        speaks_ipv4 () : boolean;
    }
    
    var Socket: {
        new (family: SocketFamily, _type: SocketType, protocol: SocketProtocol) : Socket;
        new_from_fd (fd: number) : Socket;
        
    }
    
    
    
    
    interface SocketAddress extends GObject.Object, SocketConnectable {
        get_family () : SocketFamily;
        get_native_size () : number;
        to_native (dest: any, destlen: number) : boolean;
    }
    
    var SocketAddress: {
        new_from_native (_native: any, len: number) : SocketAddress;
        
    }
    
    
    
    
    interface SocketAddressEnumerator extends GObject.Object {
        next (cancellable: Cancellable) : SocketAddress;
        next_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        next_finish (result: AsyncResult) : SocketAddress;
    }
    
    var SocketAddressEnumerator: {
        
        
    }
    
    
    
    
    class SocketClient extends GObject.Object {
        add_application_proxy (protocol: string) : void;
        //connect (connectable: SocketConnectable, cancellable: Cancellable) : SocketConnection;
        connect_async (connectable: SocketConnectable, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_finish (result: AsyncResult) : SocketConnection;
        connect_to_host (host_and_port: string, default_port: number, cancellable: Cancellable) : SocketConnection;
        connect_to_host_async (host_and_port: string, default_port: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_to_host_finish (result: AsyncResult) : SocketConnection;
        connect_to_service (domain: string, service: string, cancellable: Cancellable) : SocketConnection;
        connect_to_service_async (domain: string, service: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_to_service_finish (result: AsyncResult) : SocketConnection;
        connect_to_uri (uri: string, default_port: number, cancellable: Cancellable) : SocketConnection;
        connect_to_uri_async (uri: string, default_port: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_to_uri_finish (result: AsyncResult) : SocketConnection;
        get_enable_proxy () : boolean;
        get_family () : SocketFamily;
        get_local_address () : SocketAddress;
        get_protocol () : SocketProtocol;
        get_proxy_resolver () : ProxyResolver;
        get_socket_type () : SocketType;
        get_timeout () : number;
        get_tls () : boolean;
        get_tls_validation_flags () : TlsCertificateFlags;
        set_enable_proxy (enable: boolean) : void;
        set_family (family: SocketFamily) : void;
        set_local_address (address: SocketAddress) : void;
        set_protocol (protocol: SocketProtocol) : void;
        set_proxy_resolver (proxy_resolver: ProxyResolver) : void;
        set_socket_type (_type: SocketType) : void;
        set_timeout (timeout: number) : void;
        set_tls (tls: boolean) : void;
		set_tls_validation_flags (flags: TlsCertificateFlags) : void;
		static new(): SocketClient
    }
    
    
    
    class SocketConnection extends IOStream {
        //connect (address: SocketAddress, cancellable: Cancellable) : boolean;
        connect_async (address: SocketAddress, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_finish (result: AsyncResult) : boolean;
        get_local_address () : SocketAddress;
        get_remote_address () : SocketAddress;
        get_socket () : Socket;
		is_connected () : boolean;
		static factory_lookup_type (family: SocketFamily, _type: SocketType, protocol_id: number) : GObject.Type;
        static factory_register_type (g_type: GObject.Type, family: SocketFamily, _type: SocketType, protocol: number) : void;
    } 
    
    interface SocketControlMessage extends GObject.Object {
        get_level () : number;
        get_msg_type () : number;
        get_size () : number;
        serialize (data: any) : void;
    }
    
    var SocketControlMessage: {
        
        deserialize (level: number, _type: number, size: number, data: number[]) : SocketControlMessage;
    }
    
    
    
    
    interface SocketListener extends GObject.Object {
        accept (source_object: GObject.Object, cancellable: Cancellable) : SocketConnection;
        accept_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        accept_finish (result: AsyncResult, source_object: GObject.Object) : SocketConnection;
        accept_socket (source_object: GObject.Object, cancellable: Cancellable) : Socket;
        accept_socket_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        accept_socket_finish (result: AsyncResult, source_object: GObject.Object) : Socket;
        add_address (address: SocketAddress, _type: SocketType, protocol: SocketProtocol, source_object: GObject.Object, effective_address: SocketAddress) : boolean;
        add_any_inet_port (source_object: GObject.Object) : number;
        add_inet_port (_port: number, source_object: GObject.Object) : boolean;
        add_socket (socket: Socket, source_object: GObject.Object) : boolean;
        close () : void;
        set_backlog (listen_backlog: number) : void;
    }
    
    var SocketListener: {
        new () : SocketListener;
        
    }
    
    
    
    
    interface SocketService extends SocketListener {
        is_active () : boolean;
        start () : void;
        stop () : void;
    }
    
    var SocketService: {
        new () : SocketService;
        
    }
    
    
    
    
    interface Subprocess extends GObject.Object, Initable {
        communicate (stdin_buf: GLib.Bytes, cancellable: Cancellable, stdout_buf: GLib.Bytes, stderr_buf: GLib.Bytes) : boolean;
        communicate_async (stdin_buf: GLib.Bytes, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        communicate_finish (result: AsyncResult, stdout_buf: GLib.Bytes, stderr_buf: GLib.Bytes) : boolean;
        communicate_utf8 (stdin_buf: string, cancellable: Cancellable, stdout_buf: string, stderr_buf: string) : boolean;
        communicate_utf8_async (stdin_buf: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        communicate_utf8_finish (result: AsyncResult, stdout_buf: string, stderr_buf: string) : boolean;
        force_exit () : void;
        get_exit_status () : number;
        get_identifier () : string;
        get_if_exited () : boolean;
        get_if_signaled () : boolean;
        get_status () : number;
        get_stderr_pipe () : InputStream;
        get_stdin_pipe () : OutputStream;
        get_stdout_pipe () : InputStream;
        get_successful () : boolean;
        get_term_sig () : number;
        send_signal (signal_num: number) : void;
        wait (cancellable: Cancellable) : boolean;
        wait_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        wait_check (cancellable: Cancellable) : boolean;
        wait_check_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        wait_check_finish (result: AsyncResult) : boolean;
        wait_finish (result: AsyncResult) : boolean;
    }
    
    var Subprocess: {
        new (flags: SubprocessFlags, error: GLib.Error, argv0: string) : Subprocess;
        newv (argv: string[], flags: SubprocessFlags) : Subprocess;
        
    }
    
    
    
    
    interface SubprocessLauncher extends GObject.Object {
        getenv (variable: string) : string;
        set_child_setup (child_setup: GLib.SpawnChildSetupFunc, user_data: any, destroy_notify: GLib.DestroyNotify) : void;
        set_cwd (cwd: string) : void;
        set_environ (env: string[]) : void;
        set_flags (flags: SubprocessFlags) : void;
        set_stderr_file_path (path: string) : void;
        set_stdin_file_path (path: string) : void;
        set_stdout_file_path (path: string) : void;
        setenv (variable: string, value: string, overwrite: boolean) : void;
        spawn (error: GLib.Error, argv0: string) : Subprocess;
        spawnv (argv: string[]) : Subprocess;
        take_fd (source_fd: number, target_fd: number) : void;
        take_stderr_fd (fd: number) : void;
        take_stdin_fd (fd: number) : void;
        take_stdout_fd (fd: number) : void;
        unsetenv (variable: string) : void;
    }
    
    var SubprocessLauncher: {
        new (flags: SubprocessFlags) : SubprocessLauncher;
        
    }
    
    
    
    
    interface Task extends GObject.Object, AsyncResult {
        attach_source (source: GLib.Source, callback: GLib.SourceFunc) : void;
        get_cancellable () : Cancellable;
        get_check_cancellable () : boolean;
        get_completed () : boolean;
        get_context () : GLib.MainContext;
        get_name () : string;
        get_priority () : number;
        get_return_on_cancel () : boolean;
        get_source_object () : GObject.Object;
        get_source_tag () : any;
        get_task_data () : any;
        had_error () : boolean;
        propagate_boolean () : boolean;
        propagate_int () : number;
        propagate_pointer () : any;
        return_boolean (result: boolean) : void;
        return_error (error: GLib.Error) : void;
        return_error_if_cancelled () : boolean;
        return_int (result: number) : void;
        return_new_error (domain: GLib.Quark, code: number, format: string) : void;
        return_pointer (result: any, result_destroy: GLib.DestroyNotify) : void;
        run_in_thread (task_func: TaskThreadFunc) : void;
        run_in_thread_sync (task_func: TaskThreadFunc) : void;
        set_check_cancellable (check_cancellable: boolean) : void;
        set_name (name: string) : void;
        set_priority (priority: number) : void;
        set_return_on_cancel (return_on_cancel: boolean) : boolean;
        set_source_tag (source_tag: any) : void;
        set_task_data (task_data: any, task_data_destroy: GLib.DestroyNotify) : void;
    }
    
    var Task: {
        new (source_object: GObject.Object, cancellable: Cancellable, callback: AsyncReadyCallback, callback_data: any) : Task;
        is_valid (result: AsyncResult, source_object: GObject.Object) : boolean;
        report_error (source_object: GObject.Object, callback: AsyncReadyCallback, callback_data: any, source_tag: any, error: GLib.Error) : void;
        report_new_error (source_object: GObject.Object, callback: AsyncReadyCallback, callback_data: any, source_tag: any, domain: GLib.Quark, code: number, format: string) : void;
    }
    
    
    
    
    interface TcpConnection extends SocketConnection {
        get_graceful_disconnect () : boolean;
        set_graceful_disconnect (graceful_disconnect: boolean) : void;
    }
    
    var TcpConnection: {
        
        
    }
    
    
    
    
    interface TcpWrapperConnection extends TcpConnection {
        get_base_io_stream () : IOStream;
    }
    
    var TcpWrapperConnection: {
        new (base_io_stream: IOStream, socket: Socket) : SocketConnection;
        
    }
    
    
    
    
    interface TestDBus extends GObject.Object {
        add_service_dir (path: string) : void;
        down () : void;
        get_bus_address () : string;
        get_flags () : TestDBusFlags;
        stop () : void;
        up () : void;
    }
    
    var TestDBus: {
        new (flags: TestDBusFlags) : TestDBus;
        unset () : void;
    }
    
    
    
    
    interface ThemedIcon extends GObject.Object, Icon {
        append_name (iconname: string) : void;
        get_names () : string[];
        prepend_name (iconname: string) : void;
    }
    
    var ThemedIcon: {
        new (iconname: string) : ThemedIcon;
        new_from_names (iconnames: string[], len: number) : ThemedIcon;
        new_with_default_fallbacks (iconname: string) : ThemedIcon;
        
    }
    
    
    
    
    interface ThreadedSocketService extends SocketService {
        
    }
    
    var ThreadedSocketService: {
        new (max_threads: number) : SocketService;
        
    }
    
    
    
    
    interface TlsCertificate extends GObject.Object {
        get_issuer () : TlsCertificate;
        is_same (cert_two: TlsCertificate) : boolean;
        verify (identity: SocketConnectable, trusted_ca: TlsCertificate) : TlsCertificateFlags;
    }
    
    var TlsCertificate: {
        new_from_file (file: string) : TlsCertificate;
        new_from_files (cert_file: string, key_file: string) : TlsCertificate;
        new_from_pem (data: string, length: number) : TlsCertificate;
        list_new_from_file (file: string) : GLib.List;
    }
    
    
    
    
    interface TlsConnection extends IOStream {
        emit_accept_certificate (peer_cert: TlsCertificate, errors: TlsCertificateFlags) : boolean;
        get_certificate () : TlsCertificate;
        get_database () : TlsDatabase;
        get_interaction () : TlsInteraction;
        get_negotiated_protocol () : string;
        get_peer_certificate () : TlsCertificate;
        get_peer_certificate_errors () : TlsCertificateFlags;
        get_rehandshake_mode () : TlsRehandshakeMode;
        get_require_close_notify () : boolean;
        get_use_system_certdb () : boolean;
        handshake (cancellable: Cancellable) : boolean;
        handshake_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        handshake_finish (result: AsyncResult) : boolean;
        set_advertised_protocols (protocols: string[]) : void;
        set_certificate (certificate: TlsCertificate) : void;
        set_database (database: TlsDatabase) : void;
        set_interaction (interaction: TlsInteraction) : void;
        set_rehandshake_mode (mode: TlsRehandshakeMode) : void;
        set_require_close_notify (require_close_notify: boolean) : void;
        set_use_system_certdb (use_system_certdb: boolean) : void;
    }
    
    var TlsConnection: {
        
        
    }
    
    
    
    
    interface TlsDatabase extends GObject.Object {
        create_certificate_handle (certificate: TlsCertificate) : string;
        lookup_certificate_for_handle (handle: string, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : TlsCertificate;
        lookup_certificate_for_handle_async (handle: string, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_certificate_for_handle_finish (result: AsyncResult) : TlsCertificate;
        lookup_certificate_issuer (certificate: TlsCertificate, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : TlsCertificate;
        lookup_certificate_issuer_async (certificate: TlsCertificate, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_certificate_issuer_finish (result: AsyncResult) : TlsCertificate;
        lookup_certificates_issued_by (issuer_raw_dn: number[], interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : GLib.List;
        lookup_certificates_issued_by_async (issuer_raw_dn: number[], interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_certificates_issued_by_finish (result: AsyncResult) : GLib.List;
        verify_chain (chain: TlsCertificate, purpose: string, identity: SocketConnectable, interaction: TlsInteraction, flags: TlsDatabaseVerifyFlags, cancellable: Cancellable) : TlsCertificateFlags;
        verify_chain_async (chain: TlsCertificate, purpose: string, identity: SocketConnectable, interaction: TlsInteraction, flags: TlsDatabaseVerifyFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        verify_chain_finish (result: AsyncResult) : TlsCertificateFlags;
    }
    
    var TlsDatabase: {
        
        
    }
    
    
    
    
    interface TlsInteraction extends GObject.Object {
        ask_password (password: TlsPassword, cancellable: Cancellable) : TlsInteractionResult;
        ask_password_async (password: TlsPassword, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        ask_password_finish (result: AsyncResult) : TlsInteractionResult;
        invoke_ask_password (password: TlsPassword, cancellable: Cancellable) : TlsInteractionResult;
        invoke_request_certificate (connection: TlsConnection, flags: TlsCertificateRequestFlags, cancellable: Cancellable) : TlsInteractionResult;
        request_certificate (connection: TlsConnection, flags: TlsCertificateRequestFlags, cancellable: Cancellable) : TlsInteractionResult;
        request_certificate_async (connection: TlsConnection, flags: TlsCertificateRequestFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        request_certificate_finish (result: AsyncResult) : TlsInteractionResult;
    }
    
    var TlsInteraction: {
        
        
    }
    
    
    
    
    interface TlsPassword extends GObject.Object {
        get_description () : string;
        get_flags () : TlsPasswordFlags;
        get_value (length: number) : number;
        get_warning () : string;
        set_description (description: string) : void;
        set_flags (flags: TlsPasswordFlags) : void;
        set_value (value: number[], length: number) : void;
        set_value_full (value: number[], length: number, destroy: GLib.DestroyNotify) : void;
        set_warning (warning: string) : void;
    }
    
    var TlsPassword: {
        new (flags: TlsPasswordFlags, description: string) : TlsPassword;
        
    }
    
    
    
    
    interface UnixConnection extends SocketConnection {
        receive_credentials (cancellable: Cancellable) : Credentials;
        receive_credentials_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        receive_credentials_finish (result: AsyncResult) : Credentials;
        receive_fd (cancellable: Cancellable) : number;
        send_credentials (cancellable: Cancellable) : boolean;
        send_credentials_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        send_credentials_finish (result: AsyncResult) : boolean;
        send_fd (fd: number, cancellable: Cancellable) : boolean;
    }
    
    var UnixConnection: {
        
        
    }
    
    
    
    
    interface UnixCredentialsMessage extends SocketControlMessage {
        get_credentials () : Credentials;
    }
    
    var UnixCredentialsMessage: {
        new () : SocketControlMessage;
        new_with_credentials (credentials: Credentials) : SocketControlMessage;
        is_supported () : boolean;
    }
    
    
    
    
    interface UnixFDList extends GObject.Object {
        append (fd: number) : number;
        get (index_: number) : number;
        get_length () : number;
        peek_fds (length: number) : number[];
        steal_fds (length: number) : number[];
    }
    
    var UnixFDList: {
        new () : UnixFDList;
        new_from_array (fds: number[], n_fds: number) : UnixFDList;
        
    }
    
    
    
    
    interface UnixFDMessage extends SocketControlMessage {
        append_fd (fd: number) : boolean;
        get_fd_list () : UnixFDList;
        steal_fds (length: number) : number[];
    }
    
    var UnixFDMessage: {
        new () : SocketControlMessage;
        new_with_fd_list (fd_list: UnixFDList) : SocketControlMessage;
        
    }
    
    
    
    
    interface UnixInputStream extends InputStream, FileDescriptorBased, PollableInputStream {
        get_close_fd () : boolean;
        get_fd () : number;
        set_close_fd (close_fd: boolean) : void;
    }
    
    var UnixInputStream: {
        new (fd: number, close_fd: boolean) : InputStream;
        
    }
    
    
    
    
    interface UnixMountMonitor extends GObject.Object {
        set_rate_limit (limit_msec: number) : void;
    }
    
    var UnixMountMonitor: {
        new () : UnixMountMonitor;
        get () : UnixMountMonitor;
    }
    
    
    
    
    interface UnixOutputStream extends OutputStream, FileDescriptorBased, PollableOutputStream {
        get_close_fd () : boolean;
        get_fd () : number;
        set_close_fd (close_fd: boolean) : void;
    }
    
    var UnixOutputStream: {
        new (fd: number, close_fd: boolean) : OutputStream;
        
    }
    
    
    
    
    interface UnixSocketAddress extends SocketAddress, SocketConnectable {
        get_address_type () : UnixSocketAddressType;
        get_is_abstract () : boolean;
        get_path () : string;
        get_path_len () : number;
    }
    
    var UnixSocketAddress: {
        new (path: string) : SocketAddress;
        new_abstract (path: string[], path_len: number) : SocketAddress;
        new_with_type (path: string[], path_len: number, _type: UnixSocketAddressType) : SocketAddress;
        abstract_names_supported () : boolean;
    }
    
    
    
    
    interface Vfs extends GObject.Object {
        get_file_for_path (path: string) : File;
        get_file_for_uri (uri: string) : File;
        get_supported_uri_schemes () : string[];
        is_active () : boolean;
        parse_name (parse_name: string) : File;
        register_uri_scheme (scheme: string, uri_func: VfsFileLookupFunc, uri_data: any, uri_destroy: GLib.DestroyNotify, parse_name_func: VfsFileLookupFunc, parse_name_data: any, parse_name_destroy: GLib.DestroyNotify) : boolean;
        unregister_uri_scheme (scheme: string) : boolean;
    }
    
    var Vfs: {
        
        get_default () : Vfs;
        get_local () : Vfs;
    }
    
    
    
    
    interface VolumeMonitor extends GObject.Object {
        get_connected_drives () : GLib.List;
        get_mount_for_uuid (uuid: string) : Mount;
        get_mounts () : GLib.List;
        get_volume_for_uuid (uuid: string) : Volume;
        get_volumes () : GLib.List;
    }
    
    var VolumeMonitor: {
        
        adopt_orphan_mount (mount: Mount) : Volume;
        get () : VolumeMonitor;
    }
    
    
    
    
    interface ZlibCompressor extends GObject.Object, Converter {
        get_file_info () : FileInfo;
        set_file_info (file_info: FileInfo) : void;
    }
    
    var ZlibCompressor: {
        new (format: ZlibCompressorFormat, level: number) : ZlibCompressor;
        
    }
    
    
    
    
    interface ZlibDecompressor extends GObject.Object, Converter {
        get_file_info () : FileInfo;
    }
    
    var ZlibDecompressor: {
        new (format: ZlibCompressorFormat) : ZlibDecompressor;
        
    }
    
    
    
    
    class ActionEntry {
        public name: string;
        public parameter_type: string;
        public state: string;
        public padding: number[];
    
        activate : {(action: SimpleAction, parameter: GLib.Variant, user_data: any) : void;};
        change_state : {(action: SimpleAction, value: GLib.Variant, user_data: any) : void;};
    
    }
    
    
    
    class ActionGroupInterface {
        public g_iface: GObject.TypeInterface;
    
        has_action : {(action_group: ActionGroup, action_name: string) : boolean;};
        list_actions : {(action_group: ActionGroup) : string[];};
        get_action_enabled : {(action_group: ActionGroup, action_name: string) : boolean;};
        get_action_parameter_type : {(action_group: ActionGroup, action_name: string) : GLib.VariantType;};
        get_action_state_type : {(action_group: ActionGroup, action_name: string) : GLib.VariantType;};
        get_action_state_hint : {(action_group: ActionGroup, action_name: string) : GLib.Variant;};
        get_action_state : {(action_group: ActionGroup, action_name: string) : GLib.Variant;};
        change_action_state : {(action_group: ActionGroup, action_name: string, value: GLib.Variant) : void;};
        activate_action : {(action_group: ActionGroup, action_name: string, parameter: GLib.Variant) : void;};
        action_added : {(action_group: ActionGroup, action_name: string) : void;};
        action_removed : {(action_group: ActionGroup, action_name: string) : void;};
        action_enabled_changed : {(action_group: ActionGroup, action_name: string, enabled: boolean) : void;};
        action_state_changed : {(action_group: ActionGroup, action_name: string, state: GLib.Variant) : void;};
        query_action : {(action_group: ActionGroup, action_name: string, enabled: boolean, parameter_type: GLib.VariantType, state_type: GLib.VariantType, state_hint: GLib.Variant, state: GLib.Variant) : boolean;};
    
    }
    
    
    
    class ActionInterface {
        public g_iface: GObject.TypeInterface;
    
        get_name : {(action: Action) : string;};
        get_parameter_type : {(action: Action) : GLib.VariantType;};
        get_state_type : {(action: Action) : GLib.VariantType;};
        get_state_hint : {(action: Action) : GLib.Variant;};
        get_enabled : {(action: Action) : boolean;};
        get_state : {(action: Action) : GLib.Variant;};
        change_state : {(action: Action, value: GLib.Variant) : void;};
        activate : {(action: Action, parameter: GLib.Variant) : void;};
    
    }
    
    
    
    class ActionMapInterface {
        public g_iface: GObject.TypeInterface;
    
        lookup_action : {(action_map: ActionMap, action_name: string) : Action;};
        add_action : {(action_map: ActionMap, action: Action) : void;};
        remove_action : {(action_map: ActionMap, action_name: string) : void;};
    
    }
    
    
    
    class AppInfoIface {
        public g_iface: GObject.TypeInterface;
    
        dup : {(appinfo: AppInfo) : AppInfo;};
        equal : {(appinfo1: AppInfo, appinfo2: AppInfo) : boolean;};
        get_id : {(appinfo: AppInfo) : string;};
        get_name : {(appinfo: AppInfo) : string;};
        get_description : {(appinfo: AppInfo) : string;};
        get_executable : {(appinfo: AppInfo) : string;};
        get_icon : {(appinfo: AppInfo) : Icon;};
        launch : {(appinfo: AppInfo, files: GLib.List, context: AppLaunchContext) : boolean;};
        supports_uris : {(appinfo: AppInfo) : boolean;};
        supports_files : {(appinfo: AppInfo) : boolean;};
        launch_uris : {(appinfo: AppInfo, uris: GLib.List, context: AppLaunchContext) : boolean;};
        should_show : {(appinfo: AppInfo) : boolean;};
        set_as_default_for_type : {(appinfo: AppInfo, content_type: string) : boolean;};
        set_as_default_for_extension : {(appinfo: AppInfo, extension: string) : boolean;};
        add_supports_type : {(appinfo: AppInfo, content_type: string) : boolean;};
        can_remove_supports_type : {(appinfo: AppInfo) : boolean;};
        remove_supports_type : {(appinfo: AppInfo, content_type: string) : boolean;};
        can_delete : {(appinfo: AppInfo) : boolean;};
        do_delete : {(appinfo: AppInfo) : boolean;};
        get_commandline : {(appinfo: AppInfo) : string;};
        get_display_name : {(appinfo: AppInfo) : string;};
        set_as_last_used_for_type : {(appinfo: AppInfo, content_type: string) : boolean;};
        get_supported_types : {(appinfo: AppInfo) : string[];};
        launch_uris_async : {(appinfo: AppInfo, uris: GLib.List, context: AppLaunchContext, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        launch_uris_finish : {(appinfo: AppInfo, result: AsyncResult) : boolean;};
    
    }
    
    
    
    class AppLaunchContextClass {
        public parent_class: GObject.ObjectClass;
    
        get_display : {(context: AppLaunchContext, info: AppInfo, files: GLib.List) : string;};
        get_startup_notify_id : {(context: AppLaunchContext, info: AppInfo, files: GLib.List) : string;};
        launch_failed : {(context: AppLaunchContext, startup_notify_id: string) : void;};
        launched : {(context: AppLaunchContext, info: AppInfo, platform_data: GLib.Variant) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
    
    }
    
    
    
    class AppLaunchContextPrivate {
    
    
    }
    
    
    
    class ApplicationClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        startup : {(application: Application) : void;};
        activate : {(application: Application) : void;};
        open : {(application: Application, files: File[], n_files: number, hint: string) : void;};
        command_line : {(application: Application, command_line: ApplicationCommandLine) : number;};
        local_command_line : {(application: Application, _arguments: string[], exit_status: number) : boolean;};
        before_emit : {(application: Application, platform_data: GLib.Variant) : void;};
        after_emit : {(application: Application, platform_data: GLib.Variant) : void;};
        add_platform_data : {(application: Application, builder: GLib.VariantBuilder) : void;};
        quit_mainloop : {(application: Application) : void;};
        run_mainloop : {(application: Application) : void;};
        shutdown : {(application: Application) : void;};
        dbus_register : {(application: Application, connection: DBusConnection, object_path: string) : boolean;};
        dbus_unregister : {(application: Application, connection: DBusConnection, object_path: string) : void;};
        handle_local_options : {(application: Application, options: GLib.VariantDict) : number;};
        name_lost : {(application: Application) : boolean;};
    
    }
    
    
    
    class ApplicationCommandLineClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        print_literal : {(cmdline: ApplicationCommandLine, message: string) : void;};
        printerr_literal : {(cmdline: ApplicationCommandLine, message: string) : void;};
        get_stdin : {(cmdline: ApplicationCommandLine) : InputStream;};
    
    }
    
    
    
    class ApplicationCommandLinePrivate {
    
    
    }
    
    
    
    class ApplicationPrivate {
    
    
    }
    
    
    
    class AsyncInitableIface {
        public g_iface: GObject.TypeInterface;
    
        init_async : {(initable: AsyncInitable, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        init_finish : {(initable: AsyncInitable, res: AsyncResult) : boolean;};
    
    }
    
    
    
    class AsyncResultIface {
        public g_iface: GObject.TypeInterface;
    
        get_user_data : {(res: AsyncResult) : any;};
        get_source_object : {(res: AsyncResult) : GObject.Object;};
        is_tagged : {(res: AsyncResult, source_tag: any) : boolean;};
    
    }
    
    
    
    class BufferedInputStreamClass {
        public parent_class: FilterInputStreamClass;
    
        fill : {(stream: BufferedInputStream, count: number, cancellable: Cancellable) : number;};
        fill_async : {(stream: BufferedInputStream, count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        fill_finish : {(stream: BufferedInputStream, result: AsyncResult) : number;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class BufferedInputStreamPrivate {
    
    
    }
    
    
    
    class BufferedOutputStreamClass {
        public parent_class: FilterOutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
    
    }
    
    
    
    class BufferedOutputStreamPrivate {
    
    
    }
    
    
    
    class CancellableClass {
        public parent_class: GObject.ObjectClass;
    
        cancelled : {(cancellable: Cancellable) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class CancellablePrivate {
    
    
    }
    
    
    
    class CharsetConverterClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class ConverterIface {
        public g_iface: GObject.TypeInterface;
    
        convert : {(converter: Converter, inbuf: number[], inbuf_size: number, outbuf: number[], outbuf_size: number, flags: ConverterFlags, bytes_read: number, bytes_written: number) : ConverterResult;};
        reset : {(converter: Converter) : void;};
    
    }
    
    
    
    class ConverterInputStreamClass {
        public parent_class: FilterInputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class ConverterInputStreamPrivate {
    
    
    }
    
    
    
    class ConverterOutputStreamClass {
        public parent_class: FilterOutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class ConverterOutputStreamPrivate {
    
    
    }
    
    
    
    class CredentialsClass {
    
    
    }
    
    
    
    class DBusAnnotationInfo {
        public ref_count: number;
        public key: string;
        public value: string;
        public annotations: DBusAnnotationInfo[];
    
    
        public ref () : DBusAnnotationInfo;
        public unref () : void;
    }
    
    
    
    class DBusArgInfo {
        public ref_count: number;
        public name: string;
        public signature: string;
        public annotations: DBusAnnotationInfo[];
    
    
        public ref () : DBusArgInfo;
        public unref () : void;
    }
    
    
    
    class DBusErrorEntry {
        public error_code: number;
        public dbus_error_name: string;
    
    
    }
    
    
    
    class DBusInterfaceIface {
        public parent_iface: GObject.TypeInterface;
    
        get_info : {(interface_: DBusInterface) : DBusInterfaceInfo;};
        get_object : {(interface_: DBusInterface) : DBusObject;};
        set_object : {(interface_: DBusInterface, object: DBusObject) : void;};
        dup_object : {(interface_: DBusInterface) : DBusObject;};
    
    }
    
    
    
    class DBusInterfaceInfo {
        public ref_count: number;
        public name: string;
        public methods: DBusMethodInfo[];
        public signals: DBusSignalInfo[];
        public properties: DBusPropertyInfo[];
        public annotations: DBusAnnotationInfo[];
    
    
        public cache_build () : void;
        public cache_release () : void;
        public generate_xml (indent: number, string_builder: GLib.String) : void;
        public lookup_method (name: string) : DBusMethodInfo;
        public lookup_property (name: string) : DBusPropertyInfo;
        public lookup_signal (name: string) : DBusSignalInfo;
        public ref () : DBusInterfaceInfo;
        public unref () : void;
    }
    
    
    
    class DBusInterfaceSkeletonClass {
        public parent_class: GObject.ObjectClass;
        public vfunc_padding: any[];
        public signal_padding: any[];
    
        get_info : {(interface_: DBusInterfaceSkeleton) : DBusInterfaceInfo;};
        get_vtable : {(interface_: DBusInterfaceSkeleton) : DBusInterfaceVTable;};
        get_properties : {(interface_: DBusInterfaceSkeleton) : GLib.Variant;};
        flush : {(interface_: DBusInterfaceSkeleton) : void;};
        g_authorize_method : {(interface_: DBusInterfaceSkeleton, invocation: DBusMethodInvocation) : boolean;};
    
    }
    
    
    
    class DBusInterfaceSkeletonPrivate {
    
    
    }
    
    
    
    class DBusInterfaceVTable {
        public method_call: DBusInterfaceMethodCallFunc;
        public get_property: DBusInterfaceGetPropertyFunc;
        public set_property: DBusInterfaceSetPropertyFunc;
        public padding: any[];
    
    
    }
    
    
    
    class DBusMethodInfo {
        public ref_count: number;
        public name: string;
        public in_args: DBusArgInfo[];
        public out_args: DBusArgInfo[];
        public annotations: DBusAnnotationInfo[];
    
    
        public ref () : DBusMethodInfo;
        public unref () : void;
    }
    
    
    
    class DBusNodeInfo {
        public ref_count: number;
        public path: string;
        public interfaces: DBusInterfaceInfo[];
        public nodes: DBusNodeInfo[];
        public annotations: DBusAnnotationInfo[];
    
    
        public generate_xml (indent: number, string_builder: GLib.String) : void;
        public lookup_interface (name: string) : DBusInterfaceInfo;
        public ref () : DBusNodeInfo;
        public unref () : void;
    }
    
    
    
    class DBusObjectIface {
        public parent_iface: GObject.TypeInterface;
    
        get_object_path : {(object: DBusObject) : string;};
        get_interfaces : {(object: DBusObject) : GLib.List;};
        get_interface : {(object: DBusObject, interface_name: string) : DBusInterface;};
        interface_added : {(object: DBusObject, interface_: DBusInterface) : void;};
        interface_removed : {(object: DBusObject, interface_: DBusInterface) : void;};
    
    }
    
    
    
    class DBusObjectManagerClientClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        interface_proxy_signal : {(manager: DBusObjectManagerClient, object_proxy: DBusObjectProxy, interface_proxy: DBusProxy, sender_name: string, signal_name: string, parameters: GLib.Variant) : void;};
        interface_proxy_properties_changed : {(manager: DBusObjectManagerClient, object_proxy: DBusObjectProxy, interface_proxy: DBusProxy, changed_properties: GLib.Variant, invalidated_properties: string) : void;};
    
    }
    
    
    
    class DBusObjectManagerClientPrivate {
    
    
    }
    
    
    
    class DBusObjectManagerIface {
        public parent_iface: GObject.TypeInterface;
    
        get_object_path : {(manager: DBusObjectManager) : string;};
        get_objects : {(manager: DBusObjectManager) : GLib.List;};
        get_object : {(manager: DBusObjectManager, object_path: string) : DBusObject;};
        get_interface : {(manager: DBusObjectManager, object_path: string, interface_name: string) : DBusInterface;};
        object_added : {(manager: DBusObjectManager, object: DBusObject) : void;};
        object_removed : {(manager: DBusObjectManager, object: DBusObject) : void;};
        interface_added : {(manager: DBusObjectManager, object: DBusObject, interface_: DBusInterface) : void;};
        interface_removed : {(manager: DBusObjectManager, object: DBusObject, interface_: DBusInterface) : void;};
    
    }
    
    
    
    class DBusObjectManagerServerClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
    
    }
    
    
    
    class DBusObjectManagerServerPrivate {
    
    
    }
    
    
    
    class DBusObjectProxyClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
    
    }
    
    
    
    class DBusObjectProxyPrivate {
    
    
    }
    
    
    
    class DBusObjectSkeletonClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        authorize_method : {(object: DBusObjectSkeleton, interface_: DBusInterfaceSkeleton, invocation: DBusMethodInvocation) : boolean;};
    
    }
    
    
    
    class DBusObjectSkeletonPrivate {
    
    
    }
    
    
    
    class DBusPropertyInfo {
        public ref_count: number;
        public name: string;
        public signature: string;
        public flags: DBusPropertyInfoFlags;
        public annotations: DBusAnnotationInfo[];
    
    
        public ref () : DBusPropertyInfo;
        public unref () : void;
    }
    
    
    
    class DBusProxyClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        g_properties_changed : {(proxy: DBusProxy, changed_properties: GLib.Variant, invalidated_properties: string) : void;};
        g_signal : {(proxy: DBusProxy, sender_name: string, signal_name: string, parameters: GLib.Variant) : void;};
    
    }
    
    
    
    class DBusProxyPrivate {
    
    
    }
    
    
    
    class DBusSignalInfo {
        public ref_count: number;
        public name: string;
        public args: DBusArgInfo[];
        public annotations: DBusAnnotationInfo[];
    
    
        public ref () : DBusSignalInfo;
        public unref () : void;
    }
    
    
    
    class DBusSubtreeVTable {
        public enumerate: DBusSubtreeEnumerateFunc;
        public introspect: DBusSubtreeIntrospectFunc;
        public dispatch: DBusSubtreeDispatchFunc;
        public padding: any[];
    
    
    }
    
    
    
    class DataInputStreamClass {
        public parent_class: BufferedInputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class DataInputStreamPrivate {
    
    
    }
    
    
    
    class DataOutputStreamClass {
        public parent_class: FilterOutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class DataOutputStreamPrivate {
    
    
    }
    
    
    
    class DatagramBasedInterface {
        public g_iface: GObject.TypeInterface;
    
        receive_messages : {(datagram_based: DatagramBased, messages: InputMessage[], num_messages: number, flags: number, timeout: number, cancellable: Cancellable) : number;};
        send_messages : {(datagram_based: DatagramBased, messages: OutputMessage[], num_messages: number, flags: number, timeout: number, cancellable: Cancellable) : number;};
        create_source : {(datagram_based: DatagramBased, condition: GLib.IOCondition, cancellable: Cancellable) : GLib.Source;};
        condition_check : {(datagram_based: DatagramBased, condition: GLib.IOCondition) : GLib.IOCondition;};
        condition_wait : {(datagram_based: DatagramBased, condition: GLib.IOCondition, timeout: number, cancellable: Cancellable) : boolean;};
    
    }
    
    
    
    class DesktopAppInfoClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class DesktopAppInfoLookupIface {
        public g_iface: GObject.TypeInterface;
    
        get_default_for_uri_scheme : {(lookup: DesktopAppInfoLookup, uri_scheme: string) : AppInfo;};
    
    }
    
    
    
    class DriveIface {
        public g_iface: GObject.TypeInterface;
    
        changed : {(drive: Drive) : void;};
        disconnected : {(drive: Drive) : void;};
        eject_button : {(drive: Drive) : void;};
        get_name : {(drive: Drive) : string;};
        get_icon : {(drive: Drive) : Icon;};
        has_volumes : {(drive: Drive) : boolean;};
        get_volumes : {(drive: Drive) : GLib.List;};
        is_media_removable : {(drive: Drive) : boolean;};
        has_media : {(drive: Drive) : boolean;};
        is_media_check_automatic : {(drive: Drive) : boolean;};
        can_eject : {(drive: Drive) : boolean;};
        can_poll_for_media : {(drive: Drive) : boolean;};
        eject : {(drive: Drive, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_finish : {(drive: Drive, result: AsyncResult) : boolean;};
        poll_for_media : {(drive: Drive, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        poll_for_media_finish : {(drive: Drive, result: AsyncResult) : boolean;};
        get_identifier : {(drive: Drive, kind: string) : string;};
        enumerate_identifiers : {(drive: Drive) : string[];};
        get_start_stop_type : {(drive: Drive) : DriveStartStopType;};
        can_start : {(drive: Drive) : boolean;};
        can_start_degraded : {(drive: Drive) : boolean;};
        start : {(drive: Drive, flags: DriveStartFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        start_finish : {(drive: Drive, result: AsyncResult) : boolean;};
        can_stop : {(drive: Drive) : boolean;};
        stop : {(drive: Drive, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        stop_finish : {(drive: Drive, result: AsyncResult) : boolean;};
        stop_button : {(drive: Drive) : void;};
        eject_with_operation : {(drive: Drive, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_with_operation_finish : {(drive: Drive, result: AsyncResult) : boolean;};
        get_sort_key : {(drive: Drive) : string;};
        get_symbolic_icon : {(drive: Drive) : Icon;};
        is_removable : {(drive: Drive) : boolean;};
    
    }
    
    
    
    class DtlsClientConnectionInterface {
        public g_iface: GObject.TypeInterface;
    
    
    }
    
    
    
    class DtlsConnectionInterface {
        public g_iface: GObject.TypeInterface;
    
        accept_certificate : {(connection: DtlsConnection, peer_cert: TlsCertificate, errors: TlsCertificateFlags) : boolean;};
        handshake : {(conn: DtlsConnection, cancellable: Cancellable) : boolean;};
        handshake_async : {(conn: DtlsConnection, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        handshake_finish : {(conn: DtlsConnection, result: AsyncResult) : boolean;};
        shutdown : {(conn: DtlsConnection, shutdown_read: boolean, shutdown_write: boolean, cancellable: Cancellable) : boolean;};
        shutdown_async : {(conn: DtlsConnection, shutdown_read: boolean, shutdown_write: boolean, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        shutdown_finish : {(conn: DtlsConnection, result: AsyncResult) : boolean;};
        set_advertised_protocols : {(conn: DtlsConnection, protocols: string[]) : void;};
        get_negotiated_protocol : {(conn: DtlsConnection) : string;};
    
    }
    
    
    
    class DtlsServerConnectionInterface {
        public g_iface: GObject.TypeInterface;
    
    
    }
    
    
    
    class EmblemClass {
    
    
    }
    
    
    
    class EmblemedIconClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class EmblemedIconPrivate {
    
    
    }
    
    
    
    class FileAttributeInfo {
        public name: string;
        public type: FileAttributeType;
        public flags: FileAttributeInfoFlags;
    
    
    }
    
    
    
    class FileAttributeInfoList {
        public infos: FileAttributeInfo;
        public n_infos: number;
    
    
        public add (name: string, _type: FileAttributeType, flags: FileAttributeInfoFlags) : void;
        public dup () : FileAttributeInfoList;
        public lookup (name: string) : FileAttributeInfo;
        public ref () : FileAttributeInfoList;
        public unref () : void;
    }
    
    
    
    class FileAttributeMatcher {
    
    
        public enumerate_namespace (_ns: string) : boolean;
        public enumerate_next () : string;
        public matches (attribute: string) : boolean;
        public matches_only (attribute: string) : boolean;
        public ref () : FileAttributeMatcher;
        public subtract (subtract: FileAttributeMatcher) : FileAttributeMatcher;
        public to_string () : string;
        public unref () : void;
    }
    
    
    
    class FileDescriptorBasedIface {
        public g_iface: GObject.TypeInterface;
    
        get_fd : {(fd_based: FileDescriptorBased) : number;};
    
    }
    
    
    
    class FileEnumeratorClass {
        public parent_class: GObject.ObjectClass;
    
        next_file : {(enumerator: FileEnumerator, cancellable: Cancellable) : FileInfo;};
        close_fn : {(enumerator: FileEnumerator, cancellable: Cancellable) : boolean;};
        next_files_async : {(enumerator: FileEnumerator, num_files: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        next_files_finish : {(enumerator: FileEnumerator, result: AsyncResult) : GLib.List;};
        close_async : {(enumerator: FileEnumerator, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        close_finish : {(enumerator: FileEnumerator, result: AsyncResult) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
    
    }
    
    
    
    class FileEnumeratorPrivate {
    
    
    }
    
    
    
    class FileIOStreamClass {
        public parent_class: IOStreamClass;
    
        tell : {(stream: FileIOStream) : number;};
        can_seek : {(stream: FileIOStream) : boolean;};
        seek : {(stream: FileIOStream, offset: number, _type: GLib.SeekType, cancellable: Cancellable) : boolean;};
        can_truncate : {(stream: FileIOStream) : boolean;};
        truncate_fn : {(stream: FileIOStream, size: number, cancellable: Cancellable) : boolean;};
        query_info : {(stream: FileIOStream, attributes: string, cancellable: Cancellable) : FileInfo;};
        query_info_async : {(stream: FileIOStream, attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        query_info_finish : {(stream: FileIOStream, result: AsyncResult) : FileInfo;};
        get_etag : {(stream: FileIOStream) : string;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class FileIOStreamPrivate {
    
    
    }
    
    
    
    class FileIconClass {
    
    
    }
    
    
    
    class FileIface {
        public g_iface: GObject.TypeInterface;
        public supports_thread_contexts: boolean;
    
        dup : {(file: File) : File;};
        hash : {(file: File) : number;};
        equal : {(file1: File, file2: File) : boolean;};
        is_native : {(file: File) : boolean;};
        has_uri_scheme : {(file: File, uri_scheme: string) : boolean;};
        get_uri_scheme : {(file: File) : string;};
        get_basename : {(file: File) : string;};
        get_path : {(file: File) : string;};
        get_uri : {(file: File) : string;};
        get_parse_name : {(file: File) : string;};
        get_parent : {(file: File) : File;};
        prefix_matches : {(prefix: File, file: File) : boolean;};
        get_relative_path : {(parent: File, descendant: File) : string;};
        resolve_relative_path : {(file: File, relative_path: string) : File;};
        get_child_for_display_name : {(file: File, display_name: string) : File;};
        enumerate_children : {(file: File, attributes: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : FileEnumerator;};
        enumerate_children_async : {(file: File, attributes: string, flags: FileQueryInfoFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        enumerate_children_finish : {(file: File, res: AsyncResult) : FileEnumerator;};
        query_info : {(file: File, attributes: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : FileInfo;};
        query_info_async : {(file: File, attributes: string, flags: FileQueryInfoFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        query_info_finish : {(file: File, res: AsyncResult) : FileInfo;};
        query_filesystem_info : {(file: File, attributes: string, cancellable: Cancellable) : FileInfo;};
        query_filesystem_info_async : {(file: File, attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        query_filesystem_info_finish : {(file: File, res: AsyncResult) : FileInfo;};
        find_enclosing_mount : {(file: File, cancellable: Cancellable) : Mount;};
        find_enclosing_mount_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        find_enclosing_mount_finish : {(file: File, res: AsyncResult) : Mount;};
        set_display_name : {(file: File, display_name: string, cancellable: Cancellable) : File;};
        set_display_name_async : {(file: File, display_name: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        set_display_name_finish : {(file: File, res: AsyncResult) : File;};
        query_settable_attributes : {(file: File, cancellable: Cancellable) : FileAttributeInfoList;};
        _query_settable_attributes_async : {() : void;};
        _query_settable_attributes_finish : {() : void;};
        query_writable_namespaces : {(file: File, cancellable: Cancellable) : FileAttributeInfoList;};
        _query_writable_namespaces_async : {() : void;};
        _query_writable_namespaces_finish : {() : void;};
        set_attribute : {(file: File, attribute: string, _type: FileAttributeType, value_p: any, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;};
        set_attributes_from_info : {(file: File, info: FileInfo, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;};
        set_attributes_async : {(file: File, info: FileInfo, flags: FileQueryInfoFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        set_attributes_finish : {(file: File, result: AsyncResult, info: FileInfo) : boolean;};
        read_fn : {(file: File, cancellable: Cancellable) : FileInputStream;};
        read_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        read_finish : {(file: File, res: AsyncResult) : FileInputStream;};
        append_to : {(file: File, flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;};
        append_to_async : {(file: File, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        append_to_finish : {(file: File, res: AsyncResult) : FileOutputStream;};
        create : {(file: File, flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;};
        create_async : {(file: File, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        create_finish : {(file: File, res: AsyncResult) : FileOutputStream;};
        replace : {(file: File, etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;};
        replace_async : {(file: File, etag: string, make_backup: boolean, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        replace_finish : {(file: File, res: AsyncResult) : FileOutputStream;};
        delete_file : {(file: File, cancellable: Cancellable) : boolean;};
        delete_file_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        delete_file_finish : {(file: File, result: AsyncResult) : boolean;};
        trash : {(file: File, cancellable: Cancellable) : boolean;};
        trash_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        trash_finish : {(file: File, result: AsyncResult) : boolean;};
        make_directory : {(file: File, cancellable: Cancellable) : boolean;};
        make_directory_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        make_directory_finish : {(file: File, result: AsyncResult) : boolean;};
        make_symbolic_link : {(file: File, symlink_value: string, cancellable: Cancellable) : boolean;};
        _make_symbolic_link_async : {() : void;};
        _make_symbolic_link_finish : {() : void;};
        copy : {(source: File, destination: File, flags: FileCopyFlags, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any) : boolean;};
        copy_async : {(source: File, destination: File, flags: FileCopyFlags, io_priority: number, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any, callback: AsyncReadyCallback, user_data: any) : void;};
        copy_finish : {(file: File, res: AsyncResult) : boolean;};
        move : {(source: File, destination: File, flags: FileCopyFlags, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any) : boolean;};
        _move_async : {() : void;};
        _move_finish : {() : void;};
        mount_mountable : {(file: File, flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        mount_mountable_finish : {(file: File, result: AsyncResult) : File;};
        unmount_mountable : {(file: File, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        unmount_mountable_finish : {(file: File, result: AsyncResult) : boolean;};
        eject_mountable : {(file: File, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_mountable_finish : {(file: File, result: AsyncResult) : boolean;};
        mount_enclosing_volume : {(location: File, flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        mount_enclosing_volume_finish : {(location: File, result: AsyncResult) : boolean;};
        monitor_dir : {(file: File, flags: FileMonitorFlags, cancellable: Cancellable) : FileMonitor;};
        monitor_file : {(file: File, flags: FileMonitorFlags, cancellable: Cancellable) : FileMonitor;};
        open_readwrite : {(file: File, cancellable: Cancellable) : FileIOStream;};
        open_readwrite_async : {(file: File, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        open_readwrite_finish : {(file: File, res: AsyncResult) : FileIOStream;};
        create_readwrite : {(file: File, flags: FileCreateFlags, cancellable: Cancellable) : FileIOStream;};
        create_readwrite_async : {(file: File, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        create_readwrite_finish : {(file: File, res: AsyncResult) : FileIOStream;};
        replace_readwrite : {(file: File, etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable) : FileIOStream;};
        replace_readwrite_async : {(file: File, etag: string, make_backup: boolean, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        replace_readwrite_finish : {(file: File, res: AsyncResult) : FileIOStream;};
        start_mountable : {(file: File, flags: DriveStartFlags, start_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        start_mountable_finish : {(file: File, result: AsyncResult) : boolean;};
        stop_mountable : {(file: File, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        stop_mountable_finish : {(file: File, result: AsyncResult) : boolean;};
        unmount_mountable_with_operation : {(file: File, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        unmount_mountable_with_operation_finish : {(file: File, result: AsyncResult) : boolean;};
        eject_mountable_with_operation : {(file: File, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_mountable_with_operation_finish : {(file: File, result: AsyncResult) : boolean;};
        poll_mountable : {(file: File, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        poll_mountable_finish : {(file: File, result: AsyncResult) : boolean;};
        measure_disk_usage : {(file: File, flags: FileMeasureFlags, cancellable: Cancellable, progress_callback: FileMeasureProgressCallback, progress_data: any, disk_usage: number, num_dirs: number, num_files: number) : boolean;};
        measure_disk_usage_async : {(file: File, flags: FileMeasureFlags, io_priority: number, cancellable: Cancellable, progress_callback: FileMeasureProgressCallback, progress_data: any, callback: AsyncReadyCallback, user_data: any) : void;};
        measure_disk_usage_finish : {(file: File, result: AsyncResult, disk_usage: number, num_dirs: number, num_files: number) : boolean;};
    
    }
    
    
    
    class FileInfoClass {
    
    
    }
    
    
    
    class FileInputStreamClass {
        public parent_class: InputStreamClass;
    
        tell : {(stream: FileInputStream) : number;};
        can_seek : {(stream: FileInputStream) : boolean;};
        seek : {(stream: FileInputStream, offset: number, _type: GLib.SeekType, cancellable: Cancellable) : boolean;};
        query_info : {(stream: FileInputStream, attributes: string, cancellable: Cancellable) : FileInfo;};
        query_info_async : {(stream: FileInputStream, attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        query_info_finish : {(stream: FileInputStream, result: AsyncResult) : FileInfo;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class FileInputStreamPrivate {
    
    
    }
    
    
    
    class FileMonitorClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(monitor: FileMonitor, file: File, other_file: File, event_type: FileMonitorEvent) : void;};
        cancel : {(monitor: FileMonitor) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class FileMonitorPrivate {
    
    
    }
    
    
    
    class FileOutputStreamClass {
        public parent_class: OutputStreamClass;
    
        tell : {(stream: FileOutputStream) : number;};
        can_seek : {(stream: FileOutputStream) : boolean;};
        seek : {(stream: FileOutputStream, offset: number, _type: GLib.SeekType, cancellable: Cancellable) : boolean;};
        can_truncate : {(stream: FileOutputStream) : boolean;};
        truncate_fn : {(stream: FileOutputStream, size: number, cancellable: Cancellable) : boolean;};
        query_info : {(stream: FileOutputStream, attributes: string, cancellable: Cancellable) : FileInfo;};
        query_info_async : {(stream: FileOutputStream, attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        query_info_finish : {(stream: FileOutputStream, result: AsyncResult) : FileInfo;};
        get_etag : {(stream: FileOutputStream) : string;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class FileOutputStreamPrivate {
    
    
    }
    
    
    
    class FilenameCompleterClass {
        public parent_class: GObject.ObjectClass;
    
        got_completion_data : {(filename_completer: FilenameCompleter) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
    
    }
    
    
    
    class FilterInputStreamClass {
        public parent_class: InputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
    
    }
    
    
    
    class FilterOutputStreamClass {
        public parent_class: OutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
    
    }
    
    
    
    class IOExtension {
    
    
        public get_name () : string;
        public get_priority () : number;
        public get_type () : GObject.Type;
        public ref_class () : GObject.TypeClass;
    }
    
    
    
    class IOExtensionPoint {
    
    
        public get_extension_by_name (name: string) : IOExtension;
        public get_extensions () : GLib.List;
        public get_required_type () : GObject.Type;
        public set_required_type (_type: GObject.Type) : void;
    }
    
    
    
    class IOModuleClass {
    
    
    }
    
    
    
    class IOModuleScope {
    
    
        public block (basename: string) : void;
        public free () : void;
    }
    
    
    
    class IOSchedulerJob {
    
    
        public send_to_mainloop (_func: GLib.SourceFunc, user_data: any, notify: GLib.DestroyNotify) : boolean;
        public send_to_mainloop_async (_func: GLib.SourceFunc, user_data: any, notify: GLib.DestroyNotify) : void;
    }
    
    
    
    class IOStreamAdapter {
    
    
    }
    
    
    
    class IOStreamClass {
        public parent_class: GObject.ObjectClass;
    
        get_input_stream : {(stream: IOStream) : InputStream;};
        get_output_stream : {(stream: IOStream) : OutputStream;};
        close_fn : {(stream: IOStream, cancellable: Cancellable) : boolean;};
        close_async : {(stream: IOStream, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        close_finish : {(stream: IOStream, result: AsyncResult) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
        _g_reserved8 : {() : void;};
        _g_reserved9 : {() : void;};
        _g_reserved10 : {() : void;};
    
    }
    
    
    
    class IOStreamPrivate {
    
    
    }
    
    
    
    class IconIface {
        public g_iface: GObject.TypeInterface;
    
        hash : {(icon: Icon) : number;};
        equal : {(icon1: Icon, icon2: Icon) : boolean;};
        to_tokens : {(icon: Icon, tokens: any[], out_version: number) : boolean;};
        from_tokens : {(tokens: string, num_tokens: number, version: number) : Icon;};
        serialize : {(icon: Icon) : GLib.Variant;};
    
    }
    
    
    
    class InetAddressClass {
        public parent_class: GObject.ObjectClass;
    
        to_string : {(address: InetAddress) : string;};
        to_bytes : {(address: InetAddress) : number;};
    
    }
    
    
    
    class InetAddressMaskClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class InetAddressMaskPrivate {
    
    
    }
    
    
    
    class InetAddressPrivate {
    
    
    }
    
    
    
    class InetSocketAddressClass {
        public parent_class: SocketAddressClass;
    
    
    }
    
    
    
    class InetSocketAddressPrivate {
    
    
    }
    
    
    
    class InitableIface {
        public g_iface: GObject.TypeInterface;
    
        init : {(initable: Initable, cancellable: Cancellable) : boolean;};
    
    }
    
    
    
    class InputMessage {
        public address: SocketAddress;
        public vectors: InputVector[];
        public num_vectors: number;
        public bytes_received: number;
        public flags: number;
        public control_messages: SocketControlMessage[];
        public num_control_messages: number;
    
    
    }
    
    
    
    class InputStreamClass {
        public parent_class: GObject.ObjectClass;
    
        read_fn : {(stream: InputStream, buffer: any, count: number, cancellable: Cancellable) : number;};
        skip : {(stream: InputStream, count: number, cancellable: Cancellable) : number;};
        close_fn : {(stream: InputStream, cancellable: Cancellable) : boolean;};
        read_async : {(stream: InputStream, buffer: number[], count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        read_finish : {(stream: InputStream, result: AsyncResult) : number;};
        skip_async : {(stream: InputStream, count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        skip_finish : {(stream: InputStream, result: AsyncResult) : number;};
        close_async : {(stream: InputStream, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        close_finish : {(stream: InputStream, result: AsyncResult) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class InputStreamPrivate {
    
    
    }
    
    
    
    class InputVector {
        public buffer: any;
        public size: number;
    
    
    }
    
    
    
    class ListModelInterface {
        public g_iface: GObject.TypeInterface;
    
        get_item_type : {(list: ListModel) : GObject.Type;};
        get_n_items : {(list: ListModel) : number;};
        get_item : {(list: ListModel, position: number) : GObject.Object;};
    
    }
    
    
    
    class ListStoreClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class LoadableIconIface {
        public g_iface: GObject.TypeInterface;
    
        load : {(icon: LoadableIcon, size: number, _type: string, cancellable: Cancellable) : InputStream;};
        load_async : {(icon: LoadableIcon, size: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        load_finish : {(icon: LoadableIcon, res: AsyncResult, _type: string) : InputStream;};
    
    }
    
    
    
    class MemoryInputStreamClass {
        public parent_class: InputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class MemoryInputStreamPrivate {
    
    
    }
    
    
    
    class MemoryOutputStreamClass {
        public parent_class: OutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class MemoryOutputStreamPrivate {
    
    
    }
    
    
    
    class MenuAttributeIterClass {
        public parent_class: GObject.ObjectClass;
    
        get_next : {(iter: MenuAttributeIter, out_name: string, value: GLib.Variant) : boolean;};
    
    }
    
    
    
    class MenuAttributeIterPrivate {
    
    
    }
    
    
    
    class MenuLinkIterClass {
        public parent_class: GObject.ObjectClass;
    
        get_next : {(iter: MenuLinkIter, out_link: string, value: MenuModel) : boolean;};
    
    }
    
    
    
    class MenuLinkIterPrivate {
    
    
    }
    
    
    
    class MenuModelClass {
        public parent_class: GObject.ObjectClass;
    
        is_mutable : {(model: MenuModel) : boolean;};
        get_n_items : {(model: MenuModel) : number;};
        get_item_attributes : {(model: MenuModel, item_index: number, attributes: GLib.HashTable) : void;};
        iterate_item_attributes : {(model: MenuModel, item_index: number) : MenuAttributeIter;};
        get_item_attribute_value : {(model: MenuModel, item_index: number, attribute: string, expected_type: GLib.VariantType) : GLib.Variant;};
        get_item_links : {(model: MenuModel, item_index: number, links: GLib.HashTable) : void;};
        iterate_item_links : {(model: MenuModel, item_index: number) : MenuLinkIter;};
        get_item_link : {(model: MenuModel, item_index: number, link: string) : MenuModel;};
    
    }
    
    
    
    class MenuModelPrivate {
    
    
    }
    
    
    
    class MountIface {
        public g_iface: GObject.TypeInterface;
    
        changed : {(mount: Mount) : void;};
        unmounted : {(mount: Mount) : void;};
        get_root : {(mount: Mount) : File;};
        get_name : {(mount: Mount) : string;};
        get_icon : {(mount: Mount) : Icon;};
        get_uuid : {(mount: Mount) : string;};
        get_volume : {(mount: Mount) : Volume;};
        get_drive : {(mount: Mount) : Drive;};
        can_unmount : {(mount: Mount) : boolean;};
        can_eject : {(mount: Mount) : boolean;};
        unmount : {(mount: Mount, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        unmount_finish : {(mount: Mount, result: AsyncResult) : boolean;};
        eject : {(mount: Mount, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_finish : {(mount: Mount, result: AsyncResult) : boolean;};
        remount : {(mount: Mount, flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        remount_finish : {(mount: Mount, result: AsyncResult) : boolean;};
        guess_content_type : {(mount: Mount, force_rescan: boolean, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        guess_content_type_finish : {(mount: Mount, result: AsyncResult) : string[];};
        guess_content_type_sync : {(mount: Mount, force_rescan: boolean, cancellable: Cancellable) : string[];};
        pre_unmount : {(mount: Mount) : void;};
        unmount_with_operation : {(mount: Mount, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        unmount_with_operation_finish : {(mount: Mount, result: AsyncResult) : boolean;};
        eject_with_operation : {(mount: Mount, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_with_operation_finish : {(mount: Mount, result: AsyncResult) : boolean;};
        get_default_location : {(mount: Mount) : File;};
        get_sort_key : {(mount: Mount) : string;};
        get_symbolic_icon : {(mount: Mount) : Icon;};
    
    }
    
    
    
    class MountOperationClass {
        public parent_class: GObject.ObjectClass;
    
        ask_password : {(op: MountOperation, message: string, default_user: string, default_domain: string, flags: AskPasswordFlags) : void;};
        ask_question : {(op: MountOperation, message: string, choices: string[]) : void;};
        reply : {(op: MountOperation, result: MountOperationResult) : void;};
        aborted : {(op: MountOperation) : void;};
        show_processes : {(op: MountOperation, message: string, processes: GLib.Pid[], choices: string[]) : void;};
        show_unmount_progress : {(op: MountOperation, message: string, time_left: number, bytes_left: number) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
        _g_reserved8 : {() : void;};
        _g_reserved9 : {() : void;};
    
    }
    
    
    
    class MountOperationPrivate {
    
    
    }
    
    
    
    class NativeSocketAddress {
    
    
    }
    
    
    
    class NativeVolumeMonitorClass {
        public parent_class: VolumeMonitorClass;
    
        get_mount_for_mount_path : {(mount_path: string, cancellable: Cancellable) : Mount;};
    
    }
    
    
    
    class NetworkAddressClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class NetworkAddressPrivate {
    
    
    }
    
    
    
    class NetworkMonitorInterface {
        public g_iface: GObject.TypeInterface;
    
        network_changed : {(monitor: NetworkMonitor, network_available: boolean) : void;};
        can_reach : {(monitor: NetworkMonitor, connectable: SocketConnectable, cancellable: Cancellable) : boolean;};
        can_reach_async : {(monitor: NetworkMonitor, connectable: SocketConnectable, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        can_reach_finish : {(monitor: NetworkMonitor, result: AsyncResult) : boolean;};
    
    }
    
    
    
    class NetworkServiceClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class NetworkServicePrivate {
    
    
    }
    
    
    
    class OutputMessage {
        public address: SocketAddress;
        public vectors: OutputVector;
        public num_vectors: number;
        public bytes_sent: number;
        public control_messages: SocketControlMessage[];
        public num_control_messages: number;
    
    
    }
    
    
    
    class OutputStreamClass {
        public parent_class: GObject.ObjectClass;
    
        write_fn : {(stream: OutputStream, buffer: number[], count: number, cancellable: Cancellable) : number;};
        splice : {(stream: OutputStream, source: InputStream, flags: OutputStreamSpliceFlags, cancellable: Cancellable) : number;};
        flush : {(stream: OutputStream, cancellable: Cancellable) : boolean;};
        close_fn : {(stream: OutputStream, cancellable: Cancellable) : boolean;};
        write_async : {(stream: OutputStream, buffer: number[], count: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        write_finish : {(stream: OutputStream, result: AsyncResult) : number;};
        splice_async : {(stream: OutputStream, source: InputStream, flags: OutputStreamSpliceFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        splice_finish : {(stream: OutputStream, result: AsyncResult) : number;};
        flush_async : {(stream: OutputStream, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        flush_finish : {(stream: OutputStream, result: AsyncResult) : boolean;};
        close_async : {(stream: OutputStream, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        close_finish : {(stream: OutputStream, result: AsyncResult) : boolean;};
        writev_fn : {(stream: OutputStream, vectors: OutputVector[], n_vectors: number, bytes_written: number, cancellable: Cancellable) : boolean;};
        writev_async : {(stream: OutputStream, vectors: OutputVector[], n_vectors: number, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        writev_finish : {(stream: OutputStream, result: AsyncResult, bytes_written: number) : boolean;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
        _g_reserved8 : {() : void;};
    
    }
    
    
    
    class OutputStreamPrivate {
    
    
    }
    
    
    
    class OutputVector {
        public buffer: any;
        public size: number;
    
    
    }
    
    
    
    class PermissionClass {
        public parent_class: GObject.ObjectClass;
        public reserved: any[];
    
        acquire : {(permission: Permission, cancellable: Cancellable) : boolean;};
        acquire_async : {(permission: Permission, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        acquire_finish : {(permission: Permission, result: AsyncResult) : boolean;};
        release : {(permission: Permission, cancellable: Cancellable) : boolean;};
        release_async : {(permission: Permission, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        release_finish : {(permission: Permission, result: AsyncResult) : boolean;};
    
    }
    
    
    
    class PermissionPrivate {
    
    
    }
    
    
    
    class PollableInputStreamInterface {
        public g_iface: GObject.TypeInterface;
    
        can_poll : {(stream: PollableInputStream) : boolean;};
        is_readable : {(stream: PollableInputStream) : boolean;};
        create_source : {(stream: PollableInputStream, cancellable: Cancellable) : GLib.Source;};
        read_nonblocking : {(stream: PollableInputStream, buffer: number[], count: number) : number;};
    
    }
    
    
    
    class PollableOutputStreamInterface {
        public g_iface: GObject.TypeInterface;
    
        can_poll : {(stream: PollableOutputStream) : boolean;};
        is_writable : {(stream: PollableOutputStream) : boolean;};
        create_source : {(stream: PollableOutputStream, cancellable: Cancellable) : GLib.Source;};
        write_nonblocking : {(stream: PollableOutputStream, buffer: number[], count: number) : number;};
        writev_nonblocking : {(stream: PollableOutputStream, vectors: OutputVector[], n_vectors: number, bytes_written: number) : PollableReturn;};
    
    }
    
    
    
    class ProxyAddressClass {
        public parent_class: InetSocketAddressClass;
    
    
    }
    
    
    
    class ProxyAddressEnumeratorClass {
        public parent_class: SocketAddressEnumeratorClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
    
    }
    
    
    
    class ProxyAddressEnumeratorPrivate {
    
    
    }
    
    
    
    class ProxyAddressPrivate {
    
    
    }
    
    
    
    class ProxyInterface {
        public g_iface: GObject.TypeInterface;
    
        connect : {(proxy: Proxy, connection: IOStream, proxy_address: ProxyAddress, cancellable: Cancellable) : IOStream;};
        connect_async : {(proxy: Proxy, connection: IOStream, proxy_address: ProxyAddress, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        connect_finish : {(proxy: Proxy, result: AsyncResult) : IOStream;};
        supports_hostname : {(proxy: Proxy) : boolean;};
    
    }
    
    
    
    class ProxyResolverInterface {
        public g_iface: GObject.TypeInterface;
    
        is_supported : {(resolver: ProxyResolver) : boolean;};
        lookup : {(resolver: ProxyResolver, uri: string, cancellable: Cancellable) : string[];};
        lookup_async : {(resolver: ProxyResolver, uri: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_finish : {(resolver: ProxyResolver, result: AsyncResult) : string[];};
    
    }
    
    
    
    class RemoteActionGroupInterface {
        public g_iface: GObject.TypeInterface;
    
        activate_action_full : {(remote: RemoteActionGroup, action_name: string, parameter: GLib.Variant, platform_data: GLib.Variant) : void;};
        change_action_state_full : {(remote: RemoteActionGroup, action_name: string, value: GLib.Variant, platform_data: GLib.Variant) : void;};
    
    }
    
    
    
    class ResolverClass {
        public parent_class: GObject.ObjectClass;
    
        reload : {(resolver: Resolver) : void;};
        lookup_by_name : {(resolver: Resolver, hostname: string, cancellable: Cancellable) : GLib.List;};
        lookup_by_name_async : {(resolver: Resolver, hostname: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_by_name_finish : {(resolver: Resolver, result: AsyncResult) : GLib.List;};
        lookup_by_address : {(resolver: Resolver, address: InetAddress, cancellable: Cancellable) : string;};
        lookup_by_address_async : {(resolver: Resolver, address: InetAddress, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_by_address_finish : {(resolver: Resolver, result: AsyncResult) : string;};
        lookup_service : {(resolver: Resolver, rrname: string, cancellable: Cancellable) : GLib.List;};
        lookup_service_async : {(resolver: Resolver, rrname: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_service_finish : {(resolver: Resolver, result: AsyncResult) : GLib.List;};
        lookup_records : {(resolver: Resolver, rrname: string, record_type: ResolverRecordType, cancellable: Cancellable) : GLib.List;};
        lookup_records_async : {(resolver: Resolver, rrname: string, record_type: ResolverRecordType, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_records_finish : {(resolver: Resolver, result: AsyncResult) : GLib.List;};
        lookup_by_name_with_flags_async : {(resolver: Resolver, hostname: string, flags: ResolverNameLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_by_name_with_flags_finish : {(resolver: Resolver, result: AsyncResult) : GLib.List;};
        lookup_by_name_with_flags : {(resolver: Resolver, hostname: string, flags: ResolverNameLookupFlags, cancellable: Cancellable) : GLib.List;};
    
    }
    
    
    
    class ResolverPrivate {
    
    
    }
    
    
    
    class Resource {
    
    
        public _register () : void;
        public _unregister () : void;
        public enumerate_children (path: string, lookup_flags: ResourceLookupFlags) : string[];
        public get_info (path: string, lookup_flags: ResourceLookupFlags, size: number, flags: number) : boolean;
        public lookup_data (path: string, lookup_flags: ResourceLookupFlags) : GLib.Bytes;
        public open_stream (path: string, lookup_flags: ResourceLookupFlags) : InputStream;
        public ref () : Resource;
        public unref () : void;
    }
    
    
    
    class SeekableIface {
        public g_iface: GObject.TypeInterface;
    
        tell : {(seekable: Seekable) : number;};
        can_seek : {(seekable: Seekable) : boolean;};
        seek : {(seekable: Seekable, offset: number, _type: GLib.SeekType, cancellable: Cancellable) : boolean;};
        can_truncate : {(seekable: Seekable) : boolean;};
        truncate_fn : {(seekable: Seekable, offset: number, cancellable: Cancellable) : boolean;};
    
    }
    
    
    
    class SettingsBackendClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        read : {(backend: SettingsBackend, key: string, expected_type: GLib.VariantType, default_value: boolean) : GLib.Variant;};
        get_writable : {(backend: SettingsBackend, key: string) : boolean;};
        write : {(backend: SettingsBackend, key: string, value: GLib.Variant, origin_tag: any) : boolean;};
        write_tree : {(backend: SettingsBackend, tree: GLib.Tree, origin_tag: any) : boolean;};
        reset : {(backend: SettingsBackend, key: string, origin_tag: any) : void;};
        subscribe : {(backend: SettingsBackend, name: string) : void;};
        unsubscribe : {(backend: SettingsBackend, name: string) : void;};
        sync : {(backend: SettingsBackend) : void;};
        get_permission : {(backend: SettingsBackend, path: string) : Permission;};
        read_user_value : {(backend: SettingsBackend, key: string, expected_type: GLib.VariantType) : GLib.Variant;};
    
    }
    
    
    
    class SettingsBackendPrivate {
    
    
    }
    
    
    
    class SettingsClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        writable_changed : {(settings: Settings, key: string) : void;};
        changed : {(settings: Settings, key: string) : void;};
        writable_change_event : {(settings: Settings, key: GLib.Quark) : boolean;};
        change_event : {(settings: Settings, keys: GLib.Quark, n_keys: number) : boolean;};
    
    }
    
    
    
    class SettingsPrivate {
    
    
    }
    
    
    
    class SettingsSchema {
    
    
        public get_id () : string;
        public get_key (name: string) : SettingsSchemaKey;
        public get_path () : string;
        public has_key (name: string) : boolean;
        public list_children () : string[];
        public list_keys () : string[];
        public ref () : SettingsSchema;
        public unref () : void;
    }
    
    
    
    class SettingsSchemaKey {
    
    
        public get_default_value () : GLib.Variant;
        public get_description () : string;
        public get_name () : string;
        public get_range () : GLib.Variant;
        public get_summary () : string;
        public get_value_type () : GLib.VariantType;
        public range_check (value: GLib.Variant) : boolean;
        public ref () : SettingsSchemaKey;
        public unref () : void;
    }
    
    
    
    class SettingsSchemaSource {
    
    
        public list_schemas (recursive: boolean, non_relocatable: string[], relocatable: string[]) : void;
        public lookup (schema_id: string, recursive: boolean) : SettingsSchema;
        public ref () : SettingsSchemaSource;
        public unref () : void;
    }
    
    
    
    class SimpleActionGroupClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
    
    }
    
    
    
    class SimpleActionGroupPrivate {
    
    
    }
    
    
    
    class SimpleAsyncResultClass {
    
    
    }
    
    
    
    class SimpleProxyResolverClass {
        public parent_class: GObject.ObjectClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class SimpleProxyResolverPrivate {
    
    
    }
    
    
    
    class SocketAddressClass {
        public parent_class: GObject.ObjectClass;
    
        get_family : {(address: SocketAddress) : SocketFamily;};
        get_native_size : {(address: SocketAddress) : number;};
        to_native : {(address: SocketAddress, dest: any, destlen: number) : boolean;};
    
    }
    
    
    
    class SocketAddressEnumeratorClass {
        public parent_class: GObject.ObjectClass;
    
        next : {(enumerator: SocketAddressEnumerator, cancellable: Cancellable) : SocketAddress;};
        next_async : {(enumerator: SocketAddressEnumerator, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        next_finish : {(enumerator: SocketAddressEnumerator, result: AsyncResult) : SocketAddress;};
    
    }
    
    
    
    class SocketClass {
        public parent_class: GObject.ObjectClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
        _g_reserved7 : {() : void;};
        _g_reserved8 : {() : void;};
        _g_reserved9 : {() : void;};
        _g_reserved10 : {() : void;};
    
    }
    
    
    
    class SocketClientClass {
        public parent_class: GObject.ObjectClass;
    
        event : {(client: SocketClient, event: SocketClientEvent, connectable: SocketConnectable, connection: IOStream) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
    
    }
    
    
    
    class SocketClientPrivate {
    
    
    }
    
    
    
    class SocketConnectableIface {
        public g_iface: GObject.TypeInterface;
    
        enumerate : {(connectable: SocketConnectable) : SocketAddressEnumerator;};
        proxy_enumerate : {(connectable: SocketConnectable) : SocketAddressEnumerator;};
        to_string : {(connectable: SocketConnectable) : string;};
    
    }
    
    
    
    class SocketConnectionClass {
        public parent_class: IOStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
    
    }
    
    
    
    class SocketConnectionPrivate {
    
    
    }
    
    
    
    class SocketControlMessageClass {
        public parent_class: GObject.ObjectClass;
    
        get_size : {(message: SocketControlMessage) : number;};
        get_level : {(message: SocketControlMessage) : number;};
        get_type : {(message: SocketControlMessage) : number;};
        serialize : {(message: SocketControlMessage, data: any) : void;};
        deserialize : {(level: number, _type: number, size: number, data: any) : SocketControlMessage;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class SocketControlMessagePrivate {
    
    
    }
    
    
    
    class SocketListenerClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(listener: SocketListener) : void;};
        event : {(listener: SocketListener, event: SocketListenerEvent, socket: Socket) : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
    
    }
    
    
    
    class SocketListenerPrivate {
    
    
    }
    
    
    
    class SocketPrivate {
    
    
    }
    
    
    
    class SocketServiceClass {
        public parent_class: SocketListenerClass;
    
        incoming : {(service: SocketService, connection: SocketConnection, source_object: GObject.Object) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
    
    }
    
    
    
    class SocketServicePrivate {
    
    
    }
    
    
    
    class SrvTarget {
    
    
        public copy () : SrvTarget;
        public free () : void;
        public get_hostname () : string;
        public get_port () : number;
        public get_priority () : number;
        public get_weight () : number;
    }
    
    
    
    class StaticResource {
        public data: number;
        public data_len: number;
        public resource: Resource;
        public next: StaticResource;
        public padding: any;
    
    
        public fini () : void;
        public get_resource () : Resource;
        public init () : void;
    }
    
    
    
    class TaskClass {
    
    
    }
    
    
    
    class TcpConnectionClass {
        public parent_class: SocketConnectionClass;
    
    
    }
    
    
    
    class TcpConnectionPrivate {
    
    
    }
    
    
    
    class TcpWrapperConnectionClass {
        public parent_class: TcpConnectionClass;
    
    
    }
    
    
    
    class TcpWrapperConnectionPrivate {
    
    
    }
    
    
    
    class ThemedIconClass {
    
    
    }
    
    
    
    class ThreadedSocketServiceClass {
        public parent_class: SocketServiceClass;
    
        run : {(service: ThreadedSocketService, connection: SocketConnection, source_object: GObject.Object) : boolean;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class ThreadedSocketServicePrivate {
    
    
    }
    
    
    
    class TlsBackendInterface {
        public g_iface: GObject.TypeInterface;
    
        supports_tls : {(backend: TlsBackend) : boolean;};
        get_certificate_type : {() : GObject.Type;};
        get_client_connection_type : {() : GObject.Type;};
        get_server_connection_type : {() : GObject.Type;};
        get_file_database_type : {() : GObject.Type;};
        get_default_database : {(backend: TlsBackend) : TlsDatabase;};
        supports_dtls : {(backend: TlsBackend) : boolean;};
        get_dtls_client_connection_type : {() : GObject.Type;};
        get_dtls_server_connection_type : {() : GObject.Type;};
    
    }
    
    
    
    class TlsCertificateClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        verify : {(cert: TlsCertificate, identity: SocketConnectable, trusted_ca: TlsCertificate) : TlsCertificateFlags;};
    
    }
    
    
    
    class TlsCertificatePrivate {
    
    
    }
    
    
    
    class TlsClientConnectionInterface {
        public g_iface: GObject.TypeInterface;
    
        copy_session_state : {(conn: TlsClientConnection, source: TlsClientConnection) : void;};
    
    }
    
    
    
    class TlsConnectionClass {
        public parent_class: IOStreamClass;
        public padding: any[];
    
        accept_certificate : {(connection: TlsConnection, peer_cert: TlsCertificate, errors: TlsCertificateFlags) : boolean;};
        handshake : {(conn: TlsConnection, cancellable: Cancellable) : boolean;};
        handshake_async : {(conn: TlsConnection, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        handshake_finish : {(conn: TlsConnection, result: AsyncResult) : boolean;};
    
    }
    
    
    
    class TlsConnectionPrivate {
    
    
    }
    
    
    
    class TlsDatabaseClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        verify_chain : {(self: TlsDatabase, chain: TlsCertificate, purpose: string, identity: SocketConnectable, interaction: TlsInteraction, flags: TlsDatabaseVerifyFlags, cancellable: Cancellable) : TlsCertificateFlags;};
        verify_chain_async : {(self: TlsDatabase, chain: TlsCertificate, purpose: string, identity: SocketConnectable, interaction: TlsInteraction, flags: TlsDatabaseVerifyFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        verify_chain_finish : {(self: TlsDatabase, result: AsyncResult) : TlsCertificateFlags;};
        create_certificate_handle : {(self: TlsDatabase, certificate: TlsCertificate) : string;};
        lookup_certificate_for_handle : {(self: TlsDatabase, handle: string, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : TlsCertificate;};
        lookup_certificate_for_handle_async : {(self: TlsDatabase, handle: string, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_certificate_for_handle_finish : {(self: TlsDatabase, result: AsyncResult) : TlsCertificate;};
        lookup_certificate_issuer : {(self: TlsDatabase, certificate: TlsCertificate, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : TlsCertificate;};
        lookup_certificate_issuer_async : {(self: TlsDatabase, certificate: TlsCertificate, interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_certificate_issuer_finish : {(self: TlsDatabase, result: AsyncResult) : TlsCertificate;};
        lookup_certificates_issued_by : {(self: TlsDatabase, issuer_raw_dn: number[], interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable) : GLib.List;};
        lookup_certificates_issued_by_async : {(self: TlsDatabase, issuer_raw_dn: number[], interaction: TlsInteraction, flags: TlsDatabaseLookupFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        lookup_certificates_issued_by_finish : {(self: TlsDatabase, result: AsyncResult) : GLib.List;};
    
    }
    
    
    
    class TlsDatabasePrivate {
    
    
    }
    
    
    
    class TlsFileDatabaseInterface {
        public g_iface: GObject.TypeInterface;
        public padding: any[];
    
    
    }
    
    
    
    class TlsInteractionClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        ask_password : {(interaction: TlsInteraction, password: TlsPassword, cancellable: Cancellable) : TlsInteractionResult;};
        ask_password_async : {(interaction: TlsInteraction, password: TlsPassword, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        ask_password_finish : {(interaction: TlsInteraction, result: AsyncResult) : TlsInteractionResult;};
        request_certificate : {(interaction: TlsInteraction, connection: TlsConnection, flags: TlsCertificateRequestFlags, cancellable: Cancellable) : TlsInteractionResult;};
        request_certificate_async : {(interaction: TlsInteraction, connection: TlsConnection, flags: TlsCertificateRequestFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        request_certificate_finish : {(interaction: TlsInteraction, result: AsyncResult) : TlsInteractionResult;};
    
    }
    
    
    
    class TlsInteractionPrivate {
    
    
    }
    
    
    
    class TlsPasswordClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        get_value : {(password: TlsPassword, length: number) : number;};
        set_value : {(password: TlsPassword, value: number[], length: number, destroy: GLib.DestroyNotify) : void;};
        get_default_warning : {(password: TlsPassword) : string;};
    
    }
    
    
    
    class TlsPasswordPrivate {
    
    
    }
    
    
    
    class TlsServerConnectionInterface {
        public g_iface: GObject.TypeInterface;
    
    
    }
    
    
    
    class UnixConnectionClass {
        public parent_class: SocketConnectionClass;
    
    
    }
    
    
    
    class UnixConnectionPrivate {
    
    
    }
    
    
    
    class UnixCredentialsMessageClass {
        public parent_class: SocketControlMessageClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
    
    }
    
    
    
    class UnixCredentialsMessagePrivate {
    
    
    }
    
    
    
    class UnixFDListClass {
        public parent_class: GObject.ObjectClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class UnixFDListPrivate {
    
    
    }
    
    
    
    class UnixFDMessageClass {
        public parent_class: SocketControlMessageClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
    
    }
    
    
    
    class UnixFDMessagePrivate {
    
    
    }
    
    
    
    class UnixInputStreamClass {
        public parent_class: InputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class UnixInputStreamPrivate {
    
    
    }
    
    
    
    class UnixMountEntry {
    
    
    }
    
    
    
    class UnixMountMonitorClass {
    
    
    }
    
    
    
    class UnixMountPoint {
    
    
        public compare (mount2: UnixMountPoint) : number;
        public copy () : UnixMountPoint;
        public free () : void;
        public get_device_path () : string;
        public get_fs_type () : string;
        public get_mount_path () : string;
        public get_options () : string;
        public guess_can_eject () : boolean;
        public guess_icon () : Icon;
        public guess_name () : string;
        public guess_symbolic_icon () : Icon;
        public is_loopback () : boolean;
        public is_readonly () : boolean;
        public is_user_mountable () : boolean;
    }
    
    
    
    class UnixOutputStreamClass {
        public parent_class: OutputStreamClass;
    
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
    
    }
    
    
    
    class UnixOutputStreamPrivate {
    
    
    }
    
    
    
    class UnixSocketAddressClass {
        public parent_class: SocketAddressClass;
    
    
    }
    
    
    
    class UnixSocketAddressPrivate {
    
    
    }
    
    
    
    class VfsClass {
        public parent_class: GObject.ObjectClass;
    
        is_active : {(vfs: Vfs) : boolean;};
        get_file_for_path : {(vfs: Vfs, path: string) : File;};
        get_file_for_uri : {(vfs: Vfs, uri: string) : File;};
        get_supported_uri_schemes : {(vfs: Vfs) : string[];};
        parse_name : {(vfs: Vfs, parse_name: string) : File;};
        local_file_add_info : {(vfs: Vfs, filename: string, device: number, attribute_matcher: FileAttributeMatcher, info: FileInfo, cancellable: Cancellable, extra_data: any, free_extra_data: GLib.DestroyNotify) : void;};
        add_writable_namespaces : {(vfs: Vfs, list: FileAttributeInfoList) : void;};
        local_file_set_attributes : {(vfs: Vfs, filename: string, info: FileInfo, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;};
        local_file_removed : {(vfs: Vfs, filename: string) : void;};
        local_file_moved : {(vfs: Vfs, source: string, dest: string) : void;};
        deserialize_icon : {(vfs: Vfs, value: GLib.Variant) : Icon;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
    
    }
    
    
    
    class VolumeIface {
        public g_iface: GObject.TypeInterface;
    
        changed : {(volume: Volume) : void;};
        removed : {(volume: Volume) : void;};
        get_name : {(volume: Volume) : string;};
        get_icon : {(volume: Volume) : Icon;};
        get_uuid : {(volume: Volume) : string;};
        get_drive : {(volume: Volume) : Drive;};
        get_mount : {(volume: Volume) : Mount;};
        can_mount : {(volume: Volume) : boolean;};
        can_eject : {(volume: Volume) : boolean;};
        mount_fn : {(volume: Volume, flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        mount_finish : {(volume: Volume, result: AsyncResult) : boolean;};
        eject : {(volume: Volume, flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_finish : {(volume: Volume, result: AsyncResult) : boolean;};
        get_identifier : {(volume: Volume, kind: string) : string;};
        enumerate_identifiers : {(volume: Volume) : string[];};
        should_automount : {(volume: Volume) : boolean;};
        get_activation_root : {(volume: Volume) : File;};
        eject_with_operation : {(volume: Volume, flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;};
        eject_with_operation_finish : {(volume: Volume, result: AsyncResult) : boolean;};
        get_sort_key : {(volume: Volume) : string;};
        get_symbolic_icon : {(volume: Volume) : Icon;};
    
    }
    
    
    
    class VolumeMonitorClass {
        public parent_class: GObject.ObjectClass;
    
        volume_added : {(volume_monitor: VolumeMonitor, volume: Volume) : void;};
        volume_removed : {(volume_monitor: VolumeMonitor, volume: Volume) : void;};
        volume_changed : {(volume_monitor: VolumeMonitor, volume: Volume) : void;};
        mount_added : {(volume_monitor: VolumeMonitor, mount: Mount) : void;};
        mount_removed : {(volume_monitor: VolumeMonitor, mount: Mount) : void;};
        mount_pre_unmount : {(volume_monitor: VolumeMonitor, mount: Mount) : void;};
        mount_changed : {(volume_monitor: VolumeMonitor, mount: Mount) : void;};
        drive_connected : {(volume_monitor: VolumeMonitor, drive: Drive) : void;};
        drive_disconnected : {(volume_monitor: VolumeMonitor, drive: Drive) : void;};
        drive_changed : {(volume_monitor: VolumeMonitor, drive: Drive) : void;};
        is_supported : {() : boolean;};
        get_connected_drives : {(volume_monitor: VolumeMonitor) : GLib.List;};
        get_volumes : {(volume_monitor: VolumeMonitor) : GLib.List;};
        get_mounts : {(volume_monitor: VolumeMonitor) : GLib.List;};
        get_volume_for_uuid : {(volume_monitor: VolumeMonitor, uuid: string) : Volume;};
        get_mount_for_uuid : {(volume_monitor: VolumeMonitor, uuid: string) : Mount;};
        adopt_orphan_mount : {(mount: Mount, volume_monitor: VolumeMonitor) : Volume;};
        drive_eject_button : {(volume_monitor: VolumeMonitor, drive: Drive) : void;};
        drive_stop_button : {(volume_monitor: VolumeMonitor, drive: Drive) : void;};
        _g_reserved1 : {() : void;};
        _g_reserved2 : {() : void;};
        _g_reserved3 : {() : void;};
        _g_reserved4 : {() : void;};
        _g_reserved5 : {() : void;};
        _g_reserved6 : {() : void;};
    
    }
    
    
    
    class ZlibCompressorClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class ZlibDecompressorClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    interface Action {
        activate (parameter: GLib.Variant) : void;
        change_state (value: GLib.Variant) : void;
        get_enabled () : boolean;
        get_name () : string;
        get_parameter_type () : GLib.VariantType;
        get_state () : GLib.Variant;
        get_state_hint () : GLib.Variant;
        get_state_type () : GLib.VariantType;
    }
    
    var Action: {
        
        name_is_valid (action_name: string) : boolean;
        parse_detailed_name (detailed_name: string, action_name: string, target_value: GLib.Variant) : boolean;
        print_detailed_name (action_name: string, target_value: GLib.Variant) : string;
    }
    
    
    
    
    interface ActionGroup {
        action_added (action_name: string) : void;
        action_enabled_changed (action_name: string, enabled: boolean) : void;
        action_removed (action_name: string) : void;
        action_state_changed (action_name: string, state: GLib.Variant) : void;
        activate_action (action_name: string, parameter: GLib.Variant) : void;
        change_action_state (action_name: string, value: GLib.Variant) : void;
        get_action_enabled (action_name: string) : boolean;
        get_action_parameter_type (action_name: string) : GLib.VariantType;
        get_action_state (action_name: string) : GLib.Variant;
        get_action_state_hint (action_name: string) : GLib.Variant;
        get_action_state_type (action_name: string) : GLib.VariantType;
        has_action (action_name: string) : boolean;
        list_actions () : string[];
        query_action (action_name: string, enabled: boolean, parameter_type: GLib.VariantType, state_type: GLib.VariantType, state_hint: GLib.Variant, state: GLib.Variant) : boolean;
    }
    
    var ActionGroup: {
        
        
    }
    
    
    
    
    interface ActionMap {
        add_action (action: Action) : void;
        add_action_entries (entries: ActionEntry[], n_entries: number, user_data: any) : void;
        lookup_action (action_name: string) : Action;
        remove_action (action_name: string) : void;
    }
    
    var ActionMap: {
        
        
    }
    
    
    
    
    interface AppInfo {
        add_supports_type (content_type: string) : boolean;
        can_delete () : boolean;
        can_remove_supports_type () : boolean;
        delete () : boolean;
        dup () : AppInfo;
        equal (appinfo2: AppInfo) : boolean;
        get_commandline () : string;
        get_description () : string;
        get_display_name () : string;
        get_executable () : string;
        get_icon () : Icon;
        get_id () : string;
        get_name () : string;
        get_supported_types () : string[];
        launch (files: GLib.List, context: AppLaunchContext) : boolean;
        launch_uris (uris: GLib.List, context: AppLaunchContext) : boolean;
        launch_uris_async (uris: GLib.List, context: AppLaunchContext, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        launch_uris_finish (result: AsyncResult) : boolean;
        remove_supports_type (content_type: string) : boolean;
        set_as_default_for_extension (extension: string) : boolean;
        set_as_default_for_type (content_type: string) : boolean;
        set_as_last_used_for_type (content_type: string) : boolean;
        should_show () : boolean;
        supports_files () : boolean;
        supports_uris () : boolean;
    }
    
    var AppInfo: {
        
        create_from_commandline (commandline: string, application_name: string, flags: AppInfoCreateFlags) : AppInfo;
        get_all () : GLib.List;
        get_all_for_type (content_type: string) : GLib.List;
        get_default_for_type (content_type: string, must_support_uris: boolean) : AppInfo;
        get_default_for_uri_scheme (uri_scheme: string) : AppInfo;
        get_fallback_for_type (content_type: string) : GLib.List;
        get_recommended_for_type (content_type: string) : GLib.List;
        launch_default_for_uri (uri: string, context: AppLaunchContext) : boolean;
        launch_default_for_uri_async (uri: string, context: AppLaunchContext, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        launch_default_for_uri_finish (result: AsyncResult) : boolean;
        reset_type_associations (content_type: string) : void;
    }
    
    
    
    
    interface AsyncInitable {
        init_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        init_finish (res: AsyncResult) : boolean;
        new_finish (res: AsyncResult) : GObject.Object;
    }
    
    var AsyncInitable: {
        
        new_async (object_type: GObject.Type, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any, first_property_name: string) : void;
        new_valist_async (object_type: GObject.Type, first_property_name: string, var_args: any[], io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        newv_async (object_type: GObject.Type, n_parameters: number, parameters: GObject.Parameter, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
    }
    
    
    
    
    interface AsyncResult {
        get_source_object () : GObject.Object;
        get_user_data () : any;
        is_tagged (source_tag: any) : boolean;
        legacy_propagate_error () : boolean;
    }
    
    var AsyncResult: {
        
        
    }
    
    
    
    
    interface Converter {
        convert (inbuf: number[], inbuf_size: number, outbuf: number[], outbuf_size: number, flags: ConverterFlags, bytes_read: number, bytes_written: number) : ConverterResult;
        reset () : void;
    }
    
    var Converter: {
        
        
    }
    
    
    
    
    interface DBusInterface {
        dup_object () : DBusObject;
        get_info () : DBusInterfaceInfo;
        get_object () : DBusObject;
        set_object (object: DBusObject) : void;
    }
    
    var DBusInterface: {
        
        
    }
    
    
    
    
    interface DBusObject {
        get_interface (interface_name: string) : DBusInterface;
        get_interfaces () : GLib.List;
        get_object_path () : string;
    }
    
    var DBusObject: {
        
        
    }
    
    
    
    
    interface DBusObjectManager {
        get_interface (object_path: string, interface_name: string) : DBusInterface;
        get_object (object_path: string) : DBusObject;
        get_object_path () : string;
        get_objects () : GLib.List;
    }
    
    var DBusObjectManager: {
        
        
    }
    
    
    
    
    interface DatagramBased {
        condition_check (condition: GLib.IOCondition) : GLib.IOCondition;
        // condition_wait (condition: GLib.IOCondition, timeout: number, cancellable: Cancellable) : boolean;
        create_source (condition: GLib.IOCondition, cancellable: Cancellable) : GLib.Source;
        // receive_messages (messages: InputMessage[], num_messages: number, flags: number, timeout: number, cancellable: Cancellable) : number;
        // send_messages (messages: OutputMessage[], num_messages: number, flags: number, timeout: number, cancellable: Cancellable) : number;
    }
    
    var DatagramBased: {
        
        
    }
    
    
    
    
    interface DesktopAppInfoLookup {
        get_default_for_uri_scheme (uri_scheme: string) : AppInfo;
    }
    
    var DesktopAppInfoLookup: {
        
        
    }
    
    
    
    
    interface Drive {
        can_eject () : boolean;
        can_poll_for_media () : boolean;
        can_start () : boolean;
        can_start_degraded () : boolean;
        can_stop () : boolean;
        eject (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_finish (result: AsyncResult) : boolean;
        eject_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_with_operation_finish (result: AsyncResult) : boolean;
        enumerate_identifiers () : string[];
        get_icon () : Icon;
        get_identifier (kind: string) : string;
        get_name () : string;
        get_sort_key () : string;
        get_start_stop_type () : DriveStartStopType;
        get_symbolic_icon () : Icon;
        get_volumes () : GLib.List;
        has_media () : boolean;
        has_volumes () : boolean;
        is_media_check_automatic () : boolean;
        is_media_removable () : boolean;
        is_removable () : boolean;
        poll_for_media (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        poll_for_media_finish (result: AsyncResult) : boolean;
        start (flags: DriveStartFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        start_finish (result: AsyncResult) : boolean;
        stop (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        stop_finish (result: AsyncResult) : boolean;
    }
    
    var Drive: {
        
        
    }
    
    
    
    
    interface DtlsClientConnection {
        get_accepted_cas () : GLib.List;
        get_server_identity () : SocketConnectable;
        get_validation_flags () : TlsCertificateFlags;
        set_server_identity (identity: SocketConnectable) : void;
        set_validation_flags (flags: TlsCertificateFlags) : void;
    }
    
    var DtlsClientConnection: {
        
        new (base_socket: DatagramBased, server_identity: SocketConnectable) : DtlsClientConnection;
    }
    
    
    
    
    interface DtlsConnection {
        close (cancellable: Cancellable) : boolean;
        close_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        close_finish (result: AsyncResult) : boolean;
        emit_accept_certificate (peer_cert: TlsCertificate, errors: TlsCertificateFlags) : boolean;
        get_certificate () : TlsCertificate;
        get_database () : TlsDatabase;
        get_interaction () : TlsInteraction;
        get_negotiated_protocol () : string;
        get_peer_certificate () : TlsCertificate;
        get_peer_certificate_errors () : TlsCertificateFlags;
        get_rehandshake_mode () : TlsRehandshakeMode;
        get_require_close_notify () : boolean;
        handshake (cancellable: Cancellable) : boolean;
        handshake_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        handshake_finish (result: AsyncResult) : boolean;
        set_advertised_protocols (protocols: string[]) : void;
        set_certificate (certificate: TlsCertificate) : void;
        set_database (database: TlsDatabase) : void;
        set_interaction (interaction: TlsInteraction) : void;
        set_rehandshake_mode (mode: TlsRehandshakeMode) : void;
        set_require_close_notify (require_close_notify: boolean) : void;
        shutdown (shutdown_read: boolean, shutdown_write: boolean, cancellable: Cancellable) : boolean;
        shutdown_async (shutdown_read: boolean, shutdown_write: boolean, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        shutdown_finish (result: AsyncResult) : boolean;
    }
    
    var DtlsConnection: {
        
        
    }
    
    
    
    
    interface DtlsServerConnection {
        
    }
    
    var DtlsServerConnection: {
        
        new (base_socket: DatagramBased, certificate: TlsCertificate) : DtlsServerConnection;
    }
    
    
    
    
    interface File {
        append_to (flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;
        append_to_async (flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        append_to_finish (res: AsyncResult) : FileOutputStream;
        copy (destination: File, flags: FileCopyFlags, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any) : boolean;
        copy_async (destination: File, flags: FileCopyFlags, io_priority: number, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any, callback: AsyncReadyCallback, user_data: any) : void;
        copy_attributes (destination: File, flags: FileCopyFlags, cancellable: Cancellable) : boolean;
        copy_finish (res: AsyncResult) : boolean;
        create (flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;
        create_async (flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        create_finish (res: AsyncResult) : FileOutputStream;
        create_readwrite (flags: FileCreateFlags, cancellable: Cancellable) : FileIOStream;
        create_readwrite_async (flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback) : void;
        create_readwrite_finish (res: AsyncResult) : FileIOStream;
        delete (cancellable: Cancellable) : boolean;
        delete_async (io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        delete_finish (result: AsyncResult) : boolean;
        dup () : File;
        eject_mountable (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_mountable_finish (result: AsyncResult) : boolean;
        eject_mountable_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_mountable_with_operation_finish (result: AsyncResult) : boolean;
        enumerate_children (attributes: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : FileEnumerator;
        enumerate_children_async (attributes: string, flags: FileQueryInfoFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        enumerate_children_finish (res: AsyncResult) : FileEnumerator;
        equal (file2: File) : boolean;
        find_enclosing_mount (cancellable: Cancellable) : Mount;
        find_enclosing_mount_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        find_enclosing_mount_finish (res: AsyncResult) : Mount;
        get_basename () : string;
        get_child (name: string) : File;
        get_child_for_display_name (display_name: string) : File;
        get_parent () : File;
        get_parse_name () : string;
        get_path () : string;
        get_relative_path (descendant: File) : string;
        get_uri () : string;
        get_uri_scheme () : string;
        has_parent (parent: File) : boolean;
        has_prefix (prefix: File) : boolean;
        has_uri_scheme (uri_scheme: string) : boolean;
        hash () : number;
        is_native () : boolean;
        load_bytes (cancellable: Cancellable, etag_out: string) : GLib.Bytes;
        load_bytes_async (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        load_bytes_finish (result: AsyncResult, etag_out: string) : GLib.Bytes;
        /**
         * 
         * @param cancellable 
         * @param contents 
         * @param length 
         * @param etag_out 
         * @returns ok (Boolean) — true if the load was successful. If false and "error" is
            present, it will be set appropriately.
         * @returns contents (ByteArray) — a location to place the contents of the file
         * @returns etag_out (String) — a location to place the current entity tag for the file,
            or null if the entity tag is not needed
         */
        load_contents(cancellable: Cancellable): [success: boolean, contents: string];
        load_contents_async (cancellable: Cancellable | null, callback: AsyncReadyCallback | null): void;
        /**
         * 
         * @param res 
         * @param contents 
         * @param length 
         * @param etag_out 
         * @returns ok (Boolean) — true if the load was successful. If false and "error" is
            present, it will be set appropriately.
         * @returns contents (ByteArray) — a location to place the contents of the file
         * @returns etag_out (String) — a location to place the current entity tag for the file,
            or null if the entity tag is not needed
         */
        load_contents_finish (res: AsyncResult) : any[];
        load_partial_contents_async (cancellable: Cancellable, read_more_callback: FileReadMoreCallback, callback: AsyncReadyCallback, user_data: any) : void;
        load_partial_contents_finish (res: AsyncResult, contents: number[], length: number, etag_out: string) : boolean;
        make_directory (cancellable: Cancellable) : boolean;
        make_directory_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        make_directory_finish (result: AsyncResult) : boolean;
        make_directory_with_parents (cancellable: Cancellable | null) : boolean;
        make_symbolic_link (symlink_value: string, cancellable: Cancellable) : boolean;
        measure_disk_usage (flags: FileMeasureFlags, cancellable: Cancellable, progress_callback: FileMeasureProgressCallback, progress_data: any, disk_usage: number, num_dirs: number, num_files: number) : boolean;
        measure_disk_usage_async (flags: FileMeasureFlags, io_priority: number, cancellable: Cancellable, progress_callback: FileMeasureProgressCallback, progress_data: any, callback: AsyncReadyCallback, user_data: any) : void;
        measure_disk_usage_finish (result: AsyncResult, disk_usage: number, num_dirs: number, num_files: number) : boolean;
        monitor (flags: FileMonitorFlags, cancellable: Cancellable) : FileMonitor;
        monitor_directory (flags: FileMonitorFlags, cancellable: Cancellable) : FileMonitor;
        monitor_file (flags: FileMonitorFlags, cancellable: Cancellable) : FileMonitor;
        mount_enclosing_volume (flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        mount_enclosing_volume_finish (result: AsyncResult) : boolean;
        mount_mountable (flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        mount_mountable_finish (result: AsyncResult) : File;
        move (destination: File, flags: FileCopyFlags, cancellable: Cancellable, progress_callback: FileProgressCallback, progress_callback_data: any) : boolean;
        open_readwrite (cancellable: Cancellable) : FileIOStream;
        open_readwrite_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        open_readwrite_finish (res: AsyncResult) : FileIOStream;
        peek_path () : string;
        poll_mountable (cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        poll_mountable_finish (result: AsyncResult) : boolean;
        query_default_handler (cancellable: Cancellable) : AppInfo;
        query_default_handler_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        query_default_handler_finish (result: AsyncResult) : AppInfo;
        query_exists (cancellable: Cancellable | null) : boolean;
        query_file_type (flags: FileQueryInfoFlags, cancellable: Cancellable) : FileType;
        query_filesystem_info (attributes: string, cancellable: Cancellable) : FileInfo;
        query_filesystem_info_async (attributes: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        query_filesystem_info_finish (res: AsyncResult) : FileInfo;
        query_info (attributes: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : FileInfo;
        query_info_async (attributes: string, flags: FileQueryInfoFlags, io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        query_info_finish (res: AsyncResult) : FileInfo;
        query_settable_attributes (cancellable: Cancellable) : FileAttributeInfoList;
        query_writable_namespaces (cancellable: Cancellable) : FileAttributeInfoList;
        read (cancellable: Cancellable) : FileInputStream;
        read_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        read_finish (res: AsyncResult) : FileInputStream;
        replace (etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable) : FileOutputStream;
        replace_async (etag: string, make_backup: boolean, flags: FileCreateFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        replace_contents(contents: string, etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable): [ok: boolean, new_etag: string];
        replace_contents_async (contents: number[], length: number, etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        replace_contents_bytes_async (contents: GLib.Bytes, etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        replace_contents_finish (res: AsyncResult, new_etag: string) : boolean;
        replace_finish (res: AsyncResult) : FileOutputStream;
        replace_readwrite (etag: string, make_backup: boolean, flags: FileCreateFlags, cancellable: Cancellable) : FileIOStream;
        replace_readwrite_async (etag: string | null, make_backup: boolean | null, flags: FileCreateFlags | null, io_priority: number | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null) : void;
        replace_readwrite_finish (res: AsyncResult) : FileIOStream;
        resolve_relative_path (relative_path: string) : File;
        set_attribute (attribute: string, _type: FileAttributeType, value_p: any, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_byte_string (attribute: string, value: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_int32 (attribute: string, value: number, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_int64 (attribute: string, value: number, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_string (attribute: string, value: string, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_uint32 (attribute: string, value: number, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attribute_uint64 (attribute: string, value: number, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_attributes_async (info: FileInfo, flags: FileQueryInfoFlags, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        set_attributes_finish (result: AsyncResult, info: FileInfo) : boolean;
        set_attributes_from_info (info: FileInfo, flags: FileQueryInfoFlags, cancellable: Cancellable) : boolean;
        set_display_name (display_name: string, cancellable: Cancellable) : File;
        set_display_name_async (display_name: string, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        set_display_name_finish (res: AsyncResult) : File;
        start_mountable (flags: DriveStartFlags, start_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        start_mountable_finish (result: AsyncResult) : boolean;
        stop_mountable (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        stop_mountable_finish (result: AsyncResult) : boolean;
        supports_thread_contexts () : boolean;
        trash (cancellable: Cancellable) : boolean;
        trash_async (io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        trash_finish (result: AsyncResult) : boolean;
        unmount_mountable (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        unmount_mountable_finish (result: AsyncResult) : boolean;
        unmount_mountable_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        unmount_mountable_with_operation_finish (result: AsyncResult) : boolean;
    }
    
    var File: {
        
        new_build_filename (first_element: string) : File;
        new_for_commandline_arg (_arg: string) : File;
        new_for_commandline_arg_and_cwd (_arg: string, cwd: string) : File;
        new_for_path (path: string) : File;
        new_for_uri (uri: string) : File;
        new_tmp (tmpl: string, iostream: FileIOStream) : File;
        parse_name (parse_name: string) : File;
    }
    
    
    
    
    interface FileDescriptorBased {
        get_fd () : number;
    }
    
    var FileDescriptorBased: {
        
        
    }
    
    
    
    
    interface Icon {
        equal (icon2: Icon) : boolean;
        serialize () : GLib.Variant;
        to_string () : string;
    }
    
    var Icon: {
        
        deserialize (value: GLib.Variant) : Icon;
        hash (icon: any) : number;
        new_for_string (_str: string) : Icon;
    }
    
    
    
    
    interface Initable {
        init (cancellable: Cancellable) : boolean;
    }
    
    var Initable: {
        
        new (object_type: GObject.Type, cancellable: Cancellable, error: GLib.Error, first_property_name: string) : GObject.Object;
        new_valist (object_type: GObject.Type, first_property_name: string, var_args: any[], cancellable: Cancellable) : GObject.Object;
        newv (object_type: GObject.Type, n_parameters: number, parameters: GObject.Parameter[], cancellable: Cancellable) : GObject.Object;
    }
    
    
    
    
    interface ListModel {
        get_item (position: number) : any;
        get_item_type () : GObject.Type;
        get_n_items () : number;
        get_object (position: number) : GObject.Object;
        items_changed (position: number, removed: number, added: number) : void;
    }
    
    var ListModel: {
        
        
    }
    
    
    
    
    interface LoadableIcon {
        load (size: number, _type: string, cancellable: Cancellable) : InputStream;
        load_async (size: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        load_finish (res: AsyncResult, _type: string) : InputStream;
    }
    
    var LoadableIcon: {
        
        
    }
    
    
    
    
    interface Mount {
        can_eject () : boolean;
        can_unmount () : boolean;
        eject (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_finish (result: AsyncResult) : boolean;
        eject_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_with_operation_finish (result: AsyncResult) : boolean;
        get_default_location () : File;
        get_drive () : Drive;
        get_icon () : Icon;
        get_name () : string;
        get_root () : File;
        get_sort_key () : string;
        get_symbolic_icon () : Icon;
        get_uuid () : string;
        get_volume () : Volume;
        guess_content_type (force_rescan: boolean, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        guess_content_type_finish (result: AsyncResult) : string[];
        guess_content_type_sync (force_rescan: boolean, cancellable: Cancellable) : string[];
        is_shadowed () : boolean;
        remount (flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        remount_finish (result: AsyncResult) : boolean;
        shadow () : void;
        unmount (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        unmount_finish (result: AsyncResult) : boolean;
        unmount_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        unmount_with_operation_finish (result: AsyncResult) : boolean;
        unshadow () : void;
    }
    
    var Mount: {
        
        
    }
    
    
    
    
    interface NetworkMonitor {
        can_reach (connectable: SocketConnectable, cancellable: Cancellable) : boolean;
        can_reach_async (connectable: SocketConnectable, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        can_reach_finish (result: AsyncResult) : boolean;
        get_connectivity () : NetworkConnectivity;
        get_network_available () : boolean;
        get_network_metered () : boolean;
    }
    
    var NetworkMonitor: {
        
        get_default () : NetworkMonitor;
    }
    
    
    
    
    interface PollableInputStream {
        can_poll () : boolean;
        create_source (cancellable: Cancellable) : GLib.Source;
        is_readable () : boolean;
        read_nonblocking (buffer: number[], count: number, cancellable: Cancellable) : number;
    }
    
    var PollableInputStream: {
        
        
    }
    
    
    
    
    interface PollableOutputStream {
        can_poll () : boolean;
        create_source (cancellable: Cancellable) : GLib.Source;
        is_writable () : boolean;
        write_nonblocking (buffer: number[], count: number, cancellable: Cancellable) : number;
        writev_nonblocking (vectors: OutputVector[], n_vectors: number, bytes_written: number, cancellable: Cancellable) : PollableReturn;
    }
    
    var PollableOutputStream: {
        
        
    }
    
    
    
    
    interface Proxy {
        connect (connection: IOStream, proxy_address: ProxyAddress, cancellable: Cancellable) : IOStream;
        connect_async (connection: IOStream, proxy_address: ProxyAddress, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        connect_finish (result: AsyncResult) : IOStream;
        supports_hostname () : boolean;
    }
    
    var Proxy: {
        
        get_default_for_protocol (protocol: string) : Proxy;
    }
    
    
    
    
    interface ProxyResolver {
        is_supported () : boolean;
        lookup (uri: string, cancellable: Cancellable) : string[];
        lookup_async (uri: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        lookup_finish (result: AsyncResult) : string[];
    }
    
    var ProxyResolver: {
        
        get_default () : ProxyResolver;
    }
    
    
    
    
    interface RemoteActionGroup {
        activate_action_full (action_name: string, parameter: GLib.Variant, platform_data: GLib.Variant) : void;
        change_action_state_full (action_name: string, value: GLib.Variant, platform_data: GLib.Variant) : void;
    }
    
    var RemoteActionGroup: {
        
        
    }
    
    
    
    
    interface Seekable {
        can_seek () : boolean;
        can_truncate () : boolean;
        seek (offset: number, _type: GLib.SeekType, cancellable: Cancellable) : boolean;
        tell () : number;
        truncate (offset: number, cancellable: Cancellable) : boolean;
    }
    
    var Seekable: {
        
        
    }
    
    
    
    
    interface SocketConnectable {
        enumerate () : SocketAddressEnumerator;
        proxy_enumerate () : SocketAddressEnumerator;
        to_string () : string;
    }
    
    var SocketConnectable: {
        
        
    }
    
    
    
    
    interface TlsBackend {
        get_certificate_type () : GObject.Type;
        get_client_connection_type () : GObject.Type;
        get_default_database () : TlsDatabase;
        get_dtls_client_connection_type () : GObject.Type;
        get_dtls_server_connection_type () : GObject.Type;
        get_file_database_type () : GObject.Type;
        get_server_connection_type () : GObject.Type;
        set_default_database (database: TlsDatabase) : void;
        supports_dtls () : boolean;
        supports_tls () : boolean;
    }
    
    var TlsBackend: {
        
        get_default () : TlsBackend;
    }
    
    
    
    
    interface TlsClientConnection {
        copy_session_state (source: TlsClientConnection) : void;
        get_accepted_cas () : GLib.List;
        get_server_identity () : SocketConnectable;
        get_use_ssl3 () : boolean;
        get_validation_flags () : TlsCertificateFlags;
        set_server_identity (identity: SocketConnectable) : void;
        set_use_ssl3 (use_ssl3: boolean) : void;
        set_validation_flags (flags: TlsCertificateFlags) : void;
    }
    
    var TlsClientConnection: {
        
        new (base_io_stream: IOStream, server_identity: SocketConnectable) : TlsClientConnection;
    }
    
    
    
    
    interface TlsFileDatabase {
        
    }
    
    var TlsFileDatabase: {
        
        new (anchors: string) : TlsFileDatabase;
    }
    
    
    
    
    interface TlsServerConnection {
        
    }
    
    var TlsServerConnection: {
        
        new (base_io_stream: IOStream, certificate: TlsCertificate) : TlsServerConnection;
    }
    
    
    
    
    interface Volume {
        can_eject () : boolean;
        can_mount () : boolean;
        eject (flags: MountUnmountFlags, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_finish (result: AsyncResult) : boolean;
        eject_with_operation (flags: MountUnmountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        eject_with_operation_finish (result: AsyncResult) : boolean;
        enumerate_identifiers () : string[];
        get_activation_root () : File;
        get_drive () : Drive;
        get_icon () : Icon;
        get_identifier (kind: string) : string;
        get_mount () : Mount;
        get_name () : string;
        get_sort_key () : string;
        get_symbolic_icon () : Icon;
        get_uuid () : string;
        mount (flags: MountMountFlags, mount_operation: MountOperation, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any) : void;
        mount_finish (result: AsyncResult) : boolean;
        should_automount () : boolean;
    }
    
    var Volume: {
        
        
    }
    
    
    
    
    enum BusType {
        starter = -1,
        none = 0,
        system = 1,
        session = 2
    }
    
    
    
    enum ConverterResult {
        error = 0,
        converted = 1,
        finished = 2,
        flushed = 3
    }
    
    
    
    enum CredentialsType {
        invalid = 0,
        linux_ucred = 1,
        freebsd_cmsgcred = 2,
        openbsd_sockpeercred = 3,
        solaris_ucred = 4,
        netbsd_unpcbid = 5
    }
    
    
    
    enum DBusError {
        failed = 0,
        no_memory = 1,
        service_unknown = 2,
        name_has_no_owner = 3,
        no_reply = 4,
        io_error = 5,
        bad_address = 6,
        not_supported = 7,
        limits_exceeded = 8,
        access_denied = 9,
        auth_failed = 10,
        no_server = 11,
        timeout = 12,
        no_network = 13,
        address_in_use = 14,
        disconnected = 15,
        invalid_args = 16,
        file_not_found = 17,
        file_exists = 18,
        unknown_method = 19,
        timed_out = 20,
        match_rule_not_found = 21,
        match_rule_invalid = 22,
        spawn_exec_failed = 23,
        spawn_fork_failed = 24,
        spawn_child_exited = 25,
        spawn_child_signaled = 26,
        spawn_failed = 27,
        spawn_setup_failed = 28,
        spawn_config_invalid = 29,
        spawn_service_invalid = 30,
        spawn_service_not_found = 31,
        spawn_permissions_invalid = 32,
        spawn_file_invalid = 33,
        spawn_no_memory = 34,
        unix_process_id_unknown = 35,
        invalid_signature = 36,
        invalid_file_content = 37,
        selinux_security_context_unknown = 38,
        adt_audit_data_unknown = 39,
        object_path_in_use = 40,
        unknown_object = 41,
        unknown_interface = 42,
        unknown_property = 43,
        property_read_only = 44
    }
    
    
    
    enum DBusMessageByteOrder {
        big_endian = 66,
        little_endian = 108
    }
    
    
    
    enum DBusMessageHeaderField {
        invalid = 0,
        path = 1,
        interface = 2,
        member = 3,
        error_name = 4,
        reply_serial = 5,
        destination = 6,
        sender = 7,
        signature = 8,
        num_unix_fds = 9
    }
    
    
    
    enum DBusMessageType {
        invalid = 0,
        method_call = 1,
        method_return = 2,
        error = 3,
        signal = 4
    }
    
    
    
    enum DataStreamByteOrder {
        big_endian = 0,
        little_endian = 1,
        host_endian = 2
    }
    
    
    
    enum DataStreamNewlineType {
        lf = 0,
        cr = 1,
        cr_lf = 2,
        any = 3
    }
    
    
    
    enum DriveStartStopType {
        unknown = 0,
        shutdown = 1,
        network = 2,
        multidisk = 3,
        password = 4
    }
    
    
    
    enum EmblemOrigin {
        unknown = 0,
        device = 1,
        livemetadata = 2,
        tag = 3
    }
    
    
    
    enum FileAttributeStatus {
        unset = 0,
        set = 1,
        error_setting = 2
    }
    
    
    
    enum FileAttributeType {
        invalid = 0,
        string = 1,
        byte_string = 2,
        boolean = 3,
        uint32 = 4,
        int32 = 5,
        uint64 = 6,
        int64 = 7,
        object = 8,
        stringv = 9
    }
    
    
    
    enum FileMonitorEvent {
        CHANGED = 0,
        CHANGES_DONE_HINT = 1,
        DELETED = 2,
        CREATED = 3,
        ATTRIBUTE_CHANGED = 4,
        PRE_UNMOUNT = 5,
        UNMOUNTED = 6,
        MOVED = 7,
        RENAMED = 8,
        MOVED_IN = 9,
        MOVED_OUT = 10
    }

    
    
    
    enum FileType {
        UNKNOWN = 0,
        REGULAR = 1,
        DIRECTORY = 2,
        SYMBOLIC_LINK = 3,
        SPECIAL = 4,
        SHORTCUT = 5,
        MOUNTABLE = 6
    }
    
    
    
    enum FilesystemPreviewType {
        if_always = 0,
        if_local = 1,
        never = 2
    }
    
    
    
    enum IOErrorEnum {
        FAILED = 0,
        NOT_FOUND = 1,
        EXISTS = 2,
        IS_DIRECTORY = 3,
        NOT_DIRECTORY = 4,
        NOT_EMPTY = 5,
        NOT_REGULAR_FILE = 6,
        NOT_SYMBOLIC_LINK = 7,
        NOT_MOUNTABLE_FILE = 8,
        FILENAME_TOO_LONG = 9,
        INVALID_FILENAME = 10,
        TOO_MANY_LINKS = 11,
        NO_SPACE = 12,
        INVALID_ARGUMENT = 13,
        PREMISSION_DENIED = 14,
        NOT_SUPPORTED = 15,
        NOT_MOUNTER = 16,
        ALREADY_MOUNTED = 17,
        CLOSED = 18,
        CANCELLED = 19,
        PENDING = 20,
        READ_ONLY = 21,
        CANT_CREATE_BACKUP = 22,
        WRONG_ETAG = 23,
        TIMED_OUT = 24,
        WOULD_RECURSE = 25,
        BUSY = 26,
        WOULD_BLOCK = 27,
        HOST_NOT_FOUND = 28,
        WOULD_MERGE = 29,
        FAILED_HANDLED = 30,
        TOO_MANY_OPEN_FILES = 31,
        NOT_INITIALIZED = 32,
        ADDRESS_IN_USE = 33,
        PERTIAL_INPUT = 34,
        INVALID_DATA = 35,
        DBUS_ERROR = 36,
        HOST_UNREACHABLE = 37,
        NETWORK_UNREACHABLE = 38,
        CONNECTION_REFUSED = 39,
        PROXY_FAILED = 40,
        PROXY_AUTH_FAILED = 41,
        PROXY_NEED_AUTH = 42,
        PROXY_NOT_ALLOWED = 43,
        BROKEN_PIPE = 44,
        CONNECTION_CLOSED = 44,
        NOT_CONNECTED = 45,
        MESSAGE_TOO_LARGE = 46
    }
    
    
    
    enum IOModuleScopeFlags {
        none = 0,
        block_duplicates = 1
    }
    
    
    
    enum MountOperationResult {
        handled = 0,
        aborted = 1,
        unhandled = 2
    }
    
    
    
    enum NetworkConnectivity {
        local = 1,
        limited = 2,
        portal = 3,
        full = 4
    }
    
    
    
    enum NotificationPriority {
        normal = 0,
        low = 1,
        high = 2,
        urgent = 3
    }
    
    
    
    enum PasswordSave {
        never = 0,
        for_session = 1,
        permanently = 2
    }
    
    
    
    enum PollableReturn {
        failed = 0,
        ok = 1,
        would_block = -27
    }
    
    
    
    enum ResolverError {
        not_found = 0,
        temporary_failure = 1,
        internal = 2
    }
    
    
    
    enum ResolverRecordType {
        srv = 1,
        mx = 2,
        txt = 3,
        soa = 4,
        ns = 5
    }
    
    
    
    enum ResourceError {
        not_found = 0,
        internal = 1
    }
    
    
    
    enum SocketClientEvent {
        resolving = 0,
        resolved = 1,
        connecting = 2,
        connected = 3,
        proxy_negotiating = 4,
        proxy_negotiated = 5,
        tls_handshaking = 6,
        tls_handshaked = 7,
        complete = 8
    }
    
    
    
    enum SocketFamily {
        invalid = 0,
        unix = 1,
        ipv4 = 2,
        ipv6 = 10
    }
    
    
    
    enum SocketListenerEvent {
        binding = 0,
        bound = 1,
        listening = 2,
        listened = 3
    }
    
    
    
    enum SocketProtocol {
        unknown = -1,
        default = 0,
        tcp = 6,
        udp = 17,
        sctp = 132
    }
    
    
    
    enum SocketType {
        invalid = 0,
        stream = 1,
        datagram = 2,
        seqpacket = 3
    }
    
    
    
    enum TlsAuthenticationMode {
        none = 0,
        requested = 1,
        required = 2
    }
    
    
    
    enum TlsCertificateRequestFlags {
        none = 0
    }
    
    
    
    enum TlsDatabaseLookupFlags {
        none = 0,
        keypair = 1
    }
    
    
    
    enum TlsError {
        unavailable = 0,
        misc = 1,
        bad_certificate = 2,
        not_tls = 3,
        handshake = 4,
        certificate_required = 5,
        eof = 6,
        inappropriate_fallback = 7
    }
    
    
    
    enum TlsInteractionResult {
        unhandled = 0,
        handled = 1,
        failed = 2
    }
    
    
    
    enum TlsRehandshakeMode {
        never = 0,
        safely = 1,
        unsafely = 2
    }
    
    
    
    enum UnixSocketAddressType {
        invalid = 0,
        anonymous = 1,
        path = 2,
        abstract = 3,
        abstract_padded = 4
    }
    
    
    
    enum ZlibCompressorFormat {
        zlib = 0,
        gzip = 1,
        raw = 2
    }
    
    
    
    enum AppInfoCreateFlags {
        none = 0,
        needs_terminal = 1,
        supports_uris = 2,
        supports_startup_notification = 4
    }
    
    
    
    enum ApplicationFlags {
        flags_none = 0,
        is_service = 1,
        is_launcher = 2,
        handles_open = 4,
        handles_command_line = 8,
        send_environment = 16,
        non_unique = 32,
        can_override_app_id = 64,
        allow_replacement = 128,
        replace = 256
    }
    
    
    
    enum AskPasswordFlags {
        need_password = 1,
        need_username = 2,
        need_domain = 4,
        saving_supported = 8,
        anonymous_supported = 16,
        tcrypt = 32
    }
    
    
    
    enum BusNameOwnerFlags {
        none = 0,
        allow_replacement = 1,
        replace = 2,
        do_not_queue = 4
    }
    
    
    
    enum BusNameWatcherFlags {
        none = 0,
        auto_start = 1
    }
    
    
    
    enum ConverterFlags {
        none = 0,
        input_at_end = 1,
        flush = 2
    }
    
    
    
    enum DBusCallFlags {
        none = 0,
        no_auto_start = 1,
        allow_interactive_authorization = 2
    }
    
    
    
    enum DBusCapabilityFlags {
        none = 0,
        unix_fd_passing = 1
    }
    
    
    
    enum DBusConnectionFlags {
        none = 0,
        authentication_client = 1,
        authentication_server = 2,
        authentication_allow_anonymous = 4,
        message_bus_connection = 8,
        delay_message_processing = 16
    }
    
    
    
    enum DBusInterfaceSkeletonFlags {
        none = 0,
        handle_method_invocations_in_thread = 1
    }
    
    
    
    enum DBusMessageFlags {
        none = 0,
        no_reply_expected = 1,
        no_auto_start = 2,
        allow_interactive_authorization = 4
    }
    
    
    
    enum DBusObjectManagerClientFlags {
        none = 0,
        do_not_auto_start = 1
    }
    
    
    
    enum DBusPropertyInfoFlags {
        none = 0,
        readable = 1,
        writable = 2
    }
    
    
    
    enum DBusProxyFlags {
        none = 0,
        do_not_load_properties = 1,
        do_not_connect_signals = 2,
        do_not_auto_start = 4,
        get_invalidated_properties = 8,
        do_not_auto_start_at_construction = 16
    }
    
    
    
    enum DBusSendMessageFlags {
        none = 0,
        preserve_serial = 1
    }
    
    
    
    enum DBusServerFlags {
        none = 0,
        run_in_thread = 1,
        authentication_allow_anonymous = 2
    }
    
    
    
    enum DBusSignalFlags {
        none = 0,
        no_match_rule = 1,
        match_arg0_namespace = 2,
        match_arg0_path = 4
    }
    
    
    
    enum DBusSubtreeFlags {
        NONE = 0,
        dispatch_to_unenumerated_nodes = 1
    }
    
    
    
    enum DriveStartFlags {
        NONE = 0
    }
    
    
    
    enum FileAttributeInfoFlags {
        NONE = 0,
        copy_with_file = 1,
        copy_when_moved = 2
    }
    
    
    
    enum FileCopyFlags {
        none = 0,
        overwrite = 1,
        backup = 2,
        nofollow_symlinks = 4,
        all_metadata = 8,
        no_fallback_for_move = 16,
        target_default_perms = 32
    }
    
    
    
    enum FileCreateFlags {
        NONE = 0,
        PRIVATE = 1,
        REPLACE_DESTINATION = 2
    }
    
    
    
    enum FileMeasureFlags {
        none = 0,
        report_any_error = 2,
        apparent_size = 4,
        no_xdev = 8
    }
    
    
    
    enum FileMonitorFlags {
        NONE = 0,
        WATCH_MOUNTS = 1,
        SEND_MOVED = 2,
        WATCH_HARD_LINKS = 4,
        WATCH_MOVES = 8
    }
    
    
    
    enum FileQueryInfoFlags {
        NONE = 0,
        NOFOLLOW_SYMLINKS = 1
    }
    
    
    
    enum IOStreamSpliceFlags {
        none = 0,
        close_stream1 = 1,
        close_stream2 = 2,
        wait_for_both = 4
    }
    
    
    
    enum MountMountFlags {
        none = 0
    }
    
    
    
    enum MountUnmountFlags {
        none = 0,
        force = 1
    }
    
    
    
    enum OutputStreamSpliceFlags {
        none = 0,
        close_source = 1,
        close_target = 2
    }
    
    
    
    enum ResolverNameLookupFlags {
        default = 0,
        ipv4_only = 1,
        ipv6_only = 2
    }
    
    
    
    enum ResourceFlags {
        none = 0,
        compressed = 1
    }
    
    
    
    enum ResourceLookupFlags {
        none = 0
    }
    
    
    
    enum SettingsBindFlags {
        default = 0,
        get = 1,
        set = 2,
        no_sensitivity = 4,
        get_no_changes = 8,
        invert_boolean = 16
    }
    
    
    
    enum SocketMsgFlags {
        none = 0,
        oob = 1,
        peek = 2,
        dontroute = 4
    }
    
    
    
    enum SubprocessFlags {
        none = 0,
        stdin_pipe = 1,
        stdin_inherit = 2,
        stdout_pipe = 4,
        stdout_silence = 8,
        stderr_pipe = 16,
        stderr_silence = 32,
        stderr_merge = 64,
        inherit_fds = 128
    }
    
    
    
    enum TestDBusFlags {
        none = 0
    }
    
    
    
    enum TlsCertificateFlags {
        unknown_ca = 1,
        bad_identity = 2,
        not_activated = 4,
        expired = 8,
        revoked = 16,
        insecure = 32,
        generic_error = 64,
        validate_all = 127
    }
    
    
    
    enum TlsDatabaseVerifyFlags {
        none = 0
    }
    
    
    
    enum TlsPasswordFlags {
        none = 0,
        retry = 2,
        many_tries = 4,
        final_try = 8
    }
    
    
    
    interface AsyncReadyCallback {
        (source_object: GObject.Object, res: AsyncResult, user_data: any) : void;
    }
    
    
    
    interface BusAcquiredCallback {
        (connection: DBusConnection, name: string, user_data: any) : void;
    }
    
    
    
    interface BusNameAcquiredCallback {
        (connection: DBusConnection, name: string, user_data: any) : void;
    }
    
    
    
    interface BusNameAppearedCallback {
        (connection: DBusConnection, name: string, name_owner: string, user_data: any) : void;
    }
    
    
    
    interface BusNameLostCallback {
        (connection: DBusConnection, name: string, user_data: any) : void;
    }
    
    
    
    interface BusNameVanishedCallback {
        (connection: DBusConnection, name: string, user_data: any) : void;
    }
    
    
    
    interface CancellableSourceFunc {
        (cancellable: Cancellable, user_data: any) : boolean;
    }
    
    
    
    interface DBusInterfaceGetPropertyFunc {
        (connection: DBusConnection, sender: string, object_path: string, interface_name: string, property_name: string, error: GLib.Error, user_data: any) : GLib.Variant;
    }
    
    
    
    interface DBusInterfaceMethodCallFunc {
        (connection: DBusConnection, sender: string, object_path: string, interface_name: string, method_name: string, parameters: GLib.Variant, invocation: DBusMethodInvocation, user_data: any) : void;
    }
    
    
    
    interface DBusInterfaceSetPropertyFunc {
        (connection: DBusConnection, sender: string, object_path: string, interface_name: string, property_name: string, value: GLib.Variant, error: GLib.Error, user_data: any) : boolean;
    }
    
    
    
    interface DBusMessageFilterFunction {
        (connection: DBusConnection, message: DBusMessage, incoming: boolean, user_data: any) : DBusMessage;
    }
    
    
    
    interface DBusProxyTypeFunc {
        (manager: DBusObjectManagerClient, object_path: string, interface_name: string, user_data: any) : GObject.Type;
    }
    
    
    
    interface DBusSignalCallback {
        (connection: DBusConnection, sender_name: string, object_path: string, interface_name: string, signal_name: string, parameters: GLib.Variant, user_data: any) : void;
    }
    
    
    
    interface DBusSubtreeDispatchFunc {
        (connection: DBusConnection, sender: string, object_path: string, interface_name: string, node: string, out_user_data: any, user_data: any) : DBusInterfaceVTable;
    }
    
    
    
    interface DBusSubtreeEnumerateFunc {
        (connection: DBusConnection, sender: string, object_path: string, user_data: any) : string[];
    }
    
    
    
    interface DBusSubtreeIntrospectFunc {
        (connection: DBusConnection, sender: string, object_path: string, node: string, user_data: any) : DBusInterfaceInfo;
    }
    
    
    
    interface DatagramBasedSourceFunc {
        (datagram_based: DatagramBased, condition: GLib.IOCondition, user_data: any) : boolean;
    }
    
    
    
    interface DesktopAppLaunchCallback {
        (appinfo: DesktopAppInfo, pid: GLib.Pid, user_data: any) : void;
    }
    
    
    
    interface FileMeasureProgressCallback {
        (reporting: boolean, current_size: number, num_dirs: number, num_files: number, user_data: any) : void;
    }
    
    
    
    interface FileProgressCallback {
        (current_num_bytes: number, total_num_bytes: number, user_data: any) : void;
    }
    
    
    
    interface FileReadMoreCallback {
        (file_contents: string, file_size: number, callback_data: any) : boolean;
    }
    
    
    
    interface IOSchedulerJobFunc {
        (job: IOSchedulerJob, cancellable: Cancellable, user_data: any) : boolean;
    }
    
    
    
    interface PollableSourceFunc {
        (pollable_stream: GObject.Object, user_data: any) : boolean;
    }
    
    
    
    interface ReallocFunc {
        (data: any, size: number) : any;
    }
    
    
    
    interface SettingsBindGetMapping {
        (value: GObject.Value, variant: GLib.Variant, user_data: any) : boolean;
    }
    
    
    
    interface SettingsBindSetMapping {
        (value: GObject.Value, expected_type: GLib.VariantType, user_data: any) : GLib.Variant;
    }
    
    
    
    interface SettingsGetMapping {
        (value: GLib.Variant, result: any, user_data: any) : boolean;
    }
    
    
    
    interface SimpleAsyncThreadFunc {
        (res: SimpleAsyncResult, object: GObject.Object, cancellable: Cancellable) : void;
    }
    
    
    
    interface SocketSourceFunc {
        (socket: Socket, condition: GLib.IOCondition, user_data: any) : boolean;
    }
    
    
    
    interface TaskThreadFunc {
        (task: Task, source_object: GObject.Object, task_data: any, cancellable: Cancellable) : void;
    }
    
    
    
    interface VfsFileLookupFunc {
        (vfs: Vfs, identifier: string, user_data: any) : File;
    }
    
    
    
    function action_name_is_valid (action_name: string): boolean;
    
    
    
    function action_parse_detailed_name (detailed_name: string, action_name: string, target_value: GLib.Variant): boolean;
    
    
    
    function action_print_detailed_name (action_name: string, target_value: GLib.Variant): string;
    
    
    
    function app_info_create_from_commandline (commandline: string, application_name: string, flags: AppInfoCreateFlags): AppInfo;
    
    
    
    function app_info_get_all (): GLib.List;
    
    
    
    function app_info_get_all_for_type (content_type: string): GLib.List;
    
    
    
    function app_info_get_default_for_type (content_type: string, must_support_uris: boolean): AppInfo;
    
    
    
    function app_info_get_default_for_uri_scheme (uri_scheme: string): AppInfo;
    
    
    
    function app_info_get_fallback_for_type (content_type: string): GLib.List;
    
    
    
    function app_info_get_recommended_for_type (content_type: string): GLib.List;
    
    
    
    function app_info_launch_default_for_uri (uri: string, context: AppLaunchContext): boolean;
    
    
    
    function app_info_launch_default_for_uri_async (uri: string, context: AppLaunchContext, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any): void;
    
    
    
    function app_info_launch_default_for_uri_finish (result: AsyncResult): boolean;
    
    
    
    function app_info_reset_type_associations (content_type: string): void;
    
    
    
    function async_initable_newv_async (object_type: GObject.Type, n_parameters: number, parameters: GObject.Parameter, io_priority: number, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any): void;
    
    
    
    function bus_get (bus_type: BusType, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any): void;
    
    
    
    function bus_get_finish (res: AsyncResult): DBusConnection;
    
    
    
    function bus_get_sync (bus_type: BusType, cancellable: Cancellable): DBusConnection;
    
    
    
    function bus_own_name (bus_type: BusType, name: string, flags: BusNameOwnerFlags, bus_acquired_handler: BusAcquiredCallback, name_acquired_handler: BusNameAcquiredCallback, name_lost_handler: BusNameLostCallback, user_data: any, user_data_free_func: GLib.DestroyNotify): number;
    
    
    
    function bus_own_name_on_connection (connection: DBusConnection, name: string, flags: BusNameOwnerFlags, name_acquired_handler: BusNameAcquiredCallback, name_lost_handler: BusNameLostCallback, user_data: any, user_data_free_func: GLib.DestroyNotify): number;
    
    
    
    function bus_own_name_on_connection_with_closures (connection: DBusConnection, name: string, flags: BusNameOwnerFlags, name_acquired_closure: GObject.Closure, name_lost_closure: GObject.Closure): number;
    
    
    
    function bus_own_name_with_closures (bus_type: BusType, name: string, flags: BusNameOwnerFlags, bus_acquired_closure: GObject.Closure, name_acquired_closure: GObject.Closure, name_lost_closure: GObject.Closure): number;
    
    
    
    function bus_unown_name (owner_id: number): void;
    
    
    
    function bus_unwatch_name (watcher_id: number): void;
    
    
    
    function bus_watch_name (bus_type: BusType, name: string, flags: BusNameWatcherFlags, name_appeared_handler: BusNameAppearedCallback, name_vanished_handler: BusNameVanishedCallback, user_data: any, user_data_free_func: GLib.DestroyNotify): number;
    
    
    
    function bus_watch_name_on_connection (connection: DBusConnection, name: string, flags: BusNameWatcherFlags, name_appeared_handler: BusNameAppearedCallback, name_vanished_handler: BusNameVanishedCallback, user_data: any, user_data_free_func: GLib.DestroyNotify): number;
    
    
    
    function bus_watch_name_on_connection_with_closures (connection: DBusConnection, name: string, flags: BusNameWatcherFlags, name_appeared_closure: GObject.Closure, name_vanished_closure: GObject.Closure): number;
    
    
    
    function bus_watch_name_with_closures (bus_type: BusType, name: string, flags: BusNameWatcherFlags, name_appeared_closure: GObject.Closure, name_vanished_closure: GObject.Closure): number;
    
    
    
    function content_type_can_be_executable (_type: string): boolean;
    
    
    
    function content_type_equals (type1: string, type2: string): boolean;
    
    
    
    function content_type_from_mime_type (mime_type: string): string;
    
    
    
    function content_type_get_description (_type: string): string;
    
    
    
    function content_type_get_generic_icon_name (_type: string): string;
    
    
    
    function content_type_get_icon (_type: string): Icon;
    
    
    
    function content_type_get_mime_dirs (): string[];
    
    
    
    function content_type_get_mime_type (_type: string): string;
    
    
    
    function content_type_get_symbolic_icon (_type: string): Icon;
    
    
    
    function content_type_guess (filename: string, data: number[], data_size: number, result_uncertain: boolean): string;
    
    
    
    function content_type_guess_for_tree (root: File): string[];
    
    
    
    function content_type_is_a (_type: string, supertype: string): boolean;
    
    
    
    function content_type_is_mime_type (_type: string, mime_type: string): boolean;
    
    
    
    function content_type_is_unknown (_type: string): boolean;
    
    
    
    function content_type_set_mime_dirs (dirs: string[]): void;
    
    
    
    function content_types_get_registered (): GLib.List;
    
    
    
    function dbus_address_escape_value (string: string): string;
    
    
    
    function dbus_address_get_for_bus_sync (bus_type: BusType, cancellable: Cancellable): string;
    
    
    
    function dbus_address_get_stream (address: string, cancellable: Cancellable, callback: AsyncReadyCallback, user_data: any): void;
    
    
    
    function dbus_address_get_stream_finish (res: AsyncResult, out_guid: string): IOStream;
    
    
    
    function dbus_address_get_stream_sync (address: string, out_guid: string, cancellable: Cancellable): IOStream;
    
    
    
    function dbus_annotation_info_lookup (annotations: DBusAnnotationInfo[], name: string): string;
    
    
    
    function dbus_error_encode_gerror (error: GLib.Error): string;
    
    
    
    function dbus_error_get_remote_error (error: GLib.Error): string;
    
    
    
    function dbus_error_is_remote_error (error: GLib.Error): boolean;
    
    
    
    function dbus_error_new_for_dbus_error (dbus_error_name: string, dbus_error_message: string): GLib.Error;
    
    
    
    function dbus_error_quark (): GLib.Quark;
    
    
    
    function dbus_error_register_error (error_domain: GLib.Quark, error_code: number, dbus_error_name: string): boolean;
    
    
    
    function dbus_error_register_error_domain (error_domain_quark_name: string, quark_volatile: number, entries: DBusErrorEntry[], num_entries: number): void;
    
    
    
    function dbus_error_strip_remote_error (error: GLib.Error): boolean;
    
    
    
    function dbus_error_unregister_error (error_domain: GLib.Quark, error_code: number, dbus_error_name: string): boolean;
    
    
    
    function dbus_generate_guid (): string;
    
    
    
    function dbus_gvalue_to_gvariant (gvalue: GObject.Value, _type: GLib.VariantType): GLib.Variant;
    
    
    
    function dbus_gvariant_to_gvalue (value: GLib.Variant, out_gvalue: GObject.Value): void;
    
    
    
    function dbus_is_address (string: string): boolean;
    
    
    
    function dbus_is_guid (string: string): boolean;
    
    
    
    function dbus_is_interface_name (string: string): boolean;
    
    
    
    function dbus_is_member_name (string: string): boolean;
    
    
    
    function dbus_is_name (string: string): boolean;
    
    
    
    function dbus_is_supported_address (string: string): boolean;
    
    
    
    function dbus_is_unique_name (string: string): boolean;
    
    
    
    function dtls_client_connection_new (base_socket: DatagramBased, server_identity: SocketConnectable): DtlsClientConnection;
    
    
    
    function dtls_server_connection_new (base_socket: DatagramBased, certificate: TlsCertificate): DtlsServerConnection;
    
    
    
    function file_new_for_commandline_arg (_arg: string): File;
    
    
    
    function file_new_for_commandline_arg_and_cwd (_arg: string, cwd: string): File;
    
    
    
    function file_new_for_path (path: string): File;
    
    
    
    function file_new_for_uri (uri: string): File;
    
    
    
    function file_new_tmp (tmpl: string, iostream: FileIOStream): File;
    
    
    
    function file_parse_name (parse_name: string): File;
    
    
    
    function icon_deserialize (value: GLib.Variant): Icon;
    
    
    
    function icon_hash (icon: any): number;
    
    
    
    function icon_new_for_string (_str: string): Icon;
    
    
    
    function initable_newv (object_type: GObject.Type, n_parameters: number, parameters: GObject.Parameter[], cancellable: Cancellable): GObject.Object;
    
    
    
    function io_error_from_errno (err_no: number): IOErrorEnum;
    
    
    
    function io_error_quark (): GLib.Quark;
    
    
    
    function io_extension_point_implement (extension_point_name: string, _type: GObject.Type, extension_name: string, priority: number): IOExtension;
    
    
    
    function io_extension_point_lookup (name: string): IOExtensionPoint;
    
    
    
    function io_extension_point_register (name: string): IOExtensionPoint;
    
    
    
    function io_modules_load_all_in_directory (dirname: string): GLib.List;
    
    
    
    function io_modules_load_all_in_directory_with_scope (dirname: string, scope: IOModuleScope): GLib.List;
    
    
    
    function io_modules_scan_all_in_directory (dirname: string): void;
    
    
    
    function io_modules_scan_all_in_directory_with_scope (dirname: string, scope: IOModuleScope): void;
    
    
    
    function io_scheduler_cancel_all_jobs (): void;
    
    
    
    function io_scheduler_push_job (job_func: IOSchedulerJobFunc, user_data: any, notify: GLib.DestroyNotify, io_priority: number, cancellable: Cancellable): void;
    
    
    
    function keyfile_settings_backend_new (filename: string, root_path: string, root_group: string): SettingsBackend;
    
    
    
    function memory_settings_backend_new (): SettingsBackend;
    
    
    
    function network_monitor_get_default (): NetworkMonitor;
    
    
    
    function networking_init (): void;
    
    
    
    function null_settings_backend_new (): SettingsBackend;
    
    
    
    function pollable_source_new (pollable_stream: GObject.Object): GLib.Source;
    
    
    
    function pollable_source_new_full (pollable_stream: GObject.Object, child_source: GLib.Source, cancellable: Cancellable): GLib.Source;
    
    
    
    function pollable_stream_read (stream: InputStream, buffer: number[], count: number, blocking: boolean, cancellable: Cancellable): number;
    
    
    
    function pollable_stream_write (stream: OutputStream, buffer: number[], count: number, blocking: boolean, cancellable: Cancellable): number;
    
    
    
    function pollable_stream_write_all (stream: OutputStream, buffer: number[], count: number, blocking: boolean, bytes_written: number, cancellable: Cancellable): boolean;
    
    
    
    function proxy_get_default_for_protocol (protocol: string): Proxy;
    
    
    
    function proxy_resolver_get_default (): ProxyResolver;
    
    
    
    function resolver_error_quark (): GLib.Quark;
    
    
    
    function resource_error_quark (): GLib.Quark;
    
    
    
    function resource_load (filename: string): Resource;
    
    
    
    function resources_enumerate_children (path: string, lookup_flags: ResourceLookupFlags): string[];
    
    
    
    function resources_get_info (path: string, lookup_flags: ResourceLookupFlags, size: number, flags: number): boolean;
    
    
    
    function resources_lookup_data (path: string, lookup_flags: ResourceLookupFlags): GLib.Bytes;
    
    
    
    function resources_open_stream (path: string, lookup_flags: ResourceLookupFlags): InputStream;
    
    
    
    function resources_register (resource: Resource): void;
    
    
    
    function resources_unregister (resource: Resource): void;
    
    
    
    function settings_schema_source_get_default (): SettingsSchemaSource;
    
    
    
    function simple_async_report_error_in_idle (object: GObject.Object, callback: AsyncReadyCallback, user_data: any, domain: GLib.Quark, code: number, format: string): void;
    
    
    
    function simple_async_report_gerror_in_idle (object: GObject.Object, callback: AsyncReadyCallback, user_data: any, error: GLib.Error): void;
    
    
    
    function simple_async_report_take_gerror_in_idle (object: GObject.Object, callback: AsyncReadyCallback, user_data: any, error: GLib.Error): void;
    
    
    
    function srv_target_list_sort (targets: GLib.List): GLib.List;
    
    
    
    function tls_backend_get_default (): TlsBackend;
    
    
    
    function tls_client_connection_new (base_io_stream: IOStream, server_identity: SocketConnectable): TlsClientConnection;
    
    
    
    function tls_error_quark (): GLib.Quark;
    
    
    
    function tls_file_database_new (anchors: string): TlsFileDatabase;
    
    
    
    function tls_server_connection_new (base_io_stream: IOStream, certificate: TlsCertificate): TlsServerConnection;
    
    
    
    function unix_is_mount_path_system_internal (mount_path: string): boolean;
    
    
    
    function unix_is_system_device_path (device_path: string): boolean;
    
    
    
    function unix_is_system_fs_type (fs_type: string): boolean;
    
    
    
    function unix_mount_at (mount_path: string, time_read: number): UnixMountEntry;
    
    
    
    function unix_mount_compare (mount1: UnixMountEntry, mount2: UnixMountEntry): number;
    
    
    
    function unix_mount_copy (mount_entry: UnixMountEntry): UnixMountEntry;
    
    
    
    function unix_mount_for (file_path: string, time_read: number): UnixMountEntry;
    
    
    
    function unix_mount_free (mount_entry: UnixMountEntry): void;
    
    
    
    function unix_mount_get_device_path (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_get_fs_type (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_get_mount_path (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_get_options (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_get_root_path (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_guess_can_eject (mount_entry: UnixMountEntry): boolean;
    
    
    
    function unix_mount_guess_icon (mount_entry: UnixMountEntry): Icon;
    
    
    
    function unix_mount_guess_name (mount_entry: UnixMountEntry): string;
    
    
    
    function unix_mount_guess_should_display (mount_entry: UnixMountEntry): boolean;
    
    
    
    function unix_mount_guess_symbolic_icon (mount_entry: UnixMountEntry): Icon;
    
    
    
    function unix_mount_is_readonly (mount_entry: UnixMountEntry): boolean;
    
    
    
    function unix_mount_is_system_internal (mount_entry: UnixMountEntry): boolean;
    
    
    
    function unix_mount_points_changed_since (time: number): boolean;
    
    
    
    function unix_mount_points_get (time_read: number): GLib.List;
    
    
    
    function unix_mounts_changed_since (time: number): boolean;
    
    
    
    function unix_mounts_get (time_read: number): GLib.List;
    
    }