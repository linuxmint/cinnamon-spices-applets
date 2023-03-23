declare namespace imports.ui.keybindings {

	const CUSTOM_KEYS_PARENT_SCHEMA: string;
	const CUSTOM_KEYS_BASENAME: string;
	const CUSTOM_KEYS_SCHEMA: string;

	const MEDIA_KEYS_SCHEMA: string;

	const iface: string;

	class KeybindingManager {
		private _proxy: imports.gi.Gio.DBusProxy;
		public bindings: any[];
		public kb_schema: gi.Gio.Settings;
		public media_key_settings: gi.Gio.Settings;

		public constructor();

		public on_customs_changed(settings: gi.Gio.Settings, key: string): void;

		public addHotKey(name: string, bindings_string: string, callback: Function): boolean;

		public addHotKeyArray(name: string, bindings: any, callback: Function): boolean;

		public removeHotKey(name: string): void;

		public setup_custom_keybindings(): void;

		public remove_custom_keybindings(): void;

		public setup_media_keys(): boolean;

		public on_global_media_key_pressed(display: any, screen: any, event: gi.Clutter.Event, kb: any, action: any): void;

		public on_media_key_pressed(display: any, screen: any, event: gi.Clutter.Event, kb: any, action: any): void;
	}
}