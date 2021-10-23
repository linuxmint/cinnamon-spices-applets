declare namespace imports.gi.Caribou {
    interface DisplayAdapter extends GObject.Object {
        keyval_press(keyval: number): void;
        keyval_release(keyval: number): void;
        mod_lock(mask: number): void;
        mod_unlock(mask: number): void;
        mod_latch(mask: number): void;
        mod_unlatch(mask: number): void;
        get_current_group(group_name: string, variant_name: string): number;
        get_groups(group_names: string[], group_names_length1: number, variant_names: string[], variant_names_length1: number): void;
        register_key_func(keyval: number, _func: Caribou.KeyButtonCallback, func_target: any): void;
        register_button_func(button: number, _func: Caribou.KeyButtonCallback, func_target: any): void;
        get_display(): Gdk.Display;
    }

    var DisplayAdapter: {
        set_default(adapter: Caribou.DisplayAdapter): boolean;
        get_default(): Caribou.DisplayAdapter;
    }

    interface NullAdapter extends Caribou.DisplayAdapter {

    }

    var NullAdapter: {
        new(): Caribou.NullAdapter;
    }

    interface XAdapter extends Caribou.DisplayAdapter {

    }

    var XAdapter: {
        new(): Caribou.XAdapter;
    }

    interface KeyboardModelOptions {
        keyboard_type: string
    }

    interface KeyboardModel extends GObject.Object, Caribou.IKeyboardObject {
        keyboard_type: string
        active_group: string
        get_groups(result_length1: number): string[];
        get_group(group_name: string): Caribou.GroupModel;
        get_active_group(): string;
        get_keyboard_type(): string;
        get_keyboard_file(): string;

    }

    class KeyboardModel {
        static new(): Caribou.KeyboardModel;
        constructor(options?: KeyboardModelOptions)
    }

    interface KeyboardService extends GObject.Object {
        set_cursor_location(_x: number, _y: number, _w: number, _h: number): void;
        set_entry_location(_x: number, _y: number, _w: number, _h: number): void;
        show(timestamp: number): void;
        hide(timestamp: number): void;
        register_keyboard(name: string): void;
        name_lost(name: string): void;
    }

    var KeyboardService: {
    }

    interface GroupModel extends GObject.Object, Caribou.IKeyboardObject {
        get_levels(result_length1: number): string[];
        get_level(level_name: string): Caribou.LevelModel;
        get_active_level(): string;
    }

    var GroupModel: {
        new(group: string, variant: string): Caribou.GroupModel;
        create_group_name(group: string, variant: string): string;
    }

    interface LevelModel extends Caribou.ScannableGroup, Caribou.IKeyboardObject {
        get_rows(result_length1: number): Caribou.RowModel[];
        get_mode(): string;
    }

    var LevelModel: {
        new(mode: string): Caribou.LevelModel;
    }

    interface RowModel extends Caribou.ScannableGroup, Caribou.IScannableItem, Caribou.IKeyboardObject {
        get_columns(result_length1: number): Caribou.ColumnModel[];
    }

    var RowModel: {
        new(): Caribou.RowModel;
    }

    interface KeyModel extends GObject.Object, Caribou.IScannableItem, Caribou.IKeyboardObject {
        press(): void;
        release(): void;
        get_extended_keys(result_length1: number): Caribou.KeyModel[];
        activate(): void;
        get_align(): string;
        set_align(value: string): void;
        get_width(): number;
        set_width(value: number): void;
        get_toggle(): string;
        set_toggle(value: string): void;
        get_repeatable(): boolean;
        set_repeatable(value: boolean): void;
        get_is_modifier(): boolean;
        set_is_modifier(value: boolean): void;
        get_show_subkeys(): boolean;
        get_name(): string;
        get_keyval(): number;
        get_text(): string;
        get_label(): string;
        set_label(value: string): void;
    }

    var KeyModel: {
        new(name: string, text: string): Caribou.KeyModel;
    }

    interface ColumnModel extends Caribou.ScannableGroup, Caribou.IScannableItem, Caribou.IKeyboardObject {
        get_key(index: number): Caribou.KeyModel;
        first_key(): Caribou.KeyModel;
    }

    var ColumnModel: {
        new(): Caribou.ColumnModel;
    }

    interface Scanner extends GObject.Object {
        set_keyboard(keyboard: Caribou.KeyboardModel): void;
        reset(): void;
        get_bind_settings(): boolean;
        get_scan_grouping(): number;
        set_scan_grouping(value: number): void;
        get_scan_enabled(): boolean;
        set_scan_enabled(value: boolean): void;
        get_step_time(): number;
        set_step_time(value: number): void;
        get_switch_device(): string;
        set_switch_device(value: string): void;
        get_keyboard_key(): string;
        set_keyboard_key(value: string): void;
        get_mouse_button(): number;
        set_mouse_button(value: number): void;
        get_scan_cycles(): number;
        set_scan_cycles(value: number): void;
        get_autorestart(): boolean;
        set_autorestart(value: boolean): void;
        get_inverse_scanning(): boolean;
        set_inverse_scanning(value: boolean): void;
    }

    var Scanner: {
        new(): Caribou.Scanner;
    }

    interface ScannableGroup extends GObject.Object, Caribou.IScannableGroup {
        get_scan_children(result_length1: number): Caribou.IScannableItem[];
        child_select(): Caribou.IScannableItem;
    }

    var ScannableGroup: {
    }

    class DisplayAdapterClass {
        public parent_class: GObject.ObjectClass;
        keyval_press: { (self: Caribou.DisplayAdapter, keyval: number): void; };
        keyval_release: { (self: Caribou.DisplayAdapter, keyval: number): void; };
        mod_lock: { (self: Caribou.DisplayAdapter, mask: number): void; };
        mod_unlock: { (self: Caribou.DisplayAdapter, mask: number): void; };
        mod_latch: { (self: Caribou.DisplayAdapter, mask: number): void; };
        mod_unlatch: { (self: Caribou.DisplayAdapter, mask: number): void; };
        get_current_group: { (self: Caribou.DisplayAdapter, group_name: string, variant_name: string): number; };
        get_groups: { (self: Caribou.DisplayAdapter, group_names: string[], group_names_length1: number, variant_names: string[], variant_names_length1: number): void; };
        register_key_func: { (self: Caribou.DisplayAdapter, keyval: number, _func: Caribou.KeyButtonCallback, func_target: any): void; };
        register_button_func: { (self: Caribou.DisplayAdapter, button: number, _func: Caribou.KeyButtonCallback, func_target: any): void; };
    }

    class DisplayAdapterPrivate {
    }

    class NullAdapterClass {
        public parent_class: Caribou.DisplayAdapterClass;
    }

    class NullAdapterPrivate {
    }

    class XAdapterClass {
        public parent_class: Caribou.DisplayAdapterClass;
    }

    class XAdapterPrivate {
    }

    class KeyboardModelClass {
        public parent_class: GObject.ObjectClass;
    }

    class KeyboardModelPrivate {
    }

    class KeyboardServiceClass {
        public parent_class: GObject.ObjectClass;
        set_cursor_location: { (self: Caribou.KeyboardService, _x: number, _y: number, _w: number, _h: number): void; };
        set_entry_location: { (self: Caribou.KeyboardService, _x: number, _y: number, _w: number, _h: number): void; };
        show: { (self: Caribou.KeyboardService, timestamp: number): void; };
        hide: { (self: Caribou.KeyboardService, timestamp: number): void; };
        name_lost: { (self: Caribou.KeyboardService, name: string): void; };
    }

    class KeyboardServicePrivate {
    }

    class GroupModelClass {
        public parent_class: GObject.ObjectClass;
    }

    class GroupModelPrivate {
    }

    class LevelModelClass {
        public parent_class: Caribou.ScannableGroupClass;
    }

    class LevelModelPrivate {
    }

    class RowModelClass {
        public parent_class: Caribou.ScannableGroupClass;
    }

    class RowModelPrivate {
    }

    class KeyModelClass {
        public parent_class: GObject.ObjectClass;
    }

    class KeyModelPrivate {
    }

    class ColumnModelClass {
        public parent_class: Caribou.ScannableGroupClass;
    }

    class ColumnModelPrivate {
    }

    class ScannerClass {
        public parent_class: GObject.ObjectClass;
    }

    class ScannerPrivate {
    }

    class ScannableGroupClass {
        public parent_class: GObject.ObjectClass;
        get_scan_children: { (self: Caribou.ScannableGroup, result_length1: number): Caribou.IScannableItem[]; };
        child_select: { (self: Caribou.ScannableGroup): Caribou.IScannableItem; };
    }

    class ScannableGroupPrivate {
    }

    class IScannableItemIface {
        public parent_iface: GObject.TypeInterface;
        get_scan_stepping: { (self: Caribou.IScannableItem): boolean; };
        set_scan_stepping: { (self: Caribou.IScannableItem, value: boolean): void; };
        get_scan_selected: { (self: Caribou.IScannableItem): boolean; };
        set_scan_selected: { (self: Caribou.IScannableItem, value: boolean): void; };
    }

    class IScannableGroupIface {
        public parent_iface: GObject.TypeInterface;
        child_select: { (self: Caribou.IScannableGroup): Caribou.IScannableItem; };
        scan_reset: { (self: Caribou.IScannableGroup): void; };
        get_scan_children: { (self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[]; };
        child_step: { (self: Caribou.IScannableGroup, cycles: number): Caribou.IScannableItem; };
        get_step_path: { (self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[]; };
        get_selected_path: { (self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[]; };
        get_scan_grouping: { (self: Caribou.IScannableGroup): Caribou.ScanGrouping; };
        set_scan_grouping: { (self: Caribou.IScannableGroup, value: Caribou.ScanGrouping): void; };
    }

    class IKeyboardObjectIface {
        public parent_iface: GObject.TypeInterface;
        get_children: { (self: Caribou.IKeyboardObject, result_length1: number): Caribou.IKeyboardObject[]; };
        get_keys: { (self: Caribou.IKeyboardObject, result_length1: number): Caribou.KeyModel[]; };
    }

    interface IScannableItem {
        get_scan_stepping(): boolean;
        set_scan_stepping(value: boolean): void;
        get_scan_selected(): boolean;
        set_scan_selected(value: boolean): void;
    }

    var IScannableItem: {
    }



    interface IScannableGroup {
        child_select(): Caribou.IScannableItem;
        scan_reset(): void;
        get_scan_children(result_length1: number): Caribou.IScannableItem[];
        child_step(cycles: number): Caribou.IScannableItem;
        get_step_path(result_length1: number): Caribou.IScannableItem[];
        get_selected_path(result_length1: number): Caribou.IScannableItem[];
        get_scan_grouping(): Caribou.ScanGrouping;
        set_scan_grouping(value: Caribou.ScanGrouping): void;
    }

    var IScannableGroup: {
    }



    interface IKeyboardObject {
        get_children(result_length1: number): Caribou.IKeyboardObject[];
        get_keys(result_length1: number): Caribou.KeyModel[];
    }

    var IKeyboardObject: {
    }



    enum ModifierState {
        NONE = 0,
        LATCHED = 1,
        LOCKED = 2
    }

    enum ScanGrouping {
        NONE = 0,
        SUBGROUPS = 1,
        ROWS = 2,
        LINEAR = 3
    }

    interface KeyButtonCallback {
        (keybuttoncode: number, pressed: boolean, user_data: any): void;
    }

}