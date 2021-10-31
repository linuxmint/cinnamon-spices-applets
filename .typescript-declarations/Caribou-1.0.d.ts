declare namespace imports.gi.Caribou {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DisplayAdapter} instead.
	 */
	interface IDisplayAdapter {
		display: Gdk.Display;
		keyval_press(keyval: number): void;
		keyval_release(keyval: number): void;
		mod_lock(mask: number): void;
		mod_unlock(mask: number): void;
		mod_latch(mask: number): void;
		mod_unlatch(mask: number): void;
		get_current_group(group_name: string, variant_name: string): number;
		get_groups(group_names: string[], group_names_length1: number, variant_names: string[], variant_names_length1: number): void;
		register_key_func(keyval: number, _func: Caribou.KeyButtonCallback | null, func_target: any | null): void;
		register_button_func(button: number, _func: Caribou.KeyButtonCallback | null, func_target: any | null): void;
		get_display(): Gdk.Display;
		connect(signal: "modifiers-changed", callback: (owner: this, modifiers: number) => void): number;
		connect(signal: "group-changed", callback: (owner: this, gid: number, group: string, variant: string) => void): number;
		connect(signal: "config-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::display", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DisplayAdapter} instead.
	 */
	type DisplayAdapterMixin = IDisplayAdapter & GObject.IObject;

	interface DisplayAdapter extends DisplayAdapterMixin {}

	class DisplayAdapter {
		public constructor();
		public static set_default(adapter: Caribou.DisplayAdapter): boolean;
		public static get_default(): Caribou.DisplayAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link NullAdapter} instead.
	 */
	interface INullAdapter {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link NullAdapter} instead.
	 */
	type NullAdapterMixin = INullAdapter & Caribou.IDisplayAdapter;

	interface NullAdapter extends NullAdapterMixin {}

	class NullAdapter {
		public constructor();
		public static new(): Caribou.NullAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XAdapter} instead.
	 */
	interface IXAdapter {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XAdapter} instead.
	 */
	type XAdapterMixin = IXAdapter & Caribou.IDisplayAdapter;

	interface XAdapter extends XAdapterMixin {}

	class XAdapter {
		public constructor();
		public static new(): Caribou.XAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardModel} instead.
	 */
	interface IKeyboardModel {
		active_group: string;
		keyboard_type: string;
		keyboard_file: string;
		get_groups(result_length1: number): string[];
		get_group(group_name: string): Caribou.GroupModel;
		get_active_group(): string;
		get_keyboard_type(): string;
		get_keyboard_file(): string;
		connect(signal: "group-added", callback: (owner: this, name: string) => void): number;
		connect(signal: "group-removed", callback: (owner: this, name: string) => void): number;

		connect(signal: "notify::active_group", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::keyboard_type", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::keyboard_file", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardModel} instead.
	 */
	type KeyboardModelMixin = IKeyboardModel & GObject.IObject & Caribou.IIKeyboardObject;

	interface KeyboardModel extends KeyboardModelMixin {}

	class KeyboardModel {
		public constructor(options?: Partial<KeyboardModelOptions>);
		public static new(): Caribou.KeyboardModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardService} instead.
	 */
	interface IKeyboardService {
		set_cursor_location(_x: number, _y: number, _w: number, _h: number): void;
		set_entry_location(_x: number, _y: number, _w: number, _h: number): void;
		show(timestamp: number): void;
		hide(timestamp: number): void;
		register_keyboard(name: string): void;
		name_lost(name: string): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardService} instead.
	 */
	type KeyboardServiceMixin = IKeyboardService & GObject.IObject;

	interface KeyboardService extends KeyboardServiceMixin {}

	class KeyboardService {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GroupModel} instead.
	 */
	interface IGroupModel {
		active_level: string;
		readonly group: string;
		readonly variant: string;
		get_levels(result_length1: number): string[];
		get_level(level_name: string): Caribou.LevelModel;
		get_active_level(): string;
		connect(signal: "notify::active_level", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::group", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::variant", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GroupModel} instead.
	 */
	type GroupModelMixin = IGroupModel & GObject.IObject & Caribou.IIKeyboardObject;

	interface GroupModel extends GroupModelMixin {}

	class GroupModel {
		public constructor();
		public static new(group: string, variant: string): Caribou.GroupModel;
		public static create_group_name(group: string, variant: string): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link LevelModel} instead.
	 */
	interface ILevelModel {
		mode: string;
		get_rows(result_length1: number): Caribou.RowModel[];
		get_mode(): string;
		connect(signal: "level-toggled", callback: (owner: this, new_level: string) => void): number;

		connect(signal: "notify::mode", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link LevelModel} instead.
	 */
	type LevelModelMixin = ILevelModel & Caribou.IScannableGroup & Caribou.IIKeyboardObject;

	interface LevelModel extends LevelModelMixin {}

	class LevelModel {
		public constructor();
		public static new(mode: string): Caribou.LevelModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RowModel} instead.
	 */
	interface IRowModel {
		get_columns(result_length1: number): Caribou.ColumnModel[];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RowModel} instead.
	 */
	type RowModelMixin = IRowModel & Caribou.IScannableGroup & Caribou.IIScannableItem & Caribou.IIKeyboardObject;

	interface RowModel extends RowModelMixin {}

	class RowModel {
		public constructor();
		public static new(): Caribou.RowModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyModel} instead.
	 */
	interface IKeyModel {
		align: string;
		width: number;
		toggle: string;
		repeatable: boolean;
		is_modifier: boolean;
		show_subkeys: boolean;
		name: string;
		keyval: number;
		text: string;
		label: string;
		readonly modifier_state: Caribou.ModifierState;
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
		get_text(): string | null;
		get_label(): string;
		set_label(value: string): void;
		connect(signal: "key-hold-end", callback: (owner: this) => void): number;
		connect(signal: "key-hold", callback: (owner: this) => void): number;

		connect(signal: "notify::align", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::width", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::toggle", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::repeatable", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::is_modifier", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::show_subkeys", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::keyval", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::label", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::modifier_state", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyModel} instead.
	 */
	type KeyModelMixin = IKeyModel & GObject.IObject & Caribou.IIScannableItem & Caribou.IIKeyboardObject;

	interface KeyModel extends KeyModelMixin {}

	class KeyModel {
		public constructor();
		public static new(name: string, text: string | null): Caribou.KeyModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ColumnModel} instead.
	 */
	interface IColumnModel {
		get_key(index: number): Caribou.KeyModel;
		first_key(): Caribou.KeyModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ColumnModel} instead.
	 */
	type ColumnModelMixin = IColumnModel & Caribou.IScannableGroup & Caribou.IIScannableItem & Caribou.IIKeyboardObject;

	interface ColumnModel extends ColumnModelMixin {}

	class ColumnModel {
		public constructor();
		public static new(): Caribou.ColumnModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scanner} instead.
	 */
	interface IScanner {
		bind_settings: boolean;
		scan_grouping: number;
		scan_enabled: boolean;
		step_time: number;
		switch_device: string;
		keyboard_key: string;
		mouse_button: number;
		scan_cycles: number;
		autorestart: boolean;
		inverse_scanning: boolean;
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
		connect(signal: "notify::bind_settings", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::scan_grouping", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::scan_enabled", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::step_time", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::switch_device", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::keyboard_key", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::mouse_button", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::scan_cycles", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::autorestart", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::inverse_scanning", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scanner} instead.
	 */
	type ScannerMixin = IScanner & GObject.IObject;

	interface Scanner extends ScannerMixin {}

	class Scanner {
		public constructor();
		public static new(): Caribou.Scanner;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScannableGroup} instead.
	 */
	interface IScannableGroup {
		get_scan_children(result_length1: number): Caribou.IScannableItem[];
		child_select(): Caribou.IScannableItem | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScannableGroup} instead.
	 */
	type ScannableGroupMixin = IScannableGroup & GObject.IObject & Caribou.IIScannableGroup;

	interface ScannableGroup extends ScannableGroupMixin {}

	class ScannableGroup {
		public constructor();
	}

	interface DisplayAdapterClass {}
	class DisplayAdapterClass {
		public constructor();
		public keyval_press: {(self: Caribou.DisplayAdapter, keyval: number): void;};
		public keyval_release: {(self: Caribou.DisplayAdapter, keyval: number): void;};
		public mod_lock: {(self: Caribou.DisplayAdapter, mask: number): void;};
		public mod_unlock: {(self: Caribou.DisplayAdapter, mask: number): void;};
		public mod_latch: {(self: Caribou.DisplayAdapter, mask: number): void;};
		public mod_unlatch: {(self: Caribou.DisplayAdapter, mask: number): void;};
		public get_current_group: {(self: Caribou.DisplayAdapter, group_name: string, variant_name: string): number;};
		public get_groups: {(self: Caribou.DisplayAdapter, group_names: string[], group_names_length1: number, variant_names: string[], variant_names_length1: number): void;};
		public register_key_func: {(self: Caribou.DisplayAdapter, keyval: number, _func: Caribou.KeyButtonCallback | null, func_target: any | null): void;};
		public register_button_func: {(self: Caribou.DisplayAdapter, button: number, _func: Caribou.KeyButtonCallback | null, func_target: any | null): void;};
	}

	interface DisplayAdapterPrivate {}
	class DisplayAdapterPrivate {
		public constructor();
	}

	interface NullAdapterClass {}
	class NullAdapterClass {
		public constructor();
	}

	interface NullAdapterPrivate {}
	class NullAdapterPrivate {
		public constructor();
	}

	interface XAdapterClass {}
	class XAdapterClass {
		public constructor();
	}

	interface XAdapterPrivate {}
	class XAdapterPrivate {
		public constructor();
	}

	interface KeyboardModelClass {}
	class KeyboardModelClass {
		public constructor();
	}

	interface KeyboardModelPrivate {}
	class KeyboardModelPrivate {
		public constructor();
	}

	interface KeyboardServiceClass {}
	class KeyboardServiceClass {
		public constructor();
		public set_cursor_location: {(self: Caribou.KeyboardService, _x: number, _y: number, _w: number, _h: number): void;};
		public set_entry_location: {(self: Caribou.KeyboardService, _x: number, _y: number, _w: number, _h: number): void;};
		public show: {(self: Caribou.KeyboardService, timestamp: number): void;};
		public hide: {(self: Caribou.KeyboardService, timestamp: number): void;};
		public name_lost: {(self: Caribou.KeyboardService, name: string): void;};
	}

	interface KeyboardServicePrivate {}
	class KeyboardServicePrivate {
		public constructor();
	}

	interface GroupModelClass {}
	class GroupModelClass {
		public constructor();
	}

	interface GroupModelPrivate {}
	class GroupModelPrivate {
		public constructor();
	}

	interface LevelModelClass {}
	class LevelModelClass {
		public constructor();
	}

	interface LevelModelPrivate {}
	class LevelModelPrivate {
		public constructor();
	}

	interface RowModelClass {}
	class RowModelClass {
		public constructor();
	}

	interface RowModelPrivate {}
	class RowModelPrivate {
		public constructor();
	}

	interface KeyModelClass {}
	class KeyModelClass {
		public constructor();
	}

	interface KeyModelPrivate {}
	class KeyModelPrivate {
		public constructor();
	}

	interface ColumnModelClass {}
	class ColumnModelClass {
		public constructor();
	}

	interface ColumnModelPrivate {}
	class ColumnModelPrivate {
		public constructor();
	}

	interface ScannerClass {}
	class ScannerClass {
		public constructor();
	}

	interface ScannerPrivate {}
	class ScannerPrivate {
		public constructor();
	}

	interface ScannableGroupClass {}
	class ScannableGroupClass {
		public constructor();
		public get_scan_children: {(self: Caribou.ScannableGroup, result_length1: number): Caribou.IScannableItem[];};
		public child_select: {(self: Caribou.ScannableGroup): Caribou.IScannableItem | null;};
	}

	interface ScannableGroupPrivate {}
	class ScannableGroupPrivate {
		public constructor();
	}

	interface IScannableItemIface {}
	class IScannableItemIface {
		public constructor();
		public readonly parent_iface: GObject.TypeInterface;
		public get_scan_stepping: {(self: Caribou.IScannableItem): boolean;};
		public set_scan_stepping: {(self: Caribou.IScannableItem, value: boolean): void;};
		public get_scan_selected: {(self: Caribou.IScannableItem): boolean;};
		public set_scan_selected: {(self: Caribou.IScannableItem, value: boolean): void;};
	}

	interface IScannableGroupIface {}
	class IScannableGroupIface {
		public constructor();
		public readonly parent_iface: GObject.TypeInterface;
		public child_select: {(self: Caribou.IScannableGroup): Caribou.IScannableItem | null;};
		public scan_reset: {(self: Caribou.IScannableGroup): void;};
		public get_scan_children: {(self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[];};
		public child_step: {(self: Caribou.IScannableGroup, cycles: number): Caribou.IScannableItem | null;};
		public get_step_path: {(self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[];};
		public get_selected_path: {(self: Caribou.IScannableGroup, result_length1: number): Caribou.IScannableItem[];};
		public get_scan_grouping: {(self: Caribou.IScannableGroup): Caribou.ScanGrouping;};
		public set_scan_grouping: {(self: Caribou.IScannableGroup, value: Caribou.ScanGrouping): void;};
	}

	interface IKeyboardObjectIface {}
	class IKeyboardObjectIface {
		public constructor();
		public readonly parent_iface: GObject.TypeInterface;
		public get_children: {(self: Caribou.IKeyboardObject, result_length1: number): Caribou.IKeyboardObject[];};
		public get_keys: {(self: Caribou.IKeyboardObject, result_length1: number): Caribou.KeyModel[];};
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableItem} instead.
	 */
	interface IIScannableItem {
		scan_stepping: boolean;
		scan_selected: boolean;
		get_scan_stepping(): boolean;
		set_scan_stepping(value: boolean): void;
		get_scan_selected(): boolean;
		set_scan_selected(value: boolean): void;
		connect(signal: "notify::scan_stepping", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::scan_selected", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableItem} instead.
	 */
	type IScannableItemMixin = IIScannableItem;

	interface IScannableItem extends IScannableItemMixin {}

	class IScannableItem {
		public constructor();
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableGroup} instead.
	 */
	interface IIScannableGroup {
		scan_grouping: Caribou.ScanGrouping;
		child_select(): Caribou.IScannableItem | null;
		scan_reset(): void;
		get_scan_children(result_length1: number): Caribou.IScannableItem[];
		child_step(cycles: number): Caribou.IScannableItem | null;
		get_step_path(result_length1: number): Caribou.IScannableItem[];
		get_selected_path(result_length1: number): Caribou.IScannableItem[];
		get_scan_grouping(): Caribou.ScanGrouping;
		set_scan_grouping(value: Caribou.ScanGrouping): void;
		connect(signal: "selected-item-changed", callback: (owner: this, selected_item: Caribou.IScannableItem | null) => void): number;
		connect(signal: "step-item-changed", callback: (owner: this, step_item: Caribou.IScannableItem | null) => void): number;
		connect(signal: "scan-cleared", callback: (owner: this) => void): number;

		connect(signal: "notify::scan_grouping", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableGroup} instead.
	 */
	type IScannableGroupMixin = IIScannableGroup;

	interface IScannableGroup extends IScannableGroupMixin {}

	class IScannableGroup {
		public constructor();
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IKeyboardObject} instead.
	 */
	interface IIKeyboardObject {
		get_children(result_length1: number): Caribou.IKeyboardObject[];
		get_keys(result_length1: number): Caribou.KeyModel[];
		connect(signal: "key-clicked", callback: (owner: this, key: Caribou.KeyModel) => void): number;
		connect(signal: "key-pressed", callback: (owner: this, key: Caribou.KeyModel) => void): number;
		connect(signal: "key-released", callback: (owner: this, key: Caribou.KeyModel) => void): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IKeyboardObject} instead.
	 */
	type IKeyboardObjectMixin = IIKeyboardObject;

	interface IKeyboardObject extends IKeyboardObjectMixin {}

	class IKeyboardObject {
		public constructor();
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
		(keybuttoncode: number, pressed: boolean): void;
	}

}