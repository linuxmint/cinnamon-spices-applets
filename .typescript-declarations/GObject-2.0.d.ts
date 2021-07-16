declare namespace imports.gi.GObject {

    interface Binding extends Object {
        get_flags () : BindingFlags;
        get_source () : Object;
        get_source_property () : string;
        get_target () : Object;
        get_target_property () : string;
        unbind () : void;
    }
    
    var Binding: {
        
        
    }
    
    
    
    
    interface InitiallyUnowned extends Object {
        
    }
    
    var InitiallyUnowned: {
        
        
    }
    
    
    
    
    class Object {
        add_toggle_ref (notify: ToggleNotify, data: any) : void;
        add_weak_pointer (weak_pointer_location: any) : void;
        bind_property (source_property: string, target: Object, target_property: string, flags: BindingFlags) : Binding;
        bind_property_full (source_property: string, target: Object, target_property: string, flags: BindingFlags, transform_to: BindingTransformFunc, transform_from: BindingTransformFunc, user_data: any, notify: GLib.DestroyNotify) : Binding;
        bind_property_with_closures (source_property: string, target: Object, target_property: string, flags: BindingFlags, transform_to: Closure, transform_from: Closure) : Binding;
		/** signal+property: string, callback: Function */
		connect (...params: any) : any;
        disconnect (signal_id: any) : void;
        dup_data (key: string, dup_func: GLib.DuplicateFunc, user_data: any) : any;
        dup_qdata (quark: GLib.Quark, dup_func: GLib.DuplicateFunc, user_data: any) : any;
        force_floating () : void;
        freeze_notify () : void;
        // get (first_property_name: string) : void;
        get_data (key: string) : any;
        // get_property (property_name: string, value: Value) : void;
        get_qdata (quark: GLib.Quark) : any;
        // get_valist (first_property_name: string, var_args: any[]) : void;
        getv (n_properties: number, names: string[], values: Value[]) : void;
        is_floating () : boolean;
        notify (property_name: string) : void;
        notify_by_pspec (pspec: ParamSpec) : void;
        ref () : Object;
        ref_sink () : Object;
        remove_toggle_ref (notify: ToggleNotify, data: any) : void;
        remove_weak_pointer (weak_pointer_location: any) : void;
        replace_data (key: string, oldval: any, newval: any, destroy: GLib.DestroyNotify, old_destroy: GLib.DestroyNotify) : boolean;
        replace_qdata (quark: GLib.Quark, oldval: any, newval: any, destroy: GLib.DestroyNotify, old_destroy: GLib.DestroyNotify) : boolean;
        run_dispose () : void;
        // set (first_property_name: string) : void;
        set_data (key: string, data: any) : void;
        set_data_full (key: string, data: any, destroy: GLib.DestroyNotify) : void;
        // set_property (property_name: string, value: Value) : void;
        set_qdata (quark: GLib.Quark, data: any) : void;
        set_qdata_full (quark: GLib.Quark, data: any, destroy: GLib.DestroyNotify) : void;
        // set_valist (first_property_name: string, var_args: any[]) : void;
        setv (n_properties: number, names: string[], values: Value[]) : void;
        steal_data (key: string) : any;
        steal_qdata (quark: GLib.Quark) : any;
        thaw_notify () : void;
        unref () : void;
        watch_closure (closure: Closure) : void;
        weak_ref (notify: WeakNotify, data: any) : void;
		weak_unref (notify: WeakNotify, data: any) : void;
		
		static new (...params: any) : Object;
        // added to the Prototype in ui/environment.js!
        is_finalized(): boolean
        static new_valist (object_type: GObject.Type, first_property_name: string, var_args: any[]) : Object;
        static new_with_properties (object_type: GObject.Type, n_properties: number, names: string[], values: Value[]) : Object;
        static newv (object_type: GObject.Type, n_parameters: number, parameters: Parameter[]) : Object;
        static compat_control (what: number, data: any) : number;
        static interface_find_property (g_iface: TypeInterface, property_name: string) : ParamSpec;
        static interface_install_property (g_iface: TypeInterface, pspec: ParamSpec) : void;
        static interface_list_properties (g_iface: TypeInterface, n_properties_p: number) : ParamSpec[];
    }
    
    interface ParamSpec {
        get_blurb () : string;
        get_default_value () : Value;
        get_name () : string;
        get_name_quark () : GLib.Quark;
        get_nick () : string;
        get_qdata (quark: GLib.Quark) : any;
        get_redirect_target () : ParamSpec;
        ref () : ParamSpec;
        ref_sink () : ParamSpec;
        set_qdata (quark: GLib.Quark, data: any) : void;
        set_qdata_full (quark: GLib.Quark, data: any, destroy: GLib.DestroyNotify) : void;
        sink () : void;
        steal_qdata (quark: GLib.Quark) : any;
        unref () : void;
    }
    
    var ParamSpec: {
        
        internal (param_type: GObject.Type, name: string, nick: string, blurb: string, flags: ParamFlags) : ParamSpec;
    }
    
    
    
    
    interface ParamSpecBoolean extends ParamSpec {
        
    }
    
    var ParamSpecBoolean: {
        
        
    }
    
    
    
    
    interface ParamSpecBoxed extends ParamSpec {
        
    }
    
    var ParamSpecBoxed: {
        
        
    }
    
    
    
    
    interface ParamSpecChar extends ParamSpec {
        
    }
    
    var ParamSpecChar: {
        
        
    }
    
    
    
    
    interface ParamSpecDouble extends ParamSpec {
        
    }
    
    var ParamSpecDouble: {
        
        
    }
    
    
    
    
    interface ParamSpecEnum extends ParamSpec {
        
    }
    
    var ParamSpecEnum: {
        
        
    }
    
    
    
    
    interface ParamSpecFlags extends ParamSpec {
        
    }
    
    var ParamSpecFlags: {
        
        
    }
    
    
    
    
    interface ParamSpecFloat extends ParamSpec {
        
    }
    
    var ParamSpecFloat: {
        
        
    }
    
    
    
    
    interface ParamSpecGType extends ParamSpec {
        
    }
    
    var ParamSpecGType: {
        
        
    }
    
    
    
    
    interface ParamSpecInt extends ParamSpec {
        
    }
    
    var ParamSpecInt: {
        
        
    }
    
    
    
    
    interface ParamSpecInt64 extends ParamSpec {
        
    }
    
    var ParamSpecInt64: {
        
        
    }
    
    
    
    
    interface ParamSpecLong extends ParamSpec {
        
    }
    
    var ParamSpecLong: {
        
        
    }
    
    
    
    
    interface ParamSpecObject extends ParamSpec {
        
    }
    
    var ParamSpecObject: {
        
        
    }
    
    
    
    
    interface ParamSpecOverride extends ParamSpec {
        
    }
    
    var ParamSpecOverride: {
        
        
    }
    
    
    
    
    interface ParamSpecParam extends ParamSpec {
        
    }
    
    var ParamSpecParam: {
        
        
    }
    
    
    
    
    interface ParamSpecPointer extends ParamSpec {
        
    }
    
    var ParamSpecPointer: {
        
        
    }
    
    
    
    
    interface ParamSpecString extends ParamSpec {
        
    }
    
    var ParamSpecString: {
        
        
    }
    
    
    
    
    interface ParamSpecUChar extends ParamSpec {
        
    }
    
    var ParamSpecUChar: {
        
        
    }
    
    
    
    
    interface ParamSpecUInt extends ParamSpec {
        
    }
    
    var ParamSpecUInt: {
        
        
    }
    
    
    
    
    interface ParamSpecUInt64 extends ParamSpec {
        
    }
    
    var ParamSpecUInt64: {
        
        
    }
    
    
    
    
    interface ParamSpecULong extends ParamSpec {
        
    }
    
    var ParamSpecULong: {
        
        
    }
    
    
    
    
    interface ParamSpecUnichar extends ParamSpec {
        
    }
    
    var ParamSpecUnichar: {
        
        
    }
    
    
    
    
    interface ParamSpecValueArray extends ParamSpec {
        
    }
    
    var ParamSpecValueArray: {
        
        
    }
    
    
    
    
    interface ParamSpecVariant extends ParamSpec {
        
    }
    
    var ParamSpecVariant: {
        
        
    }
    
    
    
    
    interface TypeModule extends Object, TypePlugin {
        add_interface (instance_type: GObject.Type, interface_type: GObject.Type, interface_info: InterfaceInfo) : void;
        register_enum (name: string, const_static_values: EnumValue) : GObject.Type;
        register_flags (name: string, const_static_values: FlagsValue) : GObject.Type;
        register_type (parent_type: GObject.Type, type_name: string, type_info: TypeInfo, flags: TypeFlags) : GObject.Type;
        set_name (name: string) : void;
        unuse () : void;
        // use () : boolean;
    }
    
    var TypeModule: {
        
        
    }
    
    
    
    
    class CClosure {
        public closure: Closure;
        public callback: any;
    
    
    }
    
    
    
    class Closure {
        public ref_count: number;
        public meta_marshal_nouse: number;
        public n_guards: number;
        public n_fnotifiers: number;
        public n_inotifiers: number;
        public in_inotify: number;
        public floating: number;
        public derivative_flag: number;
        public in_marshal: number;
        public is_invalid: number;
        public data: any;
        public notifiers: ClosureNotifyData;
    
        marshal : {(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any) : void;};
    
        public add_finalize_notifier (notify_data: any, notify_func: ClosureNotify) : void;
        public add_invalidate_notifier (notify_data: any, notify_func: ClosureNotify) : void;
        public add_marshal_guards (pre_marshal_data: any, pre_marshal_notify: ClosureNotify, post_marshal_data: any, post_marshal_notify: ClosureNotify) : void;
        public invalidate () : void;
        public invoke (return_value: Value, n_param_values: number, param_values: Value[], invocation_hint: any) : void;
        public ref () : Closure;
        public remove_finalize_notifier (notify_data: any, notify_func: ClosureNotify) : void;
        public remove_invalidate_notifier (notify_data: any, notify_func: ClosureNotify) : void;
        public set_marshal (marshal: ClosureMarshal) : void;
        public set_meta_marshal (marshal_data: any, meta_marshal: ClosureMarshal) : void;
        public sink () : void;
        public unref () : void;
    }
    
    
    
    class ClosureNotifyData {
        public data: any;
        public notify: ClosureNotify;
    
    
    }
    
    
    
    class EnumClass {
        public g_type_class: TypeClass;
        public minimum: number;
        public maximum: number;
        public n_values: number;
        public values: EnumValue;
    
    
    }
    
    
    
    class EnumValue {
        public value: number;
        public value_name: string;
        public value_nick: string;
    
    
    }
    
    
    
    class FlagsClass {
        public g_type_class: TypeClass;
        public mask: number;
        public n_values: number;
        public values: FlagsValue;
    
    
    }
    
    
    
    class FlagsValue {
        public value: number;
        public value_name: string;
        public value_nick: string;
    
    
    }
    
    
    
    class InitiallyUnownedClass {
        public g_type_class: TypeClass;
        public construct_properties: GLib.SList;
        public flags: number;
        public pdummy: any[];
    
        constructor_ : {(_type: GObject.Type, n_construct_properties: number, construct_properties: ObjectConstructParam) : Object;};
        set_property : {(object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;};
        get_property : {(object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;};
        dispose : {(object: Object) : void;};
        finalize : {(object: Object) : void;};
        dispatch_properties_changed : {(object: Object, n_pspecs: number, pspecs: ParamSpec) : void;};
        notify : {(object: Object, pspec: ParamSpec) : void;};
        constructed : {(object: Object) : void;};
    
    }
    
    
    
    class InterfaceInfo {
        public interface_init: InterfaceInitFunc;
        public interface_finalize: InterfaceFinalizeFunc;
        public interface_data: any;
    
    
    }
    
    
    
    class ObjectClass {
        public g_type_class: TypeClass;
        public construct_properties: GLib.SList;
        public flags: number;
        public pdummy: any[];
    
        constructor_ : {(_type: GObject.Type, n_construct_properties: number, construct_properties: ObjectConstructParam) : Object;};
        set_property : {(object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;};
        get_property : {(object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;};
        dispose : {(object: Object) : void;};
        finalize : {(object: Object) : void;};
        dispatch_properties_changed : {(object: Object, n_pspecs: number, pspecs: ParamSpec) : void;};
        notify : {(object: Object, pspec: ParamSpec) : void;};
        constructed : {(object: Object) : void;};
    
        public find_property (property_name: string) : ParamSpec;
        public install_properties (n_pspecs: number, pspecs: ParamSpec[]) : void;
        public install_property (property_id: number, pspec: ParamSpec) : void;
        public list_properties (n_properties: number) : ParamSpec[];
        public override_property (property_id: number, name: string) : void;
    }
    
    
    
    class ObjectConstructParam {
        public pspec: ParamSpec;
        public value: Value;
    
    
    }
    
    
    
    class ParamSpecClass {
        public g_type_class: TypeClass;
        public value_type: GObject.Type;
        public dummy: any[];
    
        finalize : {(pspec: ParamSpec) : void;};
        value_set_default : {(pspec: ParamSpec, value: Value) : void;};
        value_validate : {(pspec: ParamSpec, value: Value) : boolean;};
        values_cmp : {(pspec: ParamSpec, value1: Value, value2: Value) : number;};
    
    }
    
    
    
    class ParamSpecPool {
    
    
        public insert (pspec: ParamSpec, owner_type: GObject.Type) : void;
        public list (owner_type: GObject.Type, n_pspecs_p: number) : ParamSpec[];
        public list_owned (owner_type: GObject.Type) : GLib.List;
        public lookup (param_name: string, owner_type: GObject.Type, walk_ancestors: boolean) : ParamSpec;
        public remove (pspec: ParamSpec) : void;
    }
    
    
    
    class ParamSpecTypeInfo {
        public instance_size: number;
        public n_preallocs: number;
        public value_type: GObject.Type;
    
        instance_init : {(pspec: ParamSpec) : void;};
        finalize : {(pspec: ParamSpec) : void;};
        value_set_default : {(pspec: ParamSpec, value: Value) : void;};
        value_validate : {(pspec: ParamSpec, value: Value) : boolean;};
        values_cmp : {(pspec: ParamSpec, value1: Value, value2: Value) : number;};
    
    }
    
    
    
    class Parameter {
        public name: string;
        public value: Value;
    
    
    }
    
    
    
    class SignalInvocationHint {
        public signal_id: number;
        public detail: GLib.Quark;
        public run_type: SignalFlags;
    
    
    }
    
    
    
    class SignalQuery {
        public signal_id: number;
        public signal_name: string;
        public itype: GObject.Type;
        public signal_flags: SignalFlags;
        public return_type: GObject.Type;
        public n_params: number;
        public param_types: GObject.Type[];
    
    
    }
    
    
    
    class TypeClass {
        public g_type: GObject.Type;
    
    
        public add_private (private_size: number) : void;
        public get_instance_private_offset () : number;
        public get_private (private_type: GObject.Type) : any;
        public peek_parent () : TypeClass;
        public unref () : void;
        public unref_uncached () : void;
    }
    
    
    
    class TypeFundamentalInfo {
        public type_flags: TypeFundamentalFlags;
    
    
    }
    
    
    
    class TypeInfo {
        public class_size: number;
        public base_init: BaseInitFunc;
        public base_finalize: BaseFinalizeFunc;
        public class_init: ClassInitFunc;
        public class_finalize: ClassFinalizeFunc;
        public class_data: any;
        public instance_size: number;
        public n_preallocs: number;
        public instance_init: InstanceInitFunc;
        public value_table: TypeValueTable;
    
    
    }
    
    
    
    class TypeInstance {
        public g_class: TypeClass;
    
    
        public get_private (private_type: GObject.Type) : any;
    }
    
    
    
    class TypeInterface {
        public g_type: GObject.Type;
        public g_instance_type: GObject.Type;
    
    
        public peek_parent () : TypeInterface;
    }
    
    
    
    class TypeModuleClass {
        public parent_class: ObjectClass;
    
        load : {(module: TypeModule) : boolean;};
        unload : {(module: TypeModule) : void;};
        reserved1 : {() : void;};
        reserved2 : {() : void;};
        reserved3 : {() : void;};
        reserved4 : {() : void;};
    
    }
    
    
    
    class TypePluginClass {
        public base_iface: TypeInterface;
        public use_plugin: TypePluginUse;
        public unuse_plugin: TypePluginUnuse;
        public complete_type_info: TypePluginCompleteTypeInfo;
        public complete_interface_info: TypePluginCompleteInterfaceInfo;
    
    
    }
    
    
    
    class TypeQuery {
        public type: GObject.Type;
        public type_name: string;
        public class_size: number;
        public instance_size: number;
    
    
    }
    
    
    
    class TypeValueTable {
        public collect_format: string;
        public lcopy_format: string;
    
        value_init : {(value: Value) : void;};
        value_free : {(value: Value) : void;};
        value_copy : {(src_value: Value, dest_value: Value) : void;};
        value_peek_pointer : {(value: Value) : any;};
        collect_value : {(value: Value, n_collect_values: number, collect_values: TypeCValue, collect_flags: number) : string;};
        lcopy_value : {(value: Value, n_collect_values: number, collect_values: TypeCValue, collect_flags: number) : string;};
    
    }
    
    
    
    class Value {
        public g_type: GObject.Type;
        public data: _Value__data__union[];
    
    
        public copy (dest_value: Value) : void;
        public dup_boxed () : any;
        public dup_object () : Object;
        public dup_param () : ParamSpec;
        public dup_string () : string;
        public dup_variant () : GLib.Variant;
        public fits_pointer () : boolean;
        public get_boolean () : boolean;
        public get_boxed () : any;
        public get_char () : string;
        public get_double () : number;
        public get_enum () : number;
        public get_flags () : number;
        public get_float () : number;
        public get_gtype () : GObject.Type;
        public get_int () : number;
        public get_int64 () : number;
        public get_long () : number;
        public get_object () : Object;
        public get_param () : ParamSpec;
        public get_pointer () : any;
        public get_schar () : number;
        public get_string () : string;
        public get_uchar () : number;
        public get_uint () : number;
        public get_uint64 () : number;
        public get_ulong () : number;
        public get_variant () : GLib.Variant;
        public init (g_type: GObject.Type) : Value;
        public init_from_instance (_instance: TypeInstance) : void;
        public peek_pointer () : any;
        public reset () : Value;
        public set_boolean (v_boolean: boolean) : void;
        public set_boxed (v_boxed: any) : void;
        public set_boxed_take_ownership (v_boxed: any) : void;
        public set_char (v_char: string) : void;
        public set_double (v_double: number) : void;
        public set_enum (v_enum: number) : void;
        public set_flags (v_flags: number) : void;
        public set_float (v_float: number) : void;
        public set_gtype (v_gtype: GObject.Type) : void;
        public set_instance (_instance: any) : void;
        public set_int (v_int: number) : void;
        public set_int64 (v_int64: number) : void;
        public set_long (v_long: number) : void;
        public set_object (v_object: Object) : void;
        public set_object_take_ownership (v_object: any) : void;
        public set_param (param: ParamSpec) : void;
        public set_param_take_ownership (param: ParamSpec) : void;
        public set_pointer (v_pointer: any) : void;
        public set_schar (v_char: number) : void;
        public set_static_boxed (v_boxed: any) : void;
        public set_static_string (v_string: string) : void;
        public set_string (v_string: string) : void;
        public set_string_take_ownership (v_string: string) : void;
        public set_uchar (v_uchar: number) : void;
        public set_uint (v_uint: number) : void;
        public set_uint64 (v_uint64: number) : void;
        public set_ulong (v_ulong: number) : void;
        public set_variant (variant: GLib.Variant) : void;
        public take_boxed (v_boxed: any) : void;
        public take_object (v_object: any) : void;
        public take_param (param: ParamSpec) : void;
        public take_string (v_string: string) : void;
        public take_variant (variant: GLib.Variant) : void;
        public transform (dest_value: Value) : boolean;
        public unset () : void;
    }
    
    
    
    class ValueArray {
        public n_values: number;
        public values: Value;
        public n_prealloced: number;
    
    
        public append (value: Value) : ValueArray;
        public copy () : ValueArray;
        public free () : void;
        public get_nth (index_: number) : Value;
        public insert (index_: number, value: Value) : ValueArray;
        public prepend (value: Value) : ValueArray;
        public remove (index_: number) : ValueArray;
        public sort (compare_func: GLib.CompareFunc) : ValueArray;
        public sort_with_data (compare_func: GLib.CompareDataFunc, user_data: any) : ValueArray;
    }
    
    
    
    class WeakRef {
    
    
        public clear () : void;
        public get () : Object;
        public init (object: Object) : void;
        public set (object: Object) : void;
    }
    
    
    
    interface TypePlugin {
        complete_interface_info (instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo) : void;
        complete_type_info (g_type: GObject.Type, info: TypeInfo, value_table: TypeValueTable) : void;
        unuse () : void;
        use () : void;
    }
    
    var TypePlugin: {
        
        
    }
    
    
    
    
    enum BindingFlags {
        default = 0,
        bidirectional = 1,
        sync_create = 2,
        invert_boolean = 4
    }
    
    
    
    enum ConnectFlags {
        after = 1,
        swapped = 2
    }
    
    
    
    enum ParamFlags {
        readable = 1,
        writable = 2,
        readwrite = 3,
        construct = 4,
        construct_only = 8,
        lax_validation = 16,
        static_name = 32,
        private = 32,
        static_nick = 64,
        static_blurb = 128,
        explicit_notify = 1073741824,
        deprecated = 2147483648
    }
    
    
    
    enum SignalFlags {
        run_first = 1,
        run_last = 2,
        run_cleanup = 4,
        no_recurse = 8,
        detailed = 16,
        action = 32,
        no_hooks = 64,
        must_collect = 128,
        deprecated = 256
    }
    
    
    
    enum SignalMatchType {
        id = 1,
        detail = 2,
        closure = 4,
        func = 8,
        data = 16,
        unblocked = 32
    }
    
    
    
    enum TypeDebugFlags {
        none = 0,
        objects = 1,
        signals = 2,
        instance_count = 4,
        mask = 7
    }
    
    
    
    enum TypeFlags {
        abstract = 16,
        value_abstract = 32
    }
    
    
    
    enum TypeFundamentalFlags {
        classed = 1,
        instantiatable = 2,
        derivable = 4,
        deep_derivable = 8
    }
    
    
    
    interface BaseFinalizeFunc {
        (g_class: TypeClass) : void;
    }
    
    
    
    interface BaseInitFunc {
        (g_class: TypeClass) : void;
    }
    
    
    
    interface BindingTransformFunc {
        (binding: Binding, from_value: Value, to_value: Value, user_data: any) : boolean;
    }
    
    
    
    interface BoxedCopyFunc {
        (boxed: any) : any;
    }
    
    
    
    interface BoxedFreeFunc {
        (boxed: any) : void;
    }
    
    
    
    interface Callback {
        () : void;
    }
    
    
    
    interface ClassFinalizeFunc {
        (g_class: TypeClass, class_data: any) : void;
    }
    
    
    
    interface ClassInitFunc {
        (g_class: TypeClass, class_data: any) : void;
    }
    
    
    
    interface ClosureMarshal {
        (closure: Closure, return_value: Value, n_param_values: number, param_values: Value[], invocation_hint: any, marshal_data: any) : void;
    }
    
    
    
    interface ClosureNotify {
        (data: any, closure: Closure) : void;
    }
    
    
    
    interface InstanceInitFunc {
        (_instance: TypeInstance, g_class: TypeClass) : void;
    }
    
    
    
    interface InterfaceFinalizeFunc {
        (g_iface: TypeInterface, iface_data: any) : void;
    }
    
    
    
    interface InterfaceInitFunc {
        (g_iface: TypeInterface, iface_data: any) : void;
    }
    
    
    
    interface ObjectFinalizeFunc {
        (object: Object) : void;
    }
    
    
    
    interface ObjectGetPropertyFunc {
        (object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;
    }
    
    
    
    interface ObjectSetPropertyFunc {
        (object: Object, property_id: number, value: Value, pspec: ParamSpec) : void;
    }
    
    
    
    interface SignalAccumulator {
        (ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, data: any) : boolean;
    }
    
    
    
    interface SignalEmissionHook {
        (ihint: SignalInvocationHint, n_param_values: number, param_values: Value[], data: any) : boolean;
    }
    
    
    
    interface ToggleNotify {
        (data: any, object: Object, is_last_ref: boolean) : void;
    }
    
    
    
    interface TypeClassCacheFunc {
        (cache_data: any, g_class: TypeClass) : boolean;
    }
    
    
    
    interface TypeInterfaceCheckFunc {
        (check_data: any, g_iface: TypeInterface) : void;
    }
    
    
    
    interface TypePluginCompleteInterfaceInfo {
        (plugin: TypePlugin, instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo) : void;
    }
    
    
    
    interface TypePluginCompleteTypeInfo {
        (plugin: TypePlugin, g_type: GObject.Type, info: TypeInfo, value_table: TypeValueTable) : void;
    }
    
    
    
    interface TypePluginUnuse {
        (plugin: TypePlugin) : void;
    }
    
    
    
    interface TypePluginUse {
        (plugin: TypePlugin) : void;
    }
    
    
    
    interface VaClosureMarshal {
        (closure: Closure, return_value: Value, _instance: TypeInstance, args: any[], marshal_data: any, n_params: number, param_types: GObject.Type[]) : void;
    }
    
    
    
    interface ValueTransform {
        (src_value: Value, dest_value: Value) : void;
    }
    
    
    
    interface WeakNotify {
        (data: any, where_the_object_was: Object) : void;
    }
    
    
    
    interface TypeCValue {}
    
    
    
    interface _Value__data__union {}
    
    
    
    type SignalCMarshaller = ClosureMarshal;
    
    
    
    type SignalCVaMarshaller = VaClosureMarshal;
    
    
    
    type Type = number;
    
    
    
    function boxed_copy (boxed_type: GObject.Type, src_boxed: any): any;
    
    
    
    function boxed_free (boxed_type: GObject.Type, boxed: any): void;
    
    
    
    function boxed_type_register_static (name: string, boxed_copy: BoxedCopyFunc, boxed_free: BoxedFreeFunc): GObject.Type;
    
    
    
    function cclosure_marshal_BOOLEAN__BOXED_BOXED (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_BOOLEAN__FLAGS (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_STRING__OBJECT_POINTER (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__BOOLEAN (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__BOXED (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__CHAR (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__DOUBLE (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__ENUM (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__FLAGS (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__FLOAT (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__INT (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__LONG (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__OBJECT (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__PARAM (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__POINTER (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__STRING (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__UCHAR (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__UINT (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__UINT_POINTER (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__ULONG (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__VARIANT (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_VOID__VOID (closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_marshal_generic (closure: Closure, return_gvalue: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;
    
    
    
    function cclosure_new (callback_func: Callback, user_data: any, destroy_data: ClosureNotify): Closure;
    
    
    
    function cclosure_new_object (callback_func: Callback, object: Object): Closure;
    
    
    
    function cclosure_new_object_swap (callback_func: Callback, object: Object): Closure;
    
    
    
    function cclosure_new_swap (callback_func: Callback, user_data: any, destroy_data: ClosureNotify): Closure;
    
    
    
    function clear_object (object_ptr: Object): void;
    
    
    
    function enum_complete_type_info (g_enum_type: GObject.Type, info: TypeInfo, const_values: EnumValue): void;
    
    
    
    function enum_get_value (enum_class: EnumClass, value: number): EnumValue;
    
    
    
    function enum_get_value_by_name (enum_class: EnumClass, name: string): EnumValue;
    
    
    
    function enum_get_value_by_nick (enum_class: EnumClass, nick: string): EnumValue;
    
    
    
    function enum_register_static (name: string, const_static_values: EnumValue): GObject.Type;
    
    
    
    function enum_to_string (g_enum_type: GObject.Type, value: number): string;
    
    
    
    function flags_complete_type_info (g_flags_type: GObject.Type, info: TypeInfo, const_values: FlagsValue): void;
    
    
    
    function flags_get_first_value (flags_class: FlagsClass, value: number): FlagsValue;
    
    
    
    function flags_get_value_by_name (flags_class: FlagsClass, name: string): FlagsValue;
    
    
    
    function flags_get_value_by_nick (flags_class: FlagsClass, nick: string): FlagsValue;
    
    
    
    function flags_register_static (name: string, const_static_values: FlagsValue): GObject.Type;
    
    
    
    function flags_to_string (flags_type: GObject.Type, value: number): string;
    
    
    
    function gtype_get_type (): GObject.Type;
    
    
    
    function param_spec_boolean (name: string, nick: string, blurb: string, default_value: boolean, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_boxed (name: string, nick: string, blurb: string, boxed_type: GObject.Type, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_char (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_double (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_enum (name: string, nick: string, blurb: string, enum_type: GObject.Type, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_flags (name: string, nick: string, blurb: string, flags_type: GObject.Type, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_float (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_gtype (name: string, nick: string, blurb: string, is_a_type: GObject.Type, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_int (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_int64 (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_long (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_object (name: string, nick: string, blurb: string, object_type: GObject.Type, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_override (name: string, overridden: ParamSpec): ParamSpec;
    
    
    
    function param_spec_param (name: string, nick: string, blurb: string, param_type: GObject.Type, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_pointer (name: string, nick: string, blurb: string, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_pool_new (type_prefixing: boolean): ParamSpecPool;
    
    
    
    function param_spec_string (name: string, nick: string, blurb: string, default_value: string, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_uchar (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_uint (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_uint64 (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_ulong (name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_unichar (name: string, nick: string, blurb: string, default_value: string, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_value_array (name: string, nick: string, blurb: string, element_spec: ParamSpec, flags: ParamFlags): ParamSpec;
    
    
    
    function param_spec_variant (name: string, nick: string, blurb: string, _type: GLib.VariantType, default_value: GLib.Variant, flags: ParamFlags): ParamSpec;
    
    
    
    function param_type_register_static (name: string, pspec_info: ParamSpecTypeInfo): GObject.Type;
    
    
    
    function param_value_convert (pspec: ParamSpec, src_value: Value, dest_value: Value, strict_validation: boolean): boolean;
    
    
    
    function param_value_defaults (pspec: ParamSpec, value: Value): boolean;
    
    
    
    function param_value_set_default (pspec: ParamSpec, value: Value): void;
    
    
    
    function param_value_validate (pspec: ParamSpec, value: Value): boolean;
    
    
    
    function param_values_cmp (pspec: ParamSpec, value1: Value, value2: Value): number;
    
    
    
    function pointer_type_register_static (name: string): GObject.Type;
    
    
    
    function signal_accumulator_first_wins (ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, dummy: any): boolean;
    
    
    
    function signal_accumulator_true_handled (ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, dummy: any): boolean;
    
    
    
    function signal_add_emission_hook (signal_id: number, detail: GLib.Quark, hook_func: SignalEmissionHook, hook_data: any, data_destroy: GLib.DestroyNotify): number;
    
    
    
    function signal_chain_from_overridden (instance_and_params: Value[], return_value: Value): void;
    
    
    
    function signal_chain_from_overridden_handler (_instance: TypeInstance): void;
    
    
    
    function signal_connect_closure (_instance: Object, detailed_signal: string, closure: Closure, after: boolean): number;
    
    
    
    function signal_connect_closure_by_id (_instance: Object, signal_id: number, detail: GLib.Quark, closure: Closure, after: boolean): number;
    
    
    
    function signal_connect_data (_instance: Object, detailed_signal: string, c_handler: Callback, data: any, destroy_data: ClosureNotify, connect_flags: ConnectFlags): number;
    
    
    
    function signal_connect_object (_instance: TypeInstance, detailed_signal: string, c_handler: Callback, gobject: Object, connect_flags: ConnectFlags): number;
    
    
    
    function signal_emit (_instance: Object, signal_id: number, detail: GLib.Quark): void;
    
    
    
    function signal_emit_by_name (_instance: Object, detailed_signal: string): void;
    
    
    
    function signal_emit_valist (_instance: TypeInstance, signal_id: number, detail: GLib.Quark, var_args: any[]): void;
    
    
    
    function signal_emitv (instance_and_params: Value[], signal_id: number, detail: GLib.Quark, return_value: Value): void;
    
    
    
    function signal_get_invocation_hint (_instance: Object): SignalInvocationHint;
    
    
    
    function signal_handler_block (_instance: Object, handler_id: number): void;
    
    
    
    function signal_handler_disconnect (_instance: Object, handler_id: number): void;
    
    
    
    function signal_handler_find (_instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure, _func: any, data: any): number;
    
    
    
    function signal_handler_is_connected (_instance: Object, handler_id: number): boolean;
    
    
    
    function signal_handler_unblock (_instance: Object, handler_id: number): void;
    
    
    
    function signal_handlers_block_matched (_instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure, _func: any, data: any): number;
    
    
    
    function signal_handlers_destroy (_instance: Object): void;
    
    
    
    function signal_handlers_disconnect_matched (_instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure, _func: any, data: any): number;
    
    
    
    function signal_handlers_unblock_matched (_instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure, _func: any, data: any): number;
    
    
    
    function signal_has_handler_pending (_instance: Object, signal_id: number, detail: GLib.Quark, may_be_blocked: boolean): boolean;
    
    
    
    function signal_list_ids (itype: GObject.Type, n_ids: number): number[];
    
    
    
    function signal_lookup (name: string, itype: GObject.Type): number;
    
    
    
    function signal_name (signal_id: number): string;
    
    
    
    function signal_new (signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_offset: number, accumulator: SignalAccumulator, accu_data: any, c_marshaller: SignalCMarshaller, return_type: GObject.Type, n_params: number): number;
    
    
    
    function signal_new_class_handler (signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_handler: Callback, accumulator: SignalAccumulator, accu_data: any, c_marshaller: SignalCMarshaller, return_type: GObject.Type, n_params: number): number;
    
    
    
    function signal_new_valist (signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_closure: Closure, accumulator: SignalAccumulator, accu_data: any, c_marshaller: SignalCMarshaller, return_type: GObject.Type, n_params: number, args: any[]): number;
    
    
    
    function signal_newv (signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_closure: Closure, accumulator: SignalAccumulator, accu_data: any, c_marshaller: SignalCMarshaller, return_type: GObject.Type, n_params: number, param_types: GObject.Type[]): number;
    
    
    
    function signal_override_class_closure (signal_id: number, instance_type: GObject.Type, class_closure: Closure): void;
    
    
    
    function signal_override_class_handler (signal_name: string, instance_type: GObject.Type, class_handler: Callback): void;
    
    
    
    function signal_parse_name (detailed_signal: string, itype: GObject.Type, signal_id_p: number, detail_p: GLib.Quark, force_detail_quark: boolean): boolean;
    
    
    
    function signal_query (signal_id: number, query: SignalQuery): void;
    
    
    
    function signal_remove_emission_hook (signal_id: number, hook_id: number): void;
    
    
    
    function signal_set_va_marshaller (signal_id: number, instance_type: GObject.Type, va_marshaller: SignalCVaMarshaller): void;
    
    
    
    function signal_stop_emission (_instance: Object, signal_id: number, detail: GLib.Quark): void;
    
    
    
    function signal_stop_emission_by_name (_instance: Object, detailed_signal: string): void;
    
    
    
    function signal_type_cclosure_new (itype: GObject.Type, struct_offset: number): Closure;
    
    
    
    function source_set_closure (source: GLib.Source, closure: Closure): void;
    
    
    
    function source_set_dummy_callback (source: GLib.Source): void;
    
    
    
    function strdup_value_contents (value: Value): string;
    
    
    
    function type_add_class_cache_func (cache_data: any, cache_func: TypeClassCacheFunc): void;
    
    
    
    function type_add_class_private (class_type: GObject.Type, private_size: number): void;
    
    
    
    function type_add_instance_private (class_type: GObject.Type, private_size: number): number;
    
    
    
    function type_add_interface_check (check_data: any, check_func: TypeInterfaceCheckFunc): void;
    
    
    
    function type_add_interface_dynamic (instance_type: GObject.Type, interface_type: GObject.Type, plugin: TypePlugin): void;
    
    
    
    function type_add_interface_static (instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo): void;
    
    
    
    function type_check_class_cast (g_class: TypeClass, is_a_type: GObject.Type): TypeClass;
    
    
    
    function type_check_class_is_a (g_class: TypeClass, is_a_type: GObject.Type): boolean;
    
    
    
    function type_check_instance (_instance: TypeInstance): boolean;
    
    
    
    function type_check_instance_cast (_instance: TypeInstance, iface_type: GObject.Type): TypeInstance;
    
    
    
    function type_check_instance_is_a (_instance: TypeInstance, iface_type: GObject.Type): boolean;
    
    
    
    function type_check_instance_is_fundamentally_a (_instance: TypeInstance, fundamental_type: GObject.Type): boolean;
    
    
    
    function type_check_is_value_type (_type: GObject.Type): boolean;
    
    
    
    function type_check_value (value: Value): boolean;
    
    
    
    function type_check_value_holds (value: Value, _type: GObject.Type): boolean;
    
    
    
    function type_children (_type: GObject.Type, n_children: number): GObject.Type[];
    
    
    
    function type_class_adjust_private_offset (g_class: any, private_size_or_offset: number): void;
    
    
    
    function type_class_peek (_type: GObject.Type): TypeClass;
    
    
    
    function type_class_peek_static (_type: GObject.Type): TypeClass;
    
    
    
    function type_class_ref (_type: GObject.Type): TypeClass;
    
    
    
    function type_create_instance (_type: GObject.Type): TypeInstance;
    
    
    
    function type_default_interface_peek (g_type: GObject.Type): TypeInterface;
    
    
    
    function type_default_interface_ref (g_type: GObject.Type): TypeInterface;
    
    
    
    function type_default_interface_unref (g_iface: TypeInterface): void;
    
    
    
    function type_depth (_type: GObject.Type): number;
    
    
    
    function type_ensure (_type: GObject.Type): void;
    
    
    
    function type_free_instance (_instance: TypeInstance): void;
    
    
    
    function type_from_name (name: string): GObject.Type;
    
    
    
    function type_fundamental (type_id: GObject.Type): GObject.Type;
    
    
    
    function type_fundamental_next (): GObject.Type;
    
    
    
    function type_get_instance_count (_type: GObject.Type): number;
    
    
    
    function type_get_plugin (_type: GObject.Type): TypePlugin;
    
    
    
    function type_get_qdata (_type: GObject.Type, quark: GLib.Quark): any;
    
    
    
    function type_get_type_registration_serial (): number;
    
    
    
    function type_init (): void;
    
    
    
    function type_init_with_debug_flags (debug_flags: TypeDebugFlags): void;
    
    
    
    function type_interface_add_prerequisite (interface_type: GObject.Type, prerequisite_type: GObject.Type): void;
    
    
    
    function type_interface_get_plugin (instance_type: GObject.Type, interface_type: GObject.Type): TypePlugin;
    
    
    
    function type_interface_peek (instance_class: TypeClass, iface_type: GObject.Type): TypeInterface;
    
    
    
    function type_interface_prerequisites (interface_type: GObject.Type, n_prerequisites: number): GObject.Type[];
    
    
    
    function type_interfaces (_type: GObject.Type, n_interfaces: number): GObject.Type[];
    
    
    
    function type_is_a (_type: GObject.Type, is_a_type: GObject.Type): boolean;
    
    
    
    function type_name (_type: GObject.Type): string;
    
    
    
    function type_name_from_class (g_class: TypeClass): string;
    
    
    
    function type_name_from_instance (_instance: TypeInstance): string;
    
    
    
    function type_next_base (leaf_type: GObject.Type, root_type: GObject.Type): GObject.Type;
    
    
    
    function type_parent (_type: GObject.Type): GObject.Type;
    
    
    
    function type_qname (_type: GObject.Type): GLib.Quark;
    
    
    
    function type_query (_type: GObject.Type, query: TypeQuery): void;
    
    
    
    function type_register_dynamic (parent_type: GObject.Type, type_name: string, plugin: TypePlugin, flags: TypeFlags): GObject.Type;
    
    
    
    function type_register_fundamental (type_id: GObject.Type, type_name: string, info: TypeInfo, finfo: TypeFundamentalInfo, flags: TypeFlags): GObject.Type;
    
    
    
    function type_register_static (parent_type: GObject.Type, type_name: string, info: TypeInfo, flags: TypeFlags): GObject.Type;
    
    
    
    function type_register_static_simple (parent_type: GObject.Type, type_name: string, class_size: number, class_init: ClassInitFunc, instance_size: number, instance_init: InstanceInitFunc, flags: TypeFlags): GObject.Type;
    
    
    
    function type_remove_class_cache_func (cache_data: any, cache_func: TypeClassCacheFunc): void;
    
    
    
    function type_remove_interface_check (check_data: any, check_func: TypeInterfaceCheckFunc): void;
    
    
    
    function type_set_qdata (_type: GObject.Type, quark: GLib.Quark, data: any): void;
    
    
    
    function type_test_flags (_type: GObject.Type, flags: number): boolean;
    
    
    
    function type_value_table_peek (_type: GObject.Type): TypeValueTable;
    
    
    
    function value_register_transform_func (src_type: GObject.Type, dest_type: GObject.Type, transform_func: ValueTransform): void;
    
    
    
    function value_type_compatible (src_type: GObject.Type, dest_type: GObject.Type): boolean;
    
    
    
    function value_type_transformable (src_type: GObject.Type, dest_type: GObject.Type): boolean;
    
    }