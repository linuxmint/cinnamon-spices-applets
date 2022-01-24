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
		 * bindWithObject:
		 * @bindObject (object): (optional) the object to which the setting will be bound
		 * or null to use the bindObject passed to %_init
		 * @key (string): the id of the setting
		 * @applet_prop (string): the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @callback (function): (optional) the function to call when the setting changes
		 * @user_data: (optional) any extra data/object you wish to pass to the callback
		 *
		 * Like bind this allows you to bind a setting to a property on an object. But unlike
		 * %bind, this function allows you to specify the bindObject to which the property will
		 * be bound.
		 *
		 * Returns (boolean): Whether the bind was successful
		 */
		public bindWithObject<T>(bindObject: any, key: string, applet_prop: string, callback?: (arg?: T) => any, user_data?: T): boolean;

		/**
		 * bind:
		 * @key (string): the id of the setting
		 * @applet_prop (string): the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @callback (function): (optional) the function to call when the setting changes
		 * @user_data: (optional) any extra data/object you wish to pass to the callback
		 *
		 * Bind a setting to a property on the @bindObject passed to %_init.
		 *
		 * Returns (boolean): Whether the bind was successful
		 */
		public bind<T = undefined>(key: string, applet_prop: string, callback?: (arg: T) => any, user_data?: T): boolean;

		/**
		 * bindProperty:
		 * @direction (Settings.BindingDirection): the direction of the binding
		 * @key (string): the id of the setting
		 * @applet_prop (string): the variable name that is used to hold the
		 * setting (eg. `this.value` passes as `"value`")
		 * @callback (function): (optional) the function to call when the setting changes
		 * @user_data: (optional) any extra data/object you wish to pass to the callback
		 *
		 * Bind a setting to a property on the object @bindObject passed to %_init. This
		 * function is deprecaed and is now only a wrapper around %bind for backward
		 * compatibility. Please use %bind instead.
		 *
		 * Returns (boolean): Whether the bind was successful
		 */
		public bindProperty<T>(direction: BindingDirection, key: string, applet_prop: string, callback?: (arg?: T) => any, user_data?: T): boolean;

		/**
		 * unbindWithObject:
		 * @bindObject (object): (optional) the object from which the setting will be unbound
		 * @key (string): the previously bound key to remove
		 *
		 * Removes the binding on an object. If you have bound @key to multiple objects, this will
		 * only remove the one bound to @bindObject. If you wish to remove all bindings, or you used
		 * %bind or %bindProperty to bind the setting, it is recommended that you use %unbindPropery
		 * instead.
		 *
		 * Returns (boolean): Whether the unbind was successful.
		 */
		public unbindWithObject(bindObject: any, key: string): boolean;

		/**
		 * unbind:
		 * @key (string): the previously bound key to remove
		 *
		 * Removes the binding on an object that was bound using the %bind function. If you have bound
		 * @key to multiple objects using %bindWithObject, you should use %unbindWithObject or %unbindAll
		 * instead.
		 *
		 * Returns (boolean): Whether the unbind was successful.
		 */
		public unbind(key: string): boolean;

		/**
		 * unbindProperty:
		 * @key (string): the previously bound key to remove
		 *
		 * Removes the binding of a key that was bound using %bind, or %bindProperty. This
		 * function is deprecaed and is now only a wrapper around %unbind for backward
		 * compatibility. Please use %unbind instead.
		 *
		 * Returns (boolean): Whether the unbind was successful.
		 */
		public unbindProperty(key: string): boolean;

		/**
		 * unbindAll:
		 * @key (string): the previously bound key to remove
		 *
		 * Removes all bindings of a key that were bound using %bind, %bindWithObject, or %bindProperty.
		 *
		 * Returns (boolean): Whether the unbind was successful.
		 */
		public unbindAll(key: string): boolean;

		protected _getValue(key: string): any;

		protected _setValue(value: any, key: string): void;

		/**
		 * getValue:
		 * @key (string): the name of the settings key
		 *
		 * Gets the value of the setting @key.
		 *
		 * Returns: The current value of the setting
		 */
		public getValue<T = any>(key: string): T;

		/**
		 * setValue:
		 * @key (string): the name of the settings key
		 * @value: the new value
		 *
		 * Sets the value of the setting @key to @value.
		 */
		public setValue<T = any>(key: string, value: T): void;

		/**
		 * getDefaultValue:
		 * @key (string): the name of the settings key
		 *
		 * Gets the default value of the setting @key.
		 *
		 * Returns: The default value of the setting
		 */
		public getDefaultValue<T = any>(key: string): T;

		/**
		 * getOptions:
		 * @key (String): the name of the settings key
		 *
		 * Gets the current available options for the setting @key.
		 *
		 * Returns: The currently stored options of the key (or undefined if the key does
		 * not support options)
		 */
		public getOptions(key: string): any | null;

		/**
		 * setOptions:
		 * @key (string): the name of the settings key
		 * @options: the new options to set
		 *
		 * Sets the available options of @key to @options. An error is given if the setting
		 * does not support options.
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
		 * finalize:
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