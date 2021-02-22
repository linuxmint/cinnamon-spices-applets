declare namespace imports.misc.signalManager {

	/**
	 *#SignalManager:
	* @short_description: A convenience object for managing signals
	* @_object (Object): The object owning the SignalManager. All callbacks are
	* binded to %_object unless otherwise specified.
	* @_storage (Array): An array that stores all the connected signals. Each
	* signal is stored as an array in the form `[signalName, object, callback,
	* signalId]`.
	*
	* The #SignalManager is a convenience object for managing signals. If you use
	* this to connect signals, you can later disconnect them by signal name or
	* just disconnect everything! No need to keep track of those annoying
	* @signalIds by yourself anymore!
	*
	* A common use case is to use the #SignalManager to connect to signals and then
	* use the @disconnectAllSignals function when the object is destroyed, to
	* avoid keeping track of all the signals manually.
	*
	* However, this is not always needed. If you are connecting to a signal of
	* your actor, the signals are automatically disconnected when you destroy the
	* actor. Using the #SignalManager to disconnect all signals is only needed when
	* connecting to objects that persists after the object disappears.
	*
	* Every Javascript object should have its own @SignalManager, and use it to
	* connect signals of all objects it takes care of. For example, the panel will
	* have one #SignalManger object, which manages all signals from #GSettings,
	* `global.screen` etc.
	*
	* An example usage is as follows:
	* ```
	* class MyApplet extends Applet.Applet {
	*     constructor(orientation, panelHeight, instanceId) {
	*         super(orientation, panelHeight, instanceId);
	*
	*         this._signalManager = new SignalManager.SignalManager(null);
	*         this._signalManager.connect(global.settings, "changed::foo", (...args) => this._onChanged(...args));
	*     }
	*
	*     _onChanged() {
	*         // Do something
	*     }
	*
	*     on_applet_removed_from_panel() {
	*         this._signalManager.disconnectAllSignals();
	*     }
	* }
	* ```
	*/
	export class SignalManager {
		/**
		 * @object (Object): the object owning the #SignalManager (usually this) (Deprecated)
		 */
		constructor(object?: any);

		/**
		 * This listens to the signal @sigName from @obj and calls @callback when
		 * the signal is emitted. @callback is bound to the @bind argument if passed.
		 *
		 * This checks whether the signal is already connected and will not connect
		 * again if it is already connected. This behaviour can be overridden by
		 * settings @force to be @true.
		 *
		 * For example, what you would normally write as
		 * ```
		 * global.settings.connect("changed::foo", Lang.bind(this, this._bar))
		 * ```
		 * would become
		 * ```
		 * this._signalManager.connect(global.settings, "changed::foo", this._bar)
		 * ```
		 * Note that in this function, the first argument is the object, while the
		 * second is the signal name. In all other methods, you first pass the
		 * signal name, then the object (since the object is rarely passed in other
		 * functions).
		 * @param obj the object whose signal we are listening to
		 * @param sigName the name of the signal we are listening to
		 * @param callback the callback function
		 * @param bind the object to bind the function to. Leave
		 * empty for the owner of the #SignalManager (which has no side effects if
		 * you don't need to bind at all).
		 * @param force whether to connect again even if it is connected
		 */
		connect(obj: any, sigName: string, callback: Function, bind?: any, force?: boolean): void;

		connect_after(obj: any, sigName: string, callback: Function, bind?: any, force?: boolean): void;

		/**
		 * This checks whether the signal @sigName is connected. The optional
		 * arguments @obj and @callback can be used to specify what signals in
		 * particular we want to know. Note that when you supply @callBack, you
		 * usually want to supply @obj as well, since two different objects can
		 * connect to the same signal with the same callback.
		 *
		 * This is functionally equivalent to (and implemented as)
		 * ```
		 * this.getSignals(arguments).length > 0);
		 * ```
		 * @param sigName the signal we care about
		 * @param obj the object we care about, or leave empty if we
		 * don't care about which object it is
		 * @param callback the callback function we care about, or
		 * leave empty if we don't care about what callback is connected
		 * @returns Whether the signal is connected
		 */
		isConnected(sigName: string, obj?: any, callback?: Function): boolean;

		/**
		 * getSignals:
		 * @sigName (string): the signal we care about
		 * @obj (Object): (optional) the object we care about, or leave empty if we
		 * don't care about which object it is
		 * @callback (function): (optional) the callback function we care about, or
		 * leave empty if we don't care about what callback is connected
		 *
		 * This returns the list of all signals that matches the description
		 * provided. Each signal is represented by an array in the form
		 * `[signalName, object, callback, signalId]`.
		 *
		 * Returns (Array): The list of signals
		 */
		getSignals(sigName: string, obj?: any, callback?: Function): Signal[];

		/**
		 * disconnect:
		 * @sigName (string): the signal we care about
		 * @obj (Object): (optional) the object we care about, or leave empty if we
		 * don't care about which object it is
		 * @callback (function): (optional) the callback function we care about, or
		 * leave empty if we don't care about what callback is connected
		 *
		 * This disconnects all *signals* named @sigName. By default, it
		 * disconnects the signal on all objects, but can be fine-tuned with the
		 * optional @obj and @callback arguments.
		 *
		 * This function will do nothing if no such signal is connected, the object
		 * no longer exists, or the signal is somehow already disconnected. So
		 * checks need not be performed before calling this function.
		 */

		/**
		 * This disconnects all *signals* named @sigName. By default, it
		* disconnects the signal on all objects, but can be fine-tuned with the
		* optional @obj and @callback arguments.
		*
		* This function will do nothing if no such signal is connected, the object
		* no longer exists, or the signal is somehow already disconnected. So
		* checks need not be performed before calling this function.
		 * @param signName the signal we care about
		 * @param obj the object we care about, or leave empty if we
		* don't care about which object it is
		 * @param callback the callback function we care about, or
		* leave empty if we don't care about what callback is connected
		 */
		disconnect(signName: string, obj?: any, callback?: Function): void;

		/**
		 * Disconnects *all signals* managed by the #SignalManager. This is useful
		 * in the @destroy function of objects.
		 */
		disconnectAllSignals(): void;
	}

	interface Signal {
		signalName: string;
		object: any;
		callback: Function;
		signalId: number;
	}
}
