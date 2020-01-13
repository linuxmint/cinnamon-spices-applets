declare namespace imports.gi.GLib {

    class Array {
        public data: string;
        public len: number;
    
    
    }
    
    
    
    class AsyncQueue {
    
    
        public length () : number;
        public length_unlocked () : number;
        public lock () : void;
        public pop () : any;
        public pop_unlocked () : any;
        public push (data: any) : void;
        public push_front (item: any) : void;
        public push_front_unlocked (item: any) : void;
        public push_sorted (data: any, _func: CompareDataFunc, user_data: any) : void;
        public push_sorted_unlocked (data: any, _func: CompareDataFunc, user_data: any) : void;
        public push_unlocked (data: any) : void;
        public ref () : AsyncQueue;
        public ref_unlocked () : void;
        public remove (item: any) : boolean;
        public remove_unlocked (item: any) : boolean;
        public sort (_func: CompareDataFunc, user_data: any) : void;
        public sort_unlocked (_func: CompareDataFunc, user_data: any) : void;
        public timed_pop (end_time: TimeVal) : any;
        public timed_pop_unlocked (end_time: TimeVal) : any;
        public timeout_pop (timeout: number) : any;
        public timeout_pop_unlocked (timeout: number) : any;
        public try_pop () : any;
        public try_pop_unlocked () : any;
        public unlock () : void;
        public unref () : void;
        public unref_and_unlock () : void;
    }
    
    
    
    class BookmarkFile {
    
    
        public add_application (uri: string, name: string, exec: string) : void;
        public add_group (uri: string, group: string) : void;
        public free () : void;
        public get_added (uri: string) : number;
        public get_app_info (uri: string, name: string, exec: string, count: number, stamp: number) : boolean;
        public get_applications (uri: string, length: number) : string[];
        public get_description (uri: string) : string;
        public get_groups (uri: string, length: number) : string[];
        public get_icon (uri: string, href: string, mime_type: string) : boolean;
        public get_is_private (uri: string) : boolean;
        public get_mime_type (uri: string) : string;
        public get_modified (uri: string) : number;
        public get_size () : number;
        public get_title (uri: string) : string;
        public get_uris (length: number) : string[];
        public get_visited (uri: string) : number;
        public has_application (uri: string, name: string) : boolean;
        public has_group (uri: string, group: string) : boolean;
        public has_item (uri: string) : boolean;
        public load_from_data (data: number[], length: number) : boolean;
        public load_from_data_dirs (file: string, full_path: string) : boolean;
        public load_from_file (filename: string) : boolean;
        public move_item (old_uri: string, new_uri: string) : boolean;
        public remove_application (uri: string, name: string) : boolean;
        public remove_group (uri: string, group: string) : boolean;
        public remove_item (uri: string) : boolean;
        public set_added (uri: string, added: number) : void;
        public set_app_info (uri: string, name: string, exec: string, count: number, stamp: number) : boolean;
        public set_description (uri: string, description: string) : void;
        public set_groups (uri: string, groups: string[], length: number) : void;
        public set_icon (uri: string, href: string, mime_type: string) : void;
        public set_is_private (uri: string, is_private: boolean) : void;
        public set_mime_type (uri: string, mime_type: string) : void;
        public set_modified (uri: string, modified: number) : void;
        public set_title (uri: string, title: string) : void;
        public set_visited (uri: string, visited: number) : void;
        public to_data (length: number) : number[];
        public to_file (filename: string) : boolean;
    }
    
    
    
    class ByteArray {
        public data: number;
        public len: number;
    
    
    }
    
    
    
    class Bytes {
    
    
        public compare (bytes2: Bytes) : number;
        public equal (bytes2: Bytes) : boolean;
        public get_data (size: number) : number[];
        public get_size () : number;
        public hash () : number;
        public new_from_bytes (offset: number, length: number) : Bytes;
        public ref () : Bytes;
        public unref () : void;
        public unref_to_array () : number[];
        public unref_to_data (size: number) : number[];
    }
    
    
    
    class Checksum {
    
    
        public copy () : Checksum;
        public free () : void;
        public get_digest (buffer: number[], digest_len: number) : void;
        public get_string () : string;
        public reset () : void;
        public update (data: number[], length: number) : void;
    }
    
    
    
    class Cond {
        public p: any;
        public i: number[];
    
    
        public broadcast () : void;
        public clear () : void;
        public init () : void;
        public signal () : void;
        public wait (mutex: Mutex) : void;
        public wait_until (mutex: Mutex, end_time: number) : boolean;
    }
    
    
    
    class Data {
    
    
    }
    
    
    
    class Date {
        public julian_days: number;
        public julian: number;
        public dmy: number;
        public day: number;
        public month: number;
        public year: number;
    
    
        public add_days (n_days: number) : void;
        public add_months (n_months: number) : void;
        public add_years (n_years: number) : void;
        public clamp (min_date: Date, max_date: Date) : void;
        public clear (n_dates: number) : void;
        public compare (rhs: Date) : number;
        public copy () : Date;
        public days_between (date2: Date) : number;
        public free () : void;
        public get_day () : DateDay;
        public get_day_of_year () : number;
        public get_iso8601_week_of_year () : number;
        public get_julian () : number;
        public get_monday_week_of_year () : number;
        public get_month () : DateMonth;
        public get_sunday_week_of_year () : number;
        public get_weekday () : DateWeekday;
        public get_year () : DateYear;
        public is_first_of_month () : boolean;
        public is_last_of_month () : boolean;
        public order (date2: Date) : void;
        public set_day (day: DateDay) : void;
        public set_dmy (day: DateDay, month: DateMonth, _y: DateYear) : void;
        public set_julian (julian_date: number) : void;
        public set_month (month: DateMonth) : void;
        public set_parse (_str: string) : void;
        public set_time (time_: Time) : void;
        public set_time_t (timet: number) : void;
        public set_time_val (timeval: TimeVal) : void;
        public set_year (year: DateYear) : void;
        public subtract_days (n_days: number) : void;
        public subtract_months (n_months: number) : void;
        public subtract_years (n_years: number) : void;
        public to_struct_tm (tm: any) : void;
        public valid () : boolean;
    }
    
    
    
    class DateTime {
    
    
        public add (timespan: TimeSpan) : DateTime;
        public add_days (days: number) : DateTime;
        public add_full (years: number, months: number, days: number, hours: number, minutes: number, seconds: number) : DateTime;
        public add_hours (hours: number) : DateTime;
        public add_minutes (minutes: number) : DateTime;
        public add_months (months: number) : DateTime;
        public add_seconds (seconds: number) : DateTime;
        public add_weeks (weeks: number) : DateTime;
        public add_years (years: number) : DateTime;
        public difference (begin: DateTime) : TimeSpan;
        public format (format: string) : string;
        public get_day_of_month () : number;
        public get_day_of_week () : number;
        public get_day_of_year () : number;
        public get_hour () : number;
        public get_microsecond () : number;
        public get_minute () : number;
        public get_month () : number;
        public get_second () : number;
        public get_seconds () : number;
        public get_timezone () : TimeZone;
        public get_timezone_abbreviation () : string;
        public get_utc_offset () : TimeSpan;
        public get_week_numbering_year () : number;
        public get_week_of_year () : number;
        public get_year () : number;
        public get_ymd (year: number, month: number, day: number) : void;
        public is_daylight_savings () : boolean;
        public ref () : DateTime;
        public to_local () : DateTime;
        public to_timeval (tv: TimeVal) : boolean;
        public to_timezone (tz: TimeZone) : DateTime;
        public to_unix () : number;
        public to_utc () : DateTime;
        public unref () : void;
    }
    
    
    
    class DebugKey {
        public key: string;
        public value: number;
    
    
    }
    
    
    
    class Dir {
    
    
        public close () : void;
        public read_name () : string;
        public rewind () : void;
    }
    
    
    
    class Error {
        public domain: Quark;
        public code: number;
        public message: string;
    
    
        public copy () : Error;
        public free () : void;
        public matches (domain: Quark, code: number) : boolean;
    }
    
    
    
    class HashTable {
    
    
    }
    
    
    
    class HashTableIter {
        public dummy1: any;
        public dummy2: any;
        public dummy3: any;
        public dummy4: number;
        public dummy5: boolean;
        public dummy6: any;
    
    
        public get_hash_table () : GLib.HashTable;
        public init (hash_table: GLib.HashTable) : void;
        public next (key: any, value: any) : boolean;
        public remove () : void;
        public replace (value: any) : void;
        public steal () : void;
    }
    
    
    
    class Hmac {
    
    
        public copy () : Hmac;
        public get_digest (buffer: number[], digest_len: number) : void;
        public get_string () : string;
        public ref () : Hmac;
        public unref () : void;
        public update (data: number[], length: number) : void;
    }
    
    
    
    class Hook {
        public data: any;
        public next: Hook;
        public prev: Hook;
        public ref_count: number;
        public hook_id: number;
        public flags: number;
        public func: any;
        public destroy: DestroyNotify;
    
    
        public compare_ids (sibling: Hook) : number;
    }
    
    
    
    class HookList {
        public seq_id: number;
        public hook_size: number;
        public is_setup: number;
        public hooks: Hook;
        public dummy3: any;
        public finalize_hook: HookFinalizeFunc;
        public dummy: any[];
    
    
        public clear () : void;
        public init (hook_size: number) : void;
        public invoke (may_recurse: boolean) : void;
        public invoke_check (may_recurse: boolean) : void;
        public marshal (may_recurse: boolean, marshaller: HookMarshaller, marshal_data: any) : void;
        public marshal_check (may_recurse: boolean, marshaller: HookCheckMarshaller, marshal_data: any) : void;
    }
    
    
    
    class IConv {
    
    
        public  (inbuf: string, inbytes_left: number, outbuf: string, outbytes_left: number) : number;
        public close () : number;
    }
    
    
    
    class IOChannel {
        public ref_count: number;
        public funcs: IOFuncs;
        public encoding: string;
        public read_cd: IConv;
        public write_cd: IConv;
        public line_term: string;
        public line_term_len: number;
        public buf_size: number;
        public read_buf: String;
        public encoded_read_buf: String;
        public write_buf: String;
        public partial_write_buf: string[];
        public use_buffer: number;
        public do_encode: number;
        public close_on_unref: number;
        public is_readable: number;
        public is_writeable: number;
        public is_seekable: number;
        public reserved1: any;
        public reserved2: any;
    
    
        public close () : void;
        public flush () : IOStatus;
        public get_buffer_condition () : IOCondition;
        public get_buffer_size () : number;
        public get_buffered () : boolean;
        public get_close_on_unref () : boolean;
        public get_encoding () : string;
        public get_flags () : IOFlags;
        public get_line_term (length: number) : string;
        public init () : void;
        public read (buf: string, count: number, bytes_read: number) : IOError;
        public read_chars (buf: number[], count: number, bytes_read: number) : IOStatus;
        public read_line (str_return: string, length: number, terminator_pos: number) : IOStatus;
        public read_line_string (buffer: String, terminator_pos: number) : IOStatus;
        public read_to_end (str_return: number[], length: number) : IOStatus;
        public read_unichar (thechar: string) : IOStatus;
        public ref () : IOChannel;
        public seek (offset: number, _type: SeekType) : IOError;
        public seek_position (offset: number, _type: SeekType) : IOStatus;
        public set_buffer_size (size: number) : void;
        public set_buffered (buffered: boolean) : void;
        public set_close_on_unref (do_close: boolean) : void;
        public set_encoding (encoding: string) : IOStatus;
        public set_flags (flags: IOFlags) : IOStatus;
        public set_line_term (line_term: string, length: number) : void;
        public shutdown (flush: boolean) : IOStatus;
        public unix_get_fd () : number;
        public unref () : void;
        public write (buf: string, count: number, bytes_written: number) : IOError;
        public write_chars (buf: number[], count: number, bytes_written: number) : IOStatus;
        public write_unichar (thechar: string) : IOStatus;
    }
    
    
    
    class IOFuncs {
    
        io_read : {(channel: IOChannel, buf: string, count: number, bytes_read: number) : IOStatus;};
        io_write : {(channel: IOChannel, buf: string, count: number, bytes_written: number) : IOStatus;};
        io_seek : {(channel: IOChannel, offset: number, _type: SeekType) : IOStatus;};
        io_close : {(channel: IOChannel) : IOStatus;};
        io_create_watch : {(channel: IOChannel, condition: IOCondition) : Source;};
        io_free : {(channel: IOChannel) : void;};
        io_set_flags : {(channel: IOChannel, flags: IOFlags) : IOStatus;};
        io_get_flags : {(channel: IOChannel) : IOFlags;};
    
    }
    
    
    
    class KeyFile {
    
    
        public free () : void;
        public get_boolean (group_name: string, key: string) : boolean;
        public get_boolean_list (group_name: string, key: string, length: number) : boolean[];
        public get_comment (group_name: string, key: string) : string;
        public get_double (group_name: string, key: string) : number;
        public get_double_list (group_name: string, key: string, length: number) : number[];
        public get_groups (length: number) : string[];
        public get_int64 (group_name: string, key: string) : number;
        public get_integer (group_name: string, key: string) : number;
        public get_integer_list (group_name: string, key: string, length: number) : number[];
        public get_keys (group_name: string, length: number) : string[];
        public get_locale_for_key (group_name: string, key: string, locale: string) : string;
        public get_locale_string (group_name: string, key: string, locale: string) : string;
        public get_locale_string_list (group_name: string, key: string, locale: string, length: number) : string[];
        public get_start_group () : string;
        public get_string (group_name: string, key: string) : string;
        public get_string_list (group_name: string, key: string, length: number) : string[];
        public get_uint64 (group_name: string, key: string) : number;
        public get_value (group_name: string, key: string) : string;
        public has_group (group_name: string) : boolean;
        public has_key (group_name: string, key: string) : boolean;
        public load_from_bytes (bytes: Bytes, flags: KeyFileFlags) : boolean;
        public load_from_data (data: string, length: number, flags: KeyFileFlags) : boolean;
        public load_from_data_dirs (file: string, full_path: string, flags: KeyFileFlags) : boolean;
        public load_from_dirs (file: string, search_dirs: string[], full_path: string, flags: KeyFileFlags) : boolean;
        public load_from_file (file: string, flags: KeyFileFlags) : boolean;
        public ref () : KeyFile;
        public remove_comment (group_name: string, key: string) : boolean;
        public remove_group (group_name: string) : boolean;
        public remove_key (group_name: string, key: string) : boolean;
        public save_to_file (filename: string) : boolean;
        public set_boolean (group_name: string, key: string, value: boolean) : void;
        public set_boolean_list (group_name: string, key: string, list: boolean[], length: number) : void;
        public set_comment (group_name: string, key: string, comment: string) : boolean;
        public set_double (group_name: string, key: string, value: number) : void;
        public set_double_list (group_name: string, key: string, list: number[], length: number) : void;
        public set_int64 (group_name: string, key: string, value: number) : void;
        public set_integer (group_name: string, key: string, value: number) : void;
        public set_integer_list (group_name: string, key: string, list: number[], length: number) : void;
        public set_list_separator (separator: string) : void;
        public set_locale_string (group_name: string, key: string, locale: string, string: string) : void;
        public set_locale_string_list (group_name: string, key: string, locale: string, list: string[], length: number) : void;
        public set_string (group_name: string, key: string, string: string) : void;
        public set_string_list (group_name: string, key: string, list: string[], length: number) : void;
        public set_uint64 (group_name: string, key: string, value: number) : void;
        public set_value (group_name: string, key: string, value: string) : void;
        public to_data (length: number) : string;
        public unref () : void;
    }
    
    
    
    class List {
        public data: any;
        public next: GLib.List;
        public prev: GLib.List;
    
    
    }
    
    
    
    class LogField {
        public key: string;
        public value: any;
        public length: number;
    
    
    }
    
    
    
    class MainContext {
    
    
        public acquire () : boolean;
        public add_poll (fd: PollFD, priority: number) : void;
        public check (max_priority: number, fds: PollFD[], n_fds: number) : boolean;
        public dispatch () : void;
        public find_source_by_funcs_user_data (funcs: SourceFuncs, user_data: any) : Source;
        public find_source_by_id (source_id: number) : Source;
        public find_source_by_user_data (user_data: any) : Source;
        public get_poll_func () : PollFunc;
        public invoke (_function: SourceFunc, data: any) : void;
        public invoke_full (priority: number, _function: SourceFunc, data: any, notify: DestroyNotify) : void;
        public is_owner () : boolean;
        public iteration (may_block: boolean) : boolean;
        public pending () : boolean;
        public pop_thread_default () : void;
        public prepare (priority: number) : boolean;
        public push_thread_default () : void;
        public query (max_priority: number, timeout_: number, fds: PollFD[], n_fds: number) : number;
        public ref () : MainContext;
        public release () : void;
        public remove_poll (fd: PollFD) : void;
        public set_poll_func (_func: PollFunc) : void;
        public unref () : void;
        public wait (cond: Cond, mutex: Mutex) : boolean;
        public wakeup () : void;
    }
    
    
    
    class MainLoop {
    
    
        public get_context () : MainContext;
        public is_running () : boolean;
        public quit () : void;
        public ref () : MainLoop;
        public run () : void;
        public unref () : void;
    }
    
    
    
    class MappedFile {
    
    
        public free () : void;
        public get_bytes () : Bytes;
        public get_contents () : string;
        public get_length () : number;
        public ref () : MappedFile;
        public unref () : void;
    }
    
    
    
    class MarkupParseContext {
    
    
        public end_parse () : boolean;
        public free () : void;
        public get_element () : string;
        public get_element_stack () : GLib.SList;
        public get_position (line_number: number, char_number: number) : void;
        public get_user_data () : any;
        public parse (text: string, text_len: number) : boolean;
        public pop () : any;
        public push (parser: MarkupParser, user_data: any) : void;
        public ref () : MarkupParseContext;
        public unref () : void;
    }
    
    
    
    class MarkupParser {
    
        start_element : {(context: MarkupParseContext, element_name: string, attribute_names: string, attribute_values: string, user_data: any) : void;};
        end_element : {(context: MarkupParseContext, element_name: string, user_data: any) : void;};
        text : {(context: MarkupParseContext, text: string, text_len: number, user_data: any) : void;};
        passthrough : {(context: MarkupParseContext, passthrough_text: string, text_len: number, user_data: any) : void;};
        error : {(context: MarkupParseContext, error: Error, user_data: any) : void;};
    
    }
    
    
    
    class MatchInfo {
    
    
        public expand_references (string_to_expand: string) : string;
        public fetch (match_num: number) : string;
        public fetch_all () : string[];
        public fetch_named (name: string) : string;
        public fetch_named_pos (name: string, start_pos: number, end_pos: number) : boolean;
        public fetch_pos (match_num: number, start_pos: number, end_pos: number) : boolean;
        public free () : void;
        public get_match_count () : number;
        public get_regex () : Regex;
        public get_string () : string;
        public is_partial_match () : boolean;
        public matches () : boolean;
        public next () : boolean;
        public ref () : MatchInfo;
        public unref () : void;
    }
    
    
    
    class MemVTable {
    
        malloc : {(n_bytes: number) : any;};
        realloc : {(mem: any, n_bytes: number) : any;};
        free : {(mem: any) : void;};
        calloc : {(n_blocks: number, n_block_bytes: number) : any;};
        try_malloc : {(n_bytes: number) : any;};
        try_realloc : {(mem: any, n_bytes: number) : any;};
    
    }
    
    
    
    class Node {
        public data: any;
        public next: Node;
        public prev: Node;
        public parent: Node;
        public children: Node;
    
    
        public child_index (data: any) : number;
        public child_position (child: Node) : number;
        public children_foreach (flags: TraverseFlags, _func: NodeForeachFunc, data: any) : void;
        public copy () : Node;
        public copy_deep (copy_func: CopyFunc, data: any) : Node;
        public depth () : number;
        public destroy () : void;
        public find (order: TraverseType, flags: TraverseFlags, data: any) : Node;
        public find_child (flags: TraverseFlags, data: any) : Node;
        public first_sibling () : Node;
        public get_root () : Node;
        public insert (position: number, node: Node) : Node;
        public insert_after (sibling: Node, node: Node) : Node;
        public insert_before (sibling: Node, node: Node) : Node;
        public is_ancestor (descendant: Node) : boolean;
        public last_child () : Node;
        public last_sibling () : Node;
        public max_height () : number;
        public n_children () : number;
        public n_nodes (flags: TraverseFlags) : number;
        public nth_child (_n: number) : Node;
        public prepend (node: Node) : Node;
        public reverse_children () : void;
        public traverse (order: TraverseType, flags: TraverseFlags, max_depth: number, _func: NodeTraverseFunc, data: any) : void;
        public unlink () : void;
    }
    
    
    
    class Once {
        public status: OnceStatus;
        public retval: any;
    
    
        public impl (_func: ThreadFunc, _arg: any) : any;
    }
    
    
    
    class OptionContext {
    
    
        public add_group (group: OptionGroup) : void;
        public add_main_entries (entries: OptionEntry, translation_domain: string) : void;
        public free () : void;
        public get_description () : string;
        public get_help (main_help: boolean, group: OptionGroup) : string;
        public get_help_enabled () : boolean;
        public get_ignore_unknown_options () : boolean;
        public get_main_group () : OptionGroup;
        public get_strict_posix () : boolean;
        public get_summary () : string;
        public parse (argc: number, argv: string[]) : boolean;
        public parse_strv (_arguments: string[]) : boolean;
        public set_description (description: string) : void;
        public set_help_enabled (help_enabled: boolean) : void;
        public set_ignore_unknown_options (ignore_unknown: boolean) : void;
        public set_main_group (group: OptionGroup) : void;
        public set_strict_posix (strict_posix: boolean) : void;
        public set_summary (summary: string) : void;
        public set_translate_func (_func: TranslateFunc, data: any, destroy_notify: DestroyNotify) : void;
        public set_translation_domain (domain: string) : void;
    }
    
    
    
    class OptionEntry {
        public long_name: string;
        public short_name: string;
        public flags: number;
        public arg: OptionArg;
        public arg_data: any;
        public description: string;
        public arg_description: string;
    
    
    }
    
    
    
    class OptionGroup {
    
    
        public add_entries (entries: OptionEntry) : void;
        public free () : void;
        public ref () : OptionGroup;
        public set_error_hook (error_func: OptionErrorFunc) : void;
        public set_parse_hooks (pre_parse_func: OptionParseFunc, post_parse_func: OptionParseFunc) : void;
        public set_translate_func (_func: TranslateFunc, data: any, destroy_notify: DestroyNotify) : void;
        public set_translation_domain (domain: string) : void;
        public unref () : void;
    }
    
    
    
    class PatternSpec {
    
    
        public equal (pspec2: PatternSpec) : boolean;
        public free () : void;
    }
    
    
    
    class PollFD {
        public fd: number;
        public events: number;
        public revents: number;
    
    
    }
    
    
    
    class Private {
        public p: any;
        public notify: DestroyNotify;
        public future: any[];
    
    
        public get () : any;
        public replace (value: any) : void;
        public set (value: any) : void;
    }
    
    
    
    class PtrArray {
        public pdata: any;
        public len: number;
    
    
    }
    
    
    
    class Queue {
        public head: GLib.List;
        public tail: GLib.List;
        public length: number;
    
    
        public clear () : void;
        public clear_full (free_func: DestroyNotify) : void;
        public copy () : Queue;
        public delete_link (link_: GLib.List) : void;
        public find (data: any) : GLib.List;
        public find_custom (data: any, _func: CompareFunc) : GLib.List;
        public foreach (_func: Func, user_data: any) : void;
        public free () : void;
        public free_full (free_func: DestroyNotify) : void;
        public get_length () : number;
        public index (data: any) : number;
        public init () : void;
        public insert_after (sibling: GLib.List, data: any) : void;
        public insert_before (sibling: GLib.List, data: any) : void;
        public insert_sorted (data: any, _func: CompareDataFunc, user_data: any) : void;
        public is_empty () : boolean;
        public link_index (link_: GLib.List) : number;
        public peek_head () : any;
        public peek_head_link () : GLib.List;
        public peek_nth (_n: number) : any;
        public peek_nth_link (_n: number) : GLib.List;
        public peek_tail () : any;
        public peek_tail_link () : GLib.List;
        public pop_head () : any;
        public pop_head_link () : GLib.List;
        public pop_nth (_n: number) : any;
        public pop_nth_link (_n: number) : GLib.List;
        public pop_tail () : any;
        public pop_tail_link () : GLib.List;
        public push_head (data: any) : void;
        public push_head_link (link_: GLib.List) : void;
        public push_nth (data: any, _n: number) : void;
        public push_nth_link (_n: number, link_: GLib.List) : void;
        public push_tail (data: any) : void;
        public push_tail_link (link_: GLib.List) : void;
        public remove (data: any) : boolean;
        public remove_all (data: any) : number;
        public reverse () : void;
        public sort (compare_func: CompareDataFunc, user_data: any) : void;
        public unlink (link_: GLib.List) : void;
    }
    
    
    
    class RWLock {
        public p: any;
        public i: number[];
    
    
        public clear () : void;
        public init () : void;
        public reader_lock () : void;
        public reader_trylock () : boolean;
        public reader_unlock () : void;
        public writer_lock () : void;
        public writer_trylock () : boolean;
        public writer_unlock () : void;
    }
    
    
    
    class Rand {
    
    
        public copy () : Rand;
        public double () : number;
        public double_range (begin: number, _end: number) : number;
        public free () : void;
        public int () : number;
        public int_range (begin: number, _end: number) : number;
        public set_seed (seed: number) : void;
        public set_seed_array (seed: number, seed_length: number) : void;
    }
    
    
    
    class RecMutex {
        public p: any;
        public i: number[];
    
    
        public clear () : void;
        public init () : void;
        public lock () : void;
        public trylock () : boolean;
        public unlock () : void;
    }
    
    
    
    class Regex {
    
    
        public get_capture_count () : number;
        public get_compile_flags () : RegexCompileFlags;
        public get_has_cr_or_lf () : boolean;
        public get_match_flags () : RegexMatchFlags;
        public get_max_backref () : number;
        public get_max_lookbehind () : number;
        public get_pattern () : string;
        public get_string_number (name: string) : number;
        public match (string: string, match_options: RegexMatchFlags, match_info: MatchInfo) : boolean;
        public match_all (string: string, match_options: RegexMatchFlags, match_info: MatchInfo) : boolean;
        public match_all_full (string: string[], string_len: number, start_position: number, match_options: RegexMatchFlags, match_info: MatchInfo) : boolean;
        public match_full (string: string[], string_len: number, start_position: number, match_options: RegexMatchFlags, match_info: MatchInfo) : boolean;
        public ref () : Regex;
        public replace (string: string[], string_len: number, start_position: number, replacement: string, match_options: RegexMatchFlags) : string;
        public replace_eval (string: string[], string_len: number, start_position: number, match_options: RegexMatchFlags, _eval: RegexEvalCallback, user_data: any) : string;
        public replace_literal (string: string[], string_len: number, start_position: number, replacement: string, match_options: RegexMatchFlags) : string;
        public split (string: string, match_options: RegexMatchFlags) : string[];
        public split_full (string: string[], string_len: number, start_position: number, match_options: RegexMatchFlags, max_tokens: number) : string[];
        public unref () : void;
    }
    
    
    
    class SList {
        public data: any;
        public next: GLib.SList;
    
    
    }
    
    
    
    class Scanner {
        public user_data: any;
        public max_parse_errors: number;
        public parse_errors: number;
        public input_name: string;
        public qdata: Data;
        public config: ScannerConfig;
        public token: TokenType;
        public value: TokenValue;
        public line: number;
        public position: number;
        public next_token: TokenType;
        public next_value: TokenValue;
        public next_line: number;
        public next_position: number;
        public symbol_table: GLib.HashTable;
        public input_fd: number;
        public text: string;
        public text_end: string;
        public buffer: string;
        public scope_id: number;
        public msg_handler: ScannerMsgFunc;
    
    
        public cur_line () : number;
        public cur_position () : number;
        public cur_token () : TokenType;
        public cur_value () : TokenValue;
        public destroy () : void;
        public eof () : boolean;
        public error (format: string) : void;
        public get_next_token () : TokenType;
        public input_file (input_fd: number) : void;
        public input_text (text: string, text_len: number) : void;
        public lookup_symbol (symbol: string) : any;
        public peek_next_token () : TokenType;
        public scope_add_symbol (scope_id: number, symbol: string, value: any) : void;
        public scope_foreach_symbol (scope_id: number, _func: HFunc, user_data: any) : void;
        public scope_lookup_symbol (scope_id: number, symbol: string) : any;
        public scope_remove_symbol (scope_id: number, symbol: string) : void;
        public set_scope (scope_id: number) : number;
        public sync_file_offset () : void;
        public unexp_token (expected_token: TokenType, identifier_spec: string, symbol_spec: string, symbol_name: string, message: string, is_error: number) : void;
        public warn (format: string) : void;
    }
    
    
    
    class ScannerConfig {
        public cset_skip_characters: string;
        public cset_identifier_first: string;
        public cset_identifier_nth: string;
        public cpair_comment_single: string;
        public case_sensitive: number;
        public skip_comment_multi: number;
        public skip_comment_single: number;
        public scan_comment_multi: number;
        public scan_identifier: number;
        public scan_identifier_1char: number;
        public scan_identifier_NULL: number;
        public scan_symbols: number;
        public scan_binary: number;
        public scan_octal: number;
        public scan_float: number;
        public scan_hex: number;
        public scan_hex_dollar: number;
        public scan_string_sq: number;
        public scan_string_dq: number;
        public numbers_2_int: number;
        public int_2_float: number;
        public identifier_2_string: number;
        public char_2_token: number;
        public symbol_2_token: number;
        public scope_0_fallback: number;
        public store_int64: number;
        public padding_dummy: number;
    
    
    }
    
    
    
    class Sequence {
    
    
        public append (data: any) : SequenceIter;
        public foreach (_func: Func, user_data: any) : void;
        public free () : void;
        public get_begin_iter () : SequenceIter;
        public get_end_iter () : SequenceIter;
        public get_iter_at_pos (pos: number) : SequenceIter;
        public get_length () : number;
        public insert_sorted (data: any, cmp_func: CompareDataFunc, cmp_data: any) : SequenceIter;
        public insert_sorted_iter (data: any, iter_cmp: SequenceIterCompareFunc, cmp_data: any) : SequenceIter;
        public is_empty () : boolean;
        public lookup (data: any, cmp_func: CompareDataFunc, cmp_data: any) : SequenceIter;
        public lookup_iter (data: any, iter_cmp: SequenceIterCompareFunc, cmp_data: any) : SequenceIter;
        public prepend (data: any) : SequenceIter;
        public search (data: any, cmp_func: CompareDataFunc, cmp_data: any) : SequenceIter;
        public search_iter (data: any, iter_cmp: SequenceIterCompareFunc, cmp_data: any) : SequenceIter;
        public sort (cmp_func: CompareDataFunc, cmp_data: any) : void;
        public sort_iter (cmp_func: SequenceIterCompareFunc, cmp_data: any) : void;
    }
    
    
    
    class SequenceIter {
    
    
        public compare (_b: SequenceIter) : number;
        public get_position () : number;
        public get_sequence () : Sequence;
        public is_begin () : boolean;
        public is_end () : boolean;
        public move (delta: number) : SequenceIter;
        public next () : SequenceIter;
        public prev () : SequenceIter;
    }
    
    
    
    class Source {
        public callback_data: any;
        public callback_funcs: SourceCallbackFuncs;
        public source_funcs: SourceFuncs;
        public ref_count: number;
        public context: MainContext;
        public priority: number;
        public flags: number;
        public source_id: number;
        public poll_fds: GLib.SList;
        public prev: Source;
        public next: Source;
        public name: string;
        public priv: SourcePrivate;
    
    
        public add_child_source (child_source: Source) : void;
        public add_poll (fd: PollFD) : void;
        public add_unix_fd (fd: number, events: IOCondition) : any;
        public attach (context: MainContext) : number;
        public destroy () : void;
        public get_can_recurse () : boolean;
        public get_context () : MainContext;
        public get_current_time (timeval: TimeVal) : void;
        public get_id () : number;
        public get_name () : string;
        public get_priority () : number;
        public get_ready_time () : number;
        public get_time () : number;
        public is_destroyed () : boolean;
        public modify_unix_fd (tag: any, new_events: IOCondition) : void;
        public query_unix_fd (tag: any) : IOCondition;
        public ref () : Source;
        public remove_child_source (child_source: Source) : void;
        public remove_poll (fd: PollFD) : void;
        public remove_unix_fd (tag: any) : void;
        public set_callback (_func: SourceFunc, data: any, notify: DestroyNotify) : void;
        public set_callback_indirect (callback_data: any, callback_funcs: SourceCallbackFuncs) : void;
        public set_can_recurse (can_recurse: boolean) : void;
        public set_funcs (funcs: SourceFuncs) : void;
        public set_name (name: string) : void;
        public set_priority (priority: number) : void;
        public set_ready_time (ready_time: number) : void;
        public unref () : void;
    }
    
    
    
    class SourceCallbackFuncs {
    
        ref : {(cb_data: any) : void;};
        unref : {(cb_data: any) : void;};
        get : {(cb_data: any, source: Source, _func: SourceFunc, data: any) : void;};
    
    }
    
    
    
    class SourceFuncs {
        public closure_callback: SourceFunc;
        public closure_marshal: SourceDummyMarshal;
    
        prepare : {(source: Source, timeout_: number) : boolean;};
        check : {(source: Source) : boolean;};
        dispatch : {(source: Source, callback: SourceFunc, user_data: any) : boolean;};
        finalize : {(source: Source) : void;};
    
    }
    
    
    
    class SourcePrivate {
    
    
    }
    
    
    
    class StatBuf {
    
    
    }
    
    
    
    class String {
        public str: string;
        public len: number;
        public allocated_len: number;
    
    
        public append (_val: string) : String;
        public append_c (_c: string) : String;
        public append_len (_val: string, len: number) : String;
        public append_printf (format: string) : void;
        public append_unichar (wc: string) : String;
        public append_uri_escaped (unescaped: string, reserved_chars_allowed: string, allow_utf8: boolean) : String;
        public append_vprintf (format: string, args: any[]) : void;
        public ascii_down () : String;
        public ascii_up () : String;
        public assign (rval: string) : String;
        public down () : String;
        public equal (v2: String) : boolean;
        public erase (pos: number, len: number) : String;
        public free (free_segment: boolean) : string;
        public free_to_bytes () : Bytes;
        public hash () : number;
        public insert (pos: number, _val: string) : String;
        public insert_c (pos: number, _c: string) : String;
        public insert_len (pos: number, _val: string, len: number) : String;
        public insert_unichar (pos: number, wc: string) : String;
        public overwrite (pos: number, _val: string) : String;
        public overwrite_len (pos: number, _val: string, len: number) : String;
        public prepend (_val: string) : String;
        public prepend_c (_c: string) : String;
        public prepend_len (_val: string, len: number) : String;
        public prepend_unichar (wc: string) : String;
        public printf (format: string) : void;
        public set_size (len: number) : String;
        public truncate (len: number) : String;
        public up () : String;
        public vprintf (format: string, args: any[]) : void;
    }
    
    
    
    class StringChunk {
    
    
        public clear () : void;
        public free () : void;
        public insert (string: string) : string;
        public insert_const (string: string) : string;
        public insert_len (string: string, len: number) : string;
    }
    
    
    
    class TestCase {
    
    
    }
    
    
    
    class TestConfig {
        public test_initialized: boolean;
        public test_quick: boolean;
        public test_perf: boolean;
        public test_verbose: boolean;
        public test_quiet: boolean;
        public test_undefined: boolean;
    
    
    }
    
    
    
    class TestLogBuffer {
        public data: String;
        public msgs: GLib.SList;
    
    
        public free () : void;
        public pop () : TestLogMsg;
        public push (n_bytes: number, bytes: number) : void;
    }
    
    
    
    class TestLogMsg {
        public log_type: TestLogType;
        public n_strings: number;
        public strings: string;
        public n_nums: number;
        public nums: number;
    
    
        public free () : void;
    }
    
    
    
    class TestSuite {
    
    
        public add (test_case: TestCase) : void;
        public add_suite (nestedsuite: TestSuite) : void;
    }
    
    
    
    class Thread {
    
    
        public join () : any;
        public ref () : Thread;
        public unref () : void;
    }
    
    
    
    class ThreadPool {
        public func: Func;
        public user_data: any;
        public exclusive: boolean;
    
    
        public free (immediate: boolean, wait_: boolean) : void;
        public get_max_threads () : number;
        public get_num_threads () : number;
        public move_to_front (data: any) : boolean;
        public push (data: any) : boolean;
        public set_max_threads (max_threads: number) : boolean;
        public set_sort_function (_func: CompareDataFunc, user_data: any) : void;
        public unprocessed () : number;
    }
    
    
    
    class TimeVal {
        public tv_sec: number;
        public tv_usec: number;
    
    
        public add (microseconds: number) : void;
        public to_iso8601 () : string;
    }
    
    
    
    class TimeZone {
    
    
        public adjust_time (_type: TimeType, time_: number) : number;
        public find_interval (_type: TimeType, time_: number) : number;
        public get_abbreviation (interval: number) : string;
        public get_identifier () : string;
        public get_offset (interval: number) : number;
        public is_dst (interval: number) : boolean;
        public ref () : TimeZone;
        public unref () : void;
    }
    
    
    
    class Timer {
    
    
        public continue () : void;
        public destroy () : void;
        public elapsed (microseconds: number) : number;
        public reset () : void;
        public start () : void;
        public stop () : void;
    }
    
    
    
    class TrashStack {
        public next: TrashStack;
    
    
    }
    
    
    
    class Tree {
    
    
        public destroy () : void;
        public foreach (_func: TraverseFunc, user_data: any) : void;
        public height () : number;
        public insert (key: any, value: any) : void;
        public lookup (key: any) : any;
        public lookup_extended (lookup_key: any, orig_key: any, value: any) : boolean;
        public nnodes () : number;
        public ref () : Tree;
        public remove (key: any) : boolean;
        public replace (key: any, value: any) : void;
        public search (search_func: CompareFunc, user_data: any) : any;
        public steal (key: any) : boolean;
        public traverse (traverse_func: TraverseFunc, traverse_type: TraverseType, user_data: any) : void;
        public unref () : void;
    }
    
    
    
    class Variant {
    
    
        public byteswap () : Variant;
        public check_format_string (format_string: string, copy_only: boolean) : boolean;
        public classify () : VariantClass;
        public compare (two: Variant) : number;
        public dup_bytestring (length: number) : number[];
        public dup_bytestring_array (length: number) : string[];
        public dup_objv (length: number) : string[];
        public dup_string (length: number) : string;
        public dup_strv (length: number) : string[];
        public equal (two: Variant) : boolean;
        public get (format_string: string) : void;
        public get_boolean () : boolean;
        public get_byte () : number;
        public get_bytestring () : number[];
        public get_bytestring_array (length: number) : string[];
        public get_child (index_: number, format_string: string) : void;
        public get_child_value (index_: number) : Variant;
        public get_data () : any;
        public get_data_as_bytes () : Bytes;
        public get_double () : number;
        public get_fixed_array (n_elements: number, element_size: number) : any[];
        public get_handle () : number;
        public get_int16 () : number;
        public get_int32 () : number;
        public get_int64 () : number;
        public get_maybe () : Variant;
        public get_normal_form () : Variant;
        public get_objv (length: number) : string[];
        public get_size () : number;
        public get_string (length: number) : string;
        public get_strv (length: number) : string[];
        public get_type () : VariantType;
        public get_type_string () : string;
        public get_uint16 () : number;
        public get_uint32 () : number;
        public get_uint64 () : number;
        public get_va (format_string: string, endptr: string, app: any[]) : void;
        public get_variant () : Variant;
        public hash () : number;
        public is_container () : boolean;
        public is_floating () : boolean;
        public is_normal_form () : boolean;
        public is_of_type (_type: VariantType) : boolean;
        public iter_new () : VariantIter;
        public lookup (key: string, format_string: string) : boolean;
        public lookup_value (key: string, expected_type: VariantType) : Variant;
        public n_children () : number;
        public print (type_annotate: boolean) : string;
        public print_string (string: String, type_annotate: boolean) : String;
        public ref () : Variant;
        public ref_sink () : Variant;
        public store (data: any) : void;
        public take_ref () : Variant;
        public unref () : void;
    }
    
    
    
    class VariantBuilder {
    
    
        public add (format_string: string) : void;
        public add_parsed (format: string) : void;
        public add_value (value: Variant) : void;
        public clear () : void;
        public close () : void;
        public end () : Variant;
        public init (_type: VariantType) : void;
        public open (_type: VariantType) : void;
        public ref () : VariantBuilder;
        public unref () : void;
    }
    
    
    
    class VariantDict {
    
    
        public clear () : void;
        public contains (key: string) : boolean;
        public end () : Variant;
        public init (from_asv: Variant) : void;
        public insert (key: string, format_string: string) : void;
        public insert_value (key: string, value: Variant) : void;
        public lookup (key: string, format_string: string) : boolean;
        public lookup_value (key: string, expected_type: VariantType) : Variant;
        public ref () : VariantDict;
        public remove (key: string) : boolean;
        public unref () : void;
    }
    
    
    
    class VariantIter {
        public x: number[];
    
    
        public copy () : VariantIter;
        public free () : void;
        public init (value: Variant) : number;
        public loop (format_string: string) : boolean;
        public n_children () : number;
        public next (format_string: string) : boolean;
        public next_value () : Variant;
    }
    
    
    
    class VariantType {
    
    
        public copy () : VariantType;
        public dup_string () : string;
        public element () : VariantType;
        public equal (type2: VariantType) : boolean;
        public first () : VariantType;
        public free () : void;
        public get_string_length () : number;
        public hash () : number;
        public is_array () : boolean;
        public is_basic () : boolean;
        public is_container () : boolean;
        public is_definite () : boolean;
        public is_dict_entry () : boolean;
        public is_maybe () : boolean;
        public is_subtype_of (supertype: VariantType) : boolean;
        public is_tuple () : boolean;
        public is_variant () : boolean;
        public key () : VariantType;
        public n_items () : number;
        public next () : VariantType;
        public peek_string () : string;
        public value () : VariantType;
    }
    
    
    
    enum BookmarkFileError {
        invalid_uri = 0,
        invalid_value = 1,
        app_not_registered = 2,
        uri_not_found = 3,
        read = 4,
        unknown_encoding = 5,
        write = 6,
        file_not_found = 7
    }
    
    
    
    enum ChecksumType {
        md5 = 0,
        sha1 = 1,
        sha256 = 2,
        sha512 = 3,
        sha384 = 4
    }
    
    
    
    enum ConvertError {
        no_conversion = 0,
        illegal_sequence = 1,
        failed = 2,
        partial_input = 3,
        bad_uri = 4,
        not_absolute_path = 5,
        no_memory = 6,
        embedded_nul = 7
    }
    
    
    
    enum DateDMY {
        day = 0,
        month = 1,
        year = 2
    }
    
    
    
    enum DateMonth {
        bad_month = 0,
        january = 1,
        february = 2,
        march = 3,
        april = 4,
        may = 5,
        june = 6,
        july = 7,
        august = 8,
        september = 9,
        october = 10,
        november = 11,
        december = 12
    }
    
    
    
    enum DateWeekday {
        bad_weekday = 0,
        monday = 1,
        tuesday = 2,
        wednesday = 3,
        thursday = 4,
        friday = 5,
        saturday = 6,
        sunday = 7
    }
    
    
    
    enum ErrorType {
        unknown = 0,
        unexp_eof = 1,
        unexp_eof_in_string = 2,
        unexp_eof_in_comment = 3,
        non_digit_in_const = 4,
        digit_radix = 5,
        float_radix = 6,
        float_malformed = 7
    }
    
    
    
    enum FileError {
        exist = 0,
        isdir = 1,
        acces = 2,
        nametoolong = 3,
        noent = 4,
        notdir = 5,
        nxio = 6,
        nodev = 7,
        rofs = 8,
        txtbsy = 9,
        fault = 10,
        loop = 11,
        nospc = 12,
        nomem = 13,
        mfile = 14,
        nfile = 15,
        badf = 16,
        inval = 17,
        pipe = 18,
        again = 19,
        intr = 20,
        io = 21,
        perm = 22,
        nosys = 23,
        failed = 24
    }
    
    
    
    enum IOChannelError {
        fbig = 0,
        inval = 1,
        io = 2,
        isdir = 3,
        nospc = 4,
        nxio = 5,
        overflow = 6,
        pipe = 7,
        failed = 8
    }
    
    
    
    enum IOError {
        none = 0,
        again = 1,
        inval = 2,
        unknown = 3
    }
    
    
    
    enum IOStatus {
        error = 0,
        normal = 1,
        eof = 2,
        again = 3
    }
    
    
    
    enum KeyFileError {
        unknown_encoding = 0,
        parse = 1,
        not_found = 2,
        key_not_found = 3,
        group_not_found = 4,
        invalid_value = 5
    }
    
    
    
    enum LogWriterOutput {
        handled = 1,
        unhandled = 0
    }
    
    
    
    enum MarkupError {
        bad_utf8 = 0,
        empty = 1,
        parse = 2,
        unknown_element = 3,
        unknown_attribute = 4,
        invalid_content = 5,
        missing_attribute = 6
    }
    
    
    
    enum NormalizeMode {
        default = 0,
        nfd = 0,
        default_compose = 1,
        nfc = 1,
        all = 2,
        nfkd = 2,
        all_compose = 3,
        nfkc = 3
    }
    
    
    
    enum NumberParserError {
        invalid = 0,
        out_of_bounds = 1
    }
    
    
    
    enum OnceStatus {
        notcalled = 0,
        progress = 1,
        ready = 2
    }
    
    
    
    enum OptionArg {
        none = 0,
        string = 1,
        int = 2,
        callback = 3,
        filename = 4,
        string_array = 5,
        filename_array = 6,
        double = 7,
        int64 = 8
    }
    
    
    
    enum OptionError {
        unknown_option = 0,
        bad_value = 1,
        failed = 2
    }
    
    
    
    enum RegexError {
        compile = 0,
        optimize = 1,
        replace = 2,
        match = 3,
        internal = 4,
        stray_backslash = 101,
        missing_control_char = 102,
        unrecognized_escape = 103,
        quantifiers_out_of_order = 104,
        quantifier_too_big = 105,
        unterminated_character_class = 106,
        invalid_escape_in_character_class = 107,
        range_out_of_order = 108,
        nothing_to_repeat = 109,
        unrecognized_character = 112,
        posix_named_class_outside_class = 113,
        unmatched_parenthesis = 114,
        inexistent_subpattern_reference = 115,
        unterminated_comment = 118,
        expression_too_large = 120,
        memory_error = 121,
        variable_length_lookbehind = 125,
        malformed_condition = 126,
        too_many_conditional_branches = 127,
        assertion_expected = 128,
        unknown_posix_class_name = 130,
        posix_collating_elements_not_supported = 131,
        hex_code_too_large = 134,
        invalid_condition = 135,
        single_byte_match_in_lookbehind = 136,
        infinite_loop = 140,
        missing_subpattern_name_terminator = 142,
        duplicate_subpattern_name = 143,
        malformed_property = 146,
        unknown_property = 147,
        subpattern_name_too_long = 148,
        too_many_subpatterns = 149,
        invalid_octal_value = 151,
        too_many_branches_in_define = 154,
        define_repetion = 155,
        inconsistent_newline_options = 156,
        missing_back_reference = 157,
        invalid_relative_reference = 158,
        backtracking_control_verb_argument_forbidden = 159,
        unknown_backtracking_control_verb = 160,
        number_too_big = 161,
        missing_subpattern_name = 162,
        missing_digit = 163,
        invalid_data_character = 164,
        extra_subpattern_name = 165,
        backtracking_control_verb_argument_required = 166,
        invalid_control_char = 168,
        missing_name = 169,
        not_supported_in_class = 171,
        too_many_forward_references = 172,
        name_too_long = 175,
        character_value_too_large = 176
    }
    
    
    
    enum SeekType {
        cur = 0,
        set = 1,
        end = 2
    }
    
    
    
    enum ShellError {
        bad_quoting = 0,
        empty_string = 1,
        failed = 2
    }
    
    
    
    enum SliceConfig {
        always_malloc = 1,
        bypass_magazines = 2,
        working_set_msecs = 3,
        color_increment = 4,
        chunk_sizes = 5,
        contention_counter = 6
    }
    
    
    
    enum SpawnError {
        fork = 0,
        read = 1,
        chdir = 2,
        acces = 3,
        perm = 4,
        too_big = 5,
        _2big = 5,
        noexec = 6,
        nametoolong = 7,
        noent = 8,
        nomem = 9,
        notdir = 10,
        loop = 11,
        txtbusy = 12,
        io = 13,
        nfile = 14,
        mfile = 15,
        inval = 16,
        isdir = 17,
        libbad = 18,
        failed = 19
    }
    
    
    
    enum TestFileType {
        dist = 0,
        built = 1
    }
    
    
    
    enum TestLogType {
        none = 0,
        error = 1,
        start_binary = 2,
        list_case = 3,
        skip_case = 4,
        start_case = 5,
        stop_case = 6,
        min_result = 7,
        max_result = 8,
        message = 9,
        start_suite = 10,
        stop_suite = 11
    }
    
    
    
    enum TestResult {
        success = 0,
        skipped = 1,
        failure = 2,
        incomplete = 3
    }
    
    
    
    enum ThreadError {
        thread_error_again = 0
    }
    
    
    
    enum TimeType {
        standard = 0,
        daylight = 1,
        universal = 2
    }
    
    
    
    enum TokenType {
        eof = 0,
        left_paren = 40,
        right_paren = 41,
        left_curly = 123,
        right_curly = 125,
        left_brace = 91,
        right_brace = 93,
        equal_sign = 61,
        comma = 44,
        none = 256,
        error = 257,
        char = 258,
        binary = 259,
        octal = 260,
        int = 261,
        hex = 262,
        float = 263,
        string = 264,
        symbol = 265,
        identifier = 266,
        identifier_null = 267,
        comment_single = 268,
        comment_multi = 269
    }
    
    
    
    enum TraverseType {
        in_order = 0,
        pre_order = 1,
        post_order = 2,
        level_order = 3
    }
    
    
    
    enum UnicodeBreakType {
        mandatory = 0,
        carriage_return = 1,
        line_feed = 2,
        combining_mark = 3,
        surrogate = 4,
        zero_width_space = 5,
        inseparable = 6,
        non_breaking_glue = 7,
        contingent = 8,
        space = 9,
        after = 10,
        before = 11,
        before_and_after = 12,
        hyphen = 13,
        non_starter = 14,
        open_punctuation = 15,
        close_punctuation = 16,
        quotation = 17,
        exclamation = 18,
        ideographic = 19,
        numeric = 20,
        infix_separator = 21,
        symbol = 22,
        alphabetic = 23,
        prefix = 24,
        postfix = 25,
        complex_context = 26,
        ambiguous = 27,
        unknown = 28,
        next_line = 29,
        word_joiner = 30,
        hangul_l_jamo = 31,
        hangul_v_jamo = 32,
        hangul_t_jamo = 33,
        hangul_lv_syllable = 34,
        hangul_lvt_syllable = 35,
        close_paranthesis = 36,
        conditional_japanese_starter = 37,
        hebrew_letter = 38,
        regional_indicator = 39,
        emoji_base = 40,
        emoji_modifier = 41,
        zero_width_joiner = 42
    }
    
    
    
    enum UnicodeScript {
        invalid_code = -1,
        common = 0,
        inherited = 1,
        arabic = 2,
        armenian = 3,
        bengali = 4,
        bopomofo = 5,
        cherokee = 6,
        coptic = 7,
        cyrillic = 8,
        deseret = 9,
        devanagari = 10,
        ethiopic = 11,
        georgian = 12,
        gothic = 13,
        greek = 14,
        gujarati = 15,
        gurmukhi = 16,
        han = 17,
        hangul = 18,
        hebrew = 19,
        hiragana = 20,
        kannada = 21,
        katakana = 22,
        khmer = 23,
        lao = 24,
        latin = 25,
        malayalam = 26,
        mongolian = 27,
        myanmar = 28,
        ogham = 29,
        old_italic = 30,
        oriya = 31,
        runic = 32,
        sinhala = 33,
        syriac = 34,
        tamil = 35,
        telugu = 36,
        thaana = 37,
        thai = 38,
        tibetan = 39,
        canadian_aboriginal = 40,
        yi = 41,
        tagalog = 42,
        hanunoo = 43,
        buhid = 44,
        tagbanwa = 45,
        braille = 46,
        cypriot = 47,
        limbu = 48,
        osmanya = 49,
        shavian = 50,
        linear_b = 51,
        tai_le = 52,
        ugaritic = 53,
        new_tai_lue = 54,
        buginese = 55,
        glagolitic = 56,
        tifinagh = 57,
        syloti_nagri = 58,
        old_persian = 59,
        kharoshthi = 60,
        unknown = 61,
        balinese = 62,
        cuneiform = 63,
        phoenician = 64,
        phags_pa = 65,
        nko = 66,
        kayah_li = 67,
        lepcha = 68,
        rejang = 69,
        sundanese = 70,
        saurashtra = 71,
        cham = 72,
        ol_chiki = 73,
        vai = 74,
        carian = 75,
        lycian = 76,
        lydian = 77,
        avestan = 78,
        bamum = 79,
        egyptian_hieroglyphs = 80,
        imperial_aramaic = 81,
        inscriptional_pahlavi = 82,
        inscriptional_parthian = 83,
        javanese = 84,
        kaithi = 85,
        lisu = 86,
        meetei_mayek = 87,
        old_south_arabian = 88,
        old_turkic = 89,
        samaritan = 90,
        tai_tham = 91,
        tai_viet = 92,
        batak = 93,
        brahmi = 94,
        mandaic = 95,
        chakma = 96,
        meroitic_cursive = 97,
        meroitic_hieroglyphs = 98,
        miao = 99,
        sharada = 100,
        sora_sompeng = 101,
        takri = 102,
        bassa_vah = 103,
        caucasian_albanian = 104,
        duployan = 105,
        elbasan = 106,
        grantha = 107,
        khojki = 108,
        khudawadi = 109,
        linear_a = 110,
        mahajani = 111,
        manichaean = 112,
        mende_kikakui = 113,
        modi = 114,
        mro = 115,
        nabataean = 116,
        old_north_arabian = 117,
        old_permic = 118,
        pahawh_hmong = 119,
        palmyrene = 120,
        pau_cin_hau = 121,
        psalter_pahlavi = 122,
        siddham = 123,
        tirhuta = 124,
        warang_citi = 125,
        ahom = 126,
        anatolian_hieroglyphs = 127,
        hatran = 128,
        multani = 129,
        old_hungarian = 130,
        signwriting = 131,
        adlam = 132,
        bhaiksuki = 133,
        marchen = 134,
        newa = 135,
        osage = 136,
        tangut = 137,
        masaram_gondi = 138,
        nushu = 139,
        soyombo = 140,
        zanabazar_square = 141,
        dogra = 142,
        gunjala_gondi = 143,
        hanifi_rohingya = 144,
        makasar = 145,
        medefaidrin = 146,
        old_sogdian = 147,
        sogdian = 148
    }
    
    
    
    enum UnicodeType {
        control = 0,
        format = 1,
        unassigned = 2,
        private_use = 3,
        surrogate = 4,
        lowercase_letter = 5,
        modifier_letter = 6,
        other_letter = 7,
        titlecase_letter = 8,
        uppercase_letter = 9,
        spacing_mark = 10,
        enclosing_mark = 11,
        non_spacing_mark = 12,
        decimal_number = 13,
        letter_number = 14,
        other_number = 15,
        connect_punctuation = 16,
        dash_punctuation = 17,
        close_punctuation = 18,
        final_punctuation = 19,
        initial_punctuation = 20,
        other_punctuation = 21,
        open_punctuation = 22,
        currency_symbol = 23,
        modifier_symbol = 24,
        math_symbol = 25,
        other_symbol = 26,
        line_separator = 27,
        paragraph_separator = 28,
        space_separator = 29
    }
    
    
    
    enum UserDirectory {
        directory_desktop = 0,
        directory_documents = 1,
        directory_download = 2,
        directory_music = 3,
        directory_pictures = 4,
        directory_public_share = 5,
        directory_templates = 6,
        directory_videos = 7,
        n_directories = 8
    }
    
    
    
    enum VariantClass {
        boolean = 98,
        byte = 121,
        int16 = 110,
        uint16 = 113,
        int32 = 105,
        uint32 = 117,
        int64 = 120,
        uint64 = 116,
        handle = 104,
        double = 100,
        string = 115,
        object_path = 111,
        signature = 103,
        variant = 118,
        maybe = 109,
        array = 97,
        tuple = 40,
        dict_entry = 123
    }
    
    
    
    enum VariantParseError {
        failed = 0,
        basic_type_expected = 1,
        cannot_infer_type = 2,
        definite_type_expected = 3,
        input_not_at_end = 4,
        invalid_character = 5,
        invalid_format_string = 6,
        invalid_object_path = 7,
        invalid_signature = 8,
        invalid_type_string = 9,
        no_common_type = 10,
        number_out_of_range = 11,
        number_too_big = 12,
        type_error = 13,
        unexpected_token = 14,
        unknown_keyword = 15,
        unterminated_string_constant = 16,
        value_expected = 17
    }
    
    
    
    enum AsciiType {
        alnum = 1,
        alpha = 2,
        cntrl = 4,
        digit = 8,
        graph = 16,
        lower = 32,
        print = 64,
        punct = 128,
        space = 256,
        upper = 512,
        xdigit = 1024
    }
    
    
    
    enum FileTest {
        is_regular = 1,
        is_symlink = 2,
        is_dir = 4,
        is_executable = 8,
        exists = 16
    }
    
    
    
    enum FormatSizeFlags {
        default = 0,
        long_format = 1,
        iec_units = 2,
        bits = 4
    }
    
    
    
    enum HookFlagMask {
        active = 1,
        in_call = 2,
        mask = 15
    }
    
    
    
    enum IOCondition {
        in = 1,
        out = 4,
        pri = 2,
        err = 8,
        hup = 16,
        nval = 32
    }
    
    
    
    enum IOFlags {
        append = 1,
        nonblock = 2,
        is_readable = 4,
        is_writable = 8,
        is_writeable = 8,
        is_seekable = 16,
        mask = 31,
        get_mask = 31,
        set_mask = 3
    }
    
    
    
    enum KeyFileFlags {
        none = 0,
        keep_comments = 1,
        keep_translations = 2
    }
    
    
    
    enum LogLevelFlags {
        flag_recursion = 1,
        flag_fatal = 2,
        level_error = 4,
        level_critical = 8,
        level_warning = 16,
        level_message = 32,
        level_info = 64,
        level_debug = 128,
        level_mask = -4
    }
    
    
    
    enum MarkupCollectType {
        invalid = 0,
        string = 1,
        strdup = 2,
        boolean = 3,
        tristate = 4,
        optional = 65536
    }
    
    
    
    enum MarkupParseFlags {
        do_not_use_this_unsupported_flag = 1,
        treat_cdata_as_text = 2,
        prefix_error_position = 4,
        ignore_qualified = 8
    }
    
    
    
    enum OptionFlags {
        none = 0,
        hidden = 1,
        in_main = 2,
        reverse = 4,
        no_arg = 8,
        filename = 16,
        optional_arg = 32,
        noalias = 64
    }
    
    
    
    enum RegexCompileFlags {
        caseless = 1,
        multiline = 2,
        dotall = 4,
        extended = 8,
        anchored = 16,
        dollar_endonly = 32,
        ungreedy = 512,
        raw = 2048,
        no_auto_capture = 4096,
        optimize = 8192,
        firstline = 262144,
        dupnames = 524288,
        newline_cr = 1048576,
        newline_lf = 2097152,
        newline_crlf = 3145728,
        newline_anycrlf = 5242880,
        bsr_anycrlf = 8388608,
        javascript_compat = 33554432
    }
    
    
    
    enum RegexMatchFlags {
        anchored = 16,
        notbol = 128,
        noteol = 256,
        notempty = 1024,
        partial = 32768,
        newline_cr = 1048576,
        newline_lf = 2097152,
        newline_crlf = 3145728,
        newline_any = 4194304,
        newline_anycrlf = 5242880,
        bsr_anycrlf = 8388608,
        bsr_any = 16777216,
        partial_soft = 32768,
        partial_hard = 134217728,
        notempty_atstart = 268435456
    }
    
    
    
    enum SpawnFlags {
        default = 0,
        leave_descriptors_open = 1,
        do_not_reap_child = 2,
        search_path = 4,
        stdout_to_dev_null = 8,
        stderr_to_dev_null = 16,
        child_inherits_stdin = 32,
        file_and_argv_zero = 64,
        search_path_from_envp = 128,
        cloexec_pipes = 256
    }
    
    
    
    enum TestSubprocessFlags {
        stdin = 1,
        stdout = 2,
        stderr = 4
    }
    
    
    
    enum TestTrapFlags {
        silence_stdout = 128,
        silence_stderr = 256,
        inherit_stdin = 512
    }
    
    
    
    enum TraverseFlags {
        leaves = 1,
        non_leaves = 2,
        all = 3,
        mask = 3,
        leafs = 1,
        non_leafs = 2
    }
    
    
    
    interface ChildWatchFunc {
        (pid: Pid, status: number, user_data: any) : void;
    }
    
    
    
    interface ClearHandleFunc {
        (handle_id: number) : void;
    }
    
    
    
    interface CompareDataFunc {
        (_a: any, _b: any, user_data: any) : number;
    }
    
    
    
    interface CompareFunc {
        (_a: any, _b: any) : number;
    }
    
    
    
    interface CopyFunc {
        (src: any, data: any) : any;
    }
    
    
    
    interface DataForeachFunc {
        (key_id: Quark, data: any, user_data: any) : void;
    }
    
    
    
    interface DestroyNotify {
        (data: any) : void;
    }
    
    
    
    interface DuplicateFunc {
        (data: any, user_data: any) : any;
    }
    
    
    
    interface EqualFunc {
        (_a: any, _b: any) : boolean;
    }
    
    
    
    interface FreeFunc {
        (data: any) : void;
    }
    
    
    
    interface Func {
        (data: any, user_data: any) : void;
    }
    
    
    
    interface HFunc {
        (key: any, value: any, user_data: any) : void;
    }
    
    
    
    interface HRFunc {
        (key: any, value: any, user_data: any) : boolean;
    }
    
    
    
    interface HashFunc {
        (key: any) : number;
    }
    
    
    
    interface HookCheckFunc {
        (data: any) : boolean;
    }
    
    
    
    interface HookCheckMarshaller {
        (hook: Hook, marshal_data: any) : boolean;
    }
    
    
    
    interface HookCompareFunc {
        (new_hook: Hook, sibling: Hook) : number;
    }
    
    
    
    interface HookFinalizeFunc {
        (hook_list: HookList, hook: Hook) : void;
    }
    
    
    
    interface HookFindFunc {
        (hook: Hook, data: any) : boolean;
    }
    
    
    
    interface HookFunc {
        (data: any) : void;
    }
    
    
    
    interface HookMarshaller {
        (hook: Hook, marshal_data: any) : void;
    }
    
    
    
    interface IOFunc {
        (source: IOChannel, condition: IOCondition, data: any) : boolean;
    }
    
    
    
    interface LogFunc {
        (log_domain: string, log_level: LogLevelFlags, message: string, user_data: any) : void;
    }
    
    
    
    interface LogWriterFunc {
        (log_level: LogLevelFlags, fields: LogField[], n_fields: number, user_data: any) : LogWriterOutput;
    }
    
    
    
    interface NodeForeachFunc {
        (node: Node, data: any) : void;
    }
    
    
    
    interface NodeTraverseFunc {
        (node: Node, data: any) : boolean;
    }
    
    
    
    interface OptionArgFunc {
        (option_name: string, value: string, data: any) : boolean;
    }
    
    
    
    interface OptionErrorFunc {
        (context: OptionContext, group: OptionGroup, data: any) : void;
    }
    
    
    
    interface OptionParseFunc {
        (context: OptionContext, group: OptionGroup, data: any) : boolean;
    }
    
    
    
    interface PollFunc {
        (ufds: PollFD, nfsd: number, timeout_: number) : number;
    }
    
    
    
    interface PrintFunc {
        (string: string) : void;
    }
    
    
    
    interface RegexEvalCallback {
        (match_info: MatchInfo, result: String, user_data: any) : boolean;
    }
    
    
    
    interface ScannerMsgFunc {
        (scanner: Scanner, message: string, error: boolean) : void;
    }
    
    
    
    interface SequenceIterCompareFunc {
        (_a: SequenceIter, _b: SequenceIter, data: any) : number;
    }
    
    
    
    interface SourceDummyMarshal {
        () : void;
    }
    
    
    
    interface SourceFunc {
        (user_data: any) : boolean;
    }
    
    
    
    interface SpawnChildSetupFunc {
        (user_data: any) : void;
    }
    
    
    
    interface TestDataFunc {
        (user_data: any) : void;
    }
    
    
    
    interface TestFixtureFunc {
        (fixture: any, user_data: any) : void;
    }
    
    
    
    interface TestFunc {
        () : void;
    }
    
    
    
    interface TestLogFatalFunc {
        (log_domain: string, log_level: LogLevelFlags, message: string, user_data: any) : boolean;
    }
    
    
    
    interface ThreadFunc {
        (data: any) : any;
    }
    
    
    
    interface TranslateFunc {
        (_str: string, data: any) : string;
    }
    
    
    
    interface TraverseFunc {
        (key: any, value: any, data: any) : boolean;
    }
    
    
    
    interface UnixFDSourceFunc {
        (fd: number, condition: IOCondition, user_data: any) : boolean;
    }
    
    
    
    interface VoidFunc {
        () : void;
    }
    
    
    
    interface DoubleIEEE754 {}
    
    
    
    interface FloatIEEE754 {}
    
    
    
    interface Mutex {}
    
    
    
    interface TokenValue {}
    
    
    
    type DateDay = number;
    
    
    
    type DateYear = number;
    
    
    
    type MutexLocker = void;
    
    
    
    type Pid = number;
    
    
    
    type Quark = number;
    
    
    
    type RecMutexLocker = void;
    
    
    
    type RefString = string;
    
    
    
    type Strv = string;
    
    
    
    type Time = number;
    
    
    
    type TimeSpan = number;
    
    
    
    type Type = number;
    
    
    
    function access (filename: string, mode: number): number;
    
    
    
    function ascii_digit_value (_c: string): number;
    
    
    
    function ascii_dtostr (buffer: string, buf_len: number, _d: number): string;
    
    
    
    function ascii_formatd (buffer: string, buf_len: number, format: string, _d: number): string;
    
    
    
    function ascii_strcasecmp (s1: string, s2: string): number;
    
    
    
    function ascii_strdown (_str: string, len: number): string;
    
    
    
    function ascii_string_to_signed (_str: string, base: number, min: number, max: number, out_num: number): boolean;
    
    
    
    function ascii_string_to_unsigned (_str: string, base: number, min: number, max: number, out_num: number): boolean;
    
    
    
    function ascii_strncasecmp (s1: string, s2: string, _n: number): number;
    
    
    
    function ascii_strtod (nptr: string, endptr: string): number;
    
    
    
    function ascii_strtoll (nptr: string, endptr: string, base: number): number;
    
    
    
    function ascii_strtoull (nptr: string, endptr: string, base: number): number;
    
    
    
    function ascii_strup (_str: string, len: number): string;
    
    
    
    function ascii_tolower (_c: string): string;
    
    
    
    function ascii_toupper (_c: string): string;
    
    
    
    function ascii_xdigit_value (_c: string): number;
    
    
    
    function assert_warning (log_domain: string, file: string, line: number, pretty_function: string, expression: string): void;
    
    
    
    function assertion_message (domain: string, file: string, line: number, _func: string, message: string): void;
    
    
    
    function assertion_message_cmpnum (domain: string, file: string, line: number, _func: string, expr: string, arg1: number, cmp: string, arg2: number, numtype: string): void;
    
    
    
    function assertion_message_cmpstr (domain: string, file: string, line: number, _func: string, expr: string, arg1: string, cmp: string, arg2: string): void;
    
    
    
    function assertion_message_error (domain: string, file: string, line: number, _func: string, expr: string, error: Error, error_domain: Quark, error_code: number): void;
    
    
    
    function assertion_message_expr (domain: string, file: string, line: number, _func: string, expr: string): void;
    
    
    
    function atexit (_func: VoidFunc): void;
    
    
    
    function atomic_int_add (atomic: number, _val: number): number;
    
    
    
    function atomic_int_and (atomic: number, _val: number): number;
    
    
    
    function atomic_int_compare_and_exchange (atomic: number, oldval: number, newval: number): boolean;
    
    
    
    function atomic_int_dec_and_test (atomic: number): boolean;
    
    
    
    function atomic_int_exchange_and_add (atomic: number, _val: number): number;
    
    
    
    function atomic_int_get (atomic: number): number;
    
    
    
    function atomic_int_inc (atomic: number): void;
    
    
    
    function atomic_int_or (atomic: number, _val: number): number;
    
    
    
    function atomic_int_set (atomic: number, newval: number): void;
    
    
    
    function atomic_int_xor (atomic: number, _val: number): number;
    
    
    
    function atomic_pointer_add (atomic: any, _val: number): number;
    
    
    
    function atomic_pointer_and (atomic: any, _val: number): number;
    
    
    
    function atomic_pointer_compare_and_exchange (atomic: any, oldval: any, newval: any): boolean;
    
    
    
    function atomic_pointer_get (atomic: any): any;
    
    
    
    function atomic_pointer_or (atomic: any, _val: number): number;
    
    
    
    function atomic_pointer_set (atomic: any, newval: any): void;
    
    
    
    function atomic_pointer_xor (atomic: any, _val: number): number;
    
    
    
    function atomic_rc_box_acquire (mem_block: any): any;
    
    
    
    function atomic_rc_box_alloc (block_size: number): any;
    
    
    
    function atomic_rc_box_alloc0 (block_size: number): any;
    
    
    
    function atomic_rc_box_dup (block_size: number, mem_block: any): any;
    
    
    
    function atomic_rc_box_get_size (mem_block: any): number;
    
    
    
    function atomic_rc_box_release (mem_block: any): void;
    
    
    
    function atomic_rc_box_release_full (mem_block: any, clear_func: DestroyNotify): void;
    
    
    
    function atomic_ref_count_compare (arc: number, _val: number): boolean;
    
    
    
    function atomic_ref_count_dec (arc: number): boolean;
    
    
    
    function atomic_ref_count_inc (arc: number): void;
    
    
    
    function atomic_ref_count_init (arc: number): void;
    
    
    
    function base64_decode (text: string, out_len: number): number[];
    
    
    
    function base64_decode_inplace (text: number[], out_len: number): number;
    
    
    
    function base64_decode_step (_in: number[], len: number, out: number[], state: number, save: number): number;
    
    
    
    function base64_encode (data: number[], len: number): string;
    
    
    
    function base64_encode_close (break_lines: boolean, out: number[], state: number, save: number): number;
    
    
    
    function base64_encode_step (_in: number[], len: number, break_lines: boolean, out: number[], state: number, save: number): number;
    
    
    
    function basename (file_name: string): string;
    
    
    
    function bit_lock (address: number, lock_bit: number): void;
    
    
    
    function bit_nth_lsf (mask: number, nth_bit: number): number;
    
    
    
    function bit_nth_msf (mask: number, nth_bit: number): number;
    
    
    
    function bit_storage (number: number): number;
    
    
    
    function bit_trylock (address: number, lock_bit: number): boolean;
    
    
    
    function bit_unlock (address: number, lock_bit: number): void;
    
    
    
    function bookmark_file_error_quark (): Quark;
    
    
    
    function build_filename (first_element: string): string;
    
    
    
    function build_filename_valist (first_element: string, args: any[]): string;
    
    
    
    function build_filenamev (args: string[]): string;
    
    
    
    function build_path (separator: string, first_element: string): string;
    
    
    
    function build_pathv (separator: string, args: string[]): string;
    
    
    
    function byte_array_free (array: number[], free_segment: boolean): number;
    
    
    
    function byte_array_free_to_bytes (array: number[]): Bytes;
    
    
    
    function byte_array_new (): number[];
    
    
    
    function byte_array_new_take (data: number[], len: number): number[];
    
    
    
    function byte_array_unref (array: number[]): void;
    
    
    
    function canonicalize_filename (filename: string, relative_to: string): string;
    
    
    
    function chdir (path: string): number;
    
    
    
    function check_version (required_major: number, required_minor: number, required_micro: number): string;
    
    
    
    function checksum_type_get_length (checksum_type: ChecksumType): number;
    
    
    
    function child_watch_add (pid: Pid, _function: ChildWatchFunc, data: any): number;
    
    
    
    function child_watch_add_full (priority: number, pid: Pid, _function: ChildWatchFunc, data: any, notify: DestroyNotify): number;
    
    
    
    function child_watch_source_new (pid: Pid): Source;
    
    
    
    function clear_error (): void;
    
    
    
    function clear_handle_id (tag_ptr: number, clear_func: ClearHandleFunc): void;
    
    
    
    function clear_pointer (pp: any, destroy: DestroyNotify): void;
    
    
    
    function close (fd: number): boolean;
    
    
    
    function compute_checksum_for_bytes (checksum_type: ChecksumType, data: Bytes): string;
    
    
    
    function compute_checksum_for_data (checksum_type: ChecksumType, data: number[], length: number): string;
    
    
    
    function compute_checksum_for_string (checksum_type: ChecksumType, _str: string, length: number): string;
    
    
    
    function compute_hmac_for_bytes (digest_type: ChecksumType, key: Bytes, data: Bytes): string;
    
    
    
    function compute_hmac_for_data (digest_type: ChecksumType, key: number[], key_len: number, data: number[], length: number): string;
    
    
    
    function compute_hmac_for_string (digest_type: ChecksumType, key: number[], key_len: number, _str: string, length: number): string;
    
    
    
    function convert (_str: number[], len: number, to_codeset: string, from_codeset: string, bytes_read: number, bytes_written: number): number[];
    
    
    
    function convert_error_quark (): Quark;
    
    
    
    function convert_with_fallback (_str: number[], len: number, to_codeset: string, from_codeset: string, fallback: string, bytes_read: number, bytes_written: number): number[];
    
    
    
    function convert_with_iconv (_str: number[], len: number, converter: IConv, bytes_read: number, bytes_written: number): number[];
    
    
    
    function datalist_clear (datalist: Data): void;
    
    
    
    function datalist_foreach (datalist: Data, _func: DataForeachFunc, user_data: any): void;
    
    
    
    function datalist_get_data (datalist: Data, key: string): any;
    
    
    
    function datalist_get_flags (datalist: Data): number;
    
    
    
    function datalist_id_dup_data (datalist: Data, key_id: Quark, dup_func: DuplicateFunc, user_data: any): any;
    
    
    
    function datalist_id_get_data (datalist: Data, key_id: Quark): any;
    
    
    
    function datalist_id_remove_no_notify (datalist: Data, key_id: Quark): any;
    
    
    
    function datalist_id_replace_data (datalist: Data, key_id: Quark, oldval: any, newval: any, destroy: DestroyNotify, old_destroy: DestroyNotify): boolean;
    
    
    
    function datalist_id_set_data_full (datalist: Data, key_id: Quark, data: any, destroy_func: DestroyNotify): void;
    
    
    
    function datalist_init (datalist: Data): void;
    
    
    
    function datalist_set_flags (datalist: Data, flags: number): void;
    
    
    
    function datalist_unset_flags (datalist: Data, flags: number): void;
    
    
    
    function dataset_destroy (dataset_location: any): void;
    
    
    
    function dataset_foreach (dataset_location: any, _func: DataForeachFunc, user_data: any): void;
    
    
    
    function dataset_id_get_data (dataset_location: any, key_id: Quark): any;
    
    
    
    function dataset_id_remove_no_notify (dataset_location: any, key_id: Quark): any;
    
    
    
    function dataset_id_set_data_full (dataset_location: any, key_id: Quark, data: any, destroy_func: DestroyNotify): void;
    
    
    
    function date_get_days_in_month (month: DateMonth, year: DateYear): number;
    
    
    
    function date_get_monday_weeks_in_year (year: DateYear): number;
    
    
    
    function date_get_sunday_weeks_in_year (year: DateYear): number;
    
    
    
    function date_is_leap_year (year: DateYear): boolean;
    
    
    
    function date_strftime (_s: string, slen: number, format: string, date: Date): number;
    
    
    
    function date_time_compare (dt1: any, dt2: any): number;
    
    
    
    function date_time_equal (dt1: any, dt2: any): boolean;
    
    
    
    function date_time_hash (datetime: any): number;
    
    
    
    function date_valid_day (day: DateDay): boolean;
    
    
    
    function date_valid_dmy (day: DateDay, month: DateMonth, year: DateYear): boolean;
    
    
    
    function date_valid_julian (julian_date: number): boolean;
    
    
    
    function date_valid_month (month: DateMonth): boolean;
    
    
    
    function date_valid_weekday (weekday: DateWeekday): boolean;
    
    
    
    function date_valid_year (year: DateYear): boolean;
    
    
    
    function dcgettext (domain: string, msgid: string, category: number): string;
    
    
    
    function dgettext (domain: string, msgid: string): string;
    
    
    
    function dir_make_tmp (tmpl: string): string;
    
    
    
    function direct_equal (v1: any, v2: any): boolean;
    
    
    
    function direct_hash (_v: any): number;
    
    
    
    function dngettext (domain: string, msgid: string, msgid_plural: string, _n: number): string;
    
    
    
    function double_equal (v1: any, v2: any): boolean;
    
    
    
    function double_hash (_v: any): number;
    
    
    
    function dpgettext (domain: string, msgctxtid: string, msgidoffset: number): string;
    
    
    
    function dpgettext2 (domain: string, context: string, msgid: string): string;
    
    
    
    function environ_getenv (envp: string[], variable: string): string;
    
    
    
    function environ_setenv (envp: string[], variable: string, value: string, overwrite: boolean): string[];
    
    
    
    function environ_unsetenv (envp: string[], variable: string): string[];
    
    
    
    function file_error_from_errno (err_no: number): FileError;
    
    
    
    function file_error_quark (): Quark;
    
    
    
    function file_get_contents (filename: string, contents: number[], length: number): boolean;
    
    
    
    function file_open_tmp (tmpl: string, name_used: string): number;
    
    
    
    function file_read_link (filename: string): string;
    
    
    
    function file_set_contents (filename: string, contents: number[], length: number): boolean;
    
    
    
    function file_test (filename: string, test: FileTest): boolean;
    
    
    
    function filename_display_basename (filename: string): string;
    
    
    
    function filename_display_name (filename: string): string;
    
    
    
    function filename_from_uri (uri: string, hostname: string): string;
    
    
    
    function filename_from_utf8 (utf8string: string, len: number, bytes_read: number, bytes_written: number): string;
    
    
    
    function filename_to_uri (filename: string, hostname: string): string;
    
    
    
    function filename_to_utf8 (opsysstring: string, len: number, bytes_read: number, bytes_written: number): string;
    
    
    
    function find_program_in_path (program: string): string;
    
    
    
    function format_size (size: number): string;
    
    
    
    function format_size_for_display (size: number): string;
    
    
    
    function format_size_full (size: number, flags: FormatSizeFlags): string;
    
    
    
    function fprintf (file: any, format: string): number;
    
    
    
    function free (mem: any): void;
    
    
    
    function get_application_name (): string;
    
    
    
    function get_charset (charset: string): boolean;
    
    
    
    function get_codeset (): string;
    
    
    
    function get_current_dir (): string;
    
    
    
    function get_current_time (result: TimeVal): void;
    
    
    
    function get_environ (): string[];
    
    
    
    function get_filename_charsets (filename_charsets: string[]): boolean;
    
    
    
    function get_home_dir (): string;
    
    
    
    function get_host_name (): string;
    
    
    
    function get_language_names (): string[];
    
    
    
    function get_language_names_with_category (category_name: string): string[];
    
    
    
    function get_locale_variants (locale: string): string[];
    
    
    
    function get_monotonic_time (): number;
    
    
    
    function get_num_processors (): number;
    
    
    
    function get_prgname (): string;
    
    
    
    function get_real_name (): string;
    
    
    
    function get_real_time (): number;
    
    
    
    function get_system_config_dirs (): string[];
    
    
    
    function get_system_data_dirs (): string[];
    
    
    
    function get_tmp_dir (): string;
    
    
    
    function get_user_cache_dir (): string;
    
    
    
    function get_user_config_dir (): string;
    
    
    
    function get_user_data_dir (): string;
    
    
    
    function get_user_name (): string;
    
    
    
    function get_user_runtime_dir (): string;
    
    
    
    function get_user_special_dir (directory: UserDirectory): string;
    
    
    
    function getenv (variable: string): string;
    
    
    
    function hash_table_add (hash_table: GLib.HashTable, key: any): boolean;
    
    
    
    function hash_table_contains (hash_table: GLib.HashTable, key: any): boolean;
    
    
    
    function hash_table_destroy (hash_table: GLib.HashTable): void;
    
    
    
    function hash_table_insert (hash_table: GLib.HashTable, key: any, value: any): boolean;
    
    
    
    function hash_table_lookup (hash_table: GLib.HashTable, key: any): any;
    
    
    
    function hash_table_lookup_extended (hash_table: GLib.HashTable, lookup_key: any, orig_key: any, value: any): boolean;
    
    
    
    function hash_table_remove (hash_table: GLib.HashTable, key: any): boolean;
    
    
    
    function hash_table_remove_all (hash_table: GLib.HashTable): void;
    
    
    
    function hash_table_replace (hash_table: GLib.HashTable, key: any, value: any): boolean;
    
    
    
    function hash_table_size (hash_table: GLib.HashTable): number;
    
    
    
    function hash_table_steal (hash_table: GLib.HashTable, key: any): boolean;
    
    
    
    function hash_table_steal_all (hash_table: GLib.HashTable): void;
    
    
    
    function hash_table_steal_extended (hash_table: GLib.HashTable, lookup_key: any, stolen_key: any, stolen_value: any): boolean;
    
    
    
    function hash_table_unref (hash_table: GLib.HashTable): void;
    
    
    
    function hook_destroy (hook_list: HookList, hook_id: number): boolean;
    
    
    
    function hook_destroy_link (hook_list: HookList, hook: Hook): void;
    
    
    
    function hook_free (hook_list: HookList, hook: Hook): void;
    
    
    
    function hook_insert_before (hook_list: HookList, sibling: Hook, hook: Hook): void;
    
    
    
    function hook_prepend (hook_list: HookList, hook: Hook): void;
    
    
    
    function hook_unref (hook_list: HookList, hook: Hook): void;
    
    
    
    function hostname_is_ascii_encoded (hostname: string): boolean;
    
    
    
    function hostname_is_ip_address (hostname: string): boolean;
    
    
    
    function hostname_is_non_ascii (hostname: string): boolean;
    
    
    
    function hostname_to_ascii (hostname: string): string;
    
    
    
    function hostname_to_unicode (hostname: string): string;
    
    
    
    function iconv (converter: IConv, inbuf: string, inbytes_left: number, outbuf: string, outbytes_left: number): number;
    
    
    
    function iconv_open (to_codeset: string, from_codeset: string): IConv;
    
    
    
    function idle_add (_function: SourceFunc, data: any): number;
    
    
    
    function idle_add_full (priority: number, _function: SourceFunc, data: any, notify: DestroyNotify): number;
    
    
    
    function idle_remove_by_data (data: any): boolean;
    
    
    
    function idle_source_new (): Source;
    
    
    
    function int64_equal (v1: any, v2: any): boolean;
    
    
    
    function int64_hash (_v: any): number;
    
    
    
    function int_equal (v1: any, v2: any): boolean;
    
    
    
    function int_hash (_v: any): number;
    
    
    
    function intern_static_string (string: string): string;
    
    
    
    function intern_string (string: string): string;
    
    
    
    function io_add_watch (channel: IOChannel, condition: IOCondition, _func: IOFunc, user_data: any): number;
    
    
    
    function io_add_watch_full (channel: IOChannel, priority: number, condition: IOCondition, _func: IOFunc, user_data: any, notify: DestroyNotify): number;
    
    
    
    function io_channel_error_from_errno (_en: number): IOChannelError;
    
    
    
    function io_channel_error_quark (): Quark;
    
    
    
    function io_create_watch (channel: IOChannel, condition: IOCondition): Source;
    
    
    
    function key_file_error_quark (): Quark;
    
    
    
    function listenv (): string[];
    
    
    
    function locale_from_utf8 (utf8string: string, len: number, bytes_read: number, bytes_written: number): number[];
    
    
    
    function locale_to_utf8 (opsysstring: number[], len: number, bytes_read: number, bytes_written: number): string;
    
    
    
    function log (log_domain: string, log_level: LogLevelFlags, format: string): void;
    
    
    
    function log_default_handler (log_domain: string, log_level: LogLevelFlags, message: string, unused_data: any): void;
    
    
    
    function log_remove_handler (log_domain: string, handler_id: number): void;
    
    
    
    function log_set_always_fatal (fatal_mask: LogLevelFlags): LogLevelFlags;
    
    
    
    function log_set_default_handler (log_func: LogFunc, user_data: any): LogFunc;
    
    
    
    function log_set_fatal_mask (log_domain: string, fatal_mask: LogLevelFlags): LogLevelFlags;
    
    
    
    function log_set_handler (log_domain: string, log_levels: LogLevelFlags, log_func: LogFunc, user_data: any): number;
    
    
    
    function log_set_handler_full (log_domain: string, log_levels: LogLevelFlags, log_func: LogFunc, user_data: any, destroy: DestroyNotify): number;
    
    
    
    function log_set_writer_func (_func: LogWriterFunc, user_data: any, user_data_free: DestroyNotify): void;
    
    
    
    function log_structured (log_domain: string, log_level: LogLevelFlags): void;
    
    
    
    function log_structured_array (log_level: LogLevelFlags, fields: LogField[], n_fields: number): void;
    
    
    
    function log_structured_standard (log_domain: string, log_level: LogLevelFlags, file: string, line: string, _func: string, message_format: string): void;
    
    
    
    function log_variant (log_domain: string, log_level: LogLevelFlags, fields: Variant): void;
    
    
    
    function log_writer_default (log_level: LogLevelFlags, fields: LogField[], n_fields: number, user_data: any): LogWriterOutput;
    
    
    
    function log_writer_format_fields (log_level: LogLevelFlags, fields: LogField[], n_fields: number, use_color: boolean): string;
    
    
    
    function log_writer_is_journald (output_fd: number): boolean;
    
    
    
    function log_writer_journald (log_level: LogLevelFlags, fields: LogField[], n_fields: number, user_data: any): LogWriterOutput;
    
    
    
    function log_writer_standard_streams (log_level: LogLevelFlags, fields: LogField[], n_fields: number, user_data: any): LogWriterOutput;
    
    
    
    function log_writer_supports_color (output_fd: number): boolean;
    
    
    
    function logv (log_domain: string, log_level: LogLevelFlags, format: string, args: any[]): void;
    
    
    
    function main_context_default (): MainContext;
    
    
    
    function main_context_get_thread_default (): MainContext;
    
    
    
    function main_context_ref_thread_default (): MainContext;
    
    
    
    function main_current_source (): Source;
    
    
    
    function main_depth (): number;
    
    
    
    function malloc (n_bytes: number): any;
    
    
    
    function malloc0 (n_bytes: number): any;
    
    
    
    function malloc0_n (n_blocks: number, n_block_bytes: number): any;
    
    
    
    function malloc_n (n_blocks: number, n_block_bytes: number): any;
    
    
    
    function markup_collect_attributes (element_name: string, attribute_names: string, attribute_values: string, error: Error, first_type: MarkupCollectType, first_attr: string): boolean;
    
    
    
    function markup_error_quark (): Quark;
    
    
    
    function markup_escape_text (text: string, length: number): string;
    
    
    
    function markup_printf_escaped (format: string): string;
    
    
    
    function markup_vprintf_escaped (format: string, args: any[]): string;
    
    
    
    function mem_is_system_malloc (): boolean;
    
    
    
    function mem_profile (): void;
    
    
    
    function mem_set_vtable (vtable: MemVTable): void;
    
    
    
    function memdup (mem: any, byte_size: number): any;
    
    
    
    function mkdir_with_parents (pathname: string, mode: number): number;
    
    
    
    function mkdtemp (tmpl: string): string;
    
    
    
    function mkdtemp_full (tmpl: string, mode: number): string;
    
    
    
    function mkstemp (tmpl: string): number;
    
    
    
    function mkstemp_full (tmpl: string, flags: number, mode: number): number;
    
    
    
    function nullify_pointer (nullify_location: any): void;
    
    
    
    function number_parser_error_quark (): Quark;
    
    
    
    function on_error_query (prg_name: string): void;
    
    
    
    function on_error_stack_trace (prg_name: string): void;
    
    
    
    function once_init_enter (location: any): boolean;
    
    
    
    function once_init_leave (location: any, result: number): void;
    
    
    
    function option_error_quark (): Quark;
    
    
    
    function parse_debug_string (string: string, keys: DebugKey[], nkeys: number): number;
    
    
    
    function path_get_basename (file_name: string): string;
    
    
    
    function path_get_dirname (file_name: string): string;
    
    
    
    function path_is_absolute (file_name: string): boolean;
    
    
    
    function path_skip_root (file_name: string): string;
    
    
    
    function pattern_match (pspec: PatternSpec, string_length: number, string: string, string_reversed: string): boolean;
    
    
    
    function pattern_match_simple (pattern: string, string: string): boolean;
    
    
    
    function pattern_match_string (pspec: PatternSpec, string: string): boolean;
    
    
    
    function pointer_bit_lock (address: any, lock_bit: number): void;
    
    
    
    function pointer_bit_trylock (address: any, lock_bit: number): boolean;
    
    
    
    function pointer_bit_unlock (address: any, lock_bit: number): void;
    
    
    
    function poll (fds: PollFD, nfds: number, timeout: number): number;
    
    
    
    function prefix_error (err: Error, format: string): void;
    
    
    
    function print (format: string): void;
    
    
    
    function printerr (format: string): void;
    
    
    
    function printf (format: string): number;
    
    
    
    function printf_string_upper_bound (format: string, args: any[]): number;
    
    
    
    function propagate_error (dest: Error, src: Error): void;
    
    
    
    function propagate_prefixed_error (dest: Error, src: Error, format: string): void;
    
    
    
    function ptr_array_find (haystack: any[], needle: any, index_: number): boolean;
    
    
    
    function ptr_array_find_with_equal_func (haystack: any[], needle: any, equal_func: EqualFunc, index_: number): boolean;
    
    
    
    function qsort_with_data (pbase: any, total_elems: number, size: number, compare_func: CompareDataFunc, user_data: any): void;
    
    
    
    function quark_from_static_string (string: string): Quark;
    
    
    
    function quark_from_string (string: string): Quark;
    
    
    
    function quark_to_string (quark: Quark): string;
    
    
    
    function quark_try_string (string: string): Quark;
    
    
    
    function random_double (): number;
    
    
    
    function random_double_range (begin: number, _end: number): number;
    
    
    
    function random_int (): number;
    
    
    
    function random_int_range (begin: number, _end: number): number;
    
    
    
    function random_set_seed (seed: number): void;
    
    
    
    function rc_box_acquire (mem_block: any): any;
    
    
    
    function rc_box_alloc (block_size: number): any;
    
    
    
    function rc_box_alloc0 (block_size: number): any;
    
    
    
    function rc_box_dup (block_size: number, mem_block: any): any;
    
    
    
    function rc_box_get_size (mem_block: any): number;
    
    
    
    function rc_box_release (mem_block: any): void;
    
    
    
    function rc_box_release_full (mem_block: any, clear_func: DestroyNotify): void;
    
    
    
    function realloc (mem: any, n_bytes: number): any;
    
    
    
    function realloc_n (mem: any, n_blocks: number, n_block_bytes: number): any;
    
    
    
    function ref_count_compare (rc: number, _val: number): boolean;
    
    
    
    function ref_count_dec (rc: number): boolean;
    
    
    
    function ref_count_inc (rc: number): void;
    
    
    
    function ref_count_init (rc: number): void;
    
    
    
    function ref_string_acquire (_str: string): string;
    
    
    
    function ref_string_length (_str: string): number;
    
    
    
    function ref_string_new (_str: string): string;
    
    
    
    function ref_string_new_intern (_str: string): string;
    
    
    
    function ref_string_new_len (_str: string, len: number): string;
    
    
    
    function ref_string_release (_str: string): void;
    
    
    
    function regex_check_replacement (replacement: string, has_references: boolean): boolean;
    
    
    
    function regex_error_quark (): Quark;
    
    
    
    function regex_escape_nul (string: string, length: number): string;
    
    
    
    function regex_escape_string (string: string[], length: number): string;
    
    
    
    function regex_match_simple (pattern: string, string: string, compile_options: RegexCompileFlags, match_options: RegexMatchFlags): boolean;
    
    
    
    function regex_split_simple (pattern: string, string: string, compile_options: RegexCompileFlags, match_options: RegexMatchFlags): string[];
    
    
    
    function reload_user_special_dirs_cache (): void;
    
    
    
    function return_if_fail_warning (log_domain: string, pretty_function: string, expression: string): void;
    
    
    
    function rmdir (filename: string): number;
    
    
    
    function sequence_get (iter: SequenceIter): any;
    
    
    
    function sequence_insert_before (iter: SequenceIter, data: any): SequenceIter;
    
    
    
    function sequence_move (src: SequenceIter, dest: SequenceIter): void;
    
    
    
    function sequence_move_range (dest: SequenceIter, begin: SequenceIter, _end: SequenceIter): void;
    
    
    
    function sequence_range_get_midpoint (begin: SequenceIter, _end: SequenceIter): SequenceIter;
    
    
    
    function sequence_remove (iter: SequenceIter): void;
    
    
    
    function sequence_remove_range (begin: SequenceIter, _end: SequenceIter): void;
    
    
    
    function sequence_set (iter: SequenceIter, data: any): void;
    
    
    
    function sequence_swap (_a: SequenceIter, _b: SequenceIter): void;
    
    
    
    function set_application_name (application_name: string): void;
    
    
    
    function set_error (err: Error, domain: Quark, code: number, format: string): void;
    
    
    
    function set_error_literal (err: Error, domain: Quark, code: number, message: string): void;
    
    
    
    function set_prgname (prgname: string): void;
    
    
    
    function set_print_handler (_func: PrintFunc): PrintFunc;
    
    
    
    function set_printerr_handler (_func: PrintFunc): PrintFunc;
    
    
    
    function setenv (variable: string, value: string, overwrite: boolean): boolean;
    
    
    
    function shell_error_quark (): Quark;
    
    
    
    function shell_parse_argv (command_line: string, argcp: number, argvp: string[]): boolean;
    
    
    
    function shell_quote (unquoted_string: string): string;
    
    
    
    function shell_unquote (quoted_string: string): string;
    
    
    
    function slice_alloc (block_size: number): any;
    
    
    
    function slice_alloc0 (block_size: number): any;
    
    
    
    function slice_copy (block_size: number, mem_block: any): any;
    
    
    
    function slice_free1 (block_size: number, mem_block: any): void;
    
    
    
    function slice_free_chain_with_offset (block_size: number, mem_chain: any, next_offset: number): void;
    
    
    
    function slice_get_config (ckey: SliceConfig): number;
    
    
    
    function slice_get_config_state (ckey: SliceConfig, address: number, n_values: number): number;
    
    
    
    function slice_set_config (ckey: SliceConfig, value: number): void;
    
    
    
    function snprintf (string: string, _n: number, format: string): number;
    
    
    
    function source_remove (tag: number): boolean;
    
    
    
    function source_remove_by_funcs_user_data (funcs: SourceFuncs, user_data: any): boolean;
    
    
    
    function source_remove_by_user_data (user_data: any): boolean;
    
    
    
    function source_set_name_by_id (tag: number, name: string): void;
    
    
    
    function spaced_primes_closest (_num: number): number;
    
    
    
    function spawn_async (working_directory: string, argv: string[], envp: string[], flags: SpawnFlags, child_setup: SpawnChildSetupFunc, user_data: any, child_pid: Pid): boolean;
    
    
    
    function spawn_async_with_fds (working_directory: string, argv: string[], envp: string[], flags: SpawnFlags, child_setup: SpawnChildSetupFunc, user_data: any, child_pid: Pid, stdin_fd: number, stdout_fd: number, stderr_fd: number): boolean;
    
    
    
    function spawn_async_with_pipes (working_directory: string, argv: string[], envp: string[], flags: SpawnFlags, child_setup: SpawnChildSetupFunc, user_data: any, child_pid: Pid, standard_input: number, standard_output: number, standard_error: number): boolean;
    
    
    
    function spawn_check_exit_status (exit_status: number): boolean;
    
    
    
    function spawn_close_pid (pid: Pid): void;
    
    
    
    function spawn_command_line_async (command_line: string): boolean;
    
    
    
    function spawn_command_line_sync (command_line: string, standard_output: number[], standard_error: number[], exit_status: number): boolean;
    
    
    
    function spawn_error_quark (): Quark;
    
    
    
    function spawn_exit_error_quark (): Quark;
    
    
    
    function spawn_sync (working_directory: string, argv: string[], envp: string[], flags: SpawnFlags, child_setup: SpawnChildSetupFunc, user_data: any, standard_output: number[], standard_error: number[], exit_status: number): boolean;
    
    
    
    function sprintf (string: string, format: string): number;
    
    
    
    function stpcpy (dest: string, src: string): string;
    
    
    
    function str_equal (v1: any, v2: any): boolean;
    
    
    
    function str_has_prefix (_str: string, prefix: string): boolean;
    
    
    
    function str_has_suffix (_str: string, suffix: string): boolean;
    
    
    
    function str_hash (_v: any): number;
    
    
    
    function str_is_ascii (_str: string): boolean;
    
    
    
    function str_match_string (search_term: string, potential_hit: string, accept_alternates: boolean): boolean;
    
    
    
    function str_to_ascii (_str: string, from_locale: string): string;
    
    
    
    function str_tokenize_and_fold (string: string, translit_locale: string, ascii_alternates: string[]): string[];
    
    
    
    function strcanon (string: string, valid_chars: string, substitutor: string): string;
    
    
    
    function strcasecmp (s1: string, s2: string): number;
    
    
    
    function strchomp (string: string): string;
    
    
    
    function strchug (string: string): string;
    
    
    
    function strcmp0 (str1: string, str2: string): number;
    
    
    
    function strcompress (source: string): string;
    
    
    
    function strconcat (string1: string): string;
    
    
    
    function strdelimit (string: string, delimiters: string, new_delimiter: string): string;
    
    
    
    function strdown (string: string): string;
    
    
    
    function strdup (_str: string): string;
    
    
    
    function strdup_printf (format: string): string;
    
    
    
    function strdup_vprintf (format: string, args: any[]): string;
    
    
    
    function strdupv (str_array: string): string[];
    
    
    
    function strerror (errnum: number): string;
    
    
    
    function strescape (source: string, exceptions: string): string;
    
    
    
    function strfreev (str_array: string): void;
    
    
    
    function string_new (init: string): String;
    
    
    
    function string_new_len (init: string, len: number): String;
    
    
    
    function string_sized_new (dfl_size: number): String;
    
    
    
    function strip_context (msgid: string, msgval: string): string;
    
    
    
    function strjoin (separator: string): string;
    
    
    
    function strjoinv (separator: string, str_array: string): string;
    
    
    
    function strlcat (dest: string, src: string, dest_size: number): number;
    
    
    
    function strlcpy (dest: string, src: string, dest_size: number): number;
    
    
    
    function strncasecmp (s1: string, s2: string, _n: number): number;
    
    
    
    function strndup (_str: string, _n: number): string;
    
    
    
    function strnfill (length: number, fill_char: string): string;
    
    
    
    function strreverse (string: string): string;
    
    
    
    function strrstr (haystack: string, needle: string): string;
    
    
    
    function strrstr_len (haystack: string, haystack_len: number, needle: string): string;
    
    
    
    function strsignal (signum: number): string;
    
    
    
    function strsplit (string: string, delimiter: string, max_tokens: number): string[];
    
    
    
    function strsplit_set (string: string, delimiters: string, max_tokens: number): string[];
    
    
    
    function strstr_len (haystack: string, haystack_len: number, needle: string): string;
    
    
    
    function strtod (nptr: string, endptr: string): number;
    
    
    
    function strup (string: string): string;
    
    
    
    function strv_contains (strv: string, _str: string): boolean;
    
    
    
    function strv_equal (strv1: string, strv2: string): boolean;
    
    
    
    function strv_get_type (): GObject.Type;
    
    
    
    function strv_length (str_array: string): number;
    
    
    
    function test_add_data_func (testpath: string, test_data: any, test_func: TestDataFunc): void;
    
    
    
    function test_add_data_func_full (testpath: string, test_data: any, test_func: TestDataFunc, data_free_func: DestroyNotify): void;
    
    
    
    function test_add_func (testpath: string, test_func: TestFunc): void;
    
    
    
    function test_add_vtable (testpath: string, data_size: number, test_data: any, data_setup: TestFixtureFunc, data_test: TestFixtureFunc, data_teardown: TestFixtureFunc): void;
    
    
    
    function test_assert_expected_messages_internal (domain: string, file: string, line: number, _func: string): void;
    
    
    
    function test_bug (bug_uri_snippet: string): void;
    
    
    
    function test_bug_base (uri_pattern: string): void;
    
    
    
    function test_build_filename (file_type: TestFileType, first_path: string): string;
    
    
    
    function test_create_case (test_name: string, data_size: number, test_data: any, data_setup: TestFixtureFunc, data_test: TestFixtureFunc, data_teardown: TestFixtureFunc): TestCase;
    
    
    
    function test_create_suite (suite_name: string): TestSuite;
    
    
    
    function test_expect_message (log_domain: string, log_level: LogLevelFlags, pattern: string): void;
    
    
    
    function test_fail (): void;
    
    
    
    function test_failed (): boolean;
    
    
    
    function test_get_dir (file_type: TestFileType): string;
    
    
    
    function test_get_filename (file_type: TestFileType, first_path: string): string;
    
    
    
    function test_get_root (): TestSuite;
    
    
    
    function test_incomplete (msg: string): void;
    
    
    
    function test_init (argc: number, argv: string): void;
    
    
    
    function test_log_set_fatal_handler (log_func: TestLogFatalFunc, user_data: any): void;
    
    
    
    function test_log_type_name (log_type: TestLogType): string;
    
    
    
    function test_maximized_result (maximized_quantity: number, format: string): void;
    
    
    
    function test_message (format: string): void;
    
    
    
    function test_minimized_result (minimized_quantity: number, format: string): void;
    
    
    
    function test_queue_destroy (destroy_func: DestroyNotify, destroy_data: any): void;
    
    
    
    function test_queue_free (gfree_pointer: any): void;
    
    
    
    function test_rand_double (): number;
    
    
    
    function test_rand_double_range (range_start: number, range_end: number): number;
    
    
    
    function test_rand_int (): number;
    
    
    
    function test_rand_int_range (begin: number, _end: number): number;
    
    
    
    function test_run (): number;
    
    
    
    function test_run_suite (suite: TestSuite): number;
    
    
    
    function test_set_nonfatal_assertions (): void;
    
    
    
    function test_skip (msg: string): void;
    
    
    
    function test_subprocess (): boolean;
    
    
    
    function test_timer_elapsed (): number;
    
    
    
    function test_timer_last (): number;
    
    
    
    function test_timer_start (): void;
    
    
    
    function test_trap_assertions (domain: string, file: string, line: number, _func: string, assertion_flags: number, pattern: string): void;
    
    
    
    function test_trap_fork (usec_timeout: number, test_trap_flags: TestTrapFlags): boolean;
    
    
    
    function test_trap_has_passed (): boolean;
    
    
    
    function test_trap_reached_timeout (): boolean;
    
    
    
    function test_trap_subprocess (test_path: string, usec_timeout: number, test_flags: TestSubprocessFlags): void;
    
    
    
    function thread_error_quark (): Quark;
    
    
    
    function thread_exit (retval: any): void;
    
    
    
    function thread_pool_get_max_idle_time (): number;
    
    
    
    function thread_pool_get_max_unused_threads (): number;
    
    
    
    function thread_pool_get_num_unused_threads (): number;
    
    
    
    function thread_pool_set_max_idle_time (interval: number): void;
    
    
    
    function thread_pool_set_max_unused_threads (max_threads: number): void;
    
    
    
    function thread_pool_stop_unused_threads (): void;
    
    
    
    function thread_self (): Thread;
    
    
    
    function thread_yield (): void;
    
    
    
    function time_val_from_iso8601 (iso_date: string, time_: TimeVal): boolean;
    
    
    
    function timeout_add (interval: number, _function: SourceFunc, data: any): number;
    
    
    
    function timeout_add_full (priority: number, interval: number, _function: SourceFunc, data: any, notify: DestroyNotify): number;
    
    
    
    function timeout_add_seconds (interval: number, _function: SourceFunc, data: any): number;
    
    
    
    function timeout_add_seconds_full (priority: number, interval: number, _function: SourceFunc, data: any, notify: DestroyNotify): number;
    
    
    
    function timeout_source_new (interval: number): Source;
    
    
    
    function timeout_source_new_seconds (interval: number): Source;
    
    
    
    function trash_stack_height (stack_p: TrashStack): number;
    
    
    
    function trash_stack_peek (stack_p: TrashStack): any;
    
    
    
    function trash_stack_pop (stack_p: TrashStack): any;
    
    
    
    function trash_stack_push (stack_p: TrashStack, data_p: any): void;
    
    
    
    function try_malloc (n_bytes: number): any;
    
    
    
    function try_malloc0 (n_bytes: number): any;
    
    
    
    function try_malloc0_n (n_blocks: number, n_block_bytes: number): any;
    
    
    
    function try_malloc_n (n_blocks: number, n_block_bytes: number): any;
    
    
    
    function try_realloc (mem: any, n_bytes: number): any;
    
    
    
    function try_realloc_n (mem: any, n_blocks: number, n_block_bytes: number): any;
    
    
    
    function ucs4_to_utf16 (_str: string, len: number, items_read: number, items_written: number): number;
    
    
    
    function ucs4_to_utf8 (_str: string, len: number, items_read: number, items_written: number): string;
    
    
    
    function unichar_break_type (_c: string): UnicodeBreakType;
    
    
    
    function unichar_combining_class (_uc: string): number;
    
    
    
    function unichar_compose (_a: string, _b: string, _ch: string): boolean;
    
    
    
    function unichar_decompose (_ch: string, _a: string, _b: string): boolean;
    
    
    
    function unichar_digit_value (_c: string): number;
    
    
    
    function unichar_fully_decompose (_ch: string, compat: boolean, result: string, result_len: number): number;
    
    
    
    function unichar_get_mirror_char (_ch: string, mirrored_ch: string): boolean;
    
    
    
    function unichar_get_script (_ch: string): UnicodeScript;
    
    
    
    function unichar_isalnum (_c: string): boolean;
    
    
    
    function unichar_isalpha (_c: string): boolean;
    
    
    
    function unichar_iscntrl (_c: string): boolean;
    
    
    
    function unichar_isdefined (_c: string): boolean;
    
    
    
    function unichar_isdigit (_c: string): boolean;
    
    
    
    function unichar_isgraph (_c: string): boolean;
    
    
    
    function unichar_islower (_c: string): boolean;
    
    
    
    function unichar_ismark (_c: string): boolean;
    
    
    
    function unichar_isprint (_c: string): boolean;
    
    
    
    function unichar_ispunct (_c: string): boolean;
    
    
    
    function unichar_isspace (_c: string): boolean;
    
    
    
    function unichar_istitle (_c: string): boolean;
    
    
    
    function unichar_isupper (_c: string): boolean;
    
    
    
    function unichar_iswide (_c: string): boolean;
    
    
    
    function unichar_iswide_cjk (_c: string): boolean;
    
    
    
    function unichar_isxdigit (_c: string): boolean;
    
    
    
    function unichar_iszerowidth (_c: string): boolean;
    
    
    
    function unichar_to_utf8 (_c: string, outbuf: string): number;
    
    
    
    function unichar_tolower (_c: string): string;
    
    
    
    function unichar_totitle (_c: string): string;
    
    
    
    function unichar_toupper (_c: string): string;
    
    
    
    function unichar_type (_c: string): UnicodeType;
    
    
    
    function unichar_validate (_ch: string): boolean;
    
    
    
    function unichar_xdigit_value (_c: string): number;
    
    
    
    function unicode_canonical_decomposition (_ch: string, result_len: number): string;
    
    
    
    function unicode_canonical_ordering (string: string, len: number): void;
    
    
    
    function unicode_script_from_iso15924 (iso15924: number): UnicodeScript;
    
    
    
    function unicode_script_to_iso15924 (script: UnicodeScript): number;
    
    
    
    function unix_error_quark (): Quark;
    
    
    
    function unix_fd_add (fd: number, condition: IOCondition, _function: UnixFDSourceFunc, user_data: any): number;
    
    
    
    function unix_fd_add_full (priority: number, fd: number, condition: IOCondition, _function: UnixFDSourceFunc, user_data: any, notify: DestroyNotify): number;
    
    
    
    function unix_fd_source_new (fd: number, condition: IOCondition): Source;
    
    
    
    function unix_open_pipe (fds: number, flags: number): boolean;
    
    
    
    function unix_set_fd_nonblocking (fd: number, nonblock: boolean): boolean;
    
    
    
    function unix_signal_add (signum: number, handler: SourceFunc, user_data: any): number;
    
    
    
    function unix_signal_add_full (priority: number, signum: number, handler: SourceFunc, user_data: any, notify: DestroyNotify): number;
    
    
    
    function unix_signal_source_new (signum: number): Source;
    
    
    
    function unlink (filename: string): number;
    
    
    
    function unsetenv (variable: string): void;
    
    
    
    function uri_escape_string (unescaped: string, reserved_chars_allowed: string, allow_utf8: boolean): string;
    
    
    
    function uri_list_extract_uris (uri_list: string): string[];
    
    
    
    function uri_parse_scheme (uri: string): string;
    
    
    
    function uri_unescape_segment (escaped_string: string, escaped_string_end: string, illegal_characters: string): string;
    
    
    
    function uri_unescape_string (escaped_string: string, illegal_characters: string): string;
    
    
    
    function usleep (microseconds: number): void;
    
    
    
    function utf16_to_ucs4 (_str: number, len: number, items_read: number, items_written: number): string;
    
    
    
    function utf16_to_utf8 (_str: number, len: number, items_read: number, items_written: number): string;
    
    
    
    function utf8_casefold (_str: string, len: number): string;
    
    
    
    function utf8_collate (str1: string, str2: string): number;
    
    
    
    function utf8_collate_key (_str: string, len: number): string;
    
    
    
    function utf8_collate_key_for_filename (_str: string, len: number): string;
    
    
    
    function utf8_find_next_char (_p: string, _end: string): string;
    
    
    
    function utf8_find_prev_char (_str: string, _p: string): string;
    
    
    
    function utf8_get_char (_p: string): string;
    
    
    
    function utf8_get_char_validated (_p: string, max_len: number): string;
    
    
    
    function utf8_make_valid (_str: string, len: number): string;
    
    
    
    function utf8_normalize (_str: string, len: number, mode: NormalizeMode): string;
    
    
    
    function utf8_offset_to_pointer (_str: string, offset: number): string;
    
    
    
    function utf8_pointer_to_offset (_str: string, pos: string): number;
    
    
    
    function utf8_prev_char (_p: string): string;
    
    
    
    function utf8_strchr (_p: string, len: number, _c: string): string;
    
    
    
    function utf8_strdown (_str: string, len: number): string;
    
    
    
    function utf8_strlen (_p: string, max: number): number;
    
    
    
    function utf8_strncpy (dest: string, src: string, _n: number): string;
    
    
    
    function utf8_strrchr (_p: string, len: number, _c: string): string;
    
    
    
    function utf8_strreverse (_str: string, len: number): string;
    
    
    
    function utf8_strup (_str: string, len: number): string;
    
    
    
    function utf8_substring (_str: string, start_pos: number, end_pos: number): string;
    
    
    
    function utf8_to_ucs4 (_str: string, len: number, items_read: number, items_written: number): string;
    
    
    
    function utf8_to_ucs4_fast (_str: string, len: number, items_written: number): string;
    
    
    
    function utf8_to_utf16 (_str: string, len: number, items_read: number, items_written: number): number;
    
    
    
    function utf8_validate (_str: number[], max_len: number, _end: string): boolean;
    
    
    
    function utf8_validate_len (_str: number[], max_len: number, _end: string): boolean;
    
    
    
    function uuid_string_is_valid (_str: string): boolean;
    
    
    
    function uuid_string_random (): string;
    
    
    
    function variant_get_gtype (): GObject.Type;
    
    
    
    function variant_is_object_path (string: string): boolean;
    
    
    
    function variant_is_signature (string: string): boolean;
    
    
    
    function variant_parse (_type: VariantType, text: string, limit: string, endptr: string): Variant;
    
    
    
    function variant_parse_error_print_context (error: Error, source_str: string): string;
    
    
    
    function variant_parse_error_quark (): Quark;
    
    
    
    function variant_parser_get_error_quark (): Quark;
    
    
    
    function variant_type_checked_ (arg0: string): VariantType;
    
    
    
    function variant_type_string_get_depth_ (type_string: string): number;
    
    
    
    function variant_type_string_is_valid (type_string: string): boolean;
    
    
    
    function variant_type_string_scan (string: string, limit: string, endptr: string): boolean;
    
    
    
    function vasprintf (string: string, format: string, args: any[]): number;
    
    
    
    function vfprintf (file: any, format: string, args: any[]): number;
    
    
    
    function vprintf (format: string, args: any[]): number;
    
    
    
    function vsnprintf (string: string, _n: number, format: string, args: any[]): number;
    
    
    
    function vsprintf (string: string, format: string, args: any[]): number;
    
    
    
    function warn_message (domain: string, file: string, line: number, _func: string, warnexpr: string): void;
    
    }