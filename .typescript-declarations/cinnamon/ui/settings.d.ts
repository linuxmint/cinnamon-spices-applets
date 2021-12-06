/**
 * @short_description File providing settings objects for xlets.
 *
 * This file provides the settings API for applets, desklets and extensions.
 */
declare namespace imports.ui.settings {

	/**
	 * ENUM:BindingDirection
	 * @IN: Set the property at binding time, and automatically update the property
	 * and execute the callback when the setting file changes.  This is probably
	 * the most common mode.
	 *
	 * @OUT: Set the property at binding time, and automatically update the setting
	 * file when the property changes.  The callback can be omitted when using this
	 * mode, as it will not be used.
	 *
	 * @BIDIRECTIONAL: Combines the effects of `IN` and `OUT`.
	 *
	 * The direction of binding settings
	 *
	 * Deprecated since 3.2: Binding direction is no longer meaningful. Please do not
	 * use in new code.
	 */
	enum BindingDirection {
		IN = 1,
		OUT = 2,
		BIDIRECTIONAL = 3
	}

	const SETTINGS_TYPES: any;

	const NON_SETTING_TYPES: any;

	function settings_not_initialized_error(uuid: string): void;

	function key_not_found_error(key_name: string, uuid: string): void;

	function invalidKeyValueError(key_name: string, uuid: string): void;

	function invalid_setting_type_error(key_name: string, uuid: string, type: string): void;

	function options_not_supported_error(key_name: string, uuid: string, type: string): void;

	function binding_not_found_error(key_name: string, uuid: string): void;

	function has_required_fields(props: any, key: string): boolean;

	type SettingsEmitters = "settings-changed";

	/**
	 * #XletSettingsBase:
	 * @short_description: Object for handling xlet settings updates
	 *
	 * This object provides methods for binding settings to object properties, connecting
	 * to signal change events, and getting and setting values. This class should not be
	 * directly, but rather through one of the wrapper classes (#AppletSettings,
	 * #DeskletSettings, or #ExtensionSettings)
	 */
	class XletSettingsBase {
		public isReady: boolean;
		public bindObject: any;
		public uuid: string;
		public instanceID: string;
		public bindings: any;
		public settingsData: any;

		public constructor(bindObject: any, uuid: string, instanceId: number)

		/**
		 * Like bind this allows you to bind a setting to a property on an object. But unlike
		 * {@link bind}, this function allows you to specify the bindObject to which the property will
		 * be bound.
		 * 
		 * @param bindObject the object to which the setting will be bound
		 * or null to use the bindObject passed to %_init
		 * @param key the id of the setting
		 * @param applet_prop the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @param callback the function to call when the setting changes
		 * @param user_data any extra data/object you wish to pass to the callback
		 *
		 * @returns Whether the bind was successful
		 */
		public bindWithObject<T>(bindObject: any | null, key: string, applet_prop: string, callback?: (arg?: T) => any, user_data?: T): boolean;

		/**
		 * Bind a setting to a property on the bindObject passed to %_init.
		 * @param key the id of the setting
		 * @param applet_prop the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @param callback the function to call when the setting changes
		 * @param user_data any extra data/object you wish to pass to the callback
		 *
		 * @returns Whether the bind was successful
		 */
		public bind<T>(key: string, applet_prop: string, callback?: (arg?: T) => any, user_data?: T): boolean;

		/**
		 * @deprecated
		 * Bind a setting to a property on the object passed to %_init. This
		 * function is deprecated and is now only a wrapper around {@link bind} for backward
		 * compatibility. Please use {@link bind} instead.
		 * 
		 * @param direction the direction of the binding
		 * @param key the id of the setting
		 * @param applet_prop the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @param callback the function to call when the setting changes
		 * @param user_data any extra data/object you wish to pass to the callback
		 *
		 * @returns Whether the bind was successful
		 */
		public bindProperty<T>(direction: BindingDirection, key: string, applet_prop: string, callback?: (arg?: T) => any, user_data?: T): boolean;

		/**
		 * Removes the binding on an object. If you have bound {@link key} to multiple objects, this will
		 * only remove the one bound to {@link bindObject}. If you wish to remove all bindings, or you used
		 * {@link bind} or {@link bindProperty} to bind the setting, it is recommended that you use {@link unbindProperty}
		 * instead.
		 * 
		 * @param bindObject the object from which the setting will be unbound
		 * @param key the previously bound key to remove
		 *		 *
		 * @returns Whether the unbind was successful.
		 */
		public unbindWithObject(bindObject: any, key: string): boolean;

		/**
		 * Removes the binding on an object that was bound using the {@link bind} function. If you have bound
		 * {@link key} to multiple objects using {@link bindWithObject}, you should use {@link unbindWithObject} or {@link unbindAll}
		 * instead.
		 * @param key the previously bound key to remove
		 *
		 * @returns Whether the unbind was successful.
		 */
		public unbind(key: string): boolean;

		/**
		 * @deprecated
		 * Removes the binding of a key that was bound using {@link bind}, or {@link bindProperty}. This
		 * function is deprecated and is now only a wrapper around {@link unbind} for backward
		 * compatibility. Please use {@link unbind} instead.
		 * @param key the previously bound key to remove
		 * @returns Whether the unbind was successful.
		 */
		public unbindProperty(key: string): boolean;

		/**
		 * Removes all bindings of a key that were bound using {@link bind}, {@link bindWithObject}, or {@link bindProperty}.
		 * @param key the previously bound key to remove
		 * @returns Whether the unbind was successful.
		 */
		public unbindAll(key: string): boolean;

		protected _getValue(key: string): any;

		protected _setValue(value: any, key: string): void;

		/**
		 * Gets the value of the setting @key.
		 * @param key (string): the name of the settings key
		 * @returns: The current value of the setting
		 */
		public getValue<T = any>(key: string): T;

		/**
		 * Sets the value of the setting @key to @value.
		 * @param key the name of the settings key
		 * @param value the new value
		 *
		 */
		public setValue<T = any>(key: string, value: T): void;

		/**
		 * Gets the default value of the setting @key.
		 * @param key the name of the settings key
		 * @returns The default value of the setting
		 */
		public getDefaultValue<T = any>(key: string): T;

		/**
		 * Gets the current available options for the setting @key.
		 * @param key the name of the settings key
		 * @returns The currently stored options of the key (or undefined if the key does
		 * not support options)
		 */
		public getOptions(key: string): any | null;

		/**
		 * Sets the available options of {@link key} to {@link options}. An error is given if the setting
		 * does not support options.
		 * @param key the name of the settings key
		 * @param options the new options to set
		 */
		public setOptions(key: string, options: any): void;

		protected _checkSettings(): void;

		protected _loadTemplate(checksum: string): any[];

		protected _ensureSettingsFiles(): boolean;

		protected _doInstall(templateData: any): void;

		protected _doUpgrade(templateData: any): void;

		protected _checkSanity(val: any, setting: any): void;

		protected _loadFromFile(): any;

		protected _saveToFile(): void;

		// called by cinnamonDBus.js to when the setting is changed remotely. This is to expedite the
		// update due to settings changes, as the file monitor has a significant delay.
		protected remoteUpdate(key: string, payload: any): void;

		/**
		 *
		 * Removes all bindings and disconnects all signals. This function should be called prior
		 * to deleting the object.
		 */
		public finalize(): void;

		public connect(emitter: string, callback: Function): void;
	}


	/**
	 * #AppletSettings:
	 * @short_description: Settings object for applets.
	 *
	 * Inherits: Settings.XletSettingsBase
	 */
	class AppletSettings extends XletSettingsBase {
		/**
		 * @xlet (Object): the object variables are binded to (usually `this`)
		 * @uuid (string): uuid of the applet
		 * @instanceId (int): instance id of the applet
		 */
		public constructor(xlet: any, uuid: string, instanceId: number);

		protected _get_is_multi_instance_xlet(uuid: string): boolean;
	}

	/**
	 * #DeskletSettings:
	 * @short_description: Settings object for desklets.
	 *
	 * Inherits: Settings.XletSettingsBase
	 */
	class DeskletSettings extends XletSettingsBase {
		/**
		 * @xlet (Object): the object variables are binded to (usually `this`)
		 * @uuid (string): uuid of the desklet
		 * @instanceId (int): instance id of the desklet
		 */
		public constructor(xlet: any, uuid: string, instanceId: number);

		protected _get_is_multi_instance_xlet(uuid: string): boolean;
	}

	/**
	 * #ExtensionSettings:
	 * @short_description: Settings object for extensions.
	 *
	 * Inherits: Settings.XletSettingsBase
	 */
	class ExtensionSettings extends XletSettingsBase {
		/*
		 * @xlet (Object): the object variables are binded to (usually `this`)
		 * @uuid (string): uuid of the extension
		 */
		public constructor(xlet: any, uuid: string);

		protected _get_is_multi_instance_xlet(uuid: string): boolean;
	}

	class SettingsManager {
		public uuids: any;

		public register(uuid: string, instance_id: number, obj: any): void;

		public unregister(uuid: string, instance_id: number): void;
	}

}